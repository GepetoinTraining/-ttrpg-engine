/**
 * TOOL ARCHETYPES — runtime-derived crafting primitives
 * ========================================================
 *
 * Per `docs/to-be implemented/tool-production-chain.md`. Tools are NOT
 * a static enum. We define five abstract archetypes (Striking, Cutting,
 * Gathering, Precision, Kit) with abstract component slots; specific tools
 * (e.g. tenkara fly-fishing kit) emerge from runtime derivations seeded
 * by player studies + materials.
 *
 * Pure types + the 5 baseline archetypes + slot-derivation helper. No DB.
 * The derivation MF (`mf-craft.ts`) consumes these and produces `DerivedTool`
 * instances; persistence is via the standard `writeKappa` action with
 * `system='client-intent:craft-discover:<certId>'`.
 *
 * Δ.5 Phase 1 = static archetypes + derivation helper. Phase 2 will wire
 * the API (`/api/crafting/discover`) and link study triggers from Δ.1/Δ.2.
 */

import { z } from 'zod'
import { SeededRNG } from './hub-topology'

// ============================================================
// MATERIAL DOMAIN — where a slot pulls from
// ============================================================
//
// Material domains tie tool slots to upstream material sources:
//   - flora-* / fauna-* / fungi-* / moss-*  → Δ.1 ecology
//   - mining-*                              → Δ.4 mining
//   - aquatic-*                             → Δ.3 aquatic
//   - precision-craft                       → recursive (precision tool feeds another)
export const MaterialDomainSchema = z.enum([
  'flora-wood',
  'flora-fiber',
  'flora-bamboo',
  'fauna-bone',
  'fauna-sinew',
  'fauna-hide',
  'fauna-feather',
  'fungi-cap',
  'moss-fiber',
  'mining-stone',
  'mining-metal',
  'mining-gem',
  'aquatic-shell',
  'aquatic-scale',
  'precision-craft',
])
export type MaterialDomain = z.infer<typeof MaterialDomainSchema>

// ============================================================
// SLOT — one component of a tool
// ============================================================

export const SlotSchema = z.object({
  /** e.g. 'handle', 'tip', 'lure', 'reel'. */
  name: z.string().min(1),
  /** Acceptable material domains for this slot. */
  materialDomains: z.array(MaterialDomainSchema).min(1),
  /** Number of unit-materials this slot needs. */
  quantity: z.number().int().min(1).max(50),
  /** Modular = sub-slots/affixes can be attached. */
  modular: z.boolean().default(false),
  /** Derived = filled at runtime from a discovery, not declared in archetype. */
  derived: z.boolean().default(false),
})
export type Slot = z.infer<typeof SlotSchema>

// ============================================================
// AFFIX — discovered modifier on a slot
// ============================================================

export const AffixSchema = z.object({
  name: z.string().min(1),
  /** Tag this affix attaches to (e.g. 'weighted', 'stream-tuned'). */
  tag: z.string().min(1),
  /** Numeric efficiency / durability bonus. */
  bonus: z.number().min(-1).max(2),
})
export type Affix = z.infer<typeof AffixSchema>

// ============================================================
// SKILL REQUIREMENT
// ============================================================

export const ToolSkillSchema = z.enum([
  'survival',
  'herbalism',
  'tracking',
  'mining',
  'smithing',
  'carpentry',
  'precision',
])
export type ToolSkill = z.infer<typeof ToolSkillSchema>

// ============================================================
// ARCHETYPE — the five abstract bases
// ============================================================

export const ArchetypePurposeSchema = z.enum([
  'gathering-aquatic',
  'gathering-flora',
  'striking-mine',
  'cutting-flora',
  'precision-craft',
  'kit-study',
])
export type ArchetypePurpose = z.infer<typeof ArchetypePurposeSchema>

export const ToolArchetypeSchema = z.object({
  purpose: ArchetypePurposeSchema,
  baseSlots: z.array(SlotSchema).min(1).max(8),
  baseStats: z.object({
    durability: z.number().int().min(1).max(10),
    efficiency: z.number().min(0).max(5),
  }),
  skillReq: z.object({
    skill: ToolSkillSchema,
    dc: z.number().int().min(5).max(30),
  }),
  /** Triggers that can extend this archetype with derived slots. */
  derivationHooks: z.array(z.string()).default([]),
})
export type ToolArchetype = z.infer<typeof ToolArchetypeSchema>

