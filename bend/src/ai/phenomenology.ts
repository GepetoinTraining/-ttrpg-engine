// =============================================================================
// PHENOMENOLOGICAL ADAPTER
// =============================================================================
//
// THE NPC DOESN'T KNOW ECONOMICS. THE NPC KNOWS THEIR LIFE.
//
// This layer translates system state into lived experience.
// We are the resolution adapter between simulation and cognition.
//
// System State              →  NPC Experience
// ─────────────────────────────────────────────────────────
// iron_price: 3x normal     →  "Materials are expensive lately"
// income < expenses         →  "I'm struggling to make ends meet"
// trade_route: blocked      →  "Caravans aren't coming like before"
// faction_embargo: active   →  "Something political going on"
// regional_threat: high     →  "Roads aren't safe these days"
// guild_meeting: called     →  "Guild master seems worried"
//
// The translation considers:
//   - Intelligence (how much they connect)
//   - Wisdom (how much they notice)
//   - Role (what signals they see)
//   - Faction (insider vs outsider knowledge)
//   - Economic pressure (desperate vs comfortable)
//
// Output: Narrative fragments the AI can embody, not data it can analyze.
//



// =============================================================================
// TYPES - System State Inputs
// =============================================================================

/**
 * NPC attributes that affect perception
 */
export interface NPCLens {
  // Core attributes (D&D ability scores, -5 to +5 modifier)
  intelligence: number;
  wisdom: number;
  charisma: number;

  // Role determines what signals they notice
  role: NPCRole;

  // Faction membership gives insider knowledge
  factions: string[];
  factionRanks: Record<string, 'outsider' | 'member' | 'trusted' | 'inner_circle' | 'leader'>;

  // Economic situation colors perception
  economicPressure: EconomicPressure;

  // Personal context
  currentMood: string;
  recentEvents: string[]; // Things that happened to them personally
}

export type NPCRole =
  | 'farmer' | 'miner' | 'fisher' | 'hunter' | 'logger'           // PRIMARY
  | 'merchant' | 'sailor' | 'caravan_driver' | 'porter'            // LOGISTICS
  | 'blacksmith' | 'craftsman' | 'weaver' | 'tanner' | 'alchemist' // SECONDARY
  | 'innkeeper' | 'tavern_keeper' | 'priest' | 'sage' | 'bard'     // TERTIARY
  | 'guard' | 'soldier' | 'mercenary'                              // MILITARY
  | 'noble' | 'official' | 'guild_master'                          // LEADERSHIP
  | 'beggar' | 'criminal' | 'fence'                                // UNDERGROUND
  | 'adventurer'                                                    // SPECIAL
  | 'commoner';                                                     // DEFAULT

export type EconomicPressure =
  | 'thriving'      // Income >> expenses, saving
  | 'comfortable'   // Income > expenses
  | 'stable'        // Income ~= expenses
  | 'struggling'    // Income < expenses, depleting savings
  | 'desperate'     // No savings, can't pay expenses
  | 'destitute';    // Truly impoverished

/**
 * Local economic conditions (from simulation)
 */
export interface LocalEconomyState {
  settlementId: string;
  settlementName: string;

  // Price conditions (multiplier vs base price)
  priceMultipliers: Record<string, number>; // commodityId → multiplier

  // Supply conditions
  shortages: string[];      // commodityIds with supply < 0.5
  gluts: string[];          // commodityIds with supply > 2.0

  // Trade conditions
  tradeRoutesDisrupted: string[];  // Route names/descriptions
  tradeRoutesActive: number;

  // Market mood
  marketCondition: 'crash' | 'falling' | 'stable' | 'rising' | 'bubble';

  // Recent events (abstracted)
  recentEconomicEvents: string[];
}

/**
 * Faction activity state (from simulation)
 */
export interface FactionActivityState {
  // Active interventions affecting the settlement
  interventions: Array<{
    factionName: string;
    type: 'tax' | 'tariff' | 'embargo' | 'monopoly' | 'price_control' | 'blockade';
    target?: string;       // What's affected
    severity: 'minor' | 'moderate' | 'major' | 'severe';
    publicKnowledge: boolean;
  }>;

