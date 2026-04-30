/**
 * World Manager — create worlds, materialize tiles, resolve viewports.
 *
 * Migration note (2026-04-30): hex (q,r) → grid (x,y) throughout. The
 * `worldRegions.tileX/tileY` columns replaced `q/r`. The viewport iterates
 * a square block of tiles instead of an axial diamond.
 */

import { db } from '@/db/connection'
import { worlds, worldRegions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { createBiomeResolver, type BiomeData } from './biome'
import { generateRoads, generateRivers, type RoadPath } from './edges'
import { APERTURE, GRID_NEIGHBOR_DIRS_8 } from './grid'
import { randomUUID } from 'crypto'

export interface WorldData {
  id: string
  name: string
  seed: number
  currentDay: number
}

export interface TileViewData extends BiomeData {
  x: number
  y: number
  explored: boolean
  settlementName?: string
}

export interface TileViewportResult {
  tiles: TileViewData[]
  roads: RoadPath[]
}

/**
 * Create a new world with a seed.
 * Places a starter settlement at (0, 0) and seeds 8 surrounding tiles
 * so the player can move immediately.
 */
export async function createWorld(name: string, seed?: number): Promise<WorldData> {
  const worldSeed = seed ?? Math.floor(Math.random() * 2147483647)
  const worldId = randomUUID()

  await db.insert(worlds).values({
    id: worldId,
    name,
    seed: worldSeed,
    currentDay: 1,
    createdAt: new Date().toISOString(),
  })

  // Materialize the starting tile at (0, 0) — force plains
  const biomeResolver = createBiomeResolver(worldSeed)
  const startBiome = biomeResolver.getBiome(0, 0)

  await db.insert(worldRegions).values({
    id: randomUUID(),
    worldId,
    name: 'Starter Town',
    terrain: 'plains',
    tileX: 0,
    tileY: 0,
    explored: true,
    hasSettlement: true,
    settlementName: 'Starter Town',
    biome: 'plains',
    elevation: startBiome.elevation,
    moisture: startBiome.moisture,
    temperature: startBiome.temperature,
  })

  // Also explore the 8 neighbors so the player can move immediately.
  for (const [dx, dy] of GRID_NEIGHBOR_DIRS_8) {
    const nx = dx
    const ny = dy
    const nBiome = biomeResolver.getBiome(nx, ny)
    if (nBiome.type !== 'ocean') {
      await db.insert(worldRegions).values({
        id: randomUUID(),
        worldId,
        name: `Tile ${nx},${ny}`,
        terrain: nBiome.type,
        tileX: nx,
        tileY: ny,
        explored: true,
        hasSettlement: false,
        biome: nBiome.type,
        elevation: nBiome.elevation,
        moisture: nBiome.moisture,
        temperature: nBiome.temperature,
      })
    }
  }

  return {
    id: worldId,
    name,
    seed: worldSeed,
    currentDay: 1,
  }
}

/**
 * Get biome viewport for the renderer — mix of noise (unvisited) and DB
 * (visited). Square block of `(2*radius+1)²` tiles centered at (centerX, centerY).
 */
export async function getTileViewport(
  worldId: string,
  centerX: number,
  centerY: number,
  radius: number = 7,
  level: number = 0,
): Promise<TileViewportResult> {
  const worldRows = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1)
  if (worldRows.length === 0) throw new Error('World not found')
  const world = worldRows[0]

  const biomeResolver = createBiomeResolver(world.seed)

  // Get all explored regions for this world (stored at L0 coords).
  const exploredRegions = await db.select().from(worldRegions).where(eq(worldRegions.worldId, worldId))
  const exploredMap = new Map<string, (typeof exploredRegions)[0]>()
  for (const reg of exploredRegions) {
    exploredMap.set(`${reg.tileX},${reg.tileY}`, reg)
  }

  // Build viewport — square block.
  const tiles: TileViewData[] = []
  const scaleFactor = APERTURE ** level

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = centerX + dx
      const y = centerY + dy
      const biome = biomeResolver.getBiome(x, y, level)

      // Convert level-space coords to L0 chunk coords for explored lookup.
      const chunkX = Math.floor(x / scaleFactor)
      const chunkY = Math.floor(y / scaleFactor)
      const chunkKey = `${chunkX},${chunkY}`
      const explored = exploredMap.get(chunkKey)

      tiles.push({
        ...biome,
        x,
        y,
        explored: !!explored,
        // Only show settlement names at L0 (combat / overworld).
        settlementName:
          level === 0 ? (explored?.settlementName || undefined) : undefined,
      })
    }
  }

  // Generate roads at L0 only.
  let roads: RoadPath[] = []
  if (level === 0) {
    const roadResult = generateRoads(biomeResolver, centerX, centerY, radius)
    const rivers = generateRivers(biomeResolver, centerX, centerY, radius)
    roads = [...roadResult.roads, ...rivers]
  }

  return { tiles, roads }
}

/**
 * Materialize a tile on first visit.
 */
export async function materializeTile(
  worldId: string,
  x: number,
  y: number,
  worldSeed: number,
): Promise<void> {
  const existing = await db
    .select()
    .from(worldRegions)
    .where(and(eq(worldRegions.worldId, worldId), eq(worldRegions.tileX, x), eq(worldRegions.tileY, y)))
    .limit(1)

  if (existing.length > 0) return

  const biomeResolver = createBiomeResolver(worldSeed)
  const biome = biomeResolver.getBiome(x, y)

  if (biome.type === 'ocean') return // impassable

  // Deterministic settlement chance
  const rng = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
  const hasSettlement =
    (biome.type === 'plains' && rng < 0.08) ||
    (biome.type === 'forest' && rng < 0.04) ||
    (biome.type === 'coast' && rng < 0.10)

  const settleName = hasSettlement ? generateSettlementName(x, y) : null

  await db.insert(worldRegions).values({
    id: randomUUID(),
    worldId,
    name: settleName || `Tile ${x},${y}`,
    terrain: biome.type,
    tileX: x,
    tileY: y,
    explored: true,
    hasSettlement,
    settlementName: settleName,
    biome: biome.type,
    elevation: biome.elevation,
    moisture: biome.moisture,
    temperature: biome.temperature,
  })
}

function generateSettlementName(x: number, y: number): string {
  const prefixes = ['Green', 'Iron', 'Silver', 'Dark', 'White', 'Stone', 'River', 'Shade', 'Storm', 'Gold', 'Amber', 'Hollow', 'Frost', 'Ember', 'Oak']
  const suffixes = ['haven', 'ford', 'vale', 'keep', 'reach', 'hollow', 'burg', 'port', 'wood', 'gate', 'fall', 'watch', 'dale', 'shire', 'cross']

  const hash = Math.abs(x * 73856093 ^ y * 19349663)
  const prefix = prefixes[hash % prefixes.length]
  const suffix = suffixes[(hash >> 4) % suffixes.length]

  return `${prefix}${suffix}`
}

// ── Backward-compat aliases (legacy hex-named exports) ───────────────────
// Old surfaces may still call `getHexViewport` / `materializeHex`. These
// trampolines redirect to the renamed implementations and can be removed
// once all callers are updated.

export const getHexViewport = getTileViewport
export const materializeHex = materializeTile
export type HexViewData = TileViewData
export type HexViewportResult = TileViewportResult
