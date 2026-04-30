// @ts-nocheck
'use client'

import React from 'react'
import Die from './Die'

// surfaces/InlineCards.jsx — interactive chat card primitives
// These render INSIDE .ai-msg .body. Each is a small move the recipient takes.

function Choice({label, k, cost, color, selected, onClick, disabled}: any) {
  return (
    <span className={`choice ${color||''} ${selected?'selected':''} ${disabled?'disabled':''}`}
          onClick={disabled?null:onClick}>
      {k && <span className="key">{k}</span>}
      <span>{label}</span>
      {cost && <span className="cost">{cost}</span>}
    </span>
  );
}

// AI-asks-DM: pick which suggestion to use
export function CardChoosePath({title, prompt, options, footer, defaultSelected}: any) {
  const [sel, setSel] = React.useState(defaultSelected ?? null);
  return (
    <div className="inline-card from-ai">
      <div className="ic-head">
        <h5>{title}</h5>
        <span className="ic-kind">AI · pick one</span>
      </div>
      {prompt && <div className="ic-prompt">{prompt}</div>}
      <div className="choice-row">
        {options.map((o, i) => (
          <Choice key={o.label} label={o.label} k={String.fromCharCode(65+i)}
                  cost={o.cost} color={o.color}
                  selected={sel===i} onClick={() => setSel(i)} />
        ))}
      </div>
      <div className="ic-footer">
        <span>{footer || 'AI will continue with the chosen path'}</span>
        <span className="spacer" />
        <button className="btn sm">edit</button>
        <button className="btn sm primary">commit ↵</button>
      </div>
    </div>
  );
}

// DM-asks-player: gives them buttons to pick from in a whisper
export function CardPlayerChoice({title, prompt, options}: any) {
  const [sel, setSel] = React.useState(null);
  return (
    <div className="inline-card from-dm solid-dm">
      <div className="ic-head">
        <h5>{title}</h5>
        <span className="ic-kind">DM → you · choose</span>
      </div>
      {prompt && <div className="ic-prompt">{prompt}</div>}
      <div className="choice-row">
        {options.map((o, i) => (
          <Choice key={o.label} label={o.label} k={String.fromCharCode(65+i)}
                  color={o.color} cost={o.cost}
                  selected={sel===i} onClick={() => setSel(i)} />
        ))}
      </div>
      <div className="ic-footer">
        <span className="muted">your reply is private to the DM</span>
        <span className="spacer" />
        <button className="btn sm" disabled={sel===null} style={sel===null?{opacity:0.4}:{}}>send →</button>
      </div>
    </div>
  );
}

// Inline dice prompt — AI suggests a roll, recipient clicks the real 3D die to roll
export function CardDicePrompt({label, formula, dc, mods, autoRoll, mod = 9, type = 'd20'}: any) {
  const sides = {d4:4, d6:6, d8:8, d10:10, d12:12, d20:20}[type] || 20;
  const [rolled, setRolled] = React.useState(autoRoll ? Math.floor(Math.random()*sides)+1 : null);
  const [rolling, setRolling] = React.useState(false);
  const [value, setValue] = React.useState(autoRoll ? (rolled ?? 1) : 1);
  const doRoll = () => {
    if (rolling) return;
    const n = Math.floor(Math.random()*sides)+1;
    setValue(n);
    setRolling(true);
    setTimeout(() => setRolled(n), 0);
  };
  return (
    <div className="inline-card from-ai dashed">
      <div className="ic-head">
        <h5>{label}</h5>
        <span className="ic-kind">roll · click die</span>
      </div>
      <div className="dice-prompt" style={{alignItems:'center'}}>
        <div onClick={doRoll} style={{cursor:'pointer', marginRight: 4}} title="click to roll">
          <Die type={type} value={value} size={86} rolling={rolling} durationMs={1200}
               onRollEnd={() => setRolling(false)} />
        </div>
        <div className="formula">{formula}</div>
        {dc && <div className="dc">DC {dc}</div>}
      </div>
      {mods && <div className="ic-meta">{mods}</div>}
      {rolled !== null && !rolling && (
        <div className="ic-meta" style={{color: rolled + mod >= (dc||0) ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: 4}}>
          rolled <b>{rolled}</b> + {mod} = <b>{rolled+mod}</b> {dc && (rolled+mod >= dc ? '✓ pass' : '✗ fail')}
        </div>
      )}
    </div>
  );
}

// Multi-select whisper — player ticks several, sends in one packet
export function CardMultiSelect({title, prompt, options, max}: any) {
  const [picked, setPicked] = React.useState(new Set());
  const toggle = (i) => {
    const n = new Set(picked);
    if (n.has(i)) n.delete(i); else if (n.size < (max||999)) n.add(i);
    setPicked(n);
  };
  return (
    <div className="inline-card from-player">
      <div className="ic-head">
        <h5>{title}</h5>
        <span className="ic-kind">you · pick up to {max||options.length}</span>
      </div>
      {prompt && <div className="ic-prompt">{prompt}</div>}
      <div className="pill-multi">
        {options.map((o, i) => (
          <label key={o}>
            <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
            {o}
          </label>
        ))}
      </div>
      <div className="ic-footer">
        <span className="muted">{picked.size} selected</span>
        <span className="spacer" />
        <button className="btn sm">cancel</button>
        <button className="btn sm primary">whisper to AI →</button>
      </div>
    </div>
  );
}

