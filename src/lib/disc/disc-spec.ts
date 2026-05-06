/**
 * DISC SPEC — Canonical 64-slot allocation
 * ==========================================
 *
 * THE LOAD-BEARING DOCUMENT. This is what client and server agree on.
 * Once a slot's binding ships, it's permanent — old discs reference it by
 * position, and changing the meaning would break every existing entity.
 *
 * Each slot has:
 *   - A name (what it represents)
 *   - A decoder matrix (how RGB at that wedge becomes a value)
 *   - A catalog binding (what file holds the indexed values)
 *
 * Catalogs can GROW (add new races, weapons, etc.) without breaking
 * determinism — the slot's meaning is stable; only the lookup pool extends.
 *
 * NEW SLOTS may be assigned later from the reserved range (slots 54-63),
 * provided their decoder always returns a "feature absent" sentinel for
 * RGB = (0, 0, 0). Old discs were rolled with those wedges as black; they
 * must continue to verify as having no value at the newly-assigned slot.
 */

import {
  READ_R, READ_G, READ_B, READ_RGB, PACKED_24_MATRIX,
  type DecoderMatrix,
} from './disc-codec'

// ============================================================
// SLOT INDEX (the position-to-meaning ledger)
// ============================================================

export const SLOT = {
  // ── Routing (0-4) — locked forever ───────────────────────────────────
  KIND:        0,   // entity-kind enum index (PC/NPC/monster/beast/...)
  ARCHETYPE:   1,   // per-kind archetype index (class for PC, species for monster)
  SUBTYPE:     2,   // subclass / breed / item rarity-tier
  RACE:        3,   // race / family index
  TIER:        4,   // T0-T17 from engine/tier.ts

  // ── Instance identity (5-7) — locked forever ─────────────────────────
  INSTANCE_SEED_HI: 5,   // 24-bit packed instance variation seed (high 8 bits via R/G/B)
  INSTANCE_SEED_LO: 6,   // remaining 24 bits = 48 bits total instance space
  ROLL_DAY:    7,   // world day at first instantiation (mod 65536, packed in R+G)

  // ── Physical / visual (8-15) ─────────────────────────────────────────
  SIZE:        8,   // CreatureSize enum index
  BUILD:       9,   // build variant
  PALETTE_SKIN_OR_COAT: 10,
  PALETTE_HAIR_OR_FUR:  11,
  PALETTE_EYE: 12,
  PALETTE_ACCENT: 13,
  POSE_FAMILY: 14,
  POSE_PROGRESS: 15,

  // ── Combat / vitality (16-22) — economy-load-bearing ────────────────
  HP_NORM:     16,  // hp_current / hp_max, 0-255
  HP_MAX_TIER: 17,  // index into HP-bracket catalog
  AC:          18,  // armor class
  ATTACK_MOD:  19,  // attack modifier (signed: subtract 128)
  DAMAGE_DICE: 20,  // index into dice-spec catalog ("1d8", "2d6+2", ...)
  STATUS_LOW:  21,  // status-effect bitmask (low 8)
  STATUS_HIGH: 22,  // status-effect bitmask (high 8)

  // ── Class / level / XP (23-26) — economy-load-bearing ───────────────
  LEVEL:       23,  // 1-255
  XP_LOW:      24,  // current XP (PC) / base XP awarded (NPC/monster) — low byte
  XP_HIGH:     25,  // high byte
  HIT_DICE:    26,  // remaining hit dice (rest mechanic)

  // ── Behavioral state (27-30) ─────────────────────────────────────────
  DISPOSITION: 27,  // hostile/wary/neutral/friendly/loyal
  INTENT_KIND: 28,  // attack/flee/patrol/wait/...
  INTENT_TARGET_LO: 29,  // target entity index, low byte
  INTENT_TARGET_HI: 30,  // high byte

  // ── Equipment (31-41) — 11 slots, contiguous (Layer 4.6 of pipeline) ─
  EQUIP_HEAD:      31,
  EQUIP_TORSO:     32,
  EQUIP_SHOULDERS: 33,
  EQUIP_ARMS:      34,
  EQUIP_HANDS:     35,
  EQUIP_WAIST:     36,
  EQUIP_LEGS:      37,
  EQUIP_FEET:      38,
  EQUIP_BACK:      39,
  EQUIP_MAIN_HAND: 40,
  EQUIP_OFF_HAND:  41,

  // ── Faction / social (42-45) ─────────────────────────────────────────
  FACTION:     42,  // primary faction index
  LOYALTY:     43,  // 0-255
  REPUTATION:  44,  // 0-255
  TITLE:       45,  // TitleRank enum

  // ── Identity for display (46-50) ─────────────────────────────────────
  NAME_POOL:   46,  // which culture's name pool
  NAME_SEED_LOW:  47,
  NAME_SEED_HIGH: 48,
  AGE_TIER:    49,  // young/adult/mature/old/ancient
  DIALECT:     50,  // speech style / morphology

  // ── Knowledge / perception (51-53) ───────────────────────────────────
  KNOWLEDGE_TIER: 51,
  LAST_SEEN_TARGET_LO: 52,
  LAST_SEEN_TARGET_HI: 53,

  // ── Reserved (54-63) — default RGB(0,0,0) means "feature absent" ────
  RESERVED_54: 54, RESERVED_55: 55, RESERVED_56: 56, RESERVED_57: 57,
  RESERVED_58: 58, RESERVED_59: 59, RESERVED_60: 60, RESERVED_61: 61,
  RESERVED_62: 62, RESERVED_63: 63,
} as const

