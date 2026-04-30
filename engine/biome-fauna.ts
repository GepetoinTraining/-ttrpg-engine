/**
 * BIOME-FAUNA — The geology→fauna→monster bridge
 * ==================================================
 *
 * Pure functions that connect `src/game/biome.ts` (terrain at q,r) and
 * `src/game/regionFeatures.ts` (fauna pool per biome) to the engine.
 *
 * Provides:
 *   - Biome lookup at (worldSeed, q, r)
 *   - Fauna pool at (worldSeed, q, r)
 *   - Master species table: color, baseCR, size, default temperament,
 *     default objective. Owns the D&D size mapping.
 *   - Species selection: (biome, gateType, d20) → speciesId
 *   - Helpers: deriveBaseCR(speciesId, tier), crToMobSize(cr)
 *
 * Holds no state. No tick. Just a substrate for the gate / monster-actor /
 * mob-ai modules to consume.
 */

import { type BiomeType, createBiomeResolver } from '../src/game/biome'
import { generateRegionFeatures, type EcologyEntry } from '../src/game/regionFeatures'

export type { BiomeType }

// ============================================================
// MOB SIZE — D&D 5e categories
// ============================================================

export type MobSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'

/** Pixel size per direction frame for the sprite generator. */
export const MOB_SIZE_PX: Record<MobSize, number> = {
  Tiny:       16,
  Small:      24,
  Medium:     32,
  Large:      64,
  Huge:       128,
  Gargantuan: 256,
}

/**
 * D&D-style CR-to-size hint. Most species have an INTRINSIC size from the
 * SPECIES_TABLE (a goblin is Small no matter the CR), so prefer
 * `speciesInfo(id).size`. Use this only when you have a CR but no species.
 */
export function crToMobSize(cr: number): MobSize {
  if (cr < 0.25) return 'Tiny'
  if (cr < 1)    return 'Small'
  if (cr < 4)    return 'Medium'
  if (cr < 10)   return 'Large'
  if (cr < 17)   return 'Huge'
  return 'Gargantuan'
}

// ============================================================
// TEMPERAMENT + OBJECTIVE — used by mob-ai (defined here so the
// species table can default them; mob-ai re-exports for ergonomics)
// ============================================================

export type Temperament =
  | 'AGGRESSIVE'
  | 'COWARD'
  | 'TERRITORIAL'
  | 'PASSIVE'
  | 'BERSERKER'
  | 'OPPORTUNIST'
  | 'HIVEMIND'

export type MobObjective =
  | 'KILL_PLAYER'
  | 'PROTECT_ASSET'
  | 'HOARD'
  | 'SURVIVE'
  | 'FEED'
  | 'WITNESS'
  | 'REPRODUCE'

// ============================================================
// SPECIES TABLE — Master record of every monster the engine knows
// ============================================================

export interface SpeciesInfo {
  id: string
  /** Hex color for sprite base body. */
  color: string
  /** D&D 5e CR at base (no adaptations, no tier scaling). */
  baseCR: number
  /** D&D 5e size category — intrinsic to the species. */
  size: MobSize
  defaultTemperament: Temperament
  defaultObjective: MobObjective
  /** High-level taxonomy bucket — used by some downstream renderers. */
  kingdom: 'humanoid' | 'beast' | 'undead' | 'planar' | 'aberrant'
}

