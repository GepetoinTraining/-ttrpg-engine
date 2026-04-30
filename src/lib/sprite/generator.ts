/**
 * SPRITE GENERATOR — Procedural Monster Blob
 * =============================================
 *
 * Deterministic from (speciesId, adaptations, cr). Builds an 8-direction
 * sprite sheet on a browser <canvas>:
 *
 *   Frame 0: South        Frame 4: North
 *   Frame 1: SW           Frame 5: NE
 *   Frame 2: West         Frame 6: East
 *   Frame 3: NW           Frame 7: SE
 *
 * The base is a colored blob with directional eyes (the indicator). Each
 * adaptation adds a draw layer on top of the base — armor outlines,
 * motion trails, satellite swarms, regen halos, etc. All deterministic.
 *
 * Two-stage API:
 *   buildSpriteSpec(opts)     — pure data, browser-free, fully testable
 *   renderSpriteToDataURL(spec) — browser canvas, returns base64 data URL
 *   generateMonsterSprite(opts) — convenience wrapper (calls both)
 *
 * Used by `<MonsterChip>` as the fallback when no Gemini portrait is set.
 */

import {
  type MobSize,
  MOB_SIZE_PX,
  type SpeciesInfo,
  speciesInfo,
  crToMobSize,
} from '../../../engine/biome-fauna'
import type { Adaptation } from '../../../engine/adaptation'

// ============================================================
// TYPES
// ============================================================

export interface SpriteOptions {
  speciesId: string
  adaptations?: Adaptation[]
  /** Optional CR — used only if species has no intrinsic size. */
  cr?: number
  /** Override the species color (e.g. for shiny / variant monsters). */
  colorOverride?: string
  /** Override the size (rare — most callers should use species intrinsic). */
  sizeOverride?: MobSize
}

export interface SpriteSpec {
  /** Base body color (hex). */
  color: string
  /** D&D size category. */
  size: MobSize
  /** Pixel size of one direction frame. */
  framePx: number
  /** Number of direction frames (always 8). */
  frameCount: number
  /** Total sheet dimensions. */
  sheetWidth: number
  sheetHeight: number
  /** Layered overlays in draw order. Empty means just the base blob. */
  overlays: AdaptationOverlay[]
  /** Resolved species info (handy for callers). */
  species: SpeciesInfo
}

export type AdaptationOverlay =
  | { kind: 'armor_band';      strokeColor: string }
  | { kind: 'motion_trails';   color: string;       trailCount: number }
  | { kind: 'satellites';      color: string;       count: number }
  | { kind: 'regen_halo';      color: string;       ringWidth: number }
  | { kind: 'stealth_dim';     opacity: number;     dashed: boolean }
  | { kind: 'reflect_sheen';   color: string }
  | { kind: 'drain_tendrils';  color: string;       count: number }
  | { kind: 'split_crack';     color: string }
  | { kind: 'adapt_shimmer';   colorA: string;      colorB: string }
  | { kind: 'cunning_eyes';    eyeScale: number }

// Adaptation → overlay translation. Pure, testable.
const ADAPTATION_OVERLAY_BUILDERS: Record<Adaptation, (base: string) => AdaptationOverlay> = {
  ARMORED:  () => ({ kind: 'armor_band',     strokeColor: '#1f1b16' }),
  SWIFT:    base => ({ kind: 'motion_trails', color: base, trailCount: 3 }),
  PACK:     base => ({ kind: 'satellites',    color: base, count: 4 }),
  REGEN:    () => ({ kind: 'regen_halo',     color: '#4d6a3a', ringWidth: 2 }),
  STEALTH:  () => ({ kind: 'stealth_dim',    opacity: 0.55, dashed: true }),
  REFLECT:  () => ({ kind: 'reflect_sheen',  color: '#dceaff' }),
  DRAIN:    () => ({ kind: 'drain_tendrils', color: '#a8442a', count: 4 }),
  SPLIT:    () => ({ kind: 'split_crack',    color: '#1f1b16' }),
  ADAPT:    () => ({ kind: 'adapt_shimmer',  colorA: '#b08838', colorB: '#3a5d7a' }),
  CUNNING:  () => ({ kind: 'cunning_eyes',   eyeScale: 1.4 }),
}

// ============================================================
// SPEC BUILDER — Pure, testable
// ============================================================

/**
 * Build the deterministic sprite spec for a monster. No DOM. No canvas.
 *
 * Same options always produce the same spec (modulo input order — adaptations
 * order is preserved in the overlays array, which controls draw order).
 */