export type SlotName = keyof typeof SLOT

// ============================================================
// DECODER MATRIX REGISTRY
// ============================================================

/**
 * One decoder matrix per slot. Most slots project a single channel
 * (R, G, or B) into a single value. Some slots use the full RGB triple
 * (e.g., a 24-bit packed value, or three independent palette indices).
 *
 * Total: 64 entries. Matrices are integer-coefficient — exact arithmetic.
 */
export const DECODERS: Record<number, DecoderMatrix> = {
  // Routing — all single 8-bit indices into catalogs
  [SLOT.KIND]:        READ_R,
  [SLOT.ARCHETYPE]:   READ_R,
  [SLOT.SUBTYPE]:     READ_R,
  [SLOT.RACE]:        READ_R,
  [SLOT.TIER]:        READ_R,

  // Instance identity — packed 24-bit
  [SLOT.INSTANCE_SEED_HI]: PACKED_24_MATRIX,
  [SLOT.INSTANCE_SEED_LO]: PACKED_24_MATRIX,
  [SLOT.ROLL_DAY]:     [[256, 1, 0]],   // R*256 + G = 16-bit world day

  // Physical / visual
  [SLOT.SIZE]:         READ_R,
  [SLOT.BUILD]:        READ_R,
  [SLOT.PALETTE_SKIN_OR_COAT]: READ_RGB, // 3 indices: primary/secondary/tertiary
  [SLOT.PALETTE_HAIR_OR_FUR]:  READ_RGB,
  [SLOT.PALETTE_EYE]:  READ_RGB,
  [SLOT.PALETTE_ACCENT]: READ_RGB,
  [SLOT.POSE_FAMILY]:  READ_R,
  [SLOT.POSE_PROGRESS]: READ_R,

  // Combat / vitality
  [SLOT.HP_NORM]:      READ_R,
  [SLOT.HP_MAX_TIER]:  READ_R,
  [SLOT.AC]:           READ_R,
  [SLOT.ATTACK_MOD]:   READ_R,           // caller subtracts 128 for signed
  [SLOT.DAMAGE_DICE]:  READ_R,
  [SLOT.STATUS_LOW]:   READ_R,
  [SLOT.STATUS_HIGH]:  READ_R,

  // Class / level / XP
  [SLOT.LEVEL]:        READ_R,
  [SLOT.XP_LOW]:       READ_R,
  [SLOT.XP_HIGH]:      READ_R,
  [SLOT.HIT_DICE]:     READ_R,

  // Behavioral state
  [SLOT.DISPOSITION]:  READ_R,
  [SLOT.INTENT_KIND]:  READ_R,
  [SLOT.INTENT_TARGET_LO]: READ_R,
  [SLOT.INTENT_TARGET_HI]: READ_R,

  // Equipment — each holds an item composition index (catalog lookup for now;
  // will become a prime-composition number once weapon/armor periodic tables land)
  [SLOT.EQUIP_HEAD]:      PACKED_24_MATRIX,
  [SLOT.EQUIP_TORSO]:     PACKED_24_MATRIX,
  [SLOT.EQUIP_SHOULDERS]: PACKED_24_MATRIX,
  [SLOT.EQUIP_ARMS]:      PACKED_24_MATRIX,
  [SLOT.EQUIP_HANDS]:     PACKED_24_MATRIX,
  [SLOT.EQUIP_WAIST]:     PACKED_24_MATRIX,
  [SLOT.EQUIP_LEGS]:      PACKED_24_MATRIX,
  [SLOT.EQUIP_FEET]:      PACKED_24_MATRIX,
  [SLOT.EQUIP_BACK]:      PACKED_24_MATRIX,
  [SLOT.EQUIP_MAIN_HAND]: PACKED_24_MATRIX,
  [SLOT.EQUIP_OFF_HAND]:  PACKED_24_MATRIX,

  // Faction / social
  [SLOT.FACTION]:      READ_R,
  [SLOT.LOYALTY]:      READ_R,
  [SLOT.REPUTATION]:   READ_R,
  [SLOT.TITLE]:        READ_R,

  // Identity
  [SLOT.NAME_POOL]:    READ_R,
  [SLOT.NAME_SEED_LOW]:  READ_R,
  [SLOT.NAME_SEED_HIGH]: READ_R,
  [SLOT.AGE_TIER]:     READ_R,
  [SLOT.DIALECT]:      READ_R,

  // Knowledge / perception
  [SLOT.KNOWLEDGE_TIER]: READ_R,
  [SLOT.LAST_SEEN_TARGET_LO]: READ_R,
  [SLOT.LAST_SEEN_TARGET_HI]: READ_R,
}

