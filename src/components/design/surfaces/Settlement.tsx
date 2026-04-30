// @ts-nocheck
'use client'

import React from 'react'
import { listSettlements, loadSettlement, type SettlementSummary } from '@/lib/world-detail'

// surfaces/Settlement.tsx — Non-owned settlement viewer.
// Live data: pick a settlement from /api/settlement/list, then load /api/settlement/:id.

export default function Settlement() {
  const [tab, setTab] = React.useState('vitals');
  const [list, setList] = React.useState<SettlementSummary[] | null>(null)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    listSettlements({ limit: 50 })
      .then((r) => {
        setList(r.settlements)
        if (r.settlements[0]) setActiveId(r.settlements[0].id)
      })
      .catch((e) => setError(e?.message ?? 'list failed'))
  }, [])

  React.useEffect(() => {
    if (!activeId) return
    loadSettlement(activeId).then(setDetail).catch((e) => setError(e?.message ?? 'load failed'))
  }, [activeId])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">16 · World · settlement</div>
          <h2>Suzail</h2>
        </div>
        <span className="who">DM view · simulated, not owned</span>
      </div>

      <div className="aside" style={{maxWidth: 760, marginBottom: 18}}>
        ↳ engine/mm-settlement.ts ticks pop · stability · prosperity · unrest · trade
        weekly. this is the read-out for any settlement the party visits but doesn&rsquo;t
        own. <i>compare with Holdings (08) — that surface is for places you control.</i>
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live settlements in DB</h3>
          <span className="meta">→ /api/settlement/list · settlements + world_regions</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!list && !error && <div className="tiny muted">loading…</div>}
        {list && list.length === 0 && (
          <div className="tiny muted">no settlements seeded · the demo data below is wireframe</div>
        )}
        {list && list.length > 0 && (
          <>
            <div className="row" style={{gap: 6, marginBottom: 8, flexWrap:'wrap'}}>
              <span className="stat">{list.length} settlements loaded</span>
              <select
                value={activeId ?? ''}
                onChange={(e) => setActiveId(e.target.value)}
                className="placeholder"
                style={{padding:'4px 8px', minHeight: 0, fontSize: 13, background:'var(--paper)'}}
              >
                {list.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.regionName ?? '?'} · pop {s.population}</option>
                ))}
              </select>
            </div>
            {detail && (
              <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
                <span>population <b>{detail.settlement.population}</b></span>
                <span>stability <b>{Number(detail.settlement.stability).toFixed(1)}</b></span>
                <span>era <b>{detail.settlement.era}</b></span>
                <span>buildings <b>{detail.buildings?.length ?? 0}</b></span>
                <span>npcs <b>{detail.npcs?.length ?? 0}</b></span>
                {detail.region && <span>region <b>{detail.region.name}</b> · {detail.region.terrain}</span>}
              </div>
            )}
          </>
        )}
      </div>

      {/* identity strip */}
      <div className="grid-3" style={{marginBottom: 14}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
            <div>
              <div className="tiny">CITY · CAPITAL OF CORMYR</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1.1, marginTop: 2}}>Suzail</div>
              <div className="muted" style={{fontSize: 13, marginTop: 2}}>Dragonmere coast · ruled by Regent Alusair · 38,400 souls</div>
            </div>
            <div className="row" style={{gap: 6}}>
              <span className="chip blue">walled</span>
              <span className="chip">deep harbor</span>
              <span className="chip gold">trade hub</span>
              <span className="chip red">Purple Dragons present</span>
            </div>
          </div>
          <hr className="rule dashed" />
          <div className="row" style={{gap: 18, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)', flexWrap:'wrap'}}>
            <span><b>visited</b> Eleasis 9 · 14 · 17</span>
            <span><b>last tick</b> Eleasis 23 (today)</span>
            <span><b>next market</b> Eleint 1 (8d)</span>
            <span><b>governance</b> monarchy · regent</span>
          </div>
        </div>

        <div className="box dashed" style={{padding: 0, overflow: 'hidden'}}>
          <div className="placeholder" style={{minHeight: 132, border: 'none', margin: 0}}>
            city sketch / sigil · drop image
          </div>
        </div>
      </div>

      <div className="tabs">
        {[
          ['vitals',    'Vitals'],
          ['economy',   'Economy'],
          ['factions',  'Factions in town'],
          ['npcs',      'Notable NPCs'],
          ['events',    'Recent events'],
          ['hooks',     'Hooks for party'],
        ].map(([k, lbl]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{lbl}</div>
        ))}
      </div>

      {tab === 'vitals' && (
        <div className="grid-3">
          {/* Population */}
          <div className="box">
            <div className="box-title"><h3>Population</h3><span className="meta">38,400</span></div>
            <div className="row" style={{justifyContent:'space-between', fontFamily:'var(--mono)', fontSize: 12}}>
              <span>4-week trend</span><span><b style={{color:'var(--accent-green)'}}>+1.8%</b></span>
            </div>
            {/* tiny ascii sparkline-ish */}
            <div style={{display:'flex', alignItems:'flex-end', gap: 2, height: 36, marginTop: 8, borderBottom: '1px solid var(--rule-soft)'}}>
              {[42,44,43,45,47,46,49,52,54,53,55,58].map((v,i) => (
                <div key={i} style={{flex:1, height: `${v - 30}%`, background: 'var(--ink-2)', opacity: 0.7}} />
              ))}
            </div>
            <div className="tiny" style={{marginTop: 4}}>refugee influx from Sembia</div>

            <hr className="rule dashed" />
            <div className="tiny" style={{marginBottom: 4}}>COMPOSITION</div>
            <div className="col" style={{gap: 4, fontFamily:'var(--mono)', fontSize: 11}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>human</span><span>71%</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>halfling</span><span>11%</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>dwarf</span><span>8%</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>elf / half-elf</span><span>6%</span></div>
              <div className="row" style={{justifyContent:'space-between', color:'var(--ink-3)'}}><span>other</span><span>4%</span></div>
            </div>
          </div>

          {/* Stability */}
          <div className="box">
            <div className="box-title"><h3>Stability</h3><span className="meta">68 / 100</span></div>
            <div className="bar blue"><span style={{width:'68%'}} /></div>
            <div className="tiny" style={{marginTop: 4}}>stable · garrisoned · low crime</div>
            <hr className="rule dashed" />
            <div className="col" style={{gap: 6, fontSize: 13}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>law &amp; order</span><span className="stat"><b>+8</b></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>civic morale</span><span className="stat"><b>+4</b></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>foreign agents</span><span className="stat" style={{color:'var(--accent-red)'}}><b>−3</b></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>regent legitimacy</span><span className="stat"><b>+5</b></span></div>
            </div>
            <div className="aside blue" style={{marginTop: 10, fontSize: 16}}>
              ↳ if stability &lt; 40, garrison conscripts. tracks weekly.
            </div>
          </div>

          {/* Prosperity */}
          <div className="box">
            <div className="box-title"><h3>Prosperity</h3><span className="meta">74 / 100</span></div>
            <div className="bar gold"><span style={{width:'74%'}} /></div>
            <div className="tiny" style={{marginTop: 4}}>boom · grain &amp; iron exporters profiting</div>
            <hr className="rule dashed" />
            <div className="col" style={{gap: 6, fontSize: 13}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>trade volume</span><span className="stat"><b>+12%</b> wow</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>tax receipts</span><span className="stat"><b>+6%</b></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>credit available</span><span className="stat"><b>4,200gp</b> @ 8%</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>guild influence</span><span className="stat"><b>high</b></span></div>
            </div>
          </div>

          {/* Unrest */}
          <div className="box">
            <div className="box-title"><h3>Unrest</h3><span className="meta">22 / 100</span></div>
            <div className="bar red"><span style={{width:'22%'}} /></div>
            <div className="tiny" style={{marginTop: 4}}>simmering · refugee tensions, dockworker pay dispute</div>
            <hr className="rule dashed" />
            <div className="col" style={{gap: 6, fontSize: 13}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>refugee strain</span><span className="stat" style={{color:'var(--accent-red)'}}><b>+9</b></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>dock guild</span><span className="stat" style={{color:'var(--accent-red)'}}><b>+5</b></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>noble rivalry</span><span className="stat" style={{color:'var(--accent-red)'}}><b>+3</b></span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>religious tension</span><span className="stat"><b>+5</b></span></div>
            </div>
            <div className="aside" style={{marginTop: 10, fontSize: 16}}>
              ↳ riot threshold at 60. spike +8 if Sembia loses Selgaunt.
            </div>
          </div>

          {/* Trade */}
          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="box-title"><h3>Trade routes</h3><span className="meta">8 active · 2 disrupted</span></div>
            <table className="inv">
              <thead>
                <tr><th>Route</th><th>Volume</th><th>Status</th><th>Goods</th><th>Heat</th></tr>
              </thead>
              <tbody>
                <tr><td><b>Suzail → Waterdeep</b> (sea)</td><td className="stat">heavy</td><td><span className="chip green sm">open</span></td><td className="muted">grain · iron · wool</td><td className="stat">+1</td></tr>
                <tr><td><b>Suzail → Marsember</b> (land)</td><td className="stat">heavy</td><td><span className="chip green sm">open</span></td><td className="muted">all</td><td className="stat">0</td></tr>
                <tr><td><b>Suzail → Selgaunt</b> (sea)</td><td className="stat">light</td><td><span className="chip red sm">disrupted</span></td><td className="muted">spices · cloth</td><td className="stat" style={{color:'var(--accent-red)'}}>+6</td></tr>
                <tr><td><b>Suzail → Iriaebor</b> (Trade Way)</td><td className="stat">medium</td><td><span className="chip gold sm">caravans only</span></td><td className="muted">books · ore</td><td className="stat">+2</td></tr>
                <tr><td><b>Suzail → Westgate</b> (sea)</td><td className="stat">medium</td><td><span className="chip green sm">open</span></td><td className="muted">timber · ale</td><td className="stat">+1</td></tr>
                <tr><td><b>Suzail → Tilverton</b> (land)</td><td className="stat">light</td><td><span className="chip red sm">brigands</span></td><td className="muted">furs</td><td className="stat" style={{color:'var(--accent-red)'}}>+8</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'economy' && (
        <div className="grid-2">
          <div className="box">
            <div className="box-title"><h3>Local prices</h3><span className="meta">Eleasis 23 tick</span></div>
            <table className="inv">
              <thead><tr><th>Good</th><th>Base</th><th>Here</th><th>Δ</th></tr></thead>
              <tbody>
                <tr><td>grain (cwt)</td><td className="stat">5gp</td><td className="stat">3gp</td><td style={{color:'var(--accent-green)'}}>−40%</td></tr>
                <tr><td>iron (ingot)</td><td className="stat">2gp</td><td className="stat">2gp</td><td className="muted">par</td></tr>
                <tr><td>healing potion</td><td className="stat">50gp</td><td className="stat">62gp</td><td style={{color:'var(--accent-red)'}}>+24%</td></tr>
                <tr><td>fine wine</td><td className="stat">10gp</td><td className="stat">8gp</td><td style={{color:'var(--accent-green)'}}>−20%</td></tr>
                <tr><td>spices (oz)</td><td className="stat">15gp</td><td className="stat">28gp</td><td style={{color:'var(--accent-red)'}}>+87%</td></tr>
                <tr><td>warhorse</td><td className="stat">400gp</td><td className="stat">350gp</td><td style={{color:'var(--accent-green)'}}>−12%</td></tr>
              </tbody>
            </table>
            <div className="aside blue" style={{marginTop: 10, fontSize: 16}}>↳ deep-link → Markets dashboard (20)</div>
          </div>
          <div className="box">
            <div className="box-title"><h3>Merchants in town</h3><span className="meta">tier listing</span></div>
            <div className="col" style={{gap: 8, fontSize: 13}}>
              {[
                {n:'Aldreth Bros. Trading Co.', t:'A', focus:'general · books · curios', stock:'rich'},
                {n:'Pommery &amp; Sons', t:'A', focus:'arms · armor · master smith', stock:'limited (war demand)'},
                {n:'House Crownsilver agent', t:'B', focus:'wine · silks', stock:'rich'},
                {n:'Marsember Apothecary', t:'B', focus:'potions · alchemy', stock:'restocking'},
                {n:'Dockside fence (no name)', t:'C', focus:'questionable', stock:'rotates'},
              ].map(m => (
                <div key={m.n} style={{borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 6}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <span><b dangerouslySetInnerHTML={{__html:m.n}} /></span>
                    <span className="chip sm">tier {m.t}</span>
                  </div>
                  <div className="tiny" style={{marginTop: 2}}>{m.focus} · stock: {m.stock}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="box-title"><h3>Supply shocks &amp; opportunities</h3><span className="meta">AI-surfaced</span></div>
            <div className="grid-3">
              <div className="box soft">
                <div className="hand ink" style={{fontSize: 18}}>Spice shortage</div>
                <p style={{fontSize: 13, color:'var(--ink-2)', margin:'4px 0'}}>Selgaunt route disrupted. Spices +87% here. <b>buy elsewhere → sell here</b> ≈ 60gp/lb profit.</p>
                <span className="chip gold sm">arbitrage</span>
              </div>
              <div className="box soft">
                <div className="hand ink" style={{fontSize: 18}}>Healing potions tight</div>
                <p style={{fontSize: 13, color:'var(--ink-2)', margin:'4px 0'}}>Marsember Apothecary restocking. 6 day delay. Plan accordingly.</p>
                <span className="chip red sm">scarcity</span>
              </div>
              <div className="box soft">
                <div className="hand ink" style={{fontSize: 18}}>Grain glut</div>
                <p style={{fontSize: 13, color:'var(--ink-2)', margin:'4px 0'}}>Bumper Cormyrean harvest. Buy cheap, ship to Waterdeep.</p>
                <span className="chip green sm">opportunity</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'factions' && (
        <div className="col" style={{gap: 10}}>
          {[
            {n:'House Obarskyr (Crown)', d:'Ruling. Regent Alusair. Loyal to Cormyr proper.', i:88, c:'blue'},
            {n:'Purple Dragons', d:'Royal army garrison. 1,200 in city.', i:74, c:'blue'},
            {n:'War Wizards', d:'Crown\'s arcane arm. Suspicious of all foreign mages.', i:62, c:'blue'},
            {n:'Zhentarim', d:'Hidden cell at the docks. Supplying spice via Sembia detour.', i:18, c:'red'},
            {n:'Cult of the Dragon', d:'Whisper of cell in Wheloon. Unconfirmed here.', i:6,  c:'red'},
            {n:'House Crownsilver', d:'Noble. Wine trade. Allied to Crown but ambitious.', i:34, c:'gold'},
            {n:'Harpers (covert)', d:'Two known agents. Watching Zhent activity.', i:12, c:'green'},
          ].map(f => (
            <div key={f.n} className="box" style={{padding:'10px 14px'}}>
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <div>
                  <span style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{f.n}</span>
                  <span className="muted" style={{marginLeft: 10, fontSize: 13}}>{f.d}</span>
                </div>
                <span className="stat"><b>influence {f.i}</b>/100</span>
              </div>
              <div className={`bar ${f.c}`} style={{marginTop: 6}}><span style={{width: `${f.i}%`}} /></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'npcs' && (
        <div className="grid-3">
          {[
            {n:'Regent Alusair Nacacia', r:'Steel Regent', d:'rules in name of young king', tag:'crown'},
            {n:'Vangerdahast', r:'War Wizard, retired', d:'still consulted by court', tag:'crown'},
            {n:'Master Pommery', r:'Smith · tier A', d:'crafted Aramil\'s last sword', tag:'merchant'},
            {n:'Lia of Aldreth', r:'merchant scion', d:'flirts, sells, gossips', tag:'merchant'},
            {n:'"Hook" Garven', r:'dockmaster', d:'on Zhent payroll · doesn\'t know party knows', tag:'shady'},
            {n:'Sister Embra', r:'priestess of Tymora', d:'temple gives free healing once', tag:'cleric'},
          ].map(n => (
            <div key={n.n} className="card">
              <div className="head"><h4>{n.n}</h4><span className="type">{n.tag}</span></div>
              <p>{n.r} · {n.d}</p>
              <div className="footer">
                <button className="btn sm">open in roster →</button>
                <button className="btn sm">voice</button>
              </div>
            </div>
          ))}
          <div className="box dashed" style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight: 140}}>
            <span className="muted">＋ generate notable NPC</span>
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="col" style={{gap: 10}}>
          <div className="aside" style={{maxWidth: 760}}>↳ engine ticks every in-game day. each line is a κ-mutation visible in TPB (19) or .tp audit (23).</div>
          {[
            {d:'Eleasis 23', t:'today', e:'spice price +14%', src:'route disruption'},
            {d:'Eleasis 22', t:'-1d', e:'refugee surge: 240 souls from Saerb', src:'Sembia conflict'},
            {d:'Eleasis 19', t:'-4d', e:'dockworker strike threatened', src:'unrest +5'},
            {d:'Eleasis 17', t:'-6d', e:'PARTY VISITED · met Lia of Aldreth', src:'session log'},
            {d:'Eleasis 14', t:'-9d', e:'Selgaunt route disrupted (brigands)', src:'world tick'},
            {d:'Eleasis 9',  t:'-14d',e:'Crown grain tax announced', src:'gov decree'},
          ].map((ev, i) => (
            <div key={i} className="row" style={{gap: 14, padding: '8px 0', borderBottom: '1px dashed var(--rule-soft)'}}>
              <div style={{width: 110, fontFamily:'var(--mono)', fontSize: 11}}><b>{ev.d}</b><br/><span className="muted">{ev.t}</span></div>
              <div style={{flex: 1, fontSize: 14}}>{ev.e}</div>
              <div style={{width: 180}} className="tiny">{ev.src}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'hooks' && (
        <div className="grid-2">
          {[
            {h:'Strike-breakers wanted', d:'Crownsilver agent will pay 200gp for muscle on the docks. ALIGN: chaotic / Zhent-aligned will refuse.', tag:'gold'},
            {h:'Smuggle the spices',     d:'Hook Garven offers cut to ship Zhent cargo north. heat +10 if accepted.', tag:'red'},
            {h:'Find the missing scribe',d:'War Wizards quietly searching for a defector. 500gp + War Wizard favor.', tag:'blue'},
            {h:'Refugee child plea',     d:'Saerb girl looking for her brother in city. low gold, high RP.', tag:'green'},
          ].map(h => (
            <div key={h.h} className={`box`} style={{borderColor: `var(--accent-${h.tag})`}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <span className="hand ink" style={{fontSize: 18}}>{h.h}</span>
                <span className={`chip ${h.tag} sm`}>hook</span>
              </div>
              <p style={{fontSize: 13, margin: '6px 0 0'}}>{h.d}</p>
              <div className="row" style={{gap: 6, marginTop: 10}}>
                <button className="btn sm">offer to party</button>
                <button className="btn sm">→ scene</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