  // Faction tensions
  tensions: Array<{
    faction1: string;
    faction2: string;
    level: 'cold' | 'strained' | 'hostile' | 'conflict';
    publicKnowledge: boolean;
  }>;

  // Recent faction news
  recentFactionEvents: Array<{
    description: string;
    factionId: string;
    isPublic: boolean;
    isRumor: boolean;
  }>;
}

/**
 * Regional threat state (from monster simulation)
 */
export interface RegionalThreatState {
  overallThreat: 'peaceful' | 'low' | 'moderate' | 'high' | 'critical';

  // Specific threats
  activeThreats: Array<{
    name: string;           // "goblin raids", "undead sightings"
    severity: 'nuisance' | 'danger' | 'menace' | 'terror';
    location: string;       // Where they're active
    publicKnowledge: boolean;
  }>;

  // Recent incidents
  recentIncidents: Array<{
    description: string;
    daysAgo: number;
  }>;

  // Road safety
  roadSafety: 'safe' | 'patrolled' | 'risky' | 'dangerous' | 'deadly';
}

/**
 * Guild/professional context
 */
export interface GuildState {
  memberOf: string[];  // Guild names NPC belongs to

  guildNews: Array<{
    guildName: string;
    news: string;
    isUrgent: boolean;
  }>;

  guildMood: 'prosperous' | 'stable' | 'concerned' | 'anxious' | 'crisis';
}

// =============================================================================
// TYPES - Output (Lived Experience)
// =============================================================================

/**
 * The phenomenological output - what the NPC experiences
 */
export interface LivedExperience {
  // Economic feelings
  economicFeeling: string;        // "Things are hard lately" / "Business is good"
  specificWorries: string[];      // Concrete concerns
  specificHopes: string[];        // What they're looking forward to

  // Observations about the world
  worldObservations: string[];    // What they've noticed
  rumors: string[];               // What they've heard (may be wrong)

  // Social/political awareness
  factionAwareness: string[];     // What they know about factions
  tensionAwareness: string[];     // Conflicts they're aware of

  // Safety feelings
  safetyFeeling: string;          // "Roads are dangerous" / "Things are peaceful"
  specificFears: string[];        // What they're afraid of

  // Professional context
  workSituation: string;          // "Work is slow" / "Can't keep up with orders"
  guildTalk: string[];            // What people in their profession say

  // Personal emotional state
  overallMood: string;            // Synthesis of all the above
  conversationTopics: string[];   // What they might bring up
}

// =============================================================================
// TRANSLATION FUNCTIONS
// =============================================================================

/**
 * Main translation function - system state → lived experience
 */
export function translateToExperience(
  lens: NPCLens,
  economy: LocalEconomyState,
  factions: FactionActivityState,
  threats: RegionalThreatState,
  guild?: GuildState,
): LivedExperience {

  const experience: LivedExperience = {
    economicFeeling: '',
    specificWorries: [],
    specificHopes: [],
    worldObservations: [],
    rumors: [],
    factionAwareness: [],
    tensionAwareness: [],
    safetyFeeling: '',
    specificFears: [],
    workSituation: '',
    guildTalk: [],
    overallMood: '',
    conversationTopics: [],
  };

  // Translate each domain
  translateEconomicExperience(lens, economy, experience);
  translateFactionExperience(lens, factions, experience);
  translateThreatExperience(lens, threats, experience);
  if (guild) translateGuildExperience(lens, guild, experience);

  // Synthesize overall mood
  synthesizeMood(lens, experience);

  // Generate conversation topics
  generateConversationTopics(lens, experience);

  return experience;
}

// =============================================================================
// ECONOMIC TRANSLATION
// =============================================================================

