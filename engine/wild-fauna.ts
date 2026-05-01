/**
 * WILD FAUNA — populations, formations, travel
 * ===============================================
 *
 * The missing tier between `biome-fauna.ts` (predator/humanoid SPECIES_TABLE,
 * no population state) and `husbandry.ts` (DOMESTIC herds, settlement-fed,
 * no migration). Wild fauna are populations that LIVE in the world: they
 * graze, breed, get eaten, migrate, starve, and form herds.
 *
 * Pure types + species catalog + formation/state shapes. The MFs in
 * `mf-herd-life.ts` consume these. The MM (`mm-wild-fauna.ts`, Phase 2)
 * binds them to Clockwork L5 ECOLOGY.
 *
 * Formation primitives adapt the `entourages` schema (column/wedge/spread/
 * defensive_box, position roles) from `src/db/schema.ts`. That table was
 * authored for player+caravan+army travel groups; we re-use the same vocab
 * for natural herds because the spatial logic is identical: a moving group
 * has a leading edge, a center, flanks, and a trailing edge, and the
 * formation determines speed × defense × cohesion.
 */

import { z } from 'zod'

// ============================================================
// DIET / TROPHIC ROLE
// ============================================================

export const TrophicRoleSchema = z.enum([
  'herbivore',     // grazes flora; eaten by carnivores
  'omnivore',      // grazes + opportunistic small prey
  'small-carnivore',  // eats small herbivores; less likely to be apex
  'apex-carnivore',   // top of chain; only eats; never eaten
])
export type TrophicRole = z.infer<typeof TrophicRoleSchema>

// ============================================================
// FORMATION — adapted from entourages.formationType
// ============================================================

export const FormationSchema = z.enum([
  'column',          // migrating along an edge: high speed, low defense
  'defensive_box',   // threatened: low speed, high defense, low forage
  'spread',          // grazing at a node: high forage, low defense
  'scattered',       // fleeing: very low defense, attrition risk
])
export type Formation = z.infer<typeof FormationSchema>

/** Speed multiplier per formation (1.0 = baseline). */
export const FORMATION_SPEED_MOD: Record<Formation, number> = {
  column:        1.0,
  defensive_box: 0.4,
  spread:        0.0,    // not moving while grazing
  scattered:    1.5,    // panic-flee is fast but disordered
}

/** Defense multiplier per formation (1.0 = baseline; lower = more vulnerable). */
export const FORMATION_DEFENSE_MOD: Record<Formation, number> = {
  column:        0.8,
  defensive_box: 1.5,
  spread:        0.5,
  scattered:    0.3,
}

/** Forage efficiency per formation (1.0 = baseline at spread). */
export const FORMATION_FORAGE_MOD: Record<Formation, number> = {
  column:        0.2,    // can eat a bit on the move
  defensive_box: 0.0,
  spread:        1.0,
  scattered:    0.0,
}

// ============================================================
// HERD STATUS — high-level lifecycle
// ============================================================

export const HerdStatusSchema = z.enum([
  'grazing',    // at a node, formation=spread
  'migrating',  // on an edge, formation=column
  'fleeing',    // formation=scattered, fast move toward refuge
  'starving',   // food < threshold and no migration target available
  'decimated',  // population fell below viability; herd dissolves on next tick
])
export type HerdStatus = z.infer<typeof HerdStatusSchema>

// ============================================================
// WILD FAUNA SPECIES — catalog row
// ============================================================

export const WildFaunaSpeciesSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trophic: TrophicRoleSchema,
  /** Biome ids where this species can establish a herd. */
  biomes: z.array(z.string()).min(1),
  /** Typical herd size (count). Generation rolls within ±50%. */
  baseHerdSize: z.number().int().min(1).max(500),
  /** Minimum viable population — below this, herd is `decimated`. */
  minViable: z.number().int().min(1).max(50),
  /** Carrying capacity per node — caps growth. */
  carryingCapacity: z.number().int().min(1).max(1000),
  /** Daily flora units one head consumes (herbivores) or prey units (carnivores). */
  dailyFoodNeed: z.number().min(0).max(10),
  /** Daily breeding rate per head when food is abundant (food >= 1.0). */
  baseBreedingRate: z.number().min(0).max(0.05),
  /** Daily mortality rate from age + accidents (independent of food). */
  baseMortalityRate: z.number().min(0).max(0.02),
  /** Migration tick: days hungry before herd seeks a new node. */
  hungerMigrationThreshold: z.number().int().min(1).max(60),
  /** Flee speed multiplier under predator pressure (formation=scattered). */
  fleeSpeedMod: z.number().min(0.5).max(3),
})
export type WildFaunaSpecies = z.infer<typeof WildFaunaSpeciesSchema>

// ============================================================
// HERD STATE — runtime (lives in mm_states / κ.ecology)
// ============================================================

