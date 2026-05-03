'use client'

/**
 * Landing — the root route.
 *
 * Routing dispatch:
 *   no account cert         → mint DM cert / redeem invite explainer
 *   account + active player → quick "open my character" → /play
 *   account + active dm/gm  → quick "open DM table" → /dm
 *   always                  → DM+AI / DMless mode buttons (mint cert + go)
 *
 * Wireframe is preserved at /wireframe.
 */

import * as React from 'react'
import { loadAccount, createAccount, type AccountCert } from '@/lib/account-cert'
import {
  getActiveCharacterCert,
  createCharacterCert,
  setActiveCharacter,
  listCharacterCerts,
  type CharacterCert,
  type PersonaType,
} from '@/lib/character-cert'
import { Card } from '@/components/ui'

export default function Landing() {
  const [account, setAccount] = React.useState<AccountCert | null>(null)
  const [activeChar, setActiveChar] = React.useState<CharacterCert | null>(null)
  const [allChars, setAllChars] = React.useState<CharacterCert[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    ;(async () => {
      try {
        const a = await loadAccount().catch(() => null)
        if (!a) {
          setLoading(false)
          return
        }
        setAccount(a)
        const [active, list] = await Promise.all([
          getActiveCharacterCert().catch(() => null),
          listCharacterCerts(a.id).catch(() => []),
        ])
        setActiveChar(active)
        setAllChars(list)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleMintAccount = async () => {
    setBusy('mint-account')
    setError(null)
    try {
      const geo = await captureGeo()
      const a = await createAccount({ lat: geo.lat, lon: geo.lon })
      setAccount(a)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'cert mint failed')
    } finally {
      setBusy(null)
    }
  }

  const handlePickMode = async (persona: PersonaType, redirect: string) => {
    if (!account) return
    setBusy(`mode-${persona}`)
    setError(null)
    try {
      // Reuse an existing char cert with this persona if one exists; else mint a fresh one.
      const existing = allChars.find((c) => c.personaType === persona)
      const cert =
        existing ??
        (await createCharacterCert({
          accountId: account.id,
          geo: await captureGeo(),
          personaType: persona,
        }))
      await setActiveCharacter(account.id, cert.id)
      window.location.href = redirect
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'mode pick failed')
      setBusy(null)
    }
  }

  const personaPath: Record<PersonaType, string> = {
    player: '/play',
    dm: '/dm',
    'gm-ai': '/play',
    dmless: '/play',
  }
  const personaLabel: Record<PersonaType, string> = {
    player: 'open my character',
    dm: 'open DM table',
    'gm-ai': 'open solo + AI',
    dmless: 'open DMless',
  }

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
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Claude DM
          </h1>
          <div
            style={{
              fontFamily: 'var(--hand)',
              color: 'var(--accent-red)',
              fontSize: 22,
              transform: 'rotate(-1.5deg)',
              marginTop: 2,
            }}
          >
            centaur table · math-first · v0.1
          </div>
        </div>

        {loading && (
          <Card><div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>checking cert…</div></Card>
        )}

        {/* No account cert at all */}
        {!loading && !account && (
          <Card title="No cert on this device">
            <p style={{ color: 'var(--ink-2)', fontSize: 14, marginTop: 0 }}>
              You're either <b>joining an existing table</b> (open the invite
              link your DM sent) or <b>minting a fresh DM cert</b> to host one.
            </p>
            <button
              className="btn primary"
              onClick={handleMintAccount}
              disabled={busy === 'mint-account'}
              style={{ width: '100%', padding: 12, fontSize: 15, marginTop: 8 }}
            >
              {busy === 'mint-account' ? 'minting cert…' : '◆ Mint DM cert'}
            </button>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: 'var(--ink-3)',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              or open the invite link from your DM (WhatsApp, etc.)
            </div>
            {error && (
              <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--mono)', fontSize: 12, marginTop: 8 }}>
                {error}
              </div>
            )}
          </Card>
        )}

        {/* Active character resume */}
        {!loading && account && activeChar && (
          <Card
            title="Resume"
            meta={`${activeChar.personaType} · ${activeChar.id.slice(0, 8)}…`}
          >
            <a
              href={personaPath[activeChar.personaType]}
              className="btn primary"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: 12, fontSize: 15 }}
            >
              {personaLabel[activeChar.personaType]} →
            </a>
          </Card>
        )}

        {/* Mode chooser (always visible when account exists) */}
        {!loading && account && (
          <Card title="Pick a mode" meta={`account ${account.id.slice(0, 8)}…`}>
            <p style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 0 }}>
              {activeChar ? 'Or start something different:' : 'How do you want to play?'}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                gap: 10,
                marginTop: 8,
              }}
            >
              <button
                className="btn primary"
                onClick={() => handlePickMode('dm', '/dm')}
                disabled={busy !== null}
                style={{ padding: 14, fontFamily: 'var(--serif)', fontSize: 16 }}
              >
                ◆ DM + AI
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    letterSpacing: '0.06em',
                    marginTop: 4,
                    opacity: 0.7,
                    textTransform: 'uppercase',
                  }}
                >
                  host a table
                </div>
              </button>
              <button
                className="btn"
                onClick={() => handlePickMode('dmless', '/play')}
                disabled={busy !== null}
                style={{ padding: 14, fontFamily: 'var(--serif)', fontSize: 16 }}
              >
                ○ DMless
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    letterSpacing: '0.06em',
                    marginTop: 4,
                    opacity: 0.7,
                    textTransform: 'uppercase',
                  }}
                >
                  solo · clockwork
                </div>
              </button>
            </div>
            {busy?.startsWith('mode-') && (
              <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                minting {busy.replace('mode-', '')} cert…
              </div>
            )}
            {error && (
              <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--mono)', fontSize: 12, marginTop: 8 }}>
                {error}
              </div>
            )}
          </Card>
        )}

        {/* Other characters on this device */}
        {!loading && account && allChars.length > 1 && (
          <Card title="Other characters on this device" variant="soft">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allChars
                .filter((c) => c.id !== activeChar?.id)
                .map((c) => (
                  <button
                    key={c.id}
                    className="btn sm"
                    onClick={async () => {
                      await setActiveCharacter(account.id, c.id)
                      window.location.href = personaPath[c.personaType]
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                    }}
                  >
                    <span>{c.personaType} · {c.id.slice(0, 8)}…</span>
                    <span className="tiny" style={{ color: 'var(--ink-3)' }}>switch →</span>
                  </button>
                ))}
            </div>
          </Card>
        )}

        {!loading && (
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            wireframe →{' '}
            <a href="/wireframe" style={{ color: 'inherit' }}>/wireframe</a>
          </div>
        )}
      </div>
    </div>
  )
}

async function captureGeo(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: 0, lon: 0 })
      return
    }
    const t = setTimeout(() => resolve({ lat: 0, lon: 0 }), 5000)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(t)
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude })
      },
      () => {
        clearTimeout(t)
        resolve({ lat: 0, lon: 0 })
      },
      { timeout: 4500 },
    )
  })
}
