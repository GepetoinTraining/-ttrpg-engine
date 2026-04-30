/**
 * MF_POOL TESTS — Marble Machine Verification
 * ==============================================
 * 
 * Tests the core Marble Machine invariants:
 *   1. Pool never empties — roll() is self-sustaining (grind 2, use 1)
 *   2. SELECT is O(1) — pre-computed, no computation at observation time
 *   3. REFILL maintains pool depth at capacity
 *   4. Dice pools produce valid D&D results
 *   5. Advantage/disadvantage are net-zero (grind 2, use both)
 *   6. Factory creates all standard die types
 */

import { describe, it, expect } from 'vitest'
import { MFPool, type PoolConfig } from '../mf-pool.js'
import {
  DicePool, createDicePools, createDiceGrindFn, POOL_SIZES,
} from '../mf-pool-dice.js'
import type { DiceFormula } from '../mf-dice.js'

// ============================================================
// MF_POOL GENERIC TESTS
// ============================================================

describe('MFPool (generic)', () => {
  const config: PoolConfig = {
    id: 'test_pool',
    type: 'number',
    capacity: 100,
    ownerId: 'test',
  }

  // Simple grind: produce sequential numbers
  const numberGrind = (count: number) =>
    Array.from({ length: count }, (_, i) => i)

  it('starts empty before grind', () => {
    const pool = new MFPool<number>(config)
    expect(pool.depth()).toBe(0)
    expect(pool.isEmpty()).toBe(true)
  })

  it('grind fills the pool', () => {
    const pool = new MFPool<number>(config)
    pool.grind(numberGrind, 100)
    expect(pool.depth()).toBe(100)
    expect(pool.isEmpty()).toBe(false)
  })

  it('select returns items in order — O(1)', () => {
    const pool = new MFPool<number>(config)
    pool.grind(numberGrind, 10)
    expect(pool.select()).toBe(0)
    expect(pool.select()).toBe(1)
    expect(pool.select()).toBe(2)
    expect(pool.depth()).toBe(7)
  })

  it('selectMany returns N items', () => {
    const pool = new MFPool<number>(config)
    pool.grind(numberGrind, 20)
    const batch = pool.selectMany(5)
    expect(batch).toEqual([0, 1, 2, 3, 4])
    expect(pool.depth()).toBe(15)
  })

  it('peek does not consume', () => {
    const pool = new MFPool<number>(config)
    pool.grind(numberGrind, 5)
    expect(pool.peek()).toBe(0)
    expect(pool.peek()).toBe(0)
    expect(pool.depth()).toBe(5)
  })

  it('throws on exhaustion', () => {
    const pool = new MFPool<number>(config)
    pool.grind(numberGrind, 2)
    pool.select()
    pool.select()
    expect(() => pool.select()).toThrow(/exhausted/)
  })

  it('refill compacts consumed and replenishes', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(numberGrind, 100, 0)

    // Consume 80 items
    pool.selectMany(80)
    expect(pool.depth()).toBe(20)

    // Refill on tick
    pool.refill(numberGrind, 1)
    expect(pool.depth()).toBe(100) // back to capacity
    expect(pool.getState().computedAt).toBe(1)
  })

  it('refill does not overshoot capacity', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(numberGrind, 100, 0)

    // Consume just 5
    pool.selectMany(5)
    pool.refill(numberGrind, 1)
    // Should still be at capacity, not over
    expect(pool.depth()).toBe(100)
  })

  it('isLow triggers below 10% threshold', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(numberGrind, 100, 0)
    pool.selectMany(92) // 8 remaining = 8% < 10%
    expect(pool.isLow()).toBe(true)
  })

  it('isLow is false above threshold', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(numberGrind, 100, 0)
    pool.selectMany(50) // 50 remaining = 50% > 10%
    expect(pool.isLow()).toBe(false)
  })

  it('consumptionRate tracks usage', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(numberGrind, 100, 0)
    pool.selectMany(25)
    expect(pool.consumptionRate()).toBe(0.25)
  })

  it('getItems returns only unconsumed items', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(numberGrind, 5, 0)
    pool.select() // consume 0
    pool.select() // consume 1
    expect(pool.getItems()).toEqual([2, 3, 4])
  })

  it('fromPersisted restores pool state', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(numberGrind, 100, 0)
    pool.selectMany(30)

    // Serialize: getItems() returns unconsumed slice [30..99]
    const state = pool.getState()
    const items = pool.getItems()
    expect(items.length).toBe(70)
    expect(items[0]).toBe(30)

    // Restore: cursor resets to 0 because items are already sliced
    const restored = MFPool.fromPersisted<number>(state, items)
    expect(restored.depth()).toBe(70)
    expect(restored.select()).toBe(30) // first unconsumed item
  })

  it('multiple grinds append correctly', () => {
    const pool = new MFPool<number>(config, 0)
    pool.grind(() => [10, 20, 30], 3, 0)
    pool.grind(() => [40, 50], 2, 0)
    expect(pool.depth()).toBe(5)
    expect(pool.select()).toBe(10)
    expect(pool.select()).toBe(20)
    expect(pool.select()).toBe(30)
    expect(pool.select()).toBe(40)
    expect(pool.select()).toBe(50)
  })
})

