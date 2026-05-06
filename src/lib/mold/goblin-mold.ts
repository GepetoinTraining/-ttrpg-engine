/**
 * GOBLIN MOLD — Procedural geometry from disc tensor
 * ===================================================
 *
 * The mold reads the disc tensor (via the codec), derives semantic values,
 * and composes primitive geometric pieces (head, torso, arms, legs).
 *
 * This is the Phase-0 stub of what will eventually be SDF + marching cubes
 * (per docs/renderer-pipeline-client.md). Today: primitive geometry primitives
 * that prove the pipeline shape end-to-end.
 *
 *   disc tensor → decode each slot → semantic values → mold params → geometry
 *
 * Same disc on both sides → same params → same geometry. The bytes ARE the
 * stamp; the mold is the read-side interpretation.
 */

import { decode, type DiscTensor, type RGB } from '../disc/disc-codec'
import {
  SLOT, DECODERS,
  Kind, MonsterArchetype, CreatureSizeIdx, BuildIdx, PoseFamily, Disposition,
} from '../disc/disc-spec'

// ============================================================
// DECODED ENTITY — what the mold reads from a disc
// ============================================================

export interface DecodedEntity {
  kind: Kind
  archetype: number
  subtype: number
  race: number
  tier: number
  size: CreatureSizeIdx
  build: BuildIdx
  poseFamily: PoseFamily
  poseProgress: number
  hpNormalized: number      // 0..1
  hpMaxTier: number
  ac: number
  attackMod: number          // signed (-128..127)
  level: number
  xp: number                 // 16-bit (combined low+high)
  disposition: Disposition
  paletteSkin: RGB           // raw RGB from the tensor (designer-controlled palette)
  paletteHair: RGB
  paletteEye: RGB
  paletteAccent: RGB
  factionIdx: number
  loyalty: number
  equipment: {
    head: number; torso: number; shoulders: number; arms: number; hands: number
    waist: number; legs: number; feet: number; back: number
    mainHand: number; offHand: number
  }
}

// ============================================================
// DECODE — disc tensor → DecodedEntity
// ============================================================

export function decodeEntity(tensor: DiscTensor): DecodedEntity {
  const readScalar = (slot: number): number => {
    const matrix = DECODERS[slot]
    if (!matrix) return 0
    return decode(matrix, tensor[slot])[0] ?? 0
  }
  const readRGB = (slot: number): RGB => tensor[slot] ?? { r: 0, g: 0, b: 0 }

  return {
    kind:        readScalar(SLOT.KIND) as Kind,
    archetype:   readScalar(SLOT.ARCHETYPE),
    subtype:     readScalar(SLOT.SUBTYPE),
    race:        readScalar(SLOT.RACE),
    tier:        readScalar(SLOT.TIER),
    size:        readScalar(SLOT.SIZE) as CreatureSizeIdx,
    build:       readScalar(SLOT.BUILD) as BuildIdx,
    poseFamily:  readScalar(SLOT.POSE_FAMILY) as PoseFamily,
    poseProgress: readScalar(SLOT.POSE_PROGRESS) / 255,
    hpNormalized: readScalar(SLOT.HP_NORM) / 255,
    hpMaxTier:    readScalar(SLOT.HP_MAX_TIER),
    ac:          readScalar(SLOT.AC),
    attackMod:   readScalar(SLOT.ATTACK_MOD) - 128,
    level:       readScalar(SLOT.LEVEL),
    xp:          (tensor[SLOT.XP_HIGH].r << 8) | tensor[SLOT.XP_LOW].r,
    disposition: readScalar(SLOT.DISPOSITION) as Disposition,
    paletteSkin: readRGB(SLOT.PALETTE_SKIN_OR_COAT),
    paletteHair: readRGB(SLOT.PALETTE_HAIR_OR_FUR),
    paletteEye:  readRGB(SLOT.PALETTE_EYE),
    paletteAccent: readRGB(SLOT.PALETTE_ACCENT),
    factionIdx:  readScalar(SLOT.FACTION),
    loyalty:     readScalar(SLOT.LOYALTY),
    equipment: {
      head:      readScalar(SLOT.EQUIP_HEAD),
      torso:     readScalar(SLOT.EQUIP_TORSO),
      shoulders: readScalar(SLOT.EQUIP_SHOULDERS),
      arms:      readScalar(SLOT.EQUIP_ARMS),
      hands:     readScalar(SLOT.EQUIP_HANDS),
      waist:     readScalar(SLOT.EQUIP_WAIST),
      legs:      readScalar(SLOT.EQUIP_LEGS),
      feet:      readScalar(SLOT.EQUIP_FEET),
      back:      readScalar(SLOT.EQUIP_BACK),
      mainHand:  readScalar(SLOT.EQUIP_MAIN_HAND),
      offHand:   readScalar(SLOT.EQUIP_OFF_HAND),
    },
  }
}

// ============================================================
// MOLD GEOMETRY — primitive piece descriptions
// ============================================================

export type PieceShape = 'sphere' | 'box' | 'cylinder' | 'cone'

export interface MoldPiece {
  /** Which body part this piece represents */
  name: string
  /** Geometric primitive type */
  shape: PieceShape
  /** World-space center, relative to entity origin (in tile-meter units) */
  position: [number, number, number]
  /** Per-shape size: sphere=[r], box=[w,h,d], cylinder=[r,h], cone=[r,h] */
  size: number[]
  /** Display color (RGB triple, 0-255 per channel) */
  color: RGB
  /** Material kind hint for the renderer (drives shader settings) */
  material: 'flesh' | 'cloth' | 'leather' | 'metal' | 'wood' | 'stone'
}

