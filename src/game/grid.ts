/**
 * Grid math — square tiles, voxel/Minecraft-style chunking.
 *
 * Replaces `src/game/hex.ts` per the new visualization spec (Pedro 2026-04-30):
 *   "we used hexagonal hexing, we're changing to square... we're going
 *    the minecraft/voxel chunking strat."
 *
 * Scale system (D&D-native, base unit = 5ft combat tile):
 *
 *   Level | Label    | Feet/tile | Approx        | Aperture
 *   ──────┼──────────┼───────────┼───────────────┼─────────
 *   L0    | combat   | 5         | 1.5m          | base
 *   L1    | tactical | 40        | 12m           | 8 × L0
 *   L2    | city     | 320       | 97m           | 8 × L1
 *   L3    | mapL1    | 2560      | 0.48mi        | 8 × L2
 *   L4    | mapL2    | 20480     | 3.88mi        | 8 × L3
 *   L5    | mapL3    | 163840    | 31mi (continent) | 8 × L4
 *
 * Each level is exactly 8× the previous (`SCALE_FACTOR = 8`). Power-of-2
 * makes chunk math cheap (bitshift-friendly).
 *
 * Coordinate convention: screen-style. `x` increases east, `y` increases
 * SOUTH (so `gridToPixel` is identity in y). Worldgen + viewport agree.
 *
 * 8-neighbor by default (D&D 5e + Chebyshev distance). 4-neighbor available
 * for movement systems that exclude diagonals.
 */

// ============================================================
// COORDS + CONSTANTS
// ============================================================

export interface GridCoord {
  x: number
  y: number
}

export interface PixelCoord {
  x: number
  y: number
}

/** Tile size in pixels at base zoom — UI tunable. */
export const TILE_SIZE_PX = 32

/** Aperture: each level groups APERTURE × APERTURE tiles into one parent tile. */
export const APERTURE = 8

/** Base unit: feet per L0 (combat) tile. D&D 5e standard. */
export const BASE_FT = 5

/**
 * Feet per tile at each zoom level. Indexed by level 0..5.
 * `SCALE_LEVELS_FT[level] === BASE_FT * APERTURE ** level`.
 */
export const SCALE_LEVELS_FT = [
  5,        // L0: combat
  40,       // L1: tactical
  320,      // L2: city view
  2560,     // L3: map L1 (~0.48mi)
  20480,    // L4: map L2 (~3.88mi)
  163840,   // L5: map L3 / continent (~31mi)
] as const

export type ScaleLevel = 0 | 1 | 2 | 3 | 4 | 5

export const SCALE_LABELS = ['combat', 'tactical', 'city', 'mapL1', 'mapL2', 'mapL3'] as const
export type ScaleLabel = (typeof SCALE_LABELS)[number]

export const MAX_LEVEL: ScaleLevel = 5

/** Look up a level by label, e.g. `levelOf('city') === 2`. */
export function levelOf(label: ScaleLabel): ScaleLevel {
  return SCALE_LABELS.indexOf(label) as ScaleLevel
}

/** Feet per tile at the given level. */
export function feetPerTile(level: number): number {
  if (level < 0 || level > MAX_LEVEL) {
    throw new Error(`level ${level} out of range [0..${MAX_LEVEL}]`)
  }
  return SCALE_LEVELS_FT[level]
}

// ============================================================
// LEVEL CONVERSIONS
// ============================================================

/**
 * Convert level-space coordinates to L0 (combat / base) coordinates.
 * Multiplies by `APERTURE^level` since one L_n tile spans `APERTURE^n` L0 tiles.
 *
 * Example: `levelToBase(3, 5, 1)` → `(24, 40)` (L1 tactical → L0 combat)
 */
export function levelToBase(x: number, y: number, level: number): GridCoord {
  const mul = APERTURE ** level
  return { x: x * mul, y: y * mul }
}

/**
 * Convert L0 coordinates to level-space. Floor-divides since one L_n tile
 * captures the `APERTURE^n × APERTURE^n` block of L0 tiles around it.
 *
 * Example: `baseToLevel(24, 40, 1)` → `(3, 5)` (L0 combat → L1 tactical)
 */
export function baseToLevel(x: number, y: number, level: number): GridCoord {
  const div = APERTURE ** level
  return { x: Math.floor(x / div), y: Math.floor(y / div) }
}

