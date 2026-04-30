import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { reputations, reputationDeltas, partyMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

/**
 * POST /api/reputation/delta
 *
 * Body: { subjectType: 'character' | 'party', subjectId, factionId, baseDelta,
 *         reason?, worldDay?, partyId? }
 *
 * For character subjects: looks up the character's party (or accepts partyId
 * directly) and dampens the delta by the party's standing with that faction:
 *   dampen(p) = 1 - |p| / 200      → 1.0 at p=0, 0.5 at p=±100
 *   appliedDelta = baseDelta * dampen(partyScore)
 *
 * For party subjects: applies baseDelta directly (no dampening).
 *
 * Always upserts the score (clamped -100..+100), inserts a reputationDeltas
 * audit row recording both base and applied, and returns the new state.
 */

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function dampen(partyScore: number): number {
  return 1 - Math.abs(partyScore) / 200
}

interface Body {
  subjectType: 'character' | 'party'
  subjectId: string
  factionId: string
  baseDelta: number
  reason?: string
  worldDay?: number
  partyId?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    if (!['character', 'party'].includes(body.subjectType)) {
      return NextResponse.json({ error: 'subjectType must be character or party' }, { status: 400 })
    }
    if (!body.subjectId || !body.factionId) {
      return NextResponse.json({ error: 'subjectId and factionId required' }, { status: 400 })
    }
    if (typeof body.baseDelta !== 'number') {
      return NextResponse.json({ error: 'baseDelta must be a number' }, { status: 400 })
    }

    // Resolve party for character subjects.
    let partyId: string | null = body.partyId ?? null
    if (body.subjectType === 'character' && !partyId) {
      const m = await db
        .select({ partyId: partyMembers.partyId })
        .from(partyMembers)
        .where(eq(partyMembers.characterId, body.subjectId))
        .limit(1)
      partyId = m[0]?.partyId ?? null
    }

    // Look up the party's score with this faction (default 0).
    let partyScore = 0
    if (partyId) {
      const pr = await db
        .select({ score: reputations.score })
        .from(reputations)
        .where(
          and(
            eq(reputations.subjectType, 'party'),
            eq(reputations.subjectId, partyId),
            eq(reputations.factionId, body.factionId)
          )
        )
        .limit(1)
      partyScore = pr[0]?.score ?? 0
    }

    const dampenFactor = body.subjectType === 'character' ? dampen(partyScore) : 1
    const appliedDelta = body.baseDelta * dampenFactor

    // Upsert the row.
    const existing = await db
      .select()
      .from(reputations)
      .where(
        and(
          eq(reputations.subjectType, body.subjectType),
          eq(reputations.subjectId, body.subjectId),
          eq(reputations.factionId, body.factionId)
        )
      )
      .limit(1)

    let newScore: number
    if (existing[0]) {
      newScore = clamp(existing[0].score + appliedDelta, -100, 100)
      await db
        .update(reputations)
        .set({ score: newScore })
        .where(eq(reputations.id, existing[0].id))
    } else {
      newScore = clamp(appliedDelta, -100, 100)
      await db.insert(reputations).values({
        id: randomUUID(),
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        factionId: body.factionId,
        score: newScore,
      })
    }

    await db.insert(reputationDeltas).values({
      id: randomUUID(),
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      factionId: body.factionId,
      baseDelta: body.baseDelta,
      appliedDelta,
      reason: body.reason ?? null,
      worldDay: body.worldDay ?? 0,
      appliedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      newScore,
      baseDelta: body.baseDelta,
      appliedDelta,
      dampenFactor,
      partyScoreAtApply: partyScore,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'delta failed' }, { status: 500 })
  }
}
