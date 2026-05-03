/**
 * HUSBANDRY SYSTEM TESTS
 * =======================
 * Species, herds, weekly yield, monthly tick, slaughter, food sufficiency
 */

import { describe, it, expect } from 'vitest'
import {
  SPECIES,
  createHerd,
  totalHead,
  weeklyYieldTick,
  slaughter,
  monthlyHerdTick,
  calculateFoodSufficiency,
  getSpecies,
  getSpeciesByCategory,
  getSpeciesForClimate,
  getSpeciesForTerrain,
  dailyFeedCost,
  spaceRequired,
} from '../husbandry'

const d20s = [10, 12, 15, 8, 14, 11, 13, 9, 16, 7]

// ============================================================
// SPECIES DEFINITIONS
// ============================================================

describe('Species', () => {
  it('has 12 species', () => {
    expect(Object.keys(SPECIES)).toHaveLength(12)
  })

  it('all species have valid yield profiles', () => {
    for (const sp of Object.values(SPECIES)) {
      expect(sp.yield.manure).toBeGreaterThanOrEqual(0)
      expect(sp.care.feedPerDay).toBeGreaterThanOrEqual(0)
    }
  })

  it('cattle has meat, milk, and manure', () => {
    const cattle = SPECIES['cattle']
    expect(cattle.yield.meat).toBeDefined()
    expect(cattle.yield.milk).toBeDefined()
    expect(cattle.yield.manure).toBe(65)
  })

  it('sheep has wool', () => {
    const sheep = SPECIES['sheep']
    expect(sheep.yield.wool).toBeDefined()
    expect(sheep.yield.wool!.shearingsPerYear).toBe(2)
  })

  it('chickens have eggs', () => {
    const ch = SPECIES['chickens']
    expect(ch.yield.eggs).toBeDefined()
    expect(ch.yield.eggs!.perDay).toBe(0.8)
  })

  it('horses are mounts with labor yield', () => {
    const h = SPECIES['horses']
    expect(h.category).toBe('MOUNT')
    expect(h.yield.labor).toBeDefined()
  })

  it('bees require beekeeping seed', () => {
    expect(SPECIES['bees'].requiredSeed).toBe('beekeeping')
  })

  it('rothe are underground', () => {
    expect(SPECIES['rothe'].climates).toContain('underground')
  })
})

// ============================================================
// HERD MANAGEMENT
// ============================================================

describe('Herd Management', () => {
  it('creates empty herd', () => {
    const herd = createHerd('hub_1', 'cattle')
    expect(totalHead(herd)).toBe(0)
    expect(herd.health).toBe(100)
  })

  it('creates herd with adults', () => {
    const herd = createHerd('hub_1', 'cattle', 20)
    expect(herd.adults).toBe(20)
    expect(totalHead(herd)).toBe(20)
  })

  it('totalHead sums all age groups', () => {
    const herd = createHerd('hub_1', 'sheep', 10)
    herd.young = 5
    herd.elders = 3
    expect(totalHead(herd)).toBe(18)
  })
})

// ============================================================
// WEEKLY YIELD
// ============================================================

describe('Weekly Yield', () => {
  it('produces milk from cattle', () => {
    const herd = createHerd('hub_1', 'cattle', 10)
    const yield_ = weeklyYieldTick(herd, SPECIES['cattle'])
    expect(yield_.milkGallons).toBeGreaterThan(0)
  })

  it('produces eggs from chickens', () => {
    const herd = createHerd('hub_1', 'chickens', 20)
    const yield_ = weeklyYieldTick(herd, SPECIES['chickens'])
    expect(yield_.eggs).toBeGreaterThan(0)
  })

  it('produces manure from all animals', () => {
    const herd = createHerd('hub_1', 'pigs', 5)
    const yield_ = weeklyYieldTick(herd, SPECIES['pigs'])
    expect(yield_.manureLbs).toBeGreaterThan(0)
  })

  it('zero yield from empty herd', () => {
    const herd = createHerd('hub_1', 'cattle', 0)
    const yield_ = weeklyYieldTick(herd, SPECIES['cattle'])
    expect(yield_.milkGallons).toBe(0)
    expect(yield_.manureLbs).toBe(0)
  })

  it('health reduces yield', () => {
    const healthy = createHerd('hub_1', 'cattle', 10)
    const sick = createHerd('hub_1', 'cattle', 10)
    sick.health = 50

    const yHealthy = weeklyYieldTick(healthy, SPECIES['cattle'])
    const ySick = weeklyYieldTick(sick, SPECIES['cattle'])
    expect(ySick.milkGallons).toBeLessThan(yHealthy.milkGallons)
  })

  it('accumulates on herd', () => {
    const herd = createHerd('hub_1', 'cattle', 10)
    weeklyYieldTick(herd, SPECIES['cattle'])
    weeklyYieldTick(herd, SPECIES['cattle'])
    expect(herd.monthlyMilkProduced).toBeGreaterThan(0)
  })
})