// Group poll — sent to all 4 players, votes accumulate
export function CardGroupPoll({title, prompt, options, votes}: any) {
  const total = options.reduce((s, _, i) => s + (votes[i]?.length||0), 0);
  return (
    <div className="inline-card from-dm">
      <div className="ic-head">
        <h5>{title}</h5>
        <span className="ic-kind">DM → group · poll</span>
      </div>
      {prompt && <div className="ic-prompt">{prompt}</div>}
      {options.map((o, i) => {
        const v = votes[i]||[];
        const pct = total ? (v.length/total)*100 : 0;
        return (
          <div key={o} className="poll-row">
            <span>{o}</span>
            <div className="poll-bar"><span style={{width: `${pct}%`}} /></div>
            <span className="stat">{v.length}</span>
          </div>
        );
      })}
      <div className="ic-meta" style={{marginTop: 8}}>
        votes: {options.map((o,i) => votes[i]?.length ? `${o.toLowerCase()} (${votes[i].join(', ')})` : null).filter(Boolean).join(' · ')}
      </div>
      <div className="ic-footer">
        <span>3 of 4 voted · waiting on Aramil</span>
        <span className="spacer" />
        <button className="btn sm">close early</button>
      </div>
    </div>
  );
}

// NPC offer card — Selvys offers a deal
export function CardNPCOffer({npc, voice, terms, options}: any) {
  const [sel, setSel] = React.useState(null);
  return (
    <div className="inline-card from-ai" style={{borderLeft: '3px solid var(--accent-red)'}}>
      <div className="ic-head">
        <h5 style={{color:'var(--accent-red)'}}>{npc} offers a deal</h5>
        <span className="ic-kind">NPC · interactive</span>
      </div>
      <div className="ic-prompt" style={{fontStyle:'italic', color:'var(--ink-2)', borderLeft:'2px solid var(--rule-soft)', paddingLeft:8}}>
        "{voice}"
      </div>
      <div className="ic-meta" style={{margin:'8px 0'}}>TERMS · {terms}</div>
      <div className="choice-row">
        {options.map((o, i) => (
          <Choice key={o.label} label={o.label} k={String.fromCharCode(65+i)}
                  color={o.color} cost={o.cost}
                  selected={sel===i} onClick={() => setSel(i)} />
        ))}
      </div>
      <div className="ic-footer">
        <span className="muted">Selvys reads your face. Take your time.</span>
        <span className="spacer" />
        <button className="btn sm">stall</button>
        <button className="btn sm primary" disabled={sel===null} style={sel===null?{opacity:0.4}:{}}>respond ↵</button>
      </div>
    </div>
  );
}

