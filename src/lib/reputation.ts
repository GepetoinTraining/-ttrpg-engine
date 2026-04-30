/**
 * Browser-side reputation client.
 */

export interface RepRow {
  factionId: string
  factionName: string
  factionType: string
  pcScore: number
  partyScore: number
}

export interface RepDelta {
  id: string
  subjectType: string
  subjectId: string
  factionId: string
  baseDelta: number
  appliedDelta: number
  reason: string | null
  worldDay: number
  appliedAt: string
}

export interface RepMatrix {
  character: { id: string; name: string }
  partyId: string | null
  matrix: RepRow[]
  recent: RepDelta[]
}

export async function loadCharacterReputation(characterId: string): Promise<RepMatrix> {
  const res = await fetch(`/api/reputation/character/${characterId}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export interface DeltaResult {
  newScore: number
  baseDelta: number
  appliedDelta: number
  dampenFactor: number
  partyScoreAtApply: number
}

export async function applyReputationDelta(input: {
  subjectType: 'character' | 'party'
  subjectId: string
  factionId: string
  baseDelta: number
  reason?: string
  worldDay?: number
  partyId?: string
}): Promise<DeltaResult> {
  const res = await fetch('/api/reputation/delta', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}
