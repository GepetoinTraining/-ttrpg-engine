import { NextRequest, NextResponse } from 'next/server'
import { verifyChallenge } from '@/auth/verify'

export async function POST(req: NextRequest) {
  try {
    const { challengeId, trajectory } = await req.json()
    if (typeof challengeId !== 'string' || !challengeId) {
      return NextResponse.json({ error: 'challengeId required' }, { status: 400 })
    }
    if (typeof trajectory !== 'string' || !trajectory) {
      return NextResponse.json({ error: 'trajectory required' }, { status: 400 })
    }
    const result = await verifyChallenge(challengeId, trajectory)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'verify failed' }, { status: 500 })
  }
}
