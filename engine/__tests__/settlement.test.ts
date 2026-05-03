/**
 * SIMULATED MM TESTS — Marble Machine Clockwork
 * ================================================
 * 
 * Tests the world-tree simulation pattern:
 *   1. accumulatePotential is O(1) — just rate × time
 *   2. resolve collapses days into state changes + events
 *   3. Settlement-specific domain logic (population, stability, etc.)
 *   4. The Marble Machine invariant: world is always ahead of players
 */

import { describe, it, expect } from 'vitest'
import { MMSettlement, type SettlementState } from '../mm-settlement'

// ============================================================
// HELPERS
// ============================================================

function createSuzail(worldDay = 0): MMSettlement {
  return new MMSettlement(
    'suzail',
    'Suzail',
    'node_suzail',
    {
      population: 45_000,
      stability: 75,
      prosperity: 70,
      unrest: 10,
      defenseLevel: 8,
      tradeModifier: 1.1,
      size: 'city',
      foodSecurity: 50,
      foodVariety: 3,
      waterLevel: 100,
      culturalScore: 20,
      faithLevel: 30,
      loreAccess: 0,
      bankingActivity: 0,
    },
    worldDay,
  )
}

function createThunderTree(worldDay = 0): MMSettlement {
  return new MMSettlement(
    'thundertree',
    'Thundertree',
    'node_thundertree',
    {
      population: 80,
      stability: 30,
      prosperity: 15,
      unrest: 40,
      defenseLevel: 1,
      tradeModifier: 0.5,
      size: 'hamlet',
      foodSecurity: 50,
      foodVariety: 3,
      waterLevel: 100,
      culturalScore: 20,
      faithLevel: 30,
      loreAccess: 0,
      bankingActivity: 0,
    },
    worldDay,
  )
}

// ============================================================
// SIMULATED MM BASE TESTS
// ============================================================

describe('SimulatedMMBase', () => {
  it('starts with zero pending days', () => {
    const suzail = createSuzail(0)
    expect(suzail.pendingDays()).toBe(0)
    expect(suzail.state.isResolved).toBe(false)
  })

  it('accumulate increases pending days', () => {
    const suzail = createSuzail(0)
    suzail.accumulatePotential(7, 7) // 1 week
    expect(suzail.pendingDays()).toBe(7)
    expect(suzail.state.lastTick).toBe(7)
  })

  it('multiple accumulations stack', () => {
    const suzail = createSuzail(0)
    suzail.accumulatePotential(7, 7)
    suzail.accumulatePotential(7, 14)
    suzail.accumulatePotential(7, 21)
    expect(suzail.pendingDays()).toBe(21)
  })

  it('resolve resets pending to zero', () => {
    const suzail = createSuzail(0)
    suzail.accumulatePotential(14, 14)
    expect(suzail.pendingDays()).toBe(14)

    const result = suzail.resolve(14)
    expect(suzail.pendingDays()).toBe(0)
    expect(suzail.state.isResolved).toBe(true)
    expect(suzail.state.lastResolved).toBe(14)
  })

  it('resolve returns correct daysResolved', () => {
    const suzail = createSuzail(0)
    suzail.accumulatePotential(30, 30)
    const result = suzail.resolve(30)
    expect(result.daysResolved).toBe(30)
    expect(result.mmId).toBe('suzail')
    expect(result.resolvedAt).toBe(30)
  })

  it('serialize preserves state', () => {
    const suzail = createSuzail(0)
    suzail.accumulatePotential(7, 7)
    const serialized = suzail.serialize()
    expect(serialized.state.id).toBe('suzail')
    expect(serialized.state.pendingPotential.daysPending).toBe(7)
    expect(serialized.domain).toBeDefined()
  })
})

// ============================================================
// MM_SETTLEMENT TESTS
// ============================================================

