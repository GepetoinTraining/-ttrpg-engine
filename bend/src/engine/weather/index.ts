// ============================================
// DETERMINISTIC WEATHER SYSTEM
// ============================================
//
// AXIOMS (INVARIANT):
// 1. Weather is a PURE FUNCTION: Weather(cell_id, world_time) → WeatherSample
// 2. TIME IS A DIMENSION, NOT A LOOP VARIABLE
// 3. SPACE IS HIERARCHICAL: region → hub → chunk
// 4. DETERMINISM VIA SEEDED FIELDS, NOT RNG
// 5. VOLATILITY IS BOUNDED BY CONSTRUCTION
//
// This is a TOY SYSTEM under strict constraints.
// No physics simulation. No state accumulation.
// All evolution emerges from sampling.
//

import { z } from 'zod';
import type { WorldTimestamp } from '../timeline/substrate';

// ============================================
// CONSTANTS
// ============================================

/** Temporal granularity: weather samples at slot resolution (5 minutes) */
export const TEMPORAL_GRANULARITY = 1; // 1 slot = 1 t_norm unit

/** Slots per day for seasonal calculation */
export const SLOTS_PER_DAY = 288;

/** Days per year for seasonal amplitude */
export const DAYS_PER_YEAR = 365;

// ============================================
// OUTPUT SCHEMA (FIXED)
// ============================================

export const TemperatureBandSchema = z.enum([
  'freezing',    // < 0°C / 32°F
  'cold',        // 0-10°C / 32-50°F
  'cool',        // 10-15°C / 50-59°F
  'mild',        // 15-20°C / 59-68°F
  'warm',        // 20-25°C / 68-77°F
  'hot',         // 25-35°C / 77-95°F
  'scorching',   // > 35°C / 95°F
]);
export type TemperatureBand = z.infer<typeof TemperatureBandSchema>;

export const WindDirectionSchema = z.enum([
  'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'calm',
]);
export type WindDirection = z.infer<typeof WindDirectionSchema>;

export const WeatherSampleSchema = z.object({
  temperatureBand: TemperatureBandSchema,
  precipitationIntensity: z.number().min(0).max(1),
  windStrength: z.number().min(0).max(1),
  windDirection: WindDirectionSchema,
  visibilityModifier: z.number().min(0).max(1), // 1 = clear, 0 = zero visibility
});
export type WeatherSample = z.infer<typeof WeatherSampleSchema>;

// ============================================
// CLIMATE PARAMETERS (REGION-SCALE)
// ============================================

export const ClimateTypeSchema = z.enum([
  'arctic',
  'subarctic',
  'temperate',
  'subtropical',
  'tropical',
  'desert',
  'mediterranean',
  'oceanic',
  'continental',
  'highland',
]);
export type ClimateType = z.infer<typeof ClimateTypeSchema>;

export interface RegionClimateParams {
  baseTemperature: number;      // -1 to 1, maps to temperature bands
  humidityBaseline: number;     // 0 to 1
  prevailingWindAngle: number;  // 0 to 2π radians (N=0, E=π/2, S=π, W=3π/2)
  seasonalAmplitude: number;    // 0 to 1, how much seasons affect temperature
  stormFrequency: number;       // 0 to 1, probability density of storms
}

// ============================================
// HUB MODIFIERS
// ============================================

export interface HubModifiers {
  altitudeAdjustment: number;   // -0.3 to 0.3, affects temperature
  coastalInfluence: number;     // 0 to 1, moderates extremes, adds humidity
  urbanBias: number;            // 0 to 0.2, heat island effect
  magicalBias: number;          // -0.2 to 0.2, magical interference
}

// ============================================
// NOISE FUNCTIONS (SEEDED, DETERMINISTIC)
// ============================================

/**
 * FNV-1a hash for seed derivation.
 * INVARIANT: Pure function, no state.
 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Mulberry32 PRNG - single value from seed.
 * INVARIANT: Pure function, same seed → same output.
 */
