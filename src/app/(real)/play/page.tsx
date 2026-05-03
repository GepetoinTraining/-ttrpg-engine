'use client'

/**
 * /play — player home. Sheet at-a-glance + recent log + quick actions.
 */

import * as React from 'react'
import {
  Card,
  CharacterCard,
  EmptyState,
} from '@/components/ui'
import { useActiveCharacter } from '../_lib/use-active-character'

export default function PlayHome() {
  const { loading, cert, sheet, error } = useActiveCharacter({ withSheet: true })

  if (loading) {
    return <Card><div style={{ color: 'var(--ink-3)' }}>loading…</div></Card>
  }

  if (!cert) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          No active character
        </h2>
        <Card variant="danger">
          <EmptyState
            label="no player cert in this browser"
            hint={error ?? 'open the invite link your DM sent, or pick a character from the landing page.'}
          />
          <a href="/" className="btn" style={{ marginTop: 8, textDecoration: 'none' }}>
            ← back to landing
          </a>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          {sheet?.name ?? 'My character'}
        </h2>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          {cert.personaType} · cert {cert.id.slice(0, 8)}…
        </div>
      </div>

      {sheet ? (
        <CharacterCard
          id={sheet.id ?? cert.id}
          name={sheet.name}
          race={sheet.race}
          subrace={sheet.subrace}
          classes={sheet.classes}
          hpCurrent={sheet.hpCurrent ?? sheet.hp}
          hpMax={sheet.hpMax ?? sheet.hpMax}
          ac={sheet.ac}
          personaType={cert.personaType}
        />
      ) : (
        <Card variant="dashed">
          <EmptyState
            label="character sheet not yet bound"
            hint="finish chargen to populate your sheet, or check the journey log if your DM is still building your seat."
          />
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 10,
        }}
      >
        <Card title="Make a choice" meta="declare an action">
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
            Send an intent to the DM. They resolve the math; you tell the story.
          </p>
          <a href="/play/intent" className="btn primary" style={{ textDecoration: 'none' }}>
            open Intent →
          </a>
        </Card>
        <Card title="Inventory" meta="what I carry">
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
            Items, weight, transfer to party stash.
          </p>
          <a href="/play/inventory" className="btn" style={{ textDecoration: 'none' }}>
            open Inventory →
          </a>
        </Card>
        <Card title="Followers" meta="who walks with me">
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
            NPCs the DM has bound to me.
          </p>
          <a href="/play/followers" className="btn" style={{ textDecoration: 'none' }}>
            open Followers →
          </a>
        </Card>
        <Card title="Sheet" meta="full character sheet">
          <a href="/play/sheet" className="btn" style={{ textDecoration: 'none' }}>
            open Sheet →
          </a>
        </Card>
      </div>
    </div>
  )
}
