/**
 * POST /api/cron/drain-slots
 *
 * Hourly drain job for `flywheel_slots`. Per `project_cert_hierarchy.md`:
 *   - Sweeps pending slots ordered by `queued_at ASC` (arrival order is
 *     the canonical sequence).
 *   - Copies each slot's actions into `tpb_entries`, preserving order.
 *   - Marks the slot as processed (sets `processedAt`).
 *
 * Out-of-order timestamps inside slots are expected and OK — the .tpb is
 * append-only and absorbs out-of-order naturally (worldline reconciliation).
 *
 * Invoked by:
 *   - Vercel Cron (configure separately from /api/cron/tick)
 *   - Manual trigger for admin/dev
 *
 * Auth: same `CRON_SECRET` pattern as /api/cron/tick.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { flywheelSlots, tpbEntries } from '@/db/schema'
import { eq, isNull, asc } from 'drizzle-orm'
import type { WorldTPBAction } from '../../../../../engine/tpb-world'

interface SlotPayload {
  actions: WorldTPBAction[]
  receipts?: unknown[]
  dmSignature?: string
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

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const got = req.headers.get('authorization') ?? ''
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const url = new URL(req.url)
  const maxBatch = Math.max(1, Math.min(10000, Number(url.searchParams.get('max') ?? '1000')))

  // Pull pending slots in arrival order.
  const pending = await db
    .select()
    .from(flywheelSlots)
    .where(isNull(flywheelSlots.processedAt))
    .orderBy(asc(flywheelSlots.queuedAt), asc(flywheelSlots.id))
    .limit(maxBatch)

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, drained: 0, actionsWritten: 0 })
  }

  let actionsWritten = 0
  const processedAt = new Date().toISOString()

  for (const slot of pending) {
    let payload: SlotPayload
    try {
      payload = JSON.parse(slot.payloadJson) as SlotPayload
    } catch {
      // Bad payload — mark processed so we don't reprocess, log to console.
      // eslint-disable-next-line no-console
      console.error(`drain-slots: slot ${slot.id} has invalid JSON, skipping`)
      await db
        .update(flywheelSlots)
        .set({ processedAt })
        .where(eq(flywheelSlots.id, slot.id))
      continue
    }

    const actions = payload.actions ?? []
    if (actions.length > 0) {
      // Bulk-insert this slot's actions into tpb_entries.
      const rows = actions.map((action) => ({
        worldDay: slot.atDay,
        actionType: action.type,
        targetId: targetIdForAction(action),
        deltaJson: JSON.stringify(action),
        timestamp: slot.queuedAt,
      }))
      await db.insert(tpbEntries).values(rows)
      actionsWritten += rows.length
    }

    await db
      .update(flywheelSlots)
      .set({ processedAt })
      .where(eq(flywheelSlots.id, slot.id))
  }

  return NextResponse.json({
    ok: true,
    drained: pending.length,
    actionsWritten,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
