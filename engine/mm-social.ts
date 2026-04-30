/**
 * MM_SOCIAL — Layer 4 ISimulatedMM adapter for social.ts
 * ==========================================================
 *
 * One MMSocial per JURISDICTION (most often a settlement, sometimes a
 * larger domain like a barony or kingdom). Lives at the jurisdiction's
 * .tp node. Ticks monthly. Each resolve folds N months of
 * `monthlySocialTick(worldDay, contracts, households, titles, kinshipLinks)`:
 *
 *   1. Expire fixed-duration contracts whose end date has passed
 *   2. Recalculate each household's standing from treasury + properties
 *   3. Detect vacant titles; attempt succession via primogeniture/etc
 *
 * Slow-life: when a player ascends (becomes topological — death, divine
 * intervention, planeshift), social.ascendCharacterSocial walks their
 * obligations forward. MMSocial is the heartbeat that keeps that web
 * tidy in the background — contracts expire, households adjust, titles
 * pass to heirs.
 *
 * Cadence: monthly. Layer: 4 (SETTLEMENT).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  monthlySocialTick,
  type Contract,
  type Household,
  type Title,
  type KinshipLink,
  type SocialTickResult,
} from './social.js'
import type { TP, SocialRules } from './tp.js'

export interface MMSocialDomainState {
  jurisdictionId: string
  contracts: Contract[]
  households: Household[]
  titles: Title[]
  kinshipLinks: KinshipLink[]
  cumulative: {
    monthsTicked: number
    contractsExpired: number
    standingChanges: number
    titlesVacated: number
    successions: number
  }
  lastTick: SocialTickResult | null
}

export interface MMSocialOptions {
  name?: string
}

export class MMSocial extends SimulatedMMBase {
  domain: MMSocialDomainState

  constructor(
    jurisdictionId: string,
    nodeId: string,
    contracts: Contract[],
    households: Household[],
    titles: Title[],
    kinshipLinks: KinshipLink[],
    worldDay: number = 0,
    opts: MMSocialOptions = {},
  ) {
    super(`social:${jurisdictionId}`, opts.name ?? `Social:${jurisdictionId}`,
          nodeId, 'social', worldDay)
    this.domain = {
      jurisdictionId,
      contracts,
      households,
      titles,
      kinshipLinks,
      cumulative: {
        monthsTicked: 0,
        contractsExpired: 0,
        standingChanges: 0,
        titlesVacated: 0,
        successions: 0,
      },
      lastTick: null,
    }
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Lifecycle scans run inside resolve.
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
        narrative: `${this.state.name} (${daysResolved}d): less than a month — no social tick.`,
        additionalEvents: [],
      }
    }

    let totalExpired = 0
    let totalStandingChanges = 0
    let totalVacant = 0
    let totalSuccessions = 0
    let lastTick: SocialTickResult | null = null

    for (let m = 0; m < months; m++) {
      const result = monthlySocialTick(
        worldDay + m * 30,
        this.domain.contracts,
        this.domain.households,
        this.domain.titles,
        this.domain.kinshipLinks,
      )
      lastTick = result
      totalExpired += result.expiredContracts.length
      totalStandingChanges += result.standingChanges.length
      totalVacant += result.vacantTitles.length
      totalSuccessions += result.successions.length
    }

    this.domain.cumulative.monthsTicked += months
    this.domain.cumulative.contractsExpired += totalExpired
    this.domain.cumulative.standingChanges += totalStandingChanges
    this.domain.cumulative.titlesVacated += totalVacant
    this.domain.cumulative.successions += totalSuccessions
    this.domain.lastTick = lastTick

    // ── κ.social writes at the jurisdiction's node ──
    if (tp) {
      // Aggregate active titles + active contracts into κ.social
      const titlesMap: Record<string, { rank: 'knight' | 'baron' | 'count' | 'duke' | 'prince' | 'king'; holder: string | null; succession: 'primogeniture' | 'elective' | 'merit' | 'conquest' }> = {}
      for (const t of this.domain.titles) {
        if (t.status === 'abolished') continue
        // Simplify rank — schema only has 6 ranks; map the rich set down.
        const rank = mapRank(t.rank)
        const succession = mapSuccession(t.succession)
        titlesMap[t.id] = { rank, holder: t.holderId, succession }
      }

      const standingSum = this.domain.households.reduce((s, h) => s + standingScore(h.standing), 0)
      const standingAvg = this.domain.households.length > 0
        ? standingSum / this.domain.households.length : 0

      const active = this.domain.contracts.filter(c => c.status === 'active').length
      const breached = this.domain.contracts.filter(c => c.status === 'breached').length

      const social: SocialRules = {
        titles: titlesMap,
        standingAvg,
        contracts: {
          active,
          breached,
          enforceability: 0.7,  // default — tunable per jurisdiction
        },
      }
      tp.writeDomain(this.state.nodeId, 'social', social)
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${months} mo): ` +
      `${this.domain.contracts.filter(c => c.status === 'active').length} active contracts, ` +
      `${this.domain.households.length} households, ` +
      `${this.domain.titles.filter(t => t.status === 'active').length} titles held` +
      (totalSuccessions > 0 ? `, ${totalSuccessions} succession${totalSuccessions > 1 ? 's' : ''}` : '') +
      (totalExpired > 0 ? `, ${totalExpired} contract${totalExpired > 1 ? 's' : ''} expired` : '') +
      `.`

    return {
      stateChanges: {
        monthsTicked: months,
        contractsExpired: totalExpired,
        standingChanges: totalStandingChanges,
        titlesVacated: totalVacant,
        successions: totalSuccessions,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMSocialDomainState {
    return {
      jurisdictionId: this.domain.jurisdictionId,
      contracts: this.domain.contracts.map(c => ({ ...c })),
      households: this.domain.households.map(h => ({ ...h, members: [...h.members] })),
      titles: this.domain.titles.map(t => ({ ...t })),
      kinshipLinks: this.domain.kinshipLinks.map(k => ({ ...k })),
      cumulative: { ...this.domain.cumulative },
      lastTick: this.domain.lastTick ? { ...this.domain.lastTick } : null,
    }
  }

  /** Convenience accessors. */
  getContracts(): Contract[] { return this.domain.contracts }
  getHouseholds(): Household[] { return this.domain.households }
  getTitles(): Title[] { return this.domain.titles }
}