/**
 * Get the parent-level chunk that contains a tile at the given level.
 *
 * Example: `chunkOf(80, 130, 2, 4)` finds the L4 chunk containing the
 * L2 tile at (80, 130) → divides by `APERTURE^(4-2)` = 64.
 */
export function chunkOf(
  x: number,
  y: number,
  level: number,
  parentLevel: number,
): GridCoord {
  if (parentLevel <= level) {
    throw new Error(`parentLevel ${parentLevel} must exceed level ${level}`)
  }
  const div = APERTURE ** (parentLevel - level)
  return { x: Math.floor(x / div), y: Math.floor(y / div) }
}

/**
 * Get the local offset of a tile within its parent chunk.
 *
 * Example: `localInChunk(81, 130, 2, 4)` → `(17, 2)` mod 64.
 */
export function localInChunk(
  x: number,
  y: number,
  level: number,
  parentLevel: number,
): GridCoord {
  if (parentLevel <= level) {
    throw new Error(`parentLevel ${parentLevel} must exceed level ${level}`)
  }
  const div = APERTURE ** (parentLevel - level)
  // Modulo that handles negatives correctly
  const mod = (n: number) => ((n % div) + div) % div
  return { x: mod(x), y: mod(y) }
}

// ============================================================
// PIXEL <-> GRID
// ============================================================

/**
 * Grid → pixel center. Screen-style: y increases downward, no flip.
 * Tile (0,0) center is at (TILE_SIZE_PX/2, TILE_SIZE_PX/2).
 */
export function gridToPixel(x: number, y: number, tileSize: number = TILE_SIZE_PX): PixelCoord {
  return {
    x: x * tileSize + tileSize / 2,
    y: y * tileSize + tileSize / 2,
  }
}

/**
 * Pixel → nearest grid tile. Floors to the tile that contains the pixel.
 */
export function pixelToGrid(px: number, py: number, tileSize: number = TILE_SIZE_PX): GridCoord {
  return {
    x: Math.floor(px / tileSize),
    y: Math.floor(py / tileSize),
  }
}

/**
 * Round fractional grid coords to the nearest integer tile. Useful for
 * intermediate path interpolation (see `gridLine`).
 */
export function gridRound(x: number, y: number): GridCoord {
  return { x: Math.round(x), y: Math.round(y) }
}

// ============================================================
// NEIGHBORS
// ============================================================

/**
 * 4 cardinal directions: E, N, W, S. Indexed clockwise from east.
 * (y-down convention: N is y-1, S is y+1.)
 */
export const GRID_NEIGHBOR_DIRS_4: readonly [number, number][] = [
  [+1,  0], // 0: E
  [ 0, -1], // 1: N
  [-1,  0], // 2: W
  [ 0, +1], // 3: S
] as const

/**
 * 8 directions: 4 cardinals + 4 diagonals. Clockwise from east.
 */
export const GRID_NEIGHBOR_DIRS_8: readonly [number, number][] = [
  [+1,  0], // 0: E
  [+1, -1], // 1: NE
  [ 0, -1], // 2: N
  [-1, -1], // 3: NW
  [-1,  0], // 4: W
  [-1, +1], // 5: SW
  [ 0, +1], // 6: S
  [+1, +1], // 7: SE
] as const

export function gridNeighbors4(x: number, y: number): GridCoord[] {
  return GRID_NEIGHBOR_DIRS_4.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
}

export function gridNeighbors8(x: number, y: number): GridCoord[] {
  return GRID_NEIGHBOR_DIRS_8.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
}

/**
 * Are two tiles adjacent? `eightWay = true` includes diagonals (Chebyshev=1);
 * `eightWay = false` is cardinal only (Manhattan=1).
 */
export function gridAdjacent(a: GridCoord, b: GridCoord, eightWay: boolean = true): boolean {
  if (eightWay) return chebyshev(a, b) === 1
  return manhattan(a, b) === 1
}

// ============================================================
// DISTANCE
// ============================================================

/**
 * Chebyshev distance — max axis-aligned step count, treats diagonals as 1.
 * D&D 5e default movement (4-cost-per-tile, including diagonals).
 */
export function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/**
 * Manhattan distance — cardinal-only step count.
 */
export function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Euclidean distance — for line-of-sight ranges and area effects.
 */
