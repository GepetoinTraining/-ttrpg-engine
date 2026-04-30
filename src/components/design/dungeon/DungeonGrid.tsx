'use client'

/**
 * <DungeonGrid> — composes every primitive into a single SVG board.
 *
 * Pure render: takes a DungeonLevel and emits the full visual stack
 * (tiles → walls/doors → hazards → objects → lights → spawns) in proper
 * z-order. Editing UI lives one level up; this is the renderer the editor
 * AND the runner can both share.
 *
 * Use as:
 *   <DungeonGrid level={level} cellPx={56} reveal={true} onTile={...} />
 */

import React from 'react'
import {
  CELL_PX_DEFAULT,
  type DungeonLevel,
  type CellCoord,
} from '@/lib/dungeon/types'
import {
  Tile,
  Edge,
  Door,
  DungeonObjectGlyph,
  HazardMark,
  SpawnMark,
  LightHalo,
} from './primitives'
import { ChipLayer } from './Chip'

interface DungeonGridProps {
  level: DungeonLevel
  cellPx?: number
  /** When true, render hazards + spawns visibly (DM view); when false they're hidden / dimmed. */
  reveal?: boolean
  selectedCell?: CellCoord
  onTile?: (cell: CellCoord) => void
  /** Extra overlay (party tokens, monster tokens, AOE templates) drawn on top. */
  overlay?: React.ReactNode
}

export function DungeonGrid({
  level,
  cellPx = CELL_PX_DEFAULT,
  reveal = true,
  selectedCell,
  onTile,
  overlay,
}: DungeonGridProps) {
  const { qMin, qMax, rMin, rMax } = level.bounds
  const w = (qMax - qMin + 1) * cellPx
  const h = (rMax - rMin + 1) * cellPx
  return (
    <svg
      viewBox={`${qMin * cellPx} ${rMin * cellPx} ${w} ${h}`}
      style={{
        width: '100%',
        height: 'auto',
        background: 'var(--paper-2)',
        border: '1px solid var(--rule-soft)',
      }}
    >
      {/* Tiles (textures + light) */}
      {level.tiles.map((t) => (
        <Tile
          key={`t-${t.at.q}-${t.at.r}`}
          tile={t}
          cellPx={cellPx}
          selected={!!selectedCell && selectedCell.q === t.at.q && selectedCell.r === t.at.r}
          onClick={onTile}
        />
      ))}

      {/* Edges (walls / windows / fences) */}
      {level.edges.map((e) => (
        <Edge key={`e-${e.at.q}-${e.at.r}-${e.at.side}`} edge={e} cellPx={cellPx} />
      ))}

      {/* Light halos (DM view) */}
      {reveal &&
        level.lights.map((l, i) => (
          <LightHalo key={`l-${i}`} light={l} cellPx={cellPx} />
        ))}

      {/* Hazards */}
      {level.hazards.map((h) => (
        <HazardMark key={`h-${h.id}`} hazard={h} cellPx={cellPx} reveal={reveal} />
      ))}

      {/* Objects */}
      {level.objects.map((o) => (
        <DungeonObjectGlyph key={`o-${o.id}`} obj={o} cellPx={cellPx} />
      ))}

      {/* Doors (drawn after edges so they sit on top of the wall stroke) */}
      {level.doors.map((d) => (
        <Door key={`d-${d.at.q}-${d.at.r}-${d.at.side}`} door={d} cellPx={cellPx} />
      ))}

      {/* Spawns (DM only) */}
      {reveal &&
        level.spawns.map((s) => <SpawnMark key={`s-${s.id}`} spawn={s} cellPx={cellPx} />)}

      {/* Tokens — the moveable pieces (PCs, NPCs, monsters as Chip + portrait) */}
      {level.tokens && level.tokens.length > 0 && (
        <ChipLayer tokens={level.tokens} cellPx={cellPx} />
      )}

      {/* Caller overlay (additional party / monsters / AOE templates) */}
      {overlay}
    </svg>
  )
}

// ─── Small fixture used in dev / examples ─────────────────────────────────

