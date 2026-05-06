/**
 * MORPHOGEN — Continuous field interpolation for the hologram
 * ============================================================
 *
 * The morphogen field is the 99.98% substrate of a tile's character.
 * It interpolates the node's κ-domains into a continuous probability
 * density at exact tile coords (q, r), answering:
 *   "What is this tile most likely to contain, before seed variation?"
 *
 * Phase 1 implementation: returns substrate κ unchanged (stub).
 * Phase 4+: smooth gradient interpolation across hex/square neighborhood.
 *
 * See: docs/mesh-hologram.md § Step 3 — Compute the substrate
 * See: docs/sectors-without-number-analysis.md § chance.weighted
 *
 * Weighted selection uses `SeededRNG.weightedPick` (equivalent to
 * chance.weighted; deterministic from the same rng stream).
 */

import type { LocalContext } from './tp'
import { SeededRNG } from './hub-topology'
import type { MaterialClass, MaterialComposition } from './hologram'

// ============================================================
// MORPHOGEN FIELD — the continuous substrate at (q, r)
// ============================================================

export interface MorphogenField {
  /** The source κ context (inherited from the containing node) */
  kappa: LocalContext
  /** Tile-local coords passed through (used for future interpolation) */
  q: number
  r: number
  /**
   * Biome class weight table — probability density over MaterialClass.
   * Derived from ecology + physics + weather κ. Weights are relative
   * (don't need to sum to 1 — weightedPick normalizes internally).
   */
  materialWeights: Record<MaterialClass, number>
  /**
   * Biome variant key (e.g. 'temperate_forest', 'arid_desert').
   * Derived from ecology + weather κ.
   */
  biomeTag: string
  /**
   * How "active" entities are at this tile — 0 = dead/empty, 1 = teeming.
   * Derived from ecology.wildlifeDensity + faction.garrisonLevel.
   */
  entityDensity: number
  /**
   * How dangerous the tile is — 0 = safe, 1 = lethal.
   * Drives which entity tiers show up in rollEntityPresence.
   */
  dangerLevel: number
  /**
   * Magic intensity at the tile — influences crystal/exotic class weights.
   */
  magicLevel: number
}

// ============================================================
// STEP 3 — computeMorphogenField
// ============================================================

const BIOME_TAG_MAP: Record<string, string> = {
  standard_forest:   'temperate_forest',
  standard_plain:    'open_plain',
  standard_desert:   'arid_desert',
  standard_tundra:   'frozen_tundra',
  standard_mountain: 'rocky_highland',
  standard_swamp:    'wetland_marsh',
  standard_ocean:    'deep_ocean',
  standard_coastal:  'coastal_shallows',
  standard_cave:     'subterranean',
}

const MAGIC_LEVEL_SCALAR: Record<string, number> = {
  dead: 0, restricted: 0.2, standard: 0.4, enhanced: 0.6, high: 0.8, wild: 1.0,
}

/**
 * Compute the morphogen field at tile (q, r) within the given LocalContext.
 *
 * Phase 1 stub: returns substrate κ unchanged; interpolation disabled.
 * Future phases smooth Δκ across the neighborhood at (q, r).
 *
 * TODO Phase 4: implement smooth gradient across 4/8 neighbors.
 */
export function computeMorphogenField(ctx: LocalContext, q: number, r: number): MorphogenField {
  const wildlifeDensity = ctx.ecology?.wildlifeDensity ?? 0.3
  const dangerLevel     = ctx.ecology?.dangerLevel     ?? 0.2
  const magicTag        = ctx.physics?.magic?.level    ?? 'standard'
  const magicLevel      = MAGIC_LEVEL_SCALAR[magicTag] ?? 0.4

  // Build biome tag from ecology + weather
  const precipType   = ctx.weather?.precipitation as string | undefined
  const tempCelsius  = ctx.weather?.temperature   // number | undefined
  const biomeTag     = deriveBiomeTag(wildlifeDensity, precipType, tempCelsius)

  // Build material weight table from κ scalars
  const materialWeights = deriveMaterialWeights(ctx, wildlifeDensity, dangerLevel, magicLevel)

  return {
    kappa: ctx,
    q,
    r,
    materialWeights,
    biomeTag,
    entityDensity: Math.max(0, Math.min(1, wildlifeDensity)),
    dangerLevel: Math.max(0, Math.min(1, dangerLevel)),
    magicLevel,
  }
}

function deriveBiomeTag(
  wildlifeDensity: number,
  precipType?: string,
  tempCelsius?: number,
): string {
  if (precipType === 'heavy_rain' || precipType === 'storm') return 'wetland_marsh'
  if (tempCelsius !== undefined && tempCelsius < 0)          return 'frozen_tundra'
  if (precipType === 'snow' || precipType === 'blizzard')    return 'frozen_tundra'
  if (tempCelsius !== undefined && tempCelsius > 35 && (precipType === 'none' || !precipType)) return 'arid_desert'
  if (wildlifeDensity > 0.7) return 'temperate_forest'
  if (wildlifeDensity > 0.4) return 'open_plain'
  if (wildlifeDensity < 0.1) return 'subterranean'
  return BIOME_TAG_MAP[`standard_forest`] ?? 'temperate_forest'
}

