/**
 * Dungeon primitives — type system.
 *
 * The dungeon editor and runner both speak this vocabulary. Renderers (CSS
 * pattern, SVG, Gemini-generated image, etc.) are interchangeable behind the
 * same shape.
 *
 *   Level
 *     ↳ Tile[]            — 5ft square cells (D&D standard)
 *         ↳ Texture       — what the floor looks like
 *         ↳ Lighting      — bright / dim / dark
 *     ↳ Edge[]            — between adjacent tiles: solid wall / door / open
 *         ↳ Door (optional)
 *     ↳ Object[]          — placed on a tile (chest, statue, altar, brazier…)
 *     ↳ Hazard[]          — placed on a tile (pressure plate, glyph, pit…)
 *     ↳ Spawn[]           — encounter trigger + mob template
 *     ↳ Annotation[]      — DM-only notes
 *
 * Coords use {q, r} cell indices; pixel-space rendering multiplies by CELL_PX.
 * Z-stacking handled by Level.depth (negative = down).
 */

// ─── Geometry ───────────────────────────────────────────────────────────────

export interface CellCoord {
  q: number
  r: number
}

export type EdgeSide = 'N' | 'E' | 'S' | 'W'

export interface EdgeKey {
  q: number
  r: number
  side: EdgeSide
}

export const CELL_FT = 5             // D&D 5e cell = 5 feet
export const CELL_PX_DEFAULT = 56    // pixel size for screen render

// ─── Textures ──────────────────────────────────────────────────────────────

export type TextureKind =
  // ── Dungeon · stone & wood ─────────────────────────────────────────────
  | 'stone-smooth'
  | 'stone-rough'
  | 'stone-mossy'
  | 'stone-cracked'
  | 'wood-plank'
  | 'wood-charred'
  // ── Earth & natural ────────────────────────────────────────────────────
  | 'earth-packed'
  | 'mud'
  | 'gravel'
  | 'scree'
  | 'ash'
  // ── Water ──────────────────────────────────────────────────────────────
  | 'water-still'
  | 'water-flowing'
  | 'water-deep'
  | 'sea-foam'
  | 'wet-sand'
  // ── Outdoor wilderness ─────────────────────────────────────────────────
  | 'grass'
  | 'forest-leaf'
  | 'pine-needle'
  | 'jungle-floor'
  | 'marsh'
  | 'snow'
  | 'ice'
  | 'sand'
  | 'dunes'
  // ── City · urban ───────────────────────────────────────────────────────
  | 'cobblestone'
  | 'brick-red'
  | 'brick-tan'
  | 'paved-road'
  | 'sewer-tile'
  | 'slate-roof'
  | 'tile-clay-roof'
  | 'market-canvas'
  // ── Interior · noble / refined ─────────────────────────────────────────
  | 'marble-white'
  | 'marble-black'
  | 'parquet'
  | 'cloth-rug'
  | 'tile-mosaic'
  | 'hearth-stone'
  // ── Metal · forge / industrial ─────────────────────────────────────────
  | 'metal-grate'
  | 'metal-plate'
  // ── Ruins ──────────────────────────────────────────────────────────────
  | 'overgrown-stone'
  | 'collapsed-floor'
  // ── Underdark ──────────────────────────────────────────────────────────
  | 'glowing-fungus'
  | 'drow-tile'
  // ── Planar / magical ───────────────────────────────────────────────────
  | 'arcane-circle'
  | 'glyph-floor'
  | 'ley-line'
  | 'ethereal-mist'
  | 'fire-plane'
  | 'lava'
  | 'void'
  | 'star-field'
  // ── Special / hazard ───────────────────────────────────────────────────
  | 'blood-pool'
  | 'frost-cracked'

/** A texture binding, swappable: CSS pattern now, generated image later. */
export interface Texture {
  kind: TextureKind
  /** When set, an actual image URL (e.g. Gemini output) overrides the CSS pattern. */
  imageUrl?: string
  /** Rotation in degrees (0/90/180/270) for tiling variety. */
  rotation?: 0 | 90 | 180 | 270
  /** Tint overlay for narrative fx (blood-stained, frost, etc.) */
  tint?: string
}

