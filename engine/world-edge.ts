/**
 * WORLD EDGE — Routes Between Hubs
 * ====================================
 * 
 * Hubs are nodes. Edges are the ROADS between them.
 * 
 * An edge has:
 *   - Physical distance (miles, already known for Toril)
 *   - Terrain type (affects speed, risk, transport compatibility)
 *   - Road condition (none → paved, affects what can traverse)
 *   - Ownership segments (who controls what portion)
 *   - Points of interest discovered along the way
 *   - Resources found along the edge (procedurally revealed)
 * 
 * TRAVERSAL: When a party moves along an edge, the system:
 *   1. Calculates travel time from distance + terrain + mode
 *   2. Ticks each day of travel
 *   3. Procedurally generates what they discover (fog of war lift)
 *   4. Checks encounters per ownership segment
 * 
 * LAND ACQUISITION: Edges can be claimed segment-by-segment.
 *   A faction controls a segment → they can:
 *   - Build infrastructure (upgrade road condition)
 *   - Tax travelers (toll)
 *   - Extract resources discovered along the edge
 *   - Patrol it (changes danger level)
 * 
 * FAST TRAVEL: Teleportation circles, portals, or well-known
 *   routes that skip traversal (unlocked after first manual traverse).
 */

import { z } from 'zod'
import type { DepositType, DepositQuality } from './production-chain.js'

// ============================================================
// TERRAIN — What the land IS
// ============================================================

export const TerrainTypeSchema = z.enum([
  'plains',       // Open, flat — fastest land travel
  'forest',       // Wooded — slower, resources
  'hills',        // Rolling — moderate, mining potential
  'mountains',    // Hard terrain — slow, rich deposits
  'swamp',        // Wetland — very slow, dangerous
  'desert',       // Arid — moderate, water scarce
  'tundra',       // Frozen — slow, harsh
  'jungle',       // Dense — very slow, exotic resources
  'coastal',      // Shoreline — sea access, fishing
  'river_valley', // Along a river — barge access, fertile
  'underground',  // Underdark passage — dangerous, gems
])
export type TerrainType = z.infer<typeof TerrainTypeSchema>

/** Speed multiplier for terrain (1.0 = normal) */
export const TERRAIN_SPEED_MOD: Record<TerrainType, number> = {
  plains:       1.0,
  forest:       0.7,
  hills:        0.6,
  mountains:    0.4,
  swamp:        0.3,
  desert:       0.6,
  tundra:       0.5,
  jungle:       0.25,
  coastal:      0.9,
  river_valley: 0.85,
  underground:  0.3,
}

/** What resources tend to appear in each terrain */
export const TERRAIN_RESOURCE_TABLE: Record<TerrainType, string[]> = {
  plains:       ['grain', 'horses', 'herbs'],
  forest:       ['timber', 'herbs', 'leather', 'game'],
  hills:        ['stone', 'iron_ore', 'copper_ore', 'herbs'],
  mountains:    ['iron_ore', 'gold_ore', 'stone', 'coal'],
  swamp:        ['herbs', 'peat', 'fish'],
  desert:       ['salt', 'spices', 'stone'],
  tundra:       ['leather', 'fish', 'salt'],
  jungle:       ['herbs', 'spices', 'timber', 'exotic'],
  coastal:      ['fish', 'salt', 'timber'],
  river_valley: ['grain', 'fish', 'timber', 'clay'],
  underground:  ['iron_ore', 'gold_ore', 'coal', 'magic_components'],
}

// ============================================================
// ROAD CONDITION — What's been built on the terrain
// ============================================================

export const RoadConditionSchema = z.enum([
  'none',        // Wilderness — only foot/mount
  'trail',       // Beaten path — pack animals OK
  'dirt_road',   // Basic — carts OK, slow
  'road',        // Maintained — wagons OK
  'paved',       // Imperial highway — full speed
])
export type RoadCondition = z.infer<typeof RoadConditionSchema>

/** Speed multiplier for road condition */
export const ROAD_SPEED_MOD: Record<RoadCondition, number> = {
  none:      0.5,
  trail:     0.7,
  dirt_road: 0.85,
  road:      1.0,
  paved:     1.2,
}

/** What transport modes require what minimum road */
export const ROAD_REQUIREMENTS: Record<string, RoadCondition> = {
  porter:       'none',
  pack_animal:  'none',
  cart:         'dirt_road',
  wagon:        'road',
  caravan:      'road',
}

