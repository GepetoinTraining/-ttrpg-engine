/**
 * WATER — Lakes, Rivers, Streams, Seas & Navigation
 * ==================================================
 *
 * Water bodies are .tp nodes. Water connections are edges.
 * Rivers FLOW (directional edges). Seas are bidirectional.
 *
 * Water matters for:
 *   - Settlement bonuses (fresh water, irrigation, fishing)
 *   - Navigation (boats, trade routes, naval warfare)
 *   - Strategic control (river crossings, port access)
 *   - Resource extraction (fishing, pearl diving)
 *   - Weather interaction (κ modifiers from water proximity)
 */

// ============================================================
// WATER BODY TYPES — .tp nodes
// ============================================================

export type WaterBodyType = 'stream' | 'river' | 'lake' | 'bay' | 'sea' | 'ocean' | 'delta' | 'swamp'

export const WATER_BODY_SIZE: Record<WaterBodyType, { minArea: number; maxArea: number }> = {
  stream: { minArea: 0, maxArea: 1 },
  river:  { minArea: 1, maxArea: 5 },
  lake:   { minArea: 1, maxArea: 50 },
  bay:    { minArea: 10, maxArea: 100 },
  delta:  { minArea: 5, maxArea: 20 },
  swamp:  { minArea: 1, maxArea: 30 },
  sea:    { minArea: 100, maxArea: 10000 },
  ocean:  { minArea: 10000, maxArea: Infinity },
}

export interface WaterBody {
  id: string
  name: string
  type: WaterBodyType
  regionId: string          // .tp region this water is in
  /** Fresh or salt water — determines fishing and drinking */
  salinity: 'fresh' | 'brackish' | 'salt'
  /** Size in abstract area units */
  area: number
  /** Depth category */
  depth: 'shallow' | 'moderate' | 'deep' | 'abyssal'
  /** Is this navigable by boats? */
  navigable: boolean
  /** Fishing yield per week (food units) */
  fishingYield: number
  /** Does this provide settlement water supply? */
  drinkable: boolean
}

// ============================================================
// WATER EDGES — Connections (rivers flow, seas connect)
// ============================================================

export type WaterEdgeType = 'river_segment' | 'sea_lane' | 'canal' | 'strait' | 'river_crossing'

export interface WaterEdge {
  id: string
  fromId: string          // water body or settlement ID
  toId: string
  edgeType: WaterEdgeType
  /** River flow is directional — upstream travel is slower */
  flowDirection: 'downstream' | 'upstream' | 'bidirectional'
  /** Distance in miles */
  distanceMiles: number
  /** Navigability: some sections may be rapids, waterfalls */
  navigable: boolean
  /** Danger level (pirates, sea monsters, rapids) */
  danger: number
  /** Width category — affects crossing difficulty */
  width: 'narrow' | 'moderate' | 'wide' | 'vast'
}

// ============================================================
// NAVIGATION — Boat travel
// ============================================================

export type BoatType = 'raft' | 'canoe' | 'rowboat' | 'sailboat' | 'keelboat' | 'longship' | 'galley' | 'warship'

export const BOAT_STATS: Record<BoatType, {
  speed: number       // miles per day
  capacity: number    // cargo weight
  crew: number        // minimum crew
  seaWorthy: boolean  // can handle open sea?
  cost: number        // GP
}> = {
  raft:     { speed: 5,  capacity: 200,  crew: 1,  seaWorthy: false, cost: 5 },
  canoe:    { speed: 8,  capacity: 100,  crew: 1,  seaWorthy: false, cost: 25 },
  rowboat:  { speed: 10, capacity: 300,  crew: 2,  seaWorthy: false, cost: 50 },
  sailboat: { speed: 24, capacity: 500,  crew: 3,  seaWorthy: true,  cost: 2000 },
  keelboat: { speed: 15, capacity: 2000, crew: 5,  seaWorthy: false, cost: 3000 },
  longship: { speed: 30, capacity: 5000, crew: 40, seaWorthy: true,  cost: 10000 },
  galley:   { speed: 20, capacity: 10000,crew: 80, seaWorthy: true,  cost: 25000 },
  warship:  { speed: 18, capacity: 8000, crew: 100, seaWorthy: true, cost: 50000 },
}

