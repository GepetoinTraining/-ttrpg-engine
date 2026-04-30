// @ts-nocheck
'use client'

import React from 'react'

// surfaces/Herds.jsx — Surface 41. Slow-life: claimed herds.
// Reads engine/husbandry.ts + tend_herd/slaughter intents.

export default function Herds() {
  const herds = [
    {id:'h-cattle-1', species:'cattle', young: 4, adults: 18, elders: 2, pregnancies: 3, health: 0.84, lastTended: 470,
     yields:{milk:'14 gal/wk', manure:'high'}},
    {id:'h-sheep-1',  species:'sheep',  young: 12, adults: 32, elders: 4, pregnancies: 6, health: 0.66, lastTended: 462,
     yields:{wool:'8 lb/wk', milk:'4 gal/wk'}},
    {id:'h-chick-1',  species:'chickens',young: 22, adults: 40, elders: 0, pregnancies: 0, health: 0.91, lastTended: 471,
     yields:{eggs:'180/wk', manure:'low'}},
  ];
  const today = 472;

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">41 · L5 · slow-life · husbandry</div>
          <h2>Herds</h2>
        </div>
        <span className="who">player view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/husbandry.ts ticks weekly. tend cadence drives health; slaughter returns
        meat / leather / tallow.
      </div>

      <div className="col" style={{gap: 12}}>
        {herds.map(h => {
          const total = h.young + h.adults + h.elders;
          const tendAge = today - h.lastTended;
          return (
            <div key={h.id} className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap: 14}}>
                <div>
                  <div className="tiny">{h.species.toUpperCase()} · {h.id}</div>
                  <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 2, textTransform:'capitalize'}}>{h.species} herd</div>
                  <div className="tiny muted">total {total} head · last tended day {h.lastTended} ({tendAge}d ago)</div>
                </div>
                <div className="row" style={{gap: 4}}>
                  <button className="btn sm primary">tend_herd</button>
                  <button className="btn sm">slaughter</button>
                  <button className="btn sm">abandon</button>
                </div>
              </div>

              <div className="grid-4" style={{marginTop: 12, gap: 10}}>
                <div>
                  <div className="tiny">YOUNG</div>
                  <div className="stat" style={{fontSize: 18}}><b>{h.young}</b></div>
                </div>
                <div>
                  <div className="tiny">ADULTS</div>
                  <div className="stat" style={{fontSize: 18}}><b>{h.adults}</b></div>
                </div>
                <div>
                  <div className="tiny">ELDERS</div>
                  <div className="stat" style={{fontSize: 18}}><b>{h.elders}</b></div>
                </div>
                <div>
                  <div className="tiny">PREGNANCIES</div>
                  <div className="stat" style={{fontSize: 18}}><b>{h.pregnancies}</b></div>
                </div>
              </div>

              <hr className="rule dashed" />
              <div className="grid-3" style={{gap: 14}}>
                <div>
                  <div className="tiny">HEALTH · {(h.health*100).toFixed(0)}%</div>
                  <div className={`bar ${h.health<0.7?'red':'green'}`} style={{marginTop: 4}}><span style={{width: `${h.health*100}%`}}/></div>
                </div>
                <div style={{gridColumn:'span 2'}}>
                  <div className="tiny">WEEKLY YIELDS</div>
                  <div className="row" style={{gap: 6, marginTop: 4, flexWrap:'wrap'}}>
                    {Object.entries(h.yields).map(([k,v]) => (
                      <span key={k} className="chip sm gold"><b>{k}</b> {v}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="aside blue" style={{marginTop: 14, fontSize: 15}}>
        ↳ slaughter modal (not shown) takes a count slider; returns meat + leather + tallow per species table.
      </div>
    </div>
  );
}

