// @ts-nocheck
'use client'

import React from 'react'
import Die from './Die'
import { rollDice } from '@/lib/dice'
import { EmptyState, FidelityBadge } from './_chips'
import { MMScene } from '../../../../engine/mm-scene'
import type { Combatant, RoundResult } from '../../../../engine/mm-scene'

// surfaces/Combat.tsx — Combat Runner.
// W4.1: Math-symmetric combat. MMScene runs locally on the client. Mob-ai
// drives enemy turns (W3.1). Each round fires `scene.executeRound()` and
// produces receipts displayed in the strip. The full session bundle pushes
// on combat end via DM-shard (when a session is active).

const DEMO_PARTY: Combatant[] = [
  {
    id: 'arden',
    name: 'Arden (Fighter 5)',
    side: 'party',
    initiativeModifier: 2,
    hpCurrent: 42,
    hpMax: 42,
    tempHp: 0,
    ac: 18,
    attackModifier: 7,
    damageDice: { count: 1, sides: 8, modifier: 4 },
    damageType: 'slashing',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
  },
  {
    id: 'elara',
    name: 'Elara (Wizard 5)',
    side: 'party',
    initiativeModifier: 4,
    hpCurrent: 28,
    hpMax: 28,
    tempHp: 0,
    ac: 14,
    attackModifier: 6,
    damageDice: { count: 2, sides: 6, modifier: 3 },
    damageType: 'fire',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
  },
]

const DEMO_MOBS: Combatant[] = [
  {
    id: 'goblin_1',
    name: 'Goblin Sneak',
    side: 'enemy',
    initiativeModifier: 3,
    hpCurrent: 7,
    hpMax: 7,
    tempHp: 0,
    ac: 13,
    attackModifier: 4,
    damageDice: { count: 1, sides: 6, modifier: 2 },
    damageType: 'piercing',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
    mobBehavior: { objective: 'KILL_PCS', temperament: 'COWARD', adaptations: [] },
  },
  {
    id: 'goblin_2',
    name: 'Goblin Brute',
    side: 'enemy',
    initiativeModifier: 1,
    hpCurrent: 12,
    hpMax: 12,
    tempHp: 0,
    ac: 12,
    attackModifier: 4,
    damageDice: { count: 1, sides: 8, modifier: 2 },
    damageType: 'slashing',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
    mobBehavior: { objective: 'KILL_PCS', temperament: 'AGGRESSIVE', adaptations: [] },
  },
  {
    id: 'goblin_zealot',
    name: 'Goblin Zealot',
    side: 'enemy',
    initiativeModifier: 2,
    hpCurrent: 9,
    hpMax: 9,
    tempHp: 0,
    ac: 11,
    attackModifier: 3,
    damageDice: { count: 1, sides: 6, modifier: 1 },
    damageType: 'bludgeoning',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
    mobBehavior: { objective: 'KILL_PCS', temperament: 'BERSERKER', adaptations: [] },
  },
]

