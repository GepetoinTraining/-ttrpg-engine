/**
 * CLOCKWORK TESTS — The Unified World Simulation Engine
 * ========================================================
 * 
 * Integration tests proving the end-to-end cycle:
 *   World ticks → Potential accumulates → Player arrives → Resolve → World is alive
 * 
 * Tests the unified engine: cadence system, TP access, player ticks, observation.
 */

import { describe, it, expect } from 'vitest'
import { Clockwork } from '../clockwork'
import { MMSettlement } from '../mm-settlement'
import { TP, type WorldNode } from '../tp'

// ============================================================
// HELPERS
// ============================================================

function createTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'node_suzail', type: 'settlement', name: 'Suzail', parentId: 'region_cormyr', dataStatic: { climate: 'temperate' } },
    { id: 'node_waterdeep', type: 'settlement', name: 'Waterdeep', parentId: 'region_sword_coast', dataStatic: { climate: 'temperate' } },
    { id: 'node_thundertree', type: 'settlement', name: 'Thundertree', parentId: 'region_sword_coast', dataStatic: {} },
    { id: 'region_cormyr', type: 'region', name: 'Cormyr', parentId: null, dataStatic: { climate: 'temperate' } },
    { id: 'region_sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: { climate: 'temperate' } },
  ]
  tp.loadNodes(nodes)
  return tp
}

function createWorld(): { clockwork: Clockwork; tp: TP; suzail: MMSettlement; waterdeep: MMSettlement; thundertree: MMSettlement } {
  const tp = createTP()
  const clockwork = new Clockwork(tp, 0)

  const suzail = new MMSettlement('suzail', 'Suzail', 'node_suzail', {
    population: 45_000, stability: 75, prosperity: 70, unrest: 10,
    defenseLevel: 8, tradeModifier: 1.1, size: 'city',
    foodSecurity: 50, foodVariety: 3, waterLevel: 100, culturalScore: 20, faithLevel: 30, loreAccess: 0, bankingActivity: 0,
  })

  const waterdeep = new MMSettlement('waterdeep', 'Waterdeep', 'node_waterdeep', {
    population: 130_000, stability: 85, prosperity: 90, unrest: 5,
    defenseLevel: 15, tradeModifier: 1.3, size: 'metropolis',
    foodSecurity: 50, foodVariety: 3, waterLevel: 100, culturalScore: 20, faithLevel: 30, loreAccess: 0, bankingActivity: 0,
  })

  const thundertree = new MMSettlement('thundertree', 'Thundertree', 'node_thundertree', {
    population: 80, stability: 30, prosperity: 15, unrest: 40,
    defenseLevel: 1, tradeModifier: 0.5, size: 'hamlet',
    foodSecurity: 50, foodVariety: 3, waterLevel: 100, culturalScore: 20, faithLevel: 30, loreAccess: 0, bankingActivity: 0,
  })

  // All in layer 2 (settlement layer), weekly cadence
  clockwork.register(suzail, 2, 'weekly')
  clockwork.register(waterdeep, 2, 'weekly')
  clockwork.register(thundertree, 2, 'weekly')

  return { clockwork, tp, suzail, waterdeep, thundertree }
}

// ============================================================
// BASIC CLOCKWORK TESTS
// ============================================================

describe('Clockwork', () => {
  it('starts at world day 0', () => {
    const tp = createTP()
    const clockwork = new Clockwork(tp, 0)
    expect(clockwork.worldDay).toBe(0)
    expect(clockwork.totalMMs()).toBe(0)
  })

  it('registers MMs across layers', () => {
    const { clockwork } = createWorld()
    expect(clockwork.totalMMs()).toBe(3)
  })

  it('daily tick advances by 1 day', () => {
    const tp = createTP()
    const clockwork = new Clockwork(tp, 0)
    const result = clockwork.dailyTick()
    expect(clockwork.worldDay).toBe(1)
    expect(result.worldDay).toBe(1)
  })

  it('weekly MMs fire after 7 daily ticks', () => {
    const { clockwork, suzail } = createWorld()

    // Tick 6 days — weekly MMs should NOT fire
    for (let i = 0; i < 6; i++) {
      const result = clockwork.dailyTick()
      expect(result.firedWeekly).toBe(false)
      expect(result.weeklyMMs).toHaveLength(0)
    }
    expect(suzail.pendingDays()).toBe(0) // weekly MMs haven't fired

    // Day 7 — weekly fires
    const result = clockwork.dailyTick()
    expect(result.firedWeekly).toBe(true)
    expect(result.weeklyMMs).toHaveLength(3) // all 3 settlements
    expect(suzail.pendingDays()).toBe(7) // accumulated 7 days
  })

  it('monthly MMs fire after 30 daily ticks', () => {
    const tp = createTP()
    const clockwork = new Clockwork(tp, 0)
    const settlement = new MMSettlement('test_monthly', 'Monthly Town', 'node_suzail', {
      population: 1000, stability: 50, prosperity: 50, unrest: 10,
      defenseLevel: 3, tradeModifier: 1.0, size: 'town',
      foodSecurity: 50, foodVariety: 3, waterLevel: 100, culturalScore: 20, faithLevel: 30, loreAccess: 0, bankingActivity: 0,
    })
    clockwork.register(settlement, 2, 'monthly')

    let monthlyFired = false
    for (let i = 0; i < 30; i++) {
      const result = clockwork.dailyTick()
      if (result.firedMonthly) monthlyFired = true
    }
    expect(monthlyFired).toBe(true)
    expect(settlement.pendingDays()).toBe(30)
  })

  it('unregister removes MM', () => {
    const { clockwork } = createWorld()
    expect(clockwork.totalMMs()).toBe(3)
    clockwork.unregister('suzail')
    expect(clockwork.totalMMs()).toBe(2)
    expect(clockwork.getMM('suzail')).toBeUndefined()
  })

  it('player ticks accumulate and reset daily', () => {
    const tp = createTP()
    const clockwork = new Clockwork(tp, 0)
    clockwork.addPlayerTick(3)
    clockwork.addPlayerTick(2)
    const result = clockwork.dailyTick()
    expect(result.playerTicksConsumed).toBe(5)
    // After daily tick, counter resets
    const result2 = clockwork.dailyTick()
    expect(result2.playerTicksConsumed).toBe(0)
  })
})

