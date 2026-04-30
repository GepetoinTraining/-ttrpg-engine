/**
 * Browser-side auth client.
 *
 * Stores the cert in localStorage, computes M^n trajectories locally,
 * and talks to the /api/auth/* route handlers.
 *
 * The trajectory math (computeTrajectory) is imported from the same module
 * the server uses — both sides MUST agree on the fingerprint format.
 */

import { computeTrajectory } from '@/auth/math/matrix'

export interface Certificate {
  id: string
  seed: string
  zeta: number
  issuedAt: number
}

const CERT_KEY = 'claudedm:cert'

// Same-tab event name — kept in sync with session-context.tsx so direct
// localStorage writers (Auth.tsx, redeemInvite) propagate to the React tree
// without requiring callers to know about the context.
const SAME_TAB_EVENT = 'claudedm:session-change'

function dispatchSessionChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SAME_TAB_EVENT))
}

// ── Cert storage (localStorage) ────────────────────────────────────────────

export function loadCert(): Certificate | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CERT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      typeof parsed?.id === 'string' &&
      typeof parsed?.seed === 'string' &&
      typeof parsed?.zeta === 'number' &&
      typeof parsed?.issuedAt === 'number'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function saveCert(cert: Certificate): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CERT_KEY, JSON.stringify(cert))
  dispatchSessionChange()
}

export function clearCert(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CERT_KEY)
  dispatchSessionChange()
}

// ── API calls ──────────────────────────────────────────────────────────────

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export interface RequestEnrollmentInput {
  requestedId: string
  geo: { lat: number; lon: number }
}

export async function requestEnrollment(input: RequestEnrollmentInput): Promise<{ token: string }> {
  return postJson('/api/auth/enroll/request', input)
}

export async function approveEnrollment(token: string): Promise<{ cert: Certificate }> {
  return postJson('/api/auth/enroll/approve', { token })
}

export async function fetchChallenge(userId: string): Promise<{ challengeId: string; n: number }> {
  return postJson('/api/auth/challenge', { userId })
}

export async function submitVerification(
  challengeId: string,
  trajectory: string
): Promise<{ valid: boolean; userId?: string }> {
  return postJson('/api/auth/verify', { challengeId, trajectory })
}

// ── End-to-end helpers ─────────────────────────────────────────────────────

/**
 * Run a full challenge / verify roundtrip using the locally stored cert.
 * Returns { valid: true, userId } if the server agrees the trajectory matches.
 */
export async function authenticate(cert: Certificate): Promise<{ valid: boolean; userId?: string }> {
  const { challengeId, n } = await fetchChallenge(cert.id)
  const trajectory = computeTrajectory(cert.zeta, n)
  return submitVerification(challengeId, trajectory)
}

/**
 * Exchange an invite token for a cert and persist it.
 */
export async function redeemInvite(token: string): Promise<Certificate> {
  const { cert } = await approveEnrollment(token)
  saveCert(cert)
  return cert
}
