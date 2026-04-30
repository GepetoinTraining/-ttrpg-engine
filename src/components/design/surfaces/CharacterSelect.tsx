// @ts-nocheck
'use client'

import React from 'react'
import {
  loadAccount,
  type AccountCert,
} from '@/lib/account-cert'
import {
  listCharacterCerts,
  createCharacterCert,
  deleteCharacterCert,
  setActiveCharacter,
  type CharacterCert,
  type PersonaType,
} from '@/lib/character-cert'

// surfaces/CharacterSelect.tsx — picks which character cert to log into the
// world as. Per `project_cert_hierarchy.md`:
//   - Persona is FIXED at character cert creation, never user-toggled later
//   - One active character at a time (deterministic dual-sig signing chain)
//   - Empty state offers persona picker → mints a stub cert (chargen
//     attaches the character data row in a later flow)

const PERSONA_OPTIONS: {
  type: PersonaType
  label: string
  blurb: string
  timeFlow: string
}[] = [
  {
    type: 'player',
    label: 'Player · with a human DM',
    blurb: "You'll join a table where another person runs the world.",
    timeFlow: 'session time',
  },
  {
    type: 'gm-ai',
    label: 'Solo · AI as your DM',
    blurb: 'AI weaves a personal story for you. Pause and resume on your schedule.',
    timeFlow: 'session time',
  },
  {
    type: 'dm',
    label: "DM · running someone's table",
    blurb: 'You see the world as god — transport powers, NPC orchestration, the full clockwork.',
    timeFlow: 'session time',
  },
  {
    type: 'dmless',
    label: 'DMless · pure clockwork',
    blurb: "No DM, no AI. The world ticks autonomously, you live in real time. Can't fast-travel.",
    timeFlow: 'server time',
  },
]

const PERSONA_GLYPH: Record<PersonaType, string> = {
  player: '🛡',
  'gm-ai': '✦',
  dm: '◉',
  dmless: '∞',
}