// ============================================================
// CRANK TESTS
// ============================================================

describe('Clockwork.crankTo', () => {
  it('cranks to target day', () => {
    const { clockwork } = createWorld()
    const result = clockwork.crankTo(28) // 4 weeks
    expect(clockwork.worldDay).toBe(28)
    expect(result.ticksExecuted).toBe(28) // 28 daily ticks
    expect(result.totalMMsTicked).toBe(12) // 3 MMs × 4 weekly fires
  })

  it('respects maxTicksPerCrank safety valve', () => {
    const tp = createTP()
    const clockwork = new Clockwork(tp, 0, { maxTicksPerCrank: 10 })
    const suzail = new MMSettlement('suzail', 'Suzail', 'node_suzail', {
      population: 45_000, stability: 75, prosperity: 70, unrest: 10,
      defenseLevel: 8, tradeModifier: 1.1, size: 'city',
      foodSecurity: 50, foodVariety: 3, waterLevel: 100, culturalScore: 20, faithLevel: 30, loreAccess: 0, bankingActivity: 0,
    })
    clockwork.register(suzail, 2, 'weekly')

    const result = clockwork.crankTo(365)
    expect(result.ticksExecuted).toBe(10) // capped
    expect(clockwork.worldDay).toBe(10)
  })

  it('does nothing if already past target', () => {
    const { clockwork } = createWorld()
    clockwork.crankTo(28)
    const result = clockwork.crankTo(14) // already past day 14
    expect(result.ticksExecuted).toBe(0)
    expect(clockwork.worldDay).toBe(28)
  })
})

// ============================================================
// OBSERVATION TESTS
// ============================================================

describe('Clockwork.observe', () => {
  it('observe resolves a specific MM', () => {
    const { clockwork, suzail } = createWorld()
    clockwork.crankTo(21)

    expect(suzail.pendingDays()).toBeGreaterThan(0)
    const result = clockwork.observe('suzail')!
    expect(result).not.toBeNull()
    expect(result.daysResolved).toBeGreaterThan(0)
    expect(suzail.pendingDays()).toBe(0)
  })

  it('observe returns null for unknown MM', () => {
    const { clockwork } = createWorld()
    expect(clockwork.observe('nonexistent')).toBeNull()
  })

  it('observe returns null if no pending days', () => {
    const { clockwork } = createWorld()
    expect(clockwork.observe('suzail')).toBeNull()
  })

  it('observeNode resolves all MMs at a .tp node', () => {
    const { clockwork, suzail } = createWorld()
    clockwork.crankTo(14)

    const result = clockwork.observeNode('node_suzail')
    expect(result.nodeId).toBe('node_suzail')
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved[0].mmId).toBe('suzail')
    expect(suzail.pendingDays()).toBe(0)
  })

  it('observeNode does not resolve MMs at other nodes', () => {
    const { clockwork, waterdeep } = createWorld()
    clockwork.crankTo(14)

    clockwork.observeNode('node_suzail')
    expect(waterdeep.pendingDays()).toBeGreaterThan(0) // waterdeep NOT resolved
  })
})

// ============================================================
// TP κ WRITE TESTS
// ============================================================

