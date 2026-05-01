// @ts-nocheck
'use client'

import React from 'react'
import { loadAttunement, unattune, getActiveCharacter, type AttunementState } from '@/lib/character'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Attunement.tsx — magic-item binding · 3-slot economy.
// Live data: /api/character/[id]/attunement (GET/POST/DELETE).
// Mock slots/items stripped — drives entirely from API.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Attunement() {
  const [state, setState] = React.useState<AttunementState | null>(null)
  const [characterId, setCharacterId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid)
    setCharacterId(charId)
    if (charId) loadAttunement(charId).then(setState).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const handleUnattune = async (slotIndex: number) => {
    if (!characterId) return
    try {
      await unattune(characterId, slotIndex)
      const fresh = await loadAttunement(characterId)
      setState(fresh)
    } catch (e: any) {
      setError(e?.message ?? 'unattune failed')
    }
  }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">32 · Character · attunement</div>
          <h2>Attunement <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player view · 3-slot magic-item economy</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ a character can attune up to 3 magic items. Attune binds the item; unattune
        breaks the link. Each item declares its tier / requirement / effect.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live attunement</h3>
          <span className="meta">→ /api/character/{characterId?.slice(0,8) ?? '…'}/attunement</span>
        </div>
        {!characterId && <div className="tiny muted">no active character — set one via Sheet (14)</div>}
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {state && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12}}>
            <span>slots <b>{state.slots.filter(s => s.itemId).length}/{state.slots.length}</b></span>
            <span>candidates <b>{state.candidates?.length ?? 0}</b></span>
          </div>
        )}
      </div>

      <div className="grid-3" style={{gap: 14}}>
        {(state?.slots ?? Array.from({length: 3}).map(() => null)).map((slot, i) => (
          <div key={i} className="box">
            <div className="box-title"><h3>Slot {i + 1}</h3><span className="meta">{slot?.itemId ? 'bound' : 'open'}</span></div>
            {!slot?.itemId ? (
              <EmptyState label="empty slot" hint={state ? 'attune from inventory candidates below.' : 'load an active character to begin.'} />
            ) : (
              <div>
                <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{slot.itemName}</div>
                <div className="tiny muted" style={{marginTop: 4}}>{slot.itemTier ?? '—'} · {slot.itemId.slice(0, 8)}…</div>
                <button className="btn sm" style={{marginTop: 8}} onClick={() => handleUnattune(i)}>break attunement</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-title">Inventory candidates</div>
      <div className="box">
        {!state ? (
          <div className="tiny muted">{characterId ? 'loading…' : 'no active character'}</div>
        ) : (state.candidates ?? []).length === 0 ? (
          <EmptyState label="no attunable items in inventory" hint="acquire magic items via loot / craft / purchase. they appear here once they're in the character's inventory." />
        ) : (
          <table className="inv">
            <thead><tr><th>item</th><th>tier</th><th>requirement</th><th></th></tr></thead>
            <tbody>
              {state.candidates.map((c: any) => (
                <tr key={c.itemId}>
                  <td><b>{c.itemName}</b></td>
                  <td className="tiny">{c.tier ?? '—'}</td>
                  <td className="tiny muted">{c.requirement ?? '—'}</td>
                  <td><button className="btn sm primary">attune</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