function translateEconomicExperience(
  lens: NPCLens,
  economy: LocalEconomyState,
  exp: LivedExperience,
): void {
  // Base economic feeling from personal pressure
  exp.economicFeeling = translatePressureToFeeling(lens.economicPressure);

  // Role-specific observations
  const roleObservations = getRelevantPriceObservations(lens.role, economy);

  // Intelligence gates how much they connect
  const connectionAbility = Math.min(3, Math.max(0, lens.intelligence + 2)); // 0-5 → 0-3 connections

  // Add observations based on role
  for (const obs of roleObservations.slice(0, connectionAbility + 1)) {
    exp.worldObservations.push(obs.observation);
    if (obs.worry) exp.specificWorries.push(obs.worry);
    if (obs.hope) exp.specificHopes.push(obs.hope);
  }

  // Wisdom gates noticing trade disruptions
  if (lens.wisdom >= 0 && economy.tradeRoutesDisrupted.length > 0) {
    if (lens.wisdom >= 2) {
      exp.worldObservations.push(`Fewer caravans coming through lately`);
    } else if (lens.wisdom >= 0) {
      exp.worldObservations.push(`Something's different at the market`);
    }
  }

  // Market condition awareness (requires some intelligence)
  if (lens.intelligence >= 1) {
    exp.worldObservations.push(translateMarketCondition(economy.marketCondition));
  }

  // Shortages are obvious to everyone
  for (const shortage of economy.shortages.slice(0, 2)) {
    const name = commodityToCommonName(shortage);
    exp.worldObservations.push(`${name} has been hard to find`);
  }

  // Work situation based on role + economy
  exp.workSituation = translateWorkSituation(lens.role, lens.economicPressure, economy);
}

function translatePressureToFeeling(pressure: EconomicPressure): string {
  const feelings: Record<EconomicPressure, string[]> = {
    thriving: [
      "Life is good right now",
      "Can't complain, business is strong",
      "Finally saving some coin",
    ],
    comfortable: [
      "Getting by well enough",
      "No complaints here",
      "Steady work, steady pay",
    ],
    stable: [
      "Making ends meet",
      "It's honest work",
      "Could be better, could be worse",
    ],
    struggling: [
      "Times are tough",
      "Every coin counts these days",
      "Barely keeping my head above water",
    ],
    desperate: [
      "Don't know how I'll make it through the month",
      "Everything's falling apart",
      "I'm running out of options",
    ],
    destitute: [
      "I've got nothing left",
      "Just trying to survive another day",
      "The world has no place for people like me",
    ],
  };

  return feelings[pressure][Math.floor(Math.random() * feelings[pressure].length)];
}

interface PriceObservation {
  observation: string;
  worry?: string;
  hope?: string;
}

function getRelevantPriceObservations(
  role: NPCRole,
  economy: LocalEconomyState,
): PriceObservation[] {
  const observations: PriceObservation[] = [];

  // Role-specific commodity awareness
  const roleCommodities: Record<NPCRole, string[]> = {
    farmer: ['grain', 'livestock', 'tools'],
    blacksmith: ['iron', 'iron_ore', 'coal', 'weapons'],
    merchant: ['all'], // Merchants notice everything
    innkeeper: ['food', 'ale', 'wine', 'grain'],
    craftsman: ['timber', 'leather', 'cloth', 'tools'],
    guard: ['weapons', 'armor'],
    soldier: ['weapons', 'armor', 'provisions'],
    miner: ['iron_ore', 'ore', 'tools'],
    alchemist: ['herbs', 'magic_components'],
    noble: ['luxury', 'wine', 'silk', 'jewelry'],
    commoner: ['food', 'grain'],
    // ... add more as needed
  } as Record<NPCRole, string[]>;

  const relevantCommodities = roleCommodities[role] || ['food', 'grain'];
  const checkAll = relevantCommodities.includes('all');

  for (const [commodityId, multiplier] of Object.entries(economy.priceMultipliers)) {
    if (!checkAll && !relevantCommodities.some(c => commodityId.includes(c))) {
      continue;
    }

    const name = commodityToCommonName(commodityId);

    if (multiplier >= 2.0) {
      observations.push({
        observation: `${name} costs a fortune these days`,
        worry: `How am I supposed to afford ${name}?`,
      });
    } else if (multiplier >= 1.5) {
      observations.push({
        observation: `${name} prices have gone up`,
        worry: `Hope ${name} comes back down soon`,
      });
    } else if (multiplier <= 0.5) {
      observations.push({
        observation: `${name} is cheap right now`,
        hope: role === 'merchant' ? undefined : `Good time to stock up on ${name}`,
      });
      if (role === 'merchant' || role === 'farmer') {
        observations.push({
          observation: `Can't get a good price for ${name}`,
          worry: `${name} market has collapsed`,
        });
      }
    }
  }

  return observations;
}

