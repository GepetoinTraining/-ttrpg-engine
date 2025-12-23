import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  campaignProcedure,
  gmProcedure,
  PaginationInput,
  IdInput,
  notFound,
  forbidden,
} from "../trpc";
import * as db from "../../db/queries/characters";

// ============================================
// CHARACTER ROUTER
// ============================================

const AbilityScoresInput = z.object({
  strength: z.number().int().min(1).max(30),
  dexterity: z.number().int().min(1).max(30),
  constitution: z.number().int().min(1).max(30),
  intelligence: z.number().int().min(1).max(30),
  wisdom: z.number().int().min(1).max(30),
  charisma: z.number().int().min(1).max(30),
});

export const characterRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get character by ID
   */
  get: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const character = await db.getCharacter(input.id);
    if (!character) notFound("Character", input.id);

    // Check access
    if (!ctx.checker.canViewCharacter(character.ownerId)) {
      forbidden("Cannot view this character");
    }

    return character;
  }),

  /**
   * List characters in campaign
   */
  list: campaignProcedure
    .input(
      z
        .object({
          partyId: z.string().uuid().optional(),
          ownerId: z.string().optional(),
          status: z.string().optional(),
          ...PaginationInput.shape,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Players only see their own unless GM
      const filters: db.CharacterFilters = {
        campaignId: ctx.campaignId,
        ...input,
      };

      if (!ctx.checker.isGM()) {
        filters.ownerId = ctx.auth.userId;
      }

      return db.listCharacters(filters, input?.page, input?.pageSize);
    }),

  /**
   * Get my characters
   */
  mine: campaignProcedure.query(async ({ ctx }) => {
    return db.getPlayerCharacters(ctx.auth.userId, ctx.campaignId);
  }),

  /**
   * Get party characters
   */
  party: campaignProcedure
    .input(z.object({ partyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db.getPartyCharacters(input.partyId);
    }),

  /**
   * Get character inventory
   */
  inventory: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const character = await db.getCharacter(input.id);
    if (!character) notFound("Character", input.id);

    if (!ctx.checker.canViewCharacter(character.ownerId)) {
      forbidden("Cannot view this character");
    }

    return db.getInventory(input.id);
  }),

  // ==========================================
  // MUTATIONS - CRUD
  // ==========================================

  /**
   * Create new character
   */
  create: campaignProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        race: z.string().min(1).max(50),
        class: z.string().min(1).max(50),
        level: z.number().int().min(1).max(20).default(1),
        background: z.string().max(50).optional(),
        alignment: z.string().max(20).optional(),
        abilityScores: AbilityScoresInput,
        hp: z.number().int().min(1),
        maxHp: z.number().int().min(1),
        ac: z.number().int().min(0).max(30),
        speed: z.number().int().min(0).default(30),
        partyId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.createCharacter({
        ...input,
        campaignId: ctx.campaignId,
        ownerId: ctx.auth.userId,
      });
    }),

  /**
   * Update character
   */
  update: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        partyId: z.string().uuid().nullable().optional(),
        personality: z.string().max(1000).optional(),
        ideals: z.string().max(500).optional(),
        bonds: z.string().max(500).optional(),
        flaws: z.string().max(500).optional(),
        backstory: z.string().max(5000).optional(),
        notes: z.string().max(5000).optional(),
        portraitUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const character = await db.getCharacter(id);
      if (!character) notFound("Character", id);

      if (!ctx.checker.canEditCharacter(character.ownerId)) {
        forbidden("Cannot edit this character");
      }

      return db.updateCharacter(id, updates);
    }),

  /**
   * Delete character (GM only or own character)
   */
  delete: campaignProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    const character = await db.getCharacter(input.id);
    if (!character) notFound("Character", input.id);

    // Only owner or GM can delete
    const isOwner = character.ownerId === ctx.auth.userId;
    if (!isOwner && !ctx.checker.isGM()) {
      forbidden("Cannot delete this character");
    }

    await db.deleteCharacter(input.id);
    return { success: true };
  }),

  // ==========================================
  // MUTATIONS - HP & COMBAT
  // ==========================================

  /**
   * Damage character
   */
  damage: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.id);
      if (!character) notFound("Character", input.id);

      // GM or owner can damage
      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      return db.damageCharacter(input.id, input.amount);
    }),

  /**
   * Heal character
   */
  heal: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.id);
      if (!character) notFound("Character", input.id);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      return db.healCharacter(input.id, input.amount);
    }),

  /**
   * Add temporary HP
   */
  addTempHp: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.id);
      if (!character) notFound("Character", input.id);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      return db.addTempHp(input.id, input.amount);
    }),

  /**
   * Set HP directly (GM only)
   */
  setHp: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        hp: z.number().int().min(0),
        maxHp: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return db.updateCharacter(input.id, {
        hp: input.hp,
        maxHp: input.maxHp,
      });
    }),

  // ==========================================
  // MUTATIONS - LEVEL UP
  // ==========================================

  /**
   * Level up character
   */
  levelUp: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        hpIncrease: z.number().int().min(1),
        abilityScoreImprovement: z
          .object({
            ability: z.enum([
              "strength",
              "dexterity",
              "constitution",
              "intelligence",
              "wisdom",
              "charisma",
            ]),
            increase: z.number().int().min(1).max(2),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.id);
      if (!character) notFound("Character", input.id);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      // Apply ASI if provided
      let abilityUpdates: Record<string, number> | undefined;
      if (input.abilityScoreImprovement) {
        const current = JSON.parse(character.abilityScores);
        const ability = input.abilityScoreImprovement.ability;
        current[ability] = Math.min(
          20,
          current[ability] + input.abilityScoreImprovement.increase,
        );
        abilityUpdates = current;
      }

      return db.levelUp(
        input.id,
        input.hpIncrease,
        abilityUpdates ? { abilityScores: abilityUpdates } : undefined,
      );
    }),

  // ==========================================
  // MUTATIONS - CURRENCY
  // ==========================================

  /**
   * Add currency
   */
  addCurrency: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        copper: z.number().int().optional(),
        silver: z.number().int().optional(),
        electrum: z.number().int().optional(),
        gold: z.number().int().optional(),
        platinum: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...currency } = input;

      const character = await db.getCharacter(id);
      if (!character) notFound("Character", id);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      return db.addCurrency(id, currency);
    }),

  // ==========================================
  // MUTATIONS - INVENTORY
  // ==========================================

  /**
   * Add item to inventory
   */
  addItem: campaignProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        name: z.string().min(1).max(100),
        type: z.string().min(1).max(50),
        quantity: z.number().int().min(1).default(1),
        weight: z.number().min(0).default(0),
        value: z.number().int().min(0).default(0),
        description: z.string().max(1000).optional(),
        properties: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { characterId, ...item } = input;

      const character = await db.getCharacter(characterId);
      if (!character) notFound("Character", characterId);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      return db.addInventoryItem(characterId, item);
    }),

  /**
   * Remove item from inventory
   */
  removeItem: campaignProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        itemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.characterId);
      if (!character) notFound("Character", input.characterId);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      await db.removeInventoryItem(input.itemId);
      return { success: true };
    }),

  /**
   * Update item quantity
   */
  updateItemQuantity: campaignProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        itemId: z.string().uuid(),
        quantity: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.characterId);
      if (!character) notFound("Character", input.characterId);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      await db.updateItemQuantity(input.itemId, input.quantity);
      return { success: true };
    }),

  /**
   * Equip/unequip item
   */
  equipItem: campaignProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        itemId: z.string().uuid(),
        equipped: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.characterId);
      if (!character) notFound("Character", input.characterId);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      await db.equipItem(input.itemId, input.equipped);
      return { success: true };
    }),

  /**
   * Attune/unattune item
   */
  attuneItem: campaignProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        itemId: z.string().uuid(),
        attuned: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.characterId);
      if (!character) notFound("Character", input.characterId);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      await db.attuneItem(input.itemId, input.attuned);
      return { success: true };
    }),
});
