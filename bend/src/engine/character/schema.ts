/**
 * CHARACTER SCHEMA
 * =================
 *
 * Comprehensive character schema supporting:
 * - D&D Beyond JSON import
 * - Manual character creation
 * - 2014 PHB compatibility
 * - 2024 PHB compatibility
 * - Future homebrew extensibility
 *
 * DESIGN PRINCIPLES:
 * 1. Store RAW data, calculate derived values in application layer
 * 2. Support both "legacy" 2014 and "new" 2024 rule variants
 * 3. Keep SRD-only content in base, licensed content as references
 * 4. Flexible enough for homebrew without schema changes
 */

import { z } from 'zod'

// ============================================
// ENUMS & CONSTANTS
// ============================================

export const AbilitySchema = z.enum([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
])
export type Ability = z.infer<typeof AbilitySchema>

export const SkillSchema = z.enum([
  'acrobatics',      // DEX
  'animal_handling', // WIS
  'arcana',          // INT
  'athletics',       // STR
  'deception',       // CHA
  'history',         // INT
  'insight',         // WIS
  'intimidation',    // CHA
  'investigation',   // INT
  'medicine',        // WIS
  'nature',          // INT
  'perception',      // WIS
  'performance',     // CHA
  'persuasion',      // CHA
  'religion',        // INT
  'sleight_of_hand', // DEX
  'stealth',         // DEX
  'survival'         // WIS
])
export type Skill = z.infer<typeof SkillSchema>

export const SKILL_ABILITIES: Record<Skill, Ability> = {
  acrobatics: 'dexterity',
  animal_handling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleight_of_hand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom'
}

export const AlignmentSchema = z.enum([
  'lawful_good',
  'neutral_good',
  'chaotic_good',
  'lawful_neutral',
  'true_neutral',
  'chaotic_neutral',
  'lawful_evil',
  'neutral_evil',
  'chaotic_evil',
  'unaligned'
])
export type Alignment = z.infer<typeof AlignmentSchema>

export const SizeSchema = z.enum([
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan'
])
export type Size = z.infer<typeof SizeSchema>

export const CreatureTypeSchema = z.enum([
  'humanoid',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'monstrosity',
  'ooze',
  'plant',
  'undead'
])
export type CreatureType = z.infer<typeof CreatureTypeSchema>

export const ProficiencyLevelSchema = z.enum([
  'none',
  'half',        // Jack of All Trades, etc.
  'proficient',
  'expertise'    // Double proficiency
])
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>

export const SpellSchoolSchema = z.enum([
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation'
])
export type SpellSchool = z.infer<typeof SpellSchoolSchema>

export const RulesetSchema = z.enum([
  '2014',  // 2014 PHB rules
  '2024',  // 2024 PHB rules
  'mixed'  // Campaign allows both
])
export type Ruleset = z.infer<typeof RulesetSchema>

// ============================================
// ABILITY SCORES
// ============================================

export const AbilityScoresSchema = z.object({
  strength: z.number().int().min(1).max(30),
  dexterity: z.number().int().min(1).max(30),
  constitution: z.number().int().min(1).max(30),
  intelligence: z.number().int().min(1).max(30),
  wisdom: z.number().int().min(1).max(30),
  charisma: z.number().int().min(1).max(30)
})
export type AbilityScores = z.infer<typeof AbilityScoresSchema>

// Ability score bonuses from various sources
export const AbilityBonusSchema = z.object({
  source: z.string(),  // "race", "feat", "magic_item", etc.
  sourceName: z.string(),  // "Half-Elf", "Resilient", "Belt of Giant Strength"
  ability: AbilitySchema,
  value: z.number().int()
})
export type AbilityBonus = z.infer<typeof AbilityBonusSchema>

// ============================================
// RACE / SPECIES
// ============================================

