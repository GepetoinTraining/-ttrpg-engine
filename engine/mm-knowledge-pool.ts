/**
 * MM_KNOWLEDGE_POOL — Layer 4 ISimulatedMM adapter for knowledge-pool.ts
 * ========================================================================
 *
 * One MMKnowledgePool per KnowledgePool (per hub OR per institution like
 * a temple/library/monastery). Lives at the pool's hub node. Ticks
 * monthly. Each resolve folds N months of `tickKnowledgePool`:
 *
 *   1. Scan for realizable potentials (combinations of available seeds +
 *      roles + commodities + population + trade)
 *   2. Roll d20 per realizable potential against its activationDC
 *   3. Activated potentials unlock new workshops / recipes / roles /
 *      commodities AND may seed cascade discoveries
 *   4. Cascade pass — newly-seeded potentials may activate the same tick
 *
 * Note on coexistence with MMInfrastructure: tickInfrastructure ALSO
 * calls tickKnowledgePool internally. If a settlement has both an
 * MMInfrastructure and an MMKnowledgePool registered against the SAME
 * pool, you'll double-tick. Use MMKnowledgePool when there's a pool
 * without full infrastructure (a lone library, a wandering scholar's
 * notebook, a planar archive); use MMInfrastructure for settlements.
 *
 * Cadence: monthly. Layer: 4 (SETTLEMENT).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  tickKnowledgePool,
  STANDARD_POTENTIALS,
  type KnowledgePool,
  type HubContext,
  type KnowledgeTickResult,
  type InfrastructurePotential,
} from './knowledge-pool.js'
import type { TP, KnowledgeRules } from './tp.js'

export interface MMKnowledgePoolDomainState {
  pool: KnowledgePool
  /** Per-hub context for activation gates (population, trade, NPC roles). */
  hubContext: HubContext
  /** Custom potential set; defaults to STANDARD_POTENTIALS. */
  potentials: InfrastructurePotential[]
  cumulative: {
    monthsTicked: number
    totalActivations: number
    totalCascadeSeeds: number
  }
  lastTick: KnowledgeTickResult | null
}

export interface MMKnowledgePoolOptions {
  /** d20 source for activation rolls. Default: deterministic. */
  getD20s?: (worldDay: number, count: number) => number[]
  /** Custom potential set. Default: STANDARD_POTENTIALS. */
  potentials?: InfrastructurePotential[]
  name?: string
}

export class MMKnowledgePool extends SimulatedMMBase {
  domain: MMKnowledgePoolDomainState
  private getD20s: (worldDay: number, count: number) => number[]

  constructor(
    pool: KnowledgePool,
    hubContext: HubContext,
    worldDay: number = 0,
    opts: MMKnowledgePoolOptions = {},
  ) {
    super(`knowledge:${pool.hubId}`, opts.name ?? `Knowledge:${pool.hubId}`,
          pool.hubId, 'knowledge', worldDay)
    this.domain = {
      pool,
      hubContext,
      potentials: opts.potentials ?? STANDARD_POTENTIALS,
      cumulative: { monthsTicked: 0, totalActivations: 0, totalCascadeSeeds: 0 },
      lastTick: null,
    }
    this.getD20s = opts.getD20s ?? ((day, count) => {
      const out: number[] = []
      for (let i = 0; i < count; i++) {
        out.push((((day + i) * 1664525 + 1013904223) >>> 0) % 20 + 1)
      }
      return out
    })
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). All scanning + activation in resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const months = Math.floor(daysResolved / 30)
    if (months === 0) {
      return {
        stateChanges: { monthsTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a month — no scan.`,
        additionalEvents: [],
      }
    }

    let totalActivations = 0
    let totalCascade = 0
    let lastTick: KnowledgeTickResult | null = null

    for (let m = 0; m < months; m++) {
      // 32 d20s should be plenty for any single tick (most ticks use 0-10).
      const d20s = this.getD20s(worldDay + m * 30, 32)
      const result = tickKnowledgePool(
        this.domain.pool, this.domain.hubContext, worldDay + m * 30,
        d20s, this.domain.potentials,
      )
      lastTick = result
      totalActivations += result.totalActivations
      totalCascade += result.cascadeSeeds.length
    }

    this.domain.cumulative.monthsTicked += months
    this.domain.cumulative.totalActivations += totalActivations
    this.domain.cumulative.totalCascadeSeeds += totalCascade
    this.domain.lastTick = lastTick

    // ── κ.knowledge writes at hub node ──
    if (tp) {
      const seedMap: Record<string, { category: string; source: string; activatedDay: number | null }> = {}
      for (const seed of this.domain.pool.seeds) {
        seedMap[seed.id] = {
          category: seed.category,
          source: seed.source,
          // KnowledgeSeed tracks discoveredOnDay; the κ schema uses activatedDay
          // for the same semantic (the day this seed entered the hub).
          activatedDay: seed.discoveredOnDay,
        }
      }
      const knowledge: KnowledgeRules = {
        seeds: seedMap,
        potentials: this.domain.pool.realizedPotentials,
        tier: tierFromActivations(this.domain.pool.totalActivations),
      }
      tp.writeDomain(this.state.nodeId, 'knowledge', knowledge)
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${months} mo): ` +
      `${this.domain.pool.seeds.length} seeds, ` +
      `${this.domain.pool.realizedPotentials.length} realized, ` +
      `+${totalActivations} this resolve` +
      (totalCascade > 0 ? `, ${totalCascade} cascade seeds` : '') +
      `.`

    return {
      stateChanges: {
        monthsTicked: months,
        seedsTotal: this.domain.pool.seeds.length,
        potentialsRealized: this.domain.pool.realizedPotentials.length,
        activationsThisResolve: totalActivations,
        cascadeSeeds: totalCascade,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMKnowledgePoolDomainState {
    return {
      pool: { ...this.domain.pool, seeds: [...this.domain.pool.seeds] },
      hubContext: { ...this.domain.hubContext },
      potentials: this.domain.potentials,  // shared reference, immutable
      cumulative: { ...this.domain.cumulative },
      lastTick: this.domain.lastTick ? { ...this.domain.lastTick } : null,
    }
  }

  /** Convenience: peek the pool. */
  getPool(): KnowledgePool {
    return this.domain.pool
  }

  /** Update hub context (e.g. population grew, trade route opened). */
  setHubContext(ctx: HubContext): void {
    this.domain.hubContext = ctx
  }
}

// ── Helpers ──

/** Map total activation count → 0-5 tier (matches κ.knowledge.tier). */
function tierFromActivations(activations: number): number {
  if (activations >= 30) return 5
  if (activations >= 18) return 4
  if (activations >= 10) return 3
  if (activations >= 5) return 2
  if (activations >= 1) return 1
  return 0
}
