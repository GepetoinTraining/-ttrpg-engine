'use client'

/**
 * Dungeon primitive components.
 *
 * Each primitive is a small SVG/CSS render of one piece of the dungeon
 * vocabulary. They compose freely inside <DungeonGrid> (or any SVG board).
 *
 * Image-backed assets (Gemini portraits, SVG-skill output) drop in by
 * setting `imageUrl` on a Texture or by passing `iconUrl` to Object/Spawn.
 */

import React from 'react'
import {
  CELL_PX_DEFAULT,
  type CellCoord,
  type EdgeKey,
  type Texture as TextureT,
  type Tile as TileT,
  type Edge as EdgeT,
  type Door as DoorT,
  type DungeonObject as ObjectT,
  type Hazard as HazardT,
  type Spawn as SpawnT,
  type LightSource as LightT,
  type LightLevel,
} from '@/lib/dungeon/types'
import { texturePattern, TEXTURES, TEXTURE_CATEGORIES, texturesByCategory } from '@/lib/dungeon/textures'

// ─── <Texture> swatch ─────────────────────────────────────────────────────
// Renders a single tile-sized swatch using either an image or the CSS pattern.
// Use this anywhere a flat texture sample is needed (pickers, tile fills).

export function Texture({
  texture,
  size = CELL_PX_DEFAULT,
  rounded = false,
}: {
  texture: TextureT
  size?: number
  rounded?: boolean
}) {
  const pat = texturePattern(texture.kind)
  const bg = texture.imageUrl
    ? `center/cover url(${texture.imageUrl}), ${pat.baseColor}`
    : pat.background
  const tint = texture.tint
    ? `linear-gradient(${texture.tint}, ${texture.tint}), `
    : ''
  return (
    <div
      title={pat.label}
      style={{
        width: size,
        height: size,
        background: tint + bg,
        backgroundColor: pat.baseColor,
        borderRadius: rounded ? 4 : 0,
        transform: texture.rotation ? `rotate(${texture.rotation}deg)` : undefined,
      }}
    />
  )
}

// ─── <Tile> ───────────────────────────────────────────────────────────────
// A 5ft cell on the grid. Renders as a CSS-filled rect inside a <foreignObject>
// for SVG compatibility. Light is a translucent overlay.

export function Tile({
  tile,
  cellPx = CELL_PX_DEFAULT,
  selected = false,
  onClick,
}: {
  tile: TileT
  cellPx?: number
  selected?: boolean
  onClick?: (c: CellCoord) => void
}) {
  const px = cellPx
  return (
    <foreignObject
      x={tile.at.q * px}
      y={tile.at.r * px}
      width={px}
      height={px}
      onClick={onClick ? () => onClick(tile.at) : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div
        // @ts-expect-error xmlns for foreignObject
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          outline: selected ? '2px solid var(--accent-gold)' : 'none',
          outlineOffset: -2,
        }}
      >
        <Texture texture={tile.texture} size={px} />
        <div style={{ position: 'absolute', inset: 0, background: lightOverlay(tile.light) }} />
        {tile.difficult && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 6px)',
            }}
          />
        )}
      </div>
    </foreignObject>
  )
}

function lightOverlay(level: LightLevel): string {
  switch (level) {
    case 'dark':
      return 'rgba(8,12,20,0.78)'
    case 'dim':
      return 'rgba(8,12,20,0.40)'
    case 'bright':
      return 'rgba(0,0,0,0)'
  }
}

// ─── <Wall> + <Edge> ──────────────────────────────────────────────────────
// Edges sit between adjacent cells. <Edge> dispatches by kind.

const EDGE_THICKNESS = 4

export function Edge({
  edge,
  cellPx = CELL_PX_DEFAULT,
}: {
  edge: EdgeT
  cellPx?: number
}) {
  if (edge.kind === 'open') return null
  const { q, r, side } = edge.at
  const x1 = q * cellPx
  const y1 = r * cellPx
  const x2 = x1 + cellPx
  const y2 = y1 + cellPx
  const props = (() => {
    switch (side) {
      case 'N': return { x1, y1, x2, y2: y1 }
      case 'S': return { x1, y1: y2, x2, y2 }
      case 'E': return { x1: x2, y1, x2, y2 }
      case 'W': return { x1, y1, x2: x1, y2 }
    }
  })()
  if (edge.kind === 'window') {
    return (
      <line
        {...props}
        stroke="var(--accent-blue)"
        strokeWidth={EDGE_THICKNESS}
        strokeDasharray="6 4"
      />
    )
  }
  if (edge.kind === 'fence') {
    return (
      <line
        {...props}
        stroke="var(--ink-2)"
        strokeWidth={EDGE_THICKNESS - 1}
        strokeDasharray="2 3"
      />
    )
  }
  // wall / door (door is rendered as wall stroke + a Door symbol on top)
  return <line {...props} stroke="var(--ink)" strokeWidth={EDGE_THICKNESS} />
}

