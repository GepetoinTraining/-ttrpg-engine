/**
 * STUDY — material study queue + tool-tier gates
 * ===================================================
 *
 * Pedro 2026-05-02:
 *   - A character/follower/NPC can run N concurrent studies, where N = INT
 *     modifier (capped 1..8).
 *   - Study completion time scales by tier (F=1d → EX=360d).
 *   - Harvesting material requires `tool.tier >= material.tier` (the
 *     "is the tree =< tool?" check).
 *   - Studies are TPB-driven: `start_study` writeKappa actions are the
 *     source of truth. `computeActiveStudies` reconstructs the queue from
 *     the log (no in-memory state needed for persistence).
 *   - Completed studies trigger an LLM-supervised discovery via
 *     `/api/study/complete` (server-side, NOT engine; the engine only
 *     validates + inserts the LLM's structured response).
 *
 * Pure compute. Zero LLM imports. The route handler that drives Claude
 * lives in `src/app/api/study/complete/route.ts`.
 */

import { z } from 'zod'
import { TIER_ORDER, type Tier, TierSchema } from './tier'
import type { WorldTPBAction } from './tpb-world'
import type { Receipt } from './types'

// ============================================================
// TIER → COMPLETION DAYS
// ============================================================

/**
 * Days of game time required to complete a study at each tier. Geometric
 * scaling — a single F-tier sample finishes in a day, but EX-tier samples
 * are a year-long project. The numbers are deliberately ambitious for high
 * tiers — the player must commit time, can't grind through endgame in a
 * weekend.
 */
export const STUDY_DAYS_BY_TIER: Record<Tier, number> = {
  F:   1,
  E:   3,
  D:   7,
  C:   14,
  B:   30,
  A:   60,
  S:   90,
  SS:  120,
  SSS: 180,
  EX:  360,
}

/**
 * Concurrent study slots a character has, from their INT modifier.
 * INT mod can be negative; minimum 1 slot, maximum 8 (extreme outlier).
 */
export function maxStudySlots(intModifier: number): number {
  return Math.max(1, Math.min(8, intModifier))
}

// ============================================================
// TOOL-TIER HARVEST GATE
// ============================================================

/**
 * Can a tool of `toolTier` harvest a material of `materialTier`?
 * Strict comparison: tool must be ≥ material on the F→EX ladder.
 */
export function canHarvest(toolTier: Tier, materialTier: Tier): boolean {
  return TIER_ORDER.indexOf(toolTier) >= TIER_ORDER.indexOf(materialTier)
}

// ============================================================
// STUDY ENTRY SHAPE — the queue's element
// ============================================================

export const StudyEntrySchema = z.object({
  /** Stable id for the study (assigned at start). */
  studyId: z.string(),
  /** The character running the study (cert id). */
  characterId: z.string(),
  /** The resource being studied (commodity / item lot id). */
  resourceId: z.string(),
  /** Hub where the study is being conducted. */
  hubId: z.string(),
  /** Tier of the resource — drives completion time. */
  resourceTier: TierSchema,
  /** Domain of the resource (e.g. 'flora-wood', 'mining-metal'). */
  domain: z.string().optional(),
  /** World day the study began. */
  startDay: z.number().int().nonnegative(),
  /** World day the study completes (startDay + STUDY_DAYS_BY_TIER[tier]). */
  completionDay: z.number().int().nonnegative(),
  /** Slot index 0..maxSlots-1 — which of the character's slots holds this. */
  slotIndex: z.number().int().nonnegative(),
})
export type StudyEntry = z.infer<typeof StudyEntrySchema>

/**
 * Wire format the engine-client emits to start a study (writeKappa value
 * with system='client-intent:start-study'). Reconstruction reads these
 * from the TPB log.
 */
export const StartStudyValueSchema = z.object({
  studyId: z.string(),
  characterId: z.string(),
  resourceId: z.string(),
  hubId: z.string(),
  resourceTier: TierSchema,
  domain: z.string().optional(),
  startDay: z.number().int().nonnegative(),
  slotIndex: z.number().int().nonnegative(),
})
export type StartStudyValue = z.infer<typeof StartStudyValueSchema>

/** Wire format for completion. */
export const CompleteStudyValueSchema = z.object({
  studyId: z.string(),
  characterId: z.string(),
  worldDay: z.number().int().nonnegative(),
})
export type CompleteStudyValue = z.infer<typeof CompleteStudyValueSchema>

// ============================================================
// QUEUE RECONSTRUCTION — pure compute over TPB actions
// ============================================================

