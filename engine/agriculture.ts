/**
 * AGRICULTURE — Farming, Fisheries, Gathering & Tax-in-Kind
 * ===========================================================
 *
 * Not just "food". This is the BACKBONE of the medieval economy.
 * 90% of the population farms. Grain IS money.
 *
 * Key concepts:
 *   - Farm plots with tenure (serfdom → freehold)
 *   - Monoculture (higher yield, fragile) vs multiculture (lower yield, resilient)
 *   - Seasonal growth cycles
 *   - Fisheries (freshwater/saltwater)
 *   - Gathering (wild ingredients)
 *   - Tax-in-kind: farmers pay taxes in grain, not coin
 *   - Food variety bonuses/penalties for settlements
 */

// ============================================================
// CROP TYPES — What grows where
// ============================================================

export type CropType =
  | 'wheat' | 'barley' | 'oats' | 'rye' | 'rice'     // Grains
  | 'potato' | 'turnip' | 'cabbage' | 'onion' | 'beans' // Vegetables
  | 'apple' | 'grape' | 'olive' | 'citrus' | 'berry'  // Orchards/groves
  | 'flax' | 'cotton' | 'hemp'                         // Fiber crops
  | 'hops' | 'herb_crop'                                // Specialty

export const CROP_DATA: Record<CropType, {
  category: 'grain' | 'vegetable' | 'fruit' | 'fiber' | 'specialty'
  /** Bushels per acre per season (base yield) */
  baseYield: number
  /** Seasons this crop can grow */
  growSeasons: ('spring' | 'summer' | 'fall')[]
  /** Days from planting to harvest */
  growDays: number
  /** Perish days after harvest */
  perishDays: number
  /** GP value per bushel */
  pricePerBushel: number
  /** Does this feed people? (fiber crops don't) */
  edible: boolean
  /** Climate requirements */
  preferredClimate: string[]
}> = {
  // Grains — the backbone
  wheat:   { category: 'grain', baseYield: 30, growSeasons: ['spring', 'summer'], growDays: 120, perishDays: 180, pricePerBushel: 0.5, edible: true, preferredClimate: ['temperate', 'warm'] },
  barley:  { category: 'grain', baseYield: 35, growSeasons: ['spring'], growDays: 90, perishDays: 180, pricePerBushel: 0.3, edible: true, preferredClimate: ['temperate', 'cold'] },
  oats:    { category: 'grain', baseYield: 25, growSeasons: ['spring'], growDays: 80, perishDays: 200, pricePerBushel: 0.25, edible: true, preferredClimate: ['temperate', 'cold'] },
  rye:     { category: 'grain', baseYield: 20, growSeasons: ['fall'], growDays: 100, perishDays: 240, pricePerBushel: 0.2, edible: true, preferredClimate: ['cold', 'temperate'] },
  rice:    { category: 'grain', baseYield: 40, growSeasons: ['summer'], growDays: 150, perishDays: 360, pricePerBushel: 0.8, edible: true, preferredClimate: ['tropical', 'warm'] },

  // Vegetables
  potato:  { category: 'vegetable', baseYield: 50, growSeasons: ['spring', 'summer'], growDays: 90, perishDays: 60, pricePerBushel: 0.15, edible: true, preferredClimate: ['temperate', 'cold'] },
  turnip:  { category: 'vegetable', baseYield: 40, growSeasons: ['spring', 'fall'], growDays: 60, perishDays: 90, pricePerBushel: 0.1, edible: true, preferredClimate: ['temperate', 'cold'] },
  cabbage: { category: 'vegetable', baseYield: 30, growSeasons: ['spring', 'fall'], growDays: 70, perishDays: 30, pricePerBushel: 0.12, edible: true, preferredClimate: ['temperate'] },
  onion:   { category: 'vegetable', baseYield: 35, growSeasons: ['spring'], growDays: 100, perishDays: 120, pricePerBushel: 0.2, edible: true, preferredClimate: ['temperate', 'warm'] },
  beans:   { category: 'vegetable', baseYield: 20, growSeasons: ['summer'], growDays: 75, perishDays: 180, pricePerBushel: 0.3, edible: true, preferredClimate: ['temperate', 'warm'] },

  // Orchard/grove fruit
  apple:   { category: 'fruit', baseYield: 15, growSeasons: ['fall'], growDays: 180, perishDays: 30, pricePerBushel: 0.4, edible: true, preferredClimate: ['temperate'] },
  grape:   { category: 'fruit', baseYield: 12, growSeasons: ['summer'], growDays: 160, perishDays: 14, pricePerBushel: 1.0, edible: true, preferredClimate: ['warm', 'temperate'] },
  olive:   { category: 'fruit', baseYield: 10, growSeasons: ['fall'], growDays: 200, perishDays: 30, pricePerBushel: 1.5, edible: true, preferredClimate: ['warm', 'arid'] },
  citrus:  { category: 'fruit', baseYield: 15, growSeasons: ['spring', 'summer'], growDays: 180, perishDays: 21, pricePerBushel: 2.0, edible: true, preferredClimate: ['tropical', 'warm'] },
  berry:   { category: 'fruit', baseYield: 8, growSeasons: ['summer'], growDays: 60, perishDays: 7, pricePerBushel: 0.5, edible: true, preferredClimate: ['temperate', 'cold'] },

  // Fiber crops (not edible)
  flax:    { category: 'fiber', baseYield: 15, growSeasons: ['spring'], growDays: 100, perishDays: 360, pricePerBushel: 1.0, edible: false, preferredClimate: ['temperate'] },
  cotton:  { category: 'fiber', baseYield: 12, growSeasons: ['summer'], growDays: 150, perishDays: 360, pricePerBushel: 1.5, edible: false, preferredClimate: ['warm', 'tropical'] },
  hemp:    { category: 'fiber', baseYield: 18, growSeasons: ['spring', 'summer'], growDays: 110, perishDays: 360, pricePerBushel: 0.8, edible: false, preferredClimate: ['temperate'] },

  // Specialty
  hops:      { category: 'specialty', baseYield: 10, growSeasons: ['summer'], growDays: 120, perishDays: 90, pricePerBushel: 2.0, edible: false, preferredClimate: ['temperate'] },
  herb_crop: { category: 'specialty', baseYield: 5, growSeasons: ['spring', 'summer'], growDays: 60, perishDays: 30, pricePerBushel: 5.0, edible: true, preferredClimate: ['temperate', 'warm'] },
}

