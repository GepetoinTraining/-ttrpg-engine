/**
 * PRODUCTION CHAIN — From Dirt to Services
 * ============================================
 * 
 * THE FULL PIPELINE (each stage is an MF loop):
 * 
 *   DEPOSIT → EXTRACTION → COMMODITY
 *     ↓ (logistics)
 *   WORKSHOP → RECIPE → FINISHED GOOD
 *     ↓ (logistics)
 *   MARKET → PRICE → SALE
 *     ↓
 *   SERVICE PROVIDER → CONTRACT → EXECUTION
 * 
 * Everything ticks. Everything has physical location.
 * Nothing comes from nowhere.
 */

import { z } from 'zod'
import { TierSchema, type Tier } from './tier'

// ============================================================
// COMMODITIES — What the world trades
// ============================================================

export const CommodityCategorySchema = z.enum([
  // Primary (extraction)
  'food', 'water', 'fuel',            // Basic needs
  'timber', 'stone', 'ore', 'gems',   // Raw materials
  'cloth', 'leather', 'herbs',        // Organic raw
  'salt',                              // Preservation

  // Secondary (refined)
  'metal', 'weapons', 'armor', 'tools',
  'pottery', 'glass',
  'bread', 'ale', 'wine',

  // Luxury
  'spices', 'silk', 'art', 'jewelry', 'exotic',

  // Strategic
  'horses', 'ships', 'siege_equipment',
  'magic_components', 'enchanted_items',

  // Services (abstract)
  'labor', 'expertise', 'mercenaries', 'information',
])
export type CommodityCategory = z.infer<typeof CommodityCategorySchema>

export const CommoditySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: CommodityCategorySchema,
  basePrice: z.number().nonnegative(),    // GP per unit
  unit: z.string(),                        // "bushel", "ton", "ingot", "barrel"
  weightPerUnit: z.number().nonnegative(), // lbs per unit
  perishable: z.boolean().default(false),
  perishDays: z.number().int().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'very_rare', 'legendary']).default('common'),
  militaryValue: z.boolean().default(false),
  magicalValue: z.boolean().default(false),
})
export type Commodity = z.infer<typeof CommoditySchema>

// ============================================================
// STANDARD COMMODITIES CATALOG
// ============================================================

