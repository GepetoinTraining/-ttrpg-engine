'use client'

/**
 * Dungeon tile renderers (ported from `surfaces/_ds/TileWorld.jsx` design package).
 *
 * Adapted: only dungeon-relevant tile kinds (the biome/outdoor renderers from
 * the design package are out-of-scope for the dungeon viewer). Maps from our
 * engine's `TileType` (engine/dungeon-stamp.ts) to the design's render fns.
 *
 * Each renderer returns SVG drawn into a 100×100 viewBox so size scales linearly
 * with `tileSize`.
 */

import * as React from 'react'
import type { TileType } from '../../../../engine/dungeon-stamp'

// Deterministic per-tile hash for visual variation
function tileSeed(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) & 0xffffffff
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h >>> 0) % 1000) / 1000
}

interface TileRenderProps {
  x: number
  y: number
  size: number
  seed: number
  revealed?: boolean
}

type TileRenderer = (props: TileRenderProps) => React.ReactElement

const FLOOR: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <path
      d="M0 0 L100 0 L100 50 L0 50 Z M0 50 L50 50 L50 100 L0 100 Z M50 50 L100 50 L100 100 L50 100 Z"
      fill="none"
      stroke="#5e564a"
      strokeWidth="1.2"
    />
  </>
)

const WALL: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#3a342c" />
    <path
      d="M0 30 L100 30 M0 70 L100 70 M50 0 L50 30 M30 30 L30 70 M70 30 L70 70 M50 70 L50 100"
      stroke="#5e564a"
      strokeWidth="1.5"
    />
  </>
)

const DOOR: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <rect x="35" y="20" width="30" height="60" fill="#704a28" stroke="#3a2418" strokeWidth="2" />
    <circle cx="58" cy="55" r="2" fill="#b08838" />
  </>
)

const PILLAR: TileRenderer = ({ seed }) => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <circle cx="50" cy="50" r={28 + seed * 4} fill="#3a342c" stroke="#5e564a" strokeWidth="2" />
    <circle cx="50" cy="50" r={20 + seed * 3} fill="#5e564a" />
  </>
)

const PIT: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#1a1612" />
    <ellipse cx="50" cy="50" rx="36" ry="28" fill="#0a0806" stroke="#3a342c" strokeWidth="2" />
  </>
)

const WATER: TileRenderer = ({ seed }) => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#3a4a6a" />
    <path
      d={`M0 ${30 + seed * 8} q25 -6 50 0 t50 0 M0 ${65 + seed * 8} q25 -6 50 0 t50 0`}
      stroke="#5a7a9a"
      strokeWidth="2"
      fill="none"
    />
  </>
)

const RUBBLE: TileRenderer = ({ seed }) => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#5e564a" />
    <circle cx={20 + seed * 30} cy={30 + seed * 20} r="6" fill="#3a342c" />
    <circle cx={70 - seed * 20} cy={60 + seed * 20} r="8" fill="#3a342c" />
    <circle cx={45 + seed * 20} cy={75 - seed * 15} r="5" fill="#4a4338" />
  </>
)

const ALTAR: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <rect x="25" y="25" width="50" height="50" fill="#3a342c" stroke="#b08838" strokeWidth="2" />
    <rect x="35" y="35" width="30" height="30" fill="#4a4338" />
    <circle cx="50" cy="50" r="8" fill="#b08838" />
  </>
)

const CHEST: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <rect x="20" y="35" width="60" height="40" fill="#704a28" stroke="#3a2418" strokeWidth="2" />
    <path d="M20 50 Q20 25 50 25 Q80 25 80 50 Z" fill="#704a28" stroke="#3a2418" strokeWidth="2" />
    <rect x="44" y="42" width="12" height="14" fill="#b08838" />
    <rect x="46" y="48" width="8" height="3" fill="#3a2418" />
  </>
)

const RUNE: TileRenderer = ({ seed }) => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <circle
      cx="50"
      cy="50"
      r="32"
      fill="rgba(176,136,56,0.10)"
      stroke="#b08838"
      strokeWidth="2"
      strokeDasharray="4 3"
    />
    <text
      x="50"
      y="62"
      textAnchor="middle"
      fontSize="40"
      fontFamily="var(--mono)"
      fill="#b08838"
      opacity={0.7 + seed * 0.3}
    >
      {seed > 0.5 ? '✶' : '✸'}
    </text>
  </>
)

const STAIRS_UP: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <path d="M20 80 L80 80 L80 70 L70 70 L70 60 L60 60 L60 50 L50 50 L50 40 L40 40 L40 30 L30 30 L30 20 L20 20 Z" fill="#5e564a" stroke="#3a342c" strokeWidth="1.5" />
    <text x="50" y="70" textAnchor="middle" fontSize="18" fontFamily="var(--mono)" fill="#b08838">▲</text>
  </>
)

const STAIRS_DOWN: TileRenderer = () => (
  <>
    <rect x="0" y="0" width="100" height="100" fill="#807468" />
    <path d="M20 20 L80 20 L80 30 L70 30 L70 40 L60 40 L60 50 L50 50 L50 60 L40 60 L40 70 L30 70 L30 80 L20 80 Z" fill="#5e564a" stroke="#3a342c" strokeWidth="1.5" />
    <text x="50" y="55" textAnchor="middle" fontSize="18" fontFamily="var(--mono)" fill="#b08838">▼</text>
  </>
)

/** Renderer registry keyed by engine TileType. */
export const TILE_RENDERERS: Record<TileType, TileRenderer> = {
  floor: FLOOR,
  wall: WALL,
  door: DOOR,
  pillar: PILLAR,
  pit: PIT,
  water: WATER,
  rubble: RUBBLE,
  altar: ALTAR,
  chest: CHEST,
  rune: RUNE,
  stairs_up: STAIRS_UP,
  stairs_down: STAIRS_DOWN,
}

export interface TileVisual {
  kind: TileType
}

/** Render a single tile. Used by `TileWorld`. */
export function Tile({
  tile,
  x,
  y,
  size,
  hovered,
  selected,
  highlight,
  onClick,
  onContextMenu,
  onHover,
  revealed,
}: {
  tile: TileVisual
  x: number
  y: number
  size: number
  hovered?: boolean
  selected?: boolean
  highlight?: boolean
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onHover?: () => void
  revealed?: boolean
}): React.ReactElement | null {
  const renderer = TILE_RENDERERS[tile.kind]
  if (!renderer) return null
  const seed = tileSeed(x, y)
  return (
    <g
      transform={`translate(${x * size}, ${y * size})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onHover}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} preserveAspectRatio="none">
        {renderer({ x, y, size, seed, revealed })}
      </svg>
      {highlight && (
        <rect
          x="1"
          y="1"
          width={size - 2}
          height={size - 2}
          fill="rgba(176,136,56,0.20)"
          stroke="var(--accent-gold, #b08838)"
          strokeWidth="1.5"
          pointerEvents="none"
        />
      )}
      {(hovered || selected) && (
        <rect
          x="0"
          y="0"
          width={size}
          height={size}
          fill="none"
          stroke={selected ? 'var(--ink, #1f1b16)' : 'var(--accent-gold, #b08838)'}
          strokeWidth={selected ? 2 : 1.5}
          strokeDasharray={selected ? 'none' : '3 2'}
          pointerEvents="none"
        />
      )}
    </g>
  )
}

export { tileSeed }
