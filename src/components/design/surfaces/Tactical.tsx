// @ts-nocheck
'use client'

import * as React from 'react'
import { TileWorld, type PositionedEntityVisual } from '../dungeon/TileWorld'
import { type TileVisual } from '../dungeon/tiles'
import { FidelityBadge } from './_chips'

// surfaces/Tactical.tsx — Surface 50.
//
// DM combat canvas. Click-to-place tokens on a tile grid for the table tonight.
// Stateful by design — combat is the single React-state-as-game-state exception
// per CLAUDE.md. v1 keeps the scene local; later we can serialize the scene
// into MMScene + push a session bundle at end.
//
// Built quickly for live-table use — feature set:
//   - configurable grid (W × H, tile size)
//   - tile painter (floor / wall / water / pit / pillar / chest / altar / rune)
//   - quick-spawn presets (goblin / orc / skeleton / etc) → enter placement mode → click tile
//   - custom token form (any name + HP / AC / init mod + side)
//   - right-click tile = ctx menu (spawn or paint)
//   - right-click token = ctx menu (select / remove)
//   - HP tracking with damage / heal inputs on the selected token
//   - initiative panel (auto-rolled), Next-turn / Round counter
//   - d20 button + scrolling roll log

const DEFAULT_W = 20
const DEFAULT_H = 14

type TokenSide = 'party' | 'enemy' | 'neutral' | 'npc'

interface Token {
  id: string
  name: string
  x: number
  y: number
  side: TokenSide
  hp: number
  hpMax: number
  ac: number
  initMod: number
  initRoll: number | null
  status: 'active' | 'down' | 'fled'
}

type TileKind =
  | 'floor' | 'wall' | 'water' | 'pit' | 'rubble'
  | 'pillar' | 'chest' | 'altar' | 'rune'

const TILE_PALETTE: TileKind[] = ['floor', 'wall', 'water', 'pit', 'rubble', 'pillar', 'chest', 'altar', 'rune']

interface MonsterPreset {
  label: string
  hp: number
  ac: number
  initMod: number
  side: TokenSide
}

const MONSTER_PRESETS: MonsterPreset[] = [
  { label: 'Goblin',          hp: 7,  ac: 15, initMod: 2,  side: 'enemy' },
  { label: 'Orc',             hp: 15, ac: 13, initMod: 1,  side: 'enemy' },
  { label: 'Skeleton',        hp: 13, ac: 13, initMod: 2,  side: 'enemy' },
  { label: 'Zombie',          hp: 22, ac: 8,  initMod: -2, side: 'enemy' },
  { label: 'Bandit',          hp: 11, ac: 12, initMod: 1,  side: 'enemy' },
  { label: 'Wolf',            hp: 11, ac: 13, initMod: 2,  side: 'enemy' },
  { label: 'Ogre',            hp: 59, ac: 11, initMod: -1, side: 'enemy' },
  { label: 'Cult Fanatic',    hp: 33, ac: 13, initMod: 2,  side: 'enemy' },
  { label: 'Brigand Captain', hp: 65, ac: 15, initMod: 2,  side: 'enemy' },
  { label: 'Cultist',         hp: 9,  ac: 12, initMod: 1,  side: 'enemy' },
]

function makeEmptyTiles(w: number, h: number, fill: TileKind = 'floor'): TileVisual[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({ kind: fill })))
}

