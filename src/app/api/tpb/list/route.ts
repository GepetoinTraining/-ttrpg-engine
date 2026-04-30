import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { tpbEntries } from '@/db/schema'
import { gte, lte, and, desc, sql } from 'drizzle-orm'

/**
 * GET /api/tpb/list?sinceDay=X&untilDay=Y&limit=Z&actionType=foo
 * Reads the append-only TPB log. Filters by world-day range (since tpbEntries
 * has no adventureId column — it's a global log keyed on worldDay).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sinceDay = url.searchParams.get('sinceDay')
    const untilDay = url.searchParams.get('untilDay')
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 100))

    const filters: any[] = []
    if (sinceDay !== null) filters.push(gte(tpbEntries.worldDay, Number(sinceDay)))
    if (untilDay !== null) filters.push(lte(tpbEntries.worldDay, Number(untilDay)))

    let q: any = db.select().from(tpbEntries)
    if (filters.length === 1) q = q.where(filters[0])
    else if (filters.length > 1) q = q.where(and(...filters))
    q = q.orderBy(desc(tpbEntries.worldDay)).limit(limit)
    const rows = await q

    // Bucket counts by actionType for at-a-glance stats
    const actionCountsRows = await db
      .select({ actionType: tpbEntries.actionType, count: sql<number>`count(*)` })
      .from(tpbEntries)
      .groupBy(tpbEntries.actionType)
    const actionCounts: Record<string, number> = {}
    for (const r of actionCountsRows) actionCounts[r.actionType] = Number(r.count)

    return NextResponse.json({
      entries: rows.map((r: any) => ({
        id: r.id,
        worldDay: r.worldDay,
        actionType: r.actionType,
        targetId: r.targetId,
        timestamp: r.timestamp,
        delta: r.deltaJson ? JSON.parse(r.deltaJson) : null,
      })),
      counts: actionCounts,
      total: rows.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'tpb list failed' }, { status: 500 })
  }
}
