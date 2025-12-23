import {
  query,
  queryOne,
  queryAll,
  transaction,
  parseJson,
  toJson,
  uuid,
  now,
} from "../client";

// ============================================
// SYNC QUERIES
// ============================================
//
// Delta sync for real-time multiplayer.
// Clients request changes since their last sync.
//

// ============================================
// TYPES
// ============================================

export interface SyncLogRow {
  id: string;

  // Scope
  campaignId: string;
  sessionId: string | null;

  // What changed
  entityType: string;
  entityId: string;
  operation: string; // 'create' | 'update' | 'delete'

  // The delta
  delta: string; // JSON

  // Version for ordering
  version: number;

  // Who made the change
  actorId: string | null;
  actorType: string | null;

  // When
  timestamp: string;
}

export interface SyncCursor {
  campaignId: string;
  sessionId?: string;
  lastVersion: number;
  lastTimestamp: string;
}

export interface SyncResult {
  changes: SyncLogRow[];
  cursor: SyncCursor;
  hasMore: boolean;
}

// ============================================
// LOGGING CHANGES
// ============================================

let globalVersion = 0;

async function getNextVersion(campaignId: string): Promise<number> {
  const result = await queryOne<{ maxVersion: number }>(
    `SELECT MAX(version) as max_version FROM sync_log WHERE campaign_id = ?`,
    [campaignId],
  );
  return (result?.maxVersion || 0) + 1;
}

