// @ts-nocheck
'use client'

import React from 'react'
import {
  loadCert,
  saveCert,
  clearCert,
  authenticate,
  redeemInvite,
  type Certificate,
} from '@/lib/auth'
import {
  loadAccount,
  createAccount,
  createAccountManual,
  clearAccount,
  requestGeolocation,
  checkGeoPermission,
  type AccountCert,
} from '@/lib/account-cert'

// surfaces/Auth.tsx — Auth surface (browser-cert model), wired to /api/auth/*.
// Lifecycle:
//   1. URL has ?invite=TOKEN  → redeem token → save cert → unlocked
//   2. Cert in localStorage   → challenge/verify roundtrip → unlocked or mismatch
//   3. Otherwise              → uninvited
// The four design states (uninvited/pending/unlocked/mismatch) are still
// browsable via the chip picker below for design review.

type AuthState = 'uninvited' | 'pending' | 'unlocked' | 'mismatch'

export default function Auth() {
  const [liveState, setLiveState] = React.useState<AuthState>('pending')
  const [previewState, setPreviewState] = React.useState<AuthState | null>(null)
  const [cert, setCert] = React.useState<Certificate | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = React.useState(false)

  // New-flow state (account cert in IDB). Independent of the legacy AuthState
  // machine so the two paths can coexist while we migrate.
  const [account, setAccount] = React.useState<AccountCert | null>(null)
  const [accountChecked, setAccountChecked] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [geoPermission, setGeoPermission] = React.useState<'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown'>('unknown')
  const [showManualGeo, setShowManualGeo] = React.useState(false)
  const [manualLat, setManualLat] = React.useState('40.7128')   // NYC default for dev
  const [manualLon, setManualLon] = React.useState('-74.0060')

  const state: AuthState = previewState ?? liveState

  // ── New-flow boot: check IDB for an account cert first ───────────────────
  React.useEffect(() => {
    let cancelled = false
    loadAccount()
      .then((acc) => {
        if (cancelled) return
        setAccount(acc)
        setAccountChecked(true)
      })
      .catch(() => {
        if (cancelled) return
        setAccountChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Probe geolocation permission state on mount so the UI can warn early
  // if the prompt won't appear (e.g. permanently denied for the site).
  React.useEffect(() => {
    checkGeoPermission()
      .then((state) => setGeoPermission(state))
      .catch(() => setGeoPermission('unknown'))
  }, [])

  const handleCreateAccount = React.useCallback(async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const geo = await requestGeolocation()
      const acc = await createAccount(geo)
      setAccount(acc)
    } catch (e: any) {
      const msg = e?.message ?? 'create_failed'
      setCreateError(msg)
      // If the prompt was silently rejected (permission_denied or didn't
      // appear), surface the manual-geo fallback so the user can proceed.
      if (msg.startsWith('permission_denied') || msg.startsWith('timeout') || msg.startsWith('position_unavailable')) {
        setShowManualGeo(true)
      }
    } finally {
      setCreating(false)
    }
  }, [])

  const handleCreateAccountManual = React.useCallback(async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const lat = parseFloat(manualLat)
      const lon = parseFloat(manualLon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('invalid_coords')
      }
      const acc = await createAccountManual(lat, lon)
      setAccount(acc)
      setShowManualGeo(false)
    } catch (e: any) {
      setCreateError(e?.message ?? 'create_failed')
    } finally {
      setCreating(false)
    }
  }, [manualLat, manualLon])

  const handleAccountSignOut = React.useCallback(async () => {
    await clearAccount()
    setAccount(null)
    setCreateError(null)
  }, [])

  // ── Initial lifecycle ────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const url = new URL(window.location.href)
        const token = url.searchParams.get('invite')
        const campaignId = url.searchParams.get('campaign')
        if (token) {
          setLiveState('pending')
          try {
            const c = await redeemInvite(token)
            if (cancelled) return
            setCert(c)
            setLiveState('unlocked')
            url.searchParams.delete('invite')
            // Preserve ?campaign=... so PlayerOnboarding can pick it up.
            window.history.replaceState({}, '', url.toString())
            // New cert + campaign in URL → kick the player to onboarding.
            if (campaignId) {
              window.location.hash = 'onboarding'
            }
            return
          } catch (e: any) {
            if (cancelled) return
            setError(e?.message ?? 'invite token rejected')
            setLiveState('mismatch')
            return
          }
        }

        const stored = loadCert()
        if (!stored) {
          if (cancelled) return
          setLiveState('uninvited')
          return
        }
        setCert(stored)
        setLiveState('pending')
        try {
          const result = await authenticate(stored)
          if (cancelled) return
          if (result.valid) {
            setLiveState('unlocked')
          } else {
            setError('cert no longer valid on the server')
            clearCert()
            setCert(null)
            setLiveState('mismatch')
          }
        } catch (e: any) {
          if (cancelled) return
          setError(e?.message ?? 'verification failed')
          setLiveState('mismatch')
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'auth boot failed')
          setLiveState('mismatch')
        }
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    clearCert()
    setCert(null)
    setError(null)
    setLiveState('uninvited')
    setPreviewState(null)
  }

  const handlePasteToken = async (token: string) => {
    setError(null)
    setLiveState('pending')
    setPreviewState(null)
    try {
      const c = await redeemInvite(token.trim())
      setCert(c)
      setLiveState('unlocked')
      setPasteOpen(false)
    } catch (e: any) {
      setError(e?.message ?? 'token rejected')
      setLiveState('mismatch')
    }
  }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">01 · Identity — silent cert</div>
          <h2>Auth</h2>
        </div>
        <span className="who">no passwords ever ↗</span>
      </div>

      <p style={{ maxWidth: 740, color: 'var(--ink-2)', marginTop: 0 }}>
        Identity is a <b>browser certificate</b>. The DM seeds an invite for a player; the invite link
        installs a cert into <i>that</i> browser; from then on every visit is silently authenticated.
        No email/password, no magic links. Engine map: <span className="kbd">src/auth/seed.ts</span>{' '}
        → <span className="kbd">enroll.ts</span> → <span className="kbd">verify.ts</span>.
      </p>

      {/* Live banner */}
      <div className="row" style={{ gap: 10, marginTop: 10, alignItems: 'center' }}>
        <span className="tiny">LIVE STATE →</span>
        <span className={`chip ${liveStateChipClass(liveState)}`}>{labelFor(liveState)}</span>
        {previewState && (
          <span className="tiny muted">
            (previewing <b>{labelFor(previewState)}</b> ·{' '}
            <a style={{ cursor: 'pointer' }} onClick={() => setPreviewState(null)}>
              return to live
            </a>
            )
          </span>
        )}
        {error && (
          <span className="tiny" style={{ color: 'var(--accent-red)' }}>
            {error}
          </span>
        )}
      </div>

      {/* State picker — wireframe nav (preview only) */}
      <div className="row" style={{ gap: 8, marginTop: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <span className="tiny" style={{ alignSelf: 'center', marginRight: 4 }}>
          PREVIEW →
        </span>
        {([
          ['uninvited', 'Uninvited'],
          ['pending', 'Invite link · enrolling'],
          ['unlocked', 'Cert valid · auto-in'],
          ['mismatch', 'Wrong device / cert missing'],
        ] as const).map(([k, lbl]) => (
          <span
            key={k}
            className={`chip ${state === k ? 'solid' : ''}`}
            onClick={() => setPreviewState(k)}
            style={{ cursor: 'pointer' }}
          >
            {lbl}
          </span>
        ))}
      </div>

      {/* Center stage — the actual surface */}
      <div className="grid-3" style={{ gap: 18 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <div className="box" style={{ padding: '36px 44px', minHeight: 420, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, left: 16 }} className="tiny">
              claudedm.app · <span className="muted">no signup screen — by design</span>
            </div>

            {/* New-flow: account cert in IDB takes precedence over legacy states */}
            {accountChecked && account && !previewState && (
              <AuthAccountReady account={account} onSignOut={handleAccountSignOut} />
            )}
            {/* Legacy invite flow only shows when no IDB account (or when previewing) */}
            {(!account || previewState) && accountChecked && state === 'uninvited' && (
              <AuthUninvited
                onPasteInvite={() => setPasteOpen(true)}
                onStartCampaign={() => {
                  window.location.hash = 'onboarding'
                }}
                onCreateAccount={handleCreateAccount}
                onCreateAccountManual={handleCreateAccountManual}
                creating={creating}
                createError={createError}
                geoPermission={geoPermission}
                showManualGeo={showManualGeo}
                setShowManualGeo={setShowManualGeo}
                manualLat={manualLat}
                setManualLat={setManualLat}
                manualLon={manualLon}
                setManualLon={setManualLon}
              />
            )}
            {(!account || previewState) && state === 'pending' && <AuthPending />}
            {(!account || previewState) && state === 'unlocked' && <AuthUnlocked cert={cert} onSignOut={handleSignOut} />}
            {(!account || previewState) && state === 'mismatch' && (
              <AuthMismatch onPasteInvite={() => setPasteOpen(true)} />
            )}
          </div>
        </div>

        {/* Right rail — model + flow */}
        <div className="col">
          <div className="box filled">
            <div className="box-title">
              <h3>Threat model</h3>
              <span className="meta">simple</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
              <li>Cert = identity. Lose the browser, lose the cert.</li>
              <li>DM can re-issue (seed) at any time → old cert revoked.</li>
              <li>One cert per (player × campaign × device).</li>
              <li>Move device? DM re-seeds via QR → cert installs on new browser.</li>
            </ul>
            <div className="aside" style={{ marginTop: 10, fontSize: 16 }}>
              ↳ no passwords means no password support — beautiful.
            </div>
          </div>

          <div className="box dashed">
            <div className="box-title">
              <h3>Cert lifecycle</h3>
              <span className="meta">flow</span>
            </div>
            <ol style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.7 }}>
              <li>
                DM clicks <b>Invite</b> → <span className="kbd">seed.ts</span> mints token
              </li>
              <li>
                Player opens link once → <span className="kbd">enroll.ts</span> exchanges token for cert
              </li>
              <li>Cert stored in browser keystore (non-extractable)</li>
              <li>
                All later requests carry cert → <span className="kbd">verify.ts</span>
              </li>
              <li>
                Revocation: DM clicks "rotate" → token blacklist + force re-seed
              </li>
            </ol>
          </div>

          <div className="box">
            <div className="box-title">
              <h3>Edge cases</h3>
              <span className="meta">ux</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
              <li>Incognito → cert won't persist; warn explicitly</li>
              <li>
                Browser cleared → fall through to <i>mismatch</i> state
              </li>
              <li>Two browsers → DM sees both, can name them</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Below the fold — every state previewed */}
      <div className="section-title">All four states · at a glance</div>
      <div className="grid-4">
        {([
          ['uninvited', 'Uninvited', 'Empty room. The only door is an invite from a DM.'],
          ['pending', 'Enrolling', 'Player just opened invite link. Cert installing.'],
          ['unlocked', 'Auto-in', 'Cert valid. Slides directly into campaign.'],
          ['mismatch', 'Mismatch', 'Cert missing or doesn\'t match. Ask DM to re-seed.'],
        ] as const).map(([k, t, d]) => (
          <div
            key={k}
            className={`box ${state === k ? 'filled' : 'soft'}`}
            onClick={() => setPreviewState(k)}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>{t}</div>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              {d}
            </div>
          </div>
        ))}
      </div>

      {pasteOpen && <PasteTokenDialog onSubmit={handlePasteToken} onClose={() => setPasteOpen(false)} />}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function labelFor(s: AuthState): string {
  switch (s) {
    case 'uninvited':
      return 'Uninvited'
    case 'pending':
      return 'Enrolling'
    case 'unlocked':
      return 'Unlocked'
    case 'mismatch':
      return 'Mismatch'
  }
}

function liveStateChipClass(s: AuthState): string {
  switch (s) {
    case 'unlocked':
      return 'green solid'
    case 'mismatch':
      return 'red solid'
    case 'pending':
      return 'blue solid'
    default:
      return ''
  }
}

// ── State subviews ─────────────────────────────────────────────────────────

function AuthUninvited({
  onPasteInvite,
  onStartCampaign,
  onCreateAccount,
  onCreateAccountManual,
  creating,
  createError,
  geoPermission,
  showManualGeo,
  setShowManualGeo,
  manualLat,
  setManualLat,
  manualLon,
  setManualLon,
}: {
  onPasteInvite: () => void
  onStartCampaign: () => void
  onCreateAccount: () => void
  onCreateAccountManual: () => void
  creating: boolean
  createError: string | null
  geoPermission: 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown'
  showManualGeo: boolean
  setShowManualGeo: (b: boolean) => void
  manualLat: string
  setManualLat: (s: string) => void
  manualLon: string
  setManualLon: (s: string) => void
}) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 30 }}>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 38,
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        Claude DM
      </div>
      <div className="hand" style={{ fontSize: 22, marginTop: 4 }}>
        spacetime is your password ↘
      </div>

      <div style={{ marginTop: 32, maxWidth: 480, margin: '32px auto 0' }}>
        <div className="box filled" style={{ textAlign: 'left', padding: '18px 20px' }}>
          <div className="box-title">
            <h3>Create your account</h3>
            <span className="meta">geo + datetime</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 4, color: 'var(--ink-2)' }}>
            Your identity is the moment you click below — your <b>geolocation</b> and
            the <b>server's clock</b> hash into a unique seed. We don't take an email,
            we don't take a password. We don't track you — we only need the moment
            to mint a cert that lives in this browser.
          </p>
          <button
            className="btn primary"
            disabled={creating}
            onClick={onCreateAccount}
            style={{ marginTop: 10, width: '100%' }}
          >
            {creating ? '… requesting geolocation' : '✦ create my account'}
          </button>

          {/* Permission state hint */}
          <div className="tiny muted" style={{ marginTop: 8 }}>
            {geoPermission === 'denied' && (
              <span style={{ color: 'var(--accent-red)' }}>
                ⚠ geolocation is BLOCKED for this site. Click the lock/info icon in the URL bar →
                Location → Allow, then reload. Or use manual entry below.
              </span>
            )}
            {geoPermission === 'unsupported' && (
              <span style={{ color: 'var(--accent-red)' }}>
                ⚠ this browser doesn't support geolocation. Use manual entry below.
              </span>
            )}
            {geoPermission === 'granted' && (
              <span>
                ✓ geolocation already granted — minting will be instant.
              </span>
            )}
            {(geoPermission === 'prompt' || geoPermission === 'unknown') && (
              <span>
                your browser will prompt for location access — we use it once, never again.
              </span>
            )}
          </div>

          {createError && (
            <div className="tiny" style={{ color: 'var(--accent-red)', marginTop: 8 }}>
              create failed: {createError}
            </div>
          )}

          {/* Manual fallback toggle */}
          <div style={{ marginTop: 10 }}>
            <a
              className="tiny"
              onClick={() => setShowManualGeo(!showManualGeo)}
              style={{ cursor: 'pointer', color: 'var(--ink-2)' }}
            >
              {showManualGeo ? '↑ hide manual entry' : '↓ enter coordinates manually (dev / fallback)'}
            </a>
          </div>

          {showManualGeo && (
            <div className="box dashed" style={{ marginTop: 8, padding: 10 }}>
              <div className="tiny muted" style={{ marginBottom: 6 }}>
                Any lat/lon will mint an account — they're just seed inputs, not tracked.
              </div>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <label className="tiny" style={{ flex: 1 }}>
                  lat
                  <input
                    type="text"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 12 }}
                  />
                </label>
                <label className="tiny" style={{ flex: 1 }}>
                  lon
                  <input
                    type="text"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 12 }}
                  />
                </label>
                <button
                  className="btn sm primary"
                  disabled={creating}
                  onClick={onCreateAccountManual}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {creating ? '...' : 'mint →'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 18 }}>
          <button className="btn" onClick={onStartCampaign}>
            i'm a DM · start a campaign
          </button>
          <button className="btn" onClick={onPasteInvite}>
            i have an invite link
          </button>
        </div>
        <div className="tiny muted" style={{ marginTop: 12 }}>
          legacy invite flow stays for existing tables · the new account flow is the future
        </div>
      </div>
    </div>
  )
}

