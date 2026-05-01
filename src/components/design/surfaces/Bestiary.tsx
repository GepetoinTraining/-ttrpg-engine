// @ts-nocheck
'use client'

import React from 'react'
import { FidelityBadge } from './_chips'
import { ADAPTATIONS } from './_adaptations'

// surfaces/Bestiary.tsx — Surface 39. Sprite QA + species reference grid.
// Reads engine/biome-fauna.ts SPECIES_TABLE + src/lib/sprite/generator.ts.
// Dev tool aesthetic: minimal flourish, dense card grid.

const SPECIES_TABLE = [
  // 28 species per spec. id, name, baseCR, size, kingdom, color
  {id:'goblin',     name:'goblin',      cr:'1/4', size:'S', kingdom:'humanoid', color:'green'},
  {id:'kobold',     name:'kobold',      cr:'1/8', size:'S', kingdom:'humanoid', color:'red'},
  {id:'orc',        name:'orc',         cr:'1/2', size:'M', kingdom:'humanoid', color:'green'},
  {id:'hobgoblin',  name:'hobgoblin',   cr:'1/2', size:'M', kingdom:'humanoid', color:'red'},
  {id:'gnoll',      name:'gnoll',       cr:'1/2', size:'M', kingdom:'humanoid', color:'gold'},
  {id:'bugbear',    name:'bugbear',     cr:'1',   size:'M', kingdom:'humanoid', color:''},
  {id:'ogre',       name:'ogre',        cr:'2',   size:'L', kingdom:'giant',    color:'gold'},
  {id:'ettin',      name:'ettin',       cr:'4',   size:'L', kingdom:'giant',    color:'red'},
  {id:'troll',      name:'troll',       cr:'5',   size:'L', kingdom:'giant',    color:'green'},
  {id:'hill-giant', name:'hill giant',  cr:'5',   size:'H', kingdom:'giant',    color:'gold'},
  {id:'wolf',       name:'wolf',        cr:'1/4', size:'M', kingdom:'beast',    color:''},
  {id:'dire-wolf',  name:'dire wolf',   cr:'1',   size:'L', kingdom:'beast',    color:''},
  {id:'bear',       name:'bear',        cr:'1',   size:'L', kingdom:'beast',    color:'gold'},
  {id:'boar',       name:'boar',        cr:'1/4', size:'M', kingdom:'beast',    color:'gold'},
  {id:'spider',     name:'giant spider',cr:'1',   size:'L', kingdom:'beast',    color:''},
  {id:'snake',      name:'giant snake', cr:'2',   size:'L', kingdom:'beast',    color:'green'},
  {id:'skeleton',   name:'skeleton',    cr:'1/4', size:'M', kingdom:'undead',   color:''},
  {id:'zombie',     name:'zombie',      cr:'1/4', size:'M', kingdom:'undead',   color:'green'},
  {id:'ghoul',      name:'ghoul',       cr:'1',   size:'M', kingdom:'undead',   color:'red'},
  {id:'wight',      name:'wight',       cr:'3',   size:'M', kingdom:'undead',   color:'blue'},
  {id:'wraith',     name:'wraith',      cr:'5',   size:'M', kingdom:'undead',   color:'blue'},
  {id:'lich',       name:'lich',        cr:'21',  size:'M', kingdom:'undead',   color:'red'},
  {id:'imp',        name:'imp',         cr:'1',   size:'T', kingdom:'planar',   color:'red'},
  {id:'mephit',     name:'mephit',      cr:'1/2', size:'S', kingdom:'planar',   color:'blue'},
  {id:'demon',      name:'lesser demon',cr:'5',   size:'L', kingdom:'planar',   color:'red'},
  {id:'oni',        name:'oni',         cr:'7',   size:'L', kingdom:'planar',   color:'blue'},
  {id:'gibbering',  name:'gibberer',    cr:'2',   size:'M', kingdom:'aberrant', color:'gold'},
  {id:'beholder',   name:'beholder',    cr:'13',  size:'L', kingdom:'aberrant', color:'red'},
]

const ADAPT_KEYS = ADAPTATIONS.map(a => a.k)
const SIZES = ['T','S','M','L','H','G']

