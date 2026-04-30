'use client'

import React from 'react'
import {
  type ViewConfig,
  toggleHidden,
  togglePinned,
  resetViewConfig,
} from '@/lib/view-config'
import {
  type Persona,
  type PersonaType,
  PERSONA_LABELS,
  PERSONA_GLYPHS,
  personaKey,
} from '@/lib/persona'
import { listCharacters, type CharacterListItem } from '@/lib/character'

export interface ConfigMenuSurface {
  id: string
  num: string
  label: string
}

export interface ConfigMenuCategory {
  label: string
  surfaceIds: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  /** The active persona — drives view-config owner key. */
  persona: Persona
  setPersona: (p: Persona) => void
  config: ViewConfig
  setConfig: (c: ViewConfig) => void
  /** All categories in the workspace being configured. */
  categories: ConfigMenuCategory[]
  surfacesById: Record<string, ConfigMenuSurface>
}

const PERSONA_DESCS: Record<PersonaType, string> = {
  dm:      'Human DM — you run the world. Full god-mode tools.',
  player:  'You play a specific character at a group table.',
  'gm-ai': 'AI is the GM and embodies a character at the table — you observe + nudge.',
  dmless:  'No GM. World ticks autonomously, guild posts jobs, players self-direct.',
}

export default function ConfigMenu({
  open, onClose, persona, setPersona, config, setConfig, categories, surfacesById,
}: Props) {
  const [characters, setCharacters] = React.useState<CharacterListItem[] | null>(null)
  const [charErr, setCharErr] = React.useState<string | null>(null)

  // Lazy-load the character list when the menu opens (only needed for player/gm-ai personas).
  React.useEffect(() => {
    if (!open) return
    if (characters !== null) return
    let cancelled = false
    listCharacters()
      .then((res) => {
        if (!cancelled) setCharacters(res.characters)
      })
      .catch((e) => {
        if (!cancelled) setCharErr(String(e?.message ?? e))
      })
    return () => { cancelled = true }
  }, [open, characters])

  if (!open) return null

  const isHidden = (id: string) => config.hidden.includes(id)
  const isPinned = (id: string) => config.pinned.includes(id)

  const onHideToggle = (id: string) => setConfig(toggleHidden(config, id))
  const onPinToggle = (id: string) => setConfig(togglePinned(config, id))
  const onReset = () => setConfig(resetViewConfig(config.ownerId))

  const setPersonaType = (type: PersonaType) => {
    // Reset characterId when switching to a non-character persona
    if (type === 'dm' || type === 'dmless') {
      setPersona({ type, characterId: null })
      return
    }
    // For player / gm-ai, keep the existing character if any, else first available
    const cid = persona.characterId ?? characters?.[0]?.id ?? null
    setPersona({ type, characterId: cid })
  }

  const setPersonaCharacter = (cid: string) => {
    setPersona({ type: persona.type, characterId: cid })
  }

  const needsCharacter = persona.type === 'player' || persona.type === 'gm-ai'
  const ownerLabel = personaKey(persona)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(31, 27, 22, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="box"
        style={{
          width: 'min(760px, 92vw)', maxHeight: '88vh', overflow: 'auto',
          background: 'var(--paper)',
          boxShadow: '4px 4px 0 var(--ink), 4px 4px 0 6px var(--paper-2)',
          padding: 18,
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="tiny">VIEW CONFIG</div>
            <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>
              Configure view
            </h2>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              The cert is who you are. The persona is what you're playing as right now.
              Each persona has its own pinned / hidden surfaces.
            </div>
          </div>
          <button className="btn sm" onClick={onClose}>close ✕</button>
        </div>

        <hr className="rule dashed" style={{ margin: '12px 0' }} />

        {/* ── Persona picker ── */}
        <div className="nav-group" style={{ marginBottom: 16 }}>
          <div className="nav-label">Playing as</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}>
            {(['dm', 'player', 'gm-ai', 'dmless'] as PersonaType[]).map((pt) => {
              const isActive = persona.type === pt
              return (
                <button
                  key={pt}
                  onClick={() => setPersonaType(pt)}
                  className="box"
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--paper-2)' : 'var(--paper)',
                    borderColor: isActive ? 'var(--rule)' : 'var(--rule-soft)',
                    boxShadow: isActive ? '2px 2px 0 var(--ink)' : 'none',
                    border: '1px solid',
                  }}
                >
                  <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{PERSONA_GLYPHS[pt]}</span>
                    <b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>
                      {PERSONA_LABELS[pt]}
                    </b>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4, lineHeight: 1.4 }}>
                    {PERSONA_DESCS[pt]}
                  </div>
                </button>
              )
            })}
          </div>

          {needsCharacter && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>
                Character {persona.type === 'gm-ai' && '(AI will play as)'}
              </div>
              {characters === null && !charErr && (
                <div className="tiny muted">loading character list…</div>
              )}
              {charErr && (
                <div className="tiny" style={{ color: 'var(--accent-red)' }}>
                  Couldn't load characters: {charErr}
                </div>
              )}
              {characters && characters.length === 0 && (
                <div className="tiny muted">
                  No characters found. Create one in Chargen first.
                </div>
              )}
              {characters && characters.length > 0 && (
                <select
                  value={persona.characterId ?? ''}
                  onChange={(e) => setPersonaCharacter(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px',
                    fontFamily: 'var(--serif)',
                    background: 'var(--paper)',
                    border: '1px solid var(--rule)',
                    color: 'var(--ink)',
                  }}
                >
                  <option value="" disabled>— pick a character —</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.race}{c.subrace ? ` ${c.subrace}` : ''} · {c.classes.map((cl) => `${cl.className} ${cl.level}`).join(' / ') || 'lvl 1'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <hr className="rule dashed" style={{ margin: '14px 0' }} />

        <div className="aside" style={{ marginBottom: 12 }}>
          ↳ pin the surfaces you use the most. hide the ones you don't.
          stored per persona — switch persona and the lens changes.
          <span className="tiny" style={{ marginLeft: 8 }}>
            owner key: <span className="kbd">{ownerLabel}</span>
          </span>
        </div>

        {/* ── Surface visibility / pinning ── */}
        {categories.map((cat) => (
          <div key={cat.label} className="nav-group" style={{ marginBottom: 14 }}>
            <div className="nav-label">{cat.label}</div>
            <table className="inv" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Surface</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Pinned</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Hidden</th>
                </tr>
              </thead>
              <tbody>
                {cat.surfaceIds.map((id) => {
                  const s = surfacesById[id]
                  if (!s) return null
                  const hidden = isHidden(id)
                  const pinned = isPinned(id)
                  return (
                    <tr key={id} style={{ opacity: hidden ? 0.55 : 1 }}>
                      <td className="stat">{s.num}</td>
                      <td>{s.label}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className={'btn sm' + (pinned ? ' primary' : '')}
                          onClick={() => onPinToggle(id)}
                          title={pinned ? 'Unpin' : 'Pin to top'}
                        >
                          {pinned ? '★' : '☆'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className={'btn sm' + (hidden ? ' primary' : '')}
                          onClick={() => onHideToggle(id)}
                          title={hidden ? 'Show' : 'Hide'}
                        >
                          {hidden ? '✕' : '○'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

        <hr className="rule dashed" style={{ margin: '14px 0' }} />

        <div className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
          <div className="tiny muted">
            {config.pinned.length} pinned · {config.hidden.length} hidden
            {config.updatedAt > 0 && (
              <> · last saved {new Date(config.updatedAt).toLocaleTimeString()}</>
            )}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={onReset}>reset to defaults</button>
            <button className="btn sm primary" onClick={onClose}>done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
