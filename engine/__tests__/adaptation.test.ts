import { describe, it, expect } from 'vitest'
import {
  ALL_ADAPTATIONS,
  type Adaptation,
  createAdaptationPool,
  selectAdaptations,
  adaptationCountForGate,
  reportClear,
  evolvePool,
  modifiersFor,
  combineModifiers,
} from '../adaptation'

describe('createAdaptationPool', () => {
  it('returns all 10 adaptations at weight 1.0, generation 0', () => {
    const pool = createAdaptationPool('goblin')
    expect(pool.speciesId).toBe('goblin')
    expect(pool.generation).toBe(0)
    for (const a of ALL_ADAPTATIONS) {
      expect(pool.weights[a]).toBe(1.0)
      expect(pool.fitness[a]?.spawned).toBe(0)
    }
  })

  it('isolates state per call (no shared references)', () => {
    const a = createAdaptationPool('goblin')
    const b = createAdaptationPool('orc')
    a.weights.ARMORED = 5.0
    expect(b.weights.ARMORED).toBe(1.0)
  })
})

describe('selectAdaptations', () => {
  it('returns count items with no duplicates', () => {
    const pool = createAdaptationPool('goblin')
    const picks = selectAdaptations(pool, 3, [5, 12, 17])
    expect(picks).toHaveLength(3)
    expect(new Set(picks).size).toBe(3)
  })

  it('returns 0 items when count is 0 or negative', () => {
    const pool = createAdaptationPool('goblin')
    expect(selectAdaptations(pool, 0, [])).toEqual([])
    expect(selectAdaptations(pool, -1, [])).toEqual([])
  })

  it('caps at the number of available adaptations', () => {
    const pool = createAdaptationPool('goblin')
    const picks = selectAdaptations(pool, 999, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(picks.length).toBe(ALL_ADAPTATIONS.length)
  })

  it('is deterministic given identical d20 inputs', () => {
    const pool = createAdaptationPool('goblin')
    const a = selectAdaptations(pool, 4, [3, 9, 14, 18])
    const b = selectAdaptations(pool, 4, [3, 9, 14, 18])
    expect(a).toEqual(b)
  })

  it('respects extreme weighting', () => {
    const pool = createAdaptationPool('goblin')
    // Crank ARMORED to dominant weight
    for (const a of ALL_ADAPTATIONS) pool.weights[a] = 0.01
    pool.weights.ARMORED = 1000

    const counts = new Map<Adaptation, number>()
    for (let d = 1; d <= 20; d++) {
      const picks = selectAdaptations(pool, 1, [d])
      const pick = picks[0]
      counts.set(pick, (counts.get(pick) ?? 0) + 1)
    }
    // ARMORED should dominate for nearly every d20
    expect((counts.get('ARMORED') ?? 0)).toBeGreaterThan(15)
  })

  it('skips adaptations with zero weight', () => {
    const pool = createAdaptationPool('goblin')
    for (const a of ALL_ADAPTATIONS) pool.weights[a] = 0
    pool.weights.STEALTH = 1.0
    pool.weights.CUNNING = 1.0

    const picks = selectAdaptations(pool, 5, [1, 5, 10, 15, 20])
    // Only STEALTH and CUNNING are eligible
    expect(picks.length).toBe(2)
    expect(picks).toContain('STEALTH')
    expect(picks).toContain('CUNNING')
  })
})

describe('adaptationCountForGate', () => {
  it('curves the gen × tier matrix as specified', () => {
    expect(adaptationCountForGate(0, 1)).toBe(0)
    expect(adaptationCountForGate(0, 5)).toBe(1)
    expect(adaptationCountForGate(5, 1)).toBe(2)
    expect(adaptationCountForGate(5, 5)).toBe(3)
  })

  it('caps at 3', () => {
    expect(adaptationCountForGate(99, 5)).toBe(3)
    expect(adaptationCountForGate(0, 99)).toBeLessThanOrEqual(3)
  })

  it('handles low generations correctly', () => {
    expect(adaptationCountForGate(1, 1)).toBe(0)
    expect(adaptationCountForGate(2, 1)).toBe(1)
    expect(adaptationCountForGate(3, 1)).toBe(1)
    expect(adaptationCountForGate(4, 1)).toBe(2)
  })

  it('tier 4 gives no tier bonus, tier 5 gives one', () => {
    expect(adaptationCountForGate(0, 4)).toBe(0)
    expect(adaptationCountForGate(0, 5)).toBe(1)
  })
})

describe('reportClear', () => {
  it('counts spawned per adaptation present', () => {
    const pool = createAdaptationPool('goblin')
    reportClear(pool, {
      adaptations: ['ARMORED', 'PACK'],
      casualties: 0,
      permanent: false,
      generation: 0,
    })
    expect(pool.fitness.ARMORED?.spawned).toBe(1)
    expect(pool.fitness.PACK?.spawned).toBe(1)
    expect(pool.fitness.STEALTH?.spawned).toBe(0)
  })

  it('records survivedClears only for non-permanent clears', () => {
    const pool = createAdaptationPool('goblin')
    reportClear(pool, {
      adaptations: ['ARMORED'],
      casualties: 1,
      permanent: false,
      generation: 0,
    })
    reportClear(pool, {
      adaptations: ['ARMORED'],
      casualties: 1,
      permanent: true,
      generation: 1,
    })
    expect(pool.fitness.ARMORED?.spawned).toBe(2)
    expect(pool.fitness.ARMORED?.survivedClears).toBe(1)
  })

  it('accumulates casualties across reports', () => {
    const pool = createAdaptationPool('goblin')
    reportClear(pool, { adaptations: ['DRAIN'], casualties: 2, permanent: false, generation: 0 })
    reportClear(pool, { adaptations: ['DRAIN'], casualties: 3, permanent: false, generation: 1 })
    expect(pool.fitness.DRAIN?.causedCasualties).toBe(5)
  })
})

describe('evolvePool', () => {
  it('increments generation and resets fitness counters', () => {
    const pool = createAdaptationPool('goblin')
    reportClear(pool, { adaptations: ['ARMORED'], casualties: 5, permanent: false, generation: 0 })
    const evolved = evolvePool(pool)
    expect(evolved.generation).toBe(1)
    expect(evolved.fitness.ARMORED?.spawned).toBe(0)
    expect(evolved.fitness.ARMORED?.causedCasualties).toBe(0)
  })

  it('does not mutate the input pool', () => {
    const pool = createAdaptationPool('goblin')
    pool.weights.ARMORED = 2.0
    reportClear(pool, { adaptations: ['ARMORED'], casualties: 5, permanent: false, generation: 0 })
    const evolved = evolvePool(pool)
    // Input pool unchanged
    expect(pool.generation).toBe(0)
    expect(pool.weights.ARMORED).toBe(2.0)
    expect(pool.fitness.ARMORED?.spawned).toBe(1)
    // New pool advanced + reset
    expect(evolved.generation).toBe(1)
    expect(evolved.fitness.ARMORED?.spawned).toBe(0)
    // Different object (not shared reference)
    expect(evolved.weights).not.toBe(pool.weights)
    expect(evolved.fitness).not.toBe(pool.fitness)
  })

  it('rewards adaptations that survive and cause casualties', () => {
    const pool = createAdaptationPool('goblin')
    // ARMORED: 3 spawns, all survived, 6 casualties → strong fitness
    for (let i = 0; i < 3; i++) {
      reportClear(pool, { adaptations: ['ARMORED'], casualties: 2, permanent: false, generation: 0 })
    }
    // STEALTH: never spawned → neutral
    const evolved = evolvePool(pool)
    expect(evolved.weights.ARMORED).toBeGreaterThan(evolved.weights.STEALTH)
  })

  it('penalizes adaptations whose populations always die permanently', () => {
    const pool = createAdaptationPool('goblin')
    // SPLIT: 4 spawns, all permanent clears, no casualties → poor fitness
    for (let i = 0; i < 4; i++) {
      reportClear(pool, { adaptations: ['SPLIT'], casualties: 0, permanent: true, generation: 0 })
    }
    const evolved = evolvePool(pool)
    expect(evolved.weights.SPLIT).toBeLessThan(pool.weights.SPLIT!)
  })

  it('clamps weights to [0.1, 5.0]', () => {
    const pool = createAdaptationPool('goblin')
    pool.weights.ARMORED = 4.9
    // High kill rate to drive weight upward
    for (let i = 0; i < 20; i++) {
      reportClear(pool, { adaptations: ['ARMORED'], casualties: 10, permanent: false, generation: 0 })
    }
    const evolved = evolvePool(pool)
    expect(evolved.weights.ARMORED).toBeGreaterThanOrEqual(0.1)
    expect(evolved.weights.ARMORED).toBeLessThanOrEqual(5.0)
  })

  it('runs multiple generations stably without explosion', () => {
    let pool = createAdaptationPool('goblin')
    for (let gen = 0; gen < 50; gen++) {
      // Mild noise per gen
      reportClear(pool, {
        adaptations: ['ARMORED', 'STEALTH'],
        casualties: gen % 3,
        permanent: gen % 5 === 0,
        generation: gen,
      })
      pool = evolvePool(pool)
    }
    expect(pool.generation).toBe(50)
    for (const a of ALL_ADAPTATIONS) {
      expect(pool.weights[a]).toBeGreaterThanOrEqual(0.1)
      expect(pool.weights[a]).toBeLessThanOrEqual(5.0)
    }
  })
})

describe('modifiersFor', () => {
  it('STEALTH gives +2 DC and ambush + flank tags', () => {
    const m = modifiersFor('STEALTH')
    expect(m.dcBonus).toBe(2)
    expect(m.behaviorTags).toContain('ambush')
    expect(m.behaviorTags).toContain('flank')
  })

  it('PACK multiplies troops by 1.2', () => {
    expect(modifiersFor('PACK').troopMultiplier).toBeCloseTo(1.2, 5)
  })

  it('SPLIT spawns minions on death', () => {
    expect(modifiersFor('SPLIT').spawnsMinionsOnDeath).toBe(true)
  })

  it('REFLECT contributes the largest single CR bonus (+0.75)', () => {
    expect(modifiersFor('REFLECT').crBonus).toBe(0.75)
  })
})

describe('combineModifiers', () => {
  it('sums CR bonuses additively', () => {
    const r = combineModifiers(['ARMORED', 'REGEN', 'DRAIN'])
    // 0.5 + 0.5 + 0.5 = 1.5
    expect(r.crBonus).toBeCloseTo(1.5, 5)
  })

  it('multiplies troopMultiplier (PACK stacks with itself if duplicated)', () => {
    const r = combineModifiers(['PACK'])
    expect(r.troopMultiplier).toBeCloseTo(1.2, 5)
    const r2 = combineModifiers(['PACK', 'PACK'])
    expect(r2.troopMultiplier).toBeCloseTo(1.44, 5)
  })

  it('OR-aggregates spawnsMinionsOnDeath', () => {
    expect(combineModifiers(['ARMORED']).spawnsMinionsOnDeath).toBe(false)
    expect(combineModifiers(['ARMORED', 'SPLIT']).spawnsMinionsOnDeath).toBe(true)
  })

  it('concatenates behaviorTags', () => {
    const r = combineModifiers(['STEALTH', 'CUNNING'])
    expect(r.behaviorTags).toContain('ambush')
    expect(r.behaviorTags).toContain('tactical')
    expect(r.behaviorTags).toContain('flank')  // both contribute
  })

  it('empty list returns neutral modifiers', () => {
    const r = combineModifiers([])
    expect(r.crBonus).toBe(0)
    expect(r.troopMultiplier).toBe(1.0)
    expect(r.dcBonus).toBe(0)
    expect(r.dangerRadiusBonus).toBe(0)
    expect(r.spawnsMinionsOnDeath).toBe(false)
    expect(r.behaviorTags).toEqual([])
  })
})
