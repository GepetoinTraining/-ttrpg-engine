// @ts-nocheck
'use client'

import React from 'react'
import { authFetch } from '@/lib/auth-fetch'

// surfaces/TPEditor.tsx — World mutation audit + .tp editor.
// READ-ONLY wiring: /api/tp/tree returns the live topology (world → regions →
// settlements → buildings counts). κ WRITE capability requires a data_static
// JSON column in world_regions/settlements which the schema doesn't yet
// include — flagged for a Phase 3 schema decision.

async function loadTree(): Promise<any> {
  const res = await authFetch('/api/tp/tree')
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export default function TPEditor() {
  const [tab, setTab] = React.useState('graph');
  const [selected, setSelected] = React.useState('zhent.influence');
  const [tree, setTree] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadTree().then(setTree).catch(e => setError(e?.message ?? 'tree load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">23 · DM · κ raw access</div>
          <h2>World Audit · .tp editor</h2>
        </div>
        <span className="who">danger zone · authoring &amp; debug</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/tp.ts exposes <code style={{fontFamily:'var(--mono)', background:'var(--paper-2)', padding:'1px 4px'}}>writeKappa()</code> &amp;{' '}
        <code style={{fontFamily:'var(--mono)', background:'var(--paper-2)', padding:'1px 4px'}}>mutateNode()</code>. this surface is the
        only place to author nodes / edges and inspect κ directly. <b>changes are
        recorded to TPB (19) and reversible.</b>
      </div>

      {/* Live engine strip — read-only topology */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live topology snapshot</h3>
          <span className="meta">→ /api/tp/tree · world_regions + settlements + buildings (read-only)</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!tree && !error && <div className="tiny muted">loading…</div>}
        {tree && (
          <>
            <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, marginBottom: 8, flexWrap:'wrap'}}>
              <span>worlds <b>{tree.counts.worlds}</b></span>
              <span>regions <b>{tree.counts.regions}</b></span>
              <span>settlements <b>{tree.counts.settlements}</b></span>
              <span>buildings <b>{tree.counts.buildings}</b></span>
            </div>
            {tree.worlds.length > 0 && (
              <div className="col" style={{gap: 4, fontSize: 12}}>
                {tree.worlds.map((w: any) => {
                  const regions = tree.regions.filter((r: any) => r.worldId === w.id)
                  return (
                    <div key={w.id}>
                      <div><b>{w.name ?? w.id}</b> <span className="muted">· {regions.length} regions</span></div>
                      <div className="tiny muted" style={{marginLeft: 14, lineHeight: 1.6}}>
                        {regions.slice(0, 8).map((r: any) => (
                          <div key={r.id}>↳ {r.name} <span style={{opacity: 0.6}}>· {r.terrain}{r.hasSettlement ? ` · ${r.settlementName ?? 'settled'}` : ''}</span></div>
                        ))}
                        {regions.length > 8 && <div>… +{regions.length - 8} more</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="aside" style={{marginTop: 10, fontSize: 14, color:'var(--accent-gold)'}}>
              ↳ writes are stubbed: world_regions / settlements have no data_static JSON column yet.
              Adding one (and a tpb_entries write on each κ change) is the next schema move.
            </div>
          </>
        )}
      </div>

      <div className="tabs">
        {[['graph','κ graph'],['nodes','Node browser'],['log','Mutation log'],['author','Author / batch']].map(([k,l]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</div>
        ))}
      </div>

      {tab === 'graph' && (
        <div className="row" style={{gap: 14, alignItems:'flex-start'}}>
          <div className="col" style={{width: 240, gap: 10}}>
            <div className="box" style={{padding: 0}}>
              <div className="tiny" style={{padding:'8px 12px', borderBottom:'1px solid var(--rule)', background:'var(--paper-2)'}}>NAMESPACES · 8</div>
              {[
                {n:'world',     c:128, sel:false},
                {n:'party',     c:42,  sel:false},
                {n:'npc',       c:204, sel:false},
                {n:'zhent',     c:38,  sel:true},
                {n:'crown',     c:28,  sel:false},
                {n:'economy',   c:96,  sel:false},
                {n:'tpb',       c:1842,sel:false},
                {n:'session',   c:14,  sel:false},
              ].map(ns => (
                <div key={ns.n} style={{padding:'8px 12px', borderBottom: '1px dashed var(--rule-soft)',
                                         cursor:'pointer',
                                         background: ns.sel ? 'var(--paper-2)' : 'transparent',
                                         borderLeft: ns.sel ? '3px solid var(--ink)' : '3px solid transparent'}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <span style={{fontFamily:'var(--mono)', fontSize: 13, fontWeight: ns.sel?600:400}}>{ns.n}</span>
                    <span className="tiny">{ns.c}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{flex:1}}>
            <div className="box" style={{position: 'relative', minHeight: 420, padding: 0}}>
              <div className="tiny" style={{padding: '8px 12px', borderBottom:'1px solid var(--rule)', background:'var(--paper-2)', display:'flex', justifyContent:'space-between'}}>
                <span>NAMESPACE: <b>zhent</b> · 38 nodes · 14 edges</span>
                <span>fit · zoom · filter</span>
              </div>
              {/* graph mock */}
              <svg viewBox="0 0 600 360" style={{width:'100%', height: 380, display:'block'}}>
                <defs>
                  <marker id="ar" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0,0 L10,5 L0,10 z" fill="#1f1b16" />
                  </marker>
                </defs>
                {/* edges */}
                <g stroke="#4a4338" strokeWidth="1" fill="none" markerEnd="url(#ar)">
                  <line x1="300" y1="180" x2="180" y2="100" />
                  <line x1="300" y1="180" x2="450" y2="100" />
                  <line x1="300" y1="180" x2="180" y2="260" />
                  <line x1="300" y1="180" x2="450" y2="260" />
                  <line x1="180" y1="100" x2="100" y2="50" />
                  <line x1="450" y1="100" x2="540" y2="50" />
                  <line x1="450" y1="260" x2="540" y2="320" />
                </g>
                {/* nodes */}
                {[
                  {x:300, y:180, l:'zhent', big:true, c:'#a8442a'},
                  {x:180, y:100, l:'zhent.cells', c:'#1f1b16'},
                  {x:450, y:100, l:'zhent.influence', c:'#b08838', sel:true},
                  {x:180, y:260, l:'zhent.assets', c:'#1f1b16'},
                  {x:450, y:260, l:'zhent.heat', c:'#a8442a'},
                  {x:100, y:50,  l:'cell.waterdeep', c:'#1f1b16'},
                  {x:540, y:50,  l:'inf.waterdeep:22', c:'#b08838'},
                  {x:540, y:320, l:'heat.party:+12', c:'#a8442a'},
                ].map((n, i) => (
                  <g key={i} onClick={() => setSelected(n.l)} style={{cursor:'pointer'}}>
                    <rect x={n.x - (n.big?42:60)} y={n.y - 14} width={n.big?84:120} height="28"
                          fill={n.sel ? '#1f1b16' : '#f4efe4'} stroke={n.c} strokeWidth={n.sel?2:1.2} />
                    <text x={n.x} y={n.y+4} textAnchor="middle"
                          fontFamily="JetBrains Mono, monospace" fontSize={n.big?12:10}
                          fill={n.sel ? '#f4efe4' : '#1f1b16'}>{n.l}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div style={{width: 320}} className="col">
            <div className="box">
              <div className="box-title"><h3>Selected node</h3><span className="meta">read · write</span></div>
              <div className="tiny">PATH</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 13, padding:'4px 6px', background:'var(--paper-2)', border:'1px solid var(--rule-soft)', marginBottom: 8}}>{selected}</div>
              <div className="tiny">TYPE</div>
              <div style={{fontSize: 13, marginBottom: 8}}>integer · range −100..+100</div>
              <div className="tiny">CURRENT VALUE</div>
              <div style={{fontFamily:'var(--mono)', fontSize: 18, fontWeight: 600, marginBottom: 8}}>22</div>
              <hr className="rule dashed" />
              <div className="tiny">EDGES IN</div>
              <ul style={{margin:'4px 0 8px', paddingLeft: 14, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)'}}>
                <li>scene: arc02-vault-glyph-trigger (−6)</li>
                <li>caravan: CRV-018 success (+4)</li>
              </ul>
              <div className="tiny">SUBSCRIBERS</div>
              <ul style={{margin:'4px 0 8px', paddingLeft: 14, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)'}}>
                <li>Settlement.Suzail.factionList</li>
                <li>Reputation.Crown.threshold-check</li>
              </ul>
              <div className="row" style={{gap: 6}}>
                <button className="btn sm">edit value</button>
                <button className="btn sm danger">delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'nodes' && (
        <div className="box" style={{padding: 0}}>
          <div className="row" style={{justifyContent:'space-between', padding:'10px 14px', borderBottom: '1px solid var(--rule)'}}>
            <input className="placeholder" style={{flex:1, padding:'4px 10px', minHeight:0, fontFamily:'var(--mono)', fontSize: 12, maxWidth: 320}} placeholder="🔍  path filter (e.g. zhent.*)" />
            <div className="row" style={{gap:6}}>
              <button className="btn sm">＋ node</button>
              <button className="btn sm">＋ edge</button>
            </div>
          </div>
          <table className="inv">
            <thead><tr><th>Path</th><th>Type</th><th>Value</th><th>Last write</th><th>By</th><th></th></tr></thead>
            <tbody>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>zhent.influence.waterdeep</code></td><td>int</td><td className="stat">22</td><td className="muted">21:42</td><td className="muted">scene</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>zhent.influence.suzail</code></td><td>int</td><td className="stat">18</td><td className="muted">21:14</td><td className="muted">tick</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>zhent.heat.party</code></td><td>int</td><td className="stat">+12</td><td className="muted">21:30</td><td className="muted">recon</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>npc.selvys.status</code></td><td>enum</td><td className="stat">"plotting"</td><td className="muted">21:42</td><td className="muted">scene</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>npc.selvys.knowledge[3]</code></td><td>fact</td><td className="stat">"Kaelith → Mulmaster"</td><td className="muted">arc 01</td><td className="muted">manual</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>economy.spice.supply_shock</code></td><td>int</td><td className="stat">+1</td><td className="muted">Eleasis 14</td><td className="muted">tick</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>waterdeep.sunset_vault.contested</code></td><td>bool</td><td className="stat">true</td><td className="muted">21:41</td><td className="muted">contingency</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>party.heat.zhent</code></td><td>int</td><td className="stat">12</td><td className="muted">21:30</td><td className="muted">recon</td><td><button className="btn sm">edit</button></td></tr>
              <tr><td><code style={{fontFamily:'var(--mono)', fontSize: 12}}>session.current.scene</code></td><td>str</td><td className="stat">"arc02-vault-glyph"</td><td className="muted">21:41</td><td className="muted">mm-session</td><td><button className="btn sm">edit</button></td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'log' && (
        <div className="col" style={{gap: 6}}>
          <div className="aside blue">↳ every writeKappa() call · reversible · linked to TPB entry.</div>
          {[
            {t:'21:42:08', who:'scene contingency-04', op:'SET',  path:'waterdeep.sunset_vault.contested', val:'true', revertable:true},
            {t:'21:42:08', who:'scene mutation',       op:'+=',   path:'zhent.influence.waterdeep',         val:'-6',   revertable:true},
            {t:'21:42:01', who:'mm-npc.selvys',        op:'SET',  path:'npc.selvys.last_speech',            val:'"Mulmaster\'s little shadow…"', revertable:true},
            {t:'21:41:54', who:'mm-session',           op:'SET',  path:'session.current.scene',             val:'"arc02-vault-glyph"', revertable:false},
            {t:'21:39:22', who:'skill check',          op:'PUSH', path:'tpb.entry',                          val:'roll(open-lock,22,18)', revertable:false},
            {t:'21:30:11', who:'recon resolution',     op:'+=',   path:'party.heat.zhent',                  val:'+4',   revertable:true},
            {t:'Eleasis 22', who:'world tick',         op:'+=',   path:'suzail.unrest',                      val:'+9',   revertable:true},
            {t:'Eleasis 14', who:'route disruption',   op:'SET',  path:'route.suzail-selgaunt.status',       val:'"disrupted"', revertable:true},
          ].map((m, i) => (
            <div key={i} className="row" style={{gap: 10, padding:'6px 10px', borderBottom: '1px dashed var(--rule-soft)', alignItems:'baseline', background: i%2 ? 'var(--paper-2)' : 'transparent'}}>
              <span style={{width: 90, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-3)'}}>{m.t}</span>
              <span style={{width: 56}} className={`chip sm ${m.op === 'SET' ? '' : m.op === '+=' ? 'gold' : 'blue'}`}>{m.op}</span>
              <code style={{fontFamily:'var(--mono)', fontSize: 12, flex: 1}}>{m.path} = {m.val}</code>
              <span className="tiny" style={{width: 130}}>{m.who}</span>
              {m.revertable
                ? <button className="btn sm">↶ revert</button>
                : <span className="tiny muted">final</span>}
            </div>
          ))}
        </div>
      )}

      {tab === 'author' && (
        <div className="grid-2">
          <div className="box">
            <div className="box-title"><h3>Quick mutation</h3><span className="meta">single op</span></div>
            <div className="col" style={{gap: 8}}>
              <input style={{padding:'6px 10px', fontFamily:'var(--mono)', fontSize: 13, border:'1px solid var(--rule-soft)', background:'var(--paper)'}} defaultValue="zhent.influence.waterdeep" />
              <div className="row" style={{gap: 6}}>
                <select style={{fontFamily:'var(--mono)', fontSize: 13, padding:'5px 8px'}}><option>SET</option><option>+=</option><option>-=</option><option>PUSH</option><option>DELETE</option></select>
                <input style={{flex: 1, padding:'5px 10px', fontFamily:'var(--mono)', fontSize: 13, border:'1px solid var(--rule-soft)', background:'var(--paper)'}} defaultValue="-12" />
              </div>
              <textarea rows={2} placeholder="reason / commit message…" style={{padding:'6px 10px', fontFamily:'var(--serif)', fontSize: 13, border:'1px solid var(--rule-soft)', background:'var(--paper)'}} />
              <div className="row" style={{gap: 6}}>
                <button className="btn sm">dry-run</button>
                <button className="btn sm primary">apply</button>
              </div>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Batch · .tp script</h3><span className="meta">apply atomically</span></div>
            <textarea rows={9} style={{width:'100%', padding:'8px 10px', fontFamily:'var(--mono)', fontSize: 12, border:'1px solid var(--rule-soft)', background:'var(--paper-2)', lineHeight: 1.5}}
              defaultValue={`# arc02 wrap-up
SET    waterdeep.sunset_vault.cleared    = true
+=     zhent.influence.waterdeep         -8
+=     party.heat.zhent                  +4
SET    npc.selvys.status                 = "captured"
PUSH   tpb.entry                         { kind: scene_resolved, id: 04 }`} />
            <div className="row" style={{gap: 6, marginTop: 8}}>
              <button className="btn sm">validate</button>
              <button className="btn sm">dry-run · diff</button>
              <button className="btn sm primary">commit</button>
            </div>
          </div>

          <div className="box dashed" style={{gridColumn:'span 2'}}>
            <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)'}}>
              <span><b>safety:</b> all writes journaled to TPB · revert from log</span>
              <span><b>broadcasts:</b> 3 surfaces will re-render (Settlement.Suzail · Reputation · DMConsole)</span>
              <span><b>warning:</b> direct κ writes bypass scene contingencies</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

