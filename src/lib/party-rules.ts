/**
 * Party rules — pure, server-safe.
 *
 * Holds the persona-compatibility check and invite-string codec. Lives in
 * its own module (no IDB / no `window`) so server route handlers can import
 * without dragging the browser-only helpers in `party.ts` along.
 *
 * `party.ts` re-exports these so the browser API stays single-import.
 */

import type { PersonaType } from './character-cert'

/**
 * Compatibility check: returns null if the proposed party would mix
 * incompatible personas, otherwise a human-readable reason string.
 *
 * Rules (per Pedro's 2026-04-30 confirmation in `project_cert_hierarchy.md`):
 *   - DMless cannot party with DM-led personas (time-flow mismatch:
 *     DMless lives at server-cron time, DM-led at session-time)
 *   - Two DMs in one party = ambiguous shard authority (which DM hosts?)
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
  if (myPersona === 'dm' && theirPersona === 'dm') {
    return 'two DMs in one party would have ambiguous shard authority'
  }
  return null
}

/**
 * Reduce a list of personas already in a party + a proposed joiner against
 * the pairwise compatibility rule. Returns the first offending pair found,
 * or null if everyone is compatible.
 */
export function checkPartyJoin(
  existing: PersonaType[],
  joiner: PersonaType,
): string | null {
  for (const member of existing) {
    const reason = checkPartyCompatibility(member, joiner)
    if (reason) return reason
  }
  return null
}

/**
 * Invite string format: `claudedm-party:<certId>`. Unambiguous when shared.
 */
export function buildInviteString(certId: string): string {
  return `claudedm-party:${certId}`
}

/**
 * Parse an invite. Accepts the prefixed form, a `?invite-party=` URL, or a
 * bare cert id. Returns null on malformed input.
 */
export function parseInviteString(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('invite-party')
    if (fromQuery) return fromQuery
  } catch {
    // not a URL; fall through
  }

  if (trimmed.startsWith('claudedm-party:')) {
    return trimmed.slice('claudedm-party:'.length) || null
  }

  if (/^[a-zA-Z0-9-]{8,64}$/.test(trimmed)) return trimmed

  return null
}