// ============================================================
// DICE POOL TESTS (d20)
// ============================================================

describe('DicePool (d20)', () => {
  it('initializes with 1000 pre-rolled d20s', () => {
    const pool = new DicePool(20, 'test', 1000, 0)
    expect(pool.depth()).toBe(1000)
  })

  it('roll returns valid d20 results', () => {
    const pool = new DicePool(20, 'test', 100, 0)
    for (let i = 0; i < 100; i++) {
      const result = pool.roll()
      expect(result.rolls.length).toBe(1)
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
      expect(result.rolls[0]).toBeLessThanOrEqual(20)
      expect(result.total).toBe(result.sum) // no modifier
    }
  })

  it('rollWithModifier applies modifier without re-rolling', () => {
    const pool = new DicePool(20, 'test', 10, 0)
    const result = pool.rollWithModifier(5)
    expect(result.modifier).toBe(5)
    expect(result.total).toBe(result.sum + 5)
    expect(result.formula).toContain('+5')
  })

  it('rollWithModifier handles negative modifiers', () => {
    const pool = new DicePool(20, 'test', 10, 0)
    const result = pool.rollWithModifier(-2)
    expect(result.modifier).toBe(-2)
    expect(result.total).toBe(result.sum - 2)
    expect(result.formula).toContain('-2')
  })

  it('rollAdvantage is net-zero on pool (grind 2, use both)', () => {
    const pool = new DicePool(20, 'test', 100, 0)
    const startDepth = pool.depth()
    const { chosen, discarded } = pool.rollAdvantage(3)

    // Grind 2, use 2 → net 0
    expect(pool.depth()).toBe(startDepth)
    expect(chosen.sum).toBeGreaterThanOrEqual(discarded.sum)
    expect(chosen.modifier).toBe(3)
    expect(chosen.formula).toContain('adv')
  })

  it('rollDisadvantage is net-zero on pool (grind 2, use both)', () => {
    const pool = new DicePool(20, 'test', 100, 0)
    const startDepth = pool.depth()
    const { chosen, discarded } = pool.rollDisadvantage(0)

    // Grind 2, use 2 → net 0
    expect(pool.depth()).toBe(startDepth)
    expect(chosen.sum).toBeLessThanOrEqual(discarded.sum)
    expect(chosen.formula).toContain('dis')
  })

  it('tick compacts and stabilizes the pool', () => {
    const pool = new DicePool(20, 'test', 100, 0)

    // rollMany(80) grinds 160, uses 80 → pool grew to 180
    pool.rollMany(80)
    expect(pool.depth()).toBe(180)

    // Tick compacts consumed items behind cursor, then fills deficit to capacity.
    // Since depth (180) > capacity (100), no new items are ground.
    // But compact removes the cursor gap, keeping the unconsumed items.
    pool.tick(1)
    expect(pool.depth()).toBeGreaterThanOrEqual(100)
  })

  it('never runs out during a realistic session — pool GROWS', () => {
    // A heavy combat session: ~200 d20 rolls
    const pool = new DicePool(20, 'session', 1000, 0)

    // Simulate 200 rolls (heavy session)
    for (let i = 0; i < 200; i++) {
      const result = pool.roll()
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
      expect(result.rolls[0]).toBeLessThanOrEqual(20)
    }

    // Each roll() grinds 2, uses 1 → net +1 per roll
    // 1000 initial + 200 net = 1200
    expect(pool.depth()).toBe(1200)
    expect(pool.isLow()).toBe(false)
  })
})

