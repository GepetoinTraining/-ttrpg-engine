import { describe, it, expect } from 'vitest'
import {
  WILD_FAUNA_CATALOG,
  WildFaunaSpeciesSchema,
  WildHerdSchema,
  FORMATION_SPEED_MOD,
  FORMATION_DEFENSE_MOD,
  FORMATION_FORAGE_MOD,
  defaultFormationFor,
  isViable,
  getSpecies,
  speciesByBiome,
  speciesByTrophic,
} from '../wild-fauna'

describe('catalog', () => {
  it('every species passes Zod', () => {
    for (const s of WILD_FAUNA_CATALOG) {
      expect(WildFaunaSpeciesSchema.safeParse(s).success).toBe(true)
    }
  })
  it('ids are unique', () => {
    const ids = WILD_FAUNA_CATALOG.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('covers herbivore + omnivore + small-carnivore trophic roles', () => {
    expect(speciesByTrophic('herbivore').length).toBeGreaterThan(0)
    expect(speciesByTrophic('omnivore').length).toBeGreaterThan(0)
    expect(speciesByTrophic('small-carnivore').length).toBeGreaterThan(0)
  })
  it('every species has at least one biome', () => {
    for (const s of WILD_FAUNA_CATALOG) {
      expect(s.biomes.length).toBeGreaterThan(0)
    }
  })
})

describe('lookups', () => {
  it('getSpecies works for known ids and throws for unknown', () => {
    expect(getSpecies('deer').name).toBe('Forest Deer')
    expect(() => getSpecies('phoenix')).toThrow()
  })
  it('speciesByBiome filters', () => {
    const forest = speciesByBiome('forest')
    expect(forest.length).toBeGreaterThan(0)
    for (const s of forest) expect(s.biomes).toContain('forest')
  })
})

describe('formation modifier tables', () => {
  it('column is fast and offensive — defense_box is slow and defensive', () => {
    expect(FORMATION_SPEED_MOD.column).toBeGreaterThan(FORMATION_SPEED_MOD.defensive_box)
    expect(FORMATION_DEFENSE_MOD.defensive_box).toBeGreaterThan(FORMATION_DEFENSE_MOD.column)
  })
  it('spread is the only formation that forages', () => {
    expect(FORMATION_FORAGE_MOD.spread).toBeGreaterThan(0)
    expect(FORMATION_FORAGE_MOD.defensive_box).toBe(0)
    expect(FORMATION_FORAGE_MOD.scattered).toBe(0)
  })
  it('scattered is faster than column (panic flee)', () => {
    expect(FORMATION_SPEED_MOD.scattered).toBeGreaterThan(FORMATION_SPEED_MOD.column)
  })
  it('scattered has the lowest defense', () => {
    const all = Object.values(FORMATION_DEFENSE_MOD)
    expect(FORMATION_DEFENSE_MOD.scattered).toBe(Math.min(...all))
  })
})

describe('helpers', () => {
  it('defaultFormationFor maps status → formation correctly', () => {
    expect(defaultFormationFor('grazing')).toBe('spread')
    expect(defaultFormationFor('migrating')).toBe('column')
    expect(defaultFormationFor('fleeing')).toBe('scattered')
  })

  it('isViable is true at minViable, false below', () => {
    const deer = getSpecies('deer')
    const fresh = WildHerdSchema.parse({
      id: 'h1',
      speciesId: 'deer',
      currentNodeId: 'forest-1',
      population: deer.minViable,
      bornDay: 0,
      lastTransitionDay: 0,
    })
    expect(isViable(fresh, deer)).toBe(true)
    expect(isViable({ ...fresh, population: deer.minViable - 1 }, deer)).toBe(false)
  })
})
