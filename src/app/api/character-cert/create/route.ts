/**
 * POST /api/character-cert/create
 *
 * Mint a new character cert tied to an existing account. Per
 * `project_cert_hierarchy.md`:
 *   - Same topology math as account creation: `createSeedData(now, geo)`
 *   - Persona type is FIXED at creation (player | dm | gm-ai | dmless)
 *   - `ownerChain` starts as `[accountId]` — the minting account is the
 *     first commander.
 *   - Append a row to `accounts.characterCreatedLog` so origin is auditable.
 *   - `characterDataId` is optional; chargen may attach it later via the
 *     existing character endpoints.
 *
 * No signature verification on this path — math agrees if the account row
 * exists. (Per "dual signatures are forensic, not gating".)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { accounts, characterCerts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createSeedData } from '@/auth/seed'
import { randomUUID } from 'crypto'

const PERSONA_TYPES = ['player', 'dm', 'gm-ai', 'dmless'] as const
type PersonaType = (typeof PERSONA_TYPES)[number]

interface CreateBody {
  accountId?: string
  geo?: { lat?: number; lon?: number }
  personaType?: string
  characterDataId?: string | null
}

export async function POST(req: NextRequest) {
  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body.accountId !== 'string' || body.accountId.length === 0) {
    return NextResponse.json({ error: 'accountId_required' }, { status: 400 })
  }

  const lat = body.geo?.lat
  const lon = body.geo?.lon
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'geo_required' }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'geo_out_of_range' }, { status: 400 })
  }

  const persona = body.personaType
  if (typeof persona !== 'string' || !PERSONA_TYPES.includes(persona as PersonaType)) {
    return NextResponse.json({ error: 'persona_invalid' }, { status: 400 })
  }
  const personaType = persona as PersonaType

  // Verify the account exists.
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, body.accountId))
    .get()
  if (!account) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 })
  }

  const now = new Date()
  const seedData = createSeedData(now, { lat, lon })
  const id = randomUUID()
  const createdAt = now.toISOString()
  const ownerChain = [body.accountId]
  const characterDataId =
    typeof body.characterDataId === 'string' && body.characterDataId.length > 0
      ? body.characterDataId
      : null

  try {
    await db.insert(characterCerts).values({
      id,
      accountId: body.accountId,
      seed: seedData.seed,
      primesJson: JSON.stringify(seedData.primes),
      zeta: seedData.zeta,
      geoLat: lat,
      geoLon: lon,
      createdAt,
      ownerChainJson: JSON.stringify(ownerChain),
      characterDataId,
      personaType,
      active: true,
    })

    // Append to the account's characterCreatedLog (origin record).
    let log: { characterId: string; seed: string; createdAt: string }[] = []
    try {
      log = JSON.parse(account.characterCreatedLog ?? '[]')
    } catch {
      log = []
    }
    log.push({ characterId: id, seed: seedData.seed, createdAt })
    await db
      .update(accounts)
      .set({ characterCreatedLog: JSON.stringify(log) })
      .where(eq(accounts.id, body.accountId))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'insert_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    id,
    accountId: body.accountId,
    seed: seedData.seed,
    primes: seedData.primes,
    zeta: seedData.zeta,
    geoLat: lat,
    geoLon: lon,
    createdAt,
    ownerChain,
    characterDataId,
    personaType,
  })
}
