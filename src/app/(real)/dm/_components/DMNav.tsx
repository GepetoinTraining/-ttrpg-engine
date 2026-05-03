'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar, NavSection, NavItem } from '@/components/ui'
import { loadAccount, type AccountCert } from '@/lib/account-cert'

export function DMNav() {
  const pathname = usePathname() ?? ''
  const [cert, setCert] = React.useState<AccountCert | null>(null)

  React.useEffect(() => {
    loadAccount().then(setCert).catch(() => setCert(null))
  }, [])

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sidebar
      header={
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
            Claude DM
          </h1>
          <span
            style={{
              fontFamily: 'var(--hand)',
              color: 'var(--accent-red)',
              fontSize: 16,
              transform: 'rotate(-1.5deg)',
              display: 'inline-block',
              marginTop: 2,
            }}
          >
            DM + AI
          </span>
        </div>
      }
      footer={
        cert ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
            cert {cert.id.slice(0, 8)}…
            <br />
            <a href="/" style={{ color: 'inherit' }}>← landing</a>
            {' · '}
            <a href="/wireframe" style={{ color: 'inherit' }}>wireframe</a>
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
            no cert · <a href="/" style={{ color: 'inherit' }}>back to landing</a>
          </div>
        )
      }
    >
      <NavSection label="Table">
        <NavItem href="/dm" glyph="◆" active={isActive('/dm', true)}>
          DM home
        </NavItem>
        <NavItem href="/dm/party" glyph="👥" active={isActive('/dm/party')}>
          Party
        </NavItem>
        <NavItem href="/dm/npcs" glyph="◇" active={isActive('/dm/npcs')}>
          NPCs
        </NavItem>
        <NavItem href="/dm/holdings" glyph="◫" active={isActive('/dm/holdings')}>
          Holdings
        </NavItem>
      </NavSection>
      <NavSection label="Live">
        <NavItem href="/dm/tactical" glyph="⚔" active={isActive('/dm/tactical')}>
          Tactical
        </NavItem>
        <NavItem href="/dm/studies" glyph="📜" active={isActive('/dm/studies')}>
          Studies
        </NavItem>
      </NavSection>
    </Sidebar>
  )
}
