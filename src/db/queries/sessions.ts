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
// SESSION QUERIES
// ============================================

// ============================================
// TYPES
// ============================================

export interface SessionRow {
  id: string;
  campaignId: string;

  // Identity
  number: number;
  name: string | null;

  // State
  status: string; // 'scheduled' | 'active' | 'paused' | 'ended'

  // Scene
  currentSceneId: string | null;
  currentLocationId: string | null;

  // Time
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;

  // Duration tracking
  totalDuration: number; // seconds

  // Summary
  summary: string | null;
  notes: string | null;

  // Players present
  playerIds: string; // JSON array

  // Metadata
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SessionEventRow {
  id: string;
  sessionId: string;

  // Event info
  type: string;
  subtype: string | null;

  // Actor
  actorId: string | null;
  actorName: string | null;
  actorType: string | null; // 'player' | 'gm' | 'npc' | 'system'

  // Data
  data: string; // JSON

  // Location context
  sceneId: string | null;
  locationId: string | null;

  // Timestamp
  timestamp: string;

  // For grouping related events
  correlationId: string | null;
}

export interface CreateSessionInput {
  campaignId: string;
  name?: string;
  scheduledAt?: Date;
}

export interface CreateEventInput {
  type: string;
  subtype?: string;
  actorId?: string;
  actorName?: string;
  actorType?: "player" | "gm" | "npc" | "system";
  data: Record<string, any>;
  sceneId?: string;
  locationId?: string;
  correlationId?: string;
}

// ============================================
// SESSION CRUD
// ============================================

export async function getSession(id: string): Promise<SessionRow | null> {
  return queryOne<SessionRow>("SELECT * FROM sessions WHERE id = ?", [id]);
}

export async function getSessionOrThrow(id: string): Promise<SessionRow> {
  const session = await getSession(id);
  if (!session) throw new NotFoundError("Session", id);
  return session;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<SessionRow> {
  const id = uuid();
  const timestamp = now();

  // Get next session number for campaign
  const lastSession = await queryOne<{ number: number }>(
    `SELECT MAX(number) as number FROM sessions WHERE campaign_id = ?`,
    [input.campaignId],
  );
  const sessionNumber = (lastSession?.number || 0) + 1;

  await query(
    `INSERT INTO sessions (
      id, campaign_id, number, name,
      status, current_scene_id, current_location_id,
      scheduled_at, started_at, ended_at,
      total_duration, summary, notes,
      player_ids,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, 'scheduled', NULL, NULL, ?, NULL, NULL, 0, NULL, NULL, '[]', ?, ?, 1)`,
    [
      id,
      input.campaignId,
      sessionNumber,
      input.name || `Session ${sessionNumber}`,
      input.scheduledAt?.toISOString() || null,
      timestamp,
      timestamp,
    ],
  );

  return getSessionOrThrow(id);
}

export async function updateSession(
  id: string,
  updates: {
    name?: string;
    status?: string;
    currentSceneId?: string | null;
    currentLocationId?: string | null;
    summary?: string;
    notes?: string;
    playerIds?: string[];
  },
): Promise<SessionRow> {
  const setClauses: string[] = ["updated_at = ?", "version = version + 1"];
  const params: any[] = [now()];

  if (updates.name !== undefined) {
    setClauses.push("name = ?");
    params.push(updates.name);
  }
  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    params.push(updates.status);
  }
  if (updates.currentSceneId !== undefined) {
    setClauses.push("current_scene_id = ?");
    params.push(updates.currentSceneId);
  }
  if (updates.currentLocationId !== undefined) {
    setClauses.push("current_location_id = ?");
    params.push(updates.currentLocationId);
  }
  if (updates.summary !== undefined) {
    setClauses.push("summary = ?");
    params.push(updates.summary);
  }
  if (updates.notes !== undefined) {
    setClauses.push("notes = ?");
    params.push(updates.notes);
  }
  if (updates.playerIds !== undefined) {
    setClauses.push("player_ids = ?");
    params.push(toJson(updates.playerIds));
  }

  params.push(id);

  await query(
    `UPDATE sessions SET ${setClauses.join(", ")} WHERE id = ?`,
    params,
  );

  return getSessionOrThrow(id);
}

// ============================================
// SESSION LIFECYCLE
// ============================================

export async function startSession(
  id: string,
  playerIds: string[],
): Promise<SessionRow> {
  await query(
    `UPDATE sessions SET
      status = 'active',
      started_at = ?,
      player_ids = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [now(), toJson(playerIds), now(), id],
  );

  // Log event
  await createEvent(id, {
    type: "session",
    subtype: "started",
    actorType: "system",
    data: { playerIds },
  });

  return getSessionOrThrow(id);
}

export async function pauseSession(id: string): Promise<SessionRow> {
  const session = await getSessionOrThrow(id);

  // Calculate duration so far
  let additionalDuration = 0;
  if (session.startedAt) {
    additionalDuration = Math.floor(
      (Date.now() - new Date(session.startedAt).getTime()) / 1000,
    );
  }

  await query(
    `UPDATE sessions SET
      status = 'paused',
      total_duration = total_duration + ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [additionalDuration, now(), id],
  );

  await createEvent(id, {
    type: "session",
    subtype: "paused",
    actorType: "system",
    data: {},
  });

  return getSessionOrThrow(id);
}

export async function resumeSession(id: string): Promise<SessionRow> {
  await query(
    `UPDATE sessions SET
      status = 'active',
      started_at = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [now(), now(), id],
  );

  await createEvent(id, {
    type: "session",
    subtype: "resumed",
    actorType: "system",
    data: {},
  });

  return getSessionOrThrow(id);
}

export async function endSession(
  id: string,
  summary?: string,
): Promise<SessionRow> {
  const session = await getSessionOrThrow(id);

  let additionalDuration = 0;
  if (session.startedAt && session.status === "active") {
    additionalDuration = Math.floor(
      (Date.now() - new Date(session.startedAt).getTime()) / 1000,
    );
  }

  await query(
    `UPDATE sessions SET
      status = 'ended',
      ended_at = ?,
      total_duration = total_duration + ?,
      summary = COALESCE(?, summary),
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [now(), additionalDuration, summary || null, now(), id],
  );

  await createEvent(id, {
    type: "session",
    subtype: "ended",
    actorType: "system",
    data: { totalDuration: session.totalDuration + additionalDuration },
  });

  return getSessionOrThrow(id);
}

// ============================================
// SCENE MANAGEMENT
// ============================================

export async function setScene(
  sessionId: string,
  sceneId: string,
  locationId?: string,
): Promise<SessionRow> {
  const session = await getSessionOrThrow(sessionId);

  await query(
    `UPDATE sessions SET
      current_scene_id = ?,
      current_location_id = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [sceneId, locationId || null, now(), sessionId],
  );

  await createEvent(sessionId, {
    type: "scene",
    subtype: "changed",
    actorType: "gm",
    data: {
      previousSceneId: session.currentSceneId,
      newSceneId: sceneId,
      locationId,
    },
    sceneId,
    locationId,
  });

  return getSessionOrThrow(sessionId);
}

export async function setLocation(
  sessionId: string,
  locationId: string,
): Promise<SessionRow> {
  const session = await getSessionOrThrow(sessionId);

  await query(
    `UPDATE sessions SET
      current_location_id = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [locationId, now(), sessionId],
  );

  await createEvent(sessionId, {
    type: "location",
    subtype: "changed",
    actorType: "gm",
    data: {
      previousLocationId: session.currentLocationId,
      newLocationId: locationId,
    },
    sceneId: session.currentSceneId || undefined,
    locationId,
  });

  return getSessionOrThrow(sessionId);
}

// ============================================
// QUERY OPERATIONS
// ============================================

export async function getCampaignSessions(
  campaignId: string,
  limit: number = 20,
): Promise<SessionRow[]> {
  return queryAll<SessionRow>(
    `SELECT * FROM sessions
     WHERE campaign_id = ?
     ORDER BY number DESC
     LIMIT ?`,
    [campaignId, limit],
  );
}

export async function getActiveSession(
  campaignId: string,
): Promise<SessionRow | null> {
  return queryOne<SessionRow>(
    `SELECT * FROM sessions
     WHERE campaign_id = ? AND status IN ('active', 'paused')
     ORDER BY created_at DESC
     LIMIT 1`,
    [campaignId],
  );
}

export async function getUpcomingSessions(
  campaignId: string,
  limit: number = 5,
): Promise<SessionRow[]> {
  return queryAll<SessionRow>(
    `SELECT * FROM sessions
     WHERE campaign_id = ?
       AND status = 'scheduled'
       AND (scheduled_at IS NULL OR scheduled_at >= ?)
     ORDER BY scheduled_at ASC
     LIMIT ?`,
    [campaignId, now(), limit],
  );
}

export async function getSessionHistory(
  campaignId: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<{ sessions: SessionRow[]; total: number }> {
  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sessions
     WHERE campaign_id = ? AND status = 'ended'`,
    [campaignId],
  );

  const offset = (page - 1) * pageSize;
  const sessions = await queryAll<SessionRow>(
    `SELECT * FROM sessions
     WHERE campaign_id = ? AND status = 'ended'
     ORDER BY ended_at DESC
     LIMIT ? OFFSET ?`,
    [campaignId, pageSize, offset],
  );

  return { sessions, total: countResult?.count || 0 };
}

// ============================================
// SESSION EVENTS
// ============================================

export async function createEvent(
  sessionId: string,
  input: CreateEventInput,
): Promise<SessionEventRow> {
  const id = uuid();

  await query(
    `INSERT INTO session_events (
      id, session_id,
      type, subtype,
      actor_id, actor_name, actor_type,
      data,
      scene_id, location_id,
      timestamp, correlation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sessionId,
      input.type,
      input.subtype || null,
      input.actorId || null,
      input.actorName || null,
      input.actorType || null,
      toJson(input.data),
      input.sceneId || null,
      input.locationId || null,
      now(),
      input.correlationId || null,
    ],
  );

  const result = await queryOne<SessionEventRow>(
    "SELECT * FROM session_events WHERE id = ?",
    [id],
  );
  if (!result) throw new Error("Failed to create event");
  return result;
}

export async function getSessionEvents(
  sessionId: string,
  options: {
    type?: string;
    limit?: number;
    after?: string; // timestamp
  } = {},
): Promise<SessionEventRow[]> {
  const conditions: string[] = ["session_id = ?"];
  const params: any[] = [sessionId];

  if (options.type) {
    conditions.push("type = ?");
    params.push(options.type);
  }
  if (options.after) {
    conditions.push("timestamp > ?");
    params.push(options.after);
  }

  const limit = options.limit || 100;

  return queryAll<SessionEventRow>(
    `SELECT * FROM session_events
     WHERE ${conditions.join(" AND ")}
     ORDER BY timestamp DESC
     LIMIT ?`,
    [...params, limit],
  );
}

export async function getRecentEvents(
  sessionId: string,
  limit: number = 50,
): Promise<SessionEventRow[]> {
  return queryAll<SessionEventRow>(
    `SELECT * FROM session_events
     WHERE session_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [sessionId, limit],
  );
}

export async function getEventsByCorrelation(
  correlationId: string,
): Promise<SessionEventRow[]> {
  return queryAll<SessionEventRow>(
    `SELECT * FROM session_events
     WHERE correlation_id = ?
     ORDER BY timestamp ASC`,
    [correlationId],
  );
}

// ============================================
// EVENT LOGGING HELPERS
// ============================================

export async function logPlayerAction(
  sessionId: string,
  playerId: string,
  playerName: string,
  action: string,
  data: Record<string, any>,
): Promise<SessionEventRow> {
  const session = await getSessionOrThrow(sessionId);

  return createEvent(sessionId, {
    type: "player_action",
    subtype: action,
    actorId: playerId,
    actorName: playerName,
    actorType: "player",
    data,
    sceneId: session.currentSceneId || undefined,
    locationId: session.currentLocationId || undefined,
  });
}

export async function logGMAction(
  sessionId: string,
  gmId: string,
  action: string,
  data: Record<string, any>,
): Promise<SessionEventRow> {
  const session = await getSessionOrThrow(sessionId);

  return createEvent(sessionId, {
    type: "gm_action",
    subtype: action,
    actorId: gmId,
    actorType: "gm",
    data,
    sceneId: session.currentSceneId || undefined,
    locationId: session.currentLocationId || undefined,
  });
}

export async function logNPCAction(
  sessionId: string,
  npcId: string,
  npcName: string,
  action: string,
  data: Record<string, any>,
): Promise<SessionEventRow> {
  const session = await getSessionOrThrow(sessionId);

  return createEvent(sessionId, {
    type: "npc_action",
    subtype: action,
    actorId: npcId,
    actorName: npcName,
    actorType: "npc",
    data,
    sceneId: session.currentSceneId || undefined,
    locationId: session.currentLocationId || undefined,
  });
}

export async function logDiceRoll(
  sessionId: string,
  actorId: string,
  actorName: string,
  actorType: "player" | "gm" | "npc",
  roll: {
    expression: string;
    result: number;
    breakdown: string;
    purpose?: string;
  },
): Promise<SessionEventRow> {
  return createEvent(sessionId, {
    type: "dice_roll",
    actorId,
    actorName,
    actorType,
    data: roll,
  });
}

export async function logChat(
  sessionId: string,
  actorId: string,
  actorName: string,
  actorType: "player" | "gm",
  message: string,
  isWhisper: boolean = false,
  whisperTo?: string[],
): Promise<SessionEventRow> {
  return createEvent(sessionId, {
    type: "chat",
    subtype: isWhisper ? "whisper" : "public",
    actorId,
    actorName,
    actorType,
    data: { message, whisperTo },
  });
}
