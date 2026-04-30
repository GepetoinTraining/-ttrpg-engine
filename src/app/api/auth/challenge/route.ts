import { NextRequest, NextResponse } from 'next/server'
import { generateChallenge } from '@/auth/verify'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }
    const challenge = await generateChallenge(userId)
    if (!challenge) {
      return NextResponse.json(
        { error: 'unknown user or inactive' },
        { status: 404 }
      )
    }
    return NextResponse.json(challenge)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'challenge failed' }, { status: 500 })
  }
}
