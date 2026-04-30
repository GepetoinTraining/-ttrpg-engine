/**
 * MF_POOL_DICE — Self-Replenishing Pre-Rolled d20s
 * ==================================================
 * 
 * The atomic proof of the Marble Machine.
 * 
 * ECONOMICS:
 *   roll()          → grind 2, use 1, recycle 1  → net 0  (FREE)
 *   rollAdvantage() → grind 2, use both           → net -2 (COSTS pool)
 *   rollDisadvantage() → same as advantage        → net -2 (COSTS pool)
 *   tick()          → refill to capacity           → net +N (BONUS)
 * 
 * Every normal roll is self-sustaining. The pool only shrinks on
 * advantage/disadvantage. tick() is bonus headroom, not a lifeline.
 * 
 * This wraps MFPool<DiceResult> with dice-specific grind functions
 * and provides convenience methods for common D&D dice operations.
 */

import { MFPool, type PoolConfig } from './mf-pool.js'
import { mfDice, type DiceFormula, type DiceResult, type DiceReceipt } from './mf-dice.js'

// ============================================================
// DICE POOL CONFIGURATION
// ============================================================

/** Default pool sizes by die type */
export const POOL_SIZES = {
  d20: 1000,   // Attack rolls, saves, checks — high volume
  d12: 200,    // Greataxe damage, barbarian HD
  d10: 300,    // Many weapon damages, percentile
  d8: 400,     // Longsword, healing
  d6: 500,     // Fireball, sneak attack — very high volume
  d4: 200,     // Magic missile, small heals
  d100: 100,   // Percentile rolls — low frequency
} as const

// ============================================================
// GRIND FUNCTIONS — The MF that produces items
// ============================================================

/**
 * Create a grind function for a specific dice formula.
 * Uses sequential seeds to ensure every batch is unique.
 * 
 * @param formula - The dice formula to roll
 * @param baseSeed - Base seed for this grind cycle (use worldDay * prime)
 */
export function createDiceGrindFn(
  formula: DiceFormula,
  baseSeed: number,
): (count: number) => DiceResult[] {
  let seedOffset = 0

  return (count: number): DiceResult[] => {
    const results: DiceResult[] = []
    for (let i = 0; i < count; i++) {
      const seed = baseSeed + seedOffset
      seedOffset++
      const { output } = mfDice(formula, seed)
      results.push(output)
    }
    return results
  }
}

// ============================================================
// DICE POOL — Typed wrapper around MFPool<DiceResult>
// ============================================================

export class DicePool {
  private pool: MFPool<DiceResult>
  private formula: DiceFormula
  private seedCounter: number

  /**
   * Create a new dice pool.
   * 
   * @param sides - Number of sides on the die
   * @param ownerId - Which MM owns this pool (e.g. 'adventure_01')
   * @param capacity - Pool depth (defaults from POOL_SIZES)
   * @param worldDay - Current world day for seed generation
   */
  constructor(
    sides: number,
    ownerId: string,
    capacity?: number,
    worldDay: number = 0,
  ) {
    const defaultCapacity = (POOL_SIZES as Record<string, number>)[`d${sides}`] ?? 200

    const config: PoolConfig = {
      id: `pool_d${sides}_${ownerId}`,
      type: `d${sides}`,
      capacity: capacity ?? defaultCapacity,
      ownerId,
    }

    this.formula = { count: 1, sides, modifier: 0 }
    this.pool = new MFPool<DiceResult>(config, worldDay)
    this.seedCounter = worldDay * 7919 // prime seed base

    // Initial grind — fill the pool
    this.pool.grind(
      createDiceGrindFn(this.formula, this.seedCounter),
      config.capacity,
      worldDay,
    )
    this.seedCounter += config.capacity
  }

  // ──────────────────────────────
  // SELECT — Get a pre-rolled die
  // ──────────────────────────────

  /**
   * Pop the next pre-rolled die result — O(1).
   * 
   * The MF perpetual motion: every roll grinds 2 fresh dice,
   * uses 1, and recycles the other back into the pool.
   * Net consumption = 0. The pool only grows.
   */
  roll(): DiceResult {
    // Grind 2 fresh dice into the pool
    this.seedCounter++
    this.pool.grind(
      createDiceGrindFn(this.formula, this.seedCounter),
      2,
    )
    this.seedCounter += 2

    // Select 1 for the caller — the other stays in the pool
    return this.pool.select()
  }

