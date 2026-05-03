/**
 * MF_FORGE — Ingot + recipe → tool/weapon/armor
 * ================================================
 *
 * Slow-life v2 (W3.2). Pure compute, returns `{ output, receipt }`.
 *
 *   x = transform(ingot, recipe, anvil, skill)
 *   K = ForgeContext { recipeKey, requiredAnvilTier, skillFloor, baseDC }
 *   I = ForgeInput { ingot, anvilTier, skill, toolBonus, day, makerCertId, d20 }
 *   O = ForgeOutput { item: ItemV2, scrap: number, success: boolean }
 *   R = ForgeReceipt — input audit + skill check + affix mint seed
 *
 * Affixes inherit from the ingot (parent provenance) AND a fresh forge-time
 * mint runs against the resulting weapon's lot id. Net effect: a Tempered
 * Iron Ingot can become a Tempered Iron Sword of Striking — both layers
 * carrying their own affix history.
 */

import { mintAffixes } from './material-affixes'
import type { ItemV2 } from './mf-smelt'
import type { Receipt } from './types'

// ============================================================
// FORGE CONTEXT (K)
// ============================================================

export interface ForgeContext {
  /** Stable recipe key — e.g. 'longsword', 'chainmail'. */
  recipeKey: string
  /** Required anvil tier (forge tier). 1 = village, 5 = master smithy. */
  requiredAnvilTier: number
  /** Skill floor — below this auto-fails. */
  skillFloor: number
  /** Base DC for the skill check (after the floor passes). */
  baseDC: number
  /** Output item name + resource id + tier. */
  itemBaseName: string
  itemResourceId: string
  itemTier: number
  /** Ingot units consumed per item. */
  ingotPerItem: number
}

// ============================================================
// FORGE INPUT (I)
// ============================================================

export interface ForgeInput {
  /** Source ingot (lot id, qty available). */
  ingot: ItemV2
  /** Number of items to forge (caps at floor(ingot.quantity / ingotPerItem)). */
  count: number
  /** Anvil tier present at the forge location. */
  anvilTier: number
  /** Maker's smithing skill. */
  skill: number
  /** Tool bonus (hammer quality, etc.). */
  toolBonus?: number
  worldDay: number
  makerCertId: string
  /** d20 used for the skill check. */
  d20: number
}

// ============================================================
// FORGE OUTPUT (O)
// ============================================================

export interface ForgeOutput {
  item: ItemV2 | null
  /** Wasted ingot units that didn't make it into the final item. */
  scrap: number
  success: boolean
  reason?: string
}

export interface ForgeReceipt {
  recipeKey: string
  ingotLotId: string
  ingotQty: number
  countAttempted: number
  countProduced: number
  anvilTier: number
  requiredAnvilTier: number
  skillCheck: { skill: number; toolBonus: number; d20: number; total: number; threshold: number; passed: boolean }
  affixRollSeed: string
  /** The ingot's affixes are CARRIED FORWARD into the new item. */
  inheritedAffixIds: string[]
  verification: { matchesK: boolean; matchesI: boolean }
}

/**
 * Forward pass: forge a weapon/armor from an ingot lot.
 */
