/**
 * MM_SOCIAL TESTS — adapter for monthlySocialTick.
 */

import { describe, it, expect } from 'vitest'
import { MMSocial } from '../mm-social'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import {
  createContract,
  createHousehold,
  addMember,
  createTitle,
  vacateTitle,
  createKinshipLink,
  type Contract,
  type Household,
  type Title,
  type KinshipLink,
} from '../social'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'baldurs_gate', type: 'settlement', name: "Baldur's Gate", parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

describe('MMSocial — construction', () => {
  it('id derived from jurisdictionId', () => {
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [], [], [], [], 0)
    expect(mm.state.id).toBe('social:baldurs_gate')
    expect(mm.state.nodeId).toBe('baldurs_gate')
    expect(mm.state.mmType).toBe('social')
  })
})

describe('MMSocial — monthly tick', () => {
  it('sub-month resolve does nothing', () => {
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [], [], [], [], 0)
    mm.accumulatePotential(20, 20)
    const result = mm.resolve(20)
    expect(result.stateChanges.monthsTicked).toBe(0)
  })

  it('expires fixed-duration contracts past their endDay', () => {
    const c = createContract(
      'employment',
      [{ entityType: 'character', entityId: 'kaelith', role: 'employee', consented: true, canExit: false }, { entityType: 'character', entityId: 'duke', role: 'employer', consented: true, canExit: false }],
      0,
      { durationType: 'fixed', durationDays: 30, status: 'active' },
    )
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [c], [], [], [], 0)
    mm.accumulatePotential(60, 60); mm.resolve(60)
    expect(c.status).toBe('expired')
    const dom = mm.serialize().domain as ReturnType<MMSocial['getDomainState']>
    expect(dom.cumulative.contractsExpired).toBeGreaterThanOrEqual(1)
  })

  it('recalculates household standing as treasury changes', () => {
    const h = createHousehold('House Thann', 'baldurs_gate', 'duke_thann', 0)
    h.treasury = 50  // 'poor' threshold
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [], [h], [], [], 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    // Standing computed each tick — 'common' or higher per the math
    expect(h.standing).toBeDefined()

    // Bump wealth significantly; next tick should escalate standing
    h.treasury = 50_000  // very wealthy
    mm.accumulatePotential(30, 60); mm.resolve(60)
    expect(['comfortable', 'wealthy', 'noble', 'royal']).toContain(h.standing)
  })

  it('writes κ.social at the jurisdiction node', () => {
    const tp = makeTP()
    const h = createHousehold('House Thann', 'baldurs_gate', 'duke', 0)
    h.treasury = 1000
    const t = createTitle('Duke of Baldur\'s Gate', 'duke', 'duke_thann', 'primogeniture')
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [], [h], [t], [], 0)
    mm.accumulatePotential(30, 30); mm.resolve(30, tp)

    const ctx = tp.resolve('baldurs_gate')!
    const s = (ctx.social as any)
    expect(s).toBeDefined()
    expect(s.titles).toBeDefined()
    expect(typeof s.standingAvg).toBe('number')
    expect(s.contracts).toBeDefined()
  })

  it('vacant titles tracked across resolves', () => {
    const t1 = createTitle('Knight', 'knight', 'sir_a', 'primogeniture')
    const t2 = createTitle('Baron', 'baron', 'baron_b', 'primogeniture')
    vacateTitle(t1)  // mark vacant
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [], [], [t1, t2], [], 0)
    mm.accumulatePotential(30, 30); mm.resolve(30)
    const dom = mm.serialize().domain as ReturnType<MMSocial['getDomainState']>
    expect(dom.cumulative.titlesVacated).toBeGreaterThanOrEqual(1)
  })

  it('multi-month fold counts cumulative changes', () => {
    const c1: Contract = createContract(
      'employment',
      [{ entityType: 'character', entityId: 'a', role: 'employee', consented: true, canExit: false }, { entityType: 'character', entityId: 'b', role: 'employer', consented: true, canExit: false }],
      0,
      { durationType: 'fixed', durationDays: 30, status: 'active' },
    )
    const c2: Contract = createContract(
      'apprenticeship',
      [{ entityType: 'character', entityId: 'c', role: 'apprentice', consented: true, canExit: false }, { entityType: 'character', entityId: 'd', role: 'master', consented: true, canExit: false }],
      0,
      { durationType: 'fixed', durationDays: 60, status: 'active' },
    )
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [c1, c2], [], [], [], 0)
    mm.accumulatePotential(90, 90); mm.resolve(90)  // 3 months, both contracts expire
    const dom = mm.serialize().domain as ReturnType<MMSocial['getDomainState']>
    expect(dom.cumulative.contractsExpired).toBe(2)
    expect(dom.cumulative.monthsTicked).toBe(3)
  })
})

describe('MMSocial — Clockwork integration', () => {
  it('registers monthly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const h = createHousehold('House A', 'baldurs_gate', 'a', 0)
    const mm = new MMSocial('baldurs_gate', 'baldurs_gate', [], [h], [], [], 0)
    clockwork.register(mm, 4, 'monthly')
    clockwork.crankTo(30)
    const obs = clockwork.observeNode('baldurs_gate')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('social:baldurs_gate')
  })
})

describe('MMSocial — slow-life: kinship + household + title chain', () => {
  it('jurisdiction-scoped MM tracks the full social web', () => {
    const grandparent = createHousehold('Grandparent\'s House', 'baldurs_gate', 'old_alric', 0)
    grandparent.treasury = 2000
    addMember(grandparent, 'young_alric', 'heir', 0)

    const links: KinshipLink[] = [
      createKinshipLink('old_alric', 'young_alric', 'parent', 'legitimate'),
    ]

    const dukeTitle = createTitle('Duke', 'duke', 'old_alric', 'primogeniture')

    const apprenticeContract = createContract(
      'apprenticeship',
      [{ entityType: 'character', entityId: 'young_alric', role: 'apprentice', consented: true, canExit: false }, { entityType: 'character', entityId: 'guildmaster', role: 'master', consented: true, canExit: false }],
      0,
      { durationType: 'fixed', durationDays: 365 * 4, status: 'active' },
    )

    const mm = new MMSocial(
      'baldurs_gate', 'baldurs_gate',
      [apprenticeContract], [grandparent], [dukeTitle], links,
      0,
    )
    // Run 6 months
    mm.accumulatePotential(180, 180); mm.resolve(180)

    // Apprenticeship is for 4 years — still active
    expect(apprenticeContract.status).toBe('active')
    // Title still held
    expect(dukeTitle.status).toBe('active')
    // Household standing recomputed
    expect(grandparent.standing).toBeDefined()
  })
})
