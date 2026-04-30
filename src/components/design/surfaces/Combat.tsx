// @ts-nocheck
'use client'

import React from 'react'
import Die from './Die'
import { rollDice } from '@/lib/dice'

// surfaces/Combat.tsx — Combat Runner: tactical grid + side panel + card-pile resolution.
// Static design layout; the LiveRollWidget at the top is wired through to engine/mf-dice.ts
// (deterministic d20 + receipt) and persists each roll as a dice_receipts row.

export default function Combat() {
  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">15 · Combat Runner — encounter live</div>
          <h2>Sunset Vault · upper gallery</h2>
        </div>
        <span className="who">round 3 · Selvys's turn ↘</span>
      </div>

      <p style={{maxWidth: 740, color:'var(--ink-2)', marginTop: 0}}>
        Engine map: <span className="kbd">engine/mm-scene.ts</span> — <span className="kbd">executeRound</span>,
        <span className="kbd">mmCombatAttack</span>, concentration, reactions. Players roll on their sheets;
        the runner accepts each roll as a <b>card</b>, queues it, resolves it, and drops it onto the round's
        resolved pile. The DM watches and confirms outliers.
      </p>

      {/* engine reach test — wired to /api/sim/roll → mfDice → dice_receipts */}
      <LiveRollWidget />

      {/* top strip: round + budget + party HP shorthand */}
      <CombatTopStrip />

      {/* main grid: tactical board (2 cols) + side panel */}
      <div className="grid-3" style={{gap: 18, marginTop: 18}}>
        <TacticalBoard />
        <CombatSidePanel />
      </div>

      {/* card piles */}
      <div className="section-title">Round 3 · cards in flight</div>
      <CardPiles />

      {/* round controls */}
      <div className="row" style={{justifyContent:'space-between', marginTop: 18, padding: '12px 16px',
                                    border: '1px solid var(--rule)', background: 'var(--paper-2)'}}>
        <div className="row" style={{gap: 14, alignItems:'center'}}>
          <span className="stat"><b>round 3</b> · 4 actors acted · 2 to go</span>
          <span className="chip red">Selvys: now</span>
        </div>
        <div className="row" style={{gap: 6}}>
          <button className="btn sm">undo last</button>
          <button className="btn sm">pause</button>
          <button className="btn sm">DM secret roll</button>
          <button className="btn primary">advance turn →</button>
          <button className="btn">end round ↻</button>
        </div>
      </div>
    </div>
  );
}

