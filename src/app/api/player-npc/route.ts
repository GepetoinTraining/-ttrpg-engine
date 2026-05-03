import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { playerNpcs, players, characters } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

/**
 * GET /api/player-npc?playerId=...
 *   Returns the NPCs controlled by the given player (active assignments).
 *
 * GET /api/player-npc?playerCharacterId=...
 *   Convenience: looks up the player by activateCharacterId, then lists.
 *
 * POST /api/player-npc
 *   Body: { playerId, npcCharacterId, role?, note? }
 *   Creates an active assignment (deactivates any prior row for the same
 *   (playerId, npcCharacterId) pair to keep history but avoid duplicates).
 *
 * DELETE /api/player-npc?id=...
 *   Sets active=false on the assignment row (keeps the lineage).
 */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let playerId = url.searchParams.get('playerId')
    const playerCharacterId = url.searchParams.get('playerCharacterId')

    if (!playerId && playerCharacterId) {
      const row = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.activateCharacterId, playerCharacterId))
        .limit(1)
      if (row.length > 0) playerId = row[0].id
    }

    if (!playerId) {
      return NextResponse.json({ error: 'playerId or playerCharacterId required' }, { status: 400 })
    }

    const assignments = await db
      .select()
      .from(playerNpcs)
      .where(and(eq(playerNpcs.playerId, playerId), eq(playerNpcs.active, true)))

    if (assignments.length === 0) {
      return NextResponse.json({ playerId, npcs: [] })
    }

    // Hydrate each NPC's character row
    const npcs = await Promise.all(
      assignments.map(async (a) => {
        const charRows = await db
          .select()
          .from(characters)
          .where(eq(characters.id, a.npcCharacterId))
          .limit(1)
        const character = charRows[0] ?? null
        return {
          assignmentId: a.id,
          npcCharacterId: a.npcCharacterId,
          role: a.role,
          assignedDay: a.assignedDay,
          note: a.note,
          character,
        }
      }),
    )

    return NextResponse.json({ playerId, npcs })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'list failed' },
      { status: 500 },
    )
  }
}

interface CreateBody {
  /** Either pass the player seat id directly… */
  playerId?: string
  /** …or the active PC's character id and the server resolves the player. */
  playerCharacterId?: string
  npcCharacterId: string
  role?: string
  note?: string
  assignedDay?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBody

    if (!body.npcCharacterId) {
      return NextResponse.json({ error: 'npcCharacterId required' }, { status: 400 })
    }
    if (!body.playerId && !body.playerCharacterId) {
      return NextResponse.json(
        { error: 'playerId or playerCharacterId required' },
        { status: 400 },
      )
    }

    // Resolve playerId from playerCharacterId if needed.
    let playerId = body.playerId ?? null
    if (!playerId && body.playerCharacterId) {
      const row = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.activateCharacterId, body.playerCharacterId))
        .limit(1)
      if (row.length === 0) {
        return NextResponse.json(
          { error: 'no player found for that character' },
          { status: 404 },
        )
      }
      playerId = row[0].id
    }

    // Verify the player exists
    const playerRow = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, playerId!))
      .limit(1)
    if (playerRow.length === 0) {
      return NextResponse.json({ error: 'unknown playerId' }, { status: 404 })
    }

    // Verify the NPC character exists
    const npcRow = await db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.id, body.npcCharacterId))
      .limit(1)
    if (npcRow.length === 0) {
      return NextResponse.json({ error: 'unknown npcCharacterId' }, { status: 404 })
    }

    // Deactivate any prior active assignment for this (player, npc) pair
    await db
      .update(playerNpcs)
      .set({ active: false })
      .where(
        and(
          eq(playerNpcs.playerId, playerId!),
          eq(playerNpcs.npcCharacterId, body.npcCharacterId),
          eq(playerNpcs.active, true),
        ),
      )

    const id = `pnp_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    const newRow = {
      id,
      playerId: playerId!,
      npcCharacterId: body.npcCharacterId,
      role: body.role ?? 'follower',
      assignedDay: body.assignedDay ?? 0,
      active: true,
      note: body.note ?? null,
    }
    await db.insert(playerNpcs).values(newRow)

    return NextResponse.json({ assignment: newRow })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    await db.update(playerNpcs).set({ active: false }).where(eq(playerNpcs.id, id))
    return NextResponse.json({ ok: true, id })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unassign failed' },
      { status: 500 },
    )
  }
}
