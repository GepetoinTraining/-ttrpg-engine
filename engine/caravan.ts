/**
 * CARAVAN MM — Physical Trade on Edges
 * ========================================
 *
 * Caravans are the entities that ACTUALLY MOVE GOODS between hubs.
 * Without them, the economy computes phantom trade.
 *
 * A caravan:
 *   - Belongs to a merchant, faction, or guild
 *   - Traverses edges segment by segment
 *   - Carries cargo with weight limits
 *   - Subject to: danger levels, tolls, weather
 *   - Can be attacked, robbed, or delayed
 *   - Completes trade deliveries (production chain → real goods)
 *
 * TICK INTEGRATION:
 *   Daily (slot-based when observed): advance segments
 *   Weekly: idle caravans depart, completed caravans unload
 */

// ============================================================
// CARAVAN TYPES
// ============================================================

export type CaravanType = 'pack_mule' | 'wagon' | 'cart' | 'ship' | 'barge' | 'airship' | 'teleport_circle'

export interface CaravanProfile {
  type: CaravanType
  cargoCapacityLbs: number
  speedSegmentsPerDay: number
  dangerResistance: number    // Bonus to survive encounters
  costPerDay: number          // Operating cost in GP
  requiredCrew: number
}

export const CARAVAN_PROFILES: Record<CaravanType, CaravanProfile> = {
  pack_mule:       { type: 'pack_mule',       cargoCapacityLbs: 300,   speedSegmentsPerDay: 2, dangerResistance: 0,  costPerDay: 1,   requiredCrew: 1 },
  cart:            { type: 'cart',             cargoCapacityLbs: 800,   speedSegmentsPerDay: 2, dangerResistance: 0,  costPerDay: 2,   requiredCrew: 1 },
  wagon:           { type: 'wagon',            cargoCapacityLbs: 2000,  speedSegmentsPerDay: 1, dangerResistance: 2,  costPerDay: 5,   requiredCrew: 2 },
  barge:           { type: 'barge',            cargoCapacityLbs: 5000,  speedSegmentsPerDay: 2, dangerResistance: 1,  costPerDay: 8,   requiredCrew: 3 },
  ship:            { type: 'ship',             cargoCapacityLbs: 20000, speedSegmentsPerDay: 3, dangerResistance: 4,  costPerDay: 25,  requiredCrew: 10 },
  airship:         { type: 'airship',          cargoCapacityLbs: 5000,  speedSegmentsPerDay: 5, dangerResistance: 6,  costPerDay: 100, requiredCrew: 5 },
  teleport_circle: { type: 'teleport_circle',  cargoCapacityLbs: 500,   speedSegmentsPerDay: 99, dangerResistance: 10, costPerDay: 200, requiredCrew: 1 },
}

// ============================================================
// CARGO
// ============================================================

export interface CargoItem {
  commodityId: string
  quantity: number
  weightLbs: number
  valueTotalGp: number
  perishable: boolean
  daysSinceLoaded: number
}

// ============================================================
// CARAVAN STATE
// ============================================================

export type CaravanStatus = 'loading' | 'en_route' | 'resting' | 'under_attack' | 'arrived' | 'destroyed' | 'stranded'

export interface Caravan {
  id: string
  type: CaravanType
  ownerId: string
  ownerType: 'merchant' | 'guild' | 'faction' | 'player' | 'trading_company'
  originHubId: string
  destinationHubId: string
  edgeId: string            // Current edge being traversed
  currentSegment: number    // Which segment on the edge (0-based)
  totalSegments: number     // Total segments to traverse
  cargo: CargoItem[]
  totalWeightLbs: number
  guards: number            // Hired guards
  crew: number              // Drivers, porters, etc.
  status: CaravanStatus
  daysTraveled: number
  tollsPaid: number
  weatherSpeedModifier: number
}

