import { NextRequest, NextResponse } from 'next/server'
import { approveEnrollment } from '@/auth/enroll'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }
    const cert = await approveEnrollment(token)
    if (!cert) {
      return NextResponse.json(
        { error: 'token invalid, expired, or already used' },
        { status: 410 }
      )
    }
    return NextResponse.json({ cert })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'enroll approve failed' }, { status: 500 })
  }
}
