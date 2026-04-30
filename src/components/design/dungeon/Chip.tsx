'use client'

/**
 * <Chip> — moveable token on the dungeon grid.
 *
 * The chip is the *abstraction that moves*: a ring frame + tone color +
 * optional portrait + HP arc + status effect markers. The portrait inside
 * is loaded from `portraitUrl` (Gemini-generated at runtime); when missing,
 * we render a fallback "initial" letter inside the ring.
 *
 * Renders entirely as inline SVG so it scales with the grid and can be
 * recolored via the palette tokens. No image asset is required for the
 * frame itself — only the portrait URL is external.
 */

import React from 'react'
import {
  CELL_PX_DEFAULT,
  type CellCoord,
  type Token,
  type TokenTone,
  type ChipFrame,
  type TokenStatus,
} from '@/lib/dungeon/types'

const TONE_COLORS: Record<TokenTone, { ring: string; fill: string; ink: string }> = {
  ally:    { ring: 'var(--accent-blue)',  fill: 'var(--paper)',   ink: 'var(--ink)' },
  party:   { ring: 'var(--accent-blue)',  fill: 'var(--paper)',   ink: 'var(--ink)' },
  hostile: { ring: 'var(--accent-red)',   fill: 'var(--paper)',   ink: 'var(--accent-red)' },
  neutral: { ring: 'var(--ink-3)',        fill: 'var(--paper)',   ink: 'var(--ink-2)' },
  boss:    { ring: 'var(--accent-gold)',  fill: 'var(--ink)',     ink: 'var(--paper)' },
  mystery: { ring: 'var(--ink-2)',        fill: 'var(--paper-3)', ink: 'var(--ink-3)' },
}

const SIZE_RADIUS: Record<NonNullable<Token['size']>, number> = {
  tiny: 0.32,
  small: 0.4,
  medium: 0.46,
  large: 0.7,         // overflows the cell — caller can choose to span 2x2
  huge: 0.95,
  gargantuan: 1.4,
}

const STATUS_GLYPHS: Record<TokenStatus, string> = {
  poisoned: '☣', frightened: '!', grappled: '⌘', prone: '↓', restrained: '⊗',
  blinded: '◐', charmed: '♥', paralyzed: '✕', stunned: '★', unconscious: '✖',
  concentrating: '◉', invisible: '◌', flying: '↑', bloodied: '♦',
}

const STATUS_COLORS: Partial<Record<TokenStatus, string>> = {
  poisoned: 'var(--accent-green)',
  frightened: 'var(--accent-gold)',
  bloodied: 'var(--accent-red)',
  concentrating: 'var(--accent-blue)',
  unconscious: 'var(--accent-red)',
  flying: 'var(--accent-blue)',
}

interface ChipProps {
  token: Token
  cellPx?: number
  selected?: boolean
  onClick?: (token: Token) => void
  /** Show the token name as a label below the chip. */
  showLabel?: boolean
}