export default function CharacterSelect() {
  const [account, setAccount] = React.useState<AccountCert | null>(null)
  const [characters, setCharacters] = React.useState<CharacterCert[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState<PersonaType | null>(null)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [pickingPersona, setPickingPersona] = React.useState(false)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const acc = await loadAccount()
      setAccount(acc)
      if (acc) {
        const certs = await listCharacterCerts(acc.id)
        setCharacters(certs)
      } else {
        setCharacters([])
      }
    } catch (e: any) {
      setCreateError(e?.message ?? 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = React.useCallback(
    async (personaType: PersonaType) => {
      if (!account) {
        setCreateError('account_missing')
        return
      }
      setCreating(personaType)
      setCreateError(null)
      try {
        // Re-use the account's geo for the character cert math. Pedro's
        // "circularize a second time" — same geo, server stamps a fresh
        // datetime, produces a new seed/zeta.
        const cert = await createCharacterCert({
          accountId: account.id,
          geo: { lat: account.geoLat, lon: account.geoLon },
          personaType,
          characterDataId: null, // chargen attaches via attachCharacterData on commit
        })
        setCharacters((prev) => [...prev, cert])
        setPickingPersona(false)

        // Route to chargen with the new cert id — chargen reads `?certId=X`
        // from the hash and binds the character row on commit.
        if (typeof window !== 'undefined') {
          window.location.hash = `chargen?certId=${encodeURIComponent(cert.id)}`
        }
      } catch (e: any) {
        setCreateError(e?.message ?? 'create_failed')
      } finally {
        setCreating(null)
      }
    },
    [account],
  )

  const handleLogIn = React.useCallback(
    async (cert: CharacterCert) => {
      if (!account) return
      if (!cert.characterDataId) {
        setCreateError('character has no sheet — complete chargen first')
        return
      }
      try {
        await setActiveCharacter(account.id, cert.id)
        // Route to the live world dashboard (Slice 4). It hosts the grid
        // viewport, drawers, and action bar — the canonical play surface.
        if (typeof window !== 'undefined') {
          window.location.hash = 'world'
        }
      } catch (e: any) {
        setCreateError(e?.message ?? 'login_failed')
      }
    },
    [account],
  )

  const handleDelete = React.useCallback(async (certId: string) => {
    await deleteCharacterCert(certId)
    setCharacters((prev) => prev.filter((c) => c.id !== certId))
  }, [])

  if (loading) {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">46 · Characters · pick a cert</div>
            <h2>Character select</h2>
          </div>
        </div>
        <p style={{ color: 'var(--ink-2)' }}>… loading from IDB</p>
      </div>
    )
  }

  if (!account) {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">46 · Characters · no account</div>
            <h2>Character select</h2>
          </div>
        </div>
        <div className="box dashed" style={{ marginTop: 18, maxWidth: 520 }}>
          <p>No account cert in this browser. Mint one first.</p>
          <button
            className="btn primary"
            onClick={() => {
              window.location.hash = 'auth'
            }}
          >
            ← go to Auth
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">46 · Characters · pick a cert</div>
          <h2>Your characters</h2>
        </div>
        <span className="who">{characters.length} cert{characters.length === 1 ? '' : 's'}</span>
      </div>

      <p style={{ maxWidth: 720, color: 'var(--ink-2)', marginTop: 0 }}>
        Each character is its own cert, tied to your account ({account.id.slice(0, 8)}…).
        Persona is locked at creation — you can't toggle a player into a DM later.
        Pick one to log into the world, or mint a new one.
      </p>

      {createError && (
        <div className="aside" style={{ color: 'var(--accent-red)', marginTop: 8 }}>
          {createError}
        </div>
      )}

      {/* ── Existing characters ── */}
      <div className="grid-3" style={{ gap: 14, marginTop: 18 }}>
        {characters.length === 0 && !pickingPersona && (
          <div className="box dashed" style={{ gridColumn: 'span 2', textAlign: 'center', padding: 36 }}>
            <div className="hand" style={{ fontSize: 22 }}>no characters yet ↘</div>
            <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>
              Mint your first character cert to enter the world.
            </p>
            <button
              className="btn primary"
              onClick={() => setPickingPersona(true)}
              style={{ marginTop: 8 }}
            >
              ✦ create your first character
            </button>
          </div>
        )}

        {characters.map((cert) => (
          <div key={cert.id} className="box">
            <div className="box-title">
              <h3>
                {PERSONA_GLYPH[cert.personaType]} {cert.characterDataId ? '(named)' : 'unnamed'}
              </h3>
              <span className="meta">{cert.personaType}</span>
            </div>
            <div
              className="tiny"
              style={{ marginTop: 4, fontFamily: 'var(--mono)', lineHeight: 1.6 }}
            >
              id: {cert.id.slice(0, 12)}…<br />
              ζ: {cert.zeta.toFixed(8)}<br />
              minted: {new Date(cert.createdAt).toLocaleDateString()}
              {cert.ownerChain.length > 1 && (
                <>
                  <br />
                  owners: {cert.ownerChain.length} (traded)
                </>
              )}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 12, justifyContent: 'space-between' }}>
              <button className="btn primary" onClick={() => handleLogIn(cert)}>
                log into world →
              </button>
              <button
                className="btn"
                onClick={() => handleDelete(cert.id)}
                style={{ color: 'var(--accent-red)' }}
              >
                forget
              </button>
            </div>
            {!cert.characterDataId && (
              <div style={{ marginTop: 8 }}>
                <div className="tiny muted" style={{ marginBottom: 6 }}>
                  no character sheet attached yet
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    window.location.hash = `chargen?certId=${encodeURIComponent(cert.id)}`
                  }}
                >
                  complete chargen →
                </button>
              </div>
            )}
          </div>
        ))}

        {characters.length > 0 && !pickingPersona && (
          <div
            className="box dashed"
            style={{ textAlign: 'center', padding: 24, cursor: 'pointer' }}
            onClick={() => setPickingPersona(true)}
          >
            <div style={{ fontSize: 38, color: 'var(--ink-3)' }}>+</div>
            <div className="tiny muted" style={{ marginTop: 6 }}>
              mint another character
            </div>
          </div>
        )}
      </div>

      {/* ── Persona picker (modal-ish inline) ── */}
      {pickingPersona && (
        <div className="box filled" style={{ marginTop: 24 }}>
          <div className="box-title">
            <h3>Pick a persona</h3>
            <span className="meta">fixed at creation</span>
          </div>
          <p className="tiny" style={{ marginTop: 4, color: 'var(--ink-2)' }}>
            This determines the time-flow your character lives in. DM-led personas
            run on session time (your DM controls advancement). DMless lives on
            server time — autonomous world ticks, no fast-travel.
          </p>
          <div className="grid-3" style={{ gap: 12, marginTop: 12 }}>
            {PERSONA_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                className="box"
                onClick={() => handleCreate(opt.type)}
                disabled={creating !== null}
                style={{
                  textAlign: 'left',
                  cursor: creating === null ? 'pointer' : 'wait',
                  border:
                    creating === opt.type
                      ? '2px solid var(--accent-blue)'
                      : '1px solid var(--rule)',
                  background: 'var(--paper)',
                }}
              >
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
                  {PERSONA_GLYPH[opt.type]} {opt.label}
                </div>
                <div className="tiny" style={{ marginTop: 4, color: 'var(--ink-2)' }}>
                  {opt.blurb}
                </div>
                <div
                  className="tiny muted"
                  style={{ marginTop: 8, fontFamily: 'var(--mono)' }}
                >
                  time-flow: {opt.timeFlow}
                </div>
                {creating === opt.type && (
                  <div className="tiny" style={{ color: 'var(--accent-blue)', marginTop: 6 }}>
                    … minting cert
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              className="btn"
              onClick={() => {
                setPickingPersona(false)
                setCreateError(null)
              }}
              disabled={creating !== null}
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
