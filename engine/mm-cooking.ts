/**
 * MM_COOKING — Layer 6 ISimulatedMM adapter for cooking.ts
 * ===========================================================
 *
 * One MMCooking per settlement. Lives at the settlement node. Ticks
 * monthly. Each resolve:
 *
 *   1. Reads κ.economy.commodities at this node (populated by
 *      mm-agriculture / mm-husbandry / mm-extraction).
 *   2. Filters to food commodities (grain/meat/fish/bread/ale/herbs/salt).
 *   3. Cooks a representative meal via cookMeal(d20, skill, fuel, ingredients,
 *      cuisine) — computes quality, morale bonus, health bonus.
 *   4. Updates HubFoodState and writes κ.culture.food = { variety, morale }
 *      at the node.
 *
 * Slow-life: a player who claims a kitchen / inn / bakery building
 * eventually runs their own cookMeal routine. v1 just models the
 * settlement-level aggregate; player cooking comes when forge/inspect
 * are added in v2.
 *
 * Cadence: monthly. Layer: 6 (HUB SERVICES — reads economy κ from L4/L5).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  cookMeal,
  calculateFoodMorale,
  CUISINE_DATA,
  type CookingFuel,
  type CuisineRegion,
  type CookResult,
  type HubFoodState,
  type MealQuality,
  type MealIngredients,
} from './cooking'
import type { TP } from './tp'

/** Commodity ids that count as food for cooking purposes. */
const FOOD_COMMODITIES = new Set([
  'grain', 'meat', 'fish', 'water', 'bread', 'ale', 'wine',
  'herbs', 'salt', 'spices',
])

export interface MMCookingDomainState {
  state: HubFoodState
  /** Last representative meal cooked. */
  lastMeal: CookResult | null
  /** Months resolved (for narrative continuity). */
  monthsCooked: number
}

export interface MMCookingOptions {
  /** Cooking skill bonus for the settlement (default 5 = competent). */
  cookSkill?: number
  /** Override d20 source (default deterministic from worldDay). */
  getD20?: (worldDay: number) => number
  name?: string
}

export class MMCooking extends SimulatedMMBase {
  domain: MMCookingDomainState
  private cookSkill: number
  private getD20: (worldDay: number) => number

  constructor(
    nodeId: string,
    settlementId: string,
    cuisine: CuisineRegion,
    primaryFuel: CookingFuel,
    worldDay: number = 0,
    opts: MMCookingOptions = {},
  ) {
    super(`cooking:${nodeId}`, opts.name ?? `Kitchen:${nodeId}`, nodeId, 'cooking', worldDay)
    this.domain = {
      state: {
        settlementId,
        availableFoods: [],
        cuisine,
        primaryFuel,
        averageMealQuality: 'basic' as MealQuality,
        varietyScore: 0,
        foodMorale: 0,
        foodHealth: 0,
      },
      lastMeal: null,
      monthsCooked: 0,
    }
    this.cookSkill = opts.cookSkill ?? 5
    this.getD20 = opts.getD20 ?? ((day) => ((day * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Hub food culture only resolves on observation / monthly tick.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    // 1. Read available foods from κ.economy.commodities at this node.
    const ctx = tp?.resolve(this.state.nodeId)
    const commodities = (ctx?.economy?.commodities ?? {}) as Record<
      string,
      { supply?: number }
    >
    const availableFoods = Object.keys(commodities)
      .filter(id => FOOD_COMMODITIES.has(id))
      .filter(id => (commodities[id].supply ?? 0) > 0)

    // 2. Variety score: distinct food types, capped at 10.
    const varietyScore = Math.min(10, availableFoods.length)

    // 3. Cook a representative meal using whatever's available.
    const cuisineData = CUISINE_DATA[this.domain.state.cuisine]
    const hasCulturalStaple = availableFoods.includes(cuisineData.staple)
    const hasSpices = availableFoods.includes('spices')

    const ingredients: MealIngredients = {
      foodTypes: availableFoods.slice(0, 6),
      ingredientCount: Math.max(1, Math.min(availableFoods.length, 6)),
      hasCulturalStaple,
      hasSpices,
    }

    const d20 = this.getD20(worldDay)
    const meal = cookMeal(
      d20,
      this.cookSkill,
      this.domain.state.primaryFuel,
      ingredients,
      this.domain.state.cuisine,
    )
    this.domain.lastMeal = meal
    this.domain.monthsCooked++

    // 4. Update HubFoodState; calculate aggregate morale.
    this.domain.state.availableFoods = availableFoods
    this.domain.state.averageMealQuality = meal.quality
    this.domain.state.varietyScore = varietyScore
    this.domain.state.foodHealth = meal.healthBonus
    this.domain.state.foodMorale = calculateFoodMorale(this.domain.state)

    // 5. Write κ.culture.food at this node.
    if (tp) {
      tp.writeDomain(this.state.nodeId, 'culture', {
        food: {
          variety: varietyScore,
          morale: this.domain.state.foodMorale,
        },
      })
    }

    const narrative =
      `${this.state.name} (${daysResolved}d): ${meal.quality} meals, ` +
      `variety ${varietyScore}/10, morale ${this.domain.state.foodMorale >= 0 ? '+' : ''}${this.domain.state.foodMorale}` +
      (availableFoods.length === 0 ? ' — no food available!' : '') +
      '.'

    return {
      stateChanges: {
        varietyScore,
        moraleBonus: meal.moraleBonus,
        foodMorale: this.domain.state.foodMorale,
        availableFoodCount: availableFoods.length,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMCookingDomainState {
    return {
      state: { ...this.domain.state, availableFoods: [...this.domain.state.availableFoods] },
      lastMeal: this.domain.lastMeal ? { ...this.domain.lastMeal } : null,
      monthsCooked: this.domain.monthsCooked,
    }
  }

  /** Convenience: peek the state. */
  getState(): HubFoodState {
    return { ...this.domain.state, availableFoods: [...this.domain.state.availableFoods] }
  }
}
