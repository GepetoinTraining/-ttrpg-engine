/**
 * MF_DICE — The Atomic Dice Resolution
 * ======================================
 * 
 * The single invariant of D&D: a die roll.
 * Everything else in 5e is built on top of this.
 * 
 * MF_dice:
 *   x  = resolve roll (transform seed → result)
 *   K  = { count, sides, modifier }  ← constant (dice formula)
 *   I  = seed (random source)
 *   O  = { total, rolls[], natural, critical, fumble }
 *   R  = { formula, sum, modifier, verification: sum + mod === total }
 * 
 * Properties:
 *   - Deterministic given seed (same seed = same rolls)
 *   - Invertible: total - modifier = sum of rolls
 *   - Self-verifying: receipt proves total = sum(rolls) + modifier
 *   - Stateless: pure function, no side effects
 */

import { z } from 'zod'
import type { Receipt } from './types.js'

// ============================================================
// DICE FORMULA — K (the constant)
// ============================================================

export const DiceFormulaSchema = z.object({
  /** Number of dice to roll */
  count: z.number().int().min(1).max(100),
  /** Number of sides per die */
  sides: z.number().int().min(2).max(100),
  /** Flat modifier added to total */
  modifier: z.number().int().default(0),
})
export type DiceFormula = z.infer<typeof DiceFormulaSchema>

// ============================================================
// DICE RESULT — O (the output)
// ============================================================

export const DiceResultSchema = z.object({
  /** Final total: sum(rolls) + modifier */
  total: z.number().int(),
  /** Individual die results */
  rolls: z.array(z.number().int()),
  /** Sum of rolls before modifier */
  sum: z.number().int(),
  /** The modifier that was applied */
  modifier: z.number().int(),
  /** Was this a natural 20? (only meaningful for d20) */
  natural20: z.boolean(),
  /** Was this a natural 1? (only meaningful for d20) */
  natural1: z.boolean(),
  /** The formula that produced this */
  formula: z.string(),
})
export type DiceResult = z.infer<typeof DiceResultSchema>

// ============================================================
// DICE RECEIPT — R (the proof)
// ============================================================

export const DiceReceiptSchema = z.object({
  /** The formula used */
  formula: z.string(),
  /** Each die roll value */
  rolls: z.array(z.number().int()),
  /** Sum of all rolls */
  sum: z.number().int(),
  /** Modifier applied */
  modifier: z.number().int(),
  /** total === sum + modifier (MUST be true) */
  verified: z.boolean(),
})
export type DiceReceipt = z.infer<typeof DiceReceiptSchema>

// ============================================================
// MF_DICE — The function
// ============================================================

/**
 * Simple seeded PRNG — mulberry32.
 * Allows deterministic replay from any seed.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Roll a single die with a PRNG function.
 */
function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1
}

/**
 * MF_dice — the atomic dice resolution function.
 * 
 * Forward computation:
 *   I (seed) → through x (roll rules) with K (formula) → O (result) + R (receipt)
 * 
 * The receipt R falls out as a SIDE EFFECT of computing O.
 * Same matrix, same data, one pass.
 * 
 * @param formula - K: the dice formula (e.g., { count: 1, sides: 20, modifier: 5 })
 * @param seed - I: random seed for deterministic replay
 * @returns { output: DiceResult, receipt: DiceReceipt }
 */
export function mfDice(
  formula: DiceFormula,
  seed?: number,
): { output: DiceResult; receipt: DiceReceipt } {
  const actualSeed = seed ?? Math.floor(Math.random() * 2147483647)
  const rng = mulberry32(actualSeed)

  // Forward pass: roll the dice
  const rolls: number[] = []
  for (let i = 0; i < formula.count; i++) {
    rolls.push(rollDie(formula.sides, rng))
  }

  const sum = rolls.reduce((a, b) => a + b, 0)
  const total = sum + formula.modifier
  const formulaStr = `${formula.count}d${formula.sides}${formula.modifier >= 0 ? '+' : ''}${formula.modifier}`

  // Check natural 20/1 (only meaningful for single d20)
  const natural20 = formula.count === 1 && formula.sides === 20 && rolls[0] === 20
  const natural1 = formula.count === 1 && formula.sides === 20 && rolls[0] === 1

  // O — the output
  const output: DiceResult = {
    total,
    rolls,
    sum,
    modifier: formula.modifier,
    natural20,
    natural1,
    formula: formulaStr,
  }

  // R — the receipt (falls out of the same computation)
  // Verification: sum + modifier === total
  const receipt: DiceReceipt = {
    formula: formulaStr,
    rolls: [...rolls],
    sum,
    modifier: formula.modifier,
    verified: sum + formula.modifier === total,
  }

  return { output, receipt }
}

/**
 * Inverse MF_dice — given output and formula, verify correctness.
 * 
 * MFⁱⁿᵛ: same matrix, diagonal swapped.
 * Given O and K, recover I's integrity.
 */
export function mfDiceInverse(
  output: DiceResult,
  formula: DiceFormula,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Verify roll count matches formula
  if (output.rolls.length !== formula.count) {
    errors.push(`Expected ${formula.count} rolls, got ${output.rolls.length}`)
  }

  // Verify each roll is within bounds
  for (let i = 0; i < output.rolls.length; i++) {
    const roll = output.rolls[i]
    if (roll < 1 || roll > formula.sides) {
      errors.push(`Roll ${i} value ${roll} out of range [1, ${formula.sides}]`)
    }
  }

  // Verify sum
  const expectedSum = output.rolls.reduce((a, b) => a + b, 0)
  if (expectedSum !== output.sum) {
    errors.push(`Sum mismatch: rolls sum to ${expectedSum}, reported ${output.sum}`)
  }

  // Verify total = sum + modifier
  if (output.sum + output.modifier !== output.total) {
    errors.push(`Total mismatch: ${output.sum} + ${output.modifier} ≠ ${output.total}`)
  }

  // Verify modifier matches formula
  if (output.modifier !== formula.modifier) {
    errors.push(`Modifier mismatch: formula says ${formula.modifier}, output says ${output.modifier}`)
  }

  // Verify natural 20/1 flags
  if (formula.count === 1 && formula.sides === 20) {
    if (output.natural20 !== (output.rolls[0] === 20)) {
      errors.push(`Natural 20 flag incorrect`)
    }
    if (output.natural1 !== (output.rolls[0] === 1)) {
      errors.push(`Natural 1 flag incorrect`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Create a Receipt from a dice computation.
 */
export function diceToReceipt(
  output: DiceResult,
  receipt: DiceReceipt,
  tick: number,
): Receipt {
  return {
    mfId: 'mf_dice',
    tick,
    input: { formula: receipt.formula },
    output,
    verification: receipt,
    timestamp: Date.now(),
  }
}
