import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { spellsKnown, spells, spellSlots, casterState } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

/**
 * GET /api/character/:id/spells — spells known + slots + caster state.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    const knownRows = await db
      .select({
        spellId: spellsKnown.spellId,
        name: spells.name,
        school: spells.school,
        level: spells.level,
        range: spells.range,
        duration: spells.duration,
        ritual: spells.ritual,
        concentration: spells.concentration,
      })
      .from(spellsKnown)
      .leftJoin(spells, sql`${spells.id} = ${spellsKnown.spellId}`)
      .where(eq(spellsKnown.characterId, id))

    const slotRows = await db
      .select()
      .from(spellSlots)
      .where(eq(spellSlots.characterId, id))

    const stateRows = await db
      .select()
      .from(casterState)
      .where(eq(casterState.characterId, id))
      .limit(1)

    return NextResponse.json({
      caster: stateRows[0] ?? null,
      slots: slotRows.sort((a, b) => a.spellLevel - b.spellLevel),
      spells: knownRows,
      summary: {
        knownCount: knownRows.length,
        cantrips: knownRows.filter((s) => s.level === 0).length,
        leveled: knownRows.filter((s) => (s.level ?? 0) > 0).length,
        rituals: knownRows.filter((s) => s.ritual).length,
        concentrations: knownRows.filter((s) => s.concentration).length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'spells load failed' }, { status: 500 })
  }
}
