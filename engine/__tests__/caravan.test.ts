/**
 * CARAVAN ENGINE TESTS
 */
import { describe, it, expect } from 'vitest'
import {
  CARAVAN_PROFILES,
  createCaravan,
  loadCargo,
  departCaravan,
  advanceCaravanDay,
  unloadCaravan,
  type CargoItem,
} from '../caravan.js'

// ============================================================
// CARAVAN PROFILES
// ============================================================

describe('Caravan Profiles', () => {
  it('pack_mule is smallest', () => {
    expect(CARAVAN_PROFILES.pack_mule.cargoCapacityLbs).toBe(300)
    expect(CARAVAN_PROFILES.pack_mule.requiredCrew).toBe(1)
  })

  it('ship is largest', () => {
    expect(CARAVAN_PROFILES.ship.cargoCapacityLbs).toBe(20000)
  })

  it('teleport_circle is fastest', () => {
    expect(CARAVAN_PROFILES.teleport_circle.speedSegmentsPerDay).toBe(99)
  })

  it('all 7 types defined', () => {
    expect(Object.keys(CARAVAN_PROFILES)).toHaveLength(7)
  })
})

// ============================================================
// CARGO LOADING
// ============================================================

describe('Cargo Loading', () => {
  it('loads cargo within capacity', () => {
    const c = createCaravan('wagon', 'merchant_1', 'merchant', 'hub_a', 'hub_b', 'edge_1', 10)
    const item: CargoItem = { commodityId: 'grain', quantity: 100, weightLbs: 500, valueTotalGp: 200, perishable: false, daysSinceLoaded: 0 }
    expect(loadCargo(c, item)).toBe(true)
    expect(c.totalWeightLbs).toBe(500)
  })

  it('rejects cargo over capacity', () => {
    const c = createCaravan('pack_mule', 'merchant_1', 'merchant', 'hub_a', 'hub_b', 'edge_1', 10)
    const item: CargoItem = { commodityId: 'iron', quantity: 50, weightLbs: 500, valueTotalGp: 1000, perishable: false, daysSinceLoaded: 0 }
    // Pack mule capacity is 300
    expect(loadCargo(c, item)).toBe(false)
    expect(c.cargo).toHaveLength(0)
  })

  it('department requires cargo', () => {
    const c = createCaravan('cart', 'merchant_1', 'merchant', 'hub_a', 'hub_b', 'edge_1', 10)
    departCaravan(c)
    expect(c.status).toBe('loading') // Can't depart empty
  })
})

// ============================================================
// DAILY ADVANCE
// ============================================================

describe('Daily Advance', () => {
  function makeCaravan(segments: number = 10) {
    const c = createCaravan('wagon', 'm1', 'merchant', 'ha', 'hb', 'e1', segments)
    const item: CargoItem = { commodityId: 'grain', quantity: 50, weightLbs: 500, valueTotalGp: 100, perishable: false, daysSinceLoaded: 0 }
    loadCargo(c, item)
    departCaravan(c)
    return c
  }

  it('advances segments with clear weather', () => {
    const c = makeCaravan()
    const result = advanceCaravanDay(c, 0, 0, 1.0, 20) // No danger, clear weather, high roll
    expect(result.segmentsAdvanced).toBe(1) // Wagon goes 1 seg/day
    expect(c.currentSegment).toBe(1)
    expect(c.status).toBe('en_route')
  })

  it('pays tolls', () => {
    const c = makeCaravan()
    const result = advanceCaravanDay(c, 0, 10, 1.0, 20)
    expect(result.tollPaid).toBe(10)
    expect(c.tollsPaid).toBe(10)
  })

  it('encounter on low roll vs high danger', () => {
    const c = makeCaravan()
    c.guards = 2
    const result = advanceCaravanDay(c, 8, 0, 1.0, 3) // d20=3 ≤ danger=8
    expect(result.encounter).not.toBeNull()
  })

  it('no encounter on high roll', () => {
    const c = makeCaravan()
    const result = advanceCaravanDay(c, 5, 0, 1.0, 15) // d20=15 > danger=5
    expect(result.encounter).toBeNull()
  })

  it('arrives after enough days', () => {
    const c = makeCaravan(3) // Only 3 segments
    advanceCaravanDay(c, 0, 0, 1.0, 20) // Seg 1
    advanceCaravanDay(c, 0, 0, 1.0, 20) // Seg 2
    const result = advanceCaravanDay(c, 0, 0, 1.0, 20) // Seg 3
    expect(result.arrived).toBe(true)
    expect(c.status).toBe('arrived')
  })

  it('perishable cargo spoils after 7 days', () => {
    const c = createCaravan('wagon', 'm1', 'merchant', 'ha', 'hb', 'e1', 20)
    const perishable: CargoItem = { commodityId: 'fish', quantity: 10, weightLbs: 100, valueTotalGp: 50, perishable: true, daysSinceLoaded: 0 }
    loadCargo(c, perishable)
    departCaravan(c)

    // Advance 8 days
    for (let i = 0; i < 8; i++) {
      advanceCaravanDay(c, 0, 0, 1.0, 20)
    }
    expect(c.cargo.find(item => item.commodityId === 'fish')).toBeUndefined()
  })

  it('weather slows travel', () => {
    const c = createCaravan('cart', 'm1', 'merchant', 'ha', 'hb', 'e1', 20)
    loadCargo(c, { commodityId: 'grain', quantity: 50, weightLbs: 200, valueTotalGp: 100, perishable: false, daysSinceLoaded: 0 })
    departCaravan(c)

    // Cart normally does 2 segments/day, but weather at 0.5 should do 1
    const result = advanceCaravanDay(c, 0, 0, 0.5, 20)
    expect(result.segmentsAdvanced).toBe(1)
  })
})

// ============================================================
// UNLOAD / PROFIT
// ============================================================

describe('Unload & Profit', () => {
  it('calculates profit correctly', () => {
    const c = createCaravan('wagon', 'm1', 'merchant', 'ha', 'hb', 'e1', 5)
    loadCargo(c, { commodityId: 'silk', quantity: 10, weightLbs: 100, valueTotalGp: 500, perishable: false, daysSinceLoaded: 0 })
    c.tollsPaid = 20
    c.daysTraveled = 5

    const result = unloadCaravan(c, 50) // 50GP operating cost
    expect(result.deliveredItems).toHaveLength(1)
    expect(result.totalValueGp).toBe(500)
    expect(result.totalCost).toBe(70) // 50 operating + 20 tolls
    expect(result.profitGp).toBe(430) // 500 - 70
  })
})
