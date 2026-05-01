/**
 * ECOLOGY INTERACTABLES — flora, fauna, fungi, moss
 * ======================================================
 *
 * Per `docs/to-be implemented/fauna-flora-mapping.md`. Living understory
 * beneath the existing fauna pool (`engine/biome-fauna.ts`): herbs,
 * shrubs, vines, mosses, fungi. Drives skill-based study/harvest progression
 * (Nature/Survival/Herbalism/Tracking) with knowledge tiers that lower
 * future DCs. Each species contributes a lore-bag entry (keywords +
 * description) for `src/lib/lore-bag.ts`.
 *
 * Pure types + catalog + small starter set. No DB. No persistence here —
 * the MF (`mf-ecological-study.ts`) consumes these and emits actions; the
 * action stream is what writes κ via `applyIntent` → slot push.
 *
 * Generation density per biome is delegated to `noise.ts` + worldgen; this
 * module is the species catalog (templates) that population uses.
 */

import { z } from 'zod'

// ============================================================
// SPECIES KIND — what kind of organism this is
// ============================================================

export const InteractableKindSchema = z.enum(['flora', 'fauna', 'fungi', 'moss'])
export type InteractableKind = z.infer<typeof InteractableKindSchema>

// ============================================================
// SKILL — the check the player rolls
// ============================================================

export const EcologySkillSchema = z.enum([
  'survival',
  'nature',
  'herbalism',     // sub-of-medicine in 5e; treat as its own check here
  'tracking',      // sub-of-survival; separated for fauna intent
  'animalHandling',
  'medicine',
])
export type EcologySkill = z.infer<typeof EcologySkillSchema>

// ============================================================
// RARITY — drives generation density and base DC
// ============================================================

export const RaritySchema = z.enum(['common', 'uncommon', 'rare'])
export type Rarity = z.infer<typeof RaritySchema>

// ============================================================
// INTERACTION TEMPLATE — per-species per-intent block
// ============================================================

export const InteractionTemplateSchema = z.object({
  /** Which skill rolls for this intent. */
  skill: EcologySkillSchema,
  /** Base DC at knowledge tier 0. Reduced -2 per prior tier (capped at 5). */
  baseDC: z.number().int().min(5).max(30),
  /** Free-form yield description (e.g., "1d4 doses", "2d6 meat + pelt"). */
  yieldNote: z.string().optional(),
  /** Hazard fired on failure (e.g., "1d4 piercing", "alerts predators"). */
  hazardNote: z.string().optional(),
})
export type InteractionTemplate = z.infer<typeof InteractionTemplateSchema>

// ============================================================
// LORE — keywords + description for the lore bag
// ============================================================

export const InteractableLoreSchema = z.object({
  /** Short narrative description (1-2 sentences). */
  description: z.string(),
  /** 4-8 keyword tags for bag-of-words / future vector embedding. */
  keywords: z.array(z.string()).min(2).max(12),
})
export type InteractableLore = z.infer<typeof InteractableLoreSchema>

// ============================================================
// INTERACTABLE SPECIES — the catalog row
// ============================================================

export const InteractableSpeciesSchema = z.object({
  /** Stable id (used as lore-bag key, κ knowledge key). */
  id: z.string().min(1),
  /** Human display name. */
  name: z.string().min(1),
  kind: InteractableKindSchema,
  rarity: RaritySchema,
  /**
   * Biomes where this species can spawn. Empty = ubiquitous.
   * Matches `BiomeType` ids loosely; worldgen filters by intersection.
   */
  biomes: z.array(z.string()),
  /** Density [0, 1] at typical spawn-able biome. Worldgen scales with noise. */
  baseDensity: z.number().min(0).max(1),
  /** Per-intent interaction templates. Missing key = intent unavailable. */
  intents: z.object({
    study: InteractionTemplateSchema.optional(),
    harvest: InteractionTemplateSchema.optional(),
    track: InteractionTemplateSchema.optional(),
  }),
  lore: InteractableLoreSchema,
})
export type InteractableSpecies = z.infer<typeof InteractableSpeciesSchema>

