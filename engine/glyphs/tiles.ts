/**
 * GLYPH TILES — procedural floor-tile matrices at native resolution
 * ==================================================================
 *
 * Each tile is a `TILE_SIZE × TILE_THICKNESS × TILE_SIZE` glyph matrix
 * generated procedurally from `(worldSeed, q, r)`. Two clients with the
 * same seed produce literally the same tile matrix bit-for-bit.
 *
 * Layout convention:
 *   - bottom layers (y=0..TILE_THICKNESS-2): substrate (dirt, stone, etc.)
 *   - top layer (y=TILE_THICKNESS-1): visible surface (grass, sand, etc.)
 *
 * Cubic voxels: at the canonical footprint `{ width: 1, height: 0.0625,
 * depth: 1 }`, each voxel is `1/64 ≈ 0.0156` world units in every axis.
 * The tile is a thin slab (0.0625 world units = ~3 inches at 5ft/tile).
 *
 * Wire size: 64×4×64 = 16,384 cells per tile. Gzipped, an authored tile
 * is a few hundred bytes; a procedural tile only ships its *seed*, so
 * tiles cost effectively nothing on the wire.
 */

import { SeededRNG } from '../hub-topology'
import type { GlyphMatrix } from './mold-evaluator'

export const TILE_SIZE = 64
export const TILE_THICKNESS = 4
export const TILE_FOOTPRINT = { width: 1, height: 0.0625, depth: 1 }

const CELLS_PER_TILE = TILE_SIZE * TILE_THICKNESS * TILE_SIZE

function cellIndex(x: number, y: number, z: number): number {
  return y * (TILE_SIZE * TILE_SIZE) + z * TILE_SIZE + x
}

function emptyBuf(): string[] {
  return new Array(CELLS_PER_TILE).fill('_')
}

function fillBottomLayers(cells: string[], glyph: string): void {
  for (let y = 0; y < TILE_THICKNESS - 1; y++) {
    for (let z = 0; z < TILE_SIZE; z++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        cells[cellIndex(x, y, z)] = glyph
      }
    }
  }
}

function fillTopLayer(cells: string[], pick: (rng: SeededRNG) => string, rng: SeededRNG): void {
  const yTop = TILE_THICKNESS - 1
  for (let z = 0; z < TILE_SIZE; z++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      cells[cellIndex(x, yTop, z)] = pick(rng)
    }
  }
}

function makeMatrix(cells: string[]): GlyphMatrix {
  return {
    sizeX: TILE_SIZE,
    sizeY: TILE_THICKNESS,
    sizeZ: TILE_SIZE,
    cells: cells.join(''),
  }
}

// ============================================================
// TILE GENERATOR INTERFACE
// ============================================================

export interface TileGenerator {
  id: string
  name: string
  /** Generate this tile's matrix at the given world coordinates. */
  generate(worldSeed: string, q: number, r: number): GlyphMatrix
}

// ============================================================
// CATALOG — first-pass tile types
// ============================================================

/** Grass tile: dirt substrate, grass surface with occasional dirt patches. */
export const GRASS_TILE: TileGenerator = {
  id: 'grass',
  name: 'Grass',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:grass:${q}:${r}`)
    const cells = emptyBuf()
    fillBottomLayers(cells, 'd')
    // Mostly grass; sparse dirt patches; occasional moss tuft
    fillTopLayer(cells, (r) => {
      const v = r.next()
      if (v < 0.86) return 'g'        // grass
      if (v < 0.95) return 'd'        // bare dirt patch
      return ':'                       // moss
    }, rng)
    return makeMatrix(cells)
  },
}

/** Dirt tile: dirt all the way down, with surface gravel flecks. */
export const DIRT_TILE: TileGenerator = {
  id: 'dirt',
  name: 'Dirt',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:dirt:${q}:${r}`)
    const cells = emptyBuf()
    fillBottomLayers(cells, 'd')
    fillTopLayer(cells, (r) => (r.next() < 0.94 ? 'd' : '%'), rng)
    return makeMatrix(cells)
  },
}

