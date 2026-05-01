import { describe, it, expect } from 'vitest'
import {
  mfHunt,
  mfTrap,
  mfTame,
  mfDomesticate,
  type TrappedCreature,
  type DomesticationProgress,
} from '../mf-fauna-predation'
import { getSpecies, type WildHerd } from '../wild-fauna'

function freshHerd(speciesId: string, overrides: Partial<WildHerd> = {}): WildHerd {
  const sp = getSpecies(speciesId)
  return {
    id: `herd-${speciesId}`,
    speciesId,
    currentNodeId: 'forest-1',
    destinationNodeId: null,
    edgeId: null,
    edgeMile: 0,
    edgeTotalMiles: 0,
    population: sp.baseHerdSize,
    daysHungry: 0,
    foodSecurity: 1.0,
    formation: 'spread',
    status: 'grazing',
    bornDay: 0,
    lastTransitionDay: 0,
    ...overrides,
  }
}

function trapped(speciesId: string, day = 1): TrappedCreature {
  const sp = getSpecies(speciesId)
  return { speciesId, trophic: sp.trophic, trappedOnDay: day }
}

// ============================================================
// HUNT
// ============================================================
describe('mfHunt — happy path', () => {
  it('successful hunt kills 1+ heads, yields meat/hide/bone', () => {
    const sp = getSpecies('deer')
    const herd = freshHerd('deer')
    const r = mfHunt(herd, sp, { d20: 18, skillModifier: 4, worldDay: 1 })
    expect(r.receipt.success).toBe(true)
    expect(r.output.killed).toBeGreaterThanOrEqual(1)
    expect(r.output.yield).not.toBeNull()
    expect(r.output.yield!.meat).toBeGreaterThan(0)
    expect(r.output.herdAfter.population).toBe(herd.population - r.output.killed)
  })

  it('kills 2+ heads → herd flips to fleeing/scattered', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = mfHunt(herd, sp, { d20: 20, skillModifier: 6, worldDay: 1 })
    expect(r.output.killed).toBeGreaterThanOrEqual(2)
    expect(r.output.herdAfter.status).toBe('fleeing')
    expect(r.output.herdAfter.formation).toBe('scattered')
  })

  it('respects maxKillPerAttempt', () => {
    const sp = getSpecies('boar') // maxKillPerAttempt: 1
    const herd = freshHerd('boar')
    const r = mfHunt(herd, sp, { d20: 20, skillModifier: 10, worldDay: 1 })
    expect(r.output.killed).toBeLessThanOrEqual(1)
  })

  it('knowledge tier bumps on success', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = mfHunt(herd, sp, { d20: 16, skillModifier: 0, worldDay: 1, priorKnowledge: 0 })
    expect(r.receipt.success).toBe(true)
    expect(r.receipt.newKnowledge).toBeGreaterThan(0)
  })

  it('knowledge discount lowers effective DC', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const naive = mfHunt(herd, sp, { d20: 10, skillModifier: 0, worldDay: 1, priorKnowledge: 0 })
    const expert = mfHunt(herd, sp, { d20: 10, skillModifier: 0, worldDay: 1, priorKnowledge: 3 })
    expect(expert.receipt.effectiveDC).toBeLessThan(naive.receipt.effectiveDC)
  })

  it('emits a yieldNote-shaped result with non-zero meat for deer (large body)', () => {
    const sp = getSpecies('deer')
    const herd = freshHerd('deer')
    const r = mfHunt(herd, sp, { d20: 20, skillModifier: 5, worldDay: 1 })
    expect(r.output.yield!.meat).toBeGreaterThanOrEqual(80)
  })
})

describe('mfHunt — failure', () => {
  it('predator (fox) hunt fail emits hazardNote, no fleeing flip', () => {
    const sp = getSpecies('fox')
    const herd = freshHerd('fox')
    const r = mfHunt(herd, sp, { d20: 1, skillModifier: 0, worldDay: 1 })
    expect(r.receipt.success).toBe(false)
    expect(r.output.killed).toBe(0)
    expect(r.output.hazardNote).not.toBeNull()
    expect(r.output.herdAfter.status).toBe('grazing')
  })

  it('prey (rabbit) hunt fail flips to fleeing', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = mfHunt(herd, sp, { d20: 1, skillModifier: 0, worldDay: 1 })
    expect(r.receipt.success).toBe(false)
    expect(r.output.herdAfter.status).toBe('fleeing')
    expect(r.output.herdAfter.formation).toBe('scattered')
  })

  it('throws on non-viable herd', () => {
    const sp = getSpecies('deer')
    const herd = freshHerd('deer', { population: sp.minViable - 1 })
    expect(() => mfHunt(herd, sp, { d20: 20, skillModifier: 10, worldDay: 1 })).toThrow(/min viable/)
  })
})

