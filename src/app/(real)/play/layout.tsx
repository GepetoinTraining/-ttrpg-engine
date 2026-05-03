'use client'

import * as React from 'react'
import { AppShell } from '@/components/ui'
import { PlayerNav } from './_components/PlayerNav'
import { PlayerCommunicator } from './_components/PlayerCommunicator'

// /play/* — player tree. Sidebar is character-scoped; communicator
// has DM whisper + party channels.

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell sidebar={<PlayerNav />} communicator={<PlayerCommunicator />} title="My character">
      {children}
    </AppShell>
  )
}
