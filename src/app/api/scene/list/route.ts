import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { sceneCards, sessions, hookThreads } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/scene/list?sessionId=X
 *   OR /api/scene/list?adventureId=X (fans out to all sessions in that adventure)
 *
 * Returns scene_cards rows + open hook threads per session. Read-only for now —
 * the SceneEditor surface needs contingency / mutation / visibility extensions
 * before it can author scenes.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId')
    const adventureId = url.searchParams.get('adventureId')

    let sessionIds: string[] = []
    if (sessionId) sessionIds = [sessionId]
    else if (adventureId) {
      const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.adventureId, adventureId))
      sessionIds = rows.map((r) => r.id)
    } else {
      const rows = await db.select({ id: sessions.id }).from(sessions)
      sessionIds = rows.map((r) => r.id)
    }

    const cards: any[] = []
    const hooks: any[] = []
    for (const sid of sessionIds) {
      const sceneRows = await db.select().from(sceneCards).where(eq(sceneCards.sessionId, sid))
      const hookRows = await db.select().from(hookThreads).where(eq(hookThreads.sessionId, sid))
      for (const s of sceneRows) {
        cards.push({
          id: s.id,
          sessionId: s.sessionId,
          cardType: s.cardType,
          title: s.title,
          readAloud: s.readAloud,
          choices: s.choicesJson ? JSON.parse(s.choicesJson) : null,
        })
      }
      for (const h of hookRows) {
        hooks.push({
          id: h.id,
          sessionId: h.sessionId,
          hook: h.hook,
          staleness: h.staleness,
          priority: h.priority,
        })
      }
    }

    return NextResponse.json({
      sessions: sessionIds,
      cards,
      hooks,
      counts: { cards: cards.length, hooks: hooks.length, sessions: sessionIds.length },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'scene list failed' }, { status: 500 })
  }
}
