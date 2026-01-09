import { query, queryOne, queryAll } from '../../db/client';
import { writeDelta, type Delta } from '../timeline/deltas';
import {
  createSpeculativeProjection,
  commitSpeculativeProjection,
  type SpeculativeProjection,
} from '../timeline/projection';
import type { WorldTimestamp } from '../timeline/substrate';
import {
  type GMScene,
  type ScenePlan,
  type SceneChoiceDB,
  type ProposedDelta,
  type GenerateSceneInput,
  type ApplyChoiceInput,
  type ApplyChoiceResult,
  type ValidationResult,
  GMSceneSchema,
  SceneChoiceDBSchema,
} from './types';
import { getGMSession, updateCurrentScene, updateTimelineCursor } from './session';
import { buildContextPacket } from './context';
import { validateDeltas, checkForConflicts } from './validation';

// ============================================
// SCENE MANAGEMENT
// ============================================
//
// Two-phase commit flow:
// 1. PROPOSE: Generate scene plan with choices
// 2. VALIDATE: Validate each choice's deltas against rules
// 3. COMMIT: On player choice, commit validated deltas
//

/**
 * Generate the next scene for a GM session.
 * For AI modes, uses AI scene generation.
 * For human GM mode, creates a template scene.
 */
export async function generateNextScene(
  input: GenerateSceneInput,
): Promise<GMScene> {
  const session = await getGMSession(input.sessionId);
  if (!session) {
    throw new Error(`GM session not found: ${input.sessionId}`);
  }

  if (session.status !== 'active') {
    throw new Error(`Cannot generate scene for session with status: ${session.status}`);
  }

  // Get next sequence order
  const lastScene = await queryOne<{ sequence_order: number }>(
    `SELECT sequence_order FROM gm_scenes
     WHERE gm_session_id = ?
     ORDER BY sequence_order DESC
     LIMIT 1`,
    [input.sessionId],
  );
  const sequenceOrder = (lastScene?.sequence_order ?? -1) + 1;

  const now = new Date().toISOString();
  const sceneId = crypto.randomUUID();

  // Generate scene plan based on mode
  let scenePlan: ScenePlan;

  if (session.mode === 'PARTY_HUMAN_GM') {
    // Human GM mode - create template scene
    scenePlan = createHumanGMTemplate(input.forceSceneType);
  } else {
    // AI modes - generate via AI (placeholder for now)
    // In full implementation, this would call the AI-GM module
    const context = await buildContextPacket(input.sessionId);
    scenePlan = await generateAIScenePlan(context, input.playerHint, input.forceSceneType);
  }

  // Create the scene
  const scene: GMScene = {
    id: sceneId,
    gmSessionId: input.sessionId,
    sceneType: scenePlan.sceneType,
    proposedAt: now,
    proposedBy: session.mode === 'PARTY_HUMAN_GM' ? (session.humanGmId ?? 'human') : 'ai',
    proposal: scenePlan,
    status: 'proposed',
    committedDeltas: [],
    sequenceOrder,
    createdAt: now,
    version: 1,
  };

  // Insert scene into database
  await query(
    `INSERT INTO gm_scenes (
      id, gm_session_id, scene_type,
      proposed_at, proposed_by, proposal,
      validation_result, validated_at, status,
      committed_deltas, committed_at, player_choice_id,
      time_advancement, sequence_order, parent_scene_id,
      created_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scene.id,
      scene.gmSessionId,
      scene.sceneType,
      scene.proposedAt,
      scene.proposedBy,
      JSON.stringify(scene.proposal),
      null,
      null,
      scene.status,
      JSON.stringify(scene.committedDeltas),
      null,
      null,
      null,
      scene.sequenceOrder,
      null,
      scene.createdAt,
      scene.version,
    ],
  );

  // Insert choices into database
  for (let i = 0; i < scenePlan.choices.length; i++) {
    const choice = scenePlan.choices[i];
    await query(
      `INSERT INTO scene_choices (
        id, scene_id, label, description,
        proposed_deltas, requirements, sort_order,
        selected, selected_by, selected_at, speculation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        choice.id,
        sceneId,
        choice.label,
        choice.description ?? null,
        JSON.stringify(choice.proposedDeltas),
        JSON.stringify(choice.requirements ?? {}),
        i,
        0,
        null,
        null,
        null,
        now,
      ],
    );
  }

  // Auto-validate the scene
  const validationResult = await validateScene(sceneId);
  if (validationResult.valid) {
    scene.status = 'validated';
    scene.validationResult = validationResult;
    scene.validatedAt = new Date().toISOString();
  }

  // Update session's current scene
  await updateCurrentScene(input.sessionId, sceneId);

  // Emit delta
  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'gm_scene',
    entityId: sceneId,
    operation: 'create',
    delta: { scene },
    actorType: session.mode === 'PARTY_HUMAN_GM' ? 'gm' : 'system',
    actorId: session.humanGmId,
    timestamp: now,
  });

  return scene;
}