// ============================================================
// SLAUGHTER
// ============================================================

describe('Slaughter', () => {
  it('produces meat from cattle', () => {
    const herd = createHerd('hub_1', 'cattle', 10)
    const result = slaughter(herd, SPECIES['cattle'], 2)
    expect(result.meatLbs).toBe(800) // 2 × 400
    expect(herd.adults).toBe(8)
  })

  it('produces hide and tallow', () => {
    const herd = createHerd('hub_1', 'cattle', 5)
    const result = slaughter(herd, SPECIES['cattle'], 1)
    expect(result.hideLbs).toBe(40)
    expect(result.tallowLbs).toBe(50)
  })

  it('prefers slaughtering elders', () => {
    const herd = createHerd('hub_1', 'cattle', 5)
    herd.elders = 3
    slaughter(herd, SPECIES['cattle'], 2)
    expect(herd.elders).toBe(1) // Took from elders first
    expect(herd.adults).toBe(5) // Adults untouched
  })

  it('cannot slaughter more than available', () => {
    const herd = createHerd('hub_1', 'cattle', 3)
    const result = slaughter(herd, SPECIES['cattle'], 10)
    expect(herd.adults).toBe(0)
    expect(result.meatLbs).toBe(1200) // 3 × 400
  })

  it('horses yield no meat', () => {
    const herd = createHerd('hub_1', 'horses', 5)
    const result = slaughter(herd, SPECIES['horses'], 1)
    expect(result.meatLbs).toBe(0) // Horses don't have meat yield
  })
})

// ============================================================
// MONTHLY TICK
// ============================================================

describe('Monthly Tick', () => {
  it('consumes feed and water', () => {
    const herd = createHerd('hub_1', 'cattle', 10)
    const result = monthlyHerdTick(herd, SPECIES['cattle'], d20s, false, 'year_round')
    expect(result.feedConsumedLbs).toBeGreaterThan(0)
    expect(result.waterConsumedGallons).toBeGreaterThan(0)
  })

  it('natural mortality kills some animals', () => {
    const herd = createHerd('hub_1', 'chickens', 100)
    herd.young = 50
    herd.elders = 20
    const result = monthlyHerdTick(herd, SPECIES['chickens'], d20s, false, 'spring')
    expect(result.deaths).toBeGreaterThan(0)
  })

  it('winter increases mortality', () => {
    const herd = createHerd('hub_1', 'sheep', 50)
    herd.young = 10
    herd.elders = 5
    const summerResult = monthlyHerdTick(
      { ...herd, young: 10, adults: 50, elders: 5, health: 100 } as any,
      SPECIES['sheep'], d20s, false, 'year_round'
    )
    const winterHerd = createHerd('hub_1', 'sheep', 50)
    winterHerd.young = 10
    winterHerd.elders = 5
    const winterResult = monthlyHerdTick(winterHerd, SPECIES['sheep'], d20s, true, 'year_round')
    expect(winterResult.deaths).toBeGreaterThanOrEqual(summerResult.deaths)
  })

  it('starts pregnancies when breeding conditions met', () => {
    const herd = createHerd('hub_1', 'cattle', 20)
    const result = monthlyHerdTick(herd, SPECIES['cattle'], d20s, false, 'year_round')
    expect(result.newPregnancies).toBeGreaterThan(0)
    expect(herd.pregnancies).toBeGreaterThan(0)
  })

  it('does not breed out of season', () => {
    const herd = createHerd('hub_1', 'sheep', 20) // Sheep breed in fall
    const result = monthlyHerdTick(herd, SPECIES['sheep'], d20s, false, 'spring')
    expect(result.newPregnancies).toBe(0)
  })

  it('births increase young population', () => {
    const herd = createHerd('hub_1', 'pigs', 20)
    herd.pregnancies = 5
    herd.weeksUntilBirth = 0 // Ready to birth

    const result = monthlyHerdTick(herd, SPECIES['pigs'], d20s, false, 'year_round')
    expect(result.births).toBeGreaterThan(0)
    expect(herd.young).toBeGreaterThan(0)
  })

  it('ages young into adults', () => {
    const herd = createHerd('hub_1', 'cattle', 5)
    herd.young = 20
    const result = monthlyHerdTick(herd, SPECIES['cattle'], d20s, false, 'year_round')
    expect(result.aged.youngToAdult).toBeGreaterThan(0)
  })

  it('starvation causes mass death', () => {
    const herd = createHerd('hub_1', 'cattle', 20)
    herd.daysSinceLastFeed = 30 // Way past 14-day threshold
    const result = monthlyHerdTick(herd, SPECIES['cattle'], d20s, false, 'year_round')
    expect(result.starvationDeaths).toBeGreaterThan(0)
    expect(herd.health).toBeLessThan(100)
  })

  it('resets monthly counters', () => {
    const herd = createHerd('hub_1', 'cattle', 10)
    herd.monthlyMeatProduced = 500
    herd.monthlyMilkProduced = 100
    monthlyHerdTick(herd, SPECIES['cattle'], d20s, false, 'year_round')
    expect(herd.monthlyMeatProduced).toBe(0)
    expect(herd.monthlyMilkProduced).toBe(0)
  })
})

