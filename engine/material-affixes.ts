/**
 * MATERIAL AFFIXES — Deterministic affix mint for crafted items
 * ================================================================
 *
 * Per `project_build_log_v2.md` slow-life v2 promise:
 *   - Items extend the v1 stub `{resourceId, quantity, quality, tier, rolledOn}`
 *     with `affixes: Affix[]` + optional prefix/suffix names.
 *   - Affixes roll via deterministic seed: (input material lot id, day, maker
 *     cert id). Same input → same affixes, every time.
 *
 * Affix shape:
 *   - kind   = prefix | suffix
 *   - rarity = minor | major | legendary
 *   - effect = mechanical effect (damage bonus, durability multiplier, etc.)
 *
 * The pool is intentionally small for v1. Larger affix pools (per-material,
 * per-recipe-school) can be added without changing the mint contract.
 */

import { z } from 'zod'

export const AffixKindSchema = z.enum(['prefix', 'suffix'])
export type AffixKind = z.infer<typeof AffixKindSchema>

export const AffixRaritySchema = z.enum(['minor', 'major', 'legendary'])
export type AffixRarity = z.infer<typeof AffixRaritySchema>

export const AffixEffectSchema = z.enum([
  'damage_bonus',
  'durability_bonus',
  'weight_reduction',
  'magical_attunement',
  'crit_threat_widen',
  'resistance_grant',
  'speed_bonus',
  'value_premium',
])
export type AffixEffect = z.infer<typeof AffixEffectSchema>

export const AffixSchema = z.object({
  id: z.string(),                    // stable id within the catalog
  kind: AffixKindSchema,
  rarity: AffixRaritySchema,
  effect: AffixEffectSchema,
  /** Numeric magnitude (interpretation depends on effect). */
  magnitude: z.number(),
  /** Human-readable display name fragment (e.g. "Keen", "of Striking"). */
  word: z.string(),
})
export type Affix = z.infer<typeof AffixSchema>

// ============================================================
// AFFIX CATALOG (v1 — kept small)
// ============================================================

export const AFFIX_CATALOG: Affix[] = [
  // Prefixes — typically combat-oriented bonuses
  { id: 'pfx_keen',     kind: 'prefix', rarity: 'minor',     effect: 'crit_threat_widen', magnitude: 1, word: 'Keen' },
  { id: 'pfx_sharp',    kind: 'prefix', rarity: 'minor',     effect: 'damage_bonus',      magnitude: 1, word: 'Sharp' },
  { id: 'pfx_heavy',    kind: 'prefix', rarity: 'minor',     effect: 'damage_bonus',      magnitude: 2, word: 'Heavy' },
  { id: 'pfx_tempered', kind: 'prefix', rarity: 'major',     effect: 'durability_bonus',  magnitude: 50, word: 'Tempered' },
  { id: 'pfx_runic',    kind: 'prefix', rarity: 'major',     effect: 'magical_attunement', magnitude: 1, word: 'Runic' },
  { id: 'pfx_starforged', kind: 'prefix', rarity: 'legendary', effect: 'damage_bonus',  magnitude: 5, word: 'Starforged' },

  // Suffixes — typically utility/handling
  { id: 'sfx_lightness',  kind: 'suffix', rarity: 'minor',     effect: 'weight_reduction', magnitude: 0.25, word: 'of Lightness' },
  { id: 'sfx_swiftness',  kind: 'suffix', rarity: 'minor',     effect: 'speed_bonus',      magnitude: 1, word: 'of Swiftness' },
  { id: 'sfx_striking',   kind: 'suffix', rarity: 'major',     effect: 'damage_bonus',     magnitude: 3, word: 'of Striking' },
  { id: 'sfx_warding',    kind: 'suffix', rarity: 'major',     effect: 'resistance_grant', magnitude: 1, word: 'of Warding' },
  { id: 'sfx_kingsblood', kind: 'suffix', rarity: 'legendary', effect: 'value_premium',    magnitude: 5, word: 'of Kingsblood' },
]

// ============================================================
// DETERMINISTIC SEEDED ROLL
// ============================================================

