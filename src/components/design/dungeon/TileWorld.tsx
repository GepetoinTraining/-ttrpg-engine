'use client'

/**
 * TileWorld — projection-agnostic SVG tile-grid renderer.
 *
 * Adapted from `surfaces/_ds/TileWorld.jsx` (design package) for our engine:
 *   - Tile data comes from `engine/dungeon-stamp.RoomLayout.tileGrid` (the
 *     deterministic stamp output). No client-side tile generation.
 *   - No internal game state. Selection / highlights come in as props; click
 *     handlers raise events out (the parent translates clicks into TPB
 *     actions via `engineClient.applyIntent`).
 *   - Skipped from the design package: biome auto-tiling neighbor blends,
 *     spell AoE overlay, fog of war, weather/day-night overlays, vision
 *     line-of-sight. Those land on the relevant surfaces (Combat, world Map);
 *     the dungeon viewer doesn't need them.
 */

import * as React from 'react'
import { Tile, type TileVisual } from './tiles'

export interface PositionedEntityVisual {
  id: string
  x: number
  y: number
  /** Display label drawn on the chip when no portrait sprite is present. */
  label: string
  /** Side classification — drives chip color: party-blue, enemy-red, neutral-gold, npc-grey. */
  side: 'party' | 'enemy' | 'neutral' | 'npc'
  /** Optional HP fraction 0..1 — rendered as a thin bar under the chip. */
  hpFrac?: number
}

export interface PositionedDecorationVisual {
  id: string
  x: number
  y: number
  glyph: string  // single character (☩ ✦ ⚱ etc.) drawn over the tile
  color?: string
}

export interface TileWorldProps {
  tiles: TileVisual[][]
  entities?: PositionedEntityVisual[]
  decorations?: PositionedDecorationVisual[]
  tileSize?: number
  viewport?: { x: number; y: number; w: number; h: number }
  onTileClick?: (event: { x: number; y: number; tile: TileVisual }) => void
  onTileContextMenu?: (event: { x: number; y: number; tile: TileVisual }, e: React.MouseEvent) => void
  onEntityClick?: (entity: PositionedEntityVisual) => void
  onEntityContextMenu?: (entity: PositionedEntityVisual, e: React.MouseEvent) => void
  selectedTile?: { x: number; y: number } | null
  selectedEntityId?: string | null
  highlightTiles?: Set<string>
  highlightEntities?: Set<string>
  showGrid?: boolean
  showCoords?: boolean
  /** Dim tiles outside this set (FoW). Use null to disable. */
  visibleTiles?: Set<string> | null
  /** Tint the whole grid with this color (lighting overlay). null disables. */
  lightingTint?: string | null
}

const SIDE_COLOR: Record<PositionedEntityVisual['side'], { bg: string; border: string; ink: string }> = {
  party:   { bg: '#3a5d7a', border: '#1f1b16', ink: '#f4efe4' },
  enemy:   { bg: '#a8442a', border: '#1f1b16', ink: '#f4efe4' },
  neutral: { bg: '#b08838', border: '#1f1b16', ink: '#1f1b16' },
  npc:     { bg: '#807468', border: '#1f1b16', ink: '#f4efe4' },
}

