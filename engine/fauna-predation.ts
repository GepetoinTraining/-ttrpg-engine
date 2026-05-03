/**
 * FAUNA PREDATION + DOMESTICATION
 * ===================================
 *
 * Per `docs/to-be implemented/fauna-predation-domestication.md`. Per-species
 * per-intent templates for the 4 player-side wild-fauna interactions:
 *   - hunt:        lethal extraction (meat, hide, bone)
 *   - trap:        non-lethal capture (1 head alive)
 *   - tame:        bond a captured head as temporary follower (3-7 days)
 *   - domesticate: convert a captured head into permanent settlement
 *                  livestock (7-30+ days, may require a facility)
 *
 * Pure types + 6-species catalog matching `engine/wild-fauna.ts`
 * `WILD_FAUNA_CATALOG`. The MFs in `mf-fauna-predation.ts` consume these.
 *
 * Knowledge tier mirrors `EcologyKnowledgeLevel` (0..3) from
 * `ecology-interactables.ts` — same character-side tier ladder, same
 * `KNOWLEDGE_DC_DISCOUNT` table (don't duplicate; the MF imports it).
 */

import { z } from 'zod'
import { TrophicRoleSchema } from './wild-fauna'

// ============================================================
// SKILL — what the player rolls
// ============================================================

export const PredationSkillSchema = z.enum([
  'survival',
  'animalHandling',
])
export type PredationSkill = z.infer<typeof PredationSkillSchema>

// ============================================================
// INTENT
// ============================================================

export const PredationIntentSchema = z.enum([
  'hunt',
  'trap',
  'tame',
  'domesticate',
])
export type PredationIntent = z.infer<typeof PredationIntentSchema>

// ============================================================
// TEMPLATES — per-intent shapes
// ============================================================

export const HuntTemplateSchema = z.object({
  skill: PredationSkillSchema,
  baseDC: z.number().int().min(5).max(30),
  yieldNote: z.string().optional(),
  hazardNote: z.string().optional(),
  /** Cap on heads killed in one successful hunt. */
  maxKillPerAttempt: z.number().int().min(1).max(20).default(3),
})
export type HuntTemplate = z.infer<typeof HuntTemplateSchema>

export const TrapTemplateSchema = z.object({
  skill: PredationSkillSchema,
  baseDC: z.number().int().min(5).max(30),
  yieldNote: z.string().optional(),
  hazardNote: z.string().optional(),
})
export type TrapTemplate = z.infer<typeof TrapTemplateSchema>

export const TameTemplateSchema = z.object({
  skill: PredationSkillSchema,
  baseDC: z.number().int().min(5).max(30),
  /** Baseline bond duration in days; margin extends this. */
  baseBondDays: z.number().int().min(1).max(30).default(3),
  hazardNote: z.string().optional(),
})
export type TameTemplate = z.infer<typeof TameTemplateSchema>

export const DomesticateTemplateSchema = z.object({
  skill: PredationSkillSchema,
  baseDC: z.number().int().min(5).max(30),
  /** Days of progress required to fully domesticate. */
  requiredDays: z.number().int().min(3).max(120),
  /** Whether a settlement facility (corral / coop / stable) is required. */
  requiresFacility: z.boolean().default(false),
  hazardNote: z.string().optional(),
})
export type DomesticateTemplate = z.infer<typeof DomesticateTemplateSchema>

// ============================================================
// PROFILE — per-species map of available intents
// ============================================================

export const PredationProfileSchema = z.object({
  speciesId: z.string().min(1),
  trophic: TrophicRoleSchema,
  /** Approximate carcass meat yield per head (lbs) on a clean kill. */
  meatPerHead: z.number().min(0).max(1000),
  /** Hide / pelt produced per kill. 0 if irrelevant (e.g. owl). */
  hidePerHead: z.number().int().min(0).max(5),
  /** Bone / sinew salvage per kill. 0 if irrelevant. */
  bonePerHead: z.number().int().min(0).max(5),
  hunt: HuntTemplateSchema.optional(),
  trap: TrapTemplateSchema.optional(),
  tame: TameTemplateSchema.optional(),
  domesticate: DomesticateTemplateSchema.optional(),
})
export type PredationProfile = z.infer<typeof PredationProfileSchema>

// ============================================================
// CATALOG — all 6 wild-fauna species get full profiles
// ============================================================

