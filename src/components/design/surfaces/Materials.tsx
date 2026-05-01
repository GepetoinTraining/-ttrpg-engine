// @ts-nocheck
'use client'

import React from 'react'
import { FidelityBadge } from './_chips'

// surfaces/Materials.tsx — Surface 43. Slow-life: material knowledge.
// Reads engine/material-mastery.ts MaterialMasteryStore.

export default function Materials() {
  const [filter, setFilter] = React.useState('all') // all | studyable
  const mats = [
    {id:'iron',     name:'iron',           level: 2, hours: 18, firstSeen:'d-iron-1 · East Reach hills',  firstSeenDay: 388, depositVisible: 2},
    {id:'silver',   name:'silver',         level: 3, hours: 42, firstSeen:'d-silver-1 · Wheloon ridge',   firstSeenDay: 410, depositVisible: 3},
    {id:'stone',    name:'building stone', level: 1, hours: 6,  firstSeen:'d-stone-1 · Saerb quarry',     firstSeenDay: 422, depositVisible: 1},
    {id:'wool',     name:'wool',           level: 2, hours: 14, firstSeen:'h-sheep-1 · Saerb herd',       firstSeenDay: 440, depositVisible: 2},
    {id:'flax',     name:'flax',           level: 1, hours: 4,  firstSeen:'p-whel-1 · Wheloon edge',      firstSeenDay: 458, depositVisible: 1},
    {id:'cold-iron',name:'cold-iron',      level: 0, hours: 0,  firstSeen:'inferred · d-iron-1 affix hint',firstSeenDay: 466, depositVisible: 2},
    {id:'mythral',  name:'mythral',        level: 0, hours: 0,  firstSeen:'—',                            firstSeenDay: null, depositVisible: 0},
  ]

  const tiers = [
    {l: 0, t: 'name only',         d: 'you know it exists'},
    {l: 1, t: 'base properties',   d: 'weight, hardness, smelt point'},
    {l: 2, t: 'quality bands',     d: 'tell good from poor by feel'},
    {l: 3, t: 'hidden affixes',    d: 'detect rare modifiers'},
  ]

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">43 · L5 · slow-life · mastery</div>
          <h2>Material knowledge <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">what you've studied</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ study_material consumes hours. each level unlocks one tier of visibility on
        Deposits + crafted items.
      </div>

      <div className="grid-4" style={{marginBottom: 18}}>
        {tiers.map(t => (
          <div key={t.l} className="box">
            <div className="tiny">LEVEL {t.l}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 17, fontWeight: 600, marginTop: 4}}>{t.t}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{t.d}</div>
          </div>
        ))}
      </div>

      <div className="row" style={{gap: 8, marginBottom: 10, alignItems:'center'}}>
        <span className="tiny">FILTER</span>
        <span className={`chip sm ${filter==='all'?'solid':''}`} onClick={() => setFilter('all')}
              style={{cursor:'pointer'}}>all ({mats.length})</span>
        <span className={`chip sm ${filter==='studyable'?'solid':''}`} onClick={() => setFilter('studyable')}
              style={{cursor:'pointer'}}>studyable now ({mats.filter(m => m.level < m.depositVisible && m.level < 3).length})</span>
        <span className="tiny muted" style={{marginLeft: 8}}>studyable = deposit reveals more than your current mastery</span>
      </div>

      <table className="inv">
        <thead>
          <tr><th>Material</th><th>Mastery</th><th>Visible at this level</th><th>Provenance</th><th>Hours</th><th>Action</th></tr>
        </thead>
        <tbody>
          {mats.filter(m => filter === 'all' || (m.level < m.depositVisible && m.level < 3)).map(m => {
            const studyable = m.level < m.depositVisible && m.level < 3
            return (
              <tr key={m.id}>
                <td><b>{m.name}</b><div className="tiny muted">{m.id}</div></td>
                <td style={{minWidth: 100}}>
                  <div className="row" style={{gap: 4, alignItems:'center'}}>
                    {Array.from({length:3}).map((_,i) => (
                      <span key={i} style={{color: i<m.level ? 'var(--accent-gold)' : 'var(--ink-4)'}}>●</span>
                    ))}
                    <span className="tiny" style={{marginLeft: 4}}>{m.level}/3</span>
                  </div>
                </td>
                <td className="muted" style={{fontSize: 13}}>{tiers[m.level].t}</td>
                <td style={{fontSize: 12}}>
                  <div style={{fontFamily:'var(--mono)'}}>{m.firstSeen}</div>
                  {m.firstSeenDay && <div className="tiny muted">first seen day {m.firstSeenDay}</div>}
                </td>
                <td className="stat">{m.hours}h</td>
                <td>
                  <button className={`btn sm ${studyable ? 'primary' : ''}`} disabled={m.level >= 3 || m.depositVisible <= m.level}>
                    {m.level >= 3 ? 'mastered'
                      : m.depositVisible <= m.level ? 'need deeper deposit visibility'
                      : 'study_material'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="aside blue" style={{marginTop: 14, fontSize: 15}}>
        ↳ study without a tutor caps at 2; level 3 needs a master craftsman or rare text.
      </div>
    </div>
  )
}
