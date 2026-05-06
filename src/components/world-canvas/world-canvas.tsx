'use client'

/**
 * WORLD CANVAS — React shell
 * ============================
 *
 * ⚠ GIFT TRACK — see header in `src/lib/render/tile-math.ts`.
 * sectors-without-number idiom (Canvas 2D, full redraw on prop change),
 * NOT the main-quest 5-layer SDF/marching-cubes pipeline.
 *
 * Mirrors the friend's `hex-map.js` shell: hold a canvas ref, call the
 * paint function on mount + every prop change, wire mouse handlers,
 * apply HiDPI ratio. ~80 lines.
 */

import { useEffect, useRef, useCallback } from 'react'
import {
  worldCanvas,
  type PaintTile,
  type PaintEntityOverlay,
  type PaintRoute,
  type WorldCanvasPaintInput,
} from '../../lib/render/world-canvas'
import {
  getPixelRatio,
  getHoveredTile,
  type HitTestTile,
} from '../../lib/render/picking'
import type { ObserverFilter } from '../../../engine/mesh-potential'

export interface WorldCanvasProps {
  /** Canvas size in CSS pixels */
  width: number
  height: number
  /** Tiles to render (each carries its own pixel offsets + edge width) */
  tiles: PaintTile[]
  /** Observer filter — drives LOD cuts in the paint function */
  observer: ObserverFilter
  /** Optional Realms-of-Shod entity overlays */
  entityOverlays?: PaintEntityOverlay[]
  /** Optional routes (caravan paths, faction borders) */
  routes?: PaintRoute[]
  /** Background color override (designer-tunable) */
  backgroundColor?: string
  /** Callback fired when the user moves over a different tile */
  onHover?: (tileKey: string | undefined) => void
  /** Callback fired on a left-click (start of drag or simple tap) */
  onTileMouseDown?: (tileKey: string) => void
  /** Callback fired on a left-release */
  onTileMouseUp?: (tileKey: string) => void
  /** Callback fired on right-click (context menu trigger) */
  onTileContextMenu?: (tileKey: string, evt: React.MouseEvent) => void
  /** Currently-hovered tile key (controlled by parent for drag visuals) */
  hoverKey?: string
  /** Currently-held tile key (controlled by parent for drag arrow) */
  holdKey?: string
}

export function WorldCanvas(props: WorldCanvasProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ratioRef  = useRef<number>(1)

  // Compute ratio on mount only — devicePixelRatio rarely changes mid-session
  useEffect(() => {
    ratioRef.current = getPixelRatio()
  }, [])

  // Paint on every prop change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const input: WorldCanvasPaintInput = {
      ctx,
      ratio: ratioRef.current,
      width: props.width,
      height: props.height,
      tiles: props.tiles,
      observer: props.observer,
      entityOverlays: props.entityOverlays,
      routes: props.routes,
      hoverKey: props.hoverKey,
      holdKey: props.holdKey,
      backgroundColor: props.backgroundColor,
    }
    worldCanvas(input)
  }, [
    props.tiles, props.observer, props.entityOverlays, props.routes,
    props.hoverKey, props.holdKey, props.backgroundColor,
    props.width, props.height,
  ])

  // ── Mouse handlers ──────────────────────────────────────────────────────
  const hitTestTiles = useCallback((): HitTestTile[] => {
    return props.tiles.map(t => ({
      width:    t.width,
      xOffset:  t.xOffset,
      yOffset:  t.yOffset,
      tileKey:  `${t.tile.position.q},${t.tile.position.r}`,
      highlighted: true,
    }))
  }, [props.tiles])

  const pickAt = useCallback((evt: React.MouseEvent): string | undefined => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const rect = canvas.getBoundingClientRect()
    const x = evt.clientX - rect.left
    const y = evt.clientY - rect.top
    return getHoveredTile({ x, y, tiles: hitTestTiles() })
  }, [hitTestTiles])

  const handleMouseMove = useCallback((evt: React.MouseEvent) => {
    if (!props.onHover) return
    const key = pickAt(evt)
    props.onHover(key)
  }, [props, pickAt])

  const handleMouseDown = useCallback((evt: React.MouseEvent) => {
    if (!props.onTileMouseDown || evt.button !== 0) return
    const key = pickAt(evt)
    if (key) props.onTileMouseDown(key)
  }, [props, pickAt])

  const handleMouseUp = useCallback((evt: React.MouseEvent) => {
    if (!props.onTileMouseUp || evt.button !== 0) return
    const key = pickAt(evt)
    if (key) props.onTileMouseUp(key)
  }, [props, pickAt])

  const handleContextMenu = useCallback((evt: React.MouseEvent) => {
    if (!props.onTileContextMenu) return
    evt.preventDefault()
    const key = pickAt(evt)
    if (key) props.onTileContextMenu(key, evt)
  }, [props, pickAt])

  const handleMouseLeave = useCallback(() => {
    props.onHover?.(undefined)
  }, [props])

  return (
    <canvas
      ref={canvasRef}
      width={props.width * ratioRef.current}
      height={props.height * ratioRef.current}
      style={{
        width:  props.width,
        height: props.height,
        display: 'block',
        cursor: 'crosshair',
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    />
  )
}
