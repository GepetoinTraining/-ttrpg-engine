// @ts-nocheck
'use client'

/**
 * DiceRoller — visible dice with rolling animation, backed by `mfDice`.
 *
 * Renders the existing 3D polyhedral dice from
 * `src/components/design/surfaces/Die.tsx` (the Crag & Coin port — clear-resin
 * polyhedrons with Roman numerals). The math comes from `mfDice` so the
 * receipt is correct (Theorem 1 from `docs/MM-MF-TP-TPB.md`).
 *
 * Components:
 *   <FourDSixDropOne />  — for ability score generation (4d6 drop lowest)
 *   <StandardD20 />      — for skill/save/attack rolls (with optional adv/dis)
 *
 * WebGL context budget: each `<Die>` is its own Three.js canvas, and
 * browsers cap simultaneous WebGL contexts around 16. We only mount the
 * 3D `<Die>` for the slot currently rolling — settled slots fall back
 * to a static `<StaticDieFace>` (SVG-ish CSS) so 24+ "dice" can coexist
 * without context eviction.
 */

import * as React from 'react'
import Die from '@/components/design/surfaces/Die'
import { mfDice, type DiceFormula } from '../../../engine/mf-dice'

// Heroic re-roll: re-roll any die under this threshold (typically 8)
const ROLL_DURATION_MS = 1400

// ============================================================
// STATIC DIE FACE — flat 2D fallback, zero WebGL context cost
// ============================================================

interface StaticDieFaceProps {
  value: number
  size?: number
  dimmed?: boolean
}

const ROMAN_LOW = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']

function StaticDieFace({ value, size = 70, dimmed = false }: StaticDieFaceProps) {
  // Match the resin-tan tint of the 3D dice so the swap is visually quiet.
  const tint = '#f4e9ca'
  const numeralColor = '#3a1a08'
  const fontSize = Math.max(14, Math.floor(size * 0.32))
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${tint}, #e8d8b0)`,
        border: '1px solid rgba(58, 26, 8, 0.28)',
        borderRadius: 10,
        boxShadow: dimmed
          ? 'inset 0 0 0 1px rgba(0,0,0,0.04)'
          : 'inset 1px 1px 6px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'serif',
        fontSize,
        fontWeight: 700,
        color: numeralColor,
        opacity: dimmed ? 0.45 : 1,
        filter: dimmed ? 'grayscale(0.7)' : 'none',
        userSelect: 'none',
        transition: 'opacity 300ms, filter 300ms',
      }}
    >
      {ROMAN_LOW[value] ?? String(value)}
    </div>
  )
}

// ============================================================
// 4d6 DROP ONE — ability score generator
// ============================================================

export interface FourDSixResult {
  total: number
  rolls: number[]   // 4 values
  kept: number[]    // 3 highest
  droppedIdx: number
  droppedValue: number
}

interface FourDSixDropOneProps {
  /**
   * If set, any die that lands < this value gets ONE reroll, and the
   * BETTER of the two values is kept (this is the actual D&D Heroic
   * variant). Default 1 (no rerolls). Pass `2` to reroll 1s, `3` to
   * reroll 1s and 2s, etc.
   */
  rerollUnder?: number
  /** Called once after the animation lands. */
  onResult?: (result: FourDSixResult) => void
  /**
   * Optional seed — passing one makes the roll deterministic. Leave
   * undefined for full randomness via Math.random() (recommended, since
   * consecutive seeds 17ms apart don't fully avalanche through
   * mulberry32 on the first output).
   */
  seed?: number
  disabled?: boolean
  buttonLabel?: string
  /** Display size (px) for each die. */
  dieSize?: number
}

