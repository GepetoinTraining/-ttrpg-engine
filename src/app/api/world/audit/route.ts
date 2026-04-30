/**
 * GET /api/world/audit?fromDay=X&toDay=Y&limit=N
 *
 * Forensic verification of a `tpb_entries` slice. Per
 * `project_cert_hierarchy.md`:
 *   - "math is the gate; signatures are forensic" — happy path is cheap,
 *     this endpoint is the on-demand expensive path.
 *   - Walks the slice, flags shape failures + ordering invariants +
 *     signature presence. Real cryptographic verification is deferred
 *     until the signing pipeline lands.
 *
 * No auth gating for v1 (Pedro: "no users yet"). Add `CRON_SECRET`-style
 * auth before this hits prod.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { worlds } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { readTpbEntries } from '@/lib/world-tpb'
import { auditEntries, type AuditEntry } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const fromDay = url.searchParams.get('fromDay')
  const toDay = url.searchParams.get('toDay')
  const limit = url.searchParams.get('limit')
  const trackParty = url.searchParams.get('trackParty')

  const opts: { fromDay?: number; toDay?: number; limit?: number } = {}
  if (fromDay !== null) {
    const n = Number(fromDay)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'fromDay_invalid' }, { status: 400 })
    }
    opts.fromDay = Math.floor(n)
  }
  if (toDay !== null) {
    const n = Number(toDay)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'toDay_invalid' }, { status: 400 })
    }
    opts.toDay = Math.floor(n)
  }
  if (limit !== null) {
    const n = Number(limit)
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: 'limit_invalid' }, { status: 400 })
    }
    opts.limit = Math.min(10000, Math.floor(n))
  }

  try {
    const rows = await readTpbEntries(opts)

    // Optionally seed the party-position tracker with the world's current
    // partyNodeId. If we're auditing from day 0 forward we want null to
    // start; if we're auditing a tail slice, we want the party position
    // as it was at fromDay (best-effort: use current).
    let initialPartyNodeId: string | null = null
    if (trackParty === '1' || trackParty === 'true') {
      const world = await db
        .select({ partyNodeId: worlds.partyNodeId })
        .from(worlds)
        .where(eq(worlds.id, 'default'))
        .get()
      initialPartyNodeId = world?.partyNodeId ?? null
    }

    const auditEntriesInput: AuditEntry[] = rows.map((r) => ({
      id: r.id,
      worldDay: r.worldDay,
      actionType: (r.action as { type?: string })?.type ?? 'unknown',
      action: r.action,
      realTs: r.realTs,
    }))

    const result = auditEntries(auditEntriesInput, {
      trackPartyPosition: trackParty === '1' || trackParty === 'true',
      initialPartyNodeId,
    })

    return NextResponse.json({
      fromDay: opts.fromDay ?? null,
      toDay: opts.toDay ?? null,
      limit: opts.limit ?? 500,
      ...result,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'audit_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