function AuthAccountReady({
  account,
  onSignOut,
}: {
  account: AccountCert
  onSignOut: () => void
}) {
  const issued = new Date(account.createdAt)
  const idShort = `${account.id.slice(0, 8)}…${account.id.slice(-2)}`
  const seedShort = `${account.seed.slice(0, 12)}…`
  return (
    <div style={{ textAlign: 'center', paddingTop: 14 }}>
      <div className="tiny">
        ACCOUNT MINTED · {idShort} · ζ {account.zeta.toFixed(8)}
      </div>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 32,
          fontWeight: 600,
          marginTop: 10,
          letterSpacing: '-0.015em',
        }}
      >
        You exist now.
      </div>
      <div className="hand blue" style={{ fontSize: 22, marginTop: 4 }}>
        spacetime locked ↘
      </div>

      <div style={{ maxWidth: 480, margin: '24px auto 0' }}>
        <div className="box" style={{ textAlign: 'left' }}>
          <div className="box-title">
            <h3>Account cert</h3>
            <span className="meta">stored locally · IDB</span>
          </div>
          <div className="tiny" style={{ marginTop: 6, fontFamily: 'var(--mono)', lineHeight: 1.7 }}>
            id: {account.id}<br />
            seed: {seedShort}<br />
            ζ: {account.zeta.toFixed(10)}<br />
            primes: {account.primes.length} factors<br />
            geo: {account.geoLat.toFixed(4)}, {account.geoLon.toFixed(4)}<br />
            minted: {issued.toLocaleString()}
          </div>
          <hr className="rule dashed" style={{ marginTop: 12 }} />
          <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="tiny muted">
              characters minted: <b>{account.characterCreatedLog.length}</b>
            </div>
            <button
              className="btn primary"
              onClick={() => {
                window.location.hash = 'character-select'
              }}
            >
              {account.characterCreatedLog.length === 0
                ? 'create your first character →'
                : 'pick a character →'}
            </button>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, fontSize: 13 }}>
          <div className="muted">
            <span className="dot green" /> this device · keystore: IndexedDB
          </div>
          <a
            className="tiny"
            style={{ color: 'var(--ink-2)', cursor: 'pointer' }}
            onClick={onSignOut}
          >
            sign out · clear local account
          </a>
        </div>
      </div>
    </div>
  )
}

