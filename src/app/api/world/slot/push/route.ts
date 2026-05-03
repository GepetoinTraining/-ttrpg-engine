/**
 * POST /api/world/slot/push
 *
 * Client-driven write path for world-state deltas. Per
 * `project_cert_hierarchy.md` "Client-side TPB + flywheel slot pattern":
 *   - Clients batch `WorldTPBAction[]` locally, then push here when ready.
 *   - This endpoint is **append-only** — no engine compute, no signature
 *     verification (signatures are forensic, not gating; "math is the gate").
 *   - The hourly drain job is what actually sequences pushes into the
 *     canonical `tpb_entries` ledger.
 *
 * Two push shapes:
 *   1. solo / dmless:
 *      { kind: 'solo', sourceCertId, atDay, actions[], receipts[] }
 *   2. DM session bundle (DM-as-shard-host):
 *      { kind: 'dm-session', sourceCertId (DM cert), sessionId, atDay,
 *        endDay, actions[], receipts[], dmSignature }
 *
 * Validation: Zod-shape only. The drain job is what reconciles content.
 * Out-of-order timestamps inside the bundle are EXPECTED for DM bundles —
 * a 4-hour real session covers in-world hours/days; .tpb absorbs that
 * naturally (worldline reconciliation per Pratchett / Long Earth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db/connection'
import { flywheelSlots } from '@/db/schema'
import { WorldTPBActionSchema } from '../../../../../../engine/tpb-world'

// W5.2 — tightened receipt schema. `mfId` is enumed against known MFs so a
// malformed receipt is rejected at the boundary; `verification` stays
// `unknown` (varies by mf) but the outer envelope is shape-validated.
const ReceiptMfIdSchema = z.enum([
  'mf_dice',
  'mf_check',
  'mf_damage',
  'mf_smelt',
  'mf_forge',
  'mf_identify',
  'mf_craft',
  'mf_pool_dice',
])

const ReceiptSchema = z.object({
  mfId: ReceiptMfIdSchema,
  tick: z.number().int().nonnegative(),
  input: z.unknown(),
  output: z.unknown(),
  verification: z.unknown(),
  timestamp: z.number().nonnegative(),
})

const SoloPushSchema = z.object({
  kind: z.literal('solo'),
  sourceCertId: z.string().min(1),
  atDay: z.number().int().nonnegative(),
  actions: z.array(WorldTPBActionSchema),
  receipts: z.array(ReceiptSchema).default([]),
})

const DmSessionPushSchema = z.object({
  kind: z.literal('dm-session'),
  sourceCertId: z.string().min(1),  // DM cert
  sessionId: z.string().min(1),
  atDay: z.number().int().nonnegative(),
  endDay: z.number().int().nonnegative(),
  actions: z.array(WorldTPBActionSchema),
  receipts: z.array(ReceiptSchema).default([]),
  /** DM cert's outer signature over the entire bundle */
  dmSignature: z.string().min(1),
})

const PushSchema = z.discriminatedUnion('kind', [SoloPushSchema, DmSessionPushSchema])

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = PushSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const body = parsed.data
  const queuedAt = new Date().toISOString()

  try {
    const inserted = await db
      .insert(flywheelSlots)
      .values({
        sourceCertId: body.sourceCertId,
        pushKind: body.kind,
        sessionId: body.kind === 'dm-session' ? body.sessionId : null,
        atDay: body.atDay,
        endDay: body.kind === 'dm-session' ? body.endDay : null,
        payloadJson: JSON.stringify({
          actions: body.actions,
          receipts: body.receipts,
          ...(body.kind === 'dm-session' ? { dmSignature: body.dmSignature } : {}),
        }),
        queuedAt,
        processedAt: null,
      })
      .returning({ id: flywheelSlots.id })

    return NextResponse.json({
      ok: true,
      slotId: inserted[0]?.id ?? null,
      queuedAt,
      actionCount: body.actions.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'insert_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
