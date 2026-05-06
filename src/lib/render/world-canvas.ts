/**
 * WORLD CANVAS — The paint function
 * ==================================
 *
 * ⚠ GIFT TRACK — see header in `tile-math.ts`. sectors-without-number idiom.
 *
 * Mirrors the friend's `utils/hex/canvas.js` (~280 lines) adapted to:
 *   - Square tiles instead of hexagons (4 corners at π/4 + π/2·n)
 *   - `RenderedTile` from our hologram as input shape
 *   - `RealmsEntity` overlays from our downgrade adapter
 *   - tinycolor2 for brightness checks (text-on-color contrast)
 *
 * Full-redraw-on-prop-change. No partial invalidation. State changes →
 * React re-renders → useEffect calls this function → fresh paint.
 *
 * Layered passes (cut by observer.lodMaxTier):
 *   0. Background fill (sky color from world seed)
 *   1. Substrate — tile fills + borders from materialComposition
 *   2. Primitives — geometric atoms from RenderedTile.primitives
 *   3. Entity overlays — RealmsEntity dots/labels
 *   4. Navigation — drag arrow from holdKey to hoverKey
 *   5. Text labels — tile coords + entity names (gated on lodMaxTier ≥ 3)
 */

import tinycolor from 'tinycolor2'
import type { RenderedTile, ObserverFilter, MaterialClass } from '../../../engine/mesh-potential'
import type { RealmsEntity } from '../realms-of-shod-export'
import { getTilePoints, tileKey } from './tile-math'

// ============================================================
// PAINT INPUTS
// ============================================================

export interface PaintTile {
  /** RenderedTile produced by hologramAt() */
  tile: RenderedTile
  /** Pixel center on canvas */
  xOffset: number
  yOffset: number
  /** Edge length in CSS pixels */
  width: number
}

export interface PaintEntityOverlay {
  /** Realms-of-Shod flat record (name + type) */
  entity: RealmsEntity
  /** Pixel center */
  x: number
  y: number
  /** Color hint (defaults to type-color lookup) */
  color?: string
}

export interface PaintRoute {
  /** Source pixel center */
  from: { x: number; y: number }
  /** Destination pixel center */
  to: { x: number; y: number }
  /** Visual style */
  kind?: 'solid' | 'dotted' | 'short' | 'caravan'
  /** Stroke color (defaults to faint white) */
  color?: string
}

export interface WorldCanvasPaintInput {
  ctx: CanvasRenderingContext2D
  ratio: number
  /** Canvas size in CSS pixels (not multiplied by ratio) */
  width: number
  height: number
  /** Tiles to render (already laid out with pixel offsets) */
  tiles: PaintTile[]
  /** Observer's filter — drives LOD cuts */
  observer: ObserverFilter
  /** Realms-of-Shod entity overlays (T3-T5 NPCs, monsters, etc.) */
  entityOverlays?: PaintEntityOverlay[]
  /** Routes to paint (caravans in transit, faction borders) */
  routes?: PaintRoute[]
  /** Tile key currently hovered (for highlight) */
  hoverKey?: string
  /** Tile key currently held (for drag-vector arrow) */
  holdKey?: string
  /** Background color (designer-tunable; defaults to dark ink). */
  backgroundColor?: string
}

// ============================================================
// TYPE-COLOR LOOKUP for entity overlays
// ============================================================

const ENTITY_TYPE_COLOR: Record<string, string> = {
  character:        '#ffd166',
  creature:         '#d62828',
  faction:          '#5a189a',
  guild:            '#3a86ff',
  cult:             '#7b2cbf',
  sanctuary:        '#caf0f8',
  army:             '#9d0208',
  merchant:         '#fcbf49',
  vehicle:          '#ffba08',
  shop:             '#80b918',
  marketplace:      '#aacc00',
  temple:           '#fff3b0',
  treasury:         '#ffd700',
  archive:          '#90e0ef',
  academy:          '#48cae4',
  ruin:             '#6c757d',
  landmark:         '#a0a0a0',
  natural_feature:  '#52b788',
  region:           '#1b4332',
  city:             '#e9c46a',
  town:             '#e9c46a',
  village:          '#e9c46a',
  settlement:       '#e9c46a',
}

const DEFAULT_ENTITY_COLOR = '#ffffff'

function entityColor(type: string): string {
  return ENTITY_TYPE_COLOR[type] ?? DEFAULT_ENTITY_COLOR
}

// ============================================================
// THE PAINT FUNCTION
// ============================================================

