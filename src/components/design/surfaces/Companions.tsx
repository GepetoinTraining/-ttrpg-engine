// @ts-nocheck
'use client'

import React from 'react'
import { listCompanions, type Companion } from '@/lib/companion'
import { getActiveCharacter } from '@/lib/character'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Companions.tsx — companions / pets / mounts (engine/husbandry.ts).
// Live data loads from /api/companion/list?characterId=ACTIVE.
// Mock companion array stripped — drives entirely from API.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Companions() {
  const [companions, setCompanions] = React.useState<Companion[] | null>(null)
  const [characterId, setCharacterId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid)
    setCharacterId(charId)
    listCompanions(charId ? { characterId: charId } : undefined)
      .then(r => setCompanions(r.companions))
      .catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">29 · Player · companions</div>
          <h2>Companions <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ companions = pets, mounts, hired help. mm-husbandry handles food / health drift.
        Mood and loyalty wire once engine emits them.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live companions</h3>
          <span className="meta">→ /api/companion/list{characterId ? `?characterId=${characterId.slice(0,8)}…` : ''}</span>
        </div>
        {!characterId && <div className="tiny muted">no active character — companions filtered to all if any</div>}
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!companions && !error && <div className="tiny muted">loading…</div>}
        {companions && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12}}>
            <span>companions <b>{companions.length}</b></span>
          </div>
        )}
      </div>

      <div className="box">
        {!companions ? (
          <div className="tiny muted">loading…</div>
        ) : companions.length === 0 ? (
          <EmptyState label="no companions" hint="acquire via narrative, purchase, or summon. mm-husbandry tracks once owned." />
        ) : (
          <div className="grid-2" style={{gap: 12}}>
            {companions.map(c => (
              <div key={c.id} className="box soft" style={{padding: 12}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <div>
                    <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{c.name}</div>
                    <div className="tiny muted">{c.species ?? c.type ?? '—'}</div>
                  </div>
                  {c.health !== undefined && (
                    <span className="chip sm">health {(c.health * 100).toFixed(0)}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
