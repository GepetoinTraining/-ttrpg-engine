/**
 * MF — Fauna Predation
 * ========================
 *
 * Atomic transformations for the 4 player-side wild-fauna intents:
 * hunt, trap, tame, domesticate. Pure, deterministic. Per Theorem 1, each
 * MF returns `{output, receipt}` — receipt is the structural side-effect
 * of the forward pass.
 *
 *   mfHunt        — peer of mfHerdPredation (single-hunter d20+skill kill);
 *                   mutates herd.population
 *   mfTrap        — non-lethal capture; population - 1; emits TrappedCreature
 *   mfTame        — operates on a TrappedCreature; emits FollowerAttachSpec
 *                   (caller wires into mm-followers later)
 *   mfDomesticate — multi-day fold on a TrappedCreature; emits LivestockSpec
 *                   on completion (caller wires into husbandry.Herd later)
 *
 * mfHunt is a PEER of mfHerdPredation, NOT a wrapper. mfHerdPredation
 * models environmental predator pressure (whole-herd 0..1 over many days);
 * mfHunt models a single-hunter d20+skill check yielding 1-N heads. Both
 * mutate `herd.population` — the caller picks which based on whether the
 * threat is environmental or player-driven.
 *
 * Caller (slot push consumer / future mm-fauna wiring) takes the receipt
 * and emits a `writeKappa` action with `system='client-intent:hunt-fauna:
 * <certId>'` per the no-new-TPB-variant rule.
 */

import {
  type WildHerd,
  type WildFaunaSpecies,
  type Formation,
  type HerdStatus,
  type TrophicRole,
  defaultFormationFor,
  isViable,
} from './wild-fauna'
import {
  type EcologyKnowledgeLevel,
  KNOWLEDGE_DC_DISCOUNT,
} from './ecology-interactables'
import {
  getPredationProfile,
  type PredationIntent,
  type PredationSkill,
} from './fauna-predation'

// ============================================================
// COMMON RECEIPT
// ============================================================

export interface PredationReceipt {
  speciesId: string
  intent: PredationIntent
  skill: PredationSkill
  baseDC: number
  effectiveDC: number
  d20: number
  total: number
  success: boolean
  margin: number
  priorKnowledge: EcologyKnowledgeLevel
  newKnowledge: EcologyKnowledgeLevel
}

// ============================================================
// CAPTURED CREATURE — output of mfTrap, input of mfTame / mfDomesticate
// ============================================================

export interface TrappedCreature {
  speciesId: string
  trophic: TrophicRole
  trappedOnDay: number
}

// ============================================================
// HELPERS — knowledge bump (mirrors mf-ecological-study)
// ============================================================

function bumpKnowledge(
  prior: EcologyKnowledgeLevel,
  margin: number,
  intent: PredationIntent,
): EcologyKnowledgeLevel {
  // Trap doesn't bump tier (consistent with mfEcologicalHarvest).
  // Hunt / tame / domesticate drift toward expert tier.
  if (intent === 'trap') return prior
  if (prior >= 3) return 3
  if (prior === 2) return margin >= 5 ? 3 : 2
  return (prior + 1) as EcologyKnowledgeLevel
}

// ============================================================
// HUNT
// ============================================================

export interface HuntContext {
  d20: number
  skillModifier: number
  toolBonus?: number
  priorKnowledge?: EcologyKnowledgeLevel
  worldDay: number
}

export interface HuntYield {
  meat: number
  hide: number
  bone: number
}

export interface HuntOutput {
  herdAfter: WildHerd
  killed: number
  yield: HuntYield | null
  hazardNote: string | null
  statusTransition: { from: HerdStatus; to: HerdStatus } | null
}

