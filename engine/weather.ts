/**
 * WEATHER ENGINE — Seasonal curves + precipitation + temperature
 * ================================================================
 *
 * Weather is a κ property on .tp nodes at region level, cascading down.
 * EVERYTHING reads it:
 *   - Ecology:     monster behavior, spawning rates
 *   - Husbandry:   yield modifiers, starvation risk, breeding
 *   - Traversal:   speed penalties, discovery chance
 *   - Combat:      environmental effects (visibility, footing)
 *   - Agriculture: crop yields, food production
 *   - Markets:     perishable spoilage, demand shifts
 *
 * TICK INTEGRATION:
 *   Weekly:  weather advances, new conditions applied to κ
 *   Monthly: seasonal shift check
 */

// ============================================================
// SEASONS & CLIMATE
// ============================================================

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Climate = 'arctic' | 'subarctic' | 'temperate' | 'subtropical' | 'tropical' | 'arid' | 'oceanic'

export type Precipitation = 'none' | 'light_rain' | 'rain' | 'heavy_rain' | 'storm' | 'light_snow' | 'snow' | 'blizzard' | 'fog' | 'hail'
export type WindLevel = 'calm' | 'breeze' | 'windy' | 'gale' | 'hurricane'

export interface WeatherState {
  season: Season
  temperature: number       // °F, for D&D flavor
  precipitation: Precipitation
  wind: WindLevel
  visibility: 'clear' | 'hazy' | 'poor' | 'blind'
  /** Composite severity 0 (perfect) to 1 (apocalyptic) */
  severity: number
}

// ============================================================
// CLIMATE BASELINES — What each climate looks like per season
// ============================================================

interface SeasonalBaseline {
  tempRange: [number, number]    // min, max °F
  rainChance: number             // 0-1
  snowChance: number             // 0-1
  stormChance: number            // 0-1
  fogChance: number              // 0-1
}