function CombatTopStrip() {
  return (
    <div className="grid-3" style={{gap: 14, marginTop: 18}}>
      {/* initiative ladder */}
      <div className="box" style={{padding: 0}}>
        <div className="box-title" style={{padding:'10px 12px', margin: 0, borderBottom:'1px solid var(--rule)'}}>
          <h3>Initiative</h3><span className="meta">round 3 of ?</span>
        </div>
        <ol style={{margin: 0, padding: 0, listStyle:'none', fontFamily:'var(--mono)', fontSize: 12}}>
          {[
            {i: 21, n:'Kaelith', t:'rogue', s:'acted'},
            {i: 18, n:'Selvys (Banite)', t:'NPC', s:'now', cur: true, red: true},
            {i: 15, n:'Doruk',  t:'cleric', s:'pending'},
            {i: 14, n:'Enforcer A', t:'NPC', s:'bloodied', red: true},
            {i: 11, n:'Vessa', t:'wizard', s:'concentrating', conc: true},
            {i:  9, n:'Enforcer B', t:'NPC', s:'pending', red: true},
          ].map(a => (
            <li key={a.n} style={{padding:'7px 12px',
                                  display:'flex', justifyContent:'space-between',
                                  borderBottom:'1px dashed var(--rule-soft)',
                                  background: a.cur ? 'var(--paper-3)' : 'transparent',
                                  borderLeft: a.red ? '3px solid var(--accent-red)' : (a.conc ? '3px solid var(--accent-blue)' : '3px solid transparent')}}>
              <span><b>{a.i}</b> · {a.n} <span className="muted" style={{fontSize: 10}}>· {a.t}</span></span>
              <span className={`chip ${a.s==='now'?'red':a.s==='bloodied'?'red':a.s==='concentrating'?'blue':''} sm`} style={{fontSize: 9}}>{a.s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* current actor: action budget */}
      <div className="box">
        <div className="box-title">
          <h3>Selvys · this turn</h3>
          <span className="meta">DM-piloted · AI suggests</span>
        </div>
        <div className="row" style={{gap: 6, flexWrap:'wrap'}}>
          <span className="chip green sm">action · spent (Hold Person)</span>
          <span className="chip green sm">bonus · spent (Spiritual Wpn)</span>
          <span className="chip sm">reaction · open</span>
          <span className="chip sm">move · 0 / 30</span>
        </div>
        <div className="aside" style={{marginTop: 10, fontSize: 16}}>
          ↳ AI: she'd save reaction for Counterspell on Vessa
        </div>
        <div className="row" style={{gap: 6, marginTop: 6}}>
          <button className="btn sm">use reaction</button>
          <button className="btn sm">end Selvys's turn</button>
        </div>
      </div>

      {/* party HP shorthand */}
      <div className="box">
        <div className="box-title"><h3>Party HP</h3><span className="meta">live</span></div>
        <div className="col" style={{gap: 4}}>
          {[
            {n:'Kaelith', hp:'34/52', c:'',           cond:''},
            {n:'Doruk',   hp:'48/58', c:'',           cond:''},
            {n:'Vessa',   hp:'29/41', c:'concentrating · Bless', conc:true},
            {n:'Aramil',  hp:'12/64', c:'bloodied',   bld:true},
          ].map(p => {
            const [cur, max] = p.hp.split('/').map(Number);
            return (
              <div key={p.n} style={{borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 4}}>
                <div style={{display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize: 12}}>
                  <span>{p.n}</span>
                  <span className="stat">{p.hp}</span>
                </div>
                <div className="bar blue"><span style={{width: `${(cur/max)*100}%`, background: p.bld?'var(--accent-red)':'var(--accent-blue)'}} /></div>
                {p.c && <div className="tiny" style={{color: p.bld?'var(--accent-red)':p.conc?'var(--accent-blue)':'var(--ink-3)', marginTop: 2}}>{p.c}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TacticalBoard() {
  // 16x10 top-down grid. Tokens as positioned absolute over the grid.
  const cols = 16;
  const rows = 10;
  const tokens = [
    {x: 2,  y: 6, n:'Ka', who:'Kaelith', col:'blue'},
    {x: 4,  y: 7, n:'Do', who:'Doruk',  col:'blue'},
    {x: 3,  y: 5, n:'Ve', who:'Vessa',  col:'blue'},
    {x: 5,  y: 8, n:'Ar', who:'Aramil', col:'blue', bld: true},
    {x: 11, y: 3, n:'Sv', who:'Selvys', col:'red', cur: true},
    {x: 9,  y: 5, n:'E1', who:'Enforcer A', col:'red', bld: true},
    {x: 12, y: 7, n:'E2', who:'Enforcer B', col:'red'},
    {x: 14, y: 4, n:'$',  who:'Loot · 3 chests', col:'gold'},
  ];
  // Areas of effect
  const aoes = [
    {x: 9, y: 5, r: 1.5, label: 'Hold Person · Doruk', color: 'rgba(168,68,42,0.18)'},
    {x: 3, y: 5, r: 1.2, label: 'Bless (V)', color: 'rgba(58,93,122,0.16)'},
  ];
  return (
    <div style={{gridColumn:'span 2'}}>
      <div className="box" style={{padding: 8, position:'relative'}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginBottom: 6}}>
          <div className="row" style={{gap: 8}}>
            <span className="hand ink" style={{fontSize: 18}}>upper gallery · 80×50ft</span>
            <span className="chip sm">dim light</span>
            <span className="chip sm">cover · pillars</span>
          </div>
          <div className="row" style={{gap: 6}}>
            <button className="btn sm">grid · 5ft</button>
            <button className="btn sm">measure</button>
            <button className="btn sm">draw AOE</button>
            <button className="btn sm">reveal fog</button>
          </div>
        </div>

        <div style={{position:'relative', aspectRatio:'16/10', border:'1px solid var(--rule)',
                     background:`
                        repeating-linear-gradient(0deg, transparent 0 calc(100%/${rows} - 1px), rgba(31,27,22,0.10) calc(100%/${rows} - 1px) calc(100%/${rows})),
                        repeating-linear-gradient(90deg, transparent 0 calc(100%/${cols} - 1px), rgba(31,27,22,0.10) calc(100%/${cols} - 1px) calc(100%/${cols})),
                        var(--paper-2)`,
                     overflow:'hidden'}}>
          {/* terrain / pillars / walls */}
          <div style={{position:'absolute', left:`${6/cols*100}%`, top:`${4/rows*100}%`,
                       width:`${1/cols*100}%`, height:`${2/rows*100}%`,
                       background:'rgba(31,27,22,0.55)'}} title="pillar" />
          <div style={{position:'absolute', left:`${10/cols*100}%`, top:`${1/rows*100}%`,
                       width:`${1/cols*100}%`, height:`${2/rows*100}%`,
                       background:'rgba(31,27,22,0.55)'}} title="pillar" />
          <div style={{position:'absolute', left:`${13/cols*100}%`, top:`${5/rows*100}%`,
                       width:`${1/cols*100}%`, height:`${3/rows*100}%`,
                       background:'rgba(31,27,22,0.55)'}} title="pillar" />
          <div style={{position:'absolute', inset:`${8/rows*100}% 0 0 0`,
                       borderTop:'2px solid var(--ink)', opacity: 0.4}} title="balcony rail" />

          {/* AOEs */}
          {aoes.map((a, i) => (
            <div key={i} style={{position:'absolute',
                                 left:`${(a.x - a.r) /cols*100}%`,
                                 top: `${(a.y - a.r) /rows*100}%`,
                                 width:`${(a.r*2)/cols*100}%`,
                                 height:`${(a.r*2)/rows*100}%`,
                                 borderRadius: '50%',
                                 background: a.color,
                                 border:'1px dashed rgba(31,27,22,0.4)'}}>
              <div className="tiny" style={{position:'absolute', bottom: -16, left: 0, whiteSpace:'nowrap', background:'var(--paper)', padding:'1px 4px', border:'1px solid var(--rule-soft)'}}>{a.label}</div>
            </div>
          ))}

          {/* tokens */}
          {tokens.map(t => (
            <div key={t.who} style={{position:'absolute',
                                     left:`${(t.x + 0.5)/cols*100}%`,
                                     top: `${(t.y + 0.5)/rows*100}%`,
                                     transform:'translate(-50%, -50%)',
                                     width: 32, height: 32,
                                     borderRadius: '50%',
                                     border: t.cur ? '2px solid var(--ink)' : '1.5px solid var(--ink)',
                                     background: t.col === 'blue' ? 'var(--accent-blue)' :
                                                 t.col === 'red'  ? 'var(--accent-red)'  :
                                                 t.col === 'gold' ? 'var(--accent-gold)' : 'var(--paper)',
                                     color:'var(--paper)',
                                     boxShadow: t.cur ? '0 0 0 4px rgba(31,27,22,0.18)' : 'none',
                                     display:'flex', alignItems:'center', justifyContent:'center',
                                     fontFamily:'var(--mono)', fontSize: 11, fontWeight: 600,
                                     cursor:'pointer'}}
                 title={t.who}>
              {t.n}
              {t.bld && <div style={{position:'absolute', top:-4, right:-4, width: 10, height: 10, borderRadius:'50%', background:'var(--accent-red)', border:'1px solid var(--paper)'}} />}
              <div className="tiny" style={{position:'absolute', top: 32, left:'50%', transform:'translateX(-50%)',
                                            background:'var(--paper)', padding:'0 4px', border:'1px solid var(--rule-soft)',
                                            whiteSpace:'nowrap'}}>{t.who.split(' ')[0]}</div>
            </div>
          ))}

          {/* movement trail · current actor */}
          <svg style={{position:'absolute', inset: 0, width:'100%', height:'100%', pointerEvents:'none'}}>
            <defs>
              <marker id="arrCombat" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="rgba(168,68,42,0.7)" />
              </marker>
            </defs>
            <path d={`M ${(13.5)/cols*100}%,${(2.5)/rows*100}% Q ${(12)/cols*100}%,${(2)/rows*100}% ${(11.5)/cols*100}%,${(3.5)/rows*100}%`}
                  stroke="rgba(168,68,42,0.7)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" markerEnd="url(#arrCombat)" />
          </svg>

          {/* hand annotation */}
          <div className="hand" style={{position:'absolute', top: 6, right: 12, fontSize: 16, transform:'rotate(-1.5deg)'}}>
            Selvys moved 10ft last round ↘
          </div>
        </div>

        <div className="row" style={{justifyContent:'space-between', marginTop: 8, fontSize: 12, fontFamily:'var(--mono)'}}>
          <div className="row" style={{gap: 12}}>
            <span><span className="dot blue" /> party</span>
            <span><span className="dot red" /> hostile</span>
            <span><span className="dot gold" /> objective</span>
            <span className="muted">red ring · bloodied</span>
          </div>
          <div className="muted">click token · sheet · drag to move · shift+drag to measure</div>
        </div>
      </div>
    </div>
  );
}

function CombatSidePanel() {
  return (
    <div className="col">
      {/* selected token */}
      <div className="box">
        <div className="box-title">
          <h3>Selvys, Banite Priestess</h3>
          <span className="meta">selected</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 6, fontFamily:'var(--mono)', fontSize: 11}}>
          <div><span className="muted">CR</span> <b>5</b></div>
          <div><span className="muted">AC</span> <b>16</b></div>
          <div><span className="muted">HP</span> <b>52/66</b></div>
          <div><span className="muted">Spd</span> <b>30</b></div>
          <div><span className="muted">DC</span> <b>15</b></div>
          <div><span className="muted">Atk</span> <b>+7</b></div>
        </div>
        <div className="bar red" style={{marginTop: 8}}><span style={{width: '79%'}} /></div>
        <div className="row" style={{gap: 6, marginTop: 8}}>
          <button className="btn sm">−dmg</button>
          <button className="btn sm">+heal</button>
          <button className="btn sm">condition</button>
          <button className="btn sm">stat block ↗</button>
        </div>
        <div className="aside blue" style={{marginTop: 10, fontSize: 16}}>
          ↳ concentration: Hold Person on Doruk · DC 13 con if hit
        </div>
      </div>

      {/* AI tactic suggestions */}
      <div className="box dashed">
        <div className="box-title"><h3>AI · monster tactics</h3><span className="meta">advisory</span></div>
        <div className="col" style={{gap: 6}}>
          <div className="box" style={{padding: 8}}>
            <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: 600}}>Hold Doruk · push Aramil</div>
            <div className="tiny muted" style={{marginTop: 2}}>locks the cleric · finishes the bloodied tank · 3-round close</div>
          </div>
          <div className="box soft" style={{padding: 8}}>
            <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: 600}}>Inflict on Vessa</div>
            <div className="tiny muted" style={{marginTop: 2}}>break concentration · big risk if she saves</div>
          </div>
          <div className="box soft" style={{padding: 8}}>
            <div style={{fontFamily:'var(--serif)', fontSize: 14, fontWeight: 600}}>Retreat · Spirit Guardians up</div>
            <div className="tiny muted" style={{marginTop: 2}}>survive · let Enforcers grind</div>
          </div>
        </div>
        <div className="row" style={{gap: 6, marginTop: 8}}>
          <button className="btn sm primary">queue chosen →</button>
          <button className="btn sm">show why</button>
        </div>
      </div>

      {/* reaction watch */}
      <div className="box">
        <div className="box-title"><h3>Reaction watch</h3><span className="meta">interrupts</span></div>
        <div className="col" style={{gap: 6}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 6}}>
            <div>
              <b>Kaelith</b> · Uncanny Dodge
              <div className="tiny muted">if Selvys's blade hits her</div>
            </div>
            <span className="chip blue sm" style={{fontSize: 9}}>armed</span>
          </div>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 6}}>
            <div>
              <b>Vessa</b> · Counterspell
              <div className="tiny muted">vs cleric leveled spell · 3rd lvl slot left</div>
            </div>
            <span className="chip blue sm" style={{fontSize: 9}}>armed</span>
          </div>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <b>Doruk</b> · Shield of Faith
              <div className="tiny muted">spent · refreshes long rest</div>
            </div>
            <span className="chip sm" style={{fontSize: 9, opacity: 0.5}}>spent</span>
          </div>
        </div>
        <div className="aside" style={{marginTop: 10, fontSize: 16}}>
          ↳ DM gets pinged the moment Vessa's counterspell becomes relevant
        </div>
      </div>
    </div>
  );
}