// ============================================================
// SIZE SCALE
// ============================================================

const SIZE_SCALE: Record<CreatureSizeIdx, number> = {
  [CreatureSizeIdx.Tiny]:       0.4,
  [CreatureSizeIdx.Small]:      0.7,
  [CreatureSizeIdx.Medium]:     1.0,
  [CreatureSizeIdx.Large]:      1.6,
  [CreatureSizeIdx.Huge]:       2.4,
  [CreatureSizeIdx.Gargantuan]: 4.0,
}

const BUILD_GIRTH: Record<BuildIdx, number> = {
  [BuildIdx.Slim]:    0.85,
  [BuildIdx.Average]: 1.00,
  [BuildIdx.Stout]:   1.25,
  [BuildIdx.Hulking]: 1.55,
}

// ============================================================
// COMPOSE — DecodedEntity → MoldPiece[]
// ============================================================

/**
 * Compose a humanoid (goblin/PC/NPC) from primitives based on its disc.
 * Phase 0 stub: 7 pieces (head, torso, 2 arms, 2 legs, weapon if present).
 * Future: swap each piece for its SDF mold, marching-cubes the sum.
 */
export function composeHumanoid(entity: DecodedEntity): MoldPiece[] {
  const scale = SIZE_SCALE[entity.size] ?? 1.0
  const girth = BUILD_GIRTH[entity.build] ?? 1.0
  const skin = entity.paletteSkin
  const hair = entity.paletteHair
  const accent = entity.paletteAccent

  // Pose tilt — combat poses lean forward, sneaking compresses, dead falls flat
  const torsoTilt = entity.poseFamily === PoseFamily.Combat ? 0.2
                  : entity.poseFamily === PoseFamily.Sneaking ? 0.4
                  : entity.poseFamily === PoseFamily.Dead ? 1.4
                  : 0

  const pieces: MoldPiece[] = []

  // — Head (sphere) —
  pieces.push({
    name: 'head',
    shape: 'sphere',
    position: [0, scale * 1.55, 0],
    size: [scale * 0.22],
    color: skin,
    material: 'flesh',
  })

  // — Torso (box) —
  pieces.push({
    name: 'torso',
    shape: 'box',
    position: [0, scale * 1.05, 0],
    size: [scale * 0.45 * girth, scale * 0.7, scale * 0.28 * girth],
    color: hair, // tunic = hair color stand-in for the demo
    material: 'cloth',
  })

  // — Arms (cylinders) —
  pieces.push({
    name: 'arm-left',
    shape: 'cylinder',
    position: [-scale * 0.32 * girth, scale * 0.95, 0],
    size: [scale * 0.08, scale * 0.6],
    color: skin,
    material: 'flesh',
  })
  pieces.push({
    name: 'arm-right',
    shape: 'cylinder',
    position: [scale * 0.32 * girth, scale * 0.95, 0],
    size: [scale * 0.08, scale * 0.6],
    color: skin,
    material: 'flesh',
  })

  // — Legs (cylinders) —
  pieces.push({
    name: 'leg-left',
    shape: 'cylinder',
    position: [-scale * 0.13, scale * 0.4, 0],
    size: [scale * 0.1, scale * 0.7],
    color: accent, // pants = accent color
    material: 'leather',
  })
  pieces.push({
    name: 'leg-right',
    shape: 'cylinder',
    position: [scale * 0.13, scale * 0.4, 0],
    size: [scale * 0.1, scale * 0.7],
    color: accent,
    material: 'leather',
  })

  // — Main-hand weapon (only if equipped — composition index != 0) —
  if (entity.equipment.mainHand !== 0) {
    // Phase 0: weapon is a thin box (sword) parameterized by the composition
    // index's low bits. Real version: factorize the composition number,
    // read form/material/affixes, build the actual weapon SDF.
    const length = 0.7 * scale * (1 + 0.1 * (entity.equipment.mainHand & 0x07))
    const weaponColor: RGB = entity.equipment.mainHand & 0x10
      ? { r: 220, g: 240, b: 255 } // mithril-ish
      : { r: 180, g: 180, b: 200 } // iron-ish
    pieces.push({
      name: 'weapon-main',
      shape: 'box',
      position: [scale * 0.5 * girth, scale * 0.95, scale * 0.15],
      size: [scale * 0.05, length, scale * 0.02],
      color: weaponColor,
      material: 'metal',
    })
  }

  // — Pose tilt: rotate torso/head/arms forward as a lump (applied at render) —
  // For Phase 0 we encode tilt in the entity, the renderer applies it as a group rotation.
  // Stored on the first piece's metadata for the renderer to read.
  if (torsoTilt !== 0) {
    // Renderer-side: read entity.poseFamily separately to apply group tilt
  }

  return pieces
}

// ============================================================
// MOLD SELECTOR — dispatch by archetype
// ============================================================

export function composeMold(entity: DecodedEntity): MoldPiece[] {
  // Phase 0: only humanoid mold exists (goblin/PC/NPC). Others fall back to
  // the same humanoid mold for now — they'd get their own composeBeast,
  // composeDragon, etc. once those molds are authored.
  return composeHumanoid(entity)
}
