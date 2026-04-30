// /api/cron/tick — autonomous world heartbeat
//
// Invoked by:
//   - Vercel Cron (vercel.json) on a schedule (e.g. every 15 minutes)
//   - DM "tick world +Nd" buttons in Play.tsx
//
// Advances `worlds.currentDay` by N days and stamps `lastCronAt`. Does
// NOT observe any node — pending κ accumulates in MM state per the
// observation-writes rule.
//
// Auth: in production, Vercel Cron sends a bearer secret. Set
//   CRON_SECRET=...   in env. Locally / dev: no secret required.

import { NextRequest, NextResponse } from 'next/server'
import { cronTick } from '@/lib/world-state'

export async function POST(req: NextRequest) {
  // Optional auth — Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`
  const expected = process.env.CRON_SECRET
  if (expected) {
    const got = req.headers.get('authorization') ?? ''
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  // `?days=N` overrides default of 1
  const url = new URL(req.url)
  const daysParam = url.searchParams.get('days')
  const days = daysParam ? Math.max(1, Math.floor(Number(daysParam))) : 1

  try {
    const result = await cronTick(days)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'cron_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Vercel Cron sends GET by default
export async function GET(req: NextRequest) {
  return POST(req)
}
