/**
 * INVENTORY SYSTEM SCHEMA
 * ========================
 *
 * A comprehensive inventory system that handles:
 * - Slot-based equipment (worn items)
 * - Carried items (backpack, pouches)
 * - Mount storage (saddlebags, cart)
 * - Follower inventory (hireling, animal companion)
 * - Multiple currency types including commodities
 * - Magic item rarity and attunement
 * - Homebrew item support
 *
 * DESIGN PRINCIPLES:
 * 1. Inventory is a SYSTEM, not a character attribute
 * 2. Carrying capacity is OPTIONAL (most tables ignore it)
 * 3. Slots provide intuitive "where is this item?" answers
 * 4. Supports expansion: mounts, followers, bags of holding
 * 5. Currency includes commodities for trade campaigns
 */

import { z } from 'zod'

// ============================================
// ITEM RARITY & MAGIC
// ============================================

/**
 * Standard D&D 5e rarity tiers
 * Each tier has associated gold value ranges and attunement likelihood
 */
export const ItemRaritySchema = z.enum([
  'common',       // 50-100 gp, no attunement
  'uncommon',     // 101-500 gp, sometimes attunement
  'rare',         // 501-5,000 gp, usually attunement
  'very_rare',    // 5,001-50,000 gp, almost always attunement
  'legendary',    // 50,001+ gp, always attunement
  'artifact'      // Priceless, special rules
])
export type ItemRarity = z.infer<typeof ItemRaritySchema>

/**
 * Rarity metadata for pricing and identification
 */
export const RARITY_DATA: Record<ItemRarity, {
  minValue: number
  maxValue: number | null
  attunementChance: number  // 0-1
  identifyDC: number
  color: string  // For UI
}> = {
  common: { minValue: 50, maxValue: 100, attunementChance: 0, identifyDC: 10, color: '#9ca3af' },
  uncommon: { minValue: 101, maxValue: 500, attunementChance: 0.3, identifyDC: 13, color: '#22c55e' },
  rare: { minValue: 501, maxValue: 5000, attunementChance: 0.7, identifyDC: 16, color: '#3b82f6' },
  very_rare: { minValue: 5001, maxValue: 50000, attunementChance: 0.9, identifyDC: 19, color: '#a855f7' },
  legendary: { minValue: 50001, maxValue: null, attunementChance: 1.0, identifyDC: 22, color: '#f59e0b' },
  artifact: { minValue: 0, maxValue: null, attunementChance: 1.0, identifyDC: 25, color: '#ef4444' }
}

/**
 * Attunement requirements beyond just "requires attunement"
 */
export const AttunementRequirementSchema = z.object({
  required: z.boolean().default(false),
  byClass: z.array(z.string()).optional(),       // e.g., ['wizard', 'sorcerer']
  byAlignment: z.array(z.string()).optional(),   // e.g., ['good', 'lawful']
  byRace: z.array(z.string()).optional(),        // e.g., ['elf', 'half-elf']
  bySpellcaster: z.boolean().optional(),         // Must be a spellcaster
  special: z.string().optional()                  // Free-form requirement text
})
export type AttunementRequirement = z.infer<typeof AttunementRequirementSchema>

// ============================================
// ITEM TYPES & CATEGORIES
// ============================================

/**
 * Primary item categories
 */
export const ItemCategorySchema = z.enum([
  // Equipment
  'weapon',
  'armor',
  'shield',
  'ammunition',

  // Wearables (non-armor)
  'clothing',
  'jewelry',

  // Consumables
  'potion',
  'scroll',
  'food',
  'drink',

  // Tools & Kits
  'tool',
  'instrument',
  'gaming_set',
  'kit',

  // Containers
  'container',
  'bag',

  // Transport
  'mount_equipment',  // Saddles, barding
  'vehicle',

  // Magic Items (non-consumable)
  'wondrous_item',
  'wand',
  'rod',
  'staff',
  'ring',

  // Trade & Treasure
  'trade_good',
  'treasure',
  'gem',
  'art_object',

  // Misc
  'adventuring_gear',
  'material_component',
  'other'
])
export type ItemCategory = z.infer<typeof ItemCategorySchema>

