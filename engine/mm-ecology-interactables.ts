/**
 * MM_ECOLOGY_INTERACTABLES — Layer 5 ECOLOGY adapter for engine/ecology-interactables.ts
 * ==========================================================================================
 *
 * One MMEcologyInteractables per region node. Owns the per-species density
 * map `Record<speciesId, [0..1]>` that tracks deviations from the biome
 * baseline for flora / fauna / fungi / moss interactables (Δ.1).
 *
 * Weekly cadence — interactable density doesn't change minute-to-minute.
 * Player harvests reduce density (proposal: -0.05 / -0.1 / -0.2 by rarity);
 * passive regen restores toward baseline at a rarity-scaled rate.
 *
 * Reads:
 *   κ.ecology.interactableDensity at the region — hydrate state across
 *   resolves and across MM instance handover
 *
 * Writes:
 *   κ.ecology.interactableDensity at the region — cross-system reads (player
 *   harvest UI, gathering DC modifiers, wild-fauna flora supply later)
 *
 * Cadence: weekly. Layer: 5 (ECOLOGY).
 *
 * Phase 2 wiring of Δ.1. Player intents (mfEcologicalStudy, mfEcologicalHarvest)
 * flow through engine-client wrappers as writeKappa intents — not handled here.
 * The MM only does autonomous regen.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  type Rarity,
  ECOLOGY_INTERACTABLES,
  interactablesByBiome,
} from './ecology-interactables'
import type { TP, EcologyRules } from './tp'

// ============================================================
// REGEN RATES — toward biome baseline density per day
// ============================================================

/**
 * Per-day regen rate (density units toward baseline). Common species recover
 * fast (a hunted rabbit population rebounds in weeks); rare species recover
 * slowly (glowmoss takes a long time to regrow).
 */
export const RARITY_REGEN_RATE: Record<Rarity, number> = {
  common: 0.01,
  uncommon: 0.005,
  rare: 0.002,
}

// ============================================================
// MM_ECOLOGY_INTERACTABLES STATE
// ============================================================

export interface MMEcologyInteractablesDomainState {
  regionNodeId: string
  biome: string
  /** Current density per species (0..1). Baseline is per-species `baseDensity`. */
  densityById: Record<string, number>
  cumulative: {
    resolveCount: number
    daysAccumulated: number
  }
  lastResolvedDay: number
}

export interface MMEcologyInteractablesOptions {
  regionNodeId: string
  /** BiomeType string — determines eligible species. */
  biome: string
  worldDay?: number
  /** Override regen rate per rarity (testing / scenarios). */
  regenRate?: Partial<Record<Rarity, number>>
}

// ============================================================
// MM_ECOLOGY_INTERACTABLES
// ============================================================

export class MMEcologyInteractables extends SimulatedMMBase {
  domain: MMEcologyInteractablesDomainState
  private regenRate: Record<Rarity, number>

  constructor(opts: MMEcologyInteractablesOptions) {
    const id = `ecology_interactables:${opts.regionNodeId}`
    const name = `Ecology Interactables @ ${opts.regionNodeId}`
    const worldDay = opts.worldDay ?? 0
    super(id, name, opts.regionNodeId, 'ecology_interactables', worldDay)

    this.domain = {
      regionNodeId: opts.regionNodeId,
      biome: opts.biome,
      densityById: {},
      cumulative: { resolveCount: 0, daysAccumulated: 0 },
      lastResolvedDay: worldDay,
    }
    this.regenRate = {
      common: opts.regenRate?.common ?? RARITY_REGEN_RATE.common,
      uncommon: opts.regenRate?.uncommon ?? RARITY_REGEN_RATE.uncommon,
      rare: opts.regenRate?.rare ?? RARITY_REGEN_RATE.rare,
    }
  }

  // ────────────────────────────────────────────
  // ACCUMULATE — O(1)
  // ────────────────────────────────────────────

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Cheap — regen is folded on resolve.
  }

  // ────────────────────────────────────────────
  // RESOLVE — fold N days of regen toward baseline
  // ────────────────────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    // Hydrate from κ if available.
    if (tp) {
      const ctx = tp.resolve(this.domain.regionNodeId)
      const eco = ctx?.ecology as EcologyRules | undefined
      if (eco?.interactableDensity) {
        this.domain.densityById = { ...eco.interactableDensity }
      }
    }

    // Lazy-init: seed every eligible species at biome baseline.
    if (Object.keys(this.domain.densityById).length === 0) {
      const eligible = interactablesByBiome(this.domain.biome)
      for (const sp of eligible) {
        this.domain.densityById[sp.id] = sp.baseDensity
      }
    }

    if (daysResolved === 0) {
      this.domain.cumulative.resolveCount += 1
      this.domain.lastResolvedDay = worldDay
      return {
        stateChanges: {
          resolveCount: 1,
          species: Object.keys(this.domain.densityById).length,
          regened: 0,
        },
        narrative: `${this.state.name}: no fold (days=0).`,
        additionalEvents: [],
      }
    }

    // Regen each species toward its baseDensity.
    let regenedCount = 0
    const updated: Record<string, number> = { ...this.domain.densityById }
    for (const speciesId in updated) {
      const sp = ECOLOGY_INTERACTABLES.find((s) => s.id === speciesId)
      if (!sp) continue
      const current = updated[speciesId]
      const baseline = sp.baseDensity
      if (current >= baseline) continue
      const rate = this.regenRate[sp.rarity]
      const next = Math.min(baseline, current + rate * daysResolved)
      if (next > current) {
        updated[speciesId] = next
        regenedCount += 1
      }
    }
    this.domain.densityById = updated
    this.domain.cumulative.resolveCount += 1
    this.domain.cumulative.daysAccumulated += daysResolved
    this.domain.lastResolvedDay = worldDay

    if (tp) {
      tp.writeDomain(this.domain.regionNodeId, 'ecology', {
        interactableDensity: updated,
      } as EcologyRules)
    }

    return {
      stateChanges: {
        resolveCount: 1,
        species: Object.keys(updated).length,
        regened: regenedCount,
      },
      narrative:
        `${this.state.name} (${daysResolved}d): ${Object.keys(updated).length} species, ` +
        `${regenedCount} regening toward baseline.`,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMEcologyInteractablesDomainState {
    return {
      ...this.domain,
      densityById: { ...this.domain.densityById },
      cumulative: { ...this.domain.cumulative },
    }
  }

  // ────────────────────────────────────────────
  // CONVENIENCE
  // ────────────────────────────────────────────

  getDensity(speciesId: string): number | undefined {
    return this.domain.densityById[speciesId]
  }

  /**
   * Apply a density delta (negative for harvest, positive for events).
   * Clamps to [0, 1]. Used by callers wiring in player harvest results.
   *
   * Pass `tp` to also project the new density to κ.ecology.interactableDensity
   * so the next resolve's hydrate-from-κ pass picks up the change.
   */
  applyDelta(speciesId: string, delta: number, tp?: TP): number {
    const current = this.domain.densityById[speciesId] ?? 0
    const next = Math.max(0, Math.min(1, current + delta))
    this.domain.densityById[speciesId] = next
    if (tp) {
      tp.writeDomain(this.domain.regionNodeId, 'ecology', {
        interactableDensity: { ...this.domain.densityById },
      } as EcologyRules)
    }
    return next
  }
}
