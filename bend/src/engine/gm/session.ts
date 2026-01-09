import { query, queryOne, queryAll } from '../../db/client';
import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';
import {
  type GMSession,
  type GMMode,
  type StartGMSessionInput,
  validateMode,
  GMSessionSchema,
} from './types';

// ============================================
// GM SESSION MANAGEMENT
// ============================================
//
// Lifecycle: active -> paused -> active -> ended
// One active session per party at a time.
//

/**
 * Start a new GM session.
 *
 * Validates mode (rejects SOLO_HUMAN_GM).
 * Ensures only one active session per party.
 * Links to campaign, party, and optionally an AI profile or human GM.
 */
export async function startGMSession(
  input: StartGMSessionInput,
): Promise<GMSession> {
  // 1. Validate mode (rejects SOLO_HUMAN_GM)
  const mode = validateMode(input.mode);

  // 2. Check for existing active session for this party
  const existingSession = await getActiveGMSession(input.partyId);
  if (existingSession) {
    throw new Error(`Party ${input.partyId} already has an active GM session: ${existingSession.id}`);
  }

  // 3. Validate mode requirements
  if (mode === 'PARTY_AI_GM' || mode === 'SOLO_AI_GM') {
    if (!input.aiProfileId) {
      throw new Error(`AI-mediated modes (${mode}) require an AI profile`);
    }
  }

  if (mode === 'PARTY_HUMAN_GM') {
    if (!input.humanGmId) {
      throw new Error('PARTY_HUMAN_GM mode requires a human GM user ID');
    }
  }

  // 4. Create the session
  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();

  const session: GMSession = {
    id: sessionId,
    campaignId: input.campaignId,
    partyId: input.partyId,
    mode,
    aiProfileId: input.aiProfileId,
    humanGmId: input.humanGmId,
    status: 'active',
    currentSceneId: undefined,
    contextPacket: undefined,
    timelineCursor: undefined,
    sessionId: input.sessionId,
    activeCorridorId: undefined,
    overrideCount: 0,
    lastOverrideAt: undefined,
    createdAt: now,
    updatedAt: now,
    endedAt: undefined,
    version: 1,
  };

  // 5. Insert into database
  await query(
    `INSERT INTO gm_sessions (
      id, campaign_id, party_id, mode,
      ai_profile_id, human_gm_id, status,
      current_scene_id, context_packet, timeline_cursor,
      session_id, active_corridor_id,
      override_count, last_override_at,
      created_at, updated_at, ended_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.campaignId,
      session.partyId,
      session.mode,
      session.aiProfileId ?? null,
      session.humanGmId ?? null,
      session.status,
      session.currentSceneId ?? null,
      JSON.stringify(session.contextPacket ?? {}),
      JSON.stringify(session.timelineCursor ?? {}),
      session.sessionId ?? null,
      session.activeCorridorId ?? null,
      session.overrideCount,
      session.lastOverrideAt ?? null,
      session.createdAt,
      session.updatedAt,
      session.endedAt ?? null,
      session.version,
    ],
  );

  // 6. Emit delta
  await writeDelta({
    campaignId: input.campaignId,
    entityType: 'gm_session',
    entityId: sessionId,
    operation: 'create',
    delta: { session },
    actorType: input.humanGmId ? 'gm' : 'system',
    actorId: input.humanGmId,
    timestamp: now,
  });

  return session;
}

/**
 * Get the active GM session for a party.
 * Returns null if no active session exists.
 */
export async function getActiveGMSession(
  partyId: string,
): Promise<GMSession | null> {
  const row = await queryOne<GMSessionRow>(
    `SELECT * FROM gm_sessions WHERE party_id = ? AND status = 'active' LIMIT 1`,
    [partyId],
  );

  if (!row) return null;
  return rowToSession(row);
}

/**
 * Get a GM session by ID.
 */
export async function getGMSession(
  sessionId: string,
): Promise<GMSession | null> {
  const row = await queryOne<GMSessionRow>(
    `SELECT * FROM gm_sessions WHERE id = ?`,
    [sessionId],
  );

  if (!row) return null;
  return rowToSession(row);
}

/**
 * Get all GM sessions for a campaign.
 */
export async function getGMSessionsByCampaign(
  campaignId: string,
  options?: { status?: GMSession['status']; limit?: number },
): Promise<GMSession[]> {
  let sql = `SELECT * FROM gm_sessions WHERE campaign_id = ?`;
  const params: unknown[] = [campaignId];

  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }

  sql += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  const rows = await queryAll<GMSessionRow>(sql, params);
  return rows.map(rowToSession);
}

/**
 * Pause an active GM session.
 */
export async function pauseGMSession(
  sessionId: string,
): Promise<GMSession> {
  const session = await getGMSession(sessionId);
  if (!session) {
    throw new Error(`GM session not found: ${sessionId}`);
  }

  if (session.status !== 'active') {
    throw new Error(`Cannot pause session with status: ${session.status}`);
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions SET status = 'paused', updated_at = ?, version = version + 1 WHERE id = ?`,
    [now, sessionId],
  );

  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'gm_session',
    entityId: sessionId,
    operation: 'update',
    delta: { status: 'paused' },
    actorType: 'system',
    timestamp: now,
  });

  return { ...session, status: 'paused', updatedAt: now, version: session.version + 1 };
}

