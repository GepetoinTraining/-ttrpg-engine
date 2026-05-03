'use client'

/**
 * /dm/party — the Party Controller.
 *
 * The DM's seat manager: add slots, mint invites, copy WhatsApp-shareable
 * URLs, view bound characters' sheets.
 *
 * v1 persistence: localStorage. The active campaign id is stored at
 * `claudedm:activeCampaignId`; the slot list at `claudedm:party-slots:<cid>`.
 * Move to IDB + canonical sync next conversation (the campaign + invites
 * already exist server-side in `auth_enrollments` + `campaigns`; what's
 * local-only is the DM's slot labels and ordering).
 */

import * as React from 'react'
import {
  Card,
  EmptyState,
  PartyRoster,
  type PartySlotData,
} from '@/components/ui'
import {
  createCampaign,
  inviteToCampaign,
  buildInviteUrl,
  captureGeo,
} from '@/lib/campaign'
import { listCharacters, type CharacterListItem } from '@/lib/character'

const LS_ACTIVE_CAMPAIGN = 'claudedm:activeCampaignId'
const LS_PARTY_SLOTS = (cid: string) => `claudedm:party-slots:${cid}`

interface StoredSlot {
  slotId: string
  label: string
  invite?: { token: string; url: string; status: 'pending' | 'sent' | 'redeemed' | 'bound' | 'expired' }
  characterId?: string
}

function loadSlots(cid: string): StoredSlot[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_PARTY_SLOTS(cid))
    if (!raw) return []
    return JSON.parse(raw) as StoredSlot[]
  } catch {
    return []
  }
}

function saveSlots(cid: string, slots: StoredSlot[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_PARTY_SLOTS(cid), JSON.stringify(slots))
}

function newSlotId(): string {
  return `slot_${Math.random().toString(36).slice(2, 9)}`
}

