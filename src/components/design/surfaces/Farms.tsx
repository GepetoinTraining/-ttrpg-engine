// @ts-nocheck
'use client'

import React from 'react'
import { Chip, FidelityBadge } from './_chips'

// surfaces/Farms.tsx — Surface 40. Slow-life: claimed farm plots.
// Reads engine/agriculture.ts + engine/claims.ts + plant_crops intent.
// Per Pedro: discovered, not advertised. No tutorial.

export default function Farms() {
  const today = 472
  // current weather window from engine/weather.ts (mock). modulates daily growth tick.
  const weather = {
    season: 'Eleasis · late summer',
    today: 'warm · dry',
    forecast7d: [
      {d:'today',  cond:'warm · dry',     mod: 1.00},
      {d:'+1',     cond:'warm · dry',     mod: 1.00},
      {d:'+2',     cond:'overcast',         mod: 0.95},
      {d:'+3',     cond:'rain',             mod: 1.10},
      {d:'+4',     cond:'rain',             mod: 1.10},
      {d:'+5',     cond:'cool · clear',    mod: 1.05},
      {d:'+6',     cond:'warm · dry',     mod: 1.00},
    ],
    weeklyMod: 1.03, // avg over 7d
    soilMoisture: 0.58,
  }
  const growthMod = weather.weeklyMod // applied to growth bar

  const plots = [
    {id:'p-saerb-3',  loc:'Saerb · plot 3',     status:'planted',    crop:'wheat',  plantedDay: 440, growthDays: 90, lastTended: 466, claim:'active'},
    {id:'p-saerb-4',  loc:'Saerb · plot 4',     status:'harvesting', crop:'barley', plantedDay: 380, growthDays: 80, lastTended: 471, claim:'active'},
    {id:'p-east-1',   loc:'East Reach · west',  status:'fallow',     crop:null,     plantedDay: null, growthDays: 0,  lastTended: 410, claim:'active'},
    {id:'p-east-2',   loc:'East Reach · east',  status:'fallow',     crop:null,     plantedDay: null, growthDays: 0,  lastTended: 380, claim:'lapsed'},
    {id:'p-whel-1',   loc:'Wheloon edge · 1',   status:'planted',    crop:'flax',   plantedDay: 455, growthDays: 70, lastTended: 470, claim:'contested'},
  ]

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">40 · L5 · slow-life · agriculture</div>
          <h2>Farm plots <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player view · long horizon</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/agriculture.ts ticks daily; growth advances on weather + tend cadence.
        a plot lapses if untended {`>`} 60d. contested = another claimant filed.
      </div>

      {/* Weather modulation strip */}
      <div className="box dashed" style={{marginBottom: 14, padding:'10px 14px'}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap: 12}}>
          <div>
            <span className="hand ink" style={{fontSize: 18}}>Weather · 7-day</span>
            <span className="tiny" style={{marginLeft: 10}}>{weather.season} · today {weather.today} · soil {(weather.soilMoisture*100|0)}%</span>
          </div>
          <div className="row" style={{gap: 10, alignItems:'center'}}>
            <span className="tiny">growth modulator</span>
            <span className={`chip sm ${growthMod >= 1.05 ? 'green' : growthMod < 0.95 ? 'red' : ''}`}>
              ×{growthMod.toFixed(2)}
            </span>
            <span className="tiny" style={{textDecoration:'underline', cursor:'pointer'}}>open Weather →</span>
          </div>
        </div>
        <div className="row" style={{gap: 4, marginTop: 8, fontFamily:'var(--mono)', fontSize: 11}}>
          {weather.forecast7d.map((w,i) => (
            <div key={i} style={{flex:1, textAlign:'center', padding:'4px 0',
                                 background: w.mod >= 1.05 ? 'rgba(91,138,90,0.12)' : w.mod < 0.95 ? 'rgba(168,68,42,0.10)' : 'var(--paper-2)',
                                 border:'1px solid var(--rule-soft)'}}>
              <div style={{fontWeight: 600}}>{w.d}</div>
              <div style={{fontSize: 10, color:'var(--ink-3)'}}>{w.cond}</div>
              <div style={{fontSize: 10}}>×{w.mod.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-4" style={{marginBottom: 14}}>
        {[
          {n:'Plots', v: plots.length, s: `${plots.filter(p=>p.claim==='active').length} active`},
          {n:'Planted', v: plots.filter(p=>p.status==='planted').length, s:'growing'},
          {n:'Harvest ready', v: plots.filter(p=>p.status==='harvesting').length, s:'this week'},
          {n:'Lapsed/contested', v: plots.filter(p=>p.claim!=='active').length, s:'attention'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.s}</div>
          </div>
        ))}
      </div>

      <table className="inv">
        <thead>
          <tr><th>Plot</th><th>Status</th><th>Crop</th><th>Growth</th><th>Last tended</th><th>Claim</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {plots.map(p => {
            const grown = p.status==='planted' && p.plantedDay ? Math.min(100, ((today - p.plantedDay) / p.growthDays) * 100) : (p.status==='harvesting' ? 100 : 0)
            const harvestDay = p.plantedDay ? p.plantedDay + p.growthDays : null
            return (
              <tr key={p.id}>
                <td><b>{p.loc}</b><div className="tiny muted">{p.id}</div></td>
                <td><Chip kind="plot" value={p.status} /></td>
                <td>{p.crop || <span className="muted">—</span>}</td>
                <td style={{minWidth: 160}}>
                  {p.status === 'fallow' ? <span className="muted">—</span> : (
                    <div>
                      <div className="bar gold"><span style={{width: `${grown}%`}} /></div>
                      <div className="tiny" style={{marginTop: 2}}>
                        {p.status==='harvesting' ? 'ready now' : `harvest day ${harvestDay} · ${harvestDay - today}d`}
                      </div>
                    </div>
                  )}
                </td>
                <td className="stat">day {p.lastTended}</td>
                <td><Chip kind="claim" value={p.claim} /></td>
                <td>
                  <div className="row" style={{gap: 4}}>
                    {p.status === 'fallow' && p.claim==='active' && <button className="btn sm">plant_crops</button>}
                    {p.status === 'harvesting' && <button className="btn sm primary">harvest</button>}
                    {p.status === 'planted' && <button className="btn sm">tend</button>}
                    {p.claim === 'lapsed' && <button className="btn sm">re-claim</button>}
                    {p.claim === 'contested' && <button className="btn sm danger">defend</button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="grid-2" style={{gap: 14, marginTop: 18}}>
        <div className="box">
          <div className="box-title"><h3>Plant cycle · seasonal</h3><span className="meta">Eleasis · late summer</span></div>
          <div className="row" style={{gap: 8, flexWrap:'wrap'}}>
            {[
              {c:'wheat',  s:'spring · 90d', y:'high'},
              {c:'barley', s:'spring · 80d', y:'med'},
              {c:'flax',   s:'spring · 70d', y:'low · cash'},
              {c:'turnip', s:'autumn · 60d', y:'low'},
              {c:'rye',    s:'autumn · 110d',y:'med'},
            ].map(x => (
              <div key={x.c} className="box soft" style={{padding:'6px 10px', flex:'1 1 140px'}}>
                <b>{x.c}</b><div className="tiny">{x.s}</div><div className="tiny muted">yield {x.y}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="box">
          <div className="box-title"><h3>Recent yield</h3><span className="meta">last harvest</span></div>
          <table className="inv">
            <tbody>
              <tr><td>Saerb · 2 (wheat)</td><td className="stat">312 lb</td><td className="stat">sold 58gp</td></tr>
              <tr><td>East Reach · west (rye)</td><td className="stat">210 lb</td><td className="stat">stored</td></tr>
              <tr><td>Wheloon (turnip)</td><td className="stat">88 lb</td><td className="stat">sold 9gp</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
