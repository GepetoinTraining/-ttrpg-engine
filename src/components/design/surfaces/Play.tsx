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

// surfaces/Play.tsx — Surface 45. The canonical playable surface.
//
// Singular world, singular surface. All personas (dm, player, gm-ai, dmless)
// look at the same live world. What changes per persona is which action
// panels are visible — DM gets the "transport party" superpower; players see
// only the character-scoped controls.
//
// HUD-driven (Option B): hero strip up top, scene card in the middle,
// right rail with companions / quests / nearby, action chips at the bottom.
// World pulse indicator shows the engine ticking.
//
// strip-only fidelity — wires later.

const NEARBY_NPCS = [
  { id: 'elara',  name: 'Elara Stormwind',  role: 'cleric',  rel: 'ally',     hp: 22, maxHp: 24 },
  { id: 'valk',   name: 'Valkyr Hammerfall', role: 'smith',   rel: 'merchant', hp: 0,  maxHp: 0 },
  { id: 'mira',   name: 'Mira Songbird',    role: 'patron',  rel: 'patron',   hp: 0,  maxHp: 0 },
  { id: 'rhett',  name: 'Rhett the Watch',  role: 'guard',   rel: 'neutral',  hp: 18, maxHp: 18 },
]

const NEARBY_QUESTS = [
  { id: 'q1', label: 'Retrieve mythril for Valk', src: 'Smithy', danger: 3, reward: 320 },
  { id: 'q2', label: 'Bounty: brigand chief Rake', src: "Adventurer's Guild", danger: 3, reward: 500 },
  { id: 'q3', label: 'Escort caravan to Marsember', src: 'Caravan guild', danger: 1, reward: 180 },
]

const COMPANIONS = [
  { id: 'k', name: 'Kaelith', role: 'wizard',  hp: 24, maxHp: 30, you: true },
  { id: 'b', name: 'Bren',    role: 'fighter', hp: 38, maxHp: 42 },
  { id: 'i', name: 'Iris',    role: 'rogue',   hp: 22, maxHp: 25 },
]

const RECENT_LOG = [
  { t: '14:32', kind: 'narrative', text: 'You step out of the inn into the Trades Ward. Caravans rumble past; rain threatens.' },
  { t: '14:28', kind: 'world',     text: 'Eleasis 23 · clear → light rain · weather τ ticked.' },
  { t: '14:15', kind: 'roll',      text: 'Persuasion check: d20=14 +3 = 17 vs DC 15 — success.' },
  { t: '14:14', kind: 'narrative', text: '"Three gold pieces, no haggling," Elara says, fixing you a meal.' },
  { t: '14:00', kind: 'world',     text: 'Adventurer\'s Guild posted: bounty Rake the brigand · 500gp · expires 12d.' },
]

// Fallback transport options used until the live world state arrives.
const FALLBACK_TRANSPORT_OPTIONS = [
  { id: 'suzail', label: 'Suzail · Trades Ward',  type: 'settlement' },
  { id: 'wheloon', label: 'Wheloon · gates',       type: 'settlement' },
  { id: 'marsember', label: 'Marsember · docks',   type: 'settlement' },
  { id: 'high_road_25', label: 'High Road · mile 25', type: 'edge_site' },
  { id: 'cormanthor_portal', label: 'Cormanthor portal', type: 'poi' },
  { id: 'sunset_vault', label: 'Sunset Vault · ruin', type: 'poi' },
]