// ============================================================
// PLOT SIZE — Scale of operation
// ============================================================

export type PlotSize = 'garden' | 'small_plot' | 'field' | 'large_estate'

export const PLOT_ACRES: Record<PlotSize, number> = {
  garden:       0.5,   // cottage garden, herbs
  small_plot:   5,     // family subsistence
  field:        40,    // standard medieval field
  large_estate: 200,   // noble or monastic estate
}

// ============================================================
// TENURE — Who works the land and how
// ============================================================

export type TenureType = 'serfdom' | 'tenant' | 'freehold' | 'communal' | 'monastic'

export const TENURE_MODIFIERS: Record<TenureType, {
  yieldMultiplier: number
  taxRate: number         // fraction of yield taken as tax
  laborEfficiency: number // motivation modifier
  canSellSurplus: boolean
}> = {
  serfdom:   { yieldMultiplier: 0.8, taxRate: 0.5, laborEfficiency: 0.7, canSellSurplus: false },
  tenant:    { yieldMultiplier: 0.9, taxRate: 0.33, laborEfficiency: 0.85, canSellSurplus: true },
  freehold:  { yieldMultiplier: 1.0, taxRate: 0.1, laborEfficiency: 1.0, canSellSurplus: true },
  communal:  { yieldMultiplier: 1.1, taxRate: 0.15, laborEfficiency: 0.95, canSellSurplus: true },
  monastic:  { yieldMultiplier: 1.2, taxRate: 0.0, laborEfficiency: 1.1, canSellSurplus: false }, // tithe instead
}