// ============================================================
// CATALOGS — Phase-0 stub enums for the demo
// ============================================================
//
// These are tiny enumerations sufficient to render one goblin in the demo.
// Real catalogs grow per binding (RACE → engine/race.ts RACE_CATALOG, etc.)
// without breaking the disc spec.

export enum Kind {
  Unknown    = 0,
  PC         = 1,
  NPC        = 2,
  Monster    = 3,
  Beast      = 4,
  Construct  = 5,
  Vegetation = 6,
  Item       = 7,
  Structure  = 8,
}

export enum MonsterArchetype {
  Unknown   = 0,
  Goblin    = 1,
  Bear      = 2,
  Wolf      = 3,
  Skeleton  = 4,
  Bandit    = 5,
  Dragon    = 6,
}

export enum CreatureSizeIdx {
  Tiny = 0, Small = 1, Medium = 2, Large = 3, Huge = 4, Gargantuan = 5,
}

export enum BuildIdx {
  Slim = 0, Average = 1, Stout = 2, Hulking = 3,
}

export enum PoseFamily {
  Idle = 0, Combat = 1, Sneaking = 2, Fleeing = 3, Dead = 4, Converse = 5, Sleep = 6,
}

export enum Disposition {
  Hostile = 0, Wary = 1, Neutral = 2, Friendly = 3, Loyal = 4,
}

export enum Intent {
  None = 0, Attack = 1, Flee = 2, Patrol = 3, Wait = 4, Hunt = 5, Converse = 6, Sleep = 7,
}