/**
 * Validate a scene's proposed deltas.
 */
export async function validateScene(
  sceneId: string,
): Promise<ValidationResult> {
  const scene = await getScene(sceneId);
  if (!scene) {
    throw new Error(`Scene not found: ${sceneId}`);
  }

  const session = await getGMSession(scene.gmSessionId);
  if (!session) {
    throw new Error(`GM session not found for scene: ${sceneId}`);
  }

  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Get party cursor at validation time (for TOCTOU protection)
  // INVARIANT: Commit must verify version hasn't changed since validation
  const partyCursor = await getPartyTimelineCursor(session.partyId);
  const baseVersion = partyCursor?.version ?? 0;

  // Validate each choice's deltas
  for (const choice of scene.proposal.choices) {
    if (choice.proposedDeltas.length === 0) continue;

    // Validate deltas
    const result = await validateDeltas(session.campaignId, choice.proposedDeltas);
    allErrors.push(...result.errors.map(e => `Choice "${choice.label}": ${e}`));
    allWarnings.push(...result.warnings.map(w => `Choice "${choice.label}": ${w}`));

    // Check for conflicts
    const conflicts = await checkForConflicts(session.campaignId, choice.proposedDeltas);
    allErrors.push(...conflicts.map(c => `Choice "${choice.label}": ${c}`));

    // Create speculative projection for preview (anchored to party cursor)
    if (result.valid && conflicts.length === 0 && partyCursor) {
      const speculation = await createChoiceSpeculation(
        session.campaignId,
        choice.proposedDeltas,
        partyCursor,
      );
      await updateChoiceSpeculation(choice.id, speculation.id);
    }
  }

  // INVARIANT: Record base version for TOCTOU check at commit time
  const validationResult: ValidationResult = {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    baseVersion,  // Commit will verify this hasn't changed
  };

  // Update scene with validation result (use world timestamp if available)
  const validatedAt = partyCursor?.worldTimestamp
    ? JSON.stringify(partyCursor.worldTimestamp)
    : null;

  await query(
    `UPDATE gm_scenes
     SET validation_result = ?, validated_at = ?,
         status = ?, version = version + 1
     WHERE id = ?`,
    [
      JSON.stringify(validationResult),
      validatedAt,
      validationResult.valid ? 'validated' : 'rejected',
      sceneId,
    ],
  );

  return validationResult;
}

/**
 * Apply a player's choice, committing the associated deltas.
 * This is the COMMIT phase of the two-phase commit.
 */
