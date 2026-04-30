/**
 * COOKING ENGINE TESTS
 * =====================
 * Fuel types, regional cuisine, meal quality, food morale
 */

import { describe, it, expect } from 'vitest'
import {
  FUEL_DATA, CUISINE_DATA, MEAL_QUALITY_EFFECTS,
  cookMeal, calculateFoodMorale,
  type CookingFuel, type CuisineRegion, type HubFoodState,
} from '../cooking.js'

// ============================================================
// FUEL TYPES
// ============================================================

describe('Fuel Types', () => {
  it('has 6 fuel types', () => {
    expect(Object.keys(FUEL_DATA).length).toBe(6)
  })

  it('magic has best heat quality', () => {
    const maxHeat = Math.max(...Object.values(FUEL_DATA).map(f => f.heatQuality))
    expect(FUEL_DATA.magic.heatQuality).toBe(maxHeat)
  })

  it('dung is cheapest', () => {
    const minCost = Math.min(...Object.values(FUEL_DATA).map(f => f.costPerUnit))
    expect(FUEL_DATA.dung.costPerUnit).toBe(minCost)
  })

  it('charcoal is smoke-free', () => {
    expect(FUEL_DATA.charcoal.smoky).toBe(false)
    expect(FUEL_DATA.wood.smoky).toBe(true)
  })
})

// ============================================================
// REGIONAL CUISINE
// ============================================================

describe('Regional Cuisine', () => {
  it('has 8 cuisine regions', () => {
    expect(Object.keys(CUISINE_DATA).length).toBe(8)
  })

  it('temperate staple is wheat', () => {
    expect(CUISINE_DATA.temperate.staple).toBe('wheat')
  })

  it('underground has unique proteins', () => {
    expect(CUISINE_DATA.underground.proteins).toContain('cave_fish')
  })

  it('underground has worst foreign food penalty', () => {
    const worst = Math.min(...Object.values(CUISINE_DATA).map(c => c.foreignFoodPenalty))
    expect(CUISINE_DATA.underground.foreignFoodPenalty).toBe(worst)
  })
})

// ============================================================
// MEAL COOKING
// ============================================================

describe('Cooking Meals', () => {
  const basicIngredients = { foodTypes: ['grain', 'meat'], ingredientCount: 2, hasCulturalStaple: false, hasSpices: false }
  const richIngredients = { foodTypes: ['grain', 'meat', 'vegetables', 'spices'], ingredientCount: 4, hasCulturalStaple: true, hasSpices: true }

  it('high roll + high skill = excellent or feast', () => {
    const result = cookMeal(18, 5, 'charcoal', richIngredients, 'temperate')
    expect(['excellent', 'feast']).toContain(result.quality)
    expect(result.moraleBonus).toBeGreaterThan(0)
  })

  it('nat 1 = slop', () => {
    const result = cookMeal(1, 10, 'magic', richIngredients, 'temperate')
    expect(result.quality).toBe('slop')
  })

  it('nat 20 bumps quality up one tier', () => {
    const result = cookMeal(20, 0, 'wood', basicIngredients)
    expect(result.quality).not.toBe('slop')
  })

  it('better fuel improves quality', () => {
    const wood = cookMeal(10, 3, 'wood', basicIngredients)
    const magic = cookMeal(10, 3, 'magic', basicIngredients)
    expect(magic.totalRoll).toBeGreaterThan(wood.totalRoll)
  })

  it('spices add +2 to roll', () => {
    const noSpice = cookMeal(10, 3, 'wood', basicIngredients)
    const spiced = cookMeal(10, 3, 'wood', { ...basicIngredients, hasSpices: true })
    expect(spiced.totalRoll).toBe(noSpice.totalRoll + 2)
  })

  it('cultural staple adds morale bonus', () => {
    const noStaple = cookMeal(15, 3, 'wood', { ...richIngredients, hasCulturalStaple: false })
    const withStaple = cookMeal(15, 3, 'wood', richIngredients, 'temperate')
    expect(withStaple.moraleBonus).toBeGreaterThanOrEqual(noStaple.moraleBonus)
  })

  it('tracks fuel consumed and cost', () => {
    const result = cookMeal(10, 3, 'charcoal', basicIngredients)
    expect(result.fuelConsumed).toBe(FUEL_DATA.charcoal.unitsPerMeal)
    expect(result.fuelCost).toBe(result.fuelConsumed * FUEL_DATA.charcoal.costPerUnit)
  })
})

// ============================================================
// MEAL QUALITY EFFECTS
// ============================================================

describe('Meal Quality Effects', () => {
  it('has 6 quality tiers', () => {
    expect(Object.keys(MEAL_QUALITY_EFFECTS).length).toBe(6)
  })

  it('feast has highest morale', () => {
    expect(MEAL_QUALITY_EFFECTS.feast.moraleBonus).toBe(5)
  })

  it('slop has negative morale', () => {
    expect(MEAL_QUALITY_EFFECTS.slop.moraleBonus).toBeLessThan(0)
  })
})

// ============================================================
// HUB FOOD MORALE
// ============================================================

describe('Hub Food Morale', () => {
  it('diverse food + cultural match = high morale', () => {
    const state: HubFoodState = {
      settlementId: 's1',
      availableFoods: ['wheat', 'meat', 'fish', 'vegetables', 'fruit', 'dairy', 'spices'],
      cuisine: 'temperate',
      primaryFuel: 'wood',
      averageMealQuality: 'good',
      varietyScore: 7,
      foodMorale: 0,
      foodHealth: 0,
    }
    const morale = calculateFoodMorale(state)
    expect(morale).toBeGreaterThan(3) // meal(2) + cultural(1) + variety(2) = 5
  })

  it('monotonous without staple = negative morale', () => {
    const state: HubFoodState = {
      settlementId: 's1',
      availableFoods: ['turnip'],
      cuisine: 'temperate', // needs wheat
      primaryFuel: 'dung',
      averageMealQuality: 'basic',
      varietyScore: 1,
      foodMorale: 0,
      foodHealth: 0,
    }
    const morale = calculateFoodMorale(state)
    expect(morale).toBeLessThan(0)
  })
})
