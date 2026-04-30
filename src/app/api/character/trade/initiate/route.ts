/**
 * POST /api/character/trade/initiate
 *
 * Step 1 of 2 in a character cert transfer. The current owner signs a
 * handoff intent. Per `project_cert_hierarchy.md`:
 *   - 2-step trade prevents accidental transfers.
 *   - Server verifies the initiator currently owns the character (last
 *     entry in ownerChain).
 *   - Signature is stored as audit data, NOT verified here (forensic-only).
 *
 * The character is NOT transferred yet — that happens in /accept. Until
 * accepted, the original owner still commands the cert.
 *
 * Body:
 *   { characterCertId, fromAccountId, toAccountId, initiateSig }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db/connection'
import { characterCerts, characterTrades, accounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const InitiateBodySchema = z.object({
  characterCertId: z.string().min(1),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  /** Opaque signature blob — stored, not verified on this path. */
  initiateSig: z.string().min(1),
})

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = InitiateBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const body = parsed.data

  if (body.fromAccountId === body.toAccountId) {
    return NextResponse.json({ error: 'self_transfer_not_allowed' }, { status: 400 })
  }

  // Verify the character exists and the initiator currently commands it.
  const cert = await db
    .select()
    .from(characterCerts)
    .where(eq(characterCerts.id, body.characterCertId))
    .get()
  if (!cert) {
    return NextResponse.json({ error: 'character_not_found' }, { status: 404 })
  }
  if (cert.accountId !== body.fromAccountId) {
    return NextResponse.json({ error: 'not_current_owner' }, { status: 403 })
  }

  // Verify the receiver account exists.
  const toAccount = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, body.toAccountId))
    .get()
  if (!toAccount) {
    return NextResponse.json({ error: 'recipient_not_found' }, { status: 404 })
  }

  // Reject if there's already a pending trade for this character.
  const existing = await db
    .select({ id: characterTrades.id })
    .from(characterTrades)
    .where(
      and(
        eq(characterTrades.characterCertId, body.characterCertId),
        eq(characterTrades.status, 'pending'),
      ),
    )
    .get()
  if (existing) {
    return NextResponse.json({ error: 'trade_already_pending', tradeId: existing.id }, { status: 409 })
  }

  const tradeId = randomUUID()
  const now = new Date().toISOString()

  try {
    await db.insert(characterTrades).values({
      id: tradeId,
      characterCertId: body.characterCertId,
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      initiatedAt: now,
      acceptedAt: null,
      cancelledAt: null,
      initiateSig: body.initiateSig,
      acceptSig: null,
      status: 'pending',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'insert_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    tradeId,
    characterCertId: body.characterCertId,
    fromAccountId: body.fromAccountId,
    toAccountId: body.toAccountId,
    status: 'pending',
    initiatedAt: now,
  })
}
