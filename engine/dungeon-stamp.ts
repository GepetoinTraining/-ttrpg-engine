/**
 * DUNGEON STAMP — Concrete room layouts + positioned contents + corridor edges
 * ===============================================================================
 *
 * Where `dungeon-interior.ts` describes the *aggregate* of a room (one
 * encounter, one trap, one loot, "size: huge" as a label), this module
 * produces the **playable layout**: a tile grid + positioned encounters +
 * positioned traps + positioned loot + corridors-as-edges between rooms.
 *
 * Pure compute, deterministic. Same `(roomSeed, dungeonSeed)` → same layout
 * every time. Engine math; no DB, no LLM. Used by the renderer surface to
 * draw a tile grid the player walks through.
 *
 * Architecture (per Pedro 2026-05-02):
 *   - Rooms are NODES. They have tile grids (small 4×4 → huge 16×16, boss
 *     up to 24×24), populated with positioned encounters/traps/loot.
 *   - Corridors are EDGES. They connect two rooms at specific door tiles
 *     on each room's wall. They have length, width, and their own hazards.
 *   - The same generator pattern will extend to hubs (houses-as-nodes,
 *     streets-as-edges) — see `dungeon-stamp` is to dungeons what the
 *     forthcoming `hub-stamp` will be to settlements.
 *
 * Determinism contract: any consumer (server replay, client render, audit
 * verify) calling `stampRoomLayout(seed)` with the same seed inputs gets
 * the same `RoomLayout`. No `Math.random()` anywhere — all rolls go through
 * `SeededRNG` from `hub-topology.ts`.
 */

import { z } from 'zod'
import { SeededRNG } from './hub-topology'
import {
  type RoomType,
  type EncounterDifficulty,
  type TrapType,
  type LootRarity,
  type LootItem,
} from './dungeon-interior'

// ============================================================
// TILE TYPES
// ============================================================

export const TileTypeSchema = z.enum([
  'floor',         // walkable
  'wall',          // blocks movement + LOS
  'door',          // walkable, may be locked
  'pillar',        // blocks movement, partial LOS, cover
  'pit',           // blocks movement (or fall damage)
  'water',         // walkable but slowed
  'rubble',        // walkable but slowed
  'altar',         // interactable (shrine type)
  'chest',         // loot container — interactable
  'rune',          // magical glyph — may be a trap
  'stairs_up',     // exit upward
  'stairs_down',   // descent
])
export type TileType = z.infer<typeof TileTypeSchema>

export interface TilePosition {
  x: number
  y: number
}

export type CardinalDirection = 'N' | 'E' | 'S' | 'W'

// ============================================================
// SIZE → DIMENSIONS
// ============================================================

/**
 * Tile dimensions per logical size. Boss rooms can exceed this via
 * `bossOverride: true` in `stampRoomLayout`.
 */
export const ROOM_TILE_DIMS: Record<'small' | 'medium' | 'large' | 'huge', { w: number; h: number }> = {
  small:  { w: 4,  h: 4  },
  medium: { w: 8,  h: 8  },
  large:  { w: 12, h: 12 },
  huge:   { w: 16, h: 16 },
}

/** Boss chambers get the largest envelope — non-rectangular variations possible in v2. */
export const BOSS_DIMS = { w: 24, h: 24 }

// ============================================================
// POSITIONED CONTENT
// ============================================================

export interface PositionedEncounter {
  id: string
  position: TilePosition
  speciesId: string
  count: number
  crEach: number
  totalCR: number
  difficulty: EncounterDifficulty
  behavior: 'ambush' | 'patrol' | 'guard' | 'sleeping' | 'feeding' | 'ritual'
  /** Spread radius in tiles — count > 1 mobs scatter around `position`. */
  spreadRadius: number
  avoidable: boolean
  avoidDC: number
}

export interface PositionedTrap {
  id: string
  position: TilePosition
  type: TrapType
  detectDC: number
  disarmDC: number
  damage: string
  damageType: string
  saveDC: number
  triggered: boolean
  disarmed: boolean
  description: string
}