describe('mfHunt — population sink', () => {
  it('reduces herd to decimated when population crosses minViable', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit', { population: sp.minViable + 1 })
    const r = mfHunt(herd, sp, { d20: 20, skillModifier: 10, worldDay: 1 })
    if (r.output.herdAfter.population < sp.minViable) {
      expect(r.output.herdAfter.status).toBe('decimated')
    }
  })
})

// ============================================================
// TRAP
// ============================================================
describe('mfTrap — happy path', () => {
  it('captures 1 head on success; population - 1', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = mfTrap(herd, sp, { d20: 18, skillModifier: 2, worldDay: 1 })
    expect(r.receipt.success).toBe(true)
    expect(r.output.captured).not.toBeNull()
    expect(r.output.captured!.speciesId).toBe('rabbit')
    expect(r.output.herdAfter.population).toBe(herd.population - 1)
  })

  it('bait reduces effective DC by 2', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const dry = mfTrap(herd, sp, { d20: 10, skillModifier: 0, worldDay: 1 })
    const baited = mfTrap(herd, sp, { d20: 10, skillModifier: 0, worldDay: 1, bait: true })
    expect(baited.receipt.effectiveDC).toBe(dry.receipt.effectiveDC - 2)
  })

  it('trap does NOT bump knowledge tier', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = mfTrap(herd, sp, { d20: 20, skillModifier: 5, worldDay: 1, priorKnowledge: 1 })
    expect(r.receipt.success).toBe(true)
    expect(r.receipt.newKnowledge).toBe(r.receipt.priorKnowledge)
  })

  it('captured.trophic matches species trophic', () => {
    const sp = getSpecies('fox')
    const herd = freshHerd('fox')
    const r = mfTrap(herd, sp, { d20: 20, skillModifier: 5, worldDay: 1 })
    expect(r.output.captured!.trophic).toBe('small-carnivore')
  })
})

describe('mfTrap — failure', () => {
  it('predator (fox) trap fail emits hazardNote', () => {
    const sp = getSpecies('fox')
    const herd = freshHerd('fox')
    const r = mfTrap(herd, sp, { d20: 1, skillModifier: 0, worldDay: 1 })
    expect(r.receipt.success).toBe(false)
    expect(r.output.captured).toBeNull()
    expect(r.output.hazardNote).not.toBeNull()
  })

  it('prey trap fail does not flip status', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = mfTrap(herd, sp, { d20: 1, skillModifier: 0, worldDay: 1 })
    expect(r.output.herdAfter.status).toBe(herd.status)
  })

  it('throws on non-viable herd', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit', { population: sp.minViable - 1 })
    expect(() => mfTrap(herd, sp, { d20: 20, skillModifier: 10, worldDay: 1 })).toThrow(/min viable/)
  })
})

// ============================================================
// TAME
// ============================================================
describe('mfTame — happy path', () => {
  it('successful tame returns bondLevel 1-5 and a followerSpec', () => {
    const sp = getSpecies('fox')
    const cap = trapped('fox')
    const r = mfTame(cap, sp, { d20: 18, skillModifier: 3, worldDay: 5 })
    expect(r.receipt.success).toBe(true)
    expect(r.output.bondLevel).toBeGreaterThanOrEqual(1)
    expect(r.output.bondLevel).toBeLessThanOrEqual(5)
    expect(r.output.followerSpec).not.toBeNull()
    expect(r.output.followerSpec!.speciesId).toBe('fox')
    expect(r.output.followerSpec!.attachedOnDay).toBe(5)
    expect(r.output.followerSpec!.expiresOnDay).toBe(5 + r.output.expiresInDays)
  })

  it('higher margin → higher bondLevel', () => {
    const sp = getSpecies('rabbit')
    const cap = trapped('rabbit')
    const low = mfTame(cap, sp, { d20: 11, skillModifier: 0, worldDay: 1 })
    const high = mfTame(cap, sp, { d20: 20, skillModifier: 10, worldDay: 1 })
    expect(high.output.bondLevel).toBeGreaterThan(low.output.bondLevel)
  })

  it('offering reduces effective DC by 2', () => {
    const sp = getSpecies('deer')
    const cap = trapped('deer')
    const dry = mfTame(cap, sp, { d20: 10, skillModifier: 0, worldDay: 1 })
    const fed = mfTame(cap, sp, { d20: 10, skillModifier: 0, worldDay: 1, offering: true })
    expect(fed.receipt.effectiveDC).toBe(dry.receipt.effectiveDC - 2)
  })

  it('expiresOnDay scales up with bondLevel', () => {
    const sp = getSpecies('rabbit')
    const cap = trapped('rabbit')
    const low = mfTame(cap, sp, { d20: 11, skillModifier: 0, worldDay: 0 })
    const high = mfTame(cap, sp, { d20: 20, skillModifier: 10, worldDay: 0 })
    expect(high.output.followerSpec!.expiresOnDay).toBeGreaterThan(
      low.output.followerSpec!.expiresOnDay,
    )
  })
})

