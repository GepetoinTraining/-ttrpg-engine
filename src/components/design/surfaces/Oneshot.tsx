// @ts-nocheck
'use client'

import React from 'react'
import Die from './Die'

// surfaces/Oneshot.jsx — Quick one-shot with Claude (BETA) · solo adventure

function DiceTray() {
  const dice = ['d20','d12','d10','d8','d6','d4'];
  const sides: Record<string, number> = {d4:4, d6:6, d8:8, d10:10, d12:12, d20:20};
  const [state, setState] = React.useState<Record<string, {value:number, rolling:boolean}>>(
    () => Object.fromEntries(dice.map(d=>[d,{value:1,rolling:false}]))
  );
  const roll = (d: string) => {
    if (state[d].rolling) return;
    const n = Math.floor(Math.random()*sides[d])+1;
    setState(s => ({...s, [d]: {value:n, rolling:true}}));
  };
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 4, padding: 4,
                 background:'rgba(58,42,28,0.06)', border:'1px dashed rgba(58,42,28,0.25)', borderRadius: 6}}>
      {dice.map(d => (
        <div key={d} onClick={() => roll(d)} title={`roll ${d}`}
             style={{cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', padding:'2px 0'}}>
          <Die type={d as any} value={state[d].value} size={62} rolling={state[d].rolling} durationMs={900}
               onRollEnd={() => setState(s => ({...s, [d]: {...s[d], rolling:false}}))} />
          <div className="tiny muted" style={{marginTop:-2, fontSize: 11}}>
            {d} {!state[d].rolling && state[d].value > 1 && <b style={{color:'var(--ink)'}}>· {state[d].value}</b>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Oneshot() {
  const [phase, setPhase] = React.useState('lobby'); // lobby | session | review

  if (phase === 'lobby') {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">10 · Solo · Beta</div>
            <h2>Quick one-shot with Claude</h2>
          </div>
          <span className="who">player-only · runs solo</span>
        </div>

        <div className="row" style={{gap: 6, marginBottom: 18}}>
          <span className="chip red">BETA</span>
          <span className="chip">single PC</span>
          <span className="chip">~30 min</span>
          <span className="chip blue">Claude narrates · you act</span>
          <span className="chip gold">canon merge optional</span>
        </div>

        <div className="grid-3">
          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="box-title"><h3>Pick a seed</h3><span className="meta">choose your hook</span></div>
            <div className="col" style={{gap: 10}}>
              {[
                {n:'A debt comes calling', t:'Old Pell needs a favor in Mulmaster · 2 scenes', tone:'personal'},
                {n:'Drinks at the Yawning Portal', t:'A drunk knight wants to confess. To you.', tone:'social · no combat'},
                {n:'The wrong rooftop', t:'Chase across Trades Ward. One mistake → guards.', tone:'pursuit · stealth'},
                {n:'Vessa\'s spire is leaking smoke', t:'Wizard problems. You are the only one nearby.', tone:'mystery'},
                {n:'Surprise me', t:'Claude pulls from your rumor pool + standing orders', tone:'wild card', primary: true},
              ].map(s => (
                <div key={s.n} className={`box ${s.primary?'':'soft'}`} style={{padding: '10px 14px', cursor:'pointer'}}
                     onClick={() => setPhase('session')}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontFamily:'var(--serif)', fontSize: 17, fontWeight: 600}}>{s.n}</div>
                      <div className="tiny muted" style={{marginTop: 2}}>{s.t}</div>
                    </div>
                    <span className={`chip sm ${s.primary?'solid':''}`}>{s.tone}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col">
            <div className="box">
              <div className="box-title"><h3>Your PC</h3><span className="meta">snapshot</span></div>
              <div style={{fontFamily:'var(--serif)', fontSize: 18, fontWeight: 600}}>Kaelith Vex</div>
              <div className="tiny">Half-elf · Rogue 7 · HP 34/52</div>
              <hr className="rule dashed" />
              <div className="tiny" style={{marginBottom: 4}}>STATE LOADED</div>
              <ul style={{margin:0, paddingLeft: 16, fontSize: 13}}>
                <li>Inventory · on-person only</li>
                <li>3 standing orders</li>
                <li>2 ally NPCs reachable</li>
              </ul>
            </div>
            <div className="box dashed">
              <div className="tiny">SAFEGUARDS</div>
              <div style={{fontSize: 13, marginTop: 4}}>Death disabled in beta. Failures still hurt — you may return wounded, broke, or holding a problem.</div>
            </div>
            <div className="box filled">
              <div className="tiny">CANON</div>
              <div style={{fontSize: 13, marginTop: 4}}>This runs in a <b>side-pocket</b>. At the end you can choose to merge events to canon (DM approves), or keep it private.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'session') {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">10 · Solo · session in progress</div>
            <h2>A debt comes calling</h2>
          </div>
          <div className="row" style={{gap: 6}}>
            <span className="chip">scene 1 of 2</span>
            <button className="btn sm" onClick={() => setPhase('lobby')}>pause</button>
            <button className="btn sm primary" onClick={() => setPhase('review')}>end →</button>
          </div>
        </div>

        <div className="grid-3" style={{gap: 18}}>
          {/* Narrative column */}
          <div className="col" style={{gridColumn:'span 2', gap: 14}}>
            <div className="box" style={{padding: '18px 22px'}}>
              <div className="ai-msg ai" style={{fontSize: 15}}>
                <span className="who">Narrator</span>
                <div className="body" style={{borderColor: 'var(--accent-blue)'}}>
                  <em className="stage">Mulmaster · midnight · the Tower of the Wyvern looms two streets over.</em>
                  Old Pell's note said the third door past the brazier. You count the doors. The third one
                  hangs slightly open. From inside: a man humming, off-key. Not Pell.
                </div>
              </div>
            </div>

            <div className="box">
              <div className="ai-msg player" style={{fontSize: 15}}>
                <span className="who">Kaelith</span>
                <div className="body">I press flat against the wall and listen. What's he humming? Anything I'd recognize from my street days?</div>
              </div>
            </div>

            <div className="box" style={{padding: '14px 18px'}}>
              <div className="ai-msg ai">
                <span className="who">Narrator</span>
                <div className="body" style={{borderColor: 'var(--accent-blue)'}}>
                  <em className="stage">[Listen check · d20+9 · INT mod context · WIS mod context]</em>
                  <div style={{display:'flex', alignItems:'center', gap:14, margin:'10px 0 6px'}}>
                    <Die type="d20" value={17} size={96} />
                    <div style={{fontSize: 15}}>
                      You roll <b style={{fontSize:18}}>17</b> <span className="muted">+ 9 = <b>26</b> · DC 18 ✓</span><br />
                      <span className="tiny muted">click to re-roll · INT-shifted by Brooch of Recall</span>
                    </div>
                  </div>
                  Yes — it's an old Mulmaster fish-gutter's tune. The kind only locals
                  know. Whoever this is, they're <i>from here</i>. Pell wasn't.
                  <div style={{marginTop: 8, display:'flex', gap: 6, flexWrap:'wrap'}}>
                    <span className="chip">push the door</span>
                    <span className="chip">circle the building</span>
                    <span className="chip">whistle the next bar of the tune</span>
                    <span className="chip blue">whisper a custom action…</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="composer">
              <div className="input">whistle the next bar — see if he answers in kind…</div>
              <button className="btn">roll d20</button>
              <button className="btn primary">send <span className="kbd">↵</span></button>
            </div>
          </div>

          {/* Side rail: dice + state + claude controls */}
          <div className="col">
            <div className="box">
              <div className="box-title"><h3>Quick dice</h3><span className="meta">your sheet</span></div>
              <DiceTray />
              <div className="tiny muted" style={{marginTop:6}}>click any die to roll · result feeds the narrator</div>
              <hr className="rule dashed" />
              <div className="tiny" style={{marginBottom: 4}}>FREQUENT</div>
              <div className="col" style={{gap: 4}}>
                <button className="btn sm">⚔ attack · +9 / +4</button>
                <button className="btn sm">🗡 sneak att · +4d6</button>
                <button className="btn sm">👁 listen · +9</button>
                <button className="btn sm">🪜 climb · +12</button>
              </div>
              <div className="aside" style={{marginTop: 10, fontSize: 16}}>
                ↳ last: Listen 17 ✓
              </div>
            </div>

            <div className="box">
              <div className="box-title"><h3>Live state</h3><span className="meta">this side-session</span></div>
              <div className="col" style={{gap: 6, fontSize: 13}}>
                <div className="row" style={{justifyContent:'space-between'}}><span>HP</span><span className="stat"><b>34</b>/52</span></div>
                <div className="bar blue"><span style={{width: '65%'}} /></div>
                <div className="row" style={{justifyContent:'space-between'}}><span>Stress</span><span className="stat"><b>2</b>/8</span></div>
                <div className="bar gold"><span style={{width: '25%'}} /></div>
                <div className="tiny muted" style={{marginTop: 6}}>used so far · 1 dagger thrown · 0gp spent</div>
              </div>
            </div>

            <div className="box dashed">
              <div className="tiny" style={{marginBottom: 6}}>CLAUDE CONTROLS</div>
              <div className="col" style={{gap: 4}}>
                <button className="btn sm">retell that</button>
                <button className="btn sm">make it harder</button>
                <button className="btn sm">remind me of state</button>
                <button className="btn sm">summarize so far</button>
                <button className="btn sm danger">step out · pause</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // review phase
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">10 · Solo · session ended</div>
          <h2>A debt comes calling — review</h2>
        </div>
        <span className="who">decide what becomes canon</span>
      </div>

      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="box-title"><h3>Recap</h3><span className="meta">Claude-drafted</span></div>
          <p style={{fontSize: 14, lineHeight: 1.55}}>
            Kaelith met "Briar," a Mulmaster local working off a Bane-debt for Pell.
            Briar passed Kaelith a sealed letter intended for Manshoon's Mulmaster
            archivist — Pell wanted Kaelith to read it, then deliver it. Kaelith
            broke the seal, copied the contents (a list of three Waterdeep names),
            re-sealed it, and delivered it as instructed. No combat. Walked out 0gp
            poorer, 1 critical name richer.
          </p>
          <div className="row" style={{gap: 6, marginTop: 10}}>
            <button className="btn sm">edit recap</button>
            <button className="btn sm">re-roll narrative voice</button>
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Outcome</h3><span className="meta">stats</span></div>
          <div className="col" style={{gap: 6, fontSize: 13}}>
            <div className="row" style={{justifyContent:'space-between'}}><span>HP after</span><span className="stat"><b>34</b>/52 · same</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>Stress after</span><span className="stat"><b>3</b>/8 · +1</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>Gold</span><span className="stat">±0</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>Time elapsed</span><span className="stat">~6 hrs</span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>XP</span><span className="stat">+150</span></div>
          </div>
        </div>
      </div>

      <div className="section-title">What to merge to canon · DM approves</div>
      <div className="grid-2">
        {[
          {n:'New rumor: Manshoon\'s 3 Waterdeep names', kind:'rumor', src:'cred · likely', merge: true, push: true},
          {n:'New ally: "Briar" (Mulmaster local · neutral)', kind:'ally NPC', src:'low-tier', merge: true, push: true},
          {n:'Stress +1 (Kaelith)', kind:'state', src:'mechanical', merge: true, push: false},
          {n:'XP +150 (Kaelith only)', kind:'state', src:'solo bonus halved', merge: true, push: false},
          {n:'Pell now owes Kaelith a counter-favor', kind:'relationship', src:'narrative', merge: false, push: false},
          {n:'A Bane-debt collector knows Kaelith\'s face', kind:'consequence · world', src:'narrative', merge: false, push: true},
        ].map((it, i) => (
          <div key={i} className="box">
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
              <div>
                <div style={{fontFamily:'var(--serif)', fontSize: 16, fontWeight: 600}}>{it.n}</div>
                <div className="tiny muted" style={{marginTop: 2}}>{it.kind} · {it.src}</div>
              </div>
              <div className="col" style={{alignItems:'flex-end', gap: 4}}>
                <label className="tiny" style={{display:'flex', alignItems:'center', gap: 4}}>
                  <input type="checkbox" defaultChecked={it.merge} /> merge
                </label>
                {it.push && <label className="tiny" style={{display:'flex', alignItems:'center', gap: 4}}>
                  <input type="checkbox" defaultChecked={false} /> notify DM now
                </label>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{gap: 8, marginTop: 22, justifyContent:'flex-end'}}>
        <button className="btn" onClick={() => setPhase('lobby')}>discard side-session</button>
        <button className="btn">save private (no merge)</button>
        <button className="btn primary">submit to DM →</button>
      </div>
    </div>
  );
}