export function euclidean(a: GridCoord, b: GridCoord): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * D&D 5e variable-diagonal: every other diagonal counts as 2.
 * Returns the in-game movement cost in tiles.
 *
 *   pure-diagonal of 4 → costs 6 tiles (4 + 2 extras: 1st and 3rd are 2)
 *   actually: floor(diagonals / 2) extras
 */
export function dnd5eDiagonal(a: GridCoord, b: GridCoord): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  const diagonals = Math.min(dx, dy)
  const straights = Math.max(dx, dy) - diagonals
  return straights + diagonals + Math.floor(diagonals / 2)
}

/**
 * Default distance — Chebyshev (D&D 5e simple). Use `dnd5eDiagonal` for
 * the variable-diagonal optional rule.
 */
export function gridDistance(a: GridCoord, b: GridCoord): number {
  return chebyshev(a, b)
}

// ============================================================
// RINGS & SPIRALS
// ============================================================

/**
 * All tiles at exactly Chebyshev distance `radius` from center. Empty for
 * radius < 0; just `[center]` for radius 0.
 */
export function gridRing(center: GridCoord, radius: number): GridCoord[] {
  if (radius < 0) return []
  if (radius === 0) return [{ ...center }]

  const result: GridCoord[] = []
  const r = radius
  // Top row: (cx-r, cy-r) → (cx+r, cy-r)
  for (let dx = -r; dx <= r; dx++) result.push({ x: center.x + dx, y: center.y - r })
  // Right col: (cx+r, cy-r+1) → (cx+r, cy+r)
  for (let dy = -r + 1; dy <= r; dy++) result.push({ x: center.x + r, y: center.y + dy })
  // Bottom row: (cx+r-1, cy+r) → (cx-r, cy+r)
  for (let dx = r - 1; dx >= -r; dx--) result.push({ x: center.x + dx, y: center.y + r })
  // Left col: (cx-r, cy+r-1) → (cx-r, cy-r+1)
  for (let dy = r - 1; dy >= -r + 1; dy--) result.push({ x: center.x - r, y: center.y + dy })

  return result
}

/**
 * All tiles within Chebyshev radius — center + every ring up to `radius`.
 */
export function gridSpiral(center: GridCoord, radius: number): GridCoord[] {
  const result: GridCoord[] = [{ ...center }]
  for (let i = 1; i <= radius; i++) result.push(...gridRing(center, i))
  return result
}

/**
 * All tiles within a square block of side `2 * halfSide + 1` centered at
 * `center`. For Chebyshev-radius queries this is equivalent to gridSpiral,
 * but ordered row-by-row.
 */
export function gridBlock(center: GridCoord, halfSide: number): GridCoord[] {
  const result: GridCoord[] = []
  for (let dy = -halfSide; dy <= halfSide; dy++) {
    for (let dx = -halfSide; dx <= halfSide; dx++) {
      result.push({ x: center.x + dx, y: center.y + dy })
    }
  }
  return result
}

// ============================================================
// LINE OF SIGHT (Bresenham)
// ============================================================

/**
 * All tiles along the line from `a` to `b`, inclusive. Bresenham's line —
 * stable for diagonal LOS and area-effect aiming.
 */
export function gridLine(a: GridCoord, b: GridCoord): GridCoord[] {
  const result: GridCoord[] = []
  let x0 = a.x
  let y0 = a.y
  const x1 = b.x
  const y1 = b.y

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  // Cap iterations defensively
  const maxIter = (dx + dy + 1) * 2

  for (let i = 0; i <= maxIter; i++) {
    result.push({ x: x0, y: y0 })
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }

  return result
}

// ============================================================
// A* PATHFINDING
// ============================================================

export interface GridAStarOptions {
  /** 8-way (default) or 4-way movement */
  eightWay?: boolean
  /** Treat diagonals as 1 (Chebyshev — default) or 1.4 (Euclidean-ish) */
  diagonalCost?: 'chebyshev' | 'euclidean' | 'dnd5e'
  /** Hard cap on iterations (defaults to maxSteps × 12) */
  maxIter?: number
  /** Hard cap on path length */
  maxSteps?: number
}

/**
 * A* on the square grid.
 *
 * `costFn(x, y)` returns the cost to ENTER that tile (Infinity = impassable).
 * Returns the path from start → end inclusive, or null if no path exists.
 *
 * Defaults: 8-way movement, Chebyshev heuristic + diagonal cost.
 */