/**
 * Weapon properties (D&D 5e)
 */
export const WeaponPropertySchema = z.enum([
  'ammunition',
  'finesse',
  'heavy',
  'light',
  'loading',
  'reach',
  'special',
  'thrown',
  'two_handed',
  'versatile',
  'silvered',
  'adamantine',
  'magical'
])
export type WeaponProperty = z.infer<typeof WeaponPropertySchema>

/**
 * Damage types
 */
export const DamageTypeSchema = z.enum([
  'bludgeoning', 'piercing', 'slashing',
  'acid', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'poison', 'psychic', 'radiant', 'thunder'
])
export type DamageType = z.infer<typeof DamageTypeSchema>

/**
 * Armor types
 */
export const ArmorTypeSchema = z.enum([
  'light',    // Padded, leather, studded leather
  'medium',   // Hide, chain shirt, scale mail, breastplate, half plate
  'heavy',    // Ring mail, chain mail, splint, plate
  'shield'
])
export type ArmorType = z.infer<typeof ArmorTypeSchema>

// ============================================
// ITEM SCHEMA (CORE)
// ============================================

/**
 * Weapon-specific properties
 */
export const WeaponDataSchema = z.object({
  damage: z.string(),                           // "1d8", "2d6"
  damageType: DamageTypeSchema,
  properties: z.array(WeaponPropertySchema).default([]),
  versatileDamage: z.string().optional(),       // For versatile weapons
  range: z.object({
    normal: z.number().int(),
    long: z.number().int()
  }).optional(),
  bonusToHit: z.number().int().default(0),      // Magic weapon bonus
  bonusDamage: z.number().int().default(0),
  additionalDamage: z.object({
    dice: z.string(),
    type: DamageTypeSchema
  }).optional()                                   // e.g., Flame Tongue's fire damage
})
export type WeaponData = z.infer<typeof WeaponDataSchema>

/**
 * Armor-specific properties
 */
export const ArmorDataSchema = z.object({
  type: ArmorTypeSchema,
  baseAC: z.number().int(),
  addDexterity: z.boolean().default(false),     // Add DEX mod to AC
  maxDexBonus: z.number().int().optional(),     // Max DEX mod (usually 2 for medium)
  stealthDisadvantage: z.boolean().default(false),
  strengthRequirement: z.number().int().optional(),
  bonusAC: z.number().int().default(0)          // Magic armor bonus
})
export type ArmorData = z.infer<typeof ArmorDataSchema>

/**
 * Container-specific properties
 */
export const ContainerDataSchema = z.object({
  capacity: z.number().optional(),              // Max weight in pounds
  itemLimit: z.number().int().optional(),       // Max number of items
  dimensionalSpace: z.boolean().default(false), // Bag of Holding, Portable Hole
  actualWeight: z.number().optional(),          // Weight when full (for dimensional)
  restrictedItems: z.array(z.string()).optional() // Items that can't go in
})
export type ContainerData = z.infer<typeof ContainerDataSchema>

/**
 * Consumable-specific properties
 */
export const ConsumableDataSchema = z.object({
  uses: z.number().int().default(1),
  effect: z.string(),                           // What it does
  duration: z.string().optional(),              // How long it lasts
  saveDC: z.number().int().optional(),
  saveAbility: z.string().optional()
})
export type ConsumableData = z.infer<typeof ConsumableDataSchema>

/**
 * Charges for magic items
 */
export const ChargesDataSchema = z.object({
  max: z.number().int(),
  current: z.number().int(),
  rechargeAmount: z.string().optional(),        // "1d6+1"
  rechargeTime: z.enum(['dawn', 'dusk', 'short_rest', 'long_rest', 'never']).optional(),
  destroyOnEmpty: z.boolean().default(false),   // Wand of Wonder behavior
  destroyChance: z.number().optional()          // 1-in-20 chance to destroy
})
export type ChargesData = z.infer<typeof ChargesDataSchema>

