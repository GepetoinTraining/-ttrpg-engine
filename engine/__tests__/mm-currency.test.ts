/**
 * MM_CURRENCY TESTS — exchange-rate fold + κ write.
 */

import { describe, it, expect } from 'vitest'
import { MMCurrency } from '../mm-currency'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import { createCurrencySystem, type ExchangeRate } from '../currency'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'realmspace', type: 'crystal_sphere', name: 'Realmspace', parentId: null, dataStatic: {} },
    { id: 'toril', type: 'planet', name: 'Toril', parentId: 'realmspace', dataStatic: {} },
    { id: 'faerun', type: 'continent', name: 'Faerûn', parentId: 'toril', dataStatic: {} },
    { id: 'cormyr', type: 'kingdom', name: 'Cormyr', parentId: 'faerun', dataStatic: {} },
    { id: 'suzail', type: 'settlement', name: 'Suzail', parentId: 'cormyr', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function makeRate(from: string, to: string, rate: number): ExchangeRate {
  return {
    id: `${from}->${to}`,
    fromCurrencyId: from,
    toCurrencyId: to,
    rate,
    tradeVolume: 1000,
    lastUpdatedDay: 0,
  }
}

describe('MMCurrency — wraps weeklyExchangeTick', () => {
  it('constructs with stable id, nodeId, mmType', () => {
    const mm = new MMCurrency('toril', [], [], 0)
    expect(mm.state.id).toBe('currency:toril')
    expect(mm.state.nodeId).toBe('toril')
    expect(mm.state.mmType).toBe('currency')
  })

  it('sub-week resolve does nothing', () => {
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const sembia = createCurrencySystem('toril', 'Silver Crown', 'sembia')
    const rate = makeRate(cormyr.id, sembia.id, 1.0)
    const mm = new MMCurrency('toril', [cormyr, sembia], [rate], 0)
    mm.accumulatePotential(3, 3)
    const result = mm.resolve(3)
    expect(result.stateChanges.weeksTicked).toBe(0)
  })

  it('weekly fold drifts rates within volatility band', () => {
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const sembia = createCurrencySystem('toril', 'Silver Crown', 'sembia')
    const rate = makeRate(cormyr.id, sembia.id, 1.0)
    const mm = new MMCurrency('toril', [cormyr, sembia], [rate], 0, { getD20: () => 12 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    // Some drift should have occurred but stay in a sane band
    expect(rate.rate).toBeGreaterThan(0.5)
    expect(rate.rate).toBeLessThan(1.5)
    expect(rate.lastUpdatedDay).toBe(7)
  })

  it('inactive (no-longer-minted) currency depreciates', () => {
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const fallen = createCurrencySystem('toril', 'Old Empire Coin', 'fallen_empire')
    fallen.active = false
    const rate = makeRate(fallen.id, cormyr.id, 1.0)
    const mm = new MMCurrency('toril', [cormyr, fallen], [rate], 0, { getD20: () => 10 })

    mm.accumulatePotential(28, 28)  // 4 weeks
    mm.resolve(28)
    // Inactive from-currency → drift -3% per week, compounded
    expect(rate.rate).toBeLessThan(1.0)
  })

  it('writes κ.economy.exchangeRates at the planet node', () => {
    const tp = makeTP()
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const sembia = createCurrencySystem('toril', 'Silver Crown', 'sembia')
    const rate = makeRate(cormyr.id, sembia.id, 1.0)
    const mm = new MMCurrency('toril', [cormyr, sembia], [rate], 0, { getD20: () => 12 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('toril')!
    const rates = (ctx.economy as any).exchangeRates
    expect(rates).toBeDefined()
    expect(typeof rates[`${cormyr.id}->${sembia.id}`]).toBe('number')
  })

  it('settlement inherits exchange rates from its planet ancestor', () => {
    const tp = makeTP()
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const sembia = createCurrencySystem('toril', 'Silver Crown', 'sembia')
    const rate = makeRate(cormyr.id, sembia.id, 1.2)
    const mm = new MMCurrency('toril', [cormyr, sembia], [rate], 0, { getD20: () => 10 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    // Settlement walks up the ancestry to find economy.exchangeRates
    const suzail = tp.resolve('suzail')!
    const inheritedRates = (suzail.economy as any).exchangeRates
    expect(inheritedRates).toBeDefined()
    expect(inheritedRates[`${cormyr.id}->${sembia.id}`]).toBeGreaterThan(0)
  })

  it('integrates with Clockwork — registers weekly, observes', () => {
    const tp = makeTP()
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const sembia = createCurrencySystem('toril', 'Silver Crown', 'sembia')
    const rate = makeRate(cormyr.id, sembia.id, 1.0)
    const clockwork = new Clockwork(tp, 0)
    const mm = new MMCurrency('toril', [cormyr, sembia], [rate], 0, { getD20: () => 10 })
    clockwork.register(mm, 2, 'weekly')

    clockwork.crankTo(28)
    expect(mm.pendingDays()).toBeGreaterThan(0)

    const obs = clockwork.observeNode('toril')
    expect(obs.resolved.length).toBe(1)
    const ratesK = (tp.getNode('toril')!.dataStatic as any).economy?.exchangeRates
    expect(ratesK).toBeDefined()
  })

  it('multi-rate set ticks all rates per week', () => {
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const sembia = createCurrencySystem('toril', 'Silver Crown', 'sembia')
    const calish = createCurrencySystem('toril', 'Pegasus', 'calimshan')
    const rates = [
      makeRate(cormyr.id, sembia.id, 1.0),
      makeRate(sembia.id, calish.id, 1.0),
      makeRate(calish.id, cormyr.id, 1.0),
    ]
    const mm = new MMCurrency('toril', [cormyr, sembia, calish], rates, 0, { getD20: () => 12 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    const dom = mm.serialize().domain as ReturnType<MMCurrency['getDomainState']>
    expect(dom.lastTickResults.length).toBe(3)
  })

  it('exposes getRate / getCurrency for downstream banking', () => {
    const cormyr = createCurrencySystem('toril', 'Golden Lion', 'cormyr')
    const sembia = createCurrencySystem('toril', 'Silver Crown', 'sembia')
    const rate = makeRate(cormyr.id, sembia.id, 1.5)
    const mm = new MMCurrency('toril', [cormyr, sembia], [rate], 0)
    expect(mm.getCurrency(cormyr.id)).toBe(cormyr)
    expect(mm.getRate(cormyr.id, sembia.id)?.rate).toBe(1.5)
    expect(mm.getRate('nope', 'also_nope')).toBeUndefined()
  })
})
