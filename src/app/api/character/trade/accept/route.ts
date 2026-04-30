/**
 * POST /api/character/trade/accept
 *
 * Step 2 of 2 in a character cert transfer. The receiver signs a claim
 * for a pending trade. Per `project_cert_hierarchy.md`:
 *   - Appends the receiver to `character_certs.ownerChain` (last = current
 *     commander).
 *   - Updates `character_certs.accountId` to the receiver.
 *   - Marks the trade `accepted`.
 *   - Emits a `characterTransfer` row directly into `tpb_entries` so the
 *     transfer is part of the canonical ledger immediately (unlike most
 *     world actions which go through `flywheel_slots`).
 *
 * Body:
 *   { tradeId, toAccountId, acceptSig }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db/connection'
import { characterCerts, characterTrades, tpbEntries, worlds } from '@/db/schema'
import { eq } from 'drizzle-orm'

const AcceptBodySchema = z.object({
  tradeId: z.string().min(1),
  toAccountId: z.string().min(1),
  /** Opaque signature blob — stored, not verified on this path. */
  acceptSig: z.string().min(1),
})

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = AcceptBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const body = parsed.data

  // Pull the pending trade row.
  const trade = await db
    .select()
    .from(characterTrades)
    .where(eq(characterTrades.id, body.tradeId))
    .get()
  if (!trade) {
    return NextResponse.json({ error: 'trade_not_found' }, { status: 404 })
  }
  if (trade.status !== 'pending') {
    return NextResponse.json({ error: 'trade_not_pending', status: trade.status }, { status: 409 })
  }
  if (trade.toAccountId !== body.toAccountId) {
    return NextResponse.json({ error: 'not_intended_recipient' }, { status: 403 })
  }

  // Pull the character cert.
  const cert = await db
    .select()
    .from(characterCerts)
    .where(eq(characterCerts.id, trade.characterCertId))
    .get()
  if (!cert) {
    return NextResponse.json({ error: 'character_not_found' }, { status: 404 })
  }
  // Defensive: the cert's current commander should still be the trade's fromAccountId.
  if (cert.accountId !== trade.fromAccountId) {
    return NextResponse.json({ error: 'cert_owner_changed', currentOwner: cert.accountId }, { status: 409 })
  }

  // Update ownerChain — append toAccountId.
  let ownerChain: string[] = []
  try {
    ownerChain = JSON.parse(cert.ownerChainJson)
  } catch {
    ownerChain = [cert.accountId]
  }
  ownerChain.push(trade.toAccountId)

  const acceptedAt = new Date().toISOString()

  try {
    // Atomic-ish: update cert + trade, then append to ledger.
    await db
      .update(characterCerts)
      .set({
        accountId: trade.toAccountId,
        ownerChainJson: JSON.stringify(ownerChain),
      })
      .where(eq(characterCerts.id, trade.characterCertId))

    await db
      .update(characterTrades)
      .set({
        status: 'accepted',
        acceptedAt,
        acceptSig: body.acceptSig,
      })
      .where(eq(characterTrades.id, body.tradeId))

    // Pull current world day for the ledger entry.
    const world = await db
      .select({ currentDay: worlds.currentDay })
      .from(worlds)
      .where(eq(worlds.id, 'default'))
      .get()
    const worldDay = world?.currentDay ?? 0

    // Append a `characterTransfer` action to the canonical ledger.
    const action = {
      type: 'characterTransfer',
      characterId: trade.characterCertId,
      fromAccountId: trade.fromAccountId,
      toAccountId: trade.toAccountId,
      initiateSig: trade.initiateSig,
      acceptSig: body.acceptSig,
    }
    await db.insert(tpbEntries).values({
      worldDay,
      actionType: 'characterTransfer',
      targetId: trade.characterCertId,
      deltaJson: JSON.stringify(action),
      timestamp: acceptedAt,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'transfer_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    tradeId: body.tradeId,
    characterCertId: trade.characterCertId,
    fromAccountId: trade.fromAccountId,
    toAccountId: trade.toAccountId,
    status: 'accepted',
    acceptedAt,
    ownerChain,
  })
}