export default function Play() {
  const session = useSession()
  const [persona] = usePersona(session.cert?.id ?? null)
  const [tab, setTab] = React.useState<'narrative' | 'log'>('narrative')
  const [pulse, setPulse] = React.useState(0)
  const [actionFeedback, setActionFeedback] = React.useState<string | null>(null)
  const [transportTo, setTransportTo] = React.useState<string>('suzail')
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

  const handleTransport = async () => {
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

  const transportOptions = world?.destinations ?? FALLBACK_TRANSPORT_OPTIONS

  // When the new IDB flow is active, persona is read from the character
  // cert (FIXED at chargen). Otherwise fall back to the legacy UI toggle.
  const effectivePersonaType = hasNewSession
    ? worldApi.character!.personaType
    : persona.type

  const isDM     = effectivePersonaType === 'dm'
  const isAI     = effectivePersonaType === 'gm-ai'
  const isDMless = effectivePersonaType === 'dmless'
  const isPlayer = effectivePersonaType === 'player'

  const you = COMPANIONS.find((c) => c.you) ?? COMPANIONS[0]

  return (
    <div>
      {/* ── HERO STRIP ── */}
      <div className="surface-head">
        <div>
          <div className="crumbs">45 · live · singular world · {persona.type}</div>
          <h2>{you.name} · {you.role}</h2>
        </div>
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <span className="chip blue">HP {you.hp}/{you.maxHp}</span>
          <span className="chip gold">47 gp</span>
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
                {world?.partyNodeLabel ?? 'Suzail · Trades Ward'}
              </div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {world ? (
                  <>node type · <span className="kbd">{world.partyNodeType}</span></>
                ) : (
                  <>inside · daytime market · paved</>
                )}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">indoor</span>
              <span className="chip blue">safe</span>
            </div>
          </div>
          <hr className="rule dashed" />
          <div className="row" style={{ gap: 18, fontFamily: 'var(--mono)', fontSize: 11 }}>
            <div>
              <div className="tiny">TIME</div>
              <div><b>Eleasis 23</b> · 14:32</div>
            </div>
            <div>
              <div className="tiny">WEATHER</div>
              <div>clear → light rain</div>
            </div>
            <div>
              <div className="tiny">SEASON</div>
              <div>summer · 23/30</div>
            </div>
            <div>
              <div className="tiny">DANGER</div>
              <div>0.12 · low</div>
            </div>
          </div>
        </div>

        <div className="box dashed" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="placeholder" style={{ minHeight: 132, border: 'none', margin: 0 }}>
            scene illustration · drop image
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
              Recent log · {RECENT_LOG.length}
            </div>
          </div>

          {tab === 'narrative' && (
            <div className="box">
              <div className="tiny">CURRENT SCENE</div>
              <div className="hand" style={{ fontSize: 22, color: 'var(--accent-red)', marginTop: 4 }}>
                a market in motion
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.55, marginTop: 8 }}>
                You step out of the inn into the Trades Ward. The morning rush has thinned;
                caravans rumble past, hooves wet on cobblestones, and the smell of bread
                from Valk's neighbor wafts up the alley. <b>Elara</b> spots you from her stall —
                she already has your usual ready.
              </p>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 10 }}>
                A scrap of news drifts past: <span className="chip sm">rumor</span>{' '}
                <i>"the portal in Cormanthor is overflowing — Crown will pay double for the leader's head."</i>
              </p>
              <hr className="rule dashed" />
              <div className="tiny muted">
                inline cards (scene · choice · roll prompt) attach here when the GM advances the story.
              </div>
            </div>
          )}

          {tab === 'log' && (
            <div className="box">
              <div className="tiny">SESSION LOG · last hour</div>
              <div className="col" style={{ gap: 8, marginTop: 6 }}>
                {/* Live events first (transports, observations) */}
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
                {/* Mock backfill */}
                {RECENT_LOG.map((entry, i) => (
                  <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', width: 36, paddingTop: 2 }}>
                      {entry.t}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span className={'chip sm ' + (entry.kind === 'roll' ? 'gold' : entry.kind === 'world' ? 'blue' : '')} style={{ marginRight: 6 }}>
                        {entry.kind}
                      </span>
                      <span style={{ fontSize: 13 }}>{entry.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="col" style={{ gap: 12 }}>
          {/* Companions */}
          <div className="box">
            <div className="box-title">
              <h3>Party</h3>
              <span className="meta">{COMPANIONS.length}</span>
            </div>
            <div className="col" style={{ gap: 6 }}>
              {COMPANIONS.map((c) => (
                <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 4 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontWeight: c.you ? 700 : 500 }}>
                      {c.you && '› '}{c.name}
                    </div>
                    <div className="tiny muted">{c.role}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 84 }}>
                    <div className="bar gold" style={{ width: 64 }}>
                      <span style={{ width: `${(c.hp / c.maxHp) * 100}%` }} />
                    </div>
                    <div className="tiny">{c.hp}/{c.maxHp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nearby quests */}
          <div className="box">
            <div className="box-title">
              <h3>Quest board</h3>
              <span className="meta">{NEARBY_QUESTS.length}</span>
            </div>
            <div className="col" style={{ gap: 6 }}>
              {NEARBY_QUESTS.map((q) => (
                <div key={q.id} style={{ borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{q.label}</div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
                    <span className="tiny muted">{q.src}</span>
                    <span className="tiny">
                      <span className="chip sm gold">{q.reward}gp</span>{' '}
                      <span className="chip sm red">d{q.danger}</span>
                    </span>
                  </div>
                </div>
              ))}
              <button className="btn sm" style={{ marginTop: 4 }}>open Guild →</button>
            </div>
          </div>

          {/* NPCs at hub */}
          <div className="box">
            <div className="box-title">
              <h3>Nearby</h3>
              <span className="meta">{NEARBY_NPCS.length}</span>
            </div>
            <div className="col" style={{ gap: 6 }}>
              {NEARBY_NPCS.map((n) => (
                <div key={n.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>
                    <span style={{
                      color: n.rel === 'ally' ? 'var(--accent-blue)'
                            : n.rel === 'patron' ? 'var(--accent-gold)'
                            : n.rel === 'merchant' ? 'var(--ink-2)'
                            : 'var(--ink-3)',
                    }}>●</span>{' '}
                    {n.name}
                  </span>
                  <span className="tiny muted">{n.role}</span>
                </div>
              ))}
            </div>
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

        {/* Common actions — all personas */}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <button className="btn sm" onClick={() => fireAction('Talk to Elara')}>✦ Talk to Elara</button>
          <button className="btn sm" onClick={() => fireAction('Visit Valk the smith')}>⚒ Visit Valk</button>
          <button className="btn sm" onClick={() => fireAction('Examine market')}>↳ Examine market</button>
          <button className="btn sm" onClick={() => fireAction('Take a job')}>📜 Take a job</button>
          <button className="btn sm" onClick={() => fireAction('Rest — short')}>🛏 Rest (short)</button>
          <button className="btn sm" onClick={() => fireAction('Travel')}>🚶 Travel</button>
          <button className="btn sm" onClick={() => fireAction('Roll d20')}>🎲 Roll d20</button>
          <button className="btn sm" onClick={() => fireAction('Inventory')}>🎒 Inventory</button>
        </div>

        {/* Slow-life chip row — surfaces contextually if applicable */}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span className="tiny muted" style={{ alignSelf: 'center', marginRight: 4 }}>slow life:</span>
          <button className="btn sm" onClick={() => fireAction('Examine deposit')}>examine</button>
          <button className="btn sm" onClick={() => fireAction('Study material')}>study</button>
          <button className="btn sm" onClick={() => fireAction('Tend herd')}>tend</button>
          <button className="btn sm" onClick={() => fireAction('Plant crops')}>plant</button>
          <button className="btn sm" onClick={() => fireAction('Sell item')}>sell</button>
        </div>

        {/* GM-only superpowers */}
        {(isDM || isAI) && (
          <div style={{
            marginTop: 10,
            padding: 10,
            border: '1px dashed var(--accent-red)',
            background: 'rgba(168, 68, 42, 0.05)',
          }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div className="tiny" style={{ color: 'var(--accent-red)', letterSpacing: '0.06em', fontWeight: 600 }}>
                {isAI ? 'GM-AI · DM CONTROLS' : 'DM CONTROLS'}
              </div>
              <span className="tiny muted">visible only to {isAI ? 'gm-ai' : 'dm'} persona</span>
            </div>

            {/* Transport party */}
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
                disabled={transporting}
                onClick={handleTransport}
              >
                {transporting ? '… transporting' : '✦ Transport party'}
              </button>
            </div>

            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button className="btn sm" onClick={() => fireAction('Force scene change')}>scene change</button>
              <button className="btn sm" onClick={() => fireAction('Inject NPC')}>inject NPC</button>
              <button className="btn sm" onClick={() => fireAction('Roll random encounter')}>random encounter</button>
              <button className="btn sm" onClick={() => fireAction('Skip to next dawn')}>skip → dawn</button>
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

        {/* DMless mode hint */}
        {isDMless && (
          <div className="aside" style={{ marginTop: 10, fontSize: 14 }}>
            ↳ no GM. world ticks autonomously. when you act, the engine resolves;
            when you wait, time passes and events come from κ + guild + monster ticks.
          </div>
        )}

        {/* Player mode hint */}
        {isPlayer && (
          <div className="aside blue" style={{ marginTop: 10, fontSize: 14 }}>
            ↳ you're at the table with a human DM. wait for their narration or
            click an action to declare your intent.
          </div>
        )}
      </div>
    </div>
  )
}