// ============================================================
// HELPERS
// ============================================================

/** Map social.ts's rich TitleRank set onto SocialRules.titles.rank's narrower set. */
function mapRank(r: string): 'knight' | 'baron' | 'count' | 'duke' | 'prince' | 'king' {
  switch (r) {
    case 'emperor': case 'king':                  return 'king'
    case 'archduke': case 'duke':                 return 'duke'
    case 'marquess': case 'count': case 'viscount': return 'count'
    case 'baron': case 'baronet':                 return 'baron'
    case 'knight':                                return 'knight'
    default:                                       return 'knight'
  }
}

function mapSuccession(s: string): 'primogeniture' | 'elective' | 'merit' | 'conquest' {
  switch (s) {
    case 'primogeniture':
    case 'male_primogeniture':
    case 'ultimogeniture':
    case 'gavelkind':
    case 'seniority':            return 'primogeniture'
    case 'elective':              return 'elective'
    case 'appointed':             return 'merit'
    case 'conquest':              return 'conquest'
    default:                      return 'primogeniture'
  }
}

/** Convert SocialStanding string to a numeric score 0-6 for averaging. */
function standingScore(s: string): number {
  switch (s) {
    case 'destitute':  return 0
    case 'poor':       return 1
    case 'common':     return 2
    case 'comfortable':return 3
    case 'wealthy':    return 4
    case 'noble':      return 5
    case 'royal':      return 6
    default:           return 2
  }
}
