import { z } from "zod";
import {
  AbilitySchema,
  AbilityScoresSchema,
  SkillSchema,
  ProficiencyLevelSchema,
  ConditionSchema,
  DamageTypeSchema,
  DamageResistanceSchema,
  ActionSchema,
  DiceExpressionSchema,
} from "./core";
import { SizeSchema, VisionSchema } from "../grid/types";

// ============================================
// CREATURE TYPE & CLASSIFICATION
// ============================================

export const CreatureTypeSchema = z.enum([
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "undead",
]);
export type CreatureType = z.infer<typeof CreatureTypeSchema>;

export const AlignmentSchema = z.enum([
  "lawful_good",
  "neutral_good",
  "chaotic_good",
  "lawful_neutral",
  "true_neutral",
  "chaotic_neutral",
  "lawful_evil",
  "neutral_evil",
  "chaotic_evil",
  "unaligned",
]);
export type Alignment = z.infer<typeof AlignmentSchema>;

export const ChallengeRatingSchema = z.union([
  z.literal(0),
  z.literal(0.125), // 1/8
  z.literal(0.25), // 1/4
  z.literal(0.5), // 1/2
  z.number().int().min(1).max(30),
]);
export type ChallengeRating = z.infer<typeof ChallengeRatingSchema>;

// CR to XP mapping
export const CRToXP: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

// ============================================
// MOVEMENT
// ============================================

export const MovementSpeedsSchema = z.object({
  walk: z.number().int().nonnegative().default(30),
  fly: z.number().int().nonnegative().optional(),
  swim: z.number().int().nonnegative().optional(),
  climb: z.number().int().nonnegative().optional(),
  burrow: z.number().int().nonnegative().optional(),
  hover: z.boolean().optional(), // if flying, can hover
});
export type MovementSpeeds = z.infer<typeof MovementSpeedsSchema>;

// ============================================
// SENSES
// ============================================

export const SensesSchema = z.object({
  passivePerception: z.number().int(),
  darkvision: z.number().int().optional(), // range in feet
  blindsight: z.number().int().optional(),
  tremorsense: z.number().int().optional(),
  truesight: z.number().int().optional(),
});
export type Senses = z.infer<typeof SensesSchema>;

// ============================================
// HIT POINTS
// ============================================

export const HitPointsSchema = z.object({
  current: z.number().int(),
  max: z.number().int().positive(),
  temp: z.number().int().nonnegative().default(0),

  // Hit dice
  hitDice: z
    .object({
      count: z.number().int().positive(),
      die: z.enum(["d6", "d8", "d10", "d12"]),
      used: z.number().int().nonnegative().default(0),
    })
    .optional(),
});
export type HitPoints = z.infer<typeof HitPointsSchema>;

// ============================================
// ARMOR & DEFENSE
// ============================================

export const ArmorTypeSchema = z.enum([
  "none",
  "natural",
  "light",
  "medium",
  "heavy",
  "shield",
  "other",
]);
export type ArmorType = z.infer<typeof ArmorTypeSchema>;

export const ArmorClassSchema = z.object({
  base: z.number().int().positive(),
  armorType: ArmorTypeSchema.default("none"),
  armorName: z.string().optional(),
  shieldBonus: z.number().int().nonnegative().default(0),
  dexBonus: z.number().int().optional(), // calculated or capped
  otherBonuses: z
    .array(
      z.object({
        source: z.string(),
        value: z.number().int(),
      }),
    )
    .default([]),
});
export type ArmorClass = z.infer<typeof ArmorClassSchema>;

// Calculate total AC
export function calculateAC(ac: ArmorClass, dexMod: number): number {
  let total = ac.base + ac.shieldBonus;

  // Apply DEX bonus based on armor type
  switch (ac.armorType) {
    case "none":
    case "light":
      total += dexMod;
      break;
    case "medium":
      total += Math.min(dexMod, 2); // max +2
      break;
    case "heavy":
      // no DEX bonus
      break;
    case "natural":
      total += ac.dexBonus ?? dexMod;
      break;
    default:
      total += ac.dexBonus ?? 0;
  }

  // Other bonuses
  total += ac.otherBonuses.reduce((sum, b) => sum + b.value, 0);

  return total;
}

// ============================================
// SAVING THROWS & SKILLS
// ============================================

