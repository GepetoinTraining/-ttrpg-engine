// @ts-nocheck
'use client'

import React from 'react'
import { listCompanions, type Companion } from '@/lib/companion'
import { getActiveCharacter } from '@/lib/character'

// surfaces/Companions.tsx — companions / pets / mounts (engine/husbandry.ts).
// Live data loads from /api/companion/list?characterId=ACTIVE; falls back to demo data.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Companions() {
  const [tab, setTab] = React.useState('all');
  const [live, setLive] = React.useState<Companion[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid) ?? undefined
    listCompanions(charId).then(r => setLive(r.companions)).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const companions = [
    {id:'sable', n:'Sable', kind:'mount', species:'warhorse',
     bonded:'Doruk', mood:'eager', health:38, healthMax:38, loyalty:5, fatigue:2,
     hooks:"remembers Vorath's scent",
     status:'active'},
    {id:'mim', n:'Mim', kind:'familiar', species:'pseudodragon',
     bonded:'Vessa', mood:'curious', health:9, healthMax:12, loyalty:5, fatigue:0,
     hooks:'telepathic 100ft · scout',
     status:'active'},
    {id:'grit', n:'Grit', kind:'pet', species:'mastiff',
     bonded:'Kaelith', mood:'alert', health:21, healthMax:24, loyalty:4, fatigue:1,
     hooks:'tracks bloodscent',
     status:'active'},
    {id:'whrl', n:'Whrl', kind:'companion', species:'awakened owl',
     bonded:'party', mood:'cryptic', health:6, healthMax:8, loyalty:3, fatigue:0,
     hooks:'speaks Common, hates fire',
     status:'wandering'},
    {id:'ash', n:'Ash', kind:'mount', species:'griffon',
     bonded:'—', mood:'wild', health:0, healthMax:60, loyalty:0, fatigue:0,
     hooks:"stabled at Lord's Hold · not yet tamed",
     status:'pending'},
    {id:'mossy', n:'Mossy', kind:'pet', species:'tortoise',
     bonded:'Vessa', mood:'asleep', health:14, healthMax:14, loyalty:5, fatigue:0,
     hooks:'mascot · no combat',
     status:'home'},
  ];

  const visible = tab==='all' ? companions : companions.filter(c => c.kind === tab);

  const moodGlyph = {eager:'⚡', curious:'?', alert:'!', cryptic:'☽', wild:'⚔', asleep:'z'};

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">29 · Husbandry · pets &amp; mounts</div>
          <h2>Companions</h2>
        </div>
        <span className="who">shared · per-PC bonds · DM ticks moods</span>
      </div>

      <div className="aside blue" style={{marginBottom: 18}}>
        ↳ companions are first-class actors: HP, loyalty, fatigue, mood. They die.
        Mounts have stamina drains on long travel. Pets earn hooks (a mastiff who
        has tracked the same scent twice will offer it on the third meeting).
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live companions in DB</h3>
          <span className="meta">→ /api/companion/list · companions + companion_catalog</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && live.length === 0 && (
          <div className="tiny muted">no companions in DB yet · cards below are demo data</div>
        )}
        {live && live.length > 0 && (
          <div className="col" style={{gap: 6}}>
            {live.map((c) => (
              <div key={c.id} className="row" style={{justifyContent:'space-between', padding: '6px 0', borderBottom: '1px dashed var(--rule-soft)'}}>
                <span>
                  <b>{c.name}</b>{' '}
                  <span className="muted">· {c.catalog?.category ?? '?'} · {c.catalog?.species ?? '?'}</span>
                </span>
                <span className="stat">
                  HP {c.hp.current}/{c.hp.max} · bond {c.bondLevel} · {c.mood}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid-4" style={{marginBottom: 18}}>
        {[
          {n:'Bonded', v:'5', sub:'1 unclaimed'},
          {n:'Active in field', v:'3', sub:'Sable, Mim, Grit'},
          {n:'Wounded', v:'2', sub:'Mim, Grit'},
          {n:'Stabled / home', v:'2', sub:'Ash pending tame'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {['all','mount','familiar','pet','companion'].map(k => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{k}{k!=='all'?'s':''}</div>
        ))}
      </div>

      <div className="grid-2">
        {visible.map(c => (
          <div key={c.id} className="box" style={{padding: 16}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', gap: 10}}>
              <div>
                <div className="tiny">{c.kind.toUpperCase()} · {c.species}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 4}}>{c.n}</div>
                <div className="row" style={{gap: 6, marginTop: 6, flexWrap:'wrap'}}>
                  <span className="chip sm blue">bonded · {c.bonded}</span>
                  <span className={`chip sm ${c.status==='active'?'green':c.status==='pending'?'gold':''}`}>{c.status}</span>
                  <span className="chip sm">{moodGlyph[c.mood]||'·'} {c.mood}</span>
                </div>
              </div>
              <div className="placeholder" style={{width: 88, height: 88, padding: 0, fontSize: 9, lineHeight: 1.2}}>
                portrait<br/>{c.species}
              </div>
            </div>

            <div className="row" style={{gap: 14, marginTop: 14, alignItems:'flex-start'}}>
              <div style={{flex: 1}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span className="tiny">HP</span>
                  <span className="stat">{c.health}/{c.healthMax}</span>
                </div>
                <div className={`bar ${c.health/c.healthMax < 0.4 ? 'red' : c.health/c.healthMax < 0.75 ? 'gold':'green'}`}>
                  <span style={{width: `${(c.health/c.healthMax)*100}%`}} />
                </div>
              </div>
              <div style={{flex: 1}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span className="tiny">LOYALTY</span>
                  <span className="stat">{c.loyalty}/5</span>
                </div>
                <div className="row" style={{gap: 2}}>
                  {Array.from({length: 5}).map((_,i) => (
                    <div key={i} style={{
                      flex: 1, height: 8,
                      border:'1px solid var(--rule)',
                      background: i<c.loyalty ? 'var(--accent-blue)' : 'var(--paper-2)',
                    }} />
                  ))}
                </div>
              </div>
              <div style={{flex: 1}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span className="tiny">FATIGUE</span>
                  <span className="stat">{c.fatigue}/6</span>
                </div>
                <div className={`bar ${c.fatigue>=4?'red':c.fatigue>=2?'gold':''}`}>
                  <span style={{width: `${(c.fatigue/6)*100}%`}} />
                </div>
              </div>
            </div>

            <div className="aside" style={{marginTop: 12, fontSize: 16}}>
              ↳ {c.hooks}
            </div>

            <div className="row" style={{gap: 6, marginTop: 12, paddingTop: 10, borderTop:'1px dashed var(--rule-soft)', flexWrap:'wrap'}}>
              <button className="btn sm">summon / bring</button>
              <button className="btn sm">command</button>
              <button className="btn sm">tend &amp; feed</button>
              {c.status==='pending' && <button className="btn sm primary">begin taming →</button>}
              <button className="btn sm danger" style={{marginLeft:'auto'}}>retire</button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Catalog · adoptable / encounterable</div>
      <div className="grid-4">
        {[
          {n:'Wolfhound pup', loc:'Daggerford kennel', cost:'15gp'},
          {n:'Tressym', loc:'Yawning Portal alley', cost:'persuade'},
          {n:'Riding lizard', loc:'Skullport', cost:'40gp'},
          {n:'Imp (warlock)', loc:'pact-bound', cost:'rite'},
        ].map(c => (
          <div key={c.n} className="box soft">
            <div style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{c.n}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{c.loc} · {c.cost}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