// ============================================================
// CULTIVATION MODE — Monoculture vs Multiculture
// ============================================================

export type CultivationMode = 'monoculture' | 'multiculture'

/**
 * monoculture: +25% yield, but if blight d20 ≤ 5 → entire crop lost
 * multiculture: -10% yield, but blight only affects one crop type (d20 ≤ 2)
 */
export const CULTIVATION_MODIFIERS: Record<CultivationMode, {
  yieldMultiplier: number
  blightThreshold: number   // d20 ≤ this = blight
  blightDamage: number      // fraction of crop lost
  varietyBonus: number       // food variety contribution
}> = {
  monoculture:  { yieldMultiplier: 1.25, blightThreshold: 5, blightDamage: 1.0, varietyBonus: 0 },
  multiculture: { yieldMultiplier: 0.9, blightThreshold: 2, blightDamage: 0.3, varietyBonus: 2 },
}

// ============================================================
// FARM PLOT — A single agricultural operation
// ============================================================

export interface FarmPlot {
  id: string
  nodeId: string         // settlement .tp
  ownerId: string        // landlord or settlement
  farmerId: string       // who works it (NPC or settlement)
  plotSize: PlotSize
  tenure: TenureType
  cultivation: CultivationMode
  /** Crops planted this season */
  crops: { type: CropType; acresPlanted: number }[]
  /** Current growth stage (days since planting) */
  growthDays: number
  /** Is this currently planted? */
  planted: boolean
  /** Current season */
  season: 'spring' | 'summer' | 'fall' | 'winter'
  /** Soil quality 0.5-2.0 */
  soilQuality: number
}

// ============================================================
// HARVEST — Calculate yield from a farm plot
// ============================================================

export interface HarvestResult {
  plotId: string
  yields: { crop: CropType; bushels: number; value: number }[]
  totalBushels: number
  totalValue: number
  taxInKind: number      // bushels taken as tax
  taxInCoin: number      // GP equivalent
  farmerKeeps: number    // bushels remaining
  blighted: boolean
  blightedCrops: CropType[]
}

/**
 * Calculate harvest yield for a farm plot.
 * @param d20 - blight check roll (low = bad)
 */
export function calculateHarvest(
  plot: FarmPlot,
  d20: number,
  weatherModifier: number = 1.0,
): HarvestResult {
  const tenure = TENURE_MODIFIERS[plot.tenure]
  const cultMode = CULTIVATION_MODIFIERS[plot.cultivation]
  const totalAcres = PLOT_ACRES[plot.plotSize]
  const blighted = d20 <= cultMode.blightThreshold
  const blightedCrops: CropType[] = []

  const yields: HarvestResult['yields'] = []
  let totalBushels = 0
  let totalValue = 0

  for (const crop of plot.crops) {
    const data = CROP_DATA[crop.type]
    if (!data) continue

    // Check if crop is in season
    if (!data.growSeasons.includes(plot.season as any)) continue

    // Base yield × acres × quality × tenure × cultivation × weather
    let bushels = data.baseYield * crop.acresPlanted *
      plot.soilQuality *
      tenure.yieldMultiplier *
      tenure.laborEfficiency *
      cultMode.yieldMultiplier *
      weatherModifier

    // Blight check
    if (blighted) {
      if (plot.cultivation === 'monoculture') {
        bushels *= (1 - cultMode.blightDamage)
        blightedCrops.push(crop.type)
      } else {
        // Multiculture: only first crop hit, partially
        if (blightedCrops.length === 0) {
          bushels *= (1 - cultMode.blightDamage)
          blightedCrops.push(crop.type)
        }
      }
    }

    bushels = Math.floor(bushels)
    const value = bushels * data.pricePerBushel

    yields.push({ crop: crop.type, bushels, value })
    totalBushels += bushels
    totalValue += value
  }

  // Tax-in-kind: landlord takes a fraction of the harvest
  const taxInKind = Math.floor(totalBushels * tenure.taxRate)
  const taxInCoin = taxInKind * 0.3 // approximate GP value of grain tax

  return {
    plotId: plot.id,
    yields,
    totalBushels,
    totalValue,
    taxInKind,
    taxInCoin,
    farmerKeeps: totalBushels - taxInKind,
    blighted,
    blightedCrops,
  }
}

