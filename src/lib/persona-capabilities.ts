/**
 * persona-capabilities — central place for "what can this persona do" rules.
 *
 * Per `project_cert_hierarchy.md` (2026-04-30): personaType is FIXED at
 * character-cert creation. There are 4 personas:
 *
 *   - player:  human DM at the table (table mode)
 *   - dm:      running someone's table (god lens)
 *   - gm-ai:   solo with AI as DM
 *   - dmless:  pure clockwork solo, no AI; lives at server-cron time
 *
 * Surfaces consume capabilities instead of branching on personaType — that
 * way the matrix lives in one place and we can add capabilities (or split
 * personas) without combing through 20+ files.
 *
 * The hook variant `usePersonaCapabilities()` reads the active character
 * cert via `useWorld()` and returns the derived caps. Surfaces with an
 * already-available `personaType` can call `personaCapabilities(type)`
 * directly.
 */

'use client'

import * as React from 'react'
import { useWorld } from './use-world'
import { usePersona } from './persona'
import { useSession } from './session-context'

export type PersonaType = 'player' | 'dm' | 'gm-ai' | 'dmless'

export interface PersonaCapabilities {
  /** Identity */
  personaType: PersonaType

  /** Can move the party to a destination (DM authority). */
  canTransportParty: boolean
  /** Can advance world time outside the cron schedule. */
  canForceTick: boolean
  /** Can fast-travel (skip days). DMless lives at cron-time, can't skip. */
  canFastTravel: boolean
  /** Can the engine resolve actions instantly (DM authority) vs only at cron tick? */
  canResolveInstantly: boolean

  /** Can voice an NPC in the AI orchestrator (engine/intelligence.ts). */
  canVoiceNpc: boolean
  /** Can inject a scene mid-session (force scene change). */
  canInjectScene: boolean
  /** Can roll secretly (server-side roll, hidden from players until reveal). */
  canSecretRoll: boolean

  /** Can see fog-of-war beyond what the party has observed. */
  canSeeFog: boolean
  /** Can see NPC stat blocks (CR/HP/AC/spells). */
  canSeeNpcStats: boolean
  /** Can see other PCs' full sheets (DM god view). */
  canSeeAllPartySheets: boolean
  /** Can see live party HP (always true today; placeholder for future privacy mode). */
  canSeePartyHp: boolean

  /** Can host the shard during a session (DM-as-shard-host pattern). */
  canHostShard: boolean
  /** Can push pending actions to the slot. (Always true if a character is active.) */
  canPushSlot: boolean

  /** Time-flow flags */
  livesAtSessionTime: boolean   // session-time personas (player / dm / gm-ai)
  livesAtServerTime: boolean    // dmless only — bound to cron heartbeat

  /** Party formation rules */
  canPartyWith: (other: PersonaType) => boolean
}

/**
 * Pure derivation — keep this the source of truth.
 * Returns the full capability set keyed off personaType.
 */
export function personaCapabilities(personaType: PersonaType): PersonaCapabilities {
  const isDM = personaType === 'dm'
  const isAI = personaType === 'gm-ai'
  const isDMless = personaType === 'dmless'
  const isPlayer = personaType === 'player'
  const hasGmAuthority = isDM || isAI

  return {
    personaType,

    canTransportParty:    hasGmAuthority,
    canForceTick:         hasGmAuthority,
    canFastTravel:        !isDMless,                 // dmless can't skip cron
    canResolveInstantly:  !isDMless,

    canVoiceNpc:          hasGmAuthority,
    canInjectScene:       hasGmAuthority,
    canSecretRoll:        isDM,                      // human DM only — gm-ai surfaces rolls

    canSeeFog:            hasGmAuthority,
    canSeeNpcStats:       isDM,                      // gm-ai uses summarized hints
    canSeeAllPartySheets: isDM,                      // human DM god view
    canSeePartyHp:        true,                      // everyone sees party HP today

    canHostShard:         isDM,                      // human DM hosts session shard
    canPushSlot:          true,

    livesAtSessionTime:   !isDMless,
    livesAtServerTime:    isDMless,

    canPartyWith: (other: PersonaType) => {
      // Per `project_cert_hierarchy.md`:
      //   - dmless ✗ DM-led party (different time flows)
      //   - rest TBD when party logic ships; for now assume same-flow OK
      if (isDMless) return other === 'dmless'
      if (other === 'dmless') return false
      return true
    },
  }
}

/**
 * React hook — reads the active character cert via useWorld() and falls back
 * to the legacy `usePersona` toggle when no cert is loaded (invite-flow users).
 *
 * Returns null until hydration completes so surfaces can render skeletons
 * instead of guessing wrong capabilities.
 */
export function usePersonaCapabilities(): PersonaCapabilities | null {
  const worldApi = useWorld()
  const session = useSession()
  const [legacyPersona] = usePersona(session.cert?.id ?? null)

  return React.useMemo(() => {
    // Prefer the cert (FIXED at chargen)
    if (worldApi.character) {
      return personaCapabilities(worldApi.character.personaType as PersonaType)
    }
    // Fallback: legacy invite-flow toggle (deprecating with cert hierarchy)
    if (legacyPersona?.type) {
      return personaCapabilities(legacyPersona.type as PersonaType)
    }
    // No persona resolved yet
    return null
  }, [worldApi.character, legacyPersona?.type])
}
