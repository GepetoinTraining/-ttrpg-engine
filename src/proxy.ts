/**
 * Next.js middleware — cert-bearer auth gate for protected `/api/*` routes.
 *
 * Per `project_cert_hierarchy.md`, identity is `(accountId, seed)` proof.
 * This middleware:
 *   1. Lets a small allowlist of public paths through unchanged.
 *   2. For everything else under `/api/*`, validates `Authorization: Bearer
 *      <accountId>:<seed>` against the `accounts` table.
 *   3. On success forwards `x-account-id` to the downstream route so handlers
 *      don't have to re-query unless they need anything beyond the id.
 *
 * Runtime: Node (the libSQL client + Drizzle import chain isn't Edge-compatible
 * for our use here). Next 16 supports `runtime: 'nodejs'` in middleware.
 *
 * Public routes (no bearer required):
 *   - /api/auth/*           — login / enrollment flow
 *   - /api/account/create   — initial mint, has no account yet
 *   - /api/cron/*           — CRON_SECRET gate, not bearer
 *   - /api/world/state      — public read
 *   - /api/world/log        — public read
 *   - /api/world/replay     — public hydration read
 *   - /api/world/calendar   — public read
 *   - /api/world/weather    — public read
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/connection'
import { accounts } from '@/db/schema'

// Per Next 16: Proxy always runs on Node runtime; route segment config not
// allowed. We do path filtering ourselves at the top of `proxy()`.

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/account/create',
  '/api/cron/',
  '/api/world/state',
  '/api/world/log',
  '/api/world/replay',
  '/api/world/calendar',
  '/api/world/weather',
  '/api/world/spectrum',
]

function isPublic(pathname: string): boolean {
  for (const p of PUBLIC_PREFIXES) {
    if (pathname === p || pathname.startsWith(p)) return true
  }
  return false
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Only gate /api/* — non-API routes pass through.
  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (isPublic(pathname)) return NextResponse.next()

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

  const forwarded = new Headers(req.headers)
  forwarded.set('x-account-id', accountId)
  return NextResponse.next({ request: { headers: forwarded } })
}
