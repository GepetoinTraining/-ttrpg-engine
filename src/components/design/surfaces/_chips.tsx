// @ts-nocheck
'use client'

import React from 'react'

// surfaces/_chips.tsx — shared lifecycle vocabulary across all surfaces.
// Centralizes status-pill maps so every surface reads from one source.
// Also: <Chip>, <FidelityBadge>, <EmptyState> — three primitives the audit
// flagged as duplicated/missing.

// ---------------------------------------------------------------
// Status palettes — every enum the engine uses, mapped to chip tag
// ---------------------------------------------------------------
// ('' = neutral / no accent · red / blue / gold / green = themed)

export const STATUS_TAGS = {
  // Guild — JobStatus
  job: {
    open:        'green',
    claimed:     'gold',
    in_progress: 'blue',
    completed:   'green',
    failed:      'red',
    expired:     '',
  },
  // Guild — NPCPartyStatus
  party: {
    idle:       '',
    on_job:     'blue',
    recovering: 'gold',
    traveling:  '',
    disbanded:  'red',
  },
  // Gate — DungeonGateState
  gate: {
    dormant:     '',
    active:      'blue',
    overflowing: 'red',
    capped:      'gold',
    cleared:     'green',
  },
  // MonsterCamp — ActionGrade (6-state)
  grade: {
    backfire: 'red',
    failure:  'red',
    partial:  'gold',
    success:  'green',
    great:    'green',
    critical: 'green',
  },
  // Farms — PlotStatus
  plot: {
    fallow:     '',
    planted:    'blue',
    harvesting: 'gold',
  },
  // Farms / future Land — ClaimStatus
  claim: {
    active:    'green',
    lapsed:    '',
    contested: 'red',
  },
  // Tier-3 future — Shipments / Caravans
  shipment: {
    staged:     '',
    in_transit: 'blue',
    delivered:  'green',
    lost:       'red',
  },
  // Tier-3 future — Contracts (banking, trading-companies)
  contract: {
    proposed:  '',
    active:    'blue',
    fulfilled: 'green',
    breached:  'red',
  },
  // Rumors — tier (also reused for threat reports)
  threat: {
    A: 'red',
    B: 'gold',
    C: '',
  },
}

// Single resolver: <Chip kind="job" value="claimed" />
export function Chip({ kind, value, sm = true, children, label, className = '' }) {
  const tag = (kind && STATUS_TAGS[kind] && STATUS_TAGS[kind][value]) ?? ''
  const text = label ?? children ?? (typeof value === 'string' ? value.replace(/_/g, ' ') : value)
  const cls = `chip ${sm ? 'sm ' : ''}${tag} ${className}`.trim()
  return <span className={cls}>{text}</span>
}

// ---------------------------------------------------------------
// FidelityBadge — auto-rendered in surface-head, tells engine team
// at a glance whether this surface is strip-only / partial / fully bound.
// ---------------------------------------------------------------
const FIDELITY = {
  draft:         { tag: '',      label: 'draft',       hint: 'sketch · in flux' },
  'strip-only':  { tag: '',      label: 'strip-only',  hint: 'mock JSX · awaiting wire' },
  partial:       { tag: 'gold',  label: 'partial',     hint: 'shape matches engine type · some gaps' },
  'fully-bound': { tag: 'green', label: 'fully bound', hint: 'every field present · ready to wire' },
}

export function FidelityBadge({ level = 'strip-only' }) {
  const f = FIDELITY[level] || FIDELITY['strip-only']
  return (
    <span
      className={`chip sm ${f.tag}`}
      title={f.hint}
      style={{
        verticalAlign: 'middle',
        marginLeft: 8,
        fontFamily: 'var(--mono)',
        letterSpacing: '0.06em',
      }}
    >
      ◆ {f.label}
    </span>
  )
}

// ---------------------------------------------------------------
// EmptyState — uniform placeholder for empty rails / lists / tables.
// ---------------------------------------------------------------
export function EmptyState({ label, hint, arrow = false, children = null }) {
  return (
    <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>
      {arrow && (
        <div className="hand" style={{ fontSize: 18, color: 'var(--accent-red)', marginBottom: 6 }}>
          ← {label}
        </div>
      )}
      {!arrow && label && (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 4 }}>
          {label}
        </div>
      )}
      {hint && <div className="tiny" style={{ lineHeight: 1.4 }}>{hint}</div>}
      {children}
    </div>
  )
}