export const COMMODITIES: Record<string, Commodity> = {
  // Primary — Basic Needs
  grain:    { id: 'grain',    name: 'Grain',    category: 'food',   basePrice: 0.01,  unit: 'bushel', weightPerUnit: 60,  perishable: true, perishDays: 90, rarity: 'common', militaryValue: false, magicalValue: false },
  meat:     { id: 'meat',     name: 'Meat',     category: 'food',   basePrice: 0.1,   unit: 'lb',     weightPerUnit: 1,   perishable: true, perishDays: 7,  rarity: 'common', militaryValue: false, magicalValue: false },
  fish:     { id: 'fish',     name: 'Fish',     category: 'food',   basePrice: 0.05,  unit: 'lb',     weightPerUnit: 1,   perishable: true, perishDays: 3,  rarity: 'common', militaryValue: false, magicalValue: false },
  water:    { id: 'water',    name: 'Water',    category: 'water',  basePrice: 0.001, unit: 'gallon', weightPerUnit: 8,   perishable: false,                rarity: 'common', militaryValue: false, magicalValue: false },
  coal:     { id: 'coal',     name: 'Coal',     category: 'fuel',   basePrice: 0.1,   unit: 'lb',     weightPerUnit: 1,   perishable: false,                rarity: 'common', militaryValue: false, magicalValue: false },

  // Primary — Raw Materials
  timber:   { id: 'timber',   name: 'Timber',   category: 'timber', basePrice: 0.5,   unit: 'log',    weightPerUnit: 100, perishable: false,                rarity: 'common', militaryValue: false, magicalValue: false },
  stone:    { id: 'stone',    name: 'Stone',    category: 'stone',  basePrice: 0.2,   unit: 'block',  weightPerUnit: 200, perishable: false,                rarity: 'common', militaryValue: false, magicalValue: false },
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', category: 'ore',    basePrice: 1,     unit: 'ton',    weightPerUnit: 2000, perishable: false,               rarity: 'uncommon', militaryValue: true, magicalValue: false },
  copper_ore: { id: 'copper_ore', name: 'Copper Ore', category: 'ore', basePrice: 0.8, unit: 'ton', weightPerUnit: 2000, perishable: false,                 rarity: 'common', militaryValue: false, magicalValue: false },
  gold_ore: { id: 'gold_ore', name: 'Gold Ore', category: 'ore',    basePrice: 50,    unit: 'lb',     weightPerUnit: 1,   perishable: false,                rarity: 'rare',   militaryValue: false, magicalValue: false },
  herbs:    { id: 'herbs',    name: 'Herbs',    category: 'herbs',  basePrice: 2,     unit: 'lb',     weightPerUnit: 1,   perishable: true, perishDays: 30, rarity: 'uncommon', militaryValue: false, magicalValue: true  },
  leather:  { id: 'leather',  name: 'Leather',  category: 'leather', basePrice: 2,    unit: 'hide',   weightPerUnit: 5,   perishable: false,                rarity: 'common', militaryValue: false, magicalValue: false },
  cloth:    { id: 'cloth',    name: 'Cloth',    category: 'cloth',  basePrice: 1,     unit: 'bolt',   weightPerUnit: 10,  perishable: false,                rarity: 'common', militaryValue: false, magicalValue: false },
  salt:     { id: 'salt',     name: 'Salt',     category: 'salt',   basePrice: 0.5,   unit: 'lb',     weightPerUnit: 1,   perishable: false,                rarity: 'uncommon', militaryValue: false, magicalValue: false },

  // Secondary — Refined
  iron:     { id: 'iron',     name: 'Iron Ingots', category: 'metal', basePrice: 5,   unit: 'ingot',  weightPerUnit: 10,  perishable: false,                rarity: 'uncommon', militaryValue: true, magicalValue: false },
  weapons:  { id: 'weapons',  name: 'Weapons',  category: 'weapons', basePrice: 25,   unit: 'weapon', weightPerUnit: 5,   perishable: false,                rarity: 'uncommon', militaryValue: true, magicalValue: false },
  armor:    { id: 'armor',    name: 'Armor',    category: 'armor',   basePrice: 50,    unit: 'suit',   weightPerUnit: 40,  perishable: false,                rarity: 'uncommon', militaryValue: true, magicalValue: false },
  tools:    { id: 'tools',    name: 'Tools',    category: 'tools',   basePrice: 10,    unit: 'set',    weightPerUnit: 8,   perishable: false,                rarity: 'common', militaryValue: false, magicalValue: false },
  bread:    { id: 'bread',    name: 'Bread',    category: 'bread',   basePrice: 0.02,  unit: 'loaf',   weightPerUnit: 1,   perishable: true, perishDays: 3,  rarity: 'common', militaryValue: false, magicalValue: false },
  ale:      { id: 'ale',      name: 'Ale',      category: 'ale',     basePrice: 0.5,   unit: 'barrel', weightPerUnit: 100, perishable: true, perishDays: 60, rarity: 'common', militaryValue: false, magicalValue: false },

  // Luxury
  wine:     { id: 'wine',     name: 'Wine',     category: 'wine',    basePrice: 2,     unit: 'barrel', weightPerUnit: 100, perishable: false,                rarity: 'uncommon', militaryValue: false, magicalValue: false },
  spices:   { id: 'spices',   name: 'Spices',   category: 'spices',  basePrice: 50,    unit: 'lb',     weightPerUnit: 1,   perishable: false,                rarity: 'rare',   militaryValue: false, magicalValue: false },
  horses:   { id: 'horses',   name: 'Horses',   category: 'horses',  basePrice: 75,    unit: 'horse',  weightPerUnit: 1000, perishable: false,               rarity: 'uncommon', militaryValue: true, magicalValue: false },

  // Magical
  magic_components: { id: 'magic_components', name: 'Magic Components', category: 'magic_components', basePrice: 100, unit: 'pouch', weightPerUnit: 1, perishable: false, rarity: 'rare', militaryValue: false, magicalValue: true },

  // Extraction industries
  sand:   { id: 'sand',   name: 'Sand',   category: 'stone',  basePrice: 0.05, unit: 'ton',  weightPerUnit: 2000, perishable: false, rarity: 'common',   militaryValue: false, magicalValue: false },
  potash: { id: 'potash', name: 'Potash', category: 'salt',   basePrice: 0.3,  unit: 'lb',   weightPerUnit: 1,    perishable: false, rarity: 'uncommon', militaryValue: false, magicalValue: false },
  clay:   { id: 'clay',   name: 'Clay',   category: 'stone',  basePrice: 0.1,  unit: 'ton',  weightPerUnit: 2000, perishable: false, rarity: 'common',   militaryValue: false, magicalValue: false },
  peat:   { id: 'peat',   name: 'Peat',   category: 'fuel',   basePrice: 0.03, unit: 'lb',   weightPerUnit: 1,    perishable: false, rarity: 'common',   militaryValue: false, magicalValue: false },
}

