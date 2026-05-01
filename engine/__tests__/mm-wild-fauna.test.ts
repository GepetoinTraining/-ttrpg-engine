import { describe, it, expect } from 'vitest'
import { MMWildFauna } from '../mm-wild-fauna'
import { TP } from '../tp'
import { getSpecies, type WildHerd } from '../wild-fauna'

function freshTp(): TP {
  const tp = new TP()
  tp.loadNodes([
    { id: 'forest-region-1', type: 'region', name: 'Forest Region 1', parentId: null, dataStatic: {} },
    { id: 'forest-region-2', type: 'region', name: 'Forest Region 2', parentId: null, dataStatic: {} },
    { id: 'plains-region-1', type: 'region', name: 'Plains Region', parentId: null, dataStatic: {} },
    { id: 'mountain-region-1', type: 'region', name: 'Mountain Region', parentId: null, dataStatic: {} },
    { id: 'desert-region-1', type: 'region', name: 'Desert', parentId: null, dataStatic: {} },
  ])
  return tp
}

function freshMM(opts: Partial<ConstructorParameters<typeof MMWildFauna>[0]> = {}): MMWildFauna {
  return new MMWildFauna({
    regionNodeId: 'forest-region-1',
    biome: 'forest',
    worldSeed: 'test-seed',
    worldDay: 0,
    floraPerDay: 100,
    ...opts,
  })
}

describe('MMWildFauna — construction', () => {
  it('initializes with empty herds', () => {
    const mm = freshMM()
    expect(mm.getHerds().length).toBe(0)
    expect(mm.state.id).toBe('wild_fauna:forest-region-1')
    expect(mm.state.nodeId).toBe('forest-region-1')
    expect(mm.state.mmType).toBe('wild_fauna')
  })
})

describe('MMWildFauna — lazy spawn', () => {
  it('spawns herds on first resolve from biome.fauna pool', () => {
    const mm = freshMM()
    const tp = freshTp()
    mm.accumulatePotential(7, 7, tp)
    mm.resolve(7, tp)
    const herds = mm.getHerds()
    expect(herds.length).toBeGreaterThan(0)
    expect(herds.length).toBeLessThanOrEqual(3)
    // Every spawned herd species must be eligible for forest biome
    for (const h of herds) {
      const sp = getSpecies(h.speciesId)
      expect(sp.biomes).toContain('forest')
    }
  })

  it('lazy spawn is deterministic from (worldSeed, regionNodeId)', () => {
    const mmA = freshMM({ worldSeed: 'same' })
    const mmB = freshMM({ worldSeed: 'same' })
    mmA.accumulatePotential(1, 1, freshTp())
    mmA.resolve(1, freshTp())
    mmB.accumulatePotential(1, 1, freshTp())
    mmB.resolve(1, freshTp())

    const ids_a = mmA.getHerds().map((h) => h.speciesId).sort()
    const ids_b = mmB.getHerds().map((h) => h.speciesId).sort()
    expect(ids_a).toEqual(ids_b)
  })

  it('different regionNodeId → different spawn', () => {
    const mmA = freshMM({ regionNodeId: 'forest-region-1' })
    const mmB = freshMM({ regionNodeId: 'forest-region-2' })
    mmA.accumulatePotential(1, 1, freshTp())
    mmA.resolve(1, freshTp())
    mmB.accumulatePotential(1, 1, freshTp())
    mmB.resolve(1, freshTp())
    // Could be same or different sets — but the herd ids must differ since they're prefixed by region.
    const ids_a = mmA.getHerds().map((h) => h.id)
    const ids_b = mmB.getHerds().map((h) => h.id)
    for (const a of ids_a) expect(ids_b).not.toContain(a)
  })

  it('biome with no eligible species spawns no herds', () => {
    // 'desert' is not in any wild-fauna species' biomes array
    const mm = freshMM({ regionNodeId: 'desert-region-1', biome: 'desert' })
    mm.accumulatePotential(1, 1, freshTp())
    mm.resolve(1, freshTp())
    expect(mm.getHerds().length).toBe(0)
  })

  it('plains biome spawns plains-eligible species', () => {
    const mm = freshMM({ regionNodeId: 'plains-region-1', biome: 'plains' })
    mm.accumulatePotential(1, 1, freshTp())
    mm.resolve(1, freshTp())
    for (const h of mm.getHerds()) {
      expect(getSpecies(h.speciesId).biomes).toContain('plains')
    }
  })

  it('initial population is within ±15% of baseHerdSize', () => {
    const mm = freshMM()
    mm.accumulatePotential(1, 1, freshTp())
    mm.resolve(1, freshTp())
    for (const h of mm.getHerds()) {
      const sp = getSpecies(h.speciesId)
      expect(h.population).toBeGreaterThanOrEqual(Math.floor(sp.baseHerdSize * 0.85))
      expect(h.population).toBeLessThanOrEqual(Math.ceil(sp.baseHerdSize * 1.15))
    }
  })
})

