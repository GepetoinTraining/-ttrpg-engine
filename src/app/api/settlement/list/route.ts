import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { settlements, worldRegions } from '@/db/schema'
import { sql } from 'drizzle-orm'

/**
 * GET /api/settlement/list?limit=50&search=foo
 * Returns settlements joined with their region.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 50))
    const search = url.searchParams.get('search')?.trim().toLowerCase() ?? ''

    const rows = await db
      .select({
        id: settlements.id,
        name: settlements.name,
        regionId: settlements.regionId,
        population: settlements.population,
        stability: settlements.stability,
        hubSize: settlements.hubSize,
        era: settlements.era,
        regionName: worldRegions.name,
        terrain: worldRegions.terrain,
      })
      .from(settlements)
      .leftJoin(worldRegions, sql`${worldRegions.id} = ${settlements.regionId}`)
      .limit(limit)

    const filtered = search
      ? rows.filter((r) => r.name.toLowerCase().includes(search))
      : rows

    return NextResponse.json({ settlements: filtered, total: filtered.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'list failed' }, { status: 500 })
  }
}
