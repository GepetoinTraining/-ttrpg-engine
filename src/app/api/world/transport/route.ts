import { NextRequest, NextResponse } from 'next/server'
import { transportParty, type TimeMode } from '@/lib/world-state'

interface RequestBody {
  destNodeId?: string
  timeMode?: TimeMode
  days?: number
}

export async function POST(req: NextRequest) {
  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body.destNodeId !== 'string' || body.destNodeId.length === 0) {
    return NextResponse.json({ error: 'destNodeId_required' }, { status: 400 })
  }
  const tm: TimeMode =
    body.timeMode === 'travel' || body.timeMode === 'days' ? body.timeMode : 'instant'
  const days = typeof body.days === 'number' ? body.days : undefined

  try {
    const result = await transportParty({
      destNodeId: body.destNodeId,
      timeMode: tm,
      days,
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'transport_failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
