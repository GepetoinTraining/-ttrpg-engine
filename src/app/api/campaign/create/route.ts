import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import {
  parties,
  adventures,
  campaigns,
  playModeConfigs,
  gmProfileOverrides,
  simulationDepth,
} from '@/db/schema'
import { randomUUID } from 'crypto'

interface CreateBody {
  name: string
  slug?: string
  worldSeed?: string
  region?: string
  tone?: string
  startingLevel?: number
  playMode?: 'GROUP_DM_AI' | 'GROUP_AI' | 'SOLO_AI' | 'TRUE_SOLO'
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBody
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    const partyId = randomUUID()
    const adventureId = randomUUID()
    const campaignId = randomUUID()

    const startingLevel = Math.max(1, Math.min(20, body.startingLevel ?? 1))
    const playMode = body.playMode ?? 'GROUP_DM_AI'
    const tone = body.tone ?? null
    const region = body.region ?? null

    // Server tick at creation — engine convention is ms; treat as opaque integer.
    const nowTick = Math.floor(Date.now() / 1000)

    await db.insert(parties).values({
      id: partyId,
      name: body.name.trim(),
      adventureId, // we'll set this after but the ref is to adventures so skip
      gold: 0,
      level: startingLevel,
      birthTick: nowTick,
      currentTick: nowTick,
      startingLocation: region,
      startingType: 'safe',
      xpMultiplier: 1.0,
    })

    await db.insert(adventures).values({
      id: adventureId,
      partyId,
      name: body.name.trim(),
      worldStateJson: JSON.stringify({
        worldSeed: body.worldSeed ?? 'faerun',
        region,
        slug: body.slug ?? null,
      }),
    })

    await db.insert(campaigns).values({
      id: campaignId,
      adventureId,
      playMode,
    })

    await db.insert(playModeConfigs).values({
      id: randomUUID(),
      campaignId,
      mode: playMode,
      gmProfile: 'storyteller',
      pacingBias: 'balanced',
      corridorMode: false,
      autoAdvance: false,
      maxScenesPerSession: 10,
    })

    await db.insert(simulationDepth).values({
      id: randomUUID(),
      campaignId,
    })

    if (tone) {
      await db.insert(gmProfileOverrides).values({
        id: randomUUID(),
        campaignId,
        tone,
      })
    }

    return NextResponse.json({
      campaignId,
      adventureId,
      partyId,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'campaign create failed' },
      { status: 500 }
    )
  }
}
