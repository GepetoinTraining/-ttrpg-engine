/**
 * Browser-side helpers for the 2-step character cert trade flow.
 *
 * Per `project_cert_hierarchy.md`:
 *   - Trade is initiate (current owner) → accept (receiver). Cancellable
 *     by either party before accept.
 *   - Signatures are stored locally + sent to the server but the server
 *     does NOT verify them on the happy path (forensic-only).
 *
 * For v1 we use a deterministic hash as the "signature" stub. Real
 * signatures via `computeTrajectory` against the account cert's ζ are
 * a Slice 7 audit-pipeline concern.
 */

import type { CharacterCert } from './character-cert'
import { authFetch } from './auth-fetch'

export interface TradeRecord {
  tradeId: string
  characterCertId: string
  fromAccountId: string
  toAccountId: string
  status: 'pending' | 'accepted' | 'cancelled'
  initiatedAt: string
  acceptedAt?: string
  ownerChain?: string[]
}

/**
 * Stub "signature" — deterministic hash over the trade params. Replace
 * with `computeTrajectory(accountZeta, n)` once the audit pipeline lands.
 */
function stubSig(parts: (string | number)[]): string {
  const joined = parts.join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `stub:${(h >>> 0).toString(16)}`
}

/**
 * Initiate a trade — the current owner signs a handoff intent.
 * Returns the `tradeId` so the receiver can be linked to it.
 */
export async function initiateTrade(input: {
  cert: CharacterCert
  fromAccountId: string
  toAccountId: string
}): Promise<TradeRecord> {
  const initiateSig = stubSig([
    'initiate',
    input.cert.id,
    input.fromAccountId,
    input.toAccountId,
    Date.now(),
  ])

  const res = await authFetch('/api/character/trade/initiate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      characterCertId: input.cert.id,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      initiateSig,
    }),
  })

  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(`trade initiate failed: ${msg}`)
  }
  return (await res.json()) as TradeRecord
}

/**
 * Accept a pending trade — the receiver signs the claim. Server updates
 * the character cert's ownerChain + appends a characterTransfer action
 * to `tpb_entries`.
 */
export async function acceptTrade(input: {
  tradeId: string
  toAccountId: string
}): Promise<TradeRecord> {
  const acceptSig = stubSig([
    'accept',
    input.tradeId,
    input.toAccountId,
    Date.now(),
  ])

  const res = await authFetch('/api/character/trade/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tradeId: input.tradeId,
      toAccountId: input.toAccountId,
      acceptSig,
    }),
  })

  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(`trade accept failed: ${msg}`)
  }
  return (await res.json()) as TradeRecord
}
