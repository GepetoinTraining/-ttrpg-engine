import {
  query,
  queryOne,
  queryAll,
  transaction,
  parseJson,
  toJson,
  uuid,
  now,
  NotFoundError,
} from "../client";

// ============================================
// COMBAT QUERIES
// ============================================

// ============================================
// TYPES
// ============================================

export interface CombatRow {
  id: string;
  sessionId: string;
  campaignId: string;

  // State
  status: string; // 'preparing' | 'active' | 'paused' | 'ended'
  round: number;
  turnIndex: number;

  // Location
  locationNodeId: string | null;
  mapUrl: string | null;
  gridConfig: string; // JSON

  // Metadata
  name: string | null;
  description: string | null;

  // Timestamps
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CombatParticipantRow {
  id: string;
  combatId: string;

  // Entity reference
  entityType: string; // 'character' | 'npc' | 'monster'
  entityId: string;

  // Display
  name: string;
  imageUrl: string | null;

  // Initiative
  initiative: number;
  initiativeModifier: number;

  // Stats
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;

  // Position
  positionX: number | null;
  positionY: number | null;

  // State
  conditions: string; // JSON array
  isVisible: number;
  isAlive: number;
  turnTaken: number;

  // For monsters
  groupId: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CombatLogRow {
  id: string;
  combatId: string;
  round: number;
  turnIndex: number;

  actorId: string;
  actorName: string;

  actionType: string;
  actionData: string; // JSON

  targetIds: string; // JSON array
  results: string; // JSON

  timestamp: string;
}

export interface CreateCombatInput {
  sessionId: string;
  campaignId: string;
  name?: string;
  description?: string;
  locationNodeId?: string;
  mapUrl?: string;
  gridConfig?: Record<string, any>;
}

export interface AddParticipantInput {
  entityType: "character" | "npc" | "monster";
  entityId: string;
  name: string;
  imageUrl?: string;
  initiative?: number;
  initiativeModifier?: number;
  hp: number;
  maxHp: number;
  ac: number;
  positionX?: number;
  positionY?: number;
  isVisible?: boolean;
  groupId?: string;
}

// ============================================
// COMBAT CRUD
// ============================================

export async function getCombat(id: string): Promise<CombatRow | null> {
  return queryOne<CombatRow>("SELECT * FROM combats WHERE id = ?", [id]);
}

export async function getCombatOrThrow(id: string): Promise<CombatRow> {
  const combat = await getCombat(id);
  if (!combat) throw new NotFoundError("Combat", id);
  return combat;
}

export async function createCombat(
  input: CreateCombatInput,
): Promise<CombatRow> {
  const id = uuid();
  const timestamp = now();

  await query(
    `INSERT INTO combats (
      id, session_id, campaign_id,
      status, round, turn_index,
      location_node_id, map_url, grid_config,
      name, description,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, 'preparing', 0, 0, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      input.sessionId,
      input.campaignId,
      input.locationNodeId || null,
      input.mapUrl || null,
      toJson(input.gridConfig || {}),
      input.name || null,
      input.description || null,
      timestamp,
      timestamp,
    ],
  );

  return getCombatOrThrow(id);
}

export async function startCombat(id: string): Promise<CombatRow> {
  await query(
    `UPDATE combats SET
      status = 'active',
      round = 1,
      turn_index = 0,
      started_at = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [now(), now(), id],
  );
  return getCombatOrThrow(id);
}

export async function endCombat(id: string): Promise<CombatRow> {
  await query(
    `UPDATE combats SET
      status = 'ended',
      ended_at = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [now(), now(), id],
  );
  return getCombatOrThrow(id);
}

export async function pauseCombat(id: string): Promise<CombatRow> {
  await query(
    `UPDATE combats SET
      status = 'paused',
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [now(), id],
  );
  return getCombatOrThrow(id);
}

export async function resumeCombat(id: string): Promise<CombatRow> {
  await query(
    `UPDATE combats SET
      status = 'active',
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [now(), id],
  );
  return getCombatOrThrow(id);
}

// ============================================
// TURN MANAGEMENT
// ============================================

export async function nextTurn(combatId: string): Promise<{
  combat: CombatRow;
  currentParticipant: CombatParticipantRow | null;
}> {
  const combat = await getCombatOrThrow(combatId);
  const participants = await getInitiativeOrder(combatId);

  if (participants.length === 0) {
    return { combat, currentParticipant: null };
  }

  let nextIndex = combat.turnIndex + 1;
  let newRound = combat.round;

  // Wrap around to next round
  if (nextIndex >= participants.length) {
    nextIndex = 0;
    newRound++;

    // Reset turnTaken flags
    await query(
      `UPDATE combat_participants SET turn_taken = 0 WHERE combat_id = ?`,
      [combatId],
    );
  }

  // Mark current as having taken turn
  const current = participants[nextIndex];
  await query(`UPDATE combat_participants SET turn_taken = 1 WHERE id = ?`, [
    current.id,
  ]);

  await query(
    `UPDATE combats SET
      round = ?,
      turn_index = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [newRound, nextIndex, now(), combatId],
  );

  return {
    combat: await getCombatOrThrow(combatId),
    currentParticipant: current,
  };
}

export async function setTurn(
  combatId: string,
  participantId: string,
): Promise<CombatRow> {
  const participants = await getInitiativeOrder(combatId);
  const index = participants.findIndex((p) => p.id === participantId);

  if (index === -1) {
    throw new Error("Participant not in combat");
  }

  await query(
    `UPDATE combats SET
      turn_index = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [index, now(), combatId],
  );

  return getCombatOrThrow(combatId);
}

// ============================================
// PARTICIPANTS
// ============================================

export async function getParticipants(
  combatId: string,
): Promise<CombatParticipantRow[]> {
  return queryAll<CombatParticipantRow>(
    "SELECT * FROM combat_participants WHERE combat_id = ?",
    [combatId],
  );
}

export async function getInitiativeOrder(
  combatId: string,
): Promise<CombatParticipantRow[]> {
  return queryAll<CombatParticipantRow>(
    `SELECT * FROM combat_participants
     WHERE combat_id = ? AND is_alive = 1
     ORDER BY initiative DESC, initiative_modifier DESC`,
    [combatId],
  );
}

export async function getParticipant(
  id: string,
): Promise<CombatParticipantRow | null> {
  return queryOne<CombatParticipantRow>(
    "SELECT * FROM combat_participants WHERE id = ?",
    [id],
  );
}

export async function addParticipant(
  combatId: string,
  input: AddParticipantInput,
): Promise<CombatParticipantRow> {
  const id = uuid();
  const timestamp = now();

  await query(
    `INSERT INTO combat_participants (
      id, combat_id,
      entity_type, entity_id,
      name, image_url,
      initiative, initiative_modifier,
      hp, max_hp, temp_hp, ac,
      position_x, position_y,
      conditions, is_visible, is_alive, turn_taken,
      group_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, '[]', ?, 1, 0, ?, ?, ?)`,
    [
      id,
      combatId,
      input.entityType,
      input.entityId,
      input.name,
      input.imageUrl || null,
      input.initiative || 0,
      input.initiativeModifier || 0,
      input.hp,
      input.maxHp,
      input.ac,
      input.positionX ?? null,
      input.positionY ?? null,
      input.isVisible !== false ? 1 : 0,
      input.groupId || null,
      timestamp,
      timestamp,
    ],
  );

  const result = await getParticipant(id);
  if (!result) throw new Error("Failed to add participant");
  return result;
}

export async function removeParticipant(id: string): Promise<void> {
  await query("DELETE FROM combat_participants WHERE id = ?", [id]);
}

export async function setInitiative(
  participantId: string,
  initiative: number,
): Promise<void> {
  await query(
    `UPDATE combat_participants SET initiative = ?, updated_at = ? WHERE id = ?`,
    [initiative, now(), participantId],
  );
}

export async function rollInitiativeForAll(
  combatId: string,
  rolls: { participantId: string; roll: number }[],
): Promise<void> {
  await transaction(async (tx) => {
    for (const { participantId, roll } of rolls) {
      await tx.query(
        `UPDATE combat_participants
         SET initiative = initiative_modifier + ?
         WHERE id = ?`,
        [roll, participantId],
      );
    }
  });
}

// ============================================
// PARTICIPANT STATE
// ============================================

export async function damageParticipant(
  participantId: string,
  amount: number,
): Promise<CombatParticipantRow> {
  const p = await getParticipant(participantId);
  if (!p) throw new NotFoundError("CombatParticipant", participantId);

  let remaining = amount;
  let newTempHp = p.tempHp;
  let newHp = p.hp;

  if (newTempHp > 0) {
    if (remaining <= newTempHp) {
      newTempHp -= remaining;
      remaining = 0;
    } else {
      remaining -= newTempHp;
      newTempHp = 0;
    }
  }

  newHp = Math.max(0, newHp - remaining);
  const isAlive = newHp > 0 ? 1 : 0;

  await query(
    `UPDATE combat_participants SET
      hp = ?, temp_hp = ?, is_alive = ?, updated_at = ?
     WHERE id = ?`,
    [newHp, newTempHp, isAlive, now(), participantId],
  );

  const result = await getParticipant(participantId);
  if (!result) throw new Error("Participant disappeared");
  return result;
}

export async function healParticipant(
  participantId: string,
  amount: number,
): Promise<CombatParticipantRow> {
  const p = await getParticipant(participantId);
  if (!p) throw new NotFoundError("CombatParticipant", participantId);

  const newHp = Math.min(p.maxHp, p.hp + amount);
  const isAlive = newHp > 0 ? 1 : 0;

  await query(
    `UPDATE combat_participants SET
      hp = ?, is_alive = ?, updated_at = ?
     WHERE id = ?`,
    [newHp, isAlive, now(), participantId],
  );

  const result = await getParticipant(participantId);
  if (!result) throw new Error("Participant disappeared");
  return result;
}

export async function addCondition(
  participantId: string,
  condition: string,
): Promise<void> {
  const p = await getParticipant(participantId);
  if (!p) throw new NotFoundError("CombatParticipant", participantId);

  const conditions = parseJson<string[]>(p.conditions) || [];
  if (!conditions.includes(condition)) {
    conditions.push(condition);
    await query(
      `UPDATE combat_participants SET conditions = ?, updated_at = ? WHERE id = ?`,
      [toJson(conditions), now(), participantId],
    );
  }
}

export async function removeCondition(
  participantId: string,
  condition: string,
): Promise<void> {
  const p = await getParticipant(participantId);
  if (!p) throw new NotFoundError("CombatParticipant", participantId);

  const conditions = (parseJson<string[]>(p.conditions) || []).filter(
    (c) => c !== condition,
  );

  await query(
    `UPDATE combat_participants SET conditions = ?, updated_at = ? WHERE id = ?`,
    [toJson(conditions), now(), participantId],
  );
}

export async function moveParticipant(
  participantId: string,
  x: number,
  y: number,
): Promise<void> {
  await query(
    `UPDATE combat_participants SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ?`,
    [x, y, now(), participantId],
  );
}

export async function setVisibility(
  participantId: string,
  visible: boolean,
): Promise<void> {
  await query(
    `UPDATE combat_participants SET is_visible = ?, updated_at = ? WHERE id = ?`,
    [visible ? 1 : 0, now(), participantId],
  );
}

// ============================================
// COMBAT LOG
// ============================================

export async function logAction(
  combatId: string,
  entry: {
    round: number;
    turnIndex: number;
    actorId: string;
    actorName: string;
    actionType: string;
    actionData: Record<string, any>;
    targetIds?: string[];
    results?: Record<string, any>;
  },
): Promise<CombatLogRow> {
  const id = uuid();

  await query(
    `INSERT INTO combat_log (
      id, combat_id, round, turn_index,
      actor_id, actor_name,
      action_type, action_data,
      target_ids, results, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      combatId,
      entry.round,
      entry.turnIndex,
      entry.actorId,
      entry.actorName,
      entry.actionType,
      toJson(entry.actionData),
      toJson(entry.targetIds || []),
      toJson(entry.results || {}),
      now(),
    ],
  );

  const result = await queryOne<CombatLogRow>(
    "SELECT * FROM combat_log WHERE id = ?",
    [id],
  );
  if (!result) throw new Error("Failed to log action");
  return result;
}

export async function getCombatLog(
  combatId: string,
  limit: number = 50,
): Promise<CombatLogRow[]> {
  return queryAll<CombatLogRow>(
    `SELECT * FROM combat_log
     WHERE combat_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [combatId, limit],
  );
}

export async function getRoundLog(
  combatId: string,
  round: number,
): Promise<CombatLogRow[]> {
  return queryAll<CombatLogRow>(
    `SELECT * FROM combat_log
     WHERE combat_id = ? AND round = ?
     ORDER BY turn_index, timestamp`,
    [combatId, round],
  );
}

// ============================================
// SESSION QUERIES
// ============================================

export async function getActiveCombat(
  sessionId: string,
): Promise<CombatRow | null> {
  return queryOne<CombatRow>(
    `SELECT * FROM combats
     WHERE session_id = ? AND status IN ('preparing', 'active', 'paused')
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId],
  );
}

export async function getCampaignCombatHistory(
  campaignId: string,
  limit: number = 20,
): Promise<CombatRow[]> {
  return queryAll<CombatRow>(
    `SELECT * FROM combats
     WHERE campaign_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [campaignId, limit],
  );
}
