/**
 * Browser-side companion helpers.
 */

export interface Companion {
  id: string
  name: string
  ownerId: string
  hp: { current: number; max: number }
  mood: string
  bondLevel: number
  conditions: string[]
  catalog: {
    id: string
    name: string
    category: string
    species: string
    bodyType: string
    size: string
    colorPrimary: string
    colorSecondary: string | null
  } | null
}

export async function listCompanions(characterId?: string): Promise<{ companions: Companion[] }> {
  const params = new URLSearchParams()
  if (characterId) params.set('characterId', characterId)
  const res = await fetch(`/api/companion/list?${params}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}
