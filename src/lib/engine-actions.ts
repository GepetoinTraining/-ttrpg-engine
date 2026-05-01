/**
 * Engine actions — pure helpers that run player-side MFs locally and produce
 * the matching `writeKappa` actions for slot push.
 *
 * Per `feedback_no_time_skip.md`: tick-gated mechanics (trap, tame,
 * domesticate) require the caller to actually elapse the ticks before calling
 * these helpers. The helpers themselves are one-shot — they take the elapsed
 * state of the world (herd state at the time prey can be trapped, captured
 * creature already trapped, etc.) and resolve. The wait lives in the surface.
 *
 * Each helper returns:
 *   - `result`: the engine-side output of the MF (for UI rendering)
 *   - `receipt`: the structural side-effect receipt (audit trail)
 *   - `actions`: zero or more `writeKappa` actions to push to the slot
 *
 * Some MFs don't mutate κ (tame, domesticate, studyEcology, craft*) — those
 * helpers return `actions: []` and the caller wires the result into the
 * relevant non-κ system (mm-followers, husbandry.Herd, character mastery,
 * inventory).
 */

import {
  mfHunt,
  mfTrap,
  mfTame,
  mfDomesticate,
  type HuntContext,
  type HuntOutput,
  type TrapContext,
  type TrapOutput,
  type TameContext,
  type TameOutput,
  type DomesticateContext,
  type DomesticateOutput,
  type PredationReceipt,
  type TrappedCreature,
} from '../../engine/mf-fauna-predation'
import {
  mfMineDig,
  mfMineReveal,
  type MineDigContext,
  type MineDigOutput,
  type MineRevealContext,
  type MineRevealOutput,
  type MineDigReceipt,
} from '../../engine/mf-mine-dig'
import {
  mfEcologicalStudy,
  mfEcologicalHarvest,
  type EcologyMFContext,
  type EcologyStudyOutput,
  type EcologyHarvestOutput,
  type EcologyMFReceipt,
} from '../../engine/mf-ecological-study'
import {
  mfCraftBasic,
  mfCraftDiscover,
  type CraftContext,
  type CraftBasicOutput,
  type CraftDiscoverContext,
  type CraftDiscoverOutput,
  type CraftReceipt,
} from '../../engine/mf-craft'
import {
  mfStudyTech,
  type StudyTechContext,
  type StudyTechOutput,
  type StudyTechReceipt,
} from '../../engine/mf-study-tech'
import { type WildHerd, type WildFaunaSpecies } from '../../engine/wild-fauna'
import { type MineLayer } from '../../engine/mining-layers'
import { type ArchetypePurpose } from '../../engine/tool-archetypes'
import { type TechBlob } from '../../engine/technology-web'
import type { WorldTPBAction } from '../../engine/tpb-world'

// ============================================================
// COMMON SHAPES
// ============================================================

export interface ActionEnvelope<R, O> {
  result: O
  receipt: R
  actions: WorldTPBAction[]
}

function clientIntent(intent: string, certId: string): string {
  return `client-intent:${intent}:${certId}`
}

// ============================================================
// HUNT — kills heads from a herd; updates κ.ecology.herds
// ============================================================

export function actHunt(args: {
  herd: WildHerd
  species: WildFaunaSpecies
  ctx: HuntContext
  certId: string
}): ActionEnvelope<PredationReceipt, HuntOutput> {
  const { herd, species, ctx, certId } = args
  const { output, receipt } = mfHunt(herd, species, ctx)
  const actions: WorldTPBAction[] = []
  if (output.killed > 0 || output.statusTransition) {
    actions.push({
      type: 'writeKappa',
      nodeId: output.herdAfter.currentNodeId,
      domain: 'ecology',
      paths: [`ecology.herds.${output.herdAfter.id}`],
      system: clientIntent('hunt-fauna', certId),
      value: { herds: { [output.herdAfter.id]: output.herdAfter } },
    })
  }
  return { result: output, receipt, actions }
}

// ============================================================
// TRAP — population -1; emits TrappedCreature; updates κ.ecology.herds
// ============================================================

export function actTrap(args: {
  herd: WildHerd
  species: WildFaunaSpecies
  ctx: TrapContext
  certId: string
}): ActionEnvelope<PredationReceipt, TrapOutput> {
  const { herd, species, ctx, certId } = args
  const { output, receipt } = mfTrap(herd, species, ctx)
  const actions: WorldTPBAction[] = []
  if (output.captured) {
    actions.push({
      type: 'writeKappa',
      nodeId: output.herdAfter.currentNodeId,
      domain: 'ecology',
      paths: [`ecology.herds.${output.herdAfter.id}`],
      system: clientIntent('trap-fauna', certId),
      value: { herds: { [output.herdAfter.id]: output.herdAfter } },
    })
  }
  return { result: output, receipt, actions }
}

// ============================================================
// TAME — operates on TrappedCreature; emits FollowerAttachSpec for caller.
// No κ delta — the follower attachment flows through mm-followers wiring.
// ============================================================

export function actTame(args: {
  captured: TrappedCreature
  species: WildFaunaSpecies
  ctx: TameContext
}): ActionEnvelope<PredationReceipt, TameOutput> {
  const { captured, species, ctx } = args
  const { output, receipt } = mfTame(captured, species, ctx)
  return { result: output, receipt, actions: [] }
}

// ============================================================
// DOMESTICATE — multi-day fold; emits LivestockSpec on completion. No κ.
// ============================================================

export function actDomesticate(args: {
  captured: TrappedCreature
  species: WildFaunaSpecies
  ctx: DomesticateContext
}): ActionEnvelope<PredationReceipt, DomesticateOutput> {
  const { captured, species, ctx } = args
  const { output, receipt } = mfDomesticate(captured, species, ctx)
  return { result: output, receipt, actions: [] }
}

