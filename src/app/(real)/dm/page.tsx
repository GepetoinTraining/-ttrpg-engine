'use client'

import * as React from 'react'
import { Card } from '@/components/ui'

export default function DMHome() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 26,
            fontWeight: 600,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          DM home
        </h2>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          DM + AI · centaur table
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: 12,
        }}
      >
        <Card title="Party" meta="invite + sheets">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
            Add seats, mint invite links, view sheets.
          </p>
          <a href="/dm/party" className="btn primary" style={{ textDecoration: 'none' }}>
            open Party →
          </a>
        </Card>
        <Card title="NPCs" meta="chargen + followers">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
            Create NPCs through chargen. Assign as followers of party members.
          </p>
          <a href="/dm/npcs" className="btn" style={{ textDecoration: 'none' }}>
            open NPCs →
          </a>
        </Card>
        <Card title="Holdings" meta="downtime + inventory">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
            Party shared pool, claim stashes, downtime investments.
          </p>
          <a href="/dm/holdings" className="btn" style={{ textDecoration: 'none' }}>
            open Holdings →
          </a>
        </Card>
        <Card title="Tactical" meta="combat canvas">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
            Click-to-place monsters, initiative, damage tracking.
          </p>
          <a href="/dm/tactical" className="btn" style={{ textDecoration: 'none' }}>
            open Tactical →
          </a>
        </Card>
        <Card title="Studies" meta="research queue">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
            Active studies, claim discoveries via LLM-supervised completion.
          </p>
          <a href="/dm/studies" className="btn" style={{ textDecoration: 'none' }}>
            open Studies →
          </a>
        </Card>
      </div>
    </div>
  )
}
