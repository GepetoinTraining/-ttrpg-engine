// @ts-nocheck
'use client'

import React from 'react'

// surfaces/Deposits.jsx — Surface 42. Slow-life: resource deposits + extraction.
// Reads engine/production-chain.ts + engine/material-mastery.ts + interactions.ts.
// Mastery-gated visibility: 0=name, 1=base, 2=quality, 3=hidden affixes.

export default function Deposits() {
  const deposits = [
    {id:'d-iron-1', resource:'iron ore', loc:'East Reach hills', mastery: 2, reserves: 4200, qualityBand:'good',
     hiddenAffix:'cold-iron seam (rare)', workers: 4, dailyOutput: 28},
    {id:'d-stone-1', resource:'building stone', loc:'Saerb quarry', mastery: 1, reserves: 18000, qualityBand:'?',
     hiddenAffix:'?', workers: 6, dailyOutput: 90},
    {id:'d-silver-1', resource:'silver vein', loc:'Wheloon ridge', mastery: 3, reserves: 880, qualityBand:'fine',
     hiddenAffix:'thaumaturgic resonance · +20% to enchantment yield', workers: 2, dailyOutput: 6},
    {id:'d-clay-1', resource:'clay bed', loc:'fen', mastery: 0, reserves: null, qualityBand:'?',
     hiddenAffix:'?', workers: 0, dailyOutput: 0},
  ];

  const masteryDot = (m) => Array.from({length:3}).map((_,i) => (
    <span key={i} style={{color: i<m ? 'var(--accent-gold)' : 'var(--ink-4)', fontFamily:'var(--mono)'}}>●</span>
  ));

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">42 · L5 · slow-life · production</div>
          <h2>Deposits</h2>
        </div>
        <span className="who">visibility scales with mastery</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ examine_deposit (perception) advances mastery 0→3. each level reveals more:
        <b> 0</b> name only · <b>1</b> base props · <b>2</b> quality bands · <b>3</b> hidden affixes.
      </div>

      <div className="col" style={{gap: 12}}>
        {deposits.map(d => (
          <div key={d.id} className="box">
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap: 14}}>
              <div style={{flex: 1, minWidth: 260}}>
                <div className="tiny">{d.id} · {d.loc.toUpperCase()}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 2}}>{d.resource}</div>
                <div className="row" style={{gap: 6, marginTop: 6, alignItems:'center'}}>
                  <span className="tiny">MASTERY</span>
                  <span>{masteryDot(d.mastery)}</span>
                  <span className="tiny muted">{d.mastery}/3</span>
                </div>
              </div>
              <div className="row" style={{gap: 4}}>
                <button className="btn sm">examine_deposit</button>
                <button className="btn sm primary" disabled={d.mastery < 1}>extract</button>
              </div>
            </div>

            <hr className="rule dashed" />
            <div className="grid-4" style={{gap: 10, fontSize: 13}}>
              <div>
                <div className="tiny">RESERVES</div>
                <div className="stat" style={{fontSize: 16, marginTop: 2}}>
                  {d.mastery >= 1 ? <b>{d.reserves.toLocaleString()} u</b> : <span className="muted">████ ████</span>}
                </div>
              </div>
              <div>
                <div className="tiny">QUALITY</div>
                <div className="stat" style={{fontSize: 16, marginTop: 2}}>
                  {d.mastery >= 2 ? <b>{d.qualityBand}</b> : <span className="muted">████</span>}
                </div>
              </div>
              <div>
                <div className="tiny">HIDDEN AFFIX</div>
                <div className="stat" style={{fontSize: 13, marginTop: 2, lineHeight: 1.3}}>
                  {d.mastery >= 3 ? <b style={{color:'var(--accent-gold)'}}>{d.hiddenAffix}</b> : <span className="muted">████ ████ ████ ████</span>}
                </div>
              </div>
              <div>
                <div className="tiny">EXTRACTION</div>
                <div className="stat" style={{fontSize: 13, marginTop: 2}}>
                  {d.workers>0 ? <span><b>{d.workers}</b> workers · <b>{d.dailyOutput}</b>/day</span> : <span className="muted">unstaffed</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

