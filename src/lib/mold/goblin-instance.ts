/**
 * GOBLIN INSTANCE — Compose a disc tensor for a specific goblin
 * ===============================================================
 *
 * The encode-side counterpart to `decodeEntity`. Takes designer-readable
 * parameters (level, hp, equipment, palette) and writes them to the disc
 * tensor at the spec-defined slots.
 *
 * In production, this gets called when the world rolls a goblin
 * deterministically: roll inputs → chosen parameters → tensor → disc geometry.
 * For the demo, we hand-pick the parameters to test the pipeline.
 */

import {
  blankTensor, encodeChannel, encodeRGB, encodePacked24,
  type DiscTensor, type RGB,
} from '../disc/disc-codec'
import {
  SLOT, Kind, MonsterArchetype, CreatureSizeIdx, BuildIdx,
  PoseFamily, Disposition, Intent,
} from '../disc/disc-spec'

export interface GoblinSpec {
  // Identity
  level: number          // 1-30 typical
  hpCurrent: number      // current HP
  hpMax: number          // max HP (used to compute normalized + tier)
  ac: number
  attackMod: number      // signed, e.g. +4
  baseXpAwarded: number  // XP this goblin grants when defeated
  // Visual
  size?: CreatureSizeIdx
  build?: BuildIdx
  paletteSkin?: RGB      // designer-controlled palette colors
  paletteHair?: RGB
  paletteEye?: RGB
  paletteAccent?: RGB
  // Behavior
  poseFamily?: PoseFamily
  poseProgress?: number  // 0-1
  disposition?: Disposition
  intent?: Intent
  // Equipment composition indices (Phase 0: integers; Phase 1: composition bigints packed in 24 bits)
  equipMainHand?: number
  equipTorso?: number
  // Faction
  factionIdx?: number
  loyalty?: number
  // Instance
  instanceSeed?: number  // 24-bit
  rollDay?: number       // 16-bit world day
}

const DEFAULT_GOBLIN_SKIN:   RGB = { r: 100, g: 140, b:  90 }   // sickly green
const DEFAULT_GOBLIN_HAIR:   RGB = { r:  80, g:  60, b:  40 }   // dirty brown
const DEFAULT_GOBLIN_EYE:    RGB = { r: 220, g: 200, b:  60 }   // yellow
const DEFAULT_GOBLIN_ACCENT: RGB = { r:  90, g:  60, b:  40 }   // worn leather

/**
 * Compose a goblin's disc tensor from its specification.
 */
