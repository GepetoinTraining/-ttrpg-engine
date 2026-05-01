// @ts-nocheck
'use client'

import React from 'react'
import { loadCharacterReputation, type RepMatrix } from '@/lib/reputation'
import { getActiveCharacter } from '@/lib/character'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Reputation.tsx — Per-PC faction reputation matrix.
// Live data: /api/reputation/character/:id reads reputations table.
// MODEL: party rep dampens PC delta. dampen(p) = 1 - |p|/200.
// 'character' subject deltas multiply by dampen(party_score) at write time.
// Mock factions/PCs/matrix stripped — drives entirely from API.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Reputation() {
  const [tab, setTab] = React.useState<'matrix' | 'thresholds' | 'history'>('matrix')
  const [live, setLive] = React.useState<RepMatrix | null>(null)
  const [characterId, setCharacterId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid)
    setCharacterId(charId)
    if (charId) {
      loadCharacterReputation(charId).then(setLive).catch(e => setError(e?.message ?? 'load failed'))
    }
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">21 · World · faction reputation</div>
          <h2>Reputation Matrix <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">per-PC · per-faction · −100…+100</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ Cards (04) shows narrative faction snippets. <b>This is the math.</b>
        engine/faction.ts carries a signed integer per PC × faction; thresholds gate
        prices, hooks, sanctuary, hostility.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live reputation</h3>
          <span className="meta">→ /api/reputation/character/{characterId?.slice(0,8) ?? '…'} · party dampens PC delta · dampen(p) = 1 − |p|/200</span>
        </div>
        {!characterId && <div className="tiny muted">no active character — set one via Sheet (14)</div>}
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {live && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span><b>{live.character.name}</b></span>
            {live.partyId ? (
              <span className="muted">party {live.partyId.slice(0, 8)}…</span>
            ) : (
              <span className="muted">no party (party_members row missing)</span>
            )}
            <span>factions <b>{live.matrix.length}</b></span>
            <span>recent deltas <b>{live.recent.length}</b></span>
          </div>
        )}
      </div>

      <div className="tabs">
        {([
          ['matrix', 'Matrix'],
          ['thresholds', 'Thresholds'],
          ['history', 'History · per faction'],
        ] as const).map(([k, l]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>

      {tab === 'matrix' && (
        <div className="box">
          {!characterId ? (
            <EmptyState label="no active character" hint="set an active character via Sheet (14) to see reputation matrix." />
          ) : !live ? (
            <div className="tiny muted">loading…</div>
          ) : live.matrix.length === 0 ? (
            <EmptyState label="no factions in DB" hint="seed factions; PC × faction scores populate as the campaign accrues deltas." />
          ) : (
            <table className="inv" style={{fontSize: 12}}>
              <thead><tr><th>faction</th><th>PC score</th><th>party score</th><th>dampen</th></tr></thead>
              <tbody>
                {live.matrix.map((m) => {
                  const dampen = 1 - Math.abs(m.partyScore) / 200
                  return (
                    <tr key={m.factionId}>
                      <td><b>{m.factionName}</b> <span className="muted">· {m.factionType}</span></td>
                      <td style={{color: m.pcScore > 0 ? 'var(--accent-green)' : m.pcScore < 0 ? 'var(--accent-red)' : 'var(--ink)'}}>
                        {m.pcScore > 0 ? '+' : ''}{m.pcScore.toFixed(0)}
                      </td>
                      <td style={{color: m.partyScore > 0 ? 'var(--accent-green)' : m.partyScore < 0 ? 'var(--accent-red)' : 'var(--ink)'}}>
                        {m.partyScore > 0 ? '+' : ''}{m.partyScore.toFixed(0)}
                      </td>
                      <td className="muted">×{dampen.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'thresholds' && (
        <div className="box">
          <div className="box-title"><h3>Default thresholds</h3><span className="meta">global</span></div>
          <table className="inv">
            <thead><tr><th>Score</th><th>Status</th><th>Effect</th></tr></thead>
            <tbody>
              <tr><td className="stat"><b>+75…+100</b></td><td><span className="chip green sm">exalted</span></td><td>sanctuary · price ×0.7 · plot hooks</td></tr>
              <tr><td className="stat"><b>+40…+74</b></td><td><span className="chip green sm">allied</span></td><td>price ×0.85 · favors callable</td></tr>
              <tr><td className="stat"><b>+10…+39</b></td><td><span className="chip sm">friendly</span></td><td>info shared · normal price</td></tr>
              <tr><td className="stat"><b>−9…+9</b></td><td><span className="chip sm">neutral</span></td><td>standard interactions</td></tr>
              <tr><td className="stat"><b>−39…−10</b></td><td><span className="chip gold sm">wary</span></td><td>price ×1.15 · refuses some asks</td></tr>
              <tr><td className="stat"><b>−74…−40</b></td><td><span className="chip red sm">hostile</span></td><td>refuses service · maybe attack</td></tr>
              <tr><td className="stat"><b>−100…−75</b></td><td><span className="chip red sm">hunted</span></td><td>kill on sight · bounty</td></tr>
            </tbody>
          </table>
          <div className="aside" style={{marginTop: 10, fontSize: 14}}>
            ↳ thresholds are global rules; per-faction overrides bind once engine/faction.ts exposes per-faction effect tables.
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="box">
          <EmptyState
            label="history pending"
            hint="bind to reputation_deltas audit table once /api/reputation/character/[id]/history endpoint lands. surface per-faction sparkline + Δ event log."
          />
        </div>
      )}
    </div>
  )
}
