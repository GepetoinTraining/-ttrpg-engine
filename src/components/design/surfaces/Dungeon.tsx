// @ts-nocheck
'use client'

import React from 'react'
import { DungeonGrid, exampleDungeonLevel } from '../dungeon/DungeonGrid'
import { TexturePicker, Texture } from '../dungeon/primitives'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Dungeon.tsx — Dungeon runner (engine/dungeon-*.ts).
// SURFACE wiring deferred per Pedro (encounter builder needs design pass first).
// What remains is a primitives demo so engine team can verify the schema.
// All mock rooms/party/loot stripped for semi-prod.

export default function Dungeon() {
  const [pickedTexture, setPickedTexture] = React.useState<any>('stone-rough')
  const [showDemoLevel, setShowDemoLevel] = React.useState(false)
  const demoLevel = React.useMemo(() => (showDemoLevel ? exampleDungeonLevel() : null), [showDemoLevel])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">26 · Dungeon runner</div>
          <h2>Dungeon <FidelityBadge level="strip-only" /></h2>
        </div>
        <span className="who">DM · live mapper · party sees revealed only</span>
      </div>

      <div className="aside" style={{marginBottom: 18}}>
        ↳ engine simulates noise, lights, monster patrol, and resource drain. each room has
        threat, loot, hidden links. revealing a corridor pushes the FOW back; monsters can
        path between linked rooms when alerted. <i>encounter builder + room mapper deferred — surface needs design pass.</i>
      </div>

      {/* Primitives strip — the foundation the encounter builder will sit on. */}
      <div className="box" style={{marginBottom: 18, padding: 14, borderColor: 'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Dungeon primitives · ready</h3>
          <span className="meta">src/lib/dungeon/* + components/design/dungeon/* · editor surface deferred</span>
        </div>
        <div className="grid-3" style={{gap: 14, marginTop: 8}}>
          <div style={{gridColumn: 'span 2'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginBottom: 8}}>
              <div className="tiny">SCHEMA DEMO</div>
              <button className="btn sm" onClick={() => setShowDemoLevel(s => !s)}>
                {showDemoLevel ? 'hide demo level' : 'load demo level'}
              </button>
            </div>
            {demoLevel ? (
              <>
                <DungeonGrid level={demoLevel} cellPx={56} reveal={true} />
                <div className="tiny muted" style={{marginTop: 6}}>
                  4×3 stone room · pit hazard · chest · torch · goblin ambush spawn · demo tokens.
                  Composition: Tile · Edge · Door · Hazard · Spawn · LightSource · Annotation · DungeonObject.
                </div>
              </>
            ) : (
              <EmptyState
                label="no dungeon loaded"
                hint="click `load demo level` to render the schema fixture, or wire to an active dungeon session."
              />
            )}
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

      {/* Active dungeon session — pending wire */}
      <div className="box">
        <div className="box-title">
          <h3>Active dungeon</h3>
          <span className="meta">—</span>
        </div>
        <EmptyState
          label="no active dungeon session"
          hint="wires once mm-scene + dungeon-gate.ts expose the per-session level + party state. Mapper, room detail, patrol & alerts, loot tracker — all attach here."
        />
      </div>
    </div>
  )
}
