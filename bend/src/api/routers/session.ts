import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  campaignProcedure,
  gmProcedure,
  IdInput,
  PaginationInput,
  notFound,
} from "../trpc";
import * as db from "../../db/queries/sessions";

// ============================================
// SESSION ROUTER
// ============================================

export const sessionRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get session by ID
   */
  get: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const session = await db.getSession(input.id);
    if (!session) notFound("Session", input.id);
    return session;
  }),

  /**
   * Get active session for campaign
   */
  active: campaignProcedure.query(async ({ ctx }) => {
    return db.getActiveSession(ctx.campaignId);
  }),

  /**
   * List campaign sessions
   */
  list: campaignProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return db.getCampaignSessions(ctx.campaignId, input?.limit);
    }),

  /**
   * Get upcoming sessions
   */
  upcoming: campaignProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(10).default(5),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return db.getUpcomingSessions(ctx.campaignId, input?.limit);
    }),

  /**
   * Get session history
   */
  history: campaignProcedure
    .input(PaginationInput.optional())
    .query(async ({ ctx, input }) => {
      return db.getSessionHistory(ctx.campaignId, input?.page, input?.pageSize);
    }),

  /**
   * Get recent events
   */
  events: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        type: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        after: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return db.getSessionEvents(input.sessionId, {
        type: input.type,
        limit: input.limit,
        after: input.after,
      });
    }),

  // ==========================================
  // MUTATIONS - LIFECYCLE
  // ==========================================

  /**
   * Create new session
   */
  create: gmProcedure
    .input(
      z.object({
        name: z.string().max(100).optional(),
        scheduledAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.createSession({
        campaignId: ctx.campaignId,
        name: input.name,
        scheduledAt: input.scheduledAt
          ? new Date(input.scheduledAt)
          : undefined,
      });
    }),

  /**
   * Start session
   */
  start: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        playerIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await db.getSession(input.id);
      if (!session) notFound("Session", input.id);

      if (session.status !== "scheduled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not in scheduled state",
        });
      }

      return db.startSession(input.id, input.playerIds);
    }),

  /**
   * Pause session
   */
  pause: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    const session = await db.getSession(input.id);
    if (!session) notFound("Session", input.id);

    if (session.status !== "active") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Session is not active",
      });
    }

    return db.pauseSession(input.id);
  }),

  /**
   * Resume session
   */
  resume: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    const session = await db.getSession(input.id);
    if (!session) notFound("Session", input.id);

    if (session.status !== "paused") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Session is not paused",
      });
    }

    return db.resumeSession(input.id);
  }),

  /**
   * End session
   */
  end: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        summary: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await db.getSession(input.id);
      if (!session) notFound("Session", input.id);

      if (session.status === "ended") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session already ended",
        });
      }

      return db.endSession(input.id, input.summary);
    }),

  // ==========================================
  // MUTATIONS - SCENE & LOCATION
  // ==========================================

  /**
   * Set current scene
   */
  setScene: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        sceneId: z.string().uuid(),
        locationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.setScene(input.sessionId, input.sceneId, input.locationId);
    }),

  /**
   * Set current location
   */
  setLocation: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        locationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.setLocation(input.sessionId, input.locationId);
    }),

  // ==========================================
  // MUTATIONS - UPDATES
  // ==========================================

  /**
   * Update session
   */
  update: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().max(100).optional(),
        summary: z.string().max(5000).optional(),
        notes: z.string().max(10000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      return db.updateSession(id, updates);
    }),

  // ==========================================
  // MUTATIONS - EVENTS
  // ==========================================

  /**
   * Log player action
   */
  logPlayerAction: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        action: z.string().min(1).max(50),
        data: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.logPlayerAction(
        input.sessionId,
        ctx.auth.userId,
        ctx.auth.displayName || "Unknown",
        input.action,
        input.data,
      );
    }),

  /**
   * Log GM action
   */
  logGMAction: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        action: z.string().min(1).max(50),
        data: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.logGMAction(
        input.sessionId,
        ctx.auth.userId,
        input.action,
        input.data,
      );
    }),

  /**
   * Log dice roll
   */
  logDiceRoll: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        expression: z.string().min(1).max(100),
        result: z.number(),
        breakdown: z.string(),
        purpose: z.string().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.logDiceRoll(
        input.sessionId,
        ctx.auth.userId,
        ctx.auth.displayName || "Unknown",
        ctx.checker.isGM() ? "gm" : "player",
        {
          expression: input.expression,
          result: input.result,
          breakdown: input.breakdown,
          purpose: input.purpose,
        },
      );
    }),

  /**
   * Send chat message
   */
  chat: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        message: z.string().min(1).max(2000),
        isWhisper: z.boolean().default(false),
        whisperTo: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.logChat(
        input.sessionId,
        ctx.auth.userId,
        ctx.auth.displayName || "Unknown",
        ctx.checker.isGM() ? "gm" : "player",
        input.message,
        input.isWhisper,
        input.whisperTo,
      );
    }),
});