function uid(prefix = 'tok'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

interface CtxMenu {
  x: number
  y: number
  type: 'tile' | 'token'
  tileX?: number
  tileY?: number
  tokenId?: string
}

export default function Tactical() {
  const [gridW, setGridW] = React.useState(DEFAULT_W)
  const [gridH, setGridH] = React.useState(DEFAULT_H)
  const [tiles, setTiles] = React.useState<TileVisual[][]>(() => makeEmptyTiles(DEFAULT_W, DEFAULT_H))
  const [tokens, setTokens] = React.useState<Token[]>([])
  const [selectedTokenId, setSelectedTokenId] = React.useState<string | null>(null)
  const [paintKind, setPaintKind] = React.useState<TileKind | null>(null)
  const [pendingPlacement, setPendingPlacement] = React.useState<MonsterPreset & { name: string } | null>(null)
  const [moveTokenId, setMoveTokenId] = React.useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = React.useState<CtxMenu | null>(null)
  const [round, setRound] = React.useState(1)
  const [turnIdx, setTurnIdx] = React.useState(0)
  const [rollLog, setRollLog] = React.useState<string[]>([])
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [tileSize, setTileSize] = React.useState(36)

  const log = React.useCallback((line: string) => {
    setRollLog((l) => [line, ...l].slice(0, 50))
  }, [])

  const placeToken = React.useCallback((preset: MonsterPreset & { name: string }, x: number, y: number) => {
    const newToken: Token = {
      id: uid('tok'),
      name: preset.name,
      x, y,
      side: preset.side,
      hp: preset.hp,
      hpMax: preset.hp,
      ac: preset.ac,
      initMod: preset.initMod,
      initRoll: null,
      status: 'active',
    }
    setTokens((t) => [...t, newToken])
    log(`✦ spawned ${preset.name} at (${x},${y})`)
  }, [log])

  const initiativeOrder = React.useMemo(() => {
    const active = tokens.filter((t) => t.status === 'active')
    return [...active].sort((a, b) => {
      const ai = a.initRoll ?? a.initMod
      const bi = b.initRoll ?? b.initMod
      return bi - ai
    })
  }, [tokens])

  const currentTurn = initiativeOrder.length > 0 ? initiativeOrder[turnIdx % initiativeOrder.length] : null

  const rollAllInitiative = () => {
    log('— Initiative rolled —')
    setTokens((prev) => prev.map((t) => {
      if (t.status !== 'active') return t
      const r = Math.floor(Math.random() * 20) + 1 + t.initMod
      log(`  ${t.name}: ${r} (1d20${t.initMod >= 0 ? '+' : ''}${t.initMod})`)
      return { ...t, initRoll: r }
    }))
    setTurnIdx(0)
  }

  const advanceTurn = () => {
    if (initiativeOrder.length === 0) return
    const next = turnIdx + 1
    if (next >= initiativeOrder.length) {
      setTurnIdx(0)
      setRound((r) => r + 1)
      log(`— Round ${round + 1} —`)
    } else {
      setTurnIdx(next)
    }
  }

  const applyDamage = (tokenId: string, dmg: number) => {
    setTokens((prev) => prev.map((t) => {
      if (t.id !== tokenId) return t
      const newHp = Math.max(0, t.hp - dmg)
      const status: Token['status'] = newHp === 0 ? 'down' : t.status
      const tag = newHp === 0 ? ' · DOWN' : ''
      log(`  ${t.name} −${dmg} HP → ${newHp}/${t.hpMax}${tag}`)
      return { ...t, hp: newHp, status }
    }))
  }

  const healToken = (tokenId: string, amount: number) => {
    setTokens((prev) => prev.map((t) => {
      if (t.id !== tokenId) return t
      const newHp = Math.min(t.hpMax, t.hp + amount)
      const status: Token['status'] = newHp > 0 && t.status === 'down' ? 'active' : t.status
      log(`  ${t.name} +${amount} HP → ${newHp}/${t.hpMax}`)
      return { ...t, hp: newHp, status }
    }))
  }

  const removeToken = (tokenId: string) => {
    const tk = tokens.find((t) => t.id === tokenId)
    setTokens((prev) => prev.filter((t) => t.id !== tokenId))
    if (selectedTokenId === tokenId) setSelectedTokenId(null)
    if (tk) log(`✕ removed ${tk.name}`)
  }

  const moveToken = (tokenId: string, x: number, y: number) => {
    setTokens((prev) => prev.map((t) => t.id === tokenId ? { ...t, x, y } : t))
  }

  const setTile = (x: number, y: number, kind: TileKind) => {
    setTiles((prev) => prev.map((row, ry) =>
      ry === y ? row.map((tile, rx) => rx === x ? { kind } : tile) : row,
    ))
  }

  const handleTileClick = (event: { x: number; y: number; tile: TileVisual }) => {
    if (pendingPlacement) {
      placeToken(pendingPlacement, event.x, event.y)
      setPendingPlacement(null)
      return
    }
    if (moveTokenId) {
      moveToken(moveTokenId, event.x, event.y)
      const tk = tokens.find((t) => t.id === moveTokenId)
      if (tk) log(`↦ moved ${tk.name} to (${event.x},${event.y})`)
      setMoveTokenId(null)
      return
    }
    if (paintKind) {
      setTile(event.x, event.y, paintKind)
      return
    }
    setSelectedTokenId(null)
  }

  const handleTileContextMenu = (event: { x: number; y: number; tile: TileVisual }, e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'tile', tileX: event.x, tileY: event.y })
  }

  const handleEntityClick = (entity: PositionedEntityVisual) => {
    setSelectedTokenId(entity.id)
  }

  const handleEntityContextMenu = (entity: PositionedEntityVisual, e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'token', tokenId: entity.id })
  }

  const positionedEntities: PositionedEntityVisual[] = tokens
    .filter((t) => t.status === 'active')
    .map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      label: t.name.slice(0, 2).toUpperCase(),
      side: t.side,
      hpFrac: t.hpMax > 0 ? t.hp / t.hpMax : 0,
    }))

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null

  const banner = pendingPlacement
    ? { text: `PLACEMENT MODE · ${pendingPlacement.name} · click a tile to drop`, bg: 'var(--accent-gold)', cancel: () => setPendingPlacement(null) }
    : moveTokenId
      ? { text: `MOVE MODE · click a tile to move ${tokens.find((t) => t.id === moveTokenId)?.name ?? ''}`, bg: 'var(--accent-blue)', cancel: () => setMoveTokenId(null) }
      : paintKind
        ? { text: `PAINT MODE · ${paintKind} · click tiles to paint`, bg: 'var(--accent-blue)', cancel: () => setPaintKind(null) }
        : null

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">50 · tactical · DM combat canvas</div>
          <h2>Tactical <FidelityBadge level="partial" /></h2>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <span className="tiny">round <b>{round}</b> · turn {currentTurn ? <b>{currentTurn.name}</b> : '—'}</span>
          <button
            className="btn sm"
            onClick={() => {
              const r = Math.floor(Math.random() * 20) + 1
              log(`🎲 d20 = ${r}`)
            }}
          >🎲 d20</button>
        </div>
      </div>

      <div className="aside" style={{ maxWidth: 880, marginBottom: 12 }}>
        ↳ DM combat canvas. quick-spawn from the rail, then click a tile to drop.
        right-click a tile for ctx menu (spawn / paint). right-click a token for damage / remove.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 12,
          alignItems: 'flex-start',
          minWidth: 0,
        }}
      >
        {/* main canvas — flex-grow, scrolls horizontally if grid is wider than viewport */}
        <div className="box" style={{ padding: 0, overflow: 'hidden', minWidth: 0, gridColumn: '1 / -1' }}>
          {banner && (
            <div style={{ padding: '6px 10px', background: banner.bg, color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{banner.text}</span>
              <button className="btn sm" onClick={banner.cancel}>cancel</button>
            </div>
          )}
          <div style={{ overflow: 'auto', padding: 12 }}>
            <div style={{ width: gridW * tileSize, height: gridH * tileSize }}>
              <TileWorld
                tiles={tiles}
                entities={positionedEntities}
                tileSize={tileSize}
                selectedEntityId={selectedTokenId}
                onTileClick={handleTileClick}
                onTileContextMenu={handleTileContextMenu}
                onEntityClick={handleEntityClick}
                onEntityContextMenu={handleEntityContextMenu}
                showGrid
              />
            </div>
          </div>
        </div>

        {/* right rail — fluid, wraps onto its own row at narrow viewports */}
        <div
          className="col"
          style={{
            gap: 12,
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gridColumn: '1 / -1',
            alignItems: 'flex-start',
          }}
        >
          {/* Spawn presets */}
          <div className="box">
            <div className="box-title">
              <h3>Spawn</h3>
            </div>
            <div className="col" style={{ gap: 4, marginTop: 6 }}>
              {MONSTER_PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="btn sm"
                  style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'left' }}
                  onClick={() => setPendingPlacement({ ...p, name: p.label })}
                >
                  <span>{p.label}</span>
                  <span className="tiny" style={{ color: 'var(--ink-3)' }}>{p.hp} HP · AC {p.ac}</span>
                </button>
              ))}
              <button className="btn sm primary" style={{ marginTop: 6 }} onClick={() => setShowAddForm(true)}>+ Custom token…</button>
            </div>
          </div>

          {showAddForm && (
            <CustomAddForm
              onCancel={() => setShowAddForm(false)}
              onConfirm={(t) => {
                setShowAddForm(false)
                setPendingPlacement(t)
              }}
            />
          )}

          {/* Selected token panel */}
          {selectedToken && (
            <div className="box">
              <div className="box-title">
                <h3>{selectedToken.name}</h3>
                <span className="meta">{selectedToken.side}</span>
              </div>
              <div className="col" style={{ gap: 4, fontSize: 13, marginTop: 6 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>HP</span>
                  <span><b>{selectedToken.hp}</b> / {selectedToken.hpMax}</span>
                </div>
                <div className="bar gold" style={{ width: '100%' }}>
                  <span style={{ width: `${(selectedToken.hp / Math.max(1, selectedToken.hpMax)) * 100}%` }} />
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>AC</span><span>{selectedToken.ac}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>Init mod</span>
                  <span>{selectedToken.initMod >= 0 ? '+' : ''}{selectedToken.initMod}{selectedToken.initRoll !== null ? ` (rolled ${selectedToken.initRoll})` : ''}</span>
                </div>
                <div className="row" style={{ gap: 4, marginTop: 6 }}>
                  <DamageInput onApply={(n) => applyDamage(selectedToken.id, n)} />
                  <HealInput onApply={(n) => healToken(selectedToken.id, n)} />
                </div>
                <div className="row" style={{ gap: 4, marginTop: 4 }}>
                  <button className="btn sm" onClick={() => setMoveTokenId(selectedToken.id)}>↦ Move</button>
                  <button className="btn sm" onClick={() => removeToken(selectedToken.id)}>✕ Remove</button>
                </div>
              </div>
            </div>
          )}

          {/* Initiative */}
          <div className="box">
            <div className="box-title">
              <h3>Initiative</h3>
              <span className="meta">{initiativeOrder.length}</span>
            </div>
            {initiativeOrder.length === 0 ? (
              <div className="tiny muted" style={{ marginTop: 6 }}>add tokens then click "Roll init"</div>
            ) : (
              <div className="col" style={{ gap: 2, marginTop: 6 }}>
                {initiativeOrder.map((t, i) => {
                  const isCurrent = i === turnIdx
                  return (
                    <div
                      key={t.id}
                      className="row"
                      style={{
                        padding: '4px 6px',
                        background: isCurrent ? 'var(--accent-gold)' : 'transparent',
                        color: isCurrent ? 'var(--paper)' : 'var(--ink)',
                        cursor: 'pointer',
                        fontSize: 12,
                        justifyContent: 'space-between',
                      }}
                      onClick={() => setSelectedTokenId(t.id)}
                    >
                      <span>{i + 1}. {t.name}</span>
                      <span>{t.initRoll ?? `(${t.initMod >= 0 ? '+' : ''}${t.initMod})`}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="row" style={{ gap: 4, marginTop: 6 }}>
              <button className="btn sm" onClick={rollAllInitiative}>Roll init</button>
              <button className="btn sm primary" onClick={advanceTurn} disabled={initiativeOrder.length === 0}>Next turn →</button>
            </div>
          </div>

          {/* Tile painter */}
          <div className="box">
            <div className="box-title">
              <h3>Paint</h3>
              {paintKind && <span className="meta">{paintKind}</span>}
            </div>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {TILE_PALETTE.map((k) => (
                <button
                  key={k}
                  className={'btn sm' + (paintKind === k ? ' primary' : '')}
                  onClick={() => setPaintKind(paintKind === k ? null : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas controls */}
          <div className="box">
            <div className="box-title">
              <h3>Canvas</h3>
            </div>
            <div className="row" style={{ gap: 6, alignItems: 'flex-end', marginTop: 6, fontSize: 12, flexWrap: 'wrap' }}>
              <label>W <input type="number" min={6} max={50} value={gridW} onChange={(e) => setGridW(Math.max(6, Math.min(50, +e.target.value || 6)))} style={{ width: 50 }} /></label>
              <label>H <input type="number" min={6} max={40} value={gridH} onChange={(e) => setGridH(Math.max(6, Math.min(40, +e.target.value || 6)))} style={{ width: 50 }} /></label>
              <label>Tile <input type="number" min={20} max={64} value={tileSize} onChange={(e) => setTileSize(Math.max(20, Math.min(64, +e.target.value || 36)))} style={{ width: 50 }} /></label>
              <button
                className="btn sm"
                onClick={() => {
                  setTiles(makeEmptyTiles(gridW, gridH, 'floor'))
                  setTokens([])
                  setSelectedTokenId(null)
                  setRound(1)
                  setTurnIdx(0)
                  log('— Canvas reset —')
                }}
              >Reset</button>
            </div>
          </div>

          {/* Roll log */}
          <div className="box">
            <div className="box-title">
              <h3>Log</h3>
            </div>
            <div className="col" style={{ gap: 2, marginTop: 6, maxHeight: 220, overflowY: 'auto', fontSize: 11, fontFamily: 'var(--mono)' }}>
              {rollLog.length === 0 ? (
                <div className="tiny muted">no events yet.</div>
              ) : rollLog.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {ctxMenu && (
        <CtxMenuComponent
          menu={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onTilePaint={(kind) => {
            if (ctxMenu.tileX !== undefined && ctxMenu.tileY !== undefined) {
              setTile(ctxMenu.tileX, ctxMenu.tileY, kind)
            }
            setCtxMenu(null)
          }}
          onTileSpawn={(preset) => {
            if (ctxMenu.tileX !== undefined && ctxMenu.tileY !== undefined) {
              placeToken({ ...preset, name: preset.label }, ctxMenu.tileX, ctxMenu.tileY)
            }
            setCtxMenu(null)
          }}
          onTokenAction={(action) => {
            if (!ctxMenu.tokenId) return
            if (action === 'remove') removeToken(ctxMenu.tokenId)
            else if (action === 'select') setSelectedTokenId(ctxMenu.tokenId)
            else if (action === 'move') setMoveTokenId(ctxMenu.tokenId)
            setCtxMenu(null)
          }}
        />
      )}
    </div>
  )
}

function DamageInput({ onApply }: { onApply: (n: number) => void }) {
  const [v, setV] = React.useState('')
  const submit = () => { const n = +v; if (n > 0) { onApply(n); setV('') } }
  return (
    <div className="row" style={{ gap: 4, alignItems: 'center', flex: 1 }}>
      <input
        type="number"
        min={0}
        value={v}
        placeholder="dmg"
        onChange={(e) => setV(e.target.value)}
        style={{ width: 50, padding: '2px 4px', fontFamily: 'var(--mono)', fontSize: 12 }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
      <button className="btn sm" style={{ background: 'var(--accent-red)', color: 'var(--paper)' }} onClick={submit}>−</button>
    </div>
  )
}

function HealInput({ onApply }: { onApply: (n: number) => void }) {
  const [v, setV] = React.useState('')
  const submit = () => { const n = +v; if (n > 0) { onApply(n); setV('') } }
  return (
    <div className="row" style={{ gap: 4, alignItems: 'center', flex: 1 }}>
      <input
        type="number"
        min={0}
        value={v}
        placeholder="heal"
        onChange={(e) => setV(e.target.value)}
        style={{ width: 50, padding: '2px 4px', fontFamily: 'var(--mono)', fontSize: 12 }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
      <button className="btn sm" style={{ background: 'var(--accent-green)', color: 'var(--paper)' }} onClick={submit}>+</button>
    </div>
  )
}

function CustomAddForm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: (token: MonsterPreset & { name: string }) => void
}) {
  const [name, setName] = React.useState('')
  const [hp, setHp] = React.useState(20)
  const [ac, setAc] = React.useState(13)
  const [initMod, setInitMod] = React.useState(0)
  const [side, setSide] = React.useState<TokenSide>('enemy')

  const submit = () => {
    if (!name) return
    onConfirm({ label: name, name, hp, ac, initMod, side })
  }

  return (
    <div className="box">
      <div className="box-title">
        <h3>Custom token</h3>
      </div>
      <div className="col" style={{ gap: 6, marginTop: 6, fontSize: 12 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name"
          style={{ padding: '4px 6px', fontFamily: 'var(--mono)' }}
          autoFocus
        />
        <div className="row" style={{ gap: 6 }}>
          <label>HP <input type="number" value={hp} onChange={(e) => setHp(+e.target.value || 0)} style={{ width: 56 }} /></label>
          <label>AC <input type="number" value={ac} onChange={(e) => setAc(+e.target.value || 0)} style={{ width: 48 }} /></label>
          <label>Init <input type="number" value={initMod} onChange={(e) => setInitMod(+e.target.value || 0)} style={{ width: 44 }} /></label>
        </div>
        <select value={side} onChange={(e) => setSide(e.target.value as TokenSide)} style={{ padding: '4px 6px' }}>
          <option value="enemy">Enemy (red)</option>
          <option value="party">Party (blue)</option>
          <option value="neutral">Neutral (gold)</option>
          <option value="npc">NPC (grey)</option>
        </select>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm primary" disabled={!name} onClick={submit}>Place →</button>
          <button className="btn sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function CtxMenuComponent({
  menu,
  onClose,
  onTilePaint,
  onTileSpawn,
  onTokenAction,
}: {
  menu: CtxMenu
  onClose: () => void
  onTilePaint: (kind: TileKind) => void
  onTileSpawn: (preset: MonsterPreset) => void
  onTokenAction: (action: 'select' | 'move' | 'remove') => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    setTimeout(() => document.addEventListener('mousedown', close), 0)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  const x = Math.min(menu.x, window.innerWidth - 220)
  const y = Math.min(menu.y, window.innerHeight - 360)

  const baseStyle: React.CSSProperties = { padding: '4px 10px', cursor: 'pointer', fontSize: 11 }
  const hover = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'var(--paper-2)')
  const unhover = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'transparent')

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 400,
        background: 'var(--paper)',
        border: '2px solid var(--ink)',
        boxShadow: '4px 4px 0 var(--ink)',
        minWidth: 200,
        fontFamily: 'var(--mono)',
      }}
    >
      {menu.type === 'tile' && (
        <>
          <div style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule-soft)', color: 'var(--ink-3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            tile ({menu.tileX},{menu.tileY})
          </div>
          <div style={{ padding: '3px 10px', color: 'var(--ink-3)', fontSize: 9, textTransform: 'uppercase' }}>spawn</div>
          {MONSTER_PRESETS.slice(0, 7).map((p) => (
            <div key={p.label} onClick={() => onTileSpawn(p)} style={baseStyle} onMouseEnter={hover} onMouseLeave={unhover}>
              + {p.label}
            </div>
          ))}
          <div style={{ padding: '3px 10px', color: 'var(--ink-3)', fontSize: 9, textTransform: 'uppercase', borderTop: '1px solid var(--rule-soft)' }}>paint</div>
          {(['floor', 'wall', 'water', 'pit', 'pillar'] as TileKind[]).map((k) => (
            <div key={k} onClick={() => onTilePaint(k)} style={baseStyle} onMouseEnter={hover} onMouseLeave={unhover}>
              ▦ {k}
            </div>
          ))}
        </>
      )}
      {menu.type === 'token' && (
        <>
          <div style={{ padding: '4px 10px', borderBottom: '1px solid var(--rule-soft)', color: 'var(--ink-3)', fontSize: 9, textTransform: 'uppercase' }}>
            token
          </div>
          <div onClick={() => onTokenAction('select')} style={baseStyle} onMouseEnter={hover} onMouseLeave={unhover}>✏ Select</div>
          <div onClick={() => onTokenAction('move')} style={baseStyle} onMouseEnter={hover} onMouseLeave={unhover}>↦ Move</div>
          <div onClick={() => onTokenAction('remove')} style={{ ...baseStyle, color: 'var(--accent-red)' }} onMouseEnter={hover} onMouseLeave={unhover}>✕ Remove</div>
        </>
      )}
    </div>
  )
}
