/**
 * MARKET ENGINE TESTS
 */
import { describe, it, expect } from 'vitest'
import {
  TIER_REQUIREMENTS,
  SPECIALIZATION_GOODS,
  createVenue,
  createMerchant,
  discoverPrice,
  resolveHaggle,
  calculateSellerResistance,
  simulateMerchantDecision,
  canUpgradeTier,
  createMarketEvent,
  createSettlementMarket,
  weeklyMarketTick,
  type CommodityPrice,
  type Merchant,
} from '../market.js'

// ============================================================
// TIER REQUIREMENTS
// ============================================================

describe('Tier Requirements', () => {
  it('peddler needs least capital', () => {
    expect(TIER_REQUIREMENTS.peddler.minCapital).toBe(10)
  })
  it('consortium needs most', () => {
    expect(TIER_REQUIREMENTS.consortium.minCapital).toBe(50000)
  })
  it('margins decrease as tier increases', () => {
    expect(TIER_REQUIREMENTS.peddler.typicalMargin).toBeGreaterThan(TIER_REQUIREMENTS.consortium.typicalMargin)
  })
})

// ============================================================
// SPECIALIZATIONS
// ============================================================

describe('Specializations', () => {
  it('grocer sells food', () => {
    expect(SPECIALIZATION_GOODS.grocer).toContain('grain')
    expect(SPECIALIZATION_GOODS.grocer).toContain('meat')
  })
  it('armorer sells weapons', () => {
    expect(SPECIALIZATION_GOODS.armorer).toContain('weapons')
    expect(SPECIALIZATION_GOODS.armorer).toContain('armor')
  })
  it('general_goods is wildcard', () => {
    expect(SPECIALIZATION_GOODS.general_goods).toEqual(['*'])
  })
  it('all 18 specializations defined', () => {
    expect(Object.keys(SPECIALIZATION_GOODS)).toHaveLength(18)
  })
})

// ============================================================
// VENUES
// ============================================================

describe('Venues', () => {
  it('creates venue with type defaults', () => {
    const v = createVenue('The Bazaar', 'stall', 'hub_1')
    expect(v.type).toBe('stall')
    expect(v.displayCapacity).toBe(20)
    expect(v.rentCostWeekly).toBe(5)
    expect(v.status).toBe('open')
  })

  it('emporium is bigger than shop', () => {
    const shop = createVenue('My Shop', 'shop', 'hub_1')
    const emp = createVenue('Grand Emporium', 'emporium', 'hub_1')
    expect(emp.displayCapacity).toBeGreaterThan(shop.displayCapacity)
    expect(emp.storageCapacity).toBeGreaterThan(shop.storageCapacity)
  })
})

// ============================================================
// MERCHANTS
// ============================================================

describe('Merchants', () => {
  it('creates at peddler tier', () => {
    const m = createMerchant('Bob', 'hub_1', 'grocer')
    expect(m.tier).toBe('peddler')
    expect(m.capital).toBe(10)
    expect(m.status).toBe('operating')
  })

  it('canUpgradeTier checks requirements', () => {
    const m = createMerchant('Alice', 'hub_1', 'armorer', {
      capital: 200, reputation: 15, employeeCount: 0,
    })
    // peddler -> stall needs 100 capital, 10 rep, 0 employees
    const { canUpgrade, nextTier } = canUpgradeTier(m)
    expect(canUpgrade).toBe(true)
    expect(nextTier).toBe('stall')
  })

  it('cannot upgrade without enough capital', () => {
    const m = createMerchant('Poor Bob', 'hub_1', 'grocer', { capital: 5 })
    expect(canUpgradeTier(m).canUpgrade).toBe(false)
  })
})

// ============================================================
// PRICE DISCOVERY
// ============================================================

describe('Price Discovery', () => {
  it('balanced market: price stays at base', () => {
    const result = discoverPrice('grain', 10, 100, 100)
    expect(result.newPrice).toBe(10)
    expect(result.trend).toBe('stable')
  })

  it('shortage doubles price', () => {
    const result = discoverPrice('grain', 10, 40, 100) // ratio 0.4
    expect(result.newPrice).toBe(25) // 10 * 2.50
    expect(result.trend).toBe('spiking')
  })

  it('glut crashes price', () => {
    const result = discoverPrice('grain', 10, 300, 100) // ratio 3.0
    expect(result.newPrice).toBe(2.5) // 10 * 0.25
    expect(result.trend).toBe('crashing')
  })

  it('event modifier applied', () => {
    const result = discoverPrice('grain', 10, 100, 100, 1.5)
    expect(result.newPrice).toBe(15) // 10 * 1.0 * 1.5
  })

  it('price floor enforced', () => {
    const result = discoverPrice('grain', 10, 300, 100, 1.0, { priceFloor: 5 })
    expect(result.newPrice).toBe(5) // Would be 2.5 but floor is 5
  })

  it('price ceiling enforced', () => {
    const result = discoverPrice('grain', 10, 40, 100, 1.0, { priceCeiling: 20 })
    expect(result.newPrice).toBe(20) // Would be 25 but ceiling is 20
  })

  it('tax applied', () => {
    const result = discoverPrice('grain', 10, 100, 100, 1.0, { taxRate: 0.1 })
    expect(result.newPrice).toBe(11) // 10 + 10%
  })
})

// ============================================================
// HAGGLING
// ============================================================

