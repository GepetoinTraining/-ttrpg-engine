import { describe, it, expect } from 'vitest'
import {
  ECOLOGY_INTERACTABLES,
  InteractableSpeciesSchema,
  KNOWLEDGE_DC_DISCOUNT,
  getInteractable,
  interactablesByKind,
  interactablesByBiome,
} from '../ecology-interactables'

describe('ECOLOGY_INTERACTABLES catalog', () => {
  it('every entry passes Zod validation', () => {
    for (const s of ECOLOGY_INTERACTABLES) {
      const parsed = InteractableSpeciesSchema.safeParse(s)
      expect(parsed.success, `bad species: ${s.id}`).toBe(true)
    }
  })

  it('ids are unique', () => {
    const ids = ECOLOGY_INTERACTABLES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry has at least one intent', () => {
    for (const s of ECOLOGY_INTERACTABLES) {
      const present = Object.values(s.intents).filter(Boolean).length
      expect(present, `species ${s.id} has zero intents`).toBeGreaterThan(0)
    }
  })

  it('covers all four kinds', () => {
    const kinds = new Set(ECOLOGY_INTERACTABLES.map((s) => s.kind))
    expect(kinds).toEqual(new Set(['flora', 'fauna', 'fungi', 'moss']))
  })
})

describe('KNOWLEDGE_DC_DISCOUNT', () => {
  it('is monotonic non-decreasing across tiers', () => {
    expect(KNOWLEDGE_DC_DISCOUNT[0]).toBeLessThanOrEqual(KNOWLEDGE_DC_DISCOUNT[1])
    expect(KNOWLEDGE_DC_DISCOUNT[1]).toBeLessThanOrEqual(KNOWLEDGE_DC_DISCOUNT[2])
    expect(KNOWLEDGE_DC_DISCOUNT[2]).toBeLessThanOrEqual(KNOWLEDGE_DC_DISCOUNT[3])
  })
  it('peaks at 4 (tier 3)', () => {
    expect(KNOWLEDGE_DC_DISCOUNT[3]).toBe(4)
  })
})

describe('lookups', () => {
  it('getInteractable returns a known species', () => {
    expect(getInteractable('willow-bark').name).toBe('Willow Bark')
  })
  it('getInteractable throws on unknown id', () => {
    expect(() => getInteractable('does-not-exist')).toThrow()
  })
  it('interactablesByKind filters', () => {
    const flora = interactablesByKind('flora')
    expect(flora.length).toBeGreaterThan(0)
    expect(flora.every((s) => s.kind === 'flora')).toBe(true)
  })
  it('interactablesByBiome filters by biome membership', () => {
    const forest = interactablesByBiome('forest')
    // forest is the most-populated biome in the starter set
    expect(forest.length).toBeGreaterThan(0)
    for (const s of forest) {
      expect(s.biomes.length === 0 || s.biomes.includes('forest')).toBe(true)
    }
  })
})
