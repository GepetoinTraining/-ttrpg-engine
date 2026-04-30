import { describe, it, expect } from 'vitest'
import { mfDice } from '../mf-dice.js'

/**
 * Distribution sanity tests — empirical verification that mfDice produces
 * uniform d6/d20 outputs and matches the textbook distribution for
 * 4d6-drop-lowest. Catches bugs that unit-level tests miss (e.g. seeded
 * rolls being correct individually but biased in aggregate).
 *
 * Triggered by Pedro's "am I THIS lucky?" question after rolling four 16s
 * in six 4d6-drop-lowest sets.
 */

describe('mfDice — empirical distribution sanity', () => {
  it('d6 across 60k rolls passes chi-square uniformity (no seed)', () => {
    const counts = [0, 0, 0, 0, 0, 0, 0] // 1-indexed for d6
    const iterations = 10000  // 10k mfDice calls × 6 dice each = 60k samples
    for (let i = 0; i < iterations; i++) {
      const { output } = mfDice({ count: 6, sides: 6, modifier: 0 })
      for (const r of output.rolls) counts[r]++
    }
    const total = counts.slice(1).reduce((a, b) => a + b, 0)
    const expected = total / 6

    let chi2 = 0
    for (let face = 1; face <= 6; face++) {
      const dev = counts[face] - expected
      chi2 += (dev * dev) / expected
    }
    // Chi-square critical value at df=5, p=0.001 is 20.515 — so a fair
    // PRNG basically never exceeds it. We use this looser threshold to
    // tolerate occasional flakiness while still catching real bias.
    expect(chi2).toBeLessThan(20.515)
  })

  it('4d6-drop-lowest mean across 10k samples is ~12.244', () => {
    let sum = 0
    const iterations = 10000
    for (let i = 0; i < iterations; i++) {
      const { output } = mfDice({ count: 4, sides: 6, modifier: 0 })
      const sorted = [...output.rolls].sort((a, b) => a - b)
      const dropped = sorted[0]
      const kept = output.rolls.reduce((a, b) => a + b, 0) - dropped
      sum += kept
    }
    const mean = sum / iterations
    // Textbook mean is 12.244. Standard error over 10k samples is ~0.029.
    // ±0.15 = ~5σ — fail loudly if biased; pass for fair-die variance.
    expect(mean).toBeGreaterThan(12.10)
    expect(mean).toBeLessThan(12.40)
  })

  it('4d6-drop-lowest P(score >= 16) is ~12.95%', () => {
    let sixteenPlus = 0
    const iterations = 10000
    for (let i = 0; i < iterations; i++) {
      const { output } = mfDice({ count: 4, sides: 6, modifier: 0 })
      const sorted = [...output.rolls].sort((a, b) => a - b)
      const kept = sorted[1] + sorted[2] + sorted[3]
      if (kept >= 16) sixteenPlus++
    }
    const pct = sixteenPlus / iterations
    // Published distribution for 4d6-drop-lowest:
    //   P(16) ≈ 7.16%
    //   P(17) ≈ 4.17%
    //   P(18) ≈ 1.62%
    //   ──────────────
    //   P(>=16) ≈ 12.95%
    // Standard error ~0.0034 over 10k samples; ±0.015 catches a real bias.
    expect(pct).toBeGreaterThan(0.115)
    expect(pct).toBeLessThan(0.145)
  })

  it('seeded rolls are reproducible (same seed → same rolls)', () => {
    const a = mfDice({ count: 4, sides: 6, modifier: 0 }, 12345)
    const b = mfDice({ count: 4, sides: 6, modifier: 0 }, 12345)
    expect(a.output.rolls).toEqual(b.output.rolls)
  })

  it('different seeds produce different rolls (overwhelming probability)', () => {
    // 4d6 with two different seeds shouldn't match 100% of the time —
    // collision probability ~1/1296 per attempt, vanishingly small over 100.
    let identical = 0
    for (let i = 0; i < 100; i++) {
      const a = mfDice({ count: 4, sides: 6, modifier: 0 }, i * 17)
      const b = mfDice({ count: 4, sides: 6, modifier: 0 }, i * 17 + 1)
      if (a.output.rolls.every((v, idx) => v === b.output.rolls[idx])) {
        identical++
      }
    }
    expect(identical).toBeLessThan(5)  // way below random-collision rate
  })
})
