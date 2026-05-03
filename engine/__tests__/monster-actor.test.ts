/**
 * MONSTER ACTOR TESTS
 * ====================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMonsterActor, tickMonsterAdvancement,
  resolveLeadershipChallenge, shouldChallenge,
  generateChallengerCR, resetMonsterActorIdCounter,
  type MonsterActorState,
} from '../monster-actor'

beforeEach(() => {
  resetMonsterActorIdCounter()
})

// ============================================================
// FACTORY
// ============================================================

describe('Monster Actor Creation', () => {
  it('creates a monster actor with correct defaults', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 15, 100)
    expect(actor.id).toBe('monster_actor_1')
    expect(actor.leaderCR).toBe(2)
    expect(actor.speciesId).toBe('goblin')
    expect(actor.population).toBe(15)
    expect(actor.carryingCapacity).toBe(45) // 15 × 3
    expect(actor.troops).toBe(7) // floor(15 × 0.5)
    expect(actor.tenure).toBe(0)
    expect(actor.dangerRadius).toBe(2) // max(1, floor(2))
  })

  it('links gate ID when provided', () => {
    const actor = createMonsterActor('orc', 3, 'camp_1', 20, 100, { gateId: 'gate_5' })
    expect(actor.gateId).toBe('gate_5')
  })
})

// ============================================================
// MONTHLY ADVANCEMENT
// ============================================================

describe('Monthly Advancement', () => {
  it('backfire weakens leader and marks vulnerable', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)
    const startPop = actor.population

    // d20=1 + CR/2(1) + tenure(0) = 2 → backfire
    const result = tickMonsterAdvancement(actor, 1, 10)
    expect(result.grade).toBe('backfire')
    expect(result.vulnerable).toBe(true)
    expect(actor.population).toBeLessThan(startPop)
  })

  it('success grows population and danger radius', () => {
    const actor = createMonsterActor('goblin', 4, 'camp_1', 20, 100)
    const startPop = actor.population
    const startRadius = actor.dangerRadius

    // d20=16 + CR/2(2) + tenure(0) = 18 → success
    const result = tickMonsterAdvancement(actor, 16, 15)
    expect(result.grade).toBe('success')
    expect(actor.population).toBeGreaterThan(startPop)
    expect(actor.dangerRadius).toBeGreaterThan(startRadius)
  })

  it('critical leads to boss evolution possibility', () => {
    const actor = createMonsterActor('orc', 8, 'camp_1', 30, 100)

    // d20=20 + CR/2(4) + tenure(0) = 24 → great. Need more for critical.
    // Let's boost tenure: tenure=9 → bonus=3
    actor.tenure = 9
    // d20=20 + CR/2(4) + tenure_bonus(3) = 27 → critical
    const result = tickMonsterAdvancement(actor, 20, 10)
    expect(result.grade).toBe('critical')
    expect(result.populationChange).toBeGreaterThan(0)
  })

  it('tenure increments each month', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)
    expect(actor.tenure).toBe(0)

    tickMonsterAdvancement(actor, 10, 10)
    expect(actor.tenure).toBe(1)

    tickMonsterAdvancement(actor, 10, 10)
    expect(actor.tenure).toBe(2)
  })

  it('selects hunt action when food is critical', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)
    actor.foodSecurity = 0.2

    const result = tickMonsterAdvancement(actor, 10, 10)
    expect(result.action).toBe('hunt')
  })

  it('selects migrate when overcrowded', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 50, 100)
    actor.carryingCapacity = 50
    actor.population = 48 // > 90% capacity

    const result = tickMonsterAdvancement(actor, 10, 10)
    expect(result.action).toBe('migrate')
  })
})

// ============================================================
// LEADERSHIP CHALLENGE
// ============================================================

describe('Leadership Challenge', () => {
  it('challenger wins when rolling higher', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)

    // Incumbent: d20=5 + CR(2) + tenure(0) = 7
    // Challenger: d20=18 + CR(3) = 21  
    const result = resolveLeadershipChallenge(actor, 3, 5, 18, 15)
    expect(result.outcome).toBe('challenger_wins')
    expect(actor.leaderCR).toBe(3) // new leader
    expect(actor.tenure).toBe(0) // reset
  })

  it('incumbent wins with tenure bonus', () => {
    const actor = createMonsterActor('goblin', 3, 'camp_1', 20, 100)
    actor.tenure = 9 // +3 tenure bonus

    // Incumbent: d20=10 + CR(3) + tenure(3) = 16
    // Challenger: d20=10 + CR(3) = 13
    const result = resolveLeadershipChallenge(actor, 3, 10, 10, 15)
    expect(result.outcome).toBe('incumbent_wins')
    expect(actor.challengesSurvived).toBe(1)
  })

  it('loser migrates on high fateD20', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)

    // Challenger wins, fate d20 = 15 → migrates
    const result = resolveLeadershipChallenge(actor, 4, 1, 20, 15)
    expect(result.loserAction).toBe('migrates')
  })

  it('loser dies on low fateD20', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)

    // Challenger wins, fate d20 = 5 → dies
    const result = resolveLeadershipChallenge(actor, 4, 1, 20, 5)
    expect(result.loserAction).toBe('dies')
  })

  it('greatly outmatched challenger flees', () => {
    const actor = createMonsterActor('orc', 10, 'camp_1', 30, 100)

    // Leader CR=10, challenger CR=3 → 10 > 3×2=6 → flees if fateD20 ≤ 10
    const result = resolveLeadershipChallenge(actor, 3, 10, 10, 5)
    expect(result.outcome).toBe('challenger_flees')
  })
})

// ============================================================
// CHALLENGE TRIGGER
// ============================================================

describe('Challenge Triggers', () => {
  it('75% chance when vulnerable (backfire)', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)
    actor.lastAdvancementGrade = 'backfire'

    expect(shouldChallenge(actor, 6)).toBe(true)
    expect(shouldChallenge(actor, 20)).toBe(true)
    expect(shouldChallenge(actor, 5)).toBe(false)
  })

  it('35% chance when overcrowded', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 60, 100)
    actor.carryingCapacity = 50

    expect(shouldChallenge(actor, 14)).toBe(true)
    expect(shouldChallenge(actor, 13)).toBe(false)
  })

  it('15% base chance', () => {
    const actor = createMonsterActor('goblin', 2, 'camp_1', 20, 100)

    expect(shouldChallenge(actor, 18)).toBe(true)
    expect(shouldChallenge(actor, 17)).toBe(false)
  })
})

// ============================================================
// CHALLENGER CR GENERATION
// ============================================================

describe('Challenger CR', () => {
  it('generates CR proportional to leader with d20 variance', () => {
    const lowCR = generateChallengerCR(4, 1)   // mult = 0.55 → 2.2 → 2.25
    const highCR = generateChallengerCR(4, 20)  // mult = 1.5 → 6.0

    expect(lowCR).toBeLessThan(highCR)
    expect(lowCR).toBeGreaterThanOrEqual(0.25)
  })
})