// ============================================================
// DEPOSITS — Where raw materials come from
// ============================================================

export const DepositTypeSchema = z.enum([
  'surface', 'shallow', 'deep', 'underwater', 'volcanic',   // Mining
  'arable', 'pasture', 'orchard', 'vineyard',               // Agriculture
  'forest', 'old_growth', 'managed',                         // Forestry
  'fishery', 'deep_sea', 'shellfish',                        // Aquatic
  'herb_field', 'game_land', 'salt_flat',                    // Gathering
  'ley_line', 'planar_bleed', 'ruins',                       // Exotic
])
export type DepositType = z.infer<typeof DepositTypeSchema>

export const DepositQualitySchema = z.enum(['depleted', 'poor', 'standard', 'rich', 'legendary'])
export type DepositQuality = z.infer<typeof DepositQualitySchema>

export const QUALITY_MULTIPLIERS: Record<DepositQuality, number> = {
  depleted: 0.25, poor: 0.5, standard: 1.0, rich: 1.5, legendary: 2.0,
}

export const DepositSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodeId: z.string(),                    // .tp node
  depositType: DepositTypeSchema,
  primaryCommodityId: z.string(),
  secondaryCommodities: z.array(z.object({
    commodityId: z.string(),
    chance: z.number().min(0).max(1),
    ratio: z.number(),
  })).default([]),
  quality: DepositQualitySchema.default('standard'),
  /**
   * Universal tier (F→EX) — gates who can extract from this deposit.
   * Quality is the *yield* axis (depleted → legendary); tier is the
   * *grandeur / danger* axis (a backyard quarry vs a planar bleed).
   * Defaults to 'F' for legacy seed data; new deposits should set this.
   */
  tier: TierSchema.default('F'),

  // Reserves (non-renewable)
  totalReserves: z.number().optional(),
  remainingReserves: z.number().optional(),
  // Renewable
  renewable: z.boolean().default(false),
  regenerationPerDay: z.number().default(0),
  maxCapacity: z.number().optional(),
  currentCapacity: z.number().optional(),
  overexploited: z.boolean().default(false),

  // Requirements
  laborRequired: z.number().int().default(1),
  optimalLabor: z.number().int().default(10),
  baseOutputPerDay: z.number().default(1),

  // State
  discovered: z.boolean().default(false),
  exploited: z.boolean().default(false),
  controlledBy: z.string().optional(),
})
export type Deposit = z.infer<typeof DepositSchema>