const CLIMATE_BASELINES: Record<Climate, Record<Season, SeasonalBaseline>> = {
  arctic: {
    spring:  { tempRange: [-10, 25],  rainChance: 0.1, snowChance: 0.5, stormChance: 0.1, fogChance: 0.1 },
    summer:  { tempRange: [20, 50],   rainChance: 0.2, snowChance: 0.1, stormChance: 0.05, fogChance: 0.2 },
    autumn:  { tempRange: [-5, 30],   rainChance: 0.1, snowChance: 0.4, stormChance: 0.1, fogChance: 0.15 },
    winter:  { tempRange: [-40, 0],   rainChance: 0, snowChance: 0.7, stormChance: 0.2, fogChance: 0.05 },
  },
  subarctic: {
    spring:  { tempRange: [10, 40],   rainChance: 0.2, snowChance: 0.3, stormChance: 0.05, fogChance: 0.15 },
    summer:  { tempRange: [40, 65],   rainChance: 0.3, snowChance: 0, stormChance: 0.1, fogChance: 0.15 },
    autumn:  { tempRange: [15, 45],   rainChance: 0.2, snowChance: 0.2, stormChance: 0.1, fogChance: 0.2 },
    winter:  { tempRange: [-20, 15],  rainChance: 0.05, snowChance: 0.6, stormChance: 0.15, fogChance: 0.1 },
  },
  temperate: {
    spring:  { tempRange: [40, 65],   rainChance: 0.3, snowChance: 0.05, stormChance: 0.1, fogChance: 0.15 },
    summer:  { tempRange: [65, 90],   rainChance: 0.15, snowChance: 0, stormChance: 0.15, fogChance: 0.05 },
    autumn:  { tempRange: [40, 65],   rainChance: 0.25, snowChance: 0.05, stormChance: 0.1, fogChance: 0.2 },
    winter:  { tempRange: [15, 40],   rainChance: 0.15, snowChance: 0.3, stormChance: 0.1, fogChance: 0.15 },
  },
  subtropical: {
    spring:  { tempRange: [55, 80],   rainChance: 0.25, snowChance: 0, stormChance: 0.15, fogChance: 0.1 },
    summer:  { tempRange: [75, 100],  rainChance: 0.3, snowChance: 0, stormChance: 0.2, fogChance: 0.05 },
    autumn:  { tempRange: [55, 80],   rainChance: 0.2, snowChance: 0, stormChance: 0.15, fogChance: 0.1 },
    winter:  { tempRange: [35, 60],   rainChance: 0.2, snowChance: 0.05, stormChance: 0.05, fogChance: 0.15 },
  },
  tropical: {
    spring:  { tempRange: [70, 95],   rainChance: 0.3, snowChance: 0, stormChance: 0.15, fogChance: 0.1 },
    summer:  { tempRange: [80, 100],  rainChance: 0.5, snowChance: 0, stormChance: 0.25, fogChance: 0.05 },
    autumn:  { tempRange: [70, 95],   rainChance: 0.4, snowChance: 0, stormChance: 0.2, fogChance: 0.1 },
    winter:  { tempRange: [65, 85],   rainChance: 0.2, snowChance: 0, stormChance: 0.1, fogChance: 0.1 },
  },
  arid: {
    spring:  { tempRange: [55, 90],   rainChance: 0.05, snowChance: 0, stormChance: 0.05, fogChance: 0.02 },
    summer:  { tempRange: [85, 120],  rainChance: 0.02, snowChance: 0, stormChance: 0.05, fogChance: 0 },
    autumn:  { tempRange: [55, 90],   rainChance: 0.05, snowChance: 0, stormChance: 0.05, fogChance: 0.02 },
    winter:  { tempRange: [30, 60],   rainChance: 0.08, snowChance: 0.02, stormChance: 0.02, fogChance: 0.05 },
  },
  oceanic: {
    spring:  { tempRange: [45, 60],   rainChance: 0.4, snowChance: 0.05, stormChance: 0.1, fogChance: 0.25 },
    summer:  { tempRange: [55, 70],   rainChance: 0.3, snowChance: 0, stormChance: 0.1, fogChance: 0.2 },
    autumn:  { tempRange: [45, 60],   rainChance: 0.45, snowChance: 0.05, stormChance: 0.15, fogChance: 0.3 },
    winter:  { tempRange: [30, 50],   rainChance: 0.4, snowChance: 0.15, stormChance: 0.15, fogChance: 0.2 },
  },
}

// ============================================================
// SEASON FROM WORLD DAY
// ============================================================

/** Harptos calendar: 365 days, seasons shift roughly every 91 days */
export function getSeason(worldDay: number): Season {
  const dayOfYear = worldDay % 365
  if (dayOfYear < 91) return 'spring'
  if (dayOfYear < 182) return 'summer'
  if (dayOfYear < 273) return 'autumn'
  return 'winter'
}

export function getMonthOfYear(worldDay: number): number {
  return Math.floor((worldDay % 365) / 30) + 1  // 1-12 (roughly)
}

// ============================================================
// WEATHER GENERATION — d100 roll against baselines
// ============================================================

/**
 * Generate weather for a week at a given climate and day.
 * Uses the d100 roll to determine precipitation, wind, temperature noise.
 */