export const SPECIES_TABLE: Record<string, SpeciesInfo> = {
  // ── Humanoids ───────────────────────────────────────────────
  goblin:     { id: 'goblin',     color: '#5a8a3a', baseCR: 0.25,  size: 'Small',  defaultTemperament: 'COWARD',      defaultObjective: 'HOARD',         kingdom: 'humanoid' },
  kobold:     { id: 'kobold',     color: '#8a4a3a', baseCR: 0.125, size: 'Small',  defaultTemperament: 'COWARD',      defaultObjective: 'PROTECT_ASSET', kingdom: 'humanoid' },
  orc:        { id: 'orc',        color: '#5a3a2a', baseCR: 1.0,   size: 'Medium', defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'KILL_PLAYER',   kingdom: 'humanoid' },
  gnoll:      { id: 'gnoll',      color: '#aa7a3a', baseCR: 1.0,   size: 'Medium', defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'FEED',          kingdom: 'humanoid' },
  lizardfolk: { id: 'lizardfolk', color: '#3a8a5a', baseCR: 0.5,   size: 'Medium', defaultTemperament: 'TERRITORIAL', defaultObjective: 'PROTECT_ASSET', kingdom: 'humanoid' },
  bandit:     { id: 'bandit',     color: '#6a4a3a', baseCR: 0.25,  size: 'Medium', defaultTemperament: 'OPPORTUNIST', defaultObjective: 'HOARD',         kingdom: 'humanoid' },
  ogre:       { id: 'ogre',       color: '#7a5a3a', baseCR: 2.0,   size: 'Large',  defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'KILL_PLAYER',   kingdom: 'humanoid' },
  troll:      { id: 'troll',      color: '#5a7a5a', baseCR: 5.0,   size: 'Large',  defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'KILL_PLAYER',   kingdom: 'humanoid' },

  // ── Beasts ──────────────────────────────────────────────────
  wolf:           { id: 'wolf',           color: '#7a7a7a', baseCR: 0.25, size: 'Medium', defaultTemperament: 'TERRITORIAL', defaultObjective: 'FEED',          kingdom: 'beast' },
  wolf_pack:      { id: 'wolf_pack',      color: '#5a5a5a', baseCR: 1.0,  size: 'Medium', defaultTemperament: 'TERRITORIAL', defaultObjective: 'FEED',          kingdom: 'beast' },
  bear:           { id: 'bear',           color: '#5a3a2a', baseCR: 1.0,  size: 'Large',  defaultTemperament: 'TERRITORIAL', defaultObjective: 'PROTECT_ASSET', kingdom: 'beast' },
  mountain_lion:  { id: 'mountain_lion',  color: '#aa8a5a', baseCR: 1.0,  size: 'Large',  defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'FEED',          kingdom: 'beast' },
  alligator:      { id: 'alligator',      color: '#3a5a3a', baseCR: 2.0,  size: 'Large',  defaultTemperament: 'TERRITORIAL', defaultObjective: 'FEED',          kingdom: 'beast' },
  giant_spider:   { id: 'giant_spider',   color: '#3a2a3a', baseCR: 1.0,  size: 'Large',  defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'FEED',          kingdom: 'beast' },
  scorpion_swarm: { id: 'scorpion_swarm', color: '#aa5a3a', baseCR: 1.0,  size: 'Medium', defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'KILL_PLAYER',   kingdom: 'beast' },
  ice_bear:       { id: 'ice_bear',       color: '#dadada', baseCR: 2.0,  size: 'Large',  defaultTemperament: 'TERRITORIAL', defaultObjective: 'PROTECT_ASSET', kingdom: 'beast' },
  arctic_wolf:    { id: 'arctic_wolf',    color: '#cacaca', baseCR: 0.5,  size: 'Medium', defaultTemperament: 'TERRITORIAL', defaultObjective: 'FEED',          kingdom: 'beast' },

  // ── Undead ──────────────────────────────────────────────────
  skeleton: { id: 'skeleton', color: '#e8e0c0', baseCR: 0.25, size: 'Medium', defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'KILL_PLAYER',   kingdom: 'undead' },
  wight:    { id: 'wight',    color: '#3a2a4a', baseCR: 3.0,  size: 'Medium', defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'KILL_PLAYER',   kingdom: 'undead' },
  mummy:    { id: 'mummy',    color: '#a89a6a', baseCR: 3.0,  size: 'Medium', defaultTemperament: 'TERRITORIAL', defaultObjective: 'PROTECT_ASSET', kingdom: 'undead' },
  ghoul:    { id: 'ghoul',    color: '#7a8a6a', baseCR: 1.0,  size: 'Medium', defaultTemperament: 'BERSERKER',   defaultObjective: 'FEED',          kingdom: 'undead' },

  // ── Planar ──────────────────────────────────────────────────
  dretch:          { id: 'dretch',          color: '#aa4a4a', baseCR: 0.25, size: 'Small',  defaultTemperament: 'COWARD',      defaultObjective: 'KILL_PLAYER',   kingdom: 'planar' },
  shadow:          { id: 'shadow',          color: '#1a1a2a', baseCR: 0.5,  size: 'Medium', defaultTemperament: 'OPPORTUNIST', defaultObjective: 'FEED',          kingdom: 'planar' },
  fire_elemental:  { id: 'fire_elemental',  color: '#ff5a1a', baseCR: 5.0,  size: 'Large',  defaultTemperament: 'AGGRESSIVE',  defaultObjective: 'KILL_PLAYER',   kingdom: 'planar' },
  water_elemental: { id: 'water_elemental', color: '#1a5aff', baseCR: 5.0,  size: 'Large',  defaultTemperament: 'TERRITORIAL', defaultObjective: 'PROTECT_ASSET', kingdom: 'planar' },

  // ── Aberrant ────────────────────────────────────────────────
  gibbering_mouther: { id: 'gibbering_mouther', color: '#7a3a5a', baseCR: 2.0, size: 'Medium', defaultTemperament: 'BERSERKER',   defaultObjective: 'FEED',      kingdom: 'aberrant' },
  nothic:            { id: 'nothic',            color: '#5a3a4a', baseCR: 2.0, size: 'Medium', defaultTemperament: 'OPPORTUNIST', defaultObjective: 'WITNESS',   kingdom: 'aberrant' },
  blighted:          { id: 'blighted',          color: '#3a4a2a', baseCR: 1.0, size: 'Medium', defaultTemperament: 'HIVEMIND',    defaultObjective: 'REPRODUCE', kingdom: 'aberrant' },
}

