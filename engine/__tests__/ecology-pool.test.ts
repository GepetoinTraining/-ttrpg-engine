import { describe, it, expect } from 'vitest'
import { TP, type WorldNode } from '../tp'
import {
  getAdaptationPool,
  writeAdaptationPool,
  regionForNode,
  ecologyAt,
} from '../ecology-pool'
import { createAdaptationPool, reportClear, evolvePool } from '../adaptation'

const SEED = 12345

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'faerun',     type: 'continent',  name: 'Faerûn',         parentId: null,        dataStatic: {} },
    { id: 'sword_coast',type: 'region',     name: 'Sword Coast',    parentId: 'faerun',    dataStatic: {} },
    { id: 'thundertree',type: 'settlement', name: 'Thundertree',    parentId: 'sword_coast', dataStatic: {} },
    { id: 'old_owl_well',type: 'edge_site', name: 'Old Owl Well',   parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

describe('regionForNode', () => {
  it('returns the closest region-typed ancestor', () => {
    const tp = makeTP()
    expect(regionForNode(tp, 'thundertree')).toBe('sword_coast')
    expect(regionForNode(tp, 'old_owl_well')).toBe('sword_coast')
  })

  it('returns the node itself when it is a region', () => {
    const tp = makeTP()
    expect(regionForNode(tp, 'sword_coast')).toBe('sword_coast')
  })

  it('falls back to a continent if no region exists', () => {
    const tp = new TP()
    tp.loadNodes([
      { id: 'planet', type: 'planet', name: 'Toril', parentId: null, dataStatic: {} },
      { id: 'continent', type: 'continent', name: 'Faerûn', parentId: 'planet', dataStatic: {} },
      { id: 'lone_hub', type: 'settlement', name: 'Lone Hub', parentId: 'continent', dataStatic: {} },
    ])
    expect(regionForNode(tp, 'lone_hub')).toBe('continent')
  })

  it('returns the node itself when not in the graph', () => {
    const tp = makeTP()
    expect(regionForNode(tp, 'nonexistent')).toBe('nonexistent')
  })
})

describe('getAdaptationPool', () => {
  it('returns a fresh pool when nothing is stored', () => {
    const tp = makeTP()
    const pool = getAdaptationPool(tp, 'thundertree', 'goblin')
    expect(pool.speciesId).toBe('goblin')
    expect(pool.generation).toBe(0)
    expect(pool.weights.ARMORED).toBe(1.0)
  })

  it('reads via κ inheritance — pool stored at region is visible from child', () => {
    const tp = makeTP()
    let pool = createAdaptationPool('goblin')
    pool.weights.ARMORED = 4.0
    pool.generation = 7
    writeAdaptationPool(tp, 'sword_coast', pool)

    // Read from a CHILD node — should inherit
    const fromChild = getAdaptationPool(tp, 'thundertree', 'goblin')
    expect(fromChild.generation).toBe(7)
    expect(fromChild.weights.ARMORED).toBe(4.0)
  })

  it('different species at same region have independent pools', () => {
    const tp = makeTP()
    const goblinPool = createAdaptationPool('goblin')
    goblinPool.weights.STEALTH = 5.0
    writeAdaptationPool(tp, 'sword_coast', goblinPool)

    const orcPool = createAdaptationPool('orc')
    orcPool.weights.ARMORED = 3.0
    writeAdaptationPool(tp, 'sword_coast', orcPool)

    expect(getAdaptationPool(tp, 'thundertree', 'goblin').weights.STEALTH).toBe(5.0)
    expect(getAdaptationPool(tp, 'thundertree', 'orc').weights.ARMORED).toBe(3.0)
    // Cross-check: goblin pool DOES NOT have orc's bumps
    expect(getAdaptationPool(tp, 'thundertree', 'goblin').weights.ARMORED).toBe(1.0)
  })
})

describe('writeAdaptationPool', () => {
  it('persists a pool that survives an evolve cycle', () => {
    const tp = makeTP()
    let pool = createAdaptationPool('goblin')
    for (let i = 0; i < 3; i++) {
      reportClear(pool, { adaptations: ['ARMORED'], casualties: 2, permanent: false, generation: i })
    }
    pool = evolvePool(pool)
    writeAdaptationPool(tp, 'sword_coast', pool)

    const reread = getAdaptationPool(tp, 'sword_coast', 'goblin')
    expect(reread.generation).toBe(1)
    expect(reread.weights.ARMORED).toBeGreaterThan(1.0)  // bumped by fitness
  })

  it('returns false for nonexistent node', () => {
    const tp = makeTP()
    const pool = createAdaptationPool('goblin')
    expect(writeAdaptationPool(tp, 'nonexistent', pool)).toBe(false)
  })

  it('multiple writes across species accumulate (no overwrite)', () => {
    const tp = makeTP()
    const a = createAdaptationPool('goblin')
    a.weights.PACK = 4.0
    writeAdaptationPool(tp, 'sword_coast', a)

    const b = createAdaptationPool('orc')
    b.weights.SWIFT = 3.0
    writeAdaptationPool(tp, 'sword_coast', b)

    expect(getAdaptationPool(tp, 'sword_coast', 'goblin').weights.PACK).toBe(4.0)
    expect(getAdaptationPool(tp, 'sword_coast', 'orc').weights.SWIFT).toBe(3.0)
  })
})

describe('ecologyAt', () => {
  it('combines biome + fauna + adaptation accessor', () => {
    const tp = makeTP()
    const e = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    expect(typeof e.biome).toBe('string')
    expect(Array.isArray(e.faunaPool)).toBe(true)
    expect(e.regionNodeId).toBe('sword_coast')
    expect(typeof e.getAdaptations).toBe('function')
    expect(typeof e.selectSpecies).toBe('function')
  })

  it('selectSpecies returns a species deterministically', () => {
    const tp = makeTP()
    const e = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const s1 = e.selectSpecies('lair', 7)
    const s2 = e.selectSpecies('lair', 7)
    expect(s1).toBe(s2)
  })

  it('getAdaptations returns species-specific pools', () => {
    const tp = makeTP()
    const e = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const goblin = e.getAdaptations('goblin')
    const orc = e.getAdaptations('orc')
    expect(goblin.speciesId).toBe('goblin')
    expect(orc.speciesId).toBe('orc')
  })

  it('regionNodeId is the place to write evolved pools', () => {
    const tp = makeTP()
    const e = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const pool = createAdaptationPool('goblin')
    pool.weights.CUNNING = 4.5
    writeAdaptationPool(tp, e.regionNodeId, pool)

    // Another node in the same region sees it
    const e2 = ecologyAt(tp, SEED, 6, 6, 'old_owl_well')
    expect(e2.getAdaptations('goblin').weights.CUNNING).toBe(4.5)
  })
})

describe('full lifecycle — clear → evolve → respawn', () => {
  it('a series of clears bumps fitness, evolve re-weights, next gen draws from updated pool', () => {
    const tp = makeTP()
    const region = 'sword_coast'

    // Generation 0: pool starts uniform
    let pool = getAdaptationPool(tp, region, 'goblin')
    expect(pool.generation).toBe(0)

    // Players clear the gate — population had ARMORED + PACK, caused 6 casualties, capped (not permanent)
    reportClear(pool, {
      adaptations: ['ARMORED', 'PACK'],
      casualties: 6,
      permanent: false,
      generation: 0,
    })
    // Persist
    writeAdaptationPool(tp, region, pool)

    // Respawn — read latest pool, evolve, write
    pool = getAdaptationPool(tp, region, 'goblin')
    pool = evolvePool(pool)
    writeAdaptationPool(tp, region, pool)

    // Generation 1: ARMORED + PACK should be heavier than untouched STEALTH
    const evolved = getAdaptationPool(tp, region, 'goblin')
    expect(evolved.generation).toBe(1)
    expect(evolved.weights.ARMORED).toBeGreaterThan(evolved.weights.STEALTH)
    expect(evolved.weights.PACK).toBeGreaterThan(evolved.weights.STEALTH)
  })
})
