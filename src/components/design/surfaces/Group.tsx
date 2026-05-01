// @ts-nocheck
'use client'

import React from 'react'
import { EmptyState, FidelityBadge } from './_chips'
import { useWorld } from '@/lib/use-world'
import {
  addPartyMember,
  listPartyMembers,
  removePartyMember,
  buildInviteFromId,
  parseInviteString,
  checkPartyJoin,
  type PartyMember,
} from '@/lib/party'

// surfaces/Group.tsx — Party roster (peer-to-peer, IDB-driven).
//
// A party is a set of character cert hashes synced across each player's
// IDB. The server doesn't own this state — it just appends the bundles
// the DM-as-shard-host pushes during play. Joining = paste cert hash,
// add to your local roster. When two clients hold the same set of
// hashes, they're party-synced (railgun spectrum fans envelopes once
// the bridge ships).

export default function Group() {
  const world = useWorld()
  const cert = world.character

  const [members, setMembers] = React.useState<PartyMember[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [invite, setInvite] = React.useState('')
  const [alias, setAlias] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  const refresh = React.useCallback(async () => {
    try {
      setError(null)
      const r = await listPartyMembers()
      setMembers(r)
    } catch (e: any) {
      setError(e?.message ?? 'load_failed')
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const handleAdd = async () => {
    if (!cert) {
      setError('no_active_character')
      return
    }
    const certId = parseInviteString(invite)
    if (!certId) {
      setError('invalid_invite')
      return
    }
    if (certId === cert.id) {
      setError('cannot_add_self')
      return
    }
    // Compatibility against current roster + our own persona.
    const personas = (members ?? [])
      .map((m) => m.personaType)
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    personas.push(cert.personaType)
    // We don't yet know the joiner's persona without spectrum sync; the
    // local check enforces what we DO know. Future: pull persona from
    // spectrum envelope when the cert announces itself.
    const denial = checkPartyJoin(personas, cert.personaType)
    if (denial) {
      setError(denial)
      return
    }
    try {
      await addPartyMember(certId, alias.trim() || null)
      setInvite('')
      setAlias('')
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? 'add_failed')
    }
  }

  const handleRemove = async (certHash: string) => {
    try {
      await removePartyMember(certHash)
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? 'remove_failed')
    }
  }

  const handleCopyInvite = async () => {
    if (!cert) return
    const link = buildInviteFromId(cert.id)
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('clipboard_failed')
    }
  }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">05 · Shared · Party</div>
          <h2>Party <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">peer-to-peer · IDB roster</span>
      </div>

      <div className="aside" style={{marginBottom: 18, maxWidth: 720}}>
        ↳ a party is a set of character cert hashes you keep in your local roster.
        Paste a cert hash to add it; the other player adds yours; you're synced.
        DMless characters cannot party with DM-led ones (different time-flows).
        State syncs via DM-as-shard-host during sessions, then through the railgun
        spectrum once the bridge ships.
      </div>

      {error && (
        <div className="box" style={{borderColor:'var(--accent-red)', marginBottom: 12}}>
          <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>
        </div>
      )}

      {!cert ? (
        <div className="box">
          <EmptyState label="no active character" hint="log into a character via CharacterSelect — the cert is the join key." />
        </div>
      ) : (
        <>
          <div className="grid-2" style={{gap: 14, marginBottom: 18}}>
            <div className="box">
              <div className="box-title">
                <h3>Your invite</h3>
                <span className="meta">share this</span>
              </div>
              <div className="col" style={{gap: 8, marginTop: 8}}>
                <div className="tiny muted">PERSONA · <b>{cert.personaType}</b></div>
                <code style={{
                  fontSize: 11,
                  padding: '6px 10px',
                  background:'var(--paper-2)',
                  border:'1px solid var(--rule)',
                  wordBreak: 'break-all',
                  fontFamily: 'var(--mono)',
                }}>
                  {buildInviteFromId(cert.id)}
                </code>
                <button className="btn primary sm" onClick={handleCopyInvite}>
                  {copied ? '✓ copied' : 'copy invite'}
                </button>
              </div>
            </div>

            <div className="box">
              <div className="box-title">
                <h3>Add a member</h3>
                <span className="meta">paste cert hash</span>
              </div>
              <div className="col" style={{gap: 8, marginTop: 8}}>
                <input
                  className="input"
                  placeholder="claudedm-party:… or bare cert id"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="alias (optional)"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
                <button
                  className="btn primary sm"
                  onClick={handleAdd}
                  disabled={!invite.trim()}
                >
                  + add to roster
                </button>
                <div className="tiny muted">
                  Local-only: the other player must also add you on their end.
                  When sets match, you're synced (DM-host or spectrum routes envelopes).
                </div>
              </div>
            </div>
          </div>

          <div className="section-title">Roster · {members?.length ?? 0}</div>
          <div className="box" style={{marginBottom: 22}}>
            {!members ? (
              <div className="tiny muted">loading…</div>
            ) : members.length === 0 ? (
              <EmptyState
                label="no members"
                hint="paste another player's cert hash to start a party. Your own cert is implicit (you're always 'in' your own party of 1)."
              />
            ) : (
              <div className="col" style={{gap: 6, fontSize: 13}}>
                {members.map((m) => (
                  <div
                    key={m.certHash}
                    className="row"
                    style={{
                      justifyContent:'space-between',
                      alignItems:'center',
                      borderBottom:'1px dashed var(--rule-soft)',
                      paddingBottom: 4,
                    }}
                  >
                    <div>
                      <b>{m.alias ?? '(unnamed)'}</b>
                      {m.personaType && (
                        <span className="chip sm" style={{marginLeft: 6}}>{m.personaType}</span>
                      )}
                      <div className="tiny muted" style={{
                        fontFamily:'var(--mono)',
                        marginTop: 2,
                      }}>{m.certHash.slice(0, 16)}…</div>
                    </div>
                    <button
                      className="btn sm danger"
                      onClick={() => handleRemove(m.certHash)}
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Awaiting in-world wiring — these blocks bind to mm-party / mm-session
          once the DM-shard session push delivers full party state. */}
      <div className="grid-3">
        <div className="box">
          <div className="box-title"><h3>Party purse</h3><span className="meta">—</span></div>
          <EmptyState
            label="purse pending"
            hint="party-owned coin pool with audit trail. binds to mm-party.purse + ledger entries (DM-shard pushes the diff)."
          />
        </div>

        <div className="box">
          <div className="box-title"><h3>Party loot</h3><span className="meta">—</span></div>
          <EmptyState
            label="loot pending"
            hint="unclaimed items from recent encounters. binds to inventory rows owned by the party."
          />
        </div>

        <div className="box">
          <div className="box-title"><h3>Downtime</h3><span className="meta">—</span></div>
          <EmptyState
            label="downtime pending"
            hint="per-character downtime activities between sessions. binds to mm-adventure downtime + activity log."
          />
        </div>
      </div>

      <div className="section-title">Session intentions · what we&rsquo;re trying to do this session</div>
      <div className="box">
        <EmptyState
          label="no intentions"
          hint="any party member can propose; becomes group goal if threshold (e.g. 3/4) agrees. binds to mm-session.intentions."
        />
      </div>
    </div>
  )
}