// ============================================================
// EXTRACTION OPERATION — Working a deposit
// ============================================================

export const ExtractionSchema = z.object({
  id: z.string(),
  depositId: z.string(),
  nodeId: z.string(),
  operatorId: z.string(),

  // Workforce
  assignedWorkers: z.number().int().default(0),
  workerEfficiency: z.number().min(0).max(2).default(1),

  // Output
  currentOutputPerDay: z.number().default(0),
  totalExtracted: z.number().default(0),
  /** Where output goes — must be a physical container */
  outputContainerId: z.string(),

  // Stockpile at site
  stockpile: z.record(z.string(), z.number()).default({}),

  status: z.enum(['idle', 'operating', 'maintenance', 'disrupted', 'exhausted']).default('idle'),
})
export type Extraction = z.infer<typeof ExtractionSchema>

// ============================================================
// RECIPE — Input commodities → Output goods
// ============================================================

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  workshopType: z.string(),            // forge, bakery, alchemy_lab, etc.
  inputs: z.array(z.object({
    commodityId: z.string(),
    quantity: z.number(),
  })),
  outputs: z.array(z.object({
    commodityId: z.string(),
    quantity: z.number(),
  })),
  baseSlotsPerBatch: z.number().int(),  // time slots to produce one batch
  minSkillLevel: z.number().int().default(1),
  difficulty: z.number().int().default(10), // DC for quality roll
})
export type Recipe = z.infer<typeof RecipeSchema>

// ============================================================
// STANDARD RECIPES — The production chains the world runs on
// ============================================================

export const RECIPES: Recipe[] = [
  // PRIMARY → SECONDARY
  { id: 'r_iron_ingot',  name: 'Iron Ingot',   workshopType: 'forge',       inputs: [{ commodityId: 'iron_ore', quantity: 2 }, { commodityId: 'coal', quantity: 1 }], outputs: [{ commodityId: 'iron', quantity: 1 }], baseSlotsPerBatch: 2, minSkillLevel: 1, difficulty: 8 },
  { id: 'r_longsword',   name: 'Longsword',    workshopType: 'weaponsmith', inputs: [{ commodityId: 'iron', quantity: 3 }, { commodityId: 'timber', quantity: 1 }, { commodityId: 'leather', quantity: 1 }], outputs: [{ commodityId: 'weapons', quantity: 1 }], baseSlotsPerBatch: 8, minSkillLevel: 2, difficulty: 12 },
  { id: 'r_chain_mail',  name: 'Chain Mail',   workshopType: 'armorsmith',  inputs: [{ commodityId: 'iron', quantity: 10 }], outputs: [{ commodityId: 'armor', quantity: 1 }], baseSlotsPerBatch: 16, minSkillLevel: 3, difficulty: 15 },
  { id: 'r_tools',       name: 'Tool Set',     workshopType: 'forge',       inputs: [{ commodityId: 'iron', quantity: 2 }, { commodityId: 'timber', quantity: 1 }], outputs: [{ commodityId: 'tools', quantity: 1 }], baseSlotsPerBatch: 4, minSkillLevel: 1, difficulty: 8 },
  { id: 'r_shield',      name: 'Wooden Shield', workshopType: 'carpentry',  inputs: [{ commodityId: 'timber', quantity: 2 }, { commodityId: 'iron', quantity: 1 }], outputs: [{ commodityId: 'weapons', quantity: 1 }], baseSlotsPerBatch: 4, minSkillLevel: 1, difficulty: 10 },

  // FOOD CHAIN
  { id: 'r_bread',       name: 'Bread',        workshopType: 'bakery',      inputs: [{ commodityId: 'grain', quantity: 2 }], outputs: [{ commodityId: 'bread', quantity: 4 }], baseSlotsPerBatch: 1, minSkillLevel: 1, difficulty: 5 },
  { id: 'r_ale',         name: 'Ale Barrel',   workshopType: 'brewery',     inputs: [{ commodityId: 'grain', quantity: 10 }, { commodityId: 'water', quantity: 5 }], outputs: [{ commodityId: 'ale', quantity: 1 }], baseSlotsPerBatch: 8, minSkillLevel: 1, difficulty: 8 },

  // ALCHEMY
  { id: 'r_healing',     name: 'Healing Potion', workshopType: 'alchemy_lab', inputs: [{ commodityId: 'herbs', quantity: 3 }, { commodityId: 'magic_components', quantity: 1 }], outputs: [{ commodityId: 'magic_components', quantity: 1 }], baseSlotsPerBatch: 4, minSkillLevel: 2, difficulty: 13 },
]

