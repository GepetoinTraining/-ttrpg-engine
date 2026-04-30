// @ts-nocheck
'use client'

import React from 'react'
import { listSettlements, loadMarket, type SettlementSummary, type PriceRow } from '@/lib/world-detail'

// surfaces/Markets.tsx — economy dashboard.
// Live data: pick a settlement, load /api/market/:settlementId for prices/merchants.

export default function Markets() {
  const [tab, setTab] = React.useState('prices');
  const [settlements, setSettlements] = React.useState<SettlementSummary[] | null>(null)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [market, setMarket] = React.useState<{prices: PriceRow[]; merchants: any[]; caravansInFlight: number} | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    listSettlements({ limit: 50 }).then(r => {
      setSettlements(r.settlements)
      if (r.settlements[0]) setActiveId(r.settlements[0].id)
    }).catch(e => setError(e?.message ?? 'list failed'))
  }, [])

  React.useEffect(() => {
    if (!activeId) return
    loadMarket(activeId).then(setMarket).catch(e => setError(e?.message ?? 'market load failed'))
  }, [activeId])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">20 · World · economy</div>
          <h2>Markets</h2>
        </div>
        <span className="who">prices · merchants · caravans · banking</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ Inventory (in Locations) is tabular things you own. <b>Markets</b> is the world&rsquo;s
        price grid: weekly ticks driven by supply, route status, and shocks.
        engine/{`{market,trading-company,caravan,banking}`}.ts run this.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live market data</h3>
          <span className="meta">→ /api/market/:settlementId · commodity_prices + merchants + caravans</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {settlements && settlements.length > 0 && (
          <div className="row" style={{gap: 6, marginBottom: 8}}>
            <select
              value={activeId ?? ''}
              onChange={(e) => setActiveId(e.target.value)}
              className="placeholder"
              style={{padding:'4px 8px', minHeight: 0, fontSize: 13, background:'var(--paper)'}}
            >
              {settlements.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {s.regionName ?? '?'}</option>
              ))}
            </select>
          </div>
        )}
        {market && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, marginBottom: 8}}>
            <span>commodity rows <b>{market.prices.length}</b></span>
            <span>merchants <b>{market.merchants.length}</b></span>
            <span>caravans in flight (global) <b>{market.caravansInFlight}</b></span>
          </div>
        )}
        {market && market.prices.length > 0 && (
          <table className="inv">
            <thead><tr><th>commodity</th><th>category</th><th>base</th><th>now</th><th>Δ%</th><th>supply</th><th>demand</th></tr></thead>
            <tbody>
              {market.prices.slice(0, 12).map((p) => (
                <tr key={p.id}>
                  <td><b>{p.commodity}</b></td>
                  <td className="muted">{p.category}</td>
                  <td>{p.basePrice?.toFixed(1) ?? '—'}</td>
                  <td>{p.currentPrice.toFixed(2)}</td>
                  <td style={{color: p.priceDeltaPct > 5 ? 'var(--accent-red)' : p.priceDeltaPct < -5 ? 'var(--accent-green)' : 'var(--ink)'}}>
                    {p.priceDeltaPct > 0 ? '+' : ''}{p.priceDeltaPct.toFixed(1)}%
                  </td>
                  <td>{p.supply.toFixed(2)}</td>
                  <td>{p.demand.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {market && market.prices.length === 0 && (
          <div className="tiny muted">no commodity_prices rows for this settlement · weekly market tick hasn't run</div>
        )}
      </div>

      <div className="tabs">
        {[
          ['prices','Prices · matrix'],
          ['shocks','Supply shocks'],
          ['caravans','Caravans · in flight'],
          ['banking','Banking · debts'],
          ['portfolio','Party portfolio'],
        ].map(([k, lbl]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{lbl}</div>
        ))}
      </div>

      {tab === 'prices' && (
        <div>
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginBottom: 10}}>
            <div className="tiny">Eleasis 23 · weekly tick · base = Waterdeep avg</div>
            <div className="row" style={{gap: 6}}>
              <button className="btn sm">prev tick</button>
              <button className="btn sm">next tick →</button>
              <button className="btn sm primary">force tick</button>
            </div>
          </div>
          <div className="box" style={{padding: 0, overflow:'hidden'}}>
            <table className="inv">
              <thead>
                <tr>
                  <th style={{width: 140}}>Good (base)</th>
                  <th>Waterdeep</th><th>Suzail</th><th>Daggerford</th><th>Mulmaster</th><th>Westgate</th><th>Iriaebor</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {g:'grain',     b:'5gp',   r:[{v:'5gp',d:0},{v:'3gp',d:-40},{v:'4gp',d:-20},{v:'7gp',d:40},{v:'5gp',d:0},{v:'5gp',d:0}]},
                  {g:'iron',      b:'2gp',   r:[{v:'2gp',d:0},{v:'2gp',d:0},{v:'1gp',d:-50},{v:'4gp',d:100},{v:'2gp',d:0},{v:'2gp',d:0}]},
                  {g:'spices',    b:'15gp',  r:[{v:'18gp',d:20},{v:'28gp',d:87},{v:'22gp',d:47},{v:'12gp',d:-20},{v:'14gp',d:-7},{v:'16gp',d:7}]},
                  {g:'healing pot.',b:'50gp',r:[{v:'50gp',d:0},{v:'62gp',d:24},{v:'58gp',d:16},{v:'80gp',d:60},{v:'48gp',d:-4},{v:'52gp',d:4}]},
                  {g:'fine wine', b:'10gp',  r:[{v:'12gp',d:20},{v:'8gp',d:-20},{v:'10gp',d:0},{v:'14gp',d:40},{v:'9gp',d:-10},{v:'11gp',d:10}]},
                  {g:'warhorse',  b:'400gp', r:[{v:'400gp',d:0},{v:'350gp',d:-12},{v:'380gp',d:-5},{v:'500gp',d:25},{v:'420gp',d:5},{v:'390gp',d:-2}]},
                  {g:'silk (bolt)',b:'25gp', r:[{v:'28gp',d:12},{v:'22gp',d:-12},{v:'30gp',d:20},{v:'24gp',d:-4},{v:'20gp',d:-20},{v:'26gp',d:4}]},
                  {g:'paper (rm)',b:'4gp',   r:[{v:'4gp',d:0},{v:'4gp',d:0},{v:'5gp',d:25},{v:'6gp',d:50},{v:'4gp',d:0},{v:'3gp',d:-25}]},
                ].map(row => (
                  <tr key={row.g}>
                    <td><b>{row.g}</b><br/><span className="muted" style={{fontSize: 11}}>base {row.b}</span></td>
                    {row.r.map((c, i) => (
                      <td key={i} style={{background: c.d > 30 ? 'rgba(168,68,42,0.10)' : c.d < -20 ? 'rgba(77,106,58,0.10)' : 'transparent'}}>
                        <span className="stat"><b>{c.v}</b></span>
                        <div className="tiny" style={{color: c.d > 0 ? 'var(--accent-red)' : c.d < 0 ? 'var(--accent-green)' : 'var(--ink-3)'}}>
                          {c.d > 0 ? '+' : ''}{c.d}%
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="aside blue" style={{marginTop: 12}}>
            ↳ red cells &gt; +30%: arbitrage opportunity. green cells &lt; −20%: buy here.
          </div>
        </div>
      )}

      {tab === 'shocks' && (
        <div className="grid-3">
          {[
            {n:'Spice route disrupted',sev:'major',d:'Selgaunt → Suzail blocked. Spices +47% Suzail, +87% inland. ETA recovery: 3-6 weeks.',c:'red'},
            {n:'Cormyr grain glut',sev:'opportunity',d:'Bumper harvest. Grain −40% Suzail. Ship to Mulmaster (+40% there) for 80% margin.',c:'green'},
            {n:'Mulmaster arms demand',sev:'major',d:'Banite mobilization. Iron +100%, healing +60%. Smith tier upgraded to A.',c:'red'},
            {n:'Iriaebor paper boom',sev:'minor',d:'New scriptorium. Paper −25%. Books +12%.',c:'gold'},
            {n:'Westgate silk dump',sev:'minor',d:'Pirate seizure liquidated cheap. Silk −20%.',c:'gold'},
          ].map(s => (
            <div key={s.n} className="box" style={{borderColor:`var(--accent-${s.c})`}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <span style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{s.n}</span>
                <span className={`chip sm ${s.c}`}>{s.sev}</span>
              </div>
              <p style={{fontSize: 13, color:'var(--ink-2)', margin:'6px 0 0'}}>{s.d}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'caravans' && (
        <div className="col" style={{gap: 12}}>
          {[
            {n:'CRV-018 · Suzail → Waterdeep', cargo:'spices x40 lb', risk:'high (sea)', eta:'5d', val:'2,240gp', owner:'party (via Aldreth Bros)', c:'gold'},
            {n:'CRV-022 · Daggerford → Mulmaster', cargo:'iron ingots x200', risk:'low', eta:'9d', val:'400gp', owner:'Aldreth Bros', c:'green'},
            {n:'CRV-019 · Waterdeep → Iriaebor', cargo:'wool · ale', risk:'medium (brigands)', eta:'7d', val:'780gp', owner:'House Crownsilver', c:'gold'},
            {n:'CRV-009 · Westgate → Suzail', cargo:'silk x120 bolts', risk:'overdue (3d)', eta:'?', val:'2,400gp', owner:'unknown', c:'red'},
          ].map(c => (
            <div key={c.n} className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <div>
                  <span style={{fontFamily:'var(--mono)', fontSize: 13, fontWeight: 600}}>{c.n}</span>
                  <div className="tiny" style={{marginTop: 2}}>{c.cargo} · {c.owner}</div>
                </div>
                <div className="row" style={{gap: 6}}>
                  <span className={`chip sm ${c.c}`}>risk: {c.risk}</span>
                  <span className="chip sm">ETA {c.eta}</span>
                  <span className="chip sm gold">est. {c.val}</span>
                </div>
              </div>
              <div className="row" style={{gap: 0, marginTop: 8, alignItems: 'center'}}>
                <div className="tiny" style={{width: 80}}>origin</div>
                <div style={{flex:1, height: 4, background:'var(--paper-2)', position:'relative', border:'1px solid var(--rule-soft)'}}>
                  <div style={{position:'absolute', left:0, top: 0, height:'100%', width: c.c === 'red' ? '100%' : c.c === 'gold' ? '60%' : '35%', background:`var(--accent-${c.c})`}} />
                </div>
                <div className="tiny" style={{width: 80, textAlign:'right'}}>destination</div>
              </div>
            </div>
          ))}
          <button className="btn sm" style={{alignSelf:'flex-start'}}>＋ commission caravan</button>
        </div>
      )}

      {tab === 'banking' && (
        <div className="grid-2">
          <div className="box">
            <div className="box-title"><h3>Party debts</h3><span className="meta">across cities</span></div>
            <table className="inv">
              <thead><tr><th>To</th><th>Amount</th><th>Rate</th><th>Due</th></tr></thead>
              <tbody>
                <tr><td>Aldreth Bros (Suzail)</td><td className="stat">600gp</td><td>8%</td><td className="muted">Eleint 12</td></tr>
                <tr><td>House Crownsilver</td><td className="stat">1,200gp</td><td>0% · favor</td><td className="muted">on demand</td></tr>
                <tr><td>"Old Pell" line</td><td className="stat">200gp</td><td>—</td><td className="muted">friend</td></tr>
              </tbody>
            </table>
          </div>
          <div className="box">
            <div className="box-title"><h3>Letters of credit</h3><span className="meta">held</span></div>
            <table className="inv">
              <thead><tr><th>Issuer</th><th>Value</th><th>Where redeemable</th></tr></thead>
              <tbody>
                <tr><td>Bank of Waterdeep</td><td className="stat">2,000gp</td><td className="muted">any allied city</td></tr>
                <tr><td>Aldreth Bros chit</td><td className="stat">400gp</td><td className="muted">Suzail · Marsember</td></tr>
              </tbody>
            </table>
          </div>
          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="box-title"><h3>Loan offers (open)</h3><span className="meta">if you need capital</span></div>
            <div className="grid-3">
              {[
                {n:'Aldreth Bros', a:'up to 5,000gp', r:'10%', n2:'requires collateral · 2 weeks'},
                {n:'House Crownsilver', a:'1,500gp', r:'favor', n2:'expects political backing'},
                {n:'Mulmaster moneylender',a:'10,000gp',r:'18% · monthly', n2:'enforcement: violent'},
              ].map(o => (
                <div key={o.n} className="box soft">
                  <div style={{fontWeight: 600}}>{o.n}</div>
                  <div className="stat">{o.a} @ {o.r}</div>
                  <div className="tiny" style={{marginTop: 4}}>{o.n2}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'portfolio' && (
        <div className="grid-3">
          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="box-title"><h3>Party trading position</h3><span className="meta">unrealized</span></div>
            <table className="inv">
              <thead><tr><th>Holding</th><th>Qty</th><th>Cost</th><th>Mark</th><th>P/L</th></tr></thead>
              <tbody>
                <tr><td>Spices (in CRV-018)</td><td className="stat">40 lb</td><td className="stat">600gp</td><td className="stat">2,240gp</td><td className="stat" style={{color:'var(--accent-green)'}}><b>+1,640gp</b></td></tr>
                <tr><td>Aldreth Bros equity</td><td className="stat">2%</td><td className="stat">800gp</td><td className="stat">920gp</td><td className="stat" style={{color:'var(--accent-green)'}}>+120gp</td></tr>
                <tr><td>Grain warehouse claim</td><td className="stat">1</td><td className="stat">300gp</td><td className="stat">240gp</td><td className="stat" style={{color:'var(--accent-red)'}}>−60gp</td></tr>
              </tbody>
            </table>
          </div>
          <div className="box">
            <div className="box-title"><h3>Cash on hand</h3><span className="meta">across vaults</span></div>
            <div className="col" style={{gap: 4, fontSize: 14}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>Safehouse</span><span className="stat">280gp</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Sunset Vault</span><span className="stat">1,400gp <span className="muted">(contested)</span></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>On persons</span><span className="stat">186gp</span></div>
              <hr className="rule dashed" style={{margin:'6px 0'}} />
              <div className="row" style={{justifyContent:'space-between'}}><span><b>total</b></span><span className="stat"><b>1,866gp</b></span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

