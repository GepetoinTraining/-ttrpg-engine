/**
 * Browser-side fetch with cert-bearer auth.
 *
 * `authFetch(url, init)` is a drop-in for `fetch()` that:
 *   - Loads the active account cert from IDB (one-shot, cheap).
 *   - Attaches `Authorization: Bearer <accountId>:<seed>` if an account exists.
 *   - Falls back to plain fetch (no header) if no account.
 *
 * Use this for ALL `/api/*` calls in browser code — public routes ignore the
 * header (per `src/middleware.ts` allowlist) and protected routes require it.
 *
 * Pre-mint flows that LITERALLY have no account yet (e.g. `/api/account/create`
 * itself) can use plain `fetch` since the middleware allows them.
 */

import { loadAccount } from './account-cert'

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const account = typeof window !== 'undefined' ? await loadAccount() : null
  const headers = new Headers(init?.headers)
  if (account && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${account.id}:${account.seed}`)
  }
  return fetch(input, { ...init, headers })
}
