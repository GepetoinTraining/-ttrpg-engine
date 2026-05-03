/**
 * AGRICULTURE ENGINE TESTS
 * =========================
 * Farming, fisheries, gathering, tax-in-kind, food variety
 */

import { describe, it, expect } from 'vitest'
import {
  CROP_DATA, PLOT_ACRES, TENURE_MODIFIERS, CULTIVATION_MODIFIERS,
  calculateHarvest, createFarmPlot,
  FISHERY_YIELD, weeklyFisheryYield,
  GATHERING_DATA, weeklyGathering,
  collectTaxInKind,
  calculateFoodVariety,
  EXTRACTION_INDUSTRY_DATA,
  type FisheryOperation,
} from '../agriculture'

// ============================================================
// CROP DATA
// ============================================================

describe('Crop Data', () => {
  it('has 20 crop types', () => {
    expect(Object.keys(CROP_DATA).length).toBe(20)
  })

  it('wheat is a grain with spring/summer seasons', () => {
    const wheat = CROP_DATA.wheat
    expect(wheat.category).toBe('grain')
    expect(wheat.growSeasons).toContain('spring')
    expect(wheat.edible).toBe(true)
  })

  it('flax is fiber (not edible)', () => {
    expect(CROP_DATA.flax.edible).toBe(false)
    expect(CROP_DATA.flax.category).toBe('fiber')
  })

  it('rice has highest grain yield', () => {
    const grains = Object.entries(CROP_DATA)
      .filter(([, d]) => d.category === 'grain')
    const maxYield = Math.max(...grains.map(([, d]) => d.baseYield))
    expect(CROP_DATA.rice.baseYield).toBe(maxYield)
  })
})

// ============================================================
// PLOT & TENURE
// ============================================================

describe('Plots & Tenure', () => {
  it('has 4 plot sizes', () => {
    expect(Object.keys(PLOT_ACRES).length).toBe(4)
  })

  it('large estate is biggest', () => {
    expect(PLOT_ACRES.large_estate).toBeGreaterThan(PLOT_ACRES.field)
    expect(PLOT_ACRES.field).toBeGreaterThan(PLOT_ACRES.small_plot)
  })

  it('freehold has best labor efficiency', () => {
    expect(TENURE_MODIFIERS.freehold.laborEfficiency).toBe(1.0)
    expect(TENURE_MODIFIERS.serfdom.laborEfficiency).toBeLessThan(1.0)
  })

  it('serfdom has highest tax rate', () => {
    const rates = Object.values(TENURE_MODIFIERS).map(t => t.taxRate)
    expect(TENURE_MODIFIERS.serfdom.taxRate).toBe(Math.max(...rates))
  })

  it('serfs cannot sell surplus', () => {
    expect(TENURE_MODIFIERS.serfdom.canSellSurplus).toBe(false)
  })

  it('monastic has zero tax but highest yield', () => {
    expect(TENURE_MODIFIERS.monastic.taxRate).toBe(0)
    expect(TENURE_MODIFIERS.monastic.yieldMultiplier).toBe(1.2)
  })
})

// ============================================================
// CULTIVATION MODE
// ============================================================

describe('Cultivation', () => {
  it('monoculture has higher yield but fragile', () => {
    expect(CULTIVATION_MODIFIERS.monoculture.yieldMultiplier).toBeGreaterThan(
      CULTIVATION_MODIFIERS.multiculture.yieldMultiplier,
    )
    expect(CULTIVATION_MODIFIERS.monoculture.blightThreshold).toBeGreaterThan(
      CULTIVATION_MODIFIERS.multiculture.blightThreshold,
    )
  })

  it('multiculture adds food variety', () => {
    expect(CULTIVATION_MODIFIERS.multiculture.varietyBonus).toBeGreaterThan(0)
    expect(CULTIVATION_MODIFIERS.monoculture.varietyBonus).toBe(0)
  })
})

// ============================================================
// HARVEST CALCULATION
// ============================================================

