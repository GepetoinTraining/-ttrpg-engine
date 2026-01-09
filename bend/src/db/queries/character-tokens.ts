/**
 * CHARACTER TOKEN QUERIES
 * =======================
 *
 * Database operations for character tokens (topology-first characters).
 *
 * The token is the source of truth. The character table is a projection.
 */

import {
  query,
  queryOne,
  queryAll,
  toJson,
  uuid,
  now,
  NotFoundError,
} from '../client';

import type { CharacterToken } from '../../genesis/character';

// ============================================
// TYPES
// ============================================

export interface CharacterTokenRow {
  id: string;
  uid: string;
  seed: string;  // Stored as TEXT (bigint string)

  playerSeedId: string | null;

  birthTimestamp: number;
  birthEntropy: string;

  topology: string;  // JSON
  dominantType: string;
  entropy: number;

  characterId: string | null;

  worldId: string | null;
  regionId: string | null;
  locationId: string | null;
  positionX: number;
  positionY: number;
  positionZ: number;

  isRepresented: number;
  representedAt: string | null;
  lastPhysicsTick: number | null;

  status: string;
  destroyedAt: string | null;
  destroyedBy: string | null;

  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface TokenEventRow {
  id: string;
  tokenId: string;
  eventType: string;
  eventData: string;  // JSON
  seedBefore: string | null;
  seedAfter: string | null;
  causedByToken: string | null;
  causedByAction: string | null;
  gameTimestamp: string | null;
  realTimestamp: string;
}

export interface CreateTokenInput {
  token: CharacterToken;
  characterId?: string;
  worldId?: string;
  regionId?: string;
  locationId?: string;
}

// ============================================
// TOKEN CRUD
// ============================================

export async function getToken(id: string): Promise<CharacterTokenRow | null> {
  return queryOne<CharacterTokenRow>(
    'SELECT * FROM character_tokens WHERE id = ?',
    [id]
  );
}

export async function getTokenOrThrow(id: string): Promise<CharacterTokenRow> {
  const token = await getToken(id);
  if (!token) throw new NotFoundError('CharacterToken', id);
  return token;
}

export async function getTokenByUid(uid: string): Promise<CharacterTokenRow | null> {
  return queryOne<CharacterTokenRow>(
    'SELECT * FROM character_tokens WHERE uid = ?',
    [uid]
  );
}

export async function getTokenByCharacterId(characterId: string): Promise<CharacterTokenRow | null> {
  return queryOne<CharacterTokenRow>(
    'SELECT * FROM character_tokens WHERE character_id = ?',
    [characterId]
  );
}

export async function getTokensByPlayerSeed(playerSeedId: string): Promise<CharacterTokenRow[]> {
  return queryAll<CharacterTokenRow>(
    'SELECT * FROM character_tokens WHERE player_seed_id = ? ORDER BY created_at DESC',
    [playerSeedId]
  );
}

export async function createToken(input: CreateTokenInput): Promise<CharacterTokenRow> {
  const { token, characterId, worldId, regionId, locationId } = input;
  const timestamp = now();

  await query(
    `INSERT INTO character_tokens (
      id, uid, seed,
      player_seed_id,
      birth_timestamp, birth_entropy,
      topology, dominant_type, entropy,
      character_id,
      world_id, region_id, location_id,
      position_x, position_y, position_z,
      is_represented, status,
      created_at, updated_at, version
    ) VALUES (
      ?, ?, ?,
      ?,
      ?, ?,
      ?, ?, ?,
      ?,
      ?, ?, ?,
      0, 0, 0,
      0, 'configured',
      ?, ?, 1
    )`,
    [
      token.id,
      token.uid,
      token.seed.toString(),  // bigint → string
      token.playerSeedId,
      token.birthTimestamp,
      token.birthEntropy,
      toJson(token.topology),
      token.dominantType,
      token.entropy,
      characterId || null,
      worldId || null,
      regionId || null,
      locationId || null,
      timestamp,
      timestamp,
    ]
  );

  // Record birth event
  await recordTokenEvent(token.id, 'birth', {
    seed: token.seed.toString(),
    topology: token.topology,
  });

  return getTokenOrThrow(token.id);
}

export async function linkTokenToCharacter(
  tokenId: string,
  characterId: string
): Promise<CharacterTokenRow> {
  await query(
    `UPDATE character_tokens
     SET character_id = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [characterId, now(), tokenId]
  );

  await recordTokenEvent(tokenId, 'linked', { characterId });

  return getTokenOrThrow(tokenId);
}

// ============================================
// REPRESENTATION (Configuration → World)
// ============================================

export async function representToken(
  tokenId: string,
  location: {
    worldId: string;
    regionId: string;
    locationId?: string;
    x?: number;
    y?: number;
    z?: number;
  }
): Promise<CharacterTokenRow> {
  const timestamp = now();

  await query(
    `UPDATE character_tokens SET
      is_represented = 1,
      represented_at = ?,
      world_id = ?,
      region_id = ?,
      location_id = ?,
      position_x = ?,
      position_y = ?,
      position_z = ?,
      status = 'represented',
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [
      timestamp,
      location.worldId,
      location.regionId,
      location.locationId || null,
      location.x || 0,
      location.y || 0,
      location.z || 0,
      timestamp,
      tokenId,
    ]
  );

  await recordTokenEvent(tokenId, 'represented', {
    location,
    timestamp,
  });

  return getTokenOrThrow(tokenId);
}

export async function updateTokenPosition(
  tokenId: string,
  x: number,
  y: number,
  z: number = 0
): Promise<void> {
  await query(
    `UPDATE character_tokens SET
      position_x = ?,
      position_y = ?,
      position_z = ?,
      last_physics_tick = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [x, y, z, Date.now(), now(), tokenId]
  );
}

export async function moveTokenToLocation(
  tokenId: string,
  locationId: string,
  regionId?: string
): Promise<CharacterTokenRow> {
  const updates: string[] = ['location_id = ?', 'updated_at = ?', 'version = version + 1'];
  const params: any[] = [locationId, now()];

  if (regionId) {
    updates.push('region_id = ?');
    params.push(regionId);
  }

  params.push(tokenId);

  await query(
    `UPDATE character_tokens SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  await recordTokenEvent(tokenId, 'moved', { locationId, regionId });

  return getTokenOrThrow(tokenId);
}

// ============================================
// DESTRUCTION (Death, etc.)
// ============================================

export async function destroyToken(
  tokenId: string,
  destroyedBy?: string,
  cause?: string
): Promise<CharacterTokenRow> {
  const timestamp = now();

  await query(
    `UPDATE character_tokens SET
      status = 'destroyed',
      destroyed_at = ?,
      destroyed_by = ?,
      is_represented = 0,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [timestamp, destroyedBy || null, timestamp, tokenId]
  );

  await recordTokenEvent(tokenId, 'destroyed', {
    destroyedBy,
    cause,
    timestamp,
  });

  return getTokenOrThrow(tokenId);
}

// ============================================
// SEED EVOLUTION
// ============================================

export async function evolveTokenSeed(
  tokenId: string,
  newSeed: bigint,
  newTopology: Record<string, number>,
  reason: string
): Promise<CharacterTokenRow> {
  const token = await getTokenOrThrow(tokenId);
  const oldSeed = token.seed;

  await query(
    `UPDATE character_tokens SET
      seed = ?,
      topology = ?,
      updated_at = ?,
      version = version + 1
     WHERE id = ?`,
    [newSeed.toString(), toJson(newTopology), now(), tokenId]
  );

  await recordTokenEvent(tokenId, 'evolved', {
    reason,
    seedBefore: oldSeed,
    seedAfter: newSeed.toString(),
    topologyDelta: newTopology,
  });

  return getTokenOrThrow(tokenId);
}

// ============================================
// TOKEN EVENTS
// ============================================

export async function recordTokenEvent(
  tokenId: string,
  eventType: string,
  eventData: Record<string, any>,
  causedBy?: { tokenId?: string; action?: string },
  gameTimestamp?: string
): Promise<TokenEventRow> {
  const id = uuid();

  await query(
    `INSERT INTO character_token_events (
      id, token_id, event_type, event_data,
      seed_before, seed_after,
      caused_by_token, caused_by_action,
      game_timestamp, real_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tokenId,
      eventType,
      toJson(eventData),
      eventData.seedBefore || null,
      eventData.seedAfter || null,
      causedBy?.tokenId || null,
      causedBy?.action || null,
      gameTimestamp || null,
      now(),
    ]
  );

  const event = await queryOne<TokenEventRow>(
    'SELECT * FROM character_token_events WHERE id = ?',
    [id]
  );

  if (!event) throw new Error('Failed to create token event');
  return event;
}

export async function getTokenEvents(
  tokenId: string,
  limit: number = 50
): Promise<TokenEventRow[]> {
  return queryAll<TokenEventRow>(
    `SELECT * FROM character_token_events
     WHERE token_id = ?
     ORDER BY real_timestamp DESC
     LIMIT ?`,
    [tokenId, limit]
  );
}

export async function getTokenEventsByType(
  tokenId: string,
  eventType: string
): Promise<TokenEventRow[]> {
  return queryAll<TokenEventRow>(
    `SELECT * FROM character_token_events
     WHERE token_id = ? AND event_type = ?
     ORDER BY real_timestamp DESC`,
    [tokenId, eventType]
  );
}

// ============================================
// QUERIES
// ============================================

export async function getRepresentedTokensInRegion(
  regionId: string
): Promise<CharacterTokenRow[]> {
  return queryAll<CharacterTokenRow>(
    `SELECT * FROM character_tokens
     WHERE region_id = ? AND is_represented = 1 AND status = 'represented'
     ORDER BY updated_at DESC`,
    [regionId]
  );
}

export async function getRepresentedTokensInLocation(
  locationId: string
): Promise<CharacterTokenRow[]> {
  return queryAll<CharacterTokenRow>(
    `SELECT * FROM character_tokens
     WHERE location_id = ? AND is_represented = 1 AND status = 'represented'
     ORDER BY updated_at DESC`,
    [locationId]
  );
}

export async function getConfiguredTokens(
  playerSeedId: string
): Promise<CharacterTokenRow[]> {
  return queryAll<CharacterTokenRow>(
    `SELECT * FROM character_tokens
     WHERE player_seed_id = ? AND status = 'configured'
     ORDER BY created_at DESC`,
    [playerSeedId]
  );
}

// ============================================
// HELPERS
// ============================================

export function rowToToken(row: CharacterTokenRow): CharacterToken {
  return {
    id: row.id,
    uid: row.uid,
    seed: BigInt(row.seed),
    playerSeedId: row.playerSeedId || '',
    birthTimestamp: row.birthTimestamp,
    birthEntropy: row.birthEntropy,
    topology: JSON.parse(row.topology),
    dominantType: row.dominantType as any,
    entropy: row.entropy,
  };
}