function deriveMaterialWeights(
  ctx: LocalContext,
  wildlifeDensity: number,
  dangerLevel: number,
  magicLevel: number,
): Record<MaterialClass, number> {
  // Base weights — soil and stone are always present
  const buildings  = ctx.infrastructure?.buildings ?? {}
  const hasForge   = Object.keys(buildings).some(k => k.includes('forge'))
  const buildCount = Object.keys(buildings).length
  const hasSources = Object.keys(ctx.water?.sources ?? {}).length > 0
  const isCold     = (ctx.weather?.temperature ?? 15) < 0
  const isFog      = ctx.weather?.precipitation === 'fog'

  return {
    soil:    3.0 + (wildlifeDensity > 0.3 ? 1.0 : 0),
    stone:   2.0 + (dangerLevel > 0.5 ? 1.0 : 0),
    fiber:   wildlifeDensity * 4.0,
    metal:   hasForge ? 1.5 : 0.3,
    ceramic: buildCount > 2 ? 0.8 : 0.1,
    glass:   0.1 + magicLevel * 0.5,
    gem:     0.1 + magicLevel * 0.3,
    fluid:   hasSources ? 2.0 : 0.3,
    gas:     isFog ? 1.5 : 0.2,
    organic: wildlifeDensity * 2.0 + 0.5,
    ice:     isCold ? 2.0 : 0.05,
    crystal: magicLevel * 1.5,
    exotic:  Math.max(0, magicLevel - 0.7) * 0.8,
  }
}

// ============================================================
// STEP 4 helpers — variation picks
// ============================================================

/**
 * Weighted pick of material composition.
 * Returns a composition (0..1 densities) for the dominant 3-5 classes.
 * Uses rng.weightedPick (equivalent to chance.weighted — same Gaussian-shaped
 * distribution pattern from sectors-without-number).
 */
export function pickMaterialComposition(
  field: MorphogenField,
  rng: SeededRNG,
): MaterialComposition {
  const classes = Object.keys(field.materialWeights) as MaterialClass[]
  const weights = classes.map(c => Math.max(0, field.materialWeights[c]))

  // Pick 3-4 material classes for this tile
  const count = rng.rangeInt(2, 4)
  const composition: MaterialComposition = {}

  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    // Zero out already-picked classes before each pick
    const adjusted = weights.map((w, idx) => used.has(classes[idx]) ? 0 : w)
    const total = adjusted.reduce((a, b) => a + b, 0)
    if (total <= 0) break
    const picked = rng.weightedPick(classes, adjusted)
    used.add(picked)
    composition[picked] = 0 // placeholder — fill after picks
  }

  // Assign densities: dominant 60%, secondary 25%, rest split
  const picked = Array.from(used) as MaterialClass[]
  const total_slots = [0.60, 0.25, 0.10, 0.05]
  for (let i = 0; i < picked.length; i++) {
    composition[picked[i]] = total_slots[i] ?? 0.05
  }

  return composition
}

/** Pick the biome variant key for this tile. */
export function pickBiomeVariant(field: MorphogenField, rng: SeededRNG): string {
  const variants: string[] = [
    field.biomeTag,
    field.biomeTag + '_sparse',
    field.biomeTag + '_dense',
  ]
  const biasWeights = [0.5, 0.3, 0.2]
  return rng.weightedPick(variants, biasWeights)
}

/** Per-entity-slot: does this tile spawn this type of entity? */
export interface EntityRoll {
  slotType: string
  present: boolean
  tierHint: number
}

export function rollEntityPresence(field: MorphogenField, rng: SeededRNG): EntityRoll[] {
  const entitySlots: Array<{ slotType: string; baseChance: number; tierHint: number }> = [
    { slotType: 'npc',      baseChance: 0.15 * field.entityDensity,       tierHint: 3 },
    { slotType: 'monster',  baseChance: 0.10 * field.dangerLevel,         tierHint: 3 },
    { slotType: 'herd',     baseChance: 0.08 * field.entityDensity,       tierHint: 5 },
    { slotType: 'deposit',  baseChance: 0.05,                             tierHint: 8 },
    { slotType: 'ruin',     baseChance: 0.03 * (1 - field.entityDensity), tierHint: 7 },
    { slotType: 'caravan',  baseChance: 0.04,                             tierHint: 12 },
  ]

  return entitySlots.map(slot => ({
    slotType: slot.slotType,
    present: rng.next() < slot.baseChance,
    tierHint: slot.tierHint,
  }))
}

/** Roll affixes for any items this tile generates (e.g. harvested resources). */
export function rollAffixes(field: MorphogenField, rng: SeededRNG): string[] {
  const pool = [
    'resonant', 'weathered', 'pristine', 'ancient', 'corrupted',
    'blessed', 'infused', 'depleted', 'abundant', 'rare_vein',
  ]
  const magicBonus   = field.magicLevel > 0.6 ? 0.2 : 0
  const dangerBonus  = field.dangerLevel > 0.7 ? 0.1 : 0
  const roll = rng.next()
  if (roll < 0.05 + magicBonus + dangerBonus) {
    return [rng.pick(pool)]
  }
  if (roll < 0.01 + magicBonus) {
    return [rng.pick(pool), rng.pick(pool)].filter((a, i, arr) => arr.indexOf(a) === i)
  }
  return []
}
