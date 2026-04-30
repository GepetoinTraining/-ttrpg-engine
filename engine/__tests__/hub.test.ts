/**
 * HUB TOPOLOGY TESTS
 * =====================
 * Deterministic generation, chunk management, observer loading,
 * hub generation, and the core invariant: same seed → same city.
 */

import { describe, it, expect } from 'vitest'
import {
  HUB_SIZE_CONFIG,
  DISTRICT_ADJACENCY,
  CHUNK_LOAD_RADIUS,
  MAX_CACHED_CHUNKS,
} from '../hub-schema.js'
import type { HubSeed, HubObserverState } from '../hub-schema.js'
import {
  SeededRNG,
  NaturalTopology,
  PlannedTopology,
  RadialTopology,
  LinearTopology,
  HybridTopology,
  generateChunkLayout,
  generateDistrictLayout,
} from '../hub-topology.js'
import { ChunkManager, HubGenerator } from '../hub-chunks.js'

// ============================================================
// SEEDED RNG — Determinism
// ============================================================

describe('Hub — SeededRNG', () => {
  it('same seed produces same sequence', () => {
    const rng1 = new SeededRNG('waterdeep')
    const rng2 = new SeededRNG('waterdeep')
    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next())
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = new SeededRNG('waterdeep')
    const rng2 = new SeededRNG('baldurs_gate')
    let same = 0
    for (let i = 0; i < 20; i++) {
      if (rng1.next() === rng2.next()) same++
    }
    expect(same).toBeLessThan(5) // Statistically near-impossible to be all same
  })

  it('rangeInt produces within bounds', () => {
    const rng = new SeededRNG('test')
    for (let i = 0; i < 100; i++) {
      const val = rng.rangeInt(5, 10)
      expect(val).toBeGreaterThanOrEqual(5)
      expect(val).toBeLessThanOrEqual(10)
    }
  })

  it('pick selects from array', () => {
    const rng = new SeededRNG('test')
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rng.pick(arr))
    }
  })

  it('shuffle preserves elements', () => {
    const rng = new SeededRNG('test')
    const arr = [1, 2, 3, 4, 5]
    const shuffled = rng.shuffle(arr)
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5])
  })
})

// ============================================================
// TOPOLOGY GENERATORS
// ============================================================

describe('Hub — Topology Generators', () => {
  it('NaturalTopology produces streets and lots', () => {
    const topo = new NaturalTopology('seed_village')
    const layout = topo.generate(0.5)
    expect(layout.streets.length).toBeGreaterThan(0)
    expect(layout.lots.length).toBeGreaterThan(0)
    expect(layout.streets.some(s => s.type === 'main')).toBe(true)
  })

  it('PlannedTopology produces grid streets', () => {
    const topo = new PlannedTopology('seed_fort')
    const layout = topo.generate(20)
    expect(layout.streets.length).toBeGreaterThan(0)
    expect(layout.lots.length).toBeGreaterThan(0)
    // Grid should have both horizontal and vertical streets
    expect(layout.streets.some(s => s.id.startsWith('h_'))).toBe(true)
    expect(layout.streets.some(s => s.id.startsWith('v_'))).toBe(true)
  })

  it('RadialTopology produces rings and radials', () => {
    const topo = new RadialTopology('seed_ancient')
    const layout = topo.generate()
    expect(layout.streets.some(s => s.id.startsWith('ring_'))).toBe(true)
    expect(layout.streets.some(s => s.id.startsWith('radial_'))).toBe(true)
    expect(layout.lots.length).toBeGreaterThan(0)
    // POI at center
    expect(layout.pois.some(p => p.x === 50 && p.y === 50)).toBe(true)
  })

  it('LinearTopology produces main road with lots on both sides', () => {
    const topo = new LinearTopology('seed_trading')
    const layout = topo.generate(false)
    expect(layout.streets.some(s => s.id === 'main')).toBe(true)
    expect(layout.lots.length).toBeGreaterThan(0)
  })

  it('HybridTopology has both natural and planned elements', () => {
    const topo = new HybridTopology('seed_hybrid')
    const layout = topo.generate(40)
    expect(layout.streets.length).toBeGreaterThan(0)
    expect(layout.lots.length).toBeGreaterThan(0)
    // Should have some outer_ prefixed streets from planned section
    expect(layout.streets.some(s => s.id.startsWith('outer_'))).toBe(true)
  })

  it('generateChunkLayout factory works for all topology types', () => {
    const types = ['natural', 'planned', 'radial', 'linear', 'hybrid', 'clustered'] as const
    for (const type of types) {
      const layout = generateChunkLayout(type, 'test_seed', 0.5)
      expect(layout.streets.length).toBeGreaterThan(0)
      expect(layout.lots.length).toBeGreaterThan(0)
    }
  })

  it('same seed produces identical layout', () => {
    const layout1 = generateChunkLayout('natural', 'my_seed_42', 0.6)
    const layout2 = generateChunkLayout('natural', 'my_seed_42', 0.6)
    expect(layout1.streets.length).toBe(layout2.streets.length)
    expect(layout1.lots.length).toBe(layout2.lots.length)
    // Check first street's first point matches exactly
    expect(layout1.streets[0].points[0].x).toBe(layout2.streets[0].points[0].x)
    expect(layout1.streets[0].points[0].y).toBe(layout2.streets[0].points[0].y)
  })
})