export async function applyPlayerChoice(
  input: ApplyChoiceInput,
): Promise<ApplyChoiceResult> {
  const session = await getGMSession(input.sessionId);
  if (!session) {
    throw new Error(`GM session not found: ${input.sessionId}`);
  }

  const scene = await getScene(input.sceneId);
  if (!scene) {
    throw new Error(`Scene not found: ${input.sceneId}`);
  }

  if (scene.gmSessionId !== input.sessionId) {
    throw new Error('Scene does not belong to this session');
  }

  if (scene.status !== 'validated') {
    throw new Error(`Cannot apply choice to scene with status: ${scene.status}`);
  }

  // Get the choice
  const choice = await getChoice(input.choiceId);
  if (!choice) {
    throw new Error(`Choice not found: ${input.choiceId}`);
  }

  if (choice.sceneId !== input.sceneId) {
    throw new Error('Choice does not belong to this scene');
  }

  if (choice.selected) {
    throw new Error('Choice has already been selected');
  }

  // TWO-PHASE COMMIT: Commit the speculative projection
  // INVARIANT: Base version must match the version used at validation time
  let committedDeltas: Delta[] = [];

  if (choice.proposedDeltas.length > 0) {
    // Get party timeline cursor for base state
    const partyCursor = await getPartyTimelineCursor(session.partyId);
    if (!partyCursor) {
      throw new Error(`Party timeline cursor not found for party: ${session.partyId}`);
    }

    // Validate that base version hasn't changed since validation
    // (TOCTOU protection)
    if (scene.validationResult && partyCursor.version !== scene.validationResult.baseVersion) {
      throw new Error(
        `Timeline has advanced since validation. ` +
        `Validated at version ${scene.validationResult.baseVersion}, ` +
        `current version ${partyCursor.version}. Re-validate the scene.`
      );
    }

    // Get base state at party cursor
    const baseState = await getStateAtCursor(session.campaignId, partyCursor);

    // Create deltas with proper structure and world timestamp
    const worldTimestamp = partyCursor.worldTimestamp;
    const now = new Date().toISOString();
    const deltasToCommit: Delta[] = choice.proposedDeltas.map((pd, index) => ({
      id: crypto.randomUUID(),
      campaignId: session.campaignId,
      entityType: pd.entityType,
      entityId: pd.entityId,
      operation: pd.operation,
      delta: pd.delta,
      version: partyCursor.version + index + 1,
      timestamp: now,
      worldTimestamp,
    })) as Delta[];

    // Create speculative projection anchored to party cursor
    const speculation = createSpeculativeProjection(
      baseState,
      partyCursor.version,
      deltasToCommit,
      30,
    );

    // Commit the projection
    committedDeltas = await commitSpeculativeProjection(
      speculation,
      async (delta) => writeDelta({
        campaignId: session.campaignId,
        entityType: delta.entityType,
        entityId: delta.entityId,
        operation: delta.operation,
        delta: delta.delta,
        actorType: 'system',
        actorId: input.selectedBy,
        timestamp: new Date().toISOString(),
        worldTimestamp: delta.worldTimestamp,
      }),
    );
  }

  const commitTimestamp = committedDeltas.length > 0
    ? committedDeltas[0].worldTimestamp
    : undefined;

  // Mark choice as selected (use world timestamp for truth, wall-clock only for operational metadata)
  await query(
    `UPDATE scene_choices
     SET selected = 1, selected_by = ?, selected_at = ?
     WHERE id = ?`,
    [input.selectedBy ?? null, commitTimestamp ? JSON.stringify(commitTimestamp) : null, input.choiceId],
  );

  // Update scene status to committed
  const committedDeltaIds = committedDeltas.map(d => d.id);
  const timeAdvancement = scene.proposal.proposedTimeAdvancement;

  await query(
    `UPDATE gm_scenes
     SET status = 'committed',
         committed_deltas = ?,
         committed_at = ?,
         player_choice_id = ?,
         time_advancement = ?,
         version = version + 1
     WHERE id = ?`,
    [
      JSON.stringify(committedDeltaIds),
      commitTimestamp ? JSON.stringify(commitTimestamp) : null,
      input.choiceId,
      timeAdvancement ? JSON.stringify(timeAdvancement) : null,
      input.sceneId,
    ],
  );

  // Update timeline cursor if time advanced
  if (timeAdvancement) {
    await updateTimelineCursor(input.sessionId, timeAdvancement);
  }

  // Emit delta for the commit (world timestamp, not wall-clock)
  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'gm_scene',
    entityId: input.sceneId,
    operation: 'update',
    delta: {
      status: 'committed',
      choiceId: input.choiceId,
      deltasCommitted: committedDeltaIds.length,
    },
    actorType: 'player',
    actorId: input.selectedBy,
    timestamp: new Date().toISOString(),
    worldTimestamp: commitTimestamp,
  });

  // Get updated scene
  const updatedScene = await getScene(input.sceneId);

  return {
    scene: updatedScene!,
    deltas: committedDeltas.map(d => ({
      id: d.id,
      entityType: d.entityType,
      entityId: d.entityId,
      operation: d.operation,
      version: d.version,
    })),
    timeAdvanced: timeAdvancement,
  };
}