export function mfHunt(
  herd: WildHerd,
  species: WildFaunaSpecies,
  ctx: HuntContext,
): { output: HuntOutput; receipt: PredationReceipt } {
  if (!isViable(herd, species)) {
    throw new Error(`mfHunt: herd ${herd.id} below min viable population`)
  }
  const profile = getPredationProfile(species.id)
  if (!profile.hunt) {
    throw new Error(`mfHunt: species ${species.id} has no hunt template`)
  }
  const t = profile.hunt
  const prior = ctx.priorKnowledge ?? 0
  const baseDC = t.baseDC
  const effectiveDC = Math.max(5, baseDC - KNOWLEDGE_DC_DISCOUNT[prior])
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC
  const newKnowledge = success ? bumpKnowledge(prior, margin, 'hunt') : prior

  const fromStatus = herd.status
  let killed = 0
  let yieldOut: HuntYield | null = null
  let hazardNote: string | null = null
  let toStatus: HerdStatus = fromStatus

  if (success) {
    const marginKills = Math.max(1, Math.ceil(margin / 3) + 1)
    killed = Math.min(t.maxKillPerAttempt, marginKills, herd.population)
    yieldOut = {
      meat: killed * profile.meatPerHead,
      hide: killed * profile.hidePerHead,
      bone: killed * profile.bonePerHead,
    }
    if (killed >= 2 && fromStatus !== 'fleeing') {
      toStatus = 'fleeing'
    }
  } else {
    // Predator counterattack on fail; prey panics & flees.
    if (profile.trophic === 'small-carnivore' || profile.trophic === 'apex-carnivore') {
      hazardNote = t.hazardNote ?? 'predator counterattack'
    } else if (fromStatus !== 'fleeing') {
      toStatus = 'fleeing'
    }
  }

  const populationAfter = Math.max(0, herd.population - killed)
  if (populationAfter < species.minViable) {
    toStatus = 'decimated'
  }

  const newFormation: Formation =
    toStatus === fromStatus ? herd.formation : defaultFormationFor(toStatus)

  const herdAfter: WildHerd = {
    ...herd,
    population: populationAfter,
    formation: newFormation,
    status: toStatus,
    lastTransitionDay:
      toStatus !== fromStatus ? ctx.worldDay : herd.lastTransitionDay,
  }

  return {
    output: {
      herdAfter,
      killed,
      yield: yieldOut,
      hazardNote,
      statusTransition: toStatus !== fromStatus ? { from: fromStatus, to: toStatus } : null,
    },
    receipt: {
      speciesId: species.id,
      intent: 'hunt',
      skill: t.skill,
      baseDC,
      effectiveDC,
      d20,
      total,
      success,
      margin,
      priorKnowledge: prior,
      newKnowledge,
    },
  }
}

// ============================================================
// TRAP
// ============================================================

export interface TrapContext {
  d20: number
  skillModifier: number
  toolBonus?: number
  priorKnowledge?: EcologyKnowledgeLevel
  worldDay: number
  /** Whether bait is offered (-2 effective DC). */
  bait?: boolean
}

export interface TrapOutput {
  herdAfter: WildHerd
  captured: TrappedCreature | null
  hazardNote: string | null
  statusTransition: { from: HerdStatus; to: HerdStatus } | null
}