// ============================================================
// FISHERY — Freshwater, Saltwater, Shellfish
// ============================================================

export type FisheryType = 'freshwater' | 'saltwater' | 'shellfish'

export const FISHERY_YIELD: Record<FisheryType, { baseLbsPerWeek: number; pricePerLb: number; perishDays: number }> = {
  freshwater: { baseLbsPerWeek: 100, pricePerLb: 0.05, perishDays: 3 },
  saltwater:  { baseLbsPerWeek: 200, pricePerLb: 0.08, perishDays: 5 },
  shellfish:  { baseLbsPerWeek: 50, pricePerLb: 0.15, perishDays: 2 },
}

export interface FisheryOperation {
  id: string
  nodeId: string
  type: FisheryType
  workers: number
  /** Boats in use */
  boats: number
  seasonalModifier: number  // 0.5-1.5
}

/**
 * Weekly fishing yield. More workers + boats = more fish, diminishing returns.
 */
export function weeklyFisheryYield(
  op: FisheryOperation,
  d20: number,
): { lbs: number; value: number; varietyContribution: number } {
  const data = FISHERY_YIELD[op.type]
  const crewEfficiency = Math.sqrt(op.workers) * (1 + op.boats * 0.2)
  const rollMod = d20 >= 15 ? 1.5 : d20 >= 10 ? 1.0 : d20 >= 5 ? 0.7 : 0.3
  const lbs = Math.floor(data.baseLbsPerWeek * crewEfficiency * op.seasonalModifier * rollMod)
  return {
    lbs,
    value: lbs * data.pricePerLb,
    varietyContribution: 1, // fish adds 1 food variety point
  }
}

// ============================================================
// GATHERING — Wild ingredients
// ============================================================

export type GatheringType = 'wild_herbs' | 'berries' | 'mushrooms' | 'roots' | 'honey' | 'nuts'

export const GATHERING_DATA: Record<GatheringType, {
  baseLbsPerGatherer: number
  pricePerLb: number
  perishDays: number
  preferredTerrain: string[]
  seasonAvailable: ('spring' | 'summer' | 'fall' | 'winter')[]
}> = {
  wild_herbs: { baseLbsPerGatherer: 3, pricePerLb: 2.0, perishDays: 14, preferredTerrain: ['forest', 'plains'], seasonAvailable: ['spring', 'summer'] },
  berries:    { baseLbsPerGatherer: 8, pricePerLb: 0.3, perishDays: 5, preferredTerrain: ['forest', 'hills'], seasonAvailable: ['summer'] },
  mushrooms:  { baseLbsPerGatherer: 4, pricePerLb: 1.0, perishDays: 7, preferredTerrain: ['forest', 'caves'], seasonAvailable: ['fall', 'spring'] },
  roots:      { baseLbsPerGatherer: 10, pricePerLb: 0.1, perishDays: 60, preferredTerrain: ['forest', 'plains', 'hills'], seasonAvailable: ['fall', 'spring'] },
  honey:      { baseLbsPerGatherer: 2, pricePerLb: 5.0, perishDays: 360, preferredTerrain: ['forest', 'plains'], seasonAvailable: ['summer', 'fall'] },
  nuts:       { baseLbsPerGatherer: 6, pricePerLb: 0.5, perishDays: 180, preferredTerrain: ['forest'], seasonAvailable: ['fall'] },
}

