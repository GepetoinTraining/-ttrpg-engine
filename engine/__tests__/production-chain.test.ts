/**
 * PRODUCTION CHAIN TESTS — From Dirt to Services
 * ===================================================
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  COMMODITIES, RECIPES, QUALITY_LEVELS,
  QUALITY_MULTIPLIERS,
  rollQuality,
  calculatePrice, determineTrend,
  tickExtraction, tickMarket,
  createDeposit, createExtraction,
  resetDepositIdCounter, resetExtractionIdCounter,
  type Deposit, type Extraction, type MarketPrice,
} from '../production-chain.js'

beforeEach(() => {
  resetDepositIdCounter()
  resetExtractionIdCounter()
})

// ============================================================
// COMMODITY CATALOG
// ============================================================

describe('Commodity Catalog', () => {
  it('has all essential primary commodities', () => {
    expect(COMMODITIES.grain).toBeDefined()
    expect(COMMODITIES.iron_ore).toBeDefined()
    expect(COMMODITIES.timber).toBeDefined()
    expect(COMMODITIES.herbs).toBeDefined()
  })

  it('has refined commodities', () => {
    expect(COMMODITIES.iron).toBeDefined()
    expect(COMMODITIES.weapons).toBeDefined()
    expect(COMMODITIES.armor).toBeDefined()
    expect(COMMODITIES.bread).toBeDefined()
  })

  it('iron is more expensive than iron ore (value added)', () => {
    expect(COMMODITIES.iron.basePrice).toBeGreaterThan(COMMODITIES.iron_ore.basePrice)
  })

  it('weapons are more expensive than iron (value added again)', () => {
    expect(COMMODITIES.weapons.basePrice).toBeGreaterThan(COMMODITIES.iron.basePrice)
  })

  it('meat perishes quickly', () => {
    expect(COMMODITIES.meat.perishable).toBe(true)
    expect(COMMODITIES.meat.perishDays).toBe(7)
  })

  it('iron ore has military value', () => {
    expect(COMMODITIES.iron_ore.militaryValue).toBe(true)
  })
})

// ============================================================
// RECIPES — Production Chains
// ============================================================

describe('Recipes', () => {
  it('iron ingot requires iron ore + coal', () => {
    const recipe = RECIPES.find(r => r.id === 'r_iron_ingot')!
    expect(recipe.inputs).toEqual([
      { commodityId: 'iron_ore', quantity: 2 },
      { commodityId: 'coal', quantity: 1 },
    ])
    expect(recipe.outputs).toEqual([{ commodityId: 'iron', quantity: 1 }])
  })

  it('longsword requires iron + timber + leather', () => {
    const recipe = RECIPES.find(r => r.id === 'r_longsword')!
    expect(recipe.inputs).toHaveLength(3)
    expect(recipe.minSkillLevel).toBe(2) // skilled work
  })

  it('bread is quick to make', () => {
    const recipe = RECIPES.find(r => r.id === 'r_bread')!
    expect(recipe.baseSlotsPerBatch).toBe(1)
    expect(recipe.difficulty).toBe(5) // easy
  })

  it('chain mail is long and hard', () => {
    const recipe = RECIPES.find(r => r.id === 'r_chain_mail')!
    expect(recipe.baseSlotsPerBatch).toBe(16)
    expect(recipe.difficulty).toBe(15)
    expect(recipe.minSkillLevel).toBe(3)
  })
})

// ============================================================
// QUALITY ROLLS
// ============================================================

describe('Quality Rolls', () => {
  it('natural 1 always produces poor quality', () => {
    expect(rollQuality(5, 2, 10, 1)).toBe('poor')
  })

  it('natural 20 bumps quality up one tier', () => {
    // skill 3 + tool 0 + roll 20 = 23, margin = 23-10 = 13 → excellent, bumped to masterwork
    expect(rollQuality(3, 0, 10, 20)).toBe('masterwork')
  })

  it('high skill makes better items', () => {
    const low = rollQuality(1, 0, 12, 10)  // 1+10=11, margin=-1 → poor
    const high = rollQuality(5, 2, 12, 10) // 5+2+10=17, margin=5 → good
    expect(QUALITY_LEVELS[high].priceMultiplier).toBeGreaterThan(QUALITY_LEVELS[low].priceMultiplier)
  })

  it('masterwork items are worth 3x', () => {
    expect(QUALITY_LEVELS.masterwork.priceMultiplier).toBe(3.0)
  })
})

// ============================================================
// MARKET PRICING
// ============================================================

describe('Market Pricing', () => {
  it('surplus drives price down', () => {
    const price = calculatePrice(10, 100, 50) // 2:1 ratio
    expect(price).toBeLessThan(10)
  })

  it('shortage drives price up', () => {
    const price = calculatePrice(10, 10, 50) // 0.2:1 ratio
    expect(price).toBeGreaterThan(10)
  })

  it('balanced supply/demand = base price', () => {
    const price = calculatePrice(10, 50, 50) // 1:1 ratio
    expect(price).toBeCloseTo(10, 1)
  })

  it('zero supply = 5x price', () => {
    expect(calculatePrice(10, 0, 50)).toBe(50)
  })

  it('zero demand = half price', () => {
    expect(calculatePrice(10, 50, 0)).toBe(5)
  })

  it('price never goes below 10% of base', () => {
    const price = calculatePrice(10, 10000, 1) // massive surplus
    expect(price).toBeGreaterThanOrEqual(1) // 10% of 10
  })
})

// ============================================================
// TREND DETECTION
// ============================================================

describe('Market Trends', () => {
  it('stable when price unchanged', () => {
    expect(determineTrend(10, 10)).toBe('stable')
  })
  it('rising with 10% increase', () => {
    expect(determineTrend(11, 10)).toBe('rising')
  })
  it('falling with 10% decrease', () => {
    expect(determineTrend(9, 10)).toBe('falling')
  })
  it('spiking with 30% increase', () => {
    expect(determineTrend(13, 10)).toBe('spiking')
  })
  it('crashing with 30% decrease', () => {
    expect(determineTrend(7, 10)).toBe('crashing')
  })
})

// ============================================================
// EXTRACTION — Ticking deposits
// ============================================================

describe('Extraction Ticking', () => {
  it('produces commodities when operating', () => {
    const deposit = createDeposit('Iron Mine', 'node_1', 'shallow', 'iron_ore', 'standard', {
      optimalLabor: 20, baseOutputPerDay: 10,
    })
    const extraction = createExtraction(deposit.id, 'node_1', 'duke_v', 'warehouse_1', 20)

    const produced = tickExtraction(extraction, deposit)
    expect(produced.iron_ore).toBe(10) // full labor, standard quality
    expect(extraction.totalExtracted).toBe(10)
  })

  it('rich quality doubles output', () => {
    const deposit = createDeposit('Rich Mine', 'node_1', 'shallow', 'iron_ore', 'rich', {
      optimalLabor: 20, baseOutputPerDay: 10,
    })
    const extraction = createExtraction(deposit.id, 'node_1', 'duke_v', 'wh_1', 20)

    const produced = tickExtraction(extraction, deposit)
    expect(produced.iron_ore).toBe(15) // 10 × 1.5
  })

  it('undermanned extraction produces less', () => {
    const deposit = createDeposit('Mine', 'node_1', 'shallow', 'iron_ore', 'standard', {
      optimalLabor: 20, baseOutputPerDay: 10,
    })
    const extraction = createExtraction(deposit.id, 'node_1', 'duke_v', 'wh_1', 10) // half staff

    const produced = tickExtraction(extraction, deposit)
    expect(produced.iron_ore).toBe(5) // 10 × 0.5
  })

  it('non-renewable deposits deplete', () => {
    const deposit = createDeposit('Finite Mine', 'node_1', 'shallow', 'gold_ore', 'standard', {
      optimalLabor: 10, baseOutputPerDay: 5, totalReserves: 20, remainingReserves: 10,
    })
    const extraction = createExtraction(deposit.id, 'node_1', 'duke_v', 'wh_1', 10)

    tickExtraction(extraction, deposit)
    expect(deposit.remainingReserves).toBe(5) // 10 - 5

    tickExtraction(extraction, deposit)
    expect(deposit.remainingReserves).toBe(0)
    expect(extraction.status).toBe('exhausted')
  })

  it('idle extraction produces nothing', () => {
    const deposit = createDeposit('Mine', 'node_1', 'shallow', 'iron_ore')
    const extraction = createExtraction(deposit.id, 'node_1', 'duke_v', 'wh_1')
    extraction.status = 'idle'

    const produced = tickExtraction(extraction, deposit)
    expect(Object.keys(produced)).toHaveLength(0)
  })

  it('stockpile accumulates', () => {
    const deposit = createDeposit('Mine', 'node_1', 'shallow', 'iron_ore', 'standard', {
      optimalLabor: 10, baseOutputPerDay: 5,
    })
    const extraction = createExtraction(deposit.id, 'node_1', 'duke_v', 'wh_1', 10)

    tickExtraction(extraction, deposit)
    tickExtraction(extraction, deposit)
    expect(extraction.stockpile.iron_ore).toBe(10) // 5 + 5
  })
})

// ============================================================
// MARKET TICK
// ============================================================

describe('Market Ticking', () => {
  it('production increases supply', () => {
    const prices: MarketPrice[] = [
      { commodityId: 'grain', currentPrice: 0.01, basePrice: 0.01, supply: 100, demand: 80, trend: 'stable', available: true, blackMarketOnly: false },
    ]
    tickMarket(prices, {}, { grain: 50 })
    expect(prices[0].supply).toBe(150) // 100 + 50
  })

  it('consumption decreases supply', () => {
    const prices: MarketPrice[] = [
      { commodityId: 'grain', currentPrice: 0.01, basePrice: 0.01, supply: 100, demand: 80, trend: 'stable', available: true, blackMarketOnly: false },
    ]
    tickMarket(prices, { grain: 30 }, {})
    expect(prices[0].supply).toBe(70) // 100 - 30
  })

  it('supply cannot go negative', () => {
    const prices: MarketPrice[] = [
      { commodityId: 'grain', currentPrice: 0.01, basePrice: 0.01, supply: 10, demand: 80, trend: 'stable', available: true, blackMarketOnly: false },
    ]
    tickMarket(prices, { grain: 50 }, {})
    expect(prices[0].supply).toBe(0) // clamped
  })

  it('price updates after market tick', () => {
    const prices: MarketPrice[] = [
      { commodityId: 'grain', currentPrice: 0.01, basePrice: 0.01, supply: 100, demand: 100, trend: 'stable', available: true, blackMarketOnly: false },
    ]
    // Remove most supply → shortage
    tickMarket(prices, { grain: 90 }, {})
    expect(prices[0].currentPrice).toBeGreaterThan(0.01) // supply 10, demand 100
    expect(prices[0].trend).not.toBe('stable')
  })
})
