/**
 * GET /api/hub/:settlementId/runtime
 *
 * Find-or-create the hub runtime for `(settlementId, aperture='A4_HUB')`.
 * Per Pedro 2026-05-01: "for the live server that's what gets spun up, at
 * the correct aperture, 3.9 miles is a shared space." A_HUB is the L4
 * shared space; one open runtime per settlement at this aperture.
 *
 * The lease is the only time the server is "live" for two parties. It
 * orders receipts in arrival sequence; clients (DM shards or live
 * observers) compute against the canonical state and post their
 * alterations through this lease.
 *
 * Response: { runtime: HubRuntimeState }.
 *
 * No engine compute here — server packages canonical state pointers and
 * returns. Clients hold their own engine.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { hubRuntimes, hubRuntimeState, settlements, worlds } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { snapshotFromRow, type TensorSnapshot } from '@/lib/hub-tensor'

const APERTURE = 'A4_HUB'
const LEASE_MINUTES = 60

type RuntimeRow = typeof hubRuntimes.$inferSelect

function shape(row: RuntimeRow) {
  return {
    id: row.id,
    settlementId: row.settlementId,
    hubId: row.hubId,
    aperture: row.aperture,
    canonicalHeadId: row.canonicalHeadId,
    activeN: row.activeN,
    joinedSessionIds: JSON.parse(row.joinedSessionIdsJson || '[]') as string[],
    status: row.status,
    openedAt: row.openedAt,
    lastSeenAt: row.lastSeenAt,
    leaseExpiresAt: row.leaseExpiresAt,
    districtIds: row.districtIdsJson ? (JSON.parse(row.districtIdsJson) as string[]) : null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> },
) {
  try {
    const { settlementId } = await params
    if (!settlementId) {
      return NextResponse.json({ error: 'settlementId_required' }, { status: 400 })
    }

    const [settlement] = await db
      .select({ id: settlements.id })
      .from(settlements)
      .where(eq(settlements.id, settlementId))
      .limit(1)
    if (!settlement) {
      return NextResponse.json({ error: 'settlement_not_found' }, { status: 404 })
    }

    const [existing] = await db
      .select()
      .from(hubRuntimes)
      .where(
        and(
          eq(hubRuntimes.settlementId, settlementId),
          eq(hubRuntimes.aperture, APERTURE),
          eq(hubRuntimes.status, 'open'),
        ),
      )
      .limit(1)

    if (existing) {
      const [stateRow] = await db
        .select()
        .from(hubRuntimeState)
        .where(eq(hubRuntimeState.hubRuntimeId, existing.id))
        .limit(1)
      const tensor: TensorSnapshot | null = stateRow ? snapshotFromRow(stateRow) : null
      return NextResponse.json({ runtime: shape(existing), tensor })
    }

    // No open runtime yet — create one. Pin canonicalHeadId at the current
    // worldDay so all joiners agree on the starting state.
    const [world] = await db.select({ currentDay: worlds.currentDay }).from(worlds).limit(1)
    const worldDay = world?.currentDay ?? 0

    const id = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + LEASE_MINUTES * 60 * 1000)

    await db.insert(hubRuntimes).values({
      id,
      settlementId,
      hubId: settlementId,
      aperture: APERTURE,
      canonicalHeadId: `worldDay:${worldDay}`,
      activeN: 0,
      joinedSessionIdsJson: '[]',
      status: 'open',
      openedAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      leaseExpiresAt: expiresAt.toISOString(),
      districtIdsJson: null,
    })

    // Initialize an empty tensor row alongside the new runtime.
    await db.insert(hubRuntimeState).values({
      hubRuntimeId: id,
      tickJson: '[]',
      writeKappaJson: '[]',
      writeEdgeJson: '[]',
      entitySpawnJson: '[]',
      entityMoveJson: '[]',
      entityDespawnJson: '[]',
      observeJson: '[]',
      sessionJson: '[]',
      characterTransferJson: '[]',
    })

    const [fresh] = await db
      .select()
      .from(hubRuntimes)
      .where(eq(hubRuntimes.id, id))
      .limit(1)

    return NextResponse.json({
      runtime: shape(fresh!),
      tensor: {
        tick: [],
        writeKappa: [],
        writeEdge: [],
        entitySpawn: [],
        entityMove: [],
        entityDespawn: [],
        observe: [],
        session: [],
        characterTransfer: [],
      } satisfies TensorSnapshot,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'runtime_failed' }, { status: 500 })
  }
}
