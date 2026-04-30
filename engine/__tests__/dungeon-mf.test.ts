/**
 * DUNGEON MF TESTS — Seeder Loop + MM Stamp
 */

import { describe, it, expect } from 'vitest'
import {
  generateSeeder, stampRoom, stampAll,
  respawnSeeder, evaluateSeeder,
  type DungeonSeeder, type StampedRoom,
} from '../dungeon-mf.js'

// ============================================================
// SEEDER GENERATION
// ============================================================

describe('Seeder Generation', () => {
  it('creates correct number of seeds for tier 1', () => {
    const seeder = generateSeeder('gate_1', 1, 'lair', 'goblin', 0, 10)
    expect(seeder.seeds.length).toBeGreaterThanOrEqual(3)
    expect(seeder.seeds.length).toBeLessThanOrEqual(5)
  })

  it('creates more seeds for higher tiers', () => {
    const s1 = generateSeeder('g1', 1, 'lair', 'goblin', 0, 10)
    const s5 = generateSeeder('g5', 5, 'portal', 'demon', 0, 10)
    expect(s5.seeds.length).toBeGreaterThan(s1.seeds.length)
  })

  it('seed potentialCosts sum to 1.0', () => {
    const seeder = generateSeeder('g1', 3, 'ruin', 'skeleton', 0, 15)
    const sum = seeder.seeds.reduce((s, seed) => s + seed.potentialCost, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('all seed values are 0-1', () => {
    const seeder = generateSeeder('g1', 4, 'corruption', 'aberration', 0, 7)
    for (const seed of seeder.seeds) {
      expect(seed.layout).toBeGreaterThanOrEqual(0)
      expect(seed.layout).toBeLessThanOrEqual(1)
      expect(seed.loot).toBeGreaterThanOrEqual(0)
      expect(seed.loot).toBeLessThanOrEqual(1)
      expect(seed.challenge).toBeGreaterThanOrEqual(0)
      expect(seed.challenge).toBeLessThanOrEqual(1)
    }
  })

  it('entrance seed has layout=0, boss seed has layout=1', () => {
    const seeder = generateSeeder('g1', 2, 'lair', 'orc', 0, 12)
    expect(seeder.seeds[0].layout).toBe(0)
    expect(seeder.seeds[seeder.seeds.length - 1].layout).toBe(1)
  })

  it('challenge ramps upward (entrance < boss)', () => {
    const seeder = generateSeeder('g1', 3, 'lair', 'orc', 0, 10)
    const entrance = seeder.seeds[0]
    const boss = seeder.seeds[seeder.seeds.length - 1]
    expect(boss.challenge).toBeGreaterThan(entrance.challenge)
  })

  it('later rooms cost more potential', () => {
    const seeder = generateSeeder('g1', 3, 'ruin', 'skeleton', 0, 10)
    const firstCost = seeder.seeds[0].potentialCost
    const lastCost = seeder.seeds[seeder.seeds.length - 1].potentialCost
    expect(lastCost).toBeGreaterThan(firstCost)
  })

  it('is deterministic — same inputs → same output', () => {
    const a = generateSeeder('g1', 2, 'lair', 'goblin', 0, 14)
    const b = generateSeeder('g1', 2, 'lair', 'goblin', 0, 14)
    expect(a.seeds).toEqual(b.seeds)
    expect(a.encounterBudget).toBe(b.encounterBudget)
    expect(a.lootBudget).toBe(b.lootBudget)
  })

  it('different d20Seed → different layout distribution', () => {
    const a = generateSeeder('g1', 3, 'lair', 'goblin', 0, 5)
    const b = generateSeeder('g1', 3, 'lair', 'goblin', 0, 17)
    // Middle rooms should differ (entrance/boss are fixed)
    const midA = a.seeds[2]?.layout
    const midB = b.seeds[2]?.layout
    // They could technically be the same but φ distribution makes it very unlikely
    if (a.seeds.length > 3 && b.seeds.length > 3) {
      expect(midA !== midB || a.seeds.length !== b.seeds.length).toBe(true)
    }
  })
})

// ============================================================
// STAMP FUNCTION (MM)
// ============================================================

describe('Stamp Room (MM Function)', () => {
  it('stamps rooms one at a time consuming potential', () => {
    const seeder = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const room1 = stampRoom(seeder)
    expect(room1).not.toBeNull()
    expect(seeder.stamped).toBe(1)
    expect(seeder.remainingPotential).toBeLessThan(1.0)
  })

  it('returns null when all seeds consumed', () => {
    const seeder = generateSeeder('g1', 1, 'lair', 'goblin', 0, 10)
    // Stamp all
    while (stampRoom(seeder) !== null) { /* drain */ }
    const extra = stampRoom(seeder)
    expect(extra).toBeNull()
    expect(seeder.remainingPotential).toBeCloseTo(0, 3)
  })

  it('first room is entrance type', () => {
    const seeder = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const room = stampRoom(seeder)!
    expect(room.roomType).toBe('entrance')
  })

  it('last room is boss type', () => {
    const seeder = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const rooms = stampAll(seeder)
    const last = rooms[rooms.length - 1]
    expect(last.roomType).toBe('boss')
  })

  it('boss has highest encounter CR', () => {
    const seeder = generateSeeder('g1', 3, 'lair', 'orc', 0, 10)
    const rooms = stampAll(seeder)
    const boss = rooms[rooms.length - 1]
    const nonBoss = rooms.slice(0, -1)
    for (const r of nonBoss) {
      expect(boss.encounterCR).toBeGreaterThanOrEqual(r.encounterCR)
    }
  })

  it('potential exhausted after stamping all rooms', () => {
    const seeder = generateSeeder('g1', 3, 'ruin', 'skeleton', 0, 10)
    stampAll(seeder)
    expect(seeder.remainingPotential).toBeCloseTo(0, 3)
    expect(seeder.stamped).toBe(seeder.seeds.length)
  })

  it('boss room has 0 exits (dead end)', () => {
    const seeder = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const rooms = stampAll(seeder)
    expect(rooms[rooms.length - 1].exitCount).toBe(0)
  })

  it('lighting matches gate type', () => {
    const lair = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const portal = generateSeeder('g2', 2, 'portal', 'demon', 0, 10)

    const lairRooms = stampAll(lair)
    const portalRooms = stampAll(portal)

    expect(lairRooms[0].lighting).toBe('dark')
    expect(portalRooms[0].lighting).toBe('magical')
  })
})

// ============================================================
// STAMP ALL
// ============================================================

describe('Stamp All', () => {
  it('returns all rooms at once', () => {
    const seeder = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const expectedCount = seeder.seeds.length
    const rooms = stampAll(seeder)
    expect(rooms).toHaveLength(expectedCount)
  })

  it('rooms have ascending seedIndex', () => {
    const seeder = generateSeeder('g1', 3, 'ruin', 'skeleton', 0, 10)
    const rooms = stampAll(seeder)
    for (let i = 0; i < rooms.length; i++) {
      expect(rooms[i].seedIndex).toBe(i)
    }
  })

  it('total lootGP is proportional to budget', () => {
    const seeder = generateSeeder('g1', 3, 'ruin', 'skeleton', 0, 10)
    const rooms = stampAll(seeder)
    const totalLoot = rooms.reduce((s, r) => s + r.lootGP, 0)
    // Total won't exactly equal budget (because seeds distribute fractionally)
    // but should be in the right order of magnitude
    expect(totalLoot).toBeGreaterThan(0)
    expect(totalLoot).toBeLessThanOrEqual(seeder.lootBudget * 1.1)
  })
})

// ============================================================
// RESPAWN
// ============================================================

describe('Respawn Seeder', () => {
  it('increases generation by 1', () => {
    const original = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const respawn = respawnSeeder(original, 14)
    expect(respawn.generation).toBe(1)
  })

  it('has higher encounter budget (1.2×)', () => {
    const gen0 = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const gen1 = respawnSeeder(gen0, 14)
    expect(gen1.encounterBudget).toBeGreaterThan(gen0.encounterBudget)
  })

  it('has higher loot budget', () => {
    const gen0 = generateSeeder('g1', 3, 'ruin', 'skeleton', 0, 10)
    const gen1 = respawnSeeder(gen0, 8)
    expect(gen1.lootBudget).toBeGreaterThan(gen0.lootBudget)
  })

  it('respawn chain scales properly', () => {
    let seeder = generateSeeder('g1', 2, 'lair', 'goblin', 0, 10)
    const baseBudget = seeder.encounterBudget

    for (let i = 0; i < 5; i++) {
      seeder = respawnSeeder(seeder, 10 + i)
    }

    // 1.2^5 ≈ 2.488
    const ratio = seeder.encounterBudget / baseBudget
    expect(ratio).toBeGreaterThan(2.0)
    expect(ratio).toBeLessThan(3.0)
  })
})

// ============================================================
// EVALUATE (PEEK without stamping)
// ============================================================

describe('Evaluate Seeder', () => {
  it('evaluates without consuming potential', () => {
    const seeder = generateSeeder('g1', 3, 'lair', 'orc', 0, 10)
    const profile = evaluateSeeder(seeder)

    expect(seeder.stamped).toBe(0)
    expect(seeder.remainingPotential).toBe(1.0)
    expect(profile.totalCR).toBeGreaterThan(0)
  })

  it('totalCR reflects encounter budget', () => {
    const seeder = generateSeeder('g1', 3, 'lair', 'orc', 0, 10)
    const profile = evaluateSeeder(seeder)
    // Total CR should be in reasonable range of encounter budget
    expect(profile.totalCR).toBeLessThanOrEqual(seeder.encounterBudget)
  })

  it('peakCR is the boss room', () => {
    const seeder = generateSeeder('g1', 3, 'lair', 'orc', 0, 10)
    const profile = evaluateSeeder(seeder)
    expect(profile.peakCR).toBeGreaterThan(profile.averageCR)
  })

  it('recommendedPartyCR is derived from totalCR', () => {
    const seeder = generateSeeder('g1', 4, 'portal', 'demon', 0, 10)
    const profile = evaluateSeeder(seeder)
    // 60% rule
    expect(profile.recommendedPartyCR).toBe(Math.ceil(profile.totalCR * 0.6))
  })

  it('higher tier → higher recommended CR', () => {
    const t1 = evaluateSeeder(generateSeeder('g', 1, 'lair', 'goblin', 0, 10))
    const t5 = evaluateSeeder(generateSeeder('g', 5, 'portal', 'demon', 0, 10))
    expect(t5.recommendedPartyCR).toBeGreaterThan(t1.recommendedPartyCR)
  })
})

// ============================================================
// FULL LIFECYCLE
// ============================================================

describe('Full Lifecycle', () => {
  it('generate → evaluate → stamp → respawn', () => {
    // 1. GRIND: Generate seeder
    const seeder = generateSeeder('gate_1', 2, 'lair', 'goblin', 0, 12)
    expect(seeder.remainingPotential).toBe(1.0)

    // 2. PEEK: Evaluate without consuming
    const profile = evaluateSeeder(seeder)
    expect(profile.totalCR).toBeGreaterThan(0)
    expect(seeder.stamped).toBe(0)

    // 3. SELECT: Stamp all rooms
    const rooms = stampAll(seeder)
    expect(rooms.length).toBe(seeder.seeds.length)
    expect(seeder.remainingPotential).toBeCloseTo(0, 3)
    expect(rooms[0].roomType).toBe('entrance')
    expect(rooms[rooms.length - 1].roomType).toBe('boss')

    // 4. REFILL: Respawn
    const respawn = respawnSeeder(seeder, 7)
    expect(respawn.generation).toBe(1)
    expect(respawn.remainingPotential).toBe(1.0)
    expect(respawn.encounterBudget).toBeGreaterThan(seeder.encounterBudget)

    // 5. Stamp respawn and verify harder
    const respawnRooms = stampAll(respawn)
    const originalBoss = rooms[rooms.length - 1]
    const respawnBoss = respawnRooms[respawnRooms.length - 1]
    expect(respawnBoss.encounterCR).toBeGreaterThanOrEqual(originalBoss.encounterCR)
  })

  it('all five tiers produce valid seeders', () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const seeder = generateSeeder('g', tier, 'lair', 'goblin', 0, 10)
      const profile = evaluateSeeder(seeder)
      const rooms = stampAll(seeder)

      expect(rooms.length).toBeGreaterThanOrEqual(3)
      expect(rooms[0].roomType).toBe('entrance')
      expect(rooms[rooms.length - 1].roomType).toBe('boss')
      expect(profile.totalCR).toBeGreaterThan(0)
      expect(seeder.remainingPotential).toBeCloseTo(0, 3)
    }
  })

  it('all four gate types produce valid seeders', () => {
    for (const type of ['ruin', 'lair', 'portal', 'corruption'] as const) {
      const seeder = generateSeeder('g', 3, type, 'test', 0, 10)
      const rooms = stampAll(seeder)
      expect(rooms.length).toBeGreaterThanOrEqual(6)
      expect(rooms[0].roomType).toBe('entrance')
    }
  })
})