export function composeGoblin(spec: GoblinSpec): DiscTensor {
  const tensor = blankTensor()

  // ── Routing ─────────────────────────────────────────────────────────────
  tensor[SLOT.KIND]      = encodeChannel('r', Kind.Monster)
  tensor[SLOT.ARCHETYPE] = encodeChannel('r', MonsterArchetype.Goblin)
  tensor[SLOT.SUBTYPE]   = encodeChannel('r', 0)         // base goblin (no subtype yet)
  tensor[SLOT.RACE]      = encodeChannel('r', 0)         // goblinoid family root
  tensor[SLOT.TIER]      = encodeChannel('r', 3)         // T3 (small unit)

  // ── Instance identity ──────────────────────────────────────────────────
  tensor[SLOT.INSTANCE_SEED_HI] = encodePacked24((spec.instanceSeed ?? 0) >>> 0)
  tensor[SLOT.INSTANCE_SEED_LO] = encodePacked24(((spec.instanceSeed ?? 0) >>> 0) ^ 0x5a5a5a)
  const day = spec.rollDay ?? 0
  tensor[SLOT.ROLL_DAY] = { r: (day >> 8) & 0xff, g: day & 0xff, b: 0 }

  // ── Physical / visual ──────────────────────────────────────────────────
  tensor[SLOT.SIZE]  = encodeChannel('r', spec.size  ?? CreatureSizeIdx.Small)
  tensor[SLOT.BUILD] = encodeChannel('r', spec.build ?? BuildIdx.Slim)

  const skin   = spec.paletteSkin   ?? DEFAULT_GOBLIN_SKIN
  const hair   = spec.paletteHair   ?? DEFAULT_GOBLIN_HAIR
  const eye    = spec.paletteEye    ?? DEFAULT_GOBLIN_EYE
  const accent = spec.paletteAccent ?? DEFAULT_GOBLIN_ACCENT
  tensor[SLOT.PALETTE_SKIN_OR_COAT] = skin
  tensor[SLOT.PALETTE_HAIR_OR_FUR]  = hair
  tensor[SLOT.PALETTE_EYE]          = eye
  tensor[SLOT.PALETTE_ACCENT]       = accent

  tensor[SLOT.POSE_FAMILY]   = encodeChannel('r', spec.poseFamily ?? PoseFamily.Idle)
  tensor[SLOT.POSE_PROGRESS] = encodeChannel('r', Math.round((spec.poseProgress ?? 0) * 255))

  // ── Combat / vitality ──────────────────────────────────────────────────
  const hpNorm = Math.max(0, Math.min(255, Math.round((spec.hpCurrent / Math.max(1, spec.hpMax)) * 255)))
  tensor[SLOT.HP_NORM]     = encodeChannel('r', hpNorm)
  tensor[SLOT.HP_MAX_TIER] = encodeChannel('r', clampHpMaxTier(spec.hpMax))
  tensor[SLOT.AC]          = encodeChannel('r', spec.ac)
  tensor[SLOT.ATTACK_MOD]  = encodeChannel('r', 128 + spec.attackMod)  // bias to unsigned
  tensor[SLOT.DAMAGE_DICE] = encodeChannel('r', 1)  // catalog index 1 = "1d6"
  tensor[SLOT.STATUS_LOW]  = encodeChannel('r', 0)
  tensor[SLOT.STATUS_HIGH] = encodeChannel('r', 0)

  // ── Class / level / XP ─────────────────────────────────────────────────
  tensor[SLOT.LEVEL]    = encodeChannel('r', spec.level)
  // For monsters/NPCs, XP_LOW + XP_HIGH = base_xp_awarded (16-bit)
  const xp = spec.baseXpAwarded
  tensor[SLOT.XP_LOW]   = encodeChannel('r', xp & 0xff)
  tensor[SLOT.XP_HIGH]  = encodeChannel('r', (xp >> 8) & 0xff)
  tensor[SLOT.HIT_DICE] = encodeChannel('r', 1)

  // ── Behavioral state ───────────────────────────────────────────────────
  tensor[SLOT.DISPOSITION]      = encodeChannel('r', spec.disposition ?? Disposition.Hostile)
  tensor[SLOT.INTENT_KIND]      = encodeChannel('r', spec.intent ?? Intent.Patrol)
  tensor[SLOT.INTENT_TARGET_LO] = encodeChannel('r', 0)
  tensor[SLOT.INTENT_TARGET_HI] = encodeChannel('r', 0)

  // ── Equipment ──────────────────────────────────────────────────────────
  tensor[SLOT.EQUIP_MAIN_HAND] = encodePacked24(spec.equipMainHand ?? 0)
  tensor[SLOT.EQUIP_TORSO]     = encodePacked24(spec.equipTorso ?? 0)

  // ── Faction ────────────────────────────────────────────────────────────
  tensor[SLOT.FACTION]    = encodeChannel('r', spec.factionIdx ?? 0)
  tensor[SLOT.LOYALTY]    = encodeChannel('r', spec.loyalty ?? 100)
  tensor[SLOT.REPUTATION] = encodeChannel('r', 0)
  tensor[SLOT.TITLE]      = encodeChannel('r', 0)

  // Identity, knowledge, reserved — left blank (default 0 RGB)

  return tensor
}

function clampHpMaxTier(hpMax: number): number {
  // HP brackets: tier 0 = 1-4, 1 = 5-9, 2 = 10-19, 3 = 20-49, 4 = 50-99, 5 = 100-249, 6 = 250+
  if (hpMax <  5)  return 0
  if (hpMax < 10)  return 1
  if (hpMax < 20)  return 2
  if (hpMax < 50)  return 3
  if (hpMax < 100) return 4
  if (hpMax < 250) return 5
  return 6
}