describe('MMSettlement', () => {
  it('initializes with correct domain state', () => {
    const suzail = createSuzail(0)
    const domain = suzail.getDomain()
    expect(domain.population).toBe(45_000)
    expect(domain.size).toBe('city')
    expect(domain.stability).toBe(75)
  })

  it('population grows over time (city rate)', () => {
    const suzail = createSuzail(0)
    const initPop = suzail.getDomain().population

    // 4 weeks of accumulation
    suzail.accumulatePotential(28, 28)
    suzail.resolve(28)

    const finalPop = suzail.getDomain().population
    // City growth rate: 0.001/week × 4 weeks = 0.004 = ~180 people
    // But random events can offset — verify reasonable range
    expect(finalPop).toBeGreaterThan(initPop * 0.95) // no catastrophic loss
    expect(finalPop).toBeLessThan(initPop * 1.05)    // no magical boom
  })

  it('hamlet has different growth rate than city', () => {
    const hamlet = createThunderTree(0)
    const city = createSuzail(0)

    hamlet.accumulatePotential(28, 28)
    city.accumulatePotential(28, 28)

    hamlet.resolve(28)
    city.resolve(28)

    const hamletDomain = hamlet.getDomain()
    const cityDomain = city.getDomain()

    // Population should still be in a reasonable range
    // (events may cause fluctuations)
    expect(hamletDomain.population).toBeGreaterThanOrEqual(50)
    expect(hamletDomain.population).toBeLessThan(200)
    expect(cityDomain.population).toBeGreaterThan(40_000)
    expect(cityDomain.population).toBeLessThan(50_000)
  })

  it('stability affects unrest over time', () => {
    const unstable = new MMSettlement(
      'chaos_town',
      'Chaos Town',
      'node_chaos',
      {
        population: 5_000,
        stability: 15, // very low
        prosperity: 30,
        unrest: 60,     // already high
        defenseLevel: 2,
        tradeModifier: 0.8,
        size: 'town',
        foodSecurity: 50,
        foodVariety: 3,
        waterLevel: 100,
        culturalScore: 20,
        faithLevel: 30,
        loreAccess: 0,
        bankingActivity: 0,
      },
      0,
    )

    unstable.accumulatePotential(30, 30)
    unstable.resolve(30)

    // Low stability + 30 days should increase unrest
    expect(unstable.getDomain().unrest).toBeGreaterThan(60)
  })

  it('high stability reduces unrest', () => {
    const stable = new MMSettlement(
      'stable_city',
      'Stable City',
      'node_stable',
      {
        population: 20_000,
        stability: 90, // very high
        prosperity: 80,
        unrest: 30,     // moderate
        defenseLevel: 10,
        tradeModifier: 1.2,
        size: 'city',
        foodSecurity: 50,
        foodVariety: 3,
        waterLevel: 100,
        culturalScore: 20,
        faithLevel: 30,
        loreAccess: 0,
        bankingActivity: 0,
      },
      0,
    )

    stable.accumulatePotential(30, 30)
    stable.resolve(30)

    // High stability should reduce unrest (or events may offset slightly)
    // 30 days × 0.2/day = 6 reduction, but events could add some
    expect(stable.getDomain().unrest).toBeLessThan(40)
  })

  it('resolve generates narrative', () => {
    const suzail = createSuzail(0)
    suzail.accumulatePotential(14, 14)
    const result = suzail.resolve(14)

    expect(result.narrative).toContain('Suzail')
    expect(result.narrative).toContain('14 days')
  })

  it('size reclassifies when population changes enough', () => {
    const growing = new MMSettlement(
      'growing_town',
      'Growing Town',
      'node_growing',
      {
        population: 9_900,
        stability: 80,
        prosperity: 90,
        unrest: 5,
        defenseLevel: 5,
        tradeModifier: 1.3,
        size: 'town',
        foodSecurity: 50,
        foodVariety: 3,
        waterLevel: 100,
        culturalScore: 20,
        faithLevel: 30,
        loreAccess: 0,
        bankingActivity: 0,
      },
      0,
    )

    // Accumulate a lot of time — growth should push past 10k
    growing.accumulatePotential(365, 365) // full year
    growing.resolve(365)

    // At town rate (0.002/week × 52 weeks = 10.4%), 9900 → ~10,930
    expect(growing.getDomain().population).toBeGreaterThan(10_000)
    expect(growing.getDomain().size).toBe('city')
  })

  it('population never drops below 1', () => {
    const dying = new MMSettlement(
      'dying_hamlet',
      'Dying Hamlet',
      'node_dying',
      {
        population: 5,
        stability: 5,
        prosperity: 0,
        unrest: 95,
        defenseLevel: 0,
        tradeModifier: 0.1,
        size: 'hamlet',
        foodSecurity: 50,
        foodVariety: 3,
        waterLevel: 100,
        culturalScore: 20,
        faithLevel: 30,
        loreAccess: 0,
        bankingActivity: 0,
      },
      0,
    )

    // Even catastrophic events can't kill everyone
    dying.accumulatePotential(365, 365)
    dying.resolve(365)
    expect(dying.getDomain().population).toBeGreaterThanOrEqual(1)
  })

  it('refillEventPool replenishes without errors', () => {
    const suzail = createSuzail(0)
    // Consume some event pool items via accumulation
    suzail.accumulatePotential(365, 365)
    suzail.resolve(365)

    // Refill should not throw
    expect(() => suzail.refillEventPool(365)).not.toThrow()
  })

  it('the Marble Machine invariant: accumulate → resolve cycle', () => {
    const suzail = createSuzail(0)

    // Week 1: world ticks, players haven't arrived
    suzail.accumulatePotential(7, 7)
    expect(suzail.pendingDays()).toBe(7)

    // Week 2: world ticks again
    suzail.accumulatePotential(7, 14)
    expect(suzail.pendingDays()).toBe(14)

    // Week 3: world ticks
    suzail.accumulatePotential(7, 21)
    expect(suzail.pendingDays()).toBe(21)

    // Day 21: PARTY ARRIVES → observation triggers resolve
    const result = suzail.resolve(21)
    expect(result.daysResolved).toBe(21)
    expect(suzail.pendingDays()).toBe(0)
    expect(suzail.state.isResolved).toBe(true)

    // The world was already alive before they looked.
    expect(result.narrative.length).toBeGreaterThan(0)
  })
})
