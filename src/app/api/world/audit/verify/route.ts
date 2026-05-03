/**
 * POST /api/world/audit/verify  — Forensic replay verification.
 *
 * W5.1 (per `project_next_routing_pass.md`): the dispute path. Replays the
 * canonical `tpb_entries` slice between [fromDay, toDay], reconstructs a
 * fresh TP from `engine/world-bootstrap`, applies every action via
 * `engine/tpb-replay`, and reports any errors encountered.
 *
 * NOT on the happy path. Slot push and drain do not call this. It exists
 * for:
 *   - Trade dispute investigations
 *   - "Why does the server say X but the client computes Y?" debugging
 *   - Periodic audit jobs (post-prod cron)
 *
 * No engine compute on the happy path: the same engine code runs here for
 * verification, but only when a human (or audit job) explicitly requests
 * it. Server normally just appends.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readTpbEntries } from '@/lib/world-tpb'
import { buildBaseTp } from '../../../../../../engine/world-bootstrap'
import { applyTpbAction } from '../../../../../../engine/tpb-replay'

interface VerifyRequest {
  fromDay?: number
  toDay?: number
  /** Optional: limit to actions involving this character cert id. */
  certId?: string
}

export async function POST(req: NextRequest) {
  let body: VerifyRequest = {}
  try {
    body = (await req.json()) as VerifyRequest
  } catch {
    // empty body OK
  }

  const opts: { fromDay?: number; toDay?: number; limit: number } = { limit: 5000 }
  if (typeof body.fromDay === 'number' && body.fromDay >= 0) opts.fromDay = Math.floor(body.fromDay)
  if (typeof body.toDay === 'number' && body.toDay >= 0) opts.toDay = Math.floor(body.toDay)

  let entries
  try {
    entries = await readTpbEntries(opts)
  } catch (e: unknown) {
    return NextResponse.json(
      { error: 'tpb_read_failed', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  // Optionally filter by certId — we look at characterTransfer.fromAccountId/toAccountId
  // and writeKappa.system="client-intent:<certId>" matches.
  const scoped = body.certId
    ? entries.filter((e) => {
        const a = e.action
        if (a.type === 'characterTransfer') {
          return a.fromAccountId === body.certId || a.toAccountId === body.certId
        }
        if (a.type === 'writeKappa' && typeof a.system === 'string') {
          return a.system.includes(body.certId!)
        }
        return false
      })
    : entries

  // Replay
  const tp = buildBaseTp()
  const errors: { entryId: number; worldDay: number; type: string; message: string }[] = []
  let appliedCount = 0
  for (const e of scoped) {
    try {
      applyTpbAction(tp, e.action)
      appliedCount++
    } catch (err: unknown) {
      errors.push({
        entryId: e.id,
        worldDay: e.worldDay,
        type: e.action.type,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    fromDay: opts.fromDay ?? null,
    toDay: opts.toDay ?? null,
    certId: body.certId ?? null,
    entriesScanned: scoped.length,
    entriesApplied: appliedCount,
    errors,
  })
}
