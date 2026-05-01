import { describe, it, expect } from 'vitest'
import {
  PredationProfileSchema,
  PREDATION_CATALOG,
  getPredationProfile,
  getHuntTemplate,
  getTrapTemplate,
  getTameTemplate,
  getDomesticateTemplate,
} from '../fauna-predation'
import { WILD_FAUNA_CATALOG } from '../wild-fauna'

describe('PREDATION_CATALOG', () => {
  it('every entry passes Zod validation', () => {
    for (const [id, profile] of Object.entries(PREDATION_CATALOG)) {
      const r = PredationProfileSchema.safeParse(profile)
      expect(r.success, `bad profile: ${id}`).toBe(true)
    }
  })

  it('covers every species in WILD_FAUNA_CATALOG', () => {
    for (const sp of WILD_FAUNA_CATALOG) {
      expect(PREDATION_CATALOG[sp.id], `missing profile for ${sp.id}`).toBeDefined()
    }
  })

  it('profile.trophic matches the wild-fauna species trophic', () => {
    for (const sp of WILD_FAUNA_CATALOG) {
      expect(PREDATION_CATALOG[sp.id].trophic).toBe(sp.trophic)
    }
  })

  it('all 6 species have all 4 intent templates', () => {
    for (const [id, p] of Object.entries(PREDATION_CATALOG)) {
      expect(p.hunt, `${id}.hunt`).toBeDefined()
      expect(p.trap, `${id}.trap`).toBeDefined()
      expect(p.tame, `${id}.tame`).toBeDefined()
      expect(p.domesticate, `${id}.domesticate`).toBeDefined()
    }
  })

  it('domesticate.requiredDays scales with trophic difficulty', () => {
    expect(PREDATION_CATALOG.rabbit.domesticate!.requiredDays).toBeLessThan(
      PREDATION_CATALOG.deer.domesticate!.requiredDays,
    )
    expect(PREDATION_CATALOG.deer.domesticate!.requiredDays).toBeLessThan(
      PREDATION_CATALOG.boar.domesticate!.requiredDays,
    )
    expect(PREDATION_CATALOG.fox.domesticate!.requiredDays).toBeLessThan(
      PREDATION_CATALOG.owl.domesticate!.requiredDays,
    )
  })

  it('predator hunt templates carry hazardNotes (counterattack risk)', () => {
    expect(PREDATION_CATALOG.fox.hunt!.hazardNote).toBeDefined()
    expect(PREDATION_CATALOG.owl.hunt!.hazardNote).toBeDefined()
  })
})

describe('getPredationProfile', () => {
  it('returns the profile for known species', () => {
    expect(getPredationProfile('rabbit').speciesId).toBe('rabbit')
  })
  it('throws for unknown species', () => {
    expect(() => getPredationProfile('dragon')).toThrow(/unknown predation profile/)
  })
})

describe('per-intent template lookups', () => {
  it('getHuntTemplate returns valid for rabbit', () => {
    expect(getHuntTemplate('rabbit').baseDC).toBe(10)
  })
  it('getTrapTemplate returns valid for fox', () => {
    expect(getTrapTemplate('fox').baseDC).toBe(14)
  })
  it('getTameTemplate returns valid for deer', () => {
    expect(getTameTemplate('deer').baseBondDays).toBe(5)
  })
  it('getDomesticateTemplate returns valid for boar', () => {
    expect(getDomesticateTemplate('boar').requiredDays).toBe(30)
    expect(getDomesticateTemplate('boar').requiresFacility).toBe(true)
  })
})
