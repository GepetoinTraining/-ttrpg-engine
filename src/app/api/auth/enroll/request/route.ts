import { NextRequest, NextResponse } from 'next/server'
import { requestEnrollment } from '@/auth/enroll'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestedId, geo } = body
    if (typeof requestedId !== 'string' || !requestedId.trim()) {
      return NextResponse.json({ error: 'requestedId required' }, { status: 400 })
    }
    if (!geo || typeof geo.lat !== 'number' || typeof geo.lon !== 'number') {
      return NextResponse.json({ error: 'geo {lat, lon} required' }, { status: 400 })
    }
    const token = await requestEnrollment(requestedId.trim(), { lat: geo.lat, lon: geo.lon })
    return NextResponse.json({ token })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'enroll request failed' }, { status: 500 })
  }
}