// ============================================================
// MINE DIG / REVEAL — updates κ.infrastructure.mineLayers
// ============================================================

export function actMineDig(args: {
  layer: MineLayer
  mineNodeId: string
  ctx: MineDigContext
  /** All current layers at the mine — used to project the full κ value. */
  currentLayers: MineLayer[]
  certId: string
}): ActionEnvelope<MineDigReceipt, MineDigOutput> {
  const { layer, mineNodeId, ctx, currentLayers, certId } = args
  const { output, receipt } = mfMineDig(layer, ctx)
  // Replace the dug layer in the full layer stack to project the κ value.
  const newLayers = currentLayers.map((l) =>
    l.layerId === output.layerAfter.layerId ? output.layerAfter : l,
  )
  const actions: WorldTPBAction[] = [{
    type: 'writeKappa',
    nodeId: mineNodeId,
    domain: 'infrastructure',
    paths: ['infrastructure.mineLayers'],
    system: clientIntent('mine-dig', certId),
    value: { mineLayers: newLayers },
  }]
  return { result: output, receipt, actions }
}

export function actMineReveal(args: {
  parent: MineLayer
  ctx: MineRevealContext
  /** All current layers at the mine — used to project the full κ value. */
  currentLayers: MineLayer[]
  certId: string
}): ActionEnvelope<MineDigReceipt, MineRevealOutput> {
  const { parent, ctx, currentLayers, certId } = args
  const { output, receipt } = mfMineReveal(parent, ctx)
  const replaced = currentLayers.map((l) =>
    l.layerId === output.parentAfter.layerId ? output.parentAfter : l,
  )
  const newLayers = output.newLayer ? [...replaced, output.newLayer] : replaced
  newLayers.sort((a, b) => a.layerId - b.layerId)
  const actions: WorldTPBAction[] = [{
    type: 'writeKappa',
    nodeId: ctx.mineNodeId,
    domain: 'infrastructure',
    paths: ['infrastructure.mineLayers'],
    system: clientIntent('mine-reveal', certId),
    value: { mineLayers: newLayers },
  }]
  return { result: output, receipt, actions }
}

// ============================================================
// ECOLOGY STUDY / HARVEST
// ============================================================

/**
 * Study reveals knowledge — knowledge is per-character (mirrors
 * material-mastery), so no κ delta. Caller updates character mastery from
 * the receipt's `newKnowledge` field.
 */
export function actStudyEcology(args: {
  ctx: EcologyMFContext
}): ActionEnvelope<EcologyMFReceipt, EcologyStudyOutput> {
  const { output, receipt } = mfEcologicalStudy(args.ctx)
  return { result: output, receipt, actions: [] }
}

/**
 * Harvest reduces interactable density at the region. Caller provides
 * `regionNodeId` and the current density map at that region; the κ delta
 * applies the new density value at the species id.
 */
export function actHarvestEcology(args: {
  ctx: EcologyMFContext
  regionNodeId: string
  /** Current densityById at the region — used to project the full κ value. */
  currentDensity: Record<string, number>
  certId: string
}): ActionEnvelope<EcologyMFReceipt, EcologyHarvestOutput> {
  const { ctx, regionNodeId, currentDensity, certId } = args
  const { output, receipt } = mfEcologicalHarvest(ctx)
  const actions: WorldTPBAction[] = []
  if (output.densityDelta !== 0) {
    const before = currentDensity[ctx.speciesId] ?? 1
    const after = Math.max(0, Math.min(1, before + output.densityDelta))
    const next = { ...currentDensity, [ctx.speciesId]: after }
    actions.push({
      type: 'writeKappa',
      nodeId: regionNodeId,
      domain: 'ecology',
      paths: [`ecology.interactableDensity.${ctx.speciesId}`],
      system: clientIntent('harvest-ecology', certId),
      value: { interactableDensity: next },
    })
  }
  return { result: output, receipt, actions }
}

// ============================================================
// CRAFT BASIC / DISCOVER — no κ delta (character inventory side)
// ============================================================

export function actCraftBasic(args: {
  purpose: ArchetypePurpose
  ctx: CraftContext
}): ActionEnvelope<CraftReceipt, CraftBasicOutput> {
  const { output, receipt } = mfCraftBasic(args.purpose, args.ctx)
  return { result: output, receipt, actions: [] }
}

export function actCraftDiscover(args: {
  purpose: ArchetypePurpose
  ctx: CraftDiscoverContext
}): ActionEnvelope<CraftReceipt, CraftDiscoverOutput> {
  const { output, receipt } = mfCraftDiscover(args.purpose, args.ctx)
  return { result: output, receipt, actions: [] }
}

// ============================================================
// STUDY TECH — updates κ.knowledge.unlockedTech at the settlement
// ============================================================

export function actStudyTech(args: {
  prior: TechBlob
  ctx: StudyTechContext
  settlementNodeId: string
  /** Current unlockedTech map at the settlement. */
  currentUnlocks: Record<string, string>
  certId: string
}): ActionEnvelope<StudyTechReceipt, StudyTechOutput> {
  const { prior, ctx, settlementNodeId, currentUnlocks, certId } = args
  const { output, receipt } = mfStudyTech(prior, ctx)
  const actions: WorldTPBAction[] = []
  if (output.blob) {
    const next = { ...currentUnlocks, [output.blob.purpose]: output.blob.tier }
    actions.push({
      type: 'writeKappa',
      nodeId: settlementNodeId,
      domain: 'knowledge',
      paths: [`knowledge.unlockedTech.${output.blob.purpose}`],
      system: clientIntent('study-tech', certId),
      value: { unlockedTech: next },
    })
  }
  return { result: output, receipt, actions }
}
