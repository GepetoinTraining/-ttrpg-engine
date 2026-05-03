/**
 * TECHNOLOGY WEB — tiered tech progression spine
 * =================================================
 *
 * Per `docs/to-be implemented/technology-web-mm.md`. Models tech advancement
 * as a tier ladder (F → EX, 10 steps) using the canonical `Tier` from
 * `engine/tier.ts` (the same scale used by deposits, monsters, adventurer
 * ranks, and dungeons). Each blob:
 *   - belongs to a `(purpose, tier)` pair
 *   - declares slots (grows over tiers: F=1-2 → EX cumulative ≤ 20)
 *   - declares dependencies on lower-tier purposes
 *   - carries hints for NPC craftsmen in hubs
 *
 * Pure types + tier-DC table + helpers + a tiny seed catalog (only the F+E
 * tiers for fishing/mining as proof of concept). Phase 1 doesn't build the
 * MM (`mm-technology-web`); that's Phase 2.
 *
 * The MF (`mf-study-tech.ts`) consumes a blob + a study trigger and produces
 * an expanded blob — the runtime "unlock" — which the caller persists via
 * the standard `writeKappa` channel.
 */

import { z } from 'zod'
import { TierSchema, TIER_ORDER, type Tier } from './tier'

// ============================================================
// TIER LADDER — re-uses the canonical 10-step Tier scale
// ============================================================

/**
 * DC modifier per tier — base study check. Monotonic across all 10 tiers,
 * ramped from 5 (F) to 30 (EX). Caller adds +2 per unmet dependency in the
 * MF, so the post-dep DC can exceed 30 in heavily-blocked configurations.
 */
export const TECH_TIER_DC: Record<Tier, number> = {
  F:   5,
  E:   8,
  D:   12,
  C:   15,
  B:   18,
  A:   21,
  S:   24,
  SS:  26,
  SSS: 28,
  EX:  30,
}

/** Successor in TIER_ORDER, or null if at EX. */
export function nextTier(t: Tier): Tier | null {
  const i = TIER_ORDER.indexOf(t)
  if (i < 0 || i >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[i + 1]
}

// ============================================================
// SLOT (parallels tool-archetypes.Slot, kept independent here so the
// tech-web module doesn't import from tool-archetypes — they're peers
// that share string-keyed material domains)
// ============================================================

export const TechSlotSchema = z.object({
  name: z.string().min(1),
  materialDomains: z.array(z.string()).min(1),
  quantity: z.number().int().min(1).max(50),
  derived: z.boolean().default(false),
  affixes: z.array(z.string()).default([]),
})
export type TechSlot = z.infer<typeof TechSlotSchema>

// ============================================================
// DEPENDENCY — what a tier blob requires from earlier ones
// ============================================================

export const TechDependencySchema = z.object({
  /** What this dep is a requirement for (e.g. 'metal-gears'). */
  req: z.string().min(1),
  /** Tier:purpose this dep needs (e.g. 'B-smithing'). */
  fromTier: z.string().min(1),
  /** Optional gating trigger that lets you check it off. */
  unlockedBy: z.string().optional(),
})
export type TechDependency = z.infer<typeof TechDependencySchema>

// ============================================================
// BLOB — the per-tier per-purpose schema
// ============================================================

export const TechBlobSchema = z.object({
  /** `${purpose}-${tier}`. */
  id: z.string().min(1),
  /** What this is a tech for (e.g. 'fishing-tool', 'mining-tool'). */
  purpose: z.string().min(1),
  tier: TierSchema,
  /**
   * Slot budget cap = 20. Cumulative growth from F→EX adds at most ~15
   * slots on top of the baseline; EX-tier blobs can run up to ~17-20.
   */
  slots: z.array(TechSlotSchema).min(1).max(20),
  dependencies: z.array(TechDependencySchema).default([]),
  baseStats: z.object({
    efficiency: z.number().min(0).max(10),
    durability: z.number().int().min(1).max(20),
  }),
  unlockDC: z.number().int().min(5).max(40),
  /** Free-form hints emitted to NPC craftsmen on unlock. */
  hints: z.array(z.string()).default([]),
  jsonVersion: z.number().int().min(1).default(1),
})
export type TechBlob = z.infer<typeof TechBlobSchema>

// ============================================================
// SEED CATALOG — F + E baseline blobs
// ============================================================

export const TECH_SEED_BLOBS: TechBlob[] = [
  {
    id: 'fishing-tool-F',
    purpose: 'fishing-tool',
    tier: 'F',
    slots: [
      { name: 'hand-line', materialDomains: ['fauna-sinew'], quantity: 1, derived: false, affixes: [] },
    ],
    dependencies: [],
    baseStats: { efficiency: 0.5, durability: 2 },
    unlockDC: TECH_TIER_DC.F,
    hints: [],
    jsonVersion: 1,
  },
  {
    id: 'fishing-tool-E',
    purpose: 'fishing-tool',
    tier: 'E',
    slots: [
      { name: 'hand-line', materialDomains: ['fauna-sinew'], quantity: 1, derived: false, affixes: [] },
      { name: 'hook', materialDomains: ['mining-stone', 'fauna-bone'], quantity: 1, derived: false, affixes: [] },
    ],
    dependencies: [
      { req: 'basic-stone-shaping', fromTier: 'F-mining', unlockedBy: 'mine-dig-iron' },
    ],
    baseStats: { efficiency: 1, durability: 3 },
    unlockDC: TECH_TIER_DC.E,
    hints: ['gatherer: try river stones for hooks'],
    jsonVersion: 1,
  },
  {
    id: 'mining-tool-F',
    purpose: 'mining-tool',
    tier: 'F',
    slots: [
      { name: 'pick-stone', materialDomains: ['mining-stone'], quantity: 1, derived: false, affixes: [] },
    ],
    dependencies: [],
    baseStats: { efficiency: 0.5, durability: 2 },
    unlockDC: TECH_TIER_DC.F,
    hints: [],
    jsonVersion: 1,
  },
]

export function getSeedBlob(purpose: string, tier: Tier): TechBlob | undefined {
  return TECH_SEED_BLOBS.find((b) => b.purpose === purpose && b.tier === tier)
}

// ============================================================
// HINT GENERATION — what a successful study tells NPC craftsmen
// ============================================================

export function generateHubHints(blob: TechBlob): string[] {
  const lines: string[] = []
  for (const d of blob.dependencies) {
    lines.push(`craftsman-need:${d.req} from ${d.fromTier}`)
  }
  if (blob.tier !== 'F') {
    lines.push(`tier-unlocked:${blob.purpose}:${blob.tier}`)
  }
  return [...lines, ...blob.hints]
}
