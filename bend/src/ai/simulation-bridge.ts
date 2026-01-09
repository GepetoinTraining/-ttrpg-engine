// =============================================================================
// SIMULATION BRIDGE
// =============================================================================
//
// Fetches simulation state and transforms it for phenomenological translation.
//
// This bridges:
//   Economy Engine     → LocalEconomyState
//   Faction Engine     → FactionActivityState
//   Monster Engine     → RegionalThreatState
//   Guild Data         → GuildState
//
// The phenomenological adapter then translates these into lived experience.
//

import { queryOne, queryAll, parseJson } from "../db/client";
import type {
  LocalEconomyState,
  FactionActivityState,
  RegionalThreatState,
  GuildState,
  NPCRole,
  EconomicPressure,
} from "./phenomenology";

// =============================================================================
// FETCH SIMULATION STATE FOR A LOCATION
// =============================================================================

export interface SimulationStateOptions {
  settlementId: string;
  campaignId: string;
  npcId?: string;
}

export interface SimulationState {
  economy: LocalEconomyState;
  factions: FactionActivityState;
  threats: RegionalThreatState;
  guild?: GuildState;
}

/**
 * Fetch all simulation state relevant to an NPC at a location
 */
export async function fetchSimulationState(
  options: SimulationStateOptions
): Promise<SimulationState> {
  const { settlementId, campaignId, npcId } = options;

  // Fetch all states in parallel
  const [economy, factions, threats, guild] = await Promise.all([
    fetchLocalEconomyState(settlementId, campaignId),
    fetchFactionActivityState(settlementId, campaignId),
    fetchRegionalThreatState(settlementId, campaignId),
    npcId ? fetchGuildState(npcId, campaignId) : Promise.resolve(undefined),
  ]);

  return { economy, factions, threats, guild };
}

// =============================================================================
// ECONOMY STATE
// =============================================================================

async function fetchLocalEconomyState(
  settlementId: string,
  campaignId: string
): Promise<LocalEconomyState> {
  // Get settlement info
  const settlement = await queryOne<{
    id: string;
    name: string;
    data_dynamic: string;
  }>(
    `SELECT id, name, data_dynamic FROM world_nodes
     WHERE id = ? AND campaign_id = ?`,
    [settlementId, campaignId]
  );

  if (!settlement) {
    return createDefaultEconomyState(settlementId, "Unknown Location");
  }

  const dynamicData = parseJson<any>(settlement.data_dynamic) || {};
  const market = dynamicData.market || {};

  // Calculate price multipliers from market data
  const priceMultipliers: Record<string, number> = {};
  const shortages: string[] = [];
  const gluts: string[] = [];

  for (const price of market.prices || []) {
    priceMultipliers[price.commodityId] = price.priceMultiplier || 1;

    const ratio = price.supplyDemandRatio || 1;
    if (ratio < 0.5) shortages.push(price.commodityId);
    if (ratio > 2.0) gluts.push(price.commodityId);
  }

  // Get disrupted trade routes
  const routes = await queryAll<{
    id: string;
    from_name: string;
    to_name: string;
    data_dynamic: string;
  }>(
    `SELECT we.id, wn1.name as from_name, wn2.name as to_name,
            we.data_dynamic
     FROM world_edges we
     JOIN world_nodes wn1 ON we.from_node_id = wn1.id
     JOIN world_nodes wn2 ON we.to_node_id = wn2.id
     WHERE (we.from_node_id = ? OR we.to_node_id = ?)
       AND we.campaign_id = ?
       AND we.type = 'trade_route'`,
    [settlementId, settlementId, campaignId]
  );

  const tradeRoutesDisrupted: string[] = [];
  let tradeRoutesActive = 0;

  for (const route of routes) {
    const routeData = parseJson<any>(route.data_dynamic) || {};
    if (routeData.status === 'blocked' || routeData.status === 'disrupted') {
      tradeRoutesDisrupted.push(
        `${route.from_name} to ${route.to_name}${routeData.disruption_reason ? `: ${routeData.disruption_reason}` : ''}`
      );
    } else {
      tradeRoutesActive++;
    }
  }

  // Determine market condition from recent price trends
  const marketCondition = determineMarketCondition(market.prices || []);

  // Get recent economic events
  const recentEvents = await queryAll<{ summary: string }>(
    `SELECT summary FROM session_events
     WHERE campaign_id = ?
       AND event_type = 'economic'
       AND created_at > datetime('now', '-7 days')
     ORDER BY created_at DESC
     LIMIT 5`,
    [campaignId]
  );

  return {
    settlementId,
    settlementName: settlement.name,
    priceMultipliers,
    shortages,
    gluts,
    tradeRoutesDisrupted,
    tradeRoutesActive,
    marketCondition,
    recentEconomicEvents: recentEvents.map(e => e.summary),
  };
}

