import { z } from "zod";
import {
  router,
  campaignProcedure,
  gmProcedure,
  PaginationInput,
  IdInput,
  notFound,
  forbidden,
} from "../trpc";
import * as db from "../../db/queries/characters";
import * as tokenDb from "../../db/queries/character-tokens";
import { birthCharacter, RACE_TOPOLOGIES, CLASS_TOPOLOGIES } from "../../genesis/character";
import { getSeed } from "../../auth/topology/enrollment";

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
  // GENESIS CHARACTER CREATION
  // ==========================================

  /**
   * Birth a character using Genesis topology system
   *
   * Creates both:
   * - TOKEN (topology seed) - Source of truth
   * - ATOM (character sheet) - Projection for quick access
   */
  birthGenesis: campaignProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        race: z.string().min(1),
        class: z.string().min(1),
        background: z.string().optional(),
        abilityScores: AbilityScoresInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate race and class exist in topology system
      const raceLower = input.race.toLowerCase();
      const classLower = input.class.toLowerCase();

      if (!RACE_TOPOLOGIES[raceLower]) {
        throw new Error(`Unknown race: ${input.race}. Available: ${Object.keys(RACE_TOPOLOGIES).join(', ')}`);
      }
      if (!CLASS_TOPOLOGIES[classLower]) {
        throw new Error(`Unknown class: ${input.class}. Available: ${Object.keys(CLASS_TOPOLOGIES).join(', ')}`);
      }

      // Verify player has a topology seed
      if (!ctx.auth.seedId) {
        forbidden("Topology seed required for Genesis character creation");
      }

      const playerSeed = await getSeed(ctx.auth.seedId);
      if (!playerSeed) {
        forbidden("Topology seed not found");
      }

      // Birth the character (creates token + atom)
      const { token, atom } = await birthCharacter({
        playerSeedId: ctx.auth.seedId,
        name: input.name,
        race: raceLower,
        class: classLower,
        background: input.background,
        abilityScores: input.abilityScores,
      });

      // Store atom in characters table (projection)
      const character = await db.createCharacter({
        campaignId: ctx.campaignId,
        ownerId: ctx.auth.userId,
        ownerSeedId: ctx.auth.seedId,
        name: atom.name,
        race: atom.race,
        class: atom.class,
        level: atom.level,
        background: atom.background || undefined,
        abilityScores: {
          strength: atom.strength,
          dexterity: atom.dexterity,
          constitution: atom.constitution,
          intelligence: atom.intelligence,
          wisdom: atom.wisdom,
          charisma: atom.charisma,
        },
        hp: atom.hpCurrent,
        maxHp: atom.hpMax,
        ac: atom.ac,
        speed: atom.speed,
      });

      // Store token (source of truth) and link to character
      await tokenDb.createToken({
        token,
        characterId: character.id,
      });

      return {
        character,
        token: {
          id: token.id,
          uid: token.uid,
          seed: token.seed.toString(),  // bigint → string for JSON
          topology: token.topology,
          dominantType: token.dominantType,
          entropy: token.entropy,
        },
      };
    }),

  /**
   * Get character's token (topology data)
   */
  getToken: campaignProcedure
    .input(IdInput)
    .query(async ({ ctx, input }) => {
      const character = await db.getCharacter(input.id);
      if (!character) notFound("Character", input.id);

      if (!ctx.checker.canViewCharacter(character.ownerId)) {
        forbidden("Cannot view this character");
      }

      const token = await tokenDb.getTokenByCharacterId(input.id);
      if (!token) {
        return null;  // Legacy character without token
      }

      return {
        id: token.id,
        uid: token.uid,
        seed: token.seed,
        topology: JSON.parse(token.topology),
        dominantType: token.dominantType,
        entropy: token.entropy,
        status: token.status,
        isRepresented: token.isRepresented === 1,
      };
    }),

  /**
   * Get available races for Genesis character creation
   */
  getGenesisRaces: campaignProcedure.query(async () => {
    return Object.entries(RACE_TOPOLOGIES).map(([key, race]) => ({
      id: key,
      name: race.name,
      traits: race.traits,
      abilityBonus: race.abilityBonus,
    }));
  }),

  /**
   * Get available classes for Genesis character creation
   */
  getGenesisClasses: campaignProcedure.query(async () => {
    return Object.entries(CLASS_TOPOLOGIES).map(([key, cls]) => ({
      id: key,
      name: cls.name,
      primaryAbility: cls.primaryAbility,
      hitDie: cls.hitDie,
    }));
  }),

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
    .query(async ({ input }) => {
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
   * Create new character (simple)
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
      // Explicitly construct to satisfy TypeScript
      const createInput: db.CreateCharacterInput = {
        name: input.name,
        race: input.race,
        class: input.class,
        level: input.level,
        background: input.background,
        alignment: input.alignment,
        abilityScores: input.abilityScores as db.CreateCharacterInput['abilityScores'],
        hp: input.hp,
        maxHp: input.maxHp,
        ac: input.ac,
        speed: input.speed,
        partyId: input.partyId,
        campaignId: ctx.campaignId,
        ownerId: ctx.auth.userId,
        ownerSeedId: ctx.auth.seedId,  // Topology auth: bind character to seed
      };
      return db.createCharacter(createInput);
    }),

  /**
   * Create new character with full builder data
   * Supports 2014/2024 PHB rulesets and D&D Beyond import
   */
  createFull: campaignProcedure
    .input(
      z.object({
        // Basic required fields
        name: z.string().min(1).max(100),
        race: z.string().min(1).max(50),
        class: z.string().min(1).max(50),
        level: z.number().int().min(1).max(20).default(1),
        background: z.string().max(50).optional(),
        alignment: z.string().max(50).optional(),
        abilityScores: AbilityScoresInput,
        hp: z.number().int().min(1),
        maxHp: z.number().int().min(1),
        ac: z.number().int().min(0).max(30),
        speed: z.number().int().min(0).default(30),
        partyId: z.string().uuid().optional(),

        // Extended character builder data
        ruleset: z.enum(['2014', '2024', 'mixed']).default('2014'),
        importedFromDDB: z.boolean().default(false),
        ddbCharacterId: z.number().optional(),
        subraceId: z.string().optional(),

        // Multiclass support
        classes: z.array(z.object({
          classId: z.string(),
          level: z.number().int().min(1).max(20),
          subclassId: z.string().optional(),
        })).optional(),

        // Spells
        selectedSpellIds: z.array(z.string()).optional(),

        // Equipment
        equipmentChoices: z.record(z.string(), z.string()).optional(),
        additionalItems: z.array(z.object({
          itemId: z.string(),
          quantity: z.number().int().min(1),
        })).optional(),

        // Appearance & Personality
        appearance: z.object({
          age: z.string().optional(),
          height: z.string().optional(),
          weight: z.string().optional(),
          eyes: z.string().optional(),
          hair: z.string().optional(),
          skin: z.string().optional(),
          description: z.string().optional(),
          portraitUrl: z.string().url().optional(),
        }).optional(),

        personality: z.object({
          traits: z.array(z.string()).optional(),
          ideals: z.array(z.string()).optional(),
          bonds: z.array(z.string()).optional(),
          flaws: z.array(z.string()).optional(),
        }).optional(),

        backstory: z.string().max(10000).optional(),
        selectedLanguages: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create the base character first
      const createInput: db.CreateCharacterInput = {
        name: input.name,
        race: input.race,
        class: input.class,
        level: input.level,
        background: input.background,
        alignment: input.alignment,
        abilityScores: input.abilityScores as db.CreateCharacterInput['abilityScores'],
        hp: input.hp,
        maxHp: input.maxHp,
        ac: input.ac,
        speed: input.speed,
        partyId: input.partyId,
        campaignId: ctx.campaignId,
        ownerId: ctx.auth.userId,
        ownerSeedId: ctx.auth.seedId,  // Topology auth: bind character to seed
      };

      const character = await db.createCharacter(createInput);

      // Store extended data as JSON in character metadata
      const extendedData = {
        ruleset: input.ruleset,
        importedFromDDB: input.importedFromDDB,
        ddbCharacterId: input.ddbCharacterId,
        subraceId: input.subraceId,
        classes: input.classes,
        selectedSpellIds: input.selectedSpellIds,
        equipmentChoices: input.equipmentChoices,
        selectedLanguages: input.selectedLanguages,
      };

      // Update with extended fields
      await db.updateCharacter(character.id, {
        personality: input.personality?.traits?.join('\n'),
        ideals: input.personality?.ideals?.join('\n'),
        bonds: input.personality?.bonds?.join('\n'),
        flaws: input.personality?.flaws?.join('\n'),
        backstory: input.backstory,
        portraitUrl: input.appearance?.portraitUrl,
        // Store extended data as notes JSON for now (would use proper columns in production)
        notes: JSON.stringify(extendedData),
      });

      // Add starting equipment if provided
      if (input.additionalItems?.length) {
        for (const item of input.additionalItems) {
          await db.addInventoryItem(character.id, {
            name: item.itemId, // Would resolve to actual item name
            type: 'equipment',
            quantity: item.quantity,
            weight: 0,
            value: 0,
          });
        }
      }

      return character;
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
    .mutation(async ({ input }) => {
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
        // Build ability scores from individual columns
        const current: Record<string, number> = {
          strength: character.str,
          dexterity: character.dex,
          constitution: character.con,
          intelligence: character.int,
          wisdom: character.wis,
          charisma: character.cha,
        };
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
      const character = await db.getCharacter(input.characterId);
      if (!character) notFound("Character", input.characterId);

      const isOwner = character.ownerId === ctx.auth.userId;
      if (!isOwner && !ctx.checker.isGM()) {
        forbidden("Cannot modify this character");
      }

      // Explicitly construct to satisfy TypeScript
      return db.addInventoryItem(input.characterId, {
        name: input.name,
        type: input.type,
        quantity: input.quantity,
        weight: input.weight,
        value: input.value,
        description: input.description,
        properties: input.properties,
      });
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
