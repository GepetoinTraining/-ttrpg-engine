// @ts-nocheck
'use client'

import React from 'react'
import { AdaptChips, AdaptWeights, AdaptLegend } from './_adaptations'

// surfaces/MonsterCamp.jsx — Surface 37. Monster actor inspector.
// Reads engine/mm-monster-actor.ts MMMonsterActorDomainState.

export default function MonsterCamp() {
  const cmp = {
    leader: {name:'Vergrath', species:'ettin', cr: 7, tenureMonths: 14, challengesSurvived: 3},
    campNodeId: 'node-cormanthor-01',
    edge: 'edge E12 : mile 7',
    population: 38,
    carryingCapacity: 50,
    troops: 24,
    foodSecurity: 0.42,
    gold: 280,
    lastGrade: 'partial', // backfire / failure / partial / success / great / critical
    lastAction: 'raid_settlement',
    adaptations: ['ADAPT','PACK','SWIFT','CUNNING'],
    dangerRadius: 6,
    claimedEdges: ['E12 : 4–9', 'E13 : 0–2'],
    raidsConducted: 7,
    settlementsRaided: ['Saerb (3×)','Wheloon outskirts','East Reach cairn 7'],
    gateId: 'g-cormanthor',
    pendingMigration: null,
  };

  const grades = ['backfire','failure','partial','success','great','critical'];
  const gradeIdx = grades.indexOf(cmp.lastGrade);
  const gradeColor = (g, idx) => {
    if (idx <= 1) return 'var(--accent-red)';
    if (idx === 2) return 'var(--accent-gold)';
    if (idx >= 3) return 'var(--accent-green)';
    return 'var(--ink-3)';
  };

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">37 · L5 · MMMonsterActor</div>
          <h2>Monster camp · {cmp.leader.name}</h2>
        </div>
        <span className="who">DM view · leader, troops, food, raids</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-monster-actor.ts ticks the camp weekly. leaders accumulate tenure;
        challengesSurvived drives adaptation drift. low food → raid; high food → expand.
      </div>

      {cmp.pendingMigration && (
        <div className="box" style={{borderColor:'var(--accent-red)', borderWidth: 2, background:'rgba(168,68,42,0.06)', marginBottom: 14}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap: 10}}>
            <div>
              <span className="hand" style={{fontSize: 20}}>Pending migration</span>
              <div style={{fontSize: 14, marginTop: 2}}>Leader has migrated to seed a new lair. Place the new gate on the map.</div>
            </div>
            <button className="btn primary">Place new lair →</button>
          </div>
        </div>
      )}

      {/* leader strip */}
      <div className="grid-3" style={{marginBottom: 14}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="row" style={{gap: 14, alignItems:'flex-start'}}>
            <div className="placeholder" style={{width: 96, height: 96, minHeight: 96, padding: 0, flexShrink: 0}}>
              leader chip
            </div>
            <div style={{flex: 1}}>
              <div className="tiny">LEADER · TENURE {cmp.leader.tenureMonths}mo</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1.05, marginTop: 2}}>
                {cmp.leader.name}
              </div>
              <div className="muted" style={{fontSize: 13, marginTop: 2}}>
                {cmp.leader.species} · CR {cmp.leader.cr} · {cmp.leader.challengesSurvived} challenges survived
              </div>
              <div className="row" style={{gap: 6, marginTop: 8}}>
                <span className="chip blue">linked gate · {cmp.gateId}</span>
                <span className="chip">{cmp.edge}</span>
                <span className="chip red">danger {cmp.dangerRadius}mi</span>
              </div>
            </div>
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Last action</h3><span className="meta">{cmp.lastAction.replace('_',' ')}</span></div>
          <div className="tiny" style={{marginBottom: 6}}>ADVANCEMENT GRADE</div>
          <div className="row" style={{gap: 0, border:'1px solid var(--rule)', overflow:'hidden'}}>
            {grades.map((g, i) => (
              <div key={g} title={g} style={{
                flex: 1,
                padding: '6px 4px',
                textAlign: 'center',
                fontFamily:'var(--mono)', fontSize: 9,
                background: i === gradeIdx ? gradeColor(g, i) : 'var(--paper)',
                color: i === gradeIdx ? 'var(--paper)' : 'var(--ink-3)',
                borderRight: i < grades.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                fontWeight: i === gradeIdx ? 600 : 400,
                letterSpacing: '0.04em',
              }}>{g.slice(0,4)}</div>
            ))}
          </div>
          <div className="tiny" style={{marginTop: 6}}>
            partial = took losses, secured half the haul. food +6, troops −4.
          </div>
        </div>
      </div>

      <div className="grid-4" style={{marginBottom: 14}}>
        <div className="box">
          <div className="tiny">POPULATION</div>
          <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2}}>
            {cmp.population}<span className="muted" style={{fontSize: 14}}> /{cmp.carryingCapacity}</span>
          </div>
          <div className="bar" style={{marginTop: 6}}><span style={{width: `${(cmp.population/cmp.carryingCapacity)*100}%`}} /></div>
          <div className="tiny" style={{marginTop: 4}}>76% capacity · pressure rising</div>
        </div>
        <div className="box">
          <div className="tiny">TROOPS</div>
          <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2}}>{cmp.troops}</div>
          <div className="tiny" style={{marginTop: 4}}>combat-ready of {cmp.population}</div>
          <div className="bar red" style={{marginTop: 6}}><span style={{width: `${(cmp.troops/cmp.population)*100}%`}} /></div>
        </div>
        <div className="box">
          <div className="tiny">FOOD SECURITY</div>
          <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2, color:'var(--accent-red)'}}>
            {(cmp.foodSecurity*100).toFixed(0)}%
          </div>
          <div className={`bar ${cmp.foodSecurity < 0.5 ? 'red' : 'green'}`} style={{marginTop: 6}}><span style={{width: `${cmp.foodSecurity*100}%`}} /></div>
          <div className="tiny" style={{marginTop: 4}}>scarcity · raids likely</div>
        </div>
        <div className="box">
          <div className="tiny">GOLD HOARD</div>
          <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2, color:'var(--accent-gold)'}}>
            {cmp.gold}gp
          </div>
          <div className="tiny" style={{marginTop: 4}}>loot pool on clear</div>
        </div>
      </div>

      <div className="grid-3" style={{gap: 14}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <div className="box-title"><h3>Adaptations · expressed</h3><span className="meta">drift this gen</span></div>
          <AdaptChips active={cmp.adaptations} />
          <hr className="rule dashed" />
          <div className="tiny" style={{marginBottom: 6}}>FULL POOL — same 10 traits as Gate / Ecology</div>
          <AdaptLegend />
        </div>

        <div className="box">
          <div className="box-title"><h3>Claimed territory</h3><span className="meta">{cmp.claimedEdges.length} segments</span></div>
          <div className="col" style={{gap: 4, fontSize: 13, fontFamily:'var(--mono)'}}>
            {cmp.claimedEdges.map(e => (
              <div key={e} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 4}}>
                <span>{e}</span>
                <span className="tiny">claimed</span>
              </div>
            ))}
          </div>
          <div className="tiny" style={{marginTop: 8}}>radius extends {cmp.dangerRadius}mi · settlements within face raid rolls weekly.</div>
        </div>
      </div>

      <div className="section-title">Raid history</div>
      <div className="grid-3" style={{gap: 14}}>
        <div className="box" style={{gridColumn:'span 2'}}>
          <table className="inv">
            <thead><tr><th>Day</th><th>Target</th><th>Action</th><th>Grade</th><th>Outcome</th></tr></thead>
            <tbody>
              <tr><td className="stat">469</td><td><b>Saerb</b></td><td>raid_settlement</td><td><span className="chip sm gold">partial</span></td><td className="muted">−4 troops · +18gp · +6 food</td></tr>
              <tr><td className="stat">462</td><td><b>cairn 7</b></td><td>raid_settlement</td><td><span className="chip sm green">success</span></td><td className="muted">+24gp · +9 food</td></tr>
              <tr><td className="stat">455</td><td><b>—</b></td><td>fortify_camp</td><td><span className="chip sm green">great</span></td><td className="muted">capacity 45 → 50</td></tr>
              <tr><td className="stat">448</td><td><b>Saerb</b></td><td>raid_settlement</td><td><span className="chip sm">success</span></td><td className="muted">+12gp</td></tr>
              <tr><td className="stat">441</td><td><b>—</b></td><td>recruit</td><td><span className="chip sm">success</span></td><td className="muted">+6 troops</td></tr>
              <tr><td className="stat">434</td><td><b>—</b></td><td>hunt</td><td><span className="chip sm red">failure</span></td><td className="muted">−1 troop · 0 food</td></tr>
            </tbody>
          </table>
          <div className="tiny" style={{marginTop: 6}}>
            <b>{cmp.raidsConducted}</b> raids · settlements: {cmp.settlementsRaided.join(' · ')}
          </div>
        </div>

        <div className="box">
          <div className="box-title"><h3>Tenure milestones</h3><span className="meta">{cmp.leader.tenureMonths}mo</span></div>
          <div className="col" style={{gap: 6, fontSize: 13}}>
            <div><b>+0mo</b> · ascended (killed previous)</div>
            <div><b>+3mo</b> · survived first challenge</div>
            <div><b>+7mo</b> · expanded to E13</div>
            <div><b>+11mo</b> · gained ADAPT trait</div>
            <div><b>+14mo</b> · <i style={{color:'var(--accent-red)'}}>now · pressure mounting</i></div>
          </div>
          <div className="aside blue" style={{marginTop: 10, fontSize: 15}}>
            ↳ at 18mo or after 5 challenges, leader rolls migration. if pass: pendingMigration set.
          </div>
        </div>
      </div>
    </div>
  );
}

