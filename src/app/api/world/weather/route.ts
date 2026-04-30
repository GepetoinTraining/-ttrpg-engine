import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { weatherState, worldRegions } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/world/weather?regionId=X
 * Returns the latest weather_state row for that region (or all rows if no id).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const regionId = url.searchParams.get('regionId')
    const allRegions = await db.select().from(worldRegions)

    if (regionId) {
      const rows = await db.select().from(weatherState).where(eq(weatherState.regionId, regionId))
      const region = allRegions.find((r) => r.id === regionId) ?? null
      return NextResponse.json({ region, weather: rows[0] ?? null })
    }
    const all = await db.select().from(weatherState)
    return NextResponse.json({ regions: allRegions, weather: all })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'weather load failed' }, { status: 500 })
  }
}