export function generateWeather(
  climate: Climate,
  worldDay: number,
  d100Roll: number = Math.floor(Math.random() * 100) + 1,
): WeatherState {
  const season = getSeason(worldDay)
  const baseline = CLIMATE_BASELINES[climate][season]

  // Temperature: base range + noise from d100
  const [tMin, tMax] = baseline.tempRange
  const tMid = (tMin + tMax) / 2
  const tSpread = (tMax - tMin) / 2
  const tempNoise = ((d100Roll - 50) / 50) * tSpread * 0.6 // ±60% of spread
  const temperature = Math.round(tMid + tempNoise)

  // Precipitation
  let precipitation: Precipitation = 'none'
  const precipRoll = (d100Roll * 7 + 13) % 100 / 100  // Pseudo-independent from same d100

  if (precipRoll < baseline.stormChance) {
    precipitation = temperature < 32 ? 'blizzard' : 'storm'
  } else if (precipRoll < baseline.stormChance + baseline.snowChance) {
    precipitation = temperature < 32 ? 'snow' : 'heavy_rain'
  } else if (precipRoll < baseline.stormChance + baseline.snowChance + baseline.rainChance) {
    precipitation = temperature < 32 ? 'light_snow' : (precipRoll > 0.5 ? 'rain' : 'light_rain')
  } else if (precipRoll < baseline.stormChance + baseline.snowChance + baseline.rainChance + baseline.fogChance) {
    precipitation = 'fog'
  }

  // Wind
  const windRoll = (d100Roll * 3 + 41) % 100
  let wind: WindLevel
  if (precipitation === 'storm' || precipitation === 'blizzard') {
    wind = windRoll > 50 ? 'hurricane' : 'gale'
  } else if (windRoll > 90) {
    wind = 'gale'
  } else if (windRoll > 65) {
    wind = 'windy'
  } else if (windRoll > 35) {
    wind = 'breeze'
  } else {
    wind = 'calm'
  }

  // Visibility
  let visibility: WeatherState['visibility'] = 'clear'
  const pType = precipitation as Precipitation
  if (pType === 'blizzard' || pType === 'storm') visibility = 'blind'
  else if (pType === 'fog' || pType === 'heavy_rain' || pType === 'snow') visibility = 'poor'
  else if (pType === 'rain' || pType === 'light_snow' || pType === 'hail') visibility = 'hazy'

  // Severity composite: 0 (perfect day) to 1 (apocalyptic)
  const severityFactors = [
    pType === 'none' ? 0 : pType === 'light_rain' || pType === 'light_snow' ? 0.1 :
      pType === 'rain' || pType === 'fog' ? 0.2 :
      pType === 'heavy_rain' || pType === 'snow' || pType === 'hail' ? 0.4 :
      pType === 'storm' ? 0.7 : 0.9,
    wind === 'calm' ? 0 : wind === 'breeze' ? 0.05 : wind === 'windy' ? 0.15 : wind === 'gale' ? 0.4 : 0.8,
    temperature < 0 ? 0.5 : temperature < 20 ? 0.3 : temperature > 100 ? 0.4 : temperature > 90 ? 0.2 : 0,
  ]
  const severity = Math.min(1, severityFactors.reduce((a, b) => a + b, 0) / 2)

  return { season, temperature, precipitation, wind, visibility, severity }
}

// ============================================================
// WEATHER MODIFIERS — What weather does to other systems
// ============================================================

export interface WeatherModifiers {
  /** Husbandry yield multiplier (0.5 blizzard → 1.2 mild spring) */
  yieldMultiplier: number
  /** Traversal speed multiplier (0.3 blizzard → 1.0 clear) */
  travelSpeedMultiplier: number
  /** Discovery chance modifier (-0.3 storm → +0.1 clear) */
  discoveryModifier: number
  /** Monster activity multiplier (0.5 blizzard → 1.5 mild night) */
  monsterActivityMultiplier: number
  /** Combat environmental effects */
  combatEffects: string[]
  /** Spoilage rate multiplier for perishable goods */
  spoilageMultiplier: number
  /** Starvation risk modifier for livestock */
  starvationModifier: number
}

