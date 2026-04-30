// @ts-nocheck
'use client'

import React from 'react'
import { DungeonGrid, exampleDungeonLevel } from '../dungeon/DungeonGrid'
import { TexturePicker, Texture } from '../dungeon/primitives'

// surfaces/Dungeon.tsx — Dungeon runner (engine/dungeon-*.ts).
// SURFACE wiring deferred per user (encounter builder needs design pass first).
// The primitives strip below demos the new src/lib/dungeon module so the editor
// can be built on top: tiles, edges, doors, hazards, spawns, lights, textures.

export default function Dungeon() {
  const [room, setRoom] = React.useState(4);
  const [pickedTexture, setPickedTexture] = React.useState<any>('stone-rough');
  const demoLevel = React.useMemo(() => exampleDungeonLevel(), [])

  // 6×4 grid. each cell: 'corridor', 'room', 'gate', 'boss', 'empty'
  // we'll position rooms with explicit coordinates.
  const rooms = [
    {id:1, x:1, y:0, kind:'gate',  name:'Gate · Sunset Vault', state:'cleared', threat:0},
    {id:2, x:1, y:1, kind:'room',  name:'Antechamber',          state:'cleared', threat:0},
    {id:3, x:2, y:1, kind:'room',  name:'Guard barracks',       state:'cleared', threat:0, loot:'2 keys'},
    {id:4, x:2, y:2, kind:'room',  name:'Cistern',              state:'active',  threat:2, mob:'4 thugs · 1 priest'},
    {id:5, x:3, y:2, kind:'room',  name:'Reliquary',            state:'unseen',  threat:3, hint:'ward sensed'},
    {id:6, x:3, y:1, kind:'room',  name:"Scribes' alcove",     state:'glimpsed',threat:1},
    {id:7, x:4, y:2, kind:'room',  name:'Sanctum',              state:'unseen',  threat:4},
    {id:8, x:4, y:3, kind:'boss',  name:'Selvys · the rite',    state:'unseen',  threat:5},
    {id:9, x:0, y:1, kind:'room',  name:"Servants' stair",     state:'cleared', threat:0, secret:true},
  ];
  const corridors = [
    {fx:1,fy:0, tx:1, ty:1},
    {fx:1,fy:1, tx:2, ty:1},
    {fx:2,fy:1, tx:2, ty:2},
    {fx:2,fy:2, tx:3, ty:2},
    {fx:3,fy:1, tx:3, ty:2},
    {fx:3,fy:2, tx:4, ty:2},
    {fx:4,fy:2, tx:4, ty:3},
    {fx:0,fy:1, tx:1, ty:1},
  ];

  const cell = 90, gap = 14;
  const W = 6, H = 5;
  const sel = rooms.find(r => r.id === room) || rooms[3];

  const stateColor = (st) => st==='cleared'?'green':st==='active'?'red':st==='glimpsed'?'gold':'';

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">26 · Dungeon runner</div>
          <h2>Sunset Vault · room-by-room</h2>
        </div>
        <span className="who">DM · live mapper · party sees revealed only</span>
      </div>

      <div className="aside" style={{marginBottom: 18}}>
        ↳ engine simulates noise, lights, monster patrol, and resource drain. each room has
        threat, loot, hidden links. revealing a corridor pushes the FOW back; monsters can
        path between linked rooms when alerted.
      </div>

      {/* Primitives strip — the foundation the encounter builder will sit on. */}
      <div className="box" style={{marginBottom: 18, padding: 14, borderColor: 'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Dungeon primitives · ready</h3>
          <span className="meta">src/lib/dungeon/* + components/design/dungeon/* · editor surface deferred</span>
        </div>
        <div className="grid-3" style={{gap: 14, marginTop: 8}}>
          <div style={{gridColumn: 'span 2'}}>
            <DungeonGrid level={demoLevel} cellPx={56} reveal={true} />
            <div className="tiny muted" style={{marginTop: 6}}>
              composes: tiles · textures · light · walls · doors · pillars · pit hazard · goblin ambush spawn · torch halo
            </div>
          </div>
          <div className="col" style={{gap: 10}}>
            <div>
              <div className="tiny" style={{marginBottom: 4}}>TEXTURE PICKER (19 kinds · CSS pattern → image URL later)</div>
              <TexturePicker selected={pickedTexture} onSelect={setPickedTexture} size={36} />
            </div>
            <div>
              <div className="tiny" style={{marginBottom: 4}}>SELECTED · {pickedTexture}</div>
              <Texture texture={{kind: pickedTexture}} size={120} rounded />
            </div>
            <div className="aside" style={{fontSize: 14}}>
              ↳ types: <span className="kbd">Tile · Edge · Door · Hazard · Spawn · LightSource · Annotation · DungeonObject</span> all in one schema. Gemini fills <span className="kbd">imageUrl</span>; SVG-skill emits portraits. Today: paper-palette CSS patterns.
            </div>
          </div>
        </div>
      </div>

      {/* status strip */}
      <div className="grid-4" style={{marginBottom: 18}}>
        {[
          {n:'Rooms', v:'9 / ?', sub:'4 explored'},
          {n:'Party HP', v:'62%', sub:'Doruk bloodied'},
          {n:'Resources', v:'5/8', sub:'spell slots used'},
          {n:'Alarm', v:'2/4', sub:'priestess alerted'},
        ].map(s => (
          <div key={s.n} className="box">
            <div className="tiny">{s.n.toUpperCase()}</div>
            <div style={{fontFamily:'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1, marginTop: 4}}>{s.v}</div>
            <div className="tiny muted" style={{marginTop: 4}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-3" style={{gap: 18, alignItems:'flex-start'}}>
        {/* mapper */}
        <div className="box" style={{gridColumn:'span 2', padding: 18}}>
          <div className="box-title"><h3>Mapper</h3><span className="meta">live · drag to pan</span></div>

          <svg viewBox={`0 0 ${W*(cell+gap)} ${H*(cell+gap)}`} style={{width:'100%', height: 'auto', background:'var(--paper-2)', border:'1px solid var(--rule-soft)'}}>
            {/* grid */}
            {Array.from({length: W}).map((_,x) => Array.from({length: H}).map((_,y) => (
              <rect key={`g${x}${y}`} x={x*(cell+gap)} y={y*(cell+gap)} width={cell} height={cell}
                    fill="none" stroke="rgba(31,27,22,0.06)" strokeDasharray="2 4" />
            )))}

            {/* corridors */}
            {corridors.map((c,i) => {
              const x1 = c.fx*(cell+gap)+cell/2, y1 = c.fy*(cell+gap)+cell/2;
              const x2 = c.tx*(cell+gap)+cell/2, y2 = c.ty*(cell+gap)+cell/2;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                           stroke="var(--ink-2)" strokeWidth="2" strokeDasharray={i===corridors.length-1?'5 4':'0'} />;
            })}

            {/* rooms */}
            {rooms.map(r => {
              const cx = r.x*(cell+gap)+cell/2, cy = r.y*(cell+gap)+cell/2;
              const fill = r.state==='cleared' ? 'var(--paper)'
                         : r.state==='active' ? 'rgba(168,68,42,0.18)'
                         : r.state==='glimpsed' ? 'rgba(176,136,56,0.12)'
                         : 'rgba(31,27,22,0.5)';
              const stroke = r.state==='unseen' ? 'var(--ink-3)'
                           : r.kind==='boss' ? 'var(--accent-red)'
                           : r.kind==='gate' ? 'var(--accent-gold)' : 'var(--ink)';
              const isSel = r.id === room;
              return (
                <g key={r.id} style={{cursor:'pointer'}} onClick={()=>setRoom(r.id)}>
                  <rect x={cx-cell/2+8} y={cy-cell/2+8} width={cell-16} height={cell-16}
                        fill={fill} stroke={stroke} strokeWidth={isSel?3:1.5}
                        strokeDasharray={r.state==='unseen'?'4 3':'0'} />
                  {r.kind==='boss' && (
                    <circle cx={cx} cy={cy} r={6} fill="var(--accent-red)" />
                  )}
                  {r.kind==='gate' && (
                    <text x={cx} y={cy+4} textAnchor="middle" fontFamily="var(--mono)" fontSize="10" fill="var(--accent-gold)">⚷</text>
                  )}
                  {r.state !== 'unseen' && (
                    <text x={cx} y={cy+cell/2-2} textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--ink-2)">
                      #{r.id}
                    </text>
                  )}
                  {r.state==='active' && (
                    <circle cx={cx-cell/2+18} cy={cy-cell/2+18} r={4} fill="var(--accent-red)">
                      <animate attributeName="r" values="3;6;3" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="row" style={{gap: 8, marginTop: 10, flexWrap:'wrap'}}>
            <span className="chip green sm">cleared</span>
            <span className="chip red sm">active fight</span>
            <span className="chip gold sm">glimpsed</span>
            <span className="chip sm" style={{borderStyle:'dashed'}}>unseen</span>
            <span className="tiny muted" style={{marginLeft: 'auto'}}>↺ regenerate · 🔍 reveal · ⛓ link rooms</span>
          </div>
        </div>

        {/* room detail */}
        <div className="col" style={{gap: 14}}>
          <div className="box">
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
              <span className="tiny">ROOM #{sel.id} · {sel.kind.toUpperCase()}</span>
              <span className={`chip sm ${stateColor(sel.state)}`}>{sel.state}</span>
            </div>
            <div style={{fontFamily:'var(--serif)', fontSize: 20, fontWeight: 600, marginTop: 4}}>{sel.name}</div>

            <div className="section-title" style={{margin:'14px 0 6px'}}>Threat</div>
            <div className="row" style={{gap: 4}}>
              {Array.from({length: 5}).map((_,i) => (
                <div key={i} style={{
                  width: 16, height: 8,
                  background: i < (sel.threat||0) ? 'var(--accent-red)' : 'var(--paper-2)',
                  border: '1px solid var(--rule)',
                }} />
              ))}
            </div>

            {sel.mob && (
              <>
                <div className="section-title" style={{margin:'14px 0 6px'}}>Inhabitants</div>
                <div style={{fontSize: 14, fontFamily:'var(--serif)'}}>{sel.mob}</div>
              </>
            )}

            <div className="row" style={{gap: 6, marginTop: 14, flexWrap:'wrap'}}>
              <button className="btn sm primary">→ enter combat</button>
              <button className="btn sm">reveal corridor</button>
              <button className="btn sm">describe to party</button>
            </div>
          </div>

          <div className="box soft">
            <div className="box-title"><h3>Patrol &amp; alerts</h3><span className="meta">2 ticks</span></div>
            <div className="col" style={{gap: 6, fontSize: 13}}>
              <div className="row" style={{gap: 6, alignItems:'baseline'}}>
                <span className="chip red sm">+1</span>
                <span>priest moves from #4 → #5 if cistern alerted</span>
              </div>
              <div className="row" style={{gap: 6, alignItems:'baseline'}}>
                <span className="chip gold sm">+2</span>
                <span>thug pair patrols #6 ↔ #3 corridor</span>
              </div>
              <div className="row" style={{gap: 6, alignItems:'baseline'}}>
                <span className="chip sm">noise</span>
                <span className="muted">Fireball in #4 alerts #5, #7 (DC 14 stealth to suppress)</span>
              </div>
            </div>
          </div>

          <div className="box dark">
            <div className="tiny" style={{color:'var(--paper-3)'}}>RUNNING DRAIN</div>
            <div className="col" style={{gap: 4, marginTop: 6, fontSize: 13}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <span>spell slots burned</span><span style={{fontFamily:'var(--mono)'}}>3</span>
              </div>
              <div className="row" style={{justifyContent:'space-between'}}>
                <span>HP losses</span><span style={{fontFamily:'var(--mono)'}}>−47</span>
              </div>
              <div className="row" style={{justifyContent:'space-between'}}>
                <span>charges (item)</span><span style={{fontFamily:'var(--mono)'}}>2</span>
              </div>
              <div className="row" style={{justifyContent:'space-between'}}>
                <span>real time</span><span style={{fontFamily:'var(--mono)'}}>00:42</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Loot found · this run</div>
      <table className="inv">
        <thead><tr><th>room</th><th>item</th><th>value</th><th>claimed by</th></tr></thead>
        <tbody>
          <tr><td>#3</td><td>2 iron keys (cell + reliquary)</td><td>—</td><td>Doruk</td></tr>
          <tr><td>#3</td><td>Ledger · Zhent payroll</td><td>intel</td><td>Vessa (research)</td></tr>
          <tr><td>#4</td><td><i>(in progress — combat)</i></td><td>—</td><td>—</td></tr>
        </tbody>
      </table>
    </div>
  );
}