// ============================================================
// DERIVED TOOL — the runtime instance
// ============================================================

export const DerivedToolSchema = z.object({
  /** Generated id: `${purpose}-${seedHash}` */
  id: z.string().min(1),
  purpose: ArchetypePurposeSchema,
  /** Base slots + any derived ones. */
  filledSlots: z.array(SlotSchema),
  /** Affix list (may be empty). */
  affixes: z.array(AffixSchema).default([]),
  /** Computed stats after slots + affixes. */
  stats: z.object({
    durability: z.number().int().min(1),
    efficiency: z.number().min(0),
  }),
  /** Trigger that produced this derivation, if any (e.g. 'ecology-study-trout'). */
  recipeSource: z.string().optional(),
})
export type DerivedTool = z.infer<typeof DerivedToolSchema>

// ============================================================
// THE FIVE BASELINE ARCHETYPES
// ============================================================

export const TOOL_ARCHETYPES: Record<ArchetypePurpose, ToolArchetype> = {
  'gathering-aquatic': {
    purpose: 'gathering-aquatic',
    baseSlots: [
      { name: 'rod', materialDomains: ['flora-wood', 'flora-bamboo'], quantity: 1, modular: true, derived: false },
      { name: 'line', materialDomains: ['fauna-sinew', 'flora-fiber'], quantity: 2, modular: false, derived: false },
      { name: 'hook', materialDomains: ['fauna-bone', 'mining-metal'], quantity: 1, modular: true, derived: false },
    ],
    baseStats: { durability: 3, efficiency: 1 },
    skillReq: { skill: 'survival', dc: 10 },
    derivationHooks: ['ecology-study-fish', 'aquatic-study-trout', 'aquatic-study-salmon'],
  },
  'gathering-flora': {
    purpose: 'gathering-flora',
    baseSlots: [
      { name: 'shears-blade', materialDomains: ['mining-metal', 'mining-stone'], quantity: 1, modular: false, derived: false },
      { name: 'grip', materialDomains: ['flora-wood', 'fauna-hide'], quantity: 1, modular: false, derived: false },
    ],
    baseStats: { durability: 4, efficiency: 1 },
    skillReq: { skill: 'herbalism', dc: 11 },
    derivationHooks: ['ecology-study-flora', 'ecology-study-fungi'],
  },
  'striking-mine': {
    purpose: 'striking-mine',
    baseSlots: [
      { name: 'shaft', materialDomains: ['flora-wood'], quantity: 1, modular: false, derived: false },
      { name: 'head', materialDomains: ['mining-stone', 'mining-metal'], quantity: 1, modular: true, derived: false },
    ],
    baseStats: { durability: 4, efficiency: 1 },
    skillReq: { skill: 'mining', dc: 12 },
    derivationHooks: ['mine-dig-iron', 'mine-dig-gem', 'mine-reveal-deep'],
  },
  'cutting-flora': {
    purpose: 'cutting-flora',
    baseSlots: [
      { name: 'blade', materialDomains: ['mining-stone', 'mining-metal'], quantity: 1, modular: true, derived: false },
      { name: 'handle', materialDomains: ['fauna-bone', 'flora-wood'], quantity: 1, modular: false, derived: false },
    ],
    baseStats: { durability: 5, efficiency: 1 },
    skillReq: { skill: 'carpentry', dc: 11 },
    derivationHooks: ['ecology-harvest-wood', 'mine-reveal-quarry'],
  },
  'precision-craft': {
    purpose: 'precision-craft',
    baseSlots: [
      { name: 'tip', materialDomains: ['mining-metal', 'mining-gem'], quantity: 1, modular: true, derived: false },
      { name: 'grip', materialDomains: ['flora-fiber', 'fauna-sinew'], quantity: 1, modular: false, derived: false },
    ],
    baseStats: { durability: 2, efficiency: 2 },
    skillReq: { skill: 'precision', dc: 13 },
    derivationHooks: ['craft-affix', 'study-engineering'],
  },
  'kit-study': {
    purpose: 'kit-study',
    baseSlots: [
      { name: 'container', materialDomains: ['fauna-hide', 'flora-fiber'], quantity: 1, modular: false, derived: false },
      { name: 'tools', materialDomains: ['precision-craft'], quantity: 2, modular: true, derived: true },
    ],
    baseStats: { durability: 6, efficiency: 1 },
    skillReq: { skill: 'survival', dc: 8 },
    derivationHooks: ['ecology-study', 'aquatic-study'],
  },
}