// ─── <Door> ───────────────────────────────────────────────────────────────
// Drawn ON TOP of the edge wall. State controls the glyph.

export function Door({
  door,
  cellPx = CELL_PX_DEFAULT,
}: {
  door: DoorT
  cellPx?: number
}) {
  const { q, r, side } = door.at
  const cx =
    side === 'N' || side === 'S'
      ? q * cellPx + cellPx / 2
      : side === 'E'
      ? (q + 1) * cellPx
      : q * cellPx
  const cy =
    side === 'E' || side === 'W'
      ? r * cellPx + cellPx / 2
      : side === 'S'
      ? (r + 1) * cellPx
      : r * cellPx
  const isVertical = side === 'E' || side === 'W'
  const w = isVertical ? 8 : cellPx * 0.42
  const h = isVertical ? cellPx * 0.42 : 8
  const fill =
    door.state === 'open'    ? 'var(--paper)'
    : door.state === 'locked' ? 'var(--accent-gold)'
    : door.state === 'secret' ? 'var(--paper-2)'
    : door.state === 'broken' ? 'var(--accent-red)'
    : 'var(--paper-3)'
  const stroke =
    door.state === 'secret' ? 'rgba(31,27,22,0.4)' :
    door.trapped            ? 'var(--accent-red)' :
    'var(--ink)'
  const strokeDash = door.state === 'secret' ? '3 3' : undefined
  return (
    <g>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={strokeDash}
      />
      {door.trapped && (
        <text
          x={cx}
          y={cy + 3}
          fontFamily="var(--mono)"
          fontSize={9}
          textAnchor="middle"
          fill="var(--accent-red)"
        >
          ⚠
        </text>
      )}
    </g>
  )
}

// ─── <DungeonObjectGlyph> ─────────────────────────────────────────────────
// Furniture / interactables. SVG glyph keyed by kind. Image override later.

const OBJECT_GLYPHS: Record<string, string> = {
  chest: '◫', altar: '⊞', statue: '⌗', pillar: '⊙', table: '▭',
  chair: '⌐', bed: '▱', bookshelf: '☰', brazier: '✺', fountain: '◉',
  lever: '⌐', button: '◎', rune: '✶', rubble: '∴', corpse: '✕',
  cage: '⊟', crate: '▣',
}

export function DungeonObjectGlyph({
  obj,
  cellPx = CELL_PX_DEFAULT,
}: {
  obj: ObjectT
  cellPx?: number
}) {
  const cx = obj.at.q * cellPx + cellPx / 2
  const cy = obj.at.r * cellPx + cellPx / 2
  const glyph = OBJECT_GLYPHS[obj.kind] ?? '?'
  return (
    <g>
      <circle cx={cx} cy={cy} r={cellPx * 0.32} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1} />
      <text
        x={cx}
        y={cy + cellPx * 0.10}
        textAnchor="middle"
        fontFamily="var(--serif)"
        fontSize={cellPx * 0.42}
        fill="var(--ink)"
      >
        {glyph}
      </text>
      {obj.label && (
        <text
          x={cx}
          y={cy + cellPx * 0.55}
          textAnchor="middle"
          fontFamily="var(--mono)"
          fontSize={9}
          fill="var(--ink-2)"
        >
          {obj.label}
        </text>
      )}
    </g>
  )
}

// ─── <HazardMark> ────────────────────────────────────────────────────────
// Trap or magical effect. Color-coded; visible to DM, hidden to players
// until detected.

const HAZARD_GLYPHS: Record<string, string> = {
  'pressure-plate': '◰', tripwire: '─', 'dart-trap': '↗', 'falling-block': '⬛',
  pit: '◯', 'spike-pit': '◉', 'arrow-slit': '↕', glyph: '✶', symbol: '✦',
  gas: '☁', 'fire-jet': '🜂', 'ice-floor': '❄', web: '✳', 'illusion-floor': '◌',
}

