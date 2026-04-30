// @ts-nocheck
'use client'

/**
 * Map surface (47) — square voxel grid viewport with pan + zoom controls.
 *
 * Per Pedro's 2026-04-30 visualization spec:
 *   - 6 zoom levels: combat (5ft) → tactical (40ft) → city (320ft) →
 *     mapL1 (~0.5mi) → mapL2 (~3.9mi) → mapL3 (~31mi continent)
 *   - Square voxel chunking. Each level is 8× the previous.
 *
 * The renderer is `<GridViewport />`. This surface adds:
 *   - Zoom controls (combat ↔ continent)
 *   - Pan controls (4-direction buttons + WASD/arrow keys)
 *   - Tile inspector (click to see biome/elevation details)
 *   - Toggle layers (roads, rivers, settlements)
 *   - Reset to origin
 */

import * as React from 'react'
import { fetchWorldState, type WorldStatusClient } from '@/lib/world-client'
import GridViewport, { type TileViewItem } from '@/components/grid/GridViewport'
import { MAX_LEVEL, SCALE_LABELS, feetPerTile, type ScaleLevel } from '@/game/grid'

export default function Map() {
  const [world, setWorld] = React.useState<WorldStatusClient | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [centerX, setCenterX] = React.useState(0)
  const [centerY, setCenterY] = React.useState(0)
  const [level, setLevel] = React.useState<ScaleLevel>(0)
  const [radius, setRadius] = React.useState(10)
  const [tilePx, setTilePx] = React.useState(32)
  const [selected, setSelected] = React.useState<TileViewItem | null>(null)
  const [showRoads, setShowRoads] = React.useState(true)
  const [showRivers, setShowRivers] = React.useState(true)
  const [showSettlements, setShowSettlements] = React.useState(true)

  React.useEffect(() => {
    fetchWorldState()
      .then((w) => {
        setWorld(w)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'world_state_failed'))
  }, [])

  // Pan via arrow keys / WASD
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = Math.max(1, Math.floor(radius / 3))
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setCenterY((y) => y - step)
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          setCenterY((y) => y + step)
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setCenterX((x) => x - step)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          setCenterX((x) => x + step)
          break
        case '+':
        case '=':
          setLevel((l) => (l > 0 ? ((l - 1) as ScaleLevel) : l))
          break
        case '-':
        case '_':
          setLevel((l) => (l < MAX_LEVEL ? ((l + 1) as ScaleLevel) : l))
          break
        case 'Home':
        case '0':
          setCenterX(0)
          setCenterY(0)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [radius])

  if (error) {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">47 · Map · grid viewport</div>
            <h2>Map</h2>
          </div>
        </div>
        <div className="aside" style={{ color: 'var(--accent-red)' }}>
          world fetch failed: {error}
        </div>
      </div>
    )
  }

  if (!world) {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">47 · Map · grid viewport</div>
            <h2>Map</h2>
          </div>
        </div>
        <p style={{ color: 'var(--ink-2)' }}>… loading world state</p>
      </div>
    )
  }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">47 · Map · square voxel grid · seed {world.seed}</div>
          <h2>Map</h2>
        </div>
        <span className="who">L{level} · {SCALE_LABELS[level]} · 1 tile = {feetPerTile(level)}ft</span>
      </div>

      <p style={{ maxWidth: 720, color: 'var(--ink-2)', marginTop: 0, fontSize: 13 }}>
        WASD/arrows to pan · +/- to zoom · click a tile for biome inspector ·
        all rendering is client-side from world seed (no server round-trips).
      </p>

      <div className="grid-3" style={{ gap: 14, alignItems: 'flex-start' }}>
        {/* ── Viewport ── */}
        <div style={{ gridColumn: 'span 2' }}>
          <GridViewport
            seed={world.seed}
            centerX={centerX}
            centerY={centerY}
            level={level}
            radius={radius}
            tilePx={tilePx}
            showRoads={showRoads}
            showRivers={showRivers}
            showSettlements={showSettlements}
            onTileClick={(t) => setSelected(t)}
            highlightTile={selected ? { x: selected.x, y: selected.y } : null}
            partyTiles={
              // Stub: until TP nodes have tile coords, drop a marker at
              // the viewport origin so the player has a visual anchor.
              centerX === 0 && centerY === 0
                ? [{ x: 0, y: 0, label: world.partyNodeLabel }]
                : []
            }
          />
        </div>

        {/* ── Right rail: controls + inspector ── */}
        <div className="col" style={{ gap: 12 }}>
          {/* Zoom controls */}
          <div className="box">
            <div className="box-title">
              <h3>Zoom</h3>
              <span className="meta">{SCALE_LABELS[level]}</span>
            </div>
            <div className="col" style={{ gap: 4, marginTop: 6 }}>
              {([0, 1, 2, 3, 4, 5] as ScaleLevel[]).map((l) => (
                <button
                  key={l}
                  className={'btn sm' + (l === level ? ' primary' : '')}
                  onClick={() => setLevel(l)}
                  style={{ textAlign: 'left' }}
                >
                  L{l} · {SCALE_LABELS[l]} ({feetPerTile(l)}ft)
                </button>
              ))}
            </div>
          </div>

          {/* Pan controls */}
          <div className="box">
            <div className="box-title">
              <h3>Pan</h3>
              <span className="meta">center: ({centerX}, {centerY})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 6 }}>
              <div></div>
              <button className="btn sm" onClick={() => setCenterY((y) => y - Math.max(1, Math.floor(radius / 3)))}>↑</button>
              <div></div>
              <button className="btn sm" onClick={() => setCenterX((x) => x - Math.max(1, Math.floor(radius / 3)))}>←</button>
              <button className="btn sm" onClick={() => { setCenterX(0); setCenterY(0) }}>⌂</button>
              <button className="btn sm" onClick={() => setCenterX((x) => x + Math.max(1, Math.floor(radius / 3)))}>→</button>
              <div></div>
              <button className="btn sm" onClick={() => setCenterY((y) => y + Math.max(1, Math.floor(radius / 3)))}>↓</button>
              <div></div>
            </div>
          </div>

          {/* Layer toggles */}
          <div className="box">
            <div className="box-title">
              <h3>Layers</h3>
              <span className="meta">L0 only</span>
            </div>
            <div className="col" style={{ gap: 4, marginTop: 6 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showRoads}
                  onChange={(e) => setShowRoads(e.target.checked)}
                />
                <span style={{ fontSize: 13 }}>roads (dashed)</span>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showRivers}
                  onChange={(e) => setShowRivers(e.target.checked)}
                />
                <span style={{ fontSize: 13 }}>rivers (blue)</span>
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showSettlements}
                  onChange={(e) => setShowSettlements(e.target.checked)}
                />
                <span style={{ fontSize: 13 }}>settlements (yellow)</span>
              </label>
            </div>
          </div>

          {/* Render quality */}
          <div className="box">
            <div className="box-title">
              <h3>Render</h3>
              <span className="meta">{2 * radius + 1}² tiles</span>
            </div>
            <div className="col" style={{ gap: 6, marginTop: 6 }}>
              <label className="tiny">
                radius: {radius}
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </label>
              <label className="tiny">
                tile size: {tilePx}px
                <input
                  type="range"
                  min={12}
                  max={64}
                  value={tilePx}
                  onChange={(e) => setTilePx(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </label>
            </div>
          </div>

          {/* Tile inspector */}
          <div className="box">
            <div className="box-title">
              <h3>Inspector</h3>
              <span className="meta">{selected ? 'tile' : 'click a tile'}</span>
            </div>
            {selected ? (
              <div className="tiny" style={{ marginTop: 6, fontFamily: 'var(--mono)', lineHeight: 1.7 }}>
                ({selected.x}, {selected.y})<br />
                <b>{selected.label}</b><br />
                elevation: {(selected.elevation * 100).toFixed(1)}%<br />
                moisture: {(selected.moisture * 100).toFixed(1)}%<br />
                temperature: {(selected.temperature * 100).toFixed(1)}%<br />
                center height: {selected.centerHeight}<br />
                corners: [{selected.cornerHeights.join(', ')}]<br />
                move cost: {selected.moveCost === Infinity ? '∞' : selected.moveCost.toFixed(1)}
              </div>
            ) : (
              <p className="tiny muted" style={{ marginTop: 6 }}>
                click any tile in the grid to inspect biome data
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