/** Lookup species info or fall back to a generic profile. */
export function speciesInfo(speciesId: string): SpeciesInfo {
  return SPECIES_TABLE[speciesId] ?? {
    id: speciesId,
    color: '#888888',
    baseCR: 0.5,
    size: 'Medium',
    defaultTemperament: 'AGGRESSIVE',
    defaultObjective: 'KILL_PLAYER',
    kingdom: 'beast',
  }
}

// ============================================================
// BIOME × GATE-TYPE → CANDIDATE SPECIES
// ============================================================
//
// Lair gates draw from biome-flavored beasts + humanoids. Other gate
// types are less biome-bound (a corruption node is corruption regardless
// of forest vs swamp), but we still spice them where it fits.

export type GateType = 'ruin' | 'lair' | 'portal' | 'corruption'

const BIOME_GATE_SPECIES: Record<BiomeType, Record<GateType, string[]>> = {
  ocean: {
    ruin:       ['skeleton'],
    lair:       ['alligator'],
    portal:     ['water_elemental'],
    corruption: ['gibbering_mouther'],
  },
  coast: {
    ruin:       ['skeleton'],
    lair:       ['lizardfolk', 'alligator'],
    portal:     ['water_elemental', 'shadow'],
    corruption: ['gibbering_mouther'],
  },
  plains: {
    ruin:       ['skeleton'],
    lair:       ['gnoll', 'bandit', 'wolf_pack'],
    portal:     ['dretch', 'shadow'],
    corruption: ['blighted'],
  },
  forest: {
    ruin:       ['skeleton'],
    lair:       ['goblin', 'wolf_pack', 'bandit'],
    portal:     ['dretch', 'shadow'],
    corruption: ['blighted'],
  },
  dense_forest: {
    ruin:       ['skeleton'],
    lair:       ['goblin', 'giant_spider', 'wolf_pack'],
    portal:     ['shadow', 'dretch'],
    corruption: ['blighted', 'nothic'],
  },
  hills: {
    ruin:       ['skeleton', 'wight'],
    lair:       ['orc', 'goblin', 'bandit'],
    portal:     ['fire_elemental', 'shadow'],
    corruption: ['gibbering_mouther'],
  },
  mountains: {
    ruin:       ['wight', 'skeleton'],
    lair:       ['orc', 'mountain_lion', 'ogre'],
    portal:     ['fire_elemental'],
    corruption: ['gibbering_mouther'],
  },
  desert: {
    ruin:       ['mummy', 'skeleton'],
    lair:       ['gnoll', 'scorpion_swarm', 'kobold'],
    portal:     ['fire_elemental', 'dretch'],
    corruption: ['gibbering_mouther'],
  },
  swamp: {
    ruin:       ['skeleton', 'ghoul'],
    lair:       ['lizardfolk', 'alligator', 'troll'],
    portal:     ['shadow'],
    corruption: ['nothic', 'blighted'],
  },
  tundra: {
    ruin:       ['skeleton', 'wight'],
    lair:       ['arctic_wolf', 'goblin'],
    portal:     ['shadow'],
    corruption: ['blighted'],
  },
  snow: {
    ruin:       ['wight', 'skeleton'],
    lair:       ['ice_bear', 'arctic_wolf', 'troll'],
    portal:     ['shadow'],
    corruption: ['blighted'],
  },
}

