// @ts-nocheck
'use client'

import React from 'react'
// surfaces/Rumors.jsx — Intel pool · sources · credibility

export default function Rumors() {
  const [filter, setFilter] = React.useState('all');

  const rumors = [
    {
      id: 1,
      txt: 'Manshoon keeps a "shadow" body in Daggerford — destroying his Waterdeep form does nothing.',
      src: 'Old Pell',
      srcKind: 'ally',
      cred: 'likely',
      tags: ['Manshoon','Daggerford'],
      knownBy: 'Kaelith',
      age: '3 days',
      flag: 'world-shifting',
    },
    {
      id: 2,
      txt: 'A second Banite priestess works at the Yawning Portal as a barback — Selvys\'s cousin.',
      src: 'Surveillance · Trades Ward',
      srcKind: 'downtime',
      cred: 'unverified',
      tags: ['Bane','Waterdeep','NPC'],
      knownBy: 'party',
      age: '1 day',
    },
    {
      id: 3,
      txt: 'The Open Lord knows the Zhentarim are inside Castle Waterdeep but lacks proof.',
      src: 'Lady Mireska (Harper)',
      srcKind: 'ally',
      cred: 'confirmed',
      tags: ['Lords','Zhentarim','political'],
      knownBy: 'party',
      age: '6 days',
    },
    {
      id: 4,
      txt: 'A fire elemental was sighted in the Cloud Peaks. Could be cult summoning or natural.',
      src: 'Caravan gossip',
      srcKind: 'tavern',
      cred: 'uncertain',
      tags: ['Cloud Peaks','elemental'],
      knownBy: 'Vessa',
      age: '2 days',
    },
    {
      id: 5,
      txt: 'Selvys\'s pendant is tied to a soul-cage. Killing her may not end her.',
      src: 'Vessa research',
      srcKind: 'downtime',
      cred: 'confirmed',
      tags: ['Selvys','Bane','arcana'],
      knownBy: 'party',
      age: 'today',
      flag: 'critical',
    },
    {
      id: 6,
      txt: 'The Sunset Vault is a decoy. The real cache is under the Trades Ward fish market.',
      src: 'AI inference',
      srcKind: 'ai',
      cred: 'speculative',
      tags: ['Vault','Waterdeep'],
      knownBy: 'DM only',
      age: '—',
      flag: 'DM-eyes',
    },
    {
      id: 7,
      txt: 'Doruk\'s old commander, presumed dead, was seen in Mulmaster wearing Banite colors.',
      src: 'Letter from Tyr-temple',
      srcKind: 'mail',
      cred: 'likely',
      tags: ['Doruk','Bane','Mulmaster','personal'],
      knownBy: 'Doruk',
      age: '5 days',
      flag: 'personal hook',
    },
  ];

  const credColor = { confirmed:'green', likely:'gold', unverified:'blue', uncertain:'blue', speculative:'red' };
  const srcLabel = { ally:'Ally', downtime:'Downtime', tavern:'Tavern', ai:'AI inference', mail:'Letter' };

  const visible = filter === 'all' ? rumors
                : filter === 'critical' ? rumors.filter(r => r.flag)
                : filter === 'dm' ? rumors.filter(r => r.knownBy === 'DM only')
                : rumors.filter(r => r.tags.includes(filter));

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">09 · Intel pool</div>
          <h2>Rumors</h2>
        </div>
        <span className="who">DM sees all · players see what they know</span>
      </div>

      <div className="aside" style={{maxWidth: 760, marginBottom: 18}}>
        ↳ rumors come from downtime actions, NPC voicebox, allies, gossip, and AI
        inference. each carries a <b>credibility</b> and a <b>source</b>. confirming a
        rumor often costs a downtime slot or a favor.
      </div>

      {/* Stats strip */}
      <div className="grid-4" style={{marginBottom: 18}}>
        {[
          {n:'Active rumors', v:'7', sub:'+3 this week'},
          {n:'Confirmed', v:'2', sub:'actionable'},
          {n:'World-shifting', v:'2', sub:'flagged'},
          {n:'DM-only', v:'1', sub:'not yet leaked'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 32, fontWeight: 600, lineHeight: 1, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="row" style={{gap: 6, flexWrap:'wrap', alignItems:'center', marginBottom: 14}}>
        <span className="tiny" style={{marginRight: 6}}>FILTER</span>
        {[['all','all'],['critical','flagged'],['dm','DM-only'],['Waterdeep','Waterdeep'],['Manshoon','Manshoon'],['Bane','Bane'],['personal','personal']].map(([k,l]) => (
          <span key={k}
                onClick={() => setFilter(k)}
                className={`chip ${filter===k?'solid':''}`}
                style={{cursor:'pointer'}}>{l}</span>
        ))}
        <input className="placeholder" style={{padding:'4px 10px', minHeight:0, fontFamily:'var(--mono)', fontSize: 12, width: 200, marginLeft:'auto'}} placeholder="🔍  search rumors…" />
        <button className="btn sm">＋ add rumor</button>
      </div>

      {/* Rumor list */}
      <div className="col">
        {visible.map(r => (
          <div key={r.id} className="box" style={{padding: '14px 18px', position:'relative'}}>
            {r.flag && (
              <span className={`chip sm ${r.flag==='critical'?'red':r.flag==='world-shifting'?'red':r.flag==='DM-eyes'?'gold':'blue'}`}
                    style={{position:'absolute', top: 12, right: 12}}>
                {r.flag}
              </span>
            )}
            <div className="row" style={{gap: 14, alignItems:'flex-start'}}>
              {/* Credibility column */}
              <div style={{minWidth: 90, paddingRight: 14, borderRight: '1px dashed var(--rule-soft)'}}>
                <div className="tiny">CRED.</div>
                <div className={`chip ${credColor[r.cred]}`} style={{marginTop: 4, fontSize: 11}}>{r.cred}</div>
                <div className="tiny muted" style={{marginTop: 8}}>{r.age}</div>
              </div>

              <div style={{flex: 1}}>
                <div style={{fontFamily:'var(--serif)', fontSize: 17, lineHeight: 1.35, fontStyle:'italic'}}>
                  "{r.txt}"
                </div>
                <div className="row" style={{gap: 10, marginTop: 10, alignItems:'baseline', flexWrap:'wrap'}}>
                  <span className="tiny"><b>SOURCE</b> · {srcLabel[r.srcKind]}: <span style={{color:'var(--ink-2)'}}>{r.src}</span></span>
                  <span className="tiny"><b>KNOWN BY</b> · <span style={{color:'var(--ink-2)'}}>{r.knownBy}</span></span>
                  <div style={{marginLeft:'auto', display:'flex', gap: 4}}>
                    {r.tags.map(t => <span key={t} className="chip sm">{t}</span>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="row" style={{gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--rule-soft)'}}>
              <button className="btn sm">confirm via downtime</button>
              <button className="btn sm">link to arc / location</button>
              <button className="btn sm">share with player →</button>
              {r.knownBy === 'DM only' && <button className="btn sm primary">leak this session</button>}
              <button className="btn sm danger" style={{marginLeft:'auto'}}>discard</button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">How rumors enter the pool</div>
      <div className="grid-4">
        {[
          {n:'Downtime', d:'Gather Info / Research'},
          {n:'NPC voicebox', d:'AI flags interesting bits DM said'},
          {n:'Ally letters', d:'async chat with non-local NPCs'},
          {n:'AI inference', d:'speculative · DM-only by default'},
        ].map(s => (
          <div key={s.n} className="box soft">
            <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{s.n}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

