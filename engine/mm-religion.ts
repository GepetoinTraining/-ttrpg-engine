/**
 * MM_RELIGION — Layer 6 ISimulatedMM adapter for religion.ts
 * ==============================================================
 *
 * One MMReligion per Pantheon. Lives at the world (or continent) node
 * where the pantheon belongs. Yearly cadence. Each resolve folds N years
 * of `yearlyPantheonTick` over all deities, accumulating faith from
 * clergy + temples and recomputing power tiers.
 *
 * Writes:
 *   κ.religion at the pantheon's node:
 *     - dominant: the deity with the highest power tier
 *     - faithPool: { [deityId]: faithPool } for all deities
 *     - temples: aggregated by temple records
 *
 * Cadence: yearly. Layer: 6 (HUB SERVICES — religion is the slowest cycle
 * in the engine; gods change tier on millennial scales).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  yearlyPantheonTick,
  type Pantheon,
  type ClergyMember,
  type Temple,
  type FaithTickResult,
} from './religion'
import type { TP, ReligionRules } from './tp'

export interface MMReligionDomainState {
  pantheon: Pantheon
  clergy: ClergyMember[]
  temples: Temple[]
  cumulative: {
    yearsTicked: number
    tierChanges: number
    totalFaithAccrued: number
  }
  lastTickResults: FaithTickResult[]
}

export interface MMReligionOptions {
  clergy?: ClergyMember[]
  temples?: Temple[]
  name?: string
}

export class MMReligion extends SimulatedMMBase {
  domain: MMReligionDomainState

  constructor(
    pantheonNodeId: string,
    pantheon: Pantheon,
    worldDay: number = 0,
    opts: MMReligionOptions = {},
  ) {
    const id = `religion:${pantheonNodeId}`
    const name = opts.name ?? `Pantheon@${pantheonNodeId}`
    super(id, name, pantheonNodeId, 'religion', worldDay)
    this.domain = {
      pantheon,
      clergy: opts.clergy ?? [],
      temples: opts.temples ?? [],
      cumulative: { yearsTicked: 0, tierChanges: 0, totalFaithAccrued: 0 },
      lastTickResults: [],
    }
  }

  // ── Mutators ──

  addClergy(c: ClergyMember): void { this.domain.clergy.push(c) }
  addTemple(t: Temple): void { this.domain.temples.push(t) }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1) — divinity sleeps between observations.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const years = Math.floor(daysResolved / 360)
    if (years === 0) {
      return {
        stateChanges: { yearsTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a year — gods stir but do not move.`,
        additionalEvents: [],
      }
    }

    let totalAccrued = 0
    let tierChanges = 0
    let lastResults: FaithTickResult[] = []

    for (let y = 0; y < years; y++) {
      const results = yearlyPantheonTick(this.domain.pantheon, this.domain.clergy, this.domain.temples)
      for (const r of results) {
        totalAccrued += r.totalAccrued
        if (r.tierChanged) tierChanges++
      }
      lastResults = results
    }

    this.domain.cumulative.yearsTicked += years
    this.domain.cumulative.tierChanges += tierChanges
    this.domain.cumulative.totalFaithAccrued += totalAccrued
    this.domain.lastTickResults = lastResults

    // Write κ.religion at the pantheon's node
    if (tp) {
      const dominant = this.dominantDeity()
      const faithPool: Record<string, number> = {}
      for (const d of this.domain.pantheon.deities) {
        faithPool[d.id] = d.faithPool
      }
      const templeMap: Record<string, {
        deity?: string
        size?: 'shrine' | 'chapel' | 'temple' | 'cathedral' | 'holy_site'
        clergy?: number
        faithOutput?: number
      }> = {}
      for (const t of this.domain.temples) {
        const tSize = t.size === 'grand_cathedral' ? 'cathedral' : t.size as ('shrine' | 'chapel' | 'temple' | 'cathedral')
        templeMap[t.id] = {
          deity: t.deityId,
          size: tSize,
          clergy: this.domain.clergy.filter(c => c.templeId === t.id).length,
        }
      }
      const kappa: ReligionRules = {
        pantheon: this.domain.pantheon.worldId,
        dominant: dominant?.id ?? null,
        temples: templeMap,
        faithPool,
      }
      tp.writeDomain(this.state.nodeId, 'religion', kappa)
    }

    const ascensions = lastResults.filter(r => r.newTier > r.previousTier).length
    const fallings = lastResults.filter(r => r.newTier < r.previousTier).length

    const narrative =
      `${this.state.name} (${daysResolved}d, ${years} yr): ` +
      `${this.domain.pantheon.deities.length} deities, ${this.domain.clergy.length} clergy, ${this.domain.temples.length} temples. ` +
      `${tierChanges} tier shifts (${ascensions} ascensions, ${fallings} declines). Faith accrued: ${totalAccrued.toFixed(0)}.`

    return {
      stateChanges: {
        yearsTicked: years,
        tierChanges,
        totalFaithAccrued: totalAccrued,
        ascensions,
        fallings,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMReligionDomainState {
    return {
      pantheon: { ...this.domain.pantheon, deities: this.domain.pantheon.deities.map(d => ({ ...d })) },
      clergy: this.domain.clergy.map(c => ({ ...c })),
      temples: this.domain.temples.map(t => ({ ...t })),
      cumulative: { ...this.domain.cumulative },
      lastTickResults: this.domain.lastTickResults.map(r => ({ ...r })),
    }
  }

  // ── Convenience ──

  /** The deity with the highest power tier currently. */
  dominantDeity() {
    if (this.domain.pantheon.deities.length === 0) return null
    return [...this.domain.pantheon.deities].sort((a, b) => b.powerTier - a.powerTier)[0]
  }
}