export interface PositionedLoot {
  id: string
  position: TilePosition
  /** Container kind — drives the visible tile sprite. */
  container: 'chest' | 'corpse' | 'altar' | 'pile' | 'sack' | 'shelf'
  items: LootItem[]
  totalGPValue: number
  trapped: boolean
  hidden: boolean
  searchDC: number
}

export interface PositionedFeature {
  id: string
  position: TilePosition
  /** Visual + tactical (pillars block LOS; pools slow; altars are interactable). */
  kind: 'pillar' | 'altar' | 'pool' | 'rubble' | 'brazier' | 'statue' | 'banner' | 'rune'
  description: string
  /** Whether it blocks movement or LOS. */
  blocksMovement: boolean
  blocksLOS: boolean
}

export interface DoorAnchor {
  /** Wall the door sits on. */
  wall: CardinalDirection
  /** Tile on the floor adjacent to the door (where the player stands when crossing). */
  position: TilePosition
  /** Stable id so corridors can reference it. */
  id: string
  locked: boolean
  lockDC: number
}

// ============================================================
// ROOM LAYOUT (the concrete, tile-rasterized room)
// ============================================================

export interface RoomLayout {
  roomId: string
  roomType: RoomType
  size: 'small' | 'medium' | 'large' | 'huge'
  tileW: number
  tileH: number
  /** [y][x] indexed — `tileGrid[y][x]` is the tile at column x, row y. */
  tileGrid: TileType[][]
  /** Doors anchored on walls — corridors connect to these. */
  doors: DoorAnchor[]
  encounters: PositionedEncounter[]
  traps: PositionedTrap[]
  loot: PositionedLoot[]
  features: PositionedFeature[]
  /** Seed string used — for replay / audit. */
  layoutSeed: string
}

// ============================================================
// CORRIDOR (edge between two rooms)
// ============================================================

export interface DungeonCorridor {
  id: string
  fromRoomId: string
  toRoomId: string
  /** Door anchors on each room. */
  fromDoorId: string
  toDoorId: string
  /** Length in tiles (manhattan or routed; v1 = manhattan). */
  length: number
  /** Tile width (1 = narrow, 3 = wide hall). */
  width: number
  /** Hazards inside the corridor itself — usually 0 or 1 trap. */
  hazards: PositionedTrap[]
  /** Special features along the corridor. */
  features: ('locked_door' | 'gate' | 'collapse' | 'darkness' | 'magical_seal')[]
  /** Seed for replay. */
  corridorSeed: string
}

// ============================================================
// STAMP — produce a concrete RoomLayout from a logical room
// ============================================================

export interface StampRoomInput {
  roomId: string
  roomType: RoomType
  size: 'small' | 'medium' | 'large' | 'huge'
  /** d20 seed from `dungeon-mf.RoomSeed` — drives layout determinism. */
  layoutSeed: number
  /** d20 seed for loot density. */
  lootSeed: number
  /** d20 seed for encounter placement. */
  challengeSeed: number
  /** Aggregate encounter CR for this room (from dungeon-interior.RoomEncounter). */
  encounterCR: number
  /** Aggregate loot GP for this room. */
  lootGP: number
  /** Trap difficulty class baseline. */
  trapDC: number
  /** Number of corridor connections this room has (drives door count). */
  exitCount: number
  /** Outer dungeon seed string — combined into the layout seed. */
  dungeonSeed: string
  /** Tier — drives mob count + hazard density. */
  tier: 1 | 2 | 3 | 4 | 5
  /** When true, oversize the room to BOSS_DIMS regardless of `size`. */
  bossOverride?: boolean
}

/**
 * Generate the concrete tile grid + positioned contents for a room.
 *
 * Algorithm:
 *   1. Pick dimensions from size (or BOSS_DIMS for boss rooms).
 *   2. Initialize all-walls grid.
 *   3. Carve interior to floor (1-tile wall perimeter).
 *   4. Sprinkle features (pillars, pools, rubble) on interior tiles.
 *   5. Place doors on walls — `exitCount` doors distributed across walls.
 *   6. Place encounters on floor tiles (avoiding doors and features).
 *   7. Place traps on floor tiles (mostly between doors — kill zones).
 *   8. Place loot on floor tiles (often near features — chest beside altar).
 *
 * All placement uses the seeded RNG so the same input → same layout.
 */
