import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import {
  reputations,
  reputationDeltas,
  factions,
  characters,
  partyMembers,
  parties,
} from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

/**
 * GET /api/reputation/character/:id
 *
 * Returns:
 *   - per-faction PC scores (rows from reputations where subjectType='character')
 *   - per-faction party scores (the PC's party, for the dampening band)
 *   - recent deltas with applied vs base
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const charRows = await db.select().from(characters).where(eq(characters.id, id)).limit(1)
    if (!charRows[0]) {
      return NextResponse.json({ error: 'character not found' }, { status: 404 })
    }

    // Find this character's party (if any) via party_members.
    const memberRows = await db
      .select({ partyId: partyMembers.partyId })
      .from(partyMembers)
      .where(eq(partyMembers.characterId, id))
      .limit(1)
    const partyId = memberRows[0]?.partyId ?? null

    const allFactions = await db.select().from(factions)
    const pcReps = await db
      .select()
      .from(reputations)
      .where(and(eq(reputations.subjectType, 'character'), eq(reputations.subjectId, id)))
    const partyReps = partyId
      ? await db
          .select()
          .from(reputations)
          .where(and(eq(reputations.subjectType, 'party'), eq(reputations.subjectId, partyId)))
      : []

    const pcByFaction = new Map(pcReps.map((r) => [r.factionId, r.score]))
    const partyByFaction = new Map(partyReps.map((r) => [r.factionId, r.score]))

    const matrix = allFactions.map((f) => ({
      factionId: f.id,
      factionName: f.name,
      factionType: f.type,
      pcScore: pcByFaction.get(f.id) ?? 0,
      partyScore: partyByFaction.get(f.id) ?? 0,
    }))

    const recent = await db
      .select()
      .from(reputationDeltas)
      .where(and(eq(reputationDeltas.subjectType, 'character'), eq(reputationDeltas.subjectId, id)))
      .orderBy(desc(reputationDeltas.appliedAt))
      .limit(20)

    return NextResponse.json({
      character: { id, name: charRows[0].name },
      partyId,
      matrix,
      recent,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'reputation load failed' }, { status: 500 })
  }
}