/**
 * The core Item schema - used for all items
 */
export const ItemSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),      // For compact views

  // Classification
  category: ItemCategorySchema,
  subcategory: z.string().optional(),           // e.g., "longsword", "chain mail"

  // Physical properties
  weight: z.number().optional(),                // In pounds (null = weightless)
  size: z.enum(['tiny', 'small', 'medium', 'large', 'huge']).optional(),

  // Value
  baseValue: z.number().optional(),             // In gold pieces
  currentValue: z.number().optional(),          // May differ from base (damaged, etc)

  // Magic properties
  magical: z.boolean().default(false),
  rarity: ItemRaritySchema.optional(),
  attunement: AttunementRequirementSchema.optional(),
  cursed: z.boolean().default(false),
  curseDescription: z.string().optional(),
  identified: z.boolean().default(true),        // False = unknown properties
  unidentifiedName: z.string().optional(),      // "Glowing Sword" before identified
  unidentifiedDescription: z.string().optional(),

  // Charges (for wands, staves, etc)
  charges: ChargesDataSchema.optional(),

  // Type-specific data
  weapon: WeaponDataSchema.optional(),
  armor: ArmorDataSchema.optional(),
  container: ContainerDataSchema.optional(),
  consumable: ConsumableDataSchema.optional(),

  // Special abilities
  abilities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    activation: z.enum(['action', 'bonus_action', 'reaction', 'passive', 'special']).optional(),
    usesPerDay: z.number().int().optional(),
    recharge: z.string().optional()             // "5-6" for recharge abilities
  })).default([]),

  // Source tracking
  source: z.string().optional(),                // "PHB", "DMG", "homebrew"
  sourceBook: z.string().optional(),
  sourcePage: z.number().int().optional(),
  isHomebrew: z.boolean().default(false),
  homebrewAuthor: z.string().optional(),
  ddbId: z.number().int().optional(),           // D&D Beyond ID

  // Metadata
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
})
export type Item = z.infer<typeof ItemSchema>

// ============================================
// EQUIPMENT SLOTS
// ============================================

/**
 * Body slots for worn equipment
 * Based on common fantasy RPG equipment slots
 */
export const EquipmentSlotSchema = z.enum([
  // Armor & Clothing
  'head',         // Helmets, hats, circlets
  'face',         // Masks, goggles
  'neck',         // Amulets, necklaces, cloaks (some)
  'shoulders',    // Cloaks, mantles
  'chest',        // Armor, robes, shirts
  'back',         // Capes, backpacks (special)
  'arms',         // Bracers, armguards
  'hands',        // Gloves, gauntlets
  'waist',        // Belts
  'legs',         // Leggings, greaves
  'feet',         // Boots, shoes

  // Rings (2 slots typically)
  'ring_left',
  'ring_right',

  // Weapons & Held Items
  'main_hand',
  'off_hand',

  // Special slots
  'ammunition',   // Quiver, bullet pouch
  'component',    // Component pouch, focus
])
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>

/**
 * Which slots an item can occupy
 */
export const SLOT_COMPATIBILITY: Partial<Record<ItemCategory, EquipmentSlot[]>> = {
  armor: ['chest'],
  shield: ['off_hand'],
  weapon: ['main_hand', 'off_hand'],
  ring: ['ring_left', 'ring_right'],
  wondrous_item: ['head', 'face', 'neck', 'shoulders', 'chest', 'back', 'arms', 'hands', 'waist', 'legs', 'feet'],
  clothing: ['head', 'face', 'neck', 'shoulders', 'chest', 'back', 'hands', 'waist', 'legs', 'feet'],
  jewelry: ['neck', 'ring_left', 'ring_right', 'waist'],
}

