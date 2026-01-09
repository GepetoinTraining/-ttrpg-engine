import { query, queryOne, queryAll } from '../../db/client';
import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';
import {
  type SoloCorridor,
  type CorridorType,
  type RejoinPoint,
  type MergeResolution,
  type StartCorridorInput,
  type MergeCorridorInput,
  type MergeCorridorResult,
  SoloCorridorSchema,
} from './types';
import { getGMSession, updateActiveCorridor } from './session';

// ============================================
// SOLO CORRIDOR MANAGEMENT
// ============================================
//
// For SOLO_AI_GM mode: player branches into a "corridor"
// that can later rejoin the main timeline.
//
// Corridors:
// - Branch from main campaign state at a specific version
// - Accumulate their own local deltas
// - Can be merged back with conflict resolution
// - Support different corridor types (exploration, combat, etc.)
//

/**
 * Start a new solo corridor.
 * Only valid in SOLO_AI_GM mode.
 */
export async function startCorridor(
  input: StartCorridorInput,
): Promise<SoloCorridor> {
  const session = await getGMSession(input.sessionId);
  if (!session) {
    throw new Error(`GM session not found: ${input.sessionId}`);
  }

  if (session.mode !== 'SOLO_AI_GM') {
    throw new Error('Corridors are only available in SOLO_AI_GM mode');
  }

  if (session.activeCorridorId) {
    throw new Error('Session already has an active corridor. Complete or abandon it first.');
  }

  // Get current campaign state version
  const versionResult = await queryOne<{ max_version: number | null }>(
    `SELECT MAX(version) as max_version FROM sync_log WHERE campaign_id = ?`,
    [session.campaignId],
  );
  const parentVersion = versionResult?.max_version ?? 0;

  // Get current party location and time for rejoin point
  const partyState = await queryOne<{
    location_id: string;
    current_time: string;
  }>(
    `SELECT location_id, current_time FROM party_timelines WHERE party_id = ?`,
    [session.partyId],
  );

  const worldTimestamp: WorldTimestamp = partyState?.current_time
    ? JSON.parse(partyState.current_time)
    : { day: 0, slot: 0, turn: 0 };

  // INVARIANT: No character_snapshot in canonical path.
  // Character state is derived from deltas up to parentCampaignStateVersion.
  // If caching is needed for performance, it must be in a non-authoritative cache layer.
  const corridorId = crypto.randomUUID();

  const rejoinPoint: RejoinPoint = {
    locationId: partyState?.location_id ?? crypto.randomUUID(),
    worldTimestamp,
    narrativeContext: 'Corridor branched from main timeline',
  };

  const corridor: SoloCorridor = {
    id: corridorId,
    gmSessionId: input.sessionId,
    parentCampaignStateVersion: parentVersion,
    rejoinPoint,
    status: 'active',
    corridorType: input.corridorType ?? 'exploration',
    estimatedDuration: input.estimatedDuration,
    corridorDeltas: [],
    // No characterSnapshot - derive from deltas at parentCampaignStateVersion
    createdAt: worldTimestamp,
    updatedAt: worldTimestamp,
    version: 1,
  };

  // Insert corridor into database
  // INVARIANT: No character_snapshot column - removed from canonical path
  await query(
    `INSERT INTO solo_corridors (
      id, gm_session_id, parent_campaign_state_version,
      rejoin_point, status, merge_resolution, merged_at, merged_by,
      corridor_type, estimated_duration, corridor_deltas,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      corridor.id,
      corridor.gmSessionId,
      corridor.parentCampaignStateVersion,
      JSON.stringify(corridor.rejoinPoint),
      corridor.status,
      null,
      null,
      null,
      corridor.corridorType,
      corridor.estimatedDuration ?? null,
      JSON.stringify(corridor.corridorDeltas),
      JSON.stringify(corridor.createdAt),
      JSON.stringify(corridor.updatedAt),
      corridor.version,
    ],
  );

  // Update session with active corridor
  await updateActiveCorridor(input.sessionId, corridorId);

  // Emit delta
  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'solo_corridor',
    entityId: corridorId,
    operation: 'create',
    delta: { corridor },
    actorType: 'system',
    timestamp: new Date().toISOString(),
    worldTimestamp,
  });

  return corridor;
}

/**
 * Get a corridor by ID.
 */
export async function getCorridor(corridorId: string): Promise<SoloCorridor | null> {
  const row = await queryOne<CorridorRow>(
    `SELECT * FROM solo_corridors WHERE id = ?`,
    [corridorId],
  );

  if (!row) return null;
  return rowToCorridor(row);
}

/**
 * Get active corridors for a session.
 */
export async function getActiveCorridors(sessionId: string): Promise<SoloCorridor[]> {
  const rows = await queryAll<CorridorRow>(
    `SELECT * FROM solo_corridors
     WHERE gm_session_id = ? AND status = 'active'
     ORDER BY created_at DESC`,
    [sessionId],
  );

  return rows.map(rowToCorridor);
}

/**
 * Get all corridors for a session.
 */
export async function getCorridorsBySession(
  sessionId: string,
  options?: { status?: SoloCorridor['status']; limit?: number },
): Promise<SoloCorridor[]> {
  let sql = `SELECT * FROM solo_corridors WHERE gm_session_id = ?`;
  const params: unknown[] = [sessionId];

  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }

  sql += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  const rows = await queryAll<CorridorRow>(sql, params);
  return rows.map(rowToCorridor);
}

/**
 * Add a delta to a corridor's local delta list.
 * These deltas are NOT written to the main sync_log until merge.
 */
export async function addCorridorDelta(
  corridorId: string,
  deltaId: string,
): Promise<void> {
  const corridor = await getCorridor(corridorId);
  if (!corridor) {
    throw new Error(`Corridor not found: ${corridorId}`);
  }

  if (corridor.status !== 'active') {
    throw new Error(`Cannot add deltas to corridor with status: ${corridor.status}`);
  }

  const newDeltas = [...corridor.corridorDeltas, deltaId];
  const now = new Date().toISOString();

  await query(
    `UPDATE solo_corridors
     SET corridor_deltas = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [JSON.stringify(newDeltas), now, corridorId],
  );
}

