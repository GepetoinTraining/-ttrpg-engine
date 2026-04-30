// @ts-nocheck
'use client'

import React from 'react'
import { loadDiplomacy } from '@/lib/narrative'

// surfaces/Diplomacy.tsx — Diplomacy / intelligence briefings.
// Live data: /api/diplomacy/list bundles factions + factionRelations +
// social_contracts + wiki_articles WHERE articleType='intel_brief' (briefings
// reuse the wiki table per user direction).

export default function Diplomacy() {
  const [tab, setTab] = React.useState('briefings');
  const [live, setLive] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadDiplomacy().then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const briefings = [
    {id:1, src:'Lady Mireska · Harper', urg:'high', age:'2h', read:false,
     subj:'Zhent payroll ledger has Castle Waterdeep watch on it',
     body:'The payroll you recovered names 4 watch captains. I can move on this — but only if you formally ally. Decide before nightfall.',
     ask:'sign Compact addendum', cost:'binds party to Harper code'},
    {id:2, src:'Open Lord · proxy', urg:'med', age:'1d', read:true,
     subj:'Audience requested · re: Sunset Vault haul',
     body:'The Lords want the cult artifacts surrendered to the city. They will pay. They will also notice if you refuse.',
     ask:'attend audience day 5', cost:'250gp travel + 1 downtime'},
    {id:3, src:'Caravan factor · Daggerford', urg:'low', age:'3d', read:true,
     subj:'Trade lane closures · routing east',
     body:'The Trade Way is hot. Caravans pay 30% over for armed escort south of the Crossroad.',
     ask:'escort contract?', cost:'optional · 600gp / leg'},
    {id:4, src:'Anonymous · drop in Plinth pew',
     urg:'critical', age:'40m', read:false,
     subj:'someone in your party is being scryed',
     body:'I know who. I will tell you for nothing. Meet me at the Yawning Portal, back booth, when the moon clears the spire.',
     ask:'meet anonymous source', cost:'risk: ambush probable'},
  ];

  const treaties = [
    {p:'The Compact ↔ Harpers',         tone:'warming', terms:'mutual intel · no kill orders', exp:'open'},
    {p:'The Compact ↔ Lords (Wd)',      tone:'cool',    terms:'tolerated · case-by-case',     exp:'2 mo'},
    {p:"The Compact ↔ Lord's Hold",    tone:'allied',  terms:'shelter · 1 favor owed',       exp:'open'},
    {p:'The Compact ↔ Zhent',           tone:'open war',terms:'—',                             exp:'—'},
    {p:'Harpers ↔ Lords (Wd)',          tone:'tense',   terms:'tacit',                         exp:'—'},
    {p:'Zhent ↔ Bane cult',             tone:'allied',  terms:'shared cells, separate orders',exp:'—'},
  ];

  const sources = [
    {n:'Lady Mireska (Harper)',  rel:'ally',  reach:'Sword Coast', last:'today',  reliab: 5},
    {n:'Old Pell',               rel:'ally',  reach:'Waterdeep',   last:'3 days', reliab: 4},
    {n:"Tymora's house priest", rel:'ally',  reach:'Plinth',      last:'1 wk',   reliab: 3},
    {n:'Surveillance · Trades',  rel:'paid',  reach:'1 ward',      last:'1 day',  reliab: 3},
    {n:'AI inference',           rel:'self',  reach:'global',      last:'live',   reliab: 2},
    {n:'Anonymous · pew drop',   rel:'?',     reach:'?',           last:'40m',    reliab: 1},
  ];

  const toneCol = (t) => t==='allied'?'green':t==='warming'?'blue':t==='cool'?'gold':t==='tense'||t==='open war'?'red':'';
  const urgCol  = (u) => u==='critical'?'red':u==='high'?'red':u==='med'?'gold':'';

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">30 · Statecraft &amp; intelligence</div>
          <h2>Diplomacy &amp; briefings</h2>
        </div>
        <span className="who">DM · party sees only what allies share</span>
      </div>

      <div className="aside" style={{marginBottom: 18}}>
        ↳ inbound dispatches from allies, contracts, treaty status, and intelligence
        sources. each briefing carries an <b>ask</b> and a <b>cost</b>. the engine ticks
        treaty tone between sessions; relations decay if ignored.
      </div>

      {/* Live engine strip — three tabs share data */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live diplomacy data</h3>
          <span className="meta">→ /api/diplomacy/list · faction_relations + social_contracts + wiki_articles[intel_brief]</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {live && (
          <>
            <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, marginBottom: 8, flexWrap:'wrap'}}>
              <span>factions <b>{live.counts.factions}</b></span>
              <span>treaties <b>{live.counts.relations}</b></span>
              <span>active contracts <b>{live.counts.contracts}</b></span>
              <span>intel briefings <b>{live.counts.briefings}</b></span>
            </div>
            {live.relations.length > 0 && (
              <div style={{marginTop: 8}}>
                <div className="tiny" style={{marginBottom: 4}}>RELATIONS · top 5</div>
                <div className="col" style={{gap: 2, fontSize: 12, fontFamily:'var(--mono)'}}>
                  {live.relations.slice(0, 5).map((r: any) => {
                    const a = live.factions.find((f: any) => f.id === r.factionA)?.name ?? r.factionA.slice(0,8)
                    const b = live.factions.find((f: any) => f.id === r.factionB)?.name ?? r.factionB.slice(0,8)
                    return (
                      <div key={r.id} className="row" style={{justifyContent:'space-between'}}>
                        <span>{a} ↔ {b}</span>
                        <span><span className={`chip sm ${r.stance === 'allied' ? 'green' : r.stance === 'hostile' ? 'red' : ''}`}>{r.stance}</span> trust {r.trust.toFixed(0)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {(live.relations.length === 0 && live.contracts.length === 0 && live.briefings.length === 0) && (
              <div className="tiny muted">no diplomatic data yet · the tabs below are wireframe</div>
            )}
          </>
        )}
      </div>

      <div className="grid-4" style={{marginBottom: 18}}>
        {[
          {n:'Unread briefings', v:'2', sub:'1 critical'},
          {n:'Active treaties', v:'3', sub:'1 warming'},
          {n:'Active war', v:'1', sub:'Zhentarim'},
          {n:'Sources', v:'6', sub:'4 reliable'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {['briefings','treaties','sources','contracts'].map(k => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{k}</div>
        ))}
      </div>

      {tab==='briefings' && (
        <div className="col">
          {briefings.map(b => (
            <div key={b.id} className="box" style={{padding: 16, position:'relative', borderLeft:'4px solid '+(b.urg==='critical'?'var(--accent-red)':b.urg==='high'?'var(--accent-red)':b.urg==='med'?'var(--accent-gold)':'var(--rule-soft)')}}>
              {!b.read && <span className="dot red" style={{position:'absolute', top: 14, right: 14}} />}
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap: 8}}>
                <span className="tiny"><b>FROM</b> · {b.src}</span>
                <span className="tiny muted">{b.age} ago</span>
              </div>
              <div className="row" style={{gap: 8, alignItems:'baseline', marginTop: 6}}>
                <span className={`chip sm ${urgCol(b.urg)}`}>{b.urg}</span>
                <span style={{fontFamily:'var(--serif)', fontSize: 18, fontWeight: 600}}>{b.subj}</span>
              </div>
              <div style={{fontFamily:'var(--serif)', fontSize: 15, fontStyle:'italic', color:'var(--ink-2)', marginTop: 8, lineHeight: 1.5}}>
                "{b.body}"
              </div>

              <div className="row" style={{gap: 12, marginTop: 12, paddingTop: 10, borderTop:'1px dashed var(--rule-soft)', flexWrap:'wrap', alignItems:'baseline'}}>
                <span className="tiny"><b>ASK</b> · {b.ask}</span>
                <span className="tiny"><b>COST</b> · {b.cost}</span>
                <div style={{marginLeft:'auto', display:'flex', gap: 6}}>
                  <button className="btn sm primary">accept</button>
                  <button className="btn sm">defer</button>
                  <button className="btn sm danger">decline</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='treaties' && (
        <table className="inv">
          <thead><tr><th>parties</th><th>tone</th><th>terms</th><th>expires</th><th>last tick</th><th></th></tr></thead>
          <tbody>
            {treaties.map((t,i) => (
              <tr key={i}>
                <td style={{fontFamily:'var(--serif)', fontWeight: 500}}>{t.p}</td>
                <td><span className={`chip sm ${toneCol(t.tone)}`}>{t.tone}</span></td>
                <td className="tiny">{t.terms}</td>
                <td className="tiny muted">{t.exp}</td>
                <td className="tiny muted">today</td>
                <td><button className="btn sm">edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab==='sources' && (
        <div className="grid-2">
          {sources.map((s,i) => (
            <div key={i} className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <span style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{s.n}</span>
                <span className={`chip sm ${s.rel==='ally'?'blue':s.rel==='paid'?'gold':s.rel==='?'?'red':''}`}>{s.rel}</span>
              </div>
              <div className="row" style={{gap: 10, marginTop: 6}}>
                <span className="tiny">REACH · <b>{s.reach}</b></span>
                <span className="tiny">LAST · <b>{s.last}</b></span>
              </div>
              <div className="row" style={{gap: 4, marginTop: 8, alignItems:'center'}}>
                <span className="tiny" style={{minWidth: 60}}>RELIAB.</span>
                {Array.from({length:5}).map((_,j) => (
                  <div key={j} style={{flex: 1, height: 6, background: j<s.reliab?'var(--ink)':'var(--paper-2)', border:'1px solid var(--rule)'}} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='contracts' && (
        <div className="placeholder" style={{minHeight: 200}}>
          ongoing contracts · escort jobs, bounties, retainers · wires into Markets surface
        </div>
      )}
    </div>
  );
}