function mulberry32(seed: number): number {
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Smooth noise function using cosine interpolation.
 * INVARIANT: Continuous in both space and time.
 */
function smoothNoise(seed: number, t: number): number {
  const t0 = Math.floor(t);
  const t1 = t0 + 1;
  const frac = t - t0;

  // Cosine interpolation for smoothness
  const blend = (1 - Math.cos(frac * Math.PI)) / 2;

  const v0 = mulberry32(seed + t0 * 1337);
  const v1 = mulberry32(seed + t1 * 1337);

  return v0 * (1 - blend) + v1 * blend;
}

/**
 * Multi-octave fractal noise for richer variation.
 * INVARIANT: Bounded output [0, 1].
 */
function fractalNoise(seed: number, t: number, octaves: number = 3): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(seed + i * 7919, t * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

// ============================================
// CLIMATE LOOKUP TABLE
// ============================================

const CLIMATE_PARAMS: Record<ClimateType, RegionClimateParams> = {
  arctic: {
    baseTemperature: -0.8,
    humidityBaseline: 0.3,
    prevailingWindAngle: Math.PI,  // South winds
    seasonalAmplitude: 0.4,
    stormFrequency: 0.3,
  },
  subarctic: {
    baseTemperature: -0.5,
    humidityBaseline: 0.4,
    prevailingWindAngle: Math.PI * 0.75,
    seasonalAmplitude: 0.5,
    stormFrequency: 0.35,
  },
  temperate: {
    baseTemperature: 0.0,
    humidityBaseline: 0.5,
    prevailingWindAngle: Math.PI * 1.25,  // SW winds
    seasonalAmplitude: 0.4,
    stormFrequency: 0.25,
  },
  subtropical: {
    baseTemperature: 0.3,
    humidityBaseline: 0.6,
    prevailingWindAngle: Math.PI * 0.5,  // East winds
    seasonalAmplitude: 0.2,
    stormFrequency: 0.3,
  },
  tropical: {
    baseTemperature: 0.6,
    humidityBaseline: 0.8,
    prevailingWindAngle: Math.PI * 0.5,
    seasonalAmplitude: 0.1,
    stormFrequency: 0.4,
  },
  desert: {
    baseTemperature: 0.5,
    humidityBaseline: 0.1,
    prevailingWindAngle: 0,
    seasonalAmplitude: 0.3,
    stormFrequency: 0.05,
  },
  mediterranean: {
    baseTemperature: 0.2,
    humidityBaseline: 0.4,
    prevailingWindAngle: Math.PI * 1.5,  // West winds
    seasonalAmplitude: 0.35,
    stormFrequency: 0.15,
  },
  oceanic: {
    baseTemperature: 0.1,
    humidityBaseline: 0.7,
    prevailingWindAngle: Math.PI * 1.5,
    seasonalAmplitude: 0.2,
    stormFrequency: 0.35,
  },
  continental: {
    baseTemperature: 0.0,
    humidityBaseline: 0.4,
    prevailingWindAngle: Math.PI,
    seasonalAmplitude: 0.6,
    stormFrequency: 0.25,
  },
  highland: {
    baseTemperature: -0.3,
    humidityBaseline: 0.5,
    prevailingWindAngle: Math.PI * 0.75,
    seasonalAmplitude: 0.3,
    stormFrequency: 0.3,
  },
};

// ============================================
// REGION CLIMATE FIELD
// ============================================

/**
 * Derive region seed from region identity.
 * INVARIANT: Pure function of region_id.
 */
function deriveRegionSeed(regionId: string): number {
  return fnv1a(`region_climate_${regionId}`);
}

/**
 * Get climate parameters for a region.
 * INVARIANT: Static function of region identity and epoch-scale time.
 */
export function getRegionClimate(
  regionId: string,
  climateType: ClimateType,
  epochDay: number,
): RegionClimateParams {
  const baseSeed = deriveRegionSeed(regionId);
  const baseParams = CLIMATE_PARAMS[climateType];

  // Epoch-scale modulation (very slow drift over years)
  const epochT = epochDay / (DAYS_PER_YEAR * 10); // 10-year cycles
  const epochNoise = fractalNoise(baseSeed, epochT, 2);

  // Apply tiny epoch drift (±5% max)
  const epochDrift = (epochNoise - 0.5) * 0.1;

  return {
    baseTemperature: clamp(baseParams.baseTemperature + epochDrift, -1, 1),
    humidityBaseline: clamp(baseParams.humidityBaseline + epochDrift * 0.5, 0, 1),
    prevailingWindAngle: baseParams.prevailingWindAngle + epochDrift * 0.2,
    seasonalAmplitude: baseParams.seasonalAmplitude,
    stormFrequency: clamp(baseParams.stormFrequency + epochDrift * 0.1, 0, 1),
  };
}

// ============================================
// TEMPORAL MODULATION
// ============================================

/**
 * Normalize world time to temporal granularity.
 * INVARIANT: t_norm is an input to noise, not accumulated.
 */
function normalizeTime(worldTime: WorldTimestamp): number {
  // Convert to total slots since campaign start
  const totalSlots = worldTime.day * SLOTS_PER_DAY + worldTime.slot;
  return Math.floor(totalSlots / TEMPORAL_GRANULARITY);
}

/**
 * Get seasonal modulation factor.
 * Returns value in [-1, 1] representing winter to summer.
 */
function getSeasonalFactor(day: number): number {
  // Assume day 0 = spring equinox
  // Peak summer at day ~91 (quarter year)
  // Peak winter at day ~273 (three-quarter year)
  const yearProgress = (day % DAYS_PER_YEAR) / DAYS_PER_YEAR;
  return Math.sin(yearProgress * Math.PI * 2 - Math.PI / 2);
}

/**
 * Get diurnal (day/night) modulation factor.
 * Returns value in [-1, 1] representing night to day.
 */
function getDiurnalFactor(slot: number): number {
  // Slot 144 = noon (peak), slot 0/288 = midnight (trough)
  const dayProgress = slot / SLOTS_PER_DAY;
  return Math.sin(dayProgress * Math.PI * 2 - Math.PI / 2);
}

// ============================================
// HUB MODIFIERS
// ============================================

/**
 * Derive hub seed from hub identity.
 */
function deriveHubSeed(hubId: string): number {
  return fnv1a(`hub_weather_${hubId}`);
}

/**
 * Compute hub modifiers from hub properties.
 * INVARIANT: Modifiers MULTIPLY or OFFSET region parameters.
 */
export function computeHubModifiers(
  hubId: string,
  altitude: number,      // 0 = sea level, 1 = mountain peak
  coastal: boolean,
  urban: boolean,
  magical: boolean,
): HubModifiers {
  const seed = deriveHubSeed(hubId);
  const noise = mulberry32(seed);

  return {
    // Temperature drops ~6°C per 1000m, normalized to -0.3 max
    altitudeAdjustment: -altitude * 0.3,

    // Coastal: moderates temperature, adds humidity
    coastalInfluence: coastal ? 0.6 + noise * 0.2 : 0,

    // Urban heat island
    urbanBias: urban ? 0.1 + noise * 0.1 : 0,

    // Magical interference (can warm or cool)
    magicalBias: magical ? (noise - 0.5) * 0.4 : 0,
  };
}

// ============================================
// CHUNK VARIATION FIELD
// ============================================

/**
 * Derive chunk seed from chunk identity.
 */
function deriveChunkSeed(chunkId: string): number {
  return fnv1a(`chunk_weather_${chunkId}`);
}

/**
 * Sample chunk-level noise.
 * INVARIANT: Continuous in space and time, bounded output.
 */
export function sampleChunkNoise(
  chunkId: string,
  tNorm: number,
): {
  temperatureNoise: number;   // [-0.1, 0.1]
  humidityNoise: number;      // [-0.1, 0.1]
  windNoise: number;          // [-0.15, 0.15]
} {
  const seed = deriveChunkSeed(chunkId);

  // Different offsets for independent noise channels
  const tempNoise = fractalNoise(seed, tNorm / 100, 3);
  const humidNoise = fractalNoise(seed + 10000, tNorm / 100, 3);
  const windNoise = fractalNoise(seed + 20000, tNorm / 50, 2);

  return {
    temperatureNoise: (tempNoise - 0.5) * 0.2,
    humidityNoise: (humidNoise - 0.5) * 0.2,
    windNoise: (windNoise - 0.5) * 0.3,
  };
}

// ============================================
// COMPOSITION FUNCTION
// ============================================

/**
 * Clamp value to range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map continuous temperature value to discrete band.
 */
function temperatureToBand(temp: number): TemperatureBand {
  if (temp < -0.6) return 'freezing';
  if (temp < -0.3) return 'cold';
  if (temp < -0.1) return 'cool';
  if (temp < 0.1) return 'mild';
  if (temp < 0.3) return 'warm';
  if (temp < 0.6) return 'hot';
  return 'scorching';
}

/**
 * Map angle to wind direction enum.
 */
function angleToWindDirection(angle: number, strength: number): WindDirection {
  if (strength < 0.05) return 'calm';

  // Normalize to [0, 2π]
  const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // 8 directions, 45° each
  const sector = Math.floor((normalizedAngle + Math.PI / 8) / (Math.PI / 4)) % 8;
  const directions: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[sector];
}

/**
 * Compute visibility from precipitation and wind.
 */
function computeVisibility(precipitation: number, windStrength: number): number {
  // Base visibility
  let visibility = 1.0;

  // Precipitation reduces visibility
  visibility -= precipitation * 0.5;

  // High winds with precipitation reduce visibility further
  if (precipitation > 0.3 && windStrength > 0.5) {
    visibility -= (precipitation * windStrength) * 0.3;
  }

  return clamp(visibility, 0, 1);
}

/**
 * MAIN WEATHER FUNCTION
 *
 * Weather(cell_id, world_time) → WeatherSample
 *
 * INVARIANT: Pure function. No stored state. No mutation.
 */
export function Weather(
  _cellId: string,
  worldTime: WorldTimestamp,
  hierarchy: {
    regionId: string;
    hubId: string;
    chunkId: string;
    climateType: ClimateType;
    altitude: number;
    isCoastal: boolean;
    isUrban: boolean;
    isMagical: boolean;
  },
): WeatherSample {
  // === A. REGION CLIMATE FIELD ===
  const regionClimate = getRegionClimate(
    hierarchy.regionId,
    hierarchy.climateType,
    worldTime.day,
  );

  // === B. TEMPORAL MODULATION ===
  const tNorm = normalizeTime(worldTime);
  const seasonalFactor = getSeasonalFactor(worldTime.day);
  const diurnalFactor = getDiurnalFactor(worldTime.slot);

  // === C. HUB MODIFIERS ===
  const hubMods = computeHubModifiers(
    hierarchy.hubId,
    hierarchy.altitude,
    hierarchy.isCoastal,
    hierarchy.isUrban,
    hierarchy.isMagical,
  );

  // === D. CHUNK VARIATION FIELD ===
  const chunkNoise = sampleChunkNoise(hierarchy.chunkId, tNorm);

  // === E. COMPOSITION ===

  // Temperature composition
  let temperature = regionClimate.baseTemperature;

  // Seasonal modulation
  temperature += seasonalFactor * regionClimate.seasonalAmplitude;

  // Diurnal modulation (smaller effect)
  temperature += diurnalFactor * 0.1;

  // Hub modifiers
  temperature += hubMods.altitudeAdjustment;
  temperature += hubMods.urbanBias;
  temperature += hubMods.magicalBias;

  // Coastal moderation (reduces extremes)
  if (hubMods.coastalInfluence > 0) {
    temperature = temperature * (1 - hubMods.coastalInfluence * 0.3);
  }

  // Chunk noise
  temperature += chunkNoise.temperatureNoise;

  // Clamp final temperature
  temperature = clamp(temperature, -1, 1);

  // Precipitation composition
  const precipSeed = fnv1a(`precip_${hierarchy.regionId}_${hierarchy.chunkId}`);
  const precipNoise = fractalNoise(precipSeed, tNorm / 200, 4);

  // Base precipitation from humidity
  let precipitation = regionClimate.humidityBaseline * precipNoise;

  // Storm events (threshold-based spikes)
  const stormNoise = fractalNoise(precipSeed + 50000, tNorm / 50, 2);
  if (stormNoise > (1 - regionClimate.stormFrequency)) {
    precipitation += (stormNoise - (1 - regionClimate.stormFrequency)) * 2;
  }

  // Coastal humidity boost
  precipitation += hubMods.coastalInfluence * 0.15;

  // Chunk noise
  precipitation += chunkNoise.humidityNoise;

  precipitation = clamp(precipitation, 0, 1);

  // Wind composition
  const windSeed = fnv1a(`wind_${hierarchy.regionId}_${hierarchy.chunkId}`);
  const windNoise = fractalNoise(windSeed, tNorm / 80, 3);

  // Base wind from storm frequency
  let windStrength = regionClimate.stormFrequency * 0.5 + windNoise * 0.5;

  // Storms increase wind
  if (stormNoise > (1 - regionClimate.stormFrequency)) {
    windStrength += 0.3;
  }

  // Coastal winds
  windStrength += hubMods.coastalInfluence * 0.1;

  // Chunk noise
  windStrength += chunkNoise.windNoise;

  windStrength = clamp(windStrength, 0, 1);

  // Wind direction
  let windAngle = regionClimate.prevailingWindAngle;
  windAngle += (fractalNoise(windSeed + 30000, tNorm / 100, 2) - 0.5) * Math.PI * 0.5;

  // Visibility
  const visibility = computeVisibility(precipitation, windStrength);

  return {
    temperatureBand: temperatureToBand(temperature),
    precipitationIntensity: precipitation,
    windStrength,
    windDirection: angleToWindDirection(windAngle, windStrength),
    visibilityModifier: visibility,
  };
}

// ============================================
// EVENT THRESHOLDS (DERIVED, NOT SIMULATED)
// ============================================

export const WeatherEventSchema = z.enum([
  'clear',
  'rain',
  'heavy_rain',
  'storm',
  'thunderstorm',
  'snow',
  'blizzard',
  'heatwave',
  'cold_snap',
  'fog',
  'dust_storm',
]);
export type WeatherEvent = z.infer<typeof WeatherEventSchema>;

/**
 * Detect weather event from sample.
 * INVARIANT: Events detected at query time, not continuously updated.
 */
export function detectWeatherEvent(sample: WeatherSample): WeatherEvent {
  const { temperatureBand, precipitationIntensity, windStrength, visibilityModifier } = sample;

  // Fog check (low visibility, low wind, low precip)
  if (visibilityModifier < 0.4 && windStrength < 0.2 && precipitationIntensity < 0.2) {
    return 'fog';
  }

  // Blizzard (freezing + high precip + high wind)
  if (
    (temperatureBand === 'freezing' || temperatureBand === 'cold') &&
    precipitationIntensity > 0.6 &&
    windStrength > 0.6
  ) {
    return 'blizzard';
  }

  // Snow (freezing/cold + precipitation)
  if (
    (temperatureBand === 'freezing' || temperatureBand === 'cold') &&
    precipitationIntensity > 0.3
  ) {
    return 'snow';
  }

  // Dust storm (hot/scorching, low humidity, high wind)
  if (
    (temperatureBand === 'hot' || temperatureBand === 'scorching') &&
    precipitationIntensity < 0.1 &&
    windStrength > 0.7
  ) {
    return 'dust_storm';
  }

  // Thunderstorm (high precip + high wind)
  if (precipitationIntensity > 0.7 && windStrength > 0.7) {
    return 'thunderstorm';
  }

  // Storm (high precip + moderate wind)
  if (precipitationIntensity > 0.6 && windStrength > 0.4) {
    return 'storm';
  }

  // Heavy rain
  if (precipitationIntensity > 0.5) {
    return 'heavy_rain';
  }

  // Rain
  if (precipitationIntensity > 0.2) {
    return 'rain';
  }

  // Heatwave
  if (temperatureBand === 'scorching') {
    return 'heatwave';
  }

  // Cold snap
  if (temperatureBand === 'freezing') {
    return 'cold_snap';
  }

  return 'clear';
}

/**
 * Check if weather event has changed between two samples.
 * Use this to emit deltas only when thresholds are crossed.
 */
export function hasWeatherEventChanged(
  previous: WeatherSample,
  current: WeatherSample,
): boolean {
  return detectWeatherEvent(previous) !== detectWeatherEvent(current);
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get weather at a specific world node.
 * Wrapper that extracts hierarchy from node data.
 */
export function getWeatherAtNode(
  nodeId: string,
  worldTime: WorldTimestamp,
  nodeData: {
    regionId: string;
    hubId?: string;
    climate?: string;
    altitude?: number;
    isCoastal?: boolean;
    isUrban?: boolean;
    isMagical?: boolean;
  },
): WeatherSample {
  const climateType = parseClimateType(nodeData.climate);

  return Weather(nodeId, worldTime, {
    regionId: nodeData.regionId,
    hubId: nodeData.hubId ?? nodeId,
    chunkId: nodeId,
    climateType,
    altitude: nodeData.altitude ?? 0,
    isCoastal: nodeData.isCoastal ?? false,
    isUrban: nodeData.isUrban ?? false,
    isMagical: nodeData.isMagical ?? false,
  });
}

/**
 * Parse climate string to ClimateType, with fallback.
 */
function parseClimateType(climate?: string): ClimateType {
  if (!climate) return 'temperate';

  const normalized = climate.toLowerCase().replace(/[\s-_]/g, '');

  // Direct matches
  if (normalized in CLIMATE_PARAMS) {
    return normalized as ClimateType;
  }

  // Fuzzy matches
  if (normalized.includes('arctic') || normalized.includes('polar')) return 'arctic';
  if (normalized.includes('desert') || normalized.includes('arid')) return 'desert';
  if (normalized.includes('tropic')) return 'tropical';
  if (normalized.includes('subtropic')) return 'subtropical';
  if (normalized.includes('mediterr')) return 'mediterranean';
  if (normalized.includes('ocean') || normalized.includes('marine')) return 'oceanic';
  if (normalized.includes('continent')) return 'continental';
  if (normalized.includes('highland') || normalized.includes('mountain')) return 'highland';
  if (normalized.includes('subarctic') || normalized.includes('boreal')) return 'subarctic';

  return 'temperate';
}

// ============================================
// PERFORMANCE NOTES
// ============================================
//
// Time Complexity: O(1) per call
// - Fixed number of noise octaves
// - No iteration over neighbors
// - No state lookup
//
// Space Complexity: O(1)
// - No caching required (pure function)
// - No memoization needed (fast computation)
//
// Determinism Guarantee:
// - Same (cell_id, world_time, hierarchy) → same WeatherSample
// - No global state
// - No RNG calls
//
// Continuity Guarantee:
// - Cosine interpolation in noise functions
// - Multi-octave fractal smoothing
// - Bounded deltas (no sudden jumps)
//
