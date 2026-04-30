// @ts-nocheck
'use client'

/**
 * GridViewport — square voxel grid renderer.
 *
 * Pure rendering component: takes a seed + center + level + radius, computes
 * biomes locally via `createBiomeResolver` (no server round-trip), and draws
 * the result as SVG.
 *
 * Layers (back-to-front):
 *   1. Tiles  — colored rects per biome, shaded by elevation
 *   2. Rivers — blue polylines through tile centers
 *   3. Roads  — beige polylines through tile centers
 *   4. Settlements — circles + labels
 *   5. Highlight — outline on the currently selected tile
 *
 * Per `project_cert_hierarchy.md`: client computes, server records. The
 * grid renderer is a pure read — it doesn't push any actions; it's the
 * visual surface for the player to point + click. Action production
 * happens in the parent surface based on click events.
 */

import * as React from 'react'
import { createBiomeResolver, type BiomeData } from '@/game/biome'
import { generateRoads, generateRivers, type RoadPath, type SettlementInfo } from '@/game/edges'
import { feetPerTile, SCALE_LABELS, type ScaleLevel } from '@/game/grid'

export interface TileViewItem extends BiomeData {
  x: number
  y: number
}

export interface GridViewportProps {
  seed: number
  centerX: number
  centerY: number
  /** 0 = combat (5ft), 5 = continent (~31mi) */
  level: ScaleLevel
  /** Tiles to render in each direction from center. Total = (2r+1)². */
  radius?: number
  /** Pixels per tile. Default 32. */
  tilePx?: number
  showRoads?: boolean
  showRivers?: boolean
  showSettlements?: boolean
  onTileClick?: (tile: TileViewItem) => void
  highlightTile?: { x: number; y: number } | null
  /** Optional tiles to mark as "explored" — shown without fog. Cert ids of party members. */
  partyTiles?: { x: number; y: number; label?: string }[]
}

/** Adjust a hex color toward black/white based on elevation 0..1. */
function shadeForElevation(baseHex: string, elevation: number): string {
  // baseHex like "#82b74b". Mix toward white for high elevation, toward
  // a darker variant for low. Cheap luminosity tweak — no fancy color math.
  const hex = baseHex.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  // map elevation [0..1] to [-0.3..+0.4]
  const factor = (elevation - 0.4) * 0.7
  const adjust = (c: number) => {
    const target = factor > 0 ? 255 : 0
    const blended = Math.round(c + (target - c) * Math.abs(factor) * 0.5)
    return Math.max(0, Math.min(255, blended))
  }
  const rr = adjust(r).toString(16).padStart(2, '0')
  const gg = adjust(g).toString(16).padStart(2, '0')
  const bb = adjust(b).toString(16).padStart(2, '0')
  return `#${rr}${gg}${bb}`
}