function AuthPending() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 22 }}>
      <div className="tiny">VERIFYING CERT · talking to /api/auth</div>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 28,
          fontWeight: 600,
          marginTop: 8,
          letterSpacing: '-0.01em',
        }}
      >
        Welcome back…
      </div>
      <div style={{ color: 'var(--ink-2)', marginTop: 4 }}>Running challenge / verify…</div>

      <div
        style={{
          marginTop: 28,
          maxWidth: 380,
          margin: '28px auto 0',
          textAlign: 'left',
        }}
      >
        {[
          { l: 'load cert from keystore', d: 'localStorage' },
          { l: 'fetch challenge', d: 'POST /api/auth/challenge' },
          { l: 'compute M^n trajectory', d: 'matrix.ts' },
          { l: 'verify with server', d: 'POST /api/auth/verify' },
        ].map((s, i) => (
          <div
            key={s.l}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: '1px dashed var(--rule-soft)',
            }}
          >
            <span className="kbd" style={{ minWidth: 22, textAlign: 'center' }}>
              {i < 3 ? '✓' : '…'}
            </span>
            <span style={{ flex: 1, fontFamily: 'var(--serif)', fontSize: 14 }}>{s.l}</span>
            <span className="tiny muted">{s.d}</span>
          </div>
        ))}
      </div>

      <div className="bar blue" style={{ maxWidth: 380, margin: '20px auto 0' }}>
        <span style={{ width: '78%' }} />
      </div>
      <div className="tiny muted" style={{ marginTop: 8 }}>
        do not close this tab
      </div>
      <div
        className="aside blue"
        style={{ maxWidth: 380, margin: '20px auto 0', fontSize: 16, textAlign: 'left' }}
      >
        ↳ this is the <b>only</b> moment auth ever takes the user's attention. every visit after this is silent.
      </div>
    </div>
  )
}

