'use client'

/**
 * /play/followers — NPCs the DM has assigned as my followers.
 *
 * Reads /api/player-npc?playerCharacterId=<my id>. Per Pedro's named-NPC
 * model: every entity is a character; an "NPC follower" is a character
 * (persona='gm-ai') bound to my player seat via the player_npcs table.
 */

import * as React from 'react'
import { Card, CharacterCard, EmptyState } from '@/components/ui'
import { useActiveCharacter } from '../../_lib/use-active-character'
import { authFetch } from '@/lib/auth-fetch'

interface PlayerNpcAssignment {
  assignmentId: string
  npcCharacterId: string
  role: string
  assignedDay: number
  note: string | null
  character: {
    id: string
    name: string
    race?: string
    subrace?: string | null
    hpCurrent?: number
    hpMax?: number
    ac?: number
    classes?: { className: string; level: number }[]
  } | null
}

export default function FollowersPage() {
  const { cert, sheet, loading: charLoading } = useActiveCharacter({ withSheet: true })
  const characterId = sheet?.id ?? cert?.characterDataId
  const [assignments, setAssignments] = React.useState<PlayerNpcAssignment[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!characterId) return
    setLoading(true)
    setError(null)
    authFetch(`/api/player-npc?playerCharacterId=${encodeURIComponent(characterId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        const j: { npcs?: PlayerNpcAssignment[] } = await r.json()
        setAssignments(j.npcs ?? [])
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'fetch failed'))
      .finally(() => setLoading(false))
  }, [characterId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
        Followers
      </h2>

      {!characterId && !charLoading && (
        <Card variant="danger">
          <EmptyState label="no character bound" hint="finish chargen first." />
        </Card>
      )}

      {(charLoading || loading) && (
        <Card><div style={{ color: 'var(--ink-3)' }}>loading followers…</div></Card>
      )}

      {error && (
        <Card variant="danger">
          <EmptyState label="followers fetch failed" hint={error} />
        </Card>
      )}

      {!loading && assignments.length === 0 && characterId && !error && (
        <Card variant="dashed">
          <EmptyState
            label="no followers"
            hint="your DM hasn't assigned any NPCs to walk with you yet. they create NPCs in /dm/npcs and bind them to your character."
          />
        </Card>
      )}

      {assignments.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 12,
          }}
        >
          {assignments.map((a) => {
            const char = a.character
            if (!char) {
              return (
                <Card key={a.assignmentId} title="(NPC missing)" meta={a.role} variant="dashed">
                  <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    Assignment exists but the NPC's character row wasn't found.
                  </p>
                </Card>
              )
            }
            return (
              <Card key={a.assignmentId} title={char.name} meta={a.role}>
                <CharacterCard
                  id={char.id}
                  name={char.name}
                  race={char.race}
                  subrace={char.subrace}
                  classes={char.classes}
                  hpCurrent={char.hpCurrent}
                  hpMax={char.hpMax}
                  ac={char.ac}
                  personaType="gm-ai"
                  compact
                />
                {a.note && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontStyle: 'italic',
                      color: 'var(--ink-2)',
                    }}
                  >
                    {a.note}
                  </div>
                )}
                <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                  bound day {a.assignedDay}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Card title="What you can do" variant="soft">
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
          Talk to a follower via the Communicator's per-NPC channel (DM grants
          when ready). Direct them to do things via your{' '}
          <a href="/play/intent" style={{ color: 'var(--accent-blue)' }}>
            Intent surface
          </a>
          {' '}— "I send Bartleby ahead to scout."
        </p>
      </Card>
    </div>
  )
}