export function exampleDungeonLevel(): DungeonLevel {
  // Tiny 4×3 starter: a 3×2 stone room, one corridor cell, a wood floor,
  // a torch, a chest, a pit trap, and a goblin spawn.
  const tiles = []
  for (let q = 0; q < 4; q++) {
    for (let r = 0; r < 3; r++) {
      const inWoodCorner = q === 3 && r === 0
      tiles.push({
        at: { q, r },
        texture: { kind: inWoodCorner ? ('wood-plank' as const) : ('stone-rough' as const) },
        light: r === 2 ? ('dim' as const) : ('bright' as const),
        passable: true,
      })
    }
  }
  return {
    id: 'demo-1',
    name: 'Antechamber',
    depth: -1,
    bounds: { qMin: 0, qMax: 3, rMin: 0, rMax: 2 },
    tiles,
    edges: [
      { at: { q: 0, r: 0, side: 'N' }, kind: 'wall' },
      { at: { q: 1, r: 0, side: 'N' }, kind: 'wall' },
      { at: { q: 2, r: 0, side: 'N' }, kind: 'wall' },
      { at: { q: 3, r: 0, side: 'N' }, kind: 'wall' },
      { at: { q: 0, r: 0, side: 'W' }, kind: 'wall' },
      { at: { q: 0, r: 1, side: 'W' }, kind: 'wall' },
      { at: { q: 0, r: 2, side: 'W' }, kind: 'wall' },
      { at: { q: 0, r: 2, side: 'S' }, kind: 'door' },
      { at: { q: 1, r: 2, side: 'S' }, kind: 'wall' },
      { at: { q: 2, r: 2, side: 'S' }, kind: 'wall' },
      { at: { q: 3, r: 2, side: 'S' }, kind: 'wall' },
      { at: { q: 3, r: 0, side: 'E' }, kind: 'wall' },
      { at: { q: 3, r: 1, side: 'E' }, kind: 'wall' },
      { at: { q: 3, r: 2, side: 'E' }, kind: 'wall' },
    ],
    doors: [
      { at: { q: 0, r: 2, side: 'S' }, state: 'closed', material: 'wood', breakDC: 12 },
    ],
    objects: [
      { id: 'chest-1', at: { q: 3, r: 0 }, kind: 'chest', label: 'small', loot: { gp: 25 } },
      { id: 'pillar-1', at: { q: 1, r: 1 }, kind: 'pillar' },
    ],
    hazards: [
      {
        id: 'pit-1',
        at: { q: 2, r: 1 },
        kind: 'pit',
        detectDC: 14,
        saveType: 'DEX',
        saveDC: 13,
        damageDice: '2d6',
        damageType: 'bludgeoning',
        status: 'armed',
      },
    ],
    spawns: [
      {
        id: 'goblins-1',
        origin: { q: 2, r: 0 },
        templateRef: 'goblin',
        count: 3,
        behavior: 'ambush',
        trigger: { kind: 'on-enter', cell: { q: 2, r: 1 } },
        difficultyBand: 'easy',
      },
    ],
    lights: [{ at: { q: 0, r: 0 }, type: 'torch', radiusBright: 2, radiusDim: 4, flicker: true }],
    tokens: [
      {
        id: 'kaelith',
        at: { q: 0, r: 0 },
        name: 'Kaelith',
        initial: 'K',
        tone: 'party',
        frame: 'plain',
        hp: { current: 9, max: 9 },
        size: 'medium',
      },
      {
        id: 'doruk',
        at: { q: 1, r: 0 },
        name: 'Doruk',
        initial: 'D',
        tone: 'ally',
        frame: 'plain',
        hp: { current: 18, max: 22 },
        status: ['concentrating'],
        size: 'medium',
      },
      {
        id: 'goblin-1',
        at: { q: 2, r: 0 },
        name: 'Goblin 1',
        initial: 'G',
        tone: 'hostile',
        frame: 'iron',
        hp: { current: 4, max: 7 },
        status: ['bloodied'],
        size: 'small',
      },
      {
        id: 'goblin-2',
        at: { q: 2, r: 1 },
        name: 'Goblin 2',
        initial: 'G',
        tone: 'hostile',
        frame: 'iron',
        hp: { current: 7, max: 7 },
        size: 'small',
      },
      {
        id: 'selvys',
        at: { q: 3, r: 1 },
        name: 'Selvys',
        initial: 'S',
        tone: 'boss',
        frame: 'magical',
        hp: { current: 28, max: 40 },
        status: ['concentrating'],
        size: 'medium',
      },
    ],
    annotations: [
      {
        id: 'note-1',
        at: { q: 2, r: 1 },
        text: 'PCs see disturbed dust here — DC 12 Investigation reveals seam.',
        visibility: 'dm-only',
        tag: 'hint',
      },
    ],
  }
}