export function getArchetype(purpose: ArchetypePurpose): ToolArchetype {
  return TOOL_ARCHETYPES[purpose]
}

// ============================================================
// SLOT DERIVATION — the runtime extension primitive
// ============================================================

/**
 * Derive 1-3 new slots for an archetype based on a study/dig trigger,
 * deterministic from the seed string. Used by `mfCraft` when a derivation
 * hook fires.
 *
 * The slot names + material domains are picked from a small pool keyed on
 * the trigger purpose. Phase 1 keeps the pool tiny — Phase 2/3 expands as
 * Δ.1/Δ.2/Δ.3/Δ.4 land their study triggers.
 */
export interface DerivationSeed {
  /** e.g. `'ecology-study-trout'`, `'mine-dig-iron'`. */
  trigger: string
  /** worldDay + certId concat, used to seed the RNG. */
  seedKey: string
  /** Caller's current knowledge tier on the trigger subject (0-3). */
  tier: number
}

const DERIVATION_POOL: Record<string, Slot[]> = {
  // Aquatic studies expand the gathering-aquatic archetype with lures + reels.
  'aquatic-study-trout': [
    { name: 'fly-lure', materialDomains: ['fauna-feather', 'flora-fiber'], quantity: 1, modular: true, derived: true },
    { name: 'leader-line', materialDomains: ['fauna-sinew'], quantity: 1, modular: false, derived: true },
  ],
  'aquatic-study-salmon': [
    { name: 'reel', materialDomains: ['mining-metal', 'precision-craft'], quantity: 1, modular: true, derived: true },
    { name: 'weighted-bobber', materialDomains: ['mining-metal', 'aquatic-shell'], quantity: 1, modular: false, derived: true },
  ],
  'ecology-study-fish': [
    { name: 'bait-pouch', materialDomains: ['fauna-hide'], quantity: 1, modular: false, derived: true },
  ],
  // Mining digs unlock specialized heads.
  'mine-dig-iron': [
    { name: 'iron-tip', materialDomains: ['mining-metal'], quantity: 1, modular: true, derived: true },
  ],
  'mine-dig-gem': [
    { name: 'precision-chisel', materialDomains: ['precision-craft'], quantity: 1, modular: false, derived: true },
  ],
  'mine-reveal-deep': [
    { name: 'reinforced-shaft', materialDomains: ['mining-metal', 'flora-wood'], quantity: 2, modular: false, derived: true },
  ],
  // Ecology gathers add herbalist accessories.
  'ecology-study-flora': [
    { name: 'pressing-tile', materialDomains: ['mining-stone'], quantity: 1, modular: false, derived: true },
  ],
  'ecology-study-fungi': [
    { name: 'spore-jar', materialDomains: ['mining-stone', 'flora-fiber'], quantity: 1, modular: false, derived: true },
  ],
}

/**
 * Pick a deterministic slice of slots for a derivation hook. Returns 0
 * if the trigger has no pool entry — caller should treat that as no-op.
 */
export function deriveSlots(seed: DerivationSeed): Slot[] {
  const pool = DERIVATION_POOL[seed.trigger]
  if (!pool || pool.length === 0) return []
  const rng = new SeededRNG(`${seed.trigger}:${seed.seedKey}:${seed.tier}`)
  // Higher tier → more slots derived (1 at tier 0-1; up to 2 at tier 2-3).
  const count = seed.tier >= 2 ? Math.min(2, pool.length) : 1
  const shuffled = rng.shuffle(pool)
  return shuffled.slice(0, count)
}
