/**
 * MM_SIMULATED — The Marble Machine Interface
 * ==============================================
 * 
 * Every world-tree MM implements this interface.
 * Two methods, two costs:
 * 
 *   accumulatePotential(days)  — CHEAP O(1), runs for ALL instances on tick
 *   resolve()                  — EXPENSIVE O(n), runs ONLY when observed
 * 
 * The world is always ahead of the players.
 * Potential accumulates silently.
 * Resolution happens only on observation.
 * 
 * This is the Marble Machine's clockwork mechanism.
 * The gears turn whether anyone is watching or not.
 * But the marbles only fall when someone looks.
 */

import { z } from 'zod'
import { type TP } from './tp'

// ============================================================
// PENDING DELTA — Accumulated potential between ticks
// ============================================================

/**
 * PendingDelta — the potential that has accumulated.
 * 
 * Each field accumulates linearly with time.
 * resolve() collapses this into actual state changes.
 * 
 * Shape varies per MM type, but the pattern is:
 *   Δ = rate × days
 *   with floor/ceiling clamps per domain
 */
export const PendingDeltaSchema = z.object({
  /** Accumulated world-days of unresolved simulation */
  daysPending: z.number().nonnegative(),
  /** Key-value pairs of pending changes */
  deltas: z.record(z.string(), z.number()),
  /** Pending events (rolled during accumulation, revealed on resolve) */
  pendingEvents: z.array(z.object({
    day: z.number().int(),
    type: z.string(),
    magnitude: z.number(),
    description: z.string(),
  })),
})
export type PendingDelta = z.infer<typeof PendingDeltaSchema>

export const EMPTY_PENDING: PendingDelta = {
  daysPending: 0,
  deltas: {},
  pendingEvents: [],
}

// ============================================================
// RESOLVE RESULT — What observation produces
// ============================================================

export const ResolveResultSchema = z.object({
  /** The MM that was resolved */
  mmId: z.string(),
  /** World day of resolution */
  resolvedAt: z.number().int(),
  /** Days that were collapsed */
  daysResolved: z.number().nonnegative(),
  /** State changes applied */
  stateChanges: z.record(z.string(), z.number()),
  /** Events that occurred during the gap */
  events: z.array(z.object({
    day: z.number().int(),
    type: z.string(),
    magnitude: z.number(),
    description: z.string(),
  })),
  /** Narrative summary for GM/player consumption */
  narrative: z.string(),
})
export type ResolveResult = z.infer<typeof ResolveResultSchema>

// ============================================================
// SIMULATED MM STATE — Shared state for all world-tree MMs
// ============================================================

export const SimulatedMMStateSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  /** Human-readable name */
  name: z.string(),
  /** Which .tp node this MM is placed at */
  nodeId: z.string(),
  /** MM type for dispatch */
  mmType: z.string(),
  /** World day of last tick (potential accumulated up to this point) */
  lastTick: z.number().int().nonnegative(),
  /** World day of last observation (resolved up to this point) */
  lastResolved: z.number().int().nonnegative(),
  /** Has this MM been observed since creation? */
  isResolved: z.boolean(),
  /** Accumulated unresolved potential */
  pendingPotential: PendingDeltaSchema,
})
export type SimulatedMMState = z.infer<typeof SimulatedMMStateSchema>

// ============================================================
// SIMULATED MM — The interface
// ============================================================

/**
 * SimulatedMM — Every world-tree MM implements this.
 * 
 * The two-method contract:
 * 
 * accumulatePotential(days):
 *   Called on EVERY tick for ALL instances.
 *   Must be O(1) — no complex computation.
 *   Just: delta += rate × days
 *   Runs server-side, unobserved, silently.
 * 
 * resolve(worldDay):
 *   Called ONLY when a player observes this MM.
 *   Collapses pending potential into actual state.
 *   Generates events for the gap period.
 *   Returns narrative for GM/player.
 *   Resets pending potential to zero.
 */
export interface ISimulatedMM {
  /** The underlying state (for persistence) */
  state: SimulatedMMState

  /**
   * CHEAP — O(1), runs every tick for ALL instances.
   * Accumulates potential change without resolving.
   * 
   * @param days - Days since last tick
   * @param worldDay - Current world day
   * @param tp - World topology for κ read/write
   */
  accumulatePotential(days: number, worldDay: number, tp?: TP): void

  /**
   * EXPENSIVE — O(complexity), runs ONLY when observed.
   * Collapses accumulated potential into actual state changes.
   * Generates events, updates state, produces narrative.
   * 
   * @param worldDay - World day of observation
   * @param tp - World topology for κ read/write
   * @returns Result of collapsing the pending potential
   */
  resolve(worldDay: number, tp?: TP): ResolveResult

  /**
   * How many days of unresolved potential?
   */
  pendingDays(): number

  /**
   * Serialize for persistence (Turso).
   */
  serialize(): { state: SimulatedMMState; domain: unknown }
}

// ============================================================
// BASE CLASS — Shared implementation
// ============================================================

/**
 * SimulatedMMBase — Default implementation of shared behavior.
 * 
 * Concrete MMs (settlement, economy, faction...) extend this
 * and implement their domain-specific accumulate/resolve logic.
 */
export abstract class SimulatedMMBase implements ISimulatedMM {
  state: SimulatedMMState

  constructor(
    id: string,
    name: string,
    nodeId: string,
    mmType: string,
    worldDay: number = 0,
  ) {
    this.state = {
      id,
      name,
      nodeId,
      mmType,
      lastTick: worldDay,
      lastResolved: worldDay,
      isResolved: false,
      pendingPotential: { ...EMPTY_PENDING, deltas: {}, pendingEvents: [] },
    }
  }

  pendingDays(): number {
    return this.state.pendingPotential.daysPending
  }

  /**
   * Default accumulate: subclasses override to add domain deltas.
   * Base just tracks daysPending.
   */
  accumulatePotential(days: number, worldDay: number, tp?: TP): void {
    this.state.pendingPotential.daysPending += days
    this.state.lastTick = worldDay
    // Subclasses add their domain-specific deltas here
    this.onAccumulate(days, worldDay, tp)
  }

  /**
   * Default resolve: subclasses override to apply domain changes.
   * Base handles bookkeeping.
   */
  resolve(worldDay: number, tp?: TP): ResolveResult {
    const daysResolved = this.state.pendingPotential.daysPending
    const events = [...this.state.pendingPotential.pendingEvents]

    // Let subclass compute domain-specific results
    const { stateChanges, narrative, additionalEvents } = this.onResolve(
      daysResolved,
      worldDay,
      tp,
    )

    // Merge events
    events.push(...additionalEvents)

    // Sort events by day
    events.sort((a, b) => a.day - b.day)

    // Reset pending
    this.state.pendingPotential = { daysPending: 0, deltas: {}, pendingEvents: [] }
    this.state.lastResolved = worldDay
    this.state.isResolved = true

    return {
      mmId: this.state.id,
      resolvedAt: worldDay,
      daysResolved,
      stateChanges,
      events,
      narrative,
    }
  }

  /**
   * Subclass hook: add domain-specific deltas during accumulation.
   */
  protected abstract onAccumulate(days: number, worldDay: number, tp?: TP): void

  /**
   * Subclass hook: compute domain-specific state changes during resolve.
   */
  protected abstract onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  }

  /**
   * Default serialization.
   */
  serialize(): { state: SimulatedMMState; domain: unknown } {
    return { state: { ...this.state }, domain: this.getDomainState() }
  }

  /**
   * Subclass hook: return domain-specific state for persistence.
   */
  protected abstract getDomainState(): unknown
}
