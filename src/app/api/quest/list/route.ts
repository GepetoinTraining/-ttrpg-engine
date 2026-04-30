import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { quests, beats, arcs } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/quest/list?adventureId=X
 *
 * Returns quests grouped by arc, each with its beats inlined.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const adventureId = url.searchParams.get('adventureId')

    const arcRows = adventureId
      ? await db.select().from(arcs).where(eq(arcs.adventureId, adventureId))
      : await db.select().from(arcs)

    const out: any[] = []
    for (const arc of arcRows) {
      const questRows = await db.select().from(quests).where(eq(quests.arcId, arc.id))
      const arcOut: any = { ...arc, quests: [] as any[] }
      for (const q of questRows) {
        const beatRows = await db.select().from(beats).where(eq(beats.questId, q.id))
        arcOut.quests.push({
          id: q.id,
          objective: q.objective,
          status: q.status,
          reward: q.rewardJson ? JSON.parse(q.rewardJson) : null,
          beats: beatRows.map((b: any) => ({
            id: b.id,
            beatType: b.beatType,
            trigger: b.trigger,
            consequences: b.consequencesJson ? JSON.parse(b.consequencesJson) : null,
          })),
        })
      }
      out.push(arcOut)
    }

    return NextResponse.json({ arcs: out, total: out.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'quest list failed' }, { status: 500 })
  }
}