export function stampRoomLayout(input: StampRoomInput): RoomLayout {
  const seedStr = `${input.dungeonSeed}|room:${input.roomId}|l${input.layoutSeed}|c${input.challengeSeed}|t${input.tier}`
  const rng = new SeededRNG(seedStr)

  // 1. Dimensions
  const dims =
    input.bossOverride || input.roomType === 'boss_chamber'
      ? BOSS_DIMS
      : ROOM_TILE_DIMS[input.size]

  // Apply ±1 jitter from layoutSeed so two same-size rooms aren't identical
  const jitterW = rng.rangeInt(0, 2)
  const jitterH = rng.rangeInt(0, 2)
  const tileW = Math.max(4, dims.w + jitterW - 1)
  const tileH = Math.max(4, dims.h + jitterH - 1)

  // 2. Initialize all walls
  const tileGrid: TileType[][] = []
  for (let y = 0; y < tileH; y++) {
    tileGrid.push(new Array(tileW).fill('wall' as TileType))
  }

  // 3. Carve interior (1-tile wall perimeter)
  for (let y = 1; y < tileH - 1; y++) {
    for (let x = 1; x < tileW - 1; x++) {
      tileGrid[y][x] = 'floor'
    }
  }

  // 4. Features — type-driven density
  const features: PositionedFeature[] = []
  const featureCount = featureCountFor(input.roomType, tileW, tileH, rng)
  for (let i = 0; i < featureCount; i++) {
    const pos = pickInteriorTile(tileGrid, rng)
    if (!pos) break
    const kind = pickFeatureKind(input.roomType, rng)
    const blocksMovement = kind === 'pillar' || kind === 'statue'
    const blocksLOS = kind === 'pillar' || kind === 'statue' || kind === 'banner'
    features.push({
      id: `feat_${input.roomId}_${i}`,
      position: pos,
      kind,
      description: featureDescription(kind, input.roomType),
      blocksMovement,
      blocksLOS,
    })
    if (kind === 'pillar') tileGrid[pos.y][pos.x] = 'pillar'
    if (kind === 'pool') tileGrid[pos.y][pos.x] = 'water'
    if (kind === 'rubble') tileGrid[pos.y][pos.x] = 'rubble'
    if (kind === 'altar') tileGrid[pos.y][pos.x] = 'altar'
    if (kind === 'rune') tileGrid[pos.y][pos.x] = 'rune'
  }

  // 5. Doors — distribute on walls
  const doors: DoorAnchor[] = []
  const wallChoices: CardinalDirection[] = ['N', 'E', 'S', 'W']
  const shuffledWalls = rng.shuffle(wallChoices)
  const exitCount = Math.max(1, Math.min(4, input.exitCount))
  for (let i = 0; i < exitCount; i++) {
    const wall = shuffledWalls[i % shuffledWalls.length]
    const door = placeDoor(tileGrid, wall, rng)
    if (door) {
      const id = `door_${input.roomId}_${i}`
      doors.push({
        id,
        wall,
        position: door,
        locked: rng.next() < 0.15, // 15% of doors are locked
        lockDC: 10 + Math.floor(rng.next() * 10),
      })
    }
  }

  // 6. Encounters — scatter mob groups across interior
  const encounters: PositionedEncounter[] = []
  if (input.encounterCR > 0) {
    const groupCount = encounterGroupCount(input.encounterCR, input.roomType, rng)
    let crRemaining = input.encounterCR
    for (let i = 0; i < groupCount && crRemaining > 0; i++) {
      const pos = pickInteriorTile(tileGrid, rng, doors)
      if (!pos) break
      const groupCR = i === groupCount - 1 ? crRemaining : crRemaining * (0.3 + rng.next() * 0.4)
      const crEach = pickCREach(groupCR, rng)
      const count = Math.max(1, Math.round(groupCR / crEach))
      const totalCR = crEach * count
      crRemaining -= totalCR
      encounters.push({
        id: `enc_${input.roomId}_${i}`,
        position: pos,
        speciesId: 'placeholder', // caller fills in from gate species table
        count,
        crEach,
        totalCR,
        difficulty: classifyDifficulty(totalCR, input.tier),
        behavior: pickBehavior(input.roomType, rng),
        spreadRadius: count > 1 ? 1 + Math.floor(rng.next() * 2) : 0,
        avoidable: input.roomType !== 'boss_chamber' && rng.next() < 0.3,
        avoidDC: 10 + Math.floor(rng.next() * 8),
      })
    }
  }

  // 7. Traps — concentrate near doors as kill zones
  const traps: PositionedTrap[] = []
  const trapCount = trapCountFor(input.roomType, input.tier, rng)
  for (let i = 0; i < trapCount; i++) {
    const pos = pickTrapTile(tileGrid, rng, doors)
    if (!pos) break
    const type = pickTrapType(input.roomType, rng)
    traps.push({
      id: `trap_${input.roomId}_${i}`,
      position: pos,
      type,
      detectDC: input.trapDC,
      disarmDC: input.trapDC + 2,
      damage: trapDamageDice(input.tier, rng),
      damageType: trapDamageType(type),
      saveDC: input.trapDC,
      triggered: false,
      disarmed: false,
      description: trapDescription(type),
    })
  }

  // 8. Loot — placed on chest tiles or near features
  const loot: PositionedLoot[] = []
  if (input.lootGP > 0) {
    const lootCount = lootCountFor(input.lootGP, input.roomType, rng)
    let gpRemaining = input.lootGP
    for (let i = 0; i < lootCount && gpRemaining > 0; i++) {
      const pos = pickInteriorTile(tileGrid, rng, doors)
      if (!pos) break
      const lootGP = i === lootCount - 1 ? gpRemaining : gpRemaining * (0.4 + rng.next() * 0.4)
      gpRemaining -= lootGP
      const container = pickLootContainer(input.roomType, rng)
      const items = generateLootItems(lootGP, input.tier, rng, `${input.roomId}_${i}`)
      loot.push({
        id: `loot_${input.roomId}_${i}`,
        position: pos,
        container,
        items,
        totalGPValue: items.reduce((sum, it) => sum + it.gpValue, 0),
        trapped: rng.next() < 0.1,
        hidden: rng.next() < 0.3,
        searchDC: 10 + Math.floor(rng.next() * 8),
      })
      if (container === 'chest') tileGrid[pos.y][pos.x] = 'chest'
    }
  }

  return {
    roomId: input.roomId,
    roomType: input.roomType,
    size: input.size,
    tileW,
    tileH,
    tileGrid,
    doors,
    encounters,
    traps,
    loot,
    features,
    layoutSeed: seedStr,
  }
}

