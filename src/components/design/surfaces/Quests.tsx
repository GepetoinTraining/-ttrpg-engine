// @ts-nocheck
'use client'

import React from 'react'
import { loadQuests } from '@/lib/narrative'

// surfaces/Quests.tsx — Quest + beat tracker.
// Live data: /api/quest/list?adventureId=X reads quests + beats joined under arcs.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Quests() {
  const [sel, setSel] = React.useState('selvys');
  const [live, setLive] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Without an adventureId we still get all quests across the DB. Fine for read-only display.
    loadQuests().then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const quests = [
    {id:'selvys', name:'The Selvys problem', tier:'A', status:'active', progress:5, of:7,
     hook:'Banite priestess running soul-cage rite under Trades Ward', sessions:'S08–S15'},
    {id:'compact', name:'Cement the Compact', tier:'A', status:'active', progress:2, of:5,
     hook:"Earn Lady Mireska's formal Harper backing", sessions:'S11–'},
    {id:'doruk', name:"Doruk's old commander", tier:'B', status:'active', progress:1, of:6,
     hook:'Personal — find Vorath, presumed dead, seen in Mulmaster', sessions:'S14–'},
    {id:'vault2', name:'The twin vault', tier:'B', status:'cold', progress:0, of:5,
     hook:'AI-inferred mirror cache; no party action yet', sessions:'—'},
    {id:'kael', name:"Kaelith's debt", tier:'C', status:'paused', progress:3, of:4,
     hook:'Owed favor to fence in Skullport', sessions:'S05–S09'},
    {id:'cloud', name:'Cloud Peaks elemental', tier:'C', status:'rumor', progress:0, of:4,
     hook:'Caravan gossip; not chased', sessions:'—'},
  ];

  const q = quests.find(x => x.id === sel);

  // beats for selected quest
  const beats = sel === 'selvys' ? [
    {n:'B1 · whispers reach the party', state:'done', knownBy:['party'], session:'S08'},
    {n:'B2 · identify the priestess', state:'done', knownBy:['Vessa','party'], session:'S09'},
    {n:'B3 · trace her supply line', state:'done', knownBy:['party'], session:'S10'},
    {n:'B4 · locate the Sunset Vault', state:'done', knownBy:['party'], session:'S11'},
    {n:'B5 · breach the vault (running)', state:'now',  knownBy:['party'], session:'S15 · current'},
    {n:'B6 · break the soul-cage rite', state:'next', knownBy:['Vessa','DM'], session:'pending', gate:'Vessa must succeed Arcana DC 17'},
    {n:'B7 · confront the soul-anchor', state:'hidden', knownBy:['DM'], session:'pending', gate:'unlocks only if rite breaks'},
  ] : [
    {n:'B1', state:'done', knownBy:['party'], session:'S11'},
    {n:'B2 · current', state:'now', knownBy:['party'], session:'S15'},
    {n:'B3 · gated', state:'next', knownBy:['DM'], session:'—', gate:'requires faction trust ≥ 3'},
  ];

  const tierCol = (t) => t==='A'?'red':t==='B'?'gold':'';

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">28 · Threads · beats · gates</div>
          <h2>Quests &amp; beats</h2>
        </div>
        <span className="who">DM · party sees only beats they know</span>
      </div>

      <div className="aside" style={{marginBottom: 18}}>
        ↳ each quest is a chain of beats. beats have <b>NPC-knowledge gates</b> — a beat
        is hidden until party / specific PC reaches the gate (skill check, rumor confirmed,
        ally favor). Promotes mystery and respects "show don't tell".
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live arcs / quests / beats</h3>
          <span className="meta">→ /api/quest/list · arcs + quests + beats</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && live.arcs.length === 0 && (
          <div className="tiny muted">no arcs in DB · cards below are demo</div>
        )}
        {live && live.arcs.length > 0 && (
          <div className="col" style={{gap: 8}}>
            {live.arcs.map((a: any) => (
              <div key={a.id} className="box soft" style={{padding: 8}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span><b>{a.name}</b> <span className="muted">· {a.arcType}</span></span>
                  <span className={`chip sm ${a.status === 'active' ? 'green' : ''}`}>{a.status}</span>
                </div>
                <div className="tiny muted" style={{marginTop: 4}}>
                  {a.quests.length} quests · {a.quests.reduce((s: number, q: any) => s + q.beats.length, 0)} beats
                </div>
                {a.quests.slice(0, 3).map((q: any) => (
                  <div key={q.id} style={{marginTop: 4, paddingLeft: 12, fontSize: 12}}>
                    <span>↳ <b>{q.objective}</b> <span className="muted">· {q.status} · {q.beats.length} beats</span></span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid-4" style={{marginBottom: 18}}>
        {[
          {n:'Active threads', v:'3', sub:'tier A: 2'},
          {n:'Beats this session', v:'2', sub:'1 done · 1 active'},
          {n:'Cold / paused', v:'2', sub:'1 personal'},
          {n:'Gated reveals', v:'4', sub:'1 unlockable now'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-3" style={{gap: 18, alignItems:'flex-start'}}>
        {/* quest list */}
        <div className="box" style={{gridColumn:'span 1'}}>
          <div className="box-title"><h3>Threads</h3><span className="meta">{quests.length}</span></div>
          <div className="col" style={{gap: 8}}>
            {quests.map(qu => (
              <a key={qu.id} onClick={()=>setSel(qu.id)} style={{
                  padding: 10, cursor:'pointer',
                  border:'1px solid '+(sel===qu.id?'var(--rule)':'var(--rule-soft)'),
                  background: sel===qu.id ? 'var(--paper-2)' : 'var(--paper)',
                  display:'block',
                }}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', gap: 6}}>
                  <span className={`chip sm ${tierCol(qu.tier)}`}>tier {qu.tier}</span>
                  <span className={`chip sm ${qu.status==='active'?'green':qu.status==='cold'?'':qu.status==='rumor'?'gold':''}`}>{qu.status}</span>
                </div>
                <div style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600, marginTop: 4}}>{qu.name}</div>
                <div className="tiny muted" style={{marginTop: 4}}>{qu.hook}</div>
                <div className="bar" style={{marginTop: 6}}><span style={{width: `${(qu.progress/qu.of)*100}%`}} /></div>
                <div className="tiny" style={{marginTop: 2}}>{qu.progress}/{qu.of} beats · {qu.sessions}</div>
              </a>
            ))}
            <button className="btn sm" style={{marginTop: 4}}>＋ new thread</button>
          </div>
        </div>

        {/* beats timeline */}
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
            <div>
              <div className="tiny">{q.tier===q.tier?`TIER ${q.tier}`:''} · {q.status.toUpperCase()}</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 4}}>{q.name}</div>
              <div className="tiny muted" style={{marginTop: 4}}>{q.hook}</div>
            </div>
            <div className="row" style={{gap: 6}}>
              <button className="btn sm">edit thread</button>
              <button className="btn sm primary">advance beat →</button>
            </div>
          </div>

          <div className="section-title">Beats</div>

          <div style={{position:'relative', paddingLeft: 28}}>
            <div style={{position:'absolute', left: 12, top: 8, bottom: 8, borderLeft:'2px dashed var(--rule-soft)'}} />
            {beats.map((b,i) => {
              const dotCol = b.state==='done' ? 'var(--accent-green)'
                          : b.state==='now' ? 'var(--accent-red)'
                          : b.state==='next' ? 'var(--accent-gold)'
                          : 'var(--ink-3)';
              return (
                <div key={i} style={{position:'relative', paddingBottom: 16}}>
                  <div style={{position:'absolute', left:-22, top: 6, width: 12, height: 12, borderRadius:'50%', background: dotCol, border:'2px solid var(--paper)', boxShadow:`0 0 0 1.5px ${dotCol}`}} />
                  <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                    <span style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600, color: b.state==='hidden'?'var(--ink-3)':'var(--ink)'}}>
                      {b.state==='hidden' ? '████ ████ ████' : b.n}
                    </span>
                    <span className="tiny">{b.session}</span>
                  </div>
                  <div className="row" style={{gap: 6, marginTop: 4, flexWrap:'wrap'}}>
                    {b.knownBy.map(k => (
                      <span key={k} className={`chip sm ${k==='DM'?'red':k==='party'?'blue':'gold'}`}>known by {k}</span>
                    ))}
                    {b.gate && (
                      <span className="chip sm gold">gate: {b.gate}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="section-title">Knowledge gate · who knows what</div>
          <table className="inv">
            <thead><tr><th>character</th><th>last beat seen</th><th>gated by</th><th>could unlock</th></tr></thead>
            <tbody>
              <tr><td>Kaelith</td><td>B5 (current)</td><td>—</td><td>B6 if Vessa succeeds</td></tr>
              <tr><td>Vessa</td><td>B5 (current)</td><td>Arcana DC 17</td><td><b>B6 next round</b></td></tr>
              <tr><td>Doruk</td><td>B5 (current)</td><td>—</td><td>B6 (witness)</td></tr>
              <tr><td className="muted">Mireska (NPC)</td><td className="muted">B4</td><td className="muted">awaits debrief</td><td className="muted">—</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

