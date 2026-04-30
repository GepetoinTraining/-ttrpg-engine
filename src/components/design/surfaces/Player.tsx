// @ts-nocheck
'use client'

import React from 'react'
// surfaces/Player.jsx — Player Dashboard (Kaelith)

export default function Player() {
  const [invTab, setInvTab] = React.useState('local');
  const [groups, setGroups] = React.useState({weapons:true, armor:true, consumables:true, magic:true, mundane:false});

  const localItems = {
    weapons: [
      {n:'Shortsword +1', q:1, w:'2 lb', t:'1d6+1 piercing · finesse', tags:['attuned']},
      {n:'Hand crossbow', q:1, w:'3 lb', t:'1d6 piercing · 30 ft'},
      {n:'Daggers (silvered)', q:4, w:'1 lb ea', t:'1d4 · throw 20/60'},
    ],
    armor: [
      {n:'Studded leather +1', q:1, w:'13 lb', t:'AC 13 + Dex · attuned'},
    ],
    consumables: [
      {n:'Potion of healing', q:3, w:'½ lb', t:'2d4+2 HP'},
      {n:"Alchemist's fire", q:2, w:'1 lb', t:'1d4 fire / round'},
      {n:'Tindertwig', q:8, w:'—', t:'instant flame'},
    ],
    magic: [
      {n:'Boots of Elvenkind', q:1, w:'1 lb', t:'+5 Move Silently · attuned'},
      {n:'Hat of Disguise', q:1, w:'—', t:'1/day · 1 hr'},
    ],
  };

  const nonLocalItems = [
    {loc:'Stash · Waterdeep safehouse', items:'4× signet rings (forged), 280gp coin, climbing rig'},
    {loc:'With Old Pell (fence)', items:'Zhent ledger (translated), 2× hush-letters'},
    {loc:'Held by Doruk', items:'Holy water flask (yours, returned next session)'},
    {loc:'Mount: "Soot" (riding horse)', items:'Bedroll, rations ×7, lantern, oil ×3, rope 50ft'},
  ];

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">03 · Player Dashboard</div>
          <h2>Kaelith Vex</h2>
        </div>
        <span className="who">your view, Kaelith</span>
      </div>

      {/* Identity strip */}
      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, lineHeight: 1}}>Kaelith Vex</div>
              <div className="tiny" style={{marginTop: 4}}>Half-elf · Rogue 7 · Chaotic Good · Mulmaster street kid</div>
              <div className="row" style={{gap: 16, marginTop: 12, fontFamily:'var(--mono)', fontSize: 12}}>
                <span><span className="muted">HP</span> <b>34/52</b></span>
                <span><span className="muted">AC</span> <b>17</b></span>
                <span><span className="muted">Init</span> <b>+5</b></span>
                <span><span className="muted">Speed</span> <b>30 ft</b></span>
                <span><span className="muted">Sneak</span> <b>4d6</b></span>
                <span><span className="muted">XP</span> <b>23,400</b></span>
              </div>
            </div>
            <div className="row" style={{gap: 6}}>
              <button className="btn sm">full sheet ↗</button>
              <button className="btn sm primary">end turn</button>
            </div>
          </div>
        </div>
        <div className="box filled">
          <div className="box-title"><h3>Carry</h3><span className="meta">enc.</span></div>
          <div className="bar gold"><span style={{width: '38%'}} /></div>
          <div className="tiny" style={{marginTop: 6}}>23 / 60 lb · light load</div>
          <div className="aside" style={{marginTop: 8, fontSize:16}}>↳ stash anything &gt;30 lb at safehouse</div>
        </div>
      </div>

      {/* Inventory */}
      <div className="section-title">Inventory · tabular · collapsible · searchable</div>
      <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
        <div className="tabs" style={{margin: 0, border: 0}}>
          <div className={`tab ${invTab==='local'?'active':''}`} onClick={()=>setInvTab('local')}>On person</div>
          <div className={`tab ${invTab==='nonlocal'?'active':''}`} onClick={()=>setInvTab('nonlocal')}>Non-local</div>
          <div className={`tab ${invTab==='attune'?'active':''}`} onClick={()=>setInvTab('attune')}>Attunements</div>
        </div>
        <div className="row" style={{gap: 8, alignItems:'center'}}>
          <input className="placeholder" style={{padding:'4px 10px', minHeight:0, fontFamily:'var(--mono)', fontSize: 12, width: 220, background: 'var(--paper)'}} placeholder="🔍  search items, tags, notes…" />
          <button className="btn sm">＋ add</button>
        </div>
      </div>

      {invTab === 'local' && (
        <div className="box" style={{padding: 0}}>
          <table className="inv">
            <thead>
              <tr><th style={{width: 24}}></th><th>Item</th><th style={{width: 60}}>Qty</th><th style={{width: 80}}>Wt</th><th>Notes</th><th style={{width: 100}}>Tags</th></tr>
            </thead>
            <tbody>
              {Object.entries(localItems).map(([cat, items]) => (
                <React.Fragment key={cat}>
                  <tr className="group" onClick={() => setGroups({...groups, [cat]: !groups[cat]})} style={{cursor:'pointer'}}>
                    <td>{groups[cat] ? '▾' : '▸'}</td>
                    <td colSpan={5}>{cat} <span className="muted">· {items.length}</span></td>
                  </tr>
                  {groups[cat] && items.map(it => (
                    <tr key={it.n}>
                      <td></td>
                      <td><b>{it.n}</b></td>
                      <td className="stat">{it.q}</td>
                      <td className="stat">{it.w}</td>
                      <td className="muted" style={{fontSize: 13}}>{it.t}</td>
                      <td>{(it.tags||[]).map(t => <span key={t} className="chip gold sm" style={{fontSize: 9}}>{t}</span>)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              <tr className="group">
                <td>▸</td><td colSpan={5}>mundane <span className="muted">· 14</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {invTab === 'nonlocal' && (
        <div className="col" style={{gap: 8}}>
          {nonLocalItems.map((g, i) => (
            <div key={i} className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <div>
                  <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{g.loc}</div>
                  <div className="muted" style={{fontSize: 13, marginTop: 4}}>{g.items}</div>
                </div>
                <div className="row" style={{gap: 6}}>
                  <button className="btn sm">view</button>
                  <button className="btn sm">retrieve →</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {invTab === 'attune' && (
        <div className="grid-3">
          {['Shortsword +1','Studded leather +1','Boots of Elvenkind'].map(s => (
            <div key={s} className="box">
              <div className="box-title"><h3>{s}</h3><span className="meta">attuned</span></div>
              <div className="bar"><span style={{width: '100%'}} /></div>
              <div className="tiny" style={{marginTop: 6}}>slot 1 of 3</div>
            </div>
          ))}
        </div>
      )}

      {/* Allies + Pre-planned actions */}
      <div className="grid-2" style={{marginTop: 32}}>
        <div>
          <div className="section-title" style={{marginTop:0}}>Non-local NPC allies · async chat</div>
          <div className="col">
            <div className="box">
              <div className="row" style={{justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--serif)', fontSize: 17, fontWeight: 600}}>Old Pell · fence, Mulmaster</div>
                  <div className="tiny">last contacted 3 days ago · 2 unread →</div>
                </div>
                <span className="chip blue">ally</span>
              </div>
              <div className="aside blue" style={{marginTop: 8, fontStyle:'italic'}}>
                "The ledger you sent — there's a name in it that shouldn't be. We
                need to talk before you go to the vault."
              </div>
              <div className="row" style={{gap: 6, marginTop: 8}}>
                <button className="btn sm">reply</button>
                <button className="btn sm">ask favor</button>
                <button className="btn sm">trade</button>
              </div>
            </div>

            <div className="box">
              <div className="row" style={{justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--serif)', fontSize: 17, fontWeight: 600}}>Lady Mireska · Harper contact</div>
                  <div className="tiny">political · costs favor to call</div>
                </div>
                <span className="chip blue">ally</span>
              </div>
              <div className="muted" style={{fontSize: 13, marginTop: 6}}>
                Owes you for the Yellow Banner job. Will move resources in
                Waterdeep, not outside.
              </div>
            </div>

            <div className="box dashed">
              <div className="muted" style={{fontSize: 13}}>＋ propose new ally · pending DM approval</div>
            </div>
          </div>
        </div>

        <div>
          <div className="section-title" style={{marginTop:0}}>Pre-planned actions · for next session</div>
          <div className="col">
            <div className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <div>
                  <span className="chip">when</span> <b>session opens</b>
                </div>
                <span className="chip green">ready</span>
              </div>
              <div style={{marginTop: 8}}>
                <span className="hand ink" style={{fontSize: 18}}>I want to —</span>
                <p style={{margin: '4px 0', fontSize: 14}}>Take the Banite priestess <i>alive</i> if possible. Move to upper gallery via climber's kit, attempt grapple disarm.</p>
              </div>
              <div className="tiny" style={{marginTop: 4}}>cost · 1 round of stealth approach · DC 15 climb (auto on 10+)</div>
            </div>

            <div className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <div>
                  <span className="chip">if</span> <b>vault opens cleanly</b>
                </div>
                <span className="chip gold">conditional</span>
              </div>
              <p style={{margin: '8px 0 0', fontSize: 14}}>Spend downtime forging matched signet for the Manshoon scrying gambit (2 days · 80gp materials)</p>
            </div>

            <div className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                <div>
                  <span className="chip">always</span> <b>standing orders</b>
                </div>
                <span className="chip blue">ongoing</span>
              </div>
              <ul style={{margin: '8px 0 0', paddingLeft: 16, fontSize: 14}}>
                <li>If Aramil drops below ¼ HP — I dash to him, use my potion</li>
                <li>Listen for "Mulmaster" or "Manshoon" in any voiced NPC</li>
              </ul>
            </div>

            <div className="box dashed">
              <div className="muted" style={{fontSize: 13}}>＋ add planned action</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