function createDefaultEconomyState(
  settlementId: string,
  settlementName: string
): LocalEconomyState {
  return {
    settlementId,
    settlementName,
    priceMultipliers: {},
    shortages: [],
    gluts: [],
    tradeRoutesDisrupted: [],
    tradeRoutesActive: 0,
    marketCondition: 'stable',
    recentEconomicEvents: [],
  };
}

function determineMarketCondition(
  prices: Array<{ trend?: string; weeklyChange?: number }>
): 'crash' | 'falling' | 'stable' | 'rising' | 'bubble' {
  if (!prices.length) return 'stable';

  const avgChange = prices.reduce((sum, p) => sum + (p.weeklyChange || 0), 0) / prices.length;
  const crashingCount = prices.filter(p => p.trend === 'crashing').length;
  const spikingCount = prices.filter(p => p.trend === 'spiking').length;

  if (crashingCount > prices.length * 0.3) return 'crash';
  if (spikingCount > prices.length * 0.3) return 'bubble';
  if (avgChange < -10) return 'falling';
  if (avgChange > 10) return 'rising';
  return 'stable';
}

// =============================================================================
// FACTION STATE
// =============================================================================

async function fetchFactionActivityState(
  settlementId: string,
  campaignId: string
): Promise<FactionActivityState> {
  // Get factions with territory in this settlement
  const factions = await queryAll<{
    id: string;
    name: string;
    data_static: string;
    data_dynamic: string;
  }>(
    `SELECT f.id, f.name, f.data_static, f.data_dynamic
     FROM factions f
     WHERE f.campaign_id = ?`,
    [campaignId]
  );

  const interventions: FactionActivityState['interventions'] = [];
  const tensions: FactionActivityState['tensions'] = [];
  const recentFactionEvents: FactionActivityState['recentFactionEvents'] = [];

  for (const faction of factions) {
    const dynamicData = parseJson<any>(faction.data_dynamic) || {};

    // Check if faction has territory here
    const territories: string[] = dynamicData.territories || [];
    const hasPresence = territories.includes(settlementId);

    if (!hasPresence) continue;

    // Get active schemes that affect this location
    const schemes = dynamicData.activeSchemes || [];
    for (const scheme of schemes) {
      if (scheme.affectedSettlements?.includes(settlementId)) {
        // Translate scheme to intervention
        const intervention = schemeToIntervention(faction.name, scheme);
        if (intervention) interventions.push(intervention);
      }
    }

    // Get faction relationships (tensions)
    const relationships = dynamicData.relationships || [];
    for (const rel of relationships) {
      if (rel.standing < -20) {
        tensions.push({
          faction1: faction.name,
          faction2: rel.factionName,
          level: rel.standing < -50 ? 'conflict' :
                 rel.standing < -35 ? 'hostile' : 'strained',
          publicKnowledge: rel.publicStance !== 'neutral',
        });
      }
    }
  }

  // Get recent faction events
  const events = await queryAll<{
    summary: string;
    faction_id: string;
    is_public: number;
  }>(
    `SELECT summary, faction_id, is_public FROM session_events
     WHERE campaign_id = ?
       AND event_type = 'faction'
       AND created_at > datetime('now', '-14 days')
     ORDER BY created_at DESC
     LIMIT 10`,
    [campaignId]
  );

  for (const event of events) {
    recentFactionEvents.push({
      description: event.summary,
      factionId: event.faction_id,
      isPublic: event.is_public === 1,
      isRumor: event.is_public === 0,
    });
  }

  return { interventions, tensions, recentFactionEvents };
}