export const SavingThrowProficienciesSchema = z.object({
  STR: z.boolean().default(false),
  DEX: z.boolean().default(false),
  CON: z.boolean().default(false),
  INT: z.boolean().default(false),
  WIS: z.boolean().default(false),
  CHA: z.boolean().default(false),
});
export type SavingThrowProficiencies = z.infer<
  typeof SavingThrowProficienciesSchema
>;

export const SkillProficienciesSchema = z
  .record(SkillSchema, ProficiencyLevelSchema)
  .default({});
export type SkillProficiencies = z.infer<typeof SkillProficienciesSchema>;

// ============================================
// DAMAGE RESISTANCES/IMMUNITIES
// ============================================

export const DamageModifiersSchema = z.object({
  vulnerabilities: z.array(DamageTypeSchema).default([]),
  resistances: z.array(DamageTypeSchema).default([]),
  immunities: z.array(DamageTypeSchema).default([]),

  // Conditional resistances (e.g., "nonmagical bludgeoning")
  conditionalResistances: z
    .array(
      z.object({
        types: z.array(DamageTypeSchema),
        condition: z.string(), // "from nonmagical weapons"
      }),
    )
    .default([]),
});
export type DamageModifiers = z.infer<typeof DamageModifiersSchema>;

export const ConditionImmunitiesSchema = z.array(ConditionSchema).default([]);
export type ConditionImmunities = z.infer<typeof ConditionImmunitiesSchema>;

// ============================================
// FEATURES & TRAITS
// ============================================

export const FeatureSchema = z.object({
  name: z.string(),
  description: z.string(),

  // Usage limits
  usesPerRest: z
    .object({
      uses: z.number().int().positive(),
      restType: z.enum(["short", "long"]),
      current: z.number().int().nonnegative(),
    })
    .optional(),

  // Recharge (for monsters)
  recharge: z
    .object({
      min: z.number().int().min(1).max(6), // recharge on X-6
      recharged: z.boolean().default(true),
    })
    .optional(),

  // Source
  source: z.string().optional(), // "Racial", "Class: Fighter 3", etc.
});
export type Feature = z.infer<typeof FeatureSchema>;

// ============================================
// SPELLCASTING
// ============================================

export const SpellSchema = z.object({
  name: z.string(),
  level: z.number().int().min(0).max(9), // 0 = cantrip
  school: z.enum([
    "abjuration",
    "conjuration",
    "divination",
    "enchantment",
    "evocation",
    "illusion",
    "necromancy",
    "transmutation",
  ]),

  // Casting
  castingTime: z.string(), // "1 action", "1 bonus action", "1 minute"
  range: z.string(), // "Self", "Touch", "60 feet"
  components: z.object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.string().optional(),
    materialConsumed: z.boolean().default(false),
    materialCost: z.number().optional(), // in GP
  }),
  duration: z.string(), // "Instantaneous", "Concentration, up to 1 minute"
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),

  // Effects
  description: z.string(),
  higherLevels: z.string().optional(),

  // Prepared status (for prepared casters)
  prepared: z.boolean().optional(),
});
export type Spell = z.infer<typeof SpellSchema>;

export const SpellSlotSchema = z.object({
  level: z.number().int().min(1).max(9),
  total: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
});
export type SpellSlot = z.infer<typeof SpellSlotSchema>;

export const SpellcastingSchema = z.object({
  // Casting ability
  ability: AbilitySchema,

  // Calculated values (can be overridden)
  spellSaveDC: z.number().int().optional(),
  spellAttackBonus: z.number().int().optional(),

  // Spell slots
  slots: z.array(SpellSlotSchema).default([]),

  // Known/prepared spells
  spells: z.array(SpellSchema).default([]),

  // Spellcasting type
  type: z
    .enum([
      "full", // Wizard, Cleric, etc.
      "half", // Paladin, Ranger
      "third", // Eldritch Knight, Arcane Trickster
      "pact", // Warlock
      "innate", // Racial/monster innate casting
    ])
    .default("full"),

  // For innate spellcasting
  innateSpells: z
    .array(
      z.object({
        spell: z.string(),
        usesPerDay: z.number().int().positive(),
        usesRemaining: z.number().int().nonnegative(),
        noComponents: z.boolean().default(false),
      }),
    )
    .optional(),
});
export type Spellcasting = z.infer<typeof SpellcastingSchema>;