// ============================================================
// STAMP — produce a corridor edge between two stamped rooms
// ============================================================

export interface StampCorridorInput {
  corridorId: string
  fromRoom: RoomLayout
  toRoom: RoomLayout
  /** Door indices to connect — caller picks which exits link. */
  fromDoorIndex: number
  toDoorIndex: number
  dungeonSeed: string
  tier: 1 | 2 | 3 | 4 | 5
}

export function stampCorridor(input: StampCorridorInput): DungeonCorridor {
  const seedStr = `${input.dungeonSeed}|corridor:${input.corridorId}|t${input.tier}`
  const rng = new SeededRNG(seedStr)
  const fromDoor = input.fromRoom.doors[input.fromDoorIndex]
  const toDoor = input.toRoom.doors[input.toDoorIndex]
  if (!fromDoor || !toDoor) {
    throw new Error(`stampCorridor: invalid door index for ${input.corridorId}`)
  }
  const length = 3 + rng.rangeInt(0, 8) + input.tier
  const width = rng.next() < 0.7 ? 1 : 1 + rng.rangeInt(1, 2)

  const hazards: PositionedTrap[] = []
  if (rng.next() < 0.25) {
    const trapPos = { x: Math.floor(length / 2), y: 0 }
    hazards.push({
      id: `corridor_trap_${input.corridorId}`,
      position: trapPos,
      type: pickTrapType('corridor', rng),
      detectDC: 10 + input.tier * 2,
      disarmDC: 12 + input.tier * 2,
      damage: trapDamageDice(input.tier, rng),
      damageType: 'piercing',
      saveDC: 10 + input.tier * 2,
      triggered: false,
      disarmed: false,
      description: 'A pressure plate in the floor.',
    })
  }

  const features: DungeonCorridor['features'] = []
  if (fromDoor.locked || toDoor.locked) features.push('locked_door')
  if (rng.next() < 0.15) features.push('darkness')
  if (rng.next() < 0.05) features.push('collapse')

  return {
    id: input.corridorId,
    fromRoomId: input.fromRoom.roomId,
    toRoomId: input.toRoom.roomId,
    fromDoorId: fromDoor.id,
    toDoorId: toDoor.id,
    length,
    width,
    hazards,
    features,
    corridorSeed: seedStr,
  }
}