describe('MMWildFauna — autonomous fold', () => {
  it('grazing herd accumulates births over many days when flora is plentiful', () => {
    const mm = freshMM({ floraPerDay: 10000 })
    const tp = freshTp()
    mm.accumulatePotential(60, 60, tp)
    mm.resolve(60, tp)
    const herds = mm.getHerds()
    // At least one herd should have grown.
    expect(herds.some((h) => h.population > getSpecies(h.speciesId).baseHerdSize)).toBe(true)
  })

  it('zero flora → herds eventually decimate', () => {
    const mm = freshMM({ floraPerDay: 0 })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const initial = mm.getHerds()
    const initialCount = initial.length

    // Fold many days with zero flora
    mm.accumulatePotential(365, 365, tp)
    mm.resolve(365, tp)

    const after = mm.getHerds()
    expect(after.length).toBe(initialCount) // herds row preserved on decimation
    // At least one herd should be decimated/starving after a year of famine.
    const dec = after.filter((h) => h.status === 'decimated' || h.status === 'starving').length
    expect(dec).toBeGreaterThan(0)
  })

  it('writes herd map to κ.ecology.herds at the region node', () => {
    const mm = freshMM()
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)

    const ctx = tp.resolve('forest-region-1')
    const eco = ctx?.ecology
    expect(eco).toBeDefined()
    expect(eco?.herds).toBeDefined()
    const herdIds = Object.keys(eco?.herds ?? {}).sort()
    const localIds = mm.getHerds().map((h) => h.id).sort()
    expect(herdIds).toEqual(localIds)
  })

  it('hydrates from κ on resolve when κ has herds (cross-instance handover)', () => {
    const tp = freshTp()
    const planted: WildHerd = {
      id: 'forest-region-1:rabbit',
      speciesId: 'rabbit',
      currentNodeId: 'forest-region-1',
      destinationNodeId: null,
      edgeId: null,
      edgeMile: 0,
      edgeTotalMiles: 0,
      population: 50,
      daysHungry: 0,
      foodSecurity: 1.0,
      formation: 'spread',
      status: 'grazing',
      bornDay: 0,
      lastTransitionDay: 0,
    }
    tp.writeDomain('forest-region-1', 'ecology', {
      herds: { 'forest-region-1:rabbit': planted },
    })

    const mm = freshMM({ floraPerDay: 1000 })
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)

    const out = mm.getHerd('rabbit')
    expect(out).toBeDefined()
    expect(out!.id).toBe('forest-region-1:rabbit')
    // population may have shifted by 1d of grazing — but it's the SAME herd.
    expect(out!.bornDay).toBe(0)
  })
})

