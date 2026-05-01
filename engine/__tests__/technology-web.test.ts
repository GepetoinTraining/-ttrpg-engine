import { describe, it, expect } from 'vitest'
import {
  TECH_TIER_DC,
  TechBlobSchema,
  TECH_SEED_BLOBS,
  getSeedBlob,
  generateHubHints,
  nextTier,
} from '../technology-web'
import { TIER_ORDER } from '../tier'

describe('TIER_ORDER (canonical, from engine/tier.ts) is 10 tiers', () => {
  it('is [F, E, D, C, B, A, S, SS, SSS, EX]', () => {
    expect(TIER_ORDER).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX'])
  })
})

describe('TECH_TIER_DC', () => {
  it('covers every tier from F to EX', () => {
    for (const t of TIER_ORDER) {
      expect(TECH_TIER_DC[t]).toBeDefined()
    }
  })
  it('is monotonically increasing', () => {
    for (let i = 1; i < TIER_ORDER.length; i++) {
      expect(TECH_TIER_DC[TIER_ORDER[i]]).toBeGreaterThan(TECH_TIER_DC[TIER_ORDER[i - 1]])
    }
  })
  it('starts at 5 and caps at 30', () => {
    expect(TECH_TIER_DC.F).toBe(5)
    expect(TECH_TIER_DC.EX).toBe(30)
  })
  it('has discrete steps between SS, SSS, EX (not collapsed into S → EX)', () => {
    expect(TECH_TIER_DC.S).toBeLessThan(TECH_TIER_DC.SS)
    expect(TECH_TIER_DC.SS).toBeLessThan(TECH_TIER_DC.SSS)
    expect(TECH_TIER_DC.SSS).toBeLessThan(TECH_TIER_DC.EX)
  })
})

describe('nextTier', () => {
  it('walks the canonical 10-tier ladder', () => {
    expect(nextTier('F')).toBe('E')
    expect(nextTier('E')).toBe('D')
    expect(nextTier('D')).toBe('C')
    expect(nextTier('C')).toBe('B')
    expect(nextTier('B')).toBe('A')
    expect(nextTier('A')).toBe('S')
    expect(nextTier('S')).toBe('SS')
    expect(nextTier('SS')).toBe('SSS')
    expect(nextTier('SSS')).toBe('EX')
    expect(nextTier('EX')).toBeNull()
  })
})

describe('TECH_SEED_BLOBS', () => {
  it('every seed blob passes Zod validation', () => {
    for (const b of TECH_SEED_BLOBS) {
      const r = TechBlobSchema.safeParse(b)
      expect(r.success, `bad blob: ${b.id}`).toBe(true)
    }
  })

  it('getSeedBlob lookup', () => {
    expect(getSeedBlob('fishing-tool', 'F')?.id).toBe('fishing-tool-F')
    expect(getSeedBlob('mining-tool', 'F')?.id).toBe('mining-tool-F')
    expect(getSeedBlob('does-not-exist', 'F')).toBeUndefined()
  })

  it('seeds include F + E for fishing-tool, F for mining-tool', () => {
    expect(getSeedBlob('fishing-tool', 'F')).toBeDefined()
    expect(getSeedBlob('fishing-tool', 'E')).toBeDefined()
    expect(getSeedBlob('mining-tool', 'F')).toBeDefined()
  })
})

describe('generateHubHints', () => {
  it('emits one craftsman-need line per dependency', () => {
    const blob = getSeedBlob('fishing-tool', 'E')!
    const hints = generateHubHints(blob)
    const needs = hints.filter((h) => h.startsWith('craftsman-need:'))
    expect(needs.length).toBe(blob.dependencies.length)
  })

  it('emits a tier-unlocked line for non-F tiers', () => {
    const blob = getSeedBlob('fishing-tool', 'E')!
    const hints = generateHubHints(blob)
    expect(hints.some((h) => h.startsWith('tier-unlocked:'))).toBe(true)
  })

  it('does NOT emit tier-unlocked for F-tier (baseline)', () => {
    const blob = getSeedBlob('fishing-tool', 'F')!
    const hints = generateHubHints(blob)
    expect(hints.some((h) => h.startsWith('tier-unlocked:'))).toBe(false)
  })

  it('preserves blob.hints in output', () => {
    const blob = getSeedBlob('fishing-tool', 'E')!
    const hints = generateHubHints(blob)
    for (const h of blob.hints) {
      expect(hints).toContain(h)
    }
  })
})
