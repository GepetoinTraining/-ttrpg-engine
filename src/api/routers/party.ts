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
      return db.createParty({
        ...input,
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

  /**
   * Set party treasury
   */
  setTreasury: gmProcedure
    .input(
      z.object({
        partyId: z.string().uuid(),
        copper: z.number().int().min(0).optional(),
        silver: z.number().int().min(0).optional(),
        electrum: z.number().int().min(0).optional(),
        gold: z.number().int().min(0).optional(),
        platinum: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { partyId, ...treasury } = input;
      return db.updateParty(partyId, { treasury });
    }),

  /**
   * Add to party treasury
   */
  addTreasury: campaignProcedure
    .input(
      z.object({
        partyId: z.string().uuid(),
        copper: z.number().int().optional(),
        silver: z.number().int().optional(),
        electrum: z.number().int().optional(),
        gold: z.number().int().optional(),
        platinum: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const party = await db.getParty(input.partyId);
      if (!party) notFound("Party", input.partyId);

      const current = party.treasury || {
        copper: 0,
        silver: 0,
        electrum: 0,
        gold: 0,
        platinum: 0,
      };
      const treasury = {
        copper: (current.copper || 0) + (input.copper || 0),
        silver: (current.silver || 0) + (input.silver || 0),
        electrum: (current.electrum || 0) + (input.electrum || 0),
        gold: (current.gold || 0) + (input.gold || 0),
        platinum: (current.platinum || 0) + (input.platinum || 0),
      };

      return db.updateParty(input.partyId, { treasury });
    }),
});
