/**
 * MF_SMELT — Ore + flux + heat → ingot
 * ======================================
 *
 * Slow-life v2 (W3.2). Pure compute. Returns `{ output, receipt }` per
 * Theorem 1 — receipt R falls out of the forward pass.
 *
 *   x = transform(ore, flux, heat, skill, tools)
 *   K = { recipeKey, requiredHeat, fluxRequired, skillFloor }
 *   I = { ore, fluxQty, heatProvided, skill, toolBonus, day, makerCertId }
 *   O = SmeltOutput { ingot: ItemV2, slag: number, success: boolean }
 *   R = SmeltReceipt — input audit + skill check result + affix roll seed
 *
 * Affixes mint via `mintAffixes` from `./material-affixes`. Same input
 * (ore lot, day, maker cert) → same affixes every time.
 */

import { z } from 'zod'
import { mintAffixes, AffixSchema, type Affix } from './material-affixes'
import type { Receipt } from './types'

// ============================================================
// ITEM V2 — extends v1 stub with affixes
// ============================================================

export const ItemV2Schema = z.object({
  /** Stable id (the lot id; survives transformations as `<parent>:smelt`). */
  id: z.string(),
  /** Type code: `ingot:iron`, `weapon:sword:iron`, etc. */
  resourceId: z.string(),
  /** Display base name before affix decoration. */
  baseName: z.string(),
  quantity: z.number().nonnegative(),
  /** Inherited from `production-chain` QualityLevel for v1 callers. */
  quality: z.enum(['poor', 'fair', 'good', 'masterwork']).default('fair'),
  /** Tier — F (1) → EX (7) per `engine/tier.ts`. */
  tier: z.number().int().min(1).max(7).default(1),
  /** Affixes minted at creation. Empty array means "plain". */
  affixes: z.array(AffixSchema).default([]),
  /** Optional decorated name fragments. */
  prefixName: z.string().optional(),
  suffixName: z.string().optional(),
  /** Provenance — how this item came to be. */
  provenance: z.object({
    method: z.enum(['extracted', 'smelted', 'forged', 'inherited']),
    parentLotId: z.string().nullable(),
    makerCertId: z.string().nullable(),
    worldDay: z.number().int(),
  }),
})
export type ItemV2 = z.infer<typeof ItemV2Schema>

// ============================================================
// SMELT INPUTS
// ============================================================

export interface SmeltContext {
  /** Recipe / target — e.g. 'iron_ingot'. */
  recipeKey: string
  /** Heat required for the recipe. */
  requiredHeat: number
  /** Flux units needed per unit of ore. */
  fluxPerOre: number
  /** Minimum smelting skill needed. Below this auto-fails. */
  skillFloor: number
  /** Output ingot baseName (e.g. "Iron Ingot"). */
  ingotBaseName: string
  /** Output ingot resource id (e.g. "ingot:iron"). */
  ingotResourceId: string
  /** Tier of the resulting ingot. */
  ingotTier: number
}

export interface SmeltInput {
  /** Source ore lot id (must already exist). */
  oreLotId: string
  /** Quantity of ore being smelted. */
  oreQty: number
  /** Quality of the ore (drives ingot quality). */
  oreQuality: 'poor' | 'fair' | 'good' | 'masterwork'
  /** Flux units provided. Below `oreQty * fluxPerOre` reduces yield. */
  fluxQty: number
  /** Heat provided this run. Below `requiredHeat` increases failure. */
  heatProvided: number
  /** Maker's smelting skill. */
  skill: number
  /** Tool bonus (+1 to +5 typical). */
  toolBonus?: number
  /** World day the smelt happens. */
  worldDay: number
  /** Maker's cert id — drives affix mint determinism. */
  makerCertId: string
  /** d20 used for skill check (caller usually provides via mfDice). */
  d20: number
}

// ============================================================
// SMELT OUTPUT
// ============================================================

export interface SmeltOutput {
  ingot: ItemV2 | null
  /** Slag = waste mass; non-zero on partial success. */
  slag: number
  success: boolean
  reason?: string
}

export interface SmeltReceipt {
  recipeKey: string
  oreLotId: string
  oreQty: number
  fluxRequired: number
  fluxProvided: number
  heatRequired: number
  heatProvided: number
  skillCheck: { skill: number; toolBonus: number; d20: number; total: number; threshold: number; passed: boolean }
  affixRollSeed: string
  /** Bit-identical replay marker — same on both client + server when inputs match. */
  verification: { matchesK: boolean; matchesI: boolean }
}

/**
 * Forward pass: smelt N units of ore into an ingot lot.
 * Determinism: same input → same output every call.
 */