function translateMarketCondition(condition: LocalEconomyState['marketCondition']): string {
  const translations: Record<typeof condition, string[]> = {
    crash: [
      "Everything's falling apart at the market",
      "Merchants are panicking",
      "Prices are in freefall",
    ],
    falling: [
      "Prices keep dropping",
      "Buyers have the upper hand right now",
      "Sellers are getting desperate",
    ],
    stable: [
      "Markets are steady",
      "Things are predictable at least",
      "No surprises at the market lately",
    ],
    rising: [
      "Prices keep climbing",
      "Sellers are getting greedy",
      "Everything costs more than last month",
    ],
    bubble: [
      "Everyone's buying like there's no tomorrow",
      "Prices are insane, it can't last",
      "People are paying crazy money for things",
    ],
  };

  return translations[condition][Math.floor(Math.random() * translations[condition].length)];
}

function translateWorkSituation(
  role: NPCRole,
  pressure: EconomicPressure,
  economy: LocalEconomyState,
): string {
  // Combine role + pressure + market for work situation
  if (pressure === 'thriving') {
    return roleWorkPhrases(role, 'good');
  } else if (pressure === 'desperate' || pressure === 'destitute') {
    return roleWorkPhrases(role, 'bad');
  } else if (economy.marketCondition === 'crash' || economy.marketCondition === 'falling') {
    return roleWorkPhrases(role, 'declining');
  } else {
    return roleWorkPhrases(role, 'normal');
  }
}

function roleWorkPhrases(role: NPCRole, condition: 'good' | 'normal' | 'declining' | 'bad'): string {
  const phrases: Partial<Record<NPCRole, Record<string, string>>> = {
    blacksmith: {
      good: "Orders are piling up, can barely keep pace",
      normal: "Steady work at the forge",
      declining: "Fewer orders coming in these days",
      bad: "No one can afford my work anymore",
    },
    merchant: {
      good: "Trade is brisk, margins are healthy",
      normal: "Moving goods, making deals",
      declining: "Hard to find buyers lately",
      bad: "I'm sitting on inventory I can't sell",
    },
    innkeeper: {
      good: "Full house every night",
      normal: "Regulars keep coming, travelers pass through",
      declining: "Fewer travelers these days",
      bad: "The common room is empty most nights",
    },
    farmer: {
      good: "Good harvest, good prices",
      normal: "Working the land, like always",
      declining: "Prices are so low it's barely worth the work",
      bad: "Can't afford seed for next season",
    },
    guard: {
      good: "Extra patrols mean extra coin",
      normal: "Same shifts, same routes",
      declining: "They're cutting the watch",
      bad: "Haven't been paid in weeks",
    },
    commoner: {
      good: "Finding work where I can",
      normal: "Day labor, nothing fancy",
      declining: "Work is hard to come by",
      bad: "No one's hiring",
    },
  };

  const defaultPhrases = phrases.commoner!;
  return phrases[role]?.[condition] || defaultPhrases[condition];
}

// =============================================================================
// FACTION TRANSLATION
// =============================================================================

function translateFactionExperience(
  lens: NPCLens,
  factions: FactionActivityState,
  exp: LivedExperience,
): void {
  // Process interventions - what does the NPC perceive?
  for (const intervention of factions.interventions) {
    // Is this public knowledge or do they have insider access?
    const hasInsiderAccess = lens.factions.includes(intervention.factionName) &&
      (lens.factionRanks[intervention.factionName] === 'trusted' ||
       lens.factionRanks[intervention.factionName] === 'inner_circle' ||
       lens.factionRanks[intervention.factionName] === 'leader');

    if (intervention.publicKnowledge || hasInsiderAccess) {
      exp.factionAwareness.push(
        translateIntervention(intervention, hasInsiderAccess, lens.intelligence)
      );
    } else if (intervention.severity === 'major' || intervention.severity === 'severe') {
      // Even without knowledge, major interventions are felt
      exp.worldObservations.push("Something political is going on, but I don't understand it");
    }
  }

  // Process tensions
  for (const tension of factions.tensions) {
    if (!tension.publicKnowledge && lens.wisdom < 1) continue;

    // Insider knowledge of either faction
    const isInsider = lens.factions.includes(tension.faction1) ||
                      lens.factions.includes(tension.faction2);

    if (tension.publicKnowledge || isInsider) {
      exp.tensionAwareness.push(
        translateTension(tension, isInsider)
      );
    } else if (lens.wisdom >= 2) {
      // Wise NPCs pick up on tension even without insider knowledge
      exp.rumors.push(`I've heard ${tension.faction1} and ${tension.faction2} aren't getting along`);
    }
  }

  // Process faction events
  for (const event of factions.recentFactionEvents) {
    const isInsider = lens.factions.includes(event.factionId);

    if (isInsider || event.isPublic) {
      exp.factionAwareness.push(event.description);
    } else if (event.isRumor && lens.charisma >= 0) {
      // Charismatic NPCs hear rumors
      exp.rumors.push(event.description);
    }
  }
}