// ============================================================
// KNOWLEDGE LEVEL — per-character per-species progression
// ============================================================

/**
 * Tiers mirror `material-mastery.ts` for consistency:
 *   0 — UNKNOWN     no info; species shows as a vague description
 *   1 — NAMED       species name + kind known
 *   2 — STUDIED     properties revealed, harvest enabled (-2 DC)
 *   3 — EXPERT      hidden affixes / behaviors known (-4 DC)
 */
export const EcologyKnowledgeLevelSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
])
export type EcologyKnowledgeLevel = z.infer<typeof EcologyKnowledgeLevelSchema>

/** DC discount per knowledge tier. Capped at 4 (tier 3). */
export const KNOWLEDGE_DC_DISCOUNT: Record<EcologyKnowledgeLevel, number> = {
  0: 0,
  1: 0,    // naming alone doesn't reduce DC; needs studied props
  2: 2,
  3: 4,
}

// ============================================================
// CATALOG — small starter set across all four kinds
// ============================================================

/**
 * Starter catalog. Expand per biome rollout (proposal targets 50+); kept
 * small here so Phase 1 has unit-testable shape without speculative bloat.
 * Each entry is referenced by id from intent params + lore bag.
 */
export const ECOLOGY_INTERACTABLES: InteractableSpecies[] = [
  // ── Flora ──
  {
    id: 'willow-bark',
    name: 'Willow Bark',
    kind: 'flora',
    rarity: 'common',
    biomes: ['forest', 'river_valley'],
    baseDensity: 0.85,
    intents: {
      study:   { skill: 'nature',    baseDC: 12, yieldNote: 'reveals analgesic sap' },
      harvest: { skill: 'herbalism', baseDC: 10, yieldNote: '1d4 doses pain-relief' },
    },
    lore: {
      description: 'Flexible tree bark with analgesic sap.',
      keywords: ['healing', 'bark', 'river-side', 'anti-inflammatory'],
    },
  },
  {
    id: 'foxglove',
    name: 'Foxglove',
    kind: 'flora',
    rarity: 'uncommon',
    biomes: ['plains', 'forest'],
    baseDensity: 0.55,
    intents: {
      study:   { skill: 'nature',    baseDC: 16, yieldNote: 'dual-use warning: poison or heart medicine' },
      harvest: { skill: 'herbalism', baseDC: 15, yieldNote: '1d6 poison or 1d4 healing (player choice)' },
    },
    lore: {
      description: 'Tall spikes of tubular flowers, toxic in excess.',
      keywords: ['poison', 'cardiac', 'fox-like', 'purple', 'medicinal'],
    },
  },

  // ── Fauna (light — Δ.2 will add hunt/tame/domesticate) ──
  {
    id: 'forest-rabbit',
    name: 'Forest Rabbit',
    kind: 'fauna',
    rarity: 'common',
    biomes: ['forest', 'plains'],
    baseDensity: 0.9,
    intents: {
      study:   { skill: 'nature',  baseDC: 11, yieldNote: 'identifies burrow networks' },
      track:   { skill: 'tracking', baseDC: 10, yieldNote: 'small prints, nocturnal habit' },
      harvest: { skill: 'survival', baseDC: 12, yieldNote: 'meat + pelt; 10% predator alert', hazardNote: 'noise draws predators on fail' },
    },
    lore: {
      description: 'Swift burrower with soft fur.',
      keywords: ['prey', 'fur', 'herbivore', 'burrow', 'small-game'],
    },
  },
  {
    id: 'forest-owl',
    name: 'Forest Owl',
    kind: 'fauna',
    rarity: 'uncommon',
    biomes: ['forest'],
    baseDensity: 0.6,
    intents: {
      study:   { skill: 'nature',  baseDC: 14, yieldNote: 'prey-sense behavior' },
      track:   { skill: 'tracking', baseDC: 14, yieldNote: 'silent flight, night calls' },
    },
    lore: {
      description: 'Silent winged predator of the night.',
      keywords: ['nocturnal', 'feathers', 'hunter', 'forest', 'silent'],
    },
  },

  // ── Fungi ──
  {
    id: 'morel-mushroom',
    name: 'Morel',
    kind: 'fungi',
    rarity: 'common',
    biomes: ['forest', 'river_valley'],
    baseDensity: 0.7,
    intents: {
      study:   { skill: 'nature',    baseDC: 11, yieldNote: 'identification — distinguishes from false morel' },
      harvest: { skill: 'herbalism', baseDC: 10, yieldNote: 'food (temp HP); false-morel risk on fail', hazardNote: 'false morel poisoning' },
    },
    lore: {
      description: 'Honeycomb-capped delicacy in spring.',
      keywords: ['edible', 'nutty', 'spring', 'forest-floor', 'gourmet'],
    },
  },
  {
    id: 'amanita-fly-agaric',
    name: 'Fly Agaric',
    kind: 'fungi',
    rarity: 'uncommon',
    biomes: ['forest'],
    baseDensity: 0.4,
    intents: {
      study:   { skill: 'nature',    baseDC: 16, yieldNote: 'psychedelic warnings' },
      harvest: { skill: 'herbalism', baseDC: 18, yieldNote: 'potion ingredient; overdose 1d6 psychic damage', hazardNote: 'overdose: 1d6 psychic damage' },
    },
    lore: {
      description: 'Iconic red-cap with white spots; powerfully hallucinogenic.',
      keywords: ['poison', 'hallucinogen', 'red-cap', 'shamanic', 'deadly'],
    },
  },

  // ── Moss ──
  {
    id: 'sphagnum-moss',
    name: 'Peat Moss',
    kind: 'moss',
    rarity: 'common',
    biomes: ['swamp', 'tundra', 'river_valley'],
    baseDensity: 0.95,
    intents: {
      study:   { skill: 'survival', baseDC: 10, yieldNote: 'absorbent properties' },
      harvest: { skill: 'survival', baseDC: 9,  yieldNote: 'wound dressing — reduces bleeding' },
    },
    lore: {
      description: 'Spongy green carpet in wetlands.',
      keywords: ['absorbent', 'wound-dressing', 'wetland', 'cushion', 'medicinal'],
    },
  },
  {
    id: 'bioluminescent-moss',
    name: 'Glowmoss',
    kind: 'moss',
    rarity: 'rare',
    biomes: ['underground', 'jungle', 'swamp'],
    baseDensity: 0.3,
    intents: {
      study:   { skill: 'nature',   baseDC: 14, yieldNote: 'glow mechanism documented' },
      harvest: { skill: 'survival', baseDC: 13, yieldNote: 'light source, 1hr duration' },
    },
    lore: {
      description: 'Faintly glowing strands in dark undergrowth.',
      keywords: ['bioluminescent', 'cave', 'glow', 'moss', 'light-source'],
    },
  },
]

/** Lookup helper. Throws on unknown id — caller responsibility to validate. */
export function getInteractable(id: string): InteractableSpecies {
  const found = ECOLOGY_INTERACTABLES.find((s) => s.id === id)
  if (!found) throw new Error(`unknown interactable: ${id}`)
  return found
}

/** Filter helpers for worldgen / scenarios. */
export function interactablesByKind(kind: InteractableKind): InteractableSpecies[] {
  return ECOLOGY_INTERACTABLES.filter((s) => s.kind === kind)
}
export function interactablesByBiome(biomeId: string): InteractableSpecies[] {
  return ECOLOGY_INTERACTABLES.filter(
    (s) => s.biomes.length === 0 || s.biomes.includes(biomeId),
  )
}