export function buildSpriteSpec(opts: SpriteOptions): SpriteSpec {
  const species = speciesInfo(opts.speciesId)
  const color = opts.colorOverride ?? species.color
  const size: MobSize = opts.sizeOverride
    ?? species.size
    ?? (opts.cr != null ? crToMobSize(opts.cr) : 'Medium')
  const framePx = MOB_SIZE_PX[size]
  const adaptations = opts.adaptations ?? []

  const overlays = adaptations.map(a => ADAPTATION_OVERLAY_BUILDERS[a](color))

  return {
    color,
    size,
    framePx,
    frameCount: 8,
    sheetWidth: framePx * 8,
    sheetHeight: framePx,
    overlays,
    species,
  }
}

// ============================================================
// RENDER — Browser canvas
// ============================================================

/**
 * Get the 2D context from a freshly created canvas. Returns null if the
 * environment doesn't support canvas (e.g. SSR / vitest without jsdom).
 */
function makeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx }
}

const DIRECTION_ANGLES_DEG = [
  90,    // 0: South
  135,   // 1: SW
  180,   // 2: West
  225,   // 3: NW
  270,   // 4: North
  315,   // 5: NE
  0,     // 6: East
  45,    // 7: SE
]

/**
 * Render the sprite spec to a canvas data URL (PNG). Browser-only.
 * Returns null when canvas is unavailable (SSR/test env without jsdom).
 */
export function renderSpriteToDataURL(spec: SpriteSpec): string | null {
  const made = makeCanvas(spec.sheetWidth, spec.sheetHeight)
  if (!made) return null
  const { canvas, ctx } = made

  for (let i = 0; i < spec.frameCount; i++) {
    const offsetX = i * spec.framePx
    drawFrame(ctx, spec, offsetX, i)
  }

  return canvas.toDataURL()
}

/**
 * Convenience: build spec + render in one call. Returns null when canvas
 * is unavailable. Use buildSpriteSpec directly when you want test coverage
 * or you're rendering through a different surface (SVG, three.js, etc).
 */
export function generateMonsterSprite(opts: SpriteOptions): string | null {
  return renderSpriteToDataURL(buildSpriteSpec(opts))
}

// ============================================================
// FRAME DRAWING — Base blob + adaptation overlays per frame
// ============================================================

function drawFrame(
  ctx: CanvasRenderingContext2D,
  spec: SpriteSpec,
  offsetX: number,
  directionIdx: number,
): void {
  const cx = offsetX + spec.framePx / 2
  const cy = spec.framePx / 2
  const r = spec.framePx / 2 - 2
  const angleRad = DIRECTION_ANGLES_DEG[directionIdx] * (Math.PI / 180)

  // Stealth dim — apply alpha for the whole frame (set once, restored at end)
  const stealthOverlay = spec.overlays.find(o => o.kind === 'stealth_dim')
  if (stealthOverlay && stealthOverlay.kind === 'stealth_dim') {
    ctx.save()
    ctx.globalAlpha = stealthOverlay.opacity
  }

  // Pre-base layers (drawn behind the body)
  for (const overlay of spec.overlays) {
    if (overlay.kind === 'motion_trails') drawMotionTrails(ctx, overlay, cx, cy, r, angleRad)
    if (overlay.kind === 'regen_halo')    drawRegenHalo(ctx, overlay, cx, cy, r)
  }

  // Base blob body
  ctx.fillStyle = spec.color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Adapt shimmer — overlay on body before highlight
  const shimmer = spec.overlays.find(o => o.kind === 'adapt_shimmer')
  if (shimmer && shimmer.kind === 'adapt_shimmer') {
    drawAdaptShimmer(ctx, shimmer, cx, cy, r)
  }

  // Pseudo-3D highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.beginPath()
  ctx.arc(cx - r / 3, cy - r / 3, r / 3, 0, Math.PI * 2)
  ctx.fill()

  // Armor band — thick dark outline
  const armor = spec.overlays.find(o => o.kind === 'armor_band')
  if (armor && armor.kind === 'armor_band') {
    ctx.strokeStyle = armor.strokeColor
    ctx.lineWidth = Math.max(2, r * 0.18)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Reflect sheen — bright highlight stroke
  const reflect = spec.overlays.find(o => o.kind === 'reflect_sheen')
  if (reflect && reflect.kind === 'reflect_sheen') {
    ctx.strokeStyle = reflect.color
    ctx.lineWidth = Math.max(1, r * 0.08)
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.85, -Math.PI / 4, Math.PI / 4)
    ctx.stroke()
  }

  // Split crack — hairline through body
  const split = spec.overlays.find(o => o.kind === 'split_crack')
  if (split && split.kind === 'split_crack') {
    ctx.strokeStyle = split.color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.7, cy)
    ctx.lineTo(cx + r * 0.7, cy)
    ctx.stroke()
  }

  // Drain tendrils
  const drain = spec.overlays.find(o => o.kind === 'drain_tendrils')
  if (drain && drain.kind === 'drain_tendrils') {
    drawDrainTendrils(ctx, drain, cx, cy, r)
  }

  // Eyes (directional indicator)
  const cunning = spec.overlays.find(o => o.kind === 'cunning_eyes')
  const eyeScale = (cunning && cunning.kind === 'cunning_eyes') ? cunning.eyeScale : 1.0
  drawDirectionEyes(ctx, cx, cy, r, angleRad, eyeScale)

  // Stealth dashed silhouette outline
  if (stealthOverlay && stealthOverlay.kind === 'stealth_dim' && stealthOverlay.dashed) {
    ctx.strokeStyle = '#1f1b16'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Satellites — drawn after the main body so they appear next to it
  const satellites = spec.overlays.find(o => o.kind === 'satellites')
  if (satellites && satellites.kind === 'satellites') {
    drawSatellites(ctx, satellites, cx, cy, r, angleRad)
  }

  // Restore stealth alpha
  if (stealthOverlay && stealthOverlay.kind === 'stealth_dim') {
    ctx.restore()
  }
}

