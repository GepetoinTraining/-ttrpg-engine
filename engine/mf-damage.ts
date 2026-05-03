/**
 * MF_DAMAGE — Damage Resolution
 * ===============================
 * 
 * Third invariant: apply damage to a target.
 * 
 * MF_damage:
 *   x  = apply modification (resistance/vulnerability/immunity)
 *   K  = { resistances, vulnerabilities, immunities, hpCurrent, hpMax, tempHp }
 *   I  = { rawDamage, damageType, isCritical }
 *   O  = { hpAfter, damageDealt, resisted, absorbed, statusChange }
 *   R  = { rawDamage, multiplier, finalDamage, hpBefore, hpAfter, tempHpBefore, tempHpAfter }
 * 
 * Rules (D&D 5e):
 *   - Immunity: multiplier = 0 (no damage)
 *   - Resistance: multiplier = 0.5 (half, rounded down)
 *   - Vulnerability: multiplier = 2 (double)
 *   - Normal: multiplier = 1
 *   - Temp HP absorbs first before real HP
 *   - HP cannot go below 0
 * 
 * INVARIANT: hpAfter = max(0, hpBefore - max(0, finalDamage - tempHp))
 */

import { z } from 'zod'
import type { Receipt } from './types'

// ============================================================
// DAMAGE TYPE — The 13 D&D 5e damage types
// ============================================================

export const DamageTypeSchema = z.enum([
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
])
export type DamageType = z.infer<typeof DamageTypeSchema>

// ============================================================
// DAMAGE INPUT — I
// ============================================================

export const DamageInputSchema = z.object({
  /** Raw damage before modification */
  rawDamage: z.number().int().min(0),
  /** Type of damage */
  damageType: DamageTypeSchema,
  /** Is this from a critical hit? (doubles dice before modifier) */
  isCritical: z.boolean().default(false),
})
export type DamageInput = z.infer<typeof DamageInputSchema>

// ============================================================
// TARGET STATE — K (the constant for this computation)
// ============================================================

export const TargetStateSchema = z.object({
  /** Current HP */
  hpCurrent: z.number().int(),
  /** Maximum HP */
  hpMax: z.number().int().min(1),
  /** Temporary HP */
  tempHp: z.number().int().default(0),
  /** Damage types the target resists (half damage) */
  resistances: z.array(DamageTypeSchema).default([]),
  /** Damage types the target is vulnerable to (double damage) */
  vulnerabilities: z.array(DamageTypeSchema).default([]),
  /** Damage types the target is immune to (no damage) */
  immunities: z.array(DamageTypeSchema).default([]),
})
export type TargetState = z.infer<typeof TargetStateSchema>

// ============================================================
// STATUS CHANGE — Did the damage cause a status transition?
// ============================================================

export const StatusChangeSchema = z.enum([
  'none',            // No change
  'bloodied',        // Dropped below half HP (common house rule)
  'unconscious',     // Dropped to 0 HP
  'dead',            // Massive damage rule: excess >= max HP
])
export type StatusChange = z.infer<typeof StatusChangeSchema>

// ============================================================
// DAMAGE RESULT — O (the output)
// ============================================================

export const DamageResultSchema = z.object({
  /** HP after damage */
  hpAfter: z.number().int(),
  /** Temp HP after damage */
  tempHpAfter: z.number().int(),
  /** Actual damage dealt to real HP */
  damageDealt: z.number().int(),
  /** Damage prevented by resistance/immunity */
  resisted: z.number().int(),
  /** Damage absorbed by temp HP */
  absorbed: z.number().int(),
  /** Multiplier applied (0, 0.5, 1, or 2) */
  multiplier: z.number(),
  /** Rule that determined the multiplier */
  modificationRule: z.string(),
  /** Did this cause a status change? */
  statusChange: StatusChangeSchema,
})
export type DamageResult = z.infer<typeof DamageResultSchema>

// ============================================================
// DAMAGE RECEIPT — R (the proof)
// ============================================================

export const DamageReceiptSchema = z.object({
  rawDamage: z.number().int(),
  damageType: DamageTypeSchema,
  multiplier: z.number(),
  finalDamage: z.number().int(),
  hpBefore: z.number().int(),
  hpAfter: z.number().int(),
  tempHpBefore: z.number().int(),
  tempHpAfter: z.number().int(),
  absorbed: z.number().int(),
  damageToHp: z.number().int(),
  /** MUST be true */
  verified: z.boolean(),
})
export type DamageReceipt = z.infer<typeof DamageReceiptSchema>

// ============================================================
// MF_DAMAGE — The function
// ============================================================

/**
 * MF_damage — the damage resolution function.
 * 
 * Forward computation:
 *   I (rawDamage, damageType) → through x (resistance rules) with K (target) → O (result) + R (receipt)
 * 
 * @param input - I: the raw damage and type
 * @param target - K: the target's current state
 * @returns { output: DamageResult, receipt: DamageReceipt }
 */