// ============================================================
// HELPERS — placement, feature/trap pickers, dice
// ============================================================

function featureCountFor(type: RoomType, tileW: number, tileH: number, rng: SeededRNG): number {
  const area = tileW * tileH
  const baseDensity =
    type === 'boss_chamber' ? 0.06 :
    type === 'lair' ? 0.05 :
    type === 'shrine' ? 0.04 :
    type === 'treasure_room' ? 0.03 :
    type === 'entrance' ? 0.02 :
    0.025
  return Math.round(area * baseDensity * (0.7 + rng.next() * 0.6))
}

function pickFeatureKind(type: RoomType, rng: SeededRNG): PositionedFeature['kind'] {
  const pools: Record<RoomType, PositionedFeature['kind'][]> = {
    entrance: ['pillar', 'rubble', 'banner'],
    corridor: ['rubble'],
    chamber: ['pillar', 'rubble', 'brazier'],
    trap_room: ['pillar', 'rubble', 'rune'],
    treasure_room: ['pillar', 'altar', 'banner'],
    shrine: ['altar', 'pool', 'brazier', 'statue'],
    lair: ['rubble', 'banner', 'pool'],
    boss_chamber: ['pillar', 'altar', 'banner', 'statue', 'brazier'],
    dead_end: ['rubble'],
    junction: ['pillar'],
  }
  const pool = pools[type] ?? ['pillar']
  return rng.pick(pool)
}

function featureDescription(kind: PositionedFeature['kind'], type: RoomType): string {
  switch (kind) {
    case 'pillar': return type === 'boss_chamber' ? 'A massive obsidian column.' : 'A weathered stone pillar.'
    case 'altar':  return 'A blood-stained altar.'
    case 'pool':   return 'A pool of murky water.'
    case 'rubble': return 'A pile of fallen masonry.'
    case 'brazier':return 'A bronze brazier, embers smoldering.'
    case 'statue': return 'A defaced stone statue.'
    case 'banner': return 'A tattered banner hangs from the ceiling.'
    case 'rune':   return 'A glowing arcane rune etched in the floor.'
  }
}

function pickInteriorTile(
  grid: TileType[][],
  rng: SeededRNG,
  avoidDoors: DoorAnchor[] = [],
): TilePosition | null {
  const tileH = grid.length
  const tileW = grid[0].length
  const candidates: TilePosition[] = []
  for (let y = 1; y < tileH - 1; y++) {
    for (let x = 1; x < tileW - 1; x++) {
      if (grid[y][x] !== 'floor') continue
      // Skip tiles directly adjacent to doors (keep approach tiles clear)
      if (avoidDoors.some((d) => Math.abs(d.position.x - x) + Math.abs(d.position.y - y) <= 1)) continue
      candidates.push({ x, y })
    }
  }
  if (candidates.length === 0) return null
  return rng.pick(candidates)
}

function placeDoor(grid: TileType[][], wall: CardinalDirection, rng: SeededRNG): TilePosition | null {
  const tileH = grid.length
  const tileW = grid[0].length
  let wallTile: TilePosition
  let approach: TilePosition
  if (wall === 'N') {
    const x = 1 + rng.rangeInt(0, tileW - 3)
    wallTile = { x, y: 0 }
    approach = { x, y: 1 }
  } else if (wall === 'S') {
    const x = 1 + rng.rangeInt(0, tileW - 3)
    wallTile = { x, y: tileH - 1 }
    approach = { x, y: tileH - 2 }
  } else if (wall === 'E') {
    const y = 1 + rng.rangeInt(0, tileH - 3)
    wallTile = { x: tileW - 1, y }
    approach = { x: tileW - 2, y }
  } else {
    const y = 1 + rng.rangeInt(0, tileH - 3)
    wallTile = { x: 0, y }
    approach = { x: 1, y }
  }
  if (grid[approach.y]?.[approach.x] !== 'floor') return null
  grid[wallTile.y][wallTile.x] = 'door'
  return approach
}