describe('MMWildFauna — migration handling', () => {
  it('migrating herd advances along edge during fold', () => {
    const mm = freshMM()
    const tp = freshTp()
    mm.setHerd({
      id: 'manual:deer',
      speciesId: 'deer',
      currentNodeId: 'forest-region-1',
      destinationNodeId: 'forest-region-2',
      edgeId: 'edge-1',
      edgeMile: 0,
      edgeTotalMiles: 30,
      population: getSpecies('deer').baseHerdSize,
      daysHungry: 0,
      foodSecurity: 0.5,
      formation: 'column',
      status: 'migrating',
      bornDay: 0,
      lastTransitionDay: 0,
    })
    mm.accumulatePotential(2, 2, tp)
    mm.resolve(2, tp)
    const after = mm.getHerds().find((h) => h.id === 'manual:deer')
    expect(after).toBeDefined()
    // Either advanced on the edge, or arrived (status grazing at destination).
    if (after!.status === 'grazing') {
      expect(after!.currentNodeId).toBe('forest-region-2')
      expect(after!.edgeId).toBeNull()
    } else {
      expect(after!.edgeMile).toBeGreaterThan(0)
    }
  })
})

describe('MMWildFauna — manual control', () => {
  it('setHerd inserts a new herd', () => {
    const mm = freshMM()
    expect(mm.getHerds().length).toBe(0)
    mm.setHerd({
      id: 'manual:owl',
      speciesId: 'owl',
      currentNodeId: 'forest-region-1',
      destinationNodeId: null,
      edgeId: null,
      edgeMile: 0,
      edgeTotalMiles: 0,
      population: 5,
      daysHungry: 0,
      foodSecurity: 1.0,
      formation: 'spread',
      status: 'grazing',
      bornDay: 0,
      lastTransitionDay: 0,
    })
    expect(mm.getHerds().length).toBe(1)
    expect(mm.getHerd('owl')!.population).toBe(5)
  })

  it('setHerd replaces an existing herd by id', () => {
    const mm = freshMM()
    const baseHerd: WildHerd = {
      id: 'manual:rabbit',
      speciesId: 'rabbit',
      currentNodeId: 'forest-region-1',
      destinationNodeId: null,
      edgeId: null,
      edgeMile: 0,
      edgeTotalMiles: 0,
      population: 10,
      daysHungry: 0,
      foodSecurity: 1.0,
      formation: 'spread',
      status: 'grazing',
      bornDay: 0,
      lastTransitionDay: 0,
    }
    mm.setHerd(baseHerd)
    mm.setHerd({ ...baseHerd, population: 20 })
    expect(mm.getHerds().length).toBe(1)
    expect(mm.getHerd('rabbit')!.population).toBe(20)
  })

  it('removeHerd drops the herd by id', () => {
    const mm = freshMM()
    mm.setHerd({
      id: 'manual:fox',
      speciesId: 'fox',
      currentNodeId: 'forest-region-1',
      destinationNodeId: null,
      edgeId: null,
      edgeMile: 0,
      edgeTotalMiles: 0,
      population: 4,
      daysHungry: 0,
      foodSecurity: 1.0,
      formation: 'spread',
      status: 'grazing',
      bornDay: 0,
      lastTransitionDay: 0,
    })
    expect(mm.removeHerd('manual:fox')).toBe(true)
    expect(mm.getHerds().length).toBe(0)
    expect(mm.removeHerd('manual:fox')).toBe(false)
  })
})

describe('MMWildFauna — domain serialization', () => {
  it('serialize preserves herds and cumulative counters', () => {
    const mm = freshMM()
    const tp = freshTp()
    mm.accumulatePotential(7, 7, tp)
    mm.resolve(7, tp)

    const ser = mm.serialize()
    expect(ser.state.id).toBe('wild_fauna:forest-region-1')
    const dom = ser.domain as { cumulative: { resolveCount: number }; herds: WildHerd[] }
    expect(dom.cumulative.resolveCount).toBe(1)
    expect(dom.herds.length).toBe(mm.getHerds().length)
  })
})