export const RaceTraitSchema = z.object({
  name: z.string(),
  description: z.string(),
  source: z.string().optional(),  // "PHB 2014", "PHB 2024", "Homebrew"
  // Mechanical effects (optional - for automation)
  mechanics: z.object({
    abilityBonuses: z.array(AbilityBonusSchema).optional(),
    skillProficiencies: z.array(SkillSchema).optional(),
    resistances: z.array(z.string()).optional(),
    senses: z.array(z.string()).optional(),
    speed: z.number().int().optional(),
    spells: z.array(z.string()).optional(),
    other: z.array(z.string()).optional()
  }).optional()
})
export type RaceTrait = z.infer<typeof RaceTraitSchema>

export const RaceSchema = z.object({
  name: z.string(),
  subrace: z.string().optional(),

  // 2024 calls these "Species" - we support both terminologies
  displayName: z.string().optional(),  // What to show in UI

  size: SizeSchema,
  speed: z.number().int().default(30),
  creatureType: CreatureTypeSchema.default('humanoid'),

  // Ability score increases (2014 style - fixed)
  // In 2024, these are often flexible - stored as bonuses instead
  abilityScoreIncreases: z.record(AbilitySchema, z.number().int()).optional(),

  // Racial traits
  traits: z.array(RaceTraitSchema).default([]),

  // Languages
  languages: z.array(z.string()).default([]),

  // Proficiencies granted
  weaponProficiencies: z.array(z.string()).default([]),
  armorProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]),

  // Source reference
  source: z.string().optional(),
  isHomebrew: z.boolean().default(false),

  // D&D Beyond reference (for imports)
  ddbId: z.number().int().optional()
})
export type Race = z.infer<typeof RaceSchema>

// ============================================
// CLASS
// ============================================

export const HitDieSchema = z.object({
  die: z.enum(['d6', 'd8', 'd10', 'd12']),
  used: z.number().int().default(0),
  max: z.number().int()  // Usually equals level in that class
})
export type HitDie = z.infer<typeof HitDieSchema>

export const ClassFeatureSchema = z.object({
  name: z.string(),
  level: z.number().int().min(1).max(20),
  description: z.string(),
  source: z.string().optional(),

  // For subclass features
  subclassFeature: z.boolean().default(false),

  // For features with choices (Fighting Style, etc.)
  choices: z.array(z.object({
    name: z.string(),
    description: z.string()
  })).optional(),
  selectedChoice: z.string().optional(),

  // For features with limited uses
  uses: z.object({
    max: z.number().int(),
    current: z.number().int(),
    recharge: z.enum(['short_rest', 'long_rest', 'dawn', 'never'])
  }).optional()
})
export type ClassFeature = z.infer<typeof ClassFeatureSchema>

export const SpellcastingSchema = z.object({
  ability: AbilitySchema,

  // Spell slots per level (index 0 = 1st level, etc.)
  slots: z.array(z.object({
    max: z.number().int(),
    used: z.number().int().default(0)
  })).default([]),

  // Cantrips known
  cantripsKnown: z.number().int().default(0),

  // Spells known (for known casters like Sorcerer, Bard)
  spellsKnown: z.number().int().optional(),

  // Spells prepared (for prepared casters like Wizard, Cleric)
  spellsPrepared: z.number().int().optional(),

  // Pact Magic (Warlock)
  pactMagic: z.object({
    slotLevel: z.number().int().min(1).max(5),
    slotsMax: z.number().int(),
    slotsUsed: z.number().int().default(0)
  }).optional(),

  // Ritual casting
  ritualCasting: z.boolean().default(false),

  // Spellcasting focus
  focus: z.string().optional()
})
export type Spellcasting = z.infer<typeof SpellcastingSchema>

export const ClassSchema = z.object({
  name: z.string(),
  level: z.number().int().min(1).max(20),

  // Subclass (if chosen)
  subclass: z.string().optional(),
  subclassLevel: z.number().int().optional(),  // Level subclass was chosen

  // Hit die for this class
  hitDie: HitDieSchema,

  // Is this the character's first class? (affects proficiencies)
  isStartingClass: z.boolean().default(false),

  // Proficiencies granted (only from starting class or multiclass dip)
  savingThrows: z.array(AbilitySchema).default([]),
  skillProficiencies: z.array(SkillSchema).default([]),
  weaponProficiencies: z.array(z.string()).default([]),
  armorProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]),

  // Class features (populated based on level)
  features: z.array(ClassFeatureSchema).default([]),

  // Spellcasting (if applicable)
  spellcasting: SpellcastingSchema.optional(),

  // Source reference
  source: z.string().optional(),
  isHomebrew: z.boolean().default(false),

  // D&D Beyond reference
  ddbId: z.number().int().optional()
})
export type Class = z.infer<typeof ClassSchema>

