/**
 * POST /api/hub/:settlementId/receipt
 *
 * Body: {
 *   actorCertId: string,
 *   action: WorldTPBAction,
 *   receipt: any,
 * }
 *
 * Sequenced append to `hub_runtime_receipts`. Server assigns the next
 * sequence number, validates the cert's persona is allowed to emit this
 * action type (action-authz boundary), heartbeats `lastSeenAt`.
 *
 * No hash chain — determinism is the integrity. Per Pedro 2026-04-30: a
 * cheater who bypasses the authz check ends up with a divergent universe;
 * not our problem.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { hubRuntimes, hubRuntimeReceipts, hubRuntimeState, characterCerts } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { WorldTPBActionSchema, type WorldTPBAction } from '../../../../../../engine/tpb-world'
import { checkActionAllowed } from '@/lib/action-authz'
import { tensorColumnFor, appendTensorEntry, type TensorEntry } from '@/lib/hub-tensor'
import type { PersonaType } from '@/lib/character-cert'

interface ReceiptBody {
  actorCertId?: string
  action?: unknown
  receipt?: unknown
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

    let body: ReceiptBody
    try {
      body = (await req.json()) as ReceiptBody
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    if (typeof body.actorCertId !== 'string' || body.actorCertId.length === 0) {
      return NextResponse.json({ error: 'actorCertId_required' }, { status: 400 })
    }
    if (body.action == null || body.receipt == null) {
      return NextResponse.json({ error: 'action_and_receipt_required' }, { status: 400 })
    }

    // Validate action shape via the canonical Zod schema. Bad shape = reject.
    const parsed = WorldTPBActionSchema.safeParse(body.action)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'action_shape_invalid', details: parsed.error.message },
        { status: 400 },
      )
    }
    const action: WorldTPBAction = parsed.data

    // Look up the cert's persona for the authz check. If the cert doesn't
    // exist, reject — no anonymous receipts.
    const [cert] = await db
      .select({ id: characterCerts.id, personaType: characterCerts.personaType })
      .from(characterCerts)
      .where(eq(characterCerts.id, body.actorCertId))
      .limit(1)
    if (!cert) {
      return NextResponse.json({ error: 'cert_not_found' }, { status: 404 })
    }

    const denialReason = checkActionAllowed(action, cert.personaType as PersonaType)
    if (denialReason) {
      return NextResponse.json(
        { error: 'action_not_allowed', reason: denialReason, persona: cert.personaType },
        { status: 403 },
      )
    }

    const [runtime] = await db
      .select()
      .from(hubRuntimes)
      .where(and(eq(hubRuntimes.settlementId, settlementId), eq(hubRuntimes.status, 'open')))
      .limit(1)
    if (!runtime) {
      return NextResponse.json({ error: 'no_open_runtime' }, { status: 404 })
    }

    // Get the next sequence number.
    const [last] = await db
      .select({ sequence: hubRuntimeReceipts.sequence })
      .from(hubRuntimeReceipts)
      .where(eq(hubRuntimeReceipts.hubRuntimeId, runtime.id))
      .orderBy(desc(hubRuntimeReceipts.sequence))
      .limit(1)
    const sequence = (last?.sequence ?? 0) + 1

    const now = new Date().toISOString()
    await db.insert(hubRuntimeReceipts).values({
      hubRuntimeId: runtime.id,
      sequence,
      actorCertId: body.actorCertId,
      actionJson: JSON.stringify(action),
      receiptJson: JSON.stringify(body.receipt),
      createdAt: now,
    })

    // Tensor write — additive. Append to the right per-type column on
    // hub_runtime_state so the other shard sees this alteration on next
    // poll without scanning the receipts log. The receipts table remains
    // the authoritative time-axis; this row is the dimension-axis.
    const entry: TensorEntry = {
      seq: sequence,
      actorCertId: body.actorCertId,
      at: now,
      action,
      receipt: body.receipt,
    }
    const column = tensorColumnFor(action.type)

    // Find-or-create state row for this runtime.
    const [existingState] = await db
      .select()
      .from(hubRuntimeState)
      .where(eq(hubRuntimeState.hubRuntimeId, runtime.id))
      .limit(1)
    if (!existingState) {
      const fresh: Record<string, string> = {
        tickJson: '[]',
        writeKappaJson: '[]',
        writeEdgeJson: '[]',
        entitySpawnJson: '[]',
        entityMoveJson: '[]',
        entityDespawnJson: '[]',
        observeJson: '[]',
        sessionJson: '[]',
        characterTransferJson: '[]',
      }
      fresh[column] = appendTensorEntry('[]', entry)
      await db.insert(hubRuntimeState).values({
        hubRuntimeId: runtime.id,
        ...(fresh as Record<string, string>),
      })
    } else {
      const currentJson = (existingState as Record<string, unknown>)[column] as string
      const nextJson = appendTensorEntry(currentJson, entry)
      await db
        .update(hubRuntimeState)
        .set({ [column]: nextJson })
        .where(eq(hubRuntimeState.hubRuntimeId, runtime.id))
    }

    // Heartbeat the runtime.
    await db
      .update(hubRuntimes)
      .set({ lastSeenAt: now })
      .where(eq(hubRuntimes.id, runtime.id))

    return NextResponse.json({
      hubRuntimeId: runtime.id,
      sequence,
      lastSeenAt: now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'receipt_failed' }, { status: 500 })
  }
}
