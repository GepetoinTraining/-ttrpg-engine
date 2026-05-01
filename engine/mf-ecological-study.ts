/**
 * MF — Ecological Study / Harvest
 * ===================================
 *
 * Atomic transformation per Theorem 1: forward pass produces output O AND
 * receipt R as a structural side-effect of the matrix. Pure, deterministic,
 * no DB.
 *
 * Two intents covered here (the third — track — is fauna-specific and is
 * folded into mfHunt for Δ.2):
 *   - mfEcologicalStudy:   reveal properties, bump knowledge tier
 *   - mfEcologicalHarvest: extract resource (with depletion contribution)
 *
 * Knowledge tiers are PER-CHARACTER per-species (mirror material-mastery.ts):
 *   0 → 1 on first study success
 *   1 → 2 on subsequent study success
 *   2 → 3 on rare expert success (margin ≥ 5)
 *   capped at 3
 *
 * Effective DC = baseDC - KNOWLEDGE_DC_DISCOUNT[priorKnowledge].
 *
 * The MF doesn't write κ itself — the caller (e.g. an /api/ecology/study
 * route handler or a slot push action emitter) takes the receipt and emits
 * a `writeKappa` action with `system='client-intent:ecology-study:<certId>'`
 * per the proposal §3 (no new TPB variant needed).
 */

import {
  getInteractable,
  KNOWLEDGE_DC_DISCOUNT,
  type EcologyKnowledgeLevel,
  type EcologySkill,
  type InteractableSpecies,
  type InteractionTemplate,
} from './ecology-interactables.js'

// ============================================================
// COMMON SHAPES
// ============================================================

export interface EcologyMFContext {
  speciesId: string
  /** d20 roll (1-20). Caller pulls from `mf-pool-dice` or a deterministic seed. */
  d20: number
  /** Player's skill modifier for the rolled skill. */
  skillModifier: number
  /** Tool / equipment bonus (e.g. herbalism kit, tracker's lens). */
  toolBonus?: number
  /** Per-character prior knowledge tier on this species (default 0). */
  priorKnowledge?: EcologyKnowledgeLevel
}

export interface EcologyMFReceipt {
  speciesId: string
  intent: 'study' | 'harvest'
  skill: EcologySkill
  baseDC: number
  effectiveDC: number
  d20: number
  total: number
  success: boolean
  /** Roll margin = total - effectiveDC. Negative on fail. */
  margin: number
  /** Knowledge tier BEFORE the roll. */
  priorKnowledge: EcologyKnowledgeLevel
  /** Knowledge tier AFTER the roll (only changes on study success). */
  newKnowledge: EcologyKnowledgeLevel
}

// ============================================================
// HELPERS
// ============================================================

function bumpKnowledge(
  prior: EcologyKnowledgeLevel,
  margin: number,
  intent: 'study' | 'harvest',
): EcologyKnowledgeLevel {
  if (intent !== 'study') return prior // harvest doesn't bump tier
  if (prior >= 3) return 3
  if (prior === 2) {
    // Tier-3 (Expert) requires a strong success margin
    return margin >= 5 ? 3 : 2
  }
  return (prior + 1) as EcologyKnowledgeLevel
}

function pickTemplate(
  species: InteractableSpecies,
  intent: 'study' | 'harvest',
): InteractionTemplate {
  const t = intent === 'study' ? species.intents.study : species.intents.harvest
  if (!t) {
    throw new Error(
      `species ${species.id} does not support intent '${intent}' (catalog template absent)`,
    )
  }
  return t
}

function resolveCheck(
  template: InteractionTemplate,
  ctx: EcologyMFContext,
  intent: 'study' | 'harvest',
  species: InteractableSpecies,
): EcologyMFReceipt {
  const prior = ctx.priorKnowledge ?? 0
  const discount = KNOWLEDGE_DC_DISCOUNT[prior]
  const effectiveDC = Math.max(5, template.baseDC - discount)
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC
  const newKnowledge = success ? bumpKnowledge(prior, margin, intent) : prior

  return {
    speciesId: species.id,
    intent,
    skill: template.skill,
    baseDC: template.baseDC,
    effectiveDC,
    d20,
    total,
    success,
    margin,
    priorKnowledge: prior,
    newKnowledge,
  }
}

// ============================================================
// STUDY MF
// ============================================================

export interface EcologyStudyOutput {
  /** Species name revealed at tier ≥ 1 (always after first success). */
  revealedName: string | null
  /** Yield note from the catalog template — surfaces what the player learned. */
  yieldNote: string | null
  /** Lore-bag keywords unlocked — caller appends to lore bag at tier ≥ 2. */
  unlockedKeywords: string[]
}

export function mfEcologicalStudy(ctx: EcologyMFContext): {
  output: EcologyStudyOutput
  receipt: EcologyMFReceipt
} {
  const species = getInteractable(ctx.speciesId)
  const template = pickTemplate(species, 'study')
  const receipt = resolveCheck(template, ctx, 'study', species)

  const revealedName = receipt.newKnowledge >= 1 ? species.name : null
  const yieldNote = receipt.success ? template.yieldNote ?? null : null
  const unlockedKeywords = receipt.newKnowledge >= 2 ? species.lore.keywords : []

  return {
    output: {
      revealedName,
      yieldNote,
      unlockedKeywords,
    },
    receipt,
  }
}

// ============================================================
// HARVEST MF
// ============================================================

export interface EcologyHarvestOutput {
  /** Yield note from catalog (qualitative — the resolver/UI parses). */
  yieldNote: string | null
  /** Hazard fired on failure (e.g. "1d4 piercing damage"). */
  hazardNote: string | null
  /** Density delta to apply at the source node (negative; caller persists). */
  densityDelta: number
}

/**
 * Harvest delta — proportional to rarity. The proposal §5 says depletion
 * range is roughly 0.05–0.2; we pick a deterministic value per rarity tier
 * and modulate by success margin.
 */
function densityDeltaFor(rarity: 'common' | 'uncommon' | 'rare', success: boolean): number {
  if (!success) return 0
  switch (rarity) {
    case 'common':   return -0.05
    case 'uncommon': return -0.1
    case 'rare':     return -0.2
  }
}

export function mfEcologicalHarvest(ctx: EcologyMFContext): {
  output: EcologyHarvestOutput
  receipt: EcologyMFReceipt
} {
  const species = getInteractable(ctx.speciesId)
  const template = pickTemplate(species, 'harvest')
  const receipt = resolveCheck(template, ctx, 'harvest', species)

  return {
    output: {
      yieldNote: receipt.success ? template.yieldNote ?? null : null,
      hazardNote: !receipt.success ? template.hazardNote ?? null : null,
      densityDelta: densityDeltaFor(species.rarity, receipt.success),
    },
    receipt,
  }
}