// ============================================
// BACKGROUND
// ============================================

export const BackgroundSchema = z.object({
  name: z.string(),
  description: z.string().optional(),

  // Skill proficiencies
  skillProficiencies: z.array(SkillSchema).default([]),

  // Tool proficiencies
  toolProficiencies: z.array(z.string()).default([]),

  // Languages
  languages: z.array(z.string()).default([]),

  // Starting equipment (descriptive)
  equipment: z.array(z.string()).default([]),

  // Feature
  feature: z.object({
    name: z.string(),
    description: z.string()
  }).optional(),

  // Suggested characteristics (for character building)
  personalityTraits: z.array(z.string()).default([]),
  ideals: z.array(z.string()).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),

  // 2024 PHB adds origin feats
  originFeat: z.string().optional(),

  source: z.string().optional(),
  isHomebrew: z.boolean().default(false),
  ddbId: z.number().int().optional()
})
export type Background = z.infer<typeof BackgroundSchema>

// ============================================
// FEATS
// ============================================

export const FeatSchema = z.object({
  name: z.string(),
  description: z.string(),

  // Prerequisites
  prerequisites: z.object({
    level: z.number().int().optional(),
    ability: z.record(AbilitySchema, z.number().int()).optional(),
    proficiency: z.string().optional(),
    spellcasting: z.boolean().optional(),
    other: z.string().optional()
  }).optional(),

  // What the feat grants
  grants: z.object({
    abilityScoreIncrease: z.record(AbilitySchema, z.number().int()).optional(),
    skillProficiencies: z.array(SkillSchema).optional(),
    savingThrowProficiencies: z.array(AbilitySchema).optional(),
    weaponProficiencies: z.array(z.string()).optional(),
    armorProficiencies: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    spells: z.array(z.string()).optional(),
    other: z.array(z.string()).optional()
  }).optional(),

  // For feats with limited uses
  uses: z.object({
    max: z.number().int(),
    current: z.number().int(),
    recharge: z.enum(['short_rest', 'long_rest', 'dawn', 'never'])
  }).optional(),

  // 2024 PHB categorizes feats
  category: z.enum(['origin', 'general', 'fighting_style', 'epic_boon']).optional(),

  source: z.string().optional(),
  isHomebrew: z.boolean().default(false),
  ddbId: z.number().int().optional()
})
export type Feat = z.infer<typeof FeatSchema>

// ============================================
// SPELLS
// ============================================

export const SpellComponentsSchema = z.object({
  verbal: z.boolean().default(false),
  somatic: z.boolean().default(false),
  material: z.boolean().default(false),
  materialDescription: z.string().optional(),
  materialCost: z.number().optional(),  // In gold pieces
  materialConsumed: z.boolean().default(false)
})
export type SpellComponents = z.infer<typeof SpellComponentsSchema>

export const SpellSchema = z.object({
  name: z.string(),
  level: z.number().int().min(0).max(9),  // 0 = cantrip
  school: SpellSchoolSchema,

  castingTime: z.string(),  // "1 action", "1 bonus action", "1 minute", etc.
  range: z.string(),  // "Self", "Touch", "60 feet", etc.
  components: SpellComponentsSchema,
  duration: z.string(),  // "Instantaneous", "1 minute", "Concentration, up to 1 hour"
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),

  description: z.string(),
  higherLevels: z.string().optional(),  // "At Higher Levels" text

  // For prepared/known tracking
  prepared: z.boolean().default(false),
  alwaysPrepared: z.boolean().default(false),  // Domain spells, etc.

  // Source of the spell (class, race, feat, item)
  source: z.string().optional(),
  sourceType: z.enum(['class', 'race', 'feat', 'item', 'other']).optional(),

  // Reference
  sourcebook: z.string().optional(),
  isHomebrew: z.boolean().default(false),
  ddbId: z.number().int().optional()
})
export type Spell = z.infer<typeof SpellSchema>

