'use client'

/**
 * /onboarding/[token] — invite redemption.
 *
 * Player opens this URL from their DM's WhatsApp message:
 *   https://<host>/onboarding/<token>?campaign=<campaignId>
 *
 * Flow:
 *   1. Read token + campaignId from URL
 *   2. POST to /api/auth/enroll/verify (existing) to redeem the seeded cert
 *   3. Install the cert into IDB
 *   4. Redirect to /chargen with the token (chargen completes the player char cert)
 */

import * as React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, EmptyState } from '@/components/ui'
import { authFetch } from '@/lib/auth-fetch'

export default function OnboardingPage() {
  const params = useParams<{ token: string }>()
  const search = useSearchParams()
  const token = params?.token
  const campaignId = search?.get('campaign') ?? null

  const [status, setStatus] = React.useState<'idle' | 'redeeming' | 'ok' | 'error'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const redeem = React.useCallback(async () => {
    if (!token) return
    setStatus('redeeming')
    setError(null)
    try {
      const res = await authFetch('/api/auth/enroll/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, campaignId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `${res.status}`)
      }
      // Cert install + active-char wiring happens server-side; the
      // verify route writes the seeded cert into the user's account.
      setStatus('ok')
      // Hand off to the real /chargen route, carrying campaign + token
      // so the surface can attach the character to the right invite slot.
      const qs = new URLSearchParams()
      if (campaignId) qs.set('campaign', campaignId)
      if (token) qs.set('token', token)
      const url = `/chargen?${qs.toString()}`
      setTimeout(() => {
        window.location.href = url
      }, 600)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'redeem failed')
      setStatus('error')
    }
  }, [token, campaignId])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'var(--paper)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, margin: 0 }}>
            Joining the table
          </h1>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            invite token {token?.slice(0, 12)}…
          </div>
        </div>

        {status === 'idle' && (
          <Card title="Welcome">
            <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 0 }}>
              Your DM minted a cert for you and sent you this link. Tap below
              to install it into this browser, then we'll walk you through
              creating your character.
            </p>
            <button className="btn primary" onClick={redeem} style={{ width: '100%', padding: 12, fontSize: 15 }}>
              redeem invite →
            </button>
          </Card>
        )}

        {status === 'redeeming' && (
          <Card>
            <div style={{ color: 'var(--ink-3)', textAlign: 'center' }}>installing cert…</div>
          </Card>
        )}

        {status === 'ok' && (
          <Card>
            <div style={{ color: 'var(--accent-green)', textAlign: 'center', fontFamily: 'var(--serif)', fontSize: 15 }}>
              ✓ cert installed — opening character creation…
            </div>
          </Card>
        )}

        {status === 'error' && (
          <Card variant="danger">
            <EmptyState label="redeem failed" hint={error ?? 'unknown error'} />
            <button className="btn" onClick={redeem} style={{ marginTop: 8 }}>
              try again
            </button>
          </Card>
        )}
      </div>
    </div>
  )
}
