import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { worlds, worldRegions, settlements, buildings } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/tp/tree?worldId=X
 *
 * Returns a snapshot of the topology tree for a world: world → regions →
 * settlements → buildings. Read-only for now — κ writes require a
 * data_static JSON column the schema doesn't yet have.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const worldId = url.searchParams.get('worldId')
    const worldRows = worldId
      ? await db.select().from(worlds).where(eq(worlds.id, worldId))
      : await db.select().from(worlds)
    if (worldRows.length === 0) {
      return NextResponse.json({ worlds: [], regions: [], settlements: [], buildings: [] })
    }

    const allRegions = await db.select().from(worldRegions)
    const allSettlements = await db.select().from(settlements)
    const buildingCounts: Record<string, number> = {}
    const allBuildings = await db.select({ settlementId: buildings.settlementId }).from(buildings)
    for (const b of allBuildings) {
      buildingCounts[b.settlementId] = (buildingCounts[b.settlementId] ?? 0) + 1
    }

    const filteredRegions = worldId ? allRegions.filter((r) => r.worldId === worldId) : allRegions
    const filteredSettlements = worldId
      ? allSettlements.filter((s) => filteredRegions.some((r) => r.id === s.regionId))
      : allSettlements

    return NextResponse.json({
      worlds: worldRows,
      regions: filteredRegions.slice(0, 500).map((r) => ({
        id: r.id,
        name: r.name,
        worldId: r.worldId,
        parentId: r.parentId,
        terrain: r.terrain,
        depth: r.depth,
        explored: r.explored,
        hasSettlement: r.hasSettlement,
        settlementName: r.settlementName,
      })),
      settlements: filteredSettlements.map((s) => ({
        id: s.id,
        name: s.name,
        regionId: s.regionId,
        population: s.population,
        stability: s.stability,
        hubSize: s.hubSize,
        era: s.era,
        buildingCount: buildingCounts[s.id] ?? 0,
      })),
      counts: {
        worlds: worldRows.length,
        regions: filteredRegions.length,
        settlements: filteredSettlements.length,
        buildings: allBuildings.length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'tp tree load failed' }, { status: 500 })
  }
}