function pickTrapTile(
  grid: TileType[][],
  rng: SeededRNG,
  doors: DoorAnchor[],
): TilePosition | null {
  // Bias toward tiles adjacent to door approaches (kill zones).
  if (doors.length > 0 && rng.next() < 0.6) {
    const door = rng.pick(doors)
    const candidates: TilePosition[] = []
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const x = door.position.x + dx
        const y = door.position.y + dy
        if (grid[y]?.[x] === 'floor') candidates.push({ x, y })
      }
    }
    if (candidates.length > 0) return rng.pick(candidates)
  }
  return pickInteriorTile(grid, rng, doors)
}

function encounterGroupCount(cr: number, type: RoomType, rng: SeededRNG): number {
  if (type === 'boss_chamber') return cr > 5 ? 2 : 1 // boss + adds
  if (cr <= 2) return 1
  if (cr <= 6) return rng.next() < 0.6 ? 1 : 2
  return 1 + rng.rangeInt(1, 3)
}

function pickCREach(groupCR: number, rng: SeededRNG): number {
  const variants = [0.25, 0.5, 1, 2, 3, 5, 8].filter((v) => v <= groupCR + 0.1)
  if (variants.length === 0) return Math.max(0.125, groupCR)
  return rng.pick(variants)
}

function classifyDifficulty(cr: number, tier: number): EncounterDifficulty {
  const partyEffective = tier * 4 // rough: party_size × tier_modifier
  if (cr < partyEffective * 0.5) return 'trivial'
  if (cr < partyEffective * 0.75) return 'easy'
  if (cr < partyEffective) return 'medium'
  if (cr < partyEffective * 1.5) return 'hard'
  if (cr < partyEffective * 2) return 'deadly'
  return 'boss'
}

function pickBehavior(type: RoomType, rng: SeededRNG): PositionedEncounter['behavior'] {
  const pools: Record<RoomType, PositionedEncounter['behavior'][]> = {
    entrance: ['guard', 'patrol'],
    corridor: ['patrol', 'ambush'],
    chamber: ['guard', 'patrol', 'sleeping'],
    trap_room: ['ambush'],
    treasure_room: ['guard'],
    shrine: ['ritual', 'guard'],
    lair: ['sleeping', 'feeding', 'guard'],
    boss_chamber: ['ritual', 'guard'],
    dead_end: ['sleeping'],
    junction: ['patrol'],
  }
  return rng.pick(pools[type] ?? ['guard'])
}

function trapCountFor(type: RoomType, tier: number, rng: SeededRNG): number {
  const base =
    type === 'trap_room' ? 2 + Math.floor(tier / 2) :
    type === 'boss_chamber' ? 1 :
    type === 'treasure_room' ? 1 + Math.floor(tier / 3) :
    type === 'corridor' ? 0 :
    rng.next() < 0.3 ? 1 : 0
  return Math.max(0, base)
}

function pickTrapType(type: RoomType | 'corridor', rng: SeededRNG): TrapType {
  const pool: TrapType[] =
    type === 'corridor' ? ['pit', 'dart', 'flame_jet', 'alarm'] :
    type === 'trap_room' ? ['pit', 'dart', 'poison_gas', 'collapsing', 'flame_jet', 'cage', 'magical_glyph'] :
    type === 'shrine' ? ['magical_glyph', 'teleport'] :
    ['pit', 'dart', 'alarm']
  return rng.pick(pool)
}

function trapDamageDice(tier: number, rng: SeededRNG): string {
  const count = tier + rng.rangeInt(0, 2)
  const sides = rng.pick([6, 8, 10])
  return `${count}d${sides}`
}

