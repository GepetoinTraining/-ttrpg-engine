// @ts-nocheck
'use client'

import React from 'react'
import { loadScenes } from '@/lib/narrative'

// surfaces/SceneEditor.tsx — author scene cards.
// READ-ONLY wiring for now: lists existing scene_cards + hook_threads.
// AUTHORING capability requires scene_contingencies + scene_mutations child
// tables — flagged as the most-stable next schema move (vs JSON columns
// per user direction "won't make us want to kill ourselves later").

export default function SceneEditor() {
  const [tab, setTab] = React.useState('compose');
  const [live, setLive] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadScenes().then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">18 · DM prep · scene authoring</div>
          <h2>Scene Card · editor</h2>
        </div>
        <span className="who">DMConsole shows the active card; this writes them</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ a <b>scene card</b> is a structured payload mm-session.ts loads at run-time.
        contingencies fire on triggers · worldMutations write into κ · visibility gates
        what each PC sees. <i>this surface is the schema-aware editor.</i>
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live scene cards</h3>
          <span className="meta">→ /api/scene/list · scene_cards + hook_threads · authoring deferred</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {live && (
          <>
            <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, marginBottom: 8, flexWrap:'wrap'}}>
              <span>sessions <b>{live.counts.sessions}</b></span>
              <span>scene_cards <b>{live.counts.cards}</b></span>
              <span>open hooks <b>{live.counts.hooks}</b></span>
            </div>
            {live.cards.length === 0 ? (
              <div className="tiny muted">no scene_cards yet · the editor below is wireframe-only</div>
            ) : (
              <div className="col" style={{gap: 4, fontSize: 13, maxHeight: 200, overflowY: 'auto'}}>
                {live.cards.slice(0, 30).map((c: any) => (
                  <div key={c.id} className="row" style={{justifyContent:'space-between', padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)'}}>
                    <span><b>{c.title ?? c.cardType}</b> <span className="muted">· {c.cardType}</span></span>
                    <span className="tiny muted">session {c.sessionId.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="aside" style={{marginTop: 10, fontSize: 14, color:'var(--accent-gold)'}}>
          ↳ next schema move (per user direction): add child tables{' '}
          <span className="kbd">scene_contingencies</span> and{' '}
          <span className="kbd">scene_mutations</span> rather than JSON columns —
          relational + queryable + indexable, will not regret later.
        </div>
      </div>

      {/* breadcrumb of scene location in deck */}
      <div className="box" style={{padding:'8px 14px', marginBottom: 14}}>
        <div className="row" style={{justifyContent:'space-between', fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)'}}>
          <span>Arc 02 · Sunset Vault arc · scene 04 of 7</span>
          <span>id <b>arc02-vault-glyph-trigger</b> · v3 · last edit 14h ago by DM</span>
        </div>
      </div>

      <div className="row" style={{gap: 14, alignItems: 'flex-start'}}>
        {/* LEFT: structure tree */}
        <div className="col" style={{width: 230, gap: 10}}>
          <div className="box" style={{padding: 0}}>
            <div className="tiny" style={{padding: '8px 12px', borderBottom:'1px solid var(--rule)', background:'var(--paper-2)'}}>SCENES IN ARC 02</div>
            {[
              {id:'01',n:'Approach the vault',s:'done'},
              {id:'02',n:'Pick the outer lock',s:'done'},
              {id:'03',n:'Inner foyer · clue',s:'done'},
              {id:'04',n:'Glyph trigger → combat',s:'live'},
              {id:'05',n:'Banite priestess parlay',s:'on deck'},
              {id:'06',n:'Vault contents reveal',s:'on deck'},
              {id:'07',n:'Manshoon scrying', s:'draft'},
            ].map(s => (
              <div key={s.id} style={{padding: '8px 12px', borderBottom: '1px dashed var(--rule-soft)',
                                       background: s.s==='live'?'var(--paper-2)':'transparent',
                                       borderLeft: s.s==='live' ? '3px solid var(--accent-red)' : '3px solid transparent'}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span style={{fontSize: 13, fontWeight: s.s==='live'?600:400}}><span className="muted" style={{fontFamily:'var(--mono)', fontSize: 10, marginRight: 6}}>{s.id}</span>{s.n}</span>
                </div>
                <div className="tiny" style={{marginTop: 2}}>{s.s}</div>
              </div>
            ))}
            <div style={{padding:'10px 12px', textAlign:'center'}}>
              <button className="btn sm">＋ new scene</button>
            </div>
          </div>
          <div className="box dashed">
            <div className="tiny" style={{marginBottom: 4}}>VALIDATION</div>
            <div className="col" style={{gap: 4, fontSize: 12}}>
              <div><span style={{color:'var(--accent-green)'}}>✓</span> 3 contingencies wired</div>
              <div><span style={{color:'var(--accent-green)'}}>✓</span> world mutations dry-run pass</div>
              <div><span style={{color:'var(--accent-gold)'}}>!</span> visibility gates: 1 PC unhandled (Aramil)</div>
              <div><span style={{color:'var(--accent-red)'}}>✗</span> linked NPC <b>Selvys</b> missing voice profile</div>
            </div>
          </div>
        </div>

        {/* CENTER: editor */}
        <div className="col" style={{flex: 1, gap: 12}}>
          <div className="tabs">
            {[
              ['compose',  'Compose'],
              ['contingencies','Contingencies'],
              ['mutations','World mutations'],
              ['visibility','Visibility'],
              ['preview','Preview as DM'],
            ].map(([k, lbl]) => (
              <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{lbl}</div>
            ))}
          </div>

          {tab === 'compose' && (
            <div className="grid-2">
              <div className="box" style={{gridColumn:'span 2'}}>
                <div className="box-title"><h3>Scene heading</h3><span className="meta">title · slug · summary</span></div>
                <div className="col" style={{gap: 8}}>
                  <input style={{padding:'6px 10px', fontFamily:'var(--serif)', fontSize: 18, border:'1px solid var(--rule-soft)', background:'var(--paper)'}} defaultValue="The Sunset Vault, Waterdeep" />
                  <input style={{padding:'5px 10px', fontFamily:'var(--mono)', fontSize: 12, border:'1px solid var(--rule-soft)', background:'var(--paper)', color:'var(--ink-3)'}} defaultValue="arc02-vault-glyph-trigger" />
                  <textarea rows={3} style={{padding:'6px 10px', fontFamily:'var(--serif)', fontSize: 14, border:'1px solid var(--rule-soft)', background:'var(--paper)'}} defaultValue="Dim torchlight. The party has just triggered the glyph ward. Two Zhentarim enforcers + a Banite priestess on the upper gallery." />
                </div>
              </div>

              <div className="box">
                <div className="box-title"><h3>Setting</h3><span className="meta">env · time · weather</span></div>
                <div className="col" style={{gap: 6, fontSize: 13}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <span>location</span>
                    <select style={{fontFamily:'var(--serif)', fontSize: 13, border:'1px solid var(--rule-soft)', background:'var(--paper)', padding:'2px 6px'}}>
                      <option>Sunset Vault, Waterdeep</option>
                    </select>
                  </div>
                  <div className="row" style={{justifyContent:'space-between'}}><span>lighting</span><select style={{fontFamily:'var(--serif)', fontSize: 13, padding:'2px 6px'}}><option>dim · torch</option></select></div>
                  <div className="row" style={{justifyContent:'space-between'}}><span>time of day</span><select style={{fontFamily:'var(--serif)', fontSize: 13, padding:'2px 6px'}}><option>night · 21:42</option></select></div>
                  <div className="row" style={{justifyContent:'space-between'}}><span>weather</span><select style={{fontFamily:'var(--serif)', fontSize: 13, padding:'2px 6px'}}><option>overcast · light wind</option></select></div>
                </div>
                <hr className="rule dashed" />
                <div className="tiny" style={{marginBottom: 4}}>TAGS</div>
                <div className="row" style={{gap: 4, flexWrap:'wrap'}}>
                  {['indoors','dim','combat','trap','stealth-allowed','loot'].map(t => <span key={t} className="chip sm">{t}<span style={{marginLeft:4, color:'var(--ink-3)', cursor:'pointer'}}>×</span></span>)}
                  <span className="chip sm dashed" style={{borderStyle:'dashed', color:'var(--ink-3)', cursor:'pointer'}}>＋ tag</span>
                </div>
              </div>

              <div className="box">
                <div className="box-title"><h3>Cast</h3><span className="meta">NPCs in scene</span></div>
                <div className="col" style={{gap: 6}}>
                  {[
                    {n:'Selvys (Banite priestess)', r:'antagonist', voice:true},
                    {n:'Enforcer A', r:'mook', voice:false},
                    {n:'Enforcer B', r:'mook', voice:false},
                  ].map(c => (
                    <div key={c.n} className="row" style={{justifyContent:'space-between', padding:'6px 0', borderBottom:'1px dashed var(--rule-soft)', fontSize: 13}}>
                      <span><b>{c.n}</b> <span className="muted">· {c.r}</span></span>
                      <span className={`chip sm ${c.voice?'blue':''}`}>{c.voice?'voiced by AI':'silent'}</span>
                    </div>
                  ))}
                  <button className="btn sm">＋ add NPC from roster</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'contingencies' && (
            <div className="col" style={{gap: 10}}>
              <div className="aside blue">↳ contingency = <span style={{fontFamily:'var(--mono)', fontSize: 14}}>WHEN(trigger) → THEN(effect)</span>. fire once or repeat.</div>
              {[
                {when:'PC enters range 30ft of glyph', then:'glyph flares · combat init', once:true, fired:true},
                {when:'Selvys reduced to 0 HP', then:'enforcers flee · drop spice key', once:true, fired:false},
                {when:'PC casts Detect Magic', then:'reveal hidden vault rune (south wall)', once:false, fired:false},
                {when:'Round 5 reached', then:'Manshoon scries scene · push to scene 07', once:true, fired:false},
              ].map((c, i) => (
                <div key={i} className="box">
                  <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                    <div className="tiny">CONTINGENCY {String(i+1).padStart(2,'0')}</div>
                    <div className="row" style={{gap: 6}}>
                      <span className={`chip sm ${c.fired?'green':''}`}>{c.fired?'fired':'armed'}</span>
                      <span className="chip sm">{c.once?'once':'repeats'}</span>
                      <button className="btn sm">edit</button>
                    </div>
                  </div>
                  <div className="grid-2" style={{marginTop: 6, gap: 10}}>
                    <div>
                      <div className="tiny">WHEN</div>
                      <div style={{fontFamily:'var(--mono)', fontSize: 13, padding: '6px 8px', background:'var(--paper-2)', border:'1px solid var(--rule-soft)'}}>{c.when}</div>
                    </div>
                    <div>
                      <div className="tiny">THEN</div>
                      <div style={{fontFamily:'var(--mono)', fontSize: 13, padding: '6px 8px', background:'var(--paper-2)', border:'1px solid var(--rule-soft)'}}>{c.then}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="box dashed" style={{textAlign:'center', padding: 16}}>
                <span className="muted">＋ add contingency</span>
              </div>
            </div>
          )}

          {tab === 'mutations' && (
            <div>
              <div className="aside" style={{marginBottom: 12}}>
                ↳ world mutations write into κ when scene resolves. preview shows the diff;
                deep-link to <b>.tp editor (23)</b> for raw access.
              </div>
              <table className="inv">
                <thead><tr><th>Path</th><th>Op</th><th>Value</th><th>Trigger</th></tr></thead>
                <tbody>
                  <tr><td><span style={{fontFamily:'var(--mono)', fontSize: 12}}>waterdeep.sunset_vault.contested</span></td><td><span className="chip red sm">SET</span></td><td className="stat">true</td><td className="muted">on glyph trigger</td></tr>
                  <tr><td><span style={{fontFamily:'var(--mono)', fontSize: 12}}>zhent.influence.waterdeep</span></td><td><span className="chip sm">+=</span></td><td className="stat">−6</td><td className="muted">on Selvys defeat</td></tr>
                  <tr><td><span style={{fontFamily:'var(--mono)', fontSize: 12}}>npc.selvys.status</span></td><td><span className="chip red sm">SET</span></td><td className="stat">"captured"</td><td className="muted">if HP=0 + party intent=capture</td></tr>
                  <tr><td><span style={{fontFamily:'var(--mono)', fontSize: 12}}>economy.spice.supply_shock</span></td><td><span className="chip sm">+=</span></td><td className="stat">+1</td><td className="muted">on vault contents reveal</td></tr>
                  <tr><td><span style={{fontFamily:'var(--mono)', fontSize: 12}}>party.heat.zhent</span></td><td><span className="chip sm">+=</span></td><td className="stat">+12</td><td className="muted">always (scene start)</td></tr>
                  <tr><td><span style={{fontFamily:'var(--mono)', fontSize: 12}}>tpb.entry</span></td><td><span className="chip sm">PUSH</span></td><td className="stat">scene id + roll log</td><td className="muted">on scene end</td></tr>
                </tbody>
              </table>
              <div className="row" style={{gap: 6, marginTop: 12}}>
                <button className="btn sm">＋ mutation</button>
                <button className="btn sm">dry-run</button>
                <button className="btn sm">→ open in .tp editor</button>
              </div>
            </div>
          )}

          {tab === 'visibility' && (
            <div className="grid-2">
              <div className="box" style={{gridColumn:'span 2'}}>
                <div className="aside">↳ what each PC <b>sees, hears, knows</b> at scene start. drives whisper-channel context.</div>
              </div>
              {[
                {pc:'Kaelith', n:[
                  {l:'sees Selvys clearly (Mulmaster recognition)', g:'green'},
                  {l:'reads holy symbol of Bane', g:'green'},
                  {l:'hidden glyph on south wall (DC 18)', g:'gold'},
                ]},
                {pc:'Doruk', n:[
                  {l:'detects evil aura on priestess', g:'green'},
                  {l:'smells incense (wax + iron)', g:'green'},
                  {l:'recognizes hold-person prep stance', g:'gold'},
                ]},
                {pc:'Vessa', n:[
                  {l:'arcane glyph signature (Banite ward)', g:'green'},
                  {l:'feels magical hum, hair-on-arm', g:'green'},
                  {l:'identifies counter-spell window (DC 22)', g:'gold'},
                ]},
                {pc:'Aramil', n:[
                  {l:'(no profile yet)', g:'red'},
                ]},
              ].map(v => (
                <div key={v.pc} className="box">
                  <div className="box-title"><h3>{v.pc}</h3><span className="meta">visibility</span></div>
                  <div className="col" style={{gap: 4, fontSize: 13}}>
                    {v.n.map((x, i) => (
                      <div key={i} className="row" style={{gap: 6}}>
                        <span className={`dot ${x.g}`} /> <span>{x.l}</span>
                      </div>
                    ))}
                    <button className="btn sm" style={{marginTop: 8}}>＋ visibility line</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'preview' && (
            <div className="box" style={{padding: 18}}>
              <div className="tiny" style={{marginBottom: 6}}>HOW THIS LOOKS IN DM CONSOLE</div>
              <div className="hand ink" style={{fontSize: 22, marginBottom: 4}}>The Sunset Vault, Waterdeep</div>
              <p style={{margin: '4px 0', color:'var(--ink-2)', fontSize: 14}}>
                Dim torchlight. The party has just triggered the glyph ward. Two
                Zhentarim enforcers + a Banite priestess on the upper gallery.
              </p>
              <div className="row" style={{flexWrap:'wrap', gap: 6, marginTop: 8}}>
                <span className="chip">Indoors</span><span className="chip">Dim</span>
                <span className="chip red">Trap active</span><span className="chip blue">Stealth allowed</span>
                <span className="chip gold">Loot: 3 boxes</span>
              </div>
              <hr className="rule dashed" />
              <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-3)'}}>
                <span>3 contingencies armed</span><span>6 mutations queued</span><span>4 visibility gates</span>
              </div>
              <div className="row" style={{gap: 6, marginTop: 12}}>
                <button className="btn">save draft</button>
                <button className="btn primary">→ load into live session</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

