/**
 * MINING LAYERS — Stratified extraction model
 * ===============================================
 *
 * Per `docs/to-be implemented/mining-layers-proposal.md`. Surface deposits
 * deplete over time; deeper layers are revealed by player digs. Each layer
 * has its own resource type, reserve, density, and structural integrity.
 * Hazards (cave-ins) fire when integrity drops below threshold.
 *
 * Pure types + helpers + small resource-type table. No DB. No persistence
 * here — caller (mm-extraction onResolve, /api routes) consumes the MF
 * output and emits actions via the standard `writeKappa` path.
 *
 * Determinism: `SeededRNG` (FNV-1a + LCG, from `hub-topology.ts`) seeds
 * reveal rolls from `(mineNodeId, layerId, worldDay)`. Same triple → same
 * resource + density forever.
 */

import { z } from 'zod'
import { SeededRNG } from './hub-topology'

// ============================================================
// RESOURCE TYPES — what a layer can yield
// ============================================================

export const MineResourceTypeSchema = z.enum([
  'iron_ore',
  'copper_ore',
  'tin_ore',
  'coal',
  'stone',
  'silver_ore',
  'gold_vein',
  'gem_cluster',
  'mithril_seam',
  'adamantine_vein',
])
export type MineResourceType = z.infer<typeof MineResourceTypeSchema>

/** Roughly which resources show up at which depth bands. Higher = rarer + richer. */
export const RESOURCE_DEPTH_BAND: Record<MineResourceType, { minDepth: number; tier: number }> = {
  stone:           { minDepth: 0,    tier: 0 },
  iron_ore:        { minDepth: 0,    tier: 1 },
  coal:            { minDepth: 50,   tier: 1 },
  copper_ore:      { minDepth: 50,   tier: 1 },
  tin_ore:         { minDepth: 100,  tier: 2 },
  silver_ore:      { minDepth: 200,  tier: 2 },
  gold_vein:       { minDepth: 300,  tier: 3 },
  gem_cluster:     { minDepth: 400,  tier: 3 },
  mithril_seam:    { minDepth: 600,  tier: 4 },
  adamantine_vein: { minDepth: 800,  tier: 5 },
}

const ALL_RESOURCES = Object.keys(RESOURCE_DEPTH_BAND) as MineResourceType[]

// ============================================================
// HAZARD EVENT — fired on dig fail or low integrity
// ============================================================

export const HazardKindSchema = z.enum(['caveIn', 'gasLeak', 'flood'])
export type HazardKind = z.infer<typeof HazardKindSchema>

export const HazardEventSchema = z.object({
  kind: HazardKindSchema,
  /** 0..1 — multiplier on damage / immobilization. */
  severity: z.number().min(0).max(1),
  /** DC for survival/engineering check to mitigate. */
  mitigationDC: z.number().int().min(5).max(30),
})
export type HazardEvent = z.infer<typeof HazardEventSchema>

// ============================================================
// MINE LAYER — one stratum of a mine
// ============================================================

export const MineLayerSchema = z.object({
  /** 0 = surface, 1+ = deeper. */
  layerId: z.number().int().min(0).max(10),
  /** Meters below surface. layerId 0 = depth 0. */
  depth: z.number().nonnegative(),
  resourceType: MineResourceTypeSchema,
  /** Initial reserve at reveal time — fixed for the layer's life. */
  initialReserve: z.number().nonnegative(),
  /** Remaining extractable units. Drops as digs succeed. */
  reserve: z.number().nonnegative(),
  /** Daily depletion rate in units/day (independent of player digs). Tier-scaled. */
  depletionRate: z.number().nonnegative(),
  /** 0..1 — drops with each dig and on hazard events. */
  structuralIntegrity: z.number().min(0).max(1),
  /** Trigger hazard rolls when integrity falls below this. */
  hazardThreshold: z.number().min(0).max(1),
  /** Whether the layer is accessible (surface = true; deeper requires reveal). */
  revealed: z.boolean(),
})
export type MineLayer = z.infer<typeof MineLayerSchema>