/** Cost to upgrade road (GP per mile) */
export const ROAD_UPGRADE_COST: Record<RoadCondition, number> = {
  none:      0,
  trail:     5,       // clear brush
  dirt_road: 20,      // level and pack
  road:      100,     // gravel, drainage
  paved:     500,     // stone blocks, engineering
}

// ============================================================
// OWNERSHIP SEGMENT — Who controls this stretch
// ============================================================

export const OwnershipSegmentSchema = z.object({
  /** Start mile along the edge (0 = source hub) */
  startMile: z.number().nonnegative(),
  /** End mile */
  endMile: z.number().nonnegative(),
  /** Who controls this segment */
  controllerId: z.string().nullable(),
  controllerName: z.string().default('Unclaimed'),
  /** Road condition in this segment */
  roadCondition: RoadConditionSchema.default('none'),
  /** Danger level in this segment */
  dangerLevel: z.enum(['safe', 'patrolled', 'risky', 'dangerous', 'deadly']).default('risky'),
  /** Toll to pass (GP per traveler) */
  toll: z.number().nonnegative().default(0),
  /** Is there a patrol / garrison? */
  patrolStrength: z.number().int().nonnegative().default(0),
})
export type OwnershipSegment = z.infer<typeof OwnershipSegmentSchema>

// ============================================================
// DISCOVERED SITE — Resource or POI found along an edge
// ============================================================

export const DiscoveredSiteSchema = z.object({
  id: z.string(),
  /** Mile marker along the edge where this was found */
  mileMarker: z.number().nonnegative(),
  /** What kind of site */
  siteType: z.enum([
    'resource_deposit',  // Mineable/farmable resource
    'ruin',              // Explorable dungeon/ruin
    'camp_site',         // Safe rest spot
    'landmark',          // Navigation aid, lore
    'settlement_seed',   // Could become a hamlet/outpost
    'monster_lair',      // Danger
    'shrine',            // Divine presence
    'crossing',          // River ford, mountain pass
  ]),
  name: z.string(),
  /** Resource info (if resource_deposit) */
  depositType: z.string().optional(),
  depositCommodity: z.string().optional(),
  depositQuality: z.string().optional(),
  /** Has this been fully explored? */
  explored: z.boolean().default(false),
  /** Who discovered it */
  discoveredBy: z.string().optional(),
  discoveredOnDay: z.number().int().optional(),
})
export type DiscoveredSite = z.infer<typeof DiscoveredSiteSchema>

// ============================================================
// WORLD EDGE — The full route between two hubs
// ============================================================

export const WorldEdgeSchema = z.object({
  id: z.string(),
  /** Source hub node ID */
  sourceNodeId: z.string(),
  sourceName: z.string(),
  /** Destination hub node ID */
  targetNodeId: z.string(),
  targetName: z.string(),
  /** Total distance in miles */
  distanceMiles: z.number().nonnegative(),
  /** Dominant terrain */
  terrain: TerrainTypeSchema,
  /** Ownership segments (cover the full distance) */
  segments: z.array(OwnershipSegmentSchema).min(1),
  /** Sites discovered along this edge */
  discoveredSites: z.array(DiscoveredSiteSchema).default([]),
  /** Has this edge been traversed at least once? */
  traversed: z.boolean().default(false),
  /** How much of the edge has been explored (0-1) */
  exploredFraction: z.number().min(0).max(1).default(0),

  // Fast travel
  /** Is fast travel available on this route? */
  fastTravelUnlocked: z.boolean().default(false),
  /** Type of fast travel if available */
  fastTravelType: z.enum(['none', 'teleportation_circle', 'portal', 'known_route']).default('none'),
  /** Fast travel cost (GP per person) */
  fastTravelCost: z.number().nonnegative().default(0),

  /** Bidirectional (most roads are) */
  bidirectional: z.boolean().default(true),
})
export type WorldEdge = z.infer<typeof WorldEdgeSchema>

// ============================================================
// TRAVERSAL — Moving along an edge
// ============================================================

export interface TraversalState {
  edgeId: string
  /** Current mile position along the edge */
  currentMile: number
  /** Direction: source→target or target→source */
  direction: 'forward' | 'reverse'
  /** World day when traversal started */
  startDay: number
  /** Current world day */
  currentDay: number
  /** Miles traveled per day (after terrain + road + mode) */
  effectiveSpeed: number
  /** Discovery rolls accumulated */
  sitesFound: DiscoveredSite[]
  /** Segment the party is currently in */
  currentSegmentIndex: number
  /** Has the traversal completed? */
  completed: boolean
}

