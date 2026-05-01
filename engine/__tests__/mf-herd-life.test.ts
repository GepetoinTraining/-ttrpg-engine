import { describe, it, expect } from 'vitest'
import { mfHerdGraze, mfHerdMigrate, mfHerdPredation } from '../mf-herd-life'
import { getSpecies, type WildHerd } from '../wild-fauna'

function freshHerd(speciesId: string, overrides: Partial<WildHerd> = {}): WildHerd {
  const sp = getSpecies(speciesId)
  return {
    id: `herd-${speciesId}`,
    speciesId,
    currentNodeId: 'forest-1',
    destinationNodeId: null,
    edgeId: null,
    edgeMile: 0,
    edgeTotalMiles: 0,
    population: sp.baseHerdSize,
    daysHungry: 0,
    foodSecurity: 1.0,
    formation: 'spread',
    status: 'grazing',
    bornDay: 0,
    lastTransitionDay: 0,
    ...overrides,
  }
}

describe('mfHerdGraze — feed + breed + age', () => {
  it('full feed bumps food security and triggers births over enough days', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer')
    const r = mfHerdGraze(herd, deer, {
      days: 30,
      worldDay: 30,
      floraAvailable: deer.dailyFoodNeed * herd.population * 30 * 2, // 2× demand
    })
    expect(r.output.herdAfter.foodSecurity).toBe(1)
    expect(r.output.herdAfter.daysHungry).toBe(0)
    expect(r.output.populationDelta).toBeGreaterThan(0) // some births over 30d
    expect(r.output.statusTransition).toBeNull()
  })

  it('starvation: low flora drops food, hunger counter ticks', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer')
    const r = mfHerdGraze(herd, deer, {
      days: 5,
      worldDay: 5,
      floraAvailable: 0,
    })
    expect(r.output.herdAfter.foodSecurity).toBe(0)
    expect(r.output.herdAfter.daysHungry).toBe(5)
  })

  it('exceeds hungerMigrationThreshold → status flips to starving', () => {
    const deer = getSpecies('deer') // hungerMigrationThreshold: 14
    const herd = freshHerd('deer', { daysHungry: 13 })
    const r = mfHerdGraze(herd, deer, {
      days: 2,
      worldDay: 2,
      floraAvailable: 0,
    })
    expect(r.output.statusTransition?.to).toBe('starving')
    expect(r.output.herdAfter.status).toBe('starving')
  })

  it('cannot grow past carryingCapacity', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer', { population: deer.carryingCapacity })
    const r = mfHerdGraze(herd, deer, {
      days: 30,
      worldDay: 30,
      floraAvailable: 100_000,
    })
    expect(r.output.herdAfter.population).toBeLessThanOrEqual(deer.carryingCapacity)
  })

  it('decimated when starvation drives below minViable', () => {
    const rabbit = getSpecies('rabbit')
    const herd = freshHerd('rabbit', { population: rabbit.minViable })
    // Many days of zero food → mortality wipes out remaining
    const r = mfHerdGraze(herd, rabbit, {
      days: 365,
      worldDay: 365,
      floraAvailable: 0,
    })
    expect(r.output.herdAfter.population).toBeLessThan(rabbit.minViable)
    expect(r.output.herdAfter.status).toBe('decimated')
  })
})

