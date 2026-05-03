'use client'

import * as React from 'react'
import { AppShell } from '@/components/ui'
import { DMNav } from './_components/DMNav'
import { DMCommunicator } from './_components/DMCommunicator'

// /dm/* — DM tree. Sidebar shows the table tools (party, NPCs, holdings,
// tactical, studies). Communicator drawer scopes to DM channels.

export default function DMLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell sidebar={<DMNav />} communicator={<DMCommunicator />} title="Claude DM">
      {children}
    </AppShell>
  )
}
