import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { characterAttunements, items } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const MAX_SLOTS = 3

/**
 * GET    /api/character/:id/attunement → list current attunements (slots 0..2)
 * POST   /api/character/:id/attunement → body { itemId, slotIndex } → bind item to slot
 * DELETE /api/character/:id/attunement?slotIndex=N → break attunement at slot
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const rows = await db
      .select()
      .from(characterAttunements)
      .where(eq(characterAttunements.characterId, id))

    const slots: ({ slotIndex: number; itemId: string; item: any; attunedDay: number } | null)[] = [
      null,
      null,
      null,
    ]
    for (const a of rows) {
      if (a.slotIndex >= 0 && a.slotIndex < MAX_SLOTS) {
        const itemRows = await db.select().from(items).where(eq(items.id, a.itemId)).limit(1)
        slots[a.slotIndex] = {
          slotIndex: a.slotIndex,
          itemId: a.itemId,
          item: itemRows[0] ?? null,
          attunedDay: a.attunedDay,
        }
      }
    }
    return NextResponse.json({ slots, used: rows.length, max: MAX_SLOTS })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'attunement read failed' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const { itemId, slotIndex, attunedDay } = await req.json()
    if (typeof itemId !== 'string' || !itemId) {
      return NextResponse.json({ error: 'itemId required' }, { status: 400 })
    }
    if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      return NextResponse.json({ error: `slotIndex must be 0..${MAX_SLOTS - 1}` }, { status: 400 })
    }
    // Slot already occupied? caller must DELETE first.
    const existing = await db
      .select()
      .from(characterAttunements)
      .where(and(eq(characterAttunements.characterId, id), eq(characterAttunements.slotIndex, slotIndex)))
      .limit(1)
    if (existing[0]) {
      return NextResponse.json({ error: 'slot occupied — break attunement first' }, { status: 409 })
    }
    const rowId = randomUUID()
    await db.insert(characterAttunements).values({
      id: rowId,
      characterId: id,
      itemId,
      slotIndex,
      attunedDay: attunedDay ?? 0,
    })
    return NextResponse.json({ id: rowId, slotIndex, itemId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'attune failed' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const url = new URL(req.url)
    const slotIndex = Number(url.searchParams.get('slotIndex'))
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      return NextResponse.json({ error: `slotIndex must be 0..${MAX_SLOTS - 1}` }, { status: 400 })
    }
    await db
      .delete(characterAttunements)
      .where(and(eq(characterAttunements.characterId, id), eq(characterAttunements.slotIndex, slotIndex)))
    return NextResponse.json({ slotIndex, freed: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unattune failed' }, { status: 500 })
  }
}