/**
 * Complete a corridor (ready for merge).
 */
export async function completeCorridor(corridorId: string): Promise<SoloCorridor> {
  const corridor = await getCorridor(corridorId);
  if (!corridor) {
    throw new Error(`Corridor not found: ${corridorId}`);
  }

  if (corridor.status !== 'active') {
    throw new Error(`Cannot complete corridor with status: ${corridor.status}`);
  }

  // Use the corridor's current world timestamp for updatedAt
  const updatedAtTimestamp = corridor.updatedAt;

  await query(
    `UPDATE solo_corridors
     SET status = 'completed', updated_at = ?, version = version + 1
     WHERE id = ?`,
    [JSON.stringify(updatedAtTimestamp), corridorId],
  );

  const session = await getGMSession(corridor.gmSessionId);
  if (session) {
    await writeDelta({
      campaignId: session.campaignId,
      entityType: 'solo_corridor',
      entityId: corridorId,
      operation: 'update',
      delta: { status: 'completed' },
      actorType: 'system',
      timestamp: new Date().toISOString(),
    });
  }

  return { ...corridor, status: 'completed', updatedAt: updatedAtTimestamp, version: corridor.version + 1 };
}

/**
 * Abandon a corridor (discard all local changes).
 */
export async function abandonCorridor(corridorId: string): Promise<SoloCorridor> {
  const corridor = await getCorridor(corridorId);
  if (!corridor) {
    throw new Error(`Corridor not found: ${corridorId}`);
  }

  if (corridor.status !== 'active' && corridor.status !== 'completed') {
    throw new Error(`Cannot abandon corridor with status: ${corridor.status}`);
  }

  // Use the corridor's current world timestamp for updatedAt
  const updatedAtTimestamp = corridor.updatedAt;

  await query(
    `UPDATE solo_corridors
     SET status = 'abandoned', updated_at = ?, version = version + 1
     WHERE id = ?`,
    [JSON.stringify(updatedAtTimestamp), corridorId],
  );

  // Clear active corridor from session
  await updateActiveCorridor(corridor.gmSessionId, null);

  const session = await getGMSession(corridor.gmSessionId);
  if (session) {
    await writeDelta({
      campaignId: session.campaignId,
      entityType: 'solo_corridor',
      entityId: corridorId,
      operation: 'update',
      delta: { status: 'abandoned', deltasDiscarded: corridor.corridorDeltas.length },
      actorType: 'system',
      timestamp: new Date().toISOString(),
    });
  }

  return { ...corridor, status: 'abandoned', updatedAt: updatedAtTimestamp, version: corridor.version + 1 };
}

