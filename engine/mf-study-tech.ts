/**
 * MF — Study Tech
 * ====================
 *
 * Atomic transformation that drives tier progression along the canonical
 * 10-step `Tier` ladder (F → EX, from `engine/tier.ts`). A successful study
 * expands a `TechBlob`'s slot set deterministically (seeded by trigger +
 * worldDay + certId), generates fresh hub hints, and bumps the recorded
 * tier. Pure, no DB.
 *
 * Per Theorem 1: forward pass produces O (the new blob) AND R (the receipt).
 *
 * Caller persists via `writeKappa` with `system='client-intent:study-tech:
 * <certId>'` per the proposal — no new TPB variant needed.
 */

import {
  type TechBlob,
  type TechSlot,
  TECH_TIER_DC,
  nextTier,
  generateHubHints,
} from './technology-web.js'
import { type Tier } from './tier.js'
import { SeededRNG } from './hub-topology.js'

// ============================================================
// CONTEXT + RECEIPT
// ============================================================

export interface StudyTechContext {
  /** d20 roll. */
  d20: number
  /** Player's relevant skill modifier. */
  skillModifier: number
  /** Tool or workspace bonus. */
  toolBonus?: number
  /** Stable seed key — typically `${certId}:${worldDay}`. */
  seedKey: string
  /** How many of the blob's dependencies are NOT yet satisfied in the current world. */
  unmetDependencyCount?: number
}

export interface StudyTechReceipt {
  purpose: string
  fromTier: Tier
  targetTier: Tier
  baseDC: number
  effectiveDC: number
  d20: number
  total: number
  success: boolean
  margin: number
  unmetDependencyCount: number
}

export interface StudyTechOutput {
  /** The expanded blob, or null on failure. */
  blob: TechBlob | null
  /** New slots added vs the prior blob (for UI / lore-bag). */
  addedSlots: TechSlot[]
  /** Hub-level hints emitted by this unlock, picked up by craftsman MMs. */
  hubHints: string[]
}

// ============================================================
// SLOT EXPANSION POOL — Phase 1 starter set
// ============================================================

const TIER_EXPANSION_POOL: Record<string, TechSlot[]> = {
  'fishing-tool': [
    { name: 'hook', materialDomains: ['mining-stone', 'fauna-bone'], quantity: 1, derived: true, affixes: [] },
    { name: 'rod-handle', materialDomains: ['flora-wood', 'flora-bamboo'], quantity: 1, derived: true, affixes: [] },
    { name: 'net-attachment', materialDomains: ['flora-fiber'], quantity: 3, derived: true, affixes: [] },
    { name: 'reel', materialDomains: ['mining-metal', 'precision-craft'], quantity: 1, derived: true, affixes: [] },
    { name: 'lure', materialDomains: ['fauna-feather', 'aquatic-scale'], quantity: 2, derived: true, affixes: [] },
    { name: 'leader-line', materialDomains: ['fauna-sinew'], quantity: 1, derived: true, affixes: [] },
    { name: 'composite-rod', materialDomains: ['flora-bamboo', 'mining-metal'], quantity: 1, derived: true, affixes: ['stream-tuned'] },
    { name: 'fly-tying-vise', materialDomains: ['mining-metal', 'precision-craft'], quantity: 1, derived: true, affixes: [] },
    { name: 'micro-fly-set', materialDomains: ['fauna-feather'], quantity: 5, derived: true, affixes: ['kebari'] },
  ],
  'mining-tool': [
    { name: 'pick-iron', materialDomains: ['mining-metal'], quantity: 1, derived: true, affixes: [] },
    { name: 'shaft-reinforced', materialDomains: ['flora-wood', 'mining-metal'], quantity: 1, derived: true, affixes: [] },
    { name: 'precision-chisel', materialDomains: ['precision-craft'], quantity: 1, derived: true, affixes: [] },
    { name: 'blast-charge', materialDomains: ['mining-metal', 'flora-fiber'], quantity: 1, derived: true, affixes: ['controlled'] },
    { name: 'tunnel-brace', materialDomains: ['flora-wood', 'mining-metal'], quantity: 2, derived: true, affixes: [] },
  ],
}

