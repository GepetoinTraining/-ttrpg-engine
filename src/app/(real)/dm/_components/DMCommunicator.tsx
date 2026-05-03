'use client'

/**
 * DMCommunicator — the right-rail chat for the DM.
 *
 * Channels:
 *   - 'party' — DM ↔ all players (general table chat). v1 mock; v2 persists.
 *   - 'incoming' — read-only stream of player intents (polled from
 *                   /api/world/log filtered by system='player-intent:*' or
 *                   system='propose-investment:*'). DM sees the intent and
 *                   responds in another channel / resolves via engine math.
 *   - 'npc:<id>' — DM ↔ a specific NPC, routed through /api/npc/[id]/converse
 *
 * Persistence + cross-device sync is a follow-up. When session model lands,
 * messages tagged with sessionId join the TPB bundle.
 */

import * as React from 'react'
import { Communicator, type CommChannel, type CommMessage } from '@/components/ui'
import { authFetch } from '@/lib/auth-fetch'
import { fetchWorldLog, type TpbLogEntryClient } from '@/lib/world-client'

const PARTY_CHANNEL: CommChannel = { id: 'party', label: 'Party', glyph: '👥' }
const INCOMING_CHANNEL: CommChannel = {
  id: 'incoming',
  label: 'Incoming',
  glyph: '↘',
  readOnly: true,
}

const POLL_MS = 8000

export function DMCommunicator() {
  const [channels] = React.useState<CommChannel[]>([PARTY_CHANNEL, INCOMING_CHANNEL])
  const [activeId, setActiveId] = React.useState('party')
  const [messages, setMessages] = React.useState<Record<string, CommMessage[]>>({
    party: [],
    incoming: [],
  })
  const seenIntentIds = React.useRef<Set<number>>(new Set())

  const addMessage = (channelId: string, m: CommMessage) => {
    setMessages((prev) => ({
      ...prev,
      [channelId]: [...(prev[channelId] ?? []), m],
    }))
  }

  // Poll /api/world/log for player intent / investment proposal actions
  // and surface them in the Incoming channel.
  React.useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      if (cancelled) return
      try {
        const rows = await fetchWorldLog(50)
        if (cancelled) return
        const newMsgs: CommMessage[] = []
        for (const row of rows) {
          if (seenIntentIds.current.has(row.id)) continue
          const action = row.action as Record<string, unknown>
          const system = typeof action.system === 'string' ? action.system : ''
          if (
            !system.startsWith('player-intent:') &&
            !system.startsWith('propose-investment:')
          ) continue
          seenIntentIds.current.add(row.id)
          const value = action.value as Record<string, unknown> | undefined
          const verb = system.startsWith('propose-investment:')
            ? 'INVESTMENT'
            : ((value?.verb as string) ?? 'intent').toUpperCase()
          const target = (value?.target as string) ?? null
          const description = (value?.description as string) ?? '(no description)'
          const amount = value?.amount as number | undefined
          const d20 = value?.d20 as number | undefined
          const cidShort = system.split(':').slice(1).join(':').slice(0, 8)
          const body = [
            `[${verb}${target ? ` → ${target}` : ''}]`,
            description,
            amount ? `· ${amount}gp` : '',
            d20 ? `· d20=${d20}` : '',
          ]
            .filter(Boolean)
            .join(' ')
          newMsgs.push({
            id: `intent_${row.id}`,
            channelId: 'incoming',
            who: cidShort ? `cert ${cidShort}…` : 'player',
            body,
            ts: row.realTs ? new Date(row.realTs).getTime() : Date.now(),
            self: false,
          })
        }
        if (newMsgs.length > 0 && !cancelled) {
          setMessages((prev) => ({
            ...prev,
            incoming: [...(prev.incoming ?? []), ...newMsgs],
          }))
        }
      } catch {
        // ignore poll errors; next tick retries
      }
      if (!cancelled) {
        timer = setTimeout(tick, POLL_MS)
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const handleSend = async (channelId: string, body: string) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const ts = Date.now()

    addMessage(channelId, { id, channelId, who: 'DM', body, ts, self: true })

    if (channelId.startsWith('npc:')) {
      const npcId = channelId.slice('npc:'.length)
      try {
        const res = await authFetch(`/api/npc/${encodeURIComponent(npcId)}/converse`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: body }),
        })
        if (res.ok) {
          const j: { reply?: string; name?: string } = await res.json().catch(() => ({}))
          addMessage(channelId, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            channelId,
            who: j.name ?? 'NPC',
            body: j.reply ?? '(no reply)',
            ts: Date.now(),
            self: false,
          })
        } else {
          addMessage(channelId, {
            id: `msg_err_${Date.now()}`,
            channelId,
            who: 'system',
            body: `converse failed: ${res.status}`,
            ts: Date.now(),
            self: false,
          })
        }
      } catch (e) {
        addMessage(channelId, {
          id: `msg_err_${Date.now()}`,
          channelId,
          who: 'system',
          body: `converse error: ${e instanceof Error ? e.message : 'unknown'}`,
          ts: Date.now(),
          self: false,
        })
      }
    }
  }

  return (
    <Communicator
      channels={channels}
      messagesByChannel={messages}
      activeChannelId={activeId}
      onChannelChange={setActiveId}
      onSend={handleSend}
      title="Communicator"
    />
  )
}