/**
 * Get scene history for a session.
 */
export async function getSceneHistory(
  sessionId: string,
  options?: { limit?: number; status?: GMScene['status'] },
): Promise<GMScene[]> {
  let sql = `SELECT * FROM gm_scenes WHERE gm_session_id = ?`;
  const params: unknown[] = [sessionId];

  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }

  sql += ` ORDER BY sequence_order DESC`;

  if (options?.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  const rows = await queryAll<GMSceneRow>(sql, params);
  return rows.map(rowToScene);
}

/**
 * Get a scene by ID.
 */
export async function getScene(sceneId: string): Promise<GMScene | null> {
  const row = await queryOne<GMSceneRow>(
    `SELECT * FROM gm_scenes WHERE id = ?`,
    [sceneId],
  );

  if (!row) return null;
  return rowToScene(row);
}

/**
 * Get choices for a scene.
 */
export async function getSceneChoices(sceneId: string): Promise<SceneChoiceDB[]> {
  const rows = await queryAll<SceneChoiceDBRow>(
    `SELECT * FROM scene_choices WHERE scene_id = ? ORDER BY sort_order`,
    [sceneId],
  );

  return rows.map(rowToChoice);
}

/**
 * Get a choice by ID.
 */
export async function getChoice(choiceId: string): Promise<SceneChoiceDB | null> {
  const row = await queryOne<SceneChoiceDBRow>(
    `SELECT * FROM scene_choices WHERE id = ?`,
    [choiceId],
  );

  if (!row) return null;
  return rowToChoice(row);
}

/**
 * Override a scene (for PARTY_AI_GM mode).
 * Human GM replaces the AI-generated scene plan.
 */