export const WildHerdSchema = z.object({
  id: z.string().min(1),
  speciesId: z.string().min(1),
  /** Current `.tp` node — settlement, edge_site, region, etc. */
  currentNodeId: z.string().min(1),
  /** Set while migrating; the destination node. */
  destinationNodeId: z.string().nullable().default(null),
  /** Edge id along which the herd is currently traveling (null at-node). */
  edgeId: z.string().nullable().default(null),
  /** Mile marker on the edge if migrating. */
  edgeMile: z.number().nonnegative().default(0),
  /** Total miles to traverse on the current edge. */
  edgeTotalMiles: z.number().nonnegative().default(0),
  /** Current population (head count). */
  population: z.number().int().nonnegative(),
  /** Days the herd has gone with food < 1.0. Reset on full feed. */
  daysHungry: z.number().int().nonnegative().default(0),
  /** Food security 0..1 — abstract scalar, drops with hunger. */
  foodSecurity: z.number().min(0).max(1).default(1.0),
  formation: FormationSchema.default('spread'),
  status: HerdStatusSchema.default('grazing'),
  /** World day the herd was created or last fully reset. */
  bornDay: z.number().int().nonnegative(),
  /** World day of last status transition (for surface UI). */
  lastTransitionDay: z.number().int().nonnegative(),
})
export type WildHerd = z.infer<typeof WildHerdSchema>

// ============================================================
// CATALOG — 6 starter species (mix of trophic roles)
// ============================================================

export const WILD_FAUNA_CATALOG: WildFaunaSpecies[] = [
  {
    id: 'deer',
    name: 'Forest Deer',
    trophic: 'herbivore',
    biomes: ['forest', 'plains', 'river_valley'],
    baseHerdSize: 12,
    minViable: 3,
    carryingCapacity: 40,
    dailyFoodNeed: 1.5,
    baseBreedingRate: 0.008,
    baseMortalityRate: 0.003,
    hungerMigrationThreshold: 14,
    fleeSpeedMod: 2.0,
  },
  {
    id: 'rabbit',
    name: 'Forest Rabbit',
    trophic: 'herbivore',
    biomes: ['forest', 'plains'],
    baseHerdSize: 30,
    minViable: 8,
    carryingCapacity: 120,
    dailyFoodNeed: 0.3,
    baseBreedingRate: 0.025,
    baseMortalityRate: 0.005,
    hungerMigrationThreshold: 7,
    fleeSpeedMod: 2.5,
  },
  {
    id: 'boar',
    name: 'Wild Boar',
    trophic: 'omnivore',
    biomes: ['forest', 'swamp', 'jungle'],
    baseHerdSize: 6,
    minViable: 2,
    carryingCapacity: 25,
    dailyFoodNeed: 1.2,
    baseBreedingRate: 0.005,
    baseMortalityRate: 0.002,
    hungerMigrationThreshold: 21,
    fleeSpeedMod: 1.4,
  },
  {
    id: 'mountain-goat',
    name: 'Mountain Goat',
    trophic: 'herbivore',
    biomes: ['mountains', 'hills', 'tundra'],
    baseHerdSize: 8,
    minViable: 2,
    carryingCapacity: 25,
    dailyFoodNeed: 0.8,
    baseBreedingRate: 0.006,
    baseMortalityRate: 0.002,
    hungerMigrationThreshold: 30,
    fleeSpeedMod: 1.8,
  },
  {
    id: 'fox',
    name: 'Red Fox',
    trophic: 'small-carnivore',
    biomes: ['forest', 'plains', 'tundra'],
    baseHerdSize: 4,
    minViable: 1,
    carryingCapacity: 15,
    dailyFoodNeed: 0.6,
    baseBreedingRate: 0.004,
    baseMortalityRate: 0.003,
    hungerMigrationThreshold: 10,
    fleeSpeedMod: 2.2,
  },
  {
    id: 'owl',
    name: 'Forest Owl',
    trophic: 'small-carnivore',
    biomes: ['forest'],
    baseHerdSize: 3,
    minViable: 1,
    carryingCapacity: 10,
    dailyFoodNeed: 0.3,
    baseBreedingRate: 0.003,
    baseMortalityRate: 0.002,
    hungerMigrationThreshold: 12,
    fleeSpeedMod: 2.5,
  },
]

export function getSpecies(id: string): WildFaunaSpecies {
  const found = WILD_FAUNA_CATALOG.find((s) => s.id === id)
  if (!found) throw new Error(`unknown wild fauna species: ${id}`)
  return found
}

export function speciesByBiome(biomeId: string): WildFaunaSpecies[] {
  return WILD_FAUNA_CATALOG.filter((s) => s.biomes.includes(biomeId))
}

export function speciesByTrophic(role: TrophicRole): WildFaunaSpecies[] {
  return WILD_FAUNA_CATALOG.filter((s) => s.trophic === role)
}

// ============================================================
// HELPERS — formation/status transitions
// ============================================================

/** Pick formation for a given status. Conventional mapping. */
export function defaultFormationFor(status: HerdStatus): Formation {
  switch (status) {
    case 'grazing':   return 'spread'
    case 'migrating': return 'column'
    case 'fleeing':   return 'scattered'
    case 'starving':  return 'spread'      // still trying to forage
    case 'decimated': return 'scattered'
  }
}

/** Whether the herd is below the species' minimum viable population. */
export function isViable(herd: WildHerd, species: WildFaunaSpecies): boolean {
  return herd.population >= species.minViable
}