// ============================================
// EQUIPMENT & INVENTORY
// ============================================

export const CurrencySchema = z.object({
  copper: z.number().int().default(0),
  silver: z.number().int().default(0),
  electrum: z.number().int().default(0),
  gold: z.number().int().default(0),
  platinum: z.number().int().default(0)
})
export type Currency = z.infer<typeof CurrencySchema>

export const ItemTypeSchema = z.enum([
  'weapon',
  'armor',
  'shield',
  'adventuring_gear',
  'tool',
  'mount',
  'vehicle',
  'trade_good',
  'treasure',
  'wondrous_item',
  'potion',
  'scroll',
  'wand',
  'rod',
  'staff',
  'ring',
  'ammunition',
  'other'
])
export type ItemType = z.infer<typeof ItemTypeSchema>

export const ItemRaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact'
])
export type ItemRarity = z.infer<typeof ItemRaritySchema>

export const WeaponPropertiesSchema = z.object({
  damage: z.string().optional(),  // "1d8 slashing"
  damageType: z.string().optional(),
  properties: z.array(z.string()).default([]),  // "finesse", "versatile", etc.
  versatileDamage: z.string().optional(),  // "1d10"
  range: z.object({
    normal: z.number().int(),
    long: z.number().int()
  }).optional(),
  thrown: z.boolean().default(false)
})
export type WeaponProperties = z.infer<typeof WeaponPropertiesSchema>

export const ArmorPropertiesSchema = z.object({
  baseAC: z.number().int(),
  addDex: z.boolean().default(false),
  maxDex: z.number().int().optional(),  // For medium armor
  stealthDisadvantage: z.boolean().default(false),
  strengthRequirement: z.number().int().optional()
})
export type ArmorProperties = z.infer<typeof ArmorPropertiesSchema>

export const InventoryItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: ItemTypeSchema,

  quantity: z.number().int().default(1),
  weight: z.number().optional(),  // In pounds
  value: z.number().optional(),  // In gold pieces

  description: z.string().optional(),

  // Equipment state
  equipped: z.boolean().default(false),
  attuned: z.boolean().default(false),
  requiresAttunement: z.boolean().default(false),

  // Magic item properties
  rarity: ItemRaritySchema.optional(),
  magical: z.boolean().default(false),
  charges: z.object({
    max: z.number().int(),
    current: z.number().int(),
    recharge: z.string().optional()  // "dawn", "never", etc.
  }).optional(),

  // Type-specific properties
  weapon: WeaponPropertiesSchema.optional(),
  armor: ArmorPropertiesSchema.optional(),

  // Container (bag of holding, etc.)
  container: z.boolean().default(false),
  containedItems: z.array(z.string()).default([]),  // Item IDs

  // Notes
  notes: z.string().optional(),

  // Reference
  source: z.string().optional(),
  isHomebrew: z.boolean().default(false),
  ddbId: z.number().int().optional()
})
export type InventoryItem = z.infer<typeof InventoryItemSchema>

// ============================================
// CHARACTER DESCRIPTION & ROLEPLAY
// ============================================

export const AppearanceSchema = z.object({
  age: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  eyes: z.string().optional(),
  hair: z.string().optional(),
  skin: z.string().optional(),
  description: z.string().optional(),
  portraitUrl: z.string().url().optional()
})
export type Appearance = z.infer<typeof AppearanceSchema>

export const PersonalitySchema = z.object({
  traits: z.array(z.string()).default([]),
  ideals: z.array(z.string()).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([])
})
export type Personality = z.infer<typeof PersonalitySchema>