/**
 * Calculate travel time along a water edge.
 * Downstream: full speed. Upstream: half speed. Bidirectional: full.
 */
export function waterTravelDays(edge: WaterEdge, boat: BoatType): number {
  const stats = BOAT_STATS[boat]
  if (!edge.navigable || !stats) return Infinity
  // Sea routes require seaworthy boats
  if ((edge.edgeType === 'sea_lane' || edge.edgeType === 'strait') && !stats.seaWorthy) return Infinity

  const speedMod = edge.flowDirection === 'upstream' ? 0.5
    : edge.flowDirection === 'downstream' ? 1.5
    : 1.0

  return Math.ceil(edge.distanceMiles / (stats.speed * speedMod))
}

// ============================================================
// SETTLEMENT WATER BONUSES
// ============================================================

export interface WaterBonus {
  settlementId: string
  /** Fresh water supply: +population capacity */
  waterSupply: boolean
  /** Irrigation: +agriculture yield */
  irrigation: boolean
  /** Fishing: weekly food income */
  fishingIncome: number
  /** Port: enables naval trade */
  hasPort: boolean
  /** River crossing: strategic military value */
  strategicCrossing: boolean
}

/**
 * Calculate water bonuses for a settlement based on adjacent water bodies/edges.
 */
export function calculateWaterBonus(
  settlementId: string,
  adjacentWater: WaterBody[],
  adjacentEdges: WaterEdge[],
): WaterBonus {
  const freshWater = adjacentWater.some(w => w.drinkable)
  const rivers = adjacentWater.filter(w => w.type === 'river' || w.type === 'stream')
  const navigableWater = adjacentWater.some(w => w.navigable)
  const hasSeaAccess = adjacentWater.some(w => w.type === 'sea' || w.type === 'ocean' || w.type === 'bay')
  const hasCrossing = adjacentEdges.some(e => e.edgeType === 'river_crossing')

  const fishingIncome = adjacentWater.reduce((sum, w) => sum + w.fishingYield, 0)

  return {
    settlementId,
    waterSupply: freshWater,
    irrigation: rivers.length > 0,
    fishingIncome,
    hasPort: navigableWater || hasSeaAccess,
    strategicCrossing: hasCrossing,
  }
}

// ============================================================
// FISHING — Resource extraction
// ============================================================

export interface FishingResult {
  waterBodyId: string
  foodUnits: number
  d20: number
  quality: 'poor' | 'average' | 'good' | 'abundant'
}

/**
 * Weekly fishing at a water body.
 * Yield = base × d20 modifier × depth bonus.
 */
export function weeklyFishing(water: WaterBody, d20: number): FishingResult {
  const depthBonus = { shallow: 0.8, moderate: 1.0, deep: 1.3, abyssal: 0.5 }
  const base = water.fishingYield * depthBonus[water.depth]

  let qualityMul: number
  let quality: FishingResult['quality']
  if (d20 <= 5)       { quality = 'poor';     qualityMul = 0.5 }
  else if (d20 <= 12) { quality = 'average';  qualityMul = 1.0 }
  else if (d20 <= 17) { quality = 'good';     qualityMul = 1.5 }
  else                { quality = 'abundant'; qualityMul = 2.0 }

  return {
    waterBodyId: water.id,
    foodUnits: Math.round(base * qualityMul),
    d20,
    quality,
  }
}

/**
 * Create a water body.
 */
