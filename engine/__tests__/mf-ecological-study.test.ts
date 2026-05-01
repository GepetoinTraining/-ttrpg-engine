import { describe, it, expect } from 'vitest'
import {
  mfEcologicalStudy,
  mfEcologicalHarvest,
} from '../mf-ecological-study'

describe('mfEcologicalStudy — knowledge tier progression', () => {
  it('bumps tier 0 → 1 on first study success', () => {
    const r = mfEcologicalStudy({
      speciesId: 'willow-bark',
      d20: 18, // willow-bark study DC 12; 18+0 = 18 ≥ 12
      skillModifier: 0,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.receipt.priorKnowledge).toBe(0)
    expect(r.receipt.newKnowledge).toBe(1)
    expect(r.output.revealedName).toBe('Willow Bark')
  })

  it('keeps tier at 0 on study fail', () => {
    const r = mfEcologicalStudy({
      speciesId: 'willow-bark',
      d20: 5,
      skillModifier: 0,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.receipt.newKnowledge).toBe(0)
    expect(r.output.revealedName).toBeNull()
    expect(r.output.unlockedKeywords).toEqual([])
  })

  it('bumps tier 1 → 2 on second study success and unlocks keywords', () => {
    const r = mfEcologicalStudy({
      speciesId: 'willow-bark',
      d20: 18,
      skillModifier: 0,
      priorKnowledge: 1,
    })
    expect(r.receipt.newKnowledge).toBe(2)
    expect(r.output.unlockedKeywords.length).toBeGreaterThan(0)
  })

  it('promotes tier 2 → 3 only with strong margin (≥5)', () => {
    // foxglove study DC 16; tier 2 discount = 2 → effective 14
    // total 14 = pass with margin 0; should NOT promote
    const close = mfEcologicalStudy({
      speciesId: 'foxglove',
      d20: 14,
      skillModifier: 0,
      priorKnowledge: 2,
    })
    expect(close.receipt.success).toBe(true)
    expect(close.receipt.margin).toBe(0)
    expect(close.receipt.newKnowledge).toBe(2)

    // total 19 = pass with margin 5 → promotes
    const big = mfEcologicalStudy({
      speciesId: 'foxglove',
      d20: 19,
      skillModifier: 0,
      priorKnowledge: 2,
    })
    expect(big.receipt.margin).toBe(5)
    expect(big.receipt.newKnowledge).toBe(3)
  })

  it('caps at tier 3', () => {
    const r = mfEcologicalStudy({
      speciesId: 'willow-bark',
      d20: 20,
      skillModifier: 5,
      priorKnowledge: 3,
    })
    expect(r.receipt.newKnowledge).toBe(3)
  })

  it('applies KNOWLEDGE_DC_DISCOUNT[2] = -2 to effective DC', () => {
    const r = mfEcologicalStudy({
      speciesId: 'willow-bark',
      d20: 10,
      skillModifier: 0,
      priorKnowledge: 2,
    })
    // baseDC 12 - 2 (tier 2) = 10. d20 10 = pass.
    expect(r.receipt.effectiveDC).toBe(10)
    expect(r.receipt.success).toBe(true)
  })

  it('toolBonus contributes to total', () => {
    const r = mfEcologicalStudy({
      speciesId: 'willow-bark',
      d20: 8,
      skillModifier: 2,
      toolBonus: 2,
      priorKnowledge: 0,
    })
    expect(r.receipt.total).toBe(12)
    expect(r.receipt.success).toBe(true)
  })
})

describe('mfEcologicalHarvest — depletion + hazards', () => {
  it('emits negative density delta on success (common = -0.05)', () => {
    const r = mfEcologicalHarvest({
      speciesId: 'willow-bark',
      d20: 18,
      skillModifier: 0,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.output.densityDelta).toBe(-0.05)
    expect(r.output.yieldNote).toBeTruthy()
    expect(r.output.hazardNote).toBeNull()
  })

  it('rare species harvest delta is -0.2', () => {
    const r = mfEcologicalHarvest({
      speciesId: 'bioluminescent-moss',
      d20: 18,
      skillModifier: 0,
    })
    expect(r.output.densityDelta).toBe(-0.2)
  })

  it('emits hazard note + zero delta on fail', () => {
    const r = mfEcologicalHarvest({
      speciesId: 'amanita-fly-agaric',
      d20: 5,
      skillModifier: 0,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.output.densityDelta).toBe(0)
    expect(r.output.hazardNote).toMatch(/psychic/i)
    expect(r.output.yieldNote).toBeNull()
  })

  it('does NOT bump knowledge tier (study only)', () => {
    const r = mfEcologicalHarvest({
      speciesId: 'forest-rabbit',
      d20: 18,
      skillModifier: 0,
      priorKnowledge: 0,
    })
    expect(r.receipt.newKnowledge).toBe(0)
  })

  it('throws when species lacks the requested intent', () => {
    // forest-owl has only study + track in the catalog, no harvest
    expect(() =>
      mfEcologicalHarvest({
        speciesId: 'forest-owl',
        d20: 15,
        skillModifier: 0,
      }),
    ).toThrow(/does not support intent 'harvest'/)
  })
})

describe('determinism', () => {
  it('same inputs → same outputs', () => {
    const args = {
      speciesId: 'morel-mushroom',
      d20: 13,
      skillModifier: 1,
      toolBonus: 1,
      priorKnowledge: 1 as const,
    }
    const a = mfEcologicalStudy(args)
    const b = mfEcologicalStudy(args)
    expect(a).toEqual(b)
  })
})