export function calculateWeatherModifiers(weather: WeatherState): WeatherModifiers {
  const { precipitation, wind, temperature, severity } = weather

  // Yield: harsh weather reduces, mild boosts
  let yieldMultiplier = 1.0
  if (severity > 0.7) yieldMultiplier = 0.5
  else if (severity > 0.4) yieldMultiplier = 0.7
  else if (severity > 0.2) yieldMultiplier = 0.9
  else if (temperature >= 50 && temperature <= 80 && precipitation === 'light_rain') yieldMultiplier = 1.2

  // Travel speed
  let travelSpeedMultiplier = 1.0
  if (precipitation === 'blizzard') travelSpeedMultiplier = 0.25
  else if (precipitation === 'storm') travelSpeedMultiplier = 0.4
  else if (precipitation === 'snow' || precipitation === 'heavy_rain') travelSpeedMultiplier = 0.6
  else if (precipitation === 'rain' || precipitation === 'fog') travelSpeedMultiplier = 0.8
  if (wind === 'hurricane') travelSpeedMultiplier *= 0.5
  else if (wind === 'gale') travelSpeedMultiplier *= 0.7

  // Discovery
  let discoveryModifier = 0
  if (weather.visibility === 'blind') discoveryModifier = -0.3
  else if (weather.visibility === 'poor') discoveryModifier = -0.15
  else if (weather.visibility === 'clear' && precipitation === 'none') discoveryModifier = 0.1

  // Monster activity: storms drive them indoors, mild nights bring them out
  let monsterActivityMultiplier = 1.0
  if (severity > 0.6) monsterActivityMultiplier = 0.5   // Even monsters hide
  else if (severity < 0.1) monsterActivityMultiplier = 1.3 // Perfect predator weather

  // Combat effects
  const combatEffects: string[] = []
  if (wind === 'gale' || wind === 'hurricane') combatEffects.push('ranged_disadvantage')
  if (weather.visibility === 'poor' || weather.visibility === 'blind') combatEffects.push('perception_disadvantage')
  if (precipitation === 'rain' || precipitation === 'heavy_rain') combatEffects.push('fire_resistance')
  if (temperature < 20) combatEffects.push('cold_damage_risk')
  if (temperature > 95) combatEffects.push('heat_exhaustion_risk')
  if (precipitation === 'snow' || precipitation === 'light_snow' || precipitation === 'blizzard') combatEffects.push('difficult_terrain')
  if (precipitation === 'fog') combatEffects.push('heavily_obscured')

  // Spoilage
  let spoilageMultiplier = 1.0
  if (temperature > 85) spoilageMultiplier = 1.5
  if (temperature > 95) spoilageMultiplier = 2.0
  if (precipitation === 'rain' || precipitation === 'heavy_rain') spoilageMultiplier *= 1.2

  // Starvation modifier for livestock
  let starvationModifier = 0
  if (temperature < 10) starvationModifier = 0.2   // Cold burns calories
  if (precipitation === 'blizzard') starvationModifier = 0.5  // Can't forage
  if (precipitation === 'snow') starvationModifier = 0.3

  return {
    yieldMultiplier,
    travelSpeedMultiplier,
    discoveryModifier,
    monsterActivityMultiplier,
    combatEffects,
    spoilageMultiplier,
    starvationModifier,
  }
}

// ============================================================
// WEEKLY WEATHER TICK — Writes κ.weather to .tp node
// ============================================================

export interface WeatherTickResult {
  weather: WeatherState
  modifiers: WeatherModifiers
  /** κ properties to write to the .tp node */
  kappaOverrides: Record<string, unknown>
}

/**
 * Weekly weather tick for a region or hub node.
 * Generates new weather, computes modifiers, returns κ overrides.
 */
export function weeklyWeatherTick(
  climate: Climate,
  worldDay: number,
  d100Roll: number = Math.floor(Math.random() * 100) + 1,
): WeatherTickResult {
  const weather = generateWeather(climate, worldDay, d100Roll)
  const modifiers = calculateWeatherModifiers(weather)

  return {
    weather,
    modifiers,
    kappaOverrides: {
      'weather.season': weather.season,
      'weather.temperature': weather.temperature,
      'weather.precipitation': weather.precipitation,
      'weather.wind': weather.wind,
      'weather.visibility': weather.visibility,
      'weather.severity': weather.severity,
      'weather.yield_modifier': modifiers.yieldMultiplier,
      'weather.travel_speed': modifiers.travelSpeedMultiplier,
      'weather.monster_activity': modifiers.monsterActivityMultiplier,
      'weather.combat_effects': modifiers.combatEffects,
      'weather.spoilage_rate': modifiers.spoilageMultiplier,
      'weather.starvation_modifier': modifiers.starvationModifier,
    },
  }
}
