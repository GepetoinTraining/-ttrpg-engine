import { describe, it, expect } from 'vitest'
import { createSurfaceLayer, revealNextLayer } from '../mining-layers'
import { mfMineDig, mfMineReveal } from '../mf-mine-dig'

describe('mfMineDig — happy path', () => {
  it('extracts proportional to depletionRate + margin on success', () => {
    const layer = createSurfaceLayer('mine-A')
    const r = mfMineDig(layer, { d20: 18, skillModifier: 4, days: 1 })
    expect(r.receipt.success).toBe(true)
    expect(r.output.extracted).toBeGreaterThan(0)
    expect(r.output.layerAfter.reserve).toBeLessThan(layer.reserve)
    expect(r.output.layerAfter.structuralIntegrity).toBeLessThan(layer.structuralIntegrity)
    expect(r.output.hazard).toBeNull()
  })

  it('does not extract more than the remaining reserve', () => {
    const layer = { ...createSurfaceLayer('mine-A'), reserve: 5 }
    const r = mfMineDig(layer, { d20: 20, skillModifier: 10, days: 30 })
    expect(r.output.extracted).toBeLessThanOrEqual(5)
    expect(r.output.layerAfter.reserve).toBe(Math.max(0, 5 - r.output.extracted))
  })

  it('flags depletedNow when reserve hits zero this dig', () => {
    const layer = { ...createSurfaceLayer('mine-A'), reserve: 5 }
    const r = mfMineDig(layer, { d20: 20, skillModifier: 10, days: 30 })
    expect(r.output.depletedNow).toBe(true)
  })
})

describe('mfMineDig — failure + hazards', () => {
  it('fail = no extraction + hazard event', () => {
    const layer = createSurfaceLayer('mine-B')
    const r = mfMineDig(layer, { d20: 1, skillModifier: 0, days: 1 })
    expect(r.receipt.success).toBe(false)
    expect(r.output.extracted).toBe(0)
    expect(r.output.hazard).not.toBeNull()
    expect(r.output.hazard!.severity).toBeGreaterThan(0)
  })

  it('low integrity triggers hazard even on success', () => {
    const fragile = { ...createSurfaceLayer('mine-C'), structuralIntegrity: 0.25 }
    const r = mfMineDig(fragile, { d20: 20, skillModifier: 10, days: 1 })
    expect(r.receipt.success).toBe(true)
    expect(r.output.hazard).not.toBeNull()
  })

  it('coal at depth picks gasLeak hazard', () => {
    const coalLayer = {
      ...createSurfaceLayer('mine-coal'),
      resourceType: 'coal' as const,
      depth: 150,
      structuralIntegrity: 0.1,
    }
    const r = mfMineDig(coalLayer, { d20: 20, skillModifier: 10, days: 1 })
    expect(r.output.hazard?.kind).toBe('gasLeak')
  })
})

describe('mfMineDig — invariants', () => {
  it('throws on unrevealed layer', () => {
    const layer = { ...createSurfaceLayer('mine-D'), revealed: false }
    expect(() => mfMineDig(layer, { d20: 18, skillModifier: 0 })).toThrow(/not yet revealed/)
  })
  it('throws on depleted layer', () => {
    const layer = { ...createSurfaceLayer('mine-D'), reserve: 0 }
    expect(() => mfMineDig(layer, { d20: 18, skillModifier: 0 })).toThrow(/depleted/)
  })
  it('depletion penalty raises effective DC at low density', () => {
    const layer = createSurfaceLayer('mine-E')
    const fresh = mfMineDig(layer, { d20: 18, skillModifier: 0, days: 1 })
    const sparse = {
      ...layer,
      reserve: Math.floor(layer.initialReserve * 0.1),
    }
    const sparseRoll = mfMineDig(sparse, { d20: 18, skillModifier: 0, days: 1 })
    expect(sparseRoll.receipt.effectiveDC).toBeGreaterThan(fresh.receipt.effectiveDC)
  })
})

describe('mfMineReveal', () => {
  it('reveals the next layer on success', () => {
    const surface = createSurfaceLayer('mine-R')
    const r = mfMineReveal(surface, {
      mineNodeId: 'mine-R',
      worldDay: 100,
      d20: 20,
      skillModifier: 10,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.output.newLayer).not.toBeNull()
    expect(r.output.newLayer!.layerId).toBe(1)
    expect(r.output.parentAfter.structuralIntegrity).toBeLessThan(surface.structuralIntegrity)
  })

  it('returns null newLayer + hazard on failure', () => {
    const surface = createSurfaceLayer('mine-R')
    const r = mfMineReveal(surface, {
      mineNodeId: 'mine-R',
      worldDay: 100,
      d20: 1,
      skillModifier: 0,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.output.newLayer).toBeNull()
    expect(r.output.hazard).not.toBeNull()
  })

  it('reveal DC scales with depth', () => {
    const surface = createSurfaceLayer('mine-D')
    const layer1 = revealNextLayer(surface, 'mine-D', 100)!
    const surfaceReveal = mfMineReveal(surface, {
      mineNodeId: 'mine-D',
      worldDay: 100,
      d20: 15,
      skillModifier: 0,
    })
    const deepReveal = mfMineReveal(layer1, {
      mineNodeId: 'mine-D',
      worldDay: 100,
      d20: 15,
      skillModifier: 0,
    })
    expect(deepReveal.receipt.baseDC).toBeGreaterThan(surfaceReveal.receipt.baseDC)
  })

  it('throws on unrevealed parent', () => {
    const layer = { ...createSurfaceLayer('mine-X'), revealed: false }
    expect(() =>
      mfMineReveal(layer, { mineNodeId: 'mine-X', worldDay: 1, d20: 18, skillModifier: 0 }),
    ).toThrow(/not revealed/)
  })

  it('is deterministic — same inputs → same outputs', () => {
    const surface = createSurfaceLayer('mine-Z')
    const args = { mineNodeId: 'mine-Z', worldDay: 42, d20: 17, skillModifier: 2 }
    const a = mfMineReveal(surface, args)
    const b = mfMineReveal(surface, args)
    expect(a).toEqual(b)
  })
})