// ============================================================
// DICE POOL TESTS (d6 — sneak attack / fireball)
// ============================================================

describe('DicePool (d6)', () => {
  it('initializes with correct default capacity', () => {
    const pool = new DicePool(6, 'test', undefined, 0)
    expect(pool.depth()).toBe(POOL_SIZES.d6) // 500
  })

  it('produces valid d6 results', () => {
    const pool = new DicePool(6, 'test', 100, 0)
    for (let i = 0; i < 50; i++) {
      const result = pool.roll()
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
      expect(result.rolls[0]).toBeLessThanOrEqual(6)
    }
  })

  it('rollMany for sneak attack (8d6 = 8 dice, pool grows)', () => {
    const pool = new DicePool(6, 'test', 100, 0)
    const results = pool.rollMany(8)
    expect(results.length).toBe(8)
    // rollMany(8) grinds 16, selects 8 → net +8
    expect(pool.depth()).toBe(108)

    const total = results.reduce((sum, r) => sum + r.sum, 0)
    expect(total).toBeGreaterThanOrEqual(8)  // 8 × 1
    expect(total).toBeLessThanOrEqual(48)    // 8 × 6
  })
})

// ============================================================
// FACTORY TESTS
// ============================================================

describe('createDicePools (factory)', () => {
  it('creates all 7 standard die types', () => {
    const pools = createDicePools('session_01', 0)
    expect(pools.size).toBe(7)
    expect(pools.has('d4')).toBe(true)
    expect(pools.has('d6')).toBe(true)
    expect(pools.has('d8')).toBe(true)
    expect(pools.has('d10')).toBe(true)
    expect(pools.has('d12')).toBe(true)
    expect(pools.has('d20')).toBe(true)
    expect(pools.has('d100')).toBe(true)
  })

  it('d20 pool has 1000 items', () => {
    const pools = createDicePools('session_01', 0)
    expect(pools.get('d20')!.depth()).toBe(POOL_SIZES.d20) // 1000
  })

  it('all pools produce valid results', () => {
    const pools = createDicePools('session_01', 0)
    for (const [name, pool] of pools) {
      const sides = parseInt(name.slice(1))
      const result = pool.roll()
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
      expect(result.rolls[0]).toBeLessThanOrEqual(sides)
    }
  })
})

// ============================================================
// GRIND FUNCTION TESTS
// ============================================================

describe('createDiceGrindFn', () => {
  it('produces deterministic results from same seed', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 0 }
    const grindA = createDiceGrindFn(formula, 42)
    const grindB = createDiceGrindFn(formula, 42)

    const batchA = grindA(10)
    const batchB = grindB(10)

    expect(batchA.map(r => r.total)).toEqual(batchB.map(r => r.total))
  })

  it('produces different results from different seeds', () => {
    const formula: DiceFormula = { count: 1, sides: 20, modifier: 0 }
    const grindA = createDiceGrindFn(formula, 42)
    const grindB = createDiceGrindFn(formula, 999)

    const batchA = grindA(100)
    const batchB = grindB(100)

    // Very unlikely all 100 match
    const matches = batchA.filter((a, i) => a.total === batchB[i].total).length
    expect(matches).toBeLessThan(100)
  })
})