function translateIntervention(
  intervention: FactionActivityState['interventions'][0],
  isInsider: boolean,
  intelligence: number,
): string {
  const { factionName, type, target, severity } = intervention;

  if (isInsider) {
    // Insider gets the real story
    switch (type) {
      case 'embargo':
        return `${factionName} has banned trade with ${target || 'certain parties'}`;
      case 'tax':
        return `${factionName} is collecting extra taxes`;
      case 'tariff':
        return `${factionName} has raised tariffs on ${target || 'imports'}`;
      case 'monopoly':
        return `${factionName} controls all the ${target || 'trade'}`;
      case 'blockade':
        return `${factionName} has blockaded ${target || 'the routes'}`;
      default:
        return `${factionName} is making moves`;
    }
  } else {
    // Outsider just sees effects
    const severityDesc = severity === 'severe' ? 'everything' :
                         severity === 'major' ? 'a lot' : 'some things';

    if (intelligence >= 2) {
      return `I think ${factionName} is behind ${severityDesc} changing`;
    } else if (intelligence >= 0) {
      return `People say ${factionName} is up to something`;
    } else {
      return `The lords are doing... something`;
    }
  }
}

function translateTension(
  tension: FactionActivityState['tensions'][0],
  isInsider: boolean,
): string {
  const { faction1, faction2, level } = tension;

  const levelDescriptions: Record<typeof level, string> = {
    cold: "aren't on speaking terms",
    strained: "are having disagreements",
    hostile: "are at each other's throats",
    conflict: "are practically at war",
  };

  if (isInsider) {
    return `${faction1} and ${faction2} ${levelDescriptions[level]}`;
  } else {
    return `There's bad blood between ${faction1} and ${faction2}`;
  }
}

// =============================================================================
// THREAT TRANSLATION
// =============================================================================

function translateThreatExperience(
  lens: NPCLens,
  threats: RegionalThreatState,
  exp: LivedExperience,
): void {
  // Overall safety feeling
  exp.safetyFeeling = translateSafetyFeeling(threats.overallThreat, threats.roadSafety);

  // Specific threats - everyone knows about major ones
  for (const threat of threats.activeThreats) {
    if (threat.publicKnowledge || threat.severity === 'menace' || threat.severity === 'terror') {
      exp.worldObservations.push(translateThreatToObservation(threat));
      if (threat.severity === 'menace' || threat.severity === 'terror') {
        exp.specificFears.push(translateThreatToFear(threat, lens.wisdom));
      }
    } else if (lens.wisdom >= 1) {
      // Wise NPCs notice even non-public threats
      exp.rumors.push(`I've heard tell of ${threat.name} near ${threat.location}`);
    }
  }

  // Recent incidents
  for (const incident of threats.recentIncidents.slice(0, 3)) {
    if (incident.daysAgo <= 7) {
      exp.worldObservations.push(incident.description);
    } else if (incident.daysAgo <= 30 && lens.wisdom >= 0) {
      exp.rumors.push(incident.description);
    }
  }

  // Road safety affects everyone
  if (threats.roadSafety === 'dangerous' || threats.roadSafety === 'deadly') {
    exp.specificFears.push("I wouldn't travel the roads if I didn't have to");
  } else if (threats.roadSafety === 'risky') {
    exp.worldObservations.push("Best to travel in groups these days");
  }
}