/**
 * Compute a study entry from a `start_study` value + tier-driven completion day.
 */
export function makeStudyEntry(value: StartStudyValue): StudyEntry {
  const days = STUDY_DAYS_BY_TIER[value.resourceTier]
  return {
    studyId: value.studyId,
    characterId: value.characterId,
    resourceId: value.resourceId,
    hubId: value.hubId,
    resourceTier: value.resourceTier,
    domain: value.domain,
    startDay: value.startDay,
    completionDay: value.startDay + days,
    slotIndex: value.slotIndex,
  }
}

/**
 * Reconstruct the live study queue for a character from a list of relevant
 * TPB action values (start + complete pairs).
 *
 * Active = started AND (no matching complete) AND (currentDay < completionDay).
 * Completed-not-yet-claimed = started AND (currentDay ≥ completionDay) AND no complete.
 * Completed = started AND complete present.
 */
export interface StudyQueueState {
  /** Studies in flight (not yet ready). */
  active: StudyEntry[]
  /** Studies whose completionDay has passed but the player hasn't claimed yet. */
  pendingClaim: StudyEntry[]
  /** Studies already completed (have matching complete_study). */
  completed: StudyEntry[]
}

export function computeStudyQueue(
  startActions: StartStudyValue[],
  completeActions: CompleteStudyValue[],
  characterId: string,
  currentDay: number,
): StudyQueueState {
  const completedIds = new Set(
    completeActions.filter((c) => c.characterId === characterId).map((c) => c.studyId),
  )
  const charStarts = startActions.filter((s) => s.characterId === characterId)

  const active: StudyEntry[] = []
  const pendingClaim: StudyEntry[] = []
  const completed: StudyEntry[] = []

  for (const start of charStarts) {
    const entry = makeStudyEntry(start)
    if (completedIds.has(entry.studyId)) {
      completed.push(entry)
    } else if (currentDay >= entry.completionDay) {
      pendingClaim.push(entry)
    } else {
      active.push(entry)
    }
  }

  return { active, pendingClaim, completed }
}

/**
 * Helper: can a character START a new study? Slot must be available.
 * `intModifier` drives the cap. Returns the next free slot index, or null.
 */
export function nextFreeSlot(
  active: StudyEntry[],
  intModifier: number,
): number | null {
  const cap = maxStudySlots(intModifier)
  const used = new Set(active.map((s) => s.slotIndex))
  for (let i = 0; i < cap; i++) {
    if (!used.has(i)) return i
  }
  return null
}

// ============================================================
// CHOP-TREE RESOLVER (tool-gated harvest)
// ============================================================

export const ChopTreeArgsSchema = z.object({
  characterId: z.string(),
  hubId: z.string(),
  treeId: z.string(),
  /** Domain of the wood (e.g. 'flora-wood-oak', 'flora-wood-ironwood'). */
  treeDomain: z.string(),
  treeTier: TierSchema,
  toolItemId: z.string(),
  toolTier: TierSchema,
  worldDay: z.number().int().nonnegative(),
  /** d20 for quality roll. */
  d20: z.number().int().min(1).max(20),
})
export type ChopTreeArgs = z.infer<typeof ChopTreeArgsSchema>

export interface ChopTreeOutcome {
  ok: boolean
  reason?: 'tool_too_weak' | 'invalid_d20'
  /** Quantity of wood logs harvested (0 on failure). */
  logs: {
    resourceId: string
    quantity: number
    quality: 'poor' | 'fair' | 'good' | 'masterwork'
    tier: Tier
  }
  /** Margin by which the tool exceeded the tree tier — drives bonus yield. */
  toolMargin: number
}

/**
 * Resolve a chop-tree action. Pure compute, deterministic given inputs.
 *
 * Yield rules:
 *   - Base yield: 4 logs.
 *   - Tool margin: +1 log per tier above the tree (max +5).
 *   - Quality from d20: 1-5 poor, 6-12 fair, 13-17 good, 18-20 masterwork.
 *   - On failure (tool < tree), no logs harvested.
 */
