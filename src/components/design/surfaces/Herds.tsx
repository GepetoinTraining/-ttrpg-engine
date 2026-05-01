// @ts-nocheck
'use client'

import React from 'react'
import { Chip, FidelityBadge } from './_chips'

// surfaces/Herds.tsx — Surface 41. Slow-life: claimed herds.
// Reads engine/husbandry.ts + tend_herd/slaughter intents.

export default function Herds() {
  const [slaughter, setSlaughter] = React.useState(null)
  const herds = [
    {id:'h-cattle-1', species:'cattle', young: 4, adults: 18, elders: 2, pregnancies: 3, health: 0.84, lastTended: 470, claim:'active',
     yields:{milk:'14 gal/wk', manure:'high'},
     slaughterTable:{adult:{meat:'320 lb', leather:'1 hide', tallow:'12 lb'}, elder:{meat:'240 lb', leather:'1 hide', tallow:'8 lb'}, young:{meat:'90 lb', leather:'—', tallow:'2 lb'}}},
    {id:'h-sheep-1',  species:'sheep',  young: 12, adults: 32, elders: 4, pregnancies: 6, health: 0.66, lastTended: 462, claim:'active',
     yields:{wool:'8 lb/wk', milk:'4 gal/wk'},
     slaughterTable:{adult:{meat:'42 lb', leather:'1 fleece', tallow:'3 lb'}, elder:{meat:'30 lb', leather:'1 fleece', tallow:'2 lb'}, young:{meat:'14 lb', leather:'—', tallow:'—'}}},
    {id:'h-chick-1',  species:'chickens',young: 22, adults: 40, elders: 0, pregnancies: 0, health: 0.91, lastTended: 471, claim:'contested',
     yields:{eggs:'180/wk', manure:'low'},
     slaughterTable:{adult:{meat:'2 lb', leather:'—', tallow:'—'}, elder:{meat:'1 lb', leather:'—', tallow:'—'}, young:{meat:'—', leather:'—', tallow:'—'}}},
  ]
  const today = 472

  // tend cadence: > 14d health drops; > 60d herd lapses
  const tendStatus = (age) => age > 60 ? {label:'lapsing', tag:'red'} : age > 14 ? {label:'overdue', tag:'gold'} : {label:'tended', tag:'green'}

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">41 · L5 · slow-life · husbandry</div>
          <h2>Herds <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/husbandry.ts ticks weekly. tend cadence drives health; slaughter returns
        meat / leather / tallow.
      </div>

      <div className="col" style={{gap: 12}}>
        {herds.map(h => {
          const total = h.young + h.adults + h.elders
          const tendAge = today - h.lastTended
          return (
            <div key={h.id} className="box">
              <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap: 14}}>
                <div>
                  <div className="tiny">{h.species.toUpperCase()} · {h.id}</div>
                  <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 2, textTransform:'capitalize'}}>{h.species} herd</div>
                  <div className="row" style={{gap: 8, marginTop: 4, alignItems:'center'}}>
                    <span className="tiny muted">total {total} head · last tended day {h.lastTended} ({tendAge}d ago)</span>
                    <Chip kind="claim" value={h.claim} />
                    <span className={`chip sm ${tendStatus(tendAge).tag}`}>{tendStatus(tendAge).label}</span>
                  </div>
                </div>
                <div className="row" style={{gap: 4}}>
                  <button className="btn sm primary">tend_herd</button>
                  <button className="btn sm" onClick={() => setSlaughter(h)}>slaughter…</button>
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
          )
        })}
      </div>

      {slaughter && <SlaughterModal herd={slaughter} onClose={() => setSlaughter(null)} />}
    </div>
  )
}

function SlaughterModal({herd, onClose}) {
  const [adultN, setAdultN] = React.useState(0)
  const [elderN, setElderN] = React.useState(Math.min(1, herd.elders))
  const [youngN, setYoungN] = React.useState(0)
  const t = herd.slaughterTable

  return (
    <div style={{position:'fixed', inset: 0, background:'rgba(28,26,22,0.45)', zIndex: 60,
                 display:'grid', placeItems:'center'}}>
      <div className="box" style={{background:'var(--paper)', width: 560, maxWidth:'92vw',
                                    boxShadow:'4px 4px 0 var(--ink)'}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div className="tiny">SLAUGHTER · {herd.id}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600, marginTop: 2,
                         textTransform:'capitalize'}}>{herd.species} herd</div>
          </div>
          <button className="btn sm" onClick={onClose}>close ✕</button>
        </div>

        <div className="aside" style={{margin:'10px 0 14px', fontSize: 13}}>
          ↳ returns meat + leather + tallow per species table. cull is permanent.
          health drops if young selected before adults.
        </div>

        {[
          {k:'young',  label:'Young',  cap: herd.young,  n: youngN,  set: setYoungN,  yields: t.young, warn:'health −2 if culled before adults'},
          {k:'adult',  label:'Adults', cap: herd.adults, n: adultN,  set: setAdultN,  yields: t.adult, warn: null},
          {k:'elder',  label:'Elders', cap: herd.elders, n: elderN,  set: setElderN,  yields: t.elder, warn: null},
        ].map(row => (
          <div key={row.k} className="box soft" style={{padding:'8px 12px', marginBottom: 8}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center', gap: 10}}>
              <div style={{minWidth: 90}}>
                <b>{row.label}</b>
                <div className="tiny muted">avail {row.cap}</div>
              </div>
              <div className="row" style={{gap: 4}}>
                <button className="btn sm" onClick={() => row.set(Math.max(0, row.n - 1))}>−</button>
                <span className="stat" style={{minWidth: 28, textAlign:'center'}}>{row.n}</span>
                <button className="btn sm" onClick={() => row.set(Math.min(row.cap, row.n + 1))}>+</button>
              </div>
              <div className="tiny" style={{flex: 1, textAlign:'right'}}>
                per head: {row.yields.meat} meat · {row.yields.leather} · {row.yields.tallow} tallow
              </div>
            </div>
            {row.warn && row.n > 0 && (
              <div className="tiny" style={{color:'var(--accent-red)', marginTop: 4}}>⚠ {row.warn}</div>
            )}
          </div>
        ))}

        <div className="row" style={{justifyContent:'space-between', marginTop: 14, alignItems:'center'}}>
          <div className="tiny">total cull <b>{youngN + adultN + elderN}</b> head</div>
          <div className="row" style={{gap: 4}}>
            <button className="btn sm" onClick={onClose}>cancel</button>
            <button className="btn sm primary" onClick={onClose}>confirm slaughter</button>
          </div>
        </div>
      </div>
    </div>
  )
}