// ============================================
// INVENTORY CONTAINERS
// ============================================

/**
 * Types of inventory containers
 */
export const InventoryContainerTypeSchema = z.enum([
  'worn',           // Equipment slots on body
  'carried',        // Backpack, pouches, in hands
  'mount',          // Saddlebags, cart attached to mount
  'follower',       // Items carried by follower/hireling
  'vehicle',        // Wagon, ship cargo
  'stash',          // Hidden cache, bank deposit
  'shared_party'    // Party treasury / shared loot
])
export type InventoryContainerType = z.infer<typeof InventoryContainerTypeSchema>

/**
 * An inventory container (backpack, mount's saddlebags, etc)
 */
export const InventoryContainerSchema = z.object({
  id: z.string().uuid(),
  type: InventoryContainerTypeSchema,
  name: z.string(),                             // "Backpack", "Shadowmere's Saddlebags"

  // Ownership
  ownerId: z.string().uuid(),                   // Character, mount, or follower ID
  ownerType: z.enum(['character', 'mount', 'follower', 'vehicle', 'party']),

  // Capacity (all optional for no-encumbrance play)
  weightCapacity: z.number().optional(),        // Max weight in pounds
  itemSlots: z.number().int().optional(),       // Max number of distinct items
  volumeCapacity: z.number().optional(),        // Cubic feet (for containers with size limits)

  // Special properties
  dimensionalSpace: z.boolean().default(false), // Bag of Holding, etc
  weatherproof: z.boolean().default(false),
  locked: z.boolean().default(false),
  lockDC: z.number().int().optional(),
  hidden: z.boolean().default(false),           // Secret compartment

  // For mount/follower containers
  linkedEntityId: z.string().uuid().optional(), // The mount or follower
  linkedEntityType: z.enum(['mount', 'follower', 'vehicle']).optional(),

  // Contents
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().default(1),
    equipped: z.boolean().default(false),       // For worn container
    equippedSlot: EquipmentSlotSchema.optional(),
    attuned: z.boolean().default(false),
    containedIn: z.string().uuid().optional(),  // Nested in another container item
    notes: z.string().optional()
  })).default([])
})
export type InventoryContainer = z.infer<typeof InventoryContainerSchema>

// ============================================
// CURRENCY SYSTEM
// ============================================

/**
 * Standard D&D currency
 */
export const StandardCurrencySchema = z.object({
  copper: z.number().int().default(0),          // cp - 1/100 gp
  silver: z.number().int().default(0),          // sp - 1/10 gp
  electrum: z.number().int().default(0),        // ep - 1/2 gp
  gold: z.number().int().default(0),            // gp - base unit
  platinum: z.number().int().default(0)         // pp - 10 gp
})
export type StandardCurrency = z.infer<typeof StandardCurrencySchema>

/**
 * Currency conversion rates (to gold pieces)
 */
export const CURRENCY_TO_GP: Record<keyof StandardCurrency, number> = {
  copper: 0.01,
  silver: 0.1,
  electrum: 0.5,
  gold: 1,
  platinum: 10
}

/**
 * Calculate total value in gold pieces
 */
export function currencyToGP(currency: StandardCurrency): number {
  return (
    currency.copper * CURRENCY_TO_GP.copper +
    currency.silver * CURRENCY_TO_GP.silver +
    currency.electrum * CURRENCY_TO_GP.electrum +
    currency.gold * CURRENCY_TO_GP.gold +
    currency.platinum * CURRENCY_TO_GP.platinum
  )
}

/**
 * Convert gold pieces to optimal denomination
 */
export function gpToCurrency(gp: number, includeElectrum = false): StandardCurrency {
  let remaining = Math.round(gp * 100) // Work in copper to avoid float issues

  const platinum = Math.floor(remaining / 1000)
  remaining -= platinum * 1000

  const gold = Math.floor(remaining / 100)
  remaining -= gold * 100

  let electrum = 0
  if (includeElectrum) {
    electrum = Math.floor(remaining / 50)
    remaining -= electrum * 50
  }

  const silver = Math.floor(remaining / 10)
  remaining -= silver * 10

  return {
    copper: remaining,
    silver,
    electrum,
    gold,
    platinum
  }
}

