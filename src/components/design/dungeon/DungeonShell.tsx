'use client'

/**
 * DungeonShell — full dungeon viewer.
 *
 * Architecture:
 *   - **Engine wins. Design adapts.** Data shape from `engine/dungeon-stamp.ts`
 *     (deterministic from gate seed). UI ported from the design package
 *     (`DungeonShell.jsx`), adapted to consume our data and emit TPB
 *     actions instead of mutating React state for game data.
 *   - **No useState for game data.** What's in a chest, whether a door is
 *     locked, who's cleared the room — all lives in TPB (writeKappa actions
 *     replayed). Local React state only for view-side concerns: which view
 *     mode, selection, hover, modal-open.
 *   - **Combat is the single stateful exception.** `MMScene` (engine/mm-scene)
 *     is a pocket-manifold instance that lives for the duration of a fight.
 *     Each round → write to TPB / IDB. End-of-fight → bundle push.
 *
 * Three view modes:
 *   1. exploration — TileWorld renders current room. Click tile/entity →
 *      context menu; menu items emit engineClient.applyIntent calls.
 *   2. corridor — narrow TileWorld animates the party along a corridor edge
 *      (forward/backward); FoW curves around bends.
 *   3. combat — MMScene-driven round-by-round combat. Mob-ai (W3.1) drives
 *      enemy turns. Dies/checks/damage produce receipts shown in the strip.
 */

import * as React from 'react'
import { useWorld } from '@/lib/use-world'
import { TileWorld, type PositionedEntityVisual, type PositionedDecorationVisual } from './TileWorld'
import { type TileVisual } from './tiles'
import {
  CharacterSheetModal,
  InventoryModal,
  RestPanelModal,
  type PartyMember,
} from './DungeonModals'
import {
  generateDungeonInterior,
  resetInteriorIdCounter,
  type DungeonInterior,
  type DungeonRoom,
} from '../../../../engine/dungeon-interior'
import {
  stampDungeonLayouts,
  type RoomLayout,
  type DungeonCorridor,
  type StampedDungeon,
} from '../../../../engine/dungeon-stamp'
import { MMScene, type Combatant, type RoundResult } from '../../../../engine/mm-scene'

const TILE_SIZE_EXPLORE = 36
const TILE_SIZE_CORRIDOR = 38
const CORRIDOR_ANIM_MS = 1200

const LIGHTING_TINT: Record<string, string | null> = {
  bright: null,
  dim: 'rgba(10,8,4,0.28)',
  dark: 'rgba(4,4,10,0.50)',
  magical: 'rgba(40,10,60,0.22)',
}

const ROOM_LABELS: Record<DungeonRoom['type'], string> = {
  entrance: 'ENTRANCE',
  corridor: 'CORRIDOR',
  chamber: 'CHAMBER',
  trap_room: 'TRAP',
  treasure_room: 'TREASURE',
  shrine: 'SHRINE',
  lair: 'LAIR',
  boss_chamber: 'BOSS',
  dead_end: 'DEAD END',
  junction: 'JUNCTION',
}

const ROOM_TYPE_COLORS: Record<DungeonRoom['type'], string> = {
  entrance: '#3a5d7a',
  corridor: '#807468',
  chamber: '#5e564a',
  trap_room: '#a8442a',
  treasure_room: '#b08838',
  shrine: '#a070c0',
  lair: '#5a3a2a',
  boss_chamber: '#c81818',
  dead_end: '#3a3a3a',
  junction: '#807468',
}

// ── demo data (V2: read from /api/gate/[id] + mm-party) ──

const DEMO_PARTY: PartyMember[] = [
  {
    id: 'arden',
    name: 'Arden',
    race: 'human',
    klass: 'fighter',
    level: 5,
    hpCurrent: 38,
    hpMax: 42,
    ac: 18,
    speed: 30,
    init: 2,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
    conditions: [],
    inventory: [
      { id: 'longsword', name: 'Longsword', qty: 1, weight: 3, valueGP: 15 },
      { id: 'shield', name: 'Shield', qty: 1, weight: 6, valueGP: 10 },
      { id: 'rations', name: 'Rations', qty: 5, weight: 2, valueGP: 0.5 },
    ],
    goldGP: 87,
  },
  {
    id: 'elara',
    name: 'Elara',
    race: 'elf',
    klass: 'wizard',
    level: 5,
    hpCurrent: 24,
    hpMax: 28,
    ac: 14,
    speed: 30,
    init: 4,
    abilities: { str: 8, dex: 16, con: 12, int: 18, wis: 14, cha: 10 },
    conditions: [],
    inventory: [
      { id: 'staff', name: 'Quarterstaff', qty: 1, weight: 4, valueGP: 1 },
      { id: 'spellbook', name: 'Spellbook', qty: 1, weight: 3, valueGP: 50 },
      { id: 'components', name: 'Component Pouch', qty: 1, weight: 2, valueGP: 25 },
    ],
    goldGP: 62,
  },
  {
    id: 'mira',
    name: 'Mira',
    race: 'halfling',
    klass: 'rogue',
    level: 5,
    hpCurrent: 19,
    hpMax: 22,
    ac: 15,
    speed: 25,
    init: 5,
    abilities: { str: 10, dex: 18, con: 12, int: 12, wis: 10, cha: 14 },
    conditions: [],
    inventory: [
      { id: 'dagger_pair', name: 'Daggers', qty: 2, weight: 1, valueGP: 2 },
      { id: 'tools_thieves', name: "Thieves' Tools", qty: 1, weight: 1, valueGP: 25 },
    ],
    goldGP: 144,
  },
  {
    id: 'orin',
    name: 'Orin',
    race: 'dwarf',
    klass: 'cleric',
    level: 5,
    hpCurrent: 31,
    hpMax: 33,
    ac: 17,
    speed: 25,
    init: 0,
    abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    conditions: [],
    inventory: [
      { id: 'mace', name: 'Mace', qty: 1, weight: 4, valueGP: 5 },
      { id: 'shield', name: 'Shield', qty: 1, weight: 6, valueGP: 10 },
      { id: 'holy_symbol', name: 'Holy Symbol', qty: 1, weight: 1, valueGP: 5 },
    ],
    goldGP: 72,
  },
]