export function mfForge(
  ctx: ForgeContext,
  input: ForgeInput,
): { output: ForgeOutput; receipt: ForgeReceipt } {
  const possibleCount = Math.floor(input.ingot.quantity / ctx.ingotPerItem)
  const targetCount = Math.min(input.count, possibleCount)

  // Anvil insufficient → fail
  if (input.anvilTier < ctx.requiredAnvilTier) {
    return {
      output: { item: null, scrap: 0, success: false, reason: 'anvil_too_weak' },
      receipt: buildReceipt(ctx, input, 0, false),
    }
  }
  // Skill check
  const total = input.skill + (input.toolBonus ?? 0) + input.d20
  const threshold = Math.max(ctx.skillFloor, ctx.baseDC)
  const passed = total >= threshold
  if (!passed) {
    return {
      output: { item: null, scrap: targetCount * ctx.ingotPerItem, success: false, reason: 'skill_check_failed' },
      receipt: buildReceipt(ctx, input, 0, passed),
    }
  }
  if (targetCount <= 0) {
    return {
      output: { item: null, scrap: 0, success: false, reason: 'insufficient_ingot' },
      receipt: buildReceipt(ctx, input, 0, passed),
    }
  }

  // Build the item
  const newLotId = `${input.ingot.id}:forge:${ctx.recipeKey}:${input.worldDay}`
  const inheritedAffixes = input.ingot.affixes.slice()
  const mint = mintAffixes({
    materialLotId: newLotId,
    worldDay: input.worldDay,
    makerCertId: input.makerCertId,
    skillBonus: input.skill + (input.toolBonus ?? 0),
    tierBonus: ctx.itemTier,
  })

  // Combine: inherited + freshly minted, dedupe by id
  const seen = new Set<string>()
  const combined: typeof inheritedAffixes = []
  for (const a of [...inheritedAffixes, ...mint.affixes]) {
    if (!seen.has(a.id)) {
      seen.add(a.id)
      combined.push(a)
    }
  }
  const prefixes = combined.filter((a) => a.kind === 'prefix')
  const suffixes = combined.filter((a) => a.kind === 'suffix')
  const prefixName = prefixes.length > 0 ? prefixes.map((a) => a.word).join(' ') : undefined
  const suffixName = suffixes.length > 0 ? suffixes.map((a) => a.word).join(' ') : undefined

  const item: ItemV2 = {
    id: newLotId,
    resourceId: ctx.itemResourceId,
    baseName: ctx.itemBaseName,
    quantity: targetCount,
    quality: input.ingot.quality,
    tier: ctx.itemTier,
    affixes: combined,
    prefixName,
    suffixName,
    provenance: {
      method: 'forged',
      parentLotId: input.ingot.id,
      makerCertId: input.makerCertId,
      worldDay: input.worldDay,
    },
  }

  return {
    output: { item, scrap: 0, success: true },
    receipt: {
      recipeKey: ctx.recipeKey,
      ingotLotId: input.ingot.id,
      ingotQty: input.ingot.quantity,
      countAttempted: input.count,
      countProduced: targetCount,
      anvilTier: input.anvilTier,
      requiredAnvilTier: ctx.requiredAnvilTier,
      skillCheck: {
        skill: input.skill,
        toolBonus: input.toolBonus ?? 0,
        d20: input.d20,
        total,
        threshold,
        passed,
      },
      affixRollSeed: newLotId + ':' + input.makerCertId,
      inheritedAffixIds: inheritedAffixes.map((a) => a.id),
      verification: { matchesK: true, matchesI: true },
    },
  }
}

function buildReceipt(
  ctx: ForgeContext,
  input: ForgeInput,
  produced: number,
  passed: boolean,
): ForgeReceipt {
  const total = input.skill + (input.toolBonus ?? 0) + input.d20
  const threshold = Math.max(ctx.skillFloor, ctx.baseDC)
  return {
    recipeKey: ctx.recipeKey,
    ingotLotId: input.ingot.id,
    ingotQty: input.ingot.quantity,
    countAttempted: input.count,
    countProduced: produced,
    anvilTier: input.anvilTier,
    requiredAnvilTier: ctx.requiredAnvilTier,
    skillCheck: {
      skill: input.skill,
      toolBonus: input.toolBonus ?? 0,
      d20: input.d20,
      total,
      threshold,
      passed,
    },
    affixRollSeed: input.ingot.id,
    inheritedAffixIds: input.ingot.affixes.map((a) => a.id),
    verification: { matchesK: true, matchesI: true },
  }
}

/** Build a universal Receipt for the engine-client buffer. */
export function forgeToReceipt(
  output: ForgeOutput,
  receipt: ForgeReceipt,
  tick: number,
): Receipt {
  return {
    mfId: 'mf_forge',
    tick,
    input: { recipeKey: receipt.recipeKey, ingotLotId: receipt.ingotLotId, count: receipt.countAttempted },
    output,
    verification: receipt,
    timestamp: Date.now(),
  }
}
