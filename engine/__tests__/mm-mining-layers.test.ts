import { describe, it, expect } from 'vitest'
import { MMMineNode } from '../mm-mining-layers'
import { TP } from '../tp'
import { createSurfaceLayer, type MineLayer } from '../mining-layers'

function freshTp(): TP {
  const tp = new TP()
  tp.loadNodes([
    { id: 'mine-1', type: 'mine', name: 'Mine 1', parentId: null, dataStatic: {} },
    { id: 'mine-2', type: 'mine', name: 'Mine 2', parentId: null, dataStatic: {} },
  ])
  return tp
}

describe('MMMineNode — construction', () => {
  it('initializes with empty layers when no initialLayers', () => {
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    expect(mm.getLayers().length).toBe(0)
    expect(mm.state.id).toBe('mine_node:mine-1')
    expect(mm.state.nodeId).toBe('mine-1')
    expect(mm.state.mmType).toBe('mine_node')
  })

  it('accepts initialLayers', () => {
    const surface = createSurfaceLayer('mine-1')
    const mm = new MMMineNode({ mineNodeId: 'mine-1', initialLayers: [surface] })
    expect(mm.getLayers().length).toBe(1)
    expect(mm.getLayer(0)).toBeDefined()
  })
})

describe('MMMineNode — lazy init', () => {
  it('creates surface layer on first resolve', () => {
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const layers = mm.getLayers()
    expect(layers.length).toBe(1)
    expect(layers[0].layerId).toBe(0)
    expect(layers[0].depth).toBe(0)
    expect(layers[0].revealed).toBe(true)
    expect(layers[0].reserve).toBeGreaterThan(0)
  })

  it('lazy init is deterministic from mineNodeId', () => {
    const mmA = new MMMineNode({ mineNodeId: 'same-mine' })
    const mmB = new MMMineNode({ mineNodeId: 'same-mine' })
    const tpA = freshTp()
    const tpB = freshTp()
    mmA.resolve(0, tpA)
    mmB.resolve(0, tpB)
    expect(mmA.getLayer(0)!.resourceType).toBe(mmB.getLayer(0)!.resourceType)
    expect(mmA.getLayer(0)!.initialReserve).toBe(mmB.getLayer(0)!.initialReserve)
  })
})

describe('MMMineNode — autonomous depletion', () => {
  it('reserve drops over multiple days', () => {
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const initialReserve = mm.getLayer(0)!.reserve

    mm.accumulatePotential(30, 31, tp)
    mm.resolve(31, tp)
    const afterReserve = mm.getLayer(0)!.reserve
    expect(afterReserve).toBeLessThan(initialReserve)
  })

  it('cumulative.daysAccumulated tracks fold totals', () => {
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    const tp = freshTp()
    mm.accumulatePotential(7, 7, tp)
    mm.resolve(7, tp)
    mm.accumulatePotential(3, 10, tp)
    mm.resolve(10, tp)
    const dom = mm.serialize().domain as { cumulative: { daysAccumulated: number; resolveCount: number } }
    expect(dom.cumulative.daysAccumulated).toBe(10)
    expect(dom.cumulative.resolveCount).toBe(2)
  })

  it('layersDepleted increments when a layer hits zero reserve', () => {
    // Plant a near-empty layer
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    const tp = freshTp()
    mm.setLayer({
      layerId: 0,
      depth: 0,
      resourceType: 'stone',
      initialReserve: 1000,
      reserve: 5,
      depletionRate: 20,
      structuralIntegrity: 0.9,
      hazardThreshold: 0.3,
      revealed: true,
    })
    mm.accumulatePotential(2, 2, tp)
    mm.resolve(2, tp)
    expect(mm.getLayer(0)!.reserve).toBe(0)
    const dom = mm.serialize().domain as { cumulative: { layersDepleted: number } }
    expect(dom.cumulative.layersDepleted).toBe(1)
  })
})

describe('MMMineNode — κ projection', () => {
  it('writes κ.infrastructure.mineLayers on resolve', () => {
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const ctx = tp.resolve('mine-1')
    const infra = ctx?.infrastructure
    expect(infra?.mineLayers).toBeDefined()
    expect(Array.isArray(infra?.mineLayers)).toBe(true)
    expect((infra?.mineLayers as MineLayer[]).length).toBe(1)
  })

  it('hydrates from κ if mineLayers exist there', () => {
    const tp = freshTp()
    const planted: MineLayer = {
      layerId: 0,
      depth: 0,
      resourceType: 'iron_ore',
      initialReserve: 5000,
      reserve: 4000,
      depletionRate: 10,
      structuralIntegrity: 0.8,
      hazardThreshold: 0.3,
      revealed: true,
    }
    tp.writeDomain('mine-1', 'infrastructure', { mineLayers: [planted] })

    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const got = mm.getLayer(0)!
    expect(got.resourceType).toBe('iron_ore')
    // After 1 day at depletionRate 10 → reserve = 4000 - 10 = 3990
    expect(got.reserve).toBe(3990)
  })
})

describe('MMMineNode — manual layer control', () => {
  it('setLayer inserts or replaces by layerId', () => {
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    const layer1: MineLayer = {
      layerId: 1,
      depth: 50,
      resourceType: 'iron_ore',
      initialReserve: 2000,
      reserve: 2000,
      depletionRate: 10,
      structuralIntegrity: 1.0,
      hazardThreshold: 0.3,
      revealed: true,
    }
    mm.setLayer(layer1)
    expect(mm.getLayer(1)!.resourceType).toBe('iron_ore')
    mm.setLayer({ ...layer1, reserve: 500 })
    expect(mm.getLayer(1)!.reserve).toBe(500)
    expect(mm.getLayers().length).toBe(1)
  })

  it('setLayer keeps layers sorted by layerId', () => {
    const mm = new MMMineNode({ mineNodeId: 'mine-1' })
    mm.setLayer({
      layerId: 2,
      depth: 100,
      resourceType: 'tin_ore',
      initialReserve: 1500,
      reserve: 1500,
      depletionRate: 5,
      structuralIntegrity: 1.0,
      hazardThreshold: 0.3,
      revealed: true,
    })
    mm.setLayer({
      layerId: 1,
      depth: 50,
      resourceType: 'iron_ore',
      initialReserve: 2000,
      reserve: 2000,
      depletionRate: 10,
      structuralIntegrity: 1.0,
      hazardThreshold: 0.3,
      revealed: true,
    })
    const layers = mm.getLayers()
    expect(layers[0].layerId).toBe(1)
    expect(layers[1].layerId).toBe(2)
  })
})