/**
 * Calculate effective travel speed along an edge.
 * Base speed × terrain modifier × road modifier.
 */
export function calculateTravelSpeed(
  baseMilesPerDay: number,
  terrain: TerrainType,
  roadCondition: RoadCondition,
): number {
  return Math.floor(baseMilesPerDay * TERRAIN_SPEED_MOD[terrain] * ROAD_SPEED_MOD[roadCondition])
}

/**
 * Calculate total travel time for an edge.
 */
export function estimateTravelDays(
  distanceMiles: number,
  baseMilesPerDay: number,
  terrain: TerrainType,
  roadCondition: RoadCondition,
): number {
  const speed = calculateTravelSpeed(baseMilesPerDay, terrain, roadCondition)
  if (speed <= 0) return Infinity
  return Math.ceil(distanceMiles / speed)
}

/**
 * Get the ownership segment at a given mile.
 */
export function getSegmentAtMile(edge: WorldEdge, mile: number): OwnershipSegment | undefined {
  return edge.segments.find(s => mile >= s.startMile && mile < s.endMile)
}

/**
 * Start a traversal along an edge.
 */
export function beginTraversal(
  edge: WorldEdge,
  baseMilesPerDay: number,
  startDay: number,
  direction: 'forward' | 'reverse' = 'forward',
): TraversalState {
  const startSeg = direction === 'forward' ? edge.segments[0] : edge.segments[edge.segments.length - 1]
  const speed = calculateTravelSpeed(baseMilesPerDay, edge.terrain, startSeg.roadCondition)

  return {
    edgeId: edge.id,
    currentMile: direction === 'forward' ? 0 : edge.distanceMiles,
    direction,
    startDay,
    currentDay: startDay,
    effectiveSpeed: speed,
    sitesFound: [],
    currentSegmentIndex: direction === 'forward' ? 0 : edge.segments.length - 1,
    completed: false,
  }
}

// ============================================================
// TRAVERSAL TICK — One day of travel
// ============================================================

export interface TraversalTickResult {
  /** Miles traveled this day */
  milesTraveled: number
  /** New mile position */
  newMile: number
  /** Did we enter a new ownership segment? */
  segmentChanged: boolean
  /** New segment info (if changed) */
  newSegment?: OwnershipSegment
  /** Sites discovered this day */
  discoveries: DiscoveredSite[]
  /** Has the traversal completed? */
  arrived: boolean
  /** Toll paid this day (if entering controlled segment) */
  tollPaid: number
}

/**
 * Tick one day of traversal.
 * d20Seed drives the discovery gate (should something appear?).
 * typeD20 drives the type table (what appears?).
 * Two rolls prevents the gate from filtering out site types.
 */
export function tickTraversal(
  state: TraversalState,
  edge: WorldEdge,
  d20Seed: number,
  typeD20: number = 10,
): TraversalTickResult {
  if (state.completed) {
    return { milesTraveled: 0, newMile: state.currentMile, segmentChanged: false, discoveries: [], arrived: true, tollPaid: 0 }
  }

  // Get current segment road condition for speed
  const segment = edge.segments[state.currentSegmentIndex]
  const speed = calculateTravelSpeed(
    state.effectiveSpeed / (TERRAIN_SPEED_MOD[edge.terrain] * ROAD_SPEED_MOD[segment?.roadCondition ?? 'none']),
    edge.terrain,
    segment?.roadCondition ?? 'none',
  )

  // Move
  const delta = state.direction === 'forward' ? speed : -speed
  const newMile = Math.max(0, Math.min(edge.distanceMiles, state.currentMile + delta))
  const milesTraveled = Math.abs(newMile - state.currentMile)

  // Check for segment change
  let segmentChanged = false
  let newSegment: OwnershipSegment | undefined
  let tollPaid = 0

  const newSegObj = getSegmentAtMile(edge, newMile)
  if (newSegObj && segment && (newSegObj.startMile !== segment.startMile)) {
    segmentChanged = true
    newSegment = newSegObj
    tollPaid = newSegObj.toll
    state.currentSegmentIndex = edge.segments.indexOf(newSegObj)
  }

  // Discovery roll — d20Seed gates, typeD20 determines what
  const discoveries: DiscoveredSite[] = []
  const discoveryChance = 0.15 // 15% per day of travel to find something
  const discoveryRoll = d20Seed / 20

  if (discoveryRoll <= discoveryChance && d20Seed > 0) {
    const site = generateDiscovery(edge, newMile, typeD20, state.currentDay)
    if (site) {
      discoveries.push(site)
      state.sitesFound.push(site)
    }
  }

  // Check arrival
  const arrived = state.direction === 'forward'
    ? newMile >= edge.distanceMiles
    : newMile <= 0

  // Update state
  state.currentMile = newMile
  state.currentDay++
  state.completed = arrived

  // Update explored fraction
  const exploredMiles = Math.abs(state.currentMile - (state.direction === 'forward' ? 0 : edge.distanceMiles))
  edge.exploredFraction = Math.max(edge.exploredFraction, exploredMiles / edge.distanceMiles)
  if (arrived) {
    edge.traversed = true
    edge.exploredFraction = 1.0
  }

  return {
    milesTraveled,
    newMile,
    segmentChanged,
    newSegment,
    discoveries,
    arrived,
    tollPaid,
  }
}