  /**
   * Pop N pre-rolled dice at once.
   * Grinds 2×N, selects N, recycles N.
   */
  rollMany(count: number): DiceResult[] {
    // Grind 2 per die needed
    this.seedCounter++
    this.pool.grind(
      createDiceGrindFn(this.formula, this.seedCounter),
      count * 2,
    )
    this.seedCounter += count * 2

    return this.pool.selectMany(count)
  }

  /**
   * Roll with a modifier applied on top.
   * Uses the MF perpetual motion (grind 2, use 1, recycle 1).
   */
  rollWithModifier(modifier: number): DiceResult {
    const base = this.roll()
    return {
      ...base,
      modifier,
      total: base.sum + modifier,
      formula: `1d${this.formula.sides}${modifier >= 0 ? '+' : ''}${modifier}`,
    }
  }

  /**
   * Roll with advantage (take higher of two).
   * This is the ONLY operation that actually costs the pool:
   * grinds 2, takes BOTH. Net = -2 from pool.
   */
  rollAdvantage(modifier: number = 0): { chosen: DiceResult; discarded: DiceResult } {
    // Grind 2, but take BOTH — this drains the pool
    this.seedCounter++
    this.pool.grind(
      createDiceGrindFn(this.formula, this.seedCounter),
      2,
    )
    this.seedCounter += 2
    const a = this.pool.select()
    const b = this.pool.select()
    const higher = a.sum >= b.sum ? a : b
    const lower = a.sum >= b.sum ? b : a

    return {
      chosen: {
        ...higher,
        modifier,
        total: higher.sum + modifier,
        formula: `1d${this.formula.sides}(adv)${modifier >= 0 ? '+' : ''}${modifier}`,
      },
      discarded: lower,
    }
  }

  /**
   * Roll with disadvantage (take lower of two).
   * Like advantage: grinds 2, takes BOTH. Net = -2 from pool.
   */
  rollDisadvantage(modifier: number = 0): { chosen: DiceResult; discarded: DiceResult } {
    // Grind 2, take BOTH
    this.seedCounter++
    this.pool.grind(
      createDiceGrindFn(this.formula, this.seedCounter),
      2,
    )
    this.seedCounter += 2
    const a = this.pool.select()
    const b = this.pool.select()
    const lower = a.sum <= b.sum ? a : b
    const higher = a.sum <= b.sum ? b : a

    return {
      chosen: {
        ...lower,
        modifier,
        total: lower.sum + modifier,
        formula: `1d${this.formula.sides}(dis)${modifier >= 0 ? '+' : ''}${modifier}`,
      },
      discarded: higher,
    }
  }

  // ──────────────────────────────
  // REFILL — The clockwork tick
  // ──────────────────────────────

  /** Refill the pool on tick. Compacts consumed, grinds fresh. */
  tick(worldDay: number): void {
    this.seedCounter = worldDay * 7919
    this.pool.refill(
      createDiceGrindFn(this.formula, this.seedCounter),
      worldDay,
    )
    this.seedCounter += this.pool.depth()
  }

  // ──────────────────────────────
  // STATE — monitoring
  // ──────────────────────────────

  /** Items remaining in pool */
  depth(): number { return this.pool.depth() }
  /** Is pool getting low? */
  isLow(): boolean { return this.pool.isLow() }
  /** Is pool empty? */
  isEmpty(): boolean { return this.pool.isEmpty() }
  /** Get pool stats */
  getState() { return this.pool.getState() }
}

// ============================================================
// FACTORY — Create a standard set of pools
// ============================================================

/**
 * Create the standard D&D dice pools for a session.
 * One pool per common die type, all pre-filled.
 */
export function createDicePools(
  ownerId: string,
  worldDay: number = 0,
): Map<string, DicePool> {
  const pools = new Map<string, DicePool>()
  const dieTypes = [4, 6, 8, 10, 12, 20, 100]

  for (const sides of dieTypes) {
    pools.set(`d${sides}`, new DicePool(sides, ownerId, undefined, worldDay))
  }

  return pools
}
