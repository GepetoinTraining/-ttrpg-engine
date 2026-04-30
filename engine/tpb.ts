/**
 * TPB — Backward Topology (Session History)
 * ==========================================
 * 
 * The .tpb is append-only. Entries are never modified or deleted.
 * Every transformation is recorded. Every state is a checkpoint.
 * 
 * Properties:
 *   - Append-only: history only grows
 *   - Every entry is a resumable checkpoint
 *   - branch(t) — fork from any point in history
 *   - diff(A, B) — find where two histories diverge
 * 
 * For TTRPG:
 *   - Each combat round appends entries
 *   - Each session is a contiguous section of the .tpb
 *   - "What if?" scenarios = branch from a point
 *   - Multi-table play = diff two .tpbs to find convergence
 */

import { z } from 'zod'

// ============================================================
// TPB ENTRY — A single entry in the history
// ============================================================

export const TPBEntrySchema = z.object({
  /** Monotonically increasing index */
  index: z.number().int().nonnegative(),
  /** The transformation that was applied (null for initial state) */
  action: z.unknown().nullable(),
  /** The complete state after this transformation */
  stateSnapshot: z.unknown(),
  /** Receipt chain proving legality (optional for non-MF entries) */
  receipts: z.array(z.unknown()).default([]),
  /** Aggregate delta from this entry */
  delta: z.object({
    potential: z.number(),
    archival: z.number(),
    omega: z.number(),
  }).optional(),
  /** Session ID (groups entries into sessions) */
  sessionId: z.string().optional(),
  /** Human-readable description */
  description: z.string().optional(),
  /** Timestamp */
  timestamp: z.number(),
})
export type TPBEntry = z.infer<typeof TPBEntrySchema>

// ============================================================
// TPB — The backward topology
// ============================================================

export class TPB<TState = unknown, TAction = unknown> {
  private entries: TPBEntry[] = []
  private branchPoint: number | null = null

  /**
   * Create a new TPB with an initial state.
   */
  static create<S, A>(initialState: S, sessionId?: string): TPB<S, A> {
    const tpb = new TPB<S, A>()
    tpb.entries.push({
      index: 0,
      action: null,
      stateSnapshot: initialState,
      receipts: [],
      timestamp: Date.now(),
      sessionId,
      description: 'initial state',
    })
    return tpb
  }

  /**
   * Append a new entry to the .tpb.
   * The only mutation allowed — and it only ever grows.
   */
  append(
    action: TAction,
    stateAfter: TState,
    options?: {
      receipts?: unknown[]
      delta?: { potential: number; archival: number; omega: number }
      sessionId?: string
      description?: string
    },
  ): TPBEntry {
    const entry: TPBEntry = {
      index: this.entries.length,
      action,
      stateSnapshot: stateAfter,
      receipts: options?.receipts ?? [],
      delta: options?.delta,
      sessionId: options?.sessionId,
      description: options?.description,
      timestamp: Date.now(),
    }
    this.entries.push(entry)
    return entry
  }

  /**
   * Get current state (latest entry's snapshot).
   */
  currentState(): TState {
    return this.entries[this.entries.length - 1].stateSnapshot as TState
  }

  /**
   * Get state at any point in history.
   */
  stateAt(index: number): TState | null {
    const entry = this.entries[index]
    return entry ? (entry.stateSnapshot as TState) : null
  }

  /**
   * Get all entries.
   */
  history(): readonly TPBEntry[] {
    return this.entries
  }

  /**
   * Get entry count.
   */
  length(): number {
    return this.entries.length
  }

  /**
   * Branch — fork from a point in history.
   * Creates a new TPB starting from the state at `fromIndex`.
   * The original TPB is unchanged (immutable history).
   */
  branch(fromIndex: number, sessionId?: string): TPB<TState, TAction> | null {
    const state = this.stateAt(fromIndex)
    if (state === null) return null

    const branched = TPB.create<TState, TAction>(state, sessionId)
    branched.branchPoint = fromIndex
    return branched
  }

  /**
   * Get the branch point (if this TPB was branched from another).
   */
  getBranchPoint(): number | null {
    return this.branchPoint
  }

  /**
   * Diff — find where two TPBs diverge.
   * Returns the index of the first entry where states differ.
   * If one is a prefix of the other, returns the length of the shorter one.
   */
  static diff<S, A>(a: TPB<S, A>, b: TPB<S, A>): {
    divergenceIndex: number
    aLength: number
    bLength: number
    commonPrefix: number
  } {
    const minLen = Math.min(a.entries.length, b.entries.length)
    let divergence = minLen

    for (let i = 0; i < minLen; i++) {
      const stateA = JSON.stringify(a.entries[i].stateSnapshot)
      const stateB = JSON.stringify(b.entries[i].stateSnapshot)
      if (stateA !== stateB) {
        divergence = i
        break
      }
    }

    return {
      divergenceIndex: divergence,
      aLength: a.entries.length,
      bLength: b.entries.length,
      commonPrefix: divergence,
    }
  }

  /**
   * Get entries for a specific session.
   */
  session(sessionId: string): TPBEntry[] {
    return this.entries.filter(e => e.sessionId === sessionId)
  }

  /**
   * Get aggregate delta across a range of entries.
   */
  aggregateDelta(fromIndex: number, toIndex?: number): { potential: number; archival: number; omega: number } {
    const end = toIndex ?? this.entries.length
    const result = { potential: 0, archival: 0, omega: 0 }

    for (let i = fromIndex; i < end; i++) {
      const delta = this.entries[i]?.delta
      if (delta) {
        result.potential += delta.potential
        result.archival += delta.archival
        result.omega += delta.omega
      }
    }

    return result
  }

  /**
   * Serialize the entire TPB to JSON.
   */
  toJSON(): { entries: TPBEntry[]; branchPoint: number | null } {
    return {
      entries: this.entries,
      branchPoint: this.branchPoint,
    }
  }

  /**
   * Deserialize from JSON.
   */
  static fromJSON<S, A>(data: { entries: TPBEntry[]; branchPoint: number | null }): TPB<S, A> {
    const tpb = new TPB<S, A>()
    tpb.entries = data.entries
    tpb.branchPoint = data.branchPoint
    return tpb
  }
}
