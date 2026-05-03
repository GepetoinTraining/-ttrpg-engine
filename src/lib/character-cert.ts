/**
 * Character cert — per-character identity, IDB-backed.
 *
 * Per `project_cert_hierarchy.md`:
 *   - Character cert is minted at chargen from `(serverNow, playerGeo)` via
 *     the same `createSeedData` topology math as the account cert. It's
 *     the SAME math, second invocation — Pedro's "circularize a second time".
 *   - Persona type (`player | dm | gm-ai | dmless`) is FIXED at creation.
 *   - `ownerChain` is append-only — last entry is the current commander.
 *   - The cert is independent of the character sheet (HP, abilities) which
 *     lives in the `characters` table. Cert is identity, sheet is data.
 */

import { idbPut, idbGet, idbGetAll, idbDelete } from './idb'
import { authFetch } from './auth-fetch'

export type PersonaType = 'player' | 'dm' | 'gm-ai' | 'dmless'

export interface CharacterCert {
  id: string
  accountId: string         // current commander (last in ownerChain)
  seed: string
  primes: string[]
  zeta: number
  geoLat: number
  geoLon: number
  createdAt: string
  ownerChain: string[]      // accountIds, last is current commander
  characterDataId: string | null  // FK to characters table; null until chargen completes
  personaType: PersonaType
}

export interface CreateCharacterCertInput {
  accountId: string
  geo: { lat: number; lon: number }
  personaType: PersonaType
  characterDataId?: string | null
}

/**
 * Mint a new character cert.
 *
 * The server stamps datetime + runs `createSeedData(now, geo)` to produce
 * the topology trio. The result is persisted to IDB on success.
 *
 * `characterDataId` is optional at this stage — chargen may mint the cert
 * BEFORE creating the character row, then update via `attachCharacterData`.
 */
export async function createCharacterCert(input: CreateCharacterCertInput): Promise<CharacterCert> {
  const res = await authFetch('/api/character-cert/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId: input.accountId,
      geo: input.geo,
      personaType: input.personaType,
      characterDataId: input.characterDataId ?? null,
    }),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(`character cert create failed: ${msg}`)
  }
  const cert = (await res.json()) as CharacterCert
  await idbPut<CharacterCert>('characterCerts', cert)
  return cert
}

/**
 * Read a character cert by id from IDB.
 */
export async function loadCharacterCert(id: string): Promise<CharacterCert | null> {
  if (typeof window === 'undefined') return null
  return (await idbGet<CharacterCert>('characterCerts', id)) ?? null
}

/**
 * List all character certs in IDB. Filters by accountId if provided —
 * useful when `loadAccount()` returns the active account and we want only
 * characters they currently command.
 */
export async function listCharacterCerts(accountId?: string): Promise<CharacterCert[]> {
  if (typeof window === 'undefined') return []
  const all = await idbGetAll<CharacterCert>('characterCerts')
  if (!accountId) return all
  return all.filter((c) => c.accountId === accountId)
}

/**
 * Attach a character data row to a cert. Used by chargen when the cert
 * was minted before the character sheet was created.
 */
export async function attachCharacterData(certId: string, characterDataId: string): Promise<CharacterCert | null> {
  const cert = await loadCharacterCert(certId)
  if (!cert) return null
  cert.characterDataId = characterDataId
  await idbPut<CharacterCert>('characterCerts', cert)
  return cert
}

/**
 * Wipe a single character cert from IDB. Does NOT touch the server row.
 */
export async function deleteCharacterCert(certId: string): Promise<void> {
  await idbDelete('characterCerts', certId)
}

// ============================================================
// SESSION STATE — which character is "logged into" the world right now
// ============================================================

/**
 * Per `project_cert_hierarchy.md`: one active character at a time so the
 * dual-signature signing chain stays unambiguous. The active id lives in
 * the singleton `sessionState` row (keyPath: 'id', the literal string
 * 'singleton').
 */
const SESSION_KEY = 'singleton'

interface SessionStateRecord {
  id: string                    // always 'singleton'
  activeAccountId: string | null
  activeCharacterId: string | null
  lastWorldDay: number
  updatedAt: string
}

export async function setActiveCharacter(
  accountId: string,
  characterCertId: string,
): Promise<void> {
  const rec: SessionStateRecord = {
    id: SESSION_KEY,
    activeAccountId: accountId,
    activeCharacterId: characterCertId,
    lastWorldDay: 0,
    updatedAt: new Date().toISOString(),
  }
  await idbPut<SessionStateRecord>('sessionState', rec)
}

export async function clearActiveCharacter(): Promise<void> {
  if (typeof window === 'undefined') return
  const rec: SessionStateRecord = {
    id: SESSION_KEY,
    activeAccountId: null,
    activeCharacterId: null,
    lastWorldDay: 0,
    updatedAt: new Date().toISOString(),
  }
  await idbPut<SessionStateRecord>('sessionState', rec)
}

/**
 * Returns the active character cert (with full payload) or null if none
 * is active. Loads sessionState first, then dereferences to the cert row.
 */
export async function getActiveCharacterCert(): Promise<CharacterCert | null> {
  if (typeof window === 'undefined') return null
  const rec = await idbGet<SessionStateRecord>('sessionState', SESSION_KEY)
  if (!rec || !rec.activeCharacterId) return null
  return loadCharacterCert(rec.activeCharacterId)
}

/**
 * Returns the raw session state record (or null if never set). Useful for
 * surfaces that want to know if there's an active session without paying
 * for the cert dereference.
 */
export async function getSessionState(): Promise<SessionStateRecord | null> {
  if (typeof window === 'undefined') return null
  return (await idbGet<SessionStateRecord>('sessionState', SESSION_KEY)) ?? null
}