// ============================================================
// QUALITY from d20 roll (same as old workshop system)
// ============================================================

export const QUALITY_LEVELS = {
  poor:       { priceMultiplier: 0.5, durability: 0.5 },
  common:     { priceMultiplier: 1.0, durability: 1.0 },
  good:       { priceMultiplier: 1.5, durability: 1.25 },
  excellent:  { priceMultiplier: 2.0, durability: 1.5 },
  masterwork: { priceMultiplier: 3.0, durability: 2.0 },
} as const
export type QualityLevel = keyof typeof QUALITY_LEVELS

export function rollQuality(skill: number, toolBonus: number, difficulty: number, d20: number): QualityLevel {
  const total = d20 + skill + toolBonus
  const margin = total - difficulty

  if (d20 === 1) return 'poor'
  let quality: QualityLevel = margin < 0 ? 'poor' : margin < 5 ? 'common' : margin < 10 ? 'good' : margin < 15 ? 'excellent' : 'masterwork'
  if (d20 === 20 && quality !== 'masterwork') {
    const order: QualityLevel[] = ['poor', 'common', 'good', 'excellent', 'masterwork']
    quality = order[Math.min(order.indexOf(quality) + 1, 4)]
  }
  return quality
}

// ============================================================
// MARKET PRICE — Supply/demand at a node
// ============================================================

export const MarketPriceSchema = z.object({
  commodityId: z.string(),
  currentPrice: z.number(),
  basePrice: z.number(),
  supply: z.number().int().default(0),
  demand: z.number().int().default(0),
  trend: z.enum(['crashing', 'falling', 'stable', 'rising', 'spiking']).default('stable'),
  available: z.boolean().default(true),
  blackMarketOnly: z.boolean().default(false),
})
export type MarketPrice = z.infer<typeof MarketPriceSchema>

/**
 * Calculate price from supply/demand ratio.
 * surplus → cheaper, shortage → more expensive.
 */
export function calculatePrice(basePrice: number, supply: number, demand: number): number {
  if (demand <= 0) return basePrice * 0.5 // no demand = half price
  if (supply <= 0) return basePrice * 5   // no supply = 5x price

  const ratio = supply / demand
  // ratio 1 = base price
  // ratio 2 = 0.7x (surplus)
  // ratio 0.5 = 1.5x (shortage)
  // ratio 0.1 = 3x (critical shortage)
  const multiplier = 1 / Math.pow(ratio, 0.5)
  return Math.max(basePrice * 0.1, basePrice * multiplier)
}

/**
 * Determine trend from price history.
 */
export function determineTrend(priceNow: number, pricePrev: number): MarketPrice['trend'] {
  const change = (priceNow - pricePrev) / pricePrev
  if (change < -0.2) return 'crashing'
  if (change < -0.05) return 'falling'
  if (change > 0.2) return 'spiking'
  if (change > 0.05) return 'rising'
  return 'stable'
}

// ============================================================
// TICK FUNCTIONS — MF loops
// ============================================================

/**
 * Tick an extraction operation for one world-day.
 * Returns raw commodities produced.
 */
