'use client'

/**
 * /chargen — character creation page (real route).
 *
 * Mounts the existing Chargen surface inside a responsive standalone wrapper
 * (no sidebar; the player is mid-onboarding, the sidebar arrives at /play
 * after they finish). The surface itself reads `?campaign=…` and `?token=…`
 * from the URL when a player came in via /onboarding/[token].
 *
 * On submit, the surface creates the character row + attaches it to the
 * active character cert. After completion, the page redirects to /play.
 */

import * as React from 'react'
import Chargen from '@/components/design/surfaces/Chargen'

export default function ChargenPage() {
  // Wrapping container with responsive padding + a bordered max-width strip.
  // The inner Chargen is dense; let it breathe on desktop, fill on mobile.
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        padding: 14,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 980,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Character creation
          </h1>
          <a
            href="/"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--ink-3)',
              textDecoration: 'none',
            }}
          >
            ← landing
          </a>
        </div>
        <Chargen />
      </div>
    </div>
  )
}
