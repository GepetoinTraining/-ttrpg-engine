/**
 * LOGISTICS — Moving Things Between .tp Nodes
 * ==============================================
 * 
 * RULE: Nothing teleports for free. Moving costs time, money, and risk.
 * 
 * A SHIPMENT is an MF loop:
 *   - Created when someone sends goods from A → B
 *   - Ticks forward each world-day based on transport speed
 *   - Arrives after distance/speed days
 *   - Risk events can occur during transit (hazards, bandits)
 *   - Cargo physically leaves source container, arrives at destination
 * 
 * Transport modes from the old engine, distilled:
 *   porter → pack_animal → cart → wagon → caravan (land)
 *   rowboat → sailing_boat → cog → galleon → barge (sea/river)
 *   teleportation (magic, instant, expensive)
 */

import { z } from 'zod'
import type { Container, Item, Currency } from './inventory'

// ============================================================
// TRANSPORT MODES
// ============================================================

export const TransportModeSchema = z.enum([
  // Land (slowest → fastest capacity trade-off)
  'porter',        // Human carrying
  'pack_animal',   // Mules, donkeys
  'cart',          // Horse-drawn, needs road
  'wagon',         // Heavy, needs road
  'caravan',       // Multiple wagons, safest land

  // Sea / River
  'rowboat',       // Small, coastal
  'sailing_boat',  // Small sailing vessel
  'cog',           // Merchant ship
  'galleon',       // Large merchant
  'barge',         // River only

  // Magic
  'teleportation', // Instant, expensive, weight-limited
])
export type TransportMode = z.infer<typeof TransportModeSchema>

export interface TransportSpec {
  category: 'land' | 'sea' | 'river' | 'magic'
  capacityLbs: number
  milesPerDay: number
  requiresRoad: boolean
  requiresPort: boolean
  crewRequired: number
  costPerMile: number    // GP per mile
  riskModifier: number   // multiplier on hazard chance
}

export const TRANSPORT_SPECS: Record<TransportMode, TransportSpec> = {
  // Land
  porter:       { category: 'land', capacityLbs: 50,     milesPerDay: 15,  requiresRoad: false, requiresPort: false, crewRequired: 1,  costPerMile: 0.01,  riskModifier: 1.5 },
  pack_animal:  { category: 'land', capacityLbs: 200,    milesPerDay: 20,  requiresRoad: false, requiresPort: false, crewRequired: 1,  costPerMile: 0.02,  riskModifier: 1.2 },
  cart:         { category: 'land', capacityLbs: 500,    milesPerDay: 20,  requiresRoad: true,  requiresPort: false, crewRequired: 1,  costPerMile: 0.03,  riskModifier: 1.0 },
  wagon:        { category: 'land', capacityLbs: 2000,   milesPerDay: 15,  requiresRoad: true,  requiresPort: false, crewRequired: 2,  costPerMile: 0.05,  riskModifier: 0.9 },
  caravan:      { category: 'land', capacityLbs: 10000,  milesPerDay: 12,  requiresRoad: true,  requiresPort: false, crewRequired: 10, costPerMile: 0.10,  riskModifier: 0.6 },
  // Sea
  rowboat:      { category: 'sea',   capacityLbs: 500,    milesPerDay: 20,  requiresRoad: false, requiresPort: false, crewRequired: 2,  costPerMile: 0.02,  riskModifier: 1.5 },
  sailing_boat: { category: 'sea',   capacityLbs: 2000,   milesPerDay: 40,  requiresRoad: false, requiresPort: true,  crewRequired: 4,  costPerMile: 0.03,  riskModifier: 1.2 },
  cog:          { category: 'sea',   capacityLbs: 50000,  milesPerDay: 60,  requiresRoad: false, requiresPort: true,  crewRequired: 15, costPerMile: 0.02,  riskModifier: 0.8 },
  galleon:      { category: 'sea',   capacityLbs: 200000, milesPerDay: 80,  requiresRoad: false, requiresPort: true,  crewRequired: 50, costPerMile: 0.015, riskModifier: 0.5 },
  barge:        { category: 'river', capacityLbs: 100000, milesPerDay: 30,  requiresRoad: false, requiresPort: true,  crewRequired: 8,  costPerMile: 0.01,  riskModifier: 0.7 },
  // Magic
  teleportation: { category: 'magic', capacityLbs: 500,  milesPerDay: 99999, requiresRoad: false, requiresPort: false, crewRequired: 1, costPerMile: 10, riskModifier: 0.1 },
}

// ============================================================
// ROUTE DANGER LEVELS
// ============================================================

export const DangerLevelSchema = z.enum(['safe', 'patrolled', 'risky', 'dangerous', 'deadly'])
export type DangerLevel = z.infer<typeof DangerLevelSchema>