// ============================================
// WEAPONS & ATTACKS
// ============================================

export const WeaponPropertySchema = z.enum([
  "ammunition",
  "finesse",
  "heavy",
  "light",
  "loading",
  "range",
  "reach",
  "special",
  "thrown",
  "two_handed",
  "versatile",
  "silvered",
  "magical",
]);
export type WeaponProperty = z.infer<typeof WeaponPropertySchema>;

export const WeaponSchema = z.object({
  name: z.string(),

  // Attack
  attackBonus: z.number().int().optional(), // override calculated
  damage: z.string(), // "1d8+3"
  damageType: DamageTypeSchema,

  // Versatile
  versatileDamage: z.string().optional(), // "1d10+3"

  // Range
  range: z.number().int().optional(), // melee reach or ranged normal
  longRange: z.number().int().optional(), // ranged long

  // Properties
  properties: z.array(WeaponPropertySchema).default([]),

  // Magic
  magicBonus: z.number().int().default(0),
  additionalEffects: z.string().optional(),
});
export type Weapon = z.infer<typeof WeaponSchema>;

export const AttackSchema = z.object({
  name: z.string(),
  attackBonus: z.number().int(),
  reach: z.number().int().optional(), // melee reach in feet
  range: z
    .object({
      normal: z.number().int(),
      long: z.number().int().optional(),
    })
    .optional(),

  // Hit effects
  damage: z.array(
    z.object({
      dice: z.string(),
      type: DamageTypeSchema,
      averageDamage: z.number().int().optional(),
    }),
  ),

  additionalEffects: z.string().optional(),
});
export type Attack = z.infer<typeof AttackSchema>;

// ============================================
// LEGENDARY & LAIR
// ============================================

export const LegendaryActionsSchema = z.object({
  count: z.number().int().positive().default(3),
  remaining: z.number().int().nonnegative(),
  actions: z.array(
    z.object({
      name: z.string(),
      cost: z.number().int().positive().default(1),
      description: z.string(),
    }),
  ),
});
export type LegendaryActions = z.infer<typeof LegendaryActionsSchema>;

export const LairActionsSchema = z.object({
  initiativeCount: z.number().int().default(20), // usually 20
  actions: z.array(
    z.object({
      description: z.string(),
    }),
  ),
  regionalEffects: z
    .array(
      z.object({
        description: z.string(),
      }),
    )
    .optional(),
});
export type LairActions = z.infer<typeof LairActionsSchema>;

// ============================================
// FULL CREATURE STAT BLOCK
// ============================================

export const CreatureSchema = z.object({
  // Identity
  id: z.string().uuid(),
  name: z.string(),

  // Classification
  size: SizeSchema,
  type: CreatureTypeSchema,
  subtype: z.string().optional(), // "goblinoid", "shapechanger", etc.
  alignment: AlignmentSchema,

  // Challenge
  cr: ChallengeRatingSchema,
  xp: z.number().int().nonnegative().optional(),
  proficiencyBonus: z.number().int().positive(),

  // Core stats
  abilityScores: AbilityScoresSchema,

  // Defense
  armorClass: ArmorClassSchema,
  hitPoints: HitPointsSchema,

  // Movement
  speed: MovementSpeedsSchema,

  // Saves & Skills
  savingThrows: SavingThrowProficienciesSchema,
  skills: SkillProficienciesSchema,

  // Senses
  senses: SensesSchema,

  // Languages
  languages: z.array(z.string()).default([]),
  telepathy: z.number().int().optional(), // range in feet

  // Damage modifiers
  damageModifiers: DamageModifiersSchema,
  conditionImmunities: ConditionImmunitiesSchema,

  // Current conditions
  conditions: z
    .array(
      z.object({
        condition: ConditionSchema,
        source: z.string().optional(),
        duration: z.number().int().optional(),
      }),
    )
    .default([]),

  // Features
  features: z.array(FeatureSchema).default([]),

  // Combat
  attacks: z.array(AttackSchema).default([]),
  actions: z.array(ActionSchema).default([]),
  bonusActions: z.array(ActionSchema).default([]),
  reactions: z.array(ActionSchema).default([]),

  // Legendary
  legendaryActions: LegendaryActionsSchema.optional(),
  lairActions: LairActionsSchema.optional(),
  mythicActions: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    )
    .optional(),

  // Spellcasting
  spellcasting: SpellcastingSchema.optional(),

  // Lore (for AI)
  description: z.string().optional(),
  personality: z.string().optional(),
  tactics: z.string().optional(),

  // Source
  source: z.string().optional(), // "Monster Manual p.123"
});
export type Creature = z.infer<typeof CreatureSchema>;

