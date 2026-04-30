// @ts-nocheck
'use client'

import React from 'react'
// surfaces/Locations.jsx — Owned locations · storage · downtime allowance

export default function Locations() {
  const [selected, setSelected] = React.useState('safehouse');
  const [tab, setTab] = React.useState('overview');

  const owned = [
    {id:'safehouse', n:'Waterdeep Safehouse',   own:'party',    type:'safehouse', status:'operating',  slots:6,  used:4, rep:'Trades Ward'},
    {id:'pell',      n:"Old Pell's Shop",        own:'Kaelith', type:'fence',      status:'allied',     slots:3,  used:1, rep:'Mulmaster · hidden'},
    {id:'tower',     n:'Vessa\'s Spire',        own:'Vessa',   type:'tower',      status:'building',   slots:4,  used:2, rep:'Cloud Peaks'},
    {id:'temple',    n:'Shrine of Tyr',         own:'Doruk',   type:'temple',     status:'operating',  slots:5,  used:5, rep:'Daggerford'},
    {id:'vault',     n:'Sunset Vault',          own:'party',   type:'cache',      status:'contested',  slots:2,  used:0, rep:'just claimed!'},
  ];

  const loc = owned.find(l => l.id === selected);

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">08 · Owned locations</div>
          <h2>Holdings &amp; Downtime</h2>
        </div>
        <span className="who">party + individual ownership</span>
      </div>

      <div className="aside" style={{maxWidth:760, marginBottom: 18}}>
        ↳ each location is a place you own, store stuff in, and SPEND DOWNTIME from.
        weekly slots are configured by the DM. modifiers (Cha · Int · Wis) of the
        worker shift outcomes per action.
      </div>

      {/* Owned-locations rail */}
      <div className="row" style={{gap: 10, flexWrap:'wrap', marginBottom: 18}}>
        {owned.map(l => (
          <div key={l.id}
               onClick={() => setSelected(l.id)}
               className={`box ${selected===l.id?'':'soft'}`}
               style={{cursor:'pointer', minWidth: 200, flex: 1, padding: '10px 12px',
                       borderColor: selected===l.id ? 'var(--ink)' : undefined,
                       boxShadow: selected===l.id ? '3px 3px 0 var(--ink)' : undefined}}>
            <div className="tiny">{l.type.toUpperCase()} · {l.own === 'party' ? 'PARTY' : `OWNED BY ${l.own.toUpperCase()}`}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 17, fontWeight: 600, marginTop: 2}}>{l.n}</div>
            <div className="tiny muted" style={{marginTop: 2}}>{l.rep}</div>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginTop: 8}}>
              <span className={`chip sm ${l.status==='contested'?'red':l.status==='building'?'gold':l.status==='allied'?'blue':'green'}`}>{l.status}</span>
              <span className="stat"><b>{l.used}</b>/{l.slots} slots</span>
            </div>
          </div>
        ))}
        <div className="box dashed" style={{minWidth: 200, flex: 1, padding: '10px 12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <span className="muted">＋ claim location</span>
        </div>
      </div>

      {/* Selected location detail */}
      <div className="surface-head" style={{marginBottom: 14}}>
        <div>
          <div className="crumbs">{loc.type} · {loc.own === 'party' ? 'PARTY-OWNED' : `${loc.own}'s holding`}</div>
          <h2 style={{fontSize: 28}}>{loc.n}</h2>
        </div>
        <div className="row" style={{gap: 6}}>
          <button className="btn sm">edit</button>
          <button className="btn sm">transfer</button>
          <button className="btn sm danger">abandon</button>
        </div>
      </div>

      <div className="tabs">
        {['overview','storage','downtime','dm-config'].map(k => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>
            {k === 'dm-config' ? 'DM config' : k.replace(/^./, c=>c.toUpperCase())}
          </div>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid-3">
          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="placeholder" style={{minHeight: 180}}>floor plan / sketch · drop image</div>
            <div className="row" style={{gap: 6, flexWrap:'wrap', marginTop: 10}}>
              <span className="chip">3 rooms</span>
              <span className="chip">hidden entrance</span>
              <span className="chip blue">staffed: 2 NPCs</span>
              <span className="chip gold">income: 12gp/wk</span>
              <span className="chip">defended (CR 3)</span>
            </div>
          </div>
          <div className="box">
            <div className="box-title"><h3>Status</h3><span className="meta">live</span></div>
            <div className="col" style={{gap: 8}}>
              <div>
                <div className="tiny">heat / discovery</div>
                <div className="bar red"><span style={{width: '18%'}} /></div>
                <div className="tiny" style={{marginTop:2}}>low · still hidden</div>
              </div>
              <div>
                <div className="tiny">supply</div>
                <div className="bar gold"><span style={{width: '74%'}} /></div>
                <div className="tiny" style={{marginTop:2}}>3 weeks at current burn</div>
              </div>
              <div>
                <div className="tiny">morale (NPC staff)</div>
                <div className="bar green"><span style={{width: '88%'}} /></div>
              </div>
            </div>
            <hr className="rule dashed" />
            <div className="tiny" style={{marginBottom: 4}}>STAFF</div>
            <div style={{fontSize: 13}}>Mira (caretaker · loyal)<br/>"Ratch" (lookout · paid)</div>
          </div>
        </div>
      )}

      {tab === 'storage' && (
        <div className="box" style={{padding: 0}}>
          <div className="row" style={{justifyContent:'space-between', padding: '12px 14px', borderBottom: '1px solid var(--rule)'}}>
            <div className="tiny">STORED HERE · 47 items · 312 lb</div>
            <div className="row" style={{gap: 8}}>
              <input className="placeholder" style={{padding:'4px 10px', minHeight:0, fontFamily:'var(--mono)', fontSize: 12, width: 200}} placeholder="🔍  search…" />
              <button className="btn sm">＋ deposit</button>
              <button className="btn sm">withdraw →</button>
            </div>
          </div>
          <table className="inv">
            <thead>
              <tr><th></th><th>Item</th><th>Qty</th><th>Owner</th><th>Notes</th><th>Tags</th></tr>
            </thead>
            <tbody>
              <tr className="group"><td>▾</td><td colSpan={5}>currency &amp; valuables</td></tr>
              <tr><td></td><td><b>Coin</b></td><td className="stat">280gp</td><td className="muted">party</td><td className="muted">strongbox · west wall</td><td><span className="chip sm">liquid</span></td></tr>
              <tr><td></td><td><b>Silver bars</b></td><td className="stat">3</td><td className="muted">party</td><td className="muted">~75gp ea</td><td><span className="chip sm gold">split?</span></td></tr>

              <tr className="group"><td>▾</td><td colSpan={5}>arms &amp; armor</td></tr>
              <tr><td></td><td><b>Climbing rig</b></td><td className="stat">1</td><td className="muted">Kaelith</td><td className="muted">grapnel + 60ft silk</td><td></td></tr>
              <tr><td></td><td><b>Crossbow bolts</b></td><td className="stat">120</td><td className="muted">party</td><td></td><td></td></tr>

              <tr className="group"><td>▾</td><td colSpan={5}>evidence &amp; documents</td></tr>
              <tr><td></td><td><b>Forged signet rings</b></td><td className="stat">4</td><td className="muted">Kaelith</td><td className="muted">Manshoon-aligned families</td><td><span className="chip sm red">contraband</span></td></tr>
              <tr><td></td><td><b>Zhent ledger (translated)</b></td><td className="stat">1</td><td className="muted">Kaelith</td><td className="muted">cross-referenced w/ priestess letters</td><td><span className="chip sm">intel</span></td></tr>

              <tr className="group"><td>▸</td><td colSpan={5}>consumables · 14</td></tr>
              <tr className="group"><td>▸</td><td colSpan={5}>mundane · 22</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'downtime' && (
        <div>
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginBottom: 12}}>
            <div>
              <div className="tiny">WEEK OF · Eleasis 17 — Eleasis 23</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600}}>
                Downtime · <span style={{color:'var(--accent-gold)'}}>{loc.used}</span><span className="muted"> / {loc.slots} slots used</span>
              </div>
            </div>
            <div className="row" style={{gap: 6}}>
              <button className="btn sm">prev week</button>
              <button className="btn sm">next week</button>
              <button className="btn sm primary">resolve week →</button>
            </div>
          </div>

          {/* Slot grid */}
          <div className="grid-3" style={{marginBottom: 18}}>
            {/* Slot 1 — Kaelith forging */}
            <div className="box">
              <div className="box-title"><h3>Slot 1 · Kaelith</h3><span className="meta">days 1–2</span></div>
              <div className="hand ink" style={{fontSize: 18}}>Forge matching signet</div>
              <div className="muted" style={{fontSize: 13, marginTop: 4}}>Craft (forgery) · DC 22 · 80gp materials</div>
              <hr className="rule dashed" />
              <div className="tiny" style={{marginBottom: 4}}>MODIFIERS APPLIED</div>
              <div className="row" style={{gap: 8, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
                <span><b>INT +3</b> (Kaelith 16)</span>
                <span><b>WIS +1</b> (12)</span>
                <span className="muted">CHA n/a</span>
              </div>
              <div className="bar gold" style={{marginTop: 8}}><span style={{width: '85%'}} /></div>
              <div className="tiny" style={{marginTop: 4}}>success projection: 85%</div>
              <div className="row" style={{gap: 6, marginTop: 10}}>
                <button className="btn sm">edit</button>
                <button className="btn sm danger">cancel</button>
              </div>
            </div>

            {/* Slot 2 — Doruk recruiting */}
            <div className="box">
              <div className="box-title"><h3>Slot 2 · Doruk</h3><span className="meta">days 1–3</span></div>
              <div className="hand ink" style={{fontSize: 18}}>Recruit lookouts</div>
              <div className="muted" style={{fontSize: 13, marginTop: 4}}>Diplomacy · DC 18 · 50gp/wk wages</div>
              <hr className="rule dashed" />
              <div className="tiny" style={{marginBottom: 4}}>MODIFIERS APPLIED</div>
              <div className="row" style={{gap: 8, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
                <span><b>CHA +2</b> (Doruk 14)</span>
                <span><b>WIS +3</b> (16)</span>
                <span className="muted">INT n/a</span>
              </div>
              <div className="bar green" style={{marginTop: 8}}><span style={{width: '72%'}} /></div>
              <div className="tiny" style={{marginTop: 4}}>success projection: 72% · adds +1 staff if won</div>
            </div>

            {/* Slot 3 — Vessa research */}
            <div className="box">
              <div className="box-title"><h3>Slot 3 · Vessa</h3><span className="meta">day 4</span></div>
              <div className="hand ink" style={{fontSize: 18}}>Research Banite wards</div>
              <div className="muted" style={{fontSize: 13, marginTop: 4}}>Knowledge (religion) · DC 25 · library access</div>
              <hr className="rule dashed" />
              <div className="tiny" style={{marginBottom: 4}}>MODIFIERS APPLIED</div>
              <div className="row" style={{gap: 8, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
                <span><b>INT +5</b> (Vessa 20)</span>
                <span><b>WIS +2</b> (14)</span>
                <span className="muted">CHA n/a</span>
              </div>
              <div className="bar blue" style={{marginTop: 8}}><span style={{width: '64%'}} /></div>
              <div className="tiny" style={{marginTop: 4}}>success projection: 64% · pushes 1 rumor → confirmed</div>
            </div>

            {/* Slot 4 — Party intel */}
            <div className="box">
              <div className="box-title"><h3>Slot 4 · Party</h3><span className="meta">days 5–7</span></div>
              <div className="hand ink" style={{fontSize: 18}}>Surveil Trades Ward dock</div>
              <div className="muted" style={{fontSize: 13, marginTop: 4}}>Gather Information · group check · 0gp</div>
              <hr className="rule dashed" />
              <div className="tiny" style={{marginBottom: 4}}>MODIFIERS APPLIED · best of party</div>
              <div className="row" style={{gap: 8, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
                <span><b>WIS +3</b> (Doruk)</span>
                <span><b>CHA +4</b> (Kaelith disg.)</span>
                <span><b>INT +5</b> (Vessa support)</span>
              </div>
              <div className="bar green" style={{marginTop: 8}}><span style={{width: '88%'}} /></div>
              <div className="tiny" style={{marginTop: 4}}>success projection: 88% · likely 2 new rumors</div>
            </div>

            {/* Empty slots */}
            <div className="box dashed" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: 180}}>
              <div className="muted" style={{fontSize: 13}}>＋ assign slot 5</div>
              <div className="tiny" style={{marginTop: 6}}>any PC · any allowed action</div>
            </div>
            <div className="box dashed" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: 180}}>
              <div className="muted" style={{fontSize: 13}}>＋ assign slot 6</div>
            </div>
          </div>

          {/* Action menu */}
          <div className="section-title">Actions allowed at this location</div>
          <div className="grid-4">
            {[
              {n:'Forgery / Craft',     stat:'INT', cost:'25–500gp', note:'tools required'},
              {n:'Recruit',             stat:'CHA', cost:'wages',     note:'adds staff'},
              {n:'Research',            stat:'INT', cost:'free',      note:'1 rumor → confirmed'},
              {n:'Gather Information',  stat:'CHA', cost:'10–50gp',   note:'pulls 1–3 rumors'},
              {n:'Train',               stat:'WIS', cost:'time',      note:'+1 to one skill (week)'},
              {n:'Heal / recover',      stat:'WIS', cost:'free',      note:'+HP, removes condition'},
              {n:'Forge alliance',      stat:'CHA', cost:'gift',      note:'NPC ally favor +1'},
              {n:'Plant evidence',      stat:'INT', cost:'varies',    note:'shifts faction influence'},
            ].map(a => (
              <div key={a.n} className="box soft" style={{padding: '10px 12px'}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{a.n}</span>
                  <span className="chip sm">{a.stat}</span>
                </div>
                <div className="tiny" style={{marginTop: 4}}>{a.cost} · {a.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'dm-config' && (
        <div className="grid-2">
          <div className="box">
            <div className="box-title"><h3>Allowance</h3><span className="meta">DM-set</span></div>
            <div className="col" style={{gap: 12}}>
              <div>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span style={{fontSize: 14}}>Slots per week</span>
                  <span className="stat"><b>{loc.slots}</b></span>
                </div>
                <input type="range" min="1" max="12" defaultValue={loc.slots} style={{width:'100%'}} />
                <div className="tiny">scales with location size + rep</div>
              </div>
              <div>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span style={{fontSize: 14}}>Slots per PC, per week</span>
                  <span className="stat"><b>2</b></span>
                </div>
                <input type="range" min="1" max="6" defaultValue={2} style={{width:'100%'}} />
              </div>
              <div>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span style={{fontSize: 14}}>Concurrent workers</span>
                  <span className="stat"><b>3</b></span>
                </div>
                <input type="range" min="1" max="6" defaultValue={3} style={{width:'100%'}} />
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Stat modifiers</h3><span className="meta">how rolls weight</span></div>
            <table className="inv">
              <thead>
                <tr><th>Action</th><th>Primary</th><th>Secondary</th><th>Tertiary</th></tr>
              </thead>
              <tbody>
                <tr><td>Craft / forgery</td><td><b>INT</b></td><td>WIS</td><td className="muted">—</td></tr>
                <tr><td>Recruit</td><td><b>CHA</b></td><td>WIS</td><td className="muted">—</td></tr>
                <tr><td>Research</td><td><b>INT</b></td><td>WIS</td><td className="muted">—</td></tr>
                <tr><td>Gather info</td><td><b>CHA</b></td><td>WIS</td><td>INT</td></tr>
                <tr><td>Heal</td><td><b>WIS</b></td><td className="muted">—</td><td className="muted">—</td></tr>
                <tr><td>Train</td><td><b>WIS</b></td><td>INT</td><td className="muted">—</td></tr>
              </tbody>
            </table>
            <div className="aside" style={{marginTop: 10, fontSize: 16}}>
              ↳ AI computes: roll = d20 + ranks + primary*1.0 + secondary*0.5 + tertiary*0.25
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Allowed actions here</h3><span className="meta">whitelist</span></div>
            <div className="col" style={{gap: 4, fontSize: 13}}>
              {['Forgery','Recruit','Research','Gather Info','Train','Heal','Forge alliance','Plant evidence'].map(a => (
                <label key={a} style={{display:'flex', alignItems:'center', gap: 8}}>
                  <input type="checkbox" defaultChecked /> {a}
                </label>
              ))}
              <label style={{display:'flex', alignItems:'center', gap: 8, opacity: 0.5}}>
                <input type="checkbox" /> Sea travel <span className="muted">(no port)</span>
              </label>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Heat &amp; cost</h3><span className="meta">running this place</span></div>
            <div className="col" style={{gap: 8, fontSize: 14}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>Upkeep / week</span><span className="stat">85gp</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Heat / week</span><span className="stat">+2</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Heat decay (idle)</span><span className="stat">−1</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Discovery threshold</span><span className="stat">75</span></div>
            </div>
            <div className="aside" style={{marginTop: 10}}>
              ↳ if heat ≥ threshold, location becomes <b>contested</b> → AI rolls Zhent counter-action.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

