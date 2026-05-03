'use client'

/**
 * CharacterCard — reusable summary card for a character (PC, NPC, follower).
 *
 * Shows portrait/initial + name + class line + HP bar. Clickable to drill in.
 * No fixed pixel width — sizes to its container.
 *
 * Shape is intentionally minimal so it accepts CharacterListItem (from
 * src/lib/character.ts) as well as engine character data — duck-typed via
 * the props interface.
 */

import * as React from 'react'

export interface CharacterCardData {
  id: string
  name: string
  race?: string
  subrace?: string | null
  /** [{className, level}] — multiclass-aware. */
  classes?: { className: string; level: number }[]
  hpCurrent?: number
  hpMax?: number
  ac?: number
  /** Url to a portrait image; falls back to first letter if missing. */
  portraitUrl?: string
  /** 'player' | 'gm-ai' | 'dm' | 'dmless' — drives the persona indicator. */
  personaType?: string
  /** Player handle (when persona = player) or 'AI' / '—'. */
  handler?: string
  /** Render a mini view (compact card for sidebars / strips). */
  compact?: boolean
}

interface CharacterCardProps extends CharacterCardData {
  onClick?: (id: string) => void
  selected?: boolean
}

const PERSONA_GLYPH: Record<string, string> = {
  player: '👤',
  dm: '◆',
  'gm-ai': '◇',
  dmless: '○',
  npc: '◇',
}

export function CharacterCard({
  id,
  name,
  race,
  subrace,
  classes = [],
  hpCurrent,
  hpMax,
  ac,
  portraitUrl,
  personaType,
  handler,
  compact = false,
  onClick,
  selected = false,
}: CharacterCardProps) {
  const classLine = classes.length === 0
    ? '—'
    : classes.map((c) => `${c.className} ${c.level}`).join(' / ')
  const hpFrac = hpMax && hpMax > 0 ? Math.max(0, Math.min(1, (hpCurrent ?? 0) / hpMax)) : null
  const hpColor = hpFrac == null
    ? 'var(--ink-3)'
    : hpFrac < 0.3 ? 'var(--accent-red)'
    : hpFrac < 0.6 ? 'var(--accent-gold)'
    : 'var(--accent-green)'
  const initial = (name?.[0] ?? '?').toUpperCase()

  return (
    <button
      onClick={onClick ? () => onClick(id) : undefined}
      style={{
        background: selected ? 'var(--paper-2)' : 'var(--paper)',
        border: `1px solid ${selected ? 'var(--ink)' : 'var(--rule-soft)'}`,
        padding: compact ? '8px 10px' : '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        display: 'flex',
        gap: 12,
        alignItems: compact ? 'center' : 'flex-start',
        width: '100%',
        minWidth: 0,
        fontFamily: 'inherit',
        color: 'inherit',
      }}
    >
      {/* Portrait / initial */}
      <div
        style={{
          width: compact ? 36 : 48,
          height: compact ? 36 : 48,
          borderRadius: '50%',
          background: portraitUrl ? 'transparent' : 'var(--paper-2)',
          border: '2px solid var(--ink)',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--serif)',
          fontSize: compact ? 16 : 22,
          fontWeight: 700,
          color: 'var(--ink)',
        }}
      >
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initial
        )}
      </div>

      {/* Name + class + handler */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: compact ? 14 : 16, fontWeight: 600, lineHeight: 1.2 }}>
            {name}
          </span>
          {personaType && (
            <span title={personaType} style={{ fontSize: 11 }}>
              {PERSONA_GLYPH[personaType] ?? '·'}
            </span>
          )}
        </div>
        {!compact && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            {[race, subrace].filter(Boolean).join(' · ')}{race ? ' · ' : ''}{classLine}
          </div>
        )}
        {compact && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
            {classLine}
          </div>
        )}
        {handler && !compact && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
            handler: {handler}
          </div>
        )}
      </div>

      {/* HP + AC */}
      {(hpFrac !== null || ac !== undefined) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, minWidth: compact ? 60 : 80 }}>
          {hpFrac !== null && (
            <>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: hpColor }}>
                {hpCurrent}/{hpMax}
              </div>
              <div style={{ width: compact ? 60 : 80, height: 4, background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ width: `${hpFrac * 100}%`, height: '100%', background: hpColor }} />
              </div>
            </>
          )}
          {ac !== undefined && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              AC <b style={{ color: 'var(--ink)' }}>{ac}</b>
            </div>
          )}
        </div>
      )}
    </button>
  )
}
