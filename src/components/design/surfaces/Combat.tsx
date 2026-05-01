// @ts-nocheck
'use client'

import React from 'react'
import Die from './Die'
import { rollDice } from '@/lib/dice'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Combat.tsx — Combat Runner: tactical grid + side panel + card-pile resolution.
// LiveRollWidget at top is fully wired through engine/mf-dice.ts → dice_receipts.
// The runner body (initiative, board, side panel, card piles) is strip-only —
// awaits mm-scene.executeRound + mmCombatAttack. All hardcoded mock content
// has been replaced with EmptyState placeholders for semi-prod.

export default function Combat() {
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">15 · Combat Runner — encounter live</div>
          <h2>Combat <FidelityBadge level="strip-only" /></h2>
        </div>
        <span className="who">DM · live runner</span>
      </div>

      <p style={{maxWidth: 740, color:'var(--ink-2)', marginTop: 0}}>
        Engine map: <span className="kbd">engine/mm-scene.ts</span> — <span className="kbd">executeRound</span>,
        <span className="kbd">mmCombatAttack</span>, concentration, reactions. Players roll on their sheets;
        the runner accepts each roll as a <b>card</b>, queues it, resolves it, and drops it onto the round's
        resolved pile. The DM watches and confirms outliers.
      </p>

      {/* engine reach test — wired to /api/sim/roll → mfDice → dice_receipts */}
      <LiveRollWidget />

      {/* Combat body — pending mm-scene wiring */}
      <div className="grid-3" style={{gap: 14, marginTop: 18}}>
        <div className="box" style={{gridColumn: 'span 2'}}>
          <div className="box-title"><h3>Tactical board</h3><span className="meta">—</span></div>
          <EmptyState
            label="no encounter active"
            hint="bind to mm-scene once a fight starts. board renders tokens, AOEs, terrain, line of sight."
          />
        </div>
        <div className="box">
          <div className="box-title"><h3>Initiative</h3><span className="meta">—</span></div>
          <EmptyState label="no combat in progress" hint="bind to mm-scene.initiativeOrder when a fight starts." />
        </div>
      </div>

      <div className="grid-3" style={{gap: 14, marginTop: 14}}>
        <div className="box" style={{gridColumn: 'span 2'}}>
          <div className="box-title"><h3>Selected actor</h3><span className="meta">—</span></div>
          <EmptyState
            label="no actor selected"
            hint="click a token to surface stat block (CR/AC/HP/Spd/DC/Atk), reaction watch, AI tactic suggestions, action budget."
          />
        </div>
        <div className="box">
          <div className="box-title"><h3>Party HP</h3><span className="meta">—</span></div>
          <EmptyState label="party state pending" hint="bind to mm-party + mm-character HP." />
        </div>
      </div>

      <div className="section-title">Cards in flight</div>
      <div className="grid-3" style={{gap: 14}}>
        {(['Queued', 'Rolling now', 'Resolved'] as const).map(lane => (
          <div key={lane} className="box" style={{padding: 0, minHeight: 180}}>
            <div className="box-title" style={{padding:'10px 12px', margin: 0, borderBottom:'1px solid var(--rule)'}}>
              <h3>{lane}</h3>
              <span className="meta">—</span>
            </div>
            <div style={{padding: 12}}>
              <EmptyState label={`${lane.toLowerCase()} pile empty`} hint="cards land here once players roll on their sheets." />
            </div>
          </div>
        ))}
      </div>

      {/* round controls */}
      <div className="row" style={{justifyContent:'space-between', marginTop: 18, padding: '12px 16px',
                                    border: '1px solid var(--rule)', background: 'var(--paper-2)'}}>
        <div className="row" style={{gap: 14, alignItems:'center'}}>
          <span className="stat muted">no active round</span>
        </div>
        <div className="row" style={{gap: 6}}>
          <button className="btn sm" disabled>undo last</button>
          <button className="btn sm" disabled>pause</button>
          <button className="btn sm" disabled>DM secret roll</button>
          <button className="btn primary" disabled>advance turn →</button>
          <button className="btn" disabled>end round ↻</button>
        </div>
      </div>
    </div>
  )
}