const HAZARD_CHANCE_PER_DAY: Record<DangerLevel, number> = {
  safe:       0.01,
  patrolled:  0.05,
  risky:      0.15,
  dangerous:  0.30,
  deadly:     0.50,
}

// ============================================================
// SHIPMENT — The MF loop for moving goods
// ============================================================

export const ShipmentStatusSchema = z.enum([
  'loading',    // At origin, being packed
  'in_transit', // On the road/sea
  'arrived',    // At destination, ready for unload
  'delivered',  // Unloaded into destination container
  'lost',       // Destroyed/captured in transit
])
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>

export const ShipmentSchema = z.object({
  id: z.string(),

  // Route
  originNodeId: z.string(),
  destinationNodeId: z.string(),
  distanceMiles: z.number().nonnegative(),
  dangerLevel: DangerLevelSchema,

  // Transport
  transportMode: TransportModeSchema,

  // Cargo manifest (item IDs + quantities removed from source)
  manifest: z.array(z.object({
    itemId: z.string(),
    name: z.string(),
    quantity: z.number().int().nonnegative(),
    weightLbs: z.number().nonnegative(),
    valueGP: z.number().nonnegative(),
  })).default([]),
  /** Currency being transported */
  currency: z.object({
    copper: z.number().int().nonnegative().default(0),
    silver: z.number().int().nonnegative().default(0),
    electrum: z.number().int().nonnegative().default(0),
    gold: z.number().int().nonnegative().default(0),
    platinum: z.number().int().nonnegative().default(0),
  }).default({ copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 }),
  totalWeightLbs: z.number().nonnegative(),

  // Progress
  status: ShipmentStatusSchema.default('loading'),
  progressMiles: z.number().nonnegative().default(0),
  departedDay: z.number().int().optional(),
  estimatedArrivalDay: z.number().int().optional(),

  // Cost
  totalCostGP: z.number().nonnegative().default(0),
  crewWagesPerDay: z.number().nonnegative().default(0),

  // Events during transit
  events: z.array(z.object({
    worldDay: z.number().int(),
    type: z.string(),
    description: z.string(),
    cargoLostPercent: z.number().min(0).max(1).default(0),
  })).default([]),

  // Owner
  ownerId: z.string(),
  sourceContainerId: z.string(),
  destinationContainerId: z.string(),
})
export type Shipment = z.infer<typeof ShipmentSchema>

// ============================================================
// COST CALCULATION
// ============================================================

/**
 * Calculate total cost for a shipment.
 */
export function calculateShipmentCost(
  distanceMiles: number,
  weightLbs: number,
  mode: TransportMode,
  dangerLevel: DangerLevel,
): { baseCost: number; riskPremium: number; crewCost: number; total: number; travelDays: number } {
  const spec = TRANSPORT_SPECS[mode]

  const travelDays = Math.ceil(distanceMiles / spec.milesPerDay)

  // Base transport cost
  const baseCost = distanceMiles * spec.costPerMile * Math.ceil(weightLbs / spec.capacityLbs)

  // Risk premium (danger increases price)
  const riskMultiplier: Record<DangerLevel, number> = {
    safe: 1.0, patrolled: 1.1, risky: 1.3, dangerous: 1.6, deadly: 2.5,
  }
  const riskPremium = baseCost * (riskMultiplier[dangerLevel] - 1)

  // Crew wages
  const crewCost = spec.crewRequired * 1 * travelDays // 1 GP/day per crew

  const total = baseCost + riskPremium + crewCost

  return { baseCost, riskPremium, crewCost, total, travelDays }
}

// ============================================================
// SHIPMENT TICK — Advance one world-day
// ============================================================

export interface ShipmentTickResult {
  arrived: boolean
  lost: boolean
  events: Shipment['events']
  progressMiles: number
}

/**
 * Tick a shipment forward by one world-day.
 * Uses d20 seed for deterministic hazard generation.
 */
