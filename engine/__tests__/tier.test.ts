/**
 * TIER TESTS — universal F→EX scale, comparisons, conversions.
 */
import { describe, it, expect } from 'vitest'
import {
  TIER_ORDER,
  TIER_MULTIPLIERS,
  compareTier,
  tierAtLeast,
  tierUp,
  tierDown,
  tierFromCR,
  tierFromLevel,
} from '../tier.js'

describe('Tier — universal scale', () => {
  it('TIER_ORDER is monotonic F → EX (10 steps)', () => {
    expect(TIER_ORDER).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX'])
    expect(TIER_ORDER.length).toBe(10)
  })

  it('TIER_MULTIPLIERS grows geometrically', () => {
    for (let i = 1; i < TIER_ORDER.length; i++) {
      const prev = TIER_MULTIPLIERS[TIER_ORDER[i - 1]]
      const curr = TIER_MULTIPLIERS[TIER_ORDER[i]]
      expect(curr).toBeGreaterThan(prev)
    }
    expect(TIER_MULTIPLIERS.F).toBe(1.0)
    expect(TIER_MULTIPLIERS.EX).toBeGreaterThan(20)
  })

  it('compareTier orders correctly', () => {
    expect(compareTier('F', 'A')).toBe(-1)
    expect(compareTier('S', 'D')).toBe(1)
    expect(compareTier('B', 'B')).toBe(0)
    expect(compareTier('EX', 'F')).toBe(1)
  })

  it('tierAtLeast gates access', () => {
    expect(tierAtLeast('A', 'B')).toBe(true)   // A ≥ B
    expect(tierAtLeast('B', 'A')).toBe(false)  // B < A
    expect(tierAtLeast('S', 'S')).toBe(true)   // equal counts
    expect(tierAtLeast('F', 'EX')).toBe(false)
  })

  it('tierUp / tierDown clamp at boundaries', () => {
    expect(tierUp('F')).toBe('E')
    expect(tierUp('A', 2)).toBe('SS')
    expect(tierUp('EX')).toBe('EX')        // clamped
    expect(tierDown('E')).toBe('F')
    expect(tierDown('F')).toBe('F')        // clamped
    expect(tierDown('S', 3)).toBe('C')
  })

  it('tierFromCR maps 5e CR onto Tier', () => {
    expect(tierFromCR(0)).toBe('F')        // commoner
    expect(tierFromCR(0.5)).toBe('E')      // kobold
    expect(tierFromCR(3)).toBe('D')        // owlbear
    expect(tierFromCR(7)).toBe('C')        // young dragon
    expect(tierFromCR(11)).toBe('B')       // adult dragon-ish
    expect(tierFromCR(15)).toBe('A')       // ancient brass
    expect(tierFromCR(20)).toBe('S')       // ancient red
    expect(tierFromCR(30)).toBe('SSS')     // tarrasque
    expect(tierFromCR(99)).toBe('EX')      // Ao
  })

  it('tierFromLevel maps PC level onto Tier', () => {
    expect(tierFromLevel(1)).toBe('F')
    expect(tierFromLevel(3)).toBe('E')
    expect(tierFromLevel(5)).toBe('D')
    expect(tierFromLevel(11)).toBe('B')
    expect(tierFromLevel(20)).toBe('SSS')
    expect(tierFromLevel(25)).toBe('EX')   // beyond cap
  })
})