export function gridAStar(
  start: GridCoord,
  end: GridCoord,
  costFn: (x: number, y: number) => number,
  opts: GridAStarOptions = {},
): GridCoord[] | null {
  const eightWay = opts.eightWay !== false
  const diagonalCost = opts.diagonalCost ?? 'chebyshev'
  const maxSteps = opts.maxSteps ?? 200
  const maxIter = opts.maxIter ?? maxSteps * 12

  const startKey = `${start.x},${start.y}`
  const endKey = `${end.x},${end.y}`
  if (startKey === endKey) return [{ ...start }]

  const heuristic = (a: GridCoord, b: GridCoord) => chebyshev(a, b)
  const stepCost = (dx: number, dy: number, costEnter: number): number => {
    const isDiagonal = dx !== 0 && dy !== 0
    if (!isDiagonal) return costEnter
    switch (diagonalCost) {
      case 'chebyshev': return costEnter
      case 'euclidean': return costEnter * Math.SQRT2
      case 'dnd5e':     return costEnter * 1.5  // average of 1 + 2 every other
    }
  }

  const dirs = eightWay ? GRID_NEIGHBOR_DIRS_8 : GRID_NEIGHBOR_DIRS_4

  // Open list — simple sorted array; fine for < 1000-tile paths
  const open: { key: string; x: number; y: number; f: number }[] = [
    { key: startKey, x: start.x, y: start.y, f: heuristic(start, end) },
  ]
  const gScore = new Map<string, number>()
  const cameFrom = new Map<string, string>()
  const coords = new Map<string, GridCoord>()

  gScore.set(startKey, 0)
  coords.set(startKey, { ...start })

  let iter = 0
  while (open.length > 0 && iter++ < maxIter) {
    open.sort((a, b) => a.f - b.f)
    const current = open.shift()!

    if (current.key === endKey) {
      const path: GridCoord[] = []
      let key: string | undefined = endKey
      while (key) {
        path.unshift(coords.get(key)!)
        key = cameFrom.get(key)
      }
      return path
    }

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx
      const ny = current.y + dy
      const nKey = `${nx},${ny}`
      const enterCost = costFn(nx, ny)
      if (!Number.isFinite(enterCost)) continue

      const tentG =
        (gScore.get(current.key) ?? Infinity) + stepCost(dx, dy, enterCost)
      if (tentG < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentG)
        cameFrom.set(nKey, current.key)
        coords.set(nKey, { x: nx, y: ny })
        const f = tentG + heuristic({ x: nx, y: ny }, end)
        const existing = open.findIndex((o) => o.key === nKey)
        if (existing >= 0) open[existing].f = f
        else open.push({ key: nKey, x: nx, y: ny, f })
      }
    }
  }

  return null
}

// ============================================================
// ZOOM
// ============================================================

/**
 * Map a continuous zoom value to the appropriate display level.
 * Tunable per UI; defaults pick reasonable breakpoints for browser scroll.
 *
 *   zoom <    3 → L5 (continent)
 *   zoom <   12 → L4 (3.88mi tiles)
 *   zoom <   50 → L3 (0.48mi tiles)
 *   zoom <  200 → L2 (city view, 320ft tiles)
 *   zoom <  700 → L1 (tactical, 40ft tiles)
 *   zoom ≥  700 → L0 (combat, 5ft tiles)
 *
 * Note: HIGHER zoom = closer in = LOWER level. Inverted from `SCALE_LEVELS_FT`.
 */
export function zoomToLevel(zoom: number): ScaleLevel {
  if (zoom < 3) return 5    // L5 continent
  if (zoom < 12) return 4   // L4
  if (zoom < 50) return 3   // L3
  if (zoom < 200) return 2  // L2 city
  if (zoom < 700) return 1  // L1 tactical
  return 0                  // L0 combat
}

// ============================================================
// CHUNK KEY HELPERS (Minecraft-style)
// ============================================================

/**
 * Encode a chunk's `(x, y)` into a sortable string key. Useful for `Map`
 * lookups when chunks are stored by coordinate.
 */
export function chunkKey(x: number, y: number): string {
  return `${x},${y}`
}

export function parseChunkKey(key: string): GridCoord | null {
  const [x, y] = key.split(',').map(Number)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}
