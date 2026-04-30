/**
 * Biome classification from noise layers — square voxel edition.
 *
 * Given a world seed and grid coord (x, y), deterministically returns
 * the biome: terrain type, color, move cost, elevation.
 *
 * Three noise channels:
 *   elevation  — low=water, mid=plains/forest, high=mountains
 *   moisture   — low=desert, mid=grassland, high=swamp/forest
 *   temperature — low=arctic/tundra, mid=temperate, high=tropical
 *
 * Migration note (2026-04-30): replaces the hex `triangleHeights` (6 wedges)
 * with `cornerHeights` (4 corners — TL, TR, BR, BL). Square tiles are
 * Minecraft-natural — corner heightmap fits voxel rendering directly.
 */

import { createNoise } from './noise'
import { APERTURE, type GridCoord } from './grid'

// ─── Biome Types ───

export type BiomeType =
  | 'ocean'
  | 'coast'
  | 'plains'
  | 'forest'
  | 'dense_forest'
  | 'hills'
  | 'mountains'
  | 'desert'
  | 'swamp'
  | 'tundra'
  | 'snow'

/** Heights at the 4 tile corners. Order: top-left, top-right, bottom-right, bottom-left. */
export type CornerHeights = [number, number, number, number]

export interface BiomeData {
  type: BiomeType
  color: string
  moveCost: number  // 1 = normal, higher = slower, Infinity = impassable
  elevation: number // raw 0-1 from noise
  cornerHeights: CornerHeights
  centerHeight: number
  moisture: number
  temperature: number
  label: string
}

// ─── Biome Config ───

const BIOME_CONFIG: Record<BiomeType, { color: string; moveCost: number; label: string }> = {
  ocean:        { color: '#2980b9', moveCost: Infinity, label: 'Ocean' },
  coast:        { color: '#5dade2', moveCost: 2,        label: 'Coast' },
  plains:       { color: '#82b74b', moveCost: 1,        label: 'Plains' },
  forest:       { color: '#3e7a38', moveCost: 1.5,      label: 'Forest' },
  dense_forest: { color: '#2d5a27', moveCost: 2,        label: 'Dense Forest' },
  hills:        { color: '#a0855b', moveCost: 1.5,      label: 'Hills' },
  mountains:    { color: '#6c6c6c', moveCost: 3,        label: 'Mountains' },
  desert:       { color: '#d4a017', moveCost: 2,        label: 'Desert' },
  swamp:        { color: '#5a6e3d', moveCost: 2.5,      label: 'Swamp' },
  tundra:       { color: '#b0c4de', moveCost: 1.5,      label: 'Tundra' },
  snow:         { color: '#e8e8e8', moveCost: 2,        label: 'Snow' },
}

// ─── Classification ───

function classify(elevation: number, moisture: number, temperature: number): BiomeType {
  if (elevation < 0.30) return 'ocean'
  if (elevation < 0.35) return 'coast'

  if (elevation > 0.75) {
    if (temperature < 0.3) return 'snow'
    return 'mountains'
  }

  if (elevation > 0.60) return 'hills'

  if (temperature < 0.25) {
    return moisture > 0.5 ? 'snow' : 'tundra'
  }

  if (temperature > 0.75 && moisture < 0.3) return 'desert'

  if (moisture > 0.70) {
    return elevation < 0.45 ? 'swamp' : 'dense_forest'
  }

  if (moisture > 0.45) return 'forest'

  return 'plains'
}

// ─── Biome Generator ───

/**
 * Create a biome resolver for a given world seed.
 * Caches the noise generator internally.
 */
export function createBiomeResolver(worldSeed: number) {
  const noise = createNoise(worldSeed)

  function getElevation(x: number, y: number): number {
    return noise.fbm(x + 1000, y + 1000, 0.04, 5, 2.0, 0.5)
  }

  function getMoisture(x: number, y: number): number {
    return noise.fbm(x + 5000, y + 5000, 0.05, 4, 2.0, 0.5)
  }

  function getTemperature(x: number, y: number): number {
    // Latitude-ish gradient (warmer near y=0, colder far away) + noise
    const latGradient = 1.0 - Math.abs(y) / 80
    const noiseVal = noise.fbm(x + 9000, y + 9000, 0.03, 3, 2.0, 0.5)
    return Math.max(0, Math.min(1, latGradient * 0.6 + noiseVal * 0.4))
  }

  /**
   * Get biome data for a tile at the given zoom level.
   *
   * Level 0 = combat (5ft tile, finest grain).
   * Higher levels = coarser tiles. `(x, y)` are level-space coords.
   *
   * Pure function — no DB hit, deterministic from `(worldSeed, x, y, level)`.
   */
  function getBiome(x: number, y: number, level: number = 0): BiomeData {
    // Convert level coords to base-space for noise sampling.
    const div = APERTURE ** level
    const wx = x / div
    const wy = y / div

    const elevation = getElevation(wx, wy)
    const moisture = getMoisture(wx, wy)
    const temperature = getTemperature(wx, wy)
    const type = classify(elevation, moisture, temperature)
    const config = BIOME_CONFIG[type]

    // Heights are 0 for water/coast, scaled 0..800 for higher elevation.
    const elevToHeight = (e: number) => (e > 0.35 ? Math.round((e - 0.35) / 0.65 * 800) : 0)
    const baseCenter = elevToHeight(elevation)

    let cornerHeights: CornerHeights = [baseCenter, baseCenter, baseCenter, baseCenter]

    if (baseCenter > 0) {
      // Sample 4 corners by stepping a half-tile in each diagonal direction.
      // (Half-tile in level space = 0.5 / div in base space.)
      const halfStep = 0.5 / div
      const tl = elevToHeight(getElevation(wx - halfStep, wy - halfStep))
      const tr = elevToHeight(getElevation(wx + halfStep, wy - halfStep))
      const br = elevToHeight(getElevation(wx + halfStep, wy + halfStep))
      const bl = elevToHeight(getElevation(wx - halfStep, wy + halfStep))
      cornerHeights = [tl, tr, br, bl]
    }

    const centerHeight = Math.round(
      (cornerHeights[0] + cornerHeights[1] + cornerHeights[2] + cornerHeights[3]) / 4,
    )

    return {
      type,
      color: config.color,
      moveCost: config.moveCost,
      elevation,
      cornerHeights,
      centerHeight,
      moisture,
      temperature,
      label: config.label,
    }
  }

  /**
   * Get biome data for a square viewport of tiles.
   * Returns a map keyed by "x,y" string.
   */
  function getViewport(
    centerX: number,
    centerY: number,
    radius: number,
    level: number = 0,
  ): Map<string, BiomeData & GridCoord> {
    const result = new Map<string, BiomeData & GridCoord>()

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx
        const y = centerY + dy
        const biome = getBiome(x, y, level)
        result.set(`${x},${y}`, { ...biome, x, y })
      }
    }

    return result
  }

  return { getBiome, getViewport, noise }
}

export type BiomeResolver = ReturnType<typeof createBiomeResolver>