export const BackstorySchema = z.object({
  backstory: z.string().optional(),
  allies: z.string().optional(),
  enemies: z.string().optional(),
  organizations: z.string().optional(),
  notes: z.string().optional()
})
export type Backstory = z.infer<typeof BackstorySchema>

// ============================================
// COMBAT & CONDITIONS
// ============================================

export const DeathSavesSchema = z.object({
  successes: z.number().int().min(0).max(3).default(0),
  failures: z.number().int().min(0).max(3).default(0)
})
export type DeathSaves = z.infer<typeof DeathSavesSchema>

export const ConditionSchema = z.enum([
  'blinded',
  'charmed',
  'deafened',
  'exhaustion_1',
  'exhaustion_2',
  'exhaustion_3',
  'exhaustion_4',
  'exhaustion_5',
  'exhaustion_6',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious'
])
export type Condition = z.infer<typeof ConditionSchema>

export const CombatStateSchema = z.object({
  // Hit Points
  hp: z.number().int(),
  maxHp: z.number().int(),
  tempHp: z.number().int().default(0),

  // Armor Class (base - bonuses calculated)
  baseAC: z.number().int().optional(),
  acOverride: z.number().int().optional(),  // For unarmored defense, etc.

  // Initiative
  initiativeBonus: z.number().int().optional(),

  // Death saves
  deathSaves: DeathSavesSchema.default({ successes: 0, failures: 0 }),

  // Conditions
  conditions: z.array(ConditionSchema).default([]),

  // Inspiration
  inspiration: z.boolean().default(false),

  // Concentrating on a spell
  concentrating: z.string().optional()  // Spell name
})
export type CombatState = z.infer<typeof CombatStateSchema>

// ============================================
// PROFICIENCIES (aggregated)
// ============================================

export const ProficienciesSchema = z.object({
  // Saving throws
  savingThrows: z.record(AbilitySchema, ProficiencyLevelSchema).default({}),

  // Skills
  skills: z.record(SkillSchema, ProficiencyLevelSchema).default({}),

  // Weapons (specific or category)
  weapons: z.array(z.string()).default([]),  // "longsword", "martial weapons", etc.

  // Armor
  armor: z.array(z.string()).default([]),  // "light armor", "medium armor", "shields"

  // Tools
  tools: z.array(z.string()).default([]),

  // Languages
  languages: z.array(z.string()).default([])
})
export type Proficiencies = z.infer<typeof ProficienciesSchema>

// ============================================
// MAIN CHARACTER SCHEMA
// ============================================