// ============================================================
// PROCEDURAL DISCOVERY — Build the map as they travel
// ============================================================

let _siteId = 0
export function resetSiteIdCounter(): void { _siteId = 0 }

function generateDiscovery(
  edge: WorldEdge,
  mileMarker: number,
  typeD20: number,
  worldDay: number,
): DiscoveredSite | null {
  // Don't generate if something already exists within 5 miles
  const tooClose = edge.discoveredSites.some(
    s => Math.abs(s.mileMarker - mileMarker) < 5,
  )
  if (tooClose) return null

  const id = `site_${++_siteId}`
  const resources = TERRAIN_RESOURCE_TABLE[edge.terrain]

  // typeD20 determines site type (independent of gate roll)
  let site: DiscoveredSite

  if (typeD20 <= 3) {
    // Resource deposit (rich)
    const commodity = resources[typeD20 % resources.length]
    site = {
      id, mileMarker, siteType: 'resource_deposit',
      name: `Rich ${commodity} deposit`,
      depositType: edge.terrain === 'mountains' ? 'deep' : 'surface',
      depositCommodity: commodity,
      depositQuality: 'rich',
      explored: false, discoveredOnDay: worldDay,
    }
  } else if (typeD20 <= 6) {
    // Resource deposit (standard)
    const commodity = resources[typeD20 % resources.length]
    site = {
      id, mileMarker, siteType: 'resource_deposit',
      name: `${commodity} source`,
      depositType: edge.terrain === 'hills' ? 'shallow' : 'surface',
      depositCommodity: commodity,
      depositQuality: 'standard',
      explored: false, discoveredOnDay: worldDay,
    }
  } else if (typeD20 <= 8) {
    site = { id, mileMarker, siteType: 'ruin', name: 'Ancient Ruin', explored: false, discoveredOnDay: worldDay }
  } else if (typeD20 <= 10) {
    site = { id, mileMarker, siteType: 'monster_lair', name: 'Monster Lair', explored: false, discoveredOnDay: worldDay }
  } else if (typeD20 <= 12) {
    site = { id, mileMarker, siteType: 'camp_site', name: 'Sheltered Camp', explored: false, discoveredOnDay: worldDay }
  } else if (typeD20 <= 14) {
    site = { id, mileMarker, siteType: 'crossing', name: 'Natural Crossing', explored: false, discoveredOnDay: worldDay }
  } else if (typeD20 <= 16) {
    site = { id, mileMarker, siteType: 'landmark', name: 'Notable Landmark', explored: false, discoveredOnDay: worldDay }
  } else if (typeD20 <= 18) {
    site = { id, mileMarker, siteType: 'shrine', name: 'Roadside Shrine', explored: false, discoveredOnDay: worldDay }
  } else {
    site = { id, mileMarker, siteType: 'settlement_seed', name: 'Promising Location', explored: false, discoveredOnDay: worldDay }
  }

  edge.discoveredSites.push(site)
  return site
}

// ============================================================
// LAND ACQUISITION — Claiming segments
// ============================================================

/**
 * Claim a segment of an edge for a faction/player.
 * Splits existing segments if needed.
 */
