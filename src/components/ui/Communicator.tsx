'use client'

/**
 * Communicator — right-rail chat drawer.
 *
 * Channels:
 *   - "party"   — DM ↔ all players (general table chat)
 *   - "npc:<id>" — DM ↔ a specific NPC, routed through /api/npc/[id]/converse
 *   - "whisper:<certId>" — DM ↔ a single player (private)
 *
 * v1 stores messages in React state per channel. Persistence + cross-device
 * sync is a follow-up — when sessions land, in-session messages get
 * tagged with sessionId and become part of the TPB bundle.
 */

import * as React from 'react'

export interface CommMessage {
  id: string
  channelId: string
  who: string         // display name of speaker
  whoCertId?: string  // cert id, if known (party/whisper)
  body: string
  ts: number          // unix ms
  self: boolean       // rendered right-aligned + accent-blue when true
}

export interface CommChannel {
  id: string
  label: string
  /** Optional avatar/glyph (emoji). */
  glyph?: string
  /** When true, the input is disabled (e.g., a read-only log). */
  readOnly?: boolean
}

interface CommunicatorProps {
  channels: CommChannel[]
  /** Messages keyed by channel id. */
  messagesByChannel: Record<string, CommMessage[]>
  activeChannelId: string
  onChannelChange: (id: string) => void
  /** Called when the user sends a message in the active channel. */
  onSend: (channelId: string, body: string) => void | Promise<void>
  /** Optional title for the drawer header. */
  title?: string
}

export function Communicator({
  channels,
  messagesByChannel,
  activeChannelId,
  onChannelChange,
  onSend,
  title = 'Communicator',
}: CommunicatorProps) {
  const [draft, setDraft] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const messagesRef = React.useRef<HTMLDivElement>(null)
  const activeChannel = channels.find((c) => c.id === activeChannelId)
  const messages = messagesByChannel[activeChannelId] ?? []

  // Auto-scroll to newest on message change
  React.useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, activeChannelId])

  const handleSend = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await onSend(activeChannelId, body)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <div className="comm-head">
        <h3>{title}</h3>
        {activeChannel?.glyph && <span style={{ fontSize: 18 }}>{activeChannel.glyph}</span>}
      </div>

      <div className="comm-channels">
        {channels.map((c) => (
          <button
            key={c.id}
            className={`chip sm ${c.id === activeChannelId ? 'solid' : ''}`}
            onClick={() => onChannelChange(c.id)}
            style={{ cursor: 'pointer', border: '1px solid var(--rule-soft)' }}
          >
            {c.glyph && <span style={{ marginRight: 4 }}>{c.glyph}</span>}
            {c.label}
          </button>
        ))}
      </div>

      <div className="comm-messages" ref={messagesRef}>
        {messages.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '24px 12px' }}>
            no messages yet
            {activeChannel?.readOnly ? '' : ' — say something below'}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`comm-msg ${m.self ? 'self' : ''}`}>
              <span className="who">{m.who} · {fmtTime(m.ts)}</span>
              <span className="body">{m.body}</span>
            </div>
          ))
        )}
      </div>

      {!activeChannel?.readOnly && (
        <div className="comm-input">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={activeChannel ? `message ${activeChannel.label}…` : 'pick a channel'}
            disabled={!activeChannel || sending}
            rows={1}
          />
          <button
            className="btn sm primary"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
          >
            {sending ? '…' : '↑'}
          </button>
        </div>
      )}
    </>
  )
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}
