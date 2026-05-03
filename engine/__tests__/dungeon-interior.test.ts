/**
 * DUNGEON INTERIOR TESTS
 * =======================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateDungeonInterior, resolveRoom, resolveDungeon,
  resetInteriorIdCounter,
  type DungeonInterior, type DungeonRoom,
} from '../dungeon-interior'

beforeEach(() => {
  resetInteriorIdCounter()
})

// Standard d20 seeds for deterministic tests
const SEEDS = [10, 5, 15, 3, 18, 7, 12, 1, 20, 9, 6, 14, 8, 17, 2]

// ============================================================
// GENERATION
// ============================================================

describe('Dungeon Generation', () => {
  it('generates correct room count for tier 1', () => {
    const interior = generateDungeonInterior('gate_1', 1, 'lair', 'goblin', 100, 0, SEEDS)
    expect(interior.totalRooms).toBeGreaterThanOrEqual(3)
    expect(interior.totalRooms).toBeLessThanOrEqual(5)
    expect(interior.rooms).toHaveLength(interior.totalRooms)
  })

  it('generates more rooms for higher tiers', () => {
    const tier1 = generateDungeonInterior('g1', 1, 'lair', 'goblin', 100, 0, SEEDS)
    const tier5 = generateDungeonInterior('g5', 5, 'portal', 'fire_elemental', 100, 0, SEEDS)
    expect(tier5.totalRooms).toBeGreaterThan(tier1.totalRooms)
  })

  it('first room is always entrance, last is always boss', () => {
    const interior = generateDungeonInterior('gate_1', 2, 'ruin', 'skeleton', 100, 0, SEEDS)
    expect(interior.rooms[0].type).toBe('entrance')
    expect(interior.rooms[interior.rooms.length - 1].type).toBe('boss_chamber')
  })

  it('rooms are connected linearly', () => {
    const interior = generateDungeonInterior('gate_1', 2, 'lair', 'goblin', 100, 0, SEEDS)
    for (let i = 0; i < interior.rooms.length - 1; i++) {
      expect(interior.rooms[i].exits).toContain(interior.rooms[i + 1].id)
    }
  })

  it('boss room always has an encounter', () => {
    const interior = generateDungeonInterior('gate_1', 3, 'lair', 'orc', 100, 0, SEEDS)
    const bossRoom = interior.rooms.find(r => r.id === interior.bossRoom)!
    expect(bossRoom.encounter).toBeDefined()
    expect(bossRoom.encounter!.difficulty).toBe('boss')
  })

  it('respawn generation increases difficulty', () => {
    const gen0 = generateDungeonInterior('g1', 2, 'lair', 'goblin', 100, 0, SEEDS)
    const gen3 = generateDungeonInterior('g1', 2, 'lair', 'goblin', 200, 3, SEEDS)

    // Generation 3 has 1.2^3 = 1.728× encounter budget
    expect(gen3.totalEncounterCR).toBeGreaterThan(gen0.totalEncounterCR)
  })

  it('applies gate type flavor', () => {
    const ruin = generateDungeonInterior('g1', 2, 'ruin', 'skeleton', 100, 0, SEEDS)
    const corruption = generateDungeonInterior('g2', 2, 'corruption', 'gibbering_mouther', 100, 0, SEEDS)

    // Ruin rooms should have dim lighting
    expect(ruin.rooms[0].lighting).toBe('dim')
    // Corruption rooms should also have dim
    expect(corruption.rooms[0].lighting).toBe('dim')
  })

  it('has loot', () => {
    const interior = generateDungeonInterior('g1', 3, 'lair', 'orc', 100, 0, SEEDS)
    expect(interior.totalLootGP).toBeGreaterThan(0)

    const roomsWithLoot = interior.rooms.filter(r => r.loot)
    expect(roomsWithLoot.length).toBeGreaterThan(0)
  })
})

// ============================================================
// ROOM CONTENT
// ============================================================

describe('Room Content', () => {
  it('encounter species matches gate species', () => {
    const interior = generateDungeonInterior('g1', 2, 'lair', 'goblin', 100, 0, SEEDS)
    const roomsWithEncounters = interior.rooms.filter(r => r.encounter)

    for (const room of roomsWithEncounters) {
      expect(room.encounter!.speciesId).toBe('goblin')
    }
  })

  it('traps have valid stats', () => {
    const interior = generateDungeonInterior('g1', 3, 'ruin', 'skeleton', 100, 0, SEEDS)
    const roomsWithTraps = interior.rooms.filter(r => r.trap)

    for (const room of roomsWithTraps) {
      expect(room.trap!.detectDC).toBeGreaterThanOrEqual(10)
      expect(room.trap!.disarmDC).toBeGreaterThan(room.trap!.detectDC)
      expect(room.trap!.triggered).toBe(false)
      expect(room.trap!.disarmed).toBe(false)
    }
  })

  it('puzzles have valid categories', () => {
    const interior = generateDungeonInterior('g1', 2, 'ruin', 'skeleton', 100, 0, [5, 3, 7, 2, 14, 6, 11, 1, 19, 8])
    const roomsWithPuzzles = interior.rooms.filter(r => r.puzzle)

    for (const room of roomsWithPuzzles) {
      expect(['combination_lock', 'sequence', 'spatial', 'logic', 'word', 'physical']).toContain(room.puzzle!.category)
      expect(room.puzzle!.solved).toBe(false)
    }
  })

  it('rooms have descriptive features', () => {
    const interior = generateDungeonInterior('g1', 2, 'portal', 'dretch', 100, 0, SEEDS)

    for (const room of interior.rooms) {
      expect(room.features.length).toBeGreaterThanOrEqual(1)
      expect(room.description).toBeTruthy()
    }
  })
})

// ============================================================
// ROOM RESOLUTION (NPC auto-clear)
// ============================================================

describe('Room Resolution', () => {
  it('strong party clears easy room', () => {
    const interior = generateDungeonInterior('g1', 1, 'lair', 'goblin', 100, 0, SEEDS)
    const room = interior.rooms.find(r => r.encounter)!

    const result = resolveRoom(room, 20, 5, 18) // Strong roll
    expect(result.success).toBe(true)
    expect(result.encounterDefeated).toBe(true)
    expect(room.cleared).toBe(true)
  })

  it('weak party fails hard room', () => {
    const interior = generateDungeonInterior('g1', 4, 'portal', 'fire_elemental', 100, 0, SEEDS)
    const bossRoom = interior.rooms.find(r => r.type === 'boss_chamber')!

    const result = resolveRoom(bossRoom, 3, 2, 2) // Very weak + bad roll
    expect(result.success).toBe(false)
    expect(result.casualties).toBeGreaterThan(0)
  })

  it('traps can be disarmed', () => {
    const room: DungeonRoom = {
      id: 'test_room', index: 1, type: 'trap_room', name: 'Trap Room',
      description: 'A trapped room',
      trap: {
        type: 'dart', detectDC: 12, disarmDC: 14, damage: '2d6',
        damageType: 'piercing', saveDC: 14, triggered: false, disarmed: false,
        description: 'Darts!',
      },
      exits: [], cleared: false, explored: false,
      lighting: 'dim', size: 'medium', features: ['dart holes'],
    }

    const result = resolveRoom(room, 10, 8, 18) // High roll + level = pass disarm DC
    expect(result.trapDisarmed || !result.trapTriggered).toBe(true)
  })
})

// ============================================================
// FULL DUNGEON RESOLUTION
// ============================================================

describe('Full Dungeon Resolution', () => {
  it('strong party full-clears a dungeon', () => {
    const interior = generateDungeonInterior('g1', 1, 'lair', 'goblin', 100, 0, SEEDS)
    const highRolls = Array(interior.totalRooms).fill(18)

    const result = resolveDungeon(interior, 25, 8, highRolls)
    expect(result.success).toBe(true)
    expect(result.bossDefeated).toBe(true)
    expect(result.roomsCleared).toBe(interior.totalRooms)
    expect(interior.state).toBe('cleared')
  })

  it('weak party partially clears before retreating', () => {
    const interior = generateDungeonInterior('g1', 4, 'portal', 'fire_elemental', 100, 0, SEEDS)
    const lowRolls = Array(interior.totalRooms).fill(3)

    const result = resolveDungeon(interior, 5, 2, lowRolls)
    // Should fail at some point
    expect(result.roomsCleared).toBeLessThan(interior.totalRooms)
    expect(interior.state).toBe('failed')
  })

  it('collects loot from cleared rooms', () => {
    const interior = generateDungeonInterior('g1', 2, 'lair', 'goblin', 100, 0, SEEDS)
    const highRolls = Array(interior.totalRooms).fill(16)

    const result = resolveDungeon(interior, 20, 6, highRolls)
    if (result.success) {
      expect(result.totalLoot).toBeGreaterThan(0)
    }
  })

  it('generates meaningful narrative', () => {
    const interior = generateDungeonInterior('g1', 1, 'lair', 'goblin', 100, 0, SEEDS)
    const rolls = Array(interior.totalRooms).fill(15)

    const result = resolveDungeon(interior, 15, 5, rolls)
    expect(result.narrative).toBeTruthy()
    expect(result.narrative.length).toBeGreaterThan(20)
  })
})

// ============================================================
// INTEGRATION: Gate → Interior → Resolution
// ============================================================

describe('Gate-Interior Integration', () => {
  it('tier matches between gate and interior', () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const interior = generateDungeonInterior(`gate_${tier}`, tier, 'lair', 'goblin', 100, 0, SEEDS)
      expect(interior.tier).toBe(tier)
    }
  })

  it('all four gate types produce valid interiors', () => {
    const types = ['ruin', 'lair', 'portal', 'corruption'] as const
    for (const gateType of types) {
      const interior = generateDungeonInterior('g1', 2, gateType, 'test_species', 100, 0, SEEDS)
      expect(interior.rooms.length).toBeGreaterThanOrEqual(4)
      expect(interior.bossRoom).toBeTruthy()
      expect(interior.gateType).toBe(gateType)
    }
  })

  it('respawn generation 3 is meaningfully harder', () => {
    const gen0 = generateDungeonInterior('g1', 3, 'lair', 'orc', 100, 0, SEEDS)
    const gen3 = generateDungeonInterior('g1', 3, 'lair', 'orc', 200, 3, SEEDS)

    // 1.2^3 = 1.728× → the CR budget should be notably higher
    const ratio = gen3.totalEncounterCR / gen0.totalEncounterCR
    expect(ratio).toBeGreaterThan(1.3) // At least 1.3x harder
  })
})
