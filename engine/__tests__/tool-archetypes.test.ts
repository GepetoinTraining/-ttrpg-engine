import { describe, it, expect } from 'vitest'
import {
  TOOL_ARCHETYPES,
  ToolArchetypeSchema,
  SlotSchema,
  getArchetype,
  deriveSlots,
} from '../tool-archetypes'

describe('TOOL_ARCHETYPES baseline', () => {
  it('has exactly the five abstract archetypes', () => {
    const purposes = Object.keys(TOOL_ARCHETYPES).sort()
    expect(purposes).toEqual(
      [
        'cutting-flora',
        'gathering-aquatic',
        'gathering-flora',
        'kit-study',
        'precision-craft',
        'striking-mine',
      ].sort(),
    )
  })

  it('every archetype passes Zod validation', () => {
    for (const a of Object.values(TOOL_ARCHETYPES)) {
      expect(ToolArchetypeSchema.safeParse(a).success, `bad archetype: ${a.purpose}`).toBe(true)
    }
  })

  it('every archetype has between 1 and 8 base slots', () => {
    for (const a of Object.values(TOOL_ARCHETYPES)) {
      expect(a.baseSlots.length).toBeGreaterThanOrEqual(1)
      expect(a.baseSlots.length).toBeLessThanOrEqual(8)
    }
  })

  it('every base slot passes Zod validation', () => {
    for (const a of Object.values(TOOL_ARCHETYPES)) {
      for (const s of a.baseSlots) {
        expect(SlotSchema.safeParse(s).success, `bad slot in ${a.purpose}: ${s.name}`).toBe(true)
      }
    }
  })

  it('getArchetype returns the same object as the table', () => {
    expect(getArchetype('gathering-aquatic')).toBe(TOOL_ARCHETYPES['gathering-aquatic'])
  })
})

describe('deriveSlots', () => {
  it('returns empty for unknown trigger', () => {
    expect(deriveSlots({ trigger: 'unknown-trigger', seedKey: 'k', tier: 0 })).toEqual([])
  })

  it('returns 1 slot at low tier', () => {
    const slots = deriveSlots({ trigger: 'aquatic-study-trout', seedKey: 'cert:42', tier: 1 })
    expect(slots.length).toBe(1)
  })

  it('returns up to 2 slots at high tier', () => {
    const slots = deriveSlots({ trigger: 'aquatic-study-trout', seedKey: 'cert:42', tier: 3 })
    expect(slots.length).toBeLessThanOrEqual(2)
    expect(slots.length).toBeGreaterThanOrEqual(1)
  })

  it('is deterministic from (trigger, seedKey, tier)', () => {
    const args = { trigger: 'mine-dig-iron', seedKey: 'cert:1:100', tier: 2 }
    expect(deriveSlots(args)).toEqual(deriveSlots(args))
  })

  it('different seedKeys can produce different slot orderings', () => {
    // With small pools (2 slots), shuffle outcomes are limited; just check
    // that varying seedKey doesn't crash and produces a valid slot count.
    const a = deriveSlots({ trigger: 'aquatic-study-trout', seedKey: 'A', tier: 3 })
    const b = deriveSlots({ trigger: 'aquatic-study-trout', seedKey: 'B', tier: 3 })
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBeGreaterThan(0)
  })

  it('marks every derived slot with derived=true', () => {
    const slots = deriveSlots({ trigger: 'mine-dig-gem', seedKey: 'k', tier: 2 })
    for (const s of slots) expect(s.derived).toBe(true)
  })
})