function translateSafetyFeeling(
  overall: RegionalThreatState['overallThreat'],
  roads: RegionalThreatState['roadSafety'],
): string {
  if (overall === 'critical' || roads === 'deadly') {
    return "Nowhere is safe anymore";
  } else if (overall === 'high' || roads === 'dangerous') {
    return "These are dangerous times";
  } else if (overall === 'moderate' || roads === 'risky') {
    return "You have to be careful out there";
  } else if (overall === 'low') {
    return "Things are mostly quiet, but you hear things";
  } else {
    return "It's been peaceful lately";
  }
}

function translateThreatToObservation(threat: RegionalThreatState['activeThreats'][0]): string {
  const severityPhrases: Record<typeof threat.severity, string> = {
    nuisance: "have been causing trouble",
    danger: "attacked someone",
    menace: "are a real problem",
    terror: "have everyone terrified",
  };

  return `${threat.name} ${severityPhrases[threat.severity]} near ${threat.location}`;
}

function translateThreatToFear(
  threat: RegionalThreatState['activeThreats'][0],
  wisdom: number,
): string {
  if (wisdom >= 2) {
    return `The ${threat.name} could reach us if they're not stopped`;
  } else if (wisdom >= 0) {
    return `What if the ${threat.name} come here?`;
  } else {
    return `I'm scared of what's out there`;
  }
}

// =============================================================================
// GUILD TRANSLATION
// =============================================================================

function translateGuildExperience(
  lens: NPCLens,
  guild: GuildState,
  exp: LivedExperience,
): void {
  // Guild mood
  if (guild.guildMood === 'crisis') {
    exp.specificWorries.push("The guild is in trouble");
  } else if (guild.guildMood === 'anxious') {
    exp.worldObservations.push("Everyone at the guild is on edge");
  } else if (guild.guildMood === 'prosperous') {
    exp.specificHopes.push("Good times for the guild");
  }

  // Guild news - filtered by urgency and intelligence
  for (const news of guild.guildNews) {
    if (guild.memberOf?.includes(news.guildName)) {
      if (news.isUrgent || lens.intelligence >= 0) {
        exp.guildTalk.push(news.news);
      }
    }
  }
}

// =============================================================================
// SYNTHESIS
// =============================================================================

function synthesizeMood(lens: NPCLens, exp: LivedExperience): void {
  // Weight factors
  const economicWeight = 0.4;
  const safetyWeight = 0.3;
  const socialWeight = 0.3;

  // Score each dimension (-2 to +2)
  let economicScore = pressureToScore(lens.economicPressure);
  let safetyScore = safetyToScore(exp.safetyFeeling);
  let socialScore = 0;

  // Worries drag down, hopes lift up
  socialScore -= exp.specificWorries.length * 0.3;
  socialScore += exp.specificHopes.length * 0.3;
  socialScore -= exp.specificFears.length * 0.4;
  socialScore = Math.max(-2, Math.min(2, socialScore));

  const overallScore =
    economicScore * economicWeight +
    safetyScore * safetyWeight +
    socialScore * socialWeight;

  // Translate to mood string
  if (overallScore >= 1.5) {
    exp.overallMood = "optimistic and content";
  } else if (overallScore >= 0.5) {
    exp.overallMood = "cautiously hopeful";
  } else if (overallScore >= -0.5) {
    exp.overallMood = "getting by";
  } else if (overallScore >= -1.5) {
    exp.overallMood = "worried and stressed";
  } else {
    exp.overallMood = "fearful and desperate";
  }

  // Current mood from lens can override
  if (lens.currentMood) {
    exp.overallMood = `${lens.currentMood}, and generally ${exp.overallMood}`;
  }
}

function pressureToScore(pressure: EconomicPressure): number {
  const scores: Record<EconomicPressure, number> = {
    thriving: 2,
    comfortable: 1,
    stable: 0,
    struggling: -1,
    desperate: -2,
    destitute: -2,
  };
  return scores[pressure];
}

