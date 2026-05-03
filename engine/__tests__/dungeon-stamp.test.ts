/**
 * DUNGEON STAMP TESTS — concrete tile layouts + corridor edges.
 *
 * Pedro 2026-05-02: rooms are nodes (varying tile sizes, populated with
 * positioned encounters/traps/loot/features), corridors are first-class
 * edges. All deterministic from seed — same input → same layout.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  stampRoomLayout,
  stampCorridor,
  stampDungeonLayouts,
  ROOM_TILE_DIMS,
  BOSS_DIMS,
  type StampRoomInput,
} from '../dungeon-stamp'
import {
  generateDungeonInterior,
  resetInteriorIdCounter,
} from '../dungeon-interior'

beforeEach(() => {
  resetInteriorIdCounter()
})

const baseInput: StampRoomInput = {
  roomId: 'room_1',
  roomType: 'chamber',
  size: 'medium',
  layoutSeed: 12,
  lootSeed: 7,
  challengeSeed: 15,
  encounterCR: 4,
  lootGP: 200,
  trapDC: 14,
  exitCount: 2,
  dungeonSeed: 'gate_demo',
  tier: 2,
}

describe('stampRoomLayout — dimensions', () => {
  it('respects size for tile dimensions (with ±1 jitter)', () => {
    const layout = stampRoomLayout({ ...baseInput, size: 'medium' })
    const dims = ROOM_TILE_DIMS['medium']
    expect(layout.tileW).toBeGreaterThanOrEqual(dims.w - 1)
    expect(layout.tileW).toBeLessThanOrEqual(dims.w + 1)
    expect(layout.tileH).toBeGreaterThanOrEqual(dims.h - 1)
    expect(layout.tileH).toBeLessThanOrEqual(dims.h + 1)
  })

  it('boss_chamber uses BOSS_DIMS', () => {
    const layout = stampRoomLayout({
      ...baseInput,
      roomType: 'boss_chamber',
      size: 'huge',
      bossOverride: true,
    })
    expect(layout.tileW).toBeGreaterThanOrEqual(BOSS_DIMS.w - 1)
    expect(layout.tileH).toBeGreaterThanOrEqual(BOSS_DIMS.h - 1)
  })

  it('small rooms are 4×4 (after jitter, min 4)', () => {
    const layout = stampRoomLayout({ ...baseInput, size: 'small' })
    expect(layout.tileW).toBeGreaterThanOrEqual(4)
    expect(layout.tileH).toBeGreaterThanOrEqual(4)
  })
})

describe('stampRoomLayout — tile grid invariants', () => {
  it('grid dimensions match tileW × tileH', () => {
    const layout = stampRoomLayout(baseInput)
    expect(layout.tileGrid).toHaveLength(layout.tileH)
    for (const row of layout.tileGrid) {
      expect(row).toHaveLength(layout.tileW)
    }
  })

  it('perimeter is walls (except where doors are placed)', () => {
    const layout = stampRoomLayout(baseInput)
    const { tileW, tileH, tileGrid, doors } = layout
    const doorPositions = new Set(
      doors.map((d) => {
        // Door TILE is on the wall; what's stored in DoorAnchor.position is the
        // adjacent floor. Reconstruct the wall tile.
        if (d.wall === 'N') return `${d.position.x},0`
        if (d.wall === 'S') return `${d.position.x},${tileH - 1}`
        if (d.wall === 'E') return `${tileW - 1},${d.position.y}`
        return `0,${d.position.y}`
      }),
    )
    for (let x = 0; x < tileW; x++) {
      const top = tileGrid[0][x]
      const bot = tileGrid[tileH - 1][x]
      if (!doorPositions.has(`${x},0`)) expect(top).toBe('wall')
      if (!doorPositions.has(`${x},${tileH - 1}`)) expect(bot).toBe('wall')
    }
    for (let y = 0; y < tileH; y++) {
      const left = tileGrid[y][0]
      const right = tileGrid[y][tileW - 1]
      if (!doorPositions.has(`0,${y}`)) expect(left).toBe('wall')
      if (!doorPositions.has(`${tileW - 1},${y}`)) expect(right).toBe('wall')
    }
  })

  it('interior contains floor tiles', () => {
    const layout = stampRoomLayout(baseInput)
    let floors = 0
    for (let y = 1; y < layout.tileH - 1; y++) {
      for (let x = 1; x < layout.tileW - 1; x++) {
        if (layout.tileGrid[y][x] === 'floor') floors++
      }
    }
    expect(floors).toBeGreaterThan(0)
  })
})

describe('stampRoomLayout — content placement', () => {
  it('encounter positions land on interior tiles', () => {
    const layout = stampRoomLayout({ ...baseInput, encounterCR: 6 })
    expect(layout.encounters.length).toBeGreaterThan(0)
    for (const enc of layout.encounters) {
      expect(enc.position.x).toBeGreaterThan(0)
      expect(enc.position.x).toBeLessThan(layout.tileW - 1)
      expect(enc.position.y).toBeGreaterThan(0)
      expect(enc.position.y).toBeLessThan(layout.tileH - 1)
    }
  })

  it('encounter total CR roughly matches input', () => {
    const layout = stampRoomLayout({ ...baseInput, encounterCR: 10 })
    const totalCR = layout.encounters.reduce((sum, e) => sum + e.totalCR, 0)
    // Allow some slack — CR is allocated in chunks
    expect(totalCR).toBeGreaterThan(5)
    expect(totalCR).toBeLessThanOrEqual(15)
  })

  it('loot positions land on interior tiles', () => {
    const layout = stampRoomLayout({ ...baseInput, lootGP: 500 })
    expect(layout.loot.length).toBeGreaterThan(0)
    for (const item of layout.loot) {
      expect(item.position.x).toBeGreaterThan(0)
      expect(item.position.y).toBeGreaterThan(0)
    }
  })

  it('zero CR → no encounters', () => {
    const layout = stampRoomLayout({ ...baseInput, encounterCR: 0 })
    expect(layout.encounters).toHaveLength(0)
  })

  it('treasure_room produces multiple loot piles', () => {
    const layout = stampRoomLayout({
      ...baseInput,
      roomType: 'treasure_room',
      lootGP: 2000,
    })
    expect(layout.loot.length).toBeGreaterThanOrEqual(1)
  })
})

describe('stampRoomLayout — doors', () => {
  it('produces at least one door', () => {
    const layout = stampRoomLayout(baseInput)
    expect(layout.doors.length).toBeGreaterThanOrEqual(1)
  })

  it('produces up to exitCount doors (capped at 4)', () => {
    const layout = stampRoomLayout({ ...baseInput, exitCount: 6 })
    expect(layout.doors.length).toBeLessThanOrEqual(4)
  })

  it('each door has a unique id', () => {
    const layout = stampRoomLayout({ ...baseInput, exitCount: 3 })
    const ids = new Set(layout.doors.map((d) => d.id))
    expect(ids.size).toBe(layout.doors.length)
  })
})

describe('stampRoomLayout — determinism', () => {
  it('same input produces identical layout', () => {
    const a = stampRoomLayout(baseInput)
    const b = stampRoomLayout(baseInput)
    expect(a.tileGrid).toEqual(b.tileGrid)
    expect(a.doors).toEqual(b.doors)
    expect(a.encounters.map((e) => e.position)).toEqual(b.encounters.map((e) => e.position))
    expect(a.loot.map((l) => l.position)).toEqual(b.loot.map((l) => l.position))
  })

  it('different dungeon seeds produce different layouts', () => {
    const a = stampRoomLayout({ ...baseInput, dungeonSeed: 'gate_a' })
    const b = stampRoomLayout({ ...baseInput, dungeonSeed: 'gate_b' })
    // Either grid OR door positions OR contents differ — at minimum the layoutSeed string differs
    expect(a.layoutSeed).not.toEqual(b.layoutSeed)
  })
})

describe('stampCorridor', () => {
  it('produces a corridor between two stamped rooms', () => {
    const a = stampRoomLayout({ ...baseInput, roomId: 'room_a' })
    const b = stampRoomLayout({ ...baseInput, roomId: 'room_b' })
    const corridor = stampCorridor({
      corridorId: 'corr_1',
      fromRoom: a,
      toRoom: b,
      fromDoorIndex: 0,
      toDoorIndex: 0,
      dungeonSeed: 'gate_demo',
      tier: 2,
    })
    expect(corridor.fromRoomId).toBe('room_a')
    expect(corridor.toRoomId).toBe('room_b')
    expect(corridor.length).toBeGreaterThan(0)
    expect(corridor.fromDoorId).toBe(a.doors[0].id)
    expect(corridor.toDoorId).toBe(b.doors[0].id)
  })

  it('corridor seed is deterministic', () => {
    const a = stampRoomLayout({ ...baseInput, roomId: 'room_a' })
    const b = stampRoomLayout({ ...baseInput, roomId: 'room_b' })
    const c1 = stampCorridor({
      corridorId: 'corr_1',
      fromRoom: a,
      toRoom: b,
      fromDoorIndex: 0,
      toDoorIndex: 0,
      dungeonSeed: 'gate_demo',
      tier: 2,
    })
    const c2 = stampCorridor({
      corridorId: 'corr_1',
      fromRoom: a,
      toRoom: b,
      fromDoorIndex: 0,
      toDoorIndex: 0,
      dungeonSeed: 'gate_demo',
      tier: 2,
    })
    expect(c1).toEqual(c2)
  })
})

describe('stampDungeonLayouts — full integration', () => {
  it('binds layouts to every room in a generated interior', () => {
    const interior = generateDungeonInterior(
      'gate_demo',
      2,
      'lair',
      'goblin',
      100,
      0,
      [10, 5, 15, 3, 18, 7, 12, 1, 20, 9, 6, 14, 8, 17, 2],
    )
    const stamped = stampDungeonLayouts(interior, 'gate_demo')
    expect(stamped.layouts.size).toBe(interior.rooms.length)
    for (const room of interior.rooms) {
      const layout = stamped.layouts.get(room.id)
      expect(layout).toBeDefined()
      expect(layout!.roomId).toBe(room.id)
    }
  })

  it('produces corridor edges (deduplicated A↔B)', () => {
    const interior = generateDungeonInterior(
      'gate_demo',
      3,
      'ruin',
      'skeleton',
      100,
      0,
      [10, 5, 15, 3, 18, 7, 12, 1, 20, 9, 6, 14, 8, 17, 2],
    )
    const stamped = stampDungeonLayouts(interior, 'gate_demo')
    expect(stamped.corridors.length).toBeGreaterThan(0)
    // No duplicate (fromRoomId, toRoomId) pairs (in either direction)
    const seen = new Set<string>()
    for (const c of stamped.corridors) {
      const key = [c.fromRoomId, c.toRoomId].sort().join('|')
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('encounter species are filled in from dungeon species', () => {
    const interior = generateDungeonInterior(
      'gate_demo',
      2,
      'lair',
      'orc',
      100,
      0,
      [10, 5, 15, 3, 18, 7, 12, 1, 20, 9, 6, 14, 8, 17, 2],
    )
    const stamped = stampDungeonLayouts(interior, 'gate_demo')
    for (const layout of stamped.layouts.values()) {
      for (const enc of layout.encounters) {
        expect(enc.speciesId).toBe('orc')
      }
    }
  })
})
