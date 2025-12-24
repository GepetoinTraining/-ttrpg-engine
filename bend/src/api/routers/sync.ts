import { z } from "zod";
import { router, campaignProcedure, notFound } from "../trpc";
import * as sync from "../../db/queries/sync";

// ============================================
// SYNC ROUTER
// ============================================
//
// Delta sync for real-time multiplayer.
// Clients poll for changes since their last cursor.
//

export const syncRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get initial sync state
   */
  init: campaignProcedure
    .input(
      z
        .object({
          sessionId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return sync.getFullSync(ctx.campaignId, input?.sessionId);
    }),

  /**
   * Get current cursor position
   */
  cursor: campaignProcedure
    .input(
      z
        .object({
          sessionId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return sync.getCurrentCursor(ctx.campaignId, input?.sessionId);
    }),

  /**
   * Get changes since cursor
   */
  changes: campaignProcedure
    .input(
      z.object({
        lastVersion: z.number().int().min(0),
        lastTimestamp: z.string(),
        sessionId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cursor: sync.SyncCursor = {
        campaignId: ctx.campaignId,
        sessionId: input.sessionId,
        lastVersion: input.lastVersion,
        lastTimestamp: input.lastTimestamp,
      };

      return sync.getChangesSince(cursor, input.limit);
    }),

  // ==========================================
  // SUBSCRIPTIONS (for WebSocket)
  // ==========================================
  //
  // These are placeholders - actual subscriptions
  // are handled by the WebSocket layer.
  //

  /**
   * Subscribe to campaign changes
   * Returns subscription ID for WebSocket
   */
  subscribe: campaignProcedure
    .input(
      z
        .object({
          sessionId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const cursor = await sync.getCurrentCursor(
        ctx.campaignId,
        input?.sessionId,
      );

      const subscription = sync.createSubscription(
        ctx.campaignId,
        input?.sessionId || null,
        ctx.auth.userId,
        cursor,
      );

      return {
        subscriptionId: subscription.id,
        cursor,
      };
    }),

  /**
   * Unsubscribe
   */
  unsubscribe: campaignProcedure
    .input(
      z.object({
        subscriptionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      sync.removeSubscription(input.subscriptionId);
      return { success: true };
    }),

  /**
   * Update cursor after processing changes
   */
  ack: campaignProcedure
    .input(
      z.object({
        subscriptionId: z.string().uuid(),
        lastVersion: z.number().int(),
        lastTimestamp: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      sync.updateSubscriptionCursor(input.subscriptionId, {
        campaignId: ctx.campaignId,
        lastVersion: input.lastVersion,
        lastTimestamp: input.lastTimestamp,
      });
      return { success: true };
    }),

  /**
   * Push client deltas to server
   */
  push: campaignProcedure
    .input(
      z.object({
        deltas: z.array(
          z.object({
            id: z.string().uuid(),
            table: z.string(),
            recordId: z.string(),
            operation: z.enum(['create', 'update', 'delete']),
            data: z.record(z.any()).optional(),
            clientVersion: z.number().int(),
            clientTimestamp: z.string(),
          })
        ),
        sessionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Apply each delta
      const results = await Promise.all(
        input.deltas.map(async (delta) => {
          try {
            // Log to sync_log table
            await sync.logChange(
              ctx.campaignId,
              input.sessionId || null,
              delta.table,
              delta.recordId,
              delta.operation as 'create' | 'update' | 'delete',
              delta.data || {},
              ctx.auth.userId,
              'player'
            );

            return {
              id: delta.id,
              status: 'confirmed' as const
            };
          } catch (error) {
            return {
              id: delta.id,
              status: 'rejected' as const,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      // Get new cursor after applying changes
      const cursor = await sync.getCurrentCursor(
        ctx.campaignId,
        input.sessionId
      );

      return {
        results,
        serverVersion: cursor.lastVersion,
        serverTimestamp: cursor.lastTimestamp,
      };
    }),
});