function AuthUnlocked({
  cert,
  onSignOut,
}: {
  cert: Certificate | null
  onSignOut: () => void
}) {
  const issued = cert ? new Date(cert.issuedAt) : null
  const idShort = cert ? `${cert.id.slice(0, 8)}…${cert.id.slice(-2)}` : 'demo · sha-256 a8…7c'
  return (
    <div style={{ textAlign: 'center', paddingTop: 14 }}>
      <div className="tiny">
        CERT VALID · {idShort}{' '}
        {issued ? `· issued ${issued.toLocaleDateString()}` : '· demo cert'}
      </div>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 32,
          fontWeight: 600,
          marginTop: 10,
          letterSpacing: '-0.015em',
        }}
      >
        Welcome back.
      </div>
      <div className="hand blue" style={{ fontSize: 22, marginTop: 4 }}>
        auto-signed-in ↘
      </div>

      <div style={{ maxWidth: 480, margin: '24px auto 0' }}>
        <div className="box" style={{ textAlign: 'left' }}>
          <div className="box-title">
            <h3>Your campaigns</h3>
            <span className="meta">no campaigns yet · placeholder</span>
          </div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            Once campaign creation is wired (12 · Onboarding), the campaign list lands here.
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button
              className="btn primary"
              onClick={() => {
                window.location.hash = 'dm'
              }}
            >
              go to DM Console →
            </button>
            <button
              className="btn"
              onClick={() => {
                window.location.hash = 'sheet'
              }}
            >
              view sheet
            </button>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, fontSize: 13 }}>
          <div className="muted">
            <span className="dot green" /> this device · keystore: localStorage
          </div>
          <a
            className="tiny"
            style={{ color: 'var(--ink-2)', cursor: 'pointer' }}
            onClick={onSignOut}
          >
            sign out · revoke cert
          </a>
        </div>

        {cert && (
          <details style={{ marginTop: 14 }}>
            <summary className="tiny muted" style={{ cursor: 'pointer' }}>
              cert details
            </summary>
            <div className="tiny" style={{ marginTop: 8, fontFamily: 'var(--mono)' }}>
              id: {cert.id}
              <br />
              seed: {cert.seed}
              <br />
              ζ: {cert.zeta.toFixed(10)}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function AuthMismatch({ onPasteInvite }: { onPasteInvite: () => void }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 30 }}>
      <div className="tiny" style={{ color: 'var(--accent-red)' }}>
        NO VALID CERT · this browser doesn't recognize you
      </div>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 28,
          fontWeight: 600,
          marginTop: 10,
          letterSpacing: '-0.01em',
        }}
      >
        We don't know this browser yet.
      </div>
      <div
        style={{
          color: 'var(--ink-2)',
          marginTop: 6,
          maxWidth: 460,
          margin: '6px auto 0',
        }}
      >
        Maybe you're on a new device, or your browser cleared its keystore. Either way — the DM has
        to re-seed you.
      </div>

      <div style={{ maxWidth: 460, margin: '26px auto 0', textAlign: 'left' }}>
        <div className="box dashed">
          <div className="box-title">
            <h3>Re-seed flow</h3>
            <span className="meta">2 steps</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.7 }}>
            <li>
              Ping your DM (one tap). They see <i>"new device pending"</i>.
            </li>
            <li>DM seeds an invite. Paste the link or token here.</li>
          </ol>
        </div>

        <div className="row" style={{ gap: 14, marginTop: 14, alignItems: 'center' }}>
          <div className="placeholder" style={{ width: 130, height: 130, padding: 0 }}>
            QR · pairing code
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat">
              <b>Pairing code:</b> 4F9C-2E1B-77A0
            </div>
            <div className="tiny muted" style={{ marginTop: 6 }}>
              expires in 3 minutes
            </div>
            <div className="row" style={{ gap: 6, marginTop: 12 }}>
              <button className="btn primary" disabled>
                ping DM
              </button>
              <button className="btn" onClick={onPasteInvite}>
                paste invite link
              </button>
            </div>
          </div>
        </div>

        <div className="aside" style={{ marginTop: 14, fontSize: 16 }}>
          ↳ everything else stays — sheet, allies, whisper history. this just binds a new browser to{' '}
          <i>you</i>.
        </div>
      </div>
    </div>
  )
}

// ── Paste-token dialog ─────────────────────────────────────────────────────

function PasteTokenDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (token: string) => void
  onClose: () => void
}) {
  const [val, setVal] = React.useState('')
  const extractToken = (raw: string): string => {
    try {
      // Accept full URLs like https://.../?invite=TOKEN
      const url = new URL(raw)
      const t = url.searchParams.get('invite')
      if (t) return t
    } catch {}
    return raw
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,16,10,0.45)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="box"
        style={{ width: 460, background: 'var(--paper)', padding: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="box-title">
          <h3>Paste invite link or token</h3>
          <span className="meta">redeem once</span>
        </div>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="https://claudedm.app/?invite=… or just the token"
          style={{
            width: '100%',
            padding: '10px 12px',
            marginTop: 10,
            fontFamily: 'var(--mono)',
            fontSize: 13,
            border: '1px solid var(--rule-soft)',
            borderRadius: 6,
            background: 'var(--paper-2)',
          }}
        />
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose}>
            cancel
          </button>
          <button
            className="btn primary"
            disabled={!val.trim()}
            onClick={() => onSubmit(extractToken(val))}
          >
            redeem →
          </button>
        </div>
      </div>
    </div>
  )
}
