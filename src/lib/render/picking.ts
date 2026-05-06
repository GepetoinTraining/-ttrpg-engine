/**
 * PICKING — Pixel→tile lookup + HiDPI ratio
 * ===========================================
 *
 * ⚠ GIFT TRACK — see header in `tile-math.ts`. sectors-without-number idiom,
 * not the main-quest 3D pipeline. Mirrors his `utils/canvas-helpers.js`.
 */

import type { TileGeometry } from './tile-math'

// ============================================================
// HIDPI RATIO — verbatim port from sectors-without-number
// ============================================================

/**
 * Pixel ratio for HiDPI / Retina displays. Canvas internal pixels are
 * `width × ratio`; CSS pixels are `width`. Multiply width/height by ratio
 * for the canvas attributes; keep the style width/height in CSS pixels.
 *
 * Returns 1 in non-browser contexts (SSR-safe).
 */
export function getPixelRatio(): number {
  if (typeof window === 'undefined') return 1
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d') as
    (CanvasRenderingContext2D & {
      webkitBackingStorePixelRatio?: number
      mozBackingStorePixelRatio?: number
      msBackingStorePixelRatio?: number
      oBackingStorePixelRatio?: number
      backingStorePixelRatio?: number
    }) | null
  const dpr = window.devicePixelRatio || 1
  const bsr = ctx
    ? (ctx.webkitBackingStorePixelRatio
      ?? ctx.mozBackingStorePixelRatio
      ?? ctx.msBackingStorePixelRatio
      ?? ctx.oBackingStorePixelRatio
      ?? ctx.backingStorePixelRatio
      ?? 1)
    : 1
  return dpr / bsr
}

// ============================================================
// HIT TESTING — bounding box → nearest center
// ============================================================

export interface HitTestTile extends TileGeometry {
  /** Stable key for the tile (e.g. "q,r") */
  tileKey: string
  /** Whether this tile is interactive — non-interactive tiles are skipped */
  highlighted?: boolean
}

interface BBox { left: number; right: number; top: number; bottom: number }

function getTileBoundingBox(t: TileGeometry): BBox {
  const half = t.width / 2
  return {
    left:   t.xOffset - half,
    right:  t.xOffset + half,
    top:    t.yOffset - half,
    bottom: t.yOffset + half,
  }
}

function isWithin(point: { x: number; y: number }, box: BBox): boolean {
  return point.x >= box.left && point.x <= box.right
    && point.y >= box.top  && point.y <= box.bottom
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Find the tile under the given pixel coordinates.
 *
 * Algorithm (same shape as sectors-without-number's getHoveredHex):
 *   1. Filter tiles whose bbox contains the pixel.
 *   2. If only one matches, return it.
 *   3. Otherwise return the one whose center is closest to the pixel.
 *
 * Returns the matching tile's `tileKey`, or undefined if no match.
 */
export function getHoveredTile({
  x, y, tiles,
}: {
  x: number
  y: number
  tiles: HitTestTile[]
}): string | undefined {
  const candidates = tiles.filter(t =>
    (t.highlighted !== false) && isWithin({ x, y }, getTileBoundingBox(t))
  )
  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0].tileKey

  return candidates.reduce<{ tileKey: string | undefined; distance: number }>(
    (best, t) => {
      const d = distanceBetween({ x, y }, { x: t.xOffset, y: t.yOffset })
      return d < best.distance ? { tileKey: t.tileKey, distance: d } : best
    },
    { tileKey: undefined, distance: Infinity },
  ).tileKey
}