describe('TP writeKappa', () => {
  it('writes dot-path κ to node', () => {
    const tp = createTP()
    const written = tp.writeKappa('node_suzail', {
      'weather.severity': 0.7,
      'weather.temperature': 65,
    })
    expect(written).toBe(true)

    const node = tp.getNode('node_suzail')!
    const data = node.dataStatic as Record<string, any>
    expect(data.weather.severity).toBe(0.7)
    expect(data.weather.temperature).toBe(65)
    // Original data preserved
    expect(data.climate).toBe('temperate')
  })

  it('returns false for unknown nodeId', () => {
    const tp = createTP()
    expect(tp.writeKappa('nonexistent', { foo: 1 })).toBe(false)
  })

  it('creates nested objects for deep paths', () => {
    const tp = createTP()
    tp.writeKappa('node_suzail', {
      'economy.market.prices.grain': 5,
    })
    const node = tp.getNode('node_suzail')!
    const data = node.dataStatic as Record<string, any>
    expect(data.economy.market.prices.grain).toBe(5)
  })

  it('mutateNode shallow-merges', () => {
    const tp = createTP()
    tp.mutateNode('node_suzail', { weather: { severity: 0.3 } })
    tp.mutateNode('node_suzail', { weather: { temperature: 70 } })

    const node = tp.getNode('node_suzail')!
    const data = node.dataStatic as Record<string, any>
    // Shallow merge: second call merges into weather, keeping severity
    expect(data.weather.severity).toBe(0.3)
    expect(data.weather.temperature).toBe(70)
  })
})

// ============================================================
// THE MARBLE MACHINE — Full Integration Test
// ============================================================

describe('The Marble Machine (integration)', () => {
  it('simulates a living world that players arrive into', () => {
    const { clockwork, suzail, waterdeep, thundertree } = createWorld()

    // === WEEKS 1-4: World simulates, no players ===
    clockwork.crankTo(28)
    expect(clockwork.worldDay).toBe(28)

    // All settlements have pending potential (weekly cadence fires 4 times)
    expect(suzail.pendingDays()).toBeGreaterThan(0)
    expect(waterdeep.pendingDays()).toBeGreaterThan(0)
    expect(thundertree.pendingDays()).toBeGreaterThan(0)

    // Nobody has been observed yet
    const pending = clockwork.pendingMMs()
    expect(pending).toHaveLength(3)

    // === WEEK 5: Party arrives at Suzail ===
    clockwork.crankTo(35)
    const suzailResult = clockwork.observeNode('node_suzail')
    expect(suzailResult.resolved).toHaveLength(1)
    expect(suzailResult.resolved[0].narrative).toContain('Suzail')

    // Suzail is now resolved, others still pending
    expect(suzail.pendingDays()).toBe(0)
    expect(waterdeep.pendingDays()).toBeGreaterThan(0)
    expect(thundertree.pendingDays()).toBeGreaterThan(0)

    // === WEEKS 6-8: More simulation ===
    clockwork.crankTo(56)

    // Suzail has accumulated new potential since resolve
    expect(suzail.pendingDays()).toBeGreaterThan(0)
    // Waterdeep has accumulated much more (never observed)
    expect(waterdeep.pendingDays()).toBeGreaterThan(suzail.pendingDays())

    // === Party fast-travels to Waterdeep ===
    const waterdeepResult = clockwork.observeNode('node_waterdeep')
    expect(waterdeepResult.resolved).toHaveLength(1)

    // The world was ALIVE the whole time
    const waterdeepDomain = waterdeep.getDomain()
    expect(waterdeepDomain.population).toBeGreaterThan(100_000)

    // Thundertree was NEVER observed
    expect(thundertree.pendingDays()).toBeGreaterThan(0)
  })

  it('scales to many settlements cheaply', () => {
    const tp = createTP()
    const clockwork = new Clockwork(tp, 0)

    // Register 100 settlements
    for (let i = 0; i < 100; i++) {
      const settlement = new MMSettlement(
        `settlement_${i}`,
        `Settlement ${i}`,
        `node_${i}`,
        {
          population: 1000 + i * 100,
          stability: 50 + (i % 30),
          prosperity: 40 + (i % 40),
          unrest: 10 + (i % 20),
          defenseLevel: 3,
          tradeModifier: 1.0,
          size: 'town',
          foodSecurity: 50,
          foodVariety: 3,
          waterLevel: 100,
          culturalScore: 20,
          faithLevel: 30,
          loreAccess: 0,
          bankingActivity: 0,
        },
      )
      clockwork.register(settlement, 2, 'weekly')
    }

    expect(clockwork.totalMMs()).toBe(100)

    // Crank 1 year — should be fast
    const start = performance.now()
    const result = clockwork.crankTo(365)
    const elapsed = performance.now() - start

    expect(result.ticksExecuted).toBe(365) // 365 daily ticks
    expect(result.totalMMsTicked).toBeGreaterThanOrEqual(5000) // 100 MMs × 52 weekly fires
    // Should complete in under 2 seconds (O(1) per MM per tick)
    expect(elapsed).toBeLessThan(2000)

    // Only observe 3 of them
    clockwork.observeNode('node_0')
    clockwork.observeNode('node_50')
    clockwork.observeNode('node_99')

    // 97 settlements were NEVER observed — zero resolve cost
    const pending = clockwork.pendingMMs()
    expect(pending).toHaveLength(97)
  })

  it('snapshot shows cadence state', () => {
    const { clockwork } = createWorld()
    clockwork.crankTo(10)

    const snap = clockwork.snapshot()
    expect(snap.worldDay).toBe(10)
    expect(snap.totalMMs).toBe(3)
    expect(snap.mmsByCadence.weekly).toBe(3)
    expect(snap.daysUntilWeekly).toBeLessThanOrEqual(7)
    expect(snap.totalPlayerTicks).toBe(0)
  })
})
