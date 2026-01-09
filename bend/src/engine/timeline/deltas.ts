import { z } from 'zod';
import { queryAll, queryOne, query } from '../../db/client';
import type { WorldTimestamp } from './substrate';
import { timestampToTurns } from './substrate';

// ============================================
// DELTA RETRIEVAL
// ============================================
//
// Deltas are atomic changes to game state.
// They're stored in sync_log and can be:
//   - Queried by time range
//   - Filtered by scope
//   - Projected onto state
//

export const DeltaSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),

  // What changed
  entityType: z.string(),
  entityId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),

  // The change payload
  delta: z.record(z.string(), z.any()),

  // Ordering
  version: z.number().int(),
  sequence: z.number().int().optional(),

  // Who made the change
  actorId: z.string().optional(),
  actorType: z.enum(['player', 'gm', 'system']).optional(),

  // When
  timestamp: z.string(),
  worldTimestamp: z.object({
    day: z.number().int(),
    slot: z.number().int(),
    turn: z.number().int(),
  }).optional(),
});
export type Delta = z.infer<typeof DeltaSchema>;

export const DeltaScopeSchema = z.object({
  // Filter by entity type
  entityTypes: z.array(z.string()).optional(),

  // Filter by specific entities
  entityIds: z.array(z.string()).optional(),

  // Filter by actor
  actorId: z.string().optional(),
  actorType: z.enum(['player', 'gm', 'system']).optional(),

  // Filter by session
  sessionId: z.string().uuid().optional(),

  // Only include certain operations
  operations: z.array(z.enum(['create', 'update', 'delete'])).optional(),
});
export type DeltaScope = z.infer<typeof DeltaScopeSchema>;

/**
 * Get deltas for a campaign within a sequence range.
 *
 * @param campaignId - The campaign
 * @param from - Start sequence (exclusive)
 * @param to - End sequence (inclusive)
 * @param scope - Optional filters
 * @returns Array of deltas ordered by sequence
 */
export async function getDeltas(
  campaignId: string,
  from: number,
  to: number,
  scope?: DeltaScope
): Promise<Delta[]> {
  // Build query with filters
  let sql = `
    SELECT
      id,
      campaign_id,
      session_id,
      entity_type,
      entity_id,
      operation,
      delta,
      version,
      actor_id,
      actor_type,
      timestamp
    FROM sync_log
    WHERE campaign_id = ?
      AND version > ?
      AND version <= ?
  `;
  const params: any[] = [campaignId, from, to];

  // Apply scope filters
  if (scope?.entityTypes?.length) {
    sql += ` AND entity_type IN (${scope.entityTypes.map(() => '?').join(',')})`;
    params.push(...scope.entityTypes);
  }

  if (scope?.entityIds?.length) {
    sql += ` AND entity_id IN (${scope.entityIds.map(() => '?').join(',')})`;
    params.push(...scope.entityIds);
  }

  if (scope?.actorId) {
    sql += ` AND actor_id = ?`;
    params.push(scope.actorId);
  }

  if (scope?.actorType) {
    sql += ` AND actor_type = ?`;
    params.push(scope.actorType);
  }

  if (scope?.sessionId) {
    sql += ` AND session_id = ?`;
    params.push(scope.sessionId);
  }

  if (scope?.operations?.length) {
    sql += ` AND operation IN (${scope.operations.map(() => '?').join(',')})`;
    params.push(...scope.operations);
  }

  sql += ` ORDER BY version ASC`;

  const rows = await queryAll<{
    id: string;
    campaign_id: string;
    session_id: string | null;
    entity_type: string;
    entity_id: string;
    operation: string;
    delta: string;
    version: number;
    actor_id: string | null;
    actor_type: string | null;
    timestamp: string;
  }>(sql, params);

  return rows.map(row => ({
    id: row.id,
    campaignId: row.campaign_id,
    sessionId: row.session_id ?? undefined,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation as Delta['operation'],
    delta: JSON.parse(row.delta || '{}'),
    version: row.version,
    actorId: row.actor_id ?? undefined,
    actorType: row.actor_type as Delta['actorType'],
    timestamp: row.timestamp,
  }));
}