/**
 * Merge a corridor back into the main timeline.
 * INVARIANT: Actually writes corridor deltas to sync_log, not just annotations.
 */
export async function mergeCorridor(
  input: MergeCorridorInput,
): Promise<MergeCorridorResult> {
  const corridor = await getCorridor(input.corridorId);
  if (!corridor) {
    throw new Error(`Corridor not found: ${input.corridorId}`);
  }

  if (corridor.status !== 'completed') {
    throw new Error(`Cannot merge corridor with status: ${corridor.status}. Complete it first.`);
  }

  const session = await getGMSession(corridor.gmSessionId);
  if (!session) {
    throw new Error(`GM session not found for corridor: ${input.corridorId}`);
  }

  // Get current campaign version
  const currentVersionResult = await queryOne<{ max_version: number | null }>(
    `SELECT MAX(version) as max_version FROM sync_log WHERE campaign_id = ?`,
    [session.campaignId],
  );
  const currentVersion = currentVersionResult?.max_version ?? 0;

  // Detect conflicts (if campaign advanced since corridor started)
  const conflicts = await detectConflicts(
    session.campaignId,
    corridor.parentCampaignStateVersion,
    currentVersion,
    corridor.corridorDeltas,
  );

  // Get the actual corridor deltas from the corridor_deltas storage
  const corridorDeltaRows = await queryAll<{
    id: string;
    entity_type: string;
    entity_id: string;
    operation: string;
    delta: string;
    world_timestamp: string | null;
  }>(
    `SELECT id, entity_type, entity_id, operation, delta, world_timestamp
     FROM corridor_delta_log
     WHERE corridor_id = ?
     ORDER BY sequence_order ASC`,
    [input.corridorId],
  );

  // Apply resolution strategy and write ACTUAL deltas to sync_log
  const writtenDeltaIds: string[] = [];
  let conflictsResolved = 0;
  let nextVersion = currentVersion + 1;

  for (const deltaRow of corridorDeltaRows) {
    const entityKey = `${deltaRow.entity_type}:${deltaRow.entity_id}`;
    const conflict = conflicts.find(c =>
      `${c.entityType}:${c.entityId}` === entityKey
    );

    let shouldWrite = true;
    let deltaToWrite = JSON.parse(deltaRow.delta);

    if (conflict) {
      if (input.resolution.strategy === 'replace') {
        // Corridor wins - write as-is
        shouldWrite = true;
        conflictsResolved++;
      } else if (input.resolution.strategy === 'merge') {
        // Check for custom resolution
        const customResolution = input.resolution.conflictResolutions.find(
          cr => cr.entityId === deltaRow.entity_id && cr.entityType === deltaRow.entity_type,
        );
        if (customResolution) {
          deltaToWrite = customResolution.resolvedDelta;
          conflictsResolved++;
        }
        shouldWrite = true;
      } else if (input.resolution.strategy === 'branch') {
        // Skip conflicting deltas in branch mode
        shouldWrite = false;
      }
    }

    if (shouldWrite) {
      // INVARIANT: Write the ACTUAL delta to sync_log, not an annotation
      const worldTimestamp = deltaRow.world_timestamp
        ? JSON.parse(deltaRow.world_timestamp)
        : corridor.rejoinPoint.worldTimestamp;

      const newDeltaId = crypto.randomUUID();
      await writeDelta({
        campaignId: session.campaignId,
        entityType: deltaRow.entity_type,
        entityId: deltaRow.entity_id,
        operation: deltaRow.operation as 'create' | 'update' | 'delete',
        delta: {
          ...deltaToWrite,
          _corridorSource: corridor.id,  // Track provenance
          _mergeStrategy: input.resolution.strategy,
          _originalDeltaId: deltaRow.id,
        },
        actorType: 'system',
        timestamp: new Date().toISOString(),
        worldTimestamp,
      });

      writtenDeltaIds.push(newDeltaId);
      nextVersion++;
    }
  }

  // Update corridor with merge resolution
  const mergeResolution: MergeResolution = {
    strategy: input.resolution.strategy,
    conflictResolutions: input.resolution.conflictResolutions,
    finalDeltas: writtenDeltaIds,
  };

  // Use world timestamp for merge time, not wall-clock
  const mergeWorldTimestamp = corridor.rejoinPoint.worldTimestamp;

  await query(
    `UPDATE solo_corridors
     SET status = 'merged',
         merge_resolution = ?,
         merged_at = ?,
         updated_at = ?,
         version = version + 1
     WHERE id = ?`,
    [
      JSON.stringify(mergeResolution),
      JSON.stringify(mergeWorldTimestamp),
      JSON.stringify(mergeWorldTimestamp),
      input.corridorId,
    ],
  );

  // Clear active corridor from session
  await updateActiveCorridor(corridor.gmSessionId, null);

  // Emit merge completion delta
  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'solo_corridor',
    entityId: input.corridorId,
    operation: 'update',
    delta: {
      status: 'merged',
      deltasWritten: writtenDeltaIds.length,
      conflictsResolved,
    },
    actorType: 'system',
    timestamp: new Date().toISOString(),
    worldTimestamp: mergeWorldTimestamp,
  });

  const updatedCorridor = await getCorridor(input.corridorId);

  return {
    corridor: updatedCorridor!,
    deltasWritten: writtenDeltaIds.length,
    conflictsResolved,
  };
}

