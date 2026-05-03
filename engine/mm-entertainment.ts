/**
 * MM_ENTERTAINMENT — Layer 6 ISimulatedMM adapter for entertainment.ts
 * =======================================================================
 *
 * One MMEntertainment per settlement. Lives at the settlement node.
 * Weekly cadence. Each resolve folds N weeks of:
 *
 *   1. Run scheduled performances (one per performer per week, by default).
 *   2. Collect patron stipends + steady reputation drift.
 *   3. Recompute cultural score + write `κ.culture.entertainment`
 *      ({ culturalScore, revenue, venues }).
 *
 * Bards generate rumors while performing — those bubble up via the result
 * (consumers can route them into mm-lore at the same hub).
 *
 * Cadence: weekly. Layer: 6 (HUB SERVICES).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  resolvePerformance,
  patronBenefit,
  calculateCulturalScore,
  type Performer,
  type Patronage,
  type PerformanceResult,
  type VenueCategory,
  type PerformanceType,
  type CulturalScore,
} from './entertainment'
import type { TP, CultureRules } from './tp'

export interface MMEntertainmentDomainState {
  settlementId: string
  performers: Performer[]
  patronages: Patronage[]
  /** Default venue + type used when performers don't specify (the city's main venue). */
  defaultVenue: VenueCategory
  defaultType: PerformanceType
  cumulative: {
    weeksTicked: number
    performancesRun: number
    totalRevenue: number
    rumorsCollected: number
    patronStipends: number
  }
  lastScore: CulturalScore | null
  lastResults: PerformanceResult[]
}

export interface MMEntertainmentOptions {
  performers?: Performer[]
  patronages?: Patronage[]
  defaultVenue?: VenueCategory
  defaultType?: PerformanceType
  /** d20 supplier — defaults to deterministic. */
  getD20?: (worldDay: number, salt: number) => number
  /** Default audience fill if not specified per performer. 0–1. */
  defaultAudienceFill?: number
  name?: string
}

export class MMEntertainment extends SimulatedMMBase {
  domain: MMEntertainmentDomainState
  private getD20: (worldDay: number, salt: number) => number
  private defaultAudienceFill: number

  constructor(settlementId: string, worldDay: number = 0, opts: MMEntertainmentOptions = {}) {
    const id = `entertainment:${settlementId}`
    const name = opts.name ?? `Entertainment@${settlementId}`
    super(id, name, settlementId, 'entertainment', worldDay)

    this.domain = {
      settlementId,
      performers: opts.performers ?? [],
      patronages: opts.patronages ?? [],
      defaultVenue: opts.defaultVenue ?? 'tavern',
      defaultType: opts.defaultType ?? 'storytelling',
      cumulative: {
        weeksTicked: 0,
        performancesRun: 0,
        totalRevenue: 0,
        rumorsCollected: 0,
        patronStipends: 0,
      },
      lastScore: null,
      lastResults: [],
    }

    this.getD20 = opts.getD20
      ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
    this.defaultAudienceFill = opts.defaultAudienceFill ?? 0.7
  }

  // ── Mutators ──

  addPerformer(p: Performer): void { this.domain.performers.push(p) }
  addPatronage(p: Patronage): void { this.domain.patronages.push(p) }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1).
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const weeks = Math.floor(daysResolved / 7)
    if (weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a week — silent stage.`,
        additionalEvents: [],
      }
    }

    let performancesRun = 0
    let totalRevenue = 0
    let rumorsCollected = 0
    let patronStipends = 0
    let lastResults: PerformanceResult[] = []

    for (let w = 0; w < weeks; w++) {
      const weekDay = worldDay - daysResolved + (w + 1) * 7

      // 1. Each local performer runs one performance this week
      const localPerformers = this.domain.performers.filter(
        p => p.homeSettlementId === this.domain.settlementId,
      )
      const weekResults: PerformanceResult[] = []
      for (let i = 0; i < localPerformers.length; i++) {
        const p = localPerformers[i]
        const d20 = this.getD20(weekDay, i)
        const result = resolvePerformance(
          p,
          this.domain.defaultVenue,
          this.domain.defaultType,
          d20,
          this.defaultAudienceFill,
        )
        weekResults.push(result)
        performancesRun++
        totalRevenue += result.revenue
        rumorsCollected += result.rumorsCollected
      }
      lastResults = weekResults

      // 2. Patron stipends + steady reputation drip
      for (const patronage of this.domain.patronages) {
        patronStipends += patronage.weeklyStipend
        const performer = this.domain.performers.find(p => p.id === patronage.performerId)
        if (performer) {
          const benefit = patronBenefit(performer, patronage)
          performer.reputation = Math.min(100, performer.reputation + benefit.weeklyReputationGain)
        }
      }
    }

    // 3. Recompute cultural score
    const score = calculateCulturalScore(
      this.domain.settlementId,
      this.domain.performers,
      totalRevenue,
    )

    this.domain.cumulative.weeksTicked += weeks
    this.domain.cumulative.performancesRun += performancesRun
    this.domain.cumulative.totalRevenue += totalRevenue
    this.domain.cumulative.rumorsCollected += rumorsCollected
    this.domain.cumulative.patronStipends += patronStipends
    this.domain.lastScore = score
    this.domain.lastResults = lastResults

    // 4. Write κ.culture.entertainment
    if (tp) {
      const kappa: CultureRules = {
        entertainment: {
          culturalScore: score.entertainmentScore,
          revenue: score.weeklyRevenue,
          venues: 1,   // single venue MM for v1; multi-venue cities can stack MMs
        },
      }
      tp.writeDomain(this.state.nodeId, 'culture', kappa)
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} wks): ` +
      `${performancesRun} performances, ${totalRevenue.toFixed(1)}gp revenue. ` +
      `${rumorsCollected} rumors collected. Patron stipends: ${patronStipends}gp. ` +
      `Cultural score ${score.entertainmentScore} → +${score.moraleBonus} morale.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        performancesRun,
        totalRevenue,
        rumorsCollected,
        patronStipends,
        culturalScore: score.entertainmentScore,
        moraleBonus: score.moraleBonus,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMEntertainmentDomainState {
    return {
      settlementId: this.domain.settlementId,
      performers: this.domain.performers.map(p => ({ ...p })),
      patronages: this.domain.patronages.map(p => ({ ...p })),
      defaultVenue: this.domain.defaultVenue,
      defaultType: this.domain.defaultType,
      cumulative: { ...this.domain.cumulative },
      lastScore: this.domain.lastScore ? { ...this.domain.lastScore } : null,
      lastResults: this.domain.lastResults.map(r => ({ ...r })),
    }
  }

  // ── Convenience ──

  getPerformers(): Performer[] { return this.domain.performers }
  getCulturalScore(): CulturalScore | null { return this.domain.lastScore }
}