describe('mfHerdMigrate — formation-driven travel', () => {
  it('column formation advances at base speed', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer', {
      status: 'migrating',
      formation: 'column',
      edgeId: 'edge-1',
      edgeMile: 0,
      edgeTotalMiles: 100,
      destinationNodeId: 'meadow-2',
    })
    const r = mfHerdMigrate(herd, deer, {
      days: 10,
      worldDay: 10,
      edgeId: 'edge-1',
      edgeTotalMiles: 100,
      destinationNodeId: 'meadow-2',
      baseMilesPerDay: 5,
    })
    expect(r.output.milesAdvanced).toBeCloseTo(50, 0)
    expect(r.output.arrived).toBe(false)
    expect(r.output.herdAfter.edgeMile).toBeCloseTo(50, 0)
  })

  it('arrival flips status to grazing at the new node', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer', {
      status: 'migrating',
      formation: 'column',
      edgeId: 'edge-1',
      edgeMile: 95,
      edgeTotalMiles: 100,
      destinationNodeId: 'meadow-2',
    })
    const r = mfHerdMigrate(herd, deer, {
      days: 5,
      worldDay: 5,
      edgeId: 'edge-1',
      edgeTotalMiles: 100,
      destinationNodeId: 'meadow-2',
      baseMilesPerDay: 5,
    })
    expect(r.output.arrived).toBe(true)
    expect(r.output.herdAfter.currentNodeId).toBe('meadow-2')
    expect(r.output.herdAfter.edgeId).toBeNull()
    expect(r.output.herdAfter.status).toBe('grazing')
    expect(r.output.herdAfter.formation).toBe('spread')
  })

  it('high segment danger flips to fleeing/scattered with flee speed bonus', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer', {
      status: 'migrating',
      formation: 'column',
      edgeId: 'edge-1',
      edgeMile: 0,
      edgeTotalMiles: 100,
      destinationNodeId: 'meadow-2',
    })
    const safe = mfHerdMigrate(herd, deer, {
      days: 5,
      worldDay: 5,
      edgeId: 'edge-1',
      edgeTotalMiles: 100,
      destinationNodeId: 'meadow-2',
      baseMilesPerDay: 5,
      segmentDanger: 0,
    })
    const unsafe = mfHerdMigrate(herd, deer, {
      days: 5,
      worldDay: 5,
      edgeId: 'edge-1',
      edgeTotalMiles: 100,
      destinationNodeId: 'meadow-2',
      baseMilesPerDay: 5,
      segmentDanger: 8,
    })
    expect(unsafe.output.herdAfter.status).toBe('fleeing')
    expect(unsafe.output.herdAfter.formation).toBe('scattered')
    expect(unsafe.output.milesAdvanced).toBeGreaterThan(safe.output.milesAdvanced)
  })

  it('throws on non-viable herd', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer', { population: deer.minViable - 1 })
    expect(() =>
      mfHerdMigrate(herd, deer, {
        days: 1, worldDay: 1, edgeId: 'e', edgeTotalMiles: 10,
        destinationNodeId: 'd', baseMilesPerDay: 5,
      }),
    ).toThrow(/min viable/)
  })
})

describe('mfHerdPredation — predator pressure', () => {
  it('high pressure with spread formation loses heads', () => {
    const rabbit = getSpecies('rabbit')
    const herd = freshHerd('rabbit', { formation: 'spread' })
    const r = mfHerdPredation(herd, rabbit, {
      worldDay: 10,
      pressure: 0.9,
      days: 5,
    })
    expect(r.output.predated).toBeGreaterThan(0)
    expect(r.output.herdAfter.population).toBe(herd.population - r.output.predated)
  })

  it('defensive_box reduces effective pressure', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer', { formation: 'spread' })
    const exposed = mfHerdPredation(herd, deer, { worldDay: 1, pressure: 0.6, days: 5 })
    const dug_in = mfHerdPredation(
      { ...herd, formation: 'defensive_box' },
      deer,
      { worldDay: 1, pressure: 0.6, days: 5 },
    )
    expect(exposed.output.predated).toBeGreaterThan(dug_in.output.predated)
  })

  it('moderate pressure flips status to fleeing', () => {
    const deer = getSpecies('deer')
    const herd = freshHerd('deer')
    const r = mfHerdPredation(herd, deer, { worldDay: 1, pressure: 0.7, days: 1 })
    expect(r.output.statusTransition?.to).toBe('fleeing')
  })

  it('drops to decimated if predation crosses minViable', () => {
    const rabbit = getSpecies('rabbit')
    const herd = freshHerd('rabbit', {
      population: rabbit.minViable + 1,
      formation: 'scattered', // worst defense to ensure heavy losses
    })
    const r = mfHerdPredation(herd, rabbit, { worldDay: 1, pressure: 1, days: 10 })
    if (r.output.herdAfter.population < rabbit.minViable) {
      expect(r.output.herdAfter.status).toBe('decimated')
    }
  })
})
