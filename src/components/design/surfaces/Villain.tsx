// @ts-nocheck
'use client'

import React from 'react'
// surfaces/Villain.jsx — Villain org · CTF influence map

export default function Villain() {
  const [layer, setLayer] = React.useState('influence');

  // % positions on the map for major Faerûn cities (rough — Sword Coast cluster)
  const cities = [
    {id:'wd',  n:'Waterdeep',     x:32, y:50, ctrl:'contested', red: 45, blue: 35},
    {id:'da',  n:'Daggerford',    x:30, y:58, ctrl:'red',       red: 65, blue: 15},
    {id:'bg',  n:'Baldur\'s Gate',x:32, y:67, ctrl:'red',       red: 70, blue: 10},
    {id:'mu',  n:'Mulmaster',     x:78, y:46, ctrl:'red',       red: 85, blue: 5},
    {id:'zh',  n:'Zhentil Keep',  x:74, y:38, ctrl:'red',       red: 95, blue: 0},
    {id:'sk',  n:'Silverymoon',   x:48, y:30, ctrl:'blue',      red: 10, blue: 70},
    {id:'cn',  n:'Candlekeep',    x:25, y:72, ctrl:'blue',      red: 5,  blue: 80},
    {id:'lr',  n:'Lord\'s Hold',  x:55, y:60, ctrl:'gold',      red: 30, blue: 30},
  ];

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">06 · Villain control room</div>
          <h2>The Black Network · Faerûn</h2>
        </div>
        <span className="who">DM only · AI ticks between sessions</span>
      </div>

      <div className="aside" style={{marginBottom: 18}}>
        ↳ capture-the-flag over Faerûn — every city has an influence score per faction.
        AI advances Zhent / Bane while the party sleeps.
      </div>

      {/* Top: BBEG + clocks */}
      <div className="grid-3" style={{marginBottom: 18}}>
        <div className="box dark" style={{gridColumn:'span 2'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div className="tiny" style={{color:'var(--paper-3)', marginBottom: 4}}>BBEG · CR 21 · vampire wizard</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 32, fontWeight: 600, lineHeight: 1}}>Manshoon</div>
              <div className="tiny" style={{color:'var(--paper-3)', marginTop: 4}}>"there can be only one"</div>
              <div className="row" style={{gap: 8, marginTop: 12}}>
                <span className="chip red">aware of party</span>
                <span className="chip" style={{borderColor:'var(--paper-3)', color:'var(--paper)'}}>not yet engaged</span>
                <span className="chip gold">scrying weekly</span>
              </div>
            </div>
            <div style={{width: 200}}>
              <div className="tiny" style={{color:'var(--paper-3)'}}>CURRENT MOVE</div>
              <p style={{fontSize: 13, margin: '4px 0', color:'var(--paper-2)'}}>
                Consolidating Sword Coast trade lanes. Will pivot to Waterdeep
                power-grab once Daggerford holds.
              </p>
            </div>
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Front clocks</h3><span className="meta">async ticks</span></div>
          <div className="col" style={{gap: 10}}>
            {[
              {n:'Manshoon · Waterdeep coup', f:4, of:8, col:'red'},
              {n:'Bane cult · martial revival', f:6, of:8, col:'red'},
              {n:'Daggerford lockdown', f:3, of:6, col:'gold'},
              {n:'Harper exposure (counter)', f:2, of:6, col:'blue'},
            ].map(c => (
              <div key={c.n}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span style={{fontSize: 13, fontFamily:'var(--serif)'}}>{c.n}</span>
                  <span className="stat">{c.f}/{c.of}</span>
                </div>
                <div className={`bar ${c.col}`} style={{marginTop: 2}}><span style={{width: `${(c.f/c.of)*100}%`}} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
        <div className="tabs" style={{margin: 0, border: 0}}>
          {['influence','agents','clocks','party-known'].map(l => (
            <div key={l} className={`tab ${layer===l?'active':''}`} onClick={()=>setLayer(l)}>{l}</div>
          ))}
        </div>
        <div className="row" style={{gap: 8}}>
          <span className="chip red"><span className="dot red" /> Zhent · Bane</span>
          <span className="chip blue"><span className="dot blue" /> Harpers · party</span>
          <span className="chip gold"><span className="dot gold" /> contested</span>
        </div>
      </div>

      <div className="map-wrap">
        <div className="map-bg" />
        <div className="coastline" />

        {/* influence blooms */}
        {layer === 'influence' && cities.map(c => (
          <React.Fragment key={c.id}>
            {c.red > 0 && (
              <div className="influence" style={{
                left: `${c.x}%`, top: `${c.y}%`,
                width: c.red * 2.4, height: c.red * 2.4,
                background: 'radial-gradient(closest-side, rgba(168,68,42,0.45), transparent)',
                transform: 'translate(-50%, -50%)'
              }} />
            )}
            {c.blue > 0 && (
              <div className="influence" style={{
                left: `${c.x}%`, top: `${c.y}%`,
                width: c.blue * 2, height: c.blue * 2,
                background: 'radial-gradient(closest-side, rgba(58,93,122,0.4), transparent)',
                transform: 'translate(-50%, -50%)'
              }} />
            )}
          </React.Fragment>
        ))}

        {/* pins */}
        {cities.map(c => (
          <div key={c.id} className={`pin ${c.ctrl === 'red' ? 'red' : c.ctrl === 'blue' ? 'blue' : 'gold'}`}
               style={{left: `${c.x}%`, top: `${c.y}%`}}>
            <div className="dot" />
            <div className="lbl">{c.n}</div>
          </div>
        ))}

        {layer === 'agents' && (
          <>
            <div className="pin red" style={{left: '36%', top: '55%'}}>
              <div className="dot" style={{width: 14, height: 14}} />
              <div className="lbl">Selvys → captured?</div>
            </div>
            <div className="pin red" style={{left: '70%', top: '42%'}}>
              <div className="dot" style={{width: 14, height: 14}} />
              <div className="lbl">Fzoul Chembryl</div>
            </div>
            <div className="pin blue" style={{left: '34%', top: '52%'}}>
              <div className="dot" style={{width: 14, height: 14}} />
              <div className="lbl">Lady Mireska</div>
            </div>
          </>
        )}

        <div className="hand" style={{position:'absolute', top: '14%', left: '60%', transform:'rotate(-3deg)', maxWidth: 180}}>
          Zhent corridor — they own this whole eastern spine
        </div>
        <div className="hand blue" style={{position:'absolute', top: '76%', left: '12%', transform:'rotate(2deg)', maxWidth: 180}}>
          Candlekeep is the only safe research stop
        </div>

        <div style={{position:'absolute', bottom: 12, left: 12, fontFamily:'var(--mono)', fontSize: 10, color:'var(--ink-3)', background:'var(--paper)', padding: '4px 8px', border: '1px solid var(--rule-soft)'}}>
          Faerûn · 3.5e map · pinch / drag (placeholder)
        </div>
      </div>

      {/* City detail */}
      <div className="section-title">Selected: Waterdeep · contested</div>
      <div className="grid-3">
        <div className="box">
          <div className="box-title"><h3>Influence</h3><span className="meta">live</span></div>
          <div className="col" style={{gap: 8}}>
            {[
              {n:'Zhentarim', v:45, col:'red'},
              {n:'Bane cult', v:12, col:'red'},
              {n:'Harpers', v:35, col:'blue'},
              {n:'Lords (open)', v:55, col:'gold'},
              {n:'Party (the Compact)', v:8, col:'green'},
            ].map(f => (
              <div key={f.n}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span style={{fontSize: 13}}>{f.n}</span>
                  <span className="stat">{f.v}</span>
                </div>
                <div className={`bar ${f.col}`}><span style={{width: `${f.v}%`}} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="box">
          <div className="box-title"><h3>Holdings</h3><span className="meta">who owns what</span></div>
          <ul style={{margin:0, paddingLeft: 16, fontSize: 13}}>
            <li><span className="dot red" /> Sunset Vault <span className="muted">(party hitting NOW)</span></li>
            <li><span className="dot red" /> Three docks · Trades Ward</li>
            <li><span className="dot blue" /> Yawning Portal back rooms</li>
            <li><span className="dot gold" /> Castle Waterdeep · Lords' seat</li>
            <li><span className="dot red" /> 4 safe houses (1 known to party)</li>
          </ul>
        </div>
        <div className="box">
          <div className="box-title"><h3>Pending ticks</h3><span className="meta">next 3 days</span></div>
          <div className="col" style={{gap: 6, fontSize: 13}}>
            <div><span className="chip red sm">+5</span> Zhent recovers vault loss <span className="muted">(if priestess escapes)</span></div>
            <div><span className="chip blue sm">+3</span> Harper expose · if party shares letters</div>
            <div><span className="chip gold sm">−2</span> Lords act · if vault haul becomes public</div>
          </div>
          <button className="btn primary sm" style={{marginTop: 10}}>simulate next tick →</button>
        </div>
      </div>
    </div>
  );
}

