'use client'

/**
 * AppShell — 3-area responsive layout for the real (non-wireframe) app.
 *
 *   mobile  (<768): header bar + main; sidebar and communicator are
 *                   off-canvas drawers, toggled via header button + FAB.
 *   tablet  (>=768): sidebar pinned left in grid; communicator still drawer.
 *   desktop (>=1280): communicator pinned right in grid; FAB hidden.
 *
 * No fixed pixel widths in JS. All sizing comes from CSS variables in
 * `globals.css` (.app-shell, .app-sidebar, .app-communicator). See
 * `feedback_responsive_no_fixed_widths.md`.
 */

import * as React from 'react'

interface AppShellProps {
  /** Sidebar content — usually a <Sidebar> with <NavSection>s. */
  sidebar: React.ReactNode
  /** Optional right drawer content (chat / NPC dialogue / DM whisper). Omit to hide. */
  communicator?: React.ReactNode
  /** Title shown in the mobile header bar. */
  title?: string
  children: React.ReactNode
}

export function AppShell({ sidebar, communicator, title = 'Claude DM', children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [commOpen, setCommOpen] = React.useState(false)

  // Close sidebar on route change (any nav-item click) — listen for the click
  // bubbling up from inside .app-sidebar.
  const sidebarRef = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    const node = sidebarRef.current
    if (!node) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.nav-item')) setSidebarOpen(false)
    }
    node.addEventListener('click', close)
    return () => node.removeEventListener('click', close)
  }, [])

  // Lock body scroll while a drawer is open on mobile.
  React.useEffect(() => {
    if (sidebarOpen || commOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen, commOpen])

  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <button
          className="icon-btn"
          aria-label="open menu"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <h1>{title}</h1>
        <span style={{ flex: 1 }} />
        {communicator && (
          <button
            className="icon-btn"
            aria-label="open communicator"
            onClick={() => setCommOpen(true)}
          >
            💬
          </button>
        )}
      </header>

      <div
        className={`app-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      <aside
        ref={sidebarRef}
        className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}
        aria-label="primary navigation"
      >
        {sidebar}
      </aside>

      <main className="app-main">{children}</main>

      {communicator && (
        <>
          <aside
            className={`app-communicator ${commOpen ? 'open' : ''}`}
            aria-label="communicator"
          >
            {communicator}
          </aside>
          <button
            className="communicator-toggle"
            onClick={() => setCommOpen((v) => !v)}
            aria-label={commOpen ? 'close communicator' : 'open communicator'}
          >
            {commOpen ? '×' : '💬'}
          </button>
        </>
      )}
    </div>
  )
}
