/**
 * MF_CHECK — Skill Check / Attack Roll / Saving Throw
 * =====================================================
 * 
 * The D&D 5e invariant: compare total vs threshold.
 * ALL of 5e reduces to: roll + modifier vs DC/AC.
 * 
 * MF_check:
 *   x  = compare (total >= threshold → success)
 *   K  = { threshold, advantage, type }  ← constant (the DC/AC)
 *   I  = DiceResult (from MF_dice)
 *   O  = { success, margin, criticalHit, criticalMiss }
 *   R  = { total, threshold, margin, rule: which comparison was applied }
 * 
 * Chains from MF_dice. Receipt proves legality.
 * 
 * INVARIANT: success = (total >= threshold) UNLESS critical override.
 *   - Natural 20 on attack = always hits (critical hit)
 *   - Natural 1 on attack = always misses (critical miss)
 *   - Natural 20 on save = always succeeds (2024 rules)
 *   - Natural 20 on ability check = no special rule (2014) or auto-success (2024)
 */

import { z } from 'zod'
import type { DiceResult } from './mf-dice.js'
import type { Receipt } from './types.js'

// ============================================================
// CHECK TYPE — What kind of check is this?
// ============================================================

export const CheckTypeSchema = z.enum([
  'ability_check',     // Skill check, generic ability check
  'attack_roll',       // Melee, ranged, spell attack
  'saving_throw',      // STR/DEX/CON/INT/WIS/CHA save
])
export type CheckType = z.infer<typeof CheckTypeSchema>

// ============================================================
// ADVANTAGE STATE
// ============================================================

export const AdvantageStateSchema = z.enum([
  'normal',       // Single roll
  'advantage',    // Roll twice, take higher
  'disadvantage', // Roll twice, take lower
])
export type AdvantageState = z.infer<typeof AdvantageStateSchema>

// ============================================================
// CHECK PARAMS — K (the constant)
// ============================================================

export const CheckParamsSchema = z.object({
  /** DC or AC to beat */
  threshold: z.number().int(),
  /** What kind of check */
  type: CheckTypeSchema,
  /** Advantage/disadvantage state */
  advantage: AdvantageStateSchema.default('normal'),
  /** The modifier already applied to the dice roll */
  modifier: z.number().int().default(0),
})
export type CheckParams = z.infer<typeof CheckParamsSchema>

// ============================================================
// CHECK RESULT — O (the output)
// ============================================================

export const CheckResultSchema = z.object({
  /** Did the check succeed? */
  success: z.boolean(),
  /** total - threshold (positive = succeeded by this much) */
  margin: z.number().int(),
  /** Was this a critical hit? (attack rolls only) */
  criticalHit: z.boolean(),
  /** Was this a critical miss? (attack rolls only) */
  criticalMiss: z.boolean(),
  /** The final total used for comparison */
  total: z.number().int(),
  /** The threshold it was compared against */
  threshold: z.number().int(),
  /** Which rule determined the outcome */
  rule: z.string(),
})
export type CheckResult = z.infer<typeof CheckResultSchema>

// ============================================================
// CHECK RECEIPT — R (the proof)
// ============================================================

export const CheckReceiptSchema = z.object({
  /** The dice result(s) that fed this check */
  diceResults: z.array(z.object({
    rolls: z.array(z.number().int()),
    total: z.number().int(),
  })),
  /** Which value was selected (for advantage/disadvantage) */
  selectedTotal: z.number().int(),
  /** The selection rule applied */
  selectionRule: z.string(),
  /** The threshold compared against */
  threshold: z.number().int(),
  /** The comparison that was evaluated */
  comparison: z.string(),
  /** Was the result overridden by a critical rule? */
  criticalOverride: z.boolean(),
  /** Verification: the output matches the computation */
  verified: z.boolean(),
})
export type CheckReceipt = z.infer<typeof CheckReceiptSchema>

// ============================================================
// MF_CHECK — The function
// ============================================================

/**
 * MF_check — the comparison function.
 * 
 * Takes one or two DiceResults (for advantage/disadvantage)
 * and compares against a threshold.
 * 
 * Forward computation:
 *   I (DiceResult[]) → through x (comparison) with K (params) → O (result) + R (receipt)
 * 
 * @param diceResults - I: one or two dice results
 * @param params - K: the check parameters (threshold, type, advantage)
 * @returns { output: CheckResult, receipt: CheckReceipt }
 */
