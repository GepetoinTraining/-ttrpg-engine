// @ts-nocheck
'use client'

import React from 'react'
import { loadWeather } from '@/lib/world'

// surfaces/Weather.tsx — Weather observer + forecast (engine/weather.ts).
// Live band loads weather_state for all regions; forecast/omens stay wireframe.

export default function Weather() {
  const [live, setLive] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadWeather().then(setLive).catch((e) => setError(e?.message ?? 'load failed'))
  }, [])

  const days = [
    {d:'today', dt:'14 Mirtul', hi:64, lo:48, code:'rain',   wind:'SW 14', moon:'waxing', omen:'gray'},
    {d:'2',     dt:'15 Mirtul', hi:62, lo:46, code:'rain',   wind:'SW 18', moon:'waxing'},
    {d:'3',     dt:'16 Mirtul', hi:58, lo:44, code:'storm',  wind:'W 26',  moon:'gibbous', omen:'auspicious'},
    {d:'4',     dt:'17 Mirtul', hi:60, lo:45, code:'cloudy', wind:'NW 10', moon:'gibbous'},
    {d:'5',     dt:'18 Mirtul', hi:65, lo:48, code:'sun',    wind:'N 6',   moon:'full',  omen:'full · Selûne'},
    {d:'6',     dt:'19 Mirtul', hi:67, lo:50, code:'sun',    wind:'NE 8',  moon:'full'},
    {d:'7',     dt:'20 Mirtul', hi:64, lo:48, code:'cloudy', wind:'E 12',  moon:'waning'},
  ];

  const seasonal = [
    {n:'Wheat (Trades Ward farms)', stage:'sowing', risk:'med', note:'rain delaying broadcast — −1 wk yield'},
    {n:'Apple orchards (Dock)', stage:'flowering', risk:'high', note:'storm Day 3 may strip blossoms'},
    {n:'Grazing (south road)', stage:'good', risk:'low', note:'mud impedes caravan speed −15%'},
    {n:'Fishing (harbor)', stage:'fair', risk:'high', note:'gale Day 3, fleet stays in port'},
  ];

  const wxIcon = (code) => {
    if (code==='sun') return '☉';
    if (code==='cloudy') return '☁';
    if (code==='rain') return '☂';
    if (code==='storm') return '↯';
    if (code==='snow') return '❄';
    return '·';
  };

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">27 · Atmosphere · Sword Coast</div>
          <h2>Weather &amp; seasons</h2>
        </div>
        <span className="who">DM · ticks per in-game day · player sees current only</span>
      </div>

      <div className="aside blue" style={{marginBottom: 18}}>
        ↳ engine ticks weather per region per day. Currently DMConsole shows only "rain · 14mph
        SW" inline. This adds a 7-day forecast, seasonal effects on crops &amp; trade, and omens
        tied to the lunar cycle (Selûne worshippers).
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live regional weather</h3>
          <span className="meta">→ /api/world/weather · weather_state</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && (live.regions?.length ?? 0) === 0 && (
          <div className="tiny muted">no weather_state rows yet · run a world tick to populate</div>
        )}
        {live && (live.regions?.length ?? 0) > 0 && (
          <table className="inv" style={{marginTop: 8}}>
            <thead>
              <tr><th>region</th><th>climate</th><th>season</th><th>temp</th><th>severity</th></tr>
            </thead>
            <tbody>
              {live.regions.map((r: any) => {
                const w = live.weather.find((x: any) => x.regionId === r.id)
                return (
                  <tr key={r.id}>
                    <td><b>{r.name ?? r.id.slice(0, 8) + '…'}</b></td>
                    <td>{w?.climate ?? <span className="muted">—</span>}</td>
                    <td>{w?.season ?? <span className="muted">—</span>}</td>
                    <td>{w?.temperature != null ? `${w.temperature.toFixed(1)}°` : <span className="muted">—</span>}</td>
                    <td>
                      {w?.severity != null ? (
                        <span style={{color: w.severity > 0.5 ? 'var(--accent-red)' : w.severity > 0.2 ? 'var(--accent-gold)' : 'var(--ink)'}}>
                          {w.severity.toFixed(2)}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* current conditions hero */}
      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box dark" style={{gridColumn:'span 2'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div className="tiny" style={{color:'var(--paper-3)'}}>WATERDEEP · TRADES WARD</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 56, fontWeight: 600, lineHeight: 1, marginTop: 4}}>
                57°F <span style={{fontSize: 32, color:'var(--paper-3)'}}>{wxIcon('rain')}</span>
              </div>
              <div className="tiny" style={{color:'var(--paper-3)', marginTop: 4}}>steady rain · SW wind 14mph · pressure dropping</div>
              <div className="row" style={{gap: 6, marginTop: 14, flexWrap:'wrap'}}>
                <span className="chip" style={{borderColor:'var(--paper-3)', color:'var(--paper)'}}>visibility −2</span>
                <span className="chip" style={{borderColor:'var(--paper-3)', color:'var(--paper)'}}>tracking dis.</span>
                <span className="chip gold">fire spells +1 DC vs ignite</span>
              </div>
            </div>

            <div style={{textAlign:'right'}}>
              <div className="tiny" style={{color:'var(--paper-3)'}}>14 MIRTUL · YEAR OF DRAGONS</div>
              <div style={{fontSize: 13, marginTop: 4, color:'var(--paper-2)'}}>spring · 4 wks to Greengrass</div>
              <div className="tiny" style={{color:'var(--paper-3)', marginTop: 12}}>MOON</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 20}}>☽ waxing · 62%</div>
            </div>
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Active omens</h3><span className="meta">narrative</span></div>
          <div className="col" style={{gap: 8}}>
            <div>
              <span className="chip gold sm">Day 3</span>
              <span style={{fontFamily:'var(--hand)', fontSize: 18, color:'var(--accent-gold)', marginLeft: 6}}>
                Storm broken by sunbeam — auspicious
              </span>
            </div>
            <div>
              <span className="chip blue sm">Day 5</span>
              <span style={{fontFamily:'var(--hand)', fontSize: 18, color:'var(--accent-blue)', marginLeft: 6}}>
                Full moon · Selûne rites favored
              </span>
            </div>
            <div>
              <span className="chip red sm">today</span>
              <span style={{fontFamily:'var(--hand)', fontSize: 18, color:'var(--accent-red)', marginLeft: 6}}>
                gray rain — tracking impossible
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-day forecast */}
      <div className="section-title">7-day forecast</div>
      <div className="grid-4" style={{gridTemplateColumns:'repeat(7, 1fr)', gap: 10}}>
        {days.map((d,i) => (
          <div key={i} className={`box ${i===0?'filled':''}`} style={{padding: 12, textAlign:'center'}}>
            <div className="tiny">{d.d.toUpperCase()}</div>
            <div className="tiny muted">{d.dt}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 32, lineHeight: 1, marginTop: 8}}>{wxIcon(d.code)}</div>
            <div className="tiny" style={{marginTop: 4}}>
              <b>{d.hi}°</b> / <span className="muted">{d.lo}°</span>
            </div>
            <div className="tiny muted" style={{marginTop: 4}}>{d.wind}</div>
            <div className="tiny" style={{marginTop: 4}}>☽ {d.moon}</div>
            {d.omen && <div className="hand" style={{fontSize: 14, marginTop: 6, color: d.omen==='gray'?'var(--accent-red)':d.omen.includes('Selûne')?'var(--accent-blue)':'var(--accent-gold)'}}>{d.omen}</div>}
          </div>
        ))}
      </div>

      {/* seasonal effects */}
      <div className="grid-2" style={{marginTop: 22}}>
        <div className="box">
          <div className="box-title"><h3>Agricultural &amp; trade effects</h3><span className="meta">auto-applied</span></div>
          <table className="inv">
            <thead><tr><th>thing</th><th>stage</th><th>risk</th><th>note</th></tr></thead>
            <tbody>
              {seasonal.map((s,i) => (
                <tr key={i}>
                  <td style={{fontFamily:'var(--serif)', fontWeight: 500}}>{s.n}</td>
                  <td className="tiny">{s.stage}</td>
                  <td><span className={`chip sm ${s.risk==='high'?'red':s.risk==='med'?'gold':'green'}`}>{s.risk}</span></td>
                  <td className="tiny" style={{fontStyle:'italic'}}>{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="aside" style={{marginTop: 12}}>↳ poor harvest cascades into Markets surface — bread +12% if blossoms strip</div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Mechanical effects in play</h3><span className="meta">applied to rolls</span></div>
          <ul style={{margin:0, paddingLeft: 16, fontSize: 14, lineHeight: 1.6}}>
            <li><b>rain</b> · disadv. on Perception (sight), tracking impossible</li>
            <li><b>wind ≥ 20mph</b> · ranged attacks dis., torch goes out on save fail</li>
            <li><b>storm</b> · lightning damage spells +1d6, metal armor disadv. in open</li>
            <li><b>full moon</b> · lycanthrope-curse triggers, +1 healing for moon-blessed</li>
            <li><b>snow / cold</b> · exhaustion check after 1hr exposure w/o gear</li>
          </ul>
          <button className="btn sm" style={{marginTop: 12}}>tweak active region →</button>
        </div>
      </div>

      <div className="section-title">Regions tracked</div>
      <div className="grid-4">
        {[
          {n:'Sword Coast · north', t:'52° rain', m:'auto'},
          {n:'High Forest', t:'48° fog', m:'auto'},
          {n:'Underdark · upper', t:'51° still', m:'fixed'},
          {n:'Cloud Peaks', t:'34° snow', m:'auto'},
        ].map(r => (
          <div key={r.n} className="box soft">
            <div style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{r.n}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{r.t} · {r.m}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

