// @ts-nocheck
'use client'

import React from 'react'
// surfaces/Cards.jsx — Campaign cards (Arcs, Locations, Factions)

export default function Cards() {
  const [tab, setTab] = React.useState('arcs');

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">04 · Campaign authoring</div>
          <h2>Campaign Cards</h2>
        </div>
        <span className="who">DM authors · all see read-only</span>
      </div>

      <p style={{maxWidth: 720, color: 'var(--ink-2)', marginTop: 0}}>
        Only <b>Arcs</b>, <b>Locations</b>, and <b>Factions</b> are full cards. Everything else
        (NPCs, items, quests, encounters) lives as small JSON stat blocks the AI can read
        but humans don't manage by hand.
      </p>

      <div className="tabs">
        <div className={`tab ${tab==='arcs'?'active':''}`} onClick={()=>setTab('arcs')}>Arcs · 3</div>
        <div className={`tab ${tab==='locations'?'active':''}`} onClick={()=>setTab('locations')}>Locations · 12</div>
        <div className={`tab ${tab==='factions'?'active':''}`} onClick={()=>setTab('factions')}>Factions · 6</div>
        <div className={`tab ${tab==='blocks'?'active':''}`} onClick={()=>setTab('blocks')}>JSON stat blocks</div>
      </div>

      {tab === 'arcs' && (
        <div className="grid-3">
          {[
            {n:'I · The Mulmaster Debt', s:'closed', col:'green', sess:'1–6', stakes:'low → personal'},
            {n:'II · The Sunset Vault', s:'active', col:'red', sess:'7–14', stakes:'regional'},
            {n:'III · Manshoon Ascendant', s:'looming', col:'gold', sess:'15–?', stakes:'continental'},
          ].map(a => (
            <div key={a.n} className="card">
              <div className="head">
                <h4>{a.n}</h4>
                <span className={`chip ${a.col}`}>{a.s}</span>
              </div>
              <div className="tiny">sessions {a.sess} · {a.stakes}</div>
              <p>
                {a.s==='closed' && 'Resolved. Kaelith\'s old fence cleared. Manshoon now knows the party exists.'}
                {a.s==='active' && 'Hit Zhent vaults across Waterdeep. Find the priestess. Trace her up the chain.'}
                {a.s==='looming' && 'Manshoon moves openly. The Lords of Waterdeep choose sides. War or coup.'}
              </p>
              <div className="footer">
                <span className="chip sm">3 NPCs</span>
                <span className="chip sm">5 locations</span>
                <span className="chip sm">2 factions</span>
                <span className="chip sm gold">12 quests</span>
              </div>
            </div>
          ))}
          <div className="card" style={{borderStyle:'dashed', display:'flex', alignItems:'center', justifyContent:'center', minHeight: 160}}>
            <span className="muted">＋ new arc</span>
          </div>
        </div>
      )}

      {tab === 'locations' && (
        <div className="grid-3">
          {[
            {n:'Waterdeep', t:'Metropolis', tags:['party home','Lords','Zhent infiltrated'], hand:'home base'},
            {n:'Mulmaster', t:'City', tags:['Bane temple','Kaelith origin','cold'], hand:'where it began'},
            {n:'Sunset Vault', t:'Dungeon', tags:['Zhent cache','indoor','active'], hand:'tonight!'},
            {n:'Daggerford', t:'Town', tags:['warehouse','river trade','contested']},
            {n:'Cloud Peaks', t:'Wilderness', tags:['travel','weather +','bandits']},
            {n:'Old Pell\'s shop', t:'Hidden', tags:['ally','stash','intel']},
          ].map(l => (
            <div key={l.n} className="card">
              <div className="head">
                <h4>{l.n}</h4>
                <span className="chip sm">{l.t}</span>
              </div>
              <div className="placeholder" style={{minHeight: 60, marginTop: 6}}>map sketch · drop image</div>
              <div className="footer">
                {l.tags.map(t => <span key={t} className="chip sm">{t}</span>)}
              </div>
              {l.hand && <div className="hand" style={{marginTop: 6, fontSize: 16}}>↳ {l.hand}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'factions' && (
        <div className="grid-2">
          {[
            {n:'Zhentarim · Black Network', col:'red', mood:'hostile', goal:'control Waterdeep trade', leader:'Manshoon (BBEG)', strength: 78, infl: '+1/week'},
            {n:'Harpers', col:'blue', mood:'allied', goal:'expose Manshoon openly', leader:'Lady Mireska', strength: 45, infl: 'stable'},
            {n:'Lords of Waterdeep', col:'gold', mood:'wary', goal:'deny instability', leader:'Open Lord', strength: 88, infl: '−1/week'},
            {n:'Bane · Black Hand cult', col:'red', mood:'hostile', goal:'martial supremacy', leader:'Selvys (in custody?)', strength: 62, infl: '+2/week'},
          ].map(f => (
            <div key={f.n} className="card">
              <div className="head">
                <h4><span className={`dot ${f.col}`} /> {f.n}</h4>
                <span className={`chip ${f.col} sm`}>{f.mood}</span>
              </div>
              <div className="row" style={{gap: 16, marginTop: 4}}>
                <div style={{flex: 1}}>
                  <div className="tiny">GOAL</div>
                  <div style={{fontSize: 14}}>{f.goal}</div>
                  <div className="tiny" style={{marginTop: 8}}>LEADER</div>
                  <div style={{fontSize: 14}}>{f.leader}</div>
                </div>
                <div style={{width: 130}}>
                  <div className="tiny">strength</div>
                  <div className={`bar ${f.col}`}><span style={{width: `${f.strength}%`}} /></div>
                  <div className="stat" style={{marginTop: 4}}>{f.strength}/100</div>
                  <div className="tiny" style={{marginTop: 8}}>influence Δ</div>
                  <div className="stat">{f.infl}</div>
                </div>
              </div>
              <div className="footer">
                <span className="chip sm">4 agents</span>
                <span className="chip sm">3 holdings</span>
                <span className="chip sm">2 active clocks</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'blocks' && (
        <div className="col">
          <div className="aside">
            ↳ everything below is intentionally lightweight. AI reads, humans rarely touch.
          </div>
          <div className="grid-2">
            <div className="box">
              <div className="box-title"><h3>NPCs · 47</h3><span className="meta">json</span></div>
              <pre style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)', margin: 0, whiteSpace:'pre-wrap'}}>{`{
  "id": "selvys",
  "name": "Selvys",
  "faction": "bane_cult",
  "role": "priestess",
  "cl": 7,
  "voice": "cold, zealous, clipped",
  "knows_kaelith": true,
  "memory_ref": "selvys.mem"
}`}</pre>
            </div>
            <div className="box">
              <div className="box-title"><h3>Items · 312</h3><span className="meta">json</span></div>
              <pre style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)', margin: 0, whiteSpace:'pre-wrap'}}>{`{
  "id": "sword_plus1",
  "name": "Shortsword +1",
  "type": "weapon",
  "dmg": "1d6+1 piercing",
  "props": ["finesse","light"],
  "value_gp": 2310,
  "attune": true
}`}</pre>
            </div>
            <div className="box">
              <div className="box-title"><h3>Quests · 28</h3><span className="meta">json</span></div>
              <div className="placeholder">id · arc · status · steps[] · rewards[]</div>
            </div>
            <div className="box">
              <div className="box-title"><h3>Encounters · 19</h3><span className="meta">json</span></div>
              <div className="placeholder">id · location · forces · CR · triggers[]</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