describe('Harvest', () => {
  it('produces grain on a standard freehold field', () => {
    const plot = createFarmPlot('node1', 'lord1', 'farmer1', {
      tenure: 'freehold',
      cultivation: 'multiculture',
      crops: [{ type: 'wheat', acresPlanted: 40 }],
      season: 'spring',
      soilQuality: 1.0,
    })
    const result = calculateHarvest(plot, 15) // no blight
    expect(result.totalBushels).toBeGreaterThan(0)
    expect(result.blighted).toBe(false)
  })

  it('freehold pays less tax than serfdom', () => {
    const free = createFarmPlot('n', 'l', 'f', { tenure: 'freehold', crops: [{ type: 'wheat', acresPlanted: 40 }], season: 'spring' })
    const serf = createFarmPlot('n', 'l', 'f', { tenure: 'serfdom', crops: [{ type: 'wheat', acresPlanted: 40 }], season: 'spring' })
    const freeHarvest = calculateHarvest(free, 15)
    const serfHarvest = calculateHarvest(serf, 15)
    expect(freeHarvest.taxInKind).toBeLessThan(serfHarvest.taxInKind)
  })

  it('monoculture blight destroys entire crop on low roll', () => {
    const plot = createFarmPlot('n', 'l', 'f', {
      cultivation: 'monoculture',
      crops: [{ type: 'wheat', acresPlanted: 40 }],
      season: 'spring',
    })
    const result = calculateHarvest(plot, 1) // blight!
    expect(result.blighted).toBe(true)
    expect(result.totalBushels).toBe(0)
  })

  it('multiculture blight only partially damages', () => {
    const plot = createFarmPlot('n', 'l', 'f', {
      cultivation: 'multiculture',
      crops: [{ type: 'wheat', acresPlanted: 20 }, { type: 'turnip', acresPlanted: 20 }],
      season: 'spring',
    })
    const result = calculateHarvest(plot, 1) // blight
    expect(result.blighted).toBe(true)
    expect(result.totalBushels).toBeGreaterThan(0) // turnip survives
    expect(result.blightedCrops.length).toBe(1)
  })

  it('out-of-season crops yield nothing', () => {
    const plot = createFarmPlot('n', 'l', 'f', {
      crops: [{ type: 'wheat', acresPlanted: 40 }],
      season: 'fall', // wheat doesn't grow in fall
    })
    const result = calculateHarvest(plot, 15)
    expect(result.totalBushels).toBe(0)
  })

  it('weather modifier affects yield', () => {
    const plot = createFarmPlot('n', 'l', 'f', { crops: [{ type: 'wheat', acresPlanted: 40 }], season: 'spring' })
    const good = calculateHarvest(plot, 15, 1.5)
    const bad = calculateHarvest(plot, 15, 0.5)
    expect(good.totalBushels).toBeGreaterThan(bad.totalBushels)
  })
})

// ============================================================
// FISHERY
// ============================================================

describe('Fishery', () => {
  it('has 3 fishery types', () => {
    expect(Object.keys(FISHERY_YIELD).length).toBe(3)
  })

  it('saltwater yields more than freshwater', () => {
    expect(FISHERY_YIELD.saltwater.baseLbsPerWeek).toBeGreaterThan(FISHERY_YIELD.freshwater.baseLbsPerWeek)
  })

  it('more workers = more fish', () => {
    const base: FisheryOperation = { id: 'f1', nodeId: 'n1', type: 'freshwater', workers: 5, boats: 1, seasonalModifier: 1 }
    const small = weeklyFisheryYield(base, 10)
    const big = weeklyFisheryYield({ ...base, workers: 20 }, 10)
    expect(big.lbs).toBeGreaterThan(small.lbs)
  })

  it('fishing contributes to food variety', () => {
    const op: FisheryOperation = { id: 'f1', nodeId: 'n1', type: 'freshwater', workers: 5, boats: 1, seasonalModifier: 1 }
    const result = weeklyFisheryYield(op, 10)
    expect(result.varietyContribution).toBe(1)
  })
})

// ============================================================
// GATHERING
// ============================================================

