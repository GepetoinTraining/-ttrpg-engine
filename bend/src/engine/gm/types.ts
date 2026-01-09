import { z } from 'zod';
import { CardTypeSchema, type CardType } from '../session/live';
import { WorldTimestampSchema } from '../timeline/substrate';

// Re-export CardType for convenience
export { CardTypeSchema, type CardType };

// ============================================
// GM ORCHESTRATOR TYPES
// ============================================
//
// Three game modes:
// - PARTY_HUMAN_GM: Classic TTRPG with human GM, engine validates
// - PARTY_AI_GM: AI mediates party play, human can override
// - SOLO_AI_GM: AI mediates solo "corridor" experience
//
// SOLO_HUMAN_GM explicitly rejected - solo play requires AI assistance.
//
// Core principle: GM is "lens + pacing interface, not authority"
// All world changes via validated deltas through canonical engine pathways.
//

// ============================================
// GM MODE
// ============================================

export const GMModeSchema = z.enum([
  'PARTY_HUMAN_GM',  // Classic TTRPG: human GM, engine validates
  'PARTY_AI_GM',     // AI mediates, human can override
  'SOLO_AI_GM',      // AI mediates solo corridor experience
]);
export type GMMode = z.infer<typeof GMModeSchema>;

/**
 * Validate mode and explicitly reject SOLO_HUMAN_GM.
 * Solo play requires AI assistance.
 */
export function validateMode(mode: string): GMMode {
  if (mode === 'SOLO_HUMAN_GM') {
    throw new Error('SOLO_HUMAN_GM is not supported - solo play requires AI assistance');
  }
  return GMModeSchema.parse(mode);
}

// ============================================
// AI PROFILE
// ============================================
//
// GM personality/style presets for AI-mediated modes.
//

export const AIProfileStyleSchema = z.object({
  // Narrative style
  descriptiveness: z.enum(['minimal', 'moderate', 'verbose']).default('moderate'),
  combatNarration: z.enum(['mechanical', 'balanced', 'cinematic']).default('balanced'),

  // Difficulty tuning
  challengeLevel: z.enum(['forgiving', 'standard', 'challenging', 'brutal']).default('standard'),

  // Player agency
  railroading: z.enum(['sandbox', 'guided', 'structured']).default('guided'),

  // Tone modifiers
  humor: z.enum(['none', 'light', 'moderate', 'frequent']).default('light'),
  darkness: z.enum(['light', 'moderate', 'dark', 'grimdark']).default('moderate'),
});
export type AIProfileStyle = z.infer<typeof AIProfileStyleSchema>;

export const AIProfileNarrativeConfigSchema = z.object({
  hooksEnabled: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  intensity: z.number().min(0).max(1).default(0.5),
});
export type AIProfileNarrativeConfig = z.infer<typeof AIProfileNarrativeConfigSchema>;

export const AIProfileSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid().optional(),

  name: z.string(),
  description: z.string().optional(),

  style: AIProfileStyleSchema,

  tone: z.enum(['serious', 'balanced', 'lighthearted']).default('balanced'),
  pacing: z.enum(['slow', 'moderate', 'fast']).default('moderate'),

  narrativeConfig: AIProfileNarrativeConfigSchema,

  voice: z.record(z.string(), z.any()).default({}),

  isSystemPreset: z.boolean().default(false),

  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().default(1),
});
export type AIProfile = z.infer<typeof AIProfileSchema>;

// ============================================
// CONTEXT PACKET - Truth slice GM is allowed to know
// ============================================

export const ContextPacketMemberSchema = z.object({
  characterId: z.string().uuid(),
  name: z.string(),
  hpCurrent: z.number().int(),
  hpMax: z.number().int(),
  ac: z.number().int(),
  conditions: z.array(z.string()).default([]),
  resources: z.record(z.string(), z.object({
    current: z.number(),
    max: z.number(),
  })).optional(),
});
export type ContextPacketMember = z.infer<typeof ContextPacketMemberSchema>;

export const ContextPacketPartyStateSchema = z.object({
  members: z.array(ContextPacketMemberSchema),
  partyLevel: z.number().int(),
  partyGold: z.number().int().optional(),
});
export type ContextPacketPartyState = z.infer<typeof ContextPacketPartyStateSchema>;

export const ContextPacketNpcSchema = z.object({
  npcId: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  disposition: z.string().optional(),
  knownInfo: z.array(z.string()).default([]),
});
export type ContextPacketNpc = z.infer<typeof ContextPacketNpcSchema>;

export const ContextPacketQuestSchema = z.object({
  questId: z.string().uuid(),
  name: z.string(),
  status: z.string(),
  currentObjective: z.string().optional(),
});
export type ContextPacketQuest = z.infer<typeof ContextPacketQuestSchema>;

