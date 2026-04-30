// @ts-nocheck
'use client'

import React from 'react'
import { listNPCs, type NPCSummary } from '@/lib/world-detail'

// surfaces/Roster.tsx — DM full NPC cast.
// Live data: /api/npc/list reads npcs (+ memories on detail).

export default function Roster() {
  const [selected, setSelected] = React.useState('selvys');
  const [filter, setFilter] = React.useState('all');
  const [live, setLive] = React.useState<NPCSummary[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    listNPCs({ limit: 200 }).then(r => setLive(r.npcs)).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const npcs = [
    {id:'selvys',  n:'Selvys Vrend',          role:'Banite priestess',     loc:'Waterdeep',   loy:-72, kn:14, faction:'Zhent',   status:'active',  drives:['advance Manshoon','recover Sunset Vault'], tag:'red'},
    {id:'pell',    n:"Old Pell",                role:'fence',                loc:'Mulmaster',   loy: 38, kn:23, faction:'Indep.',  status:'wounded', drives:['stay alive','protect Kaelith'], tag:'blue'},
    {id:'manshoon',n:'Lord Manshoon',           role:'Zhent overlord',        loc:'???',         loy:-95, kn:62, faction:'Zhent',   status:'plotting',drives:['expand network','clone success'], tag:'red'},
    {id:'mira',    n:'Mira',                    role:'safehouse caretaker',  loc:'Waterdeep',   loy: 84, kn: 8, faction:'party',   status:'staffing',drives:['serve party','keep safehouse hidden'], tag:'green'},
    {id:'lia',     n:'Lia of Aldreth',          role:'merchant scion',       loc:'Suzail',      loy: 12, kn: 6, faction:'Crown',   status:'flirting',drives:['profit','climb noble ladder'], tag:'gold'},
    {id:'garven',  n:'"Hook" Garven',           role:'dockmaster · Zhent',   loc:'Suzail',      loy:-44, kn:11, faction:'Zhent',   status:'unaware', drives:['skim','keep Crown unaware'], tag:'red'},
    {id:'embra',   n:'Sister Embra',            role:'Tymoran priestess',    loc:'Suzail',      loy: 22, kn: 4, faction:'Tymora',  status:'helpful', drives:['heal','spread luck'], tag:'green'},
    {id:'alusair', n:'Regent Alusair',          role:'Steel Regent',         loc:'Suzail',      loy: 18, kn: 3, faction:'Crown',   status:'governing',drives:['stabilize Cormyr','protect heir'], tag:'blue'},
    {id:'doruk-mom',n:"Etta (Doruk's mother)",  role:'farmer',               loc:'Daggerford',  loy: 50, kn: 1, faction:'family',  status:'worried', drives:['son comes home'], tag:'green'},
    {id:'aramil-rival',n:'Sir Vance Marl',      role:'former captain',       loc:'Waterdeep',   loy:-30, kn: 9, faction:'Crown',   status:'bitter',  drives:['ruin Aramil','reclaim title'], tag:'red'},
  ];

  const filtered = filter === 'all' ? npcs : npcs.filter(n => n.tag === filter);
  const npc = npcs.find(n => n.id === selected);

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">17 · DM · full cast</div>
          <h2>NPC Roster</h2>
        </div>
        <span className="who">everyone the AI can voice</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ Voicebox (in DM Console) is a chat surface. <b>This is the cast.</b> Search,
        filter, view loyalty &amp; agenda, and gate what each NPC <i>knows</i> before
        the AI speaks for them.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live NPC roster</h3>
          <span className="meta">→ /api/npc/list · npcs</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && live.length === 0 && (
          <div className="tiny muted">no npcs in DB · cards below are demo</div>
        )}
        {live && live.length > 0 && (
          <div className="col" style={{gap: 4, maxHeight: 200, overflowY: 'auto'}}>
            <div className="row"><span className="stat">{live.length} NPCs loaded</span></div>
            {live.slice(0, 30).map((n) => (
              <div key={n.id} className="row" style={{justifyContent:'space-between', padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)', fontSize: 13}}>
                <span><b>{n.name}</b> <span className="muted">· {n.role ?? '?'}</span></span>
                <span className="tiny">
                  <span className={`chip sm ${n.disposition === 'hostile' ? 'red' : n.disposition === 'friendly' ? 'green' : ''}`}>{n.disposition}</span>
                  {n.craft && <span className="muted"> · {n.craft}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{gap: 14, alignItems: 'flex-start'}}>
        {/* LEFT: list */}
        <div className="col" style={{width: 360, gap: 10}}>
          <div className="row" style={{gap: 6}}>
            <input className="placeholder" style={{flex:1, padding:'6px 10px', minHeight:0, fontFamily:'var(--mono)', fontSize: 12}} placeholder="🔍  search NPCs…" />
            <button className="btn sm">＋ new</button>
          </div>
          <div className="row" style={{gap: 4, flexWrap:'wrap'}}>
            {[['all','all · 124'],['blue','allies'],['red','hostile'],['gold','neutral'],['green','known-good']].map(([k, l]) => (
              <span key={k} className={`chip ${k!=='all'?k:''} sm`} onClick={()=>setFilter(k)}
                    style={{cursor:'pointer', background: filter===k?'var(--ink)':undefined, color: filter===k?'var(--paper)':undefined, borderColor: filter===k?'var(--ink)':undefined}}>
                {l}
              </span>
            ))}
          </div>
          <div className="box" style={{padding: 0}}>
            {filtered.map(n => (
              <div key={n.id} onClick={()=>setSelected(n.id)}
                   style={{padding: '10px 12px', borderBottom: '1px dashed var(--rule-soft)', cursor: 'pointer',
                           background: selected===n.id ? 'var(--paper-2)' : 'transparent',
                           borderLeft: `3px solid var(--accent-${n.tag})`}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{n.n}</span>
                  <span className="stat" style={{color: n.loy < 0 ? 'var(--accent-red)' : 'var(--accent-green)'}}><b>{n.loy>0?'+':''}{n.loy}</b></span>
                </div>
                <div className="tiny" style={{marginTop: 2}}>{n.role} · {n.loc}</div>
                <div className="row" style={{gap: 4, marginTop: 4}}>
                  <span className="chip sm">{n.faction}</span>
                  <span className="chip sm muted">knows {n.kn}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: detail */}
        <div className="col" style={{flex: 1, gap: 14}}>
          <div className="box">
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
              <div>
                <div className="tiny">{npc.faction.toUpperCase()} · {npc.loc.toUpperCase()}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2}}>{npc.n}</div>
                <div className="hand" style={{color:'var(--accent-blue)', fontSize: 18}}>{npc.role}</div>
              </div>
              <div className="row" style={{gap: 6}}>
                <button className="btn sm">edit</button>
                <button className="btn sm primary">→ Voicebox</button>
              </div>
            </div>
            <hr className="rule dashed" />
            <div className="grid-3">
              <div>
                <div className="tiny">LOYALTY (to party)</div>
                <div className={`bar ${npc.loy < 0 ? 'red' : 'green'}`}><span style={{width: `${Math.abs(npc.loy)}%`, marginLeft: npc.loy < 0 ? 0 : 0}} /></div>
                <div className="stat" style={{marginTop: 4}}><b>{npc.loy>0?'+':''}{npc.loy}</b> / ±100</div>
              </div>
              <div>
                <div className="tiny">DISPOSITION TODAY</div>
                <div className="hand ink" style={{fontSize: 18}}>{npc.status}</div>
                <div className="tiny muted">last contact: 6 days ago</div>
              </div>
              <div>
                <div className="tiny">AI VOICE PROFILE</div>
                <div className="row" style={{gap: 4, flexWrap:'wrap', marginTop: 2}}>
                  <span className="chip sm">cold</span>
                  <span className="chip sm">zealous</span>
                  <span className="chip sm">clipped imperatives</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2">
            {/* Agenda */}
            <div className="box">
              <div className="box-title"><h3>Agenda</h3><span className="meta">npc-agenda.ts</span></div>
              <ol style={{paddingLeft: 18, margin: '4px 0', fontSize: 14}}>
                {npc.drives.map((d, i) => (
                  <li key={i} style={{marginBottom: 4}}><b>drive {i+1}.</b> {d}</li>
                ))}
              </ol>
              <hr className="rule dashed" />
              <div className="tiny" style={{marginBottom: 4}}>NEXT MOVE (AI projection)</div>
              <div style={{fontSize: 13, color:'var(--ink-2)'}}>
                Will attempt to recover Sunset Vault contents within 2 weeks.
                If blocked, escalates to Manshoon for hit squad.
              </div>
              <div className="bar red" style={{marginTop: 8}}><span style={{width:'48%'}} /></div>
              <div className="tiny" style={{marginTop: 4}}>escalation clock · 3.8 / 8</div>
            </div>

            {/* Knowledge gating */}
            <div className="box">
              <div className="box-title"><h3>Knowledge pool</h3><span className="meta">knows {npc.kn} facts</span></div>
              <table className="inv">
                <thead><tr><th>Fact</th><th>Source</th><th>Share?</th></tr></thead>
                <tbody>
                  <tr><td>Kaelith was a Mulmaster street kid</td><td className="muted">arc 01</td><td><span className="chip red sm">won't say</span></td></tr>
                  <tr><td>Sunset Vault inventory list</td><td className="muted">arc 02</td><td><span className="chip red sm">private</span></td></tr>
                  <tr><td>Manshoon's Waterdeep cell location</td><td className="muted">npc.faction</td><td><span className="chip red sm">never</span></td></tr>
                  <tr><td>Old Pell tortured 3 winters ago</td><td className="muted">backstory</td><td><span className="chip gold sm">if pushed</span></td></tr>
                  <tr><td>Banite hold-person prepped today</td><td className="muted">scene</td><td><span className="chip gold sm">if asked</span></td></tr>
                  <tr><td>Refugee number from Sembia</td><td className="muted">public</td><td><span className="chip green sm">freely</span></td></tr>
                </tbody>
              </table>
              <div className="aside" style={{marginTop: 10, fontSize: 16}}>
                ↳ AI <b>cannot</b> reveal red items even if PC rolls Persuasion 30. <br/>
                ↳ gold items unlock past DC 22.
              </div>
            </div>

            {/* Relationships */}
            <div className="box" style={{gridColumn:'span 2'}}>
              <div className="box-title"><h3>Relationships</h3><span className="meta">to other NPCs &amp; PCs</span></div>
              <div className="grid-3">
                {[
                  {to:'Manshoon',  v:'+62', n:'reports to'},
                  {to:'Old Pell',  v:'−40', n:'tortured (Mulmaster)'},
                  {to:'Kaelith',   v:'−72', n:'recognizes by sight'},
                  {to:'Hook Garven',v:'+18',n:'cell handler'},
                  {to:'Doruk',     v:'−15', n:'theological enemy'},
                  {to:'Sister Embra',v:'−68',n:'rival faith'},
                ].map(r => (
                  <div key={r.to} className="box soft" style={{padding:'8px 10px'}}>
                    <div className="row" style={{justifyContent:'space-between'}}>
                      <span style={{fontSize: 14, fontWeight: 600}}>{r.to}</span>
                      <span className="stat" style={{color: r.v.includes('-') ? 'var(--accent-red)' : 'var(--accent-green)'}}><b>{r.v}</b></span>
                    </div>
                    <div className="tiny">{r.n}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

