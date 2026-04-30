/**
 * COOKING — Food Culture, Regional Cuisine & Meal Quality
 * =========================================================
 *
 * What people eat defines their culture.
 * Cooking transforms raw ingredients into meals.
 * Good food = morale. Bad food = unrest.
 *
 * Key mechanics:
 *   - Fuel types (wood, charcoal, coal, peat, dung, magic)
 *   - Regional cuisine (cultural background of food)
 *   - Meal quality = ingredients + skill + fuel + facilities
 *   - Hub food tracking → variety bonuses / monotony penalties
 */

// ============================================================
// FUEL TYPES — What burns to cook
// ============================================================

export type CookingFuel = 'wood' | 'charcoal' | 'coal' | 'peat' | 'dung' | 'magic'

export const FUEL_DATA: Record<CookingFuel, {
  /** Heat quality modifier (affects meal quality) */
  heatQuality: number
  /** Cost per unit in GP */
  costPerUnit: number
  /** Units consumed per meal cooked */
  unitsPerMeal: number
  /** Availability — how common in the world */
  availability: 'common' | 'uncommon' | 'rare'
  /** Smoke produced (affects indoor cooking) */
  smoky: boolean
}> = {
  wood:     { heatQuality: 1.0, costPerUnit: 0.01, unitsPerMeal: 2,   availability: 'common',   smoky: true },
  charcoal: { heatQuality: 1.3, costPerUnit: 0.05, unitsPerMeal: 1,   availability: 'uncommon', smoky: false },
  coal:     { heatQuality: 1.4, costPerUnit: 0.1,  unitsPerMeal: 0.5, availability: 'uncommon', smoky: true },
  peat:     { heatQuality: 0.8, costPerUnit: 0.02, unitsPerMeal: 3,   availability: 'common',   smoky: true },
  dung:     { heatQuality: 0.6, costPerUnit: 0.001, unitsPerMeal: 4,  availability: 'common',   smoky: true },
  magic:    { heatQuality: 2.0, costPerUnit: 1.0,  unitsPerMeal: 0.1, availability: 'rare',     smoky: false },
}

// ============================================================
// REGIONAL CUISINE — Cultural food identity
// ============================================================

export type CuisineRegion =
  | 'northern' | 'temperate' | 'southern' | 'coastal'
  | 'mountain' | 'desert' | 'tropical' | 'underground'

export const CUISINE_DATA: Record<CuisineRegion, {
  /** Core staple food */
  staple: string
  /** Common proteins */
  proteins: string[]
  /** Signature flavors */
  flavors: string[]
  /** Cultural bonus when matched */
  culturalBonusToMorale: number
  /** Penalty when eating foreign food exclusively */
  foreignFoodPenalty: number
}> = {
  northern:    { staple: 'rye', proteins: ['fish', 'game', 'dairy'], flavors: ['smoked', 'pickled', 'salted'], culturalBonusToMorale: 1, foreignFoodPenalty: -1 },
  temperate:   { staple: 'wheat', proteins: ['beef', 'pork', 'poultry'], flavors: ['herbed', 'roasted', 'stewed'], culturalBonusToMorale: 1, foreignFoodPenalty: -1 },
  southern:    { staple: 'wheat', proteins: ['lamb', 'goat', 'fish'], flavors: ['olive_oil', 'garlic', 'wine'], culturalBonusToMorale: 2, foreignFoodPenalty: -1 },
  coastal:     { staple: 'rice', proteins: ['fish', 'shellfish', 'seaweed'], flavors: ['briny', 'citrus', 'fermented'], culturalBonusToMorale: 1, foreignFoodPenalty: -2 },
  mountain:    { staple: 'barley', proteins: ['goat', 'game', 'yak'], flavors: ['smoked', 'dried', 'spiced'], culturalBonusToMorale: 1, foreignFoodPenalty: -1 },
  desert:      { staple: 'millet', proteins: ['camel', 'goat', 'dates'], flavors: ['spiced', 'dried', 'honeyed'], culturalBonusToMorale: 2, foreignFoodPenalty: -2 },
  tropical:    { staple: 'rice', proteins: ['fish', 'poultry', 'insects'], flavors: ['coconut', 'fruit', 'chili'], culturalBonusToMorale: 1, foreignFoodPenalty: -1 },
  underground: { staple: 'mushroom', proteins: ['cave_fish', 'beetles', 'lichen'], flavors: ['umami', 'earthy', 'fermented'], culturalBonusToMorale: 1, foreignFoodPenalty: -3 },
}

// ============================================================
// MEAL QUALITY — d20 + skill + fuel + ingredients = quality
// ============================================================

export type MealQuality = 'slop' | 'basic' | 'decent' | 'good' | 'excellent' | 'feast'