// ============================================================
// BIOME / FAUNA LOOKUP — wraps src/game
// ============================================================

/** Resolve the biome at a hex coordinate from the world seed. */
export function biomeAt(worldSeed: number, q: number, r: number): BiomeType {
  const resolver = createBiomeResolver(worldSeed)
  return resolver.getBiome(q, r).type
}

/** Resolve the natural fauna pool at a hex coordinate. */
export function faunaAt(worldSeed: number, q: number, r: number): EcologyEntry[] {
  const biome = biomeAt(worldSeed, q, r)
  return generateRegionFeatures(worldSeed, q, r, biome).ecology.filter(
    e => e.kingdom === 'fauna',
  )
}

// ============================================================
// SPECIES SELECTION
// ============================================================

/**
 * Pick a species for a gate at (q, r). Deterministic given d20.
 *
 *   1. Resolve biome at (q, r)
 *   2. Look up biome × gateType candidate list
 *   3. Pick from list by d20 modulo length
 *
 * Returns null if the biome has no candidates for that gate type
 * (e.g. ocean lairs are sparse).
 */
export function selectMonsterSpecies(
  worldSeed: number,
  q: number,
  r: number,
  gateType: GateType,
  d20: number,
): string | null {
  const biome = biomeAt(worldSeed, q, r)
  const candidates = BIOME_GATE_SPECIES[biome]?.[gateType] ?? []
  if (candidates.length === 0) return null
  const idx = ((d20 - 1) % candidates.length + candidates.length) % candidates.length
  return candidates[idx]
}

/** Get raw candidate list for a (biome, gateType) — useful for testing. */
export function candidateSpeciesFor(biome: BiomeType, gateType: GateType): string[] {
  return BIOME_GATE_SPECIES[biome]?.[gateType] ?? []
}

// ============================================================
// CR DERIVATION
// ============================================================

/** Per-gate-tier CR ceiling (matches dungeon-gate's tier table). */
const GATE_TIER_CR_CEILING: Record<number, number> = {
  1: 1,
  2: 3,
  3: 6,
  4: 10,
  5: 20,
}

/**
 * Effective base CR for a species when spawned from a gate of the given
 * tier. The species' intrinsic baseCR is the floor; the tier ceiling caps
 * the upper bound. We scale up to ¾ of the gap to keep the leader
 * threatening but not headlining the gate.
 */
export function deriveBaseCR(speciesId: string, tier: number): number {
  const info = speciesInfo(speciesId)
  const ceiling = GATE_TIER_CR_CEILING[tier] ?? 1
  if (info.baseCR >= ceiling) return info.baseCR
  const scaled = info.baseCR + (ceiling - info.baseCR) * 0.75
  // Round to D&D quarter-CR convention
  return Math.round(scaled * 4) / 4
}