export function tickShipment(
  shipment: Shipment,
  worldDay: number,
  d20Seed: number,  // from the dice pool — deterministic hazards
): ShipmentTickResult {
  const spec = TRANSPORT_SPECS[shipment.transportMode]
  const events: Shipment['events'] = []
  let lost = false

  // Move forward
  const milesThisDay = spec.milesPerDay
  let newProgress = shipment.progressMiles + milesThisDay

  // Check for hazards (d20 seed determines outcome)
  const hazardThreshold = HAZARD_CHANCE_PER_DAY[shipment.dangerLevel] * spec.riskModifier
  // Use d20 normalized: 1-20 → 0.05 to 1.0
  const hazardRoll = d20Seed / 20

  if (hazardRoll <= hazardThreshold) {
    // Hazard occurred! Severity based on d20
    if (d20Seed <= 3) {
      // Critical hazard — major loss
      events.push({
        worldDay,
        type: 'critical_hazard',
        description: 'Devastating attack — significant cargo lost',
        cargoLostPercent: 0.3,
      })
    } else if (d20Seed <= 7) {
      // Severe hazard — some loss
      events.push({
        worldDay,
        type: 'severe_hazard',
        description: 'Bandit attack — some cargo damaged',
        cargoLostPercent: 0.1,
      })
    } else if (d20Seed <= 12) {
      // Moderate hazard — delay
      events.push({
        worldDay,
        type: 'delay',
        description: 'Weather or terrain caused delay',
        cargoLostPercent: 0,
      })
      newProgress -= milesThisDay * 0.5 // Half day lost
    } else {
      // Minor — no real impact
      events.push({
        worldDay,
        type: 'minor_incident',
        description: 'Minor obstacle encountered, handled',
        cargoLostPercent: 0,
      })
    }

    // If total loss exceeds threshold, shipment is lost
    const totalLoss = events.reduce((sum, e) => sum + e.cargoLostPercent, 0)
    if (totalLoss >= 1.0) {
      lost = true
    }
  }

  // Check if arrived
  const arrived = newProgress >= shipment.distanceMiles

  return {
    arrived,
    lost,
    events,
    progressMiles: Math.min(newProgress, shipment.distanceMiles),
  }
}

// ============================================================
// SHIPMENT FACTORY
// ============================================================

let _shipmentId = 0
export function resetShipmentIdCounter(): void { _shipmentId = 0 }

/**
 * Create a new shipment.
 */
export function createShipment(
  originNodeId: string,
  destinationNodeId: string,
  distanceMiles: number,
  dangerLevel: DangerLevel,
  transportMode: TransportMode,
  ownerId: string,
  sourceContainerId: string,
  destinationContainerId: string,
): Shipment {
  const id = `shipment_${++_shipmentId}`
  const cost = calculateShipmentCost(distanceMiles, 0, transportMode, dangerLevel)

  return {
    id,
    originNodeId,
    destinationNodeId,
    distanceMiles,
    dangerLevel,
    transportMode,
    manifest: [],
    currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
    totalWeightLbs: 0,
    status: 'loading',
    progressMiles: 0,
    totalCostGP: cost.total,
    crewWagesPerDay: TRANSPORT_SPECS[transportMode].crewRequired * 1,
    events: [],
    ownerId,
    sourceContainerId,
    destinationContainerId,
  }
}

/**
 * Add an item to a shipment's manifest (before departure).
 * Returns false if it would exceed transport capacity.
 */
export function addToManifest(
  shipment: Shipment,
  itemId: string,
  name: string,
  quantity: number,
  weightLbs: number,
  valueGP: number,
): boolean {
  const spec = TRANSPORT_SPECS[shipment.transportMode]
  const newWeight = shipment.totalWeightLbs + weightLbs

  if (newWeight > spec.capacityLbs) {
    return false
  }

  shipment.manifest.push({ itemId, name, quantity, weightLbs, valueGP })
  shipment.totalWeightLbs = newWeight

  // Recalculate cost based on actual weight
  const cost = calculateShipmentCost(
    shipment.distanceMiles, shipment.totalWeightLbs,
    shipment.transportMode, shipment.dangerLevel,
  )
  shipment.totalCostGP = cost.total

  return true
}

/**
 * Dispatch shipment (change status from loading → in_transit).
 */
export function dispatchShipment(shipment: Shipment, worldDay: number): void {
  shipment.status = 'in_transit'
  shipment.departedDay = worldDay
  const spec = TRANSPORT_SPECS[shipment.transportMode]
  const travelDays = Math.ceil(shipment.distanceMiles / spec.milesPerDay)
  shipment.estimatedArrivalDay = worldDay + travelDays
}

/**
 * Best transport mode for a given weight and infrastructure.
 */
export function recommendTransport(
  weightLbs: number,
  hasRoad: boolean,
  hasPort: boolean,
  hasRiver: boolean,
): TransportMode {
  // Filter by infrastructure
  const available = Object.entries(TRANSPORT_SPECS).filter(([_, spec]) => {
    if (spec.requiresRoad && !hasRoad) return false
    if (spec.requiresPort && !hasPort) return false
    if (spec.category === 'river' && !hasRiver) return false
    if (spec.category === 'magic') return false // never auto-recommend magic
    return spec.capacityLbs >= weightLbs
  })

  if (available.length === 0) {
    // Nothing can carry it — use multiple trips with best available
    return hasRoad ? 'wagon' : 'pack_animal'
  }

  // Pick cheapest that fits
  available.sort(([, a], [, b]) => a.costPerMile - b.costPerMile)
  return available[0][0] as TransportMode
}
