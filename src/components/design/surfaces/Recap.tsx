// @ts-nocheck
'use client'

import React from 'react'
import { loadTPB, type TPBList } from '@/lib/world'

// surfaces/Recap.tsx — Session recap / TPB timeline (engine/tpb.ts).
// Live data: /api/tpb/list reads tpb_entries (append-only, world-day keyed).

export default function Recap() {
  const [scope, setScope] = React.useState('session');
  const [filter, setFilter] = React.useState({mut:true, choice:true, roll:true, npc:true, scene:true});
  const [live, setLive] = React.useState<TPBList | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadTPB({ limit: 200 }).then(setLive).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">19 · TPB · timeline &amp; replay</div>
          <h2>Session Recap</h2>
        </div>
        <span className="who">DM · audit · time-travel debugging</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/tpb.ts records every <b>mutation</b>, <b>choice</b>, <b>roll</b>, <b>npc tick</b>, and <b>scene boundary</b>.
        scrub the timeline · jump to any point · branch a what-if · export recap to players.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live TPB log</h3>
          <span className="meta">→ /api/tpb/list · tpb_entries (append-only)</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && live.entries.length === 0 && (
          <div className="tiny muted">tpb_entries empty · clockwork ticks haven't fired yet</div>
        )}
        {live && live.entries.length > 0 && (
          <>
            <div className="row" style={{gap: 6, flexWrap:'wrap', fontSize: 12, marginBottom: 8}}>
              <span className="stat">{live.total} shown</span>
              {Object.entries(live.counts).map(([k, v]) => (
                <span key={k} className="chip sm">{k} · {v}</span>
              ))}
            </div>
            <div className="col" style={{gap: 4, maxHeight: 200, overflowY:'auto', fontFamily:'var(--mono)', fontSize: 11}}>
              {live.entries.slice(0, 50).map((e) => (
                <div key={e.id} className="row" style={{justifyContent:'space-between', padding:'2px 0', borderBottom:'1px dashed var(--rule-soft)'}}>
                  <span style={{flex: 1}}>day <b>{e.worldDay}</b> · {e.actionType}{e.targetId ? ` → ${e.targetId.slice(0,12)}…` : ''}</span>
                  <span className="muted">{e.timestamp ?? ''}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Scope + filter strip */}
      <div className="box" style={{marginBottom: 14}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <div className="row" style={{gap: 4}}>
            {['session','arc','campaign','last 24h','custom'].map(s => (
              <span key={s} className="chip sm" onClick={()=>setScope(s)}
                    style={{cursor:'pointer', background: scope===s?'var(--ink)':undefined, color: scope===s?'var(--paper)':undefined, borderColor: scope===s?'var(--ink)':undefined}}>
                {s}
              </span>
            ))}
          </div>
          <div className="row" style={{gap: 4, fontSize: 12}}>
            {Object.entries(filter).map(([k, v]) => (
              <label key={k} style={{display:'flex', alignItems:'center', gap: 4, cursor:'pointer'}}>
                <input type="checkbox" checked={v} onChange={e => setFilter({...filter, [k]: e.target.checked})} />
                <span>{k}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <div className="box dark" style={{marginBottom: 18}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginBottom: 8}}>
          <div>
            <div className="tiny" style={{color:'var(--paper-3)'}}>NOW</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 20, fontWeight: 600}}>Session 14 · Round 3 · 21:42</div>
          </div>
          <div className="row" style={{gap: 6}}>
            <button className="btn sm" style={{background:'var(--paper)', color:'var(--ink)'}}>⟲ rewind</button>
            <button className="btn sm" style={{background:'var(--paper)', color:'var(--ink)'}}>▶ replay</button>
            <button className="btn sm" style={{background:'var(--paper)', color:'var(--ink)'}}>⌥ branch</button>
            <button className="btn sm" style={{background:'var(--paper-2)', color:'var(--ink)'}}>↗ export</button>
          </div>
        </div>
        {/* Scrubber rail */}
        <div style={{position:'relative', height: 56, background: 'rgba(255,255,255,0.04)', border:'1px solid var(--ink-3)'}}>
          <div style={{position:'absolute', inset: 0, display: 'flex'}}>
            {Array.from({length: 80}).map((_, i) => (
              <div key={i} style={{flex: 1, borderRight: i % 8 === 7 ? '1px solid var(--paper-3)' : '1px solid rgba(255,255,255,0.06)'}} />
            ))}
          </div>
          {[
            {l:14, c:'red',   lbl:'glyph'},
            {l:22, c:'gold',  lbl:'lock'},
            {l:30, c:'red',   lbl:'combat'},
            {l:46, c:'blue',  lbl:'whisper'},
            {l:58, c:'red',   lbl:'priestess'},
            {l:74, c:'gold',  lbl:'NOW'},
          ].map((m, i) => (
            <div key={i} style={{position:'absolute', left: `${m.l}%`, top: 0, bottom: 0, width: 2, background:`var(--accent-${m.c})`}}>
              <div style={{position:'absolute', top: -2, left: -3, width: 8, height: 8, background:`var(--accent-${m.c})`, borderRadius:'50%'}} />
              <div className="tiny" style={{position:'absolute', bottom: -16, left: -10, color: 'var(--paper-3)', whiteSpace:'nowrap', fontFamily:'var(--mono)', fontSize: 9}}>{m.lbl}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{justifyContent:'space-between', marginTop: 22, fontFamily:'var(--mono)', fontSize: 10, color:'var(--paper-3)'}}>
          <span>20:00 session start</span>
          <span>21:00</span>
          <span>21:30</span>
          <span style={{color:'var(--accent-gold)'}}>21:42 · NOW</span>
        </div>
      </div>

      {/* Two-column: events + state-at-cursor */}
      <div className="row" style={{gap: 14, alignItems: 'flex-start'}}>
        <div className="col" style={{flex: 1, gap: 10}}>
          <div className="section-title" style={{margin: '4px 0 8px'}}>Event log · session 14</div>
          {[
            {t:'21:42', k:'mut',   c:'red',    txt:'κ.zhent.influence.waterdeep -= 6',                             src:'scene 04 mutation'},
            {t:'21:42', k:'roll',  c:'gold',   txt:'Selvys · Hold Person DC 15 · Doruk save d20+5 = 9 ✗',          src:'combat'},
            {t:'21:42', k:'npc',   c:'red',    txt:'Selvys voice: "Mulmaster\'s little shadow…"',                  src:'npc tick'},
            {t:'21:42', k:'choice',c:'blue',   txt:'DM steered Selvys → recognize Kaelith',                        src:'orchestrator'},
            {t:'21:41', k:'scene', c:'gold',   txt:'SCENE BOUNDARY · 03 → 04 (glyph trigger)',                     src:'mm-session'},
            {t:'21:41', k:'mut',   c:'red',    txt:'κ.waterdeep.sunset_vault.contested = true',                   src:'contingency-01'},
            {t:'21:39', k:'roll',  c:'green',  txt:'Kaelith · Open Lock · d20+12 = 22 ✓ (DC 18)',                  src:'skill'},
            {t:'21:38', k:'choice',c:'blue',   txt:'Party chose: enter via roof, not main door',                   txt2:'(branch point)', src:'pc decision'},
            {t:'21:35', k:'scene', c:'gold',   txt:'SCENE BOUNDARY · 02 → 03 (foyer)',                             src:'mm-session'},
            {t:'21:33', k:'choice',c:'blue',   txt:'Doruk asked AI: channel divinity rules check',                 src:'whisper'},
            {t:'21:30', k:'mut',   c:'red',    txt:'κ.party.heat.zhent += 4',                                       src:'reconnaissance'},
            {t:'21:28', k:'npc',   c:'red',    txt:'Hook Garven (offscreen): reports party movement to handler',    src:'world tick'},
          ].map((e, i) => (
            <div key={i} className="row" style={{gap: 12, padding:'8px 0', borderBottom: '1px dashed var(--rule-soft)', fontSize: 13, alignItems:'baseline'}}>
              <span style={{width: 56, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-3)'}}>{e.t}</span>
              <span className={`chip ${e.c} sm`} style={{width: 64, justifyContent:'center'}}>{e.k}</span>
              <span style={{flex: 1, fontFamily: e.k === 'mut' ? 'var(--mono)' : 'var(--serif)', fontSize: e.k === 'mut' ? 12 : 13}}>
                {e.txt}{e.txt2 && <span className="hand ink" style={{marginLeft: 8, fontSize: 16}}>{e.txt2}</span>}
              </span>
              <span className="tiny" style={{width: 140}}>{e.src}</span>
              <button className="btn sm">jump</button>
            </div>
          ))}
        </div>

        <div style={{width: 320}} className="col">
          <div className="box">
            <div className="box-title"><h3>State @ cursor</h3><span className="meta">21:42</span></div>
            <div className="col" style={{gap: 6, fontSize: 13}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>scene</span><b>arc02-vault-glyph-trigger</b></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>round</span><b>3</b></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>active turn</span><b>Selvys (18)</b></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Kaelith HP</span><b>34/52</b></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Aramil HP</span><b style={{color:'var(--accent-red)'}}>12/64</b></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>zhent infl. waterdeep</span><b>22</b></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>session minutes</span><b>1h 42m</b></div>
            </div>
          </div>
          <div className="box dashed">
            <div className="box-title"><h3>Branch point</h3><span className="meta">21:38</span></div>
            <p style={{fontSize: 13, color:'var(--ink-2)'}}>Party chose <b>roof entry</b>. Alt: <i>main door</i> would have triggered Banite ambush in foyer (scene 03b draft exists).</p>
            <button className="btn sm">⌥ what-if branch from here</button>
          </div>
          <div className="box">
            <div className="box-title"><h3>Player recap</h3><span className="meta">share-ready</span></div>
            <p style={{fontSize: 13, color:'var(--ink-2)'}}>auto-drafted highlight reel · spoiler-safe · 240 words</p>
            <div className="row" style={{gap: 6, marginTop: 6}}>
              <button className="btn sm">read</button>
              <button className="btn sm primary">send to party</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

