/**
 * POST /api/hub/:settlementId/join
 *
 * Body: { sessionId: string, certId: string }
 *
 * Increments activeN, appends sessionId to joinedSessionIdsJson, refreshes
 * lastSeenAt. Idempotent on sessionId — joining twice is a no-op. The
 * cert must exist and be active.
 *
 * Persona compatibility (DMless ↔ DM-led time-flow mismatch) is enforced
 * at the action-authz boundary on /receipt — joining the lease itself is
 * permissive; what you can DO inside is what's gated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { hubRuntimes, characterCerts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

interface JoinBody {
  sessionId?: string
  certId?: string
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

    let body: JoinBody
    try {
      body = (await req.json()) as JoinBody
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    if (typeof body.sessionId !== 'string' || body.sessionId.length === 0) {
      return NextResponse.json({ error: 'sessionId_required' }, { status: 400 })
    }
    if (typeof body.certId !== 'string' || body.certId.length === 0) {
      return NextResponse.json({ error: 'certId_required' }, { status: 400 })
    }

    const [cert] = await db
      .select({ id: characterCerts.id, active: characterCerts.active })
      .from(characterCerts)
      .where(eq(characterCerts.id, body.certId))
      .limit(1)
    if (!cert) {
      return NextResponse.json({ error: 'cert_not_found' }, { status: 404 })
    }
    if (!cert.active) {
      return NextResponse.json({ error: 'cert_inactive' }, { status: 403 })
    }

    const [runtime] = await db
      .select()
      .from(hubRuntimes)
      .where(and(eq(hubRuntimes.settlementId, settlementId), eq(hubRuntimes.status, 'open')))
      .limit(1)
    if (!runtime) {
      return NextResponse.json(
        { error: 'no_open_runtime', hint: 'GET /api/hub/[settlementId]/runtime first' },
        { status: 404 },
      )
    }

    const current: string[] = JSON.parse(runtime.joinedSessionIdsJson || '[]')
    let activeN = runtime.activeN
    let joined = current
    if (!current.includes(body.sessionId)) {
      joined = [...current, body.sessionId]
      activeN = activeN + 1
    }

    const now = new Date().toISOString()
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
      lastSeenAt: now,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'join_failed' }, { status: 500 })
  }
}
