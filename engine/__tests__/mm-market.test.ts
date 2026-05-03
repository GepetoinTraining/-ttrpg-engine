/**
 * MM_MARKET TESTS — wraps weeklyMarketTick as ISimulatedMM.
 * Verifies sync-from-κ + price discovery + write-back-to-κ.
 */

import { describe, it, expect } from 'vitest'
import { MMMarket } from '../mm-market'
import { Clockwork } from '../clockwork'
import { TP, type WorldNode } from '../tp'
import { createSettlementMarket, type SettlementMarket, type CommodityPrice } from '../market'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function seedMarket(market: SettlementMarket, entries: { id: string; basePrice: number; supply: number; demand: number }[]) {
  for (const e of entries) {
    market.prices[e.id] = {
      commodityId: e.id,
      basePrice: e.basePrice,
      currentPrice: e.basePrice,
      supply: e.supply,
      demand: e.demand,
      trend: 'stable',
      available: true,
    } satisfies CommodityPrice
  }
}

describe('MMMarket — adapter for weeklyMarketTick', () => {
  it('constructs with stable id, nodeId, mmType', () => {
    const market = createSettlementMarket('thundertree')
    const mm = new MMMarket(market, 0)
    expect(mm.state.id).toBe('market:thundertree')
    expect(mm.state.nodeId).toBe('thundertree')
    expect(mm.state.mmType).toBe('market')
  })

  it('fewer than 7 days resolved → no tick fires', () => {
    const market = createSettlementMarket('thundertree')
    seedMarket(market, [{ id: 'iron_ore', basePrice: 1, supply: 100, demand: 50 }])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })
    mm.accumulatePotential(3, 3)
    const result = mm.resolve(3)
    expect(result.stateChanges.weeksTicked).toBe(0)
  })

  it('one week tick discovers prices for each commodity', () => {
    const market = createSettlementMarket('thundertree')
    seedMarket(market, [
      { id: 'iron_ore', basePrice: 1, supply: 100, demand: 50 },   // glut
      { id: 'grain',    basePrice: 0.5, supply: 30, demand: 100 },  // shortage
    ])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })  // d20=12 avoids events
    mm.accumulatePotential(7, 7)
    mm.resolve(7)

    const iron = market.prices['iron_ore']
    const grain = market.prices['grain']
    expect(iron.currentPrice).toBeLessThan(iron.basePrice)   // glut → cheaper
    expect(grain.currentPrice).toBeGreaterThan(grain.basePrice) // shortage → pricier
  })

  it('syncs supply from κ.economy.commodities before each tick', () => {
    const tp = makeTP()
    // Pre-write supply via L1-style κ writes (mimicking mm-extraction)
    tp.writeDomain('thundertree', 'economy', {
      commodities: { iron_ore: { supply: 500 } },
    })

    const market = createSettlementMarket('thundertree')
    seedMarket(market, [{ id: 'iron_ore', basePrice: 1, supply: 0, demand: 50 }])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    // After the sync, market should have read the 500 supply
    expect(market.prices['iron_ore'].supply).toBe(500)
  })

  it('writes computed prices back to κ.economy.commodities', () => {
    const tp = makeTP()
    const market = createSettlementMarket('thundertree')
    seedMarket(market, [{ id: 'iron_ore', basePrice: 1, supply: 100, demand: 50 }])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('thundertree')!
    const ironKappa = (ctx.economy.commodities as any)?.iron_ore
    expect(typeof ironKappa?.price).toBe('number')
    expect(['rising', 'stable', 'falling']).toContain(ironKappa.trend)
  })

  it('round-trip with mm-extraction pre-seeding (slow-life integration)', () => {
    // Simulates: extraction wrote supply, market reads it, prices it, writes back
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: {
        iron_ore: { supply: 30 },   // very scarce → high price
        grain:    { supply: 1000 }, // glut → low price
      },
    })

    const market = createSettlementMarket('thundertree')
    seedMarket(market, [
      { id: 'iron_ore', basePrice: 1, supply: 0, demand: 100 },
      { id: 'grain',    basePrice: 0.5, supply: 0, demand: 80 },
    ])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('thundertree')!
    const ironPrice = (ctx.economy.commodities as any).iron_ore.price
    const grainPrice = (ctx.economy.commodities as any).grain.price
    expect(ironPrice).toBeGreaterThan(1)    // shortage premium
    expect(grainPrice).toBeLessThan(0.5)    // glut discount
  })

  it('integrates with Clockwork — registers weekly, observes', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'economy', {
      commodities: { iron_ore: { supply: 100 } },
    })
    const market = createSettlementMarket('thundertree')
    seedMarket(market, [{ id: 'iron_ore', basePrice: 1, supply: 100, demand: 50 }])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })
    const clockwork = new Clockwork(tp, 0)
    clockwork.register(mm, 2, 'weekly')  // L2 ECONOMY
    clockwork.crankTo(14)  // 2 weekly ticks
    expect(mm.pendingDays()).toBeGreaterThan(0)

    const obs = clockwork.observeNode('thundertree')
    expect(obs.resolved.length).toBe(1)
    const ironKappa = (tp.getNode('thundertree')!.dataStatic as any).economy?.commodities?.iron_ore
    expect(typeof ironKappa?.price).toBe('number')
  })

  it('multi-week fold runs N weeks of price discovery', () => {
    const market = createSettlementMarket('thundertree')
    seedMarket(market, [{ id: 'iron_ore', basePrice: 1, supply: 100, demand: 50 }])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })
    mm.accumulatePotential(28, 28)  // 4 weeks
    const result = mm.resolve(28)
    expect(result.stateChanges.weeksTicked).toBe(4)
    expect((mm.serialize().domain as ReturnType<MMMarket['getDomainState']>).cumulative.weeksTicked).toBe(4)
  })

  it('exposes getPrice() for downstream sell intents', () => {
    const market = createSettlementMarket('thundertree')
    seedMarket(market, [{ id: 'iron_ore', basePrice: 1, supply: 100, demand: 50 }])
    const mm = new MMMarket(market, 0, { getD20: () => 12 })
    mm.accumulatePotential(7, 7); mm.resolve(7)
    expect(typeof mm.getPrice('iron_ore')).toBe('number')
    expect(mm.getPrice('nonexistent_commodity')).toBeUndefined()
  })
})
