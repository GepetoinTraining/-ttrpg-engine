/**
 * Account cert — top-level player identity, IDB-backed.
 *
 * Per `project_cert_hierarchy.md`:
 *   - Account cert is minted at landing from `(serverNow, playerGeo)` via the
 *     existing `createSeedData` topology math. No email/password ever.
 *   - One account cert per browser, typically. Lives in IDB `accounts` store.
 *   - Persists an append-only `characterCreatedLog` — every character cert
 *     this account has ever minted (survives trades).
 *
 * This module is the BROWSER-side helper. Talks to /api/account/create for
 * the actual mint, then saves the returned cert to IDB.
 */

import { idbPut, idbGetAll, idbClear } from './idb'

export interface AccountCert {
  id: string
  seed: string
  primes: string[]
  zeta: number
  geoLat: number
  geoLon: number
  createdAt: string
  /** Append-only — origin records of every character minted by this account */
  characterCreatedLog: { characterId: string; seed: string; createdAt: string }[]
}

/**
 * Mint a new account cert.
 *
 * Asks geolocation, posts to /api/account/create. Server stamps the
 * datetime and runs `createSeedData(now, geo)` to produce the cert.
 * Persisted to IDB on success; the returned object is the same shape the
 * server stored.
 */
export async function createAccount(geo: { lat: number; lon: number }): Promise<AccountCert> {
  const res = await fetch('/api/account/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ geo }),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(`account create failed: ${msg}`)
  }
  const cert = (await res.json()) as AccountCert
  await idbPut<AccountCert>('accounts', cert)
  return cert
}

/**
 * Read the account cert from IDB. Returns null if no account has been
 * minted yet on this browser, or if running on the server.
 */
export async function loadAccount(): Promise<AccountCert | null> {
  if (typeof window === 'undefined') return null
  const all = await idbGetAll<AccountCert>('accounts')
  return all[0] ?? null
}

/**
 * Wipe the account store. Used for "sign out" / dev resets. Does NOT touch
 * the server row — the canonical account row stays for replay/audit.
 */
export async function clearAccount(): Promise<void> {
  await idbClear('accounts')
}

/**
 * Check the current geolocation permission state without triggering a
 * prompt. Returns 'granted' | 'prompt' | 'denied' | 'unsupported'.
 * Useful for surfacing why the prompt won't appear (e.g. previously denied
 * permanently for the site).
 */
export async function checkGeoPermission(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported'
  if (!navigator.permissions) return 'prompt'  // Permissions API unavailable; assume browser will prompt
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state as 'granted' | 'prompt' | 'denied'
  } catch {
    return 'prompt'
  }
}

/**
 * Geolocation prompt. Resolves to `{ lat, lon }` if the user grants
 * permission, rejects otherwise. Caller is responsible for the UX of
 * explaining why we need geo (it's the seed input — not for tracking).
 *
 * Distinguishes error codes:
 *   1 → PERMISSION_DENIED (user blocked, possibly via prior site setting)
 *   2 → POSITION_UNAVAILABLE (no GPS / no network locating)
 *   3 → TIMEOUT (browser took too long)
 */
export function requestGeolocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation_unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const codeName =
          err.code === 1 ? 'permission_denied' :
          err.code === 2 ? 'position_unavailable' :
          err.code === 3 ? 'timeout' :
          'unknown'
        const detail = err.message ? `: ${err.message}` : ''
        reject(new Error(`${codeName}${detail}`))
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: false },
    )
  })
}

/**
 * Dev-only / fallback path: mint an account using approximate coords
 * the user types in (or the page provides). Same math as
 * `createAccount({ lat, lon })`, just with the geo source differently
 * sourced. Useful when the browser's geolocation prompt is suppressed
 * (denied permanently, headless, no GPS, etc.).
 */
export async function createAccountManual(lat: number, lon: number): Promise<AccountCert> {
  return createAccount({ lat, lon })
}
