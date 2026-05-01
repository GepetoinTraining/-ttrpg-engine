/**
 * Browser-side party helpers — peer-to-peer cert-hash groups.
 *
 * Per `project_cert_hierarchy.md`:
 *   - A party is a set of character cert ids that synchronize state.
 *   - Joining = sharing a cert hash → adding it to the local IDB
 *     `partyMembers` store. The roster lives on each player's machine; the
 *     server doesn't mediate. State sync flows DM-as-shard-host during
 *     sessions and via railgun spectrum fan-out (when bridge ships).
 *   - DMless certs can't party with DM-led certs (different time-flows).
 *
 * Pure rules (compatibility check + invite codec) live in `party-rules.ts`
 * so they remain importable without IDB.
 */

import { idbPut, idbGetAll, idbDelete } from './idb'
import type { CharacterCert, PersonaType } from './character-cert'
import {
  buildInviteString as buildInviteFromIdInternal,
  parseInviteString as parseInvite,
  checkPartyCompatibility,
  checkPartyJoin,
} from './party-rules'

export {
  checkPartyCompatibility,
  checkPartyJoin,
  parseInvite as parseInviteString,
  buildInviteFromIdInternal as buildInviteFromId,
}

export interface PartyMember {
  /** The character cert id the player is grouped with */
  certHash: string
  /** Optional human-readable label the player attached */
  alias: string | null
  /** Persona type — drives compatibility checks if known locally */
  personaType?: PersonaType
  joinedAt: number
}

/**
 * Add a cert hash to the local party roster. Idempotent — calling twice
 * with the same hash just refreshes the alias + joinedAt.
 */
export async function addPartyMember(
  certHash: string,
  alias: string | null = null,
  personaType?: PersonaType,
): Promise<PartyMember> {
  const member: PartyMember = {
    certHash,
    alias,
    personaType,
    joinedAt: Date.now(),
  }
  await idbPut<PartyMember>('partyMembers', member)
  return member
}

/**
 * List all party members from the local IDB roster.
 */
export async function listPartyMembers(): Promise<PartyMember[]> {
  if (typeof window === 'undefined') return []
  return idbGetAll<PartyMember>('partyMembers')
}

/**
 * Remove a member from the local party roster.
 */
export async function removePartyMember(certHash: string): Promise<void> {
  await idbDelete('partyMembers', certHash)
}

/**
 * Build a shareable invite string from a character cert.
 */
export function buildInviteString(cert: CharacterCert): string {
  return buildInviteFromIdInternal(cert.id)
}