// ============================================
// CONFLICT DETECTION
// ============================================

/**
 * Conflict detected between main timeline and corridor.
 * INVARIANT: Conflicts are entity-aware, not just delta-ID aware.
 */
interface Conflict {
  entityType: string;
  entityId: string;
  mainDeltaIds: string[];
  corridorDeltaIds: string[];
  description: string;
}

/**
 * Detect conflicts between main timeline and corridor deltas.
 * INVARIANT: Entity-aware conflict detection, not delta-ID matching.
 */
async function detectConflicts(
  campaignId: string,
  fromVersion: number,
  toVersion: number,
  corridorDeltaIds: string[],
): Promise<Conflict[]> {
  if (fromVersion >= toVersion) {
    // No changes in main timeline since corridor started
    return [];
  }

  // Get main timeline deltas since corridor started
  const mainDeltas = await queryAll<{
    id: string;
    entity_type: string;
    entity_id: string;
  }>(
    `SELECT id, entity_type, entity_id FROM sync_log
     WHERE campaign_id = ?
     AND version > ?
     AND version <= ?`,
    [campaignId, fromVersion, toVersion],
  );

  // Build map of entities modified in main timeline
  const mainEntityDeltas = new Map<string, string[]>();
  for (const d of mainDeltas) {
    const key = `${d.entity_type}:${d.entity_id}`;
    const existing = mainEntityDeltas.get(key) ?? [];
    existing.push(d.id);
    mainEntityDeltas.set(key, existing);
  }

  // Get corridor deltas and check for entity overlap
  const corridorDeltas = await queryAll<{
    id: string;
    entity_type: string;
    entity_id: string;
  }>(
    `SELECT id, entity_type, entity_id FROM corridor_delta_log
     WHERE corridor_id IN (
       SELECT id FROM solo_corridors WHERE id IN (${corridorDeltaIds.map(() => '?').join(',') || "''"})
     )`,
    corridorDeltaIds.length > 0 ? corridorDeltaIds : [],
  );

  // If no corridor_delta_log entries, fall back to checking by corridor ID
  if (corridorDeltas.length === 0 && corridorDeltaIds.length > 0) {
    // Query corridor_delta_log directly by corridor_id from the first delta
    const corridorDeltasFallback = await queryAll<{
      id: string;
      entity_type: string;
      entity_id: string;
    }>(
      `SELECT id, entity_type, entity_id FROM corridor_delta_log
       WHERE id IN (${corridorDeltaIds.map(() => '?').join(',')})`,
      corridorDeltaIds,
    );
    corridorDeltas.push(...corridorDeltasFallback);
  }

  // Build map of entities modified in corridor
  const corridorEntityDeltas = new Map<string, string[]>();
  for (const d of corridorDeltas) {
    const key = `${d.entity_type}:${d.entity_id}`;
    const existing = corridorEntityDeltas.get(key) ?? [];
    existing.push(d.id);
    corridorEntityDeltas.set(key, existing);
  }

  // Find conflicts: entities modified in BOTH main and corridor
  const conflicts: Conflict[] = [];
  for (const [entityKey, corridorIds] of corridorEntityDeltas) {
    const mainIds = mainEntityDeltas.get(entityKey);
    if (mainIds && mainIds.length > 0) {
      const [entityType, entityId] = entityKey.split(':');
      conflicts.push({
        entityType,
        entityId,
        mainDeltaIds: mainIds,
        corridorDeltaIds: corridorIds,
        description: `Entity ${entityKey} modified in both main timeline and corridor`,
      });
    }
  }

  return conflicts;
}

