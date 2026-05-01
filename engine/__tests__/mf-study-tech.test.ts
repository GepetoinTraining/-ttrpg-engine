import { describe, it, expect } from 'vitest'
import { mfStudyTech } from '../mf-study-tech'
import { getSeedBlob, TECH_TIER_DC } from '../technology-web'

describe('mfStudyTech — happy path', () => {
  it('promotes F → E with a slot growth', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const r = mfStudyTech(f, { d20: 18, skillModifier: 0, seedKey: 'cert:1' })
    expect(r.receipt.success).toBe(true)
    expect(r.receipt.fromTier).toBe('F')
    expect(r.receipt.targetTier).toBe('E')
    expect(r.output.blob).not.toBeNull()
    expect(r.output.blob!.tier).toBe('E')
    expect(r.output.blob!.slots.length).toBeGreaterThan(f.slots.length)
    expect(r.output.addedSlots.length).toBeGreaterThan(0)
  })

  it('emits tier-unlocked + craftsman-need hints on success', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const r = mfStudyTech(f, { d20: 18, skillModifier: 0, seedKey: 'cert:1' })
    expect(r.receipt.success).toBe(true)
    const tierLine = r.output.hubHints.find((h) => h.startsWith('tier-unlocked:'))
    expect(tierLine).toBeDefined()
  })

  it('scales stats with each tier climbed', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const r = mfStudyTech(f, { d20: 18, skillModifier: 0, seedKey: 'cert:k' })
    expect(r.output.blob!.baseStats.efficiency).toBeGreaterThan(f.baseStats.efficiency)
    expect(r.output.blob!.baseStats.durability).toBeGreaterThan(f.baseStats.durability)
  })

  it('is deterministic from (purpose, target, seedKey)', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const args = { d20: 18, skillModifier: 0, seedKey: 'cert:1' }
    const a = mfStudyTech(f, args)
    const b = mfStudyTech(f, args)
    expect(a.output.blob).toEqual(b.output.blob)
  })
})

describe('mfStudyTech — DC + dependencies', () => {
  it('unmet deps inflate effective DC', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const free = mfStudyTech(f, { d20: 12, skillModifier: 0, seedKey: 'k' })
    const blocked = mfStudyTech(f, { d20: 12, skillModifier: 0, seedKey: 'k', unmetDependencyCount: 2 })
    expect(blocked.receipt.effectiveDC).toBeGreaterThan(free.receipt.effectiveDC)
  })

  it('toolBonus contributes to total', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    // E baseDC is 8; total = 5 + 1 + 2 = 8 → pass margin 0
    const r = mfStudyTech(f, { d20: 5, skillModifier: 1, toolBonus: 2, seedKey: 'k' })
    expect(r.receipt.total).toBe(8)
    expect(r.receipt.effectiveDC).toBe(TECH_TIER_DC.E)
    expect(r.receipt.success).toBe(true)
  })
})

describe('mfStudyTech — failure', () => {
  it('returns null blob + craftsman-stuck hint on fail', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const r = mfStudyTech(f, { d20: 1, skillModifier: 0, seedKey: 'k' })
    expect(r.receipt.success).toBe(false)
    expect(r.output.blob).toBeNull()
    expect(r.output.addedSlots).toEqual([])
    expect(r.output.hubHints.some((h) => h.startsWith('craftsman-stuck:'))).toBe(true)
  })

  it('records target tier in receipt even on fail', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const r = mfStudyTech(f, { d20: 1, skillModifier: 0, seedKey: 'k' })
    expect(r.receipt.targetTier).toBe('E')
  })
})

describe('mfStudyTech — at the top of the ladder', () => {
  it('returns no-op success=false when already at EX', () => {
    const top = {
      ...getSeedBlob('fishing-tool', 'F')!,
      tier: 'EX' as const,
      id: 'fishing-tool-EX',
    }
    const r = mfStudyTech(top, { d20: 20, skillModifier: 10, seedKey: 'k' })
    expect(r.receipt.success).toBe(false)
    expect(r.receipt.fromTier).toBe('EX')
    expect(r.receipt.targetTier).toBe('EX')
    expect(r.output.blob).toBeNull()
  })

  it('walks every step of the canonical 10-tier ladder', () => {
    let cur = getSeedBlob('fishing-tool', 'F')!
    const tiersWalked: string[] = [cur.tier]
    for (let step = 0; step < 10; step++) {
      const r = mfStudyTech(cur, { d20: 20, skillModifier: 20, seedKey: `step-${step}` })
      if (!r.output.blob) break
      cur = r.output.blob
      tiersWalked.push(cur.tier)
    }
    // F → E → D → C → B → A → S → SS → SSS → EX (10 entries)
    expect(tiersWalked).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX'])
  })

  it('SS → SSS targets the right DC + emits expected hint', () => {
    const at_ss = {
      ...getSeedBlob('fishing-tool', 'F')!,
      tier: 'SS' as const,
      id: 'fishing-tool-SS',
    }
    const r = mfStudyTech(at_ss, { d20: 20, skillModifier: 20, seedKey: 'k' })
    expect(r.receipt.targetTier).toBe('SSS')
    expect(r.receipt.baseDC).toBe(TECH_TIER_DC.SSS)
    expect(r.output.blob?.tier).toBe('SSS')
  })
})
