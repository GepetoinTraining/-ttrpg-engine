// @ts-nocheck
'use client'

import React from 'react'

// surfaces/Guild.jsx — Surface 35. Adventurer's Guild chapter.
// THE most important new view: DM-substitute when there's no human DM.
// Reads engine/mm-guild.ts MMGuildDomainState (strip-only fidelity for now).

export default function Guild() {
  const [tab, setTab] = React.useState('jobs');
  const [selJob, setSelJob] = React.useState(null);

  const chapter = {
    name: 'Suzail Free Company',
    hub: 'Suzail · Trades Ward',
    factionOwner: 'House Obarskyr (charter)',
    reputation: 62,
    treasury: 4280,
    members: 41,
  };

  const jobs = [
    {id:'j1', type:'clear_gate', target:'Greenfields ruin (T2)', danger: 2, reward: 320, expires: 6,  status:'open',
     desc:'Lesser ruin gate near Saerb. Goblin spillover; one farm already lost. T2 monsters expected.'},
    {id:'j2', type:'bounty',     target:'Brigand chief "Rake" Thal', danger: 3, reward: 500, expires: 12, status:'open',
     desc:'Trade Way ambushes traced to Rake. Caravan guild puts up the gold; head or hand.'},
    {id:'j3', type:'escort',     target:'Bullion shipment → Marsember', danger: 1, reward: 180, expires: 2,  status:'claimed',
     desc:'Three day ride. Two wagons, four oxen, one banker. Claimed by Iron Hawk Co.'},
    {id:'j4', type:'patrol',     target:'East Reach (12mi loop)',     danger: 2, reward: 140, expires: 8,  status:'in_progress',
     desc:'Standing weekly contract. Verify cairns intact, log monster sign.'},
    {id:'j5', type:'investigate',target:'Missing scribe (Wheloon)',   danger: 2, reward: 260, expires: 14, status:'open',
     desc:'War Wizards quietly want him back. No questions about prior employer.'},
    {id:'j6', type:'retrieve',   target:'Sunset Vault sigil-key',     danger: 4, reward: 900, expires: 21, status:'open',
     desc:'Wizard estate; lock requires keystone known to be inside ruin near Wheloon.'},
    {id:'j7', type:'clear_gate', target:'Cormanthor portal (T4)',     danger: 4, reward: 1100, expires: 18, status:'open',
     desc:'Portal-class gate. OVERFLOWING for 3 weeks. Crown will pay double if leader is killed.'},
    {id:'j8', type:'bounty',     target:'Verraketh, lich (rumor)',    danger: 5, reward: 0,    expires: 0,  status:'expired',
     desc:'Rumor only. No proof of life. Marked expired but kept on board for posterity.'},
  ];

  const parties = [
    {n:'Iron Hawk Co.',    lvl: 4, cr: 'CR 4–5',  status:'on_job',     rep: 71, members: 4, note:'on j3 escort'},
    {n:'The Verdant Three',lvl: 3, cr: 'CR 3',    status:'idle',       rep: 58, members: 3, note:'last cleared T2 lair'},
    {n:'Brass Blades',     lvl: 6, cr: 'CR 6–7',  status:'recovering', rep: 80, members: 5, note:'2 wounded · ready 8d'},
    {n:'Hooded Walkers',   lvl: 5, cr: 'CR 5',    status:'traveling',  rep: 44, members: 4, note:'en route Wheloon'},
    {n:'Pale Lantern',     lvl: 2, cr: 'CR 2',    status:'idle',       rep: 31, members: 4, note:'apprentice tier'},
    {n:'Gull & Anchor',    lvl: 4, cr: 'CR 4',    status:'disbanded',  rep: 12, members: 0, note:'never reformed after Selgaunt'},
  ];

  const knownSites = 14, threatReports = 7;
  const recentRumors = [
    {d:'Eleasis 23', topic:'Cormanthor portal pulses brighter', src:'patrol log', tier:'A'},
    {d:'Eleasis 21', topic:'Goblin pack moved 2mi closer to Saerb', src:'farmer hearsay', tier:'B'},
    {d:'Eleasis 18', topic:'Caravan ambush — 3rd this month', src:'caravan guild', tier:'A'},
    {d:'Eleasis 15', topic:'Strange light at Sunset Vault midnights', src:'shepherd', tier:'C'},
    {d:'Eleasis 12', topic:'Wheloon scribe seen in Mulmaster (?)', src:'rumor chain', tier:'B'},
  ];

  const jobTypeLabel = {clear_gate:'clear gate', bounty:'bounty', escort:'escort', patrol:'patrol', investigate:'investigate', retrieve:'retrieve'};
  const statusChip = (s) => ({open:'green', claimed:'gold', in_progress:'blue', completed:'green', failed:'red', expired:''})[s] || '';
  const partyChip = (s) => ({idle:'',on_job:'blue',recovering:'gold',traveling:'',disbanded:'red'})[s];

  const sel = jobs.find(j => j.id === selJob);

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">35 · L5 · DM-substitute · MMGuild</div>
          <h2>Adventurer's Guild</h2>
        </div>
        <span className="who">DM &amp; player view · the chapter is the quest giver</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-guild.ts ticks the chapter weekly. when no human DM is at the table,
        <b> the guild is the DM</b>: jobs surface, NPC parties take what players don't,
        the world advances even while the party rests. <i>strip-only — body wires later.</i>
      </div>

      {/* identity strip */}
      <div className="grid-3" style={{marginBottom: 14}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
            <div>
              <div className="tiny">CHAPTER · CHARTERED</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1.1, marginTop: 2}}>{chapter.name}</div>
              <div className="muted" style={{fontSize: 13, marginTop: 2}}>{chapter.hub} · charter held by {chapter.factionOwner} · {chapter.members} members</div>
            </div>
            <div className="row" style={{gap: 6}}>
              <span className="chip blue">chartered</span>
              <span className="chip gold">treasury {chapter.treasury}gp</span>
              <span className="chip">tier B chapter</span>
            </div>
          </div>
          <hr className="rule dashed" />
          <div className="row" style={{gap: 18, alignItems:'flex-end', flexWrap:'wrap'}}>
            <div style={{minWidth: 240, flex: 1}}>
              <div className="tiny">REPUTATION · {chapter.reputation}/100</div>
              <div className="bar gold" style={{marginTop: 4}}><span style={{width: `${chapter.reputation}%`}} /></div>
              <div className="tiny" style={{marginTop: 4}}>respected · steady contracts · slow growth</div>
            </div>
            <div style={{fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-2)'}}>
              <div><b>founded</b> 1467 DR</div>
              <div><b>last tick</b> Eleasis 23 (today)</div>
              <div><b>weekly retainer</b> 80gp from Crown</div>
            </div>
          </div>
        </div>

        <div className="box dashed" style={{padding: 0, overflow: 'hidden'}}>
          <div className="placeholder" style={{minHeight: 132, border: 'none', margin: 0}}>
            chapter sigil · drop image
          </div>
        </div>
      </div>

      <div className="tabs">
        {[
          ['jobs',    `Job board · ${jobs.filter(j=>j.status==='open').length} open`],
          ['parties', `NPC parties · ${parties.length}`],
          ['intel',   'Intel digest'],
        ].map(([k, lbl]) => (
          <div key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{lbl}</div>
        ))}
      </div>

      {tab === 'jobs' && (
        <div className="grid-3" style={{alignItems:'flex-start'}}>
          <div style={{gridColumn:'span 2'}} className="col">
            {jobs.map(j => (
              <div key={j.id} className="box"
                   onClick={() => setSelJob(j.id)}
                   style={{padding:'10px 14px', cursor:'pointer',
                           borderColor: selJob===j.id ? 'var(--rule)' : 'var(--rule-soft)',
                           background: selJob===j.id ? 'var(--paper-2)' : 'var(--paper)'}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', gap: 10}}>
                  <div>
                    <div className="row" style={{gap: 6, alignItems:'center'}}>
                      <span className="chip sm">{jobTypeLabel[j.type]}</span>
                      <span className="tiny" style={{letterSpacing:'0.06em'}}>
                        DANGER {Array.from({length:5}).map((_,i)=>(
                          <span key={i} style={{color: i<j.danger ? 'var(--accent-red)' : 'var(--ink-4)'}}>●</span>
                        ))}
                      </span>
                    </div>
                    <div style={{fontFamily:'var(--serif)', fontSize: 17, fontWeight: 600, marginTop: 4}}>{j.target}</div>
                    <div className="tiny muted" style={{marginTop: 2}}>{j.desc}</div>
                  </div>
                  <div style={{textAlign:'right', flexShrink: 0}}>
                    <div className="stat"><b>{j.reward}gp</b></div>
                    <div className="tiny" style={{marginTop: 2}}>
                      {j.expires > 0 ? `expires ${j.expires}d` : <span className="muted">—</span>}
                    </div>
                    <span className={`chip sm ${statusChip(j.status)}`} style={{marginTop: 6}}>{j.status.replace('_',' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* job detail rail */}
          <div className="box" style={{position:'sticky', top: 20}}>
            {!sel && (
              <div className="muted" style={{fontSize: 13, padding: '8px 0'}}>
                <div className="hand" style={{fontSize: 18, color:'var(--accent-red)', marginBottom: 6}}>← pick a job</div>
                Detail rail shows the contract sheet, NPC-party suggestion, and the take/dispatch buttons.
              </div>
            )}
            {sel && (
              <>
                <div className="tiny">CONTRACT · {sel.id.toUpperCase()}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 18, fontWeight: 600, marginTop: 4}}>
                  {jobTypeLabel[sel.type]} — {sel.target}
                </div>
                <div className="row" style={{gap: 6, marginTop: 8, flexWrap:'wrap'}}>
                  <span className="chip sm gold">{sel.reward}gp</span>
                  <span className="chip sm red">danger {sel.danger}/5</span>
                  <span className={`chip sm ${statusChip(sel.status)}`}>{sel.status.replace('_',' ')}</span>
                </div>
                <hr className="rule dashed" />
                <p style={{fontSize: 13, color:'var(--ink-2)', margin: 0}}>{sel.desc}</p>

                <div className="section-title" style={{marginTop: 14}}>Suggested party</div>
                <div className="tiny" style={{marginBottom: 6}}>auto-matched on level + status + travel</div>
                {(() => {
                  const idle = parties.filter(p => p.status==='idle');
                  const pick = idle[Math.min(idle.length-1, sel.danger - 1)] || idle[0];
                  if (!pick) return <div className="muted" style={{fontSize: 13}}>none idle. job will sit on the board.</div>;
                  return (
                    <div className="box soft" style={{padding: '8px 10px'}}>
                      <div className="row" style={{justifyContent:'space-between'}}>
                        <span style={{fontFamily:'var(--serif)', fontWeight: 600}}>{pick.n}</span>
                        <span className="tiny">lvl {pick.lvl} · {pick.cr}</span>
                      </div>
                      <div className="tiny muted" style={{marginTop: 2}}>{pick.note}</div>
                    </div>
                  );
                })()}

                <div className="row" style={{gap: 6, marginTop: 14, flexWrap:'wrap'}}>
                  <button className="btn sm primary">Take this job</button>
                  <button className="btn sm">Dispatch NPC party</button>
                  <button className="btn sm">Edit contract</button>
                </div>
                <div className="aside blue" style={{marginTop: 10, fontSize: 15}}>
                  ↳ if no one takes this in {sel.expires || '—'}d, engine auto-dispatches highest-rep idle party.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'parties' && (
        <div className="col" style={{gap: 8}}>
          <table className="inv">
            <thead>
              <tr><th>Party</th><th>Level</th><th>CR band</th><th>Status</th><th>Members</th><th>Reputation</th><th></th></tr>
            </thead>
            <tbody>
              {parties.map(p => (
                <tr key={p.n}>
                  <td><b>{p.n}</b><div className="tiny muted">{p.note}</div></td>
                  <td className="stat">{p.lvl}</td>
                  <td className="stat">{p.cr}</td>
                  <td><span className={`chip sm ${partyChip(p.status)}`}>{p.status.replace('_',' ')}</span></td>
                  <td className="stat">{p.members}</td>
                  <td style={{minWidth: 140}}>
                    <div className="row" style={{alignItems:'center', gap: 6}}>
                      <div className="bar gold" style={{flex: 1}}><span style={{width: `${p.rep}%`}} /></div>
                      <span className="tiny">{p.rep}</span>
                    </div>
                  </td>
                  <td><button className="btn sm">view</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="aside" style={{maxWidth: 760, marginTop: 6}}>
            ↳ NPC parties tick same as the players: take jobs, level, recover, occasionally die.
            disbanded parties stay listed — their reputation is what the chapter inherited.
          </div>
        </div>
      )}

      {tab === 'intel' && (
        <div className="grid-3" style={{alignItems:'flex-start'}}>
          <div className="box">
            <div className="box-title"><h3>Known sites</h3><span className="meta">{knownSites}</span></div>
            <div className="col" style={{gap: 4, fontSize: 13}}>
              {[
                ['Greenfields ruin','T2','active'],
                ['Cormanthor portal','T4','OVERFLOWING'],
                ['Sunset Vault','T3','dormant'],
                ['Wheloon catacombs','T2','capped'],
                ['East Reach lairs','T1','cleared'],
              ].map(([n,t,st]) => (
                <div key={n} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 4}}>
                  <span>{n}</span>
                  <span className="tiny"><b>{t}</b> · {st}</span>
                </div>
              ))}
              <button className="btn sm" style={{marginTop: 6}}>open Sitemap →</button>
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Threat reports</h3><span className="meta">{threatReports}</span></div>
            <div className="col" style={{gap: 6, fontSize: 13}}>
              {[
                {t:'Cormanthor leader emerged', sev:'A', d:'CR 7 ettin tagged ADAPT/PACK'},
                {t:'Greenfields spillover risk', sev:'B', d:'2 weeks to threshold'},
                {t:'Trade Way brigand cell',     sev:'B', d:'3 ambushes / month'},
                {t:'Sunset Vault arcane spike',  sev:'C', d:'unconfirmed'},
              ].map(r => (
                <div key={r.t}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <span><b>{r.t}</b></span>
                    <span className={`chip sm ${r.sev==='A'?'red':r.sev==='B'?'gold':''}`}>tier {r.sev}</span>
                  </div>
                  <div className="tiny muted">{r.d}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="box">
            <div className="box-title"><h3>Recent rumors</h3><span className="meta">last 5</span></div>
            <div className="col" style={{gap: 6, fontSize: 13}}>
              {recentRumors.map((r,i) => (
                <div key={i} style={{borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 6}}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <span style={{fontFamily:'var(--mono)', fontSize: 11}}>{r.d}</span>
                    <span className={`chip sm ${r.tier==='A'?'red':r.tier==='B'?'gold':''}`}>{r.tier}</span>
                  </div>
                  <div style={{marginTop: 2}}>{r.topic}</div>
                  <div className="tiny muted">via {r.src}</div>
                </div>
              ))}
              <button className="btn sm" style={{marginTop: 4}}>open Rumors →</button>
            </div>
          </div>

          <div className="box dashed" style={{gridColumn:'span 3', padding: 12}}>
            <div className="row" style={{gap: 14, flexWrap:'wrap', alignItems:'baseline'}}>
              <span className="hand ink" style={{fontSize: 18}}>DM-less mode</span>
              <span className="tiny" style={{flex: 1}}>
                if no human DM connects this session, the guild posts a job the party is rated for,
                runs an inline-card scene to take it, and ticks resolution on return. <b>Players don't notice the seam.</b>
              </span>
              <button className="btn sm">simulate next tick →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

