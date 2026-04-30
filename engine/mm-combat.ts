/**
 * MM_COMBAT — Combat Round Container
 * ====================================
 * 
 * The MM that chains: dice → check → damage
 * 
 * MM_combat [3:3]:
 *   cell₁ = MF_dice  (roll the attack)
 *   cell₂ = MF_check (compare vs AC)
 *   cell₃ = MF_damage (resolve damage — CONDITIONAL on cell₂)
 * 
 * The ? slot: cell₃ only runs if cell₂.success === true.
 * This is TP resolution — the topology says "miss = skip."
 * 
 * Container principles (from new-math.md):
 *   - Container provides time to its children
 *   - Container aggregates child Δω into Δᵖ
 *   - Container detects flow breaks
 *   - Children never request mass — container decides
 * 
 * An attack action in D&D IS an MM:
 *   1. Roll d20 + modifier           (MF_dice)
 *   2. Compare total vs AC            (MF_check)  
 *   3. IF hit → roll damage dice      (MF_dice again)
 *   4. Apply damage to target         (MF_damage)
 * 
 * The receipt chain proves the entire attack was legal.
 */

import { z } from 'zod'
import { mfDice, type DiceFormula, type DiceResult, type DiceReceipt } from './mf-dice.js'
import { mfCheck, type CheckParams, type CheckResult, type CheckReceipt } from './mf-check.js'
import { mfDamage, type DamageInput, type TargetState, type DamageResult, type DamageReceipt } from './mf-damage.js'
import { type CycleDelta, type Receipt, ZERO_DELTA, addDeltas } from './types.js'

// ============================================================
// ATTACK ACTION PARAMS — What we need to resolve an attack
// ============================================================

export const AttackActionSchema = z.object({
  /** Who is attacking */
  attackerId: z.string(),
  /** Who is being attacked */
  targetId: z.string(),
  /** Attack roll formula (usually 1d20 + modifier) */
  attackFormula: z.object({
    count: z.number().int().default(1),
    sides: z.number().int().default(20),
    modifier: z.number().int(),
  }),
  /** Target's AC */
  targetAC: z.number().int(),
  /** Advantage/disadvantage */
  advantage: z.enum(['normal', 'advantage', 'disadvantage']).default('normal'),
  /** Damage formula (e.g., 1d8 + 3) */
  damageFormula: z.object({
    count: z.number().int(),
    sides: z.number().int(),
    modifier: z.number().int(),
  }),
  /** Damage type */
  damageType: z.enum([
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
  ]),
  /** Target's current state */
  target: z.object({
    hpCurrent: z.number().int(),
    hpMax: z.number().int(),
    tempHp: z.number().int().default(0),
    resistances: z.array(z.string()).default([]),
    vulnerabilities: z.array(z.string()).default([]),
    immunities: z.array(z.string()).default([]),
  }),
  /** Optional seed for deterministic replay */
  seed: z.number().int().optional(),
})
export type AttackAction = z.infer<typeof AttackActionSchema>

// ============================================================
// ATTACK RESULT — The full chain output
// ============================================================

export const AttackResultSchema = z.object({
  /** Did the attack hit? */
  hit: z.boolean(),
  /** Was it a critical hit? */
  critical: z.boolean(),
  /** Was it a critical miss? */
  fumble: z.boolean(),
  /** Attack roll result */
  attackRoll: z.object({
    total: z.number().int(),
    rolls: z.array(z.number().int()),
    natural20: z.boolean(),
    natural1: z.boolean(),
  }),
  /** Check result */
  checkResult: z.object({
    success: z.boolean(),
    margin: z.number().int(),
    rule: z.string(),
  }),
  /** Damage result (null if miss) */
  damageResult: z.object({
    damageDealt: z.number().int(),
    hpAfter: z.number().int(),
    resisted: z.number().int(),
    absorbed: z.number().int(),
    statusChange: z.string(),
    modificationRule: z.string(),
  }).nullable(),
  /** Aggregate delta for this attack action */
  delta: z.object({
    potential: z.number(),
    archival: z.number(),
    omega: z.number(),
  }),
})
export type AttackResult = z.infer<typeof AttackResultSchema>

// ============================================================
// ATTACK RECEIPT CHAIN — Proves the entire attack was legal
// ============================================================

export interface AttackReceiptChain {
  attackRollReceipt: DiceReceipt
  attackRollReceipt2?: DiceReceipt  // For advantage/disadvantage
  checkReceipt: CheckReceipt
  damageRollReceipt?: DiceReceipt   // Only if hit
  damageReceipt?: DamageReceipt     // Only if hit
  chain: Receipt[]                   // Ordered receipt chain
  allVerified: boolean
}

// ============================================================
// MM_COMBAT — The container function
// ============================================================

/**
 * Resolve a complete attack action.
 * 
 * This is the MM settlement: it ticks each child MF in order,
 * aggregates their deltas, and produces a single result.
 * 
 * Chain: MF_dice → MF_check → (if hit) MF_dice → MF_damage
 * 
 * The ? slot resolution:
 *   - cell₂.success === true  → continue to damage
 *   - cell₂.success === false → skip damage, attack complete
 * 
 * @param action - The full attack specification
 * @returns { result: AttackResult, receipts: AttackReceiptChain }
 */
