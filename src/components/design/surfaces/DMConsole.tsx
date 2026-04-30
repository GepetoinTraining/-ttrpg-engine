// @ts-nocheck
'use client'

import React from 'react'
// surfaces/DMConsole.jsx — DM Console with 3-view AI panel + tabbed logs

export default function DMConsole() {
  const [aiView, setAiView] = React.useState('orchestrator');
  const [logTab, setLogTab] = React.useState('session');

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">02 · Session HQ — live + prep</div>
          <h2>DM Console</h2>
        </div>
        <span className="who">DM laptop view</span>
      </div>

      {/* Top strip: scene + initiative + party HP */}
      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box" style={{gridColumn: 'span 2'}}>
          <div className="box-title">
            <h3>Current Scene</h3>
            <span className="meta">Arc 02 · Session 14 · Round 3</span>
          </div>
          <div style={{display:'flex', gap: 14}}>
            <div style={{flex:1}}>
              <div className="hand ink" style={{fontSize: 22, marginBottom: 4}}>The Sunset Vault, Waterdeep</div>
              <p style={{margin: '4px 0', color:'var(--ink-2)', fontSize: 14}}>
                Dim torchlight. The party has just triggered the glyph ward. Two
                Zhentarim enforcers + a Banite priestess on the upper gallery.
              </p>
              <div className="row" style={{flexWrap:'wrap', gap: 6, marginTop: 8}}>
                <span className="chip">Indoors</span>
                <span className="chip">Dim light</span>
                <span className="chip red">Trap active</span>
                <span className="chip blue">Stealth allowed</span>
                <span className="chip gold">Loot: 3 boxes unopened</span>
              </div>
            </div>
            <div style={{width: 200}}>
              <div className="tiny" style={{marginBottom: 4}}>WEATHER · TIME</div>
              <div className="stat"><b>21:42</b> Eleasis 17</div>
              <div className="stat">Overcast · light wind</div>
              <div className="stat" style={{marginTop:8}}><b>Moon:</b> waning gibbous</div>
              <div className="aside" style={{marginTop:10, fontSize: 16}}>
                ↳ Banite priestess casts at init 12
              </div>
            </div>
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Initiative</h3><span className="meta">round 3</span></div>
          <ol style={{margin: 0, padding: 0, listStyle: 'none', fontFamily: 'var(--mono)', fontSize: 12}}>
            <li style={{padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)', display:'flex', justifyContent:'space-between'}}>
              <span><b>21</b> · Kaelith <span className="muted">(rogue)</span></span><span className="chip blue sm">acted</span>
            </li>
            <li style={{padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)', display:'flex', justifyContent:'space-between', background:'var(--paper-2)'}}>
              <span><b>18</b> · <b>Banite Priestess</b></span><span className="chip red sm">→ now</span>
            </li>
            <li style={{padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)', display:'flex', justifyContent:'space-between'}}>
              <span><b>15</b> · Doruk</span><span></span>
            </li>
            <li style={{padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)', display:'flex', justifyContent:'space-between'}}>
              <span><b>14</b> · Enforcer A</span><span className="chip red sm">bloodied</span>
            </li>
            <li style={{padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)', display:'flex', justifyContent:'space-between'}}>
              <span><b>11</b> · Vessa</span><span></span>
            </li>
            <li style={{padding: '4px 0', display:'flex', justifyContent:'space-between'}}>
              <span><b>9</b>  · Enforcer B</span><span></span>
            </li>
          </ol>
        </div>
      </div>

      {/* AI Panel + side rail */}
      <div className="grid-3">
        <div style={{gridColumn: 'span 2'}}>
          <div className="ai-panel">
            <div className="ai-tabs">
              <div className={`ai-tab ${aiView==='orchestrator' ? 'active' : ''}`} onClick={() => setAiView('orchestrator')}>
                Orchestrator
                <span className="sub">DM ↔ AI · context</span>
              </div>
              <div className={`ai-tab ${aiView==='npc' ? 'active' : ''}`} onClick={() => setAiView('npc')}>
                NPC Voicebox
                <span className="sub">in-character · DM-piloted</span>
              </div>
              <div className={`ai-tab ${aiView==='whisper' ? 'active' : ''}`} onClick={() => setAiView('whisper')}>
                Whispers · Q&amp;A
                <span className="sub">private to one player</span>
              </div>
            </div>

            {aiView === 'orchestrator' && (
              <div className="ai-body">
                <div className="ai-msg dm">
                  <span className="who">DM</span>
                  <div className="body">Party just triggered the glyph. Brief them on what they sense. Keep it tight.</div>
                </div>
                <div className="ai-msg ai">
                  <span className="who">AI</span>
                  <div className="body">
                    Arcane sigil flares amber → low hum, hair-on-arm prickle. Kaelith
                    catches a glint above (Perception 17 saw the priestess earlier).
                    Doruk smells wax + iron.
                    <div style={{marginTop: 6, display:'flex', gap:6, flexWrap:'wrap'}}>
                      <span className="chip">use</span>
                      <span className="chip">edit</span>
                      <span className="chip">re-roll</span>
                    </div>
                  </div>
                </div>
                <div className="ai-msg dm">
                  <span className="who">DM</span>
                  <div className="body">Use it. Now — priestess opens with what?</div>
                </div>
                <div className="ai-msg ai">
                  <span className="who">AI · suggest</span>
                  <div className="body">
                    <em className="stage">[stat block: Banite Priestess · CL 7 · Inflict Serious Wounds prepped]</em>
                    Opens with <b>Hold Person</b> on Doruk (closest melee). Backup: Spiritual Weapon next round.
                  </div>
                </div>
              </div>
            )}

            {aiView === 'npc' && (
              <div className="ai-body">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 8, marginBottom: 4}}>
                  <div>
                    <div className="hand">currently voicing →</div>
                    <div style={{fontFamily:'var(--serif)', fontSize: 20, fontWeight:600}}>Selvys, the Banite priestess</div>
                    <div className="tiny">cold · zealous · speaks in clipped imperatives</div>
                  </div>
                  <div className="row" style={{gap:6}}>
                    <button className="btn sm">switch NPC</button>
                    <button className="btn sm danger">end voice</button>
                  </div>
                </div>
                <div className="ai-msg npc">
                  <span className="who">Selvys</span>
                  <div className="body">"Kneel, or be unmade. The Black Hand does not bargain with thieves."
                    <em className="stage">— eyes the rogue, raises pendant</em>
                  </div>
                </div>
                <div className="ai-msg dm">
                  <span className="who">DM (steer)</span>
                  <div className="body">she recognizes Kaelith specifically — they crossed in Mulmaster</div>
                </div>
                <div className="ai-msg npc">
                  <span className="who">Selvys</span>
                  <div className="body">"You. Mulmaster's little shadow. I told Lord Manshoon you would crawl back."</div>
                </div>
              </div>
            )}

            {aiView === 'whisper' && (
              <div className="ai-body">
                <div style={{display:'flex', gap: 6, flexWrap:'wrap', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 8}}>
                  <span className="chip blue solid" style={{background:'var(--accent-blue)', color:'var(--paper)', borderColor:'var(--accent-blue)'}}>Kaelith</span>
                  <span className="chip">Doruk</span>
                  <span className="chip">Vessa</span>
                  <span className="chip">Aramil</span>
                  <span className="hand blue" style={{marginLeft: 'auto'}}>private channel</span>
                </div>
                <div className="ai-msg player">
                  <span className="who">Kaelith</span>
                  <div className="body">do I recognize her holy symbol? my background is Mulmaster street kid</div>
                </div>
                <div className="ai-msg ai">
                  <span className="who">AI</span>
                  <div className="body">
                    Yes — Bane's black hand on a red field. Common in Mulmaster's
                    Tower of the Wyvern. You'd remember Selvys specifically: she
                    "questioned" your fence, Old Pell, three winters ago.
                    <div className="aside" style={{marginTop: 6}}>DM hasn't seen this yet — flag for review?</div>
                  </div>
                </div>
              </div>
            )}

            <div className="composer">
              <div className="input">{aiView === 'npc' ? 'steer Selvys… (or type her line)' : aiView === 'whisper' ? 'whisper to Kaelith…' : 'ask the AI to draft, lookup, or summarize…'}</div>
              <button className="btn">attach card</button>
              <button className="btn primary">send <span className="kbd">↵</span></button>
            </div>
          </div>
        </div>

        {/* Right rail: party HP + quick actions */}
        <div className="col">
          <div className="box">
            <div className="box-title"><h3>Party</h3><span className="meta">PCs</span></div>
            <div className="col" style={{gap: 8}}>
              {[
                {n:'Kaelith', c:'Rogue 7', hp:'34/52', cond:'—'},
                {n:'Doruk',   c:'Cleric 7', hp:'48/58', cond:'—'},
                {n:'Vessa',   c:'Wizard 7', hp:'29/41', cond:'concentrating'},
                {n:'Aramil',  c:'Fighter 7', hp:'12/64', cond:'bloodied'},
              ].map(p => (
                <div key={p.n} style={{borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 6}}>
                  <div style={{display:'flex', justifyContent:'space-between', fontFamily:'var(--serif)', fontSize: 14}}>
                    <span><b>{p.n}</b> <span className="muted" style={{fontSize: 12}}>· {p.c}</span></span>
                    <span className="stat">{p.hp}</span>
                  </div>
                  <div className="bar blue" style={{marginTop: 4}}><span style={{width: `${(parseInt(p.hp)/parseInt(p.hp.split('/')[1]))*100}%`}} /></div>
                  {p.cond !== '—' && <div className="tiny" style={{color:'var(--accent-red)', marginTop: 2}}>{p.cond}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="box dashed">
            <div className="box-title"><h3>Quick Actions</h3><span className="meta">DM-only</span></div>
            <div className="col" style={{gap: 6}}>
              <button className="btn">＋ apply damage / heal</button>
              <button className="btn">＋ add condition</button>
              <button className="btn">＋ secret roll</button>
              <button className="btn">＋ split off whisper</button>
              <button className="btn">＋ tick villain clock</button>
            </div>
          </div>

          <div className="box filled">
            <div className="box-title"><h3>On Deck</h3><span className="meta">prepared</span></div>
            <ul style={{margin:0, paddingLeft: 16, fontSize: 13}}>
              <li>Vault door riddle (if avoided)</li>
              <li>Manshoon scrying interlude</li>
              <li>Loot manifest · 3 chests</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="section-title">Tabbed logs · everything the AI has done</div>
      <div className="tabs">
        {[
          ['session', 'Session log'],
          ['npc', 'NPC log'],
          ['whisper', 'Whisper log'],
          ['rolls', 'Rolls'],
          ['villain', 'Villain ticks'],
        ].map(([k, lbl]) => (
          <div key={k} className={`tab ${logTab===k?'active':''}`} onClick={() => setLogTab(k)}>{lbl}</div>
        ))}
      </div>
      <div className="box" style={{borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0}}>
        {logTab === 'session' && (
          <div className="col" style={{gap: 6}}>
            <div className="stat"><b>21:38</b> · scene set: Sunset Vault</div>
            <div className="stat"><b>21:39</b> · Kaelith picked lock (DC 18, rolled 22)</div>
            <div className="stat"><b>21:41</b> · glyph triggered → combat init</div>
            <div className="stat"><b>21:42</b> · Banite Priestess revealed (formerly hidden)</div>
            <div className="stat"><b>21:43</b> · AI drafted scene-flare description, DM accepted</div>
          </div>
        )}
        {logTab === 'npc' && (
          <div className="col" style={{gap: 6}}>
            <div className="stat"><b>21:42</b> · voiced: <b>Selvys</b> · "Kneel, or be unmade…"</div>
            <div className="stat"><b>21:43</b> · DM steered: recognize Kaelith from Mulmaster</div>
            <div className="stat"><b>21:43</b> · voiced: <b>Selvys</b> · "Mulmaster's little shadow…"</div>
          </div>
        )}
        {logTab === 'whisper' && (
          <div className="col" style={{gap: 6}}>
            <div className="stat"><b>21:42</b> · <b>Kaelith</b> ↔ AI · holy symbol lookup [flagged for DM]</div>
            <div className="stat"><b>21:33</b> · <b>Doruk</b> ↔ AI · channel divinity rules check</div>
          </div>
        )}
        {logTab === 'rolls' && (
          <div className="col" style={{gap: 6}}>
            <div className="stat"><b>21:39</b> · Kaelith · Open Lock · d20+12 = <b>22</b> ✓</div>
            <div className="stat"><b>21:42</b> · Selvys · Hold Person DC 15 · Doruk save d20+5 = <b>9</b> ✗</div>
            <div className="stat"><b>21:42</b> · Aramil · attack vs Enf A · d20+9 = <b>24</b> hit, <b>11</b> dmg</div>
          </div>
        )}
        {logTab === 'villain' && (
          <div className="col" style={{gap: 6}}>
            <div className="stat"><b>Eleasis 12</b> · Zhentarim consolidates Daggerford warehouse → +1 influence</div>
            <div className="stat"><b>Eleasis 15</b> · Manshoon clock <b>4/8</b> · spies in Waterdeep</div>
            <div className="stat"><b>Eleasis 17</b> · party intercepts Sunset Vault asset → -1 Zhent influence Waterdeep</div>
          </div>
        )}
      </div>
    </div>
  );
}

