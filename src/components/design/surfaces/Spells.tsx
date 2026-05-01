// @ts-nocheck
'use client'

import React from 'react'
import { loadSpells } from '@/lib/world-detail'
import { getActiveCharacter } from '@/lib/character'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Spells.tsx — Spell prep / casting.
// Live data: /api/character/:id/spells (spells_known + spell_slots + caster_state).
// Mock slot/prepared/ritual data stripped — drives entirely from API.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Spells() {
  const [view, setView] = React.useState<'prep' | 'spellbook' | 'ritual book' | 'components' | 'metamagic'>('prep')
  const [live, setLive] = React.useState<any>(null)
  const [characterId, setCharacterId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid)
    setCharacterId(charId)
    if (charId) loadSpells(charId).then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const slots = live?.slots ?? []
  const prepared = live?.spellsKnown?.filter((s: any) => s.prepared) ?? []
  const rituals = live?.spellsKnown?.filter((s: any) => s.ritual) ?? []

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">25 · Magic system</div>
          <h2>Spell prep &amp; casting <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player surface · DM sees concentration timer</span>
      </div>

      <div className="aside blue" style={{marginBottom: 18}}>
        ↳ prep budget = INT mod + level (caster-dependent). Slots regenerate on long rest;
        ritual book lets supported casters cast many spells at no slot cost (10 min).
        Components ≠ V,S,M are tracked against inventory automatically.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live spell loadout</h3>
          <span className="meta">→ /api/character/{characterId?.slice(0,8) ?? '…'}/spells</span>
        </div>
        {!characterId && <div className="tiny muted">no active character — set one via Sheet (14)</div>}
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {live && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>known <b>{live.summary.knownCount}</b></span>
            <span>cantrips <b>{live.summary.cantrips}</b></span>
            <span>leveled <b>{live.summary.leveled}</b></span>
            <span>rituals <b>{live.summary.rituals}</b></span>
            <span>concentrations <b>{live.summary.concentrations}</b></span>
            <span>slots <b>{live.slots.map((s:any) => `L${s.spellLevel}:${s.total-s.used}/${s.total}`).join(' · ') || '—'}</b></span>
            {live.caster && (
              <span>DC <b>{live.caster.dc}</b> · atk <b>+{live.caster.attackBonus}</b></span>
            )}
          </div>
        )}
      </div>

      {/* Header strip — slots + concentration */}
      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="box-title"><h3>Spell slots</h3><span className="meta">long rest restores all</span></div>
          {slots.length === 0 ? (
            <EmptyState label="no slots" hint="non-caster, or spell_slots rows not yet seeded for this character." />
          ) : (
            <div className="col" style={{gap: 8}}>
              {slots.map((s: any) => (
                <div key={s.spellLevel} className="row" style={{alignItems:'center', gap: 10}}>
                  <span className="tiny" style={{minWidth: 56}}>LEVEL {s.spellLevel}</span>
                  <div className="row" style={{gap: 4}}>
                    {Array.from({length: s.total}).map((_, i) => (
                      <div key={i} style={{
                        width: 22, height: 28,
                        border: '1.5px solid var(--ink)',
                        background: i < s.used ? 'var(--ink)' : 'var(--paper)',
                        transform: `rotate(${(i%2?-1:1)*1.5}deg)`,
                      }} />
                    ))}
                  </div>
                  <span className="stat" style={{marginLeft: 'auto'}}>{s.total - s.used} / {s.total}</span>
                </div>
              ))}
              <div className="row" style={{gap: 8, marginTop: 6}}>
                <button className="btn sm" disabled>short rest</button>
                <button className="btn sm primary" disabled>long rest →</button>
                <span className="tiny muted" style={{marginLeft:'auto'}}>rest endpoints pending</span>
              </div>
            </div>
          )}
        </div>

        <div className="box dark">
          <div className="tiny" style={{color:'var(--paper-3)'}}>CURRENTLY CONCENTRATING</div>
          <EmptyState label="no concentration" hint="surfaces when caster_state.concentratingOn is set." />
        </div>
      </div>

      {/* tabs */}
      <div className="tabs">
        {(['prep', 'spellbook', 'ritual book', 'components', 'metamagic'] as const).map(k => (
          <div key={k} className={`tab ${view===k?'active':''}`} onClick={() => setView(k)}>{k}</div>
        ))}
      </div>

      {view === 'prep' && (
        <div className="box">
          {!live ? (
            <EmptyState label="no character loaded" hint="set an active character to see prepared spells." />
          ) : prepared.length === 0 ? (
            <EmptyState label="no spells prepared" hint="prepare spells from the spellbook tab; budget = ability mod + level." />
          ) : (
            <table className="inv">
              <thead>
                <tr><th>spell</th><th>lvl</th><th>school</th><th>comp</th><th>tags</th><th></th></tr>
              </thead>
              <tbody>
                {prepared.map((s: any, i: number) => (
                  <tr key={i}>
                    <td style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{s.name}</td>
                    <td><span className="chip sm">L{s.level}</span></td>
                    <td className="tiny muted">{s.school}</td>
                    <td className="tiny">{s.components}</td>
                    <td>
                      {s.concentration && <span className="chip sm gold">conc.</span>}{' '}
                      {s.ritual && <span className="chip sm blue">ritual</span>}
                    </td>
                    <td><button className="btn sm primary" disabled>cast</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'ritual book' && (
        <div className="box">
          {rituals.length === 0 ? (
            <EmptyState label="no rituals" hint="ritual casting: 10 min, no slot cost. wired once spells_known.ritual flags populate." />
          ) : (
            <div className="grid-2">
              {rituals.map((r: any, i: number) => (
                <div key={i} className="box">
                  <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                    <span style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{r.name}</span>
                    <span className="chip sm">L{r.level} · ritual</span>
                  </div>
                  <div className="tiny muted" style={{marginTop: 4}}>{r.school}</div>
                  <div className="row" style={{gap: 6, marginTop: 8}}>
                    <button className="btn sm primary" disabled>cast as ritual</button>
                    <button className="btn sm" disabled>cast w/ slot</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'components' && (
        <div className="box">
          <EmptyState
            label="material costs pending"
            hint="bind to spell registry + character inventory once /api/character/[id]/spells exposes component requirements."
          />
        </div>
      )}

      {view === 'spellbook' && (
        <div className="box">
          <EmptyState label="spellbook view pending" hint="full spellbook with prepared toggle, school filter, level filter — bind once spells_known is populated." />
        </div>
      )}

      {view === 'metamagic' && (
        <div className="box">
          <EmptyState label="metamagic / sorcery points pending" hint="surfaces only for sorcerer / cleric variants — bind to engine/magic.ts." />
        </div>
      )}
    </div>
  )
}