const DEMO_SEEDS = [10, 5, 15, 3, 18, 7, 12, 1, 20, 9, 6, 14, 8, 17, 2]

function buildDemoDungeon(): StampedDungeon {
  resetInteriorIdCounter()
  const interior = generateDungeonInterior('gate_demo', 2, 'lair', 'goblin', 100, 0, DEMO_SEEDS)
  return stampDungeonLayouts(interior, 'gate_demo')
}

// ── data adapters (engine RoomLayout → TileWorld props) ──

function roomTilesAsVisual(layout: RoomLayout): TileVisual[][] {
  return layout.tileGrid.map((row) => row.map((kind) => ({ kind })))
}

function partyAsEntities(layout: RoomLayout, party: PartyMember[]): PositionedEntityVisual[] {
  const door = layout.doors[0]
  const baseX = door?.position.x ?? Math.floor(layout.tileW / 2)
  const baseY = door?.position.y ?? Math.floor(layout.tileH / 2)
  const offsets = [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
  ]
  return party.map((m, i) => {
    const off = offsets[i % offsets.length]
    return {
      id: m.id,
      x: Math.max(1, Math.min(layout.tileW - 2, baseX + off.dx)),
      y: Math.max(1, Math.min(layout.tileH - 2, baseY + off.dy)),
      label: m.name,
      side: 'party',
      hpFrac: m.hpMax > 0 ? m.hpCurrent / m.hpMax : 0,
    }
  })
}

function mobsAsEntities(layout: RoomLayout): PositionedEntityVisual[] {
  return layout.encounters.map((enc) => ({
    id: enc.id,
    x: enc.position.x,
    y: enc.position.y,
    label: enc.speciesId,
    side: 'enemy',
  }))
}

function decorationsForRoom(layout: RoomLayout): PositionedDecorationVisual[] {
  const out: PositionedDecorationVisual[] = []
  for (const f of layout.features) {
    let glyph = '·'
    switch (f.kind) {
      case 'pillar': glyph = '◉'; break
      case 'altar': glyph = '☩'; break
      case 'pool': glyph = '〜'; break
      case 'rubble': glyph = '⋯'; break
      case 'brazier': glyph = '🜂'; break
      case 'statue': glyph = '☖'; break
      case 'banner': glyph = '⚑'; break
      case 'rune': glyph = '✶'; break
    }
    out.push({ id: f.id, x: f.position.x, y: f.position.y, glyph })
  }
  for (const t of layout.traps) {
    out.push({
      id: t.id,
      x: t.position.x,
      y: t.position.y,
      glyph: t.disarmed ? '○' : '✕',
      color: t.disarmed ? '#807468' : '#a8442a',
    })
  }
  for (const l of layout.loot) {
    out.push({
      id: l.id,
      x: l.position.x,
      y: l.position.y,
      glyph: l.container === 'chest' ? '⌧' : l.container === 'altar' ? '☩' : '✦',
      color: '#b08838',
    })
  }
  return out
}

/** Convert dungeon-stamp PositionedEncounters into MMScene Combatants. */
function buildCombatants(layout: RoomLayout, party: PartyMember[]): Combatant[] {
  const partyCombatants: Combatant[] = party.map((m) => ({
    id: m.id,
    name: m.name,
    side: 'party',
    initiativeModifier: m.init,
    hpCurrent: m.hpCurrent,
    hpMax: m.hpMax,
    tempHp: 0,
    ac: m.ac,
    attackModifier: Math.floor((m.abilities.str - 10) / 2) + 3,
    damageDice: { count: 1, sides: 8, modifier: Math.floor((m.abilities.str - 10) / 2) },
    damageType: 'slashing',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
  }))

  const mobs: Combatant[] = []
  for (const enc of layout.encounters) {
    for (let i = 0; i < enc.count; i++) {
      const id = `${enc.id}_${i}`
      mobs.push({
        id,
        name: `${enc.speciesId} ${i + 1}`,
        side: 'enemy',
        initiativeModifier: 1,
        hpCurrent: Math.max(4, Math.round(enc.crEach * 8) + 4),
        hpMax: Math.max(4, Math.round(enc.crEach * 8) + 4),
        tempHp: 0,
        ac: 12,
        attackModifier: 3,
        damageDice: { count: 1, sides: 6, modifier: 1 },
        damageType: 'piercing',
        resistances: [],
        vulnerabilities: [],
        immunities: [],
        status: 'active',
        mobBehavior: {
          objective: 'KILL_PCS',
          temperament: enc.behavior === 'sleeping' ? 'COWARD' : 'AGGRESSIVE',
          adaptations: [],
        },
      })
    }
  }
  return [...partyCombatants, ...mobs]
}

// ── room id helpers ──

function roomById(dungeon: DungeonInterior, id: string): DungeonRoom | undefined {
  return dungeon.rooms.find((r) => r.id === id)
}

function corridorBetween(
  corridors: DungeonCorridor[],
  fromId: string,
  toId: string,
): DungeonCorridor | undefined {
  return corridors.find(
    (c) =>
      (c.fromRoomId === fromId && c.toRoomId === toId) ||
      (c.toRoomId === fromId && c.fromRoomId === toId),
  )
}

// ── status bar ──