export function worldCanvas(input: WorldCanvasPaintInput): void {
  const { ctx, ratio, width, height, tiles, observer } = input
  const lod = observer.lodMaxTier

  ctx.save()
  ctx.scale(ratio, ratio)

  // ── Pass 0: Background fill ──────────────────────────────────────────────
  // Background is a designer-controlled value: caller passes backgroundColor,
  // otherwise we use the default ink. NO hash-of-seed → color trick — that
  // would make sky un-tunable for designers.
  ctx.fillStyle = input.backgroundColor ?? DEFAULT_SKY_COLOR
  ctx.fillRect(0, 0, width, height)

  // ── Pass 1: Substrate (tile fills + borders) ────────────────────────────
  paintSubstrate(ctx, tiles, input.hoverKey)

  // ── Pass 2: Primitives ──────────────────────────────────────────────────
  // Drop primitives below mid-distance LOD
  if (lod >= 2) paintPrimitives(ctx, tiles)

  // ── Pass 3: Entity overlays ─────────────────────────────────────────────
  if (lod >= 3 && input.entityOverlays?.length) {
    paintEntityOverlays(ctx, input.entityOverlays)
  }

  // ── Pass 4: Routes + drag arrow ─────────────────────────────────────────
  if (input.routes?.length) paintRoutes(ctx, input.routes)
  if (input.hoverKey && input.holdKey && input.hoverKey !== input.holdKey) {
    const fromTile = tiles.find(t => tileKey(t.tile.position.q, t.tile.position.r) === input.holdKey)
    const toTile   = tiles.find(t => tileKey(t.tile.position.q, t.tile.position.r) === input.hoverKey)
    if (fromTile && toTile) {
      paintDragArrow(ctx,
        { x: fromTile.xOffset, y: fromTile.yOffset },
        { x: toTile.xOffset,   y: toTile.yOffset })
    }
  }

  // ── Pass 5: Text labels (zoom-gated) ────────────────────────────────────
  if (lod >= 3) paintLabels(ctx, tiles, input.entityOverlays)

  ctx.restore()
}

// ============================================================
// PASS 1 — SUBSTRATE (tile fills + borders)
// ============================================================

