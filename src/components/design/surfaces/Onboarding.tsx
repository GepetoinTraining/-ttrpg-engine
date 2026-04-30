// @ts-nocheck
'use client'

import React from 'react'
import {
  createCampaign,
  inviteToCampaign,
  buildInviteUrl,
  captureGeo,
} from '@/lib/campaign'
import { loadCert } from '@/lib/auth'

// surfaces/Onboarding.tsx — Two flows wired to /api/campaign/* and /api/auth/enroll/request.
//
//   DM flow:
//     name → world params → invite players (each call = one auth/enroll/request)
//     → POST campaign/create → POST campaign/:id/invite × N → list of invite URLs
//
//   Player flow:
//     reads campaign id from URL (?campaign=CID), assumes cert is installed
//     → captures handle / AI mode / lines & veils / hook → saves to localStorage
//       under claudedm:player-prefs:CID → navigates to chargen.

const DEFAULT_PREFS = {
  handle: '',
  pronouns: '',
  aiMode: 'co-thinker',
  lines: ['child harm', 'torture'],
  hook: 'I owe someone in Mulmaster something I can\'t pay back',
}

export default function Onboarding() {
  const [flow, setFlow] = React.useState<'dm' | 'player'>('dm')

  // Auto-pick the player flow if a campaign id is in the URL — that means the
  // user just redeemed an invite and should be doing player intake next.
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const campaignId = url.searchParams.get('campaign')
    if (campaignId) setFlow('player')
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">12 · Onboarding — first run</div>
          <h2>New campaign · join campaign</h2>
        </div>
        <span className="who">two flows, one screen</span>
      </div>

      <p style={{ maxWidth: 740, color: 'var(--ink-2)', marginTop: 0 }}>
        Two paths into the system. The DM seeds a world and invites players;
        each player walks a tiny <i>"who are you in this world"</i> intake before chargen.
        The AI co-pilot proposes regions / tone / table style — DM stays the orchestrator.
      </p>

      <div className="row" style={{ gap: 8, marginTop: 18, marginBottom: 18 }}>
        <span className="tiny" style={{ alignSelf: 'center', marginRight: 4 }}>FLOW →</span>
        <span
          className={`chip ${flow === 'dm' ? 'solid' : ''}`}
          onClick={() => setFlow('dm')}
          style={{ cursor: 'pointer' }}
        >
          DM · new campaign
        </span>
        <span
          className={`chip ${flow === 'player' ? 'solid' : ''}`}
          onClick={() => setFlow('player')}
          style={{ cursor: 'pointer' }}
        >
          Player · join
        </span>
      </div>

      {flow === 'dm' ? <DMOnboarding /> : <PlayerOnboarding />}
    </div>
  )
}

// ── DM FLOW ──────────────────────────────────────────────────────────────

interface PlayerSeat {
  id: string
  name: string
  handle: string
  state: 'idle' | 'inviting' | 'sent' | 'error'
  token?: string
  inviteUrl?: string
  error?: string
}

const seatId = () => Math.random().toString(36).slice(2, 9)

