import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { npcs } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/npc/list?settlementId=X&search=foo&limit=N
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const settlementId = url.searchParams.get('settlementId')
    const search = url.searchParams.get('search')?.trim().toLowerCase() ?? ''
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 100))

    const rows = settlementId
      ? await db.select().from(npcs).where(eq(npcs.settlementId, settlementId)).limit(limit)
      : await db.select().from(npcs).limit(limit)

    const filtered = search
      ? rows.filter((r) => r.name.toLowerCase().includes(search))
      : rows

    return NextResponse.json({
      npcs: filtered.map((n) => ({
        id: n.id,
        name: n.name,
        settlementId: n.settlementId,
        role: n.role,
        disposition: n.disposition,
        craft: n.craft,
        agenda: n.agendaJson ? JSON.parse(n.agendaJson) : null,
        personality: n.personalityJson ? JSON.parse(n.personalityJson) : null,
      })),
      total: filtered.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'npc list failed' }, { status: 500 })
  }
}