describe('mfTame — failure', () => {
  it('failed tame returns bondLevel 0, no followerSpec', () => {
    const sp = getSpecies('boar')
    const cap = trapped('boar')
    const r = mfTame(cap, sp, { d20: 1, skillModifier: 0, worldDay: 1 })
    expect(r.receipt.success).toBe(false)
    expect(r.output.bondLevel).toBe(0)
    expect(r.output.followerSpec).toBeNull()
  })

  it('throws if captured speciesId mismatches', () => {
    const sp = getSpecies('fox')
    const cap = trapped('owl')
    expect(() => mfTame(cap, sp, { d20: 18, skillModifier: 5, worldDay: 1 })).toThrow(/does not match/)
  })
})

// ============================================================
// DOMESTICATE
// ============================================================
describe('mfDomesticate — happy path', () => {
  it('fresh domesticate accumulates progress on success', () => {
    const sp = getSpecies('rabbit')
    const cap = trapped('rabbit')
    const r = mfDomesticate(cap, sp, { d20: 18, skillModifier: 3, worldDay: 5, days: 3 })
    expect(r.receipt.success).toBe(true)
    expect(r.output.progressAfter.pointsAccumulated).toBe(3)
    expect(r.output.completed).toBe(false)
  })

  it('completes after pointsRequired days of success', () => {
    const sp = getSpecies('rabbit') // requiredDays: 7
    const cap = trapped('rabbit')
    const r = mfDomesticate(cap, sp, { d20: 18, skillModifier: 5, worldDay: 7, days: 7 })
    expect(r.output.completed).toBe(true)
    expect(r.output.livestockSpec).not.toBeNull()
    expect(r.output.livestockSpec!.speciesId).toBe('rabbit')
    expect(r.output.livestockSpec!.count).toBe(1)
    expect(r.output.livestockSpec!.domesticatedOnDay).toBe(7)
  })

  it('continuing prior progress sums', () => {
    const sp = getSpecies('rabbit')
    const cap = trapped('rabbit')
    const first = mfDomesticate(cap, sp, { d20: 18, skillModifier: 5, worldDay: 3, days: 3 })
    const second = mfDomesticate(cap, sp, {
      d20: 18,
      skillModifier: 5,
      worldDay: 7,
      days: 4,
      prior: first.output.progressAfter,
    })
    expect(second.output.progressAfter.daysInvested).toBe(7)
    expect(second.output.completed).toBe(true)
  })

  it('facility-required species cannot progress without facility', () => {
    const sp = getSpecies('deer') // requiresFacility: true
    const cap = trapped('deer')
    const r = mfDomesticate(cap, sp, { d20: 20, skillModifier: 10, worldDay: 1, days: 5 })
    expect(r.output.progressAfter.pointsAccumulated).toBe(0)
    expect(r.output.hazardNote).toMatch(/facility/)
  })

  it('facility-required species progresses when hasFacility=true', () => {
    const sp = getSpecies('deer')
    const cap = trapped('deer')
    const r = mfDomesticate(cap, sp, {
      d20: 20,
      skillModifier: 10,
      worldDay: 1,
      days: 5,
      hasFacility: true,
    })
    expect(r.output.progressAfter.pointsAccumulated).toBeGreaterThan(0)
  })

  it('failure adds half progress (no regression)', () => {
    const sp = getSpecies('rabbit')
    const cap = trapped('rabbit')
    const r = mfDomesticate(cap, sp, { d20: 1, skillModifier: 0, worldDay: 5, days: 4 })
    expect(r.receipt.success).toBe(false)
    expect(r.output.progressAfter.pointsAccumulated).toBe(2) // floor(4 * 0.5)
  })

  it('progress cannot exceed pointsRequired', () => {
    const sp = getSpecies('rabbit') // requiredDays: 7
    const cap = trapped('rabbit')
    const r = mfDomesticate(cap, sp, { d20: 20, skillModifier: 10, worldDay: 1, days: 30 })
    expect(r.output.progressAfter.pointsAccumulated).toBe(7)
    expect(r.output.completed).toBe(true)
  })
})

describe('mfDomesticate — guards', () => {
  it('throws if captured speciesId mismatches', () => {
    const sp = getSpecies('rabbit')
    const cap = trapped('fox')
    expect(() =>
      mfDomesticate(cap, sp, { d20: 18, skillModifier: 5, worldDay: 1, days: 1 }),
    ).toThrow(/does not match/)
  })

  it('throws if prior progress speciesId mismatches', () => {
    const sp = getSpecies('rabbit')
    const cap = trapped('rabbit')
    const badPrior: DomesticationProgress = {
      speciesId: 'deer',
      daysInvested: 1,
      pointsAccumulated: 1,
      pointsRequired: 14,
      startedOnDay: 0,
    }
    expect(() =>
      mfDomesticate(cap, sp, {
        d20: 18,
        skillModifier: 5,
        worldDay: 5,
        days: 1,
        prior: badPrior,
      }),
    ).toThrow(/mismatch/)
  })
})
