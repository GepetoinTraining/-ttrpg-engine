'use client'

/**
 * PlayerCommunicator — chat from the player's POV.
 *
 * Channels (v1: local mock; v2: server-relayed via DM's machine):
 *   - 'dm'     — private whisper to the DM
 *   - 'party'  — open table chat
 *   - 'follower:<id>' — DM-granted whisper to a specific follower NPC
 *
 * In v2, the DM's machine is the math host. Player messages go to the DM's
 * shard via SSE/HTTP relay; DM resolves any math-affecting beats and the
 * outcome lands in the session bundle.
 */

import * as React from 'react'
import { Communicator, type CommChannel, type CommMessage } from '@/components/ui'

const DEFAULT_CHANNELS: CommChannel[] = [
  { id: 'dm',    label: 'DM',    glyph: '◆' },
  { id: 'party', label: 'Party', glyph: '👥' },
]

export function PlayerCommunicator() {
  const [activeId, setActiveId] = React.useState('dm')
  const [messages, setMessages] = React.useState<Record<string, CommMessage[]>>({
    dm: [],
    party: [],
  })

  const handleSend = async (channelId: string, body: string) => {
    const msg: CommMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      channelId,
      who: 'me',
      body,
      ts: Date.now(),
      self: true,
    }
    setMessages((prev) => ({
      ...prev,
      [channelId]: [...(prev[channelId] ?? []), msg],
    }))
    // v2: POST to /api/session/[id]/message scoped to channel + this player's cert
  }

  return (
    <Communicator
      channels={DEFAULT_CHANNELS}
      messagesByChannel={messages}
      activeChannelId={activeId}
      onChannelChange={setActiveId}
      onSend={handleSend}
      title="Communicator"
    />
  )
}
