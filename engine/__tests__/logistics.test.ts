/**
 * LOGISTICS TESTS — Moving Things Between Nodes
 * =================================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TRANSPORT_SPECS,
  calculateShipmentCost,
  createShipment, addToManifest, dispatchShipment,
  tickShipment, recommendTransport,
  resetShipmentIdCounter,
  type TransportMode, type DangerLevel,
} from '../logistics'

beforeEach(() => resetShipmentIdCounter())

// ============================================================
// TRANSPORT SPECS
// ============================================================

describe('Transport Specs', () => {
  it('porter is slowest land mode', () => {
    expect(TRANSPORT_SPECS.porter.milesPerDay).toBe(15)
    expect(TRANSPORT_SPECS.porter.capacityLbs).toBe(50)
  })

  it('galleon is fastest sea mode', () => {
    expect(TRANSPORT_SPECS.galleon.milesPerDay).toBe(80)
    expect(TRANSPORT_SPECS.galleon.capacityLbs).toBe(200000)
  })

  it('teleportation is instant but expensive', () => {
    expect(TRANSPORT_SPECS.teleportation.milesPerDay).toBe(99999)
    expect(TRANSPORT_SPECS.teleportation.costPerMile).toBe(10)
  })

  it('caravan has lowest risk (safety in numbers)', () => {
    expect(TRANSPORT_SPECS.caravan.riskModifier).toBe(0.6)
    expect(TRANSPORT_SPECS.porter.riskModifier).toBe(1.5)
  })

  it('cart and wagon require roads', () => {
    expect(TRANSPORT_SPECS.cart.requiresRoad).toBe(true)
    expect(TRANSPORT_SPECS.wagon.requiresRoad).toBe(true)
    expect(TRANSPORT_SPECS.pack_animal.requiresRoad).toBe(false)
  })
})

// ============================================================
// COST CALCULATION
// ============================================================

describe('Shipment Cost', () => {
  it('calculates base cost from distance × rate', () => {
    const cost = calculateShipmentCost(100, 500, 'cart', 'safe')
    expect(cost.baseCost).toBe(3) // 100 × 0.03 × ceil(500/500)
    expect(cost.riskPremium).toBe(0) // safe = ×1.0 → premium = 0
    expect(cost.travelDays).toBe(5) // 100 miles / 20 mi/day
  })

  it('dangerous routes have risk premium', () => {
    const safe = calculateShipmentCost(100, 500, 'cart', 'safe')
    const dangerous = calculateShipmentCost(100, 500, 'cart', 'dangerous')
    expect(dangerous.total).toBeGreaterThan(safe.total)
    expect(dangerous.riskPremium).toBeGreaterThan(0)
  })

  it('heavier loads cost more', () => {
    const light = calculateShipmentCost(100, 100, 'wagon', 'safe')
    const heavy = calculateShipmentCost(100, 2500, 'wagon', 'safe')
    expect(heavy.baseCost).toBeGreaterThan(light.baseCost)
  })

  it('crew wages scale with travel days', () => {
    const short = calculateShipmentCost(15, 100, 'wagon', 'safe')
    const long = calculateShipmentCost(150, 100, 'wagon', 'safe')
    expect(long.crewCost).toBeGreaterThan(short.crewCost)
  })

  it('teleportation is extremely expensive but instant', () => {
    const cost = calculateShipmentCost(500, 100, 'teleportation', 'safe')
    expect(cost.travelDays).toBe(1) // ceil(500/99999)
    expect(cost.baseCost).toBe(5000) // 500 × 10
  })
})

// ============================================================
// SHIPMENT LIFECYCLE
// ============================================================

describe('Shipment Lifecycle', () => {
  it('create → load → dispatch → tick → arrive', () => {
    const shipment = createShipment(
      'node_suzail', 'node_arabel', 60, 'patrolled',
      'wagon', 'duke_v', 'warehouse_1', 'warehouse_2',
    )
    expect(shipment.status).toBe('loading')

    // Add items to manifest
    const added = addToManifest(shipment, 'iron_1', 'Iron Ingots', 100, 500, 50)
    expect(added).toBe(true)
    expect(shipment.totalWeightLbs).toBe(500)
    expect(shipment.manifest).toHaveLength(1)

    // Dispatch
    dispatchShipment(shipment, 10)
    expect(shipment.status).toBe('in_transit')
    expect(shipment.departedDay).toBe(10)
    expect(shipment.estimatedArrivalDay).toBe(14) // 60mi / 15mi/day = 4 days

    // Tick 3 days (not arrived yet)
    for (let day = 11; day <= 13; day++) {
      const result = tickShipment(shipment, day, 20) // d20=20, low hazard
      shipment.progressMiles = result.progressMiles
      expect(result.arrived).toBe(false)
    }

    // Tick day 4 (should arrive)
    const finalResult = tickShipment(shipment, 14, 20)
    shipment.progressMiles = finalResult.progressMiles
    expect(finalResult.arrived).toBe(true)
    expect(shipment.progressMiles).toBe(60)
  })

  it('reject manifest item that exceeds capacity', () => {
    const shipment = createShipment(
      'node_a', 'node_b', 100, 'safe',
      'porter', 'char_1', 'bag_1', 'bag_2',
    )
    // Porter capacity: 50 lbs
    expect(addToManifest(shipment, 'heavy', 'Anvil', 1, 60, 10)).toBe(false)
    expect(shipment.manifest).toHaveLength(0)
  })

  it('cost updates when manifest changes', () => {
    const shipment = createShipment(
      'node_a', 'node_b', 100, 'safe',
      'wagon', 'char_1', 'c_1', 'c_2',
    )
    const costBefore = shipment.totalCostGP
    addToManifest(shipment, 'item_1', 'Goods', 100, 1500, 100)
    // Cost should update (1500 lbs on a 2000lb wagon)
    expect(shipment.totalCostGP).toBeGreaterThanOrEqual(costBefore)
  })
})

// ============================================================
// HAZARDS
// ============================================================

describe('Shipment Hazards', () => {
  it('low d20 on dangerous route causes hazard', () => {
    const shipment = createShipment(
      'node_a', 'node_b', 100, 'dangerous',
      'wagon', 'char_1', 'c_1', 'c_2',
    )
    dispatchShipment(shipment, 1)
    // d20=1 on dangerous route: hazardThreshold = 0.3*0.9 = 0.27, roll = 1/20 = 0.05
    const result = tickShipment(shipment, 2, 1)
    // d20=1 → critical hazard
    expect(result.events.length).toBeGreaterThanOrEqual(1)
    if (result.events.length > 0) {
      expect(result.events[0].type).toBe('critical_hazard')
      expect(result.events[0].cargoLostPercent).toBe(0.3)
    }
  })

  it('high d20 on safe route = no hazard', () => {
    const shipment = createShipment(
      'node_a', 'node_b', 100, 'safe',
      'caravan', 'char_1', 'c_1', 'c_2',
    )
    dispatchShipment(shipment, 1)
    // d20=20 on safe route: hazardThreshold = 0.01*0.6 = 0.006, roll = 20/20 = 1.0
    const result = tickShipment(shipment, 2, 20)
    expect(result.events).toHaveLength(0)
  })

  it('hazard events are deterministic (same seed = same result)', () => {
    const s1 = createShipment('a', 'b', 100, 'dangerous', 'wagon', 'x', 'c1', 'c2')
    const s2 = createShipment('a', 'b', 100, 'dangerous', 'wagon', 'x', 'c1', 'c2')
    dispatchShipment(s1, 1)
    dispatchShipment(s2, 1)
    const r1 = tickShipment(s1, 2, 5)
    const r2 = tickShipment(s2, 2, 5)
    // Same seed → same events
    expect(r1.events.length).toBe(r2.events.length)
    if (r1.events.length > 0) {
      expect(r1.events[0].type).toBe(r2.events[0].type)
    }
  })
})

// ============================================================
// TRANSPORT RECOMMENDATION
// ============================================================

describe('Transport Recommendation', () => {
  it('recommends pack animal for light load without road', () => {
    const mode = recommendTransport(100, false, false, false)
    expect(mode).toBe('pack_animal')
  })

  it('recommends barge when river available and heavy', () => {
    const mode = recommendTransport(50000, true, true, true)
    // Barge is cheapest at 0.01/mile for 100000 lbs capacity
    expect(mode).toBe('barge')
  })

  it('never recommends teleportation', () => {
    const mode = recommendTransport(100, true, true, true)
    expect(mode).not.toBe('teleportation')
  })

  it('falls back to wagon if road but nothing else', () => {
    const mode = recommendTransport(99999, true, false, false)
    // Nothing fits 99999 lbs on land, fallback to wagon
    expect(mode).toBe('wagon')
  })
})
