/**
 * MM_HUSBANDRY — Layer 1 ISimulatedMM adapter for husbandry.ts
 * ===============================================================
 *
 * One MMHusbandry per Herd. Lives at the hub node (settlement / village
 * / homestead). Ticks weekly. Each resolve folds:
 *
 *   - N weeks of weeklyYieldTick → milk / eggs / wool / manure
 *   - M months of monthlyHerdTick → births / deaths / aging / starvation
 *
 * Reads:
 *   - κ.weather.modifiers.yieldModifier — drought / blight / cold reduces yield
 *   - κ.weather.season — drives breeding / winter mortality
 * Writes:
 *   - κ.economy.commodities.meat   — milk + eggs proteins (food bucket)
 *   - κ.economy.commodities.cloth  — wool
 *
 * Entity registration: the herd is registered with the TP entity registry
 * as `{ id: 'herd:<herdId>', type: 'herd', position: at_node }`. This is
 * how surfaces query "what herds are at Thundertree?" and how the
 * claim_plot intent finds claimable herds.
 *
 * Slow-life: a player who claims a herd (claim_plot with targetType='herd')
 * becomes its tender — yield routing to the player's stockpile + slaughter
 * via a future tend_herd / slaughter intent. v1 tracks ownership only.
 *
 * Cadence: weekly. Layer: 1 (EXTRACTION).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  weeklyYieldTick,
  monthlyHerdTick,
  totalHead,
  type Herd,
  type Species,
  type WeeklyYield,
  type MonthlyTickResult,
  type BreedingSeason,
} from './husbandry'
import type { TP, WeatherRules } from './tp'

export interface MMHusbandryDomainState {
  herd: Herd
  species: Species
  /** Cumulative yields across all resolves. */
  cumulative: {
    milkGallons: number
    eggs: number
    woolLbs: number
    manureLbs: number
    meatLbs: number      // from slaughter events when wired
    births: number
    deaths: number
  }
  /** Last weekly yield report. */
  lastWeekly: WeeklyYield | null
  /** Last monthly tick result. */
  lastMonthly: MonthlyTickResult | null
}

export interface MMHusbandryOptions {
  getD20?: (worldDay: number, salt: number) => number
  name?: string
}

/** Stable entity id for use in the TP entity registry. */
export function herdEntityId(herd: Herd): string {
  return `herd:${herd.hubId}:${herd.speciesId}`
}

export class MMHusbandry extends SimulatedMMBase {
  domain: MMHusbandryDomainState
  private getD20: (worldDay: number, salt: number) => number