function paintSubstrate(
  ctx: CanvasRenderingContext2D,
  tiles: PaintTile[],
  hoverKey?: string,
): void {
  for (const t of tiles) {
    const points = getTilePoints({ width: t.width, xOffset: t.xOffset, yOffset: t.yOffset })
    const { surface } = t.tile
    const baseRgb = surface.averagedColor
    const fill = `rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()

    // Hover highlight: brighter overlay
    const key = tileKey(t.tile.position.q, t.tile.position.r)
    if (key === hoverKey) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.fill()
    }

    // Border: tinted darker than the fill
    ctx.strokeStyle = tinycolor(fill).darken(20).toRgbString()
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
}

// ============================================================
// PASS 2 — PRIMITIVES (per-tile geometric atoms)
// ============================================================

function paintPrimitives(ctx: CanvasRenderingContext2D, tiles: PaintTile[]): void {
  for (const t of tiles) {
    if (!t.tile.primitives.length) continue
    for (const prim of t.tile.primitives) {
      // Local-to-tile fractional coords (0..1) → pixel coords
      const half = t.width / 2
      const px = t.xOffset - half + prim.position.x * t.width
      const py = t.yOffset - half + prim.position.y * t.width
      const size = Math.max(1, prim.scale * t.width * 0.25)
      const fill = `rgb(${prim.color.r}, ${prim.color.g}, ${prim.color.b})`

      ctx.fillStyle = fill
      ctx.strokeStyle = tinycolor(fill).darken(15).toRgbString()
      ctx.lineWidth = 0.5

      drawPrimitive(ctx, prim.geometry, px, py, size, prim.rotation)
    }
  }
}

function drawPrimitive(
  ctx: CanvasRenderingContext2D,
  geometry: string,
  x: number, y: number,
  size: number,
  rotation: number,
): void {
  switch (geometry) {
    case 'polyhedron': {
      // Diamond / rotated square
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.fillRect(-size / 2, -size / 2, size, size)
      ctx.restore()
      break
    }
    case 'cylinder': {
      // Vertical ellipse (tree trunks etc)
      ctx.beginPath()
      ctx.ellipse(x, y, size * 0.4, size * 0.8, rotation, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'plane': {
      // Flat rectangle (floors, paths)
      ctx.fillRect(x - size / 2, y - size / 4, size, size / 2)
      break
    }
    case 'card': {
      // Foliage / leaf — soft circle
      ctx.beginPath()
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'particles': {
      // Cluster of dots (fog, smoke, sparks)
      for (let i = 0; i < 5; i++) {
        const dx = (i % 3 - 1) * size * 0.3
        const dy = (Math.floor(i / 3) - 0.5) * size * 0.3
        ctx.beginPath()
        ctx.arc(x + dx, y + dy, size * 0.12, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'volumetric': {
      // Soft puff — large translucent circle
      ctx.save()
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(x, y, size * 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      break
    }
    case 'lattice': {
      // Crosshatch
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.beginPath()
      ctx.moveTo(-size / 2, 0); ctx.lineTo(size / 2, 0)
      ctx.moveTo(0, -size / 2); ctx.lineTo(0, size / 2)
      ctx.stroke()
      ctx.restore()
      break
    }
    default:
      // Fallback: small filled circle
      ctx.beginPath()
      ctx.arc(x, y, size * 0.3, 0, Math.PI * 2)
      ctx.fill()
  }
}

// ============================================================
// PASS 3 — ENTITY OVERLAYS
// ============================================================

function paintEntityOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: PaintEntityOverlay[],
): void {
  for (const o of overlays) {
    const fill = o.color ?? entityColor(o.entity.type)
    ctx.fillStyle = fill
    ctx.strokeStyle = tinycolor(fill).darken(25).toRgbString()
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(o.x, o.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

// ============================================================
// PASS 4 — ROUTES + DRAG ARROW
// ============================================================

function paintRoutes(ctx: CanvasRenderingContext2D, routes: PaintRoute[]): void {
  for (const route of routes) {
    ctx.save()
    ctx.strokeStyle = route.color ?? 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 1
    switch (route.kind) {
      case 'dotted':  ctx.setLineDash([2, 4]); break
      case 'short':   ctx.setLineDash([6, 4]); break
      case 'caravan': ctx.setLineDash([10, 4]); ctx.lineWidth = 1.5; break
      default: ctx.setLineDash([])
    }
    ctx.beginPath()
    ctx.moveTo(route.from.x, route.from.y)
    ctx.lineTo(route.to.x, route.to.y)
    ctx.stroke()
    ctx.restore()
  }
}

/** Drag-vector arrow with triangular head — same `Math.atan` trick as sectors-without-number. */
function paintDragArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to:   { x: number; y: number },
): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 220, 100, 0.9)'
  ctx.fillStyle   = 'rgba(255, 220, 100, 0.9)'
  ctx.lineWidth   = 2

  // Shaft
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()

  // Head — triangle, rotation from atan2
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const headLen = 10
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6),
             to.y - headLen * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6),
             to.y - headLen * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// ============================================================
// PASS 5 — TEXT LABELS (zoom-gated)
// ============================================================

function paintLabels(
  ctx: CanvasRenderingContext2D,
  tiles: PaintTile[],
  overlays?: PaintEntityOverlay[],
): void {
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Tile coord labels — only when tiles are large enough to fit text
  for (const t of tiles) {
    if (t.width < 32) continue
    const baseRgb = t.tile.surface.averagedColor
    const fill = `rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`
    // tinycolor2.getBrightness() decides black vs white text for contrast
    const brightness = tinycolor(fill).getBrightness()
    ctx.fillStyle = brightness > 140 ? '#000000' : '#ffffff'
    const label = `${t.tile.position.q},${t.tile.position.r}`
    ctx.fillText(label, t.xOffset, t.yOffset - t.width / 2 + 8)
  }

  // Entity name labels — only the primary entity per tile
  if (overlays) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.lineWidth = 2.5
    for (const o of overlays) {
      const name = o.entity.name
      if (!name) continue
      // Stroke (halo) then fill for legibility on any background
      ctx.strokeText(name, o.x, o.y + 12)
      ctx.fillText(name, o.x, o.y + 12)
    }
  }
}

// ============================================================
// SKY COLOR — designer-controlled palette
// ============================================================
//
// Sky color is RGB. RGB is RGB. Designers tune it. The caller passes
// `backgroundColor`; this default is only used when nothing is passed.
// Do NOT derive sky from world-seed via a hash — that strips designer control.
// If different world types need different defaults, expose a palette catalog
// that maps a designer-named world-type id to a literal hex color.
const DEFAULT_SKY_COLOR = '#0d1b2a'

// ============================================================
// EXPORTED HELPERS — used by the React shell
// ============================================================

/** Public re-export so consumers don't need a separate utils import */
export { entityColor }
export type { MaterialClass }