function CardPiles() {
  return (
    <div className="grid-3" style={{gap: 14}}>
      {/* Queued */}
      <CardLane title="Queued" sub="thrown · not yet rolled" tone="">
        <ResolveCard kind="action" actor="Selvys" who="Selvys → Doruk"
                    title="Hold Person · 2nd lvl"
                    body={<>
                      <div className="dice-prompt" style={{margin:0, marginTop: 2}}>
                        <div className="die">d20</div>
                        <div className="formula">Doruk WIS save d20+5</div>
                        <div className="dc">DC 15</div>
                      </div>
                      <div className="ic-meta" style={{marginTop: 6}}>player rolls · DM confirms</div>
                    </>}
                    state="awaiting roll" />
        <ResolveCard kind="bonus" actor="Selvys" who="Selvys"
                    title="Spiritual Weapon · summon"
                    body={<div className="muted" style={{fontSize: 13}}>spectral mace appears, 5ft from Aramil. attacks next turn.</div>}
                    state="ready · no roll" />
      </CardLane>

      {/* Rolling */}
      <CardLane title="Rolling now" sub="dice on the table" tone="blue">
        <ResolveCard kind="reaction" actor="Vessa" who="Vessa"
                    title="Counterspell · 3rd lvl?"
                    body={<>
                      <div className="muted" style={{fontSize: 13}}>Selvys cast 2nd lvl. Auto-counter? or hold slot?</div>
                      <div className="row" style={{gap: 6, marginTop: 6, flexWrap:'wrap'}}>
                        <span className="choice"><span className="key">A</span>auto · burn 3rd</span>
                        <span className="choice"><span className="key">B</span>hold · let through</span>
                        <span className="choice"><span className="key">C</span>roll arcana</span>
                      </div>
                    </>}
                    state="player choosing"
                    hot />
      </CardLane>

      {/* Resolved */}
      <CardLane title="Resolved · round 3" sub="locked into log" tone="green">
        <ResolveCard kind="action" actor="Kaelith" who="Kaelith → Enforcer A"
                    title="Psychic blade · throw"
                    body={<>
                      <div className="ic-meta">d20+8 = <b>22</b> hit · d6+3 + sneak 4d6 = <b>21</b> dmg ✓</div>
                      <div className="tiny muted" style={{marginTop: 2}}>Enforcer A → bloodied (12/30)</div>
                    </>}
                    state="committed" small />
        <ResolveCard kind="bonus" actor="Kaelith" who="Kaelith"
                    title="Cunning Action · Hide"
                    body={<div className="ic-meta">stealth d20+9 = <b>27</b> · re-hidden behind pillar</div>}
                    state="committed" small />
        <ResolveCard kind="action" actor="Enforcer A" who="Enforcer A → Aramil"
                    title="Greatsword · 2 attacks"
                    body={<>
                      <div className="ic-meta">atk1 d20+5 = <b>14</b> miss · atk2 d20+5 = <b>23</b> hit</div>
                      <div className="ic-meta">2d6+3 = <b>11</b> dmg → Aramil bloodied (12/64)</div>
                    </>}
                    state="committed" small />
        <ResolveCard kind="action" actor="Aramil" who="Aramil → Enforcer A"
                    title="Action Surge · 4 swings"
                    body={<div className="ic-meta">2 hit · <b>18</b> dmg · Enf A still up at 12</div>}
                    state="committed" small />
      </CardLane>
    </div>
  );
}