export const MEAL_QUALITY_EFFECTS: Record<MealQuality, {
  moraleBonus: number
  healthBonus: number
  costMultiplier: number
}> = {
  slop:      { moraleBonus: -2, healthBonus: -1, costMultiplier: 0.3 },
  basic:     { moraleBonus: 0, healthBonus: 0, costMultiplier: 0.5 },
  decent:    { moraleBonus: 1, healthBonus: 0, costMultiplier: 1.0 },
  good:      { moraleBonus: 2, healthBonus: 1, costMultiplier: 1.5 },
  excellent: { moraleBonus: 3, healthBonus: 1, costMultiplier: 2.5 },
  feast:     { moraleBonus: 5, healthBonus: 2, costMultiplier: 5.0 },
}

export interface MealIngredients {
  /** Food types used (e.g. 'grain', 'meat', 'vegetables', 'spices') */
  foodTypes: string[]
  /** Number of distinct ingredient types */
  ingredientCount: number
  /** Does this include the character's cultural staple? */
  hasCulturalStaple: boolean
  /** Includes spices? */
  hasSpices: boolean
}

export interface CookResult {
  quality: MealQuality
  moraleBonus: number
  healthBonus: number
  fuelConsumed: number
  fuelCost: number
  d20: number
  totalRoll: number
}

/**
 * Cook a meal. Quality = d20 + cookSkill + fuel bonus + ingredient variety.
 * Cultural match and spices add bonuses.
 */
export function cookMeal(
  d20: number,
  cookSkill: number,
  fuel: CookingFuel,
  ingredients: MealIngredients,
  cuisine?: CuisineRegion,
): CookResult {
  const fuelData = FUEL_DATA[fuel]

  // Build total roll
  let total = d20 + cookSkill
  total += Math.floor(fuelData.heatQuality * 2) // fuel quality bonus
  total += Math.min(3, ingredients.ingredientCount - 1) // variety bonus (up to +3)
  if (ingredients.hasSpices) total += 2
  if (ingredients.hasCulturalStaple && cuisine) total += 1

  // Grade
  let quality: MealQuality
  if (d20 === 1) quality = 'slop'
  else if (total <= 5) quality = 'slop'
  else if (total <= 10) quality = 'basic'
  else if (total <= 15) quality = 'decent'
  else if (total <= 20) quality = 'good'
  else if (total <= 25) quality = 'excellent'
  else quality = 'feast'

  if (d20 === 20 && quality !== 'feast') {
    const grades: MealQuality[] = ['slop', 'basic', 'decent', 'good', 'excellent', 'feast']
    const idx = grades.indexOf(quality)
    quality = grades[Math.min(idx + 1, 5)]
  }

  const effects = MEAL_QUALITY_EFFECTS[quality]
  let moraleBonus = effects.moraleBonus
  if (ingredients.hasCulturalStaple && cuisine) {
    moraleBonus += CUISINE_DATA[cuisine].culturalBonusToMorale
  }

  return {
    quality,
    moraleBonus,
    healthBonus: effects.healthBonus,
    fuelConsumed: fuelData.unitsPerMeal,
    fuelCost: fuelData.unitsPerMeal * fuelData.costPerUnit,
    d20,
    totalRoll: total,
  }
}

// ============================================================
// HUB FOOD TRACKER — Per-settlement food culture
// ============================================================

export interface HubFoodState {
  settlementId: string
  /** Available food types this month */
  availableFoods: string[]
  /** Cultural cuisine region */
  cuisine: CuisineRegion
  /** Dominant cooking fuel */
  primaryFuel: CookingFuel
  /** Average meal quality for the settlement */
  averageMealQuality: MealQuality
  /** Food variety score (from agriculture.ts calculateFoodVariety) */
  varietyScore: number
  /** Net morale modifier from food */
  foodMorale: number
  /** Net health modifier from food */
  foodHealth: number
}

/**
 * Calculate total food morale for a settlement.
 * Combines: variety score + meal quality + cultural match.
 */
export function calculateFoodMorale(state: HubFoodState): number {
  const mealEffect = MEAL_QUALITY_EFFECTS[state.averageMealQuality]
  const cuisineData = CUISINE_DATA[state.cuisine]

  // Check if local cuisine staple is available
  const hasStaple = state.availableFoods.includes(cuisineData.staple)
  const culturalBonus = hasStaple ? cuisineData.culturalBonusToMorale : cuisineData.foreignFoodPenalty

  // Variety score → morale (0-10 mapped to -2 to +3)
  const varietyMorale = state.varietyScore >= 7 ? 2
    : state.varietyScore >= 5 ? 1
    : state.varietyScore >= 3 ? 0
    : state.varietyScore >= 1 ? -1
    : -2

  return mealEffect.moraleBonus + culturalBonus + varietyMorale
}