/**
 * Get deltas by world timestamp range instead of sequence.
 */
export async function getDeltasByTime(
  campaignId: string,
  from: WorldTimestamp,
  to: WorldTimestamp,
  scope?: DeltaScope
): Promise<Delta[]> {
  // Convert timestamps to turns for comparison
  const fromTurns = timestampToTurns(from);
  const toTurns = timestampToTurns(to);

  // For now, get all deltas and filter by stored world timestamp
  // In production, we'd store world_timestamp as indexed columns
  const allDeltas = await getDeltas(campaignId, 0, Number.MAX_SAFE_INTEGER, scope);

  return allDeltas.filter(delta => {
    if (!delta.worldTimestamp) return true; // Include if no world timestamp
    const deltaTurns = timestampToTurns(delta.worldTimestamp);
    return deltaTurns > fromTurns && deltaTurns <= toTurns;
  });
}

/**
 * Get the latest delta for a specific entity.
 */
export async function getLatestDelta(
  campaignId: string,
  entityType: string,
  entityId: string
): Promise<Delta | null> {
  const row = await queryOne<{
    id: string;
    campaign_id: string;
    session_id: string | null;
    entity_type: string;
    entity_id: string;
    operation: string;
    delta: string;
    version: number;
    actor_id: string | null;
    actor_type: string | null;
    timestamp: string;
  }>(
    `SELECT * FROM sync_log
     WHERE campaign_id = ?
       AND entity_type = ?
       AND entity_id = ?
     ORDER BY version DESC
     LIMIT 1`,
    [campaignId, entityType, entityId]
  );

  if (!row) return null;

  return {
    id: row.id,
    campaignId: row.campaign_id,
    sessionId: row.session_id ?? undefined,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation as Delta['operation'],
    delta: JSON.parse(row.delta || '{}'),
    version: row.version,
    actorId: row.actor_id ?? undefined,
    actorType: row.actor_type as Delta['actorType'],
    timestamp: row.timestamp,
  };
}

/**
 * Count deltas in a range.
 */
export async function countDeltas(
  campaignId: string,
  from: number,
  to: number,
  scope?: DeltaScope
): Promise<number> {
  let sql = `
    SELECT COUNT(*) as count
    FROM sync_log
    WHERE campaign_id = ?
      AND version > ?
      AND version <= ?
  `;
  const params: any[] = [campaignId, from, to];

  if (scope?.entityTypes?.length) {
    sql += ` AND entity_type IN (${scope.entityTypes.map(() => '?').join(',')})`;
    params.push(...scope.entityTypes);
  }

  const result = await queryOne<{ count: number }>(sql, params);
  return result?.count ?? 0;
}

/**
 * Write a new delta to the sync log.
 */
export async function writeDelta(delta: Omit<Delta, 'id' | 'version'>): Promise<Delta> {
  const id = crypto.randomUUID();

  // Get next version number for this campaign
  const versionResult = await queryOne<{ max_version: number | null }>(
    `SELECT MAX(version) as max_version FROM sync_log WHERE campaign_id = ?`,
    [delta.campaignId]
  );
  const version = (versionResult?.max_version ?? 0) + 1;

  await query(
    `INSERT INTO sync_log (
      id, campaign_id, session_id, entity_type, entity_id,
      operation, delta, version, actor_id, actor_type, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      delta.campaignId,
      delta.sessionId ?? null,
      delta.entityType,
      delta.entityId,
      delta.operation,
      JSON.stringify(delta.delta),
      version,
      delta.actorId ?? null,
      delta.actorType ?? null,
      delta.timestamp,
    ]
  );

  return { ...delta, id, version };
}