/**
 * How many slots are added at each tier. Cumulative budget keeps EX-tier
 * blobs under the 20-slot schema cap (baseline F is 1-2 slots).
 *
 *   F  → 0  (baseline, no growth)
 *   E  → 1
 *   D  → 1
 *   C  → 1
 *   B  → 1
 *   A  → 2
 *   S  → 2
 *   SS → 2
 *   SSS→ 2
 *   EX → 3
 *  cumulative growth = 15 → with F=1 baseline, EX caps at 16 slots
 */
const TIER_SLOT_GROWTH: Record<Tier, number> = {
  F:   0,
  E:   1,
  D:   1,
  C:   1,
  B:   1,
  A:   2,
  S:   2,
  SS:  2,
  SSS: 2,
  EX:  3,
}

import { TIER_ORDER } from './tier.js'

function buildExpandedBlob(
  prior: TechBlob,
  target: Tier,
  seedKey: string,
): { newSlots: TechSlot[]; expanded: TechBlob } {
  const pool = TIER_EXPANSION_POOL[prior.purpose] ?? []
  const want = TIER_SLOT_GROWTH[target]
  const rng = new SeededRNG(`${prior.purpose}:${target}:${seedKey}`)
  // Filter out slots already present in the prior blob (by name).
  const existingNames = new Set(prior.slots.map((s) => s.name))
  const eligible = pool.filter((s) => !existingNames.has(s.name))
  const shuffled = rng.shuffle(eligible)
  const newSlots = shuffled.slice(0, Math.min(want, eligible.length))

  // Stat scaling — each tier climbed bumps efficiency + durability.
  const tierIdx = TIER_ORDER.indexOf(target)
  const fromIdx = TIER_ORDER.indexOf(prior.tier)
  const tiersClimbed = Math.max(1, tierIdx - fromIdx)

  const expanded: TechBlob = {
    id: `${prior.purpose}-${target}`,
    purpose: prior.purpose,
    tier: target,
    slots: [...prior.slots, ...newSlots],
    dependencies: prior.dependencies, // Phase 1: keep prior deps; Phase 2 derives new ones
    baseStats: {
      efficiency: prior.baseStats.efficiency + 0.5 * tiersClimbed,
      durability: prior.baseStats.durability + tiersClimbed,
    },
    unlockDC: TECH_TIER_DC[target],
    hints: [...prior.hints],
    jsonVersion: prior.jsonVersion,
  }
  return { newSlots, expanded }
}

// ============================================================
// MF — STUDY TECH
// ============================================================

export function mfStudyTech(
  prior: TechBlob,
  ctx: StudyTechContext,
): { output: StudyTechOutput; receipt: StudyTechReceipt } {
  const target = nextTier(prior.tier)
  if (!target) {
    // Already at EX — study cannot push further.
    return {
      output: { blob: null, addedSlots: [], hubHints: [] },
      receipt: {
        purpose: prior.purpose,
        fromTier: prior.tier,
        targetTier: prior.tier,
        baseDC: TECH_TIER_DC[prior.tier],
        effectiveDC: TECH_TIER_DC[prior.tier],
        d20: ctx.d20,
        total: 0,
        success: false,
        margin: 0,
        unmetDependencyCount: ctx.unmetDependencyCount ?? 0,
      },
    }
  }

  const baseDC = TECH_TIER_DC[target]
  const unmet = Math.max(0, ctx.unmetDependencyCount ?? 0)
  const effectiveDC = baseDC + unmet * 2

  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC

  if (!success) {
    return {
      output: {
        blob: null,
        addedSlots: [],
        hubHints: [`craftsman-stuck:${prior.purpose}:${target}`],
      },
      receipt: {
        purpose: prior.purpose,
        fromTier: prior.tier,
        targetTier: target,
        baseDC,
        effectiveDC,
        d20,
        total,
        success,
        margin,
        unmetDependencyCount: unmet,
      },
    }
  }

  const { newSlots, expanded } = buildExpandedBlob(prior, target, ctx.seedKey)
  const hubHints = generateHubHints(expanded)

  return {
    output: { blob: expanded, addedSlots: newSlots, hubHints },
    receipt: {
      purpose: prior.purpose,
      fromTier: prior.tier,
      targetTier: target,
      baseDC,
      effectiveDC,
      d20,
      total,
      success,
      margin,
      unmetDependencyCount: unmet,
    },
  }
}

// Re-export tier-DC table for convenience
export { TECH_TIER_DC, nextTier }