export function TileWorld({
  tiles,
  entities = [],
  decorations = [],
  tileSize = 36,
  viewport,
  onTileClick,
  onTileContextMenu,
  onEntityClick,
  onEntityContextMenu,
  selectedTile,
  selectedEntityId,
  highlightTiles,
  highlightEntities,
  showGrid = true,
  showCoords = false,
  visibleTiles,
  lightingTint,
}: TileWorldProps): React.ReactElement {
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null)
  const rows = tiles.length
  const cols = tiles[0]?.length ?? 0
  const vp = viewport ?? { x: 0, y: 0, w: cols, h: rows }
  const w = vp.w * tileSize
  const h = vp.h * tileSize

  return (
    <svg
      viewBox={`${vp.x * tileSize} ${vp.y * tileSize} ${w} ${h}`}
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'var(--paper-2, #2a2420)' }}
      onMouseLeave={() => setHover(null)}
    >
      {/* tiles */}
      {tiles.map((row, y) =>
        row.map((tile, x) => {
          if (x < vp.x || x >= vp.x + vp.w || y < vp.y || y >= vp.y + vp.h) return null
          const key = `${x},${y}`
          // Visibility: when visibleTiles is provided, dim non-visible tiles
          const isVisible = visibleTiles ? visibleTiles.has(key) : true
          const isHover = hover?.x === x && hover.y === y
          const isSel = selectedTile?.x === x && selectedTile.y === y
          const isHi = highlightTiles?.has(key) ?? false
          return (
            <g key={key} opacity={isVisible ? 1 : 0.3}>
              <Tile
                tile={tile}
                x={x}
                y={y}
                size={tileSize}
                hovered={isHover}
                selected={isSel}
                highlight={isHi}
                onClick={onTileClick ? () => onTileClick({ x, y, tile }) : undefined}
                onContextMenu={
                  onTileContextMenu ? (e) => onTileContextMenu({ x, y, tile }, e) : undefined
                }
                onHover={() => setHover({ x, y })}
              />
            </g>
          )
        }),
      )}

      {/* grid */}
      {showGrid && tileSize >= 14 && (
        <g pointerEvents="none" opacity={0.18}>
          {Array.from({ length: vp.w + 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={(vp.x + i) * tileSize}
              y1={vp.y * tileSize}
              x2={(vp.x + i) * tileSize}
              y2={(vp.y + vp.h) * tileSize}
              stroke="var(--ink, #1f1b16)"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: vp.h + 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={vp.x * tileSize}
              y1={(vp.y + i) * tileSize}
              x2={(vp.x + vp.w) * tileSize}
              y2={(vp.y + i) * tileSize}
              stroke="var(--ink, #1f1b16)"
              strokeWidth="0.5"
            />
          ))}
        </g>
      )}

      {/* decorations (above tiles, below entities) */}
      {decorations.map((d) => (
        <text
          key={d.id}
          x={(d.x + 0.5) * tileSize}
          y={(d.y + 0.5) * tileSize + tileSize * 0.18}
          textAnchor="middle"
          fontSize={Math.round(tileSize * 0.55)}
          fill={d.color ?? 'var(--accent-gold, #b08838)'}
          pointerEvents="none"
        >
          {d.glyph}
        </text>
      ))}

      {/* entities */}
      {entities.map((e) => {
        const isHi = highlightEntities?.has(e.id) ?? false
        const isSel = selectedEntityId === e.id
        const palette = SIDE_COLOR[e.side]
        const chipSize = Math.round(tileSize * 0.7)
        const cx = e.x * tileSize + tileSize / 2
        const cy = e.y * tileSize + tileSize / 2
        return (
          <g
            key={e.id}
            transform={`translate(${cx - chipSize / 2}, ${cy - chipSize / 2})`}
            style={{ cursor: onEntityClick ? 'pointer' : 'default' }}
            onClick={onEntityClick ? () => onEntityClick(e) : undefined}
            onContextMenu={onEntityContextMenu ? (ev) => onEntityContextMenu(e, ev) : undefined}
          >
            <circle
              cx={chipSize / 2}
              cy={chipSize / 2}
              r={chipSize / 2 - 1}
              fill={palette.bg}
              stroke={isSel || isHi ? 'var(--accent-gold, #b08838)' : palette.border}
              strokeWidth={isSel || isHi ? 2.5 : 1.5}
            />
            <text
              x={chipSize / 2}
              y={chipSize / 2 + chipSize * 0.12}
              textAnchor="middle"
              fontSize={Math.max(8, Math.round(chipSize * 0.42))}
              fontFamily="var(--mono, ui-monospace)"
              fontWeight="700"
              fill={palette.ink}
              pointerEvents="none"
            >
              {e.label.slice(0, 2).toUpperCase()}
            </text>
            {typeof e.hpFrac === 'number' && (
              <g transform={`translate(0, ${chipSize + 1})`}>
                <rect x="0" y="0" width={chipSize} height="3" fill="rgba(0,0,0,0.4)" />
                <rect
                  x="0"
                  y="0"
                  width={chipSize * Math.max(0, Math.min(1, e.hpFrac))}
                  height="3"
                  fill={
                    e.hpFrac > 0.6
                      ? 'var(--accent-green, #2c8a3e)'
                      : e.hpFrac > 0.3
                        ? 'var(--accent-gold, #b08838)'
                        : 'var(--accent-red, #a8442a)'
                  }
                />
              </g>
            )}
          </g>
        )
      })}

      {/* coords overlay */}
      {showCoords &&
        tileSize >= 32 &&
        tiles.map((row, y) =>
          row.map(
            (_, x) =>
              x >= vp.x &&
              x < vp.x + vp.w &&
              y >= vp.y &&
              y < vp.y + vp.h && (
                <text
                  key={`c${x},${y}`}
                  x={x * tileSize + 3}
                  y={y * tileSize + 10}
                  fontSize="8"
                  fontFamily="var(--mono, ui-monospace)"
                  fill="var(--ink-3, #807468)"
                  pointerEvents="none"
                >
                  {x},{y}
                </text>
              ),
          ),
        )}

      {/* lighting tint — drawn last to wash everything */}
      {lightingTint && (
        <rect
          x={vp.x * tileSize}
          y={vp.y * tileSize}
          width={w}
          height={h}
          fill={lightingTint}
          pointerEvents="none"
        />
      )}
    </svg>
  )
}
