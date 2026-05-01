import { describe, it, expect } from 'vitest'
import { mfCraftBasic, mfCraftDiscover } from '../mf-craft'

describe('mfCraftBasic', () => {
  it('produces a tool on success with the archetype base slots', () => {
    const r = mfCraftBasic('gathering-aquatic', {
      d20: 18,
      skillModifier: 0,
      seedKey: 'cert:1',
    })
    expect(r.receipt.success).toBe(true)
    expect(r.output.tool).not.toBeNull()
    expect(r.output.tool!.purpose).toBe('gathering-aquatic')
    expect(r.output.tool!.filledSlots.length).toBeGreaterThanOrEqual(3)
    expect(r.output.tool!.recipeSource).toBe('basic')
  })

  it('returns null tool on failure', () => {
    const r = mfCraftBasic('gathering-aquatic', {
      d20: 1,
      skillModifier: 0,
      seedKey: 'cert:1',
    })
    expect(r.receipt.success).toBe(false)
    expect(r.output.tool).toBeNull()
  })

  it('id is deterministic from (purpose, seedKey)', () => {
    const a = mfCraftBasic('gathering-aquatic', { d20: 18, skillModifier: 0, seedKey: 'k' })
    const b = mfCraftBasic('gathering-aquatic', { d20: 18, skillModifier: 0, seedKey: 'k' })
    expect(a.output.tool?.id).toBe(b.output.tool?.id)
  })

  it('seedKey variation changes the id', () => {
    const a = mfCraftBasic('gathering-aquatic', { d20: 18, skillModifier: 0, seedKey: 'A' })
    const b = mfCraftBasic('gathering-aquatic', { d20: 18, skillModifier: 0, seedKey: 'B' })
    expect(a.output.tool?.id).not.toBe(b.output.tool?.id)
  })

  it('toolBonus contributes to total', () => {
    const r = mfCraftBasic('striking-mine', {
      d20: 9,
      skillModifier: 1,
      toolBonus: 2,
      seedKey: 'k',
    })
    // striking-mine baseDC 12; total = 9+1+2 = 12 → pass with margin 0
    expect(r.receipt.total).toBe(12)
    expect(r.receipt.success).toBe(true)
    expect(r.receipt.margin).toBe(0)
  })
})

describe('mfCraftDiscover', () => {
  it('rejects triggers the archetype does not accept', () => {
    expect(() =>
      mfCraftDiscover('striking-mine', {
        d20: 18,
        skillModifier: 5,
        seedKey: 'k',
        trigger: 'aquatic-study-trout',
        tier: 2,
      }),
    ).toThrow(/does not accept trigger/)
  })

  it('appends derived slots on success', () => {
    const r = mfCraftDiscover('gathering-aquatic', {
      d20: 20,
      skillModifier: 5,
      seedKey: 'cert:7',
      trigger: 'aquatic-study-trout',
      tier: 3,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.output.tool).not.toBeNull()
    // Base slots + derived
    const base = 3
    expect(r.output.tool!.filledSlots.length).toBeGreaterThan(base)
    expect(r.output.newlyDerivedSlots.length).toBeGreaterThan(0)
    expect(r.output.tool!.recipeSource).toBe('aquatic-study-trout')
  })

  it('derived slots inflate the effective DC', () => {
    const basic = mfCraftBasic('gathering-aquatic', { d20: 12, skillModifier: 0, seedKey: 'k' })
    const discover = mfCraftDiscover('gathering-aquatic', {
      d20: 12,
      skillModifier: 0,
      seedKey: 'k',
      trigger: 'aquatic-study-trout',
      tier: 1,
    })
    expect(discover.receipt.effectiveDC).toBeGreaterThan(basic.receipt.effectiveDC)
  })

  it('failure produces no tool but no throw', () => {
    const r = mfCraftDiscover('gathering-aquatic', {
      d20: 1,
      skillModifier: 0,
      seedKey: 'k',
      trigger: 'aquatic-study-trout',
      tier: 1,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.output.tool).toBeNull()
    expect(r.output.newlyDerivedSlots.length).toBe(0)
  })

  it('is deterministic — same inputs → same outputs', () => {
    const args = {
      d20: 17,
      skillModifier: 2,
      seedKey: 'cert:42:worldDay:100',
      trigger: 'aquatic-study-trout',
      tier: 2,
    } as const
    const a = mfCraftDiscover('gathering-aquatic', args)
    const b = mfCraftDiscover('gathering-aquatic', args)
    expect(a).toEqual(b)
  })

  it('higher tier yields more slots', () => {
    const lowTier = mfCraftDiscover('gathering-aquatic', {
      d20: 20,
      skillModifier: 10,
      seedKey: 'k',
      trigger: 'aquatic-study-trout',
      tier: 0,
    })
    const highTier = mfCraftDiscover('gathering-aquatic', {
      d20: 20,
      skillModifier: 10,
      seedKey: 'k',
      trigger: 'aquatic-study-trout',
      tier: 3,
    })
    expect(highTier.output.newlyDerivedSlots.length).toBeGreaterThanOrEqual(
      lowTier.output.newlyDerivedSlots.length,
    )
  })
})
