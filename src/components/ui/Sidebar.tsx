'use client'

/**
 * Sidebar — content shell for the left rail. Used inside AppShell.
 *
 * Renders header (campaign / cert / persona) on top, then NavSection
 * groups below. Footer is optional (typically a settings / log-out
 * link). All children flow vertically.
 */

import * as React from 'react'

interface SidebarProps {
  /** Top brand strip (campaign title, cert info, etc.). */
  header?: React.ReactNode
  /** Bottom footer content (settings link, persona indicator). */
  footer?: React.ReactNode
  children: React.ReactNode
}

export function Sidebar({ header, footer, children }: SidebarProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {header && (
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--rule-soft)' }}>
          {header}
        </div>
      )}
      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} aria-label="sidebar nav">
        {children}
      </nav>
      {footer && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule-soft)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}

interface NavSectionProps {
  label?: string
  children: React.ReactNode
}

export function NavSection({ label, children }: NavSectionProps) {
  return (
    <div className="nav-section">
      {label && <div className="nav-section-label">{label}</div>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

interface NavItemProps {
  /** href for navigation (passed to <a>). Use Next.js Link for app-local routes; this is a plain anchor. */
  href: string
  /** Glyph (emoji or single character) shown left of the label. */
  glyph?: React.ReactNode
  /** Whether this item represents the current route. */
  active?: boolean
  /** Optional onClick — typically used by Next Link wrapper, or to override navigation. */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  children: React.ReactNode
}

export function NavItem({ href, glyph, active = false, onClick, children }: NavItemProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`nav-item ${active ? 'active' : ''}`}
    >
      {glyph && <span className="glyph">{glyph}</span>}
      <span>{children}</span>
    </a>
  )
}