/**
 * Weekly gathering yield.
 */
export function weeklyGathering(
  type: GatheringType,
  gatherers: number,
  terrain: string,
  season: string,
  d20: number,
): { lbs: number; value: number; varietyContribution: number } {
  const data = GATHERING_DATA[type]
  if (!data.seasonAvailable.includes(season as any)) return { lbs: 0, value: 0, varietyContribution: 0 }

  const terrainBonus = data.preferredTerrain.includes(terrain) ? 1.3 : 0.7
  const rollMod = d20 >= 15 ? 1.5 : d20 >= 10 ? 1.0 : d20 >= 5 ? 0.6 : 0.2
  const lbs = Math.floor(data.baseLbsPerGatherer * gatherers * terrainBonus * rollMod)
  return {
    lbs,
    value: lbs * data.pricePerLb,
    varietyContribution: 1,
  }
}

// ============================================================
// TAX-IN-KIND — Grain as tax currency
// ============================================================

export interface TaxInKindResult {
  settlementId: string
  totalGrainCollected: number  // bushels
  totalCoinCollected: number   // GP
  grainToGranary: number       // stored for the city
  grainToArmy: number          // feed soldiers
  grainToMarket: number        // sold for gold
  grainValue: number           // GP equivalent of all grain
}

/**
 * Process monthly tax collection from all farm plots in a settlement.
 * The lord decides how to allocate collected grain.
 */
export function collectTaxInKind(
  harvests: HarvestResult[],
  armyMouthsToFeed: number,
  grainPriceGP: number = 0.5,
  allocation: { armyPercent: number; granaryPercent: number; marketPercent: number } = {
    armyPercent: 0.4, granaryPercent: 0.4, marketPercent: 0.2,
  },
): TaxInKindResult {
  const totalGrain = harvests.reduce((sum, h) => sum + h.taxInKind, 0)
  const totalCoin = harvests.reduce((sum, h) => sum + h.taxInCoin, 0)

  // Army needs: 1 bushel per soldier per month
  const armyNeeds = Math.min(
    Math.floor(totalGrain * allocation.armyPercent),
    armyMouthsToFeed,
  )

  const remaining = totalGrain - armyNeeds
  const toGranary = Math.floor(remaining * (allocation.granaryPercent / (allocation.granaryPercent + allocation.marketPercent)))
  const toMarket = remaining - toGranary

  return {
    settlementId: harvests[0]?.plotId?.split('_')[0] ?? 'unknown',
    totalGrainCollected: totalGrain,
    totalCoinCollected: totalCoin,
    grainToGranary: toGranary,
    grainToArmy: armyNeeds,
    grainToMarket: toMarket,
    grainValue: totalGrain * grainPriceGP,
  }
}

// ============================================================
// FOOD VARIETY — Bonuses for diverse diet, penalties for monotony
// ============================================================

export interface FoodVarietyScore {
  /** Number of distinct food types available */
  distinctFoods: number
  /** Score 0-10 */
  varietyScore: number
  /** Morale modifier from variety (-3 to +3) */
  moraleModifier: number
  /** Health modifier (-2 to +2) — affects disease resistance */
  healthModifier: number
  /** Description */
  description: string
}

/**
 * Calculate food variety score for a settlement or actor.
 *
 * Tracks how many distinct food categories are available:
 *   grain, vegetables, fruit, meat, dairy, eggs, fish, wild_herbs,
 *   honey, nuts, bread, ale/wine, spices
 *
 * More variety = happier, healthier people.
 * Monotonous diet (only grain) = penalties.
 */
