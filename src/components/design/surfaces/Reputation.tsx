// @ts-nocheck
'use client'

import React from 'react'
import { loadCharacterReputation, type RepMatrix } from '@/lib/reputation'
import { getActiveCharacter } from '@/lib/character'

// surfaces/Reputation.tsx — Per-PC faction reputation matrix.
// Live data: /api/reputation/character/:id reads reputations table.
// MODEL: party rep dampens PC delta. dampen(p) = 1 - |p|/200.
// 'character' subject deltas multiply by dampen(party_score) at write time.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Reputation() {
  const [tab, setTab] = React.useState('matrix');
  const [live, setLive] = React.useState<RepMatrix | null>(null)
  const [characterId, setCharacterId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    const charId = getActiveCharacter(cid)
    setCharacterId(charId)
    if (charId) {
      loadCharacterReputation(charId).then(setLive).catch(e => setError(e?.message ?? 'load failed'))
    }
  }, [])

  const factions = [
    {id:'zhent',  n:'Zhentarim',         c:'red'},
    {id:'crown',  n:'Cormyrean Crown',   c:'blue'},
    {id:'wizards',n:'War Wizards',       c:'blue'},
    {id:'harper', n:'Harpers',           c:'green'},
    {id:'lords',  n:"Lords' Alliance",   c:'blue'},
    {id:'cult',   n:'Cult of the Dragon',c:'red'},
    {id:'banite', n:'Church of Bane',    c:'red'},
    {id:'tymora', n:'Church of Tymora',  c:'green'},
    {id:'crowns', n:'House Crownsilver', c:'gold'},
    {id:'aldreth',n:'Aldreth Bros',      c:'gold'},
  ];

  const pcs = ['Kaelith','Doruk','Vessa','Aramil'];

  // -100..+100
  const rep = {
    Kaelith: {zhent:-72, crown:-22, wizards:-10, harper:18,  lords:-4,  cult:-20, banite:-88, tymora:8,   crowns:-12, aldreth:24},
    Doruk:   {zhent:-44, crown: 32, wizards: 14, harper: 6,  lords: 28, cult:-60, banite:-92, tymora:42,  crowns: 8,  aldreth:10},
    Vessa:   {zhent:-30, crown: 8,  wizards: 56, harper:22,  lords: 12, cult:-40, banite:-30, tymora:0,   crowns: 18, aldreth:6},
    Aramil:  {zhent:-12, crown:-30, wizards:-8,  harper: 0,  lords:-22, cult: 0,  banite:-10, tymora:4,   crowns:-6,  aldreth:0},
  };

  const cell = (v) => {
    const ab = Math.min(100, Math.abs(v));
    const bg = v > 0 ? `rgba(77,106,58,${0.08 + ab/300})` : v < 0 ? `rgba(168,68,42,${0.08 + ab/300})` : 'transparent';
    const col = v > 30 ? 'var(--accent-green)' : v < -30 ? 'var(--accent-red)' : 'var(--ink-2)';
    return (
      <td style={{background:bg, textAlign:'center'}}>
        <div className="stat" style={{color: col}}><b>{v>0?'+':''}{v}</b></div>
        <div style={{height: 3, background:'rgba(0,0,0,0.06)', position:'relative', marginTop: 2}}>
          <div style={{position:'absolute', left:'50%', top:0, height:'100%', width: `${ab/2}%`,
                       transform: v < 0 ? 'translateX(-100%)' : 'none', background: col}} />
        </div>
      </td>
    );
  };

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">21 · World · faction reputation</div>
          <h2>Reputation Matrix</h2>
        </div>
        <span className="who">per-PC · per-faction · −100…+100</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ Cards (04) shows narrative faction snippets. <b>This is the math.</b>
        engine/faction.ts carries a signed integer per PC × faction; thresholds gate
        prices, hooks, sanctuary, hostility.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live reputation</h3>
          <span className="meta">→ /api/reputation/character/{characterId?.slice(0,8) ?? '…'} · party dampens PC delta · dampen(p) = 1 − |p|/200</span>
        </div>
        {!characterId && <div className="tiny muted">no active character — set one via Sheet (14)</div>}
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {live && (
          <>
            <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, marginBottom: 8, flexWrap:'wrap'}}>
              <span><b>{live.character.name}</b></span>
              {live.partyId ? (
                <span className="muted">party {live.partyId.slice(0, 8)}…</span>
              ) : (
                <span className="muted">no party (party_members row missing)</span>
              )}
              <span>factions <b>{live.matrix.length}</b></span>
              <span>recent deltas <b>{live.recent.length}</b></span>
            </div>
            {live.matrix.length > 0 ? (
              <table className="inv" style={{fontSize: 12}}>
                <thead><tr><th>faction</th><th>PC</th><th>party</th><th>dampen</th></tr></thead>
                <tbody>
                  {live.matrix.map((m) => {
                    const dampen = 1 - Math.abs(m.partyScore) / 200
                    return (
                      <tr key={m.factionId}>
                        <td><b>{m.factionName}</b> <span className="muted">· {m.factionType}</span></td>
                        <td style={{color: m.pcScore > 0 ? 'var(--accent-green)' : m.pcScore < 0 ? 'var(--accent-red)' : 'var(--ink)'}}>
                          {m.pcScore > 0 ? '+' : ''}{m.pcScore.toFixed(0)}
                        </td>
                        <td style={{color: m.partyScore > 0 ? 'var(--accent-green)' : m.partyScore < 0 ? 'var(--accent-red)' : 'var(--ink)'}}>
                          {m.partyScore > 0 ? '+' : ''}{m.partyScore.toFixed(0)}
                        </td>
                        <td className="muted">×{dampen.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="tiny muted">no factions in DB · seed Faerûn factions and the matrix below comes alive</div>
            )}
            {live.recent.length > 0 && (
              <div style={{marginTop: 10}}>
                <div className="tiny" style={{marginBottom: 4}}>RECENT DELTAS</div>
                <div className="col" style={{gap: 2, fontFamily:'var(--mono)', fontSize: 11}}>
                  {live.recent.slice(0, 5).map((d) => (
                    <div key={d.id} className="row" style={{justifyContent:'space-between'}}>
                      <span>{d.factionId.slice(0, 8)}… · base {d.baseDelta > 0 ? '+' : ''}{d.baseDelta} → applied {d.appliedDelta > 0 ? '+' : ''}{d.appliedDelta.toFixed(1)}</span>
                      <span className="muted">{d.reason ?? ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="tabs">
        {[['matrix','Matrix'],['thresholds','Thresholds'],['history','History · per faction']].map(([k,l]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</div>
        ))}
      </div>

      {tab === 'matrix' && (
        <div className="box" style={{padding: 0, overflow:'hidden'}}>
          <table className="inv">
            <thead>
              <tr>
                <th style={{width: 200}}>Faction</th>
                {pcs.map(p => <th key={p} style={{textAlign:'center'}}>{p}</th>)}
                <th style={{textAlign:'center'}}>Party avg</th>
              </tr>
            </thead>
            <tbody>
              {factions.map(f => {
                const vals = pcs.map(p => rep[p][f.id]);
                const avg = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
                return (
                  <tr key={f.id}>
                    <td><span className={`dot ${f.c}`} /> <b>{f.n}</b></td>
                    {pcs.map((p, i) => <React.Fragment key={p}>{cell(vals[i])}</React.Fragment>)}
                    {cell(avg)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'thresholds' && (
        <div className="grid-2">
          <div className="box">
            <div className="box-title"><h3>Default thresholds</h3><span className="meta">global</span></div>
            <table className="inv">
              <thead><tr><th>Score</th><th>Status</th><th>Effect</th></tr></thead>
              <tbody>
                <tr><td className="stat"><b>+75…+100</b></td><td><span className="chip green sm">exalted</span></td><td>sanctuary · price ×0.7 · plot hooks</td></tr>
                <tr><td className="stat"><b>+40…+74</b></td><td><span className="chip green sm">allied</span></td><td>price ×0.85 · favors callable</td></tr>
                <tr><td className="stat"><b>+10…+39</b></td><td><span className="chip sm">friendly</span></td><td>info shared · normal price</td></tr>
                <tr><td className="stat"><b>−9…+9</b></td><td><span className="chip sm">neutral</span></td><td>standard interactions</td></tr>
                <tr><td className="stat"><b>−39…−10</b></td><td><span className="chip gold sm">wary</span></td><td>price ×1.15 · refuses some asks</td></tr>
                <tr><td className="stat"><b>−74…−40</b></td><td><span className="chip red sm">hostile</span></td><td>refuses service · maybe attack</td></tr>
                <tr><td className="stat"><b>−100…−75</b></td><td><span className="chip red sm">hunted</span></td><td>kill on sight · bounty</td></tr>
              </tbody>
            </table>
          </div>
          <div className="box">
            <div className="box-title"><h3>Kaelith · current statuses</h3><span className="meta">applied now</span></div>
            <div className="col" style={{gap: 6, fontSize: 14}}>
              <div className="row" style={{justifyContent:'space-between'}}><span>Zhentarim</span><span className="chip red sm">hostile</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Church of Bane</span><span className="chip red sm">hunted</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Aldreth Bros</span><span className="chip sm">friendly</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Harpers</span><span className="chip sm">friendly</span></div>
              <div className="row" style={{justifyContent:'space-between'}}><span>Cormyrean Crown</span><span className="chip gold sm">wary</span></div>
            </div>
            <div className="aside" style={{marginTop: 10, fontSize: 16}}>
              ↳ Selvys on sight: <b>−92 with Banite</b> means immediate combat or capture.
            </div>
          </div>

          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="box-title"><h3>Cross-faction rivalry rules</h3><span className="meta">earning one costs another</span></div>
            <table className="inv">
              <thead><tr><th>Gain with</th><th>Costs you (per +10)</th><th>Notes</th></tr></thead>
              <tbody>
                <tr><td>Harpers</td><td>−4 Zhent, −2 Cult</td><td className="muted">historical opposition</td></tr>
                <tr><td>Crown</td><td>−6 Zhent, −2 cells</td><td className="muted">law-and-order alignment</td></tr>
                <tr><td>Bane</td><td>−10 Tymora, −6 Crown</td><td className="muted">religious + lawful tension</td></tr>
                <tr><td>Crownsilver</td><td>−2 other Cormyr nobles</td><td className="muted">noble rivalry</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div className="row" style={{gap: 6, marginBottom: 14}}>
            <span className="chip red solid">Zhentarim</span>
            <span className="chip">Crown</span>
            <span className="chip">Harpers</span>
            <span className="chip">Bane</span>
            <span className="chip">Aldreth</span>
          </div>
          <div className="box dark">
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
              <div>
                <div className="tiny" style={{color:'var(--paper-3)'}}>KAELITH × ZHENTARIM</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 22, fontWeight: 600}}>−72 · hostile</div>
              </div>
              <div className="tiny" style={{color:'var(--paper-3)'}}>arc 01 → today · 14 sessions</div>
            </div>
            {/* Sparkline */}
            <div style={{position:'relative', height: 80, marginTop: 14, borderTop: '1px solid var(--ink-3)', borderBottom: '1px solid var(--ink-3)'}}>
              <div style={{position:'absolute', left:0, right:0, top:'50%', borderTop:'1px dashed var(--paper-3)'}} />
              <svg viewBox="0 0 100 80" preserveAspectRatio="none" style={{width:'100%', height:'100%'}}>
                <polyline fill="none" stroke="var(--accent-red)" strokeWidth="0.6"
                  points="0,40 8,38 16,30 24,28 32,42 40,52 48,58 56,60 64,68 72,62 80,70 88,68 96,72 100,72" />
              </svg>
            </div>
            <div className="row" style={{justifyContent:'space-between', marginTop: 6, fontFamily:'var(--mono)', fontSize: 10, color:'var(--paper-3)'}}>
              <span>arc 01</span>
              <span>+0</span>
              <span>−40</span>
              <span>arc 02 · NOW −72</span>
            </div>
          </div>
          <div className="section-title">Δ events · Kaelith × Zhentarim</div>
          <div className="col" style={{gap: 6}}>
            {[
              {d:'Eleasis 17', t:'session 14', e:'Sunset Vault contested · −12'},
              {d:'Eleasis 12', t:'session 13', e:'killed enforcer Brask · −8'},
              {d:'Eleasis 5',  t:'session 12', e:'Old Pell rescued from Zhent torture · −20'},
              {d:'Kythorn 28', t:'session 09', e:'declined Manshoon contract · −10'},
              {d:'Kythorn 14', t:'session 06', e:'sold forged ledger to Harpers · −18'},
              {d:'Mirtul 3',   t:'session 02', e:'first Mulmaster encounter · −4'},
            ].map((x, i) => (
              <div key={i} className="row" style={{gap: 12, padding: '8px 0', borderBottom: '1px dashed var(--rule-soft)'}}>
                <span style={{width: 110, fontFamily:'var(--mono)', fontSize: 11}}><b>{x.d}</b><br/><span className="muted">{x.t}</span></span>
                <span style={{flex: 1, fontSize: 14}}>{x.e}</span>
                <button className="btn sm">→ tpb</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