function trapDamageType(type: TrapType): string {
  const m: Record<TrapType, string> = {
    pit: 'bludgeoning',
    dart: 'piercing',
    poison_gas: 'poison',
    collapsing: 'bludgeoning',
    magical_glyph: 'force',
    alarm: 'psychic',
    cage: 'bludgeoning',
    flame_jet: 'fire',
    flooding: 'cold',
    teleport: 'force',
  }
  return m[type]
}

function trapDescription(type: TrapType): string {
  const m: Record<TrapType, string> = {
    pit: 'A loose floor panel concealing a deep pit.',
    dart: 'Tiny holes in the wall where poisoned darts fire.',
    poison_gas: 'Cracked vials seeping noxious vapor.',
    collapsing: 'Cracks in the ceiling threaten a cave-in.',
    magical_glyph: 'An arcane symbol pulsing on the floor.',
    alarm: 'Tripwires and rattles strung at ankle height.',
    cage: 'A spring-loaded cage rigged to drop from above.',
    flame_jet: 'Blackened nozzles flush with the wall.',
    flooding: 'Water-stained walls hint at a flooding mechanism.',
    teleport: 'A faintly glowing teleport circle.',
  }
  return m[type]
}

function lootCountFor(gp: number, type: RoomType, rng: SeededRNG): number {
  if (type === 'treasure_room' || type === 'boss_chamber') return 1 + rng.rangeInt(1, 3)
  if (gp < 50) return 1
  if (gp < 500) return 1 + rng.rangeInt(0, 2)
  return 1 + rng.rangeInt(1, 3)
}

function pickLootContainer(type: RoomType, rng: SeededRNG): PositionedLoot['container'] {
  const pools: Record<RoomType, PositionedLoot['container'][]> = {
    entrance: ['corpse', 'pile'],
    corridor: ['corpse', 'pile'],
    chamber: ['chest', 'corpse', 'shelf'],
    trap_room: ['chest'],
    treasure_room: ['chest', 'pile', 'shelf'],
    shrine: ['altar', 'pile'],
    lair: ['pile', 'corpse', 'sack'],
    boss_chamber: ['chest', 'altar', 'pile'],
    dead_end: ['corpse', 'pile'],
    junction: ['corpse'],
  }
  return rng.pick(pools[type] ?? ['chest'])
}

function generateLootItems(
  totalGP: number,
  tier: number,
  rng: SeededRNG,
  idPrefix: string,
): LootItem[] {
  const itemCount = 1 + rng.rangeInt(0, Math.min(4, Math.floor(totalGP / 100)))
  const items: LootItem[] = []
  let remaining = totalGP
  for (let i = 0; i < itemCount; i++) {
    const isLast = i === itemCount - 1
    const gp = isLast ? remaining : Math.round(remaining * (0.3 + rng.next() * 0.4))
    remaining -= gp
    const rarity = pickRarity(gp)
    const itemType = rng.pick(['coin', 'gem', 'art_object', 'potion', 'scroll', 'weapon', 'armor'] as LootItem['type'][])
    items.push({
      id: `loot_item_${idPrefix}_${i}`,
      name: itemNameFor(itemType, rarity, rng),
      rarity,
      gpValue: gp,
      type: itemType,
      magical: rarity === 'rare' || rarity === 'very_rare' || rarity === 'legendary',
      description: '',
    })
  }
  return items
}

function pickRarity(gp: number): LootRarity {
  if (gp < 50) return 'common'
  if (gp < 200) return 'uncommon'
  if (gp < 1000) return 'rare'
  if (gp < 5000) return 'very_rare'
  return 'legendary'
}

function itemNameFor(type: LootItem['type'], rarity: LootRarity, rng: SeededRNG): string {
  const adj = rng.pick(['Tarnished', 'Ancient', 'Cracked', 'Gilded', 'Worn', 'Pristine', 'Forgotten'])
  const noun: Record<LootItem['type'], string[]> = {
    coin: ['coin pile', 'silver hoard', 'gold pouch'],
    gem: ['ruby', 'sapphire', 'emerald', 'amethyst', 'opal'],
    art_object: ['chalice', 'crown', 'figurine', 'ceremonial dagger'],
    potion: ['vial', 'flask', 'bottle'],
    scroll: ['scroll', 'parchment', 'tablet'],
    weapon: ['sword', 'axe', 'dagger', 'mace'],
    armor: ['shield', 'helm', 'breastplate', 'gauntlets'],
    reagent: ['herb pouch', 'crystal shard', 'rune stone'],
    key: ['iron key', 'brass key', 'silver key'],
  }
  return `${adj} ${rng.pick(noun[type])}`
}

