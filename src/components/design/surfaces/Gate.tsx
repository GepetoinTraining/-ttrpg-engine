// @ts-nocheck
'use client'

import React from 'react'
import { AdaptChips, AdaptWeights, AdaptLegend } from './_adaptations'

// surfaces/Gate.jsx — Surface 36. Single dungeon gate inspector.
// Reads engine/mm-dungeon-gate.ts MMDungeonGateDomainState.

export default function Gate() {
  const gate = {
    name: 'Cormanthor portal',
    type: 'portal',
    tier: 4,
    location: 'edge E12 : mile 7',
    state: 'overflowing', // dormant / active / overflowing / capped / cleared
    currentInternal: 86,
    internalCapacity: 100,
    spawnRate: 14,        // /week
    spilloverThreshold: 0.8,
    overflowRadius: 6,    // mi
    weeksOverflowing: 3,
    overflowCount: 22,
    cappedOnDay: null,
    respawnDays: 60,
    currentDay: 472,
    timesCleared: 1,
    leader: { name: 'Vergrath', species: 'ettin', cr: 7, monsterId: 'm-ett-04' },
    adaptations: ['ADAPT','PACK','SWIFT','CUNNING'],
  };

  const stateChip = {
    dormant:    {tag:'',     label:'dormant'},
    active:     {tag:'blue', label:'active'},
    overflowing:{tag:'red',  label:'OVERFLOWING'},
    capped:     {tag:'gold', label:'capped'},
    cleared:    {tag:'green',label:'cleared'},
  }[gate.state];

  const fillPct = (gate.currentInternal / gate.internalCapacity) * 100;
  const thresholdPct = gate.spilloverThreshold * 100;
  const overflowing = gate.state === 'overflowing';

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">36 · L5 · MMDungeonGate</div>
          <h2>{gate.name}</h2>
        </div>
        <span className="who">DM view · single gate readout</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-dungeon-gate.ts ticks fill weekly. when fill ≥ <b>spilloverThreshold</b>,
        gate <b>overflows</b> — monsters spread within <b>overflowRadius</b>, raiding settlements,
        ticking up <i>weeksOverflowing</i>. capping pauses spawn until respawn timer.
      </div>

      {/* hero strip */}
      <div className="box" style={{
        marginBottom: 14,
        borderColor: overflowing ? 'var(--accent-red)' : 'var(--rule)',
        borderWidth: overflowing ? 2 : 1,
        background: overflowing ? 'rgba(168,68,42,0.04)' : 'var(--paper)',
      }}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap: 14}}>
          <div>
            <div className="tiny">PORTAL · {gate.location.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 30, fontWeight: 600, lineHeight: 1.05, marginTop: 2}}>
              {gate.name}
            </div>
            <div className="row" style={{gap: 6, marginTop: 6, alignItems:'center'}}>
              <span className="chip">{gate.type}</span>
              <span className="tiny" style={{letterSpacing:'0.06em'}}>
                TIER {Array.from({length:5}).map((_,i)=>(
                  <span key={i} style={{color: i<gate.tier ? 'var(--accent-red)' : 'var(--ink-4)'}}>●</span>
                ))}
              </span>
              <span className="muted" style={{fontSize: 13, marginLeft: 8}}>cleared {gate.timesCleared}× since 1462 DR</span>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <span className={`chip ${stateChip.tag}`} style={{
              fontSize: 14, padding:'4px 12px',
              fontFamily:'var(--mono)', fontWeight: 600,
              animation: overflowing ? 'gate-pulse 1.6s ease-in-out infinite' : 'none',
            }}>
              ● {stateChip.label}
            </span>
            {overflowing && (
              <div className="tiny" style={{color:'var(--accent-red)', marginTop: 6}}>
                week {gate.weeksOverflowing} · {gate.overflowRadius}mi radius · {gate.overflowCount} monsters loose
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gate-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      <div className="grid-3" style={{gap: 14}}>
        {/* fill gauge */}
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="box-title"><h3>Internal fill</h3><span className="meta">{gate.currentInternal} / {gate.internalCapacity}</span></div>
          <div style={{position:'relative', marginTop: 10}}>
            <div className="bar red" style={{height: 14}}>
              <span style={{width: `${fillPct}%`}} />
            </div>
            {/* spillover threshold marker */}
            <div style={{
              position:'absolute', top: -4, bottom: -4,
              left: `${thresholdPct}%`,
              width: 0, borderLeft: '2px dashed var(--ink)',
            }} />
            <div className="tiny" style={{
              position:'absolute', top: -16, left: `${thresholdPct}%`,
              transform:'translateX(-50%)', whiteSpace:'nowrap',
            }}>
              spillover ↓ {gate.spilloverThreshold}
            </div>
          </div>
          <div className="row" style={{justifyContent:'space-between', marginTop: 16, fontFamily:'var(--mono)', fontSize: 11}}>
            <span><b>spawnRate</b> {gate.spawnRate}/wk</span>
            <span><b>fill velocity</b> +{((gate.spawnRate / gate.internalCapacity) * 100).toFixed(0)}% /wk</span>
            <span><b>weeks overflowing</b> {gate.weeksOverflowing}</span>
            <span><b>total overflows</b> {gate.overflowCount}</span>
          </div>
        </div>

        {/* respawn timer */}
        <div className="box">
          <div className="box-title"><h3>Respawn cycle</h3><span className="meta">if capped</span></div>
          {gate.state === 'capped' ? (
            <div>
              <div style={{fontFamily:'var(--mono)', fontSize: 32, textAlign:'center', marginTop: 10}}>
                {Math.max(0, gate.cappedOnDay + gate.respawnDays - gate.currentDay)}d
              </div>
              <div className="tiny" style={{textAlign:'center'}}>until respawn</div>
            </div>
          ) : (
            <div className="muted" style={{fontSize: 13, padding:'8px 0'}}>
              not capped. if cleared &amp; capped today, respawn would tick at <b style={{color:'var(--ink)'}}>day {gate.currentDay + gate.respawnDays}</b> ({gate.respawnDays}d).
            </div>
          )}
          <hr className="rule dashed" />
          <button className="btn primary" style={{width:'100%'}}>Attempt clear →</button>
          <div className="tiny" style={{marginTop: 6, textAlign:'center'}}>routes via clearGateWithEcology()</div>
        </div>
      </div>

      <div className="grid-3" style={{gap: 14, marginTop: 14}}>
        {/* adaptations */}
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="box-title"><h3>Expressed adaptations</h3><span className="meta">from ecology pool</span></div>
          <AdaptChips active={gate.adaptations} />
          <hr className="rule dashed" />
          <div className="tiny">FULL POOL · 10 traits · weights drift each generation</div>
          <div style={{marginTop: 6}}>
            <AdaptLegend />
          </div>
        </div>

        {/* leader */}
        <div className="box">
          <div className="box-title"><h3>Leader emerged</h3><span className="meta">CR {gate.leader.cr}</span></div>
          <div className="row" style={{gap: 10, alignItems:'center'}}>
            <div className="placeholder" style={{width: 64, height: 64, minHeight: 64, padding: 0, flexShrink: 0}}>
              chip
            </div>
            <div>
              <div style={{fontFamily:'var(--serif)', fontSize: 18, fontWeight: 600}}>{gate.leader.name}</div>
              <div className="tiny muted">{gate.leader.species} · CR {gate.leader.cr}</div>
            </div>
          </div>
          <button className="btn sm" style={{marginTop: 10, width:'100%'}}>open MonsterCamp →</button>
        </div>
      </div>

      {/* spillover map */}
      <div className="section-title">Overflow footprint</div>
      <div className="box" style={{padding: 0, position:'relative', overflow:'hidden'}}>
        <div style={{
          position:'relative', height: 220,
          background: `radial-gradient(circle at 50% 50%,
            rgba(168,68,42,0.30) 0,
            rgba(168,68,42,0.18) 30%,
            rgba(168,68,42,0.06) 55%,
            transparent 75%),
            repeating-linear-gradient(45deg, transparent 0 16px, rgba(31,27,22,0.04) 16px 17px)`,
        }}>
          <div style={{
            position:'absolute', left:'50%', top:'50%',
            transform:'translate(-50%,-50%)', width: 18, height: 18,
            borderRadius:'50%', background:'var(--accent-red)', border:'3px solid var(--paper)', boxShadow:'0 0 0 1.5px var(--accent-red)',
          }} />
          <div style={{
            position:'absolute', left:'50%', top: 'calc(50% + 16px)',
            transform:'translateX(-50%)', fontFamily:'var(--mono)', fontSize: 10, color:'var(--accent-red)',
          }}>
            gate · {gate.location}
          </div>
          {[
            {x:34, y:36, n:'Saerb farm'},
            {x:62, y:30, n:'cairn 7'},
            {x:70, y:62, n:'shepherd path'},
            {x:28, y:68, n:'East Reach'},
          ].map((p,i) => (
            <div key={i} className="pin" style={{left: `${p.x}%`, top: `${p.y}%`}}>
              <div className="dot" style={{background:'var(--ink-2)'}}/>
              <div className="lbl">{p.n}</div>
            </div>
          ))}
          <div className="tiny" style={{position:'absolute', top: 8, left: 12, color:'var(--accent-red)'}}>
            radius {gate.overflowRadius}mi · {gate.overflowCount} monsters loose
          </div>
        </div>
      </div>

      <div className="aside" style={{marginTop: 14}}>
        ↳ if not addressed, overflow extends to neighbouring edges in 2 wks. settlements within radius take raid rolls weekly via mm-monster-actor.
      </div>
    </div>
  );
}

