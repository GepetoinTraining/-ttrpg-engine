/**
 * UNIVERSAL TIER — The F → EX Power Scale
 * ==========================================
 *
 * A single tier scale applied across ALL graded entities in the engine:
 * deposits, items, monsters, dungeons, characters, factions.
 *
 * Replaces D&D's CR/level system as the canonical "how grand is this thing"
 * axis. D&D level still exists for character mechanics (HP / spell slots /
 * saves), but Tier is what the engine uses to gate access, calculate
 * difficulty, and scale rewards.
 *
 * Why F → EX?
 *   - 10 steps gives finer granularity than CR's 0–30 lump
 *   - Solo Leveling / isekai pop-culture readability
 *   - Same scale spans goblin (F) → ancient red dragon (S+)
 *   - EX is reserved for "this shouldn't exist"
 *
 * The order is fixed. Every comparison uses TIER_ORDER index.
 */

import { z } from 'zod'

export const TierSchema = z.enum([
  'F',    // Trash mob, broken tools, surface scrap
  'E',    // Common, expected at low levels
  'D',    // Standard threat, journeyman tier
  'C',    // Notable, regional
  'B',    // Veteran, kingdom-level
  'A',    // Elite, continental
  'S',    // Legendary, world-changing
  'SS',   // Mythic, multi-legendary
  'SSS',  // Demigod, paradox-tier
  'EX',   // Above the scale entirely
])
export type Tier = z.infer<typeof TierSchema>

export const TIER_ORDER: Tier[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX']

/**
 * Numeric multiplier applied to "power" (yield, damage, IP, etc).
 * Geometric so the gap between tiers grows.
 */
export const TIER_MULTIPLIERS: Record<Tier, number> = {
  F:   1.0,
  E:   1.4,
  D:   2.0,
  C:   2.8,
  B:   4.0,
  A:   5.6,
  S:   8.0,
  SS:  12.0,
  SSS: 18.0,
  EX:  30.0,
}

/** Compare two tiers. Returns -1 / 0 / 1. */
export function compareTier(a: Tier, b: Tier): -1 | 0 | 1 {
  const ai = TIER_ORDER.indexOf(a)
  const bi = TIER_ORDER.indexOf(b)
  if (ai < bi) return -1
  if (ai > bi) return 1
  return 0
}

export function tierAtLeast(actual: Tier, required: Tier): boolean {
  return compareTier(actual, required) >= 0
}

/** Step up by N positions, clamped at EX. */
export function tierUp(tier: Tier, steps: number = 1): Tier {
  const idx = Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(tier) + steps)
  return TIER_ORDER[idx]
}

/** Step down by N positions, clamped at F. */
export function tierDown(tier: Tier, steps: number = 1): Tier {
  const idx = Math.max(0, TIER_ORDER.indexOf(tier) - steps)
  return TIER_ORDER[idx]
}

/**
 * Map a 5e-style CR (challenge rating) onto Tier for legacy-monster import.
 * Approximate; finer adjustments belong on individual stat blocks.
 */
export function tierFromCR(cr: number): Tier {
  if (cr <= 0.25) return 'F'
  if (cr <= 1)    return 'E'
  if (cr <= 4)    return 'D'
  if (cr <= 8)    return 'C'
  if (cr <= 12)   return 'B'
  if (cr <= 17)   return 'A'
  if (cr <= 24)   return 'S'
  if (cr <= 28)   return 'SS'
  if (cr <= 30)   return 'SSS'
  return 'EX'
}

/**
 * Map an adventurer level (D&D PC level 1–20) onto Tier.
 * Used by the guild orb-of-revelation. Mirrors the existing
 * guild-receptionist.calculateTrueRank but as the canonical mapping.
 */
export function tierFromLevel(level: number): Tier {
  if (level <= 1)  return 'F'
  if (level <= 3)  return 'E'
  if (level <= 5)  return 'D'
  if (level <= 8)  return 'C'
  if (level <= 11) return 'B'
  if (level <= 14) return 'A'
  if (level <= 17) return 'S'
  if (level <= 19) return 'SS'
  if (level === 20) return 'SSS'
  return 'EX'
}
