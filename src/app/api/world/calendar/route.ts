import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import {
  parties,
  adventures,
  campaigns,
  sessions,
  clockworkEvents,
} from '@/db/schema'
import { eq, gte, asc } from 'drizzle-orm'

/**
 * GET /api/world/calendar?adventureId=X
 *   OR /api/world/calendar?campaignId=X
 *
 * Returns:
 *   - worldDay (party.currentTick — opaque integer)
 *   - birthTick
 *   - recent sessions (last 5)
 *   - upcoming clockwork events (worldDay >= today, limit 20)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let adventureId = url.searchParams.get('adventureId')
    const campaignId = url.searchParams.get('campaignId')

    if (!adventureId && campaignId) {
      const camp = await db
        .select({ adventureId: campaigns.adventureId })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1)
      adventureId = camp[0]?.adventureId ?? null
    }
    if (!adventureId) {
      return NextResponse.json({ error: 'adventureId or campaignId required' }, { status: 400 })
    }

    const adv = await db
      .select({ id: adventures.id, name: adventures.name, partyId: adventures.partyId })
      .from(adventures)
      .where(eq(adventures.id, adventureId))
      .limit(1)
    if (!adv[0]) {
      return NextResponse.json({ error: 'adventure not found' }, { status: 404 })
    }

    const partyRow = await db
      .select({
        currentTick: parties.currentTick,
        birthTick: parties.birthTick,
        level: parties.level,
        name: parties.name,
      })
      .from(parties)
      .where(eq(parties.id, adv[0].partyId))
      .limit(1)
    const party = partyRow[0]
    const today = party?.currentTick ?? 0

    const sessionRows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.adventureId, adventureId))
      .orderBy(asc(sessions.worldDay))
    const recentSessions = sessionRows.slice(-5).reverse()

    const upcomingRows: any[] = []
    for (const s of sessionRows) {
      const evs = await db
        .select()
        .from(clockworkEvents)
        .where(eq(clockworkEvents.sessionId, s.id))
      for (const e of evs) {
        if (e.worldDay >= today) upcomingRows.push(e)
      }
    }
    upcomingRows.sort((a, b) => a.worldDay - b.worldDay)

    return NextResponse.json({
      adventure: { id: adv[0].id, name: adv[0].name },
      party,
      today,
      recentSessions,
      upcoming: upcomingRows.slice(0, 20),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'calendar load failed' }, { status: 500 })
  }
}
