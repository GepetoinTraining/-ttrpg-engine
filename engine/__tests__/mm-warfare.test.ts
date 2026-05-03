/**
 * MM_WARFARE TESTS — adapter for monthlyReadinessTick + monthlyArmyUpkeep
 * + monthlyDiplomaticDrift, with κ.military writes per region.
 */

import { describe, it, expect } from 'vitest'
import { MMWarfare } from '../mm-warfare'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import { type ArmyUnit, type DiplomaticRelation } from '../warfare'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'baldurs_gate', type: 'settlement', name: "Baldur's Gate", parentId: 'sword_coast', dataStatic: {} },
    { id: 'high_moor', type: 'region', name: 'High Moor', parentId: null, dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makeUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: 'unit_1',
    factionId: 'lords_alliance',
    name: 'Flaming Fist 1st',
    tier: 'company',
    unitType: 'infantry',
    currentStrength: 100,
    readiness: 80,
    morale: 75,
    equipmentTier: 3,
    regionId: 'sword_coast',
    weeklyUpkeepGP: 60,
    ...overrides,
  }
}

function makeRelation(overrides: Partial<DiplomaticRelation> = {}): DiplomaticRelation {
  return {
    id: 'rel_lords_zhent',
    factionA: 'lords_alliance',
    factionB: 'zhentarim',
    status: 'rivalry',
    standing: -40,
    treaties: [],
    lastChangedDay: 0,
    ...overrides,
  }
}

describe('MMWarfare — construction', () => {
  it('id derived from factionId; nodeId = HQ', () => {
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [], [], 0)
    expect(mm.state.id).toBe('warfare:lords_alliance')
    expect(mm.state.nodeId).toBe('baldurs_gate')
    expect(mm.state.mmType).toBe('warfare')
  })

  it('totalMonthlyUpkeep computed from units', () => {
    const u1 = makeUnit({ currentStrength: 100, equipmentTier: 3 })
    const u2 = makeUnit({ id: 'unit_2', currentStrength: 50, equipmentTier: 2 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u1, u2], [], 0)
    // calculateUpkeep = strength × eqTier × 0.2; weekly. Monthly = ×4.
    // u1: 100×3×0.2 = 60, u2: 50×2×0.2 = 20 → weekly 80, monthly 320.
    expect(mm.totalMonthlyUpkeep()).toBe(320)
  })
})

