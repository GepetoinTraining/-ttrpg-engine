import { query, queryOne, queryAll } from '../../db/client';
import {
  type AIProfile,
  type CreateAIProfileInput,
  AIProfileSchema,
  DEFAULT_AI_PROFILES,
} from './types';

// ============================================
// AI PROFILE MANAGEMENT
// ============================================
//
// Manage AI GM personality/style presets.
// Includes system presets and user-created profiles.
//

/**
 * Get an AI profile by ID.
 */
export async function getAIProfile(profileId: string): Promise<AIProfile | null> {
  const row = await queryOne<AIProfileRow>(
    `SELECT * FROM ai_profiles WHERE id = ?`,
    [profileId],
  );

  if (!row) return null;
  return rowToProfile(row);
}

/**
 * List AI profiles for a campaign.
 * Includes system presets and campaign-specific profiles.
 */
export async function listAIProfiles(
  campaignId: string,
  options?: { includeSystemPresets?: boolean },
): Promise<AIProfile[]> {
  const includeSystem = options?.includeSystemPresets ?? true;

  let sql = `SELECT * FROM ai_profiles WHERE campaign_id = ?`;
  const params: unknown[] = [campaignId];

  if (includeSystem) {
    sql = `SELECT * FROM ai_profiles WHERE campaign_id = ? OR is_system_preset = 1`;
  }

  sql += ` ORDER BY is_system_preset DESC, name ASC`;

  const rows = await queryAll<AIProfileRow>(sql, params);
  return rows.map(rowToProfile);
}

/**
 * Create a new AI profile.
 */
export async function createAIProfile(
  campaignId: string,
  input: CreateAIProfileInput,
): Promise<AIProfile> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const profile: AIProfile = {
    id,
    campaignId,
    name: input.name,
    description: input.description,
    style: input.style,
    tone: input.tone,
    pacing: input.pacing,
    narrativeConfig: input.narrativeConfig,
    voice: input.voice ?? {},
    isSystemPreset: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  await query(
    `INSERT INTO ai_profiles (
      id, campaign_id, name, description,
      style, tone, pacing, narrative_config, voice,
      is_system_preset, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.campaignId ?? null,
      profile.name,
      profile.description ?? null,
      JSON.stringify(profile.style),
      profile.tone,
      profile.pacing,
      JSON.stringify(profile.narrativeConfig),
      JSON.stringify(profile.voice),
      profile.isSystemPreset ? 1 : 0,
      profile.createdAt,
      profile.updatedAt,
      profile.version,
    ],
  );

  return profile;
}

/**
 * Update an AI profile.
 */
export async function updateAIProfile(
  profileId: string,
  updates: Partial<CreateAIProfileInput>,
): Promise<AIProfile> {
  const existing = await getAIProfile(profileId);
  if (!existing) {
    throw new Error(`AI profile not found: ${profileId}`);
  }

  if (existing.isSystemPreset) {
    throw new Error('Cannot modify system preset profiles');
  }

  const now = new Date().toISOString();

  const profile: AIProfile = {
    ...existing,
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    style: updates.style ?? existing.style,
    tone: updates.tone ?? existing.tone,
    pacing: updates.pacing ?? existing.pacing,
    narrativeConfig: updates.narrativeConfig ?? existing.narrativeConfig,
    voice: updates.voice ?? existing.voice,
    updatedAt: now,
    version: existing.version + 1,
  };

  await query(
    `UPDATE ai_profiles SET
      name = ?, description = ?,
      style = ?, tone = ?, pacing = ?,
      narrative_config = ?, voice = ?,
      updated_at = ?, version = ?
    WHERE id = ?`,
    [
      profile.name,
      profile.description ?? null,
      JSON.stringify(profile.style),
      profile.tone,
      profile.pacing,
      JSON.stringify(profile.narrativeConfig),
      JSON.stringify(profile.voice),
      profile.updatedAt,
      profile.version,
      profileId,
    ],
  );

  return profile;
}

/**
 * Delete an AI profile.
 */
export async function deleteAIProfile(profileId: string): Promise<void> {
  const existing = await getAIProfile(profileId);
  if (!existing) {
    throw new Error(`AI profile not found: ${profileId}`);
  }

  if (existing.isSystemPreset) {
    throw new Error('Cannot delete system preset profiles');
  }

  // Check if profile is in use
  const inUse = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM gm_sessions WHERE ai_profile_id = ? AND status != 'ended'`,
    [profileId],
  );

  if (inUse && inUse.count > 0) {
    throw new Error('Cannot delete profile that is in use by active sessions');
  }

  await query(`DELETE FROM ai_profiles WHERE id = ?`, [profileId]);
}

/**
 * Seed system preset profiles.
 * Called during database initialization.
 */
export async function seedSystemProfiles(): Promise<void> {
  for (const preset of DEFAULT_AI_PROFILES) {
    // Check if already exists
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM ai_profiles WHERE name = ? AND is_system_preset = 1`,
      [preset.name],
    );

    if (existing) {
      continue;
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await query(
      `INSERT INTO ai_profiles (
        id, campaign_id, name, description,
        style, tone, pacing, narrative_config, voice,
        is_system_preset, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        null, // System presets have no campaign_id
        preset.name,
        preset.description ?? null,
        JSON.stringify(preset.style),
        preset.tone,
        preset.pacing,
        JSON.stringify(preset.narrativeConfig),
        JSON.stringify(preset.voice),
        1, // is_system_preset
        now,
        now,
        preset.version,
      ],
    );
  }
}

/**
 * Get system preset profiles.
 */
export async function getSystemProfiles(): Promise<AIProfile[]> {
  const rows = await queryAll<AIProfileRow>(
    `SELECT * FROM ai_profiles WHERE is_system_preset = 1 ORDER BY name`,
    [],
  );
  return rows.map(rowToProfile);
}

// ============================================
// ROW TYPES AND CONVERTERS
// ============================================

interface AIProfileRow {
  id: string;
  campaign_id: string | null;
  name: string;
  description: string | null;
  style: string;
  tone: string;
  pacing: string;
  narrative_config: string;
  voice: string;
  is_system_preset: number;
  created_at: string;
  updated_at: string;
  version: number;
}

function rowToProfile(row: AIProfileRow): AIProfile {
  return AIProfileSchema.parse({
    id: row.id,
    campaignId: row.campaign_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    style: JSON.parse(row.style),
    tone: row.tone,
    pacing: row.pacing,
    narrativeConfig: JSON.parse(row.narrative_config),
    voice: JSON.parse(row.voice || '{}'),
    isSystemPreset: row.is_system_preset === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}