export function Chip({
  token,
  cellPx = CELL_PX_DEFAULT,
  selected = false,
  onClick,
  showLabel = true,
}: ChipProps) {
  const tone = TONE_COLORS[token.tone] ?? TONE_COLORS.neutral
  const radiusFactor = SIZE_RADIUS[token.size ?? 'medium']
  const cx = token.at.q * cellPx + cellPx / 2
  const cy = token.at.r * cellPx + cellPx / 2
  const r = cellPx * radiusFactor
  const portraitId = `chip-portrait-${token.id}`
  const hpPct = token.hp ? Math.max(0, Math.min(1, token.hp.current / token.hp.max)) : null

  return (
    <g
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick ? () => onClick(token) : undefined}
    >
      {/* Selection halo */}
      {selected && (
        <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="var(--accent-gold)" strokeWidth={2} strokeDasharray="3 3" />
      )}

      {/* Frame styling per ChipFrame */}
      <FrameDecor cx={cx} cy={cy} r={r} tone={tone} frame={token.frame ?? 'plain'} />

      {/* Inner fill (background behind the portrait) */}
      <circle cx={cx} cy={cy} r={r - 4} fill={tone.fill} stroke={tone.ring} strokeWidth={2.5} />

      {/* Portrait — clipped to inner circle */}
      <defs>
        <clipPath id={portraitId}>
          <circle cx={cx} cy={cy} r={r - 5} />
        </clipPath>
      </defs>
      {token.portraitUrl ? (
        <image
          href={token.portraitUrl}
          x={cx - (r - 5)}
          y={cy - (r - 5)}
          width={(r - 5) * 2}
          height={(r - 5) * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${portraitId})`}
        />
      ) : (
        <text
          x={cx}
          y={cy + r * 0.12}
          textAnchor="middle"
          fontFamily="var(--serif)"
          fontSize={r * 0.85}
          fontWeight={700}
          fill={tone.ink}
        >
          {(token.initial ?? token.name?.[0] ?? '?').toUpperCase()}
        </text>
      )}

      {/* HP arc */}
      {hpPct != null && (
        <HPArc cx={cx} cy={cy} r={r + 1} fraction={hpPct} />
      )}

      {/* Status markers around the perimeter */}
      {token.status?.map((s, i) => {
        const angle = (-Math.PI / 2) + (i / Math.max(1, token.status!.length)) * (Math.PI * 2)
        const sx = cx + Math.cos(angle) * (r + 7)
        const sy = cy + Math.sin(angle) * (r + 7)
        const color = STATUS_COLORS[s] ?? 'var(--ink-2)'
        return (
          <g key={s}>
            <circle cx={sx} cy={sy} r={6} fill="var(--paper)" stroke={color} strokeWidth={1.5} />
            <text
              x={sx}
              y={sy + 3}
              textAnchor="middle"
              fontFamily="var(--mono)"
              fontSize={9}
              fill={color}
            >
              {STATUS_GLYPHS[s] ?? '?'}
            </text>
          </g>
        )
      })}

      {/* Label below */}
      {showLabel && (
        <text
          x={cx}
          y={cy + r + 14}
          textAnchor="middle"
          fontFamily="var(--mono)"
          fontSize={Math.min(11, r * 0.32)}
          fill="var(--ink)"
        >
          {token.name}
        </text>
      )}
    </g>
  )
}

// ─── Frame decoration variants ────────────────────────────────────────────

function FrameDecor({
  cx,
  cy,
  r,
  tone,
  frame,
}: {
  cx: number
  cy: number
  r: number
  tone: { ring: string; fill: string; ink: string }
  frame: ChipFrame
}) {
  if (frame === 'plain') {
    return (
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone.ring} strokeWidth={3} />
    )
  }
  if (frame === 'iron') {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone.ring} strokeWidth={3} />
        {/* rivets */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const a = (deg * Math.PI) / 180
          const px = cx + Math.cos(a) * r
          const py = cy + Math.sin(a) * r
          return <circle key={deg} cx={px} cy={py} r={1.8} fill={tone.ring} />
        })}
      </g>
    )
  }
  if (frame === 'magical') {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={tone.ring} strokeWidth={1} strokeDasharray="2 3" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone.ring} strokeWidth={3} />
      </g>
    )
  }
  // laurel: a thicker double ring with a tiny crown notch at top
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={tone.ring} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={tone.ring} strokeWidth={3} />
      <path
        d={`M ${cx - 5} ${cy - r - 1} L ${cx} ${cy - r - 6} L ${cx + 5} ${cy - r - 1} Z`}
        fill={tone.ring}
      />
    </g>
  )
}

// ─── HP arc ───────────────────────────────────────────────────────────────
// Arcs around the chip from -90° (top) clockwise. fraction=1 → full ring.

function HPArc({ cx, cy, r, fraction }: { cx: number; cy: number; r: number; fraction: number }) {
  const start = -Math.PI / 2
  const end = start + Math.PI * 2 * fraction
  const x1 = cx + Math.cos(start) * r
  const y1 = cy + Math.sin(start) * r
  const x2 = cx + Math.cos(end) * r
  const y2 = cy + Math.sin(end) * r
  const largeArc = fraction > 0.5 ? 1 : 0
  const color =
    fraction > 0.5 ? 'var(--accent-green)' : fraction > 0.25 ? 'var(--accent-gold)' : 'var(--accent-red)'
  if (fraction <= 0) {
    return <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-red)" strokeWidth={2} strokeDasharray="3 2" />
  }
  if (fraction >= 1) {
    return <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2} />
  }
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(31,27,22,0.15)" strokeWidth={2} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} />
    </g>
  )
}

// ─── Layer helper ─────────────────────────────────────────────────────────

export function ChipLayer({
  tokens,
  cellPx,
  selectedId,
  onSelect,
}: {
  tokens: Token[]
  cellPx?: number
  selectedId?: string
  onSelect?: (token: Token) => void
}) {
  return (
    <g>
      {tokens.map((t) => (
        <Chip
          key={t.id}
          token={t}
          cellPx={cellPx}
          selected={selectedId === t.id}
          onClick={onSelect}
        />
      ))}
    </g>
  )
}
