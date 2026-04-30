/**
 * DUNGEON GATE TESTS
 * ===================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDungeonGate, tickDungeonGate, attemptClearGate,
  activateGate, resetGateIdCounter,
  GATE_TIER_CONFIG, GATE_SPECIES_TABLE,
  type DungeonGate,
} from '../dungeon-gate.js'

beforeEach(() => {
  resetGateIdCounter()
})

// ============================================================
// FACTORY
// ============================================================

describe('Gate Creation', () => {
  it('creates an active gate with correct defaults', () => {
    const gate = createDungeonGate('site_1', 'edge_1', 25, 'lair', 2, 'forest', 100)
    expect(gate.id).toBe('gate_1')
    expect(gate.state).toBe('active')
    expect(gate.gateType).toBe('lair')
    expect(gate.tier).toBe(2)
    expect(gate.speciesId).toBe('goblin') // forest + lair = goblin
    expect(gate.internalCapacity).toBe(30) // tier 2
    expect(gate.currentInternal).toBe(9) // 30 × 0.3 = 9
    expect(gate.spawnRate).toBe(4) // tier 2 base
    expect(gate.respawnEnabled).toBe(true)
    expect(gate.timesCleared).toBe(0)
  })

  it('selects species based on gate type + terrain', () => {
    const gate1 = createDungeonGate('s1', 'e1', 10, 'ruin', 1, 'underground', 1)
    expect(gate1.speciesId).toBe('skeleton')

    const gate2 = createDungeonGate('s2', 'e2', 20, 'lair', 1, 'mountains', 1)
    expect(gate2.speciesId).toBe('orc')

    const gate3 = createDungeonGate('s3', 'e3', 30, 'portal', 1, 'swamp', 1)
    expect(gate3.speciesId).toBe('shadow')
  })

  it('higher tiers have lower capacity but higher per-creature threat', () => {
    expect(GATE_TIER_CONFIG[5].baseCapacity).toBeLessThan(GATE_TIER_CONFIG[3].baseCapacity)
    expect(GATE_TIER_CONFIG[5].baseOverflowRadius).toBeGreaterThan(GATE_TIER_CONFIG[3].baseOverflowRadius)
  })

  it('ruins require boss_kill + consecration to clear', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'ruin', 1, 'forest', 1)
    expect(gate.clearRequirements).toContain('boss_kill')
    expect(gate.clearRequirements).toContain('consecration')
  })
})

// ============================================================
// WEEKLY TICK
// ============================================================

describe('Gate Weekly Tick', () => {
  it('spawns monsters each week', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 1, 'forest', 1)
    gate.currentInternal = 0

    const result = tickDungeonGate(gate, 8, 10) // neutral roll
    expect(result.spawned).toBeGreaterThanOrEqual(1)
    expect(gate.currentInternal).toBe(result.spawned)
  })

  it('overflows when above threshold', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 2, 'forest', 1)
    gate.currentInternal = Math.floor(gate.internalCapacity * 0.85) // above 80% threshold

    const result = tickDungeonGate(gate, 8, 10)
    expect(gate.state).toBe('overflowing')
    expect(result.overflowed).toBeGreaterThanOrEqual(1)
  })

  it('overflow increases danger radius', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 3, 'forest', 1)
    gate.currentInternal = gate.internalCapacity
    gate.overflowCount = 20

    tickDungeonGate(gate, 8, 10)
    expect(gate.overflowRadius).toBeGreaterThan(0)
  })

  it('leader emerges after 4+ weeks of overflow', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 2, 'forest', 1)
    gate.currentInternal = gate.internalCapacity
    gate.weeksOverflowing = 3

    // Week 4 overflow with high d20 (>= 10 required)
    const result = tickDungeonGate(gate, 8, 15)
    expect(result.leaderEmerged).toBe(true)
    expect(gate.leaderEmerged).toBe(true)
  })

  it('leader does NOT emerge with low d20', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 2, 'forest', 1)
    gate.currentInternal = gate.internalCapacity
    gate.weeksOverflowing = 5

    const result = tickDungeonGate(gate, 8, 5) // low d20
    // Leader can't emerge because d20 < 10
    expect(result.leaderEmerged).toBe(false)
  })

  it('dormant gates produce nothing', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 1, 'forest', 1)
    gate.state = 'dormant'

    const result = tickDungeonGate(gate, 8, 10)
    expect(result.spawned).toBe(0)
  })
})

// ============================================================
// CLEARING
// ============================================================

describe('Gate Clearing', () => {
  it('caps gate on successful clear', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 1, 'forest', 50)
    gate.currentInternal = 10

    const result = attemptClearGate(gate, 25, ['boss_kill'], 60, 15)
    expect(result.success).toBe(true)
    expect(result.newState).toBe('capped')
    expect(gate.currentInternal).toBe(0)
    expect(gate.timesCleared).toBe(1)
  })

  it('failed clear leaves gate active', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 4, 'forest', 50)

    const result = attemptClearGate(gate, 5, [], 60, 1) // very low roll + low strength
    expect(result.success).toBe(false)
    expect(gate.state).toBe('active')
  })

  it('DC increases with each clear', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 1, 'forest', 50)
    gate.timesCleared = 5 // cleared 5 times already

    // DC = tier(1)×5 + timesCleared(5)×2 = 15 — much harder
    const result = attemptClearGate(gate, 10, [], 60, 8) // 8 + 2 = 10 < 15
    expect(result.success).toBe(false)
  })
})

// ============================================================
// RESPAWN
// ============================================================

describe('Gate Respawn', () => {
  it('respawns after respawnDays', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 2, 'forest', 50)
    attemptClearGate(gate, 30, ['boss_kill'], 60, 18)

    expect(gate.state).toBe('capped')
    expect(gate.cappedOnDay).toBe(60)

    // Tick at day 91 (31 days later, > respawnDays=30)
    const result = tickDungeonGate(gate, 91, 10)
    expect(result.respawned).toBe(true)
    expect(gate.state).not.toBe('capped')
  })

  it('respawn rate scales with timesCleared', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 2, 'forest', 50)
    const originalRate = gate.spawnRate

    // Clear twice
    attemptClearGate(gate, 30, ['boss_kill'], 60, 18)
    tickDungeonGate(gate, 91, 10) // respawn 1

    attemptClearGate(gate, 30, ['boss_kill'], 120, 18)
    tickDungeonGate(gate, 151, 10) // respawn 2

    // Rate should have increased: base × 1.2^2 = base × 1.44
    expect(gate.spawnRate).toBeGreaterThan(originalRate)
  })
})

// ============================================================
// ACTIVATION
// ============================================================

describe('Gate Activation', () => {
  it('activates a dormant gate', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 1, 'forest', 50)
    gate.state = 'dormant'

    activateGate(gate, 55)
    expect(gate.state).toBe('active')
    expect(gate.activatedOnDay).toBe(55)
  })

  it('does nothing to already active gates', () => {
    const gate = createDungeonGate('s1', 'e1', 10, 'lair', 1, 'forest', 50)
    const original = gate.activatedOnDay

    activateGate(gate, 100)
    expect(gate.activatedOnDay).toBe(original) // unchanged
  })
})
