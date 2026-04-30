/**
 * POST /api/account/create
 *
 * Mint a new account cert from `(serverNow, geo)`. Per
 * `project_cert_hierarchy.md`:
 *   - Account cert is the top-level player identity, generated from
 *     geolocation + server datetime via the existing `createSeedData`
 *     topology math.
 *   - No email, no password, no invite token.
 *   - Self-serve: anyone hitting this endpoint with valid geo gets an
 *     account.
 *
 * Returns the full cert payload so the client can persist it to IDB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { accounts } from '@/db/schema'
import { createSeedData } from '@/auth/seed'
import { randomUUID } from 'crypto'

interface CreateBody {
  geo?: { lat?: number; lon?: number }
}

export async function POST(req: NextRequest) {
  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const lat = body.geo?.lat
  const lon = body.geo?.lon
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'geo_required' }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'geo_out_of_range' }, { status: 400 })
  }

  const now = new Date()
  const seedData = createSeedData(now, { lat, lon })
  const id = randomUUID()
  const createdAt = now.toISOString()

  try {
    await db.insert(accounts).values({
      id,
      seed: seedData.seed,
      primesJson: JSON.stringify(seedData.primes),
      zeta: seedData.zeta,
      geoLat: lat,
      geoLon: lon,
      createdAt,
      characterCreatedLog: '[]',
      active: true,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'insert_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    id,
    seed: seedData.seed,
    primes: seedData.primes,
    zeta: seedData.zeta,
    geoLat: lat,
    geoLon: lon,
    createdAt,
    characterCreatedLog: [],
  })
}