// ─── Lighting ──────────────────────────────────────────────────────────────

export type LightLevel = 'bright' | 'dim' | 'dark'

export interface LightSource {
  at: CellCoord
  type: 'torch' | 'candle' | 'sunshaft' | 'magical-orb' | 'brazier' | 'sconce'
  radiusBright: number    // in cells
  radiusDim: number       // in cells
  flicker?: boolean
  color?: string
}

// ─── Tiles & edges ─────────────────────────────────────────────────────────

export interface Tile {
  at: CellCoord
  texture: Texture
  light: LightLevel
  passable: boolean
  /** Difficult terrain costs 2× movement. */
  difficult?: boolean
  /** Cover bonus (0 = none, 2 = half, 5 = three-quarters, 99 = full). */
  cover?: 0 | 2 | 5 | 99
  /** DM annotation key (for Annotation[]). */
  noteId?: string
}

export type EdgeKind = 'open' | 'wall' | 'door' | 'window' | 'fence'

export interface Edge {
  at: EdgeKey
  kind: EdgeKind
  /** A wall blocks LoS by default; this overrides for special walls (curtain, etc.) */
  blocksLineOfSight?: boolean
}

// ─── Doors ─────────────────────────────────────────────────────────────────

export type DoorState = 'open' | 'closed' | 'locked' | 'stuck' | 'secret' | 'broken'

export interface Door {
  at: EdgeKey
  state: DoorState
  /** DC to detect if `state==='secret'`. */
  detectDC?: number
  /** DC to force / pick. */
  breakDC?: number
  pickDC?: number
  trapped?: boolean
  trapId?: string         // → Hazard.id
  material?: 'wood' | 'iron' | 'stone' | 'magical'
}

// ─── Objects (placed furniture / interactables) ────────────────────────────

export type ObjectKind =
  | 'chest'           // trappable, lockable, lootable
  | 'altar'
  | 'statue'
  | 'pillar'
  | 'table'
  | 'chair'
  | 'bed'
  | 'bookshelf'
  | 'brazier'
  | 'fountain'
  | 'lever'
  | 'button'
  | 'rune'
  | 'rubble'
  | 'corpse'
  | 'cage'
  | 'crate'

export interface DungeonObject {
  id: string
  at: CellCoord
  kind: ObjectKind
  facing?: 0 | 90 | 180 | 270
  label?: string
  loot?: { tableRef?: string; gp?: number; itemRefs?: string[] }
  interaction?: { description: string; triggersHazardId?: string; revealsDoorId?: string; toggles?: string }
  hp?: number             // for breakable objects
}

// ─── Hazards (traps + magical effects) ─────────────────────────────────────

export type HazardKind =
  | 'pressure-plate'
  | 'tripwire'
  | 'dart-trap'
  | 'falling-block'
  | 'pit'
  | 'spike-pit'
  | 'arrow-slit'
  | 'glyph'           // magical
  | 'symbol'          // magical
  | 'gas'
  | 'fire-jet'
  | 'ice-floor'
  | 'web'
  | 'illusion-floor'

export interface Hazard {
  id: string
  at: CellCoord
  kind: HazardKind
  detectDC: number
  disarmDC?: number
  saveType?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'
  saveDC?: number
  damageDice?: string     // '4d6'
  damageType?: string     // 'piercing'
  status?: 'armed' | 'disarmed' | 'sprung'
  recharge?: 'once' | 'short-rest' | 'long-rest' | 'always'
}

// ─── Encounter spawns ──────────────────────────────────────────────────────

export type SpawnTrigger =
  | { kind: 'on-enter'; cell: CellCoord }
  | { kind: 'on-noise'; cell: CellCoord; threshold: number }
  | { kind: 'on-time'; turn: number }
  | { kind: 'on-light'; cell: CellCoord }
  | { kind: 'manual' }

