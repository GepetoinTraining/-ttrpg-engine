/**
 * MF_POOL — The Marble Machine Track
 * ====================================
 * 
 * Pre-compute MORE outcomes than anyone will observe.
 * When observation happens: SELECT from the pool — O(1).
 * When the clockwork ticks: GRIND new outcomes into the pool.
 * 
 * The pool never empties. Production always outpaces consumption.
 * 
 * Three phases:
 *   GRIND  — on tick, produce N items into the pool
 *   SELECT — on observation, pop next item O(1)
 *   REFILL — on tick, from excess + new seed, fill back up
 * 
 * Pool = MFⁿ — a manifold of pre-computed MF outputs.
 * The pool itself is an MF: it has κ (capacity, type) and x (current items).
 */

import { z } from 'zod'

// ============================================================
// POOL CONFIGURATION — κ (the constant)
// ============================================================

export const PoolConfigSchema = z.object({
  /** Unique identifier for this pool */
  id: z.string(),
  /** What kind of items this pool produces */
  type: z.string(),
  /** Target pool depth — how many items to maintain */
  capacity: z.number().int().min(1),
  /** Which MM owns this pool */
  ownerId: z.string(),
})
export type PoolConfig = z.infer<typeof PoolConfigSchema>

// ============================================================
// POOL STATE
// ============================================================

export const PoolStateSchema = z.object({
  config: PoolConfigSchema,
  /** World day when this pool was last ground */
  computedAt: z.number().int(),
  /** Total items produced since creation */
  totalProduced: z.number().int().nonnegative(),
  /** Total items consumed since creation */
  totalConsumed: z.number().int().nonnegative(),
  /** Current cursor position (next item to select) */
  cursor: z.number().int().nonnegative(),
})
export type PoolState = z.infer<typeof PoolStateSchema>

// ============================================================
// MF_POOL — The generic pool
// ============================================================

/**
 * MFPool<T> — A pre-computed outcome pool.
 * 
 * Generic over the item type T. Each pool:
 *   - Stores items in a ring buffer (array with cursor)
 *   - GRIND pushes new items to the back
 *   - SELECT pops from cursor position (O(1))
 *   - Never blocks — if pool runs low, it's a bug in tick scheduling
 * 
 * The grindFn is the MF that produces items.
 * Different pools use different grindFns (dice, events, prices, etc.)
 */
export class MFPool<T> {
  private items: T[] = []
  private state: PoolState

  /**
   * @param config - Pool configuration (κ)
   * @param worldDay - Current world day
   */
  constructor(config: PoolConfig, worldDay: number = 0) {
    this.state = {
      config,
      computedAt: worldDay,
      totalProduced: 0,
      totalConsumed: 0,
      cursor: 0,
    }
  }

  // ──────────────────────────────
  // GRIND — produce items
  // ──────────────────────────────

  /**
   * Grind new items into the pool.
   * 
   * @param grindFn - Function that produces N items
   * @param count - How many to produce (defaults to capacity)
   * @param worldDay - Current world day
   */
  grind(grindFn: (count: number) => T[], count?: number, worldDay?: number): void {
    const n = count ?? this.state.config.capacity
    const produced = grindFn(n)
    
    // Append to items array (items beyond cursor are unconsumed)
    this.items.push(...produced)
    this.state.totalProduced += produced.length
    
    if (worldDay !== undefined) {
      this.state.computedAt = worldDay
    }
  }

  // ──────────────────────────────
  // SELECT — consume one item O(1)
  // ──────────────────────────────

  /**
   * Select the next item from the pool.
   * O(1) — just advances the cursor.
   * 
   * @returns The next pre-computed item
   * @throws If pool is exhausted (should never happen with proper tick scheduling)
   */
  select(): T {
    if (this.state.cursor >= this.items.length) {
      throw new Error(
        `Pool ${this.state.config.id} exhausted! ` +
        `cursor=${this.state.cursor}, items=${this.items.length}. ` +
        `Tick scheduling bug — grind rate < consumption rate.`
      )
    }
    
    const item = this.items[this.state.cursor]
    this.state.cursor++
    this.state.totalConsumed++
    return item
  }

  /**
   * Select N items from the pool at once.
   */
  selectMany(count: number): T[] {
    const results: T[] = []
    for (let i = 0; i < count; i++) {
      results.push(this.select())
    }
    return results
  }

  // ──────────────────────────────
  // REFILL — compact and replenish
  // ──────────────────────────────

  /**
   * Refill the pool: discard consumed items, grind new ones.
   * Called on tick to maintain pool depth.
   * 
   * @param grindFn - Function that produces items
   * @param worldDay - Current world day
   */
  refill(grindFn: (count: number) => T[], worldDay: number): void {
    // Compact: remove consumed items behind cursor
    this.items = this.items.slice(this.state.cursor)
    this.state.cursor = 0

    // Calculate how many to grind to reach capacity
    const deficit = this.state.config.capacity - this.items.length
    if (deficit > 0) {
      this.grind(grindFn, deficit, worldDay)
    } else {
      this.state.computedAt = worldDay
    }
  }

  // ──────────────────────────────
  // STATE — monitoring the marble track
  // ──────────────────────────────

  /** Items remaining (not yet consumed) */
  depth(): number {
    return this.items.length - this.state.cursor
  }

  /** Is the pool getting dangerously low? (< 10% remaining) */
  isLow(): boolean {
    return this.depth() < this.state.config.capacity * 0.1
  }

  /** Is the pool exhausted? */
  isEmpty(): boolean {
    return this.state.cursor >= this.items.length
  }

  /** Consumption rate: items consumed / items produced */
  consumptionRate(): number {
    if (this.state.totalProduced === 0) return 0
    return this.state.totalConsumed / this.state.totalProduced
  }

  /** Get the full pool state for persistence */
  getState(): PoolState {
    return { ...this.state }
  }

  /** Get remaining items (for serialization) */
  getItems(): T[] {
    return this.items.slice(this.state.cursor)
  }

  /** Peek at the next item without consuming */
  peek(): T | undefined {
    if (this.state.cursor >= this.items.length) return undefined
    return this.items[this.state.cursor]
  }

  /** Get pool identity */
  get id(): string { return this.state.config.id }
  get type(): string { return this.state.config.type }
  get ownerId(): string { return this.state.config.ownerId }

  // ──────────────────────────────
  // HYDRATE — restore from storage
  // ──────────────────────────────

  /**
   * Restore a pool from persisted state + items.
   * Used when loading from Turso.
   */
  static fromPersisted<T>(state: PoolState, items: T[]): MFPool<T> {
    const pool = new MFPool<T>(state.config, state.computedAt)
    pool.items = items
    // Items are already the unconsumed slice, so cursor resets to 0
    pool.state = { ...state, cursor: 0 }
    return pool
  }
}