function SpeciesCell({s, onClick, selected}) {
  return (
    <div className="sprite-card"
         onClick={onClick}
         style={{cursor:'pointer',
                 borderColor: selected ? 'var(--rule)' : 'var(--rule-soft)',
                 boxShadow: selected ? '2px 2px 0 var(--ink)' : 'none'}}>
      <div className="sprite-cell" style={{width: 80, height: 80}}>
        <div className="sprite-grid-bg" />
        <div style={{
          position:'relative', width: 38, height: 38, borderRadius:'50%',
          background: s.color ? `var(--accent-${s.color})` : 'var(--ink-3)',
          opacity: 0.85,
          border:'2px solid var(--paper)',
          boxShadow:'0 0 0 1px var(--ink-2)',
          display:'grid', placeItems:'center',
          color:'var(--paper)', fontFamily:'var(--mono)', fontSize: 10, fontWeight: 600,
        }}>{s.id.slice(0,2).toUpperCase()}</div>
      </div>
      <div className="sprite-meta">
        <div className="sprite-name">{s.color && <span className={`dot ${s.color}`}/>}{s.name}</div>
        <div className="sprite-role">CR {s.cr} · {s.size} · {s.kingdom}</div>
        <div className="sprite-path">{s.id}.svg</div>
      </div>
    </div>
  )
}

