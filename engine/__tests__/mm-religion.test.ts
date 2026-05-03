import { describe, it, expect } from 'vitest'
import { TP, type WorldNode, type ReligionRules } from '../tp'
import { MMReligion } from '../mm-religion'
import {
  type Pantheon,
  type Deity,
  type ClergyMember,
  type Temple,
} from '../religion'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'toril',  type: 'planet',    name: 'Toril',  parentId: null,    dataStatic: {} },
    { id: 'faerun', type: 'continent', name: 'Faerûn', parentId: 'toril', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function fakeDeity(over: Partial<Deity>): Deity {
  return {
    id: over.id ?? 'mystra',
    worldId: over.worldId ?? 'toril',
    name: over.name ?? 'Mystra',
    titles: over.titles ?? ['Lady of Mysteries'],
    alignment: over.alignment ?? 'NG',
    domains: over.domains ?? [],
    plane: over.plane ?? 'House of the Triad',
    status: over.status ?? 'active',
    faithPool: over.faithPool ?? 0,
    faithPerYear: over.faithPerYear ?? 0,
    powerTier: over.powerTier ?? 0,
    allies: over.allies ?? [],
    enemies: over.enemies ?? [],
  }
}

function fakeTemple(over: Partial<Temple>): Temple {
  return {
    id: over.id ?? 'temple_1',
    deityId: over.deityId ?? 'mystra',
    settlementId: over.settlementId ?? 'waterdeep',
    buildingId: over.buildingId ?? 'building_1',
    size: over.size ?? 'temple',
    condition: over.condition ?? 100,
    relicCount: over.relicCount ?? 0,
    consecrated: over.consecrated ?? true,
  }
}

function fakeClergy(over: Partial<ClergyMember>): ClergyMember {
  return {
    id: over.id ?? 'cleric_1',
    deityId: over.deityId ?? 'mystra',
    npcId: over.npcId ?? 'npc_1',
    templeId: over.templeId,
    rank: over.rank ?? 'priest',
    piety: over.piety ?? 50,
    yearsOfService: over.yearsOfService ?? 0,
    domainFocus: over.domainFocus,
  }
}

describe('MMReligion — construction', () => {
  it('uses religion:<nodeId> as id', () => {
    const pantheon: Pantheon = { worldId: 'toril', deities: [fakeDeity({})] }
    const mm = new MMReligion('faerun', pantheon, 0)
    expect(mm.state.id).toBe('religion:faerun')
    expect(mm.state.mmType).toBe('religion')
    expect(mm.state.nodeId).toBe('faerun')
  })
})

describe('MMReligion — yearly fold', () => {
  it('yearly tick accrues faith for active deities', () => {
    const tp = makeTP()
    const mystra = fakeDeity({ id: 'mystra', faithPool: 100 })
    const pantheon: Pantheon = { worldId: 'toril', deities: [mystra] }
    const clergy = [
      fakeClergy({ id: 'c1', rank: 'high_priest', piety: 80 }),
      fakeClergy({ id: 'c2', rank: 'priest',      piety: 60 }),
    ]
    const temples = [fakeTemple({ id: 't1', size: 'temple' })]

    const mm = new MMReligion('faerun', pantheon, 0, { clergy, temples })
    mm.accumulatePotential(360, 360)
    const result = mm.resolve(360, tp)

    expect(result.stateChanges.yearsTicked).toBe(1)
    expect(mystra.faithPool).toBeGreaterThan(100)
  })

  it('tier shifts are detected', () => {
    const tp = makeTP()
    const minor = fakeDeity({ id: 'minor', faithPool: 95, powerTier: 0 })
    const pantheon: Pantheon = { worldId: 'toril', deities: [minor] }
    // Strong clergy → push past tier 1 threshold (100)
    const clergy = [fakeClergy({ rank: 'archpriest', piety: 100, deityId: 'minor' })]
    const mm = new MMReligion('faerun', pantheon, 0, { clergy, temples: [] })

    mm.accumulatePotential(360, 360)
    const result = mm.resolve(360, tp)
    expect(result.stateChanges.tierChanges).toBeGreaterThanOrEqual(1)
    expect(result.stateChanges.ascensions).toBeGreaterThanOrEqual(1)
  })

  it('writes κ.religion with dominant + faithPool', () => {
    const tp = makeTP()
    const mystra = fakeDeity({ id: 'mystra', faithPool: 200, powerTier: 1 })
    const cyric  = fakeDeity({ id: 'cyric',  faithPool: 50,  powerTier: 0 })
    const pantheon: Pantheon = { worldId: 'toril', deities: [mystra, cyric] }
    const mm = new MMReligion('faerun', pantheon, 0)
    mm.accumulatePotential(360, 360)
    mm.resolve(360, tp)

    const ctx = tp.resolve('faerun')
    const rel = ctx?.religion as ReligionRules | undefined
    expect(rel).toBeDefined()
    expect(rel!.faithPool?.mystra).toBeGreaterThan(0)
    expect(rel!.dominant).toBe('mystra')
  })

  it('zero-year resolves to no-op', () => {
    const mm = new MMReligion('faerun', { worldId: 'toril', deities: [fakeDeity({})] }, 0)
    const result = mm.resolve(0, undefined)
    expect(result.stateChanges.yearsTicked).toBe(0)
  })

  it('dead gods have their pool decay 10% per year', () => {
    const tp = makeTP()
    const dead = fakeDeity({ id: 'old_god', status: 'dead', faithPool: 1000, powerTier: 3 })
    const pantheon: Pantheon = { worldId: 'toril', deities: [dead] }
    const mm = new MMReligion('faerun', pantheon, 0)
    mm.accumulatePotential(720, 720)   // 2 years
    mm.resolve(720, tp)
    // 1000 * 0.9 * 0.9 = 810
    expect(dead.faithPool).toBeLessThanOrEqual(810)
    expect(dead.faithPool).toBeGreaterThan(700)
  })
})

describe('MMReligion — multi-year stability', () => {
  it('runs 50 years without crashing', () => {
    const tp = makeTP()
    const mystra = fakeDeity({ id: 'mystra', faithPool: 500 })
    const pantheon: Pantheon = { worldId: 'toril', deities: [mystra] }
    const clergy = [fakeClergy({ rank: 'priest', piety: 60 })]
    const mm = new MMReligion('faerun', pantheon, 0, { clergy, temples: [] })
    mm.accumulatePotential(360 * 50, 360 * 50)
    const result = mm.resolve(360 * 50, tp)
    expect(result.stateChanges.yearsTicked).toBe(50)
  })
})
