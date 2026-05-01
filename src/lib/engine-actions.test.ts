import { describe, it, expect } from 'vitest'
import {
  actHunt,
  actTrap,
  actTame,
  actDomesticate,
  actMineDig,
  actMineReveal,
  actStudyEcology,
  actHarvestEcology,
  actCraftBasic,
  actCraftDiscover,
  actStudyTech,
} from './engine-actions'
import { getSpecies, type WildHerd } from '../../engine/wild-fauna'
import { createSurfaceLayer, type MineLayer } from '../../engine/mining-layers'
import { getSeedBlob } from '../../engine/technology-web'

const CERT_ID = 'cert-test-1'

function freshHerd(speciesId: string, over: Partial<WildHerd> = {}): WildHerd {
  const sp = getSpecies(speciesId)
  return {
    id: `forest-1:${speciesId}`,
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
    ...over,
  }
}

// ============================================================
// HUNT
// ============================================================
describe('actHunt', () => {
  it('successful hunt produces a writeKappa with the updated herd', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = actHunt({
      herd, species: sp,
      ctx: { d20: 20, skillModifier: 5, worldDay: 1 },
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.actions.length).toBe(1)
    const a = r.actions[0]
    expect(a.type).toBe('writeKappa')
    if (a.type === 'writeKappa') {
      expect(a.nodeId).toBe('forest-1')
      expect(a.domain).toBe('ecology')
      expect(a.paths).toEqual([`ecology.herds.${herd.id}`])
      expect(a.system).toBe(`client-intent:hunt-fauna:${CERT_ID}`)
      const v = a.value as { herds: Record<string, WildHerd> }
      expect(v.herds[herd.id].population).toBeLessThan(herd.population)
    }
  })

  it('failed hunt may still produce a writeKappa if status flipped to fleeing', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = actHunt({
      herd, species: sp,
      ctx: { d20: 1, skillModifier: 0, worldDay: 1 },
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.actions.length).toBe(1) // status flip → writeKappa for fleeing
  })

  it('failed predator hunt with no status flip → no actions', () => {
    const sp = getSpecies('fox')
    const herd = freshHerd('fox')
    const r = actHunt({
      herd, species: sp,
      ctx: { d20: 1, skillModifier: 0, worldDay: 1 },
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.actions.length).toBe(0)
  })
})

// ============================================================
// TRAP
// ============================================================
describe('actTrap', () => {
  it('successful trap produces writeKappa + captured creature', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = actTrap({
      herd, species: sp,
      ctx: { d20: 20, skillModifier: 3, worldDay: 1 },
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.result.captured).not.toBeNull()
    expect(r.actions.length).toBe(1)
    const a = r.actions[0]
    if (a.type === 'writeKappa') {
      expect(a.system).toBe(`client-intent:trap-fauna:${CERT_ID}`)
      const v = a.value as { herds: Record<string, WildHerd> }
      expect(v.herds[herd.id].population).toBe(herd.population - 1)
    }
  })

  it('failed trap with no capture → no actions', () => {
    const sp = getSpecies('rabbit')
    const herd = freshHerd('rabbit')
    const r = actTrap({
      herd, species: sp,
      ctx: { d20: 1, skillModifier: 0, worldDay: 1 },
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.actions.length).toBe(0)
  })
})

// ============================================================
// TAME
// ============================================================
describe('actTame', () => {
  it('always returns 0 actions (follower wiring is non-κ)', () => {
    const sp = getSpecies('fox')
    const r = actTame({
      captured: { speciesId: 'fox', trophic: sp.trophic, trappedOnDay: 1 },
      species: sp,
      ctx: { d20: 18, skillModifier: 3, worldDay: 5 },
    })
    expect(r.receipt.success).toBe(true)
    expect(r.result.followerSpec).not.toBeNull()
    expect(r.actions.length).toBe(0)
  })
})

// ============================================================
// DOMESTICATE
// ============================================================
describe('actDomesticate', () => {
  it('always returns 0 actions (livestock wiring is non-κ)', () => {
    const sp = getSpecies('rabbit')
    const r = actDomesticate({
      captured: { speciesId: 'rabbit', trophic: sp.trophic, trappedOnDay: 1 },
      species: sp,
      ctx: { d20: 18, skillModifier: 5, worldDay: 7, days: 7 },
    })
    expect(r.receipt.success).toBe(true)
    expect(r.result.completed).toBe(true)
    expect(r.actions.length).toBe(0)
  })
})

// ============================================================
// MINE DIG / REVEAL
// ============================================================
describe('actMineDig', () => {
  it('emits writeKappa with the full mineLayers stack', () => {
    const layer = createSurfaceLayer('mine-1')
    const r = actMineDig({
      layer, mineNodeId: 'mine-1',
      ctx: { d20: 18, skillModifier: 3, days: 1 },
      currentLayers: [layer],
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.actions.length).toBe(1)
    const a = r.actions[0]
    if (a.type === 'writeKappa') {
      expect(a.nodeId).toBe('mine-1')
      expect(a.domain).toBe('infrastructure')
      expect(a.system).toBe(`client-intent:mine-dig:${CERT_ID}`)
      const v = a.value as { mineLayers: MineLayer[] }
      expect(v.mineLayers.length).toBe(1)
      expect(v.mineLayers[0].reserve).toBeLessThan(layer.reserve)
    }
  })
})

describe('actMineReveal', () => {
  it('emits writeKappa with the new layer added on success', () => {
    const surface = createSurfaceLayer('mine-1')
    const r = actMineReveal({
      parent: surface,
      ctx: { d20: 20, skillModifier: 10, mineNodeId: 'mine-1', worldDay: 1 },
      currentLayers: [surface],
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.result.newLayer).not.toBeNull()
    const a = r.actions[0]
    if (a.type === 'writeKappa') {
      const v = a.value as { mineLayers: MineLayer[] }
      expect(v.mineLayers.length).toBe(2)
      expect(v.mineLayers[1].layerId).toBe(1)
    }
  })

  it('failure: no new layer, parent integrity drops, single-layer κ value', () => {
    const surface = createSurfaceLayer('mine-1')
    const r = actMineReveal({
      parent: surface,
      ctx: { d20: 1, skillModifier: 0, mineNodeId: 'mine-1', worldDay: 1 },
      currentLayers: [surface],
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(false)
    const a = r.actions[0]
    if (a.type === 'writeKappa') {
      const v = a.value as { mineLayers: MineLayer[] }
      expect(v.mineLayers.length).toBe(1)
      expect(v.mineLayers[0].structuralIntegrity).toBeLessThan(surface.structuralIntegrity)
    }
  })
})

// ============================================================
// ECOLOGY STUDY / HARVEST
// ============================================================
describe('actStudyEcology', () => {
  it('returns no actions (knowledge is per-character)', () => {
    const r = actStudyEcology({
      ctx: { speciesId: 'willow-bark', d20: 16, skillModifier: 2, priorKnowledge: 0 },
    })
    expect(r.receipt.success).toBe(true)
    expect(r.receipt.newKnowledge).toBeGreaterThan(r.receipt.priorKnowledge)
    expect(r.actions.length).toBe(0)
  })
})

describe('actHarvestEcology', () => {
  it('successful harvest emits writeKappa with reduced density', () => {
    const r = actHarvestEcology({
      ctx: { speciesId: 'willow-bark', d20: 18, skillModifier: 3 },
      regionNodeId: 'forest-1',
      currentDensity: { 'willow-bark': 0.85 },
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.actions.length).toBe(1)
    const a = r.actions[0]
    if (a.type === 'writeKappa') {
      expect(a.system).toBe(`client-intent:harvest-ecology:${CERT_ID}`)
      const v = a.value as { interactableDensity: Record<string, number> }
      expect(v.interactableDensity['willow-bark']).toBeLessThan(0.85)
    }
  })

  it('failed harvest → no actions', () => {
    const r = actHarvestEcology({
      ctx: { speciesId: 'willow-bark', d20: 1, skillModifier: 0 },
      regionNodeId: 'forest-1',
      currentDensity: { 'willow-bark': 0.85 },
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.actions.length).toBe(0)
  })
})

// ============================================================
// CRAFT
// ============================================================
describe('actCraftBasic', () => {
  it('returns no actions (inventory is character-side)', () => {
    const r = actCraftBasic({
      purpose: 'gathering-flora',
      ctx: { d20: 18, skillModifier: 3, seedKey: 'k' },
    })
    expect(r.receipt.success).toBe(true)
    expect(r.actions.length).toBe(0)
  })
})

describe('actCraftDiscover', () => {
  it('returns no actions on success', () => {
    const r = actCraftDiscover({
      purpose: 'gathering-aquatic',
      ctx: { d20: 18, skillModifier: 5, seedKey: 'k', trigger: 'aquatic-study-trout', tier: 2 },
    })
    expect(r.receipt.success).toBe(true)
    expect(r.actions.length).toBe(0)
  })
})

// ============================================================
// STUDY TECH
// ============================================================
describe('actStudyTech', () => {
  it('successful tier promotion emits writeKappa with unlockedTech update', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const r = actStudyTech({
      prior: f,
      ctx: { d20: 18, skillModifier: 0, seedKey: 'k' },
      settlementNodeId: 'suzail',
      currentUnlocks: {},
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(true)
    expect(r.actions.length).toBe(1)
    const a = r.actions[0]
    if (a.type === 'writeKappa') {
      expect(a.nodeId).toBe('suzail')
      expect(a.domain).toBe('knowledge')
      expect(a.system).toBe(`client-intent:study-tech:${CERT_ID}`)
      const v = a.value as { unlockedTech: Record<string, string> }
      expect(v.unlockedTech['fishing-tool']).toBe('E')
    }
  })

  it('failed study → no actions', () => {
    const f = getSeedBlob('fishing-tool', 'F')!
    const r = actStudyTech({
      prior: f,
      ctx: { d20: 1, skillModifier: 0, seedKey: 'k' },
      settlementNodeId: 'suzail',
      currentUnlocks: {},
      certId: CERT_ID,
    })
    expect(r.receipt.success).toBe(false)
    expect(r.actions.length).toBe(0)
  })
})