export const ContextPacketLocationSchema = z.object({
  locationId: z.string().uuid().optional(),
  name: z.string(),
  description: z.string(),
  features: z.array(z.string()).default([]),
});
export type ContextPacketLocation = z.infer<typeof ContextPacketLocationSchema>;

export const ContextPacketWorldStateSchema = z.object({
  worldDate: WorldTimestampSchema.optional(),
  weather: z.string().optional(),
  timeOfDay: z.string().optional(),
  activeEvents: z.array(z.string()).default([]),
});
export type ContextPacketWorldState = z.infer<typeof ContextPacketWorldStateSchema>;

/**
 * INVARIANT: Context packet is built from party cursor, not canonical-latest.
 * This prevents leaking future information to lagging parties.
 */
export const ContextPacketSchema = z.object({
  // Party state (current HP, resources, conditions)
  partyState: ContextPacketPartyStateSchema,

  // Visible NPCs in current location
  visibleNpcs: z.array(ContextPacketNpcSchema),

  // Known quests and revealed secrets
  knownQuests: z.array(ContextPacketQuestSchema),
  revealedSecrets: z.array(z.string()),

  // Current location context
  currentLocation: ContextPacketLocationSchema,

  // World state relevant to current scene
  worldState: ContextPacketWorldStateSchema,

  // Metadata - INVARIANT: Uses WorldTimestamp, not wall-clock
  computedAt: WorldTimestampSchema,  // WorldTimestamp, not wall-clock string
  baseVersion: z.number().int(),     // Party cursor version, not canonical-latest
});
export type ContextPacket = z.infer<typeof ContextPacketSchema>;

// What the GM must NOT know
export const ContextExclusionsSchema = z.object({
  hiddenSecrets: z.array(z.string().uuid()).default([]),
  futureEvents: z.array(z.string().uuid()).default([]),
  unrolledDice: z.boolean().default(true),
  playerPrivateNotes: z.boolean().default(true),
  otherFactionPlans: z.array(z.string().uuid()).default([]),
});
export type ContextExclusions = z.infer<typeof ContextExclusionsSchema>;

// ============================================
// PROPOSED DELTA - Engine delta proposal
// ============================================

export const ProposedDeltaSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  delta: z.record(z.string(), z.any()),
});
export type ProposedDelta = z.infer<typeof ProposedDeltaSchema>;

// ============================================
// SCENE PLAN - AI/GM output for scene proposal
// ============================================

export const SceneChoiceRequirementsSchema = z.object({
  minLevel: z.number().int().optional(),
  requiredSkill: z.string().optional(),
  requiredItem: z.string().optional(),
  dcCheck: z.object({
    skill: z.string(),
    dc: z.number().int(),
  }).optional(),
}).optional();
export type SceneChoiceRequirements = z.infer<typeof SceneChoiceRequirementsSchema>;

export const SceneChoiceSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string().optional(),

  // Proposed delta effects if chosen
  proposedDeltas: z.array(ProposedDeltaSchema).default([]),

  // Requirements to see/select
  requirements: SceneChoiceRequirementsSchema,
});
export type SceneChoice = z.infer<typeof SceneChoiceSchema>;

export const SceneNpcSchema = z.object({
  npcId: z.string().uuid(),
  name: z.string(),
  role: z.string(),
});
export type SceneNpc = z.infer<typeof SceneNpcSchema>;

export const SceneEnvironmentEffectSchema = z.object({
  effect: z.string(),
  mechanicalImpact: z.string().optional(),
});
export type SceneEnvironmentEffect = z.infer<typeof SceneEnvironmentEffectSchema>;

export const ScenePlanSchema = z.object({
  // Scene identity
  sceneType: CardTypeSchema,
  title: z.string(),

  // Content
  description: z.string(),
  readAloud: z.string().optional(),

  // Player choices
  choices: z.array(SceneChoiceSchema).default([]),

  // NPCs involved
  npcsInvolved: z.array(SceneNpcSchema).default([]),

  // Environment
  environmentEffects: z.array(SceneEnvironmentEffectSchema).default([]),

  // Conditions
  successConditions: z.array(z.string()).optional(),
  failureConditions: z.array(z.string()).optional(),

  // Time
  proposedTimeAdvancement: WorldTimestampSchema.optional(),

  // GM notes (only for PARTY_HUMAN_GM and overrides)
  gmNotes: z.string().optional(),
});
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

// ============================================
// VALIDATION RESULT
// ============================================

/**
 * INVARIANT: baseVersion records the party cursor version at validation time.
 * Commit must verify this hasn't changed (TOCTOU protection).
 */
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  baseVersion: z.number().int().optional(),  // Party cursor version at validation time
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ============================================
// GM SESSION
// ============================================

export const GMSessionStatusSchema = z.enum(['active', 'paused', 'ended']);
export type GMSessionStatus = z.infer<typeof GMSessionStatusSchema>;

