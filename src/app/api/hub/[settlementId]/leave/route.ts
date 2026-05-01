/**
 * POST /api/hub/:settlementId/leave
 *
 * Body: { sessionId: string }
 *
 * Decrements activeN, removes sessionId from joinedSessionIds. If activeN
 * reaches 0, marks the runtime status='closing', drains receipts inline
 * into canonical `tpb_entries` (in sequence order), then marks
 * status='committed'. No flywheel slot path — the lease + receipt rows
 * ARE the bundle. Math is the gate; deterministic replay verifies.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { hubRuntimes, hubRuntimeReceipts, tpbEntries, worlds } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import type { WorldTPBAction } from '../../../../../../engine/tpb-world'

interface LeaveBody {
  sessionId?: string
}

function targetIdForAction(action: WorldTPBAction): string | null {
  switch (action.type) {
    case 'tick':              return null
    case 'writeKappa':        return action.nodeId
    case 'writeEdge':         return action.edgeId
    case 'entitySpawn':       return action.entityId
    case 'entityMove':        return action.entityId
    case 'entityDespawn':     return action.entityId
    case 'observe':           return action.nodeId
    case 'session':           return action.sessionId
    case 'characterTransfer': return action.characterId
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> },
) {
  try {
    const { settlementId } = await params
    if (!settlementId) {
      return NextResponse.json({ error: 'settlementId_required' }, { status: 400 })
    }

    let body: LeaveBody
    try {
      body = (await req.json()) as LeaveBody
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    if (typeof body.sessionId !== 'string' || body.sessionId.length === 0) {
      return NextResponse.json({ error: 'sessionId_required' }, { status: 400 })
    }

    const [runtime] = await db
      .select()
      .from(hubRuntimes)
      .where(and(eq(hubRuntimes.settlementId, settlementId), eq(hubRuntimes.status, 'open')))
      .limit(1)
    if (!runtime) {
      return NextResponse.json({ error: 'no_open_runtime' }, { status: 404 })
    }

    const current: string[] = JSON.parse(runtime.joinedSessionIdsJson || '[]')
    let activeN = runtime.activeN
    let joined = current
    if (current.includes(body.sessionId)) {
      joined = current.filter((s) => s !== body.sessionId)
      activeN = Math.max(0, activeN - 1)
    }

    const now = new Date().toISOString()

    if (activeN > 0) {
      // Still active — just update.
      await db
        .update(hubRuntimes)
        .set({
          activeN,
          joinedSessionIdsJson: JSON.stringify(joined),
          lastSeenAt: now,
        })
        .where(eq(hubRuntimes.id, runtime.id))

      return NextResponse.json({
        hubRuntimeId: runtime.id,
        activeN,
        joinedSessionIds: joined,
        closing: false,
      })
    }

    // activeN reached 0 — initiate close + inline drain.
    await db
      .update(hubRuntimes)
      .set({
        activeN: 0,
        joinedSessionIdsJson: JSON.stringify([]),
        lastSeenAt: now,
        status: 'closing',
      })
      .where(eq(hubRuntimes.id, runtime.id))

    // Read receipts in sequence order — the canonical record of what the
    // shards posted while the lease was open.
    const receipts = await db
      .select()
      .from(hubRuntimeReceipts)
      .where(eq(hubRuntimeReceipts.hubRuntimeId, runtime.id))
      .orderBy(asc(hubRuntimeReceipts.sequence))

    // Read current canonical worldDay so the appended tpb_entries are
    // tagged at canon — fast-travel computes the road forward from canon
    // to canon; the lease lives at canon (per Pedro 2026-05-01).
    const [world] = await db.select({ currentDay: worlds.currentDay }).from(worlds).limit(1)
    const worldDay = world?.currentDay ?? 0

    let written = 0
    if (receipts.length > 0) {
      const inserts = receipts
        .map((r) => {
          let inner: WorldTPBAction
          try {
            inner = JSON.parse(r.actionJson) as WorldTPBAction
          } catch {
            return null
          }
          if (!inner || typeof inner !== 'object' || !('type' in inner)) return null
          return {
            worldDay,
            actionType: inner.type,
            targetId: targetIdForAction(inner),
            deltaJson: JSON.stringify(inner),
            timestamp: r.createdAt,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)

      if (inserts.length > 0) {
        await db.insert(tpbEntries).values(inserts)
        written = inserts.length
      }
    }

    await db
      .update(hubRuntimes)
      .set({ status: 'committed' })
      .where(eq(hubRuntimes.id, runtime.id))

    return NextResponse.json({
      hubRuntimeId: runtime.id,
      activeN: 0,
      joinedSessionIds: [],
      closing: true,
      receiptCount: receipts.length,
      tpbEntriesWritten: written,
      closedAt: now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'leave_failed' }, { status: 500 })
  }
}
