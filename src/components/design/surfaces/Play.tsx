// @ts-nocheck
'use client'

import React from 'react'
import { usePersona } from '@/lib/persona'
import { useSession } from '@/lib/session-context'
import {
  fetchWorldState,
  transportParty as apiTransportParty,
  cronTick as apiCronTick,
  type WorldStatusClient,
} from '@/lib/world-client'
import { useWorld } from '@/lib/use-world'
import { usePersonaCapabilities } from '@/lib/persona-capabilities'
import { EmptyState, FidelityBadge } from './_chips'
import { ReceiptStrip } from '../ReceiptStrip'

// surfaces/Play.tsx — Surface 45. The canonical playable surface.
//
// Singular world, singular surface. All personas (dm, player, gm-ai, dmless)
// look at the same live world. What changes per persona is which action
// panels are visible — DM gets the "transport party" superpower; players see
// only the character-scoped controls.
//
// Wiring status: HUD-driven. Transport + log + persona are bound to useWorld().
// Right-rail panels (party, quests, nearby NPCs) are EmptyState pending
// engine-side aggregation (party state, /api/quest/list bridge, hub NPCs).

export default function Play() {
  const session = useSession()
  const [persona] = usePersona(session.cert?.id ?? null)
  const [tab, setTab] = React.useState<'narrative' | 'log'>('narrative')
  const [pulse, setPulse] = React.useState(0)
  const [actionFeedback, setActionFeedback] = React.useState<string | null>(null)
  const [transportTo, setTransportTo] = React.useState<string>('')
  const [transportTime, setTransportTime] = React.useState<'instant' | 'travel' | 'days'>('instant')
  const [transportDays, setTransportDays] = React.useState<number>(1)
  const [transporting, setTransporting] = React.useState(false)

  // Live world state — fetched on mount + refreshed after transport.
  const [world, setWorld] = React.useState<WorldStatusClient | null>(null)
  const [worldErr, setWorldErr] = React.useState<string | null>(null)
  const [eventLog, setEventLog] = React.useState<{ t: string; kind: string; text: string }[]>([])

  const refreshWorld = React.useCallback(async () => {
    try {
      const s = await fetchWorldState()
      setWorld(s)
      setWorldErr(null)
    } catch (e: unknown) {
      setWorldErr(e instanceof Error ? e.message : 'fetch_failed')
    }
  }, [])

  React.useEffect(() => {
    refreshWorld()
  }, [refreshWorld])

  // World pulse — every 8s a small "tick" lights up the heartbeat indicator.
  React.useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 8000)
    return () => clearInterval(id)
  }, [])

  const fireAction = (label: string) => {
    setActionFeedback(label)
    setTimeout(() => setActionFeedback(null), 1800)
  }

  // ── New flow: useWorld hook (engine-client + IDB-backed account/character) ──
  // Falls back to legacy /api/world/transport if no active character cert is
  // logged in (i.e. user came through the legacy invite flow).
  const worldApi = useWorld()
  const hasNewSession = !!(worldApi.account && worldApi.character && worldApi.worldStatus)

  const transportOptions = world?.destinations ?? []

  // Default transportTo to first option once destinations land.
  React.useEffect(() => {
    if (!transportTo && transportOptions.length > 0) {
      setTransportTo(transportOptions[0].id)
    }
  }, [transportOptions, transportTo])

  const handleTransport = async () => {
    if (!transportTo) return
    setTransporting(true)
    try {
      const days =
        transportTime === 'days' ? transportDays : transportTime === 'travel' ? 3 : 0

      if (hasNewSession) {
        // NEW PATH: client engine produces actions, pushes to flywheel slot.
        // Per `project_next_routing_pass.md`: server doesn't compute, just appends.
        const fromLabel =
          transportOptions.find((o) => o.id === worldApi.worldStatus!.partyNodeId)?.label ??
          worldApi.worldStatus!.partyNodeId
        const destLabel =
          transportOptions.find((o) => o.id === transportTo)?.label ?? transportTo

        worldApi.transport(transportTo, days)
        await worldApi.push()

        const stamp = new Date().toLocaleTimeString().slice(0, 5)
        setEventLog((prev) =>
          [
            {
              t: stamp,
              kind: 'world',
              text: `Party transported ${fromLabel} → ${destLabel}. ${
                days > 0 ? `+${days}d (slot push, drained on next cron)` : 'instant'
              }.`,
            },
            ...prev,
          ].slice(0, 50),
        )
        setActionFeedback(`Transported to ${destLabel} via slot push`)
        setTimeout(() => setActionFeedback(null), 2400)
        await refreshWorld()
        return
      }

      // LEGACY PATH (no IDB account/character — user came via invite flow).
      const result = await apiTransportParty(
        transportTo,
        transportTime,
        transportTime === 'days' ? transportDays : undefined,
      )
      const stamp = new Date().toLocaleTimeString().slice(0, 5)
      setEventLog((prev) =>
        [
          {
            t: stamp,
            kind: 'world',
            text: `Party transported ${result.fromNodeId} → ${result.destLabel}. World day ${result.worldDay} (+${result.daysAdvanced}d).`,
          },
          ...result.observed.map((o) => ({
            t: stamp,
            kind: 'narrative' as const,
            text: o.narrative,
          })),
          ...prev,
        ].slice(0, 50),
      )
      setActionFeedback(`Transported to ${result.destLabel} (+${result.daysAdvanced}d)`)
      setTimeout(() => setActionFeedback(null), 2400)
      await refreshWorld()
    } catch (e: unknown) {
      setActionFeedback(`Transport failed: ${e instanceof Error ? e.message : 'unknown'}`)
      setTimeout(() => setActionFeedback(null), 3000)
    } finally {
      setTransporting(false)
    }
  }

  // When the new IDB flow is active, persona is read from the character
  // cert (FIXED at chargen). Otherwise fall back to the legacy UI toggle.
  const effectivePersonaType = hasNewSession
    ? worldApi.character!.personaType
    : persona.type

  // Derived capabilities — single source of truth for persona-conditional UI.
  // See src/lib/persona-capabilities.ts for the matrix.
  const caps = usePersonaCapabilities()

  // Active character — only known when the IDB cert flow is in use.
  const activeChar = worldApi.character
  const charName = activeChar?.id ?? '—'

  return (
    <div>
      {/* ── HERO STRIP ── */}
      <div className="surface-head">
        <div>
          <div className="crumbs">45 · live · singular world · {effectivePersonaType}</div>
          <h2>{charName} <FidelityBadge level="partial" /></h2>
        </div>
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <span className="tiny" title="World pulse — engine tick rate">
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent-green)',
              marginRight: 6,
              opacity: pulse % 2 === 0 ? 1 : 0.35,
              transition: 'opacity 400ms',
            }} />
            world ticking
            {world && <> · day <b>{world.worldDay}</b></>} · {pulse} pulses
          </span>
        </div>
      </div>

      <div className="aside" style={{ maxWidth: 880, marginBottom: 16 }}>
        ↳ singular play surface · same live world for every persona ·
        DM gets transport + force-event controls · player sees only party-scoped actions.
        {worldErr && (
          <span className="tiny" style={{ color: 'var(--accent-red)', marginLeft: 8 }}>
            · world fetch failed: {worldErr}
          </span>
        )}
      </div>

      {/* ── LOCATION + STATUS STRIP ── */}
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="box" style={{ gridColumn: 'span 2' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div className="tiny">CURRENT LOCATION</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 2 }}>
                {world?.partyNodeLabel ?? <span className="muted">…</span>}
              </div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {world ? (
                  <>node · <span className="kbd">{world.partyNodeType}</span></>
                ) : (
                  <span className="muted">loading…</span>
                )}
              </div>
            </div>
          </div>
          <hr className="rule dashed" />
          <div className="row" style={{ gap: 18, fontFamily: 'var(--mono)', fontSize: 11 }}>
            <div>
              <div className="tiny">WORLD DAY</div>
              <div>{world ? <b>day {world.worldDay}</b> : <span className="muted">—</span>}</div>
            </div>
            <div>
              <div className="tiny">LAST CRON</div>
              <div>{world?.lastCronAt ? new Date(world.lastCronAt).toLocaleString() : <span className="muted">—</span>}</div>
            </div>
            <div>
              <div className="tiny">PERSONA</div>
              <div><b>{effectivePersonaType}</b></div>
            </div>
          </div>
        </div>

        <div className="box dashed" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="placeholder" style={{ minHeight: 132, border: 'none', margin: 0 }}>
            scene illustration · pending wire
          </div>
        </div>
      </div>

      {/* ── MAIN GRID: scene + right rail ── */}
      <div className="grid-3" style={{ alignItems: 'flex-start', gap: 14 }}>
        {/* Scene + log */}
        <div style={{ gridColumn: 'span 2' }} className="col">
          <div className="tabs">
            <div className={`tab ${tab === 'narrative' ? 'active' : ''}`} onClick={() => setTab('narrative')}>
              Scene · narrative
            </div>
            <div className={`tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>
              Recent log · {eventLog.length + (worldApi.log?.length ?? 0)}
            </div>
          </div>

          {tab === 'narrative' && (
            <div className="box">
              <div className="tiny">CURRENT SCENE</div>
              <EmptyState
                label="no active scene"
                hint="scene cards appear when a session starts or the GM advances. inline cards (scene · choice · roll prompt) attach here."
              />
            </div>
          )}

          {tab === 'log' && (
            <div className="box">
              <div className="tiny">SESSION LOG · live</div>
              <div className="col" style={{ gap: 8, marginTop: 6 }}>
                {/* Live local events (transport, ticks) */}
                {eventLog.map((entry, i) => (
                  <div key={`live-${i}`} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', width: 36, paddingTop: 2 }}>
                      {entry.t}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span className={'chip sm ' + (entry.kind === 'roll' ? 'gold' : entry.kind === 'world' ? 'blue' : 'green')} style={{ marginRight: 6 }}>
                        {entry.kind}
                      </span>
                      <span style={{ fontSize: 13 }}>{entry.text}</span>
                    </div>
                  </div>
                ))}
                {/* Live engine log via useWorld (TPB tail, polled every 5s) */}
                {worldApi.log?.map((entry, i) => (
                  <div key={`tpb-${entry.id ?? i}`} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', width: 36, paddingTop: 2 }}>
                      d{entry.worldDay}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span className="chip sm blue" style={{ marginRight: 6 }}>
                        {entry.actionType}
                      </span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>
                        {entry.targetId ?? '—'}
                      </span>
                    </div>
                  </div>
                ))}
                {eventLog.length === 0 && (worldApi.log?.length ?? 0) === 0 && (
                  <EmptyState label="no log entries yet" hint="entries appear here as the engine ticks and the party acts." />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="col" style={{ gap: 12 }}>
          {/* Active character */}
          <div className="box">
            <div className="box-title">
              <h3>You</h3>
              <span className="meta">{activeChar ? 'active' : '—'}</span>
            </div>
            {activeChar ? (
              <div className="col" style={{ gap: 4, fontSize: 13 }}>
                <div><b>cert</b> <span className="kbd">{activeChar.id.slice(0, 8)}…</span></div>
                <div><b>persona</b> {activeChar.personaType}</div>
                <div><b>created</b> day {activeChar.createdAt ? new Date(activeChar.createdAt).toLocaleDateString() : '—'}</div>
              </div>
            ) : (
              <EmptyState label="no active character" hint="log into the world from CharacterSelect to bind a cert." />
            )}
          </div>

          {/* Receipt strip — math proof for recent computations */}
          <div className="box">
            <div className="box-title">
              <h3>Receipts</h3>
              <span className="meta">last {Math.min(10, worldApi.engine?.getRecentReceipts(10).length ?? 0)}</span>
            </div>
            <ReceiptStrip receipts={worldApi.engine?.getRecentReceipts(10) ?? []} limit={10} />
          </div>

          {/* Party — all known characters (cert-hash party formation pending) */}
          <div className="box">
            <div className="box-title">
              <h3>Party</h3>
              <span className="meta">{worldApi.partyMembers.length}</span>
            </div>
            {worldApi.partyMembers.length === 0 ? (
              <EmptyState label="no characters yet" hint="run chargen to create one." />
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {worldApi.partyMembers.map((c) => {
                  const isYou = c.id === activeChar?.id
                  const classLine = c.classes.map((cl) => `${cl.className} ${cl.level}`).join(', ') || '—'
                  const hpPct = c.hpMax > 0 ? Math.round((c.hpCurrent / c.hpMax) * 100) : 0
                  return (
                    <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 4 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--serif)', fontWeight: isYou ? 700 : 500 }}>
                          {isYou && '› '}{c.name}
                        </div>
                        <div className="tiny muted">{classLine}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 84 }}>
                        <div className="bar gold" style={{ width: 64 }}>
                          <span style={{ width: `${hpPct}%` }} />
                        </div>
                        <div className="tiny">{c.hpCurrent}/{c.hpMax}</div>
                      </div>
                    </div>
                  )
                })}
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  ↳ cert-hash party formation pending — for now lists all characters.
                </div>
              </div>
            )}
          </div>

          {/* Quest board — bridged via /api/quest/list */}
          <div className="box">
            <div className="box-title">
              <h3>Quest board</h3>
              <span className="meta">{worldApi.arcs.length} arc{worldApi.arcs.length === 1 ? '' : 's'}</span>
            </div>
            {worldApi.arcs.length === 0 ? (
              <EmptyState label="no quests" hint="seed arcs / quests via narrative authoring." />
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {worldApi.arcs.flatMap((arc: any) =>
                  (arc.quests ?? []).slice(0, 3).map((q: any) => (
                    <div key={q.id} style={{ borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{q.objective ?? q.title ?? q.id}</div>
                      <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
                        <span className="tiny muted">{arc.title ?? arc.kind ?? 'arc'}</span>
                        <span className="chip sm">{q.status ?? '—'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => (window.location.hash = '#guild')}>open Guild →</button>
          </div>

          {/* Nearby NPCs — scoped to partyNodeId via /api/npc/list */}
          <div className="box">
            <div className="box-title">
              <h3>Nearby</h3>
              <span className="meta">{worldApi.nearbyNpcs.length}</span>
            </div>
            {worldApi.nearbyNpcs.length === 0 ? (
              <EmptyState label="no NPCs at this node" hint="seed npcs at the current settlement, or move to a populated node." />
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {worldApi.nearbyNpcs.slice(0, 8).map((n) => (
                  <div key={n.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>
                      <span style={{
                        color: n.disposition === 'friendly' ? 'var(--accent-green)'
                              : n.disposition === 'hostile' ? 'var(--accent-red)'
                              : 'var(--ink-3)',
                      }}>●</span>{' '}
                      {n.name}
                    </span>
                    <span className="tiny muted">{n.role ?? n.craft ?? '—'}</span>
                  </div>
                ))}
                {worldApi.nearbyNpcs.length > 8 && (
                  <div className="tiny muted">+{worldApi.nearbyNpcs.length - 8} more · open Roster →</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ACTION PANEL ── */}
      <div className="box" style={{ marginTop: 18, position: 'sticky', bottom: 0, background: 'var(--paper)', boxShadow: '0 -4px 12px var(--paper-2)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="section-title">Actions</div>
          {actionFeedback && (
            <span className="tiny" style={{ color: 'var(--accent-green)' }}>
              ✓ {actionFeedback}
            </span>
          )}
        </div>
        <hr className="rule dashed" />

        {/* Generic actions — wired chips that produce engine intents */}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <button
            className="btn sm"
            disabled={!hasNewSession}
            onClick={() => {
              worldApi.observe()
              fireAction('observe queued')
            }}
          >↳ Observe location</button>
          <button
            className="btn sm"
            disabled={!hasNewSession}
            onClick={() => {
              const r = worldApi.roll('1d20')
              if (r) fireAction(`d20 = ${r.output} (${r.receipt.verified ? 'ok' : 'invalid'})`)
              else fireAction('roll requires active character')
            }}
          >🎲 Roll d20</button>
          <button
            className="btn sm"
            disabled={!hasNewSession || worldApi.pendingCount === 0}
            onClick={async () => {
              try {
                await worldApi.push()
                fireAction('pushed pending actions')
              } catch (e: unknown) {
                fireAction(`push failed: ${e instanceof Error ? e.message : 'unknown'}`)
              }
            }}
          >⤴ Push pending ({worldApi.pendingCount})</button>
          <button
            className="btn sm"
            disabled={!hasNewSession || worldApi.pendingCount === 0}
            onClick={() => {
              worldApi.discardPending()
              fireAction('discarded pending')
            }}
          >✕ Discard pending</button>
          <button className="btn sm" onClick={() => (window.location.hash = '#actions')}>📜 Actions surface →</button>
        </div>

        {/* GM-only superpowers — DM + GM-AI both have transport authority. */}
        {caps?.canTransportParty && (
          <div style={{
            marginTop: 10,
            padding: 10,
            border: '1px dashed var(--accent-red)',
            background: 'rgba(168, 68, 42, 0.05)',
          }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div className="tiny" style={{ color: 'var(--accent-red)', letterSpacing: '0.06em', fontWeight: 600 }}>
                {caps?.personaType === 'gm-ai' ? 'GM-AI · DM CONTROLS' : 'DM CONTROLS'}
              </div>
              <span className="tiny muted">visible only to gm authority ({caps?.personaType ?? '—'})</span>
            </div>

            {/* Transport party */}
            {transportOptions.length === 0 ? (
              <EmptyState label="no destinations" hint="world state has no destinations yet — bind to TP graph or wait for first transport push." />
            ) : (
              <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="tiny">Transport party to</div>
                  <select
                    value={transportTo}
                    onChange={(e) => setTransportTo(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontFamily: 'var(--serif)', background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  >
                    {transportOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} · {opt.type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="tiny">Travel time</div>
                  <div className="row" style={{ gap: 4 }}>
                    {(['instant', 'travel', 'days'] as const).map((mode) => (
                      <button
                        key={mode}
                        className={'btn sm' + (transportTime === mode ? ' primary' : '')}
                        onClick={() => setTransportTime(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                {transportTime === 'days' && (
                  <div>
                    <div className="tiny">Days</div>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={transportDays}
                      onChange={(e) => setTransportDays(Math.max(0, Number(e.target.value) || 0))}
                      style={{ width: 64, padding: '6px 8px', fontFamily: 'var(--mono)', background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                    />
                  </div>
                )}
                <button
                  className="btn sm primary"
                  disabled={transporting || !transportTo}
                  onClick={handleTransport}
                >
                  {transporting ? '… transporting' : '✦ Transport party'}
                </button>
              </div>
            )}

            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                className="btn sm"
                onClick={async () => {
                  try {
                    const r = await apiCronTick(1)
                    const stamp = new Date().toLocaleTimeString().slice(0, 5)
                    setEventLog((prev) => [
                      { t: stamp, kind: 'world', text: `Cron +1d → world day ${r.worldDay}.` },
                      ...prev,
                    ].slice(0, 50))
                    fireAction(`Tick +1d → day ${r.worldDay}`)
                    await refreshWorld()
                  } catch (e: unknown) {
                    fireAction(`Tick failed: ${e instanceof Error ? e.message : 'unknown'}`)
                  }
                }}
              >tick +1d</button>
              <button
                className="btn sm"
                onClick={async () => {
                  try {
                    const r = await apiCronTick(7)
                    const stamp = new Date().toLocaleTimeString().slice(0, 5)
                    setEventLog((prev) => [
                      { t: stamp, kind: 'world', text: `Cron +7d → world day ${r.worldDay}.` },
                      ...prev,
                    ].slice(0, 50))
                    fireAction(`Tick +7d → day ${r.worldDay}`)
                    await refreshWorld()
                  } catch (e: unknown) {
                    fireAction(`Tick failed: ${e instanceof Error ? e.message : 'unknown'}`)
                  }
                }}
              >tick +1w</button>
            </div>

            {world?.lastCronAt && (
              <div className="tiny muted" style={{ marginTop: 8 }}>
                last cron tick: {new Date(world.lastCronAt).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* DMless mode hint — lives at server-cron time, can't fast-travel */}
        {caps?.livesAtServerTime && (
          <div className="aside" style={{ marginTop: 10, fontSize: 14 }}>
            ↳ no GM. world ticks autonomously. when you act, the engine resolves;
            when you wait, time passes and events come from κ + guild + monster ticks.
          </div>
        )}

        {/* Player mode hint */}
        {caps?.personaType === 'player' && (
          <div className="aside blue" style={{ marginTop: 10, fontSize: 14 }}>
            ↳ you're at the table with a human DM. wait for their narration or
            click an action to declare your intent.
          </div>
        )}
      </div>
    </div>
  )
}