function drawDirectionEyes(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  angleRad: number, eyeScale: number,
): void {
  const eyeDist = r * 0.5
  const eyeX = cx + Math.cos(angleRad) * eyeDist
  const eyeY = cy + Math.sin(angleRad) * eyeDist
  const eyeR = r * 0.25 * eyeScale
  const pupilR = r * 0.1 * eyeScale

  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'black'
  ctx.beginPath()
  ctx.arc(eyeX, eyeY, pupilR, 0, Math.PI * 2)
  ctx.fill()
}

function drawMotionTrails(
  ctx: CanvasRenderingContext2D,
  overlay: { kind: 'motion_trails'; color: string; trailCount: number },
  cx: number, cy: number, r: number, angleRad: number,
): void {
  // Trails drawn opposite the facing direction (behind the blob)
  const tailAngle = angleRad + Math.PI
  for (let i = 1; i <= overlay.trailCount; i++) {
    const dist = r * (0.8 + i * 0.4)
    const tx = cx + Math.cos(tailAngle) * dist
    const ty = cy + Math.sin(tailAngle) * dist
    const tr = r * (0.7 - i * 0.15)
    if (tr <= 0) continue
    ctx.fillStyle = overlay.color
    ctx.globalAlpha *= 0.5
    ctx.beginPath()
    ctx.arc(tx, ty, tr, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha *= 2  // restore (compounding works because save/restore is outside)
  }
}

function drawSatellites(
  ctx: CanvasRenderingContext2D,
  overlay: { kind: 'satellites'; color: string; count: number },
  cx: number, cy: number, r: number, angleRad: number,
): void {
  const satR = r * 0.35
  const orbitDist = r * 1.3
  for (let i = 0; i < overlay.count; i++) {
    const a = angleRad + (Math.PI * 2 * i / overlay.count)
    const sx = cx + Math.cos(a) * orbitDist
    const sy = cy + Math.sin(a) * orbitDist
    ctx.fillStyle = overlay.color
    ctx.beginPath()
    ctx.arc(sx, sy, satR, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawRegenHalo(
  ctx: CanvasRenderingContext2D,
  overlay: { kind: 'regen_halo'; color: string; ringWidth: number },
  cx: number, cy: number, r: number,
): void {
  ctx.strokeStyle = overlay.color
  ctx.lineWidth = overlay.ringWidth
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2)
  ctx.stroke()
}

function drawDrainTendrils(
  ctx: CanvasRenderingContext2D,
  overlay: { kind: 'drain_tendrils'; color: string; count: number },
  cx: number, cy: number, r: number,
): void {
  ctx.strokeStyle = overlay.color
  ctx.lineWidth = 1
  for (let i = 0; i < overlay.count; i++) {
    const a = (Math.PI * 2 * i) / overlay.count
    const ex = cx + Math.cos(a) * r * 1.4
    const ey = cy + Math.sin(a) * r * 1.4
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }
}

function drawAdaptShimmer(
  ctx: CanvasRenderingContext2D,
  overlay: { kind: 'adapt_shimmer'; colorA: string; colorB: string },
  cx: number, cy: number, r: number,
): void {
  // Diagonal split — half tinted with colorA, half with colorB
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = overlay.colorA
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 4, Math.PI * 3 / 4)
  ctx.lineTo(cx, cy)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = overlay.colorB
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI * 3 / 4, Math.PI * 7 / 4)
  ctx.lineTo(cx, cy)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
