import { describe, it, expect } from 'vitest'
import {
  effectiveExchangeRate,
  convertCurrency,
  appraiseGem,
  weeklyExchangeTick,
  recordTrade,
  createCurrencySystem,
  GEM_CATALOG,
  GEM_BASE_VALUES,
  BASE_DENOMINATION_RATES,
  type CurrencySystem,
  type ExchangeRate,
} from '../currency'

function makeCurrency(overrides: Partial<CurrencySystem> = {}): CurrencySystem {
  return {
    id: 'cur_1',
    worldId: 'world_1',
    name: 'Golden Lion',
    issuingKingdom: 'Cormyr',
    denominations: { copper: 'copper nib', silver: 'silver falcon', electrum: 'half-lion', gold: 'golden lion', platinum: 'platinum crown' },
    trust: 1.0,
    active: true,
    ...overrides,
  }
}

function makeRate(overrides: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    id: 'rate_1',
    fromCurrencyId: 'cur_1',
    toCurrencyId: 'cur_2',
    rate: 1.0,
    tradeVolume: 1000,
    lastUpdatedDay: 1,
    ...overrides,
  }
}

describe('Currency Engine', () => {

  // ──────────────────────────────────────
  // CURRENCY SYSTEMS
  // ──────────────────────────────────────

  describe('Currency Systems', () => {
    it('creates default currency with standard denominations', () => {
      const c = createCurrencySystem('w1', 'Test Coin', 'kingdom_1')
      expect(c.name).toBe('Test Coin')
      expect(c.trust).toBe(1.0)
      expect(c.active).toBe(true)
      expect(c.denominations.gold).toBe('gold piece')
    })

    it('creates currency with custom denomination names', () => {
      const c = createCurrencySystem('w1', 'Golden Lion', 'cormyr', {
        gold: 'golden lion',
        platinum: 'platinum crown',
      })
      expect(c.denominations.gold).toBe('golden lion')
      expect(c.denominations.platinum).toBe('platinum crown')
      expect(c.denominations.copper).toBe('copper piece') // default
    })

    it('base denomination rates follow D&D standard', () => {
      expect(BASE_DENOMINATION_RATES.copper).toBe(0.01)
      expect(BASE_DENOMINATION_RATES.silver).toBe(0.1)
      expect(BASE_DENOMINATION_RATES.gold).toBe(1.0)
      expect(BASE_DENOMINATION_RATES.platinum).toBe(10.0)
    })
  })

  // ──────────────────────────────────────
  // EXCHANGE RATES
  // ──────────────────────────────────────

  describe('Exchange Rates', () => {
    it('equal-trust currencies exchange at base rate', () => {
      const from = makeCurrency({ id: 'c1', trust: 1.0 })
      const to = makeCurrency({ id: 'c2', trust: 1.0 })
      const rate = makeRate({ rate: 1.0, tradeVolume: 5000 })
      const effective = effectiveExchangeRate(rate, from, to)
      expect(effective).toBe(1.0)
    })

    it('low trust currency gets worse rate', () => {
      const from = makeCurrency({ trust: 0.5 })
      const to = makeCurrency({ id: 'c2', trust: 1.0 })
      const rate = makeRate({ rate: 1.0, tradeVolume: 5000 })
      const effective = effectiveExchangeRate(rate, from, to)
      expect(effective).toBe(0.5) // half trust = half rate
    })

    it('low trade volume widens spread', () => {
      const from = makeCurrency()
      const to = makeCurrency({ id: 'c2' })
      const highVol = makeRate({ tradeVolume: 5000 })
      const lowVol = makeRate({ tradeVolume: 0 })
      const highRate = effectiveExchangeRate(highVol, from, to)
      const lowRate = effectiveExchangeRate(lowVol, from, to)
      expect(lowRate).toBeLessThan(highRate)
    })

    it('converts currency with fee', () => {
      const from = makeCurrency()
      const to = makeCurrency({ id: 'c2' })
      const rate = makeRate({ rate: 1.0, tradeVolume: 5000 })
      const result = convertCurrency(100, rate, from, to)
      expect(result.fee).toBeGreaterThan(0)
      expect(result.amountInTarget).toBeLessThan(100)
      expect(result.amountInTarget + result.fee).toBeCloseTo(100)
    })

    it('high volume trades have lower fees', () => {
      const from = makeCurrency()
      const to = makeCurrency({ id: 'c2' })
      const highVol = makeRate({ tradeVolume: 100000 })
      const lowVol = makeRate({ tradeVolume: 0 })
      const r1 = convertCurrency(100, highVol, from, to)
      const r2 = convertCurrency(100, lowVol, from, to)
      expect(r1.fee).toBeLessThan(r2.fee)
    })
  })

  // ──────────────────────────────────────
  // GEMS
  // ──────────────────────────────────────

  describe('Gem Catalog', () => {
    it('has 20 gem types', () => {
      expect(GEM_CATALOG).toHaveLength(20)
    })

    it('has 5 tiers', () => {
      const tiers = new Set(GEM_CATALOG.map(g => g.tier))
      expect(tiers.size).toBe(5)
    })

    it('tier base values match', () => {
      expect(GEM_BASE_VALUES.ornamental).toBe(10)
      expect(GEM_BASE_VALUES.semi_precious).toBe(50)
      expect(GEM_BASE_VALUES.precious).toBe(100)
      expect(GEM_BASE_VALUES.gem).toBe(500)
      expect(GEM_BASE_VALUES.jewel).toBe(5000)
    })

    it('ornamental gems have highest rarity weights', () => {
      const ornamentals = GEM_CATALOG.filter(g => g.tier === 'ornamental')
      const jewels = GEM_CATALOG.filter(g => g.tier === 'jewel')
      const avgOrnamental = ornamentals.reduce((s, g) => s + g.rarityWeight, 0) / ornamentals.length
      const avgJewel = jewels.reduce((s, g) => s + g.rarityWeight, 0) / jewels.length
      expect(avgOrnamental).toBeGreaterThan(avgJewel)
    })
  })

  describe('Gem Appraisal', () => {
    const ruby = GEM_CATALOG.find(g => g.id === 'gem_ruby')!

    it('flawed quality on low roll', () => {
      const result = appraiseGem(ruby, 1)
      expect(result.quality).toBe('flawed')
      expect(result.value).toBe(400) // 500 * 0.8
    })

    it('good quality on mid roll', () => {
      const result = appraiseGem(ruby, 10)
      expect(result.quality).toBe('good')
      expect(result.value).toBe(500)
    })

    it('perfect quality on nat 20', () => {
      const result = appraiseGem(ruby, 20)
      expect(result.quality).toBe('perfect')
      expect(result.value).toBe(600) // 500 * 1.2
    })

    it('fair quality on 4-8', () => {
      const result = appraiseGem(ruby, 5)
      expect(result.quality).toBe('fair')
      expect(result.value).toBe(450) // 500 * 0.9
    })

    it('excellent quality on 15-18', () => {
      const result = appraiseGem(ruby, 17)
      expect(result.quality).toBe('excellent')
      expect(result.value).toBe(550) // 500 * 1.1
    })
  })

  // ──────────────────────────────────────
  // EXCHANGE RATE TICK
  // ──────────────────────────────────────

  describe('Weekly Exchange Tick', () => {
    it('rates drift with d20 rolls', () => {
      const from = makeCurrency()
      const to = makeCurrency({ id: 'c2' })
      const rate = makeRate({ rate: 1.0, tradeVolume: 1000 })
      const result = weeklyExchangeTick(rate, from, to, 10, 2) // mid roll
      expect(result.newRate).not.toBe(result.previousRate)
    })

    it('high roll strengthens from-currency', () => {
      const from = makeCurrency()
      const to = makeCurrency({ id: 'c2' })
      const rate = makeRate({ rate: 1.0, tradeVolume: 100 })
      weeklyExchangeTick(rate, from, to, 20, 2)
      expect(rate.rate).toBeGreaterThan(1.0)
    })

    it('low roll weakens from-currency', () => {
      const from = makeCurrency()
      const to = makeCurrency({ id: 'c2' })
      const rate = makeRate({ rate: 1.0, tradeVolume: 100 })
      weeklyExchangeTick(rate, from, to, 1, 2)
      expect(rate.rate).toBeLessThan(1.0)
    })

    it('inactive currency depreciates', () => {
      const from = makeCurrency({ active: false })
      const to = makeCurrency({ id: 'c2' })
      const rate = makeRate({ rate: 1.0, tradeVolume: 100 })
      weeklyExchangeTick(rate, from, to, 10, 2)
      expect(rate.rate).toBeLessThan(1.0)
    })

    it('trade volume decays', () => {
      const from = makeCurrency()
      const to = makeCurrency({ id: 'c2' })
      const rate = makeRate({ tradeVolume: 1000 })
      weeklyExchangeTick(rate, from, to, 10, 2)
      expect(rate.tradeVolume).toBeLessThan(1000)
    })

    it('recordTrade increases volume', () => {
      const rate = makeRate({ tradeVolume: 100 })
      recordTrade(rate, 500)
      expect(rate.tradeVolume).toBe(600)
    })
  })
})
