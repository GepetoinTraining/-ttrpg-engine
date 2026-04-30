// @ts-nocheck
'use client'

import React from 'react'
import { loadArmies } from '@/lib/narrative'

// surfaces/Warfare.tsx — Warfare / armies / sieges.
// READ-ONLY wiring of armies + army_units. The full siege resolver
// (geography/strategy/preparation/armaments modifiers, health portions,
// front/back line, freshness, real-time when PCs present, war roll every
// 10 player turns) is parked in memory:project_warfare_model.md and is
// Phase 4+ work — needs schema expansion and engine module.

export default function Warfare() {
  const [live, setLive] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadArmies().then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const demoArmies = [
    {id:1, n:'Zhent · Black Network 1st', side:'red', troops: 2400, x: 72, y: 40, status:'marching', tgt:'Mulmaster supply'},
    {id:2, n:'Zhent · 3rd light cav',     side:'red', troops:  600, x: 54, y: 56, status:'raiding',  tgt:'caravan corridor'},
    {id:3, n:'Bane cult militants',        side:'red', troops:  300, x: 33, y: 52, status:'sleepers', tgt:'Wd · Trades'},
    {id:4, n:"Lords' garrison · Wd",     side:'gold',troops: 1800, x: 32, y: 50, status:'fortified',tgt:'—'},
    {id:5, n:'Silverymoon Knights',       side:'blue',troops:  900, x: 50, y: 30, status:'patrol',   tgt:'High Forest'},
    {id:6, n:"Lord's Hold militia",      side:'gold',troops:  400, x: 55, y: 60, status:'ready',    tgt:'—'},
  ];

  const fortifications = [
    {n:'Castle Waterdeep',  hold:'Lords',   walls:90, garrison:1800, supply:'90 d'},
    {n:'Zhentil Keep',      hold:'Zhent',   walls:95, garrison:5000, supply:'>1 yr'},
    {n:"Lord's Hold keep", hold:'Compact ally', walls:60, garrison:400, supply:'40 d'},
    {n:'Daggerford palisade',hold:'contested',walls:35, garrison:200, supply:'12 d', siege:true},
  ];

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">31 · Warfare · troop layer</div>
          <h2>Armies &amp; sieges</h2>
        </div>
        <span className="who">DM · sim ticks per in-game week</span>
      </div>

      <div className="aside" style={{marginBottom: 18}}>
        ↳ Villain shows territorial influence, but the troop layer was missing. armies have
        location, morale, supply, march speed; sieges tick wall HP &amp; supply each day.
        the party can <b>turn the tide</b> at scale.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live armies in DB</h3>
          <span className="meta">→ /api/army/list · armies + army_units</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && live.armies.length === 0 && (
          <div className="tiny muted">no armies in DB · the panels below are demo</div>
        )}
        {live && live.armies.length > 0 && (
          <div className="col" style={{gap: 4, fontSize: 13, maxHeight: 200, overflowY: 'auto'}}>
            <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12}}>
              <span>armies <b>{live.counts.armies}</b></span>
              <span>units <b>{live.counts.units}</b></span>
            </div>
            {live.armies.slice(0, 12).map((a: any) => (
              <div key={a.id} className="row" style={{justifyContent:'space-between', padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)'}}>
                <span><b>{a.name}</b> <span className="muted">· {a.faction?.name ?? '?'} · tier {a.tier}</span></span>
                <span className="tiny stat">{a.totalCount} troops · morale {a.morale.toFixed(0)} · supply {a.supplies.toFixed(0)} · ready {a.readiness.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="aside" style={{marginTop: 10, fontSize: 14, color:'var(--accent-gold)'}}>
          ↳ <b>siege resolver parked.</b> Full spec (geography/strategy/preparation/armaments
          modifiers · health portions · front/back line collapse · freshness · player-local
          node + war roll every 10 turns) is saved to{' '}
          <span className="kbd">memory:project_warfare_model.md</span>. Needs schema
          expansion (portions, courage, freshness, leader links, battle table) +{' '}
          <span className="kbd">engine/warfare.ts</span> module before wiring.
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid-4" style={{marginBottom: 18}}>
        {[
          {n:'Active armies', v:'6', sub:'3 hostile'},
          {n:'Troops in field', v:'~6.4k', sub:'red 3.3k · friendly 3.1k'},
          {n:'Active sieges', v:'1', sub:'Daggerford'},
          {n:'Open battles', v:'0', sub:'next: 2 d'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* map */}
      <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
        <h3 style={{margin: 0, fontFamily:'var(--serif)', fontSize: 18}}>Troop layer</h3>
        <div className="row" style={{gap: 8}}>
          <span className="chip red sm">hostile</span>
          <span className="chip blue sm">ally</span>
          <span className="chip gold sm">neutral / lord</span>
        </div>
      </div>

      <div className="map-wrap">
        <div className="map-bg" />
        <div className="coastline" />

        {/* march vectors */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute', inset: 0, width:'100%', height:'100%', pointerEvents:'none'}}>
          <defs>
            <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="var(--accent-red)" />
            </marker>
          </defs>
          <line x1="72" y1="40" x2="78" y2="46" stroke="var(--accent-red)" strokeWidth="0.6" markerEnd="url(#arr)" strokeDasharray="2 1.5" />
          <line x1="54" y1="56" x2="32" y2="50" stroke="var(--accent-red)" strokeWidth="0.4" markerEnd="url(#arr)" strokeDasharray="1.5 1" />
        </svg>

        {demoArmies.map(a => (
          <div key={a.id} className={`pin ${a.side}`} style={{left: `${a.x}%`, top: `${a.y}%`}}>
            <div className="dot" style={{
              width: 8 + Math.min(20, a.troops/200), height: 8 + Math.min(20, a.troops/200),
            }} />
            <div className="lbl" style={{fontSize: 9}}>{a.n.split(' · ')[0]} ({a.troops})</div>
          </div>
        ))}

        {/* siege marker */}
        <div style={{position:'absolute', left:'30%', top:'58%', transform:'translate(-50%, -50%)', width: 80, height: 80, border:'2px dashed var(--accent-red)', borderRadius:'50%', pointerEvents:'none'}} />
        <div className="hand" style={{position:'absolute', top:'66%', left:'18%', transform:'rotate(-3deg)', maxWidth: 180}}>
          siege day 5 — palisade 35%, supply running thin
        </div>
      </div>

      {/* armies + fortifications */}
      <div className="grid-2" style={{marginTop: 22}}>
        <div className="box">
          <div className="box-title"><h3>Armies in field</h3><span className="meta">live</span></div>
          <table className="inv">
            <thead><tr><th>force</th><th>strength</th><th>status</th><th>target</th></tr></thead>
            <tbody>
              {demoArmies.map(a => (
                <tr key={a.id}>
                  <td>
                    <span className={`dot ${a.side}`} />
                    <span style={{fontFamily:'var(--serif)', fontWeight: 500}}>{a.n}</span>
                  </td>
                  <td className="stat">{a.troops}</td>
                  <td><span className={`chip sm ${a.status==='marching'||a.status==='raiding'?'red':a.status==='fortified'?'gold':a.status==='patrol'?'blue':''}`}>{a.status}</span></td>
                  <td className="tiny">{a.tgt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="box">
          <div className="box-title"><h3>Fortifications</h3><span className="meta">walls + supply</span></div>
          <div className="col" style={{gap: 12}}>
            {fortifications.map((f,i) => (
              <div key={i} style={{paddingBottom: 10, borderBottom: i<fortifications.length-1?'1px dashed var(--rule-soft)':'none'}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{f.n}</span>
                  <span className="tiny">held by {f.hold}</span>
                </div>
                <div className="row" style={{gap: 10, marginTop: 6, alignItems:'center'}}>
                  <span className="tiny" style={{minWidth: 38}}>WALLS</span>
                  <div className={`bar ${f.walls<50?'red':f.walls<70?'gold':'green'}`} style={{flex: 1}}>
                    <span style={{width: `${f.walls}%`}} />
                  </div>
                  <span className="stat">{f.walls}%</span>
                </div>
                <div className="row" style={{gap: 10, marginTop: 6, fontSize: 12, color:'var(--ink-2)'}}>
                  <span>garrison <b>{f.garrison}</b></span>
                  <span>supply <b>{f.supply}</b></span>
                  {f.siege && <span className="chip sm red" style={{marginLeft:'auto'}}>under siege · day 5</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* battle resolver */}
      <div className="section-title">Daggerford siege · resolver</div>
      <div className="grid-3">
        <div className="box dark" style={{gridColumn:'span 2'}}>
          <div className="box-title">
            <h3 style={{color:'var(--paper)'}}>Day 5 · projected outcome</h3>
            <span className="meta" style={{color:'var(--paper-3)'}}>monte carlo · 1000 runs</span>
          </div>
          <div className="row" style={{gap: 16, marginTop: 12}}>
            <div style={{flex: 1}}>
              <div className="tiny" style={{color:'var(--paper-3)'}}>WALLS FALL BY DAY</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 36, fontWeight: 600, lineHeight: 1}}>9 ± 2</div>
            </div>
            <div style={{flex: 1}}>
              <div className="tiny" style={{color:'var(--paper-3)'}}>RELIEF FORCE NEEDED</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 36, fontWeight: 600, lineHeight: 1}}>~800</div>
            </div>
            <div style={{flex: 1}}>
              <div className="tiny" style={{color:'var(--paper-3)'}}>P(HOLD) IF PARTY ACTS</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 36, fontWeight: 600, lineHeight: 1, color:'var(--accent-gold)'}}>62%</div>
            </div>
          </div>
          <div className="aside" style={{marginTop: 14, color:'var(--paper-2)', borderColor:'var(--paper-3)', background:'rgba(255,255,255,0.04)'}}>
            ↳ if party rides for Daggerford and breaks the supply line on day 6, hold-prob → 81%
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Party intervention</h3><span className="meta">scale: small unit</span></div>
          <div className="col" style={{gap: 8}}>
            <button className="btn">ride to relief (4 d)</button>
            <button className="btn">cut supply (stealth · 2 d)</button>
            <button className="btn">turn a captain (intel · 1 d)</button>
            <button className="btn">stay course · ignore</button>
          </div>
          <div className="tiny muted" style={{marginTop: 10}}>
            party scale-up via the Compact: +400 militia available if treaty signed
          </div>
        </div>
      </div>
    </div>
  );
}