export const GMSessionSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  partyId: z.string().uuid(),

  mode: GMModeSchema,

  aiProfileId: z.string().uuid().optional(),
  humanGmId: z.string().uuid().optional(),

  status: GMSessionStatusSchema,

  currentSceneId: z.string().uuid().optional(),
  contextPacket: ContextPacketSchema.optional(),
  timelineCursor: WorldTimestampSchema.optional(),

  sessionId: z.string().uuid().optional(),
  activeCorridorId: z.string().uuid().optional(),

  overrideCount: z.number().int().default(0),
  lastOverrideAt: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
  endedAt: z.string().optional(),
  version: z.number().int().default(1),
});
export type GMSession = z.infer<typeof GMSessionSchema>;

// ============================================
// GM SCENE
// ============================================

export const GMSceneStatusSchema = z.enum(['proposed', 'validated', 'committed', 'rejected']);
export type GMSceneStatus = z.infer<typeof GMSceneStatusSchema>;

export const GMSceneSchema = z.object({
  id: z.string().uuid(),
  gmSessionId: z.string().uuid(),

  sceneType: CardTypeSchema,

  proposedAt: z.string(),
  proposedBy: z.string(),

  proposal: ScenePlanSchema,

  validationResult: ValidationResultSchema.optional(),
  validatedAt: z.string().optional(),

  status: GMSceneStatusSchema,

  committedDeltas: z.array(z.string()).default([]),
  committedAt: z.string().optional(),

  playerChoiceId: z.string().optional(),
  timeAdvancement: WorldTimestampSchema.optional(),

  sequenceOrder: z.number().int(),
  parentSceneId: z.string().uuid().optional(),

  createdAt: z.string(),
  version: z.number().int().default(1),
});
export type GMScene = z.infer<typeof GMSceneSchema>;

// ============================================
// SCENE CHOICE (DB representation)
// ============================================

export const SceneChoiceDBSchema = z.object({
  id: z.string().uuid(),
  sceneId: z.string().uuid(),

  label: z.string(),
  description: z.string().optional(),

  proposedDeltas: z.array(ProposedDeltaSchema).default([]),
  requirements: SceneChoiceRequirementsSchema,

  sortOrder: z.number().int().default(0),

  selected: z.boolean().default(false),
  selectedBy: z.string().uuid().optional(),
  selectedAt: z.string().optional(),

  speculationId: z.string().uuid().optional(),

  createdAt: z.string(),
});
export type SceneChoiceDB = z.infer<typeof SceneChoiceDBSchema>;

// ============================================
// SOLO CORRIDOR
// ============================================

export const CorridorTypeSchema = z.enum([
  'exploration',
  'combat',
  'social',
  'puzzle',
  'mixed',
]);
export type CorridorType = z.infer<typeof CorridorTypeSchema>;

export const CorridorStatusSchema = z.enum([
  'active',
  'completed',
  'abandoned',
  'merged',
]);
export type CorridorStatus = z.infer<typeof CorridorStatusSchema>;

export const RejoinPointSchema = z.object({
  locationId: z.string().uuid(),
  worldTimestamp: WorldTimestampSchema,
  narrativeContext: z.string(),
  triggerCondition: z.string().optional(),
});
export type RejoinPoint = z.infer<typeof RejoinPointSchema>;

export const MergeResolutionStrategySchema = z.enum(['replace', 'merge', 'branch']);
export type MergeResolutionStrategy = z.infer<typeof MergeResolutionStrategySchema>;

/**
 * Resolution for a specific entity conflict.
 * INVARIANT: Must include entityType for proper entity-aware resolution.
 */
export const ConflictResolutionSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  resolution: z.enum(['use_corridor', 'use_main', 'custom']),
  resolvedDelta: z.record(z.string(), z.unknown()).optional(),  // For 'custom' resolution
});
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

export const MergeResolutionSchema = z.object({
  strategy: MergeResolutionStrategySchema,
  conflictResolutions: z.array(ConflictResolutionSchema).default([]),
  finalDeltas: z.array(z.string()).default([]),
});
export type MergeResolution = z.infer<typeof MergeResolutionSchema>;

export const SoloCorridorSchema = z.object({
  id: z.string().uuid(),
  gmSessionId: z.string().uuid(),

  parentCampaignStateVersion: z.number().int(),

  rejoinPoint: RejoinPointSchema,

  status: CorridorStatusSchema,

  mergeResolution: MergeResolutionSchema.optional(),
  mergedAt: z.string().optional(),
  mergedBy: z.string().uuid().optional(),

  corridorType: CorridorTypeSchema,
  estimatedDuration: z.string().optional(),

  corridorDeltas: z.array(z.string()).default([]),
  // INVARIANT: No characterSnapshot - derive from deltas at parentCampaignStateVersion
  // Snapshots are truth hazards and must not exist in canonical paths

  createdAt: WorldTimestampSchema,  // Use WorldTimestamp, not wall-clock
  updatedAt: WorldTimestampSchema,
  version: z.number().int().default(1),
});
export type SoloCorridor = z.infer<typeof SoloCorridorSchema>;