export function mmCombatAttack(
  action: AttackAction,
): { result: AttackResult; receipts: AttackReceiptChain } {
  let tick = 0
  const chain: Receipt[] = []
  let aggregateDelta: CycleDelta = { ...ZERO_DELTA }

  // ── Cell 1: MF_dice (attack roll) ──────────────────────────
  const needsTwo = action.advantage !== 'normal'
  const seed1 = action.seed ?? Math.floor(Math.random() * 2147483647)
  
  const roll1 = mfDice(action.attackFormula as DiceFormula, seed1)
  chain.push({
    mfId: 'mf_dice:attack_1',
    tick: tick++,
    input: { formula: action.attackFormula, seed: seed1 },
    output: roll1.output,
    verification: roll1.receipt,
    timestamp: Date.now(),
  })

  let roll2: { output: DiceResult; receipt: DiceReceipt } | undefined
  if (needsTwo) {
    const seed2 = seed1 + 1  // Deterministic second seed
    roll2 = mfDice(action.attackFormula as DiceFormula, seed2)
    chain.push({
      mfId: 'mf_dice:attack_2',
      tick: tick++,
      input: { formula: action.attackFormula, seed: seed2 },
      output: roll2.output,
      verification: roll2.receipt,
      timestamp: Date.now(),
    })
  }

  // Δω for attack roll: the roll happened, cost nothing meaningful
  const attackDelta: CycleDelta = { potential: 0, archival: 0, omega: 1 }
  aggregateDelta = addDeltas(aggregateDelta, attackDelta)

  // ── Cell 2: MF_check (compare vs AC) ──────────────────────
  const diceResults = needsTwo ? [roll1.output, roll2!.output] : [roll1.output]
  const checkParams: CheckParams = {
    threshold: action.targetAC,
    type: 'attack_roll',
    advantage: action.advantage,
    modifier: action.attackFormula.modifier,
  }

  const check = mfCheck(diceResults, checkParams)
  chain.push({
    mfId: 'mf_check:attack',
    tick: tick++,
    input: { diceResults, params: checkParams },
    output: check.output,
    verification: check.receipt,
    timestamp: Date.now(),
  })

  const checkDelta: CycleDelta = { potential: 0, archival: 0, omega: check.output.success ? 1 : -1 }
  aggregateDelta = addDeltas(aggregateDelta, checkDelta)

  // ── ? Slot Resolution ─────────────────────────────────────
  // TP says: if miss → skip damage. If hit → continue.

  let damageRoll: { output: DiceResult; receipt: DiceReceipt } | undefined
  let damageResult: { output: DamageResult; receipt: DamageReceipt } | undefined

  if (check.output.success) {
    // ── Cell 3: MF_dice (damage roll) ──────────────────────
    let dmgFormula = { ...action.damageFormula } as DiceFormula

    // Critical hit: double the dice count (not the modifier)
    if (check.output.criticalHit) {
      dmgFormula = { ...dmgFormula, count: dmgFormula.count * 2 }
    }

    const dmgSeed = seed1 + 100  // Deterministic damage seed
    damageRoll = mfDice(dmgFormula, dmgSeed)
    chain.push({
      mfId: 'mf_dice:damage',
      tick: tick++,
      input: { formula: dmgFormula, seed: dmgSeed },
      output: damageRoll.output,
      verification: damageRoll.receipt,
      timestamp: Date.now(),
    })

    // ── Cell 4: MF_damage (apply to target) ─────────────────
    const dmgInput: DamageInput = {
      rawDamage: damageRoll.output.total,
      damageType: action.damageType as DamageInput['damageType'],
      isCritical: check.output.criticalHit,
    }

    const targetState: TargetState = {
      hpCurrent: action.target.hpCurrent,
      hpMax: action.target.hpMax,
      tempHp: action.target.tempHp,
      resistances: action.target.resistances as TargetState['resistances'],
      vulnerabilities: action.target.vulnerabilities as TargetState['vulnerabilities'],
      immunities: action.target.immunities as TargetState['immunities'],
    }

    damageResult = mfDamage(dmgInput, targetState)
    chain.push({
      mfId: 'mf_damage:attack',
      tick: tick++,
      input: dmgInput,
      output: damageResult.output,
      verification: damageResult.receipt,
      timestamp: Date.now(),
    })

    // Δω for damage: negative for the target (they lost HP)
    const damageDelta: CycleDelta = {
      potential: -damageResult.output.damageDealt,
      archival: damageResult.output.statusChange === 'dead' ? -1 : 0,
      omega: damageResult.output.damageDealt,
    }
    aggregateDelta = addDeltas(aggregateDelta, damageDelta)
  }

  // ── Settlement: Aggregate result ──────────────────────────

  const result: AttackResult = {
    hit: check.output.success,
    critical: check.output.criticalHit,
    fumble: check.output.criticalMiss,
    attackRoll: {
      total: check.output.total,
      rolls: roll1.output.rolls,
      natural20: roll1.output.natural20,
      natural1: roll1.output.natural1,
    },
    checkResult: {
      success: check.output.success,
      margin: check.output.margin,
      rule: check.output.rule,
    },
    damageResult: damageResult ? {
      damageDealt: damageResult.output.damageDealt,
      hpAfter: damageResult.output.hpAfter,
      resisted: damageResult.output.resisted,
      absorbed: damageResult.output.absorbed,
      statusChange: damageResult.output.statusChange,
      modificationRule: damageResult.output.modificationRule,
    } : null,
    delta: aggregateDelta,
  }

  const receipts: AttackReceiptChain = {
    attackRollReceipt: roll1.receipt,
    attackRollReceipt2: roll2?.receipt,
    checkReceipt: check.receipt,
    damageRollReceipt: damageRoll?.receipt,
    damageReceipt: damageResult?.receipt,
    chain,
    allVerified:
      roll1.receipt.verified &&
      (!roll2 || roll2.receipt.verified) &&
      check.receipt.verified &&
      (!damageRoll || damageRoll.receipt.verified) &&
      (!damageResult || damageResult.receipt.verified),
  }

  return { result, receipts }
}
