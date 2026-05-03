'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar, NavSection, NavItem } from '@/components/ui'
import { useActiveCharacter } from '../../_lib/use-active-character'

export function PlayerNav() {
  const pathname = usePathname() ?? ''
  const { cert, sheet } = useActiveCharacter({ withSheet: true })

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  const charName = sheet?.name ?? cert?.id?.slice(0, 8)

  return (
    <Sidebar
      header={
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
            {charName ?? 'Claude DM'}
          </h1>
          <span
            style={{
              fontFamily: 'var(--hand)',
              color: 'var(--accent-blue)',
              fontSize: 16,
              transform: 'rotate(-1.5deg)',
              display: 'inline-block',
              marginTop: 2,
            }}
          >
            player
          </span>
        </div>
      }
      footer={
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          {cert ? <>cert {cert.id.slice(0, 8)}…<br /></> : null}
          <a href="/" style={{ color: 'inherit' }}>← landing</a>
        </div>
      }
    >
      <NavSection label="Me">
        <NavItem href="/play" glyph="◆" active={isActive('/play', true)}>
          Home
        </NavItem>
        <NavItem href="/play/sheet" glyph="📜" active={isActive('/play/sheet')}>
          Sheet
        </NavItem>
        <NavItem href="/play/inventory" glyph="🎒" active={isActive('/play/inventory')}>
          Inventory
        </NavItem>
        <NavItem href="/play/followers" glyph="◇" active={isActive('/play/followers')}>
          Followers
        </NavItem>
      </NavSection>
      <NavSection label="Table">
        <NavItem href="/play/intent" glyph="✦" active={isActive('/play/intent')}>
          Make a choice
        </NavItem>
        <NavItem href="/play/holdings" glyph="◫" active={isActive('/play/holdings')}>
          Holdings
        </NavItem>
        <NavItem href="/play/journey" glyph="📖" active={isActive('/play/journey')}>
          Journey
        </NavItem>
      </NavSection>
    </Sidebar>
  )
}
