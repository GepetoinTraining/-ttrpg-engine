'use client'

/**
 * /onboarding/[token] — invite redemption.
 *
 * Player opens this URL from their DM's WhatsApp message:
 *   https://<host>/onboarding/<token>?campaign=<campaignId>
 *
 * Flow:
 *   1. Read token + campaignId from URL
 *   2. Geolocate the player — the seed input for the new IDB cert math
 *   3. Best-effort mark the legacy invite token consumed
 *   4. Mint account cert (Turso `accounts` + IDB `accounts`)
 *   5. Mint character cert with personaType='player' (Turso `character_certs`
 *      + IDB `characterCerts`) so DMHelperApp routes them into the Player
 *      workspace
 *   6. Pin the active character in IDB `sessionState`
 *   7. Hand off to /chargen with the new cert id so chargen attaches the
 *      character row on commit
 */

import * as React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, EmptyState } from '@/components/ui'
import { redeemInvite } from '@/lib/auth'
import { createAccount, requestGeolocation } from '@/lib/account-cert'
import { createCharacterCert, setActiveCharacter } from '@/lib/character-cert'

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
      // 1. Player geo — seed input. We need this BEFORE minting either cert.
      const geo = await requestGeolocation()

      // 2. Best-effort: mark the legacy invite token consumed and drop the
      //    legacy localStorage cert. If the token's already been used or is
      //    invalid we still proceed — the IDB certs are what matter for
      //    routing into the Player workspace.
      try {
        await redeemInvite(token)
      } catch {
        // non-fatal — token may already be consumed; new IDB flow doesn't
        // depend on it.
      }

      // 3. Mint the account cert. Writes the Turso row AND the IDB row.
      const account = await createAccount(geo)

      // 4. Mint the character cert with personaType='player' — FIXED at
      //    creation per project_cert_hierarchy.md. Without this the IDB
      //    `characterCerts` store stays empty and DMHelperApp falls back to
      //    the legacy persona default ('dm') → player lands on DM workspace.
      const charCert = await createCharacterCert({
        accountId: account.id,
        geo,
        personaType: 'player',
        characterDataId: null,
      })

      // 5. Pin the active session in IDB so DMHelperApp's
      //    getActiveCharacterCert() resolves immediately on the next route.
      await setActiveCharacter(account.id, charCert.id)

      setStatus('ok')

      // 6. Hand off to /chargen carrying the cert id so the chargen surface
      //    attaches the character row on commit.
      const qs = new URLSearchParams()
      qs.set('certId', charCert.id)
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
              creating your character. Your browser will ask for location —
              that's the seed input for your cert, not for tracking.
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
