import { query, queryOne, queryAll } from '../../db/client';
import { getSlotPeriod } from '../timeline/substrate';
import type { WorldTimestamp } from '../timeline/substrate';
import {
  type ContextPacket,
  type ContextExclusions,
  type ContextPacketMember,
  type ContextPacketNpc,
  type ContextPacketQuest,
  type AIProfile,
  ContextPacketSchema,
} from './types';
import { getGMSession } from './session';

// ============================================
// CONTEXT PACKET BUILDING
// ============================================
//
// The Context Packet is the "truth slice" that the GM (human or AI)
// is allowed to know. It excludes hidden secrets, future events,
// unrolled dice, and player private notes.
//
// This is the boundary between what the GM can see and what is
// hidden by the engine.
//

/**
 * Build a context packet for a GM session.
 * This is the truth slice the GM is allowed to know.
 *
 * INVARIANT: Context is built from party cursor, not canonical-latest.
 * This prevents leaking future information to lagging parties.
 */
export async function buildContextPacket(
  sessionId: string,
  options?: {
    forceRefresh?: boolean;
  },
): Promise<ContextPacket> {
  const session = await getGMSession(sessionId);
  if (!session) {
    throw new Error(`GM session not found: ${sessionId}`);
  }

  // Get party timeline cursor - this is the party's view of the world
  // INVARIANT: Use party cursor version, not MAX(version) from sync_log
  const partyCursor = await getPartyTimelineCursor(session.partyId);
  if (!partyCursor) {
    throw new Error(`Party timeline cursor not found: ${session.partyId}`);
  }

  // Check cache - invalidate if cursor/version has changed
  if (!options?.forceRefresh) {
    const cached = await getCachedContextPacket(sessionId);
    if (cached && isContextPacketValidForCursor(cached, partyCursor)) {
      return cached;
    }
  }

  // Build fresh context packet AT THE PARTY CURSOR, not canonical-latest
  const partyState = await buildPartyState(session.partyId, partyCursor);
  const visibleNpcs = await buildVisibleNpcs(session.campaignId, session.partyId, partyCursor);
  const knownQuests = await buildKnownQuests(session.campaignId, session.partyId, partyCursor);
  const revealedSecrets = await buildRevealedSecrets(session.campaignId, session.partyId, partyCursor);
  const currentLocation = await buildCurrentLocation(session.partyId, partyCursor);
  const worldState = await buildWorldStateAtCursor(session.campaignId, partyCursor);

  const contextPacket: ContextPacket = {
    partyState,
    visibleNpcs,
    knownQuests,
    revealedSecrets,
    currentLocation,
    worldState,
    computedAt: partyCursor.worldTimestamp,  // WorldTimestamp, not wall-clock
    baseVersion: partyCursor.version,  // Party cursor version, not canonical-latest
  };

  // Cache the context packet
  await cacheContextPacket(sessionId, contextPacket, partyCursor);

  return contextPacket;
}

/**
 * Refresh context packet (alias for buildContextPacket with forceRefresh).
 */
export async function refreshContextPacket(
  sessionId: string,
): Promise<ContextPacket> {
  return buildContextPacket(sessionId, { forceRefresh: true });
}

/**
 * Get context exclusions (what the GM must NOT know).
 */
export async function getContextExclusions(
  campaignId: string,
  partyId: string,
): Promise<ContextExclusions> {
  // Get hidden secrets (not yet revealed to party)
  const hiddenSecrets = await queryAll<{ id: string }>(
    `SELECT id FROM campaign_secrets
     WHERE campaign_id = ?
     AND revealed = 0`,
    [campaignId],
  );

  // Get future scheduled events
  const futureEvents = await queryAll<{ id: string }>(
    `SELECT id FROM scheduled_events
     WHERE campaign_id = ?
     AND status = 'pending'`,
    [campaignId],
  );

  // Get faction plans not known to party
  const otherFactionPlans = await queryAll<{ id: string }>(
    `SELECT DISTINCT faction_id as id FROM faction_schemes
     WHERE campaign_id = ?
     AND faction_id NOT IN (
       SELECT faction_id FROM party_faction_knowledge
       WHERE party_id = ?
     )`,
    [campaignId, partyId],
  );

  return {
    hiddenSecrets: hiddenSecrets.map(s => s.id),
    futureEvents: futureEvents.map(e => e.id),
    unrolledDice: true,
    playerPrivateNotes: true,
    otherFactionPlans: otherFactionPlans.map(f => f.id),
  };
}

