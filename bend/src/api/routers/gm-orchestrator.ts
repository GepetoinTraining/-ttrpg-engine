import { z } from "zod";
import {
  router,
  gmProcedure,
  campaignProcedure,
  notFound,
} from "../trpc";
import {
  GMModeSchema,
  ScenePlanSchema,
  CorridorTypeSchema,
  MergeResolutionStrategySchema,
  AIProfileStyleSchema,
  AIProfileNarrativeConfigSchema,
} from "../../engine/gm/types";
import * as gm from "../../engine/gm";

// ============================================
// GM ORCHESTRATOR ROUTER
// ============================================
//
// Three game modes:
// - PARTY_HUMAN_GM: Classic TTRPG with human GM, engine validates
// - PARTY_AI_GM: AI mediates party play, human can override
// - SOLO_AI_GM: AI mediates solo "corridor" experience
//
// SOLO_HUMAN_GM explicitly rejected - solo play requires AI assistance.
//

export const gmOrchestratorRouter = router({
  // ==========================================
  // SESSION LIFECYCLE
  // ==========================================

  /**
   * Start a new GM session.
   */
  startSession: gmProcedure
    .input(
      z.object({
        partyId: z.string().uuid(),
        mode: GMModeSchema,
        aiProfileId: z.string().uuid().optional(),
        sessionId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return gm.startGMSession({
        campaignId: ctx.campaignId,
        partyId: input.partyId,
        mode: input.mode,
        aiProfileId: input.aiProfileId,
        humanGmId: ctx.auth.userId,
        sessionId: input.sessionId,
      });
    }),

  /**
   * Get the active GM session for a party.
   */
  getActiveSession: campaignProcedure
    .input(
      z.object({
        partyId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return gm.getActiveGMSession(input.partyId);
    }),

  /**
   * Get a GM session by ID.
   */
  getSession: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const session = await gm.getGMSession(input.sessionId);
      if (!session) {
        notFound("GM Session", input.sessionId);
      }
      return session;
    }),

  /**
   * List GM sessions for the campaign.
   */
  listSessions: campaignProcedure
    .input(
      z.object({
        status: z.enum(["active", "paused", "ended"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return gm.getGMSessionsByCampaign(ctx.campaignId, {
        status: input.status,
        limit: input.limit,
      });
    }),

  /**
   * Pause an active GM session.
   */
  pauseSession: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.pauseGMSession(input.sessionId);
    }),

  /**
   * Resume a paused GM session.
   */
  resumeSession: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.resumeGMSession(input.sessionId);
    }),

  /**
   * End a GM session.
   */
  endSession: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.endGMSession(input.sessionId);
    }),

  // ==========================================
  // SCENE MANAGEMENT
  // ==========================================

  /**
   * Generate the next scene.
   */
  generateNextScene: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        playerHint: z.string().optional(),
        forceSceneType: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.generateNextScene({
        sessionId: input.sessionId,
        playerHint: input.playerHint,
        forceSceneType: input.forceSceneType as any,
      });
    }),

  /**
   * Get a scene by ID.
   */
  getScene: campaignProcedure
    .input(
      z.object({
        sceneId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const scene = await gm.getScene(input.sceneId);
      if (!scene) {
        notFound("Scene", input.sceneId);
      }
      return scene;
    }),

  /**
   * Get choices for a scene.
   */
  getSceneChoices: campaignProcedure
    .input(
      z.object({
        sceneId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return gm.getSceneChoices(input.sceneId);
    }),

  /**
   * Get scene history for a session.
   */
  getSceneHistory: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        status: z.enum(["proposed", "validated", "committed", "rejected"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      return gm.getSceneHistory(input.sessionId, {
        status: input.status,
        limit: input.limit,
      });
    }),

  /**
   * Apply a player's choice (commit deltas).
   */
  applyPlayerChoice: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        sceneId: z.string().uuid(),
        choiceId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // selectedBy is the user ID - character association is handled by the scene system
      const selectedBy = ctx.auth?.userId;

      return gm.applyPlayerChoice({
        sessionId: input.sessionId,
        sceneId: input.sceneId,
        choiceId: input.choiceId,
        selectedBy,
      });
    }),

  /**
   * Override a scene (PARTY_AI_GM mode only).
   */
  overrideScene: gmProcedure
    .input(
      z.object({
        sceneId: z.string().uuid(),
        newPlan: ScenePlanSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return gm.overrideScene(input.sceneId, input.newPlan);
    }),

  // ==========================================
  // SOLO CORRIDORS
  // ==========================================

  /**
   * Start a solo corridor (SOLO_AI_GM mode only).
   */
  startCorridor: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        corridorType: CorridorTypeSchema.optional(),
        estimatedDuration: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.startCorridor({
        sessionId: input.sessionId,
        corridorType: input.corridorType,
        estimatedDuration: input.estimatedDuration,
      });
    }),

  /**
   * Get a corridor by ID.
   */
  getCorridor: campaignProcedure
    .input(
      z.object({
        corridorId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const corridor = await gm.getCorridor(input.corridorId);
      if (!corridor) {
        notFound("Corridor", input.corridorId);
      }
      return corridor;
    }),

  /**
   * Get active corridors for a session.
   */
  getActiveCorridors: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return gm.getActiveCorridors(input.sessionId);
    }),

  /**
   * Complete a corridor (ready for merge).
   */
  completeCorridor: gmProcedure
    .input(
      z.object({
        corridorId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.completeCorridor(input.corridorId);
    }),

  /**
   * Abandon a corridor (discard changes).
   */
  abandonCorridor: gmProcedure
    .input(
      z.object({
        corridorId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.abandonCorridor(input.corridorId);
    }),

  /**
   * Merge a completed corridor back into main timeline.
   */
  mergeCorridor: gmProcedure
    .input(
      z.object({
        corridorId: z.string().uuid(),
        resolution: z.object({
          strategy: MergeResolutionStrategySchema,
          conflictResolutions: z
            .array(
              z.object({
                entityType: z.string(),
                entityId: z.string(),
                resolution: z.enum(['use_corridor', 'use_main', 'custom']),
                resolvedDelta: z.record(z.string(), z.unknown()).optional(),
              }),
            )
            .optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      return gm.mergeCorridor({
        corridorId: input.corridorId,
        resolution: {
          strategy: input.resolution.strategy,
          conflictResolutions: input.resolution.conflictResolutions ?? [],
          finalDeltas: [],
        },
      });
    }),

  // ==========================================
  // AI PROFILES
  // ==========================================

  /**
   * List AI profiles for the campaign.
   */
  listProfiles: campaignProcedure
    .input(
      z.object({
        includeSystemPresets: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      return gm.listAIProfiles(ctx.campaignId, {
        includeSystemPresets: input.includeSystemPresets,
      });
    }),

  /**
   * Get an AI profile by ID.
   */
  getProfile: campaignProcedure
    .input(
      z.object({
        profileId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const profile = await gm.getAIProfile(input.profileId);
      if (!profile) {
        notFound("AI Profile", input.profileId);
      }
      return profile;
    }),

  /**
   * Get system preset profiles.
   */
  getSystemProfiles: campaignProcedure.query(async () => {
    return gm.getSystemProfiles();
  }),

  /**
   * Create a custom AI profile.
   */
  createProfile: gmProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        style: AIProfileStyleSchema.optional(),
        tone: z.enum(["serious", "balanced", "lighthearted"]).optional(),
        pacing: z.enum(["slow", "moderate", "fast"]).optional(),
        narrativeConfig: AIProfileNarrativeConfigSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return gm.createAIProfile(ctx.campaignId, {
        name: input.name,
        description: input.description,
        style: input.style ?? {
          descriptiveness: "moderate",
          combatNarration: "balanced",
          challengeLevel: "standard",
          railroading: "guided",
          humor: "light",
          darkness: "moderate",
        },
        tone: input.tone ?? "balanced",
        pacing: input.pacing ?? "moderate",
        narrativeConfig: input.narrativeConfig ?? {
          hooksEnabled: [],
          themes: [],
          intensity: 0.5,
        },
        voice: {},  // Empty voice fingerprint for custom profiles
        isSystemPreset: false,  // User-created profiles are not system presets
      });
    }),

  /**
   * Update an AI profile.
   */
  updateProfile: gmProcedure
    .input(
      z.object({
        profileId: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        style: AIProfileStyleSchema.optional(),
        tone: z.enum(["serious", "balanced", "lighthearted"]).optional(),
        pacing: z.enum(["slow", "moderate", "fast"]).optional(),
        narrativeConfig: AIProfileNarrativeConfigSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { profileId, ...updates } = input;
      return gm.updateAIProfile(profileId, updates);
    }),

  /**
   * Delete an AI profile.
   */
  deleteProfile: gmProcedure
    .input(
      z.object({
        profileId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      await gm.deleteAIProfile(input.profileId);
      return { success: true };
    }),

  // ==========================================
  // CONTEXT
  // ==========================================

  /**
   * Get the context packet for a session.
   */
  getContextPacket: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        forceRefresh: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      if (input.forceRefresh) {
        return gm.refreshContextPacket(input.sessionId);
      }
      return gm.buildContextPacket(input.sessionId);
    }),

  /**
   * Get context exclusions (what GM must NOT know).
   */
  getContextExclusions: gmProcedure
    .input(
      z.object({
        partyId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return gm.getContextExclusions(ctx.campaignId, input.partyId);
    }),

  // ==========================================
  // VALIDATION
  // ==========================================

  /**
   * Validate proposed deltas (preview before commit).
   */
  validateDeltas: gmProcedure
    .input(
      z.object({
        deltas: z.array(
          z.object({
            entityType: z.string(),
            entityId: z.string(),
            operation: z.enum(["create", "update", "delete"]),
            delta: z.record(z.string(), z.any()),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return gm.validateDeltas(ctx.campaignId, input.deltas);
    }),
});
