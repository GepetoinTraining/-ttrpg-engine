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
import * as db from "../../db/queries/campaigns";
import * as characters from "../../db/queries/characters";

// ============================================
// PARTY ROUTER
// ============================================

export const partyRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get party by ID
   */
  get: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const party = await db.getParty(input.id);
    if (!party) notFound("Party", input.id);
    return party;
  }),

  /**
   * List parties in campaign
   */
  list: campaignProcedure.query(async ({ ctx }) => {
    return db.getCampaignParties(ctx.campaignId);
  }),

  /**
   * Get party members
   */
  members: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    return characters.getPartyCharacters(input.id);
  }),

  /**
   * Get my party
   */
  mine: campaignProcedure.query(async ({ ctx }) => {
    const myChars = await characters.getPlayerCharacters(
      ctx.auth.userId,
      ctx.campaignId,
    );
    if (myChars.length === 0 || !myChars[0].partyId) return null;
    return db.getParty(myChars[0].partyId);
  }),

  // ==========================================
  // MUTATIONS
  // ==========================================

  /**
   * Create party
   */
  create: gmProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Explicitly construct to satisfy TypeScript
      return db.createParty({
        name: input.name,
        description: input.description,
        campaignId: ctx.campaignId,
      });
    }),

  /**
   * Update party
   */
  update: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        status: z.enum(["active", "inactive", "disbanded"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      return db.updateParty(id, updates);
    }),

  /**
   * Delete party
   */
  delete: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    // Remove all characters from party first
    const members = await characters.getPartyCharacters(input.id);
    for (const member of members) {
      await characters.updateCharacter(member.id, { partyId: null });
    }

    await db.deleteParty(input.id);
    return { success: true };
  }),

  /**
   * Add character to party
   */
  addMember: gmProcedure
    .input(
      z.object({
        partyId: z.string().uuid(),
        characterId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const party = await db.getParty(input.partyId);
      if (!party) notFound("Party", input.partyId);

      const character = await characters.getCharacter(input.characterId);
      if (!character) notFound("Character", input.characterId);

      if (character.campaignId !== ctx.campaignId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Character is not in this campaign",
        });
      }

      return characters.updateCharacter(input.characterId, {
        partyId: input.partyId,
      });
    }),

  /**
   * Remove character from party
   */
  removeMember: gmProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return characters.updateCharacter(input.characterId, { partyId: null });
    }),

  // TODO: Treasury methods removed - DB layer doesn't support treasury field yet
  // Add treasury to Party type and UpdatePartyInput in campaigns.ts before re-enabling
});