/**
 * Format context packet for AI consumption.
 * Transforms structured data into a prompt-friendly format.
 */
export function getContextForAI(
  contextPacket: ContextPacket,
  aiProfile: AIProfile,
): string {
  const lines: string[] = [];

  // Party state
  lines.push('## Current Party State');
  lines.push(`Party Level: ${contextPacket.partyState.partyLevel}`);
  if (contextPacket.partyState.partyGold !== undefined) {
    lines.push(`Party Gold: ${contextPacket.partyState.partyGold} gp`);
  }
  lines.push('');

  for (const member of contextPacket.partyState.members) {
    const hpPercent = Math.round((member.hpCurrent / member.hpMax) * 100);
    const conditionStr = member.conditions.length > 0
      ? ` [${member.conditions.join(', ')}]`
      : '';
    lines.push(`- ${member.name}: ${member.hpCurrent}/${member.hpMax} HP (${hpPercent}%), AC ${member.ac}${conditionStr}`);
  }
  lines.push('');

  // Location
  lines.push('## Current Location');
  lines.push(`**${contextPacket.currentLocation.name}**`);
  lines.push(contextPacket.currentLocation.description);
  if (contextPacket.currentLocation.features.length > 0) {
    lines.push(`Features: ${contextPacket.currentLocation.features.join(', ')}`);
  }
  lines.push('');

  // NPCs present
  if (contextPacket.visibleNpcs.length > 0) {
    lines.push('## NPCs Present');
    for (const npc of contextPacket.visibleNpcs) {
      const disposition = npc.disposition ? ` (${npc.disposition})` : '';
      lines.push(`- **${npc.name}** - ${npc.role}${disposition}`);
      if (npc.knownInfo.length > 0) {
        lines.push(`  Known: ${npc.knownInfo.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Active quests
  if (contextPacket.knownQuests.length > 0) {
    lines.push('## Active Quests');
    for (const quest of contextPacket.knownQuests) {
      const objective = quest.currentObjective ? ` - ${quest.currentObjective}` : '';
      lines.push(`- **${quest.name}** (${quest.status})${objective}`);
    }
    lines.push('');
  }

  // Revealed secrets
  if (contextPacket.revealedSecrets.length > 0) {
    lines.push('## Known Secrets');
    for (const secret of contextPacket.revealedSecrets) {
      lines.push(`- ${secret}`);
    }
    lines.push('');
  }

  // World state
  lines.push('## World State');
  if (contextPacket.worldState.worldDate) {
    const period = getSlotPeriod(contextPacket.worldState.worldDate.slot);
    lines.push(`Day ${contextPacket.worldState.worldDate.day + 1}, ${period.toLowerCase()}`);
  }
  if (contextPacket.worldState.weather) {
    lines.push(`Weather: ${contextPacket.worldState.weather}`);
  }
  if (contextPacket.worldState.activeEvents.length > 0) {
    lines.push(`Active Events: ${contextPacket.worldState.activeEvents.join(', ')}`);
  }
  lines.push('');

  // AI profile modifiers
  lines.push('## Narration Style');
  lines.push(`Tone: ${aiProfile.tone}`);
  lines.push(`Pacing: ${aiProfile.pacing}`);
  lines.push(`Descriptiveness: ${aiProfile.style.descriptiveness}`);
  if (aiProfile.narrativeConfig.themes.length > 0) {
    lines.push(`Themes: ${aiProfile.narrativeConfig.themes.join(', ')}`);
  }

  return lines.join('\n');
}

// ============================================
// PARTY TIMELINE CURSOR
// ============================================

/**
 * Party timeline cursor - the party's current position in the timeline.
 * INVARIANT: All context must be built from this cursor, not canonical-latest.
 */
interface PartyTimelineCursor {
  partyId: string;
  version: number;
  worldTimestamp: WorldTimestamp;
  locationId?: string;
}

async function getPartyTimelineCursor(partyId: string): Promise<PartyTimelineCursor | null> {
  const row = await queryOne<{
    party_id: string;
    version: number;
    current_time: string;
    location_id: string | null;
  }>(
    `SELECT party_id, version, current_time, location_id
     FROM party_timelines
     WHERE party_id = ?`,
    [partyId],
  );

  if (!row) return null;

  let worldTimestamp: WorldTimestamp;
  try {
    worldTimestamp = JSON.parse(row.current_time);
  } catch {
    worldTimestamp = { day: 0, slot: 0, turn: 0 };
  }

  return {
    partyId: row.party_id,
    version: row.version,
    worldTimestamp,
    locationId: row.location_id ?? undefined,
  };
}

// ============================================
// INTERNAL BUILDERS
// ============================================

async function buildPartyState(
  partyId: string,
  _cursor: PartyTimelineCursor,
): Promise<ContextPacket['partyState']> {
  // Get party members with their current stats
  const members = await queryAll<{
    id: string;
    name: string;
    hp_current: number;
    hp_max: number;
    ac: number;
    level: number;
    conditions: string;
  }>(
    `SELECT c.id, c.name, c.hp_current, c.hp_max, c.ac, c.level,
            COALESCE(c.conditions, '[]') as conditions
     FROM characters c
     JOIN party_memberships pm ON pm.character_id = c.id
     WHERE pm.party_id = ? AND pm.is_active = 1`,
    [partyId],
  );

  const partyMembers: ContextPacketMember[] = members.map(m => ({
    characterId: m.id,
    name: m.name,
    hpCurrent: m.hp_current,
    hpMax: m.hp_max,
    ac: m.ac,
    conditions: JSON.parse(m.conditions || '[]'),
  }));

  const partyLevel = members.length > 0
    ? Math.round(members.reduce((sum, m) => sum + m.level, 0) / members.length)
    : 1;

  // Get party gold if tracked
  const partyGold = await queryOne<{ total: number }>(
    `SELECT SUM(gp) as total FROM party_inventory WHERE party_id = ?`,
    [partyId],
  );

  return {
    members: partyMembers,
    partyLevel,
    partyGold: partyGold?.total,
  };
}

async function buildVisibleNpcs(
  campaignId: string,
  partyId: string,
  _cursor: PartyTimelineCursor,
): Promise<ContextPacketNpc[]> {
  // Get NPCs at the party's current location
  // INVARIANT: NPCs are characters with is_npc = 1, not a separate table
  const npcs = await queryAll<{
    id: string;
    name: string;
    role: string;
    disposition: string | null;
    known_info: string;
  }>(
    `SELECT c.id, c.name, c.role, c.disposition,
            COALESCE(pnk.known_info, '[]') as known_info
     FROM characters c
     LEFT JOIN party_npc_knowledge pnk ON pnk.npc_id = c.id AND pnk.party_id = ?
     WHERE c.campaign_id = ?
     AND c.is_npc = 1
     AND c.current_location_id IN (
       SELECT pt.location_id FROM party_timelines pt
       WHERE pt.party_id = ?
     )
     AND c.is_visible = 1`,
    [partyId, campaignId, partyId],
  );

  return npcs.map(npc => ({
    npcId: npc.id,
    name: npc.name,
    role: npc.role,
    disposition: npc.disposition ?? undefined,
    knownInfo: JSON.parse(npc.known_info || '[]'),
  }));
}

async function buildKnownQuests(
  campaignId: string,
  partyId: string,
  _cursor: PartyTimelineCursor,
): Promise<ContextPacketQuest[]> {
  // Get quests the party knows about
  const quests = await queryAll<{
    id: string;
    name: string;
    status: string;
    current_objective: string | null;
  }>(
    `SELECT q.id, q.name, q.status, q.current_objective
     FROM quests q
     JOIN party_quest_knowledge pqk ON pqk.quest_id = q.id
     WHERE q.campaign_id = ?
     AND pqk.party_id = ?
     AND q.status != 'unknown'`,
    [campaignId, partyId],
  );

  return quests.map(q => ({
    questId: q.id,
    name: q.name,
    status: q.status,
    currentObjective: q.current_objective ?? undefined,
  }));
}

async function buildRevealedSecrets(
  campaignId: string,
  partyId: string,
  _cursor: PartyTimelineCursor,
): Promise<string[]> {
  // Get secrets revealed to this party
  const secrets = await queryAll<{ content: string }>(
    `SELECT cs.content
     FROM campaign_secrets cs
     JOIN party_secret_reveals psr ON psr.secret_id = cs.id
     WHERE cs.campaign_id = ?
     AND psr.party_id = ?
     AND cs.revealed = 1`,
    [campaignId, partyId],
  );

  return secrets.map(s => s.content);
}

async function buildCurrentLocation(
  partyId: string,
  _cursor: PartyTimelineCursor,
): Promise<ContextPacket['currentLocation']> {
  // Get party's current location
  const location = await queryOne<{
    id: string;
    name: string;
    description: string;
    features: string;
  }>(
    `SELECT l.id, l.name, l.description, COALESCE(l.features, '[]') as features
     FROM locations l
     JOIN party_timelines pt ON pt.location_id = l.id
     WHERE pt.party_id = ?`,
    [partyId],
  );

  if (!location) {
    return {
      name: 'Unknown Location',
      description: 'The party\'s current location is unclear.',
      features: [],
    };
  }

  return {
    locationId: location.id,
    name: location.name,
    description: location.description,
    features: JSON.parse(location.features || '[]'),
  };
}

/**
 * Build world state AT the party cursor, not canonical-latest.
 * INVARIANT: Use cursor.worldTimestamp, not campaign's current_date.
 */
async function buildWorldStateAtCursor(
  campaignId: string,
  cursor: PartyTimelineCursor,
): Promise<ContextPacket['worldState']> {
  // Get weather and events that were active at the cursor's world timestamp
  // INVARIANT: Do not leak future events or state changes
  const campaign = await queryOne<{
    weather: string | null;
  }>(
    `SELECT weather FROM campaigns WHERE id = ?`,
    [campaignId],
  );

  // Get active events up to the cursor version
  const activeEvents = await queryAll<{ event_name: string }>(
    `SELECT DISTINCT delta->>'$.eventName' as event_name
     FROM sync_log
     WHERE campaign_id = ?
     AND entity_type = 'world_event'
     AND operation = 'create'
     AND version <= ?
     AND entity_id NOT IN (
       SELECT entity_id FROM sync_log
       WHERE campaign_id = ?
       AND entity_type = 'world_event'
       AND operation = 'delete'
       AND version <= ?
     )`,
    [campaignId, cursor.version, campaignId, cursor.version],
  );

  const timeOfDay = getSlotPeriod(cursor.worldTimestamp.slot).toLowerCase();

  return {
    worldDate: cursor.worldTimestamp,  // Use cursor's timestamp, not campaign's
    weather: campaign?.weather ?? undefined,
    timeOfDay,
    activeEvents: activeEvents.map(e => e.event_name).filter(Boolean),
  };
}

// ============================================
// CACHING
// ============================================

async function getCachedContextPacket(
  sessionId: string,
): Promise<ContextPacket | null> {
  const cached = await queryOne<{
    party_state: string;
    visible_npcs: string;
    known_quests: string;
    revealed_secrets: string;
    current_location: string;
    world_state: string;
    computed_at: string;
    base_version: number;
    valid_until: string | null;
  }>(
    `SELECT * FROM context_packets
     WHERE gm_session_id = ?
     ORDER BY computed_at DESC
     LIMIT 1`,
    [sessionId],
  );

  if (!cached) return null;

  return ContextPacketSchema.parse({
    partyState: JSON.parse(cached.party_state),
    visibleNpcs: JSON.parse(cached.visible_npcs),
    knownQuests: JSON.parse(cached.known_quests),
    revealedSecrets: JSON.parse(cached.revealed_secrets),
    currentLocation: JSON.parse(cached.current_location),
    worldState: JSON.parse(cached.world_state),
    computedAt: cached.computed_at,
    baseVersion: cached.base_version,
  });
}

/**
 * Check if cached context packet is still valid for the current cursor.
 * INVARIANT: Cache is invalidated on cursor/version change, not elapsed time.
 */
function isContextPacketValidForCursor(
  packet: ContextPacket,
  cursor: PartyTimelineCursor,
): boolean {
  // Cache is valid only if base version matches current cursor version
  return packet.baseVersion === cursor.version;
}

async function cacheContextPacket(
  sessionId: string,
  packet: ContextPacket,
  cursor: PartyTimelineCursor,
): Promise<void> {
  const id = crypto.randomUUID();

  // INVARIANT: No wall-clock valid_until - cache validity is cursor-based
  await query(
    `INSERT INTO context_packets (
      id, gm_session_id,
      party_state, visible_npcs, known_quests,
      revealed_secrets, current_location, world_state,
      exclusions, computed_at, valid_until, base_version, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sessionId,
      JSON.stringify(packet.partyState),
      JSON.stringify(packet.visibleNpcs),
      JSON.stringify(packet.knownQuests),
      JSON.stringify(packet.revealedSecrets),
      JSON.stringify(packet.currentLocation),
      JSON.stringify(packet.worldState),
      '{}', // exclusions
      JSON.stringify(packet.computedAt),  // WorldTimestamp as JSON
      null,  // No wall-clock valid_until - use cursor.version for validity
      cursor.version,
      1,
    ],
  );
}
