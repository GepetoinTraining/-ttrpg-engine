import { NextResponse } from 'next/server'
import { getWorldStatus } from '@/lib/world-state'

export async function GET() {
  try {
    const status = await getWorldStatus()
    return NextResponse.json(status)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'state_failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