/**
 * Regional/Fantasy currencies for rich world-building
 * These are stored but not exposed in basic UI
 */
export const FantasyCurrencySchema = z.object({
  // Example regional currencies (1 unit = X gold pieces)
  taols: z.number().int().default(0),           // Waterdeep trade bars (2 gp)
  shards: z.number().int().default(0),          // Thay glass coins (0.1 gp)
  harborbars: z.number().int().default(0),      // Baldur's Gate trade bars (5 gp)
  moonstones: z.number().int().default(0),      // Elven currency (5 gp)
  bloodcoins: z.number().int().default(0),      // Underdark (0.5 gp)

  // Generic trade units
  trade_bars: z.number().int().default(0),      // Generic 10 gp bars
  gems_low: z.number().int().default(0),        // 10 gp gems
  gems_medium: z.number().int().default(0),     // 50 gp gems
  gems_high: z.number().int().default(0),       // 100 gp gems
  gems_precious: z.number().int().default(0),   // 500 gp gems
  gems_exquisite: z.number().int().default(0),  // 1000+ gp gems

  // Art objects
  art_minor: z.number().int().default(0),       // 25 gp art
  art_moderate: z.number().int().default(0),    // 250 gp art
  art_major: z.number().int().default(0),       // 750 gp art
  art_exceptional: z.number().int().default(0)  // 2500+ gp art
})
export type FantasyCurrency = z.infer<typeof FantasyCurrencySchema>

/**
 * Commodity types for trade campaigns
 * Stored as quantity, value fluctuates with economy system
 * NOT EXPOSED in basic UI - for advanced trade campaigns
 */
export const CommoditySchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    // Basic Goods
    'grain',
    'flour',
    'salt',
    'sugar',
    'spices',
    'ale',
    'wine',
    'spirits',

    // Textiles
    'wool',
    'linen',
    'silk',
    'leather',
    'fur',

    // Metals
    'iron_ore',
    'iron_ingot',
    'steel_ingot',
    'copper_ore',
    'copper_ingot',
    'silver_ore',
    'gold_ore',
    'mithral',
    'adamantine',

    // Precious
    'gems_uncut',
    'gems_cut',
    'pearls',
    'ivory',
    'coral',

    // Timber & Stone
    'timber',
    'hardwood',
    'stone',
    'marble',

    // Exotic
    'monster_parts',
    'rare_herbs',
    'magical_components',
    'alchemical_supplies',

    // Animals
    'livestock',
    'horses',
    'exotic_animals',

    // Other
    'slaves',         // Dark campaigns only
    'contraband',
    'other'
  ]),
  quantity: z.number(),                         // In standard units (pounds, items, etc)
  unit: z.string(),                             // "lb", "barrel", "crate", "head"
  baseValue: z.number(),                        // Base price per unit in gp
  quality: z.enum(['poor', 'standard', 'fine', 'exceptional']).default('standard'),
  origin: z.string().optional(),                // Where it came from (affects value)
  notes: z.string().optional()
})
export type Commodity = z.infer<typeof CommoditySchema>

/**
 * Complete currency wallet
 */
export const WalletSchema = z.object({
  standard: StandardCurrencySchema.default({
    copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0
  }),
  fantasy: FantasyCurrencySchema.optional(),    // Regional currencies
  commodities: z.array(CommoditySchema).default([]) // Trade goods
})
export type Wallet = z.infer<typeof WalletSchema>

// ============================================
// CARRYING CAPACITY (OPTIONAL)
// ============================================

/**
 * Encumbrance rules variants
 */
