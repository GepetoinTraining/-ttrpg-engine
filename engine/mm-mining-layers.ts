/**
 * MM_MINING_LAYERS — Layer 1 EXTRACTION adapter for engine/mining-layers.ts
 * ============================================================================
 *
 * One MMMineNode per mine .tp node. Owns the MineLayer[] stack at that node.
 * Daily cadence. Each resolve folds N days of:
 *
 *   1. Lazy-init surface layer on first resolve (deterministic from
 *      mineNodeId) if no layers yet
 *   2. applyDailyDepletion on every revealed layer (passive seam erosion;
 *      independent of player digs)
 *
 * Reads:
 *   κ.infrastructure.mineLayers at the mine node — used to hydrate state
 *   across resolves
 *
 * Writes:
 *   κ.infrastructure.mineLayers at the mine node — projects current layer
 *   stack for cross-system reads (player UI, market supply trackers)
 *
 * Cadence: daily. Layer: 1 (EXTRACTION).
 *
 * Phase 2 wiring of Δ.4. Player digs / reveals (mfMineDig / mfMineReveal)
 * flow through engine-client wrappers as writeKappa intents — not handled
 * here. The MM only does autonomous decay.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  type MineLayer,
  applyDailyDepletion,
  createSurfaceLayer,
} from './mining-layers.js'
import type { TP, InfrastructureRules } from './tp.js'

// ============================================================
// MM_MINING_LAYERS STATE
// ============================================================

export interface MMMineNodeDomainState {
  mineNodeId: string
  /** Local mirror of κ.infrastructure.mineLayers for this mine. */
  layers: MineLayer[]
  cumulative: {
    resolveCount: number
    daysAccumulated: number
    layersDepleted: number
  }
  lastResolvedDay: number
}

export interface MMMineNodeOptions {
  mineNodeId: string
  worldDay?: number
  /** Pre-set layers (e.g. from a saved snapshot). Defaults to lazy-init on first resolve. */
  initialLayers?: MineLayer[]
}

// ============================================================
// MM_MINING_LAYERS
// ============================================================

export class MMMineNode extends SimulatedMMBase {
  domain: MMMineNodeDomainState

  constructor(opts: MMMineNodeOptions) {
    const id = `mine_node:${opts.mineNodeId}`
    const name = `Mine @ ${opts.mineNodeId}`
    const worldDay = opts.worldDay ?? 0
    super(id, name, opts.mineNodeId, 'mine_node', worldDay)

    this.domain = {
      mineNodeId: opts.mineNodeId,
      layers: opts.initialLayers ? opts.initialLayers.map((l) => ({ ...l })) : [],
      cumulative: {
        resolveCount: 0,
        daysAccumulated: 0,
        layersDepleted: 0,
      },
      lastResolvedDay: worldDay,
    }
  }

  // ────────────────────────────────────────────
  // ACCUMULATE — O(1)
  // ────────────────────────────────────────────

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Cheap — depletion is folded on resolve.
  }

  // ────────────────────────────────────────────
  // RESOLVE — fold N days of depletion
  // ────────────────────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    // Hydrate from κ if available.
    if (tp) {
      const ctx = tp.resolve(this.domain.mineNodeId)
      const infra = ctx?.infrastructure as InfrastructureRules | undefined
      if (infra?.mineLayers && Array.isArray(infra.mineLayers) && infra.mineLayers.length > 0) {
        this.domain.layers = (infra.mineLayers as MineLayer[]).map((l) => ({ ...l }))
      }
    }

    // Lazy-init surface layer on first resolve.
    if (this.domain.layers.length === 0) {
      this.domain.layers = [createSurfaceLayer(this.domain.mineNodeId)]
    }

    if (daysResolved === 0) {
      this.domain.cumulative.resolveCount += 1
      this.domain.lastResolvedDay = worldDay
      return {
        stateChanges: {
          resolveCount: 1,
          layers: this.domain.layers.length,
          daysAccumulated: 0,
          layersDepleted: 0,
        },
        narrative: `${this.state.name}: no fold (days=0).`,
        additionalEvents: [],
      }
    }

    // Apply daily depletion to each revealed layer.
    let layersDepletedThisFold = 0
    const updated = this.domain.layers.map((layer) => {
      const before = layer.reserve
      const after = applyDailyDepletion(layer, daysResolved)
      if (before > 0 && after.reserve === 0) layersDepletedThisFold += 1
      return after
    })
    this.domain.layers = updated
    this.domain.cumulative.resolveCount += 1
    this.domain.cumulative.daysAccumulated += daysResolved
    this.domain.cumulative.layersDepleted += layersDepletedThisFold
    this.domain.lastResolvedDay = worldDay

    // Project to κ.infrastructure.mineLayers.
    if (tp) {
      tp.writeDomain(this.domain.mineNodeId, 'infrastructure', {
        mineLayers: updated,
      } as InfrastructureRules)
    }

    return {
      stateChanges: {
        resolveCount: 1,
        layers: updated.length,
        daysAccumulated: daysResolved,
        layersDepleted: layersDepletedThisFold,
      },
      narrative:
        `${this.state.name} (${daysResolved}d): ${updated.length} layers, ` +
        `${layersDepletedThisFold} fully depleted this fold.`,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMMineNodeDomainState {
    return {
      ...this.domain,
      layers: this.domain.layers.map((l) => ({ ...l })),
      cumulative: { ...this.domain.cumulative },
    }
  }

  // ────────────────────────────────────────────
  // CONVENIENCE
  // ────────────────────────────────────────────

  getLayers(): MineLayer[] {
    return this.domain.layers
  }

  getLayer(layerId: number): MineLayer | undefined {
    return this.domain.layers.find((l) => l.layerId === layerId)
  }

  /**
   * Replace or insert a layer by layerId. Used by callers that pushed
   * mfMineDig / mfMineReveal results back from the client (each MF returns
   * an updated layer state and a hazard).
   */
  setLayer(layer: MineLayer): void {
    const idx = this.domain.layers.findIndex((l) => l.layerId === layer.layerId)
    if (idx >= 0) {
      this.domain.layers[idx] = { ...layer }
    } else {
      this.domain.layers.push({ ...layer })
      this.domain.layers.sort((a, b) => a.layerId - b.layerId)
    }
  }
}