function safetyToScore(safetyFeeling: string): number {
  if (safetyFeeling.includes("peaceful") || safetyFeeling.includes("safe")) return 2;
  if (safetyFeeling.includes("quiet")) return 1;
  if (safetyFeeling.includes("careful")) return 0;
  if (safetyFeeling.includes("dangerous")) return -1;
  return -2; // "Nowhere is safe"
}

function generateConversationTopics(lens: NPCLens, exp: LivedExperience): void {
  // Topics are drawn from what's on their mind

  // Worries are top of mind
  for (const worry of exp.specificWorries.slice(0, 2)) {
    exp.conversationTopics.push(worry);
  }

  // Recent observations
  for (const obs of exp.worldObservations.slice(0, 2)) {
    exp.conversationTopics.push(obs);
  }

  // Rumors if they're chatty (charisma)
  if (lens.charisma >= 0 && exp.rumors.length > 0) {
    exp.conversationTopics.push(exp.rumors[0]);
  }

  // Guild talk for professionals
  for (const talk of exp.guildTalk.slice(0, 1)) {
    exp.conversationTopics.push(talk);
  }

  // Fears if things are bad
  if (exp.specificFears.length > 0 && pressureToScore(lens.economicPressure) < 0) {
    exp.conversationTopics.push(exp.specificFears[0]);
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function commodityToCommonName(commodityId: string): string {
  const names: Record<string, string> = {
    iron: "Iron",
    iron_ore: "Iron ore",
    grain: "Grain",
    timber: "Lumber",
    weapons: "Weapons",
    armor: "Armor",
    food: "Food",
    ale: "Ale",
    wine: "Wine",
    cloth: "Cloth",
    leather: "Leather",
    horses: "Horses",
    magic_components: "Spell components",
    herbs: "Herbs",
    spices: "Spices",
    // ... add more as needed
  };

  return names[commodityId] || commodityId.replace(/_/g, ' ');
}

// =============================================================================
// CONTEXT BUILDER INTEGRATION
// =============================================================================

/**
 * Generate the lived experience section for an NPC's AI prompt
 */
export function buildExperiencePrompt(experience: LivedExperience): string {
  const sections: string[] = [];

  // Economic situation
  sections.push(`CURRENT SITUATION: ${experience.economicFeeling}`);
  sections.push(`WORK: ${experience.workSituation}`);
  sections.push(`SAFETY: ${experience.safetyFeeling}`);
  sections.push(`OVERALL MOOD: ${experience.overallMood}`);

  // What's on their mind
  if (experience.specificWorries.length > 0) {
    sections.push(`\nWHAT WORRIES YOU:\n${experience.specificWorries.map(w => `- ${w}`).join('\n')}`);
  }

  if (experience.specificFears.length > 0) {
    sections.push(`\nWHAT SCARES YOU:\n${experience.specificFears.map(f => `- ${f}`).join('\n')}`);
  }

  if (experience.specificHopes.length > 0) {
    sections.push(`\nWHAT YOU HOPE FOR:\n${experience.specificHopes.map(h => `- ${h}`).join('\n')}`);
  }

  // What they know
  if (experience.worldObservations.length > 0) {
    sections.push(`\nWHAT YOU'VE NOTICED:\n${experience.worldObservations.map(o => `- ${o}`).join('\n')}`);
  }

  if (experience.rumors.length > 0) {
    sections.push(`\nRUMORS YOU'VE HEARD (may not be true):\n${experience.rumors.map(r => `- ${r}`).join('\n')}`);
  }

  if (experience.factionAwareness.length > 0) {
    sections.push(`\nPOLITICAL AWARENESS:\n${experience.factionAwareness.map(f => `- ${f}`).join('\n')}`);
  }

  if (experience.guildTalk.length > 0) {
    sections.push(`\nWORD FROM YOUR GUILD:\n${experience.guildTalk.map(g => `- ${g}`).join('\n')}`);
  }

  // Conversation starters
  if (experience.conversationTopics.length > 0) {
    sections.push(`\nTHINGS ON YOUR MIND (might bring up in conversation):\n${experience.conversationTopics.map(t => `- ${t}`).join('\n')}`);
  }

  return sections.join('\n');
}

export default {
  translateToExperience,
  buildExperiencePrompt,
};
