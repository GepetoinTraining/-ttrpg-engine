// @ts-nocheck
'use client'

import React from 'react'
// surfaces/_adaptations.jsx — shared adaptation taxonomy for Gate / MonsterCamp / Ecology / Bestiary
// 10 adaptations from engine/ecology-pool.ts. Single glyph set so the vocabulary is consistent.

export const ADAPTATIONS = [
  {k: 'ARMORED', glyph: '◧', tag: '',     hint: 'thicker hide · DR'},
  {k: 'SWIFT',   glyph: '»', tag: 'blue', hint: '+10ft speed · evade'},
  {k: 'PACK',    glyph: '⁂', tag: '',     hint: 'group bonus · flank'},
  {k: 'REGEN',   glyph: '↻', tag: 'green',hint: 'heal 1d6 / round'},
  {k: 'STEALTH', glyph: '◐', tag: '',     hint: 'ambush · advantage hidden'},
  {k: 'REFLECT', glyph: '◇', tag: 'blue', hint: 'spell reflection · 25%'},
  {k: 'DRAIN',   glyph: '◍', tag: 'red',  hint: 'lifesteal on hit'},
  {k: 'SPLIT',   glyph: '⋈', tag: 'red',  hint: 'cleaves into two on death'},
  {k: 'ADAPT',   glyph: '✱', tag: 'gold', hint: 'gains immunity to last damage type'},
  {k: 'CUNNING', glyph: '∴', tag: 'gold', hint: 'tactical retreat · feint'},
];

// Pill-row of present adaptations (read-out)
export function AdaptChips({active}) {
  // active: array of adaptation keys, e.g. ['ARMORED','PACK','CUNNING']
  return (
    <div className="row" style={{gap: 6, flexWrap:'wrap'}}>
      {ADAPTATIONS.filter(a => (active || []).includes(a.k)).map(a => (
        <span key={a.k} className={`chip sm ${a.tag}`} title={a.hint}>
          <span style={{fontFamily:'var(--mono)', fontWeight: 600}}>{a.glyph}</span> {a.k.toLowerCase()}
        </span>
      ))}
      {(!active || active.length === 0) && (
        <span className="tiny muted">none expressed</span>
      )}
    </div>
  );
}

// Full 10-row weight bar table — for Ecology per-species cards
export function AdaptWeights({weights, normalize = true}) {
  // weights: { ARMORED: 0.3, SWIFT: 0.1, ... } — any 0..1 ish
  const total = ADAPTATIONS.reduce((s, a) => s + (weights[a.k] || 0), 0) || 1;
  return (
    <div className="col" style={{gap: 4}}>
      {ADAPTATIONS.map(a => {
        const v = weights[a.k] || 0;
        const pct = normalize ? (v / total) * 100 : v * 100;
        return (
          <div key={a.k} className="row" style={{gap: 8, alignItems:'center', fontFamily:'var(--mono)', fontSize: 10}}>
            <span style={{width: 14, textAlign:'center', color:`var(--accent-${a.tag||'ink'})`}}>{a.glyph}</span>
            <span style={{width: 64, color:'var(--ink-2)'}}>{a.k.toLowerCase()}</span>
            <div className={`bar ${a.tag}`} style={{flex: 1}}><span style={{width: `${pct}%`}} /></div>
            <span style={{width: 38, textAlign:'right', color:'var(--ink-3)'}}>{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Compact 10-cell legend — for surface header / overflow flag
export function AdaptLegend() {
  return (
    <div className="row" style={{gap: 6, flexWrap:'wrap'}}>
      {ADAPTATIONS.map(a => (
        <span key={a.k} className={`chip sm ${a.tag}`} style={{opacity: 0.7}}>
          <span style={{fontFamily:'var(--mono)', fontWeight: 600}}>{a.glyph}</span> {a.k.toLowerCase()}
        </span>
      ))}
    </div>
  );
}

