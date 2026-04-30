// @ts-nocheck
'use client'

import React from 'react'
import { AdaptChips, AdaptWeights, AdaptLegend } from './_adaptations'

// surfaces/Ecology.jsx — Surface 38. Region-scoped species evolution.
// Reads engine/ecology-pool.ts via getAdaptationPool(tp, regionNodeId, speciesId).
// Aesthetic: wildlife field guide. More whitespace; less chip noise.

export default function Ecology() {
  const region = {
    name: 'Eastern Cormyr · Cormanthor reach',
    biome: [
      {n:'forest', pct: 48, tag:'green'},
      {n:'hills',  pct: 24, tag:'gold'},
      {n:'plain',  pct: 18, tag:''},
      {n:'fen',    pct: 10, tag:'blue'},
    ],
    danger: 0.62,
    dominantThreats: ['orc','ettin','goblin','undead'],
  };

  const species = [
    {id:'goblin', name:'goblin', gen: 14, baseCR: '1/4', kingdom:'humanoid',
     weights:{ARMORED:0.10, SWIFT:0.32, PACK:0.28, REGEN:0.02, STEALTH:0.20, REFLECT:0.00, DRAIN:0.00, SPLIT:0.00, ADAPT:0.05, CUNNING:0.20},
     fitness:{spawned: 412, survivedClears: 38, casualties: 24, lastSeenAtGen: 14}},
    {id:'orc', name:'orc', gen: 11, baseCR: '1/2', kingdom:'humanoid',
     weights:{ARMORED:0.30, SWIFT:0.10, PACK:0.34, REGEN:0.04, STEALTH:0.04, REFLECT:0.00, DRAIN:0.06, SPLIT:0.00, ADAPT:0.10, CUNNING:0.18},
     fitness:{spawned: 188, survivedClears: 22, casualties: 41, lastSeenAtGen: 11}},
    {id:'ettin', name:'ettin', gen: 7, baseCR: '4', kingdom:'giant',
     weights:{ARMORED:0.42, SWIFT:0.06, PACK:0.18, REGEN:0.10, STEALTH:0.00, REFLECT:0.00, DRAIN:0.00, SPLIT:0.00, ADAPT:0.20, CUNNING:0.24},
     fitness:{spawned: 14, survivedClears: 4, casualties: 2, lastSeenAtGen: 7}},
    {id:'wight', name:'wight', gen: 9, baseCR: '3', kingdom:'undead',
     weights:{ARMORED:0.18, SWIFT:0.14, PACK:0.10, REGEN:0.20, STEALTH:0.16, REFLECT:0.04, DRAIN:0.36, SPLIT:0.00, ADAPT:0.12, CUNNING:0.10},
     fitness:{spawned: 38, survivedClears: 9, casualties: 6, lastSeenAtGen: 9}},
  ];

  const [sel, setSel] = React.useState('ettin');
  const cur = species.find(s => s.id === sel);

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">38 · L5 · region · ecology pool</div>
          <h2>Ecology · {region.name}</h2>
        </div>
        <span className="who">field-guide view · what's evolving here</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 22}}>
        ↳ engine/ecology-pool.ts maintains a per-species adaptation pool per region.
        every clear &amp; survival shifts weights. read this like a naturalist's logbook —
        it's <i>natural history</i>, not a stat block.
      </div>

      {/* region header */}
      <div className="grid-3" style={{gap: 14, marginBottom: 22}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="tiny">BIOME COMPOSITION</div>
          <div className="row" style={{height: 28, border:'1px solid var(--rule)', overflow:'hidden', marginTop: 6, gap: 0}}>
            {region.biome.map(b => (
              <div key={b.n} title={`${b.n} · ${b.pct}%`} style={{
                width: `${b.pct}%`,
                background: b.tag ? `var(--accent-${b.tag})` : 'var(--ink-3)',
                opacity: 0.55,
                color:'var(--paper)',
                fontFamily:'var(--mono)', fontSize: 10, letterSpacing:'0.06em',
                display:'flex', alignItems:'center', justifyContent:'center',
                borderRight:'1px solid var(--paper)',
              }}>{b.pct}%</div>
            ))}
          </div>
          <div className="row" style={{gap: 12, marginTop: 6, flexWrap:'wrap'}}>
            {region.biome.map(b => (
              <span key={b.n} className="tiny"><span className={`dot ${b.tag}`} style={{marginRight: 4}}/>{b.n}</span>
            ))}
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Region danger</h3><span className="meta">{(region.danger*100).toFixed(0)}/100</span></div>
          <div className="bar red"><span style={{width: `${region.danger*100}%`}} /></div>
          <div className="tiny" style={{marginTop: 6}}>elevated · gate overflow active</div>
          <hr className="rule dashed" />
          <div className="tiny" style={{marginBottom: 4}}>DOMINANT THREATS</div>
          <div className="row" style={{gap: 4, flexWrap:'wrap'}}>
            {region.dominantThreats.map(t => <span key={t} className="chip sm">{t}</span>)}
          </div>
        </div>
      </div>

      {/* species list + selected detail */}
      <div className="section-title">Species under observation · {species.length}</div>

      <div className="grid-2" style={{gap: 18, alignItems:'flex-start'}}>
        {/* left: list of cards */}
        <div className="col" style={{gap: 10}}>
          {species.map(s => (
            <div key={s.id} className="box"
                 onClick={() => setSel(s.id)}
                 style={{cursor:'pointer', padding: 14,
                         borderColor: sel===s.id ? 'var(--rule)' : 'var(--rule-soft)',
                         background: sel===s.id ? 'var(--paper-2)' : 'var(--paper)'}}>
              <div className="row" style={{gap: 14, alignItems:'flex-start'}}>
                <div className="placeholder" style={{width: 64, height: 64, minHeight: 64, padding: 0, flexShrink: 0}}>
                  sprite
                </div>
                <div style={{flex: 1}}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                    <span style={{fontFamily:'var(--serif)', fontSize: 20, fontWeight: 600, fontStyle:'italic'}}>{s.name}</span>
                    <span className="tiny">CR {s.baseCR} · {s.kingdom}</span>
                  </div>
                  <div className="hand ink" style={{fontSize: 17, marginTop: 2}}>generation {s.gen}</div>
                  <div className="row" style={{gap: 12, marginTop: 6, fontFamily:'var(--mono)', fontSize: 10, color:'var(--ink-3)'}}>
                    <span>spawned {s.fitness.spawned}</span>
                    <span>survived {s.fitness.survivedClears}</span>
                    <span>casualties {s.fitness.casualties}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* right: weights detail */}
        <div className="box" style={{position:'sticky', top: 20}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
            <div>
              <div className="tiny">ADAPTATION POOL · GEN {cur.gen}</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 22, fontStyle:'italic', fontWeight: 600, marginTop: 2}}>{cur.name}</div>
            </div>
            <span className="chip">CR {cur.baseCR}</span>
          </div>
          <hr className="rule dashed" />
          <AdaptWeights weights={cur.weights} normalize={true} />
          <hr className="rule dashed" />
          <div className="tiny">FITNESS LOG</div>
          <div className="grid-2" style={{gap: 4, marginTop: 4, fontSize: 13}}>
            <div className="row" style={{justifyContent:'space-between'}}><span>spawned</span><span className="stat"><b>{cur.fitness.spawned}</b></span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>survived clears</span><span className="stat"><b>{cur.fitness.survivedClears}</b></span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>caused casualties</span><span className="stat"><b>{cur.fitness.casualties}</b></span></div>
            <div className="row" style={{justifyContent:'space-between'}}><span>last seen at gen</span><span className="stat"><b>{cur.fitness.lastSeenAtGen}</b></span></div>
          </div>

          <div className="section-title" style={{margin:'18px 0 8px'}}>Adaptation pool history</div>
          <div className="placeholder" style={{height: 120}}>
            line chart · pool weights × generation
          </div>

          <div className="aside" style={{marginTop: 12, fontSize: 15}}>
            ↳ next clear hardens dominant trait. <i>{cur.name}</i>'s next gen will lean harder into{' '}
            {Object.entries(cur.weights).sort((a,b)=>b[1]-a[1])[0][0].toLowerCase()}.
          </div>
        </div>
      </div>
    </div>
  );
}