// ============================================
// PLAYER CHARACTER EXTENSION
// ============================================

export const CharacterClassSchema = z.object({
  name: z.string(),
  subclass: z.string().optional(),
  level: z.number().int().min(1).max(20),
});
export type CharacterClass = z.infer<typeof CharacterClassSchema>;

export const BackgroundSchema = z.object({
  name: z.string(),
  feature: z.string().optional(),
  personalityTraits: z.array(z.string()).default([]),
  ideals: z.array(z.string()).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
});
export type Background = z.infer<typeof BackgroundSchema>;

export const PlayerCharacterSchema = CreatureSchema.extend({
  // PC-specific
  playerName: z.string().optional(),

  // Species/race
  species: z.string(),
  subspecies: z.string().optional(),

  // Class
  classes: z.array(CharacterClassSchema),
  totalLevel: z.number().int().min(1).max(20),

  // Background
  background: BackgroundSchema,

  // Experience
  experience: z
    .object({
      current: z.number().int().nonnegative(),
      nextLevel: z.number().int().positive(),
    })
    .optional(),

  // Death saves
  deathSaves: z
    .object({
      successes: z.number().int().min(0).max(3).default(0),
      failures: z.number().int().min(0).max(3).default(0),
    })
    .optional(),

  // Inspiration
  inspiration: z.boolean().default(false),

  // Inventory
  inventory: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        quantity: z.number().int().positive().default(1),
        weight: z.number().optional(),
        equipped: z.boolean().default(false),
        attuned: z.boolean().default(false),
        description: z.string().optional(),
      }),
    )
    .default([]),

  // Currency
  currency: z
    .object({
      cp: z.number().int().nonnegative().default(0),
      sp: z.number().int().nonnegative().default(0),
      ep: z.number().int().nonnegative().default(0),
      gp: z.number().int().nonnegative().default(0),
      pp: z.number().int().nonnegative().default(0),
    })
    .default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),

  // Carried weight
  carryingCapacity: z.number().optional(),
  currentWeight: z.number().optional(),

  // Character notes
  notes: z.string().optional(),
  backstory: z.string().optional(),
});
export type PlayerCharacter = z.infer<typeof PlayerCharacterSchema>;

// ============================================
// MONSTER FACTORY HELPERS
// ============================================

export function calculateProficiencyFromCR(cr: ChallengeRating): number {
  if (cr < 5) return 2;
  if (cr < 9) return 3;
  if (cr < 13) return 4;
  if (cr < 17) return 5;
  if (cr < 21) return 6;
  if (cr < 25) return 7;
  if (cr < 29) return 8;
  return 9;
}

export function calculateXPFromCR(cr: ChallengeRating): number {
  return CRToXP[cr] ?? 0;
}

export function createDefaultCreature(name: string): Creature {
  return {
    id: crypto.randomUUID(),
    name,
    size: "medium",
    type: "humanoid",
    alignment: "true_neutral",
    cr: 0,
    proficiencyBonus: 2,
    abilityScores: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10,
    },
    armorClass: {
      base: 10,
      armorType: "none",
      shieldBonus: 0,
      otherBonuses: [],
    },
    hitPoints: {
      current: 4,
      max: 4,
      temp: 0,
      hitDice: { count: 1, die: "d8", used: 0 },
    },
    speed: { walk: 30 },
    savingThrows: {
      STR: false,
      DEX: false,
      CON: false,
      INT: false,
      WIS: false,
      CHA: false,
    },
    skills: {},
    senses: { passivePerception: 10 },
    languages: ["Common"],
    damageModifiers: {
      vulnerabilities: [],
      resistances: [],
      immunities: [],
      conditionalResistances: [],
    },
    conditionImmunities: [],
    conditions: [],
    features: [],
    attacks: [],
    actions: [],
    bonusActions: [],
    reactions: [],
  };
}