export function mfTrap(
  herd: WildHerd,
  species: WildFaunaSpecies,
  ctx: TrapContext,
): { output: TrapOutput; receipt: PredationReceipt } {
  if (!isViable(herd, species)) {
    throw new Error(`mfTrap: herd ${herd.id} below min viable population`)
  }
  const profile = getPredationProfile(species.id)
  if (!profile.trap) {
    throw new Error(`mfTrap: species ${species.id} has no trap template`)
  }
  const t = profile.trap
  const prior = ctx.priorKnowledge ?? 0
  const baseDC = t.baseDC
  const baitMod = ctx.bait ? -2 : 0
  const effectiveDC = Math.max(5, baseDC - KNOWLEDGE_DC_DISCOUNT[prior] + baitMod)
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC
  const newKnowledge = bumpKnowledge(prior, margin, 'trap') // trap stays put

  const fromStatus = herd.status
  let captured: TrappedCreature | null = null
  let hazardNote: string | null = null
  let toStatus: HerdStatus = fromStatus
  let populationAfter = herd.population

  if (success) {
    captured = {
      speciesId: species.id,
      trophic: profile.trophic,
      trappedOnDay: ctx.worldDay,
    }
    populationAfter = Math.max(0, herd.population - 1)
  } else if (profile.trophic === 'small-carnivore' || profile.trophic === 'apex-carnivore') {
    hazardNote = t.hazardNote ?? 'snared but bites handler'
  }
  // Prey trap fail: herd doesn't even know — no flee flip.

  if (populationAfter < species.minViable) {
    toStatus = 'decimated'
  }

  const newFormation: Formation =
    toStatus === fromStatus ? herd.formation : defaultFormationFor(toStatus)

  const herdAfter: WildHerd = {
    ...herd,
    population: populationAfter,
    formation: newFormation,
    status: toStatus,
    lastTransitionDay:
      toStatus !== fromStatus ? ctx.worldDay : herd.lastTransitionDay,
  }

  return {
    output: {
      herdAfter,
      captured,
      hazardNote,
      statusTransition: toStatus !== fromStatus ? { from: fromStatus, to: toStatus } : null,
    },
    receipt: {
      speciesId: species.id,
      intent: 'trap',
      skill: t.skill,
      baseDC,
      effectiveDC,
      d20,
      total,
      success,
      margin,
      priorKnowledge: prior,
      newKnowledge,
    },
  }
}

// ============================================================
// TAME
// ============================================================

export interface TameContext {
  d20: number
  skillModifier: number
  toolBonus?: number
  priorKnowledge?: EcologyKnowledgeLevel
  worldDay: number
  /** Food / treat offering bonus (-2 DC). */
  offering?: boolean
}

export interface FollowerAttachSpec {
  speciesId: string
  trophic: TrophicRole
  bondLevel: number
  attachedOnDay: number
  expiresOnDay: number
}

export interface TameOutput {
  bondLevel: number
  followerSpec: FollowerAttachSpec | null
  expiresInDays: number
  hazardNote: string | null
}

export function mfTame(
  captured: TrappedCreature,
  species: WildFaunaSpecies,
  ctx: TameContext,
): { output: TameOutput; receipt: PredationReceipt } {
  if (captured.speciesId !== species.id) {
    throw new Error(
      `mfTame: captured speciesId '${captured.speciesId}' does not match species '${species.id}'`,
    )
  }
  const profile = getPredationProfile(species.id)
  if (!profile.tame) {
    throw new Error(`mfTame: species ${species.id} has no tame template`)
  }
  const t = profile.tame
  const prior = ctx.priorKnowledge ?? 0
  const baseDC = t.baseDC
  const offerMod = ctx.offering ? -2 : 0
  const effectiveDC = Math.max(5, baseDC - KNOWLEDGE_DC_DISCOUNT[prior] + offerMod)
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC
  const newKnowledge = success ? bumpKnowledge(prior, margin, 'tame') : prior

  let bondLevel = 0
  let followerSpec: FollowerAttachSpec | null = null
  let expiresInDays = 0
  let hazardNote: string | null = null

  if (success) {
    bondLevel = 1 + Math.max(0, Math.min(4, Math.floor(margin / 3))) // 1..5
    expiresInDays = t.baseBondDays + bondLevel
    followerSpec = {
      speciesId: species.id,
      trophic: profile.trophic,
      bondLevel,
      attachedOnDay: ctx.worldDay,
      expiresOnDay: ctx.worldDay + expiresInDays,
    }
  } else {
    hazardNote = t.hazardNote ?? null
  }

  return {
    output: {
      bondLevel,
      followerSpec,
      expiresInDays,
      hazardNote,
    },
    receipt: {
      speciesId: species.id,
      intent: 'tame',
      skill: t.skill,
      baseDC,
      effectiveDC,
      d20,
      total,
      success,
      margin,
      priorKnowledge: prior,
      newKnowledge,
    },
  }
}