export function mfSmelt(
  ctx: SmeltContext,
  input: SmeltInput,
): { output: SmeltOutput; receipt: SmeltReceipt } {
  const fluxRequired = input.oreQty * ctx.fluxPerOre
  const skillCheckThreshold = ctx.skillFloor
  const skillTotal = input.skill + (input.toolBonus ?? 0) + input.d20
  const passedSkill = skillTotal >= skillCheckThreshold
  const heatOk = input.heatProvided >= ctx.requiredHeat
  const fluxOk = input.fluxQty >= fluxRequired

  // Failure cases first
  if (!passedSkill) {
    return {
      output: { ingot: null, slag: input.oreQty, success: false, reason: 'skill_check_failed' },
      receipt: buildReceipt(ctx, input, fluxRequired, skillCheckThreshold, skillTotal, false),
    }
  }
  if (!heatOk) {
    return {
      output: { ingot: null, slag: input.oreQty, success: false, reason: 'insufficient_heat' },
      receipt: buildReceipt(ctx, input, fluxRequired, skillCheckThreshold, skillTotal, passedSkill),
    }
  }
  if (!fluxOk) {
    // Partial success: lose half the ore as slag, half becomes ingot
    const yieldQty = Math.floor(input.oreQty / 2)
    const slag = input.oreQty - yieldQty
    if (yieldQty <= 0) {
      return {
        output: { ingot: null, slag: input.oreQty, success: false, reason: 'insufficient_flux' },
        receipt: buildReceipt(ctx, input, fluxRequired, skillCheckThreshold, skillTotal, passedSkill),
      }
    }
    const ingot = buildIngot(ctx, input, yieldQty)
    return {
      output: { ingot, slag, success: true, reason: 'partial_flux' },
      receipt: buildReceipt(ctx, input, fluxRequired, skillCheckThreshold, skillTotal, passedSkill),
    }
  }

  // Full success
  const ingot = buildIngot(ctx, input, input.oreQty)
  return {
    output: { ingot, slag: 0, success: true },
    receipt: buildReceipt(ctx, input, fluxRequired, skillCheckThreshold, skillTotal, passedSkill),
  }
}

function buildIngot(ctx: SmeltContext, input: SmeltInput, yieldQty: number): ItemV2 {
  const lotId = `${input.oreLotId}:smelt:${input.worldDay}`
  const mint = mintAffixes({
    materialLotId: lotId,
    worldDay: input.worldDay,
    makerCertId: input.makerCertId,
    skillBonus: input.skill + (input.toolBonus ?? 0),
    tierBonus: ctx.ingotTier,
  })
  return {
    id: lotId,
    resourceId: ctx.ingotResourceId,
    baseName: ctx.ingotBaseName,
    quantity: yieldQty,
    quality: input.oreQuality,
    tier: ctx.ingotTier,
    affixes: mint.affixes,
    prefixName: mint.prefixName,
    suffixName: mint.suffixName,
    provenance: {
      method: 'smelted',
      parentLotId: input.oreLotId,
      makerCertId: input.makerCertId,
      worldDay: input.worldDay,
    },
  }
}

function buildReceipt(
  ctx: SmeltContext,
  input: SmeltInput,
  fluxRequired: number,
  threshold: number,
  total: number,
  passed: boolean,
): SmeltReceipt {
  return {
    recipeKey: ctx.recipeKey,
    oreLotId: input.oreLotId,
    oreQty: input.oreQty,
    fluxRequired,
    fluxProvided: input.fluxQty,
    heatRequired: ctx.requiredHeat,
    heatProvided: input.heatProvided,
    skillCheck: {
      skill: input.skill,
      toolBonus: input.toolBonus ?? 0,
      d20: input.d20,
      total,
      threshold,
      passed,
    },
    affixRollSeed: `${input.oreLotId}:smelt:${input.worldDay}:${input.makerCertId}`,
    verification: { matchesK: true, matchesI: true },
  }
}

/**
 * Build a universal Receipt from a smelt result (for client-side buffering).
 */
export function smeltToReceipt(
  output: SmeltOutput,
  receipt: SmeltReceipt,
  tick: number,
): Receipt {
  return {
    mfId: 'mf_smelt',
    tick,
    input: { recipeKey: receipt.recipeKey, oreLotId: receipt.oreLotId, oreQty: receipt.oreQty },
    output,
    verification: receipt,
    timestamp: Date.now(),
  }
}

/**
 * Affixes are unmodifiable; quantity is reversible. Inverse just zeros the
 * smelt — useful for transactional rollback if the slot push fails.
 */
export function mfSmeltInverse(_output: SmeltOutput, receipt: SmeltReceipt): SmeltInput {
  return {
    oreLotId: receipt.oreLotId,
    oreQty: receipt.oreQty,
    oreQuality: 'fair',
    fluxQty: receipt.fluxProvided,
    heatProvided: receipt.heatProvided,
    skill: receipt.skillCheck.skill,
    toolBonus: receipt.skillCheck.toolBonus,
    worldDay: 0,
    makerCertId: '',
    d20: receipt.skillCheck.d20,
  }
}