export default function Bestiary() {
  const [sel, setSel] = React.useState(null)
  const [colorOverride, setColorOverride] = React.useState(null)
  const cur = SPECIES_TABLE.find(s => s.id === sel)

  // group by kingdom
  const groups = {}
  SPECIES_TABLE.forEach(s => { (groups[s.kingdom] = groups[s.kingdom] || []).push(s) })

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">39 · L5 · sprite QA · SPECIES_TABLE</div>
          <h2>Bestiary · sprite generator reference <FidelityBadge level="draft" /></h2>
        </div>
        <span className="who">dev tool · 28 species × 10 adaptations</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ visual QA for the procedural sprite generator. each species renders an 8-direction sheet
        via <code>generateMonsterSprite()</code>; clicking opens the 10-adaptation overlay grid +
        every D&amp;D size.
      </div>

      <div className="row" style={{gap: 14, marginTop: 6, flexWrap:'wrap', alignItems:'center'}}>
        <span className="chip solid">{SPECIES_TABLE.length} species</span>
        <span className="chip">{Object.keys(groups).length} kingdoms</span>
        <span className="chip blue">8-dir sheets</span>
        <span className="chip gold">10 adaptation overlays</span>
        <span className="tiny" style={{marginLeft: 'auto'}}>uses chip+portrait architecture · project_sprite_spec</span>
      </div>

      {Object.entries(groups).map(([kingdom, list]) => (
        <div key={kingdom} className="sprite-group">
          <div className="section-title">{kingdom} · {list.length}</div>
          <div className="sprite-grid">
            {list.map(s => (
              <SpeciesCell key={s.id} s={s} selected={sel===s.id} onClick={() => setSel(s.id)} />
            ))}
          </div>
        </div>
      ))}

      {/* detail drawer */}
      {cur && (
        <div className="box" style={{
          position:'fixed', right: 20, top: 20, bottom: 20, width: 460, zIndex: 50,
          background:'var(--paper)', boxShadow:'-4px 0 0 var(--ink), -4px 0 0 6px var(--paper-2)',
          overflow:'auto',
        }}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div className="tiny">SPECIES · {cur.id}</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 26, fontStyle:'italic', fontWeight: 600, marginTop: 2}}>{cur.name}</div>
              <div className="tiny muted" style={{marginTop: 2}}>CR {cur.cr} · size {cur.size} · {cur.kingdom}</div>
            </div>
            <button className="btn sm" onClick={() => setSel(null)}>close ✕</button>
          </div>

          <div className="section-title" style={{margin:'18px 0 8px'}}>8-direction sheet</div>
          <div className="box soft" style={{padding: 8, background:'var(--paper-2)'}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 6}}>
              {['N','NE','E','SE','S','SW','W','NW'].map((dir, i) => {
                const angle = i * 45
                const dx = Math.round(Math.sin(angle * Math.PI/180) * 10)
                const dy = -Math.round(Math.cos(angle * Math.PI/180) * 10)
                return (
                  <div key={dir} className="sprite-cell" style={{aspectRatio:'1'}}>
                    <div className="sprite-grid-bg" />
                    <div style={{
                      position:'relative', width:'48%', aspectRatio:'1', borderRadius:'50%',
                      background: (colorOverride || cur.color) ? `var(--accent-${colorOverride || cur.color})` : 'var(--ink-3)',
                      opacity: 0.85, border:'2px solid var(--paper)',
                      boxShadow:'0 0 0 1px var(--ink-2)',
                    }}>
                      <div style={{
                        position:'absolute', left: '50%', top: '50%',
                        width: 4, height: 4, background:'var(--paper)', borderRadius: '50%',
                        transform: `translate(${dx - 2}px, ${dy - 2}px)`,
                      }} />
                    </div>
                    <div className="tiny" style={{
                      position:'absolute', top: 2, left: 4, fontFamily:'var(--mono)',
                      fontSize: 8, color:'var(--ink-3)',
                    }}>{dir}</div>
                  </div>
                )
              })}
            </div>
            <div className="tiny" style={{marginTop: 6, textAlign:'center'}}>
              eye-glint indicates facing · N / NE / E / SE / S / SW / W / NW
            </div>
          </div>

          <div className="section-title" style={{margin:'18px 0 8px'}}>Adaptation overlays · 10</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 6}}>
            {ADAPT_KEYS.map((k) => {
              const a = ADAPTATIONS.find(x => x.k === k)
              return (
                <div key={k} className="sprite-cell" style={{width:'100%', aspectRatio:'1', minHeight: 70}}>
                  <div className="sprite-grid-bg" />
                  <div style={{
                    position:'relative', width: '60%', height: '60%', borderRadius:'50%',
                    background: cur.color ? `var(--accent-${cur.color})` : 'var(--ink-3)',
                    opacity: 0.85, border:'2px solid var(--paper)',
                    display:'grid', placeItems:'center',
                    color:'var(--paper)', fontFamily:'var(--mono)', fontSize: 14, fontWeight: 600,
                  }}>{a.glyph}</div>
                  <div className="tiny" style={{
                    position:'absolute', bottom: 2, left: 0, right: 0,
                    textAlign:'center', fontSize: 8, letterSpacing:'0.04em',
                  }}>{k.toLowerCase()}</div>
                </div>
              )
            })}
          </div>

          <div className="section-title" style={{margin:'18px 0 8px'}}>Sizes · D&amp;D 6</div>
          <div className="row" style={{gap: 6, alignItems:'flex-end'}}>
            {SIZES.map(sz => {
              const px = {T: 22, S: 30, M: 38, L: 54, H: 70, G: 90}[sz]
              return (
                <div key={sz} style={{flex: 1, textAlign:'center'}}>
                  <div className="sprite-cell" style={{width:'100%', height: 100}}>
                    <div className="sprite-grid-bg" />
                    <div style={{
                      position:'relative', width: px, height: px, borderRadius:'50%',
                      background: cur.color ? `var(--accent-${cur.color})` : 'var(--ink-3)',
                      opacity: 0.85, border:'2px solid var(--paper)',
                    }} />
                  </div>
                  <div className="tiny" style={{marginTop: 4, fontWeight: cur.size===sz?600:400, color: cur.size===sz?'var(--ink)':'var(--ink-3)'}}>{sz}</div>
                </div>
              )
            })}
          </div>

          <div className="section-title" style={{margin:'18px 0 8px'}}>Color override</div>
          <div className="row" style={{gap: 6, flexWrap:'wrap'}}>
            {['','red','blue','gold','green'].map(c => (
              <span key={c||'none'} className={`chip ${c}`}
                    onClick={() => setColorOverride(c)}
                    style={{cursor:'pointer', background: colorOverride===c ? 'var(--paper-2)' : 'var(--paper)'}}>
                {c || 'default'}
              </span>
            ))}
          </div>

          <div className="aside blue" style={{marginTop: 14, fontSize: 15}}>
            ↳ render uses generateMonsterSprite(speciesId, {`{`} adaptations, color {`}`}). placeholders here pending wire-up.
          </div>
        </div>
      )}
    </div>
  )
}