// ============================================================
// HELPERS — reveal + accumulate (pure)
// ============================================================

const MAX_LAYERS = 10

/** Depth grows with layer index. Surface = 0; +50m to first deep, then +100m per. */
export function depthForLayer(layerId: number): number {
  if (layerId <= 0) return 0
  return 50 + (layerId - 1) * 100
}

/** Pick a deterministic resource type for a layer at a given depth. */
function pickResourceForDepth(rng: SeededRNG, depth: number): MineResourceType {
  const eligible = ALL_RESOURCES.filter((r) => RESOURCE_DEPTH_BAND[r].minDepth <= depth)
  if (eligible.length === 0) return 'stone'
  // Weight inversely by tier — deeper layers favor higher-tier picks.
  const weights = eligible.map((r) => 1 + RESOURCE_DEPTH_BAND[r].tier * 0.5)
  return rng.weightedPick(eligible, weights)
}

/**
 * Maximum reserve for a layer at this depth — units. Deeper = richer, but
 * with diminishing returns past depth 800.
 */
export function maxReserveForDepth(depth: number): number {
  return Math.floor(1000 + depth * 5 + Math.min(depth, 800) * 2)
}

/** Tier-scaled depletion rate (units/day). */
function depletionRateFor(resource: MineResourceType): number {
  const tier = RESOURCE_DEPTH_BAND[resource].tier
  return Math.max(1, 20 - tier * 3)
}

/**
 * Create the surface layer (layer 0) for a new mine. Always revealed.
 * Deterministic from `seed = mineNodeId`.
 */
export function createSurfaceLayer(mineNodeId: string): MineLayer {
  const rng = new SeededRNG(`${mineNodeId}:0`)
  const resource = pickResourceForDepth(rng, 0)
  const initialReserve = Math.floor(maxReserveForDepth(0) * (0.5 + rng.next() * 0.5))
  return {
    layerId: 0,
    depth: 0,
    resourceType: resource,
    initialReserve,
    reserve: initialReserve,
    depletionRate: depletionRateFor(resource),
    structuralIntegrity: 1.0,
    hazardThreshold: 0.3,
    revealed: true,
  }
}

/**
 * Reveal the next layer beneath `parent`. Deterministic from
 * `(mineNodeId, layerId, worldDay)`. Caller decides when to call (typically
 * after a successful `mfMineReveal` dig).
 */
export function revealNextLayer(
  parent: MineLayer,
  mineNodeId: string,
  worldDay: number,
): MineLayer | null {
  const nextId = parent.layerId + 1
  if (nextId > MAX_LAYERS) return null
  const depth = depthForLayer(nextId)
  const rng = new SeededRNG(`${mineNodeId}:${nextId}:${worldDay}`)
  const resource = pickResourceForDepth(rng, depth)
  const initialReserve = Math.floor(maxReserveForDepth(depth) * (0.4 + rng.next() * 0.6))
  return {
    layerId: nextId,
    depth,
    resourceType: resource,
    initialReserve,
    reserve: initialReserve,
    depletionRate: depletionRateFor(resource),
    structuralIntegrity: 1.0,
    hazardThreshold: 0.3,
    revealed: true,
  }
}

/** Daily depletion (no skill check). Returns updated layer copy. */
export function applyDailyDepletion(layer: MineLayer, days: number): MineLayer {
  if (!layer.revealed || layer.reserve <= 0 || days <= 0) return layer
  const drop = layer.depletionRate * days
  const reserve = Math.max(0, layer.reserve - drop)
  return { ...layer, reserve }
}

/** Convenience: density 0..1 = remaining reserve / initial reserve. */
export function densityOf(layer: MineLayer): number {
  if (layer.initialReserve <= 0) return 0
  return Math.max(0, Math.min(1, layer.reserve / layer.initialReserve))
}

/** Whether a hazard check is warranted (integrity below threshold). */
export function shouldRollHazard(layer: MineLayer): boolean {
  return layer.structuralIntegrity < layer.hazardThreshold
}