export const EncumbranceRuleSchema = z.enum([
  'none',           // No weight tracking at all
  'basic',          // STR x 15 lbs max
  'variant',        // STR x 5 encumbered, STR x 10 heavily encumbered
  'realistic'       // More granular homebrew rules
])
export type EncumbranceRule = z.infer<typeof EncumbranceRuleSchema>

/**
 * Calculate carrying capacity based on Strength
 */
export function calculateCarryingCapacity(
  strength: number,
  rule: EncumbranceRule,
  sizeModifier: number = 1  // 0.5 for small, 2 for large, etc
): {
  lightLoad: number | null
  encumbered: number | null
  heavilyEncumbered: number | null
  maximum: number | null
} {
  if (rule === 'none') {
    return { lightLoad: null, encumbered: null, heavilyEncumbered: null, maximum: null }
  }

  const base = strength * 15 * sizeModifier

  if (rule === 'basic') {
    return {
      lightLoad: null,
      encumbered: null,
      heavilyEncumbered: null,
      maximum: base
    }
  }

  if (rule === 'variant') {
    return {
      lightLoad: strength * 5 * sizeModifier,
      encumbered: strength * 10 * sizeModifier,
      heavilyEncumbered: null,
      maximum: base
    }
  }

  // Realistic variant
  return {
    lightLoad: strength * 3 * sizeModifier,
    encumbered: strength * 6 * sizeModifier,
    heavilyEncumbered: strength * 10 * sizeModifier,
    maximum: base
  }
}

/**
 * Get encumbrance penalties
 */
export function getEncumbrancePenalties(
  currentWeight: number,
  capacity: ReturnType<typeof calculateCarryingCapacity>
): {
  speedPenalty: number
  hasDisadvantageOnPhysical: boolean
  cannotMove: boolean
} {
  if (capacity.maximum === null) {
    return { speedPenalty: 0, hasDisadvantageOnPhysical: false, cannotMove: false }
  }

  if (currentWeight > capacity.maximum) {
    return { speedPenalty: 0, hasDisadvantageOnPhysical: true, cannotMove: true }
  }

  if (capacity.heavilyEncumbered && currentWeight > capacity.heavilyEncumbered) {
    return { speedPenalty: 20, hasDisadvantageOnPhysical: true, cannotMove: false }
  }

  if (capacity.encumbered && currentWeight > capacity.encumbered) {
    return { speedPenalty: 10, hasDisadvantageOnPhysical: false, cannotMove: false }
  }

  return { speedPenalty: 0, hasDisadvantageOnPhysical: false, cannotMove: false }
}

// ============================================
// MOUNT & FOLLOWER INVENTORY
// ============================================

/**
 * Mount types and their carrying capacities
 */
export const MountDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum([
    'horse_riding',     // 480 lbs
    'horse_war',        // 540 lbs
    'horse_draft',      // 540 lbs
    'pony',             // 225 lbs
    'mule',             // 420 lbs
    'donkey',           // 420 lbs
    'camel',            // 480 lbs
    'elephant',         // 1320 lbs
    'mastiff',          // 195 lbs
    'exotic',           // Variable
    'magical'           // Variable
  ]),
  strength: z.number().int(),
  carryingCapacity: z.number(),                 // In pounds
  speed: z.number().int(),
  canWearBarding: z.boolean().default(true),

  // Equipment
  barding: z.object({
    itemId: z.string().uuid(),
    equipped: z.boolean()
  }).optional(),
  saddle: z.object({
    itemId: z.string().uuid(),
    type: z.enum(['riding', 'military', 'pack', 'exotic'])
  }).optional(),

  // Attached containers
  containers: z.array(z.string().uuid()).default([])  // Container IDs
})
export type MountData = z.infer<typeof MountDataSchema>

/**
 * Follower types for inventory purposes
 */