// ============================================
// ROW TYPES AND CONVERTERS
// ============================================

interface CorridorRow {
  id: string;
  gm_session_id: string;
  parent_campaign_state_version: number;
  rejoin_point: string;
  status: string;
  merge_resolution: string | null;
  merged_at: string | null;
  merged_by: string | null;
  corridor_type: string;
  estimated_duration: string | null;
  corridor_deltas: string;
  // No character_snapshot - removed from canonical path
  created_at: string;
  updated_at: string;
  version: number;
}

function rowToCorridor(row: CorridorRow): SoloCorridor {
  // Parse WorldTimestamp from JSON strings
  let createdAt: { day: number; slot: number; turn: number };
  let updatedAt: { day: number; slot: number; turn: number };

  try {
    createdAt = JSON.parse(row.created_at);
  } catch {
    createdAt = { day: 0, slot: 0, turn: 0 };
  }

  try {
    updatedAt = JSON.parse(row.updated_at);
  } catch {
    updatedAt = { day: 0, slot: 0, turn: 0 };
  }

  return SoloCorridorSchema.parse({
    id: row.id,
    gmSessionId: row.gm_session_id,
    parentCampaignStateVersion: row.parent_campaign_state_version,
    rejoinPoint: JSON.parse(row.rejoin_point),
    status: row.status,
    mergeResolution: row.merge_resolution ? JSON.parse(row.merge_resolution) : undefined,
    mergedAt: row.merged_at ?? undefined,
    mergedBy: row.merged_by ?? undefined,
    corridorType: row.corridor_type as CorridorType,
    estimatedDuration: row.estimated_duration ?? undefined,
    corridorDeltas: JSON.parse(row.corridor_deltas || '[]'),
    // No characterSnapshot - derive from deltas at parentCampaignStateVersion
    createdAt,
    updatedAt,
    version: row.version,
  });
}