function schemeToIntervention(
  factionName: string,
  scheme: any
): FactionActivityState['interventions'][0] | null {
  const schemeTypeMap: Record<string, FactionActivityState['interventions'][0]['type']> = {
    'economic_embargo': 'embargo',
    'trade_embargo': 'embargo',
    'impose_tariffs': 'tariff',
    'monopolize_trade': 'monopoly',
    'price_fixing': 'price_control',
    'blockade': 'blockade',
    'raise_taxes': 'tax',
  };

  const type = schemeTypeMap[scheme.type];
  if (!type) return null;

  return {
    factionName,
    type,
    target: scheme.target,
    severity: scheme.progress > 75 ? 'severe' :
              scheme.progress > 50 ? 'major' :
              scheme.progress > 25 ? 'moderate' : 'minor',
    publicKnowledge: !scheme.secret,
  };
}

// =============================================================================
// THREAT STATE
// =============================================================================

async function fetchRegionalThreatState(
  settlementId: string,
  campaignId: string
): Promise<RegionalThreatState> {
  // Get the region this settlement is in
  const settlement = await queryOne<{
    parent_id: string;
    data_dynamic: string;
  }>(
    `SELECT parent_id, data_dynamic FROM world_nodes WHERE id = ?`,
    [settlementId]
  );

  const regionId = settlement?.parent_id;

  // Get threats in the region
  const threats = await queryAll<{
    name: string;
    severity: string;
    location: string;
    is_public: number;
  }>(
    `SELECT t.name, t.severity, wn.name as location, t.is_public
     FROM threats t
     LEFT JOIN world_nodes wn ON t.location_id = wn.id
     WHERE t.campaign_id = ?
       AND t.status = 'active'
       AND (t.region_id = ? OR t.location_id = ?)`,
    [campaignId, regionId, settlementId]
  );

  const activeThreats: RegionalThreatState['activeThreats'] = threats.map(t => ({
    name: t.name,
    severity: (t.severity as 'nuisance' | 'danger' | 'menace' | 'terror') || 'danger',
    location: t.location || 'the region',
    publicKnowledge: t.is_public === 1,
  }));

  // Get recent incidents
  const incidents = await queryAll<{
    summary: string;
    created_at: string;
  }>(
    `SELECT summary, created_at FROM session_events
     WHERE campaign_id = ?
       AND event_type IN ('combat', 'monster', 'threat')
       AND created_at > datetime('now', '-30 days')
     ORDER BY created_at DESC
     LIMIT 5`,
    [campaignId]
  );

  const recentIncidents: RegionalThreatState['recentIncidents'] = incidents.map(i => ({
    description: i.summary,
    daysAgo: Math.floor((Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  // Calculate overall threat and road safety
  const settlementData = parseJson<any>(settlement?.data_dynamic) || {};
  const overallThreat = calculateOverallThreat(activeThreats);
  const roadSafety = settlementData.roadSafety ||
    (overallThreat === 'critical' ? 'deadly' :
     overallThreat === 'high' ? 'dangerous' :
     overallThreat === 'moderate' ? 'risky' : 'patrolled');

  return {
    overallThreat,
    activeThreats,
    recentIncidents,
    roadSafety,
  };
}

function calculateOverallThreat(
  threats: RegionalThreatState['activeThreats']
): RegionalThreatState['overallThreat'] {
  if (!threats.length) return 'peaceful';

  const hasTerror = threats.some(t => t.severity === 'terror');
  const hasMenace = threats.some(t => t.severity === 'menace');
  const dangerCount = threats.filter(t => t.severity === 'danger').length;

  if (hasTerror) return 'critical';
  if (hasMenace || dangerCount >= 2) return 'high';
  if (dangerCount >= 1) return 'moderate';
  return 'low';
}

// =============================================================================
// GUILD STATE
// =============================================================================

async function fetchGuildState(
  npcId: string,
  campaignId: string
): Promise<GuildState | undefined> {
  // Get NPC's guild memberships
  const npc = await queryOne<{
    data_static: string;
    data_dynamic: string;
  }>(
    `SELECT data_static, data_dynamic FROM npcs WHERE id = ? AND campaign_id = ?`,
    [npcId, campaignId]
  );

  if (!npc) return undefined;

  const staticData = parseJson<any>(npc.data_static) || {};
  const dynamicData = parseJson<any>(npc.data_dynamic) || {};

  const guildMemberships: string[] = staticData.guildMemberships || dynamicData.guilds || [];
  if (!guildMemberships.length) return undefined;

  // Get guild news
  const guildNews: GuildState['guildNews'] = [];

  for (const guildName of guildMemberships) {
    const news = await queryAll<{
      summary: string;
      is_urgent: number;
    }>(
      `SELECT summary, is_urgent FROM guild_news
       WHERE guild_name = ? AND campaign_id = ?
         AND created_at > datetime('now', '-14 days')
       ORDER BY created_at DESC
       LIMIT 3`,
      [guildName, campaignId]
    );

    for (const n of news) {
      guildNews.push({
        guildName,
        news: n.summary,
        isUrgent: n.is_urgent === 1,
      });
    }
  }

  // Determine guild mood (simplified - would query actual guild state)
  const guildMood: GuildState['guildMood'] = guildNews.some(n => n.isUrgent)
    ? 'anxious'
    : 'stable';

  return {
    memberOf: guildMemberships,
    guildNews,
    guildMood,
  };
}

// =============================================================================
// NPC ATTRIBUTE HELPERS
// =============================================================================

/**
 * Convert D&D ability score to modifier
 */
export function abilityScoreToModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Infer economic pressure from NPC data
 */
export function inferEconomicPressure(npcData: any): EconomicPressure {
  // Try to infer from various sources
  const wealth = npcData.wealth || npcData.gold || 0;
  const income = npcData.income || 0;
  const expenses = npcData.expenses || 0;
  const status = npcData.economicStatus || npcData.status;

  if (status) {
    const statusMap: Record<string, EconomicPressure> = {
      'wealthy': 'thriving',
      'rich': 'thriving',
      'comfortable': 'comfortable',
      'middle': 'stable',
      'poor': 'struggling',
      'destitute': 'destitute',
      'beggar': 'destitute',
    };
    for (const [key, value] of Object.entries(statusMap)) {
      if (status.toLowerCase().includes(key)) return value;
    }
  }

  if (income > expenses * 1.5) return 'thriving';
  if (income > expenses) return 'comfortable';
  if (income >= expenses * 0.9) return 'stable';
  if (income >= expenses * 0.5) return 'struggling';
  if (wealth <= 0 && income < expenses) return 'destitute';
  return 'stable';
}

/**
 * Infer NPC role from occupation/class
 */
export function inferNPCRole(occupation: string): NPCRole {
  const lower = occupation.toLowerCase();

  const roleMap: Array<[string[], NPCRole]> = [
    [['farmer', 'peasant', 'serf'], 'farmer'],
    [['miner'], 'miner'],
    [['fisher', 'fisherman'], 'fisher'],
    [['hunter', 'trapper'], 'hunter'],
    [['logger', 'woodcutter', 'lumberjack'], 'logger'],
    [['merchant', 'trader', 'shopkeeper'], 'merchant'],
    [['sailor', 'mariner', 'captain'], 'sailor'],
    [['caravan', 'teamster', 'driver'], 'caravan_driver'],
    [['porter', 'laborer', 'dockworker'], 'porter'],
    [['smith', 'blacksmith', 'armorer'], 'blacksmith'],
    [['craftsman', 'artisan', 'carpenter', 'mason'], 'craftsman'],
    [['weaver', 'tailor', 'seamstress'], 'weaver'],
    [['tanner', 'leatherworker'], 'tanner'],
    [['alchemist', 'apothecary', 'herbalist'], 'alchemist'],
    [['innkeeper', 'barkeep', 'bartender'], 'innkeeper'],
    [['tavern'], 'tavern_keeper'],
    [['priest', 'cleric', 'acolyte', 'monk'], 'priest'],
    [['sage', 'scholar', 'wizard', 'mage'], 'sage'],
    [['bard', 'minstrel', 'performer'], 'bard'],
    [['guard', 'watchman', 'constable'], 'guard'],
    [['soldier', 'warrior', 'knight'], 'soldier'],
    [['mercenary', 'sellsword', 'hired'], 'mercenary'],
    [['noble', 'lord', 'lady', 'baron', 'duke'], 'noble'],
    [['official', 'magistrate', 'mayor', 'councillor'], 'official'],
    [['guild master', 'guildmaster'], 'guild_master'],
    [['beggar', 'vagrant', 'homeless'], 'beggar'],
    [['thief', 'criminal', 'rogue', 'smuggler'], 'criminal'],
    [['fence', 'dealer'], 'fence'],
    [['adventurer', 'explorer', 'hero'], 'adventurer'],
  ];

  for (const [keywords, role] of roleMap) {
    if (keywords.some(k => lower.includes(k))) {
      return role;
    }
  }

  return 'commoner';
}

export default {
  fetchSimulationState,
  abilityScoreToModifier,
  inferEconomicPressure,
  inferNPCRole,
};