describe('Haggling', () => {
  const merchant = createMerchant('Testy', 'hub_1', 'general_goods', {
    personality: { greed: 0.5, patience: 0.5, honesty: 0.7, risk: 0.3 },
  })

  it('seller resistance based on greed', () => {
    const dc = calculateSellerResistance(merchant)
    expect(dc).toBeGreaterThanOrEqual(5)
    expect(dc).toBeLessThanOrEqual(25)
  })

  it('natural 20 gives 20%+ discount', () => {
    const result = resolveHaggle(merchant, 100, 20, 5)
    expect(result.success).toBe(true)
    expect(result.discount).toBeGreaterThanOrEqual(0.2)
    expect(result.finalPrice).toBeLessThan(80)
  })

  it('natural 1 increases price', () => {
    const result = resolveHaggle(merchant, 100, 1, 5)
    expect(result.discount).toBe(-0.10)
    expect(result.finalPrice).toBe(110)
  })

  it('mediocre roll with no bonus fails', () => {
    const result = resolveHaggle(merchant, 100, 5, 0)
    // DC is ~15 (10 + 5 greed), so roll 5+0=5 << 15
    expect(result.discount).toBe(0)
  })
})

// ============================================================
// MERCHANT AI
// ============================================================

describe('Merchant AI', () => {
  it('merchant liquidates when broke', () => {
    const m = createMerchant('Broke Bob', 'hub_1', 'grocer', {
      capital: 5,
      inventory: [{ commodityId: 'grain', quantity: 100, purchasePrice: 1, quality: 'common' }],
    })
    const prices: Record<string, CommodityPrice> = {
      grain: { commodityId: 'grain', basePrice: 1, currentPrice: 1, supply: 100, demand: 100, trend: 'stable', available: true },
    }
    const decision = simulateMerchantDecision(m, prices, 10)
    expect(decision.type).toBe('liquidate')
  })

  it('merchant restocks when low', () => {
    const m = createMerchant('Grocer Gail', 'hub_1', 'grocer', { capital: 500, tier: 'shop' })
    const prices: Record<string, CommodityPrice> = {
      grain: { commodityId: 'grain', basePrice: 1, currentPrice: 1, supply: 100, demand: 100, trend: 'stable', available: true },
    }
    const decision = simulateMerchantDecision(m, prices, 10)
    expect(decision.type).toBe('restock')
    expect(decision.commodityId).toBe('grain')
  })

  it('merchant does nothing when stable', () => {
    const m = createMerchant('Happy Hannah', 'hub_1', 'grocer', {
      capital: 5000, tier: 'shop', employeeCount: 1, reputation: 30,
      inventory: [{ commodityId: 'grain', quantity: 50, purchasePrice: 1, quality: 'common' }],
    })
    const prices: Record<string, CommodityPrice> = {
      grain: { commodityId: 'grain', basePrice: 1, currentPrice: 1, supply: 100, demand: 100, trend: 'stable', available: true },
    }
    const decision = simulateMerchantDecision(m, prices, 10)
    // Already stocked, can't yet upgrade to emporium (needs 50 rep), doesn't need staff
    expect(decision.type).toBe('nothing')
  })
})

// ============================================================
// MARKET EVENTS
// ============================================================

describe('Market Events', () => {
  it('creates event from template', () => {
    const e = createMarketEvent('festival_demand', 'hub_1', ['wine', 'food'])
    expect(e.type).toBe('festival_demand')
    expect(e.demandMultiplier).toBe(2.0)
    expect(e.durationWeeks).toBe(1)
    expect(e.status).toBe('active')
  })

  it('embargo cuts supply', () => {
    const e = createMarketEvent('embargo_effect', 'hub_1', ['silk'])
    expect(e.supplyMultiplier).toBe(0.4)
    expect(e.durationWeeks).toBe(8)
  })
})

// ============================================================
// WEEKLY MARKET TICK
// ============================================================

describe('Weekly Market Tick', () => {
  function makeMarket() {
    const market = createSettlementMarket('hub_1', 0.05)
    market.prices = {
      grain: { commodityId: 'grain', basePrice: 1, currentPrice: 1, supply: 100, demand: 100, trend: 'stable', available: true },
      iron: { commodityId: 'iron', basePrice: 5, currentPrice: 5, supply: 50, demand: 50, trend: 'stable', available: true },
    }
    const m = createMerchant('TestMerchant', 'hub_1', 'grocer', {
      capital: 500, tier: 'stall',
      inventory: [{ commodityId: 'grain', quantity: 20, purchasePrice: 1, quality: 'common' }],
    })
    market.merchants.push(m)
    return market
  }

  it('runs without error', () => {
    const market = makeMarket()
    const result = weeklyMarketTick(market, 10) // d20=10, no random event
    expect(result.priceChanges).toHaveLength(2)
    expect(result.merchantDecisions).toHaveLength(1)
  })

  it('resolves expired events', () => {
    const market = makeMarket()
    const event = createMarketEvent('festival_demand', 'hub_1', ['grain'])
    event.weeksRemaining = 1 // Will expire this tick
    market.activeEvents.push(event)

    const result = weeklyMarketTick(market, 10)
    expect(result.resolvedEvents).toContain(event.id)
  })

  it('bankrupts merchant with no capital', () => {
    const market = makeMarket()
    market.merchants[0].capital = 0
    market.merchants[0].venueId = 'some_venue'
    market.venues.push(createVenue('Market Stall', 'stall', 'hub_1', { id: 'some_venue' }))

    const result = weeklyMarketTick(market, 10)
    expect(result.bankruptcies).toHaveLength(1)
  })

  it('generates event on low d20 roll', () => {
    const market = makeMarket()
    const result = weeklyMarketTick(market, 1) // d20=1 triggers event
    expect(result.newEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('no event on high d20 roll', () => {
    const market = makeMarket()
    const result = weeklyMarketTick(market, 15)
    expect(result.newEvents).toHaveLength(0)
  })
})
