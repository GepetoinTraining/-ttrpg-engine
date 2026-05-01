/**
 * MF — Craft + Discover
 * ========================
 *
 * Atomic transformations for Δ.5 tool production. Pure, deterministic.
 *
 * Two MFs:
 *   - mfCraftBasic:    skill check against an archetype's base recipe;
 *                      success produces a `DerivedTool` with the base slots
 *                      filled, no derivations
 *   - mfCraftDiscover: applies a derivation hook (e.g. 'ecology-study-trout')
 *                      to an archetype, producing a `DerivedTool` with
 *                      additional derived slots; deterministic from seed
 *
 * Caller (slot-push consumer / future /api/crafting/discover route) takes
 * the receipt and emits a `writeKappa` action with `system='client-intent:
 * craft-discover:<certId>'` per the proposal.
 */

import {
  type Slot,
  type Affix,
  type DerivedTool,
  type ToolArchetype,
  type ArchetypePurpose,
  getArchetype,
  deriveSlots,
} from './tool-archetypes.js'
import { SeededRNG } from './hub-topology.js'

// ============================================================
// CONTEXT + RECEIPT
// ============================================================

export interface CraftContext {
  /** d20 roll. */
  d20: number
  /** Mod for the archetype's required skill. */
  skillModifier: number
  /** Tool / workspace bonus (e.g. forge, workshop). */
  toolBonus?: number
  /** Stable seed key — typically `${certId}:${worldDay}`. Drives id + RNG. */
  seedKey: string
}

export interface CraftReceipt {
  purpose: ArchetypePurpose
  baseDC: number
  effectiveDC: number
  d20: number
  total: number
  success: boolean
  margin: number
}

// ============================================================
// HELPERS
// ============================================================

function effectiveDCFor(arch: ToolArchetype, derivationCount: number): number {
  // Each derived slot adds +2 DC over the base recipe.
  return arch.skillReq.dc + derivationCount * 2
}

function statsFromArchetype(
  arch: ToolArchetype,
  affixes: Affix[],
  derivationCount: number,
): { durability: number; efficiency: number } {
  const affixBonus = affixes.reduce((sum, a) => sum + a.bonus, 0)
  return {
    durability: Math.max(1, arch.baseStats.durability + Math.floor(derivationCount / 2)),
    efficiency: Math.max(0, arch.baseStats.efficiency + affixBonus + derivationCount * 0.25),
  }
}

function generateId(purpose: ArchetypePurpose, seedKey: string, suffix: string): string {
  const rng = new SeededRNG(`${purpose}:${seedKey}:${suffix}`)
  const hex = Math.floor(rng.next() * 0xffff_ffff)
    .toString(16)
    .padStart(8, '0')
  return `${purpose}-${hex}`
}

// ============================================================
// MF — BASIC CRAFT
// ============================================================

export interface CraftBasicOutput {
  /** The crafted tool, or null on failure. */
  tool: DerivedTool | null
}

/**
 * Craft an archetype with its base slots. No derivation hooks fired.
 * Skill check against the archetype's base DC. On success the tool is
 * stamped with base slots only, baseline stats.
 */
export function mfCraftBasic(
  purpose: ArchetypePurpose,
  ctx: CraftContext,
): { output: CraftBasicOutput; receipt: CraftReceipt } {
  const arch = getArchetype(purpose)
  const baseDC = arch.skillReq.dc
  const effectiveDC = effectiveDCFor(arch, 0)
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC

  let tool: DerivedTool | null = null
  if (success) {
    tool = {
      id: generateId(purpose, ctx.seedKey, 'basic'),
      purpose,
      filledSlots: arch.baseSlots.map((s) => ({ ...s })),
      affixes: [],
      stats: statsFromArchetype(arch, [], 0),
      recipeSource: 'basic',
    }
  }

  return {
    output: { tool },
    receipt: { purpose, baseDC, effectiveDC, d20, total, success, margin },
  }
}

// ============================================================
// MF — DERIVATION DISCOVERY
// ============================================================

export interface CraftDiscoverContext extends CraftContext {
  /** Derivation hook id, e.g. 'aquatic-study-trout'. */
  trigger: string
  /** Caller's current knowledge tier on the trigger subject (0-3). */
  tier: number
}

export interface CraftDiscoverOutput {
  /** The discovered tool with derived slots, or null on failure. */
  tool: DerivedTool | null
  /** The slots that were freshly derived this craft (for lore-bag / UI). */
  newlyDerivedSlots: Slot[]
}

/**
 * Apply a derivation hook to an archetype. The seed key (certId+worldDay)
 * + trigger + tier deterministically picks 1-2 derived slots from the
 * derivation pool. DC scales with derivation count.
 *
 * Failure produces no tool — but the caller can record the attempt as
 * a knowledge-tier hint via the standard writeKappa channel.
 */
export function mfCraftDiscover(
  purpose: ArchetypePurpose,
  ctx: CraftDiscoverContext,
): { output: CraftDiscoverOutput; receipt: CraftReceipt } {
  const arch = getArchetype(purpose)

  // Reject triggers the archetype doesn't accept.
  if (!arch.derivationHooks.includes(ctx.trigger)) {
    throw new Error(
      `mfCraftDiscover: archetype '${purpose}' does not accept trigger '${ctx.trigger}'`,
    )
  }

  const newSlots = deriveSlots({ trigger: ctx.trigger, seedKey: ctx.seedKey, tier: ctx.tier })
  const baseDC = arch.skillReq.dc
  const effectiveDC = effectiveDCFor(arch, newSlots.length)
  const d20 = Math.max(1, Math.min(20, Math.floor(ctx.d20)))
  const total = d20 + ctx.skillModifier + (ctx.toolBonus ?? 0)
  const success = total >= effectiveDC
  const margin = total - effectiveDC

  let tool: DerivedTool | null = null
  if (success) {
    tool = {
      id: generateId(purpose, ctx.seedKey, ctx.trigger),
      purpose,
      filledSlots: [...arch.baseSlots.map((s) => ({ ...s })), ...newSlots],
      affixes: [],
      stats: statsFromArchetype(arch, [], newSlots.length),
      recipeSource: ctx.trigger,
    }
  }

  return {
    output: {
      tool,
      newlyDerivedSlots: success ? newSlots : [],
    },
    receipt: { purpose, baseDC, effectiveDC, d20, total, success, margin },
  }
}
