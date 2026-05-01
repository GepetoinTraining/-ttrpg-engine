import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import {
  worlds,
  parties,
  adventures,
  campaigns,
  sessions,
  clockworkEvents,
} from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

const DEFAULT_WORLD_ID = 'default'

/**
 * GET /api/world/calendar
 * GET /api/world/calendar?adventureId=X
 * GET /api/world/calendar?campaignId=X
 *
 * Returns:
 *   - worldDay         (worlds.currentDay — canonical cron-driven clock)
 *   - partyDay         (parties.currentTick — session-time clock, only if scoped)
 *   - birthTick        (parties.birthTick, only if scoped)
 *   - adventure        (only if scoped)
 *   - party            (only if scoped)
 *   - sessions         (last 5 sessions for this adventure, or all if unscoped)
 *   - upcomingEvents   (clockwork events with worldDay >= today, limit 20)
 *
 * Both adventureId and campaignId are optional; when neither is supplied the
 * response is a global view (worldDay + global sessions/events).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let adventureId = url.searchParams.get('adventureId')
    const campaignId = url.searchParams.get('campaignId')

    // Translate campaignId → adventureId if needed.
    if (!adventureId && campaignId) {
      const camp = await db
        .select({ adventureId: campaigns.adventureId })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1)
      adventureId = camp[0]?.adventureId ?? null
    }

    // Canonical world clock.
    const worldRow = await db
      .select({ currentDay: worlds.currentDay })
      .from(worlds)
      .where(eq(worlds.id, DEFAULT_WORLD_ID))
      .limit(1)
    const worldDay = worldRow[0]?.currentDay ?? 0

    // Scoped path — adventure + party + their sessions.
    if (adventureId) {
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
      const partyDay = party?.currentTick ?? null
      const birthTick = party?.birthTick ?? null

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
          if (e.worldDay >= worldDay) upcomingRows.push(e)
        }
      }
      upcomingRows.sort((a, b) => a.worldDay - b.worldDay)

      return NextResponse.json({
        worldDay,
        partyDay,
        birthTick,
        adventure: { id: adv[0].id, name: adv[0].name },
        party,
        sessions: recentSessions,
        upcomingEvents: upcomingRows.slice(0, 20),
      })
    }

    // Global path — no adventure scope.
    const allSessions = await db.select().from(sessions).orderBy(asc(sessions.worldDay))
    const recentSessions = allSessions.slice(-5).reverse()

    const allEvents = await db.select().from(clockworkEvents)
    const upcomingEvents = allEvents
      .filter((e: any) => e.worldDay >= worldDay)
      .sort((a: any, b: any) => a.worldDay - b.worldDay)
      .slice(0, 20)

    return NextResponse.json({
      worldDay,
      partyDay: null,
      birthTick: null,
      adventure: null,
      party: null,
      sessions: recentSessions,
      upcomingEvents,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'calendar load failed' }, { status: 500 })
  }
}
