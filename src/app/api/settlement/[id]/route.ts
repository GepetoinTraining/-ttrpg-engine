import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { settlements, buildings, npcs, worldRegions } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/settlement/:id — full settlement detail with buildings + npcs.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const sRow = await db.select().from(settlements).where(eq(settlements.id, id)).limit(1)
    if (!sRow[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const region = sRow[0].regionId
      ? (await db.select().from(worldRegions).where(eq(worldRegions.id, sRow[0].regionId)).limit(1))[0]
      : null

    const [buildingRows, npcRows] = await Promise.all([
      db.select().from(buildings).where(eq(buildings.settlementId, id)),
      db.select().from(npcs).where(eq(npcs.settlementId, id)),
    ])

    return NextResponse.json({
      settlement: sRow[0],
      region,
      buildings: buildingRows,
      npcs: npcRows.map((n) => ({
        id: n.id,
        name: n.name,
        role: n.role,
        disposition: n.disposition,
        craft: n.craft,
        agenda: n.agendaJson ? JSON.parse(n.agendaJson) : null,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'load failed' }, { status: 500 })
  }
}
