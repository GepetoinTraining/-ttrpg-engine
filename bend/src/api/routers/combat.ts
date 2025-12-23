import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  campaignProcedure,
  gmProcedure,
  IdInput,
  notFound,
  forbidden,
} from "../trpc";
import * as db from "../../db/queries/combat";

// ============================================
// COMBAT ROUTER
// ============================================

export const combatRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get combat by ID
   */
  get: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const combat = await db.getCombat(input.id);
    if (!combat) notFound("Combat", input.id);
    return combat;
  }),

  /**
   * Get active combat in session
   */
  active: campaignProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db.getActiveCombat(input.sessionId);
    }),

  /**
   * Get participants
   */
  participants: campaignProcedure
    .input(IdInput)
    .query(async ({ ctx, input }) => {
      const combat = await db.getCombat(input.id);
      if (!combat) notFound("Combat", input.id);
      return db.getParticipants(input.id);
    }),

  /**
   * Get initiative order
   */
  initiativeOrder: campaignProcedure
    .input(IdInput)
    .query(async ({ ctx, input }) => {
      const combat = await db.getCombat(input.id);
      if (!combat) notFound("Combat", input.id);

      const order = await db.getInitiativeOrder(input.id);

      // Filter hidden monsters for non-GMs
      if (!ctx.checker.isGM()) {
        return order.filter(
          (p) => p.isVisible === 1 || p.entityType === "character",
        );
      }

      return order;
    }),

  /**
   * Get combat log
   */
  log: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      return db.getCombatLog(input.id, input.limit);
    }),

  /**
   * Get round log
   */
  roundLog: campaignProcedure
    .input(
      z.object({
        combatId: z.string().uuid(),
        round: z.number().int().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      return db.getRoundLog(input.combatId, input.round);
    }),

  /**
   * Get campaign combat history
   */
  history: campaignProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return db.getCampaignCombatHistory(ctx.campaignId, input?.limit);
    }),

  // ==========================================
  // MUTATIONS - LIFECYCLE
  // ==========================================

  /**
   * Create new combat
   */
  create: gmProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        name: z.string().max(100).optional(),
        description: z.string().max(1000).optional(),
        locationNodeId: z.string().uuid().optional(),
        mapUrl: z.string().url().optional(),
        gridConfig: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.createCombat({
        ...input,
        campaignId: ctx.campaignId,
      });
    }),

  /**
   * Start combat
   */
  start: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    const combat = await db.getCombat(input.id);
    if (!combat) notFound("Combat", input.id);

    if (combat.status !== "preparing") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Combat is not in preparing state",
      });
    }

    return db.startCombat(input.id);
  }),

  /**
   * End combat
   */
  end: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    const combat = await db.getCombat(input.id);
    if (!combat) notFound("Combat", input.id);

    return db.endCombat(input.id);
  }),

  /**
   * Pause combat
   */
  pause: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    return db.pauseCombat(input.id);
  }),

  /**
   * Resume combat
   */
  resume: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    return db.resumeCombat(input.id);
  }),

  // ==========================================
  // MUTATIONS - TURN MANAGEMENT
  // ==========================================

  /**
   * Next turn
   */
  nextTurn: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    const combat = await db.getCombat(input.id);
    if (!combat) notFound("Combat", input.id);

    if (combat.status !== "active") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Combat is not active",
      });
    }

    return db.nextTurn(input.id);
  }),

  /**
   * Set turn to specific participant
   */
  setTurn: gmProcedure
    .input(
      z.object({
        combatId: z.string().uuid(),
        participantId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.setTurn(input.combatId, input.participantId);
    }),

  // ==========================================
  // MUTATIONS - PARTICIPANTS
  // ==========================================

  /**
   * Add participant
   */
  addParticipant: gmProcedure
    .input(
      z.object({
        combatId: z.string().uuid(),
        entityType: z.enum(["character", "npc", "monster"]),
        entityId: z.string().uuid(),
        name: z.string().min(1).max(100),
        imageUrl: z.string().url().optional(),
        initiative: z.number().int().optional(),
        initiativeModifier: z.number().int().default(0),
        hp: z.number().int().min(0),
        maxHp: z.number().int().min(1),
        ac: z.number().int().min(0),
        positionX: z.number().int().optional(),
        positionY: z.number().int().optional(),
        isVisible: z.boolean().default(true),
        groupId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { combatId, ...participant } = input;
      return db.addParticipant(combatId, participant);
    }),

  /**
   * Remove participant
   */
  removeParticipant: gmProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.removeParticipant(input.participantId);
      return { success: true };
    }),

  /**
   * Set initiative
   */
  setInitiative: gmProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        initiative: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.setInitiative(input.participantId, input.initiative);
      return { success: true };
    }),

  /**
   * Roll initiative for all
   */
  rollInitiative: gmProcedure
    .input(
      z.object({
        combatId: z.string().uuid(),
        rolls: z.array(
          z.object({
            participantId: z.string().uuid(),
            roll: z.number().int().min(1).max(20),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.rollInitiativeForAll(input.combatId, input.rolls);
      return { success: true };
    }),

  // ==========================================
  // MUTATIONS - PARTICIPANT STATE
  // ==========================================

  /**
   * Damage participant
   */
  damage: campaignProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Players can damage with GM permission; GM always can
      if (!ctx.checker.isGM()) {
        // Check if player's character is in combat
        const participant = await db.getParticipant(input.participantId);
        if (!participant) notFound("Participant", input.participantId);

        // Only allow if target is own character or it's their turn
        if (participant.entityType !== "character") {
          forbidden("Players can only damage their own characters");
        }
      }

      const result = await db.damageParticipant(
        input.participantId,
        input.amount,
      );

      // Log the action
      const participant = await db.getParticipant(input.participantId);
      if (participant) {
        await db.logAction(participant.combatId, {
          round: 0, // TODO: get from combat
          turnIndex: 0,
          actorId: ctx.auth.userId,
          actorName: ctx.auth.displayName || "Unknown",
          actionType: "damage",
          actionData: { amount: input.amount },
          targetIds: [input.participantId],
          results: { newHp: result.hp, isAlive: result.isAlive === 1 },
        });
      }

      return result;
    }),

  /**
   * Heal participant
   */
  heal: campaignProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await db.healParticipant(
        input.participantId,
        input.amount,
      );

      const participant = await db.getParticipant(input.participantId);
      if (participant) {
        await db.logAction(participant.combatId, {
          round: 0,
          turnIndex: 0,
          actorId: ctx.auth.userId,
          actorName: ctx.auth.displayName || "Unknown",
          actionType: "heal",
          actionData: { amount: input.amount },
          targetIds: [input.participantId],
          results: { newHp: result.hp },
        });
      }

      return result;
    }),

  /**
   * Add condition
   */
  addCondition: gmProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        condition: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.addCondition(input.participantId, input.condition);
      return { success: true };
    }),

  /**
   * Remove condition
   */
  removeCondition: gmProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        condition: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.removeCondition(input.participantId, input.condition);
      return { success: true };
    }),

  /**
   * Move participant
   */
  move: campaignProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        x: z.number().int(),
        y: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const participant = await db.getParticipant(input.participantId);
      if (!participant) notFound("Participant", input.participantId);

      // Players can move their own characters
      if (!ctx.checker.isGM() && participant.entityType !== "character") {
        forbidden("Cannot move this participant");
      }

      await db.moveParticipant(input.participantId, input.x, input.y);
      return { success: true };
    }),

  /**
   * Set visibility (GM only)
   */
  setVisibility: gmProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        visible: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.setVisibility(input.participantId, input.visible);
      return { success: true };
    }),

  // ==========================================
  // MUTATIONS - LOGGING
  // ==========================================

  /**
   * Log action (for dice rolls, attacks, etc.)
   */
  logAction: campaignProcedure
    .input(
      z.object({
        combatId: z.string().uuid(),
        actionType: z.string().min(1).max(50),
        actionData: z.record(z.string(), z.any()),
        targetIds: z.array(z.string().uuid()).optional(),
        results: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const combat = await db.getCombat(input.combatId);
      if (!combat) notFound("Combat", input.combatId);

      return db.logAction(input.combatId, {
        round: combat.round,
        turnIndex: combat.turnIndex,
        actorId: ctx.auth.userId,
        actorName: ctx.auth.displayName || "Unknown",
        actionType: input.actionType,
        actionData: input.actionData,
        targetIds: input.targetIds,
        results: input.results,
      });
    }),
});