/**
 * FNV-1a 32-bit hash. Used to mix the affix seed deterministically.
 */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function seededInt(seed: number, max: number): { value: number; nextSeed: number } {
  // mulberry32 step
  let s = (seed + 0x6d2b79f5) >>> 0
  s = Math.imul(s ^ (s >>> 15), s | 1)
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
  const r = ((s ^ (s >>> 14)) >>> 0) / 4294967296
  return { value: Math.floor(r * max), nextSeed: s >>> 0 }
}

export interface AffixMintInput {
  /** ID of the source material / lot (smelting result, ore lot, etc). */
  materialLotId: string
  /** World day the craft happens. */
  worldDay: number
  /** Maker's cert id (so the same craft on the same day yields different rolls per maker). */
  makerCertId: string
  /** Skill bonus (higher = more affixes, better rarities). */
  skillBonus?: number
  /** Tier hint (higher = more affixes). */
  tierBonus?: number
}

export interface AffixMintOutput {
  affixes: Affix[]
  rollSeed: string
  /** Display chain: prefixes first, then suffixes. */
  prefixName?: string
  suffixName?: string
}

/**
 * Mint affixes for a forged item. Deterministic given the input.
 *
 * Rules of thumb:
 *   - Base affix count = 0 (chance) + bias from skill + tier
 *   - Skill bonus 5 → ~50% chance of 1 affix
 *   - Skill bonus 10 + tier ≥ 3 → ~80% chance of 1, 30% chance of a second
 *   - Legendary affixes only roll on tier ≥ 4 + skillBonus ≥ 10
 */
export function mintAffixes(input: AffixMintInput): AffixMintOutput {
  const seedStr = `${input.materialLotId}:${input.worldDay}:${input.makerCertId}`
  let seed = fnv1a(seedStr)

  const skill = input.skillBonus ?? 0
  const tier = input.tierBonus ?? 0
  const affixes: Affix[] = []

  // First affix gate: ~50% at skill≥5, scaling
  let r = seededInt(seed, 100)
  seed = r.nextSeed
  const firstThreshold = Math.max(0, 75 - skill * 5 - tier * 5)
  if (r.value >= firstThreshold) {
    affixes.push(pickAffix(seed, skill, tier))
    seed = (seed + 0x9e3779b9) >>> 0
  }

  // Second affix gate: stricter, only fires at higher skill+tier
  r = seededInt(seed, 100)
  seed = r.nextSeed
  const secondThreshold = Math.max(0, 95 - skill * 4 - tier * 4)
  if (r.value >= secondThreshold) {
    const next = pickAffix(seed, skill, tier)
    // Avoid duplicate of the first affix's word
    if (!affixes.find((a) => a.word === next.word)) {
      affixes.push(next)
    }
  }

  const prefixes = affixes.filter((a) => a.kind === 'prefix')
  const suffixes = affixes.filter((a) => a.kind === 'suffix')
  return {
    affixes,
    rollSeed: seedStr,
    prefixName: prefixes.length > 0 ? prefixes.map((a) => a.word).join(' ') : undefined,
    suffixName: suffixes.length > 0 ? suffixes.map((a) => a.word).join(' ') : undefined,
  }
}

function pickAffix(seed: number, skill: number, tier: number): Affix {
  // Rarity gating: legendary only at tier ≥ 4 + skill ≥ 10
  const allowLegendary = tier >= 4 && skill >= 10
  const allowMajor = tier >= 2 || skill >= 5
  const pool = AFFIX_CATALOG.filter((a) => {
    if (a.rarity === 'legendary' && !allowLegendary) return false
    if (a.rarity === 'major' && !allowMajor) return false
    return true
  })
  const r = seededInt(seed, pool.length)
  return pool[r.value]
}

/**
 * Display: combine prefix + base name + suffix.
 *   "Keen Iron Sword of Striking" given baseName="Iron Sword".
 */
export function displayItemName(
  baseName: string,
  prefixName: string | undefined,
  suffixName: string | undefined,
): string {
  const parts: string[] = []
  if (prefixName) parts.push(prefixName)
  parts.push(baseName)
  if (suffixName) parts.push(suffixName)
  return parts.join(' ')
}