export interface Spawn {
  id: string
  /** The center cell where the encounter materializes. */
  origin: CellCoord
  /** Reference into monster_catalog (or NPC roster). */
  templateRef: string
  count: number
  /** Optional fixed positions; else random within radius. */
  positions?: CellCoord[]
  spawnRadius?: number
  trigger: SpawnTrigger
  behavior: 'guard' | 'patrol' | 'ambush' | 'flee' | 'idle' | 'boss'
  patrolPath?: CellCoord[]    // ordered cells visited cyclically
  alarmRange?: number          // cells from origin where alert spreads
  difficultyBand?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'
}

// ─── Annotations (DM-only notes on cells) ──────────────────────────────────

export interface Annotation {
  id: string
  at: CellCoord
  text: string
  visibility: 'dm-only' | 'reveal-on-discover' | 'always'
  tag?: 'lore' | 'hint' | 'history' | 'warning' | 'secret'
}

// ─── Tokens (the moveable chip + portrait) ────────────────────────────────

/**
 * A token is what *moves* on the grid during play — a PC, an NPC, a monster.
 * The chip is the geometric abstraction (ring frame + tone), the portrait is
 * the face inside (Gemini-generated at runtime, or undefined → fallback).
 */
export type TokenTone = 'ally' | 'party' | 'hostile' | 'neutral' | 'boss' | 'mystery'
export type ChipFrame = 'plain' | 'iron' | 'magical' | 'laurel'

export type TokenStatus =
  | 'poisoned' | 'frightened' | 'grappled' | 'prone' | 'restrained' | 'blinded'
  | 'charmed' | 'paralyzed' | 'stunned' | 'unconscious' | 'concentrating'
  | 'invisible' | 'flying' | 'bloodied'

export interface Token {
  id: string
  at: CellCoord
  /** Display name — "Kaelith", "Goblin 3", "Selvys". */
  name: string
  /** Two-letter fallback when no portrait is available yet. */
  initial?: string
  /** Drives ring color. */
  tone: TokenTone
  /** Frame style around the portrait. */
  frame?: ChipFrame
  /** URL to the portrait asset (Gemini Nano Banana output, or static). */
  portraitUrl?: string
  /** Current / max HP. The arc around the chip fills proportionally. */
  hp?: { current: number; max: number }
  /** Active status effects. Render as small markers at compass points. */
  status?: TokenStatus[]
  /** Size category — drives chip diameter relative to the cell. */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
  /** Whose token this is (for selection / control gating). */
  ownerId?: string
  /** Direction the token is facing (for stealth / cover lines). */
  facing?: 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315
}

// ─── Levels ────────────────────────────────────────────────────────────────

export interface DungeonLevel {
  id: string
  name: string
  depth: number                   // 0 = surface; -1 = first basement; +1 = above ground
  bounds: { qMin: number; qMax: number; rMin: number; rMax: number }
  tiles: Tile[]
  edges: Edge[]
  doors: Door[]
  objects: DungeonObject[]
  hazards: Hazard[]
  spawns: Spawn[]
  lights: LightSource[]
  annotations: Annotation[]
  /** Live tokens currently on the grid. PCs + NPCs + monsters in combat. */
  tokens?: Token[]
  /** Stairs / portals between levels. Each entry pairs two cells across levels. */
  links?: { fromCell: CellCoord; toLevelId: string; toCell: CellCoord; kind: 'stairs-up' | 'stairs-down' | 'pit' | 'portal' | 'ladder' }[]
}

export interface Dungeon {
  id: string
  name: string
  levels: DungeonLevel[]
  /** Where the engine should consider "the dungeon" rooted in the world topology. */
  topologyNodeId?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function cellKey(c: CellCoord): string {
  return `${c.q},${c.r}`
}

export function edgeKey(e: EdgeKey): string {
  return `${e.q},${e.r}:${e.side}`
}

export function neighbor(c: CellCoord, side: EdgeSide): CellCoord {
  switch (side) {
    case 'N': return { q: c.q, r: c.r - 1 }
    case 'S': return { q: c.q, r: c.r + 1 }
    case 'E': return { q: c.q + 1, r: c.r }
    case 'W': return { q: c.q - 1, r: c.r }
  }
}