export const PREDATION_CATALOG: Record<string, PredationProfile> = {
  // ── Herbivores ──
  rabbit: {
    speciesId: 'rabbit',
    trophic: 'herbivore',
    meatPerHead: 2,
    hidePerHead: 1,
    bonePerHead: 1,
    hunt: {
      skill: 'survival',
      baseDC: 10,
      yieldNote: 'meat + pelt; small game',
      hazardNote: 'noise alerts predators',
      maxKillPerAttempt: 4,
    },
    trap: {
      skill: 'survival',
      baseDC: 12,
      yieldNote: 'live capture; sells as pet',
      hazardNote: 'gnaws free on poor snare',
    },
    tame: {
      skill: 'animalHandling',
      baseDC: 11,
      baseBondDays: 3,
    },
    domesticate: {
      skill: 'animalHandling',
      baseDC: 15,
      requiredDays: 7,
      requiresFacility: false,
    },
  },
  deer: {
    speciesId: 'deer',
    trophic: 'herbivore',
    meatPerHead: 80,
    hidePerHead: 1,
    bonePerHead: 1,
    hunt: {
      skill: 'survival',
      baseDC: 15,
      yieldNote: 'meat + hide + antler',
      hazardNote: 'stag charge on fail',
      maxKillPerAttempt: 2,
    },
    trap: {
      skill: 'survival',
      baseDC: 16,
      yieldNote: 'live capture for transport',
      hazardNote: 'panic flight injures animal',
    },
    tame: {
      skill: 'animalHandling',
      baseDC: 14,
      baseBondDays: 5,
    },
    domesticate: {
      skill: 'animalHandling',
      baseDC: 18,
      requiredDays: 14,
      requiresFacility: true,
    },
  },
  boar: {
    speciesId: 'boar',
    trophic: 'omnivore',
    meatPerHead: 150,
    hidePerHead: 1,
    bonePerHead: 1,
    hunt: {
      skill: 'survival',
      baseDC: 19,
      yieldNote: 'meat + hide + tusks',
      hazardNote: 'gore charge on fail',
      maxKillPerAttempt: 1,
    },
    trap: {
      skill: 'survival',
      baseDC: 20,
      yieldNote: 'live capture for trophy',
      hazardNote: 'breaks snare and charges',
    },
    tame: {
      skill: 'animalHandling',
      baseDC: 18,
      baseBondDays: 4,
      hazardNote: 'savage rebuff on failure',
    },
    domesticate: {
      skill: 'animalHandling',
      baseDC: 22,
      requiredDays: 30,
      requiresFacility: true,
    },
  },
  'mountain-goat': {
    speciesId: 'mountain-goat',
    trophic: 'herbivore',
    meatPerHead: 50,
    hidePerHead: 1,
    bonePerHead: 1,
    hunt: {
      skill: 'survival',
      baseDC: 14,
      yieldNote: 'meat + hide + horns',
      hazardNote: 'cliff fall risk',
      maxKillPerAttempt: 2,
    },
    trap: {
      skill: 'survival',
      baseDC: 15,
      yieldNote: 'live capture for cheese herd',
    },
    tame: {
      skill: 'animalHandling',
      baseDC: 13,
      baseBondDays: 4,
    },
    domesticate: {
      skill: 'animalHandling',
      baseDC: 17,
      requiredDays: 14,
      requiresFacility: false,
    },
  },
  // ── Small carnivores ──
  fox: {
    speciesId: 'fox',
    trophic: 'small-carnivore',
    meatPerHead: 12,
    hidePerHead: 1,
    bonePerHead: 1,
    hunt: {
      skill: 'survival',
      baseDC: 13,
      yieldNote: 'pelt (stealth cloak); minor meat',
      hazardNote: 'cunning counterattack on fail',
      maxKillPerAttempt: 2,
    },
    trap: {
      skill: 'survival',
      baseDC: 14,
      yieldNote: 'live capture for study or pet',
      hazardNote: 'bites handler on poor snare',
    },
    tame: {
      skill: 'animalHandling',
      baseDC: 12,
      baseBondDays: 4,
      hazardNote: 'snaps and runs on failure',
    },
    domesticate: {
      skill: 'animalHandling',
      baseDC: 16,
      requiredDays: 10,
      requiresFacility: false,
    },
  },
  owl: {
    speciesId: 'owl',
    trophic: 'small-carnivore',
    meatPerHead: 1,
    hidePerHead: 0,
    bonePerHead: 0,
    hunt: {
      skill: 'survival',
      baseDC: 16,
      yieldNote: 'feathers + talons',
      hazardNote: 'silent dive — talon hit on fail',
      maxKillPerAttempt: 1,
    },
    trap: {
      skill: 'survival',
      baseDC: 17,
      yieldNote: 'live capture for aviary',
      hazardNote: 'handler scratches',
    },
    tame: {
      skill: 'animalHandling',
      baseDC: 15,
      baseBondDays: 4,
      hazardNote: 'flies off on failure',
    },
    domesticate: {
      skill: 'animalHandling',
      baseDC: 19,
      requiredDays: 21,
      requiresFacility: false,
    },
  },
}

// ============================================================
// HELPERS
// ============================================================

export function getPredationProfile(speciesId: string): PredationProfile {
  const p = PREDATION_CATALOG[speciesId]
  if (!p) throw new Error(`unknown predation profile: ${speciesId}`)
  return p
}

export function getHuntTemplate(speciesId: string): HuntTemplate {
  const p = getPredationProfile(speciesId)
  if (!p.hunt) throw new Error(`species ${speciesId} has no hunt template`)
  return p.hunt
}

export function getTrapTemplate(speciesId: string): TrapTemplate {
  const p = getPredationProfile(speciesId)
  if (!p.trap) throw new Error(`species ${speciesId} has no trap template`)
  return p.trap
}

export function getTameTemplate(speciesId: string): TameTemplate {
  const p = getPredationProfile(speciesId)
  if (!p.tame) throw new Error(`species ${speciesId} has no tame template`)
  return p.tame
}

export function getDomesticateTemplate(speciesId: string): DomesticateTemplate {
  const p = getPredationProfile(speciesId)
  if (!p.domesticate) throw new Error(`species ${speciesId} has no domesticate template`)
  return p.domesticate
}