function CardLane({title, sub, tone, children}) {
  const tint = tone === 'blue' ? 'var(--accent-blue)' : tone === 'green' ? 'var(--accent-green)' : 'var(--ink)';
  return (
    <div className="box" style={{padding: 0, display:'flex', flexDirection:'column', minHeight: 280}}>
      <div className="box-title" style={{padding:'10px 12px', margin: 0, borderBottom:'1px solid var(--rule)',
                                          borderTop: `3px solid ${tint}`}}>
        <h3>{title}</h3>
        <span className="meta">{sub}</span>
      </div>
      <div style={{padding: 10, display:'flex', flexDirection:'column', gap: 8, flex: 1}}>
        {children}
      </div>
    </div>
  );
}

// ── LiveRollWidget ─────────────────────────────────────────────────────────
// Wired strip: each roll → /api/sim/roll → engine/mf-dice.ts → dice_receipts.
// Demonstrates the bridge from this surface to the engine MFs.
function LiveRollWidget() {
  const [log, setLog] = React.useState<any[]>([])
  const [busy, setBusy] = React.useState(false)
  const [last, setLast] = React.useState<{ sides: number; value: number; rolling: boolean }>({
    sides: 20,
    value: 1,
    rolling: false,
  })

  const fire = async (formula: { count: number; sides: number; modifier?: number }, rollType: string, dc?: number) => {
    if (busy) return
    setBusy(true)
    setLast({ sides: formula.sides, value: last.value, rolling: true })
    try {
      const r = await rollDice(formula, { rollType, rollerId: 'combat-runner' })
      setLast({ sides: formula.sides, value: r.output.rolls[0] ?? r.output.total, rolling: true })
      // Let the dice tumble for a beat
      setTimeout(() => setLast((s) => ({ ...s, rolling: false })), 1300)
      const passing = dc != null ? r.output.total >= dc : null
      setLog((l) => [
        {
          id: r.id,
          formula: r.output.formula,
          total: r.output.total,
          rolls: r.output.rolls,
          natural20: r.output.natural20,
          natural1: r.output.natural1,
          rollType,
          dc,
          passing,
          persisted: r.persisted,
        },
        ...l,
      ].slice(0, 6))
    } catch (e: any) {
      setLog((l) => [{ error: e?.message ?? 'roll failed', rollType }, ...l].slice(0, 6))
      setLast((s) => ({ ...s, rolling: false }))
    } finally {
      setBusy(false)
    }
  }

  const dieTypeOf = (sides: number): any => {
    if (sides === 4) return 'd4'
    if (sides === 6) return 'd6'
    if (sides === 8) return 'd8'
    if (sides === 10) return 'd10'
    if (sides === 12) return 'd12'
    return 'd20'
  }

  return (
    <div className="box" style={{ marginTop: 14, padding: 14, borderColor: 'var(--accent-blue)' }}>
      <div className="box-title">
        <h3>Engine reach · live rolls</h3>
        <span className="meta">→ /api/sim/roll → engine/mf-dice.ts → dice_receipts</span>
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Die type={dieTypeOf(last.sides)} value={last.value} size={88} rolling={last.rolling} durationMs={1100} />
        <div className="col" style={{ gap: 6, flex: 1, minWidth: 220 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn sm" disabled={busy} onClick={() => fire({ count: 1, sides: 20, modifier: 0 }, 'd20')}>
              roll d20
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 1, sides: 20, modifier: 5 }, 'attack', 15)}
            >
              attack d20+5 vs DC 15
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 1, sides: 20, modifier: 6 }, 'save', 13)}
            >
              DEX save +6 vs DC 13
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 1, sides: 8, modifier: 3 }, 'damage')}
            >
              damage d8+3
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => fire({ count: 4, sides: 6, modifier: 0 }, 'sneak-attack')}
            >
              sneak attack 4d6
            </button>
          </div>
          <div className="tiny muted">each click writes a row to dice_receipts; receipts are deterministic + verifiable</div>
        </div>
      </div>

      {log.length > 0 && (
        <div className="col" style={{ gap: 4, marginTop: 12 }}>
          {log.map((entry, i) =>
            entry.error ? (
              <div key={i} className="tiny" style={{ color: 'var(--accent-red)' }}>
                {entry.rollType}: {entry.error}
              </div>
            ) : (
              <div
                key={entry.id ?? i}
                className="row"
                style={{ gap: 8, fontFamily: 'var(--mono)', fontSize: 12, alignItems: 'center' }}
              >
                <span style={{ width: 110, color: 'var(--ink-3)' }}>{entry.rollType}</span>
                <span style={{ width: 90 }}>{entry.formula}</span>
                <span style={{ width: 110 }}>
                  rolls [{entry.rolls.join(', ')}] →{' '}
                  <b
                    style={{
                      color: entry.natural20
                        ? 'var(--accent-green)'
                        : entry.natural1
                          ? 'var(--accent-red)'
                          : 'var(--ink)',
                    }}
                  >
                    {entry.total}
                  </b>
                </span>
                {entry.dc != null && (
                  <span
                    className="chip sm"
                    style={{
                      fontSize: 9,
                      background: entry.passing ? 'var(--accent-green)' : 'var(--accent-red)',
                      color: 'var(--paper)',
                    }}
                  >
                    {entry.passing ? `pass DC ${entry.dc}` : `fail DC ${entry.dc}`}
                  </span>
                )}
                <span className="tiny muted">
                  receipt {entry.id?.slice(0, 8)}… {entry.persisted ? '✓' : '(not persisted)'}
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

function ResolveCard({kind, actor, who, title, body, state, hot, small}) {
  const kindColor = kind === 'action' ? '' :
                    kind === 'bonus'  ? 'gold' :
                    kind === 'reaction' ? 'red' : 'blue';
  return (
    <div className="inline-card" style={{margin: 0, position:'relative',
                                          borderColor: hot ? 'var(--accent-blue)' : 'var(--rule)',
                                          boxShadow: hot ? '3px 3px 0 var(--accent-blue)' : 'none'}}>
      <div className="ic-head" style={{marginBottom: 4}}>
        <h5 style={{fontSize: small ? 13 : 15}}>{title}</h5>
        <span className={`chip ${kindColor} sm`} style={{fontSize: 9}}>{kind}</span>
      </div>
      <div className="tiny" style={{marginBottom: small ? 4 : 8}}>{who}</div>
      {!small && <div>{body}</div>}
      {small && <div style={{fontSize: 12}}>{body}</div>}
      <div className="ic-footer" style={{marginTop: small ? 6 : 10}}>
        <span className="muted">{state}</span>
        <span className="spacer" />
        {!small && <button className="btn sm">edit</button>}
        {!small && <button className="btn sm primary">commit ↵</button>}
        {small && <span className="chip green sm" style={{fontSize: 9}}>logged</span>}
      </div>
    </div>
  );
}