export function resolveChopTree(args: ChopTreeArgs): ChopTreeOutcome {
  if (!canHarvest(args.toolTier, args.treeTier)) {
    return {
      ok: false,
      reason: 'tool_too_weak',
      logs: { resourceId: args.treeDomain, quantity: 0, quality: 'poor', tier: args.treeTier },
      toolMargin: TIER_ORDER.indexOf(args.toolTier) - TIER_ORDER.indexOf(args.treeTier),
    }
  }
  const margin = TIER_ORDER.indexOf(args.toolTier) - TIER_ORDER.indexOf(args.treeTier)
  const baseYield = 4
  const yieldQty = baseYield + Math.min(5, Math.max(0, margin))

  const quality: ChopTreeOutcome['logs']['quality'] =
    args.d20 <= 5 ? 'poor' : args.d20 <= 12 ? 'fair' : args.d20 <= 17 ? 'good' : 'masterwork'

  return {
    ok: true,
    logs: {
      resourceId: args.treeDomain,
      quantity: yieldQty,
      quality,
      tier: args.treeTier,
    },
    toolMargin: margin,
  }
}

// ============================================================
// STUDY-INITIATION CHECKS
// ============================================================

/**
 * Can a character START studying this resource?
 * Returns the slot index if yes, or a reason string if no.
 */
export function canStartStudy(
  characterId: string,
  active: StudyEntry[],
  intModifier: number,
): { ok: true; slotIndex: number } | { ok: false; reason: 'no_free_slots'; usedSlots: number; cap: number } {
  const cap = maxStudySlots(intModifier)
  const slot = nextFreeSlot(active, intModifier)
  if (slot === null) {
    return { ok: false, reason: 'no_free_slots', usedSlots: active.length, cap }
  }
  return { ok: true, slotIndex: slot }
}

// ============================================================
// TPB ACTION READER — feed computeStudyQueue from a log tail
// ============================================================

/**
 * Wire-format identifiers for study-related writeKappa actions. Public so
 * the engine-client can use the same string in its action producers.
 */
export const STUDY_INTENT_SYSTEMS = {
  start: 'client-intent:start-study',
  complete: 'client-intent:complete-study',
  chop: 'client-intent:chop-tree',
} as const

/**
 * Extract `start_study` and `complete_study` value payloads from a list of
 * TPB actions. The Studies surface uses this on the live TPB tail to drive
 * `computeStudyQueue` without round-tripping to a server endpoint.
 *
 * Malformed entries (missing `value`, schema-mismatched payload) are silently
 * dropped — pre-Phase-2.9 writeKappa actions had no `value` field at all.
 */
export function extractStudyValuesFromActions(
  actions: WorldTPBAction[],
): { starts: StartStudyValue[]; completes: CompleteStudyValue[] } {
  const starts: StartStudyValue[] = []
  const completes: CompleteStudyValue[] = []
  for (const action of actions) {
    if (action.type !== 'writeKappa') continue
    if (action.value === undefined) continue
    if (action.system === STUDY_INTENT_SYSTEMS.start) {
      const parsed = StartStudyValueSchema.safeParse(action.value)
      if (parsed.success) starts.push(parsed.data)
    } else if (action.system === STUDY_INTENT_SYSTEMS.complete) {
      const parsed = CompleteStudyValueSchema.safeParse(action.value)
      if (parsed.success) completes.push(parsed.data)
    }
  }
  return { starts, completes }
}

// ============================================================
// CHOP-TREE RECEIPT — wraps resolveChopTree outcome
// ============================================================

/**
 * Build a forensic Receipt for a chop-tree resolution. Mirrors the pattern
 * of `diceToReceipt` (engine/mf-dice.ts) — the d20, tier comparison, and
 * computed yield are recorded in `verification` so the outcome can be
 * replayed deterministically from the args.
 *
 * Receipt verification rule: `verified === true` iff the resolver ran to
 * completion (either succeeded with logs harvested, or refused for the
 * documented `tool_too_weak` reason). An invalid d20 (`< 1` or `> 20`)
 * means the args were malformed and the receipt is unverifiable.
 */
export function chopTreeToReceipt(
  args: ChopTreeArgs,
  outcome: ChopTreeOutcome,
  tick: number,
): Receipt {
  return {
    mfId: 'resolve_chop_tree',
    tick,
    input: {
      characterId: args.characterId,
      hubId: args.hubId,
      treeId: args.treeId,
      treeDomain: args.treeDomain,
      treeTier: args.treeTier,
      toolItemId: args.toolItemId,
      toolTier: args.toolTier,
      worldDay: args.worldDay,
      d20: args.d20,
    },
    output: outcome,
    verification: {
      d20: args.d20,
      ok: outcome.ok,
      reason: outcome.reason,
      toolMargin: outcome.toolMargin,
      yieldQty: outcome.logs.quantity,
      quality: outcome.logs.quality,
      verified: outcome.reason !== 'invalid_d20',
    },
    timestamp: Date.now(),
  }
}
