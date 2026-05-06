/**
 * TILE MATH — Square-tile geometry on the torus
 * ================================================
 *
 * ⚠ GIFT TRACK — sectors-without-number idiom, NOT engine canon.
 *
 * This file (and its siblings in `src/lib/render/` + `src/components/world-canvas/`)
 * is the renderer we're shipping to our friend who built sectors-without-number.
 * It mirrors his `utils/hex/common.js` adapted to square tiles, consumes
 * `RealmsEntity[]` from `src/lib/realms-of-shod-export.ts`, and paints with
 * full-redraw-on-prop-change Canvas 2D.
 *
 * The main-quest renderer (per `docs/renderer-pipeline-client.md`) is a
 * 5-layer SDF/marching-cubes/wedge-tensor 3D pipeline using Three.js.
 * That lives elsewhere (TBD: `src/lib/mesh/`). Don't conflate them.
 * Don't try to "fix" this file to match the engine's deterministic
 * compression principle — it's intentionally in the friend's shape.
 *
 * Pure math. No DOM. No React. No engine imports.
 */

const CORNER_ANGLES = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]

export interface TilePoint {
  x: number
  y: number
}

export interface TileGeometry {
  /** Side length of the square in pixels (full edge, not radius) */
  width: number
  /** Center offset in pixels */
  xOffset: number
  yOffset: number
}

/**
 * Compute the 4 corner pixels of a square tile centered at (xOffset, yOffset)
 * with the given edge width. Corners are returned in TL/TR/BR/BL order.
 */
export function getTilePoints({ width, xOffset, yOffset }: TileGeometry): TilePoint[] {
  // For a square aligned to axes, the radius (center→corner) is width * √2 / 2
  const radius = (width * Math.SQRT2) / 2
  return CORNER_ANGLES.map(angle => ({
    x: radius * Math.cos(angle) + xOffset,
    y: radius * Math.sin(angle) + yOffset,
  }))
}

/** Width in pixels of a row of `columns` tiles, given per-tile edge width. */
export function getTotalWidth(tileWidth: number, columns: number): number {
  return tileWidth * columns
}

/** Height in pixels of `rows` tiles, given per-tile edge width. */
export function getTotalHeight(tileWidth: number, rows: number): number {
  return tileWidth * rows
}

/**
 * 4-neighbor for square grid (N/E/S/W). Returns axial-style coords.
 * Use this for movement, pathfinding, coupling-check inputs.
 */
export function tileNeighbors(q: number, r: number): { q: number; r: number }[] {
  return [
    { q,     r: r - 1 }, // N
    { q: q + 1, r },     // E
    { q,     r: r + 1 }, // S
    { q: q - 1, r },     // W
  ]
}

/**
 * 8-neighbor variant (with diagonals). Used when the renderer needs
 * to test neighbor primitives for blending across diagonal edges.
 */
export function tileNeighbors8(q: number, r: number): { q: number; r: number }[] {
  return [
    { q,         r: r - 1 }, // N
    { q: q + 1,  r: r - 1 }, // NE
    { q: q + 1,  r        }, // E
    { q: q + 1,  r: r + 1 }, // SE
    { q,         r: r + 1 }, // S
    { q: q - 1,  r: r + 1 }, // SW
    { q: q - 1,  r        }, // W
    { q: q - 1,  r: r - 1 }, // NW
  ]
}

/**
 * Convert tile coordinates (q, r) to canvas pixel center (x, y).
 * The grid origin (0, 0) sits at canvas pixel (originX, originY).
 */
export function tileToPixel(
  q: number,
  r: number,
  tileWidth: number,
  originX: number = 0,
  originY: number = 0,
): { x: number; y: number } {
  return {
    x: originX + q * tileWidth + tileWidth / 2,
    y: originY + r * tileWidth + tileWidth / 2,
  }
}

/**
 * Inverse of tileToPixel: convert a pixel coordinate to tile (q, r).
 * Returns the tile that contains the pixel (floor division).
 */
export function pixelToTile(
  x: number,
  y: number,
  tileWidth: number,
  originX: number = 0,
  originY: number = 0,
): { q: number; r: number } {
  return {
    q: Math.floor((x - originX) / tileWidth),
    r: Math.floor((y - originY) / tileWidth),
  }
}

/** Serialize tile coords to a stable string key (for Sets and Maps). */
export function tileKey(q: number, r: number): string {
  return `${q},${r}`
}

/** Parse a tile key back to coordinates. */
export function parseTileKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

/** Manhattan distance between two tiles (4-neighbor steps). */
export function tileManhattanDistance(
  a: { q: number; r: number },
  b: { q: number; r: number },
): number {
  return Math.abs(a.q - b.q) + Math.abs(a.r - b.r)
}

/** Chebyshev distance (8-neighbor steps; diagonals count as 1). */
export function tileChebyshevDistance(
  a: { q: number; r: number },
  b: { q: number; r: number },
): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r))
}
