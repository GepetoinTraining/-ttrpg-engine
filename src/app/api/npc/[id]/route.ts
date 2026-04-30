import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { npcs, npcMemories } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/npc/:id — full NPC with memories.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const row = await db.select().from(npcs).where(eq(npcs.id, id)).limit(1)
    if (!row[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const mems = await db
      .select()
      .from(npcMemories)
      .where(eq(npcMemories.npcId, id))

    const n = row[0]
    return NextResponse.json({
      npc: {
        id: n.id,
        name: n.name,
        settlementId: n.settlementId,
        role: n.role,
        disposition: n.disposition,
        craft: n.craft,
        agenda: n.agendaJson ? JSON.parse(n.agendaJson) : null,
        personality: n.personalityJson ? JSON.parse(n.personalityJson) : null,
        services: n.servicesJson ? JSON.parse(n.servicesJson) : null,
      },
      memories: mems.map((m) => ({
        id: m.id,
        type: m.memoryType,
        content: m.content,
        sentiment: m.sentiment,
        decay: m.decay,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'npc load failed' }, { status: 500 })
  }
}
