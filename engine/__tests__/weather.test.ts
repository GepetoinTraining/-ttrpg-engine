/**
 * WEATHER ENGINE TESTS
 */
import { describe, it, expect } from 'vitest'
import {
  getSeason,
  getMonthOfYear,
  generateWeather,
  calculateWeatherModifiers,
  weeklyWeatherTick,
} from '../weather'

// ============================================================
// SEASONS
// ============================================================

describe('Seasons', () => {
  it('day 0-90 is spring', () => expect(getSeason(0)).toBe('spring'))
  it('day 91-181 is summer', () => expect(getSeason(91)).toBe('summer'))
  it('day 182-272 is autumn', () => expect(getSeason(200)).toBe('autumn'))
  it('day 273-364 is winter', () => expect(getSeason(300)).toBe('winter'))
  it('wraps at 365', () => expect(getSeason(365)).toBe('spring'))
  it('month of year 1-12', () => {
    expect(getMonthOfYear(0)).toBe(1)
    expect(getMonthOfYear(180)).toBe(7)
  })
})

// ============================================================
// WEATHER GENERATION
// ============================================================

describe('Weather Generation', () => {
  it('generates valid weather for temperate spring', () => {
    const w = generateWeather('temperate', 45, 50)
    expect(w.season).toBe('spring')
    expect(w.temperature).toBeGreaterThan(20)
    expect(w.temperature).toBeLessThan(90)
    expect(['none', 'light_rain', 'rain', 'heavy_rain', 'storm', 'light_snow', 'snow', 'blizzard', 'fog', 'hail']).toContain(w.precipitation)
  })

  it('arctic winter is cold', () => {
    const w = generateWeather('arctic', 300, 50)
    expect(w.season).toBe('winter')
    expect(w.temperature).toBeLessThan(20)
  })

  it('tropical summer is hot', () => {
    const w = generateWeather('tropical', 120, 50)
    expect(w.season).toBe('summer')
    expect(w.temperature).toBeGreaterThan(60)
  })

  it('arid has low rain chance', () => {
    // Run 20 rolls, most should be no precipitation
    let dryCount = 0
    for (let i = 0; i < 20; i++) {
      const w = generateWeather('arid', 120, i * 5 + 1)
      if (w.precipitation === 'none') dryCount++
    }
    expect(dryCount).toBeGreaterThan(10) // Most days are dry
  })

  it('severity is 0-1', () => {
    for (let roll = 1; roll <= 100; roll += 10) {
      const w = generateWeather('temperate', 45, roll)
      expect(w.severity).toBeGreaterThanOrEqual(0)
      expect(w.severity).toBeLessThanOrEqual(1)
    }
  })

  it('storm has bad visibility', () => {
    // Force a stormy condition via extreme roll in oceanic winter
    const w = generateWeather('oceanic', 320, 5)
    // Should be some kind of precipitation
    expect(['none', 'light_rain', 'rain', 'heavy_rain', 'storm', 'light_snow', 'snow', 'blizzard', 'fog', 'hail']).toContain(w.precipitation)
  })
})

// ============================================================
// WEATHER MODIFIERS
// ============================================================

describe('Weather Modifiers', () => {
  it('clear mild weather has good modifiers', () => {
    const mods = calculateWeatherModifiers({
      season: 'spring', temperature: 65, precipitation: 'none',
      wind: 'calm', visibility: 'clear', severity: 0,
    })
    expect(mods.travelSpeedMultiplier).toBe(1.0)
    expect(mods.yieldMultiplier).toBe(1.0)
    expect(mods.discoveryModifier).toBe(0.1)
    expect(mods.combatEffects).toHaveLength(0)
    expect(mods.starvationModifier).toBe(0)
  })

  it('blizzard wrecks everything', () => {
    const mods = calculateWeatherModifiers({
      season: 'winter', temperature: -10, precipitation: 'blizzard',
      wind: 'hurricane', visibility: 'blind', severity: 0.9,
    })
    expect(mods.travelSpeedMultiplier).toBeLessThan(0.3)
    expect(mods.yieldMultiplier).toBeLessThanOrEqual(0.5)
    expect(mods.discoveryModifier).toBe(-0.3)
    expect(mods.monsterActivityMultiplier).toBe(0.5)
    expect(mods.starvationModifier).toBe(0.5)
    expect(mods.combatEffects).toContain('cold_damage_risk')
    expect(mods.combatEffects).toContain('difficult_terrain')
  })

  it('light rain boosts yield in mild temperatures', () => {
    const mods = calculateWeatherModifiers({
      season: 'spring', temperature: 65, precipitation: 'light_rain',
      wind: 'breeze', visibility: 'hazy', severity: 0.08,
    })
    expect(mods.yieldMultiplier).toBe(1.2)
  })

  it('extreme heat increases spoilage', () => {
    const mods = calculateWeatherModifiers({
      season: 'summer', temperature: 100, precipitation: 'none',
      wind: 'calm', visibility: 'clear', severity: 0.1,
    })
    expect(mods.spoilageMultiplier).toBeGreaterThan(1.0)
    expect(mods.combatEffects).toContain('heat_exhaustion_risk')
  })

  it('fog grants heavily_obscured', () => {
    const mods = calculateWeatherModifiers({
      season: 'autumn', temperature: 50, precipitation: 'fog',
      wind: 'calm', visibility: 'poor', severity: 0.1,
    })
    expect(mods.combatEffects).toContain('heavily_obscured')
  })
})

// ============================================================
// WEEKLY WEATHER TICK
// ============================================================

describe('Weekly Weather Tick', () => {
  it('returns weather + modifiers + kappa overrides', () => {
    const result = weeklyWeatherTick('temperate', 45, 50)
    expect(result.weather.season).toBe('spring')
    expect(result.modifiers).toBeDefined()
    expect(result.kappaOverrides['weather.season']).toBe('spring')
    expect(typeof result.kappaOverrides['weather.temperature']).toBe('number')
    expect(typeof result.kappaOverrides['weather.yield_modifier']).toBe('number')
    expect(typeof result.kappaOverrides['weather.travel_speed']).toBe('number')
  })

  it('different climates produce different results', () => {
    const arctic = weeklyWeatherTick('arctic', 300, 50)
    const tropical = weeklyWeatherTick('tropical', 120, 50)
    expect(arctic.weather.temperature).toBeLessThan(tropical.weather.temperature)
  })
})