export default function Combat() {
  const [scene, setScene] = React.useState<MMScene | null>(null)
  const [rounds, setRounds] = React.useState<RoundResult[]>([])
  const [tick, setTick] = React.useState(0)

  const startCombat = () => {
    const seed = Math.floor(Math.random() * 2147483647)
    const newScene = new MMScene([...DEMO_PARTY, ...DEMO_MOBS], seed)
    setScene(newScene)
    setRounds([])
    setTick((t) => t + 1)
  }

  const runRound = () => {
    if (!scene) return
    const seed = Math.floor(Math.random() * 2147483647)
    const r = scene.executeRound(seed)
    setRounds((prev) => [...prev, r])
    setTick((t) => t + 1)
  }

  const runToCompletion = () => {
    if (!scene) return
    let safety = 30
    let r: RoundResult
    do {
      r = scene.executeRound(Math.floor(Math.random() * 2147483647))
      setRounds((prev) => [...prev, r])
      safety--
    } while (!scene.isOver() && safety > 0)
    setTick((t) => t + 1)
  }

  const reset = () => {
    setScene(null)
    setRounds([])
    setTick((t) => t + 1)
  }

  const initiative = scene?.getInitiativeOrder() ?? []
  const combatants = scene?.getCombatants() ?? []
  const isOver = scene?.isOver() ?? false
  const victor = scene?.getVictor()

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">15 · Combat Runner — encounter live</div>
          <h2>Combat <FidelityBadge level={scene ? 'fully-bound' : 'strip-only'} /></h2>
        </div>
        <span className="who">DM · live runner</span>
      </div>

      <p style={{maxWidth: 740, color:'var(--ink-2)', marginTop: 0}}>
        Engine map: <span className="kbd">engine/mm-scene.ts</span> — <span className="kbd">executeRound</span>,
        <span className="kbd">mob-ai</span>. Math runs on the client; the full session bundle pushes through
        DM-shard at session end. Receipts are first-class.
      </p>

      {/* engine reach test — wired to /api/sim/roll → mfDice → dice_receipts */}
      <LiveRollWidget />

      {/* Combat controls */}
      <div className="box" style={{marginTop: 18, padding: 14, borderColor: 'var(--accent-amber)'}}>
        <div className="box-title">
          <h3>Demo combat · 2 PCs + 3 mobs</h3>
          <span className="meta">{scene ? `round ${scene.getRound()} · ${isOver ? 'OVER' : 'live'}` : 'no scene'}</span>
        </div>
        <div className="row" style={{gap: 6, flexWrap: 'wrap'}}>
          <button className="btn sm" onClick={startCombat}>start combat</button>
          <button className="btn sm primary" disabled={!scene || isOver} onClick={runRound}>run round →</button>
          <button className="btn sm" disabled={!scene || isOver} onClick={runToCompletion}>run to completion</button>
          <button className="btn sm" disabled={!scene} onClick={reset}>reset</button>
          {isOver && victor && (
            <span className="chip sm" style={{background: victor === 'party' ? 'var(--accent-green)' : 'var(--accent-red)', color: 'var(--paper)'}}>
              winner: {victor}
            </span>
          )}
        </div>
      </div>

      {/* Combat body */}
      <div className="grid-3" style={{gap: 14, marginTop: 18}}>
        <div className="box" style={{gridColumn: 'span 2'}}>
          <div className="box-title"><h3>Tactical board</h3><span className="meta">— combatants</span></div>
          {!scene ? (
            <EmptyState label="no encounter active" hint="click 'start combat' to spawn the demo encounter." />
          ) : (
            <div className="col" style={{gap: 6}}>
              {combatants.map((c) => (
                <div key={c.id} className="row" style={{justifyContent: 'space-between', padding: '6px 8px', border: '1px solid var(--rule)', background: c.side === 'party' ? 'rgba(80,200,120,0.05)' : 'rgba(255,80,80,0.05)'}}>
                  <span style={{fontFamily: 'var(--mono)', fontSize: 12}}>
                    {c.side === 'party' ? '🛡' : '🗡'} {c.name}
                  </span>
                  <span style={{fontFamily: 'var(--mono)', fontSize: 12, color: c.status === 'active' ? 'var(--ink)' : 'var(--ink-3)'}}>
                    {c.status === 'active' ? `HP ${c.hpCurrent}/${c.hpMax}` : c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="box">
          <div className="box-title"><h3>Initiative</h3><span className="meta">— order</span></div>
          {initiative.length === 0 ? (
            <EmptyState label="no combat in progress" hint="bind to mm-scene.initiativeOrder when a fight starts." />
          ) : (
            <div className="col" style={{gap: 4}}>
              {initiative.map((entry, i) => (
                <div key={entry.id} className="row" style={{justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--mono)'}}>
                  <span>{i + 1}. {entry.name}</span>
                  <span className="muted">{entry.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Round log */}
      {rounds.length > 0 && (
        <>
          <div className="section-title">Round log</div>
          <div className="col" style={{gap: 10}}>
            {rounds.map((r) => (
              <div key={r.roundNumber} className="box" style={{padding: 10}}>
                <div className="row" style={{justifyContent: 'space-between', marginBottom: 6}}>
                  <h4 style={{margin: 0, fontSize: 13}}>Round {r.roundNumber}</h4>
                  {r.combatOver && <span className="chip sm">combat ends</span>}
                </div>
                <div className="col" style={{gap: 3}}>
                  {r.turns.map((t, i) => (
                    <div key={i} style={{fontSize: 12, fontFamily: 'var(--mono)', color: t.action === 'attack' ? 'var(--ink)' : 'var(--ink-2)'}}>
                      {t.description}
                      {t.mobIntent?.action && t.action !== 'attack' && (
                        <span className="muted" style={{marginLeft: 6}}>· mob-ai: {t.mobIntent.action}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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
