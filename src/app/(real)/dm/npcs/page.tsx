'use client'

/**
 * /dm/npcs — NPC Manager.
 *
 * Lists DM-owned characters whose cert persona is 'gm-ai' (Pedro's "everyone
 * is an NPC; some have human handlers" — gm-ai = AI handler). Creates new
 * NPCs via a condensed inline form (full chargen lives at /chargen for
 * player characters; NPCs use a faster path).
 *
 * Click an NPC card → opens its sheet at /dm/party/[id] (shared view).
 *
 * Follower assignment + bond shifts are deferred to next conversation
 * (need a /api/companion/create endpoint + UI to pick a PC owner).
 */

import * as React from 'react'
import {
  Card,
  CharacterCard,
  EmptyState,
  type CharacterCardData,
} from '@/components/ui'
import { loadAccount, type AccountCert } from '@/lib/account-cert'
import {
  listCharacterCerts,
  createCharacterCert,
  attachCharacterData,
  type CharacterCert,
} from '@/lib/character-cert'
import { authFetch } from '@/lib/auth-fetch'
import { listCharacters, type CharacterListItem } from '@/lib/character'

interface NPCRow {
  cert: CharacterCert
  sheet: CharacterCardData | null
}

export default function NPCsPage() {
  const [account, setAccount] = React.useState<AccountCert | null>(null)
  const [npcs, setNpcs] = React.useState<NPCRow[]>([])
  const [allCharacters, setAllCharacters] = React.useState<CharacterListItem[]>([])
  const [assignments, setAssignments] = React.useState<Record<string, { playerCharacterId: string; assignmentId: string; role: string }>>({})
  const [loading, setLoading] = React.useState(true)
  const [showForm, setShowForm] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [assigning, setAssigning] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const a = await loadAccount()
      if (!a) {
        setLoading(false)
        return
      }
      setAccount(a)
      const certs = await listCharacterCerts(a.id)
      const gmCerts = certs.filter((c) => c.personaType === 'gm-ai')
      const rows: NPCRow[] = await Promise.all(
        gmCerts.map(async (cert) => {
          if (!cert.characterDataId) return { cert, sheet: null }
          try {
            const r = await authFetch(`/api/character/${encodeURIComponent(cert.characterDataId)}`)
            if (!r.ok) return { cert, sheet: null }
            const sheet = await r.json()
            return { cert, sheet }
          } catch {
            return { cert, sheet: null }
          }
        }),
      )
      setNpcs(rows)

      // Fetch the full character list so the DM can pick a PC owner per NPC.
      try {
        const cl = await listCharacters()
        setAllCharacters(cl.characters)
      } catch {
        setAllCharacters([])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAssign = async (npcCharacterId: string, playerCharacterId: string) => {
    setAssigning(npcCharacterId)
    setError(null)
    try {
      const res = await authFetch('/api/player-npc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerCharacterId, npcCharacterId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `${res.status}`)
      }
      const j = await res.json()
      setAssignments((prev) => ({
        ...prev,
        [npcCharacterId]: {
          playerCharacterId,
          assignmentId: j.assignment.id,
          role: j.assignment.role,
        },
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'assign failed')
    } finally {
      setAssigning(null)
    }
  }

  const handleUnassign = async (npcCharacterId: string) => {
    const a = assignments[npcCharacterId]
    if (!a) return
    setAssigning(npcCharacterId)
    setError(null)
    try {
      const res = await authFetch(
        `/api/player-npc?id=${encodeURIComponent(a.assignmentId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `${res.status}`)
      }
      setAssignments((prev) => {
        const next = { ...prev }
        delete next[npcCharacterId]
        return next
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'unassign failed')
    } finally {
      setAssigning(null)
    }
  }

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          NPCs
        </h2>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          {npcs.length} on this device
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? '× cancel' : '+ New NPC'}
        </button>
      </div>

      {error && (
        <Card variant="danger">
          <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            {error}
          </div>
        </Card>
      )}

      {showForm && account && (
        <NPCForm
          account={account}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            refresh()
          }}
        />
      )}

      {loading && (
        <Card><div style={{ color: 'var(--ink-3)' }}>loading NPCs…</div></Card>
      )}

      {!loading && npcs.length === 0 && !showForm && (
        <Card variant="dashed">
          <EmptyState
            label="no NPCs yet"
            hint="click '+ New NPC' to create one. NPCs are full character sheets with persona='gm-ai' (the AI is their handler unless you whisper-claim them during a session)."
          />
        </Card>
      )}

      {npcs.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 12,
          }}
        >
          {npcs.map(({ cert, sheet }) =>
            sheet ? (
              <Card key={cert.id} title={null} meta={cert.id.slice(0, 8) + '…'}>
                <CharacterCard
                  id={(sheet as any).id ?? cert.id}
                  name={(sheet as any).name ?? '—'}
                  race={(sheet as any).race}
                  classes={(sheet as any).classes}
                  hpCurrent={(sheet as any).hpCurrent}
                  hpMax={(sheet as any).hpMax}
                  ac={(sheet as any).ac}
                  personaType="gm-ai"
                  onClick={() => {
                    const id = (sheet as any).id ?? cert.characterDataId
                    if (id) window.location.href = `/dm/party/${encodeURIComponent(id)}`
                  }}
                />
                <FollowerAssignRow
                  npcCharacterId={(sheet as any).id ?? cert.characterDataId ?? ''}
                  candidates={allCharacters}
                  current={assignments[(sheet as any).id ?? cert.characterDataId ?? '']}
                  busy={assigning === ((sheet as any).id ?? cert.characterDataId)}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                />
              </Card>
            ) : (
              <Card key={cert.id} title="(unfinished NPC)" meta="no sheet" variant="dashed">
                <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                  cert minted but the chargen submit didn't attach a character row.
                  <br />
                  cert id: <code>{cert.id.slice(0, 12)}…</code>
                </p>
              </Card>
            ),
          )}
        </div>
      )}

      <Card title="Why NPCs go through chargen" variant="soft">
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
          Pedro's framing: every entity is an NPC; some have a human handler.
          DM-created NPCs get persona='gm-ai' (the AI is the handler). The DM
          can whisper-claim an NPC's voice during a session via the
          Communicator's per-NPC channel.
        </p>
      </Card>
    </div>
  )
}

function FollowerAssignRow({
  npcCharacterId,
  candidates,
  current,
  busy,
  onAssign,
  onUnassign,
}: {
  npcCharacterId: string
  candidates: CharacterListItem[]
  current?: { playerCharacterId: string; assignmentId: string; role: string }
  busy: boolean
  onAssign: (npcCharacterId: string, playerCharacterId: string) => void
  onUnassign: (npcCharacterId: string) => void
}) {
  const [pick, setPick] = React.useState('')
  const ownerName = current
    ? candidates.find((c) => c.id === current.playerCharacterId)?.name ?? current.playerCharacterId.slice(0, 8) + '…'
    : null

  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px dashed var(--rule-soft)',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--ink-3)',
      }}
    >
      {current ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>follower of <b style={{ fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)' }}>{ownerName}</b></span>
          <span style={{ flex: 1 }} />
          <button
            className="btn sm"
            onClick={() => onUnassign(npcCharacterId)}
            disabled={busy}
            style={{ color: 'var(--accent-red)' }}
          >
            unbind
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>assign to:</span>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            style={{ flex: 1, minWidth: 100, padding: '4px 6px', fontFamily: 'inherit', fontSize: 11 }}
          >
            <option value="">pick a PC…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            className="btn sm primary"
            disabled={!pick || busy}
            onClick={() => onAssign(npcCharacterId, pick)}
          >
            {busy ? '…' : 'assign'}
          </button>
        </div>
      )}
    </div>
  )
}

const RACES = [
  'human', 'elf', 'half-elf', 'dwarf', 'halfling', 'gnome', 'tiefling',
  'half-orc', 'dragonborn', 'goblin', 'orc',
]
const CLASSES = [
  'fighter', 'rogue', 'wizard', 'cleric', 'bard', 'ranger', 'paladin',
  'sorcerer', 'warlock', 'druid', 'monk', 'barbarian',
]

function NPCForm({
  account,
  onCancel,
  onCreated,
}: {
  account: AccountCert
  onCancel: () => void
  onCreated: () => void
}) {
  const [name, setName] = React.useState('')
  const [raceKey, setRaceKey] = React.useState('human')
  const [classKey, setClassKey] = React.useState('fighter')
  const [level, setLevel] = React.useState(1)
  const [submitting, setSubmitting] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const submit = async () => {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setErr(null)
    try {
      // 1. Mint a character cert with persona='gm-ai' (do NOT set active —
      //    DM keeps their own session intact).
      const cert = await createCharacterCert({
        accountId: account.id,
        geo: { lat: account.geoLat, lon: account.geoLon },
        personaType: 'gm-ai',
      })

      // 2. Create the character sheet with sensible NPC defaults.
      const draft = {
        name: name.trim(),
        raceKey,
        classKey,
        abilityScores: {
          strength: 13,
          dexterity: 13,
          constitution: 13,
          intelligence: 11,
          wisdom: 11,
          charisma: 10,
        },
        background: 'commoner',
        alignment: 'True Neutral',
        certId: cert.id,
        // Level scaling: bump CON for higher-level NPCs to give them more HP
        ...(level > 1 ? { startingLevel: level } : {}),
      }
      const res = await authFetch('/api/character/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `${res.status}`)
      }
      const result = (await res.json()) as { characterId: string }

      // 3. Attach the character row to the cert in IDB.
      await attachCharacterData(cert.id, result.characterId)

      onCreated()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="New NPC" meta="quick form">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name (e.g., 'Bartleby the innkeeper')"
          autoFocus
          style={{
            padding: '8px 10px',
            fontFamily: 'var(--serif)',
            fontSize: 15,
            background: 'var(--paper)',
            border: '1px solid var(--rule-soft)',
            minWidth: 0,
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
            gap: 8,
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="tiny">race</span>
            <select value={raceKey} onChange={(e) => setRaceKey(e.target.value)} style={{ padding: '6px 8px' }}>
              {RACES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="tiny">class</span>
            <select value={classKey} onChange={(e) => setClassKey(e.target.value)} style={{ padding: '6px 8px' }}>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="tiny">level</span>
            <input
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(20, +e.target.value || 1)))}
              style={{ padding: '6px 8px', minWidth: 0 }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button className="btn primary" onClick={submit} disabled={!name.trim() || submitting}>
            {submitting ? 'creating…' : 'create NPC →'}
          </button>
          <button className="btn" onClick={onCancel} disabled={submitting}>
            cancel
          </button>
          <span style={{ flex: 1 }} />
          <a href="/chargen" className="btn" style={{ textDecoration: 'none' }}>
            full chargen →
          </a>
        </div>
        {err && (
          <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            {err}
          </div>
        )}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          ↳ defaults: standard ability spread (13/13/13/11/11/10), commoner background, neutral alignment.
          for tier-1 NPCs only. open the full chargen for legendary entities.
        </div>
      </div>
    </Card>
  )
}