export function FourDSixDropOne({
  rerollUnder,
  onResult,
  seed,
  disabled,
  buttonLabel = '🎲 roll 4d6',
  dieSize = 70,
}: FourDSixDropOneProps) {
  const [rolling, setRolling] = React.useState(false)
  const [diceValues, setDiceValues] = React.useState<number[]>([1, 1, 1, 1])
  const [result, setResult] = React.useState<FourDSixResult | null>(null)

  const roll = () => {
    if (rolling || disabled) return
    setResult(null)

    // Compute final values up front via mfDice — animation lands on these.
    // No seed by default → mfDice uses fresh Math.random() each call.
    const { output } = mfDice({ count: 4, sides: 6, modifier: 0 } as DiceFormula, seed)
    let rolls = [...output.rolls]
    if (rerollUnder !== undefined && rerollUnder > 1) {
      for (let i = 0; i < rolls.length; i++) {
        if (rolls[i] < rerollUnder) {
          // Heroic: reroll once and keep the BETTER of the two rolls.
          // Without keep-better this would just replace with another fair
          // die — net zero advantage. The "keep better" is what makes it
          // actually heroic.
          const reroll = mfDice({ count: 1, sides: 6, modifier: 0 })
          rolls[i] = Math.max(rolls[i], reroll.output.rolls[0])
        }
      }
    }
    const droppedValue = Math.min(...rolls)
    const droppedIdx = rolls.indexOf(droppedValue)
    const kept = rolls.filter((_, i) => i !== droppedIdx)
    const total = kept.reduce((a, b) => a + b, 0)

    setDiceValues(rolls)
    setRolling(true)

    // After animation completes (use a single timer slightly past the
    // duration to ensure all 4 dice have landed before flagging done).
    setTimeout(() => {
      setRolling(false)
      const finalResult: FourDSixResult = { total, rolls, kept, droppedIdx, droppedValue }
      setResult(finalResult)
      onResult?.(finalResult)
    }, ROLL_DURATION_MS + 100)
  }

  return (
    <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="row" style={{ gap: 6 }}>
        {diceValues.map((v, i) => {
          const dimmed = !!result && i === result.droppedIdx
          // Live 3D Die only while rolling. After landing, swap to static
          // face so the WebGL context count stays low (browser caps ~16
          // contexts; ability rolls × 4 dice would blow past it).
          if (rolling) {
            return (
              <div key={i} style={{ opacity: dimmed ? 0.45 : 1 }}>
                <Die
                  type="d6"
                  value={v}
                  size={dieSize}
                  rolling={rolling}
                  durationMs={ROLL_DURATION_MS}
                  spins={2 + i * 0.3}
                />
              </div>
            )
          }
          return <StaticDieFace key={i} value={v} size={dieSize} dimmed={dimmed} />
        })}
      </div>
      <div className="col" style={{ gap: 4 }}>
        <button className="btn sm" onClick={roll} disabled={rolling || disabled}>
          {rolling ? '… rolling' : buttonLabel}
        </button>
        {result && (
          <span className="tiny" style={{ fontFamily: 'var(--mono)', maxWidth: 220 }}>
            kept{' '}
            {result.kept.map((k, i) => (
              <span key={i}><b>{k}</b>{i < result.kept.length - 1 ? '+' : ''}</span>
            ))}
            {' = '}
            <b style={{ color: 'var(--accent-blue)', fontSize: 16 }}>{result.total}</b>
            <br />
            <span className="muted">dropped {result.droppedValue}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================
// STANDARD d20 — skill/save/attack with optional adv/dis
// ============================================================

export interface D20Result {
  total: number
  natural: number
  modifier: number
  advantage: 'normal' | 'advantage' | 'disadvantage'
  rolls: number[]
  used: number
}

interface StandardD20Props {
  modifier?: number
  advantage?: 'normal' | 'advantage' | 'disadvantage'
  onResult?: (result: D20Result) => void
  seed?: number
  buttonLabel?: string
  disabled?: boolean
  dieSize?: number
}

export function StandardD20({
  modifier = 0,
  advantage = 'normal',
  onResult,
  seed,
  buttonLabel = '🎲 d20',
  disabled,
  dieSize = 90,
}: StandardD20Props) {
  const [rolling, setRolling] = React.useState(false)
  const [diceValues, setDiceValues] = React.useState<number[]>([1])
  const [result, setResult] = React.useState<D20Result | null>(null)

  const numDice = advantage === 'normal' ? 1 : 2

  const roll = () => {
    if (rolling || disabled) return
    setResult(null)

    const { output } = mfDice({ count: numDice, sides: 20, modifier: 0 }, seed)
    const rolls = [...output.rolls]
    const used =
      advantage === 'advantage' ? Math.max(...rolls) :
      advantage === 'disadvantage' ? Math.min(...rolls) :
      rolls[0]
    const total = used + modifier

    setDiceValues(rolls)
    setRolling(true)

    setTimeout(() => {
      setRolling(false)
      const finalResult: D20Result = { total, natural: used, modifier, advantage, rolls, used }
      setResult(finalResult)
      onResult?.(finalResult)
    }, ROLL_DURATION_MS + 100)
  }

  return (
    <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="row" style={{ gap: 6 }}>
        {diceValues.map((v, i) => {
          const isUnused = result && advantage !== 'normal' && v !== result.used
          if (rolling) {
            return (
              <div key={i} style={{ opacity: isUnused ? 0.45 : 1 }}>
                <Die
                  type="d20"
                  value={v}
                  size={dieSize}
                  rolling={rolling}
                  durationMs={ROLL_DURATION_MS}
                  spins={2 + i * 0.4}
                />
              </div>
            )
          }
          return <StaticDieFace key={i} value={v} size={dieSize} dimmed={isUnused} />
        })}
      </div>
      <div className="col" style={{ gap: 4 }}>
        <button className="btn sm" onClick={roll} disabled={rolling || disabled}>
          {rolling ? '… rolling' : buttonLabel}
          {modifier !== 0 && ` ${modifier > 0 ? '+' : ''}${modifier}`}
        </button>
        {result && (
          <span className="tiny" style={{ fontFamily: 'var(--mono)' }}>
            {result.advantage !== 'normal' && (
              <span className="muted">
                {result.rolls.join('/')} ({result.advantage[0].toUpperCase()})<br />
              </span>
            )}
            <b>{result.natural}</b>
            {modifier !== 0 && <> {modifier > 0 ? '+' : ''}{modifier}</>}
            {' = '}
            <b style={{ color: 'var(--accent-blue)', fontSize: 16 }}>{result.total}</b>
            {result.natural === 20 && <span className="chip sm gold" style={{ marginLeft: 6 }}>nat 20</span>}
            {result.natural === 1 && <span className="chip sm red" style={{ marginLeft: 6 }}>nat 1</span>}
          </span>
        )}
      </div>
    </div>
  )
}
