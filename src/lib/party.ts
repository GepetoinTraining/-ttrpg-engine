/**
 * Browser-side party helpers — peer-to-peer cert-hash groups.
 *
 * Per `project_cert_hierarchy.md`:
 *   - A party is a set of character cert ids that synchronize state.
 *   - Joining = sharing a cert hash → adding it to the local IDB
 *     `partyMembers` store and posting to the server's `parties` table.
 *   - DMless certs can't party with DM-led certs (different time-flows).
 *
 * V1 scope: local IDB-only roster + helper to share/copy your own cert
 * hash. Server `parties` endpoint + spectrum fan-out are Slice 6 follow-ups.
 */

import { idbPut, idbGetAll, idbDelete } from './idb'
import type { CharacterCert, PersonaType } from './character-cert'

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
 * Compatibility check: returns null if the proposed party would mix
 * DMless with DM-led personas. Returns the offending pair as a string
 * if incompatible. Caller passes their own active cert + the prospective
 * member's persona (if known).
 *
 * Per Pedro's 2026-04-30 confirmation: DMless can't party with DM-led
 * because of time-flow incompatibility (DMless lives at server-cron time,
 * can't fast-travel; DM-led lives at session time).
 */
export function checkPartyCompatibility(
  myPersona: PersonaType,
  theirPersona: PersonaType,
): string | null {
  const dmless = myPersona === 'dmless' || theirPersona === 'dmless'
  const dmLed =
    myPersona === 'player' || myPersona === 'dm' || myPersona === 'gm-ai' ||
    theirPersona === 'player' || theirPersona === 'dm' || theirPersona === 'gm-ai'

  if (dmless && dmLed) {
    return `dmless cannot party with DM-led personas (time-flow mismatch: ${myPersona} ↔ ${theirPersona})`
  }
  // Two DMs in one party: ambiguous shard authority.
  if (myPersona === 'dm' && theirPersona === 'dm') {
    return 'two DMs in one party would have ambiguous shard authority'
  }
  return null
}

/**
 * Build a shareable invite string from a character cert. The whole cert
 * hash IS the invite — receivers paste it on the other end and get added.
 * Format: `claudedm-party:<certId>` so it's unambiguous when shared.
 */
export function buildInviteString(cert: CharacterCert): string {
  return `claudedm-party:${cert.id}`
}

/**
 * Parse an invite string. Accepts the bare cert id, the prefixed form,
 * or a full URL with `?invite-party=`. Returns null on malformed input.
 */
export function parseInviteString(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // URL with ?invite-party=...
  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('invite-party')
    if (fromQuery) return fromQuery
  } catch {
    // not a URL; fall through
  }

  // Prefixed form
  if (trimmed.startsWith('claudedm-party:')) {
    return trimmed.slice('claudedm-party:'.length) || null
  }

  // Bare id (UUID-ish)
  if (/^[a-zA-Z0-9-]{8,64}$/.test(trimmed)) return trimmed

  return null
}
