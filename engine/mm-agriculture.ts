/**
 * MM_AGRICULTURE — Layer 1 ISimulatedMM adapter for agriculture.ts
 * ===================================================================
 *
 * One MMAgriculture per FarmPlot. Lives at the settlement node hosting
 * the plot. Ticks weekly. Each resolve:
 *
 *   1. If the plot is planted, advance growthDays by daysResolved.
 *   2. If any crop has reached its growDays threshold AND is in season,
 *      run calculateHarvest with the local weather κ's yieldModifier.
 *      Write the resulting bushels into κ.economy.commodities supply.
 *   3. After harvest, the plot becomes fallow (planted=false, growthDays=0).
 *      Replanting is a separate intent (future wave).
 *
 * Slow-life: a player who claims this plot (engine/claims.ts) becomes its
 * claimant — yield routing to player vs settlement is a future wave; this
 * MM just produces yield deterministically from soil + weather + season.
 *
 * Cadence: weekly. Layer: 1 (EXTRACTION).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  calculateHarvest,
  CROP_DATA,
  type FarmPlot,
  type HarvestResult,
  type CropType,
} from './agriculture.js'
import type { TP, WeatherRules } from './tp.js'

export interface MMAgricultureDomainState {
  plot: FarmPlot
  /** Latest harvest event (null until first harvest). */
  lastHarvest: HarvestResult | null
  /** Total bushels harvested across all resolves, per crop type. */
  cumulativeYields: Partial<Record<CropType, number>>
  /** Number of harvests completed. */
  harvestsCompleted: number
}

export interface MMAgricultureOptions {
  /** Provide a d20 source (default: deterministic from worldDay). */
  getD20?: (worldDay: number) => number
  /** Override name for narrative. */
  name?: string
}

export class MMAgriculture extends SimulatedMMBase {
  domain: MMAgricultureDomainState
  private getD20: (worldDay: number) => number

  constructor(plot: FarmPlot, worldDay: number = 0, opts: MMAgricultureOptions = {}) {
    super(`farm:${plot.id}`, opts.name ?? `Farm:${plot.id}`, plot.nodeId, 'agriculture', worldDay)
    this.domain = {
      plot,
      lastHarvest: null,
      cumulativeYields: {},
      harvestsCompleted: 0,
    }
    this.getD20 = opts.getD20 ?? ((day) => ((day * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  // O(1) — growthDays advances inside resolve so we can read κ.
  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Intentionally empty. Base class tracks daysPending.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const plot = this.domain.plot

    // Fallow plot = nothing grows.
    if (!plot.planted || plot.crops.length === 0) {
      return {
        stateChanges: { fallow: 1, daysResolved },
        narrative: `${this.state.name} (${daysResolved}d): fallow.`,
        additionalEvents: [],
      }
    }

    plot.growthDays += daysResolved

    // Which crops are mature AND in season? Both gates required.
    const matureInSeason = plot.crops.filter(c => {
      const data = CROP_DATA[c.type]
      if (!data) return false
      const seasonMatch = data.growSeasons.includes(plot.season as 'spring' | 'summer' | 'fall')
      const matured = plot.growthDays >= data.growDays
      return seasonMatch && matured
    })

    if (matureInSeason.length === 0) {
      // Still growing
      return {
        stateChanges: { growing: 1, growthDays: plot.growthDays },
        narrative: `${this.state.name} (${daysResolved}d): growing — ${plot.growthDays} days in.`,
        additionalEvents: [],
      }
    }

    // Harvest! Read weather yield modifier from κ at this node.
    const weatherMod = readYieldModifier(tp, plot.nodeId)
    const d20 = this.getD20(worldDay)
    const harvest = calculateHarvest(plot, d20, weatherMod)
    this.domain.lastHarvest = harvest
    this.domain.harvestsCompleted++
    for (const y of harvest.yields) {
      this.domain.cumulativeYields[y.crop] =
        (this.domain.cumulativeYields[y.crop] ?? 0) + y.bushels
    }

    // Write supply increments into κ.economy.commodities. Crops map to
    // commodity ids: grains → 'grain', fruits → 'food' bucket already
    // exists; for v1 keep one-to-one where the commodity exists, else
    // collapse fruit/vegetable into 'grain' as a coarse food bucket.
    if (tp && harvest.totalBushels > 0) {
      const supplyUpdate: Record<string, { supply?: number }> = {}
      const ctx = tp.resolve(plot.nodeId)
      const existingCommodities = (ctx?.economy?.commodities ?? {}) as Record<
        string, { supply?: number }
      >
      for (const y of harvest.yields) {
        const commodityId = cropToCommodity(y.crop)
        const prevSupply = existingCommodities[commodityId]?.supply ?? supplyUpdate[commodityId]?.supply ?? 0
        supplyUpdate[commodityId] = { supply: prevSupply + y.bushels }
      }
      tp.writeDomain(plot.nodeId, 'economy', { commodities: supplyUpdate })
    }

    // Reset for next planting cycle. Caller can re-plant via a future intent.
    plot.growthDays = 0
    plot.planted = false
    plot.crops = []

    const blightNote = harvest.blighted
      ? ` BLIGHTED — ${harvest.blightedCrops.join(', ')} hit hard.`
      : ''
    const narrative =
      `${this.state.name} (${daysResolved}d): harvested ${harvest.totalBushels} bushels ` +
      `(${harvest.totalValue.toFixed(0)} GP), tax-in-kind ${harvest.taxInKind} bushels.${blightNote}`

    return {
      stateChanges: {
        harvested: harvest.totalBushels,
        farmerKept: harvest.farmerKeeps,
        tax: harvest.taxInKind,
        blight: harvest.blighted ? 1 : 0,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMAgricultureDomainState {
    return {
      plot: { ...this.domain.plot, crops: [...this.domain.plot.crops] },
      lastHarvest: this.domain.lastHarvest ? { ...this.domain.lastHarvest } : null,
      cumulativeYields: { ...this.domain.cumulativeYields },
      harvestsCompleted: this.domain.harvestsCompleted,
    }
  }

  /** Convenience: peek the plot without resolving. */
  getPlot(): FarmPlot {
    return { ...this.domain.plot, crops: [...this.domain.plot.crops] }
  }
}

// ── Helpers ──

/**
 * Read κ.weather.modifiers.yieldModifier at a node. Defaults to 1.0
 * (neutral) when no weather has been observed yet.
 */
function readYieldModifier(tp: TP | undefined, nodeId: string): number {
  if (!tp) return 1.0
  const ctx = tp.resolve(nodeId)
  const weather = ctx?.weather as WeatherRules | undefined
  return weather?.modifiers?.yieldModifier ?? 1.0
}

/**
 * Map a CropType onto a production-chain commodity id. Grains map directly
 * to 'grain'; vegetables/fruits collapse to 'grain' for v1 (a single food
 * bucket); fiber crops map to 'cloth'; specialty hops/herbs to 'herbs'.
 */
function cropToCommodity(crop: CropType): string {
  const data = CROP_DATA[crop]
  if (!data) return 'grain'
  if (data.category === 'grain') return 'grain'
  if (data.category === 'fruit' || data.category === 'vegetable') return 'grain'  // food bucket
  if (data.category === 'fiber') return 'cloth'
  if (crop === 'herb_crop') return 'herbs'
  if (crop === 'hops') return 'herbs'
  return 'grain'
}