describe('Gathering', () => {
  it('has 6 gathering types', () => {
    expect(Object.keys(GATHERING_DATA).length).toBe(6)
  })

  it('yields nothing out of season', () => {
    const result = weeklyGathering('berries', 5, 'forest', 'winter', 10)
    expect(result.lbs).toBe(0)
  })

  it('preferred terrain gives more', () => {
    const good = weeklyGathering('mushrooms', 5, 'forest', 'fall', 10)
    const bad = weeklyGathering('mushrooms', 5, 'desert', 'fall', 10)
    expect(good.lbs).toBeGreaterThan(bad.lbs)
  })

  it('gathering contributes to food variety', () => {
    const result = weeklyGathering('wild_herbs', 3, 'forest', 'spring', 10)
    expect(result.varietyContribution).toBe(1)
  })
})

// ============================================================
// TAX-IN-KIND
// ============================================================

describe('Tax-in-Kind', () => {
  it('collects grain from harvests', () => {
    const plot = createFarmPlot('n', 'l', 'f', { tenure: 'serfdom', crops: [{ type: 'wheat', acresPlanted: 40 }], season: 'spring' })
    const harvest = calculateHarvest(plot, 15)
    const tax = collectTaxInKind([harvest], 10)
    expect(tax.totalGrainCollected).toBeGreaterThan(0)
  })

  it('allocates grain to army, granary, and market', () => {
    const plot = createFarmPlot('n', 'l', 'f', { tenure: 'tenant', crops: [{ type: 'wheat', acresPlanted: 100 }], season: 'spring', plotSize: 'large_estate' })
    const harvest = calculateHarvest(plot, 15)
    const tax = collectTaxInKind([harvest], 50)
    expect(tax.grainToArmy).toBeGreaterThan(0)
    expect(tax.grainToGranary).toBeGreaterThan(0)
    expect(tax.grainToMarket).toBeGreaterThan(0)
    expect(tax.grainToArmy + tax.grainToGranary + tax.grainToMarket).toBe(tax.totalGrainCollected)
  })
})

// ============================================================
// FOOD VARIETY
// ============================================================

describe('Food Variety', () => {
  it('10+ foods = max variety score', () => {
    const foods = ['grain', 'meat', 'fish', 'vegetables', 'fruit', 'dairy', 'eggs', 'herbs', 'honey', 'spices']
    const result = calculateFoodVariety(foods)
    expect(result.varietyScore).toBe(10)
    expect(result.moraleModifier).toBe(3)
    expect(result.healthModifier).toBe(2)
  })

  it('1 food = near starvation', () => {
    const result = calculateFoodVariety(['grain'])
    expect(result.varietyScore).toBe(1)
    expect(result.moraleModifier).toBeLessThan(0)
    expect(result.healthModifier).toBeLessThan(0)
  })

  it('0 foods = famine', () => {
    const result = calculateFoodVariety([])
    expect(result.varietyScore).toBe(0)
    expect(result.moraleModifier).toBe(-3)
  })

  it('5 foods = adequate', () => {
    const result = calculateFoodVariety(['grain', 'meat', 'fish', 'vegetables', 'fruit'])
    expect(result.varietyScore).toBe(5)
    expect(result.moraleModifier).toBe(1)
  })
})

// ============================================================
// EXTRACTION INDUSTRIES
// ============================================================

describe('Extraction Industries', () => {
  it('has 6 industry types', () => {
    expect(Object.keys(EXTRACTION_INDUSTRY_DATA).length).toBe(6)
  })

  it('logging is renewable', () => {
    expect(EXTRACTION_INDUSTRY_DATA.logging.renewable).toBe(true)
  })

  it('quarry is non-renewable', () => {
    expect(EXTRACTION_INDUSTRY_DATA.quarry.renewable).toBe(false)
  })

  it('quarry costs more to build', () => {
    expect(EXTRACTION_INDUSTRY_DATA.quarry.buildCostGP).toBeGreaterThan(
      EXTRACTION_INDUSTRY_DATA.logging.buildCostGP,
    )
  })
})