export function createCaravan(
  type: CaravanType,
  ownerId: string,
  ownerType: Caravan['ownerType'],
  originHubId: string,
  destinationHubId: string,
  edgeId: string,
  totalSegments: number,
): Caravan {
  return {
    id: `caravan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type, ownerId, ownerType, originHubId, destinationHubId, edgeId,
    currentSegment: 0,
    totalSegments,
    cargo: [],
    totalWeightLbs: 0,
    guards: 0,
    crew: CARAVAN_PROFILES[type].requiredCrew,
    status: 'loading',
    daysTraveled: 0,
    tollsPaid: 0,
    weatherSpeedModifier: 1.0,
  }
}

// ============================================================
// LOADING CARGO
// ============================================================

export function loadCargo(caravan: Caravan, item: CargoItem): boolean {
  const capacity = CARAVAN_PROFILES[caravan.type].cargoCapacityLbs
  if (caravan.totalWeightLbs + item.weightLbs > capacity) return false

  caravan.cargo.push(item)
  caravan.totalWeightLbs += item.weightLbs
  return true
}

export function departCaravan(caravan: Caravan): void {
  if (caravan.status === 'loading' && caravan.cargo.length > 0) {
    caravan.status = 'en_route'
  }
}

// ============================================================
// DAILY ADVANCE — Move segments, pay tolls, check danger
// ============================================================

export interface CaravanDayResult {
  segmentsAdvanced: number
  tollPaid: number
  encounter: CaravanEncounter | null
  spoiledCargo: string[]
  arrived: boolean
  operatingCost: number
}

export interface CaravanEncounter {
  type: 'bandit_ambush' | 'monster_attack' | 'toll_dispute' | 'breakdown' | 'weather_delay'
  dangerLevel: number
  d20Roll: number
  survived: boolean
  cargoLostPercent: number
  guardsLost: number
  description: string
}

export function advanceCaravanDay(
  caravan: Caravan,
  segmentDangerLevel: number,   // 0-10 danger of current segment
  segmentToll: number,          // GP toll for this segment
  weatherSpeedMod: number,      // From weather engine
  d20Roll: number,              // Random encounter check
  spoilageMultiplier: number = 1.0, // From weather
): CaravanDayResult {
  const result: CaravanDayResult = {
    segmentsAdvanced: 0,
    tollPaid: 0,
    encounter: null,
    spoiledCargo: [],
    arrived: false,
    operatingCost: CARAVAN_PROFILES[caravan.type].costPerDay,
  }

  if (caravan.status !== 'en_route') return result

  caravan.daysTraveled++
  caravan.weatherSpeedModifier = weatherSpeedMod

  // Operating cost
  result.operatingCost += caravan.guards * 2  // Guards cost 2 GP/day

  // Toll
  if (segmentToll > 0) {
    result.tollPaid = segmentToll
    caravan.tollsPaid += segmentToll
  }

  // Encounter check: d20 ≤ danger level = encounter
  if (d20Roll <= segmentDangerLevel) {
    const encounter = resolveEncounter(caravan, segmentDangerLevel, d20Roll)
    result.encounter = encounter

    if (!encounter.survived) {
      caravan.status = 'destroyed'
      return result
    }

    if (encounter.cargoLostPercent > 0) {
      const lostCount = Math.ceil(caravan.cargo.length * encounter.cargoLostPercent)
      for (let i = 0; i < lostCount && caravan.cargo.length > 0; i++) {
        const removed = caravan.cargo.pop()!
        caravan.totalWeightLbs -= removed.weightLbs
      }
    }
    if (encounter.guardsLost > 0) {
      caravan.guards = Math.max(0, caravan.guards - encounter.guardsLost)
    }
  }

  // Advance segments
  const baseSpeed = CARAVAN_PROFILES[caravan.type].speedSegmentsPerDay
  const effectiveSpeed = Math.max(1, Math.floor(baseSpeed * weatherSpeedMod))
  caravan.currentSegment += effectiveSpeed
  result.segmentsAdvanced = effectiveSpeed

  // Check spoilage for perishable cargo
  for (const item of caravan.cargo) {
    item.daysSinceLoaded++
    if (item.perishable && item.daysSinceLoaded * spoilageMultiplier > 7) {
      result.spoiledCargo.push(item.commodityId)
    }
  }
  // Remove spoiled items
  if (result.spoiledCargo.length > 0) {
    caravan.cargo = caravan.cargo.filter(
      item => !item.perishable || item.daysSinceLoaded * spoilageMultiplier <= 7
    )
    caravan.totalWeightLbs = caravan.cargo.reduce((sum, item) => sum + item.weightLbs, 0)
  }

  // Arrival check
  if (caravan.currentSegment >= caravan.totalSegments) {
    caravan.status = 'arrived'
    result.arrived = true
  }

  return result
}

function resolveEncounter(
  caravan: Caravan,
  dangerLevel: number,
  d20Roll: number,
): CaravanEncounter {
  const profile = CARAVAN_PROFILES[caravan.type]
  const defenseRoll = caravan.guards * 2 + profile.dangerResistance

  // Encounter type based on d20 roll
  let type: CaravanEncounter['type']
  if (d20Roll <= 2) type = 'monster_attack'
  else if (d20Roll <= 5) type = 'bandit_ambush'
  else if (d20Roll <= 7) type = 'toll_dispute'
  else if (d20Roll <= 9) type = 'breakdown'
  else type = 'weather_delay'

  // Survive check: defense vs danger
  const survived = defenseRoll + 5 >= dangerLevel  // +5 base survival

  let cargoLostPercent = 0
  let guardsLost = 0

  if (type === 'monster_attack' || type === 'bandit_ambush') {
    if (!survived) {
      cargoLostPercent = 1.0  // Total loss
      guardsLost = caravan.guards
    } else {
      cargoLostPercent = Math.max(0, (dangerLevel - defenseRoll) * 0.05)
      guardsLost = dangerLevel > defenseRoll + 3 ? 1 : 0
    }
  } else if (type === 'breakdown') {
    // No cargo loss, just delay (handled by not advancing this day)
  } else if (type === 'toll_dispute') {
    // Extra toll or lose some cargo
    cargoLostPercent = 0.05
  }

  const descriptions: Record<CaravanEncounter['type'], string> = {
    bandit_ambush: survived ? 'Bandits attacked but were driven off.' : 'Bandits overwhelmed the caravan!',
    monster_attack: survived ? 'Monsters from the wilds attacked — guards held.' : 'Monsters destroyed the caravan!',
    toll_dispute: 'A local lord demanded additional tolls.',
    breakdown: 'A wheel broke — repairs delayed travel.',
    weather_delay: 'Severe weather forced a halt.',
  }

  return {
    type,
    dangerLevel,
    d20Roll,
    survived,
    cargoLostPercent,
    guardsLost,
    description: descriptions[type],
  }
}

// ============================================================
// ARRIVAL — Unload cargo into destination hub
// ============================================================

export interface UnloadResult {
  deliveredItems: { commodityId: string; quantity: number; valueGp: number }[]
  totalValueGp: number
  profitGp: number
  tripDays: number
  totalCost: number
}

export function unloadCaravan(
  caravan: Caravan,
  tripOperatingCost: number,
): UnloadResult {
  const items = caravan.cargo.map(c => ({
    commodityId: c.commodityId,
    quantity: c.quantity,
    valueGp: c.valueTotalGp,
  }))
  const totalValue = items.reduce((sum, i) => sum + i.valueGp, 0)
  const totalCost = tripOperatingCost + caravan.tollsPaid

  return {
    deliveredItems: items,
    totalValueGp: totalValue,
    profitGp: totalValue - totalCost,
    tripDays: caravan.daysTraveled,
    totalCost,
  }
}