export default function PartyPage() {
  const [campaignId, setCampaignId] = React.useState<string | null>(null)
  const [slots, setSlots] = React.useState<StoredSlot[]>([])
  const [characters, setCharacters] = React.useState<CharacterListItem[]>([])
  const [loadingChars, setLoadingChars] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [createName, setCreateName] = React.useState('')
  const [inviting, setInviting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const cid = window.localStorage.getItem(LS_ACTIVE_CAMPAIGN)
    if (cid) {
      setCampaignId(cid)
      setSlots(loadSlots(cid))
    }
  }, [])

  // Persist slots whenever they change
  React.useEffect(() => {
    if (campaignId) saveSlots(campaignId, slots)
  }, [slots, campaignId])

  // Fetch character list (used to bind invite slots to actual characters once redeemed)
  React.useEffect(() => {
    if (!campaignId) return
    setLoadingChars(true)
    listCharacters()
      .then((r) => setCharacters(r.characters))
      .catch(() => setCharacters([]))
      .finally(() => setLoadingChars(false))
  }, [campaignId])

  const handleCreateCampaign = async () => {
    setCreating(true)
    setError(null)
    try {
      const slug = (createName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'campaign').slice(0, 32)
      const result = await createCampaign({
        name: createName.trim() || 'Untitled Campaign',
        slug,
        worldSeed: 'faerun',
        region: 'Sword Coast · Waterdeep',
        tone: 'Heroic · classic',
        startingLevel: 1,
      })
      setCampaignId(result.campaignId)
      window.localStorage.setItem(LS_ACTIVE_CAMPAIGN, result.campaignId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'campaign create failed')
    } finally {
      setCreating(false)
    }
  }

  const handleAddSlot = () => {
    const idx = slots.length + 1
    const slot: StoredSlot = {
      slotId: newSlotId(),
      label: `Player ${idx}`,
    }
    setSlots((prev) => [...prev, slot])
  }

  const handleRemoveSlot = (slotId: string) => {
    setSlots((prev) => prev.filter((s) => s.slotId !== slotId))
  }

  const handleInvite = async (slotId: string) => {
    if (!campaignId) return
    const slot = slots.find((s) => s.slotId === slotId)
    if (!slot) return
    setInviting(slotId)
    setError(null)
    try {
      const geo = await captureGeo()
      const { token } = await inviteToCampaign(campaignId, slot.label, geo)
      const url = buildInviteUrl(token, campaignId)
      setSlots((prev) =>
        prev.map((s) =>
          s.slotId === slotId
            ? { ...s, invite: { token, url, status: 'pending' } }
            : s,
        ),
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'invite failed')
    } finally {
      setInviting(null)
    }
  }

  const handleCopyInvite = (url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url)
    }
    // Mark all pending invites with this URL as 'sent' so the badge updates.
    setSlots((prev) =>
      prev.map((s) =>
        s.invite && s.invite.url === url && s.invite.status === 'pending'
          ? { ...s, invite: { ...s.invite, status: 'sent' } }
          : s,
      ),
    )
  }

  const handleRevoke = (slotId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, invite: undefined } : s)),
    )
  }

  const handleRegenerate = async (slotId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, invite: undefined } : s)),
    )
    await handleInvite(slotId)
  }

  const handleCharacterClick = (characterId: string) => {
    window.location.href = `/dm/party/${encodeURIComponent(characterId)}`
  }

  const handleEditLabel = (slotId: string, newLabel: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, label: newLabel } : s)),
    )
  }

  const handleBindCharacter = (slotId: string, characterId: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, characterId } : s)),
    )
  }

  // Build the PartyRoster slot data from stored slots + character list
  const charById = new Map(characters.map((c) => [c.id, c]))
  const rosterSlots: PartySlotData[] = slots.map((s) => {
    const character = s.characterId ? charById.get(s.characterId) : undefined
    return {
      slotId: s.slotId,
      label: s.label,
      invite: s.invite,
      character: character
        ? {
            id: character.id,
            name: character.name,
            race: character.race,
            subrace: character.subrace,
            classes: character.classes,
            hpCurrent: character.hpCurrent,
            hpMax: character.hpMax,
          }
        : undefined,
    }
  })

  // No campaign: prompt for one
  if (!campaignId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 26,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Party
        </h2>
        <Card title="No active campaign">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
            Name your first campaign to start. Region, tone, and seed default to
            Faerûn / Sword Coast for now — you can rebrand later from settings.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="campaign name"
              style={{
                flex: 1,
                minWidth: 200,
                padding: '8px 10px',
                fontFamily: 'var(--serif)',
                fontSize: 15,
                background: 'var(--paper)',
                border: '1px solid var(--rule-soft)',
              }}
            />
            <button
              className="btn primary"
              onClick={handleCreateCampaign}
              disabled={creating}
            >
              {creating ? 'creating…' : 'create →'}
            </button>
          </div>
          {error && (
            <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--mono)', fontSize: 12, marginTop: 8 }}>
              {error}
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          Party
        </h2>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          campaign {campaignId.slice(0, 8)}…
        </span>
      </div>

      {error && (
        <Card variant="danger">
          <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            {error}
          </div>
        </Card>
      )}

      <Card title="Seats" meta={`${slots.length} slot${slots.length === 1 ? '' : 's'}`}>
        {slots.length === 0 ? (
          <EmptyState
            label="no seats yet"
            hint="add one below — each seat becomes an invite link you send to a player."
          />
        ) : null}

        <div style={{ marginTop: slots.length > 0 ? 4 : 8 }}>
          <PartyRoster
            slots={rosterSlots}
            onAddSlot={handleAddSlot}
            onInvite={handleInvite}
            onCopyInvite={handleCopyInvite}
            onRevokeInvite={handleRevoke}
            onRegenerateInvite={handleRegenerate}
            onRemoveSlot={handleRemoveSlot}
            onCharacterClick={handleCharacterClick}
          />
        </div>

        {inviting && (
          <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            minting invite for slot {inviting.slice(-6)}…
          </div>
        )}
      </Card>

      {/* Manual bind — for invitees who finished chargen but the slot doesn't know about it.
          v2: server-side webhook updates slot.status when chargen completes. */}
      {characters.length > 0 && slots.some((s) => !s.characterId) && (
        <Card title="Bind a character to a seat" meta="if their chargen is done">
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
            Pick the character + the seat. v1 is manual; the auto-bind on
            chargen completion lands next conversation.
          </p>
          <BindForm
            characters={characters}
            slots={slots}
            onBind={handleBindCharacter}
          />
        </Card>
      )}

      {/* Slot labels */}
      <Card title="Slot labels" variant="soft">
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
          Rename slots before inviting — the player sees this label as their seat name.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {slots.map((s) => (
            <div key={s.slotId} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={s.label}
                onChange={(e) => handleEditLabel(s.slotId, e.target.value)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontFamily: 'var(--serif)',
                  fontSize: 13,
                  background: 'var(--paper)',
                  border: '1px solid var(--rule-soft)',
                  minWidth: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--ink-3)',
                  flexShrink: 0,
                }}
              >
                {s.invite ? s.invite.status : s.characterId ? 'bound' : 'empty'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function BindForm({
  characters,
  slots,
  onBind,
}: {
  characters: CharacterListItem[]
  slots: StoredSlot[]
  onBind: (slotId: string, characterId: string) => void
}) {
  const [characterId, setCharacterId] = React.useState('')
  const [slotId, setSlotId] = React.useState('')
  const openSlots = slots.filter((s) => !s.characterId)

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 6 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, flex: 1, minWidth: 140 }}>
        <span className="tiny">character</span>
        <select
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          style={{ padding: '6px 8px', fontFamily: 'var(--serif)', fontSize: 13 }}
        >
          <option value="">pick…</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.race}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, flex: 1, minWidth: 140 }}>
        <span className="tiny">slot</span>
        <select
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          style={{ padding: '6px 8px', fontFamily: 'var(--serif)', fontSize: 13 }}
        >
          <option value="">pick…</option>
          {openSlots.map((s) => (
            <option key={s.slotId} value={s.slotId}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn primary"
        disabled={!characterId || !slotId}
        onClick={() => {
          onBind(slotId, characterId)
          setCharacterId('')
          setSlotId('')
        }}
      >
        bind
      </button>
    </div>
  )
}
