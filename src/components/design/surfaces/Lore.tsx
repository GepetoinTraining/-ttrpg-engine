// @ts-nocheck
'use client'

import React from 'react'
import { loadWiki, type WikiArticle } from '@/lib/narrative'

// surfaces/Lore.tsx — Codified lore wiki + world firsts.
// Live data: /api/wiki/list?type=lore reads wiki_articles. Lore reuses the
// existing wiki table with articleType='lore' (per user direction — different
// title only, same storage).

export default function Lore() {
  const [tab, setTab] = React.useState('canon');
  const [sel, setSel] = React.useState('selune');
  const [live, setLive] = React.useState<WikiArticle[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadWiki({ type: 'lore', limit: 200 }).then(r => setLive(r.articles)).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const entries = [
    {id:'selune', name:'Selûne', kind:'deity', tier:'canon',
     blurb:'Goddess of the moon, navigation, and good lycanthropes. Sister-rival of Shar.',
     refs: 12, lastTouched:'5 days ago', knownBy:['party','priests'], hooks:2},
    {id:'shar', name:'Shar', kind:'deity', tier:'canon',
     blurb:'Mistress of Night. Domain over loss, secrets, and the Plane of Shadow.',
     refs: 8, lastTouched:'5 days ago', knownBy:['party'], hooks:1},
    {id:'manshoon', name:'Manshoon', kind:'figure', tier:'canon',
     blurb:'Founder of the Zhentarim. Vampire wizard with cloned bodies across Faerûn.',
     refs: 24, lastTouched:'today', knownBy:['DM','party'], hooks:5},
    {id:'compact', name:'The Compact', tier:'house', kind:'faction',
     blurb:'Party-formed pact w/ Lady Mireska, est. 1494 DR. Off-canon — this campaign.',
     refs: 18, lastTouched:'today', knownBy:['party'], hooks:3},
    {id:'soulcage', name:'Soul-cage rite (Selvys)', tier:'house', kind:'arcana',
     blurb:'Banite phylactery variant. Vessa identified ritual residue post-fight.',
     refs: 4, lastTouched:'today', knownBy:['Vessa','DM'], hooks:2},
    {id:'twin', name:'The Twin Vault rumor', tier:'unverified', kind:'lore',
     blurb:'Whispers that Sunset Vault has a mirrored cache under Trades Ward.',
     refs: 2, lastTouched:'2 days ago', knownBy:['DM'], hooks:1},
  ];

  const firsts = [
    {when:'Sess 03', who:'Kaelith',  what:'first to enter the Underdark',  badge:'underdark'},
    {when:'Sess 07', who:'Vessa',    what:'first 9th-level spell cast',    badge:'wish'},
    {when:'Sess 11', who:'Doruk',    what:"first to break a god's seal",  badge:'sealbreaker'},
    {when:'Sess 12', who:'Party',    what:'first to expose a Zhent cell',  badge:'expose'},
    {when:'Sess 14', who:'Kaelith',  what:'first to die & return',         badge:'returned'},
    {when:'—',       who:'?',        what:'first to face Manshoon',         badge:'pending'},
  ];

  const e = entries.find(x => x.id === sel);

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">24 · Codex / lore wiki</div>
          <h2>Lore &amp; world firsts</h2>
        </div>
        <span className="who">DM authors · party reads what they've earned</span>
      </div>

      <div className="aside" style={{marginBottom: 18}}>
        ↳ canon (5e source-text), house (DM-authored), party-discovered, and unverified —
        each entry tracks who knows it, where it's been referenced, and which hooks dangle.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live lore entries</h3>
          <span className="meta">→ /api/wiki/list?type=lore · wiki_articles (reused, articleType=lore)</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && live.length === 0 && (
          <div className="tiny muted">no wiki_articles with articleType='lore' yet · the entries below are demo</div>
        )}
        {live && live.length > 0 && (
          <div className="col" style={{gap: 4, fontSize: 13, maxHeight: 200, overflowY: 'auto'}}>
            <div className="row"><span className="stat">{live.length} entries</span></div>
            {live.slice(0, 30).map((a) => (
              <div key={a.id} className="row" style={{justifyContent:'space-between', padding: '4px 0', borderBottom: '1px dashed var(--rule-soft)'}}>
                <span><b>{a.title}</b> <span className="muted">· day {a.worldDay}</span></span>
                <span className="tiny">
                  <span className={`chip sm ${a.depthOfKnowledge === 'canon' ? 'green' : a.depthOfKnowledge === 'rumor' ? 'gold' : ''}`}>{a.depthOfKnowledge}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* stats */}
      <div className="grid-4" style={{marginBottom: 18}}>
        {[
          {n:'Codex entries', v:'214', sub:'+12 this campaign'},
          {n:'House lore', v:'47', sub:'DM-authored'},
          {n:'Unverified', v:'9', sub:'unconfirmed'},
          {n:'World firsts', v:'5', sub:'1 pending'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 32, fontWeight: 600, lineHeight: 1, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {['canon','house','party-discovered','unverified','firsts'].map(k => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{k}</div>
        ))}
      </div>

      {tab !== 'firsts' && (
        <div className="grid-3" style={{gap: 18}}>
          {/* index */}
          <div className="box" style={{gridColumn:'span 1', maxHeight: 520, overflow:'auto'}}>
            <div className="box-title"><h3>Index</h3><span className="meta">{entries.length} entries</span></div>
            <input className="placeholder" style={{padding:'4px 10px', minHeight:0, fontFamily:'var(--mono)', fontSize: 12, width:'100%', marginBottom: 10}} placeholder="🔍  search lore…" />
            <div className="col" style={{gap: 4}}>
              {entries.map(en => (
                <a key={en.id}
                   onClick={() => setSel(en.id)}
                   style={{
                     padding:'8px 10px', cursor:'pointer',
                     border:'1px solid '+(sel===en.id?'var(--rule)':'transparent'),
                     background: sel===en.id ? 'var(--paper-2)' : 'transparent',
                     display:'block',
                   }}>
                  <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', gap: 8}}>
                    <span style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{en.name}</span>
                    <span className={`chip sm ${en.tier==='canon'?'':en.tier==='house'?'gold':'red'}`}>{en.tier}</span>
                  </div>
                  <div className="tiny muted" style={{marginTop: 2}}>{en.kind} · {en.refs} refs · {en.lastTouched}</div>
                </a>
              ))}
            </div>
            <button className="btn sm" style={{marginTop: 10, width:'100%'}}>＋ new entry</button>
          </div>

          {/* entry detail */}
          <div className="box" style={{gridColumn:'span 2'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div className="tiny">{e.kind.toUpperCase()} · {e.tier.toUpperCase()}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1.1, marginTop: 4}}>{e.name}</div>
                <div className="row" style={{gap: 6, marginTop: 8, flexWrap:'wrap'}}>
                  {e.knownBy.map(k => <span key={k} className="chip sm blue">known: {k}</span>)}
                  <span className="chip sm">{e.refs} session refs</span>
                  <span className="chip sm gold">{e.hooks} open hooks</span>
                </div>
              </div>
              <div className="col" style={{gap: 4}}>
                <button className="btn sm">edit ✎</button>
                <button className="btn sm">share with party</button>
                <button className="btn sm danger">retire</button>
              </div>
            </div>

            <hr className="rule dashed" />

            <div style={{fontFamily:'var(--serif)', fontSize: 15, lineHeight: 1.55, color:'var(--ink-2)'}}>
              <p style={{marginTop: 0}}>{e.blurb} Worship spans the Heartlands and Sword Coast.
              Major temples in Waterdeep (Plinth) and Daerlun. Unlike most LG faiths,
              clergy operate in cells rather than hierarchies.</p>
              <p>Rivalry with <a style={{color:'var(--accent-blue)', textDecoration:'underline dotted'}}>Shar</a> structures
              most cosmic events involving either deity. Aspects: Our Lady of Silver, Moonmaiden,
              Lady of Lost Love.</p>
            </div>

            <div className="section-title">References in play</div>
            <table className="inv">
              <thead>
                <tr><th>session</th><th>moment</th><th>who introduced</th><th>linked to</th></tr>
              </thead>
              <tbody>
                <tr><td>S03</td><td>Kaelith's navigation roll under stars</td><td>player</td><td>Kaelith bg</td></tr>
                <tr><td>S07</td><td>Moon-blessed silver in vault haul</td><td>DM</td><td>Sunset Vault</td></tr>
                <tr><td>S09</td><td>Vessa identifies Selûnite mark on Selvys</td><td>DM</td><td>soul-cage rite</td></tr>
                <tr><td>S12</td><td>Mireska invokes oath in Moonmaiden's name</td><td>NPC</td><td>The Compact</td></tr>
              </tbody>
            </table>

            <div className="section-title">Open hooks</div>
            <div className="col" style={{gap: 6}}>
              <div className="row" style={{gap: 8, alignItems:'center'}}>
                <span className="chip gold sm">hook</span>
                <span style={{fontSize: 14}}>The Plinth's high priestess has not been seen in 3 sessions.</span>
                <span className="tiny muted" style={{marginLeft:'auto'}}>last surfaced S11</span>
              </div>
              <div className="row" style={{gap: 8, alignItems:'center'}}>
                <span className="chip gold sm">hook</span>
                <span style={{fontSize: 14}}>Doruk's old commander wears a tarnished moon — symbol corruption?</span>
                <span className="tiny muted" style={{marginLeft:'auto'}}>S14</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'firsts' && (
        <div>
          <div className="aside blue" style={{marginBottom: 14}}>
            ↳ campaign milestones — first time anyone's done X. Some are auto-detected from
            engine events; some are DM-authored. Earnable badges show on the player sheet.
          </div>
          <div className="grid-3">
            {firsts.map((f,i) => (
              <div key={i} className={`box ${f.when==='—'?'dashed':''}`} style={{padding: 16}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span className="tiny">{f.when}</span>
                  <span className={`chip sm ${f.when==='—'?'':'gold'}`}>{f.when==='—'?'pending':'awarded'}</span>
                </div>
                <div style={{fontFamily:'var(--serif)', fontSize: 18, fontWeight: 600, marginTop: 6}}>{f.what}</div>
                <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginTop: 10, paddingTop: 8, borderTop:'1px dashed var(--rule-soft)'}}>
                  <span className="tiny">{f.who}</span>
                  <span className="hand" style={{fontSize: 16}}>★ {f.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

