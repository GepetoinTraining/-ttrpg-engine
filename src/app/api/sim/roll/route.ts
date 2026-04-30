import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { diceReceipts } from '@/db/schema'
import { mfDice, type DiceFormula } from '@/../engine/mf-dice'
import { randomUUID } from 'crypto'

interface RollBody {
  formula: DiceFormula
  seed?: number
  rollerId?: string
  rollType?: string
  worldDay?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RollBody
    if (!body.formula) {
      return NextResponse.json({ error: 'formula required' }, { status: 400 })
    }
    const { output, receipt } = mfDice(body.formula, body.seed)

    const id = randomUUID()
    try {
      await db.insert(diceReceipts).values({
        id,
        worldDay: body.worldDay ?? 0,
        rollerId: body.rollerId ?? 'anonymous',
        rollType: body.rollType ?? 'generic',
        resultJson: JSON.stringify({ output, receipt }),
      })
    } catch (e) {
      // Don't fail the roll if the receipt write fails — log it client-side.
      return NextResponse.json({ output, receipt, id, persisted: false })
    }
    return NextResponse.json({ output, receipt, id, persisted: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'roll failed' },
      { status: 500 }
    )
  }
}