// ============================================================
// DOMESTICATE
// ============================================================

export interface DomesticationProgress {
  speciesId: string
  daysInvested: number
  pointsAccumulated: number
  pointsRequired: number
  startedOnDay: number
}

export interface DomesticateContext {
  d20: number
  skillModifier: number
  toolBonus?: number
  priorKnowledge?: EcologyKnowledgeLevel
  worldDay: number
  /** Days this fold covers (≥ 1). */
  days: number
  /** Existing progress, or null/undefined to start fresh. */
  prior?: DomesticationProgress | null
  /** Whether the player has access to a settlement facility. */
  hasFacility?: boolean
}

export interface LivestockSpec {
  speciesId: string
  count: number
  domesticatedOnDay: number
}

export interface DomesticateOutput {
  progressAfter: DomesticationProgress
  completed: boolean
  livestockSpec: LivestockSpec | null
  hazardNote: string | null
}

export function mfDomesticate(
  captured: TrappedCreature,
  species: WildFaunaSpecies,
  ctx: DomesticateContext,
): { output: DomesticateOutput; receipt: PredationReceipt } {
  if (captured.speciesId !== species.id) {
    throw new Error(
      `mfDomesticate: captured speciesId '${captured.speciesId}' does not match species '${species.id}'`,
    )
  }
  if (ctx.prior && ctx.prior.speciesId !== species.id) {
    throw new Error(
      `mfDomesticate: prior progress speciesId '${ctx.prior.speciesId}' mismatch with species '${species.id}'`,
    )
  }
  const profile = getPredationProfile(species.id)
  if (!profile.domesticate) {
    throw new Error(`mfDomesticate: species ${species.id} has no domesticate template`)
  }
  const t = profile.domesticate
  const prior = ctx.priorKnowledge ?? 0
  const baseDC = t.baseDC
  const effectiveDC = Math.max(5, baseDC - KNOWLEDGE_DC_DISCOUNT[prior])
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC
  const newKnowledge = success ? bumpKnowledge(prior, margin, 'domesticate') : prior

  const days = Math.max(1, Math.floor(ctx.days))

  const startProgress: DomesticationProgress = ctx.prior ?? {
    speciesId: species.id,
    daysInvested: 0,
    pointsAccumulated: 0,
    pointsRequired: t.requiredDays,
    startedOnDay: ctx.worldDay - days,
  }

  // Facility gate — required species without a facility cannot progress.
  let hazardNote: string | null = null
  let pointsAdded = 0
  if (t.requiresFacility && !ctx.hasFacility) {
    hazardNote = `${species.id}: requires settlement facility to domesticate`
  } else {
    pointsAdded = success ? days : Math.floor(days * 0.5)
    if (!success) hazardNote = t.hazardNote ?? null
  }

  const pointsAccumulated = Math.max(
    0,
    Math.min(startProgress.pointsRequired, startProgress.pointsAccumulated + pointsAdded),
  )
  const progressAfter: DomesticationProgress = {
    speciesId: species.id,
    daysInvested: startProgress.daysInvested + days,
    pointsAccumulated,
    pointsRequired: startProgress.pointsRequired,
    startedOnDay: startProgress.startedOnDay,
  }
  const completed = pointsAccumulated >= progressAfter.pointsRequired
  const livestockSpec: LivestockSpec | null = completed
    ? { speciesId: species.id, count: 1, domesticatedOnDay: ctx.worldDay }
    : null

  return {
    output: {
      progressAfter,
      completed,
      livestockSpec,
      hazardNote,
    },
    receipt: {
      speciesId: species.id,
      intent: 'domesticate',
      skill: t.skill,
      baseDC,
      effectiveDC,
      d20,
      total,
      success,
      margin,
      priorKnowledge: prior,
      newKnowledge,
    },
  }
}
