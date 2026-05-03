'use client'

/**
 * DungeonModals — character sheet / inventory / rest panel.
 * Ported from `surfaces/_ds/DungeonModals.jsx` (design package).
 * Adapted: state lives in props; close/save events bubble to parent.
 */

import * as React from 'react'

export interface PartyMember {
  id: string
  name: string
  race: string
  klass: string
  level: number
  hpCurrent: number
  hpMax: number
  ac: number
  speed: number
  init: number
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  conditions: string[]
  inventory: { id: string; name: string; qty: number; weight: number; valueGP: number }[]
  goldGP: number
}

const ABILITIES: (keyof PartyMember['abilities'])[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function fmtMod(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : String(m)
}

// ── shared modal frame ─────────────────────────────────────────────────────

function ModalFrame({
  title,
  subtitle,
  onClose,
  width = 480,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  width?: number
  children: React.ReactNode
  footer?: React.ReactNode
}): React.ReactElement {
  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(31,27,22,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--paper, #f5efe1)',
          border: '2px solid var(--ink, #1f1b16)',
          boxShadow: '6px 6px 0 var(--ink, #1f1b16)',
          width,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            {subtitle && (
              <div
                style={{
                  fontFamily: 'var(--mono, ui-monospace)',
                  fontSize: 9,
                  color: 'var(--ink-3, #807468)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {subtitle}
              </div>
            )}
            <div
              style={{
                fontFamily: 'var(--serif, Georgia)',
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              fontSize: 22,
              background: 'transparent',
              border: 'none',
              color: 'var(--ink, #1f1b16)',
              cursor: 'pointer',
              padding: '0 8px',
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
        {footer && (
          <div
            style={{
              borderTop: '1px solid var(--rule-soft, #d9cfb8)',
              paddingTop: 12,
              marginTop: 12,
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CharacterSheet ─────────────────────────────────────────────────────────

export function CharacterSheetModal({
  member,
  onClose,
}: {
  member: PartyMember
  onClose: () => void
}): React.ReactElement {
  const hpFrac = member.hpMax > 0 ? member.hpCurrent / member.hpMax : 0
  const hpColor = hpFrac < 0.3 ? '#a8442a' : hpFrac < 0.6 ? '#b08838' : '#2c8a3e'

  return (
    <ModalFrame
      title={member.name}
      subtitle={`${member.race.toUpperCase()} · ${member.klass.toUpperCase()} ${member.level}`}
      onClose={onClose}
      width={520}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* HP / AC / Init / Speed */}
        <div style={{ padding: 10, background: 'var(--paper-2, #ebe2cc)' }}>
          <div
            style={{
              fontSize: 9,
              fontFamily: 'var(--mono, ui-monospace)',
              color: 'var(--ink-3, #807468)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            VITALS
          </div>
          <div style={{ fontFamily: 'var(--mono, ui-monospace)', fontSize: 12 }}>
            <div>
              HP <b style={{ color: hpColor }}>{member.hpCurrent}</b>/{member.hpMax}
            </div>
            <div>AC <b>{member.ac}</b></div>
            <div>SPEED <b>{member.speed}ft</b></div>
            <div>INIT <b>{member.init >= 0 ? `+${member.init}` : member.init}</b></div>
          </div>
        </div>

        {/* Abilities */}
        <div style={{ padding: 10, background: 'var(--paper-2, #ebe2cc)' }}>
          <div
            style={{
              fontSize: 9,
              fontFamily: 'var(--mono, ui-monospace)',
              color: 'var(--ink-3, #807468)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            ABILITIES
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 4,
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
            }}
          >
            {ABILITIES.map((k) => (
              <div key={k}>
                <span style={{ color: 'var(--ink-3, #807468)' }}>{k.toUpperCase()}</span>{' '}
                <b>{member.abilities[k]}</b>{' '}
                <span style={{ color: 'var(--ink-3, #807468)' }}>{fmtMod(member.abilities[k])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conditions */}
      {member.conditions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 9,
              fontFamily: 'var(--mono, ui-monospace)',
              color: 'var(--ink-3, #807468)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            CONDITIONS
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {member.conditions.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 9,
                  padding: '2px 8px',
                  border: '1px solid var(--accent-red, #a8442a)',
                  color: 'var(--accent-red, #a8442a)',
                  fontFamily: 'var(--mono, ui-monospace)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </ModalFrame>
  )
}

// ── Inventory ──────────────────────────────────────────────────────────────

export function InventoryModal({
  member,
  onClose,
}: {
  member: PartyMember
  onClose: () => void
}): React.ReactElement {
  const totalWeight = member.inventory.reduce((s, it) => s + it.weight * it.qty, 0)
  const totalValue = member.inventory.reduce((s, it) => s + it.valueGP * it.qty, 0)

  return (
    <ModalFrame
      title={`${member.name} · Inventory`}
      subtitle={`${member.inventory.length} items · ${totalWeight.toFixed(1)} lb`}
      onClose={onClose}
      width={560}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '8px 10px',
          marginBottom: 10,
          background: 'var(--paper-2, #ebe2cc)',
          fontFamily: 'var(--mono, ui-monospace)',
          fontSize: 11,
        }}
      >
        <span>
          GOLD <b>{member.goldGP} gp</b>
        </span>
        <span>
          WEIGHT <b>{totalWeight.toFixed(1)} lb</b>
        </span>
        <span>
          VALUE <b>{totalValue.toFixed(0)} gp</b>
        </span>
      </div>

      {member.inventory.length === 0 ? (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            color: 'var(--ink-3, #807468)',
            fontStyle: 'italic',
          }}
        >
          No items.
        </div>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--mono, ui-monospace)',
            fontSize: 11,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--rule, #c8bea3)' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px' }}>Item</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Weight</th>
              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {member.inventory.map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid var(--rule-softer, #ece5d3)' }}>
                <td style={{ padding: '4px 6px' }}>
                  <b>{it.name}</b>
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{it.qty}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                  {(it.weight * it.qty).toFixed(1)} lb
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{it.valueGP * it.qty} gp</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModalFrame>
  )
}

// ── Rest Panel ─────────────────────────────────────────────────────────────

export function RestPanelModal({
  party,
  onClose,
  onRest,
}: {
  party: PartyMember[]
  onClose: () => void
  onRest: (type: 'short' | 'long') => void
}): React.ReactElement {
  return (
    <ModalFrame
      title="Take a Rest"
      subtitle="DUNGEON · OUTSIDE COMBAT"
      onClose={onClose}
      width={420}
      footer={
        <>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--ink, #1f1b16)',
              background: 'transparent',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={() => onRest('short')}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--ink, #1f1b16)',
              background: 'var(--paper-2, #ebe2cc)',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            SHORT REST (1 hr)
          </button>
          <button
            onClick={() => onRest('long')}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--ink, #1f1b16)',
              background: 'var(--accent-gold, #b08838)',
              color: 'var(--paper, #f5efe1)',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            LONG REST (8 hr)
          </button>
        </>
      }
    >
      <p
        style={{
          fontSize: 13,
          color: 'var(--ink-2, #463c30)',
          fontFamily: 'var(--serif, Georgia)',
          margin: 0,
          marginBottom: 12,
        }}
      >
        Resting in a hostile dungeon may be interrupted. Pick a defensible chamber.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {party.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
              padding: '4px 8px',
              background: 'var(--paper-2, #ebe2cc)',
            }}
          >
            <span style={{ flex: 1 }}>{m.name}</span>
            <span style={{ color: 'var(--ink-3, #807468)' }}>
              HP {m.hpCurrent}/{m.hpMax}
            </span>
          </div>
        ))}
      </div>
    </ModalFrame>
  )
}
