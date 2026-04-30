/**
 * Browser-side dice client.
 * Wraps /api/sim/roll which itself wraps engine/mf-dice.ts.
 */

export interface DiceFormula {
  count: number
  sides: number
  modifier?: number
}

export interface DiceResult {
  total: number
  rolls: number[]
  sum: number
  modifier: number
  natural20: boolean
  natural1: boolean
  formula: string
}

export interface RollOutcome {
  output: DiceResult
  receipt: { formula: string; rolls: number[]; sum: number; modifier: number; verified: boolean }
  id: string
  persisted: boolean
}

export async function rollDice(
  formula: DiceFormula,
  options: { rollerId?: string; rollType?: string; worldDay?: number; seed?: number } = {}
): Promise<RollOutcome> {
  const res = await fetch('/api/sim/roll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      formula: { count: formula.count, sides: formula.sides, modifier: formula.modifier ?? 0 },
      ...options,
    }),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<RollOutcome>
}
