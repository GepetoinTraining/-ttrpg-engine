/**
 * MF — Mine Dig / Reveal
 * ==========================
 *
 * Atomic transformations per Theorem 1: forward pass produces output O AND
 * receipt R as a structural side-effect. Pure, deterministic, no DB.
 *
 * Two MFs:
 *   - mfMineDig:    extract from a revealed layer; integrity drops with each
 *                   dig; on fail or low-integrity → hazard event
 *   - mfMineReveal: dig downward to expose the next stratum; deeper layers
 *                   require higher DC, deterministic from
 *                   (mineNodeId, layerId, worldDay)
 *
 * Caller (mm-extraction onResolve, /api/world/slot/push consumer) takes the
 * receipt and emits a `writeKappa` action with `system='client-intent:
 * mine-dig:<certId>'` per the proposal §3 — no new TPB variant needed.
 */

import {
  type MineLayer,
  type HazardEvent,
  type HazardKind,
  RESOURCE_DEPTH_BAND,
  revealNextLayer,
  shouldRollHazard,
  densityOf,
} from './mining-layers'

// ============================================================
// COMMON SHAPES
// ============================================================

export interface MineDigContext {
  /** d20 roll (1-20). */
  d20: number
  /** Player's mining/survival skill modifier. */
  skillModifier: number
  /** Tool / equipment bonus (pickaxe quality, blast charges, etc.). */
  toolBonus?: number
  /** Effort: how many days the dig spans. Each day chips integrity. */
  days?: number
}

export interface MineDigReceipt {
  layerId: number
  resourceType: string
  baseDC: number
  effectiveDC: number
  d20: number
  total: number
  success: boolean
  margin: number
}

// ============================================================
// HELPERS
// ============================================================

/** Base DC scales with depth + tier of the layer's resource. */
function baseDCFor(layer: MineLayer): number {
  const tier = RESOURCE_DEPTH_BAND[layer.resourceType].tier
  // Layer 0 baseline 8; +2 per layer index; +2 per tier.
  return 8 + layer.layerId * 2 + tier * 2
}

/** Density-modifier: harder to dig from a depleted seam. */
function densityPenalty(layer: MineLayer): number {
  const d = densityOf(layer)
  if (d > 0.5) return 0
  if (d > 0.2) return 2
  return 5
}

/** Severity scales with integrity gap below threshold. */
function hazardSeverityFor(integrityAfter: number, threshold: number): number {
  const gap = Math.max(0, threshold - integrityAfter)
  return Math.min(1, 0.3 + gap * 1.5)
}

/** Deterministic hazard kind based on layer state — no Math.random. */
function pickHazardKind(layer: MineLayer): HazardKind {
  // Coal seams + depth → gas leaks.
  if (layer.resourceType === 'coal' && layer.depth >= 100) return 'gasLeak'
  // Deep gem/ore at high depth → gas leaks (toxic confined-space pockets).
  if (layer.depth >= 400) return 'gasLeak'
  // Mid-depth + low integrity below sea level → flood risk.
  if (layer.depth >= 100 && layer.depth < 400 && layer.structuralIntegrity < 0.2) {
    return 'flood'
  }
  return 'caveIn'
}

// ============================================================
// MINE DIG MF
// ============================================================

export interface MineDigOutput {
  /** Units actually extracted (≤ remaining reserve). */
  extracted: number
  /** Updated layer state (caller persists). */
  layerAfter: MineLayer
  /** Hazard fired this dig (success or fail can both trigger if integrity dipped). */
  hazard: HazardEvent | null
  /** Whether the layer hit zero reserve this dig. Caller may now reveal next. */
  depletedNow: boolean
}