export function createWaterBody(
  name: string,
  type: WaterBodyType,
  regionId: string,
  overrides: Partial<WaterBody> = {},
): WaterBody {
  const defaults: Record<WaterBodyType, Partial<WaterBody>> = {
    stream: { salinity: 'fresh', depth: 'shallow', navigable: false, fishingYield: 2, drinkable: true, area: 1 },
    river:  { salinity: 'fresh', depth: 'moderate', navigable: true, fishingYield: 5, drinkable: true, area: 3 },
    lake:   { salinity: 'fresh', depth: 'deep', navigable: true, fishingYield: 8, drinkable: true, area: 20 },
    bay:    { salinity: 'salt', depth: 'moderate', navigable: true, fishingYield: 10, drinkable: false, area: 30 },
    delta:  { salinity: 'brackish', depth: 'shallow', navigable: true, fishingYield: 12, drinkable: false, area: 10 },
    swamp:  { salinity: 'brackish', depth: 'shallow', navigable: false, fishingYield: 3, drinkable: false, area: 5 },
    sea:    { salinity: 'salt', depth: 'deep', navigable: true, fishingYield: 15, drinkable: false, area: 500 },
    ocean:  { salinity: 'salt', depth: 'abyssal', navigable: true, fishingYield: 20, drinkable: false, area: 50000 },
  }

  const d = defaults[type]
  return {
    id: `water_${name.toLowerCase().replace(/\s/g, '_')}`,
    name,
    type,
    regionId,
    salinity: overrides.salinity ?? d.salinity ?? 'fresh',
    area: overrides.area ?? d.area ?? 1,
    depth: overrides.depth ?? d.depth ?? 'moderate',
    navigable: overrides.navigable ?? d.navigable ?? true,
    fishingYield: overrides.fishingYield ?? d.fishingYield ?? 5,
    drinkable: overrides.drinkable ?? d.drinkable ?? false,
  }
}

// ============================================================
// WATER LEVEL — Dynamic tracking
// ============================================================

export type FloodStage = 'drought' | 'low' | 'normal' | 'watch' | 'warning' | 'flood' | 'catastrophic'

export interface WaterLevelState {
  waterBodyId: string
  /** Current water level as % of normal (100 = normal, 200 = double) */
  level: number
  /** Current flood stage */
  floodStage: FloodStage
  /** Natural drainage rate per day (% lost) */
  drainageRate: number
  /** Natural recharge rate per day (% gained from springs/groundwater) */
  rechargeRate: number
  /** Peak level this season (for flood tracking) */
  seasonPeak: number
}

/** Baseline drainage rates by water body type (% per day) */
const BASE_DRAINAGE: Record<WaterBodyType, number> = {
  stream: 5,    // drains fast
  river:  3,    // moderate flow-through
  lake:   0.5,  // slow evaporation
  bay:    0.2,
  delta:  2,    // tidal, drains quickly
  swamp:  1,
  sea:    0.05,
  ocean:  0.01,
}

/** Baseline recharge rates (% per day from springs/groundwater) */
const BASE_RECHARGE: Record<WaterBodyType, number> = {
  stream: 3,
  river:  2,
  lake:   1,
  bay:    0.5,
  delta:  1.5,
  swamp:  2,
  sea:    0.1,
  ocean:  0.05,
}

/**
 * Create a water level tracker for a water body.
 */
export function createWaterLevel(waterBodyId: string, type: WaterBodyType): WaterLevelState {
  return {
    waterBodyId,
    level: 100,
    floodStage: 'normal',
    drainageRate: BASE_DRAINAGE[type],
    rechargeRate: BASE_RECHARGE[type],
    seasonPeak: 100,
  }
}

/**
 * Map water level % to flood stage.
 */
export function getFloodStage(level: number): FloodStage {
  if (level <= 30)  return 'drought'
  if (level <= 60)  return 'low'
  if (level <= 120) return 'normal'
  if (level <= 140) return 'watch'
  if (level <= 170) return 'warning'
  if (level <= 200) return 'flood'
  return 'catastrophic'
}

// ============================================================
// WATER LEVEL UPDATE — Weather-driven
// ============================================================

export interface WaterInputs {
  /** Rain intensity (0 = none, 1 = normal, 3 = monsoon) */
  rainfall: number
  /** Snowmelt (0 = none, 1 = normal spring, 2 = rapid thaw) */
  snowmelt: number
  /** Evaporation modifier (1 = normal, 2 = hot summer, 0.5 = cool) */
  evaporation: number
  /** Upstream inflow from connected rivers (0-50% level increase) */
  upstreamInflow: number
}

/**
 * Update water level for one day. Returns new state + flood stage.
 * Called by the weather system daily or weekly.
 */