// ============================================================
// DISTRICT LAYOUT
// ============================================================

describe('Hub — District Layout', () => {
  it('always has a center district', () => {
    const layout = generateDistrictLayout('city', 'natural', 'seed')
    const types = [...layout.values()]
    expect(types).toContain('center')
  })

  it('city has more chunks than village', () => {
    const village = generateDistrictLayout('village', 'natural', 'seed')
    const city = generateDistrictLayout('city', 'natural', 'seed')
    expect(city.size).toBeGreaterThan(village.size)
  })

  it('adjacency rules exist for all district types', () => {
    const allTypes: string[] = [
      'center', 'residential', 'commercial', 'industrial', 'religious',
      'administrative', 'noble', 'slums', 'docks', 'military',
      'academic', 'entertainment', 'magical', 'foreign', 'garden', 'necropolis',
    ]
    for (const type of allTypes) {
      expect(DISTRICT_ADJACENCY[type as keyof typeof DISTRICT_ADJACENCY]).toBeDefined()
    }
  })
})

// ============================================================
// HUB GENERATION
// ============================================================

describe('Hub — HubGenerator', () => {
  const seed: HubSeed = {
    worldNodeId: 'node_waterdeep',
    size: 'city',
    topology: 'natural',
    era: 0,
  }

  it('generates hub with correct size', () => {
    const hub = HubGenerator.generate(seed, 'wn_waterdeep')
    expect(hub.size).toBe('city')
    expect(hub.population).toBeGreaterThanOrEqual(HUB_SIZE_CONFIG.city.minPop)
    expect(hub.population).toBeLessThanOrEqual(HUB_SIZE_CONFIG.city.maxPop)
  })

  it('city has walls and castle', () => {
    const hub = HubGenerator.generate(seed, 'wn')
    expect(hub.defenses.hasWalls).toBe(true)
    expect(hub.defenses.hasCastle).toBe(true)
    expect(hub.defenses.gateCount).toBeGreaterThanOrEqual(2)
  })

  it('hamlet has no walls', () => {
    const hamletSeed: HubSeed = { worldNodeId: 'node_hamlet', size: 'hamlet', topology: 'natural', era: 0 }
    const hub = HubGenerator.generate(hamletSeed, 'wn')
    expect(hub.defenses.hasWalls).toBe(false)
    expect(hub.defenses.hasCastle).toBe(false)
  })

  it('has districts with names and atmospheres', () => {
    const hub = HubGenerator.generate(seed, 'wn')
    expect(hub.districts.length).toBeGreaterThan(0)
    for (const d of hub.districts) {
      expect(d.name).toBeTruthy()
      expect(d.atmosphere).toBeTruthy()
    }
  })

  it('deterministic — same seed same hub', () => {
    const hub1 = HubGenerator.generate(seed, 'wn')
    const hub2 = HubGenerator.generate(seed, 'wn')
    expect(hub1.population).toBe(hub2.population)
    expect(hub1.districts.length).toBe(hub2.districts.length)
    expect(hub1.chunkGrid.width).toBe(hub2.chunkGrid.width)
  })
})