export function HazardMark({
  hazard,
  cellPx = CELL_PX_DEFAULT,
  reveal = false,
}: {
  hazard: HazardT
  cellPx?: number
  /** When false, render as a subtle DM-only outline. When true, fully shown to players. */
  reveal?: boolean
}) {
  const cx = hazard.at.q * cellPx + cellPx / 2
  const cy = hazard.at.r * cellPx + cellPx / 2
  const stroke = hazard.status === 'sprung'
    ? 'var(--ink-3)'
    : 'var(--accent-red)'
  const opacity = reveal ? 1 : 0.45
  return (
    <g opacity={opacity}>
      <rect
        x={cx - cellPx * 0.32}
        y={cy - cellPx * 0.32}
        width={cellPx * 0.64}
        height={cellPx * 0.64}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={reveal ? undefined : '3 2'}
      />
      <text
        x={cx}
        y={cy + cellPx * 0.08}
        textAnchor="middle"
        fontFamily="var(--mono)"
        fontSize={cellPx * 0.32}
        fill={stroke}
      >
        {HAZARD_GLYPHS[hazard.kind] ?? '!'}
      </text>
    </g>
  )
}

// ─── <SpawnMark> ─────────────────────────────────────────────────────────
// Encounter origin + behavior tag. Players never see this layer.

export function SpawnMark({
  spawn,
  cellPx = CELL_PX_DEFAULT,
}: {
  spawn: SpawnT
  cellPx?: number
}) {
  const cx = spawn.origin.q * cellPx + cellPx / 2
  const cy = spawn.origin.r * cellPx + cellPx / 2
  const r = cellPx * 0.38
  const color = spawn.behavior === 'boss'
    ? 'var(--accent-red)'
    : spawn.behavior === 'patrol'
    ? 'var(--accent-blue)'
    : spawn.behavior === 'ambush'
    ? 'var(--accent-gold)'
    : 'var(--ink-2)'
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 3" />
      <text
        x={cx}
        y={cy + cellPx * 0.10}
        textAnchor="middle"
        fontFamily="var(--mono)"
        fontSize={cellPx * 0.30}
        fill={color}
      >
        {spawn.count}×
      </text>
      <text
        x={cx}
        y={cy + cellPx * 0.46}
        textAnchor="middle"
        fontFamily="var(--mono)"
        fontSize={9}
        fill={color}
      >
        {spawn.behavior}
      </text>
      {/* patrol path */}
      {spawn.patrolPath && spawn.patrolPath.length > 1 && (
        <polyline
          points={spawn.patrolPath
            .map((p) => `${p.q * cellPx + cellPx / 2},${p.r * cellPx + cellPx / 2}`)
            .join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={0.7}
        />
      )}
    </g>
  )
}

// ─── <LightHalo> ─────────────────────────────────────────────────────────
// Visual halo for a light source. Optional — separate from per-tile light.

export function LightHalo({
  light,
  cellPx = CELL_PX_DEFAULT,
}: {
  light: LightT
  cellPx?: number
}) {
  const cx = light.at.q * cellPx + cellPx / 2
  const cy = light.at.r * cellPx + cellPx / 2
  const dim = light.radiusDim * cellPx
  const bright = light.radiusBright * cellPx
  const color = light.color ?? 'rgba(255,210,140,0.35)'
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={cx} cy={cy} r={dim} fill={color} opacity={0.25} />
      <circle cx={cx} cy={cy} r={bright} fill={color} opacity={0.4} />
      <circle cx={cx} cy={cy} r={cellPx * 0.10} fill="var(--accent-gold)" />
    </g>
  )
}

// ─── <TexturePicker> ─────────────────────────────────────────────────────
// Category-grouped picker. Each category section shows a row of swatches.

export function TexturePicker({
  selected,
  onSelect,
  size = 36,
  category,
}: {
  selected?: string
  onSelect: (kind: import('@/lib/dungeon/types').TextureKind) => void
  size?: number
  /** Filter to a single category; omit to show all. */
  category?: import('@/lib/dungeon/textures').TexturePattern['category']
}) {
  const cats = category ? [category] : TEXTURE_CATEGORIES
  return (
    <div className="col" style={{ gap: 8 }}>
      {cats.map((cat) => {
        const items = texturesByCategory(cat)
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <div
              className="tiny"
              style={{
                fontFamily: 'var(--mono)',
                color: 'var(--ink-3)',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {cat} <span className="muted">· {items.length}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`,
                gap: 4,
              }}
            >
              {items.map((t) => (
                <button
                  key={t.kind}
                  title={`${t.label} · ${t.kind}`}
                  onClick={() => onSelect(t.kind)}
                  style={{
                    padding: 0,
                    border:
                      selected === t.kind
                        ? '2px solid var(--accent-gold)'
                        : '1px solid var(--rule-soft)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                >
                  <Texture texture={{ kind: t.kind }} size={size} rounded />
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