export const CharacterSchema = z.object({
  // === IDENTITY ===
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  ownerId: z.string().uuid(),  // Clerk user ID

  name: z.string(),
  playerName: z.string().optional(),

  // === RULESET ===
  ruleset: RulesetSchema.default('2014'),

  // === CORE STATS ===
  // Base ability scores (before bonuses)
  baseAbilityScores: AbilityScoresSchema,

  // Bonuses from all sources (race, feats, magic items, etc.)
  abilityBonuses: z.array(AbilityBonusSchema).default([]),

  // === RACE/SPECIES ===
  race: RaceSchema,

  // === CLASS(ES) ===
  classes: z.array(ClassSchema).min(1),

  // === BACKGROUND ===
  background: BackgroundSchema,

  // === FEATS ===
  feats: z.array(FeatSchema).default([]),

  // === PROFICIENCIES ===
  proficiencies: ProficienciesSchema,

  // === SPELLS ===
  spells: z.array(SpellSchema).default([]),

  // === INVENTORY ===
  // Inventory is now a separate SYSTEM, not a character attribute
  // This allows for mounts, followers, shared party inventory, etc.
  // See: bend/src/engine/inventory/schema.ts
  inventorySystemId: z.string().uuid().optional(),

  // === CARRYING CAPACITY (Optional) ===
  // Most tables play without encumbrance rules
  carryingCapacity: z.object({
    enabled: z.boolean().default(false),
    rule: z.enum(['none', 'basic', 'variant', 'realistic']).default('none'),
    customMaximum: z.number().optional()  // Override STR-based calculation
  }).optional(),

  // === COMBAT STATE ===
  combat: CombatStateSchema,

  // === EXPERIENCE ===
  experience: z.number().int().default(0),

  // === DESCRIPTION ===
  alignment: AlignmentSchema.default('true_neutral'),
  appearance: AppearanceSchema.default({}),
  personality: PersonalitySchema.default({ traits: [], ideals: [], bonds: [], flaws: [] }),
  backstory: BackstorySchema.default({}),

  // === MOVEMENT ===
  speed: z.object({
    walk: z.number().int().default(30),
    swim: z.number().int().optional(),
    fly: z.number().int().optional(),
    climb: z.number().int().optional(),
    burrow: z.number().int().optional()
  }),

  // === SENSES ===
  senses: z.object({
    darkvision: z.number().int().optional(),  // In feet
    blindsight: z.number().int().optional(),
    tremorsense: z.number().int().optional(),
    truesight: z.number().int().optional()
  }).default({}),

  // === RESISTANCES & IMMUNITIES ===
  resistances: z.array(z.string()).default([]),
  immunities: z.array(z.string()).default([]),
  vulnerabilities: z.array(z.string()).default([]),
  conditionImmunities: z.array(ConditionSchema).default([]),

  // === METADATA ===
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),

  // === IMPORT REFERENCE ===
  importSource: z.enum(['manual', 'ddb', 'pdf', 'other']).default('manual'),
  ddbCharacterId: z.number().int().optional(),

  // === STATUS ===
  status: z.enum(['alive', 'dead', 'retired', 'missing']).default('alive'),
  isNPC: z.boolean().default(false),

  // === PARTY ===
  partyId: z.string().uuid().optional()
})
export type Character = z.infer<typeof CharacterSchema>

// ============================================
// CALCULATED VALUES (Application Layer)
// ============================================

/**
 * Calculate total ability score including all bonuses
 */
export function calculateAbilityScore(
  base: number,
  bonuses: AbilityBonus[],
  ability: Ability
): number {
  const total = bonuses
    .filter(b => b.ability === ability)
    .reduce((sum, b) => sum + b.value, base)
  return Math.min(30, Math.max(1, total))
}

/**
 * Calculate ability modifier
 */
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/**
 * Calculate proficiency bonus based on total level
 */
export function calculateProficiencyBonus(totalLevel: number): number {
  return Math.ceil(totalLevel / 4) + 1
}

/**
 * Calculate total character level
 */
export function calculateTotalLevel(classes: Class[]): number {
  return classes.reduce((sum, c) => sum + c.level, 0)
}

/**
 * Calculate spell save DC
 */
export function calculateSpellSaveDC(
  abilityMod: number,
  proficiencyBonus: number
): number {
  return 8 + abilityMod + proficiencyBonus
}

/**
 * Calculate spell attack bonus
 */
export function calculateSpellAttackBonus(
  abilityMod: number,
  proficiencyBonus: number
): number {
  return abilityMod + proficiencyBonus
}

/**
 * Calculate AC from equipped armor
 */
export function calculateAC(
  dexMod: number,
  equippedArmor: InventoryItem | null,
  hasShield: boolean,
  acBonuses: number = 0
): number {
  let ac = 10 + dexMod  // Unarmored

  if (equippedArmor?.armor) {
    const armor = equippedArmor.armor
    ac = armor.baseAC

    if (armor.addDex) {
      const maxDex = armor.maxDex ?? Infinity
      ac += Math.min(dexMod, maxDex)
    }
  }

  if (hasShield) {
    ac += 2
  }

  return ac + acBonuses
}

/**
 * Calculate passive perception
 */
export function calculatePassivePerception(
  wisdomMod: number,
  proficiencyBonus: number,
  proficiencyLevel: ProficiencyLevel
): number {
  let bonus = wisdomMod

  switch (proficiencyLevel) {
    case 'half':
      bonus += Math.floor(proficiencyBonus / 2)
      break
    case 'proficient':
      bonus += proficiencyBonus
      break
    case 'expertise':
      bonus += proficiencyBonus * 2
      break
  }

  return 10 + bonus
}
