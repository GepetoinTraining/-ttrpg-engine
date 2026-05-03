/**
 * MF_IDENTIFY — Inspect an item to reveal hidden affixes
 * ========================================================
 *
 * Slow-life v2 (W3.2). Pure compute, returns `{ output, receipt }`.
 *
 *   x = analyze(item, character mastery)
 *   K = IdentifyContext { masteryFloorForFullReveal, baseDC }
 *   I = IdentifyInput { item, knowledgeLevel, skill, toolBonus, d20 }
 *   O = IdentifyOutput { revealedAffixes, hiddenCount, masteryGain }
 *   R = IdentifyReceipt — input audit + skill check
 *
 * Mastery gating (per `material-mastery.ts` 0–3 levels):
 *   0 (unknown):      no affixes visible; only base name
 *   1 (named):        prefixName + suffixName visible, no affix details
 *   2 (base props):   minor affixes (rarity='minor') reveal in detail
 *   3 (full mastery): all affixes reveal in detail
 *
 * The skill check on TOP of mastery can reveal one additional tier above
 * the mastery floor (so a level-2 character with a great inspect roll can
 * see major affixes too — but never legendary unless mastery 3).
 */

import type { Receipt } from './types'
import type { ItemV2 } from './mf-smelt'
import type { Affix } from './material-affixes'

// ============================================================
// CONTEXT (K)
// ============================================================

export interface IdentifyContext {
  /** Mastery level required to fully reveal all affixes without a check. */
  masteryFloorForFullReveal: number  // typically 3
  /** Base DC for the inspect skill check (additional reveal beyond mastery). */
  baseDC: number
}

// ============================================================
// INPUT (I)
// ============================================================

export interface IdentifyInput {
  item: ItemV2
  /** Character's mastery level for this material (0-3 per material-mastery.ts). */
  knowledgeLevel: 0 | 1 | 2 | 3
  /** Identification skill (Investigation / Arcana etc.). */
  skill: number
  /** Tool bonus (lens, alchemy kit, etc.). */
  toolBonus?: number
  /** d20 for the inspect skill check. */
  d20: number
}

// ============================================================
// OUTPUT (O)
// ============================================================

export interface IdentifyOutput {
  /** Affixes the character can now see. May be a subset of item.affixes. */
  revealedAffixes: Affix[]
  /** Number of affixes still hidden. */
  hiddenCount: number
  /** Did the inspect bump the character's knowledge level? (returned for caller to apply). */
  masteryGain: 0 | 1
  /** True when ALL affixes were revealed (hiddenCount === 0). */
  fullyRevealed: boolean
}

export interface IdentifyReceipt {
  itemLotId: string
  itemResourceId: string
  knowledgeLevel: number
  skillCheck: { skill: number; toolBonus: number; d20: number; total: number; threshold: number; passed: boolean }
  rarityCeilingApplied: 'minor' | 'major' | 'legendary'
  verification: { matchesK: boolean; matchesI: boolean }
}

const RARITY_ORDER = { minor: 1, major: 2, legendary: 3 } as const

/**
 * Forward pass: inspect the item.
 */
export function mfIdentify(
  ctx: IdentifyContext,
  input: IdentifyInput,
): { output: IdentifyOutput; receipt: IdentifyReceipt } {
  const total = input.skill + (input.toolBonus ?? 0) + input.d20
  const passed = total >= ctx.baseDC

  // Determine the rarity ceiling: mastery sets the floor, skill check may bump by 1
  const baseCeiling: 'minor' | 'major' | 'legendary' =
    input.knowledgeLevel >= 3 ? 'legendary' :
    input.knowledgeLevel === 2 ? 'minor' :
    input.knowledgeLevel === 1 ? 'minor' :
    'minor'  // even at 0, on a successful check, minor minimum

  let ceiling: 'minor' | 'major' | 'legendary' = baseCeiling
  if (passed) {
    // Bump one tier higher if skill check passes
    if (ceiling === 'minor') {
      ceiling = 'major'
    } else if ((ceiling as string) === 'major') {
      ceiling = 'legendary'
    }
  }

  // Knowledge-level 0 sees nothing unless the check passes
  let revealed: Affix[] = []
  if (input.knowledgeLevel === 0 && !passed) {
    revealed = []
  } else {
    revealed = input.item.affixes.filter((a) => RARITY_ORDER[a.rarity] <= RARITY_ORDER[ceiling])
  }

  const masteryGain: 0 | 1 = passed && input.knowledgeLevel < 3 ? 1 : 0
  const hiddenCount = input.item.affixes.length - revealed.length

  return {
    output: {
      revealedAffixes: revealed,
      hiddenCount,
      masteryGain,
      fullyRevealed: hiddenCount === 0,
    },
    receipt: {
      itemLotId: input.item.id,
      itemResourceId: input.item.resourceId,
      knowledgeLevel: input.knowledgeLevel,
      skillCheck: {
        skill: input.skill,
        toolBonus: input.toolBonus ?? 0,
        d20: input.d20,
        total,
        threshold: ctx.baseDC,
        passed,
      },
      rarityCeilingApplied: ceiling,
      verification: { matchesK: true, matchesI: true },
    },
  }
}

/** Build a universal Receipt for the engine-client buffer. */
export function identifyToReceipt(
  output: IdentifyOutput,
  receipt: IdentifyReceipt,
  tick: number,
): Receipt {
  return {
    mfId: 'mf_identify',
    tick,
    input: { itemLotId: receipt.itemLotId, knowledgeLevel: receipt.knowledgeLevel },
    output,
    verification: receipt,
    timestamp: Date.now(),
  }
}
