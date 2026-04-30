import { describe, it, expect } from 'vitest'
import { TP, type WorldNode, type CultureRules } from '../tp.js'
import { MMEntertainment } from '../mm-entertainment.js'
import type { Performer, Patronage } from '../entertainment.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: null, dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function fakePerformer(over: Partial<Performer> = {}): Performer {
  return {
    id: over.id ?? 'p1',
    npcId: over.npcId ?? 'npc_1',
    specialties: over.specialties ?? ['storytelling'],
    skillMod: over.skillMod ?? 5,
    reputation: over.reputation ?? 30,
    patronId: over.patronId,
    homeSettlementId: over.homeSettlementId ?? 'thundertree',
  }
}

describe('MMEntertainment — construction', () => {
  it('uses entertainment:<id> as id', () => {
    const mm = new MMEntertainment('thundertree', 0)
    expect(mm.state.id).toBe('entertainment:thundertree')
    expect(mm.state.mmType).toBe('entertainment')
  })
})

describe('MMEntertainment — weekly fold', () => {
  it('runs one performance per performer per week', () => {
    const performers = [
      fakePerformer({ id: 'bard', skillMod: 8 }),
      fakePerformer({ id: 'storyteller', skillMod: 5 }),
    ]
    const mm = new MMEntertainment('thundertree', 0, { performers })
    mm.accumulatePotential(7, 7)
    const result = mm.resolve(7, undefined)
    expect(result.stateChanges.performancesRun).toBe(2)
  })

  it('multi-week resolves N × performers', () => {
    const performers = [fakePerformer({ id: 'bard', skillMod: 8 })]
    const mm = new MMEntertainment('thundertree', 0, { performers })
    mm.accumulatePotential(28, 28)   // 4 weeks
    const result = mm.resolve(28, undefined)
    expect(result.stateChanges.performancesRun).toBe(4)
  })

  it('bards collect rumors from successful performances', () => {
    const bard = fakePerformer({ id: 'tamlin', skillMod: 12 })   // high mod → masterwork chance
    const mm = new MMEntertainment('thundertree', 0, { performers: [bard] })
    mm.accumulatePotential(70, 70)
    const result = mm.resolve(70, undefined)
    expect(result.stateChanges.rumorsCollected).toBeGreaterThan(0)
  })

  it('writes κ.culture.entertainment with cultural score', () => {
    const tp = makeTP()
    const performers = [
      fakePerformer({ reputation: 80 }),
      fakePerformer({ id: 'p2', reputation: 60 }),
    ]
    const mm = new MMEntertainment('thundertree', 0, { performers })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('thundertree')
    const culture = ctx?.culture as CultureRules | undefined
    expect(culture?.entertainment).toBeDefined()
    expect(culture?.entertainment?.culturalScore).toBeGreaterThan(0)
  })

  it('zero days is no-op', () => {
    const mm = new MMEntertainment('thundertree', 0)
    const result = mm.resolve(0, undefined)
    expect(result.stateChanges.weeksTicked).toBe(0)
  })
})

describe('MMEntertainment — patronage', () => {
  it('patron stipend is collected weekly', () => {
    const performers = [fakePerformer()]
    const patronages: Patronage[] = [{
      patronId: 'lord_bartholomew',
      performerId: performers[0].id,
      weeklyStipend: 25,
      exclusivity: false,
      startedDay: 0,
    }]
    const mm = new MMEntertainment('thundertree', 0, { performers, patronages })
    mm.accumulatePotential(28, 28)
    const result = mm.resolve(28, undefined)
    expect(result.stateChanges.patronStipends).toBe(25 * 4)
  })

  it('patron drips reputation each week', () => {
    const performer = fakePerformer({ reputation: 30 })
    const patronages: Patronage[] = [{
      patronId: 'lord_x',
      performerId: performer.id,
      weeklyStipend: 10,
      exclusivity: true,
      startedDay: 0,
    }]
    const mm = new MMEntertainment('thundertree', 0, { performers: [performer], patronages })
    mm.accumulatePotential(28, 28)
    mm.resolve(28, undefined)
    // patronBenefit gives +1/week to reputation; performances also affect it
    expect(performer.reputation).toBeGreaterThanOrEqual(31)
  })
})
