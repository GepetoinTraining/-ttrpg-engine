import { NextRequest, NextResponse } from 'next/server'
import { requestEnrollment } from '@/auth/enroll'

interface InviteBody {
  requestedId: string
  geo: { lat: number; lon: number }
}

// POST /api/campaign/:id/invite
// Wraps requestEnrollment and returns a token tied to the campaign id via the
// invite URL the caller is expected to share. The campaign association is not
// persisted server-side yet — Chargen / Onboarding-Player will associate the
// player to the campaign when they redeem and create a character.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    if (!id) {
      return NextResponse.json({ error: 'campaign id required' }, { status: 400 })
    }
    const body = (await req.json()) as InviteBody
    if (typeof body.requestedId !== 'string' || !body.requestedId.trim()) {
      return NextResponse.json({ error: 'requestedId required' }, { status: 400 })
    }
    if (
      !body.geo ||
      typeof body.geo.lat !== 'number' ||
      typeof body.geo.lon !== 'number'
    ) {
      return NextResponse.json({ error: 'geo {lat, lon} required' }, { status: 400 })
    }
    const token = await requestEnrollment(body.requestedId.trim(), body.geo)
    return NextResponse.json({ token, campaignId: id })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'invite failed' },
      { status: 500 }
    )
  }
}