  constructor(
    herd: Herd,
    species: Species,
    worldDay: number = 0,
    opts: MMHusbandryOptions = {},
  ) {
    const id = herdEntityId(herd)
    super(id, opts.name ?? `Herd:${herd.speciesId}@${herd.hubId}`, herd.hubId, 'husbandry', worldDay)
    this.domain = {
      herd,
      species,
      cumulative: {
        milkGallons: 0, eggs: 0, woolLbs: 0, manureLbs: 0,
        meatLbs: 0, births: 0, deaths: 0,
      },
      lastWeekly: null,
      lastMonthly: null,
    }
    this.getD20 = opts.getD20 ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  /**
   * Register this herd as an entity in TP. Call once after construction
   * to make `tp.getEntitiesAt(hubId)` return the herd.
   */
  registerWith(tp: TP): void {
    tp.registerEntity({
      id: this.state.id,
      type: 'herd',
      position: { type: 'at_node', nodeId: this.state.nodeId },
    })
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Yield + monthly logic runs inside resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const { herd, species } = this.domain
    const weeks = Math.floor(daysResolved / 7)
    const months = Math.floor(daysResolved / 30)

    const yieldMod = readYieldModifier(tp, herd.hubId)
    const isWinter = readIsWinter(tp, herd.hubId)
    const breedingSeason = readBreedingSeason(tp, herd.hubId)

    // ── Weekly yields fold ──
    let totalMilk = 0, totalEggs = 0, totalWool = 0, totalManure = 0
    for (let w = 0; w < weeks; w++) {
      const out = weeklyYieldTick(herd, species)
      totalMilk += out.milkGallons * yieldMod
      totalEggs += out.eggs * yieldMod
      totalWool += out.woolLbs * yieldMod
      totalManure += out.manureLbs
    }

    // ── Monthly herd tick fold (births / deaths / aging) ──
    let totalBirths = 0, totalDeaths = 0, lastMonthly: MonthlyTickResult | null = null
    for (let m = 0; m < months; m++) {
      // Each monthly tick uses ~6 d20 rolls; pre-build deterministic ones.
      const d20s = [0, 1, 2, 3, 4, 5, 6, 7].map(s => this.getD20(worldDay, s + m * 8))
      const result = monthlyHerdTick(herd, species, d20s, isWinter, breedingSeason)
      totalBirths += result.births
      totalDeaths += result.deaths
      lastMonthly = result
    }

    this.domain.cumulative.milkGallons += totalMilk
    this.domain.cumulative.eggs += totalEggs
    this.domain.cumulative.woolLbs += totalWool
    this.domain.cumulative.manureLbs += totalManure
    this.domain.cumulative.births += totalBirths
    this.domain.cumulative.deaths += totalDeaths
    this.domain.lastWeekly = weeks > 0
      ? { meatLbs: 0, milkGallons: totalMilk, eggs: totalEggs, woolLbs: totalWool, manureLbs: totalManure }
      : null
    this.domain.lastMonthly = lastMonthly

    // ── κ writes ──
    if (tp) {
      const ctx = tp.resolve(herd.hubId)
      const existing = (ctx?.economy?.commodities ?? {}) as Record<
        string, { supply?: number }
      >
      const supplyUpdate: Record<string, { supply?: number }> = {}

      // Milk + eggs → meat bucket (food protein); 1 gallon milk = 8 lbs, 1 egg = 0.1 lb
      const proteinLbs = totalMilk * 8 + totalEggs * 0.1
      if (proteinLbs > 0) {
        const prev = existing['meat']?.supply ?? 0
        supplyUpdate['meat'] = { supply: prev + Math.floor(proteinLbs) }
      }
      // Wool → cloth bucket; 1 lb wool ≈ 1 unit cloth (coarse)
      if (totalWool > 0) {
        const prev = existing['cloth']?.supply ?? 0
        supplyUpdate['cloth'] = { supply: prev + Math.floor(totalWool) }
      }
      if (Object.keys(supplyUpdate).length > 0) {
        tp.writeDomain(herd.hubId, 'economy', { commodities: supplyUpdate })
      }
    }

    const head = totalHead(herd)
    const narrative =
      `${this.state.name} (${daysResolved}d, ${head} head, health ${herd.health.toFixed(0)}): ` +
      `${weeks} wks yield → ${totalMilk.toFixed(0)} gal milk, ${Math.floor(totalEggs)} eggs, ${totalWool.toFixed(1)} lb wool` +
      (months > 0 ? `; ${months} mo cycle → +${totalBirths} born, -${totalDeaths} died` : '') +
      `.`

    return {
      stateChanges: {
        milkGallons: totalMilk,
        eggs: totalEggs,
        woolLbs: totalWool,
        births: totalBirths,
        deaths: totalDeaths,
        head,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMHusbandryDomainState {
    return {
      herd: { ...this.domain.herd },
      species: { ...this.domain.species },
      cumulative: { ...this.domain.cumulative },
      lastWeekly: this.domain.lastWeekly ? { ...this.domain.lastWeekly } : null,
      lastMonthly: this.domain.lastMonthly ? { ...this.domain.lastMonthly } : null,
    }
  }

  /** Convenience accessors. */
  getHerd(): Herd { return { ...this.domain.herd } }
  getHead(): number { return totalHead(this.domain.herd) }
}

// ============================================================
// HELPERS — read from κ at the hub node
// ============================================================

function readYieldModifier(tp: TP | undefined, nodeId: string): number {
  if (!tp) return 1.0
  const ctx = tp.resolve(nodeId)
  const weather = ctx?.weather as WeatherRules | undefined
  return weather?.modifiers?.yieldModifier ?? 1.0
}

function readIsWinter(tp: TP | undefined, nodeId: string): boolean {
  if (!tp) return false
  const ctx = tp.resolve(nodeId)
  const weather = ctx?.weather as WeatherRules | undefined
  return weather?.season === 'winter'
}

function readBreedingSeason(tp: TP | undefined, nodeId: string): BreedingSeason {
  if (!tp) return 'year_round'
  const ctx = tp.resolve(nodeId)
  const weather = ctx?.weather as WeatherRules | undefined
  if (weather?.season === 'spring') return 'spring'
  if (weather?.season === 'autumn') return 'fall'
  return 'year_round'
}
