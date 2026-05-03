'use client'

/**
 * InviteLinkCard — display an invite URL with copy / status / revoke.
 *
 * Used by the Party Controller for each pending seat. The DM mints the
 * invite via /api/campaign/:id/invite (existing endpoint), gets back a
 * token + URL, and surfaces it here so they can copy + send via WhatsApp.
 *
 * Status states:
 *   pending     — minted, copied to clipboard at least once expected
 *   sent        — DM has copied / sent the link
 *   redeemed    — invitee opened the link and installed cert
 *   bound       — invitee completed chargen and is now in the party
 *   expired     — invite token aged out
 */

import * as React from 'react'

export type InviteStatus = 'pending' | 'sent' | 'redeemed' | 'bound' | 'expired'

const STATUS_TAG: Record<InviteStatus, { label: string; color: string }> = {
  pending:  { label: 'pending',  color: 'var(--ink-3)' },
  sent:     { label: 'sent',     color: 'var(--accent-blue)' },
  redeemed: { label: 'redeemed', color: 'var(--accent-gold)' },
  bound:    { label: 'in party', color: 'var(--accent-green)' },
  expired:  { label: 'expired',  color: 'var(--accent-red)' },
}

interface InviteLinkCardProps {
  inviteeName: string
  inviteUrl: string
  status: InviteStatus
  /** Called when DM clicks copy. Defaults to navigator.clipboard.writeText. */
  onCopy?: (url: string) => void
  /** Called when DM clicks regenerate (mint a new token, invalidate the old). */
  onRegenerate?: () => void
  /** Called when DM clicks revoke (delete the invite). */
  onRevoke?: () => void
  /** Optional WhatsApp deep link — pre-fills a message with the URL. */
  whatsappShare?: boolean
}

export function InviteLinkCard({
  inviteeName,
  inviteUrl,
  status,
  onCopy,
  onRegenerate,
  onRevoke,
  whatsappShare = true,
}: InviteLinkCardProps) {
  const [copied, setCopied] = React.useState(false)
  const tag = STATUS_TAG[status]

  const handleCopy = async () => {
    if (onCopy) {
      onCopy(inviteUrl)
    } else {
      try {
        await navigator.clipboard.writeText(inviteUrl)
      } catch {}
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const whatsappUrl = whatsappShare
    ? `https://wa.me/?text=${encodeURIComponent(`Join my campaign: ${inviteUrl}`)}`
    : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        border: '1px dashed var(--rule-soft)',
        background: 'var(--paper-2)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>
          {inviteeName}
        </span>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: tag.color,
            border: `1px solid ${tag.color}`,
            padding: '2px 6px',
            borderRadius: 999,
          }}
        >
          {tag.label}
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--ink-2)',
          background: 'var(--paper)',
          border: '1px solid var(--rule-soft)',
          padding: '6px 8px',
          wordBreak: 'break-all',
          minWidth: 0,
        }}
      >
        {inviteUrl}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn sm primary" onClick={handleCopy}>
          {copied ? '✓ copied' : 'copy link'}
        </button>
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="btn sm"
            style={{ textDecoration: 'none' }}
          >
            ↗ WhatsApp
          </a>
        )}
        {onRegenerate && status !== 'bound' && (
          <button className="btn sm" onClick={onRegenerate}>regenerate</button>
        )}
        {onRevoke && status !== 'bound' && (
          <button className="btn sm" onClick={onRevoke} style={{ color: 'var(--accent-red)' }}>
            revoke
          </button>
        )}
      </div>
    </div>
  )
}