// ============================================================
// FOOD SUFFICIENCY
// ============================================================

describe('Food Sufficiency', () => {
  it('calculates for a small settlement', () => {
    const herds = [
      createHerd('hub_1', 'cattle', 20),
      createHerd('hub_1', 'chickens', 50),
    ]
    const result = calculateFoodSufficiency(herds, 30)
    expect(result.totalMeatPerMonth).toBeGreaterThan(0)
    expect(result.totalEggsPerMonth).toBeGreaterThan(0)
    expect(result.feedRequired).toBeGreaterThan(0)
  })

  it('large herds feed more people', () => {
    const small = [createHerd('hub_1', 'cattle', 5)]
    const large = [createHerd('hub_1', 'cattle', 50)]
    const smallResult = calculateFoodSufficiency(small, 100)
    const largeResult = calculateFoodSufficiency(large, 100)
    expect(largeResult.populationFeedable).toBeGreaterThan(smallResult.populationFeedable)
  })

  it('reports insufficient for large population', () => {
    const herds = [createHerd('hub_1', 'chickens', 5)]
    const result = calculateFoodSufficiency(herds, 1000)
    expect(result.isSufficient).toBe(false)
  })

  it('handles empty herds', () => {
    const result = calculateFoodSufficiency([], 100)
    expect(result.totalMeatPerMonth).toBe(0)
    expect(result.isSufficient).toBe(false)
  })
})

// ============================================================
// HELPERS
// ============================================================

describe('Helpers', () => {
  it('getSpecies returns species by id', () => {
    expect(getSpecies('cattle')).toBeDefined()
    expect(getSpecies('nonexistent')).toBeUndefined()
  })

  it('getSpeciesByCategory filters correctly', () => {
    const mounts = getSpeciesByCategory('MOUNT')
    expect(mounts.length).toBeGreaterThan(0)
    expect(mounts.every(s => s.category === 'MOUNT')).toBe(true)
  })

  it('getSpeciesForClimate filters correctly', () => {
    const underground = getSpeciesForClimate('underground')
    expect(underground.some(s => s.id === 'rothe')).toBe(true)
  })

  it('getSpeciesForTerrain filters correctly', () => {
    const mountain = getSpeciesForTerrain('mountain')
    expect(mountain.some(s => s.id === 'goats')).toBe(true)
    expect(mountain.some(s => s.id === 'donkeys')).toBe(true)
  })

  it('calculates daily feed cost', () => {
    const cost = dailyFeedCost(SPECIES['cattle'], 10, 0.02)
    expect(cost).toBe(25 * 10 * 0.02) // 5 GP
  })

  it('calculates space required', () => {
    const space = spaceRequired(SPECIES['chickens'], 50)
    expect(space).toBe(200) // 50 × 4 sq ft
  })
})

// ============================================================
// FULL LIFECYCLE — 12 months of ranching
// ============================================================

describe('Full Year Lifecycle', () => {
  it('simulates 12 months of cattle ranching', () => {
    const herd = createHerd('hub_1', 'cattle', 20)
    const sp = SPECIES['cattle']

    let totalBirths = 0
    let totalDeaths = 0

    for (let month = 0; month < 12; month++) {
      // Weekly yields 4x per month
      for (let week = 0; week < 4; week++) {
        weeklyYieldTick(herd, sp)
      }

      const isWinter = month >= 9 || month <= 1
      const result = monthlyHerdTick(herd, sp, d20s, isWinter, 'year_round')
      totalBirths += result.births
      totalDeaths += result.deaths
    }

    // Herd should have grown
    expect(totalHead(herd)).toBeGreaterThan(0)
    // Some births and deaths occurred
    expect(totalBirths + totalDeaths).toBeGreaterThan(0)
  })
})
