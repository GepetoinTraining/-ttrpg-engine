import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  campaignProcedure,
  gmProcedure,
  ownerProcedure,
  PaginationInput,
  IdInput,
  notFound,
  forbidden,
} from "../trpc";
import * as db from "../../db/queries/campaigns";

// ============================================
// CAMPAIGN ROUTER
// ============================================

export const campaignRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get campaign by ID
   */
  get: protectedProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const campaign = await db.getCampaign(input.id);
    if (!campaign) notFound("Campaign", input.id);

    // Check membership
    const membership = await db.getCampaignMembership(
      ctx.auth.userId,
      input.id,
    );
    if (!membership && ctx.auth.systemRole !== "admin") {
      forbidden("Not a member of this campaign");
    }

    return campaign;
  }),

  /**
   * List user's campaigns
   */
  list: protectedProcedure
    .input(PaginationInput.optional())
    .query(async ({ ctx, input }) => {
      return db.getUserCampaigns(ctx.auth.userId, input?.page, input?.pageSize);
    }),

  /**
   * Get campaign members
   */
  members: campaignProcedure.query(async ({ ctx }) => {
    return db.getCampaignMembers(ctx.campaignId);
  }),

  /**
   * Get my membership in current campaign
   */
  myMembership: campaignProcedure.query(async ({ ctx }) => {
    return ctx.membership;
  }),

  // ==========================================
  // MUTATIONS - CAMPAIGN CRUD
  // ==========================================

  /**
   * Create new campaign
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional(),
        system: z.string().default("dnd5e"),
        primaryWorldId: z.string().uuid().optional(),
        settings: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await db.createCampaign({
        ...input,
        ownerId: ctx.auth.userId,
      });

      // Note: createCampaign already adds owner as member internally
      // No need to call addCampaignMember here

      return campaign;
    }),

  /**
   * Update campaign
   */
  update: ownerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(2000).optional(),
        primaryWorldId: z.string().uuid().optional(),
        settings: z.record(z.string(), z.any()).optional(),
        status: z
          .enum(["active", "paused", "completed", "archived"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.updateCampaign(ctx.campaignId, input);
    }),

  /**
   * Delete campaign
   */
  delete: ownerProcedure.mutation(async ({ ctx }) => {
    await db.deleteCampaign(ctx.campaignId);
    return { success: true };
  }),

  // ==========================================
  // MUTATIONS - MEMBERSHIP
  // ==========================================

  /**
   * Invite player to campaign
   */
  invite: gmProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        userId: z.string().optional(),
        role: z.enum(["player", "co_gm", "spectator"]).default("player"),
        expiresIn: z.number().int().min(3600).max(604800).optional(), // 1h - 7d
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create invite code
      const invite = await db.createCampaignInvite({
        campaignId: ctx.campaignId,
        createdBy: ctx.auth.userId,
        defaultRole: input.role,
        expiresAt: input.expiresIn
          ? new Date(Date.now() + input.expiresIn * 1000)
          : undefined,
        maxUses: 1,
      });

      // If userId provided, add directly
      if (input.userId) {
        await db.addCampaignMember({
          campaignId: ctx.campaignId,
          userId: input.userId,
          role: input.role,
          invitedBy: ctx.auth.userId,
        });
      }

      return invite;
    }),

  /**
   * Accept invite
   */
  acceptInvite: protectedProcedure
    .input(
      z.object({
        code: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invite = await db.getInviteByCode(input.code);

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid invite code",
        });
      }

      if (!invite.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite is no longer active",
        });
      }

      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite has expired",
        });
      }

      if (invite.maxUses && invite.usedCount >= invite.maxUses) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite has reached max uses",
        });
      }

      // Check if already member
      const existing = await db.getCampaignMembership(
        ctx.auth.userId,
        invite.campaignId,
      );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already a member of this campaign",
        });
      }

      // Add member
      await db.addCampaignMember({
        campaignId: invite.campaignId,
        userId: ctx.auth.userId,
        role: invite.defaultRole,
        invitedBy: invite.createdBy,
      });

      // Mark invite as used (by ID, since we already have the invite)
      // FIX: Was calling useInvite(invite.id, ...) which expected a CODE
      await db.markInviteUsed(invite.id, ctx.auth.userId);

      return { campaignId: invite.campaignId };
    }),

  /**
   * Update member role
   */
  updateMemberRole: ownerProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["gm", "co_gm", "player", "spectator"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Can't change own role
      if (input.userId === ctx.auth.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role",
        });
      }

      return db.updateMemberRole(ctx.campaignId, input.userId, input.role);
    }),

  /**
   * Remove member from campaign
   */
  removeMember: gmProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Can't remove self
      if (input.userId === ctx.auth.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove yourself",
        });
      }

      // Check target role
      const targetMembership = await db.getCampaignMembership(
        input.userId,
        ctx.campaignId,
      );
      if (!targetMembership) {
        notFound("Member", input.userId);
      }

      // Can't remove owner
      if (targetMembership.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove campaign owner",
        });
      }

      // GM can't remove other GMs
      if (ctx.membership.role !== "owner" && targetMembership.role === "gm") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owner can remove GMs",
        });
      }

      await db.removeCampaignMember(ctx.campaignId, input.userId);
      return { success: true };
    }),

  /**
   * Leave campaign
   */
  leave: campaignProcedure.mutation(async ({ ctx }) => {
    // Owner can't leave
    if (ctx.membership.role === "owner") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Owner cannot leave campaign. Transfer ownership first.",
      });
    }

    await db.removeCampaignMember(ctx.campaignId, ctx.auth.userId);
    return { success: true };
  }),

  /**
   * Transfer ownership
   */
  transferOwnership: ownerProcedure
    .input(
      z.object({
        newOwnerId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify new owner is a member
      const newOwner = await db.getCampaignMembership(
        input.newOwnerId,
        ctx.campaignId,
      );
      if (!newOwner) {
        notFound("Member", input.newOwnerId);
      }

      // Transfer
      await db.updateMemberRole(ctx.campaignId, input.newOwnerId, "owner");
      await db.updateMemberRole(ctx.campaignId, ctx.auth.userId, "gm");

      return { success: true };
    }),
});