/** Stone tile: solid stone with minor surface variation (gravel cracks). */
export const STONE_TILE: TileGenerator = {
  id: 'stone',
  name: 'Stone',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:stone:${q}:${r}`)
    const cells = emptyBuf()
    fillBottomLayers(cells, 'S')
    fillTopLayer(cells, (r) => {
      const v = r.next()
      if (v < 0.92) return 'S'
      if (v < 0.98) return '%'        // gravel
      return ':'                       // lichen on stone
    }, rng)
    return makeMatrix(cells)
  },
}

/** Sand tile: dirt substrate, sand surface. */
export const SAND_TILE: TileGenerator = {
  id: 'sand',
  name: 'Sand',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:sand:${q}:${r}`)
    const cells = emptyBuf()
    fillBottomLayers(cells, 'd')
    fillTopLayer(cells, (r) => (r.next() < 0.98 ? '~' : 'd'), rng)
    return makeMatrix(cells)
  },
}

/** Wooden plank floor (interior tile): wood substrate, wood surface. */
export const WOOD_FLOOR_TILE: TileGenerator = {
  id: 'wood_floor',
  name: 'Wood floor',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:wood:${q}:${r}`)
    const cells = emptyBuf()
    fillBottomLayers(cells, 'T')     // wood substrate (using `T` trunk for wood material)
    fillTopLayer(cells, (r) => (r.next() < 0.97 ? 'T' : 'B'), rng)
    return makeMatrix(cells)
  },
}

/** Cobblestone street: stone substrate, mixed stones on top. */
export const COBBLESTONE_TILE: TileGenerator = {
  id: 'cobblestone',
  name: 'Cobblestone',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:cobble:${q}:${r}`)
    const cells = emptyBuf()
    fillBottomLayers(cells, 'd')
    fillTopLayer(cells, (r) => {
      const v = r.next()
      if (v < 0.70) return 'S'
      if (v < 0.90) return '%'
      return 'd'                       // mortar gaps
    }, rng)
    return makeMatrix(cells)
  },
}

/** Snow tile: dirt substrate, snow surface. */
export const SNOW_TILE: TileGenerator = {
  id: 'snow',
  name: 'Snow',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:snow:${q}:${r}`)
    const cells = emptyBuf()
    fillBottomLayers(cells, 'd')
    fillTopLayer(cells, (r) => (r.next() < 0.97 ? ',' : 'i'), rng)
    return makeMatrix(cells)
  },
}

/** Water tile: stone bed, water surface. */
export const WATER_TILE: TileGenerator = {
  id: 'water',
  name: 'Water',
  generate(seed, q, r) {
    const rng = new SeededRNG(`${seed}:water:${q}:${r}`)
    const cells = emptyBuf()
    // Bottom 2 layers: stone bed
    for (let y = 0; y < 2; y++) {
      for (let z = 0; z < TILE_SIZE; z++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          cells[cellIndex(x, y, z)] = 'S'
        }
      }
    }
    // Top 2 layers: water
    for (let y = 2; y < TILE_THICKNESS; y++) {
      for (let z = 0; z < TILE_SIZE; z++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          cells[cellIndex(x, y, z)] = 'w'
        }
      }
    }
    return makeMatrix(cells)
  },
}

// ============================================================
// CATALOG REGISTRY
// ============================================================

export const TILE_CATALOG: Record<string, TileGenerator> = {
  grass:        GRASS_TILE,
  dirt:         DIRT_TILE,
  stone:        STONE_TILE,
  sand:         SAND_TILE,
  wood_floor:   WOOD_FLOOR_TILE,
  cobblestone:  COBBLESTONE_TILE,
  snow:         SNOW_TILE,
  water:        WATER_TILE,
}

export type TileId = keyof typeof TILE_CATALOG

export function generateTile(
  id: TileId,
  worldSeed: string,
  q: number,
  r: number,
): GlyphMatrix {
  const gen = TILE_CATALOG[id]
  if (!gen) throw new Error(`unknown tile id: ${id}`)
  return gen.generate(worldSeed, q, r)
}
