// @ts-nocheck
'use client'

import React from 'react'
import { loadSpells } from '@/lib/world-detail'
import { getActiveCharacter } from '@/lib/character'

// surfaces/Spells.tsx — Spell prep / casting.
// Live data: /api/character/:id/spells (spells_known + spell_slots + caster_state).

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Spells() {
  const [view, setView] = React.useState('prep');
  const [live, setLive] = React.useState<any>(null)
  const [characterId, setCharacterId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid)
    setCharacterId(charId)
    if (charId) loadSpells(charId).then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const slots = [
    {lvl:1, total:4, used:2},
    {lvl:2, total:3, used:1},
    {lvl:3, total:3, used:0},
    {lvl:4, total:2, used:0},
    {lvl:5, total:1, used:0},
  ];

  const prepared = [
    {n:'Shield', l:1, school:'abjuration', concentration:false, ritual:false, comp:'V,S', dmg:'reaction'},
    {n:'Magic Missile', l:1, school:'evocation', concentration:false, ritual:false, comp:'V,S', dmg:'1d4+1 ×3'},
    {n:'Detect Magic', l:1, school:'divination', concentration:true, ritual:true, comp:'V,S', dmg:'—'},
    {n:'Misty Step', l:2, school:'conjuration', concentration:false, ritual:false, comp:'V', dmg:'30 ft tp'},
    {n:'Web', l:2, school:'conjuration', concentration:true, ritual:false, comp:'V,S,M', dmg:'restrained'},
    {n:'Counterspell', l:3, school:'abjuration', concentration:false, ritual:false, comp:'S', dmg:'reaction'},
    {n:'Fireball', l:3, school:'evocation', concentration:false, ritual:false, comp:'V,S,M', dmg:'8d6 fire · 20ft'},
    {n:'Banishment', l:4, school:'abjuration', concentration:true, ritual:false, comp:'V,S,M', dmg:'CHA save'},
    {n:'Wall of Force', l:5, school:'evocation', concentration:true, ritual:false, comp:'V,S,M', dmg:'10×10 panels'},
  ];

  const ritualBook = [
    {n:'Identify', l:1, time:'10 min', last:'never'},
    {n:'Detect Magic', l:1, time:'10 min', last:'last session'},
    {n:'Comprehend Languages', l:1, time:'10 min', last:'S05'},
    {n:"Tenser's Floating Disk", l:1, time:'10 min', last:'never'},
    {n:'Phantom Steed', l:3, time:'10 min', last:'S08'},
    {n:"Rary's Telepathic Bond", l:5, time:'10 min', last:'never'},
  ];

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">25 · Magic system · Vessa</div>
          <h2>Spell prep &amp; casting</h2>
        </div>
        <span className="who">player surface · DM sees concentration timer</span>
      </div>

      <div className="aside blue" style={{marginBottom: 18}}>
        ↳ Vessa, Wizard 9. Prep budget = INT mod + level. Slots regenerate on long rest;
        ritual book lets her cast many spells at no slot cost (10 min). Components ≠ V,S,M
        are tracked against inventory automatically.
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
        {live && live.summary.knownCount === 0 && (
          <div className="tiny muted" style={{marginTop: 8}}>
            no spells_known rows · the panels below are demo data
          </div>
        )}
      </div>

      {/* Header strip — slots + concentration */}
      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="box-title"><h3>Spell slots</h3><span className="meta">long rest restores all</span></div>
          <div className="col" style={{gap: 8}}>
            {slots.map(s => (
              <div key={s.lvl} className="row" style={{alignItems:'center', gap: 10}}>
                <span className="tiny" style={{minWidth: 56}}>LEVEL {s.lvl}</span>
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
              <button className="btn sm">short rest</button>
              <button className="btn sm primary">long rest →</button>
              <span className="tiny muted" style={{marginLeft:'auto'}}>Arcane Recovery: 1 used</span>
            </div>
          </div>
        </div>

        <div className="box dark">
          <div className="tiny" style={{color:'var(--paper-3)'}}>CURRENTLY CONCENTRATING</div>
          <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 4}}>Web</div>
          <div className="tiny" style={{color:'var(--paper-3)', marginTop: 4}}>casted 2 rounds ago · 1 hr left</div>
          <div className="bar gold" style={{marginTop: 10}}><span style={{width:'92%'}} /></div>
          <div className="row" style={{gap: 6, marginTop: 10, flexWrap:'wrap'}}>
            <span className="chip" style={{borderColor:'var(--paper-3)', color:'var(--paper)'}}>3 enemies in</span>
            <span className="chip gold">CON save next hit</span>
          </div>
          <button className="btn sm" style={{marginTop: 10, width:'100%'}}>break concentration</button>
        </div>
      </div>

      {/* tabs */}
      <div className="tabs">
        {['prep','spellbook','ritual book','components','metamagic'].map(k => (
          <div key={k} className={`tab ${view===k?'active':''}`} onClick={()=>setView(k)}>{k}</div>
        ))}
      </div>

      {view === 'prep' && (
        <div>
          <div className="row" style={{gap: 8, alignItems:'baseline', marginBottom: 10}}>
            <span className="tiny"><b>PREP BUDGET</b></span>
            <span className="stat"><b>9</b> / 14 prepared (INT 4 + lvl 9 + tome bonus 1)</span>
            <button className="btn sm" style={{marginLeft:'auto'}}>＋ prepare from spellbook</button>
          </div>

          <table className="inv">
            <thead>
              <tr><th>spell</th><th>lvl</th><th>school</th><th>comp</th><th>effect</th><th>tags</th><th></th></tr>
            </thead>
            <tbody>
              {prepared.map((s,i) => (
                <tr key={i}>
                  <td style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{s.n}</td>
                  <td><span className="chip sm">L{s.l}</span></td>
                  <td className="tiny muted">{s.school}</td>
                  <td className="tiny">{s.comp}</td>
                  <td style={{fontSize: 13}}>{s.dmg}</td>
                  <td>
                    {s.concentration && <span className="chip sm gold">conc.</span>}{' '}
                    {s.ritual && <span className="chip sm blue">ritual</span>}
                  </td>
                  <td><button className="btn sm primary">cast</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'ritual book' && (
        <div>
          <div className="aside blue" style={{marginBottom: 14}}>
            ↳ ritual casting: 10 min, no slot cost. Vessa can cast any of these without preparing.
            Adding a new ritual costs 50gp + 2 hrs / spell level.
          </div>
          <div className="grid-2">
            {ritualBook.map((r,i) => (
              <div key={i} className="box">
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{r.n}</span>
                  <span className="chip sm">L{r.l} · ritual</span>
                </div>
                <div className="tiny muted" style={{marginTop: 4}}>cast time {r.time} · last cast {r.last}</div>
                <div className="row" style={{gap: 6, marginTop: 8}}>
                  <button className="btn sm primary">cast as ritual</button>
                  <button className="btn sm">cast w/ slot</button>
                </div>
              </div>
            ))}
            <div className="box dashed" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
              <button className="btn">＋ scribe new ritual</button>
            </div>
          </div>
        </div>
      )}

      {view === 'components' && (
        <div className="grid-2">
          <div className="box">
            <div className="box-title"><h3>Material costs</h3><span className="meta">tracked vs inventory</span></div>
            <table className="inv">
              <thead><tr><th>spell</th><th>component</th><th>cost</th><th>have</th></tr></thead>
              <tbody>
                <tr><td>Identify</td><td>pearl, 100gp</td><td>—</td><td>3 ✓</td></tr>
                <tr><td>Find Familiar</td><td>charcoal, herbs</td><td>10gp</td><td>1 ✓</td></tr>
                <tr><td>Revivify</td><td>diamonds</td><td>300gp</td><td className="muted">0 ✗</td></tr>
                <tr><td>Raise Dead</td><td>diamond</td><td>500gp</td><td className="muted">0 ✗</td></tr>
                <tr><td>Glyph of Warding</td><td>incense + powders</td><td>200gp</td><td>1 ✓</td></tr>
              </tbody>
            </table>
          </div>
          <div className="box">
            <div className="box-title"><h3>Focus / pouch</h3><span className="meta">Vessa</span></div>
            <ul style={{margin:0, paddingLeft: 16, fontSize: 13}}>
              <li>Arcane focus: <b>silvered orb of Selûne</b> (replaces non-costed M)</li>
              <li>Component pouch: ✓ assumed full of zero-cost goods</li>
              <li>Ruby dust (200gp) — for Continual Flame ×3</li>
              <li>Tome of secrets — +1 prep slot, requires attune</li>
            </ul>
            <div className="aside" style={{marginTop: 12}}>↳ if focus is sundered, all non-costed M components must be pulled from pouch by hand</div>
          </div>
        </div>
      )}

      {view === 'spellbook' && (
        <div className="placeholder" style={{minHeight: 280}}>
          spellbook view · all 47 spells in tome, prepared toggle, school filter, level filter
        </div>
      )}

      {view === 'metamagic' && (
        <div className="placeholder" style={{minHeight: 200}}>
          metamagic / sorcery points · Vessa is Wizard, n/a · shown for sorcerer / cleric variant
        </div>
      )}
    </div>
  );
}

