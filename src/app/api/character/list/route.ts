import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { characters, characterClasses } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/character/list — list all characters with primary class summary.
export async function GET(_req: NextRequest) {
  try {
    const rows = await db
      .select({
        id: characters.id,
        name: characters.name,
        race: characters.race,
        subrace: characters.subrace,
        hpCurrent: characters.hpCurrent,
        hpMax: characters.hpMax,
        status: characters.status,
        playerId: characters.playerId,
      })
      .from(characters)

    const list = await Promise.all(
      rows.map(async (r) => {
        const classes = await db
          .select({ className: characterClasses.className, level: characterClasses.level })
          .from(characterClasses)
          .where(eq(characterClasses.characterId, r.id))
        return { ...r, classes }
      })
    )

    return NextResponse.json({ characters: list })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'character list failed' },
      { status: 500 }
    )
  }
}