export async function overrideScene(
  sceneId: string,
  newPlan: ScenePlan,
): Promise<GMScene> {
  const scene = await getScene(sceneId);
  if (!scene) {
    throw new Error(`Scene not found: ${sceneId}`);
  }

  const session = await getGMSession(scene.gmSessionId);
  if (!session) {
    throw new Error(`GM session not found for scene: ${sceneId}`);
  }

  if (session.mode !== 'PARTY_AI_GM') {
    throw new Error('Override is only available in PARTY_AI_GM mode');
  }

  if (scene.status === 'committed') {
    throw new Error('Cannot override a committed scene');
  }

  const now = new Date().toISOString();

  // Delete old choices
  await query(`DELETE FROM scene_choices WHERE scene_id = ?`, [sceneId]);

  // Update scene with new plan
  await query(
    `UPDATE gm_scenes
     SET proposal = ?,
         proposed_by = 'human_override',
         status = 'proposed',
         validation_result = NULL,
         validated_at = NULL,
         version = version + 1
     WHERE id = ?`,
    [JSON.stringify(newPlan), sceneId],
  );

  // Insert new choices
  for (let i = 0; i < newPlan.choices.length; i++) {
    const choice = newPlan.choices[i];
    await query(
      `INSERT INTO scene_choices (
        id, scene_id, label, description,
        proposed_deltas, requirements, sort_order,
        selected, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        choice.id,
        sceneId,
        choice.label,
        choice.description ?? null,
        JSON.stringify(choice.proposedDeltas),
        JSON.stringify(choice.requirements ?? {}),
        i,
        0,
        now,
      ],
    );
  }

  // Record the override
  const { recordOverride } = await import('./session');
  await recordOverride(scene.gmSessionId);

  // Re-validate the scene
  await validateScene(sceneId);

  // Emit delta
  await writeDelta({
    campaignId: session.campaignId,
    entityType: 'gm_scene',
    entityId: sceneId,
    operation: 'update',
    delta: { override: true, newPlan },
    actorType: 'gm',
    actorId: session.humanGmId,
    timestamp: now,
  });

  return (await getScene(sceneId))!;
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Party timeline cursor - the party's current position in the timeline.
 * INVARIANT: All commits must be anchored to this cursor, not canonical-latest.
 */
interface PartyTimelineCursor {
  partyId: string;
  version: number;
  worldTimestamp: WorldTimestamp;
  locationId?: string;
}

/**
 * Get the party's current timeline cursor.
 * This is the anchor point for all commits affecting this party.
 */
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

/**
 * Get the campaign state at a specific cursor position.
 * Used to build the base state for speculative projections.
 */
async function getStateAtCursor(
  campaignId: string,
  cursor: PartyTimelineCursor,
): Promise<Record<string, unknown>> {
  // Query sync_log up to cursor version to reconstruct state
  // This is a simplified implementation - full version would use
  // the projection system to build complete entity states
  const deltas = await queryAll<{
    entity_type: string;
    entity_id: string;
    operation: string;
    delta: string;
  }>(
    `SELECT entity_type, entity_id, operation, delta
     FROM sync_log
     WHERE campaign_id = ?
     AND version <= ?
     ORDER BY version ASC`,
    [campaignId, cursor.version],
  );

  // Build state by applying deltas in order
  const state: Record<string, unknown> = {};
  for (const d of deltas) {
    const key = `${d.entity_type}:${d.entity_id}`;
    const delta = JSON.parse(d.delta);

    if (d.operation === 'create') {
      state[key] = delta;
    } else if (d.operation === 'update') {
      state[key] = { ...(state[key] as Record<string, unknown> ?? {}), ...delta };
    } else if (d.operation === 'delete') {
      delete state[key];
    }
  }

  return state;
}

function createHumanGMTemplate(forceSceneType?: string): ScenePlan {
  return {
    sceneType: (forceSceneType as ScenePlan['sceneType']) ?? 'narrative',
    title: 'New Scene',
    description: 'Describe the scene...',
    readAloud: undefined,
    choices: [
      {
        id: crypto.randomUUID(),
        label: 'Continue',
        description: 'The default continuation',
        proposedDeltas: [],
        requirements: undefined,
      },
    ],
    npcsInvolved: [],
    environmentEffects: [],
    gmNotes: 'Add your notes here...',
  };
}

async function generateAIScenePlan(
  _context: unknown,
  playerHint?: string,
  forceSceneType?: string,
): Promise<ScenePlan> {
  // Placeholder AI scene generation
  // In full implementation, this would use the AI-GM module
  return {
    sceneType: (forceSceneType as ScenePlan['sceneType']) ?? 'narrative',
    title: 'AI-Generated Scene',
    description: playerHint
      ? `Scene based on: ${playerHint}`
      : 'The scene unfolds before you...',
    choices: [
      {
        id: crypto.randomUUID(),
        label: 'Investigate',
        description: 'Look more closely at the situation',
        proposedDeltas: [],
      },
      {
        id: crypto.randomUUID(),
        label: 'Proceed cautiously',
        description: 'Move forward with care',
        proposedDeltas: [],
      },
      {
        id: crypto.randomUUID(),
        label: 'Act boldly',
        description: 'Take decisive action',
        proposedDeltas: [],
      },
    ],
    npcsInvolved: [],
    environmentEffects: [],
  };
}

async function createChoiceSpeculation(
  campaignId: string,
  deltas: ProposedDelta[],
  cursor: PartyTimelineCursor,
): Promise<SpeculativeProjection> {
  // Get base state at party cursor (not empty state)
  const baseState = await getStateAtCursor(campaignId, cursor);

  const now = new Date().toISOString();
  const deltasForProjection: Delta[] = deltas.map((pd, index) => ({
    id: crypto.randomUUID(),
    campaignId,
    entityType: pd.entityType,
    entityId: pd.entityId,
    operation: pd.operation,
    delta: pd.delta,
    version: cursor.version + index + 1,
    timestamp: now,
    worldTimestamp: cursor.worldTimestamp,
  })) as Delta[];

  // Anchor speculation to party cursor version
  return createSpeculativeProjection(baseState, cursor.version, deltasForProjection, 30);
}

async function updateChoiceSpeculation(
  choiceId: string,
  speculationId: string,
): Promise<void> {
  await query(
    `UPDATE scene_choices SET speculation_id = ? WHERE id = ?`,
    [speculationId, choiceId],
  );
}

// ============================================
// ROW TYPES AND CONVERTERS
// ============================================

interface GMSceneRow {
  id: string;
  gm_session_id: string;
  scene_type: string;
  proposed_at: string;
  proposed_by: string;
  proposal: string;
  validation_result: string | null;
  validated_at: string | null;
  status: string;
  committed_deltas: string;
  committed_at: string | null;
  player_choice_id: string | null;
  time_advancement: string | null;
  sequence_order: number;
  parent_scene_id: string | null;
  created_at: string;
  version: number;
}

function rowToScene(row: GMSceneRow): GMScene {
  return GMSceneSchema.parse({
    id: row.id,
    gmSessionId: row.gm_session_id,
    sceneType: row.scene_type,
    proposedAt: row.proposed_at,
    proposedBy: row.proposed_by,
    proposal: JSON.parse(row.proposal),
    validationResult: row.validation_result ? JSON.parse(row.validation_result) : undefined,
    validatedAt: row.validated_at ?? undefined,
    status: row.status,
    committedDeltas: JSON.parse(row.committed_deltas || '[]'),
    committedAt: row.committed_at ?? undefined,
    playerChoiceId: row.player_choice_id ?? undefined,
    timeAdvancement: row.time_advancement ? JSON.parse(row.time_advancement) : undefined,
    sequenceOrder: row.sequence_order,
    parentSceneId: row.parent_scene_id ?? undefined,
    createdAt: row.created_at,
    version: row.version,
  });
}

interface SceneChoiceDBRow {
  id: string;
  scene_id: string;
  label: string;
  description: string | null;
  proposed_deltas: string;
  requirements: string;
  sort_order: number;
  selected: number;
  selected_by: string | null;
  selected_at: string | null;
  speculation_id: string | null;
  created_at: string;
}

function rowToChoice(row: SceneChoiceDBRow): SceneChoiceDB {
  return SceneChoiceDBSchema.parse({
    id: row.id,
    sceneId: row.scene_id,
    label: row.label,
    description: row.description ?? undefined,
    proposedDeltas: JSON.parse(row.proposed_deltas || '[]'),
    requirements: JSON.parse(row.requirements || '{}'),
    sortOrder: row.sort_order,
    selected: row.selected === 1,
    selectedBy: row.selected_by ?? undefined,
    selectedAt: row.selected_at ?? undefined,
    speculationId: row.speculation_id ?? undefined,
    createdAt: row.created_at,
  });
}