export default function GridViewport({
  seed,
  centerX,
  centerY,
  level,
  radius = 10,
  tilePx = 32,
  showRoads = true,
  showRivers = true,
  showSettlements = true,
  onTileClick,
  highlightTile = null,
  partyTiles = [],
}: GridViewportProps) {
  const biomeResolver = React.useMemo(() => createBiomeResolver(seed), [seed])

  // Compute viewport tiles. Square block of (2r+1) × (2r+1).
  const tiles = React.useMemo<TileViewItem[]>(() => {
    const result: TileViewItem[] = []
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx
        const y = centerY + dy
        const biome = biomeResolver.getBiome(x, y, level)
        result.push({ ...biome, x, y })
      }
    }
    return result
  }, [biomeResolver, centerX, centerY, radius, level])

  // Roads + rivers (only at L0 — they're overworld-scale features).
  const roadsAndRivers = React.useMemo(() => {
    if (level !== 0 || (!showRoads && !showRivers)) {
      return { roads: [] as RoadPath[], rivers: [] as RoadPath[], settlements: [] as SettlementInfo[] }
    }
    const { roads, settlements } = showRoads
      ? generateRoads(biomeResolver, centerX, centerY, radius)
      : { roads: [], settlements: [] as SettlementInfo[] }
    const rivers = showRivers ? generateRivers(biomeResolver, centerX, centerY, radius) : []
    return { roads, rivers, settlements }
  }, [biomeResolver, centerX, centerY, radius, level, showRoads, showRivers])

  // SVG dimensions.
  const span = (radius * 2 + 1) * tilePx
  const width = span
  const height = span

  // Convert world tile (x, y) → SVG pixel center. The viewport's center
  // tile sits at the SVG center.
  const toPixel = React.useCallback(
    (x: number, y: number) => {
      const px = (x - centerX + radius) * tilePx + tilePx / 2
      const py = (y - centerY + radius) * tilePx + tilePx / 2
      return { px, py }
    },
    [centerX, centerY, radius, tilePx],
  )

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onTileClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const tx = Math.floor(px / tilePx) - radius + centerX
    const ty = Math.floor(py / tilePx) - radius + centerY
    const tile = tiles.find((t) => t.x === tx && t.y === ty)
    if (tile) onTileClick(tile)
  }

  // Build polyline points string from a path of tile coords.
  const pathToPoints = (path: { x: number; y: number }[]) =>
    path
      .map((p) => {
        const { px, py } = toPixel(p.x, p.y)
        return `${px},${py}`
      })
      .join(' ')

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onClick={handleSvgClick}
        style={{
          background: '#1a1410',
          cursor: onTileClick ? 'crosshair' : 'default',
          display: 'block',
        }}
      >
        {/* ── Tiles ── */}
        <g>
          {tiles.map((t) => {
            const { px, py } = toPixel(t.x, t.y)
            const fill = shadeForElevation(t.color, t.elevation)
            return (
              <rect
                key={`${t.x},${t.y}`}
                x={px - tilePx / 2}
                y={py - tilePx / 2}
                width={tilePx}
                height={tilePx}
                fill={fill}
                stroke="rgba(0,0,0,0.08)"
                strokeWidth={0.5}
              />
            )
          })}
        </g>

        {/* ── Rivers ── */}
        {showRivers && roadsAndRivers.rivers.length > 0 && (
          <g>
            {roadsAndRivers.rivers.map((r, i) => (
              <polyline
                key={`river-${i}`}
                points={pathToPoints(r.path)}
                fill="none"
                stroke="#2c5e88"
                strokeWidth={Math.max(2, tilePx / 12)}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.8}
              />
            ))}
          </g>
        )}

        {/* ── Roads ── */}
        {showRoads && roadsAndRivers.roads.length > 0 && (
          <g>
            {roadsAndRivers.roads.map((r, i) => (
              <polyline
                key={`road-${i}`}
                points={pathToPoints(r.path)}
                fill="none"
                stroke="#9a7949"
                strokeWidth={Math.max(2, tilePx / 14)}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={`${tilePx / 4} ${tilePx / 8}`}
                opacity={0.85}
              />
            ))}
          </g>
        )}

        {/* ── Settlements ── */}
        {showSettlements && roadsAndRivers.settlements.length > 0 && (
          <g>
            {roadsAndRivers.settlements.map((s) => {
              const { px, py } = toPixel(s.x, s.y)
              return (
                <g key={`set-${s.x},${s.y}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={Math.max(3, tilePx / 6)}
                    fill="#f4d678"
                    stroke="#1a1410"
                    strokeWidth={1.5}
                  />
                  <text
                    x={px + tilePx / 2}
                    y={py + 3}
                    fontSize={Math.max(9, tilePx / 3.5)}
                    fontFamily="serif"
                    fill="#f0e8d4"
                    style={{ pointerEvents: 'none', textShadow: '0 0 3px #1a1410' }}
                  >
                    {s.name}
                  </text>
                </g>
              )
            })}
          </g>
        )}

        {/* ── Party tiles (active character + party members) ── */}
        {partyTiles.length > 0 && (
          <g>
            {partyTiles.map((p, i) => {
              const { px, py } = toPixel(p.x, p.y)
              return (
                <g key={`party-${i}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={Math.max(4, tilePx / 4)}
                    fill="#e85a5a"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  {p.label && (
                    <text
                      x={px}
                      y={py - tilePx / 2 - 4}
                      fontSize={Math.max(10, tilePx / 3)}
                      fontFamily="serif"
                      fill="#fff"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none', textShadow: '0 0 4px #1a1410' }}
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )}

        {/* ── Highlighted tile ── */}
        {highlightTile && (
          (() => {
            const { px, py } = toPixel(highlightTile.x, highlightTile.y)
            return (
              <rect
                x={px - tilePx / 2}
                y={py - tilePx / 2}
                width={tilePx}
                height={tilePx}
                fill="none"
                stroke="#fff"
                strokeWidth={2}
                pointerEvents="none"
              />
            )
          })()
        )}
      </svg>

      {/* ── Compass / scale legend ── */}
      <div
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          background: 'rgba(26, 20, 16, 0.85)',
          color: '#f0e8d4',
          fontFamily: 'var(--mono, monospace)',
          fontSize: 11,
          padding: '6px 10px',
          border: '1px solid rgba(240, 232, 212, 0.2)',
          pointerEvents: 'none',
        }}
      >
        L{level} · {SCALE_LABELS[level]} · 1 tile = {feetPerTile(level)}ft
      </div>
    </div>
  )
}
