import { NextRequest, NextResponse } from 'next/server'
import { readRecentTpbEntries } from '@/lib/world-tpb'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? '50')))
  try {
    const rows = await readRecentTpbEntries(limit)
    return NextResponse.json({ entries: rows })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'log_read_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
