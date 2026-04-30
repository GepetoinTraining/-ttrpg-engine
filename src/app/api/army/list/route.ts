import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { armies, armyUnits, factions } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/army/list — read-only army roster.
 *
 * The siege resolver itself (modifiers, health portions, front/back line,
 * freshness, real-time war turns) is intentionally NOT wired here. The full
 * spec is parked in the warfare-model memory; this surface only lists what's
 * on the board today.
 */
export async function GET(_req: NextRequest) {
  try {
    const [armyRows, unitRows, factionRows] = await Promise.all([
      db.select().from(armies),
      db.select().from(armyUnits),
      db.select().from(factions),
    ])
    const factionById = new Map(factionRows.map((f) => [f.id, f]))
    const unitsByArmy = new Map<string, any[]>()
    for (const u of unitRows) {
      if (!unitsByArmy.has(u.armyId)) unitsByArmy.set(u.armyId, [])
      unitsByArmy.get(u.armyId)!.push(u)
    }

    return NextResponse.json({
      armies: armyRows.map((a) => ({
        id: a.id,
        name: a.name,
        tier: a.tier,
        morale: a.morale,
        supplies: a.supplies,
        readiness: a.readiness,
        regionId: a.regionId,
        faction: factionById.get(a.factionId) ?? null,
        units: unitsByArmy.get(a.id) ?? [],
        totalCount: (unitsByArmy.get(a.id) ?? []).reduce((s, u) => s + u.count, 0),
      })),
      counts: {
        armies: armyRows.length,
        units: unitRows.length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'army list failed' }, { status: 500 })
  }
}
