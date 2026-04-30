/**
 * MM_INFRASTRUCTURE — Layer 4 ISimulatedMM adapter for infrastructure-mm.ts
 * ============================================================================
 *
 * One MMInfrastructure per settlement's `InfrastructureState`. Owns the
 * settlement's KnowledgePool (so DON'T register a separate MMKnowledgePool
 * against the same pool — you'd double-tick). Lives at the hub node.
 * Ticks monthly. Each resolve folds N months of `tickInfrastructure`:
 *
 *   1. Knowledge pool tick (scan, activate, cascade)
 *   2. Sync unlocked workshops/recipes/commodities into the settlement
 *   3. Evaluate which professions can now exist; instantiate one of each
 *   4. Check guild formation rules (≥3 masters of a trade → guild forms)
 *   5. Score development; check for tier advancement
 *
 * Slow-life: as the player works the slow-life loop (extracting,
 * crafting, studying), seeds get injected via the helpers in
 * infrastructure-mm.ts (`injectExplorationSeeds`, `injectTradeSeeds`,
 * `injectPlayerDiscovery`). MMInfrastructure ticks then turn those seeds
 * into new infrastructure: a new alchemy lab, a new mason's guild, a new
 * recipe. The world develops because the player worked.
 *
 * Cadence: monthly. Layer: 4 (SETTLEMENT).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  tickInfrastructure,
  type InfrastructureState,
  type InfrastructureTickResult,
} from './infrastructure-mm.js'
import type { TP, InfrastructureRules } from './tp.js'

export interface MMInfrastructureDomainState {
  state: InfrastructureState
  cumulative: {
    monthsTicked: number
    professionsAdded: number
    guildsFormed: number
    workshopsAdded: number
    commoditiesAdded: number
    developmentDelta: number
  }
  lastTick: InfrastructureTickResult | null
}

export interface MMInfrastructureOptions {
  getD20s?: (worldDay: number, count: number) => number[]
  name?: string
}

export class MMInfrastructure extends SimulatedMMBase {
  domain: MMInfrastructureDomainState
  private getD20s: (worldDay: number, count: number) => number[]

  constructor(
    state: InfrastructureState,
    worldDay: number = 0,
    opts: MMInfrastructureOptions = {},
  ) {
    super(`infrastructure:${state.hubId}`, opts.name ?? `Infra:${state.hubName}`,
          state.hubId, 'infrastructure', worldDay)
    this.domain = {
      state,
      cumulative: {
        monthsTicked: 0,
        professionsAdded: 0,
        guildsFormed: 0,
        workshopsAdded: 0,
        commoditiesAdded: 0,
        developmentDelta: 0,
      },
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
    // O(1). Knowledge scanning + profession evaluation in resolve.
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
        narrative: `${this.state.name} (${daysResolved}d): less than a month — no infrastructure tick.`,
        additionalEvents: [],
      }
    }

    let totalProfessions = 0
    let totalGuilds = 0
    let totalWorkshops = 0
    let totalCommodities = 0
    let totalDevDelta = 0
    let lastTick: InfrastructureTickResult | null = null

    for (let m = 0; m < months; m++) {
      const d20s = this.getD20s(worldDay + m * 30, 32)
      const result = tickInfrastructure(this.domain.state, worldDay + m * 30, d20s)
      lastTick = result
      totalProfessions += result.newProfessions.length
      totalGuilds += result.newGuilds.length
      totalWorkshops += result.newWorkshops.length
      totalCommodities += result.newCommodities.length
      totalDevDelta += result.developmentDelta
    }

    this.domain.cumulative.monthsTicked += months
    this.domain.cumulative.professionsAdded += totalProfessions
    this.domain.cumulative.guildsFormed += totalGuilds
    this.domain.cumulative.workshopsAdded += totalWorkshops
    this.domain.cumulative.commoditiesAdded += totalCommodities
    this.domain.cumulative.developmentDelta += totalDevDelta
    this.domain.lastTick = lastTick

    // ── κ.infrastructure writes at hub ──
    if (tp) {
      const professions: Record<string, { count: number; tier: string; guildId: string | null }> = {}
      for (const [role, count] of this.domain.state.activeProfessions) {
        professions[role] = { count, tier: 'basic', guildId: null }
      }
      const buildings: Record<string, { count: number; condition: string }> = {}
      for (const w of this.domain.state.workshops) {
        buildings[w] = { count: 1, condition: 'good' }
      }
      const infrastructure: InfrastructureRules = {
        professions,
        buildings,
        knowledgeTier: this.domain.state.knowledgePool.realizedPotentials.length >= 5 ? 2 : 1,
        workshops: this.domain.state.workshops,
        recipes: this.domain.state.recipes,
      }
      tp.writeDomain(this.state.nodeId, 'infrastructure', infrastructure)
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${months} mo): ` +
      `${this.domain.state.activeProfessions.size} professions, ` +
      `${this.domain.state.workshops.length} workshops, ` +
      `${this.domain.state.formedGuilds.length} guilds, ` +
      `tier ${this.domain.state.tier}, ` +
      `+${totalProfessions} professions / ${totalGuilds} guilds / ${totalWorkshops} workshops this resolve.`

    return {
      stateChanges: {
        monthsTicked: months,
        professionsAdded: totalProfessions,
        guildsFormed: totalGuilds,
        workshopsAdded: totalWorkshops,
        commoditiesAdded: totalCommodities,
        developmentDelta: totalDevDelta,
        tier: this.domain.state.tier,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMInfrastructureDomainState {
    return {
      state: {
        ...this.domain.state,
        activeProfessions: new Map(this.domain.state.activeProfessions),
        formedGuilds: [...this.domain.state.formedGuilds],
        workshops: [...this.domain.state.workshops],
        recipes: [...this.domain.state.recipes],
        commodities: [...this.domain.state.commodities],
        specializations: [...this.domain.state.specializations],
      },
      cumulative: { ...this.domain.cumulative },
      lastTick: this.domain.lastTick ? { ...this.domain.lastTick } : null,
    }
  }

  /** Convenience: peek the underlying state. */
  getInfrastructure(): InfrastructureState {
    return this.domain.state
  }
}