// Demo strip surface — shows all card types side by side
export function InlineCardsDemo() {
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">11 · Chat primitives</div>
          <h2>Inline cards in chat</h2>
        </div>
        <span className="who">buttons in messages · the good stuff</span>
      </div>

      <div className="aside" style={{maxWidth:760, marginBottom: 18}}>
        ↳ chats can carry interactive moves: choices, dice, multi-selects, polls,
        NPC offers. each card lives <i>inside</i> a message bubble. recipient clicks,
        result feeds back into context. AI, DM, or players can send these.
      </div>

      <div className="grid-2" style={{gap: 18}}>
        {/* AI → DM in Orchestrator */}
        <div>
          <div className="section-title" style={{marginTop:0}}>AI → DM · Orchestrator</div>
          <div className="ai-panel" style={{height: 'auto'}}>
            <div className="ai-body" style={{padding: 16}}>
              <div className="ai-msg dm">
                <span className="who">DM</span>
                <div className="body">priestess opens combat with what?</div>
              </div>
              <div className="ai-msg ai">
                <span className="who">AI</span>
                <div className="body">
                  Three plausible openers given her sheet + position:
                  <CardChoosePath
                    title="Selvys · opening move"
                    prompt="Hold Person hits hardest but burns her best slot. Channel Negative is a cone hitting 2 PCs. Buff defends but cedes tempo."
                    defaultSelected={0}
                    options={[
                      {label: 'Hold Person → Doruk', cost: '5th lvl slot', color: 'danger'},
                      {label: 'Channel Negative · cone', cost: '2× PCs hit', color: 'gold'},
                      {label: 'Spiritual Weapon + back up', cost: 'defensive', color: ''},
                    ]}
                    footer="commit feeds the round forward"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DM → Player whisper */}
        <div>
          <div className="section-title" style={{marginTop:0}}>DM → Player · whisper</div>
          <div className="ai-panel" style={{height: 'auto'}}>
            <div className="ai-body" style={{padding: 16}}>
              <div className="ai-msg dm">
                <span className="who">DM (whisper)</span>
                <div className="body">
                  hey, since this is your origin city — gut check —
                  <CardPlayerChoice
                    title="You see Selvys for the first time"
                    prompt="What does Kaelith feel? (this colors your roll bonus + flavors what AI narrates next.)"
                    options={[
                      {label: 'recognition · cold', cost: '+2 Sense Motive'},
                      {label: 'fear · freeze', cost: '−2 init', color: 'danger'},
                      {label: 'rage · charge', cost: '+1 attack', color: 'gold'},
                      {label: 'something else…', color: ''},
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI → Player dice prompt */}
        <div>
          <div className="section-title" style={{marginTop:0}}>AI → Player · roll prompt</div>
          <div className="ai-panel" style={{height: 'auto'}}>
            <div className="ai-body" style={{padding: 16}}>
              <div className="ai-msg ai">
                <span className="who">Narrator</span>
                <div className="body">
                  You climb the gallery rope.
                  <CardDicePrompt
                    label="Climb · slick stone"
                    formula="d20 + 9 (climb) + 2 (Boots) = ?"
                    dc={15}
                    mods="WIS unaffected · DEX-shifted by Studded"
                    autoRoll={false}
                  />
                  click the die when you're ready.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Player → AI multi-select whisper */}
        <div>
          <div className="section-title" style={{marginTop:0}}>Player → AI · whisper packet</div>
          <div className="ai-panel" style={{height: 'auto'}}>
            <div className="ai-body" style={{padding: 16}}>
              <div className="ai-msg player">
                <span className="who">Kaelith</span>
                <div className="body">
                  before I commit to the gallery, what would I notice?
                  <CardMultiSelect
                    title="Auto-pull from sheet · what to lean on"
                    prompt="check up to 3 — AI uses these to bias what it surfaces"
                    max={3}
                    options={['Mulmaster background','Trapfinding','Streetwise','Sense Motive (Selvys)','Languages (Banite)','Boots of Elvenkind','Sneak attack window']}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DM → Group poll */}
        <div>
          <div className="section-title" style={{marginTop:0}}>DM → Group · poll</div>
          <div className="ai-panel" style={{height: 'auto'}}>
            <div className="ai-body" style={{padding: 16}}>
              <div className="ai-msg dm">
                <span className="who">DM</span>
                <div className="body">
                  before we end session — quick poll for next time:
                  <CardGroupPoll
                    title="Where do we open next session?"
                    prompt="binding · 3 of 4 needed · live results"
                    options={['Vault interior · keep momentum','Safehouse · debrief + downtime','Pell\'s shop · followup on letter','Time-skip 1 week']}
                    votes={[['Doruk','Vessa'],[],['Kaelith'],[]]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NPC offer card */}
        <div>
          <div className="section-title" style={{marginTop:0}}>NPC → Player · offer</div>
          <div className="ai-panel" style={{height: 'auto'}}>
            <div className="ai-body" style={{padding: 16}}>
              <div className="ai-msg npc">
                <span className="who">Selvys</span>
                <div className="body">
                  <CardNPCOffer
                    npc="Selvys"
                    voice="Spare me, and I give you the names. Three Lords on Manshoon's payroll. You walk out richer than you came in."
                    terms="release Selvys (alive, unbound) · she gives 3 names · she goes free, will resurface"
                    options={[
                      {label: 'accept', color: 'gold'},
                      {label: 'counter — names + truth-spell', color: ''},
                      {label: 'refuse · take her in', color: 'danger'},
                      {label: 'stall · check with party', color: ''},
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Where these show up */}
      <div className="section-title">Where these appear</div>
      <div className="grid-4">
        {[
          {n:'Orchestrator', d:'AI proposes paths · DM commits one'},
          {n:'NPC Voicebox', d:'NPC offers · DM steers options'},
          {n:'Whispers', d:'DM → 1 player · player → AI multi-select'},
          {n:'Group chat', d:'DM polls · binding 3/4 votes'},
          {n:'Solo with Claude', d:'every action chip = a card'},
          {n:'Async ally chat', d:'Old Pell offers a favor as terms'},
          {n:'Downtime resolution', d:'AI asks DM: "approve outcome?"'},
          {n:'Rumor sharing', d:'leak to player as a yes/no card'},
        ].map(s => (
          <div key={s.n} className="box soft">
            <div style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{s.n}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.d}</div>
          </div>
        ))}
      </div>

      <div className="aside blue" style={{marginTop: 22}}>
        ↳ key idea: every card is also <b>state</b>. Once committed, it logs to the
        right tab automatically. Decisions become a permanent record without anyone
        having to type a summary.
      </div>
    </div>
  );
}