function StatusBar({
  dungeon,
  currentRoom,
  party,
  viewMode,
}: {
  dungeon: DungeonInterior
  currentRoom: DungeonRoom | null
  party: PartyMember[]
  viewMode: 'exploration' | 'corridor' | 'combat'
}): React.ReactElement {
  const cleared = dungeon.rooms.filter((r) => r.cleared).length
  const total = dungeon.rooms.length
  const partyHp = party.reduce((s, m) => s + m.hpCurrent, 0)
  const partyMax = party.reduce((s, m) => s + m.hpMax, 0)
  const hpFrac = partyMax > 0 ? partyHp / partyMax : 0
  const hpColor = hpFrac < 0.3 ? '#a8442a' : hpFrac < 0.6 ? '#b08838' : '#2c8a3e'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 18px',
        height: 52,
        background: 'var(--paper, #f5efe1)',
        borderBottom: '2px solid var(--ink, #1f1b16)',
        fontFamily: 'var(--mono, ui-monospace)',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-3, #807468)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {dungeon.name}
        </div>
        <div
          style={{
            fontSize: 15,
            fontFamily: 'var(--serif, Georgia)',
            fontWeight: 600,
            lineHeight: 1.1,
          }}
        >
          {currentRoom?.name ?? '—'}
        </div>
      </div>
      <div style={{ width: 1, height: 32, background: 'var(--rule-soft, #d9cfb8)' }} />
      <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
        <span style={{ color: 'var(--ink-3, #807468)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          TIER <b style={{ color: 'var(--ink, #1f1b16)' }}>{dungeon.tier}</b>
        </span>
        <span style={{ color: 'var(--ink-3, #807468)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          ROOMS <b style={{ color: 'var(--ink, #1f1b16)' }}>{cleared}/{total}</b>
        </span>
        <span style={{ color: 'var(--ink-3, #807468)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          HP <b style={{ color: hpColor }}>{partyHp}/{partyMax}</b>
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          padding: '3px 10px',
          background:
            viewMode === 'combat'
              ? 'var(--accent-red, #a8442a)'
              : viewMode === 'corridor'
                ? 'var(--accent-blue, #3a5d7a)'
                : 'var(--paper-2, #ebe2cc)',
          color:
            viewMode === 'combat' || viewMode === 'corridor'
              ? 'var(--paper, #f5efe1)'
              : 'var(--ink, #1f1b16)',
          border: '1px solid var(--rule, #c8bea3)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {viewMode}
      </div>
      {currentRoom && (
        <div
          style={{
            padding: '3px 10px',
            background: ROOM_TYPE_COLORS[currentRoom.type] + '22',
            border: `1px solid ${ROOM_TYPE_COLORS[currentRoom.type]}`,
            color: ROOM_TYPE_COLORS[currentRoom.type],
            fontSize: 10,
            letterSpacing: '0.08em',
          }}
        >
          {ROOM_LABELS[currentRoom.type]}
        </div>
      )}
    </div>
  )
}

// ── minimap with room shape variants ──

function DungeonMinimap({
  dungeon,
  corridors,
  currentRoomId,
  onPick,
}: {
  dungeon: DungeonInterior
  corridors: DungeonCorridor[]
  currentRoomId: string
  onPick: (roomId: string) => void
}): React.ReactElement {
  const cellW = 64
  const cellH = 52
  const pad = 24
  const nodeW = 48
  const nodeH = 32

  const positions = new Map<string, { x: number; y: number }>()
  const cols = 5
  for (let i = 0; i < dungeon.rooms.length; i++) {
    const room = dungeon.rooms[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.set(room.id, { x: pad + col * cellW, y: pad + row * cellH + cellH / 2 })
  }
  const rows = Math.ceil(dungeon.rooms.length / cols)
  const w = pad * 2 + cols * cellW
  const h = pad * 2 + rows * cellH

  return (
    <svg width={w} height={h} style={{ background: 'var(--paper-2, #ebe2cc)' }}>
      {/* corridor edges */}
      {corridors.map((c) => {
        const from = positions.get(c.fromRoomId)
        const to = positions.get(c.toRoomId)
        if (!from || !to) return null
        const explored =
          roomById(dungeon, c.fromRoomId)?.explored || roomById(dungeon, c.toRoomId)?.explored
        return (
          <line
            key={c.id}
            x1={from.x + nodeW / 2}
            y1={from.y}
            x2={to.x + nodeW / 2}
            y2={to.y}
            stroke={explored ? 'var(--ink, #1f1b16)' : 'var(--rule-soft, #d9cfb8)'}
            strokeWidth={c.width > 1 ? 3 : 2}
            strokeDasharray={explored ? 'none' : '4 3'}
          />
        )
      })}
      {/* room nodes — shape per type */}
      {dungeon.rooms.map((room) => {
        const p = positions.get(room.id)
        if (!p) return null
        const isCurrent = room.id === currentRoomId
        const isExplored = room.explored
        const col = ROOM_TYPE_COLORS[room.type]
        const x = p.x
        const y = p.y - nodeH / 2
        const fill = isExplored ? col + '33' : 'var(--paper-2, #ebe2cc)'
        const stroke = isCurrent
          ? 'var(--ink, #1f1b16)'
          : isExplored
            ? col
            : 'var(--rule-soft, #d9cfb8)'
        const strokeWidth = isCurrent ? 2.5 : 1.5

        let nodeShape: React.ReactElement
        if (room.type === 'boss_chamber') {
          nodeShape = (
            <polygon
              points={`${x + nodeW / 2},${y} ${x + nodeW},${y + nodeH / 2} ${x + nodeW / 2},${y + nodeH} ${x},${y + nodeH / 2}`}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          )
        } else if (room.type === 'shrine') {
          nodeShape = (
            <ellipse
              cx={x + nodeW / 2}
              cy={y + nodeH / 2}
              rx={nodeW / 2}
              ry={nodeH / 2}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          )
        } else if (room.type === 'corridor') {
          nodeShape = (
            <rect
              x={x}
              y={y}
              width={nodeW}
              height={nodeH}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              rx={2}
            />
          )
        } else {
          nodeShape = (
            <rect
              x={x}
              y={y}
              width={nodeW}
              height={nodeH}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              rx={4}
            />
          )
        }

        return (
          <g
            key={room.id}
            style={{ cursor: 'pointer' }}
            onClick={() => onPick(room.id)}
            transform={`translate(0, 0)`}
          >
            {nodeShape}
            {isCurrent && (
              <rect
                x={x - 3}
                y={y - 3}
                width={nodeW + 6}
                height={nodeH + 6}
                fill="none"
                stroke="var(--accent-gold, #b08838)"
                strokeWidth="1.5"
                strokeDasharray="3 2"
                rx="4"
              />
            )}
            <text
              x={x + nodeW / 2}
              y={y + nodeH / 2 + 4}
              textAnchor="middle"
              fontFamily="var(--mono, ui-monospace)"
              fontSize="9"
              fontWeight="700"
              fill={isCurrent ? 'var(--ink, #1f1b16)' : isExplored ? col : 'var(--ink-4, #b8b0a0)'}
              pointerEvents="none"
            >
              {isExplored ? room.index + 1 : '?'}
            </text>
            {/* badges */}
            {room.encounter && !room.cleared && (
              <circle
                cx={x + nodeW - 4}
                cy={y + 4}
                r="4"
                fill="var(--accent-red, #a8442a)"
                stroke="var(--paper, #f5efe1)"
                strokeWidth="1"
                pointerEvents="none"
              />
            )}
            {room.loot && room.cleared && !(room.loot as { collected?: boolean }).collected && (
              <circle
                cx={x + 4}
                cy={y + 4}
                r="4"
                fill="var(--accent-gold, #b08838)"
                stroke="var(--paper, #f5efe1)"
                strokeWidth="1"
                pointerEvents="none"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── party HP strip (bottom bar) ──

function PartyHpStrip({
  party,
  onClickMember,
  onContextMenu,
}: {
  party: PartyMember[]
  onClickMember: (m: PartyMember) => void
  onContextMenu: (m: PartyMember, e: React.MouseEvent) => void
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--paper, #f5efe1)',
        borderTop: '1px solid var(--rule, #c8bea3)',
      }}
    >
      {party.map((m) => {
        const frac = m.hpMax > 0 ? m.hpCurrent / m.hpMax : 0
        const color = frac < 0.3 ? '#a8442a' : frac < 0.6 ? '#b08838' : '#2c8a3e'
        return (
          <div
            key={m.id}
            onClick={() => onClickMember(m)}
            onContextMenu={(e) => {
              e.preventDefault()
              onContextMenu(m, e)
            }}
            style={{
              flex: 1,
              maxWidth: 160,
              padding: '6px 10px',
              border: '1px solid var(--rule, #c8bea3)',
              background: 'var(--paper-2, #ebe2cc)',
              cursor: 'pointer',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <b>{m.name}</b>
              <span style={{ color }}>
                {m.hpCurrent}/{m.hpMax}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(0,0,0,0.1)' }}>
              <div style={{ width: `${frac * 100}%`, height: '100%', background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── context menu ──

interface CtxItem {
  label: string
  key?: string
  disabled?: boolean
  onAction?: () => void
}

interface CtxMenuState {
  x: number
  y: number
  header?: string
  items: (CtxItem | '---' | { sub: string })[]
}

function CtxMenu({
  menu,
  onClose,
}: {
  menu: CtxMenuState | null
  onClose: () => void
}): React.ReactElement | null {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', close), 0)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [menu, onClose])
  if (!menu) return null
  const x = Math.min(menu.x, window.innerWidth - 240)
  const y = Math.min(menu.y, window.innerHeight - menu.items.length * 32 - 20)
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 400,
        background: 'var(--paper, #f5efe1)',
        border: '2px solid var(--ink, #1f1b16)',
        boxShadow: '4px 4px 0 var(--ink, #1f1b16)',
        minWidth: 220,
        fontFamily: 'var(--mono, ui-monospace)',
        fontSize: 11,
      }}
    >
      {menu.header && (
        <div
          style={{
            padding: '6px 12px',
            borderBottom: '1px solid var(--rule, #c8bea3)',
            color: 'var(--ink-3, #807468)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: 9,
          }}
        >
          {menu.header}
        </div>
      )}
      {menu.items.map((it, i) => {
        if (it === '---')
          return <div key={i} style={{ height: 1, background: 'var(--rule, #c8bea3)' }} />
        if (typeof it === 'object' && 'sub' in it)
          return (
            <div
              key={i}
              style={{
                padding: '4px 12px',
                color: 'var(--ink-3, #807468)',
                fontSize: 9,
                fontStyle: 'italic',
              }}
            >
              {it.sub}
            </div>
          )
        const item = it as CtxItem
        return (
          <div
            key={i}
            onClick={() => {
              if (!item.disabled) {
                item.onAction?.()
                onClose()
              }
            }}
            style={{
              padding: '6px 12px',
              cursor: item.disabled ? 'default' : 'pointer',
              opacity: item.disabled ? 0.4 : 1,
              display: 'flex',
              justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) e.currentTarget.style.background = 'var(--paper-2, #ebe2cc)'
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>{item.label}</span>
            {item.key && (
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--ink-3, #807468)',
                  border: '1px solid var(--rule, #c8bea3)',
                  padding: '0 4px',
                }}
              >
                {item.key}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── corridor view ──

function CorridorView({
  corridor,
  fromLayout,
  toLayout,
  party,
  onArrive,
}: {
  corridor: DungeonCorridor
  fromLayout: RoomLayout
  toLayout: RoomLayout
  party: PartyMember[]
  onArrive: () => void
}): React.ReactElement {
  // Build a corridor strip — a 5×N tile grid. Length is corridor.length.
  // Party animates from (2, 1) to (2, length-2).
  const length = Math.max(4, corridor.length)
  const width = Math.max(3, corridor.width + 2)
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const start = performance.now()
    let frame: number
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / CORRIDOR_ANIM_MS)
      setProgress(t)
      if (t < 1) frame = requestAnimationFrame(step)
      else setTimeout(onArrive, 200)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [corridor.id, onArrive])

  const tiles: TileVisual[][] = React.useMemo(() => {
    const grid: TileVisual[][] = []
    for (let y = 0; y < length; y++) {
      const row: TileVisual[] = []
      for (let x = 0; x < width; x++) {
        const isWall = x === 0 || x === width - 1 || y === 0 || y === length - 1
        row.push({ kind: isWall ? 'wall' : 'floor' })
      }
      grid.push(row)
    }
    // Hazards
    if (corridor.hazards.length > 0) {
      const hazardY = Math.floor(length / 2)
      grid[hazardY][Math.floor(width / 2)] = { kind: 'pit' }
    }
    return grid
  }, [corridor, length, width])

  const partyEntities: PositionedEntityVisual[] = party.map((m, i) => ({
    id: m.id,
    x: 1 + (i % (width - 2)),
    y: Math.round(progress * (length - 3)) + 1,
    label: m.name,
    side: 'party',
    hpFrac: m.hpMax > 0 ? m.hpCurrent / m.hpMax : 0,
  }))

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: width * TILE_SIZE_CORRIDOR,
          height: length * TILE_SIZE_CORRIDOR,
        }}
      >
        <TileWorld tiles={tiles} entities={partyEntities} tileSize={TILE_SIZE_CORRIDOR} showGrid />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 12px',
          background: 'rgba(31,27,22,0.7)',
          color: 'var(--paper, #f5efe1)',
          fontFamily: 'var(--mono, ui-monospace)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        CORRIDOR · {corridor.length} tiles
        {corridor.hazards.length > 0 && ' · ⚠ HAZARD'}
        {corridor.features.includes('darkness') && ' · DARKNESS'}
      </div>
    </div>
  )
}

// ── combat view (uses our MMScene) ──

function CombatView({
  layout,
  party,
  onCombatEnd,
}: {
  layout: RoomLayout
  party: PartyMember[]
  onCombatEnd: (result: { fled: boolean; party: PartyMember[] }) => void
}): React.ReactElement {
  const sceneRef = React.useRef<MMScene | null>(null)
  const [rounds, setRounds] = React.useState<RoundResult[]>([])
  const [tick, setTick] = React.useState(0)

  // Initialize scene on mount
  React.useEffect(() => {
    const seed = Math.floor(Math.random() * 2147483647)
    sceneRef.current = new MMScene(buildCombatants(layout, party), seed)
    setRounds([])
    setTick((t) => t + 1)
  }, [layout, party])

  const scene = sceneRef.current
  const isOver = scene?.isOver() ?? false
  const victor = scene?.getVictor()

  const runRound = () => {
    if (!scene) return
    const seed = Math.floor(Math.random() * 2147483647)
    const r = scene.executeRound(seed)
    setRounds((prev) => [...prev, r])
    setTick((t) => t + 1)
    if (scene.isOver()) {
      // Sync party HP back from scene
      const updatedParty = party.map((m) => {
        const c = scene.getCombatant(m.id)
        return c ? { ...m, hpCurrent: c.hpCurrent } : m
      })
      setTimeout(() => {
        onCombatEnd({ fled: false, party: updatedParty })
      }, 800)
    }
  }

  const flee = () => {
    onCombatEnd({ fled: true, party })
  }

  if (!scene) return <div>Initializing combat…</div>

  const initiative = scene.getInitiativeOrder()
  const combatants = scene.getCombatants()

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        background: 'var(--paper, #f5efe1)',
      }}
    >
      <div
        style={{
          padding: '6px 16px',
          background: 'var(--accent-red, #a8442a)',
          color: 'var(--paper, #f5efe1)',
          fontFamily: 'var(--mono, ui-monospace)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span>⚔ COMBAT — {layout.encounters.length} encounter group(s)</span>
        <span style={{ opacity: 0.8 }}>round {scene.getRound()}</span>
        <div style={{ flex: 1 }} />
        {isOver && victor && (
          <span
            style={{
              padding: '2px 8px',
              background: victor === 'party' ? '#2c8a3e' : '#1f1b16',
              fontWeight: 700,
            }}
          >
            VICTOR: {victor}
          </span>
        )}
        <button
          onClick={flee}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.4)',
            color: 'var(--paper, #f5efe1)',
            fontFamily: 'var(--mono, ui-monospace)',
            fontSize: 9,
            padding: '2px 10px',
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          FLEE
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <div
          style={{
            flex: 1,
            padding: 14,
            overflow: 'auto',
            background: 'var(--paper-2, #ebe2cc)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--mono, ui-monospace)',
              color: 'var(--ink-3, #807468)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            COMBATANTS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {combatants.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--rule, #c8bea3)',
                  background:
                    c.side === 'party' ? 'rgba(58,93,122,0.06)' : 'rgba(168,68,42,0.06)',
                  fontFamily: 'var(--mono, ui-monospace)',
                  fontSize: 11,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  {c.side === 'party' ? '🛡' : '🗡'} <b>{c.name}</b>
                </span>
                <span style={{ color: c.status === 'active' ? '#1f1b16' : '#807468' }}>
                  {c.status === 'active' ? `HP ${c.hpCurrent}/${c.hpMax}` : c.status}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--mono, ui-monospace)',
              color: 'var(--ink-3, #807468)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            ROUND LOG
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rounds.map((r) => (
              <div
                key={r.roundNumber}
                style={{ padding: 8, background: 'var(--paper, #f5efe1)' }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--mono, ui-monospace)',
                    color: 'var(--ink-3, #807468)',
                    marginBottom: 4,
                  }}
                >
                  Round {r.roundNumber}
                </div>
                {r.turns.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--mono, ui-monospace)',
                      color: t.action === 'attack' ? '#1f1b16' : '#807468',
                    }}
                  >
                    {t.description}
                  </div>
                ))}
              </div>
            ))}
            {rounds.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-3, #807468)',
                  fontStyle: 'italic',
                }}
              >
                Click "RUN ROUND" to advance combat.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            width: 200,
            padding: 14,
            borderLeft: '1px solid var(--rule, #c8bea3)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--mono, ui-monospace)',
              color: 'var(--ink-3, #807468)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            INITIATIVE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {initiative.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  fontFamily: 'var(--mono, ui-monospace)',
                }}
              >
                <span>
                  {i + 1}. {entry.name}
                </span>
                <span style={{ color: 'var(--ink-3, #807468)' }}>{entry.total}</span>
              </div>
            ))}
          </div>

          <button
            disabled={isOver}
            onClick={runRound}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '8px 12px',
              background: isOver ? 'var(--paper-2, #ebe2cc)' : 'var(--accent-red, #a8442a)',
              color: isOver ? 'var(--ink-3, #807468)' : 'var(--paper, #f5efe1)',
              border: '1px solid var(--ink, #1f1b16)',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 11,
              fontWeight: 700,
              cursor: isOver ? 'default' : 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            {isOver ? 'COMBAT ENDED' : `RUN ROUND ${scene.getRound() + 1} →`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main shell ──

export default function DungeonShell(): React.ReactElement {
  const worldApi = useWorld()
  const [stamped, setStamped] = React.useState<StampedDungeon>(() => buildDemoDungeon())
  const [currentRoomId, setCurrentRoomId] = React.useState(stamped.interior.rooms[0].id)
  const [viewMode, setViewMode] = React.useState<'exploration' | 'corridor' | 'combat'>('exploration')
  const [activeCorridor, setActiveCorridor] = React.useState<{
    corridor: DungeonCorridor
    fromId: string
    toId: string
  } | null>(null)
  const [selectedTile, setSelectedTile] = React.useState<{ x: number; y: number } | null>(null)
  const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = React.useState<CtxMenuState | null>(null)
  const [openSheet, setOpenSheet] = React.useState<PartyMember | null>(null)
  const [openInv, setOpenInv] = React.useState<PartyMember | null>(null)
  const [openRest, setOpenRest] = React.useState(false)
  const [railMode, setRailMode] = React.useState<'delve' | 'setup'>('delve')
  const [eventLog, setEventLog] = React.useState<{ t: string; text: string; color?: string }[]>([])
  const [party, setParty] = React.useState<PartyMember[]>(DEMO_PARTY)
  const [exploredRoomIds, setExploredRoomIds] = React.useState<Set<string>>(new Set([stamped.interior.rooms[0].id]))
  const [clearedRoomIds, setClearedRoomIds] = React.useState<Set<string>>(new Set())

  // Sync explored/cleared into the dungeon interior so the minimap reflects state
  const dungeonWithState = React.useMemo<DungeonInterior>(
    () => ({
      ...stamped.interior,
      rooms: stamped.interior.rooms.map((r) => ({
        ...r,
        explored: exploredRoomIds.has(r.id),
        cleared: clearedRoomIds.has(r.id),
      })),
    }),
    [stamped.interior, exploredRoomIds, clearedRoomIds],
  )

  const currentRoom = roomById(dungeonWithState, currentRoomId) ?? dungeonWithState.rooms[0]
  const layout = stamped.layouts.get(currentRoom.id)
  const lightingTint = LIGHTING_TINT[currentRoom.lighting]

  const tiles = React.useMemo(() => (layout ? roomTilesAsVisual(layout) : []), [layout])
  const entities = React.useMemo<PositionedEntityVisual[]>(
    () =>
      layout && !clearedRoomIds.has(currentRoom.id)
        ? [...partyAsEntities(layout, party), ...mobsAsEntities(layout)]
        : layout
          ? partyAsEntities(layout, party)
          : [],
    [layout, party, currentRoom.id, clearedRoomIds],
  )
  const decorations = React.useMemo(() => (layout ? decorationsForRoom(layout) : []), [layout])

  const addLog = React.useCallback((text: string, color?: string) => {
    const t = new Date().toLocaleTimeString().slice(0, 5)
    setEventLog((log) => [{ t, text, color }, ...log].slice(0, 30))
  }, [])

  // ── transitions ──

  const enterCorridor = React.useCallback(
    (fromId: string, toId: string) => {
      const corridor = corridorBetween(stamped.corridors, fromId, toId)
      if (!corridor) {
        // Direct transition
        setCurrentRoomId(toId)
        setExploredRoomIds((s) => {
          const next = new Set(s)
          next.add(toId)
          return next
        })
        addLog(`Entered: ${roomById(dungeonWithState, toId)?.name}`)
        return
      }
      setActiveCorridor({ corridor, fromId, toId })
      setViewMode('corridor')
      addLog(`Moving through corridor → ${roomById(dungeonWithState, toId)?.name ?? '???'}`, '#3a5d7a')
      // Engine integration: emit `entityMove` for the party.
      if (worldApi.engine) {
        worldApi.transport(toId, 0)
      }
    },
    [stamped.corridors, dungeonWithState, addLog, worldApi],
  )

  const arriveCorridor = React.useCallback(() => {
    if (!activeCorridor) return
    setCurrentRoomId(activeCorridor.toId)
    setExploredRoomIds((s) => {
      const next = new Set(s)
      next.add(activeCorridor.toId)
      return next
    })
    setViewMode('exploration')
    setActiveCorridor(null)
    const target = roomById(dungeonWithState, activeCorridor.toId)
    addLog(`Entered: ${target?.name}`, '#1f1b16')
  }, [activeCorridor, dungeonWithState, addLog])

  const startCombat = React.useCallback(() => {
    setViewMode('combat')
    addLog(`⚔ Combat in ${currentRoom.name}`, '#a8442a')
  }, [currentRoom, addLog])

  const endCombat = React.useCallback(
    (result: { fled: boolean; party: PartyMember[] }) => {
      setParty(result.party)
      if (result.fled) {
        setViewMode('exploration')
        addLog('Party fled from combat.', '#b08838')
      } else {
        setClearedRoomIds((s) => {
          const next = new Set(s)
          next.add(currentRoom.id)
          return next
        })
        setViewMode('exploration')
        addLog(`✓ ${currentRoom.name} cleared.`, '#2c8a3e')
      }
    },
    [currentRoom, addLog],
  )

  // ── handlers ──

  const handleTileClick = (event: { x: number; y: number; tile: TileVisual }) => {
    setSelectedTile({ x: event.x, y: event.y })
    setSelectedEntityId(null)
    if (event.tile.kind === 'door' && layout) {
      const exitId = currentRoom.exits[0]
      if (exitId) enterCorridor(currentRoom.id, exitId)
    }
  }

  const handleTileContextMenu = (
    event: { x: number; y: number; tile: TileVisual },
    e: React.MouseEvent,
  ) => {
    e.preventDefault()
    const items: (CtxItem | '---' | { sub: string })[] = []
    items.push({ sub: `(${event.x}, ${event.y}) · ${event.tile.kind.replace(/_/g, ' ')}` })
    if (event.tile.kind === 'door') {
      items.push({
        label: 'Open door',
        onAction: () => {
          const exitId = currentRoom.exits[0]
          if (exitId) enterCorridor(currentRoom.id, exitId)
        },
      })
      items.push({
        label: 'Inspect',
        onAction: () => addLog(`Inspect door at (${event.x}, ${event.y})`),
      })
    } else if (event.tile.kind === 'chest') {
      items.push({
        label: 'Open chest',
        onAction: () => {
          addLog('Opened chest. Loot inside!', '#b08838')
          if (worldApi.engine) {
            worldApi.applyIntent('open_container', { roomId: currentRoom.id, x: event.x, y: event.y })
          }
        },
      })
      items.push({
        label: 'Inspect (DC 12)',
        onAction: () => addLog('No traps detected on this chest.'),
      })
    } else if (event.tile.kind === 'altar') {
      items.push({
        label: 'Examine altar',
        onAction: () => addLog('A blood-stained altar. The carvings depict a forgotten god.'),
      })
    } else if (event.tile.kind === 'rune') {
      items.push({
        label: 'Read rune',
        onAction: () => addLog('The rune flares briefly. Something stirs.'),
      })
    } else if (event.tile.kind === 'floor') {
      items.push({
        label: 'Move party here',
        onAction: () => addLog(`Party moves to (${event.x}, ${event.y}).`),
      })
      items.push({
        label: 'Examine area',
        onAction: () => addLog('Nothing of note.'),
      })
    }
    if (items.length > 1) {
      setCtxMenu({ x: e.clientX, y: e.clientY, items })
    }
  }

  const handleEntityRightClick = (entity: PositionedEntityVisual, e: React.MouseEvent) => {
    e.preventDefault()
    if (entity.side !== 'party') return
    const member = party.find((m) => m.id === entity.id)
    if (!member) return
    const items: (CtxItem | '---' | { sub: string })[] = [
      { sub: `${member.name} · ${member.race} ${member.klass} ${member.level}` },
      { label: 'Character Sheet', key: 'C', onAction: () => setOpenSheet(member) },
      { label: 'Inventory', key: 'I', onAction: () => setOpenInv(member) },
      '---',
      { label: 'Short Rest…', key: 'R', onAction: () => setOpenRest(true) },
      { label: 'Long Rest…', key: 'L', onAction: () => setOpenRest(true) },
      '---',
      { label: `HP ${member.hpCurrent}/${member.hpMax} · AC ${member.ac}`, disabled: true },
    ]
    setCtxMenu({ x: e.clientX, y: e.clientY, items, header: member.name })
  }

  const handleRest = (type: 'short' | 'long') => {
    setParty((p) =>
      p.map((m) => {
        const heal =
          type === 'long' ? m.hpMax : Math.min(m.hpMax - m.hpCurrent, Math.floor(m.hpMax * 0.4))
        return { ...m, hpCurrent: type === 'long' ? m.hpMax : m.hpCurrent + heal }
      }),
    )
    setOpenRest(false)
    addLog(`Took a ${type} rest.`, '#2c8a3e')
  }

  const regenerate = () => {
    setStamped(buildDemoDungeon())
    setCurrentRoomId(buildDemoDungeon().interior.rooms[0].id)
    setExploredRoomIds(new Set([stamped.interior.rooms[0].id]))
    setClearedRoomIds(new Set())
    setViewMode('exploration')
    setEventLog([])
    addLog('New dungeon generated.', '#3a5d7a')
  }

  // ── tile size scales to fit ──

  const tileSize = layout
    ? Math.max(20, Math.min(48, Math.floor(540 / Math.max(layout.tileW, layout.tileH))))
    : 32

  // ── room states for ctas ──

  const hasCombat =
    currentRoom.encounter && !clearedRoomIds.has(currentRoom.id) && layout && layout.encounters.length > 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 48px)',
        background: 'var(--paper, #f5efe1)',
      }}
    >
      <StatusBar
        dungeon={dungeonWithState}
        currentRoom={currentRoom}
        party={party}
        viewMode={viewMode}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* main panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--paper-2, #2a2420)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {viewMode === 'exploration' && layout && (
            <>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'auto',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: layout.tileW * tileSize,
                    height: layout.tileH * tileSize,
                  }}
                >
                  <TileWorld
                    tiles={tiles}
                    entities={entities}
                    decorations={decorations}
                    tileSize={tileSize}
                    selectedTile={selectedTile}
                    selectedEntityId={selectedEntityId}
                    onTileClick={handleTileClick}
                    onTileContextMenu={handleTileContextMenu}
                    onEntityClick={(e) => {
                      setSelectedEntityId(e.id)
                      setSelectedTile(null)
                    }}
                    onEntityContextMenu={handleEntityRightClick}
                    lightingTint={lightingTint}
                    showGrid
                  />
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                {hasCombat && (
                  <button
                    onClick={startCombat}
                    style={{
                      padding: '8px 20px',
                      background: 'var(--accent-red, #a8442a)',
                      color: 'var(--paper, #f5efe1)',
                      border: '2px solid var(--ink, #1f1b16)',
                      fontFamily: 'var(--mono, ui-monospace)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                    }}
                  >
                    ⚔ ENTER COMBAT
                  </button>
                )}
                {!hasCombat &&
                  currentRoom.exits.map((exitId, i) => {
                    const exitRoom = roomById(dungeonWithState, exitId)
                    return (
                      <button
                        key={exitId}
                        onClick={() => enterCorridor(currentRoom.id, exitId)}
                        style={{
                          padding: '6px 16px',
                          background: 'var(--paper, #f5efe1)',
                          border: '1px solid var(--ink, #1f1b16)',
                          fontFamily: 'var(--mono, ui-monospace)',
                          fontSize: 10,
                          letterSpacing: '0.06em',
                          cursor: 'pointer',
                        }}
                      >
                        → {exitRoom?.explored ? exitRoom.name : '???'}{' '}
                        {i === 0 ? '[E]' : '[alt]'}
                      </button>
                    )
                  })}
              </div>
            </>
          )}

          {viewMode === 'corridor' && activeCorridor && layout && (
            <CorridorView
              corridor={activeCorridor.corridor}
              fromLayout={stamped.layouts.get(activeCorridor.fromId)!}
              toLayout={stamped.layouts.get(activeCorridor.toId)!}
              party={party}
              onArrive={arriveCorridor}
            />
          )}

          {viewMode === 'combat' && layout && (
            <CombatView layout={layout} party={party} onCombatEnd={endCombat} />
          )}
        </div>

        {/* right rail */}
        <div
          style={{
            width: 320,
            borderLeft: '1px solid var(--rule, #c8bea3)',
            background: 'var(--paper, #f5efe1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Rail mode toggle */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--rule, #c8bea3)',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <button
              onClick={() => setRailMode('delve')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background:
                  railMode === 'delve' ? 'var(--paper-2, #ebe2cc)' : 'var(--paper, #f5efe1)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                fontWeight: railMode === 'delve' ? 700 : 400,
                borderRight: '1px solid var(--rule, #c8bea3)',
              }}
            >
              DELVE
            </button>
            <button
              onClick={() => setRailMode('setup')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background:
                  railMode === 'setup' ? 'var(--paper-2, #ebe2cc)' : 'var(--paper, #f5efe1)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                fontWeight: railMode === 'setup' ? 700 : 400,
              }}
            >
              SETUP
            </button>
          </div>

          {railMode === 'delve' ? (
            <>
              {/* Minimap */}
              <div style={{ padding: 12, borderBottom: '1px solid var(--rule, #c8bea3)' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--mono, ui-monospace)',
                    color: 'var(--ink-3, #807468)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 6,
                  }}
                >
                  MAP — {dungeonWithState.rooms.length} rooms · {stamped.corridors.length} corridors
                </div>
                <DungeonMinimap
                  dungeon={dungeonWithState}
                  corridors={stamped.corridors}
                  currentRoomId={currentRoom.id}
                  onPick={(id) => {
                    if (exploredRoomIds.has(id)) setCurrentRoomId(id)
                  }}
                />
              </div>

              {/* Selection panel */}
              <div
                style={{
                  padding: 12,
                  borderBottom: '1px solid var(--rule, #c8bea3)',
                  flex: 1,
                  overflow: 'auto',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--mono, ui-monospace)',
                    color: 'var(--ink-3, #807468)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  {selectedEntityId
                    ? `ENTITY · ${selectedEntityId}`
                    : selectedTile
                      ? `TILE · (${selectedTile.x}, ${selectedTile.y})`
                      : 'NOTHING SELECTED'}
                </div>
                {selectedTile && tiles.length > 0 && (
                  <div style={{ fontFamily: 'var(--mono, ui-monospace)', fontSize: 11 }}>
                    kind: <b>{tiles[selectedTile.y]?.[selectedTile.x]?.kind ?? '?'}</b>
                  </div>
                )}
                {selectedEntityId && (
                  <div style={{ fontFamily: 'var(--mono, ui-monospace)', fontSize: 11 }}>
                    {entities.find((e) => e.id === selectedEntityId)?.label ?? '—'}
                  </div>
                )}
                {!selectedTile && !selectedEntityId && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3, #807468)' }}>
                    Right-click a tile or entity for actions.
                  </div>
                )}
              </div>

              {/* Event log */}
              <div style={{ padding: 12, maxHeight: 200, overflow: 'auto' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--mono, ui-monospace)',
                    color: 'var(--ink-3, #807468)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 6,
                  }}
                >
                  EVENT LOG
                </div>
                {eventLog.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--ink-3, #807468)' }}>no events.</div>
                ) : (
                  eventLog.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: 'var(--mono, ui-monospace)',
                        fontSize: 10,
                        marginBottom: 2,
                        color: e.color,
                      }}
                    >
                      <span style={{ color: 'var(--ink-3, #807468)', marginRight: 6 }}>{e.t}</span>
                      {e.text}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: 14, fontFamily: 'var(--mono, ui-monospace)', fontSize: 11 }}>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--ink-3, #807468)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                GENERATOR
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: 'var(--ink-3, #807468)' }}>tier</span>{' '}
                <b>{dungeonWithState.tier}</b>
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: 'var(--ink-3, #807468)' }}>type</span>{' '}
                <b>{dungeonWithState.gateType}</b>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: 'var(--ink-3, #807468)' }}>species</span>{' '}
                <b>{dungeonWithState.speciesId}</b>
              </div>
              <button
                onClick={regenerate}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  background: 'var(--accent-gold, #b08838)',
                  color: 'var(--paper, #f5efe1)',
                  border: '1px solid var(--ink, #1f1b16)',
                  fontFamily: 'var(--mono, ui-monospace)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                REGENERATE
              </button>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 10,
                  color: 'var(--ink-3, #807468)',
                  fontStyle: 'italic',
                }}
              >
                V2: load from /api/gate/[id], pick a different gate, replay TPB log.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Party HP strip */}
      <PartyHpStrip
        party={party}
        onClickMember={(m) => setOpenSheet(m)}
        onContextMenu={(m, e) => {
          const items: (CtxItem | '---' | { sub: string })[] = [
            { sub: m.name },
            { label: 'Character Sheet', onAction: () => setOpenSheet(m) },
            { label: 'Inventory', onAction: () => setOpenInv(m) },
            '---',
            { label: 'Rest…', onAction: () => setOpenRest(true) },
          ]
          setCtxMenu({ x: e.clientX, y: e.clientY, items })
        }}
      />

      {/* Modals */}
      {openSheet && (
        <CharacterSheetModal member={openSheet} onClose={() => setOpenSheet(null)} />
      )}
      {openInv && <InventoryModal member={openInv} onClose={() => setOpenInv(null)} />}
      {openRest && (
        <RestPanelModal party={party} onClose={() => setOpenRest(false)} onRest={handleRest} />
      )}
      <CtxMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />
    </div>
  )
}
