/**
 * MM_FACTION TESTS — adapter for tickFaction with leader-drive bias.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MMFaction, leaderProgressMultiplier, GOAL_DRIVE_ALIGNMENT } from '../mm-faction.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode } from '../tp.js'
import {
  createFaction,
  addMember,
  addGoal,
  resetFactionIdCounter,
  type Faction,
} from '../faction.js'
import { DrivesSchema, type Drives } from '../intent.js'

beforeEach(() => resetFactionIdCounter())

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'baldurs_gate', type: 'settlement', name: "Baldur's Gate", parentId: 'sword_coast', dataStatic: {} },
    { id: 'waterdeep', type: 'settlement', name: 'Waterdeep', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makeFaction(name = 'Lords Alliance'): Faction {
  const f = createFaction(name, 'noble_house', 'baldurs_gate', {
    treasury: 5000,
    controlledNodes: ['baldurs_gate', 'waterdeep'],
  })
  f.weeklyIncome = 200
  f.weeklyExpenses = 50
  return f
}

describe('GOAL_DRIVE_ALIGNMENT — every goal type maps to drives', () => {
  it('every FactionGoalType has at least one aligned drive', () => {
    for (const goalType of Object.keys(GOAL_DRIVE_ALIGNMENT)) {
      const aligned = GOAL_DRIVE_ALIGNMENT[goalType as keyof typeof GOAL_DRIVE_ALIGNMENT]
      expect(aligned.length).toBeGreaterThan(0)
    }
  })
})

describe('leaderProgressMultiplier', () => {
  it('returns 1.0 with no drives', () => {
    expect(leaderProgressMultiplier('expand_territory', undefined)).toBe(1.0)
  })

  it('high wealth drive boosts wealth-aligned goals', () => {
    const drives = DrivesSchema.parse({ wealth: 90 })
    const wealthMult = leaderProgressMultiplier('accumulate_wealth', drives)
    expect(wealthMult).toBeGreaterThan(1.5)  // 1 + 0.9
  })

  it('drives unaligned with goal type don\'t affect multiplier', () => {
    // Pure faith leader trying to accumulate wealth
    const drives = DrivesSchema.parse({ faith: 100, wealth: 0 })
    const wealthMult = leaderProgressMultiplier('accumulate_wealth', drives)
    expect(wealthMult).toBe(1.0)  // wealth=0
    const faithMult = leaderProgressMultiplier('spread_faith', drives)
    expect(faithMult).toBeGreaterThan(1.5)
  })

  it('two aligned drives sum together', () => {
    // eliminate_rival aligns with power AND revenge
    const drives = DrivesSchema.parse({ power: 50, revenge: 50 })
    const mult = leaderProgressMultiplier('eliminate_rival', drives)
    expect(mult).toBeCloseTo(2.0, 1)  // 1 + 0.5 + 0.5
  })
})

describe('MMFaction — construction', () => {
  it('id and nodeId derived from faction', () => {
    const f = makeFaction()
    const mm = new MMFaction(f, 0)
    expect(mm.state.id).toBe(`faction:${f.id}`)
    expect(mm.state.nodeId).toBe(f.headquartersNodeId)
    expect(mm.state.mmType).toBe('faction')
  })

  it('auto-detects leader from members with rank=leader', () => {
    const f = makeFaction()
    addMember(f, 'duke_alric', 'Duke Alric', 'leader', 0)
    addMember(f, 'commander_elara', 'Commander Elara', 'commander', 0)
    const mm = new MMFaction(f, 0)
    expect(mm.getLeaderId()).toBe('duke_alric')
  })

  it('returns null leaderId when no member has rank=leader', () => {
    const f = makeFaction()
    addMember(f, 'commander_elara', 'Commander Elara', 'commander', 0)
    const mm = new MMFaction(f, 0)
    expect(mm.getLeaderId()).toBeNull()
  })

  it('leaderDrives passed in constructor populate domain state', () => {
    const f = makeFaction()
    addMember(f, 'duke_alric', 'Duke Alric', 'leader', 0)
    const drives = DrivesSchema.parse({ power: 80, wealth: 60 })
    const mm = new MMFaction(f, 0, { leaderDrives: drives })
    const dom = mm.serialize().domain as ReturnType<MMFaction['getDomainState']>
    expect(dom.leaderDrives?.power).toBe(80)
    expect(dom.leaderDrives?.wealth).toBe(60)
  })
})

describe('MMFaction — weekly tick fold', () => {
  it('sub-week resolve does nothing', () => {
    const f = makeFaction()
    const mm = new MMFaction(f, 0)
    mm.accumulatePotential(3, 3)
    const result = mm.resolve(3)
    expect(result.stateChanges.weeksTicked).toBe(0)
  })

  it('one-week resolve runs tickFaction once: treasury grows by net income', () => {
    const f = makeFaction()
    const before = f.treasury
    const mm = new MMFaction(f, 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    expect(f.treasury).toBe(before + (f.weeklyIncome - f.weeklyExpenses))
  })

  it('one-month resolve runs tickFaction 4× (treasury Δ = 4 × net income)', () => {
    const f = makeFaction()
    const before = f.treasury
    const netIncome = f.weeklyIncome - f.weeklyExpenses
    const mm = new MMFaction(f, 0)
    mm.accumulatePotential(30, 30)
    mm.resolve(30)
    expect(f.treasury).toBe(before + netIncome * 4)
  })

  it('goal progress advances; completed goals deactivate', () => {
    const f = makeFaction()
    addGoal(f, 'expand_territory', 'Take Phandalin', 5)
    addMember(f, 'duke', 'Duke', 'leader', 0)
    // many members → bigger memberBonus
    for (let i = 0; i < 50; i++) addMember(f, `m${i}`, `M${i}`, 'member', 0)
    const mm = new MMFaction(f, 0)
    // tickFaction: progressDelta = priority×0.5 + min(members,50)×0.1
    //            = 5×0.5 + 50×0.1 = 7.5 per tick. ~14 weeks to 100.
    mm.accumulatePotential(7 * 20, 7 * 20)
    mm.resolve(7 * 20)
    const goal = f.goals[0]
    expect(goal.progress).toBe(100)
    expect(goal.active).toBe(false)
  })
})

describe('MMFaction — leader drives bias goal progress', () => {
  it('with strong wealth drive, wealth-aligned goal advances faster than unaligned', () => {
    // Two parallel factions, identical except one has a wealth-driven leader.
    const fA = makeFaction('Alpha')
    addGoal(fA, 'accumulate_wealth', 'Hoard gold', 5)
    addMember(fA, 'leader_a', 'Leader A', 'leader', 0)

    const fB = makeFaction('Beta')
    addGoal(fB, 'accumulate_wealth', 'Hoard gold', 5)
    addMember(fB, 'leader_b', 'Leader B', 'leader', 0)

    const drivesGreedy = DrivesSchema.parse({ wealth: 100 })
    const drivesNeutral = DrivesSchema.parse({})  // all 50 default... no, defaults

    // Default drives use 50 — let's be explicit so the contrast is clear.
    const drivesIndifferent = DrivesSchema.parse({ wealth: 0 })

    const mmA = new MMFaction(fA, 0, { leaderDrives: drivesGreedy })
    const mmB = new MMFaction(fB, 0, { leaderDrives: drivesIndifferent })

    mmA.accumulatePotential(7, 7); mmA.resolve(7)
    mmB.accumulatePotential(7, 7); mmB.resolve(7)

    expect(fA.goals[0].progress).toBeGreaterThan(fB.goals[0].progress)
  })

  it('without a leader, no drive bias applied', () => {
    const f = makeFaction()
    addGoal(f, 'accumulate_wealth', 'Hoard', 5)
    const mm = new MMFaction(f, 0)  // no leader drives
    mm.accumulatePotential(7, 7); mm.resolve(7)
    // Progress applied only by tickFaction's base formula
    expect(f.goals[0].progress).toBeGreaterThan(0)
  })

  it('setLeaderDrives updates the bias mid-life', () => {
    const f = makeFaction()
    addGoal(f, 'expand_territory', 'Conquer', 5)
    const mm = new MMFaction(f, 0)

    // First week with no drives
    mm.accumulatePotential(7, 7); mm.resolve(7)
    const after1 = f.goals[0].progress

    // Inject power drive, run another week
    mm.setLeaderDrives(DrivesSchema.parse({ power: 100 }))
    mm.accumulatePotential(7, 14); mm.resolve(14)
    const after2 = f.goals[0].progress
    const delta2 = after2 - after1

    // Third week with weaker drives — should slow back down
    mm.setLeaderDrives(DrivesSchema.parse({ power: 0 }))
    mm.accumulatePotential(7, 21); mm.resolve(21)
    const after3 = f.goals[0].progress
    const delta3 = after3 - after2

    expect(delta2).toBeGreaterThan(delta3)
  })
})

describe('MMFaction — κ writes at controlled nodes', () => {
  it('writes faction.control entry per controlled node', () => {
    const tp = makeTP()
    const f = makeFaction('Lords Alliance')
    f.influence['baldurs_gate'] = 70
    f.influence['waterdeep'] = 30
    const mm = new MMFaction(f, 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const bg = tp.resolve('baldurs_gate')!
    const wd = tp.resolve('waterdeep')!

    const bgControl = (bg.faction.control as Record<string, { influence: number; stance: string }>)
    const wdControl = (wd.faction.control as Record<string, { influence: number; stance: string }>)

    expect(bgControl[f.id]?.influence).toBeGreaterThanOrEqual(70)
    expect(bgControl[f.id]?.stance).toBe('friendly')   // ≥50 = friendly
    expect(wdControl[f.id]?.influence).toBeGreaterThanOrEqual(30)
    expect(wdControl[f.id]?.stance).toBe('neutral')    // ≥25 = neutral
  })

  it('two factions writing to the same node coexist', () => {
    const tp = makeTP()
    const lords = makeFaction('Lords Alliance')
    lords.influence['baldurs_gate'] = 60
    const zhent = makeFaction('Zhentarim')
    zhent.influence['baldurs_gate'] = 25

    const mmLords = new MMFaction(lords, 0)
    const mmZhent = new MMFaction(zhent, 0)
    mmLords.accumulatePotential(7, 7); mmLords.resolve(7, tp)
    mmZhent.accumulatePotential(7, 7); mmZhent.resolve(7, tp)

    const ctx = tp.resolve('baldurs_gate')!
    const control = ctx.faction.control as Record<string, { influence: number }>
    expect(control[lords.id]?.influence).toBeGreaterThanOrEqual(60)
    expect(control[zhent.id]?.influence).toBeGreaterThanOrEqual(25)
  })
})

describe('MMFaction — Clockwork integration', () => {
  it('registers monthly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const f = makeFaction()
    addMember(f, 'duke', 'Duke', 'leader', 0)
    const mm = new MMFaction(f, 0, {
      leaderDrives: DrivesSchema.parse({ power: 80 } as Partial<Drives>),
    })
    clockwork.register(mm, 3, 'monthly')  // L3 FACTION
    clockwork.crankTo(30)
    expect(mm.pendingDays()).toBeGreaterThan(0)

    const obs = clockwork.observeNode(f.headquartersNodeId)
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe(`faction:${f.id}`)
  })
})
