/**
 * MAGIC TYPES - Core Interfaces
 *
 * Magic is chemistry with a different substrate.
 * Spells are compositions. Components are reagents.
 * Spell slots are thermodynamic budgets. Reality pushes back.
 */

import { z } from 'zod';

// ============================================
// SPELL SCHOOLS (D&D 5e)
// ============================================

export const SpellSchoolSchema = z.enum([
  'abjuration',    // Protection, wards
  'conjuration',   // Summoning, teleportation
  'divination',    // Knowledge, foresight
  'enchantment',   // Mind control, charm
  'evocation',     // Energy, damage
  'illusion',      // Deception, phantasms
  'necromancy',    // Death, undeath
  'transmutation', // Transformation, alteration
]);

export type SpellSchool = z.infer<typeof SpellSchoolSchema>;

// ============================================
// SPELL SCALES (from extraction shooter)
// ============================================

export const SpellScaleSchema = z.enum([
  'CANTRIP',    // Free, unlimited, minor effects
  'LOCAL',      // Combat, single target, immediate
  'TACTICAL',   // Field control, structures, area denial
  'STRATEGIC',  // Map-level, reality-bending, world-altering
]);

export type SpellScale = z.infer<typeof SpellScaleSchema>;

// ============================================
// DAMAGE TYPES
// ============================================

export const DamageTypeSchema = z.enum([
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
]);

export type DamageType = z.infer<typeof DamageTypeSchema>;

// ============================================
// BIOME TYPES (for location-dependent casting)
// ============================================

export const BiomeTypeSchema = z.enum([
  'any',
  'urban',
  'forest',
  'mountain',
  'desert',
  'swamp',
  'coastal',
  'underground',
  'arctic',
  'volcanic',
  'planar',
  'industrial',   // For tech-based spells
  'holy_ground',
  'corrupted',
]);

export type BiomeType = z.infer<typeof BiomeTypeSchema>;

// ============================================
// MATERIAL REQUIREMENTS
// ============================================

export const MaterialRequirementSchema = z.object({
  element: z.string(),          // "Sulfur", "BatGuano", "FireEssence"
  quantity: z.number().int().min(1).default(1),
  consumed: z.boolean().default(true),
  goldValue: z.number().optional(),  // If component has GP cost
  substitutes: z.array(z.string()).optional(),  // What else could work
});

export type MaterialRequirement = z.infer<typeof MaterialRequirementSchema>;

// ============================================
// LORE REQUIREMENTS (Knowledge Gates)
// ============================================

export const LoreRequirementSchema = z.object({
  topic: z.string(),            // "pyromancy", "conjuration_theory", "forbidden_necromancy"
  level: z.number().int().min(1).max(5),  // 1-5 mastery required
});

export type LoreRequirement = z.infer<typeof LoreRequirementSchema>;

// ============================================
// SPELL COST (5 Axes)
// ============================================

export const SpellCostSchema = z.object({
  // Energy cost (spell slot equivalent, ΔG budget)
  energy: z.number().int().min(0).max(9),

  // Material components
  materials: z.array(MaterialRequirementSchema).optional(),

  // Knowledge gates (lore requirements)
  lore: z.array(LoreRequirementSchema).optional(),

  // Paradox risk (0-100, chance of reality pushing back)
  entropy: z.number().min(0).max(100).optional(),

  // Location requirement
  biome: BiomeTypeSchema.optional(),

  // Health cost (sorcerer blood magic)
  health: z.number().int().min(0).optional(),

  // Cast time in combat rounds (0 = action, -1 = bonus action, -2 = reaction)
  castTimeRounds: z.number().default(0),
});

export type SpellCost = z.infer<typeof SpellCostSchema>;

// ============================================
// SPELL EFFECTS
// ============================================

export const SpellEffectSchema = z.object({
  type: z.enum([
    'damage',
    'healing',
    'condition',
    'summon',
    'transform',
    'teleport',
    'create',
    'destroy',
    'control',
    'buff',
    'debuff',
    'divination',
    'illusion',
    'utility',
  ]),

  // Damage/healing
  dice: z.string().optional(),      // "8d6", "2d10+5"
  damageType: DamageTypeSchema.optional(),

  // Targeting
  range: z.number().optional(),      // In feet
  area: z.object({
    shape: z.enum(['sphere', 'cube', 'cone', 'line', 'cylinder']),
    size: z.number(),
  }).optional(),
  targets: z.enum(['self', 'single', 'multiple', 'area']).optional(),

  // Saves
  saveDC: z.string().optional(),     // "spell", "10", "15+prof"
  saveAbility: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']).optional(),
  saveEffect: z.enum(['none', 'half', 'negates']).optional(),

  // Conditions
  condition: z.string().optional(),  // "paralyzed", "charmed", "invisible"

  // Duration
  duration: z.string().optional(),   // "instantaneous", "1 minute", "concentration, 1 hour"
  concentration: z.boolean().optional(),

  // Additional modifiers
  upcast: z.object({
    perLevel: z.string(),            // "+1d6 per level"
  }).optional(),
});

export type SpellEffect = z.infer<typeof SpellEffectSchema>;

// ============================================
// SPELL FORMULA (The Complete Spell Definition)
// ============================================