export async function logChange(
  campaignId: string,
  sessionId: string | null,
  entityType: string,
  entityId: string,
  operation: "create" | "update" | "delete",
  delta: Record<string, any>,
  actorId?: string,
  actorType?: string,
): Promise<SyncLogRow> {
  const id = uuid();
  const version = await getNextVersion(campaignId);
  const timestamp = now();

  await query(
    `INSERT INTO sync_log (
      id, campaign_id, session_id,
      entity_type, entity_id, operation,
      delta, version,
      actor_id, actor_type,
      timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      campaignId,
      sessionId,
      entityType,
      entityId,
      operation,
      toJson(delta),
      version,
      actorId || null,
      actorType || null,
      timestamp,
    ],
  );

  const result = await queryOne<SyncLogRow>(
    "SELECT * FROM sync_log WHERE id = ?",
    [id],
  );
  if (!result) throw new Error("Failed to log change");
  return result;
}

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * Get changes since a cursor position
 */
export async function getChangesSince(
  cursor: SyncCursor,
  limit: number = 100,
): Promise<SyncResult> {
  const conditions: string[] = [
    "campaign_id = ?",
    "(version > ? OR (version = ? AND timestamp > ?))",
  ];
  const params: any[] = [
    cursor.campaignId,
    cursor.lastVersion,
    cursor.lastVersion,
    cursor.lastTimestamp,
  ];

  if (cursor.sessionId) {
    conditions.push("(session_id = ? OR session_id IS NULL)");
    params.push(cursor.sessionId);
  }

  const changes = await queryAll<SyncLogRow>(
    `SELECT * FROM sync_log
     WHERE ${conditions.join(" AND ")}
     ORDER BY version ASC, timestamp ASC
     LIMIT ?`,
    [...params, limit + 1],
  );

  const hasMore = changes.length > limit;
  const resultChanges = hasMore ? changes.slice(0, limit) : changes;

  const lastChange = resultChanges[resultChanges.length - 1];
  const newCursor: SyncCursor = lastChange
    ? {
        campaignId: cursor.campaignId,
        sessionId: cursor.sessionId,
        lastVersion: lastChange.version,
        lastTimestamp: lastChange.timestamp,
      }
    : cursor;

  return {
    changes: resultChanges,
    cursor: newCursor,
    hasMore,
  };
}

/**
 * Get initial sync cursor for a campaign
 */
export async function getInitialCursor(
  campaignId: string,
  sessionId?: string,
): Promise<SyncCursor> {
  return {
    campaignId,
    sessionId,
    lastVersion: 0,
    lastTimestamp: "1970-01-01T00:00:00.000Z",
  };
}

/**
 * Get current cursor (latest position)
 */
export async function getCurrentCursor(
  campaignId: string,
  sessionId?: string,
): Promise<SyncCursor> {
  const conditions: string[] = ["campaign_id = ?"];
  const params: any[] = [campaignId];

  if (sessionId) {
    conditions.push("(session_id = ? OR session_id IS NULL)");
    params.push(sessionId);
  }

  const result = await queryOne<{ version: number; timestamp: string }>(
    `SELECT MAX(version) as version, MAX(timestamp) as timestamp
     FROM sync_log
     WHERE ${conditions.join(" AND ")}`,
    params,
  );

  return {
    campaignId,
    sessionId,
    lastVersion: result?.version || 0,
    lastTimestamp: result?.timestamp || "1970-01-01T00:00:00.000Z",
  };
}

// ============================================
// FULL SYNC (Initial Load)
// ============================================

export interface FullSyncResult {
  cursor: SyncCursor;
  entities: {
    characters: any[];
    npcs: any[];
    combat: any | null;
    session: any | null;
  };
}

/**
 * Get full state for initial sync
 */
export async function getFullSync(
  campaignId: string,
  sessionId?: string,
): Promise<FullSyncResult> {
  const cursor = await getCurrentCursor(campaignId, sessionId);

  // Get characters
  const characters = await queryAll(
    `SELECT * FROM characters WHERE campaign_id = ? AND status != 'deleted'`,
    [campaignId],
  );

  // Get relevant NPCs (from current location or active in session)
  const npcs = sessionId
    ? await queryAll(
        `SELECT * FROM npcs
         WHERE campaign_id = ?
         AND (is_active = 1 OR id IN (
           SELECT entity_id FROM session_events
           WHERE session_id = ? AND entity_type = 'npc'
         ))`,
        [campaignId, sessionId],
      )
    : [];

  // Get active combat
  const combat = sessionId
    ? await queryOne(
        `SELECT * FROM combats
         WHERE session_id = ? AND status IN ('active', 'paused')`,
        [sessionId],
      )
    : null;

  // Get session
  const session = sessionId
    ? await queryOne("SELECT * FROM sessions WHERE id = ?", [sessionId])
    : null;

  return {
    cursor,
    entities: {
      characters,
      npcs,
      combat,
      session,
    },
  };
}

// ============================================
// CLEANUP
// ============================================

/**
 * Delete old sync log entries
 */
export async function cleanupSyncLog(
  campaignId: string,
  olderThan: Date,
): Promise<number> {
  const result = await query(
    `DELETE FROM sync_log
     WHERE campaign_id = ? AND timestamp < ?`,
    [campaignId, olderThan.toISOString()],
  );
  return result.rowsAffected;
}

/**
 * Delete sync log for ended sessions
 */
export async function cleanupEndedSessionLogs(
  campaignId: string,
): Promise<number> {
  const result = await query(
    `DELETE FROM sync_log
     WHERE campaign_id = ?
     AND session_id IN (
       SELECT id FROM sessions WHERE status = 'ended'
     )`,
    [campaignId],
  );
  return result.rowsAffected;
}

// ============================================
// ENTITY-SPECIFIC LOGGING
// ============================================

export async function logCharacterChange(
  campaignId: string,
  sessionId: string | null,
  characterId: string,
  operation: "create" | "update" | "delete",
  changes: Record<string, any>,
  actorId?: string,
): Promise<SyncLogRow> {
  return logChange(
    campaignId,
    sessionId,
    "character",
    characterId,
    operation,
    changes,
    actorId,
    "player",
  );
}

export async function logCombatChange(
  campaignId: string,
  sessionId: string,
  combatId: string,
  operation: "create" | "update" | "delete",
  changes: Record<string, any>,
): Promise<SyncLogRow> {
  return logChange(
    campaignId,
    sessionId,
    "combat",
    combatId,
    operation,
    changes,
    undefined,
    "system",
  );
}

export async function logParticipantChange(
  campaignId: string,
  sessionId: string,
  participantId: string,
  operation: "create" | "update" | "delete",
  changes: Record<string, any>,
): Promise<SyncLogRow> {
  return logChange(
    campaignId,
    sessionId,
    "combat_participant",
    participantId,
    operation,
    changes,
    undefined,
    "system",
  );
}

export async function logNPCChange(
  campaignId: string,
  sessionId: string | null,
  npcId: string,
  operation: "create" | "update" | "delete",
  changes: Record<string, any>,
  gmId?: string,
): Promise<SyncLogRow> {
  return logChange(
    campaignId,
    sessionId,
    "npc",
    npcId,
    operation,
    changes,
    gmId,
    "gm",
  );
}

export async function logSessionChange(
  campaignId: string,
  sessionId: string,
  operation: "create" | "update" | "delete",
  changes: Record<string, any>,
): Promise<SyncLogRow> {
  return logChange(
    campaignId,
    sessionId,
    "session",
    sessionId,
    operation,
    changes,
    undefined,
    "system",
  );
}

// ============================================
// SUBSCRIPTION HELPERS
// ============================================

export interface Subscription {
  id: string;
  campaignId: string;
  sessionId: string | null;
  userId: string;
  cursor: SyncCursor;
  createdAt: Date;
}

const subscriptions = new Map<string, Subscription>();

/**
 * Create a subscription for a user
 */
export function createSubscription(
  campaignId: string,
  sessionId: string | null,
  userId: string,
  cursor: SyncCursor,
): Subscription {
  const sub: Subscription = {
    id: uuid(),
    campaignId,
    sessionId,
    userId,
    cursor,
    createdAt: new Date(),
  };
  subscriptions.set(sub.id, sub);
  return sub;
}

/**
 * Update subscription cursor
 */
export function updateSubscriptionCursor(
  subscriptionId: string,
  cursor: SyncCursor,
): void {
  const sub = subscriptions.get(subscriptionId);
  if (sub) {
    sub.cursor = cursor;
  }
}

/**
 * Remove subscription
 */
export function removeSubscription(subscriptionId: string): void {
  subscriptions.delete(subscriptionId);
}

/**
 * Get subscriptions for a campaign (for broadcasting)
 */
export function getCampaignSubscriptions(campaignId: string): Subscription[] {
  return Array.from(subscriptions.values()).filter(
    (s) => s.campaignId === campaignId,
  );
}

/**
 * Get subscriptions for a session
 */
export function getSessionSubscriptions(sessionId: string): Subscription[] {
  return Array.from(subscriptions.values()).filter(
    (s) => s.sessionId === sessionId,
  );
}