// ============================================================
// BINDING — attach layouts + corridors to a generated DungeonInterior
// ============================================================

import type { DungeonInterior, DungeonRoom } from './dungeon-interior'

export interface StampedDungeon {
  interior: DungeonInterior
  /** Concrete layout per room (keyed by room id). */
  layouts: Map<string, RoomLayout>
  /** First-class edges between rooms. */
  corridors: DungeonCorridor[]
}

/**
 * Take a generated `DungeonInterior` (abstract — narrative rooms with `exits: string[]`)
 * and produce concrete tile layouts for every room + corridor edges between them.
 *
 * The narrative DungeonRoom stays untouched; renderers consume `layouts.get(roomId)`
 * for the grid view. Corridor edges replace `exits: string[]` as the canonical
 * adjacency representation.
 */
export function stampDungeonLayouts(
  interior: DungeonInterior,
  dungeonSeed: string,
): StampedDungeon {
  const layouts = new Map<string, RoomLayout>()

  for (const room of interior.rooms) {
    const layout = stampRoomLayout({
      roomId: room.id,
      roomType: room.type,
      size: room.size,
      layoutSeed: hashIdToSeed(room.id, 'layout'),
      lootSeed: hashIdToSeed(room.id, 'loot'),
      challengeSeed: hashIdToSeed(room.id, 'challenge'),
      encounterCR: room.encounter?.totalCR ?? 0,
      lootGP: room.loot?.totalGPValue ?? 0,
      trapDC: room.trap?.detectDC ?? 12,
      exitCount: Math.max(1, room.exits.length),
      dungeonSeed,
      tier: interior.tier,
      bossOverride: room.type === 'boss_chamber',
    })
    // Stamp the placeholder species with the dungeon's actual species.
    for (const enc of layout.encounters) enc.speciesId = interior.speciesId
    layouts.set(room.id, layout)
  }

  // Build corridors — dedupe room-A→room-B and room-B→room-A.
  const corridors: DungeonCorridor[] = []
  const seen = new Set<string>()
  for (const room of interior.rooms) {
    const fromLayout = layouts.get(room.id)
    if (!fromLayout) continue
    for (let i = 0; i < room.exits.length; i++) {
      const targetId = room.exits[i]
      const pairKey = [room.id, targetId].sort().join('|')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      const toLayout = layouts.get(targetId)
      if (!toLayout) continue
      // Pick the first available door on each room — caller can swap if needed.
      const fromDoorIndex = i % Math.max(1, fromLayout.doors.length)
      const toDoorIndex = pickReverseDoorIndex(toLayout, room.id)
      try {
        corridors.push(
          stampCorridor({
            corridorId: `corr_${pairKey}`,
            fromRoom: fromLayout,
            toRoom: toLayout,
            fromDoorIndex,
            toDoorIndex,
            dungeonSeed,
            tier: interior.tier,
          }),
        )
      } catch {
        // skip corridors that can't bind to doors (rare — small rooms)
      }
    }
  }

  return { interior, layouts, corridors }
}

/** Stable index hash so the door picked for the reverse direction differs from the forward one. */
function pickReverseDoorIndex(toLayout: RoomLayout, fromRoomId: string): number {
  if (toLayout.doors.length === 0) return 0
  let h = 0x811c9dc5
  for (let i = 0; i < fromRoomId.length; i++) {
    h ^= fromRoomId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % toLayout.doors.length
}

function hashIdToSeed(id: string, salt: string): number {
  const s = id + ':' + salt
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % 21 // d20 range (0-20)
}

/** Type-only re-export so consumers can import everything from `dungeon-stamp`. */
export type { DungeonRoom }
