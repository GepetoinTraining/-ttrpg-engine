import { describe, it, expect } from 'vitest'
import { MMEcologyInteractables, RARITY_REGEN_RATE } from '../mm-ecology-interactables'
import { TP } from '../tp'
import { getInteractable, interactablesByBiome } from '../ecology-interactables'

function freshTp(): TP {
  const tp = new TP()
  tp.loadNodes([
    { id: 'forest-region-1', type: 'region', name: 'Forest', parentId: null, dataStatic: {} },
    { id: 'plains-region-1', type: 'region', name: 'Plains', parentId: null, dataStatic: {} },
    { id: 'desert-region-1', type: 'region', name: 'Desert', parentId: null, dataStatic: {} },
  ])
  return tp
}

describe('MMEcologyInteractables — construction', () => {
  it('initializes empty', () => {
    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    expect(mm.state.id).toBe('ecology_interactables:forest-region-1')
    expect(mm.state.mmType).toBe('ecology_interactables')
    expect(Object.keys(mm.serialize().domain as { densityById: Record<string, number> }).length).toBeGreaterThan(0)
  })
})

describe('MMEcologyInteractables — lazy init', () => {
  it('seeds every eligible species at biome baseline on first resolve', () => {
    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const eligible = interactablesByBiome('forest')
    expect(eligible.length).toBeGreaterThan(0)
    for (const sp of eligible) {
      const got = mm.getDensity(sp.id)
      expect(got).toBeDefined()
      // After 1 day of regen, density should still be at baseline (started there).
      expect(got).toBeCloseTo(sp.baseDensity, 5)
    }
  })

  it('biome with no eligible species ends up with empty density map', () => {
    // Use a biome no interactable species has — engineered absence
    const mm = new MMEcologyInteractables({ regionNodeId: 'desert-region-1', biome: 'arctic_desert' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const dom = mm.serialize().domain as { densityById: Record<string, number> }
    expect(Object.keys(dom.densityById).length).toBe(0)
  })
})

describe('MMEcologyInteractables — autonomous regen', () => {
  it('depleted density regenerates toward baseline over days', () => {
    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    const tp = freshTp()
    // First resolve to seed.
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)

    // Find a common species and deplete it (write through to κ so the next
    // hydrate doesn't clobber the delta).
    const willow = getInteractable('willow-bark') // common, baseDensity 0.85
    mm.applyDelta(willow.id, -0.5, tp) // drop to ~0.35
    const dropped = mm.getDensity(willow.id)!
    expect(dropped).toBeCloseTo(0.35, 5)

    // Fold 30 days; common rate 0.01/day → +0.3 → back to ~0.65
    mm.accumulatePotential(30, 31, tp)
    mm.resolve(31, tp)
    const after = mm.getDensity(willow.id)!
    expect(after).toBeGreaterThan(dropped)
    expect(after).toBeLessThanOrEqual(willow.baseDensity)
  })

  it('density never exceeds baseline (clamp on regen)', () => {
    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const willow = getInteractable('willow-bark')
    // Fold many days to ensure regen would overshoot if unclamped.
    mm.accumulatePotential(1000, 1001, tp)
    mm.resolve(1001, tp)
    const after = mm.getDensity(willow.id)!
    expect(after).toBeLessThanOrEqual(willow.baseDensity)
  })

  it('regen rate constants are ordered common > uncommon > rare', () => {
    expect(RARITY_REGEN_RATE.common).toBeGreaterThan(RARITY_REGEN_RATE.uncommon)
    expect(RARITY_REGEN_RATE.uncommon).toBeGreaterThan(RARITY_REGEN_RATE.rare)
  })

  it('regenRate override path: faster rate produces higher density after equal fold', () => {
    const fast = new MMEcologyInteractables({
      regionNodeId: 'forest-region-1', biome: 'forest', regenRate: { common: 0.05 },
    })
    const slow = new MMEcologyInteractables({
      regionNodeId: 'forest-region-1', biome: 'forest', regenRate: { common: 0.001 },
    })
    const tpA = freshTp()
    const tpB = freshTp()
    fast.accumulatePotential(1, 1, tpA); fast.resolve(1, tpA)
    slow.accumulatePotential(1, 1, tpB); slow.resolve(1, tpB)
    fast.applyDelta('morel-mushroom', -0.5, tpA)
    slow.applyDelta('morel-mushroom', -0.5, tpB)
    fast.accumulatePotential(2, 3, tpA); fast.resolve(3, tpA)
    slow.accumulatePotential(2, 3, tpB); slow.resolve(3, tpB)
    expect(fast.getDensity('morel-mushroom')!).toBeGreaterThan(slow.getDensity('morel-mushroom')!)
  })
})

describe('MMEcologyInteractables — κ projection', () => {
  it('writes κ.ecology.interactableDensity on resolve', () => {
    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    const ctx = tp.resolve('forest-region-1')
    const eco = ctx?.ecology
    expect(eco?.interactableDensity).toBeDefined()
    expect(Object.keys(eco?.interactableDensity ?? {}).length).toBeGreaterThan(0)
  })

  it('hydrates from κ if interactableDensity exists there', () => {
    const tp = freshTp()
    tp.writeDomain('forest-region-1', 'ecology', {
      interactableDensity: { 'willow-bark': 0.2, 'morel-mushroom': 0.4 },
    })

    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    // After 1d regen at common rate (0.01), willow goes from 0.2 → 0.21, morel 0.4 → 0.41
    expect(mm.getDensity('willow-bark')).toBeCloseTo(0.21, 5)
    expect(mm.getDensity('morel-mushroom')).toBeCloseTo(0.41, 5)
  })
})

describe('MMEcologyInteractables — applyDelta', () => {
  it('clamps density at 0', () => {
    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    mm.applyDelta('willow-bark', -10)
    expect(mm.getDensity('willow-bark')).toBe(0)
  })

  it('clamps density at 1', () => {
    const mm = new MMEcologyInteractables({ regionNodeId: 'forest-region-1', biome: 'forest' })
    const tp = freshTp()
    mm.accumulatePotential(1, 1, tp)
    mm.resolve(1, tp)
    mm.applyDelta('willow-bark', 10)
    expect(mm.getDensity('willow-bark')).toBe(1)
  })
})