// ============================================================
// CHUNK MANAGER
// ============================================================

describe('Hub — ChunkManager', () => {
  function makeTestHub() {
    const seed: HubSeed = { worldNodeId: 'test_node', size: 'town', topology: 'natural', era: 0 }
    return HubGenerator.generate(seed, 'test_wn')
  }

  it('generates chunks on demand', () => {
    const hub = makeTestHub()
    const cm = new ChunkManager(hub)
    const chunk = cm.getChunk(0, 0)

    expect(chunk.x).toBe(0)
    expect(chunk.y).toBe(0)
    expect(chunk.buildings.length).toBeGreaterThan(0)
    expect(chunk.streets.length).toBeGreaterThan(0)
    expect(chunk.seed).toContain('chunk_0_0')
  })

  it('same chunk coords return identical content', () => {
    const hub = makeTestHub()
    const cm = new ChunkManager(hub)

    const c1 = cm.getChunk(1, 1)
    cm.clearCache()
    const c2 = cm.getChunk(1, 1)

    expect(c1.buildings.length).toBe(c2.buildings.length)
    expect(c1.streets.length).toBe(c2.streets.length)
  })

  it('LRU cache evicts oldest chunks', () => {
    const hub = makeTestHub()
    const cm = new ChunkManager(hub)

    // Fill cache beyond MAX_CACHED_CHUNKS
    const gridSize = hub.chunkGrid.width
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        cm.getChunk(x, y)
      }
    }

    const stats = cm.getCacheStats()
    expect(stats.size).toBeLessThanOrEqual(MAX_CACHED_CHUNKS)
  })

  it('loadForObserver loads current + adjacent chunks', () => {
    const hub = makeTestHub()
    const cm = new ChunkManager(hub)
    const observer: HubObserverState = {
      characterId: 'char_1',
      position: { x: 50, y: 50 },
      currentChunk: { x: 1, y: 1 },
      loadedChunks: [],
      trajectory: [],
      discoveredBuildings: [],
      discoveredDistricts: [],
      knownNPCs: [],
    }

    const loaded = cm.loadForObserver(observer)
    expect(loaded.length).toBeGreaterThan(0)
    // Should contain current chunk
    expect(loaded.some(c => c.x === 1 && c.y === 1)).toBe(true)
  })

  it('trajectory prediction adds chunks', () => {
    const hub = makeTestHub()
    const cm = new ChunkManager(hub)
    const observer: HubObserverState = {
      characterId: 'c', position: { x: 0, y: 0 },
      currentChunk: { x: 0, y: 0 },
      loadedChunks: [], trajectory: [],
      discoveredBuildings: [], discoveredDistricts: [], knownNPCs: [],
    }

    const updated = cm.updateTrajectory(observer, { dx: 1, dy: 0 })
    expect(updated.trajectory.length).toBeGreaterThan(0)
    expect(updated.trajectory[0].probability).toBeGreaterThan(updated.trajectory[updated.trajectory.length - 1].probability)
  })
})

// ============================================================
// SCHEMA CONFIGS
// ============================================================

describe('Hub — Schema Config', () => {
  it('hub sizes scale correctly', () => {
    const sizes = ['outpost', 'hamlet', 'village', 'town', 'city', 'metropolis'] as const
    let prevMaxPop = 0
    for (const size of sizes) {
      const config = HUB_SIZE_CONFIG[size]
      expect(config.minPop).toBeGreaterThanOrEqual(prevMaxPop > 0 ? prevMaxPop * 0.1 : 0)
      expect(config.maxPop).toBeGreaterThan(config.minPop)
      prevMaxPop = config.maxPop
    }
  })

  it('chunk load radius constants exist', () => {
    expect(CHUNK_LOAD_RADIUS.immediate).toBe(0)
    expect(CHUNK_LOAD_RADIUS.adjacent).toBe(1)
    expect(MAX_CACHED_CHUNKS).toBe(16)
  })
})