export function mfDamage(
  input: DamageInput,
  target: TargetState,
): { output: DamageResult; receipt: DamageReceipt } {
  // Step 1: Determine multiplier
  let multiplier: number
  let modificationRule: string

  if (target.immunities.includes(input.damageType)) {
    multiplier = 0
    modificationRule = `immune to ${input.damageType}: ×0`
  } else if (target.resistances.includes(input.damageType) && target.vulnerabilities.includes(input.damageType)) {
    // Resistance + vulnerability cancel out
    multiplier = 1
    modificationRule = `resistant AND vulnerable to ${input.damageType}: cancel → ×1`
  } else if (target.resistances.includes(input.damageType)) {
    multiplier = 0.5
    modificationRule = `resistant to ${input.damageType}: ×0.5 (round down)`
  } else if (target.vulnerabilities.includes(input.damageType)) {
    multiplier = 2
    modificationRule = `vulnerable to ${input.damageType}: ×2`
  } else {
    multiplier = 1
    modificationRule = `no modification: ×1`
  }

  // Step 2: Compute final damage (round down for resistance)
  const finalDamage = Math.floor(input.rawDamage * multiplier)
  const resisted = input.rawDamage - finalDamage

  // Step 3: Apply temp HP absorption first
  const tempHpBefore = target.tempHp
  const absorbed = Math.min(finalDamage, tempHpBefore)
  const remainingDamage = finalDamage - absorbed
  const tempHpAfter = tempHpBefore - absorbed

  // Step 4: Apply remaining damage to real HP
  const hpBefore = target.hpCurrent
  const damageToHp = Math.min(remainingDamage, hpBefore) // Can't go below 0
  const hpAfter = Math.max(0, hpBefore - remainingDamage)

  // Step 5: Determine status change
  let statusChange: StatusChange = 'none'
  if (hpAfter === 0) {
    // Massive damage rule: if remaining excess >= hpMax, instant death
    const excess = remainingDamage - hpBefore
    if (excess >= target.hpMax) {
      statusChange = 'dead'
    } else {
      statusChange = 'unconscious'
    }
  } else if (hpAfter <= Math.floor(target.hpMax / 2) && hpBefore > Math.floor(target.hpMax / 2)) {
    statusChange = 'bloodied'
  }

  // O — the output
  const output: DamageResult = {
    hpAfter,
    tempHpAfter,
    damageDealt: damageToHp,
    resisted,
    absorbed,
    multiplier,
    modificationRule,
    statusChange,
  }

  // R — the receipt (verification)
  const receipt: DamageReceipt = {
    rawDamage: input.rawDamage,
    damageType: input.damageType,
    multiplier,
    finalDamage,
    hpBefore,
    hpAfter,
    tempHpBefore,
    tempHpAfter,
    absorbed,
    damageToHp,
    verified:
      Math.floor(input.rawDamage * multiplier) === finalDamage &&
      tempHpBefore - absorbed === tempHpAfter &&
      Math.max(0, hpBefore - (finalDamage - absorbed)) === hpAfter,
  }

  return { output, receipt }
}

/**
 * Inverse MF_damage — given the result, verify the math.
 */
export function mfDamageInverse(
  output: DamageResult,
  receipt: DamageReceipt,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Verify damage after multiplier
  const expectedFinal = Math.floor(receipt.rawDamage * receipt.multiplier)
  if (expectedFinal !== receipt.finalDamage) {
    errors.push(`Final damage: floor(${receipt.rawDamage} × ${receipt.multiplier}) = ${expectedFinal}, got ${receipt.finalDamage}`)
  }

  // Verify temp HP absorption
  if (receipt.tempHpBefore - receipt.absorbed !== receipt.tempHpAfter) {
    errors.push(`Temp HP: ${receipt.tempHpBefore} - ${receipt.absorbed} ≠ ${receipt.tempHpAfter}`)
  }

  // Verify HP math
  const expectedHpAfter = Math.max(0, receipt.hpBefore - (receipt.finalDamage - receipt.absorbed))
  if (expectedHpAfter !== receipt.hpAfter) {
    errors.push(`HP: max(0, ${receipt.hpBefore} - (${receipt.finalDamage} - ${receipt.absorbed})) = ${expectedHpAfter}, got ${receipt.hpAfter}`)
  }

  // Verify output matches receipt
  if (output.hpAfter !== receipt.hpAfter) {
    errors.push(`Output hpAfter (${output.hpAfter}) ≠ receipt hpAfter (${receipt.hpAfter})`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Create a Receipt from a damage computation.
 */
export function damageToReceipt(
  output: DamageResult,
  receipt: DamageReceipt,
  tick: number,
): Receipt {
  return {
    mfId: 'mf_damage',
    tick,
    input: { rawDamage: receipt.rawDamage, damageType: receipt.damageType },
    output,
    verification: receipt,
    timestamp: Date.now(),
  }
}