export function tickExtraction(
  extraction: Extraction,
  deposit: Deposit,
): Record<string, number> {
  if (extraction.status !== 'operating') return {}

  // Calculate output based on workforce and deposit quality
  const laborRatio = Math.min(extraction.assignedWorkers / deposit.optimalLabor, 1)
  const qualityMult = QUALITY_MULTIPLIERS[deposit.quality]
  const output = deposit.baseOutputPerDay * laborRatio * qualityMult * extraction.workerEfficiency

  const produced: Record<string, number> = {
    [deposit.primaryCommodityId]: output,
  }

  // Secondary commodities (chance-based, seeded later)
  for (const sec of deposit.secondaryCommodities) {
    produced[sec.commodityId] = output * sec.ratio * sec.chance
  }

  // Deplete reserves for non-renewable
  if (!deposit.renewable && deposit.remainingReserves !== undefined) {
    deposit.remainingReserves = Math.max(0, deposit.remainingReserves - output)
    if (deposit.remainingReserves <= 0) {
      extraction.status = 'exhausted'
    }
  }

  // Overexploitation check for renewable
  if (deposit.renewable && deposit.currentCapacity !== undefined) {
    deposit.currentCapacity -= output
    if (deposit.currentCapacity < 0) {
      deposit.overexploited = true
    }
    // Regenerate
    deposit.currentCapacity = Math.min(
      deposit.maxCapacity ?? Infinity,
      deposit.currentCapacity + deposit.regenerationPerDay,
    )
  }

  // Accumulate to stockpile
  for (const [id, qty] of Object.entries(produced)) {
    extraction.stockpile[id] = (extraction.stockpile[id] ?? 0) + qty
  }

  extraction.currentOutputPerDay = output
  extraction.totalExtracted += output

  return produced
}

/**
 * Tick a market for one world-day.
 * Applies consumption (demand removes from supply) and recalculates prices.
 */
export function tickMarket(
  prices: MarketPrice[],
  dailyConsumption: Record<string, number>,
  dailyProduction: Record<string, number>,
): void {
  for (const p of prices) {
    // Add production to supply
    p.supply += dailyProduction[p.commodityId] ?? 0
    // Remove consumption from supply
    const consumed = Math.min(p.supply, dailyConsumption[p.commodityId] ?? 0)
    p.supply -= consumed

    // Recalculate price
    const prevPrice = p.currentPrice
    p.currentPrice = calculatePrice(p.basePrice, p.supply, p.demand)
    p.trend = determineTrend(p.currentPrice, prevPrice)
  }
}

// ============================================================
// DEPOSIT TEMPLATES — Quick creation
// ============================================================

let _depositId = 0
export function resetDepositIdCounter(): void { _depositId = 0 }

export function createDeposit(
  name: string,
  nodeId: string,
  type: DepositType,
  primaryCommodity: string,
  quality: DepositQuality = 'standard',
  opts: Partial<Deposit> = {},
): Deposit {
  return {
    id: `deposit_${++_depositId}`,
    name,
    nodeId,
    depositType: type,
    primaryCommodityId: primaryCommodity,
    secondaryCommodities: [],
    quality,
    tier: 'F' as Tier,    // default; callers may override via opts
    renewable: false,
    regenerationPerDay: 0,
    overexploited: false,
    laborRequired: 5,
    optimalLabor: 20,
    baseOutputPerDay: 2,
    discovered: true,
    exploited: false,
    ...opts,
  }
}

let _extractionId = 0
export function resetExtractionIdCounter(): void { _extractionId = 0 }

export function createExtraction(
  depositId: string,
  nodeId: string,
  operatorId: string,
  outputContainerId: string,
  workers: number = 10,
): Extraction {
  return {
    id: `extraction_${++_extractionId}`,
    depositId,
    nodeId,
    operatorId,
    assignedWorkers: workers,
    workerEfficiency: 1,
    currentOutputPerDay: 0,
    totalExtracted: 0,
    outputContainerId,
    stockpile: {},
    status: 'operating',
  }
}
