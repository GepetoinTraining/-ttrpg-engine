'use client'

/**
 * PartySlot + PartyRoster — the DM's party controller primitives.
 *
 * A slot can be:
 *   - empty  → "+ invite" button to mint an invite
 *   - invited → InviteLinkCard with copy/revoke
 *   - bound  → CharacterCard showing the bound character
 *
 * The DM controls the roster: add slots, invite, revoke. Bound characters
 * are removed by un-binding (transferring out) — a deeper flow.
 */

import * as React from 'react'
import { CharacterCard, type CharacterCardData } from './CharacterCard'
import { InviteLinkCard, type InviteStatus } from './InviteLinkCard'

export interface PartySlotData {
  /** Stable id for this slot — DM-assigned label, may persist before invite. */
  slotId: string
  /** The seat label the DM gave it (e.g., "rogue seat", or just "Player 3"). */
  label: string
  /** When the invite has been minted but the cert isn't yet redeemed/chargenned. */
  invite?: {
    url: string
    status: InviteStatus
  }
  /** When a character has been bound to this slot. */
  character?: CharacterCardData
}

interface PartySlotProps {
  slot: PartySlotData
  onInvite?: (slotId: string) => void
  onCopyInvite?: (url: string) => void
  onRevokeInvite?: (slotId: string) => void
  onRegenerateInvite?: (slotId: string) => void
  onRemoveSlot?: (slotId: string) => void
  onCharacterClick?: (characterId: string) => void
}

export function PartySlot({
  slot,
  onInvite,
  onCopyInvite,
  onRevokeInvite,
  onRegenerateInvite,
  onRemoveSlot,
  onCharacterClick,
}: PartySlotProps) {
  const filled = !!slot.character
  const invited = !!slot.invite && !filled

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        border: filled ? '1px solid var(--rule-soft)' : '1px dashed var(--rule-soft)',
        background: 'var(--paper)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {slot.label}
        </span>
        <span style={{ flex: 1 }} />
        {onRemoveSlot && !filled && (
          <button
            onClick={() => onRemoveSlot(slot.slotId)}
            aria-label="remove slot"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        )}
      </div>

      {filled && slot.character && (
        <CharacterCard
          {...slot.character}
          onClick={onCharacterClick}
        />
      )}

      {invited && slot.invite && (
        <InviteLinkCard
          inviteeName={slot.label}
          inviteUrl={slot.invite.url}
          status={slot.invite.status}
          onCopy={onCopyInvite}
          onRegenerate={onRegenerateInvite ? () => onRegenerateInvite(slot.slotId) : undefined}
          onRevoke={onRevokeInvite ? () => onRevokeInvite(slot.slotId) : undefined}
        />
      )}

      {!filled && !invited && (
        <button
          className="btn primary"
          onClick={onInvite ? () => onInvite(slot.slotId) : undefined}
          disabled={!onInvite}
          style={{ alignSelf: 'flex-start' }}
        >
          + invite player
        </button>
      )}
    </div>
  )
}

interface PartyRosterProps {
  slots: PartySlotData[]
  onAddSlot?: () => void
  onInvite?: (slotId: string) => void
  onCopyInvite?: (url: string) => void
  onRevokeInvite?: (slotId: string) => void
  onRegenerateInvite?: (slotId: string) => void
  onRemoveSlot?: (slotId: string) => void
  onCharacterClick?: (characterId: string) => void
}

export function PartyRoster({
  slots,
  onAddSlot,
  ...handlers
}: PartyRosterProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: 12,
        }}
      >
        {slots.map((slot) => (
          <PartySlot key={slot.slotId} slot={slot} {...handlers} />
        ))}
      </div>

      {onAddSlot && (
        <button
          className="btn"
          onClick={onAddSlot}
          style={{ alignSelf: 'flex-start' }}
        >
          + add seat
        </button>
      )}
    </div>
  )
}
