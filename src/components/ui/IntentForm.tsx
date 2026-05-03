'use client'

/**
 * IntentForm — player declares an intended action.
 *
 * Per the math-host architecture: the player doesn't run combat math; they
 * declare an intent which flows to the DM's machine for resolution. This
 * form is the input surface for that flow.
 *
 * Shape of the emitted intent:
 *   {
 *     verb: 'attack' | 'cast' | 'use' | 'check' | 'social' | 'free',
 *     target?: string,            // freeform target description
 *     ability?: AbilityKey,       // optional ability for skill checks
 *     skill?: SkillKey,           // optional skill name
 *     dice?: { result, formula }, // optional pre-rolled dice (player may roll first)
 *     description: string,        // free-form prose ("I cast magic missile at the goblin")
 *   }
 *
 * v1 emits via the onSubmit callback. v2 wires to the DM's intent endpoint
 * once the session model lands.
 */

import * as React from 'react'

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const

const VERBS = [
  { id: 'free',   label: 'Free / describe',  glyph: '✦' },
  { id: 'attack', label: 'Attack',            glyph: '⚔' },
  { id: 'cast',   label: 'Cast spell',        glyph: '✺' },
  { id: 'use',    label: 'Use item / ability',glyph: '☐' },
  { id: 'check',  label: 'Skill check',       glyph: '?' },
  { id: 'social', label: 'Speak / persuade',  glyph: '☎' },
] as const

export type IntentVerb = typeof VERBS[number]['id']

export interface IntentPayload {
  verb: IntentVerb
  target?: string
  ability?: string
  description: string
  /** Optional pre-rolled d20 result. */
  d20?: number
}

interface IntentFormProps {
  onSubmit: (intent: IntentPayload) => void | Promise<void>
  disabled?: boolean
  /** Optional preface — character name + scene hint. */
  preface?: React.ReactNode
}

export function IntentForm({ onSubmit, disabled = false, preface }: IntentFormProps) {
  const [verb, setVerb] = React.useState<IntentVerb>('free')
  const [target, setTarget] = React.useState('')
  const [ability, setAbility] = React.useState<string>('')
  const [description, setDescription] = React.useState('')
  const [d20, setD20] = React.useState<number | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const rollD20 = () => {
    setD20(Math.floor(Math.random() * 20) + 1)
  }

  const submit = async () => {
    if (!description.trim() || submitting || disabled) return
    setSubmitting(true)
    try {
      await onSubmit({
        verb,
        target: target.trim() || undefined,
        ability: ability || undefined,
        description: description.trim(),
        d20: d20 ?? undefined,
      })
      // reset on success
      setDescription('')
      setTarget('')
      setD20(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {preface && <div>{preface}</div>}

      {/* Verb picker */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {VERBS.map((v) => (
          <button
            key={v.id}
            className={'btn sm' + (verb === v.id ? ' primary' : '')}
            onClick={() => setVerb(v.id)}
            disabled={disabled}
          >
            <span style={{ marginRight: 4 }}>{v.glyph}</span>
            {v.label}
          </button>
        ))}
      </div>

      {/* Optional target */}
      {verb !== 'free' && (
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="target (e.g. 'the goblin', 'the rusty lock')"
          disabled={disabled}
          style={{
            padding: '6px 10px',
            fontFamily: 'var(--serif)',
            fontSize: 14,
            background: 'var(--paper)',
            border: '1px solid var(--rule-soft)',
          }}
        />
      )}

      {/* Optional ability for check/save */}
      {(verb === 'check' || verb === 'social') && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ABILITIES.map((a) => (
            <button
              key={a}
              className={'btn sm' + (ability === a ? ' primary' : '')}
              onClick={() => setAbility(ability === a ? '' : a)}
              disabled={disabled}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="describe what you're doing — the DM resolves the math, you tell the story"
        disabled={disabled}
        rows={3}
        style={{
          padding: '8px 10px',
          fontFamily: 'var(--serif)',
          fontSize: 14,
          background: 'var(--paper)',
          border: '1px solid var(--rule-soft)',
          resize: 'vertical',
          minHeight: 60,
        }}
      />

      {/* Optional d20 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn sm" onClick={rollD20} disabled={disabled}>
          🎲 d20
        </button>
        {d20 !== null && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
            rolled: <b style={{ color: d20 === 20 ? 'var(--accent-green)' : d20 === 1 ? 'var(--accent-red)' : 'var(--ink)' }}>{d20}</b>
            {d20 === 20 && ' — nat 20!'}
            {d20 === 1 && ' — nat 1.'}
            <button
              onClick={() => setD20(null)}
              style={{ marginLeft: 8, background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 11 }}
            >
              clear
            </button>
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={submit}
          disabled={!description.trim() || submitting || disabled}
        >
          {submitting ? 'sending…' : '↑ send to DM'}
        </button>
      </div>
    </div>
  )
}
