/**
 * Cert-bearer auth — gates protected API routes.
 *
 * Per `project_cert_hierarchy.md`: account identity is a (seed, primes, ζ)
 * tuple stored both in IDB (browser) and in `accounts` (server). For v1, the
 * "bearer" is `<accountId>:<seed>` — possession of the seed *is* the proof
 * of identity, since the seed is only generated client-side from the
 * (datetime, geo) coordinate when the account is minted, and the server
 * stores it as the canonical record.
 *
 * Math is the gate: in v2 we'll move to a φ/ζ trajectory bearer (the M^n
 * challenge math from `src/auth/verify.ts`) so the seed itself never has to
 * leave the browser. For v1 we accept the seed-as-secret model — the seed
 * is HTTPS-only, never logged, and rotates at any account-cert mint.
 *
 * Usage:
 *   - Server-side: `requireAccount(req)` at the top of any protected route
 *     handler. Returns either `{ accountId }` or a 401 NextResponse.
 *   - Browser-side: `attachBearer(headers, account)` to add the bearer to
 *     a fetch call's headers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/connection'
import { accounts } from '@/db/schema'

export interface VerifiedAccount {
  accountId: string
}

/**
 * Verify a `Bearer <accountId>:<seed>` header against the `accounts` row.
 * Returns the verified `accountId` on success, or a 401 NextResponse to
 * short-circuit the route handler.
 *
 * Pattern:
 *   const auth = await requireAccount(req)
 *   if (auth instanceof NextResponse) return auth
 *   const { accountId } = auth
 */
export async function requireAccount(
  req: NextRequest,
): Promise<VerifiedAccount | NextResponse> {
  const header = req.headers.get('authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const token = header.slice('Bearer '.length)
  const idx = token.indexOf(':')
  if (idx < 0) {
    return NextResponse.json({ error: 'malformed_bearer' }, { status: 401 })
  }
  const accountId = token.slice(0, idx)
  const seed = token.slice(idx + 1)
  if (!accountId || !seed) {
    return NextResponse.json({ error: 'malformed_bearer' }, { status: 401 })
  }
  let row: { seed: string; active: boolean } | undefined
  try {
    const rows = await db
      .select({ seed: accounts.seed, active: accounts.active })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)
    row = rows[0]
  } catch {
    return NextResponse.json({ error: 'auth_check_failed' }, { status: 500 })
  }
  if (!row || row.seed !== seed || !row.active) {
    return NextResponse.json({ error: 'invalid_bearer' }, { status: 401 })
  }
  return { accountId }
}

/**
 * Browser-side: produce the Authorization header value for a given account.
 * Use as: `headers: { ...attachBearer(account) }` on fetch.
 */
export function attachBearer(account: { id: string; seed: string }): {
  authorization: string
} {
  return { authorization: `Bearer ${account.id}:${account.seed}` }
}