/**
 * Resume a paused GM session.
 */
export async function resumeGMSession(
  sessionId: string,
): Promise<GMSession> {
  const session = await getGMSession(sessionId);
  if (!session) {
    throw new Error(`GM session not found: ${sessionId}`);
  }

  if (session.status !== 'paused') {
    throw new Error(`Cannot resume session with status: ${session.status}`);
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions SET status = 'active', updated_at = ?, version = version + 1 WHERE id = ?`,
    [now, sessionId],
  );

  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'gm_session',
    entityId: sessionId,
    operation: 'update',
    delta: { status: 'active' },
    actorType: 'system',
    timestamp: now,
  });

  return { ...session, status: 'active', updatedAt: now, version: session.version + 1 };
}

/**
 * End a GM session.
 */
export async function endGMSession(
  sessionId: string,
): Promise<GMSession> {
  const session = await getGMSession(sessionId);
  if (!session) {
    throw new Error(`GM session not found: ${sessionId}`);
  }

  if (session.status === 'ended') {
    throw new Error('Session is already ended');
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions SET status = 'ended', ended_at = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
    [now, now, sessionId],
  );

  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'gm_session',
    entityId: sessionId,
    operation: 'update',
    delta: { status: 'ended', endedAt: now },
    actorType: 'system',
    timestamp: now,
  });

  return { ...session, status: 'ended', endedAt: now, updatedAt: now, version: session.version + 1 };
}

/**
 * Update the current scene for a session.
 */
export async function updateCurrentScene(
  sessionId: string,
  sceneId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions SET current_scene_id = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
    [sceneId, now, sessionId],
  );
}

/**
 * Update the timeline cursor for a session.
 */
export async function updateTimelineCursor(
  sessionId: string,
  cursor: WorldTimestamp,
): Promise<void> {
  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions SET timeline_cursor = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
    [JSON.stringify(cursor), now, sessionId],
  );
}

/**
 * Update the context packet for a session.
 */
export async function updateContextPacket(
  sessionId: string,
  contextPacket: GMSession['contextPacket'],
): Promise<void> {
  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions SET context_packet = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
    [JSON.stringify(contextPacket ?? {}), now, sessionId],
  );
}

/**
 * Update the active corridor for a session (SOLO_AI_GM mode).
 */
export async function updateActiveCorridor(
  sessionId: string,
  corridorId: string | null,
): Promise<void> {
  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions SET active_corridor_id = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
    [corridorId, now, sessionId],
  );
}

/**
 * Record a human override (for PARTY_AI_GM mode).
 */
export async function recordOverride(
  sessionId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await query(
    `UPDATE gm_sessions
     SET override_count = override_count + 1,
         last_override_at = ?,
         updated_at = ?,
         version = version + 1
     WHERE id = ?`,
    [now, now, sessionId],
  );
}

// ============================================
// INTERNAL TYPES AND HELPERS
// ============================================

interface GMSessionRow {
  id: string;
  campaign_id: string;
  party_id: string;
  mode: string;
  ai_profile_id: string | null;
  human_gm_id: string | null;
  status: string;
  current_scene_id: string | null;
  context_packet: string;
  timeline_cursor: string;
  session_id: string | null;
  active_corridor_id: string | null;
  override_count: number;
  last_override_at: string | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  version: number;
}

function rowToSession(row: GMSessionRow): GMSession {
  const contextPacket = row.context_packet ? JSON.parse(row.context_packet) : undefined;
  const timelineCursor = row.timeline_cursor ? JSON.parse(row.timeline_cursor) : undefined;

  return GMSessionSchema.parse({
    id: row.id,
    campaignId: row.campaign_id,
    partyId: row.party_id,
    mode: row.mode as GMMode,
    aiProfileId: row.ai_profile_id ?? undefined,
    humanGmId: row.human_gm_id ?? undefined,
    status: row.status,
    currentSceneId: row.current_scene_id ?? undefined,
    contextPacket: Object.keys(contextPacket || {}).length > 0 ? contextPacket : undefined,
    timelineCursor: Object.keys(timelineCursor || {}).length > 0 ? timelineCursor : undefined,
    sessionId: row.session_id ?? undefined,
    activeCorridorId: row.active_corridor_id ?? undefined,
    overrideCount: row.override_count,
    lastOverrideAt: row.last_override_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at ?? undefined,
    version: row.version,
  });
}
