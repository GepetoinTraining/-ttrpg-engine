import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { companions, companionCatalog } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/companion/list?characterId=X (optional filter)
 * Returns companions joined with their catalog entries.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const characterId = url.searchParams.get('characterId')

    const compRows = characterId
      ? await db.select().from(companions).where(eq(companions.ownerId, characterId))
      : await db.select().from(companions)

    const catRows = await db.select().from(companionCatalog)
    const catById = new Map(catRows.map((c) => [c.id, c]))

    const list = compRows.map((c) => ({
      id: c.id,
      name: c.name,
      ownerId: c.ownerId,
      hp: { current: c.hpCurrent, max: c.hpMax },
      mood: c.mood,
      bondLevel: c.bondLevel,
      conditions: c.conditionsJson ? JSON.parse(c.conditionsJson) : [],
      catalog: catById.get(c.catalogId) ?? null,
    }))

    return NextResponse.json({ companions: list })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'companion list failed' }, { status: 500 })
  }
}