function DMOnboarding() {
  const [name, setName] = React.useState('Sunset Vault Heist')
  const [slug, setSlug] = React.useState('sunset-vault')
  const [region, setRegion] = React.useState('Sword Coast · Waterdeep')
  const [tone, setTone] = React.useState('Heist · low-magic · gritty')
  const [startingLevel, setStartingLevel] = React.useState(5)
  const [seats, setSeats] = React.useState<PlayerSeat[]>([
    { id: seatId(), name: 'Kaelith', handle: '', state: 'idle' },
    { id: seatId(), name: 'Doruk', handle: '', state: 'idle' },
    { id: seatId(), name: 'Vessa', handle: '', state: 'idle' },
    { id: seatId(), name: 'Aramil', handle: '', state: 'idle' },
  ])
  const [campaignId, setCampaignId] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [geo, setGeo] = React.useState<{ lat: number; lon: number } | null>(null)

  React.useEffect(() => {
    captureGeo().then(setGeo)
  }, [])

  const updateSeat = (id: string, patch: Partial<PlayerSeat>) => {
    setSeats((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const addSeat = () =>
    setSeats((prev) => [...prev, { id: seatId(), name: '', handle: '', state: 'idle' }])

  const removeSeat = (id: string) => setSeats((prev) => prev.filter((s) => s.id !== id))

  const handleCreate = async () => {
    setError(null)
    setCreating(true)
    try {
      const result = await createCampaign({
        name,
        slug,
        worldSeed: 'faerun',
        region,
        tone,
        startingLevel,
      })
      setCampaignId(result.campaignId)
    } catch (e: any) {
      setError(e?.message ?? 'campaign create failed')
    } finally {
      setCreating(false)
    }
  }

  const handleInvite = async (seat: PlayerSeat) => {
    if (!campaignId) {
      setError('create the campaign first')
      return
    }
    if (!seat.name.trim()) {
      updateSeat(seat.id, { state: 'error', error: 'name required' })
      return
    }
    updateSeat(seat.id, { state: 'inviting', error: undefined })
    try {
      const { token } = await inviteToCampaign(
        campaignId,
        seat.handle.trim() || seat.name.trim(),
        geo ?? { lat: 0, lon: 0 }
      )
      const inviteUrl = buildInviteUrl(token, campaignId)
      updateSeat(seat.id, { state: 'sent', token, inviteUrl })
    } catch (e: any) {
      updateSeat(seat.id, { state: 'error', error: e?.message ?? 'invite failed' })
    }
  }

  const handleInviteAll = async () => {
    if (!campaignId) await handleCreate()
    for (const s of seats) {
      if (s.state === 'idle' && s.name.trim()) {
        // sequential to give the network a chance — could parallelize later
        // eslint-disable-next-line no-await-in-loop
        await handleInvite(s)
      }
    }
  }

  return (
    <div className="grid-3" style={{ gap: 18 }}>
      {/* main column */}
      <div style={{ gridColumn: 'span 2' }} className="col">
        <div className="box">
          <div className="box-title">
            <h3>1 · Name the campaign</h3>
            <span className="meta">DM only</span>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <input
              className="placeholder"
              style={{
                flex: 1,
                minHeight: 0,
                padding: '8px 12px',
                fontFamily: 'var(--serif)',
                fontSize: 18,
                background: 'var(--paper)',
              }}
              placeholder="e.g. Sunset Vault Heist"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="placeholder"
              style={{
                width: 200,
                minHeight: 0,
                padding: '8px 12px',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                background: 'var(--paper)',
              }}
              placeholder="short slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="aside blue" style={{ marginTop: 10, fontSize: 16 }}>
            ↳ slug becomes invite URL: <span className="kbd">claudedm.app/{slug}</span>
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>2 · Pick a world seed</h3>
            <span className="meta">faerûn shipping today</span>
          </div>
          <div className="grid-3" style={{ gap: 10, marginTop: 8 }}>
            {[
              { n: 'Faerûn', d: 'Forgotten Realms · default · Waterdeep, Sword Coast, Mulmaster', sel: true },
              { n: 'Eberron', d: 'next tier · greyed', sel: false, dis: true },
              { n: 'Homebrew', d: 'next tier · player can derive seeds', sel: false, dis: true },
            ].map((w) => (
              <div
                key={w.n}
                className={`box ${w.sel ? 'filled' : 'soft'} ${w.dis ? 'dashed' : ''}`}
                style={{ padding: 12, opacity: w.dis ? 0.4 : 1, cursor: w.dis ? 'not-allowed' : 'pointer' }}
              >
                <div
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 16,
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  {w.n}{' '}
                  {w.sel && (
                    <span className="chip green sm" style={{ fontSize: 9 }}>
                      chosen
                    </span>
                  )}
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {w.d}
                </div>
              </div>
            ))}
          </div>

          <div className="section-title" style={{ marginTop: 20, marginBottom: 10 }}>
            region · tone · arc
          </div>
          <div className="grid-3" style={{ gap: 10 }}>
            <div>
              <div className="tiny">REGION</div>
              <select
                className="placeholder"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  minHeight: 0,
                  background: 'var(--paper)',
                  fontFamily: 'var(--serif)',
                  fontSize: 14,
                }}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option>Sword Coast · Waterdeep</option>
                <option>Moonsea · Mulmaster</option>
                <option>Cormyr · Suzail</option>
              </select>
            </div>
            <div>
              <div className="tiny">TONE</div>
              <select
                className="placeholder"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  minHeight: 0,
                  background: 'var(--paper)',
                  fontFamily: 'var(--serif)',
                  fontSize: 14,
                }}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option>Heist · low-magic · gritty</option>
                <option>Heroic · classic D&amp;D</option>
                <option>Political intrigue</option>
                <option>Horror · gothic</option>
              </select>
            </div>
            <div>
              <div className="tiny">STARTING LEVEL</div>
              <select
                className="placeholder"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  minHeight: 0,
                  background: 'var(--paper)',
                  fontFamily: 'var(--serif)',
                  fontSize: 14,
                }}
                value={startingLevel}
                onChange={(e) => setStartingLevel(Number(e.target.value))}
              >
                <option value={5}>Level 5 · seasoned</option>
                <option value={1}>Level 1 · zero-to-hero</option>
                <option value={7}>Level 7 · current</option>
              </select>
            </div>
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>3 · Invite players</h3>
            <span className="meta">cert-based · one tap each</span>
          </div>
          {!campaignId && (
            <div className="aside" style={{ marginBottom: 8, fontSize: 16 }}>
              ↳ click <b>create campaign</b> below to mint a campaign id; then invite buttons go live.
            </div>
          )}
          <table className="inv">
            <thead>
              <tr>
                <th style={{ width: 130 }}>name</th>
                <th>handle (optional)</th>
                <th style={{ width: 200 }}>cert state</th>
                <th style={{ width: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {seats.map((seat) => (
                <tr key={seat.id}>
                  <td>
                    <input
                      className="placeholder"
                      style={{
                        width: '100%',
                        minHeight: 0,
                        padding: '4px 8px',
                        fontFamily: 'var(--serif)',
                        fontSize: 14,
                        background: 'var(--paper)',
                      }}
                      value={seat.name}
                      onChange={(e) => updateSeat(seat.id, { name: e.target.value })}
                      placeholder="player handle"
                    />
                  </td>
                  <td>
                    <input
                      className="placeholder"
                      style={{
                        width: '100%',
                        minHeight: 0,
                        padding: '4px 8px',
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        background: 'var(--paper)',
                      }}
                      value={seat.handle}
                      onChange={(e) => updateSeat(seat.id, { handle: e.target.value })}
                      placeholder="(uses name if blank)"
                    />
                  </td>
                  <td>
                    {seat.state === 'sent' && (
                      <span className="chip green sm" style={{ fontSize: 9 }}>
                        invite ready ✓
                      </span>
                    )}
                    {seat.state === 'inviting' && (
                      <span className="chip blue sm" style={{ fontSize: 9 }}>
                        sending…
                      </span>
                    )}
                    {seat.state === 'idle' && (
                      <span className="chip sm" style={{ fontSize: 9 }}>
                        —
                      </span>
                    )}
                    {seat.state === 'error' && (
                      <span
                        className="chip red sm"
                        style={{ fontSize: 9 }}
                        title={seat.error}
                      >
                        {seat.error || 'error'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {seat.state !== 'sent' ? (
                        <button
                          className="btn sm"
                          disabled={!campaignId || seat.state === 'inviting'}
                          onClick={() => handleInvite(seat)}
                        >
                          invite
                        </button>
                      ) : (
                        <button
                          className="btn sm"
                          onClick={() => {
                            if (seat.inviteUrl) navigator.clipboard?.writeText(seat.inviteUrl)
                          }}
                        >
                          copy link
                        </button>
                      )}
                      <button
                        className="btn sm"
                        style={{ opacity: 0.6 }}
                        onClick={() => removeSeat(seat.id)}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={addSeat}>＋ add seat</button>
            <button
              className="btn"
              disabled={!campaignId}
              onClick={handleInviteAll}
            >
              invite all
            </button>
            <span style={{ flex: 1 }} />
            {!campaignId ? (
              <button className="btn primary" disabled={creating} onClick={handleCreate}>
                {creating ? 'creating…' : 'create campaign →'}
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => {
                  window.location.hash = 'dm'
                }}
              >
                open DM Console →
              </button>
            )}
          </div>
          {error && (
            <div className="tiny" style={{ color: 'var(--accent-red)', marginTop: 8 }}>
              {error}
            </div>
          )}
          {campaignId && (
            <div className="aside blue" style={{ marginTop: 10, fontSize: 16 }}>
              ↳ campaign created · id <span className="kbd">{campaignId.slice(0, 8)}…</span>
            </div>
          )}
        </div>

        {/* Invite URLs sent so far */}
        {seats.some((s) => s.state === 'sent') && (
          <div className="box dashed">
            <div className="box-title">
              <h3>Sent invite links</h3>
              <span className="meta">share with each player</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
              {seats
                .filter((s) => s.state === 'sent')
                .map((s) => (
                  <li key={s.id} style={{ marginBottom: 6 }}>
                    <b>{s.name}</b>:{' '}
                    <a
                      href={s.inviteUrl}
                      onClick={(e) => {
                        e.preventDefault()
                        if (s.inviteUrl) navigator.clipboard?.writeText(s.inviteUrl)
                      }}
                      title="click to copy"
                      style={{ color: 'var(--ink-2)', cursor: 'pointer' }}
                    >
                      {s.inviteUrl}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {/* right rail */}
      <div className="col">
        <div className="box filled">
          <div className="box-title">
            <h3>You're here</h3>
            <span className="meta">DM</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.8 }}>
            <li className={name ? '' : 'muted'}><b>Name campaign</b></li>
            <li><b>Pick world seed</b></li>
            <li className={campaignId ? '' : 'muted'}>
              <b>Invite players</b>
              {campaignId ? ' ✓' : ''}
            </li>
            <li className="muted">→ Console opens, AI drafts arc</li>
            <li className="muted">→ Players walk join flow + chargen</li>
            <li className="muted">→ Session 0 (table screen)</li>
          </ol>
          <div className="aside" style={{ marginTop: 10, fontSize: 16 }}>
            ↳ ~3 min for DM if you accept AI defaults
          </div>
          {geo && (geo.lat !== 0 || geo.lon !== 0) ? (
            <div className="tiny muted" style={{ marginTop: 10 }}>
              geo captured · invites use your location's spacetime as the seed
            </div>
          ) : (
            <div className="tiny muted" style={{ marginTop: 10 }}>
              no geo (denied or unavailable) — seeds will use {'{0,0}'}
            </div>
          )}
        </div>

        <div className="box dashed">
          <div className="box-title">
            <h3>Faerûn presets</h3>
            <span className="meta">tier 1</span>
          </div>
          <div className="tiny" style={{ lineHeight: 1.7 }}>
            Forgotten Realms ships pre-loaded: <b>regions</b>, <b>factions</b>,
            <b> deity table</b>, <b>monster manual</b>. Other worlds (Eberron, homebrew)
            arrive in tier 2 — and players can derive new seeds from a prompt.
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>What gets created</h3>
            <span className="meta">scaffold</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            <li>1 party + adventure + campaign row</li>
            <li>play_mode_config (GROUP_DM_AI · storyteller)</li>
            <li>simulation_depth (all sims on)</li>
            <li>gm_profile_overrides if tone set</li>
            <li>One invite token per seat (auth_enrollments)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── PLAYER FLOW ──────────────────────────────────────────────────────────

function PlayerOnboarding() {
  const [campaignId, setCampaignId] = React.useState<string | null>(null)
  const [hasCert, setHasCert] = React.useState<boolean>(false)
  const [prefs, setPrefs] = React.useState({ ...DEFAULT_PREFS })

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const cid = url.searchParams.get('campaign')
    setCampaignId(cid)
    setHasCert(!!loadCert())
    if (cid) {
      const stored = window.localStorage.getItem(`claudedm:player-prefs:${cid}`)
      if (stored) {
        try {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) })
        } catch {}
      }
    }
  }, [])

  const updatePref = (k: keyof typeof prefs, v: any) =>
    setPrefs((prev) => ({ ...prev, [k]: v }))

  const toggleLine = (line: string) =>
    setPrefs((prev) => {
      const has = prev.lines.includes(line)
      const next = has ? prev.lines.filter((l) => l !== line) : [...prev.lines, line]
      return { ...prev, lines: next }
    })

  const persist = () => {
    if (typeof window === 'undefined' || !campaignId) return
    window.localStorage.setItem(
      `claudedm:player-prefs:${campaignId}`,
      JSON.stringify(prefs)
    )
  }

  const handleContinue = () => {
    persist()
    if (campaignId) {
      window.location.hash = `chargen?campaign=${campaignId}`
    } else {
      window.location.hash = 'chargen'
    }
  }

  const handleSave = () => {
    persist()
  }

  return (
    <div className="grid-3" style={{ gap: 18 }}>
      <div style={{ gridColumn: 'span 2' }} className="col">
        <div className="box" style={{ padding: 20 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div className="tiny">
                {hasCert ? 'CERT INSTALLED' : 'NO CERT YET'} ·{' '}
                {campaignId ? `campaign ${campaignId.slice(0, 8)}…` : 'no campaign in url'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 24,
                  fontWeight: 600,
                  marginTop: 4,
                  letterSpacing: '-0.01em',
                }}
              >
                {campaignId ? 'You\'re joining a campaign' : 'No invite open'}
              </div>
              <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
                {hasCert && campaignId
                  ? 'Three quick questions before chargen.'
                  : 'Open an invite link first ( /#auth ) — or pick the DM flow above.'}
              </div>
            </div>
            <span className={`chip ${hasCert ? 'green' : 'red'}`}>
              {hasCert ? 'cert ✓' : 'no cert'}
            </span>
          </div>
          <div className="aside blue" style={{ marginTop: 12, fontSize: 16 }}>
            ↳ before chargen — three quick questions so the world fits you
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>1 · What's your name?</h3>
            <span className="meta">your handle, not your PC</span>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <input
              className="placeholder"
              style={{
                flex: 1,
                minHeight: 0,
                padding: '8px 12px',
                background: 'var(--paper)',
                fontFamily: 'var(--serif)',
                fontSize: 16,
              }}
              placeholder="player name (DM sees this)"
              value={prefs.handle}
              onChange={(e) => updatePref('handle', e.target.value)}
            />
            <input
              className="placeholder"
              style={{
                width: 160,
                minHeight: 0,
                padding: '8px 12px',
                background: 'var(--paper)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
              placeholder="pronouns"
              value={prefs.pronouns}
              onChange={(e) => updatePref('pronouns', e.target.value)}
            />
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>2 · How do you want the AI to treat you?</h3>
            <span className="meta">whisper-channel preferences</span>
          </div>
          <div className="grid-3" style={{ gap: 8, marginTop: 6 }}>
            {[
              { n: 'lookup-only', label: 'Lookup-only', d: 'rules and lore. no narration.' },
              { n: 'co-thinker', label: 'Co-thinker', d: 'AI suggests options when I ask.' },
              { n: 'co-writer', label: 'Co-writer', d: 'AI helps voice my character\'s thoughts.' },
            ].map((o) => (
              <div
                key={o.n}
                className={`box ${prefs.aiMode === o.n ? 'filled' : 'soft'}`}
                style={{ padding: 12, cursor: 'pointer' }}
                onClick={() => updatePref('aiMode', o.n)}
              >
                <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>{o.label}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {o.d}
                </div>
              </div>
            ))}
          </div>
          <div className="ic-meta" style={{ marginTop: 8 }}>
            changeable later · Tweaks → AI mode
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>3 · Lines &amp; veils</h3>
            <span className="meta">private to DM only</span>
          </div>
          <div className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
            Anything you don't want at the table. AI never narrates them; DM gets a heads-up if a scene drifts close.
          </div>
          <div className="pill-multi">
            {[
              'gore (gratuitous)',
              'torture',
              'spiders',
              'romance · explicit',
              'child harm',
              'self-harm',
              'heights',
              'drowning',
              'prison',
              'none',
            ].map((t) => (
              <label key={t}>
                <input
                  type="checkbox"
                  checked={prefs.lines.includes(t)}
                  onChange={() => toggleLine(t)}
                />
                {t}
              </label>
            ))}
          </div>
          <div className="aside blue" style={{ marginTop: 10, fontSize: 16 }}>
            ↳ DM sees these before session 0. Players don't see each other's.
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>4 · Pick a starting hook</h3>
            <span className="meta">AI tailors arc 01 to this</span>
          </div>
          <div className="col" style={{ gap: 8 }}>
            {[
              { h: 'I owe someone in Mulmaster something I can\'t pay back', t: 'criminal · debt' },
              { h: 'I lost someone in a Waterdeep tower fire two winters ago', t: 'grief · revenge' },
              { h: 'I came here to find a person, not a thing', t: 'mystery · personal' },
              { h: 'I\'ve been hired and I don\'t know who hired me', t: 'mystery · pawn' },
              { h: '(write your own…)', t: 'free-form' },
            ].map((o) => (
              <div
                key={o.h}
                className={`box ${prefs.hook === o.h ? 'filled' : 'soft'}`}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => updatePref('hook', o.h)}
              >
                <span style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>{o.h}</span>
                <span className="chip sm" style={{ fontSize: 9 }}>
                  {o.t}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={handleSave}>
            save &amp; come back
          </button>
          <button className="btn primary" onClick={handleContinue} disabled={!campaignId}>
            continue → character creation
          </button>
        </div>
      </div>

      {/* right rail */}
      <div className="col">
        <div className="box filled">
          <div className="box-title">
            <h3>You're here</h3>
            <span className="meta">player</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.8 }}>
            <li className={hasCert ? '' : 'muted'}>
              Cert installs {hasCert ? '✓' : '(missing)'}
            </li>
            <li><b>Three intake questions</b></li>
            <li>Pick a starting hook</li>
            <li className="muted">→ Character creation</li>
            <li className="muted">→ Session 0</li>
          </ol>
          <div className="aside" style={{ marginTop: 10, fontSize: 16 }}>
            ↳ ~2 min before chargen
          </div>
        </div>

        <div className="box dashed">
          <div className="box-title">
            <h3>Why intake?</h3>
            <span className="meta">design note</span>
          </div>
          <div className="tiny" style={{ lineHeight: 1.7 }}>
            Lines/veils + AI mode + a hook — these <b>cannot</b> be derived from the
            sheet later. They're the soft contract between you, the DM, and the AI.
            Everything mechanical (race/class/stats) lives in chargen.
          </div>
        </div>

        <div className="box">
          <div className="box-title">
            <h3>Visible to DM</h3>
            <span className="meta">privacy</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            <li>Name, pronouns, hook</li>
            <li>Lines &amp; veils (DM-only)</li>
            <li>AI mode (DM-only · advisory)</li>
          </ul>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            other players see only your name + PC name
          </div>
          <div className="tiny muted" style={{ marginTop: 10 }}>
            stored at: <span className="kbd">claudedm:player-prefs:{campaignId?.slice(0, 8) ?? '…'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