export function claimSegment(
  edge: WorldEdge,
  startMile: number,
  endMile: number,
  controllerId: string,
  controllerName: string,
): void {
  const newSegments: OwnershipSegment[] = []

  for (const seg of edge.segments) {
    // Segment entirely before claim
    if (seg.endMile <= startMile) {
      newSegments.push(seg)
      continue
    }
    // Segment entirely after claim
    if (seg.startMile >= endMile) {
      newSegments.push(seg)
      continue
    }
    // Segment overlaps claim — split it

    // Part before claim
    if (seg.startMile < startMile) {
      newSegments.push({ ...seg, endMile: startMile })
    }

    // The claimed part
    newSegments.push({
      startMile: Math.max(seg.startMile, startMile),
      endMile: Math.min(seg.endMile, endMile),
      controllerId,
      controllerName,
      roadCondition: seg.roadCondition,
      dangerLevel: seg.dangerLevel,
      toll: 0,
      patrolStrength: 0,
    })

    // Part after claim
    if (seg.endMile > endMile) {
      newSegments.push({ ...seg, startMile: endMile })
    }
  }

  // Merge adjacent segments with same controller
  edge.segments = mergeAdjacentSegments(newSegments)
}

/**
 * Upgrade road condition in a segment.
 * Returns cost in GP.
 */
export function upgradeRoad(
  edge: WorldEdge,
  segmentIndex: number,
  targetCondition: RoadCondition,
): number {
  const seg = edge.segments[segmentIndex]
  if (!seg) return 0

  const conditions: RoadCondition[] = ['none', 'trail', 'dirt_road', 'road', 'paved']
  const currentIdx = conditions.indexOf(seg.roadCondition)
  const targetIdx = conditions.indexOf(targetCondition)

  if (targetIdx <= currentIdx) return 0 // already at or above target

  // Cost is for each step of upgrade × miles
  let totalCost = 0
  for (let i = currentIdx + 1; i <= targetIdx; i++) {
    totalCost += ROAD_UPGRADE_COST[conditions[i]] * (seg.endMile - seg.startMile)
  }

  seg.roadCondition = targetCondition
  return totalCost
}

/**
 * Set patrol level on a segment.
 * More patrols = lower danger level.
 */
export function setPatrol(
  segment: OwnershipSegment,
  soldiers: number,
  milesPatrolled: number,
): void {
  segment.patrolStrength = soldiers
  const density = soldiers / Math.max(milesPatrolled, 1)

  if (density >= 2)       segment.dangerLevel = 'safe'
  else if (density >= 1)  segment.dangerLevel = 'patrolled'
  else if (density >= 0.5) segment.dangerLevel = 'risky'
  else if (density >= 0.1) segment.dangerLevel = 'dangerous'
  else                     segment.dangerLevel = 'deadly'
}

// ============================================================
// FAST TRAVEL — Skip traversal
// ============================================================

/**
 * Unlock fast travel on a fully traversed edge.
 */
export function unlockFastTravel(
  edge: WorldEdge,
  type: 'teleportation_circle' | 'portal' | 'known_route',
  costPerPerson: number,
): boolean {
  if (!edge.traversed) return false
  edge.fastTravelUnlocked = true
  edge.fastTravelType = type
  edge.fastTravelCost = costPerPerson
  return true
}

// ============================================================
// EDGE FACTORY
// ============================================================

let _edgeId = 0
export function resetEdgeIdCounter(): void { _edgeId = 0 }

/**
 * Create a world edge between two hubs.
 */
export function createWorldEdge(
  sourceId: string,
  sourceName: string,
  targetId: string,
  targetName: string,
  distanceMiles: number,
  terrain: TerrainType,
  roadCondition: RoadCondition = 'none',
  controllerId: string | null = null,
  controllerName: string = 'Unclaimed',
): WorldEdge {
  return {
    id: `edge_${++_edgeId}`,
    sourceNodeId: sourceId,
    sourceName,
    targetNodeId: targetId,
    targetName,
    distanceMiles,
    terrain,
    segments: [{
      startMile: 0,
      endMile: distanceMiles,
      controllerId,
      controllerName,
      roadCondition,
      dangerLevel: controllerId ? 'patrolled' : 'risky',
      toll: 0,
      patrolStrength: 0,
    }],
    discoveredSites: [],
    traversed: false,
    exploredFraction: 0,
    fastTravelUnlocked: false,
    fastTravelType: 'none',
    fastTravelCost: 0,
    bidirectional: true,
  }
}

// ============================================================
// HELPERS
// ============================================================

function mergeAdjacentSegments(segments: OwnershipSegment[]): OwnershipSegment[] {
  if (segments.length <= 1) return segments

  const result: OwnershipSegment[] = [segments[0]]
  for (let i = 1; i < segments.length; i++) {
    const prev = result[result.length - 1]
    const curr = segments[i]
    if (prev.controllerId === curr.controllerId && prev.endMile === curr.startMile) {
      // Merge
      prev.endMile = curr.endMile
    } else {
      result.push(curr)
    }
  }
  return result
}