// ============================================
// INPUT TYPES FOR API OPERATIONS
// ============================================

export const StartGMSessionInputSchema = z.object({
  campaignId: z.string().uuid(),
  partyId: z.string().uuid(),
  mode: GMModeSchema,
  aiProfileId: z.string().uuid().optional(),
  humanGmId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});
export type StartGMSessionInput = z.infer<typeof StartGMSessionInputSchema>;

export const GenerateSceneInputSchema = z.object({
  sessionId: z.string().uuid(),
  playerHint: z.string().optional(),
  forceSceneType: CardTypeSchema.optional(),
});
export type GenerateSceneInput = z.infer<typeof GenerateSceneInputSchema>;

export const ApplyChoiceInputSchema = z.object({
  sessionId: z.string().uuid(),
  sceneId: z.string().uuid(),
  choiceId: z.string().uuid(),
  selectedBy: z.string().uuid().optional(),
});
export type ApplyChoiceInput = z.infer<typeof ApplyChoiceInputSchema>;

export const StartCorridorInputSchema = z.object({
  sessionId: z.string().uuid(),
  corridorType: CorridorTypeSchema.optional(),
  estimatedDuration: z.string().optional(),
});
export type StartCorridorInput = z.infer<typeof StartCorridorInputSchema>;

export const MergeCorridorInputSchema = z.object({
  corridorId: z.string().uuid(),
  resolution: MergeResolutionSchema,
});
export type MergeCorridorInput = z.infer<typeof MergeCorridorInputSchema>;

export const CreateAIProfileInputSchema = AIProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});
export type CreateAIProfileInput = z.infer<typeof CreateAIProfileInputSchema>;

// ============================================
// RESULT TYPES
// ============================================

export const ApplyChoiceResultSchema = z.object({
  scene: GMSceneSchema,
  deltas: z.array(z.object({
    id: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    operation: z.string(),
    version: z.number().int(),
  })),
  timeAdvanced: WorldTimestampSchema.optional(),
});
export type ApplyChoiceResult = z.infer<typeof ApplyChoiceResultSchema>;

export const MergeCorridorResultSchema = z.object({
  corridor: SoloCorridorSchema,
  deltasWritten: z.number().int(),
  conflictsResolved: z.number().int(),
});
export type MergeCorridorResult = z.infer<typeof MergeCorridorResultSchema>;

// ============================================
// DEFAULT AI PROFILES
// ============================================

export const DEFAULT_AI_PROFILES: Omit<AIProfile, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Classic Narrator',
    description: 'Traditional fantasy narration with balanced pacing',
    style: {
      descriptiveness: 'moderate',
      combatNarration: 'balanced',
      challengeLevel: 'standard',
      railroading: 'guided',
      humor: 'light',
      darkness: 'moderate',
    },
    tone: 'balanced',
    pacing: 'moderate',
    narrativeConfig: {
      hooksEnabled: ['plot', 'character', 'world'],
      themes: ['adventure', 'heroism', 'discovery'],
      intensity: 0.5,
    },
    voice: {},
    isSystemPreset: true,
    version: 1,
  },
  {
    name: 'Gritty Realist',
    description: 'Dark, consequences-matter style with challenging encounters',
    style: {
      descriptiveness: 'verbose',
      combatNarration: 'cinematic',
      challengeLevel: 'challenging',
      railroading: 'sandbox',
      humor: 'none',
      darkness: 'dark',
    },
    tone: 'serious',
    pacing: 'slow',
    narrativeConfig: {
      hooksEnabled: ['consequence', 'mortality', 'faction'],
      themes: ['survival', 'moral_ambiguity', 'consequences'],
      intensity: 0.8,
    },
    voice: {},
    isSystemPreset: true,
    version: 1,
  },
  {
    name: 'Lighthearted Adventure',
    description: 'Fun, forgiving gameplay with comedic elements',
    style: {
      descriptiveness: 'moderate',
      combatNarration: 'balanced',
      challengeLevel: 'forgiving',
      railroading: 'structured',
      humor: 'frequent',
      darkness: 'light',
    },
    tone: 'lighthearted',
    pacing: 'fast',
    narrativeConfig: {
      hooksEnabled: ['comedy', 'friendship', 'spectacle'],
      themes: ['fun', 'friendship', 'triumph'],
      intensity: 0.3,
    },
    voice: {},
    isSystemPreset: true,
    version: 1,
  },
];