export function updateWaterLevel(
  state: WaterLevelState,
  inputs: WaterInputs,
  bodyType: WaterBodyType,
): WaterLevelState {
  let level = state.level

  // Inflows
  const rainContribution = inputs.rainfall * 5  // each unit of rain = +5% level
  const snowmeltContribution = inputs.snowmelt * 8 // snowmelt is heavier
  const upstream = inputs.upstreamInflow

  level += rainContribution + snowmeltContribution + upstream

  // Natural recharge (springs, groundwater)
  level += state.rechargeRate

  // Outflows
  const evapLoss = state.drainageRate * inputs.evaporation
  level -= evapLoss

  // Rivers/streams drain toward normal faster when high
  if (bodyType === 'river' || bodyType === 'stream') {
    if (level > 120) {
      level -= (level - 120) * 0.1 // accelerated drainage when above normal
    }
  }

  // Clamp to 0-250 (catastrophic can go past 200 up to 250)
  level = Math.max(0, Math.min(250, level))

  const floodStage = getFloodStage(level)

  return {
    ...state,
    level: Math.round(level * 10) / 10,
    floodStage,
    seasonPeak: Math.max(state.seasonPeak, level),
  }
}

// ============================================================
// FLOOD DAMAGE — Effects on settlements
// ============================================================

export interface FloodDamage {
  floodStage: FloodStage
  /** Morale penalty */
  moralePenalty: number
  /** Fraction of crops destroyed */
  cropDamage: number
  /** Fraction of buildings damaged */
  buildingDamage: number
  /** Population displacement (fraction) */
  displacedPopulation: number
  /** Trade disrupted? */
  tradeDisrupted: boolean
  /** Navigation blocked? */
  navigationBlocked: boolean
  description: string
}

/**
 * Calculate flood damage for a settlement adjacent to a flooded water body.
 */
export function floodDamageToSettlement(stage: FloodStage): FloodDamage {
  switch (stage) {
    case 'drought':
      return {
        floodStage: stage,
        moralePenalty: -1, cropDamage: 0.3, buildingDamage: 0, displacedPopulation: 0,
        tradeDisrupted: false, navigationBlocked: true, // too shallow to navigate
        description: 'Drought: water too low for navigation, crops suffer',
      }
    case 'low':
      return {
        floodStage: stage,
        moralePenalty: 0, cropDamage: 0.1, buildingDamage: 0, displacedPopulation: 0,
        tradeDisrupted: false, navigationBlocked: false,
        description: 'Low water: minor crop stress',
      }
    case 'normal':
      return {
        floodStage: stage,
        moralePenalty: 0, cropDamage: 0, buildingDamage: 0, displacedPopulation: 0,
        tradeDisrupted: false, navigationBlocked: false,
        description: 'Normal water levels',
      }
    case 'watch':
      return {
        floodStage: stage,
        moralePenalty: -1, cropDamage: 0, buildingDamage: 0, displacedPopulation: 0,
        tradeDisrupted: false, navigationBlocked: false,
        description: 'Flood watch: rising waters, preparations underway',
      }
    case 'warning':
      return {
        floodStage: stage,
        moralePenalty: -2, cropDamage: 0.15, buildingDamage: 0.05, displacedPopulation: 0.05,
        tradeDisrupted: true, navigationBlocked: false,
        description: 'Flood warning: lowland fields submerged, some buildings threatened',
      }
    case 'flood':
      return {
        floodStage: stage,
        moralePenalty: -4, cropDamage: 0.5, buildingDamage: 0.15, displacedPopulation: 0.2,
        tradeDisrupted: true, navigationBlocked: true,
        description: 'Flooding: major crop loss, buildings damaged, people displaced',
      }
    case 'catastrophic':
      return {
        floodStage: stage,
        moralePenalty: -6, cropDamage: 0.8, buildingDamage: 0.4, displacedPopulation: 0.5,
        tradeDisrupted: true, navigationBlocked: true,
        description: 'Catastrophic flood: devastation, mass displacement, infrastructure destroyed',
      }
  }
}