export const FollowerDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum([
    'hireling',         // Paid follower
    'companion',        // Animal companion, familiar
    'cohort',           // Leadership follower
    'summoned',         // Summoned creature
    'undead',           // Animated dead
    'construct'         // Created construct
  ]),
  strength: z.number().int().optional(),
  carryingCapacity: z.number().optional(),

  // Inventory container (their carried items)
  inventoryContainerId: z.string().uuid().optional(),

  // Can they use items?
  canUseItems: z.boolean().default(false),
  canAttune: z.boolean().default(false)
})
export type FollowerData = z.infer<typeof FollowerDataSchema>

// ============================================
// COMPLETE INVENTORY SYSTEM
// ============================================

/**
 * The complete inventory system for a character
 */
export const InventorySystemSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Settings
  encumbranceRule: EncumbranceRuleSchema.default('none'),
  trackAmmunition: z.boolean().default(false),
  trackRations: z.boolean().default(false),
  trackWeight: z.boolean().default(false),

  // Currency
  wallet: WalletSchema,

  // Attunement tracking
  attunementSlots: z.number().int().default(3),
  attunedItems: z.array(z.string().uuid()).default([]),

  // Containers (the character always has these)
  wornContainer: z.string().uuid(),             // Equipment slots
  carriedContainer: z.string().uuid(),          // Backpack, pouches

  // Expansion containers
  additionalContainers: z.array(z.string().uuid()).default([]),

  // Mounts
  mounts: z.array(MountDataSchema).default([]),
  activeMountId: z.string().uuid().optional(),

  // Followers with inventory
  followers: z.array(FollowerDataSchema).default([]),

  // Quick access (cached for performance)
  totalWeight: z.number().optional(),
  totalValue: z.number().optional(),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type InventorySystem = z.infer<typeof InventorySystemSchema>

// ============================================
// HOMEBREW ITEM BUILDER
// ============================================

/**
 * Schema for AI-generated homebrew items
 * This is what the AI produces when creating items
 */
export const HomebrewItemRequestSchema = z.object({
  // User's description
  prompt: z.string(),                           // What the user wants

  // Constraints
  maxRarity: ItemRaritySchema.optional(),
  targetValue: z.number().optional(),
  category: ItemCategorySchema.optional(),
  requiresAttunement: z.boolean().optional(),
  isWeapon: z.boolean().optional(),
  isArmor: z.boolean().optional(),
  theme: z.string().optional()                  // "fire", "stealth", "healing", etc
})
export type HomebrewItemRequest = z.infer<typeof HomebrewItemRequestSchema>

/**
 * The response from AI item generation
 */
export const HomebrewItemResponseSchema = z.object({
  item: ItemSchema,
  reasoning: z.string(),                        // Why the AI made these choices
  balanceNotes: z.string().optional(),          // Potential balance concerns
  flavorText: z.string().optional(),            // In-world description
  historyHook: z.string().optional(),           // Plot hook for the item
  alternatives: z.array(z.object({
    name: z.string(),
    briefDescription: z.string()
  })).optional()                                // Other ideas the AI had
})
export type HomebrewItemResponse = z.infer<typeof HomebrewItemResponseSchema>

// ============================================
// ITEM TEMPLATES (SRD)
// ============================================

/**
 * Template for creating common items quickly
 * Not the full Item schema, just the essentials
 */
export const ItemTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ItemCategorySchema,
  weight: z.number().optional(),
  baseValue: z.number().optional(),
  description: z.string().optional(),
  weapon: WeaponDataSchema.optional(),
  armor: ArmorDataSchema.optional(),
  container: ContainerDataSchema.optional(),
  magical: z.boolean().default(false),
  rarity: ItemRaritySchema.optional()
})
export type ItemTemplate = z.infer<typeof ItemTemplateSchema>

// ============================================
// EXPORTS
// ============================================

export {
  // Re-export everything for convenient imports
  ItemSchema as Item,
  InventoryContainerSchema as InventoryContainer,
  InventorySystemSchema as InventorySystem,
  WalletSchema as Wallet,
  MountDataSchema as MountData,
  FollowerDataSchema as FollowerData
}