export function mfCheck(
  diceResults: DiceResult[],
  params: CheckParams,
): { output: CheckResult; receipt: CheckReceipt } {
  // Validate input count
  const needsTwo = params.advantage !== 'normal'
  if (needsTwo && diceResults.length < 2) {
    throw new Error(`${params.advantage} requires 2 dice results, got ${diceResults.length}`)
  }

  // Select the total based on advantage/disadvantage
  let selectedTotal: number
  let selectionRule: string

  if (params.advantage === 'advantage') {
    selectedTotal = Math.max(diceResults[0].total, diceResults[1].total)
    selectionRule = `advantage: max(${diceResults[0].total}, ${diceResults[1].total})`
  } else if (params.advantage === 'disadvantage') {
    selectedTotal = Math.min(diceResults[0].total, diceResults[1].total)
    selectionRule = `disadvantage: min(${diceResults[0].total}, ${diceResults[1].total})`
  } else {
    selectedTotal = diceResults[0].total
    selectionRule = 'normal: single roll'
  }

  // Find the natural roll for the selected total
  // For advantage: find which roll had the higher/lower total and use its natural
  let selectedNatural20: boolean
  let selectedNatural1: boolean

  if (params.advantage === 'advantage') {
    const selected = diceResults[0].total >= diceResults[1].total ? diceResults[0] : diceResults[1]
    selectedNatural20 = selected.natural20
    selectedNatural1 = selected.natural1
  } else if (params.advantage === 'disadvantage') {
    const selected = diceResults[0].total <= diceResults[1].total ? diceResults[0] : diceResults[1]
    selectedNatural20 = selected.natural20
    selectedNatural1 = selected.natural1
  } else {
    selectedNatural20 = diceResults[0].natural20
    selectedNatural1 = diceResults[0].natural1
  }

  // Apply critical rules based on check type
  let success: boolean
  let criticalHit = false
  let criticalMiss = false
  let criticalOverride = false
  let rule: string

  if (params.type === 'attack_roll') {
    // Attack rolls: nat 20 always hits (critical), nat 1 always misses
    if (selectedNatural20) {
      success = true
      criticalHit = true
      criticalOverride = true
      rule = 'natural 20: automatic hit (critical)'
    } else if (selectedNatural1) {
      success = false
      criticalMiss = true
      criticalOverride = true
      rule = 'natural 1: automatic miss'
    } else {
      success = selectedTotal >= params.threshold
      rule = `${selectedTotal} >= ${params.threshold}: ${success ? 'hit' : 'miss'}`
    }
  } else if (params.type === 'saving_throw') {
    // Saving throws: standard comparison (2014 rules)
    // 2024 rules add nat 20 auto-success, but we default to 2014
    success = selectedTotal >= params.threshold
    rule = `${selectedTotal} >= ${params.threshold}: ${success ? 'success' : 'failure'}`
  } else {
    // Ability checks: pure comparison, no critical overrides
    success = selectedTotal >= params.threshold
    rule = `${selectedTotal} >= ${params.threshold}: ${success ? 'success' : 'failure'}`
  }

  const margin = selectedTotal - params.threshold

  // O — the output
  const output: CheckResult = {
    success,
    margin,
    criticalHit,
    criticalMiss,
    total: selectedTotal,
    threshold: params.threshold,
    rule,
  }

  // R — the receipt
  const comparison = `${selectedTotal} ${success ? '>=' : '<'} ${params.threshold}`
  const receipt: CheckReceipt = {
    diceResults: diceResults.map(d => ({ rolls: d.rolls, total: d.total })),
    selectedTotal,
    selectionRule,
    threshold: params.threshold,
    comparison,
    criticalOverride,
    verified:
      (criticalOverride && criticalHit && success) ||
      (criticalOverride && criticalMiss && !success) ||
      (!criticalOverride && success === (selectedTotal >= params.threshold)),
  }

  return { output, receipt }
}

/**
 * Inverse MF_check — verify a check result against its inputs.
 */
export function mfCheckInverse(
  output: CheckResult,
  params: CheckParams,
  diceResults: DiceResult[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Re-run the forward computation
  const { output: expected } = mfCheck(diceResults, params)

  if (expected.success !== output.success) {
    errors.push(`Success mismatch: expected ${expected.success}, got ${output.success}`)
  }
  if (expected.margin !== output.margin) {
    errors.push(`Margin mismatch: expected ${expected.margin}, got ${output.margin}`)
  }
  if (expected.criticalHit !== output.criticalHit) {
    errors.push(`Critical hit mismatch`)
  }
  if (expected.criticalMiss !== output.criticalMiss) {
    errors.push(`Critical miss mismatch`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Create a Receipt from a check computation.
 */
export function checkToReceipt(
  output: CheckResult,
  receipt: CheckReceipt,
  tick: number,
): Receipt {
  return {
    mfId: 'mf_check',
    tick,
    input: { diceResults: receipt.diceResults, threshold: receipt.threshold },
    output,
    verification: receipt,
    timestamp: Date.now(),
  }
}