export const SpellFormulaSchema = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  description: z.string(),

  // Classification
  level: z.number().int().min(0).max(9),  // 0 = cantrip
  school: SpellSchoolSchema,
  scale: SpellScaleSchema,

  // Composition (prime-based identity)
  elements: z.record(z.string(), z.number().int().min(1)),  // { Fire: 3, Area: 2 }
  seed: z.bigint().optional(),  // Computed from elements

  // Requirements
  cost: SpellCostSchema,

  // Casting properties
  ritual: z.boolean().default(false),
  verbal: z.boolean().default(true),
  somatic: z.boolean().default(true),

  // Effects (precipitated from composition)
  effects: z.array(SpellEffectSchema),

  // Higher level casting
  atHigherLevels: z.string().optional(),

  // Metadata
  source: z.enum(['class', 'race', 'feat', 'item', 'scroll', 'homebrew']).default('class'),
  sourcebook: z.string().optional(),
  isHomebrew: z.boolean().default(false),

  // Class restrictions
  classes: z.array(z.string()).optional(),  // ["wizard", "sorcerer"]
});

export type SpellFormula = z.infer<typeof SpellFormulaSchema>;

// ============================================
// CASTER STATE (Runtime casting context)
// ============================================

export const CasterStateSchema = z.object({
  // Identity
  characterId: z.string().uuid(),
  casterType: z.enum(['wizard', 'sorcerer', 'cleric', 'warlock', 'druid', 'bard', 'paladin', 'ranger', 'artificer']),
  casterLevel: z.number().int().min(1).max(20),

  // Spell slots available
  slots: z.array(z.object({
    level: z.number().int().min(1).max(9),
    max: z.number().int(),
    used: z.number().int().default(0),
  })),

  // Pact magic (warlock)
  pactSlots: z.object({
    level: z.number().int().min(1).max(5),
    max: z.number().int(),
    used: z.number().int().default(0),
  }).optional(),

  // Spellcasting ability
  spellcastingAbility: z.enum(['int', 'wis', 'cha']),
  spellcastingMod: z.number().int(),
  spellSaveDC: z.number().int(),
  spellAttackBonus: z.number().int(),

  // Current health (for sorcerer blood magic)
  currentHP: z.number().int(),
  maxHP: z.number().int(),

  // Lore knowledge
  lore: z.record(z.string(), z.object({
    xp: z.number().int(),
    level: z.number().int(),
    sources: z.array(z.string()),
  })),

  // Daily entropy accumulated
  dailyEntropy: z.number().default(0),

  // Concentration
  concentrating: z.string().optional(),  // Spell ID if concentrating

  // Current biome/location
  currentBiome: BiomeTypeSchema.optional(),

  // Focus/arcane foci equipped
  hasFocus: z.boolean().default(false),
  focusType: z.string().optional(),
});

export type CasterState = z.infer<typeof CasterStateSchema>;

// ============================================
// CAST RESULT
// ============================================

export const CastResultSchema = z.object({
  success: z.boolean(),

  // If failed
  reason: z.string().optional(),

  // If successful
  effects: z.array(SpellEffectSchema).optional(),

  // Costs paid
  slotUsed: z.number().int().optional(),
  materialsConsumed: z.array(z.string()).optional(),
  healthPaid: z.number().int().optional(),

  // Paradox
  paradoxTriggered: z.boolean().optional(),
  paradoxSeverity: z.enum(['fizzle', 'minor', 'major', 'catastrophic']).optional(),
  paradoxEffect: z.string().optional(),

  // Entropy accumulated
  entropyGained: z.number().optional(),
});

export type CastResult = z.infer<typeof CastResultSchema>;

// ============================================
// LORE ENTRY (Player's knowledge)
// ============================================

export const LoreEntrySchema = z.object({
  topic: z.string(),
  xp: z.number().int().default(0),
  level: z.number().int().default(0),  // floor(sqrt(xp / 100))
  sources: z.array(z.string()).default([]),  // Where they learned it
  discoveredAt: z.date().optional(),
});

export type LoreEntry = z.infer<typeof LoreEntrySchema>;

// ============================================
// SCROLL ITEM
// ============================================

export const ScrollItemSchema = z.object({
  id: z.string().uuid(),
  spellId: z.string(),
  spellName: z.string(),
  spellLevel: z.number().int().min(0).max(9),

  // Scriber info
  scribedBy: z.string().uuid().optional(),
  scriberLevel: z.number().int().optional(),

  // Quality affects reliability
  quality: z.enum(['poor', 'standard', 'fine', 'masterwork']).default('standard'),

  // Charges (usually 1)
  charges: z.number().int().default(1),
  maxCharges: z.number().int().default(1),

  // Market value
  baseValue: z.number(),  // Spell level × scriber level × 25gp

  // Metadata
  createdAt: z.date(),
  expiresAt: z.date().optional(),  // Some scrolls decay
});

export type ScrollItem = z.infer<typeof ScrollItemSchema>;

// ============================================
// PARADOX RESULT
// ============================================

export const ParadoxResultSchema = z.object({
  triggered: z.boolean(),
  severity: z.enum(['fizzle', 'minor', 'major', 'catastrophic']).optional(),
  effect: z.string().optional(),
  entropyGained: z.number().optional(),
});

export type ParadoxResult = z.infer<typeof ParadoxResultSchema>;

// ============================================
// RESOLVED COST (After calculating all factors)
// ============================================

export const ResolvedCostSchema = z.object({
  energyCost: z.number().int(),
  materialsCost: z.array(z.object({
    element: z.string(),
    quantity: z.number().int(),
    itemId: z.string().optional(),
  })),
  healthCost: z.number().int().default(0),
  entropyRisk: z.number().default(0),

  loreSatisfied: z.boolean(),
  biomeSatisfied: z.boolean(),
  materialsSatisfied: z.boolean(),
  slotsSatisfied: z.boolean(),

  failures: z.array(z.object({
    type: z.enum(['lore', 'materials', 'biome', 'slots', 'health', 'focus']),
    message: z.string(),
  })),

  canCast: z.boolean(),
});

export type ResolvedCost = z.infer<typeof ResolvedCostSchema>;