export function mfMineDig(
  layer: MineLayer,
  ctx: MineDigContext,
): { output: MineDigOutput; receipt: MineDigReceipt } {
  if (!layer.revealed) {
    throw new Error(`mfMineDig: layer ${layer.layerId} is not yet revealed`)
  }
  if (layer.reserve <= 0) {
    throw new Error(`mfMineDig: layer ${layer.layerId} is depleted`)
  }

  const days = Math.max(1, Math.floor(ctx.days ?? 1))
  const baseDC = baseDCFor(layer)
  const effectiveDC = baseDC + densityPenalty(layer)
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC

  // Per-day extraction yield: scales with margin + depletion rate.
  const yieldPerDay = success ? Math.max(1, layer.depletionRate + Math.max(0, margin)) : 0
  const requestedExtract = yieldPerDay * days
  const extracted = Math.min(requestedExtract, layer.reserve)

  // Integrity loss: 0.01 per day on success, 0.05 on failure.
  const integrityLoss = success ? 0.01 * days : 0.05
  const integrityAfter = Math.max(0, layer.structuralIntegrity - integrityLoss)
  const reserveAfter = Math.max(0, layer.reserve - extracted)

  const layerAfter: MineLayer = {
    ...layer,
    reserve: reserveAfter,
    structuralIntegrity: integrityAfter,
  }

  // Hazard rolls when integrity slips below threshold (or always on failure).
  let hazard: HazardEvent | null = null
  if (!success) {
    hazard = {
      kind: pickHazardKind(layer),
      severity: hazardSeverityFor(integrityAfter, layer.hazardThreshold),
      mitigationDC: 12 + layer.layerId * 2,
    }
  } else if (shouldRollHazard(layerAfter)) {
    hazard = {
      kind: pickHazardKind(layer),
      severity: hazardSeverityFor(integrityAfter, layer.hazardThreshold),
      mitigationDC: 14 + layer.layerId * 2,
    }
  }

  return {
    output: {
      extracted,
      layerAfter,
      hazard,
      depletedNow: layer.reserve > 0 && reserveAfter === 0,
    },
    receipt: {
      layerId: layer.layerId,
      resourceType: layer.resourceType,
      baseDC,
      effectiveDC,
      d20,
      total,
      success,
      margin,
    },
  }
}

// ============================================================
// MINE REVEAL MF
// ============================================================

export interface MineRevealContext extends MineDigContext {
  mineNodeId: string
  worldDay: number
}

export interface MineRevealOutput {
  /** Newly revealed layer (null if we hit max depth or check failed). */
  newLayer: MineLayer | null
  /** Updated parent layer after the reveal effort (always loses some integrity). */
  parentAfter: MineLayer
  hazard: HazardEvent | null
}

export function mfMineReveal(
  parent: MineLayer,
  ctx: MineRevealContext,
): { output: MineRevealOutput; receipt: MineDigReceipt } {
  if (!parent.revealed) {
    throw new Error(`mfMineReveal: parent layer ${parent.layerId} is not revealed`)
  }

  // Reveal DC scales with depth — hard to break through to deeper strata.
  const baseDC = 12 + (parent.layerId + 1) * 3
  const effectiveDC = baseDC + densityPenalty(parent)
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC

  // Reveal effort costs integrity on the PARENT regardless of success.
  const integrityLoss = success ? 0.05 : 0.1
  const parentAfter: MineLayer = {
    ...parent,
    structuralIntegrity: Math.max(0, parent.structuralIntegrity - integrityLoss),
  }

  let newLayer: MineLayer | null = null
  if (success) {
    newLayer = revealNextLayer(parent, ctx.mineNodeId, ctx.worldDay)
  }

  let hazard: HazardEvent | null = null
  if (!success) {
    hazard = {
      kind: pickHazardKind(parent),
      severity: 0.4,
      mitigationDC: 14 + parent.layerId * 2,
    }
  } else if (shouldRollHazard(parentAfter)) {
    hazard = {
      kind: pickHazardKind(parent),
      severity: hazardSeverityFor(parentAfter.structuralIntegrity, parentAfter.hazardThreshold),
      mitigationDC: 14 + parent.layerId * 2,
    }
  }

  return {
    output: {
      newLayer,
      parentAfter,
      hazard,
    },
    receipt: {
      layerId: parent.layerId,
      resourceType: parent.resourceType,
      baseDC,
      effectiveDC,
      d20,
      total,
      success,
      margin: total - effectiveDC,
    },
  }
}