describe('MMWarfare — monthly readiness decay', () => {
  it('one month of resolve drops readiness 3% and morale 1', () => {
    const u = makeUnit({ readiness: 80, morale: 75 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0, {
      getTreasuryFn: () => 1_000_000,  // plenty
    })
    mm.accumulatePotential(30, 30); mm.resolve(30)
    expect(u.readiness).toBe(77)  // 80 - 3
    expect(u.morale).toBe(74)     // 75 - 1
  })

  it('three months compounds the decay', () => {
    const u = makeUnit({ readiness: 80, morale: 75 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0, {
      getTreasuryFn: () => 1_000_000,
    })
    mm.accumulatePotential(90, 90); mm.resolve(90)
    expect(u.readiness).toBe(71)  // 80 - 9
    expect(u.morale).toBe(72)     // 75 - 3
  })

  it('sub-month resolve does nothing', () => {
    const u = makeUnit({ readiness: 80 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0)
    mm.accumulatePotential(20, 20); mm.resolve(20)
    expect(u.readiness).toBe(80)  // untouched
  })
})

describe('MMWarfare — upkeep + treasury', () => {
  it('sufficient treasury → upkeep paid, no extra penalty', () => {
    const u = makeUnit({ readiness: 80, morale: 75 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0, {
      getTreasuryFn: () => 1_000,  // covers 240 monthly upkeep
    })
    mm.accumulatePotential(30, 30); mm.resolve(30)
    // Only the readiness/morale decay (3 / 1) applies, no extra punishment
    expect(u.readiness).toBe(77)
    expect(u.morale).toBe(74)
  })

  it('insufficient treasury → readiness -10, morale -15 EXTRA', () => {
    const u = makeUnit({ readiness: 80, morale: 75 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0, {
      getTreasuryFn: () => 0,  // broke
    })
    mm.accumulatePotential(30, 30); mm.resolve(30)
    // After readiness tick: 77 / 74. After failed upkeep: -10/-15 → 67 / 59.
    expect(u.readiness).toBe(67)
    expect(u.morale).toBe(59)
  })

  it('cumulative upkeep tracked across resolves', () => {
    const u = makeUnit()
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0, {
      getTreasuryFn: () => 1_000_000,
    })
    mm.accumulatePotential(60, 60); mm.resolve(60)  // 2 months
    const dom = mm.serialize().domain as ReturnType<MMWarfare['getDomainState']>
    // 2 × 240 = 480 upkeep paid
    expect(dom.cumulative.upkeepPaid).toBe(480)
    expect(dom.cumulative.monthsTicked).toBe(2)
  })
})

describe('MMWarfare — diplomatic drift', () => {
  it('alliance drifts upward toward 100', () => {
    const r = makeRelation({ status: 'alliance', standing: 90 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [], [r], 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    expect(r.standing).toBe(91)
  })

  it('war drains standing -3/month', () => {
    const r = makeRelation({ status: 'war', standing: -85 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [], [r], 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    expect(r.standing).toBe(-88)
  })

  it('crossing a threshold flips status (rivalry → cold_war)', () => {
    const r = makeRelation({ status: 'rivalry', standing: -49 })  // close to -50 cold_war boundary
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [], [r], 0)
    mm.accumulatePotential(60, 60); mm.resolve(60)  // 2 months × -1 = -51 → cold_war
    expect(r.status).toBe('cold_war')
    const dom = mm.serialize().domain as ReturnType<MMWarfare['getDomainState']>
    expect(dom.cumulative.statusChanges).toBeGreaterThanOrEqual(1)
  })
})

describe('MMWarfare — κ.military writes per region', () => {
  it('writes military κ at each region the faction has units in', () => {
    const tp = makeTP()
    const u1 = makeUnit({ regionId: 'sword_coast', currentStrength: 100, readiness: 80, morale: 70 })
    const u2 = makeUnit({ id: 'u2', regionId: 'high_moor', currentStrength: 50, readiness: 60, morale: 50 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u1, u2], [], 0, {
      getTreasuryFn: () => 100_000,
    })
    mm.accumulatePotential(30, 30); mm.resolve(30, tp)

    const swordCoast = tp.resolve('sword_coast')!
    const highMoor = tp.resolve('high_moor')!
    expect(swordCoast.military.garrison).toBe(100)
    expect(swordCoast.military.readiness).toBeGreaterThan(0)
    expect(highMoor.military.garrison).toBe(50)
  })

  it('settlements inherit military κ from their region', () => {
    const tp = makeTP()
    const u = makeUnit({ regionId: 'sword_coast', currentStrength: 200 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0, {
      getTreasuryFn: () => 100_000,
    })
    mm.accumulatePotential(30, 30); mm.resolve(30, tp)

    // baldurs_gate is a settlement under sword_coast — should see the garrison
    const bg = tp.resolve('baldurs_gate')!
    expect(bg.military.garrison).toBe(200)
  })

  it('aggregates multiple units in same region', () => {
    const tp = makeTP()
    const u1 = makeUnit({ id: 'u1', regionId: 'sword_coast', currentStrength: 100, readiness: 80 })
    const u2 = makeUnit({ id: 'u2', regionId: 'sword_coast', currentStrength: 50, readiness: 60 })
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u1, u2], [], 0, {
      getTreasuryFn: () => 100_000,
    })
    mm.accumulatePotential(30, 30); mm.resolve(30, tp)

    const sc = tp.resolve('sword_coast')!
    expect(sc.military.garrison).toBe(150)
    // Average readiness after decay: (77 + 57) / 2 / 100 = 0.67
    expect(sc.military.readiness).toBeCloseTo(0.67, 2)
  })
})

describe('MMWarfare — Clockwork integration', () => {
  it('registers monthly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const u = makeUnit()
    const mm = new MMWarfare('lords_alliance', 'baldurs_gate', [u], [], 0, {
      getTreasuryFn: () => 100_000,
    })
    clockwork.register(mm, 3, 'monthly')  // L3 FACTION
    clockwork.crankTo(30)
    expect(mm.pendingDays()).toBeGreaterThan(0)

    const obs = clockwork.observeNode('baldurs_gate')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('warfare:lords_alliance')
  })
})