// ============================================================
// METRIC TABLES — tile-relative sizing
// ============================================================
//
// THE GRID IS THE UNIT OF MEASURE. One tile = 5 ft (D&D 5e standard).
// Creature size category determines:
//   - footprint: how many tiles the creature occupies (movement, blocking, LOS)
//   - visual scale: how tall/wide the rendered mesh is (× tileSize)
//
// Same category in both. Footprint and visual scale are bound by physics
// (a Large creature is 2×2 squares because it's bigger than 1 tile).

/** Tiles per side of the creature's footprint block (1 = 1×1, 2 = 2×2, etc.) */
export const CREATURE_FOOTPRINT: Record<CreatureSizeIdx, number> = {
  [CreatureSizeIdx.Tiny]:       1,   // counts as 1 for collision (sub-tile placement is positional)
  [CreatureSizeIdx.Small]:      1,
  [CreatureSizeIdx.Medium]:     1,
  [CreatureSizeIdx.Large]:      2,   // 2×2 = 4 tiles
  [CreatureSizeIdx.Huge]:       3,   // 3×3 = 9 tiles
  [CreatureSizeIdx.Gargantuan]: 4,   // 4×4 = 16 tiles
}

/** Visual mesh scale, in multiples of tileSize. Medium = exactly 1 tile tall. */
export const CREATURE_VISUAL_SCALE: Record<CreatureSizeIdx, number> = {
  [CreatureSizeIdx.Tiny]:       0.40,
  [CreatureSizeIdx.Small]:      0.75,  // goblin, halfling, gnome
  [CreatureSizeIdx.Medium]:     1.00,  // human, elf, orc
  [CreatureSizeIdx.Large]:      2.00,  // bear, ogre
  [CreatureSizeIdx.Huge]:       3.00,  // hill giant
  [CreatureSizeIdx.Gargantuan]: 4.00,  // adult dragon, tarrasque
}

/**
 * Grid-snap offset for an entity's footprint.
 *
 *   - Odd footprint  (1×1, 3×3)   → anchored on a tile CENTER          → offset 0
 *   - Even footprint (2×2, 4×4)   → anchored on a 4-tile SHARED CORNER → offset 0.5 × tileSize
 *
 * Apply to the entity's render position so the disc circle sits inside the
 * boundary of the squares it claims, regardless of size category.
 */
export function snapOffsetForFootprint(footprint: number, tileSize: number): number {
  return (footprint % 2 === 0) ? 0.5 * tileSize : 0
}

/**
 * KIND → base-disc tint (RGB 0..1). The mini's base is masked with this
 * color at render time so the player reads the creature's broad category
 * at a glance: red = hostile monster, green = PC, blue = NPC, brown = beast.
 *
 * The actual 64-wedge data lives underneath; debug toggle reveals it.
 *
 * Phase-0 palette. Will get richer as designer conventions emerge
 * (faction overlays, status-effect rings, stealth dimming, etc.).
 */
export const KIND_TINT: Record<Kind, [number, number, number]> = {
  [Kind.Unknown]:    [0.50, 0.50, 0.55],   // neutral grey
  [Kind.PC]:         [0.40, 0.80, 0.45],   // green — player-controlled
  [Kind.NPC]:        [0.45, 0.65, 0.95],   // blue — civilian / friendly
  [Kind.Monster]:    [0.85, 0.25, 0.20],   // red — hostile
  [Kind.Beast]:      [0.62, 0.45, 0.30],   // brown — animal
  [Kind.Construct]:  [0.65, 0.65, 0.72],   // metallic — golem / automaton
  [Kind.Vegetation]: [0.40, 0.70, 0.30],   // plant green — awakened tree, etc.
  [Kind.Item]:       [0.55, 0.45, 0.30],   // brown — loot pile
  [Kind.Structure]:  [0.50, 0.48, 0.45],   // stone grey — building, statue
}
