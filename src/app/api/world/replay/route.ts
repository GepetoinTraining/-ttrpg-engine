/**
 * GET /api/world/replay?fromDay=X&toDay=Y&limit=N
 *
 * Paginated slice of `tpb_entries` for client hydration. Per
 * `project_next_routing_pass.md`: the engine-client uses this on mount
 * (or on divergence-driven retry) to replay actions and rebuild local
 * state.
 *
 * Distinct from `/api/world/log` (recent N for live event feeds) —
 * this one is range-based for full-history replay.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readTpbEntries } from '@/lib/world-tpb'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const fromDay = url.searchParams.get('fromDay')
  const toDay = url.searchParams.get('toDay')
  const limit = url.searchParams.get('limit')

  const opts: { fromDay?: number; toDay?: number; limit?: number } = {}
  if (fromDay !== null) {
    const n = Number(fromDay)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'fromDay_invalid' }, { status: 400 })
    }
    opts.fromDay = Math.floor(n)
  }
  if (toDay !== null) {
    const n = Number(toDay)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'toDay_invalid' }, { status: 400 })
    }
    opts.toDay = Math.floor(n)
  }
  if (limit !== null) {
    const n = Number(limit)
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: 'limit_invalid' }, { status: 400 })
    }
    opts.limit = Math.min(5000, Math.floor(n))
  }

  try {
    const rows = await readTpbEntries(opts)
    return NextResponse.json({
      entries: rows,
      fromDay: opts.fromDay ?? null,
      toDay: opts.toDay ?? null,
      limit: opts.limit ?? 500,
      count: rows.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'replay_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
