/**
 * ECOLOGY-POOL — Combined biome + adaptation accessor for a node
 * =================================================================
 *
 * Sits on top of:
 *   - biome-fauna.ts  (biome at q,r → fauna pool, species selection)
 *   - adaptation.ts   (per-species AdaptationPool with fitness/evolve)
 *   - tp.ts           (κ.ecology.adaptations is the persistent home)
 *
 * The two read paths:
 *   ecologyAt(tp, worldSeed, q, r, regionNodeId)
 *     → { biome, faunaPool, getAdaptations(speciesId) }
 *
 *   getAdaptationPool(tp, nodeId, speciesId)
 *     → AdaptationPool (fresh if none stored)
 *
 * The write path:
 *   writeAdaptationPool(tp, regionNodeId, pool)
 *     → updates κ.ecology.adaptations[speciesId]
 *
 * Adaptation pools live at region-scope κ. Ecology is an inheritable
 * domain, so child nodes (settlements, edges, dungeon gates) read the
 * parent region's pool via tp.resolve(). Writes target the region node
 * directly so all gates in that region share the same evolutionary
 * pressure.
 *
 * NO TICK. Reads are O(walk up to region). Writes fire on event
 * (gate clear, respawn) — observation-driven, never on a heartbeat.
 */

import type { TP, EcologyRules } from './tp'
import {
  type AdaptationPool,
  createAdaptationPool,
} from './adaptation'
import {
  type BiomeType,
  type GateType,
  biomeAt,
  faunaAt,
  selectMonsterSpecies,
} from './biome-fauna'
import type { EcologyEntry } from '../src/game/regionFeatures'

// ============================================================
// READ — Adaptation pool from κ.ecology.adaptations
// ============================================================

/**
 * Look up the adaptation pool for a species at a node. Walks up the κ
 * inheritance chain (region → settlement → ...). Returns a fresh pool
 * if none has been stored yet.
 */
export function getAdaptationPool(
  tp: TP,
  nodeId: string,
  speciesId: string,
): AdaptationPool {
  const ctx = tp.resolve(nodeId)
  const ecology = ctx?.ecology as EcologyRules | undefined
  const stored = ecology?.adaptations?.[speciesId]
  if (!stored) return createAdaptationPool(speciesId)

  // The Zod schema in tp.ts uses string keys (the AdaptationPool type
  // uses the Adaptation enum). They're structurally identical at
  // runtime — we cast to the strongly-typed shape for downstream use.
  return stored as unknown as AdaptationPool
}

/**
 * Write a single adaptation pool back to a region's κ.ecology.adaptations.
 * Merges with existing adaptations for other species (deep-merge in
 * writeDomain). Returns true if the node was found.
 */
export function writeAdaptationPool(
  tp: TP,
  regionNodeId: string,
  pool: AdaptationPool,
): boolean {
  return tp.writeDomain(regionNodeId, 'ecology', {
    adaptations: {
      [pool.speciesId]: pool,
    },
  } as EcologyRules)
}

// ============================================================
// REGION RESOLUTION — find the closest region-typed ancestor
// ============================================================

/**
 * Walk up the parent chain from `nodeId` to find a node of type 'region'.
 * Falls back to the closest non-leaf ancestor (continent/kingdom/...) if
 * no 'region' node exists. Returns the node id, or `nodeId` itself as a
 * last resort.
 */
export function regionForNode(tp: TP, nodeId: string): string {
  let current = tp.getNode(nodeId)
  if (!current) return nodeId

  // First pass: look specifically for type === 'region'
  let walker: typeof current | undefined = current
  while (walker) {
    if (walker.type === 'region') return walker.id
    if (!walker.parentId) break
    walker = tp.getNode(walker.parentId)
  }

  // Fallback: any non-leaf ancestor (kingdom, continent, planet)
  walker = current
  while (walker) {
    const t = walker.type
    if (t === 'kingdom' || t === 'continent' || t === 'planet' || t === 'crystal_sphere') {
      return walker.id
    }
    if (!walker.parentId) break
    walker = tp.getNode(walker.parentId)
  }

  return nodeId
}

// ============================================================
// COMBINED ACCESSOR — biome + fauna + adaptation pools
// ============================================================

export interface EcologyAt {
  /** The biome at (q, r) per src/game/biome.ts. */
  biome: BiomeType
  /** Wildlife pool from src/game/regionFeatures.ts. */
  faunaPool: EcologyEntry[]
  /** Region node id used for adaptation pool storage (for writes). */
  regionNodeId: string
  /** Lookup an adaptation pool by species (region-scoped). */
  getAdaptations(speciesId: string): AdaptationPool
  /**
   * Pick a species for a gate at this node, deterministic given the d20.
   * Returns the speciesId or null if no candidates exist for this biome
   * × gateType combination.
   */
  selectSpecies(gateType: GateType, d20: number): string | null
}

/**
 * The "what's alive here?" query for any node with a known (q, r).
 *
 * @param tp - The world topology
 * @param worldSeed - Seed used by biome.ts createBiomeResolver
 * @param q - Hex coordinate
 * @param r - Hex coordinate
 * @param nodeId - Node where this hex lives (used to resolve region for κ writes)
 */
export function ecologyAt(
  tp: TP,
  worldSeed: number,
  q: number,
  r: number,
  nodeId: string,
): EcologyAt {
  const biome = biomeAt(worldSeed, q, r)
  const faunaPool = faunaAt(worldSeed, q, r)
  const regionNodeId = regionForNode(tp, nodeId)

  return {
    biome,
    faunaPool,
    regionNodeId,
    getAdaptations(speciesId: string): AdaptationPool {
      return getAdaptationPool(tp, nodeId, speciesId)
    },
    selectSpecies(gateType: GateType, d20: number): string | null {
      return selectMonsterSpecies(worldSeed, q, r, gateType, d20)
    },
  }
}