export function calculateFoodVariety(availableFoods: string[]): FoodVarietyScore {
  const uniqueFoods = new Set(availableFoods)
  const n = uniqueFoods.size

  let varietyScore: number
  let moraleModifier: number
  let healthModifier: number
  let description: string

  if (n >= 10) {
    varietyScore = 10; moraleModifier = 3; healthModifier = 2
    description = 'Lavish & diverse — feasts and variety'
  } else if (n >= 7) {
    varietyScore = 7; moraleModifier = 2; healthModifier = 1
    description = 'Healthy variety — well-fed populace'
  } else if (n >= 5) {
    varietyScore = 5; moraleModifier = 1; healthModifier = 0
    description = 'Adequate — basic needs met with some variety'
  } else if (n >= 3) {
    varietyScore = 3; moraleModifier = 0; healthModifier = -1
    description = 'Monotonous — peasant diet, some grumbling'
  } else if (n >= 1) {
    varietyScore = 1; moraleModifier = -2; healthModifier = -2
    description = 'Near starvation — single food source, disease risk'
  } else {
    varietyScore = 0; moraleModifier = -3; healthModifier = -2
    description = 'Famine — no food variety at all'
  }

  return { distinctFoods: n, varietyScore, moraleModifier, healthModifier, description }
}

// ============================================================
// EXTRACTION INDUSTRIES — Logging, Quarries, Sand, Potash
// ============================================================

/**
 * These use the production-chain.ts Deposit + Extraction system.
 * This section provides the catalog of buildable extraction sites.
 */

export type ExtractionIndustry = 'logging' | 'quarry' | 'sand_pit' | 'potash' | 'clay_pit' | 'peat_bog'

export const EXTRACTION_INDUSTRY_DATA: Record<ExtractionIndustry, {
  commodityId: string
  depositType: string
  baseOutputPerDay: number
  laborRequired: number
  optimalLabor: number
  renewable: boolean
  buildCostGP: number
  buildDays: number
  terrainRequired: string[]
}> = {
  logging:   { commodityId: 'timber', depositType: 'forest', baseOutputPerDay: 3, laborRequired: 5, optimalLabor: 20, renewable: true, buildCostGP: 50, buildDays: 7, terrainRequired: ['forest', 'hills'] },
  quarry:    { commodityId: 'stone', depositType: 'surface', baseOutputPerDay: 2, laborRequired: 10, optimalLabor: 30, renewable: false, buildCostGP: 200, buildDays: 30, terrainRequired: ['mountain', 'hills'] },
  sand_pit:  { commodityId: 'sand', depositType: 'surface', baseOutputPerDay: 5, laborRequired: 3, optimalLabor: 10, renewable: true, buildCostGP: 30, buildDays: 3, terrainRequired: ['desert', 'coast', 'plains'] },
  potash:    { commodityId: 'potash', depositType: 'forest', baseOutputPerDay: 1, laborRequired: 3, optimalLabor: 8, renewable: true, buildCostGP: 40, buildDays: 7, terrainRequired: ['forest'] },
  clay_pit:  { commodityId: 'clay', depositType: 'surface', baseOutputPerDay: 4, laborRequired: 3, optimalLabor: 10, renewable: true, buildCostGP: 25, buildDays: 3, terrainRequired: ['plains', 'river', 'marsh'] },
  peat_bog:  { commodityId: 'peat', depositType: 'surface', baseOutputPerDay: 2, laborRequired: 4, optimalLabor: 12, renewable: true, buildCostGP: 20, buildDays: 5, terrainRequired: ['marsh', 'bog'] },
}

/**
 * Create a farm plot with defaults.
 */
let _farmId = 0
export function createFarmPlot(
  nodeId: string,
  ownerId: string,
  farmerId: string,
  opts: Partial<FarmPlot> = {},
): FarmPlot {
  return {
    id: `farm_${++_farmId}`,
    nodeId,
    ownerId,
    farmerId,
    plotSize: 'field',
    tenure: 'tenant',
    cultivation: 'multiculture',
    crops: [{ type: 'wheat', acresPlanted: 30 }, { type: 'turnip', acresPlanted: 10 }],
    growthDays: 0,
    planted: true,
    season: 'spring',
    soilQuality: 1.0,
    ...opts,
  }
}