// ── LiveRollWidget ─────────────────────────────────────────────────────────
// Wired strip: each roll → /api/sim/roll → engine/mf-dice.ts → dice_receipts.
// Demonstrates the bridge from this surface to the engine MFs.
function LiveRollWidget() {
  const [log, setLog] = React.useState<any[]>([])
  const [busy, setBusy] = React.useState(false)
  const [last, setLast] = React.useState<{ sides: number; value: number; rolling: boolean }>({
    sides: 20,
    value: 1,
    rolling: false,
  })

  const fire = async (formula: { count: number; sides: number; modifier?: number }, rollType: string, dc?: number) => {
    if (busy) return
    setBusy(true)
    setLast({ sides: formula.sides, value: last.value, rolling: true })
    try {
      const r = await rollDice(formula, { rollType, rollerId: 'combat-runner' })
      setLast({ sides: formula.sides, value: r.output.rolls[0] ?? r.output.total, rolling: true })
      // Let the dice tumble for a beat
      setTimeout(() => setLast((s) => ({ ...s, rolling: false })), 1300)
      const passing = dc != null ? r.output.total >= dc : null
      setLog((l) => [
        {
          id: r.id,
          formula: r.output.formula,
          total: r.output.total,
          rolls: r.output.rolls,
          natural20: r.output.natural20,
          natural1: r.output.natural1,
          rollType,
          dc,
          passing,
          persisted: r.persisted,
        },
        ...l,
      ].slice(0, 6))
    } catch (e: any) {
      setLog((l) => [{ error: e?.message ?? 'roll failed', rollType }, ...l].slice(0, 6))
      setLast((s) => ({ ...s, rolling: false }))
    } finally {
      setBusy(false)
    }
  }

  const dieTypeOf = (sides: number): any => {
    if (sides === 4) return 'd4'
    if (sides === 6) return 'd6'
    if (sides === 8) return 'd8'
    if (sides === 10) return 'd10'
    if (sides === 12) return 'd12'
    return 'd20'
  }

  return (
    <div className="box" style={{ marginTop: 14, padding: 14, borderColor: 'var(--accent-blue)' }}>
      <div className="box-title">
        <h3>Engine reach · live rolls</h3>
        <span className="meta">→ /api/sim/roll → engine/mf-dice.ts → dice_receipts</span>
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Die type={dieTypeOf(last.sides)} value={last.value} size={88} rolling={last.rolling} durationMs={1100} />
        <div className="col" style={{ gap: 6, flex: 1, minWidth: 220 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn sm" disabled={busy} onClick={() => fire({ count: 1, sides: 20, modifier: 0 }, 'd20')}>
              roll d20
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 1, sides: 20, modifier: 5 }, 'attack', 15)}
            >
              attack d20+5 vs DC 15
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 1, sides: 20, modifier: 6 }, 'save', 13)}
            >
              DEX save +6 vs DC 13
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 1, sides: 8, modifier: 3 }, 'damage')}
            >
              damage d8+3
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 4, sides: 6, modifier: 0 }, 'sneak-attack')}
            >
              sneak attack 4d6
            </button>
          </div>
          <div className="tiny muted">each click writes a row to dice_receipts; receipts are deterministic + verifiable</div>
        </div>
      </div>

      {log.length > 0 && (
        <div className="col" style={{ gap: 4, marginTop: 12 }}>
          {log.map((entry, i) =>
            entry.error ? (
              <div key={i} className="tiny" style={{ color: 'var(--accent-red)' }}>
                {entry.rollType}: {entry.error}
              </div>
            ) : (
              <div
                key={entry.id ?? i}
                className="row"
                style={{ gap: 8, fontFamily: 'var(--mono)', fontSize: 12, alignItems: 'center' }}
              >
                <span style={{ width: 110, color: 'var(--ink-3)' }}>{entry.rollType}</span>
                <span style={{ width: 90 }}>{entry.formula}</span>
                <span style={{ width: 110 }}>
                  rolls [{entry.rolls.join(', ')}] →{' '}
                  <b
                    style={{
                      color: entry.natural20
                        ? 'var(--accent-green)'
                        : entry.natural1
                          ? 'var(--accent-red)'
                          : 'var(--ink)',
                    }}
                  >
                    {entry.total}
                  </b>
                </span>
                {entry.dc != null && (
                  <span
                    className="chip sm"
                    style={{
                      fontSize: 9,
                      background: entry.passing ? 'var(--accent-green)' : 'var(--accent-red)',
                      color: 'var(--paper)',
                    }}
                  >
                    {entry.passing ? `pass DC ${entry.dc}` : `fail DC ${entry.dc}`}
                  </span>
                )}
                <span className="tiny muted">
                  receipt {entry.id?.slice(0, 8)}… {entry.persisted ? '✓' : '(not persisted)'}
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
