/**
 * PERSONA — the role a cert is playing at the table
 * ====================================================
 *
 * The cert is identity (who you are). The persona is what you're playing
 * as right now. View configs are keyed by persona, so a single cert can
 * have multiple lenses — DM-mode lens, character-X lens, character-Y
 * lens, DMless-spectator lens.
 *
 * Four persona types:
 *   - dm        Human DM running a campaign. No character.
 *   - player    Human at the table playing a specific character in a group.
 *   - gm-ai     AI is the GM AND embodies a specific character (e.g. the
 *               guild receptionist running the session). Cert observes /
 *               nudges; AI drives the world.
 *   - dmless    No GM. World ticks, guild posts jobs, players self-direct.
 *
 * Persona persistence: localStorage keyed by cert id, since one browser /
 * cert may switch personas between sessions.
 */

export type PersonaType = 'dm' | 'player' | 'gm-ai' | 'dmless'

export interface Persona {
  type: PersonaType
  /** Required for 'player' and 'gm-ai'; null for 'dm' and 'dmless'. */
  characterId: string | null
}

export const PERSONA_DEFAULT: Persona = { type: 'dm', characterId: null }

export const PERSONA_LABELS: Record<PersonaType, string> = {
  dm:       'Dungeon Master',
  player:   'Player · character',
  'gm-ai':  'GM-AI · character',
  dmless:   'No GM · DMless',
}

export const PERSONA_GLYPHS: Record<PersonaType, string> = {
  dm:      '◆',
  player:  '⚔',
  'gm-ai': '✦',
  dmless:  '∅',
}

/** Stable key used by view-config storage — same persona always = same lens. */
export function personaKey(p: Persona): string {
  if (p.type === 'player' || p.type === 'gm-ai') {
    return `${p.type}:${p.characterId ?? 'none'}`
  }
  return p.type
}

const STORAGE_PREFIX = 'claudedm:active-persona:'

function key(certId: string | null): string {
  return `${STORAGE_PREFIX}${certId ?? 'anon'}`
}

export function loadPersona(certId: string | null): Persona {
  if (typeof window === 'undefined') return PERSONA_DEFAULT
  try {
    const raw = window.localStorage.getItem(key(certId))
    if (!raw) return PERSONA_DEFAULT
    const parsed = JSON.parse(raw) as Partial<Persona>
    if (!parsed.type) return PERSONA_DEFAULT
    if (!['dm', 'player', 'gm-ai', 'dmless'].includes(parsed.type)) return PERSONA_DEFAULT
    return {
      type: parsed.type,
      characterId: parsed.characterId ?? null,
    }
  } catch {
    return PERSONA_DEFAULT
  }
}

export function savePersona(certId: string | null, persona: Persona): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key(certId), JSON.stringify(persona))
    window.dispatchEvent(
      new CustomEvent('claudedm:persona-change', { detail: persona }),
    )
  } catch {
    // ignore
  }
}

import * as React from 'react'

export function usePersona(certId: string | null): [Persona, (p: Persona) => void] {
  const [persona, setPersonaState] = React.useState<Persona>(() =>
    typeof window === 'undefined' ? PERSONA_DEFAULT : loadPersona(certId),
  )

  React.useEffect(() => {
    setPersonaState(loadPersona(certId))
  }, [certId])

  React.useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Persona>).detail
      if (!detail) return
      setPersonaState(detail)
    }
    window.addEventListener('claudedm:persona-change', onChange)
    return () => window.removeEventListener('claudedm:persona-change', onChange)
  }, [])

  const set = React.useCallback(
    (next: Persona) => {
      setPersonaState(next)
      savePersona(certId, next)
    },
    [certId],
  )

  return [persona, set]
}
