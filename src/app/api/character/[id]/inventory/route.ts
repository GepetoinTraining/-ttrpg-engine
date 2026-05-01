import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { inventories, containers, items } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/character/:id/inventory
 *
 * Returns the character's polymorphic inventories with containers + items
 * inlined. The polymorphic `inventories` table is keyed on (ownerType, ownerId).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'character id required' }, { status: 400 })
    }

    // Fetch all inventories owned by this character.
    const invRows = await db
      .select()
      .from(inventories)
      .where(and(eq(inventories.ownerType, 'character'), eq(inventories.ownerId, id)))

    if (invRows.length === 0) {
      return NextResponse.json({
        characterId: id,
        inventories: [],
        totals: { containers: 0, items: 0, weight: 0, valueGP: 0 },
      })
    }

    // Fetch containers + items in two batched queries, group in memory.
    const inventoryIds = invRows.map((i) => i.id)
    const allContainers = await Promise.all(
      inventoryIds.map((iid) =>
        db.select().from(containers).where(eq(containers.inventoryId, iid)),
      ),
    ).then((rows) => rows.flat())

    const containerIds = allContainers.map((c) => c.id)
    const allItems = await Promise.all(
      containerIds.map((cid) =>
        db.select().from(items).where(eq(items.containerId, cid)),
      ),
    ).then((rows) => rows.flat())

    // Compose nested response.
    const out = invRows.map((inv) => ({
      id: inv.id,
      locationNodeId: inv.locationNodeId,
      containers: allContainers
        .filter((c) => c.inventoryId === inv.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          weightCapacity: c.weightCapacity,
          volumeCapacity: c.volumeCapacity,
          spatialMagic: c.spatialMagic,
          locked: c.locked,
          lockDC: c.lockDC,
          currency: c.currencyJson ? JSON.parse(c.currencyJson) : null,
          items: allItems
            .filter((it) => it.containerId === c.id)
            .map((it) => ({
              id: it.id,
              name: it.name,
              category: it.category,
              rarity: it.rarity,
              weight: it.weight,
              volume: it.volume,
              valueGP: it.valueGP,
              stackable: it.stackable,
              quantity: it.quantity,
              magical: it.magical,
              requiresAttunement: it.requiresAttunement,
              sourceType: it.sourceType,
              properties: it.propertiesJson ? JSON.parse(it.propertiesJson) : null,
            })),
        })),
    }))

    const totals = {
      containers: allContainers.length,
      items: allItems.length,
      weight: allItems.reduce((sum, it) => sum + (it.weight ?? 0) * (it.quantity ?? 1), 0),
      valueGP: allItems.reduce((sum, it) => sum + (it.valueGP ?? 0) * (it.quantity ?? 1), 0),
    }

    return NextResponse.json({ characterId: id, inventories: out, totals })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'inventory load failed' },
      { status: 500 },
    )
  }
}
