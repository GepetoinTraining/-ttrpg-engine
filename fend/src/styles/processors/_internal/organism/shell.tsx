import { useState, createContext, useContext, useCallback } from 'react'
import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// SHELL ORGANISM
// ============================================

interface ShellContextValue {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  collapseSidebar: () => void
  expandSidebar: () => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell() {
  const context = useContext(ShellContext)
  if (!context) {
    throw new Error('useShell must be used within Shell')
  }
  return context
}

export interface ShellProps extends HTMLAttributes<HTMLDivElement> {
  navbar?: ReactNode
  sidebar?: ReactNode
  children: ReactNode
  defaultSidebarOpen?: boolean
}

export function Shell({
  navbar,
  sidebar,
  children,
  defaultSidebarOpen = true,
  className = '',
  style,
  ...props
}: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), [])
  const collapseSidebar = useCallback(() => setSidebarCollapsed(true), [])
  const expandSidebar = useCallback(() => setSidebarCollapsed(false), [])

  const sidebarWidth = sidebar
    ? sidebarCollapsed ? '64px' : '260px'
    : '0px'

  return (
    <ShellContext.Provider value={{
      sidebarOpen,
      sidebarCollapsed,
      toggleSidebar,
      collapseSidebar,
      expandSidebar
    }}>
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          background: '#0f172a',
          ...style,
        }}
        {...props}
      >
        {/* Navbar */}
        {navbar && (
          <header style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            flexShrink: 0,
          }}>
            {navbar}
          </header>
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          {sidebar && (
            <>
              {/* Mobile overlay */}
              {sidebarOpen && (
                <div
                  onClick={toggleSidebar}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 30,
                    display: 'none', // Show only on mobile via media query
                  }}
                />
              )}

              {/* Sidebar container */}
              <aside
                style={{
                  width: sidebarWidth,
                  flexShrink: 0,
                  transition: 'width 200ms ease-out',
                  overflow: 'hidden',
                  borderRight: '1px solid #1e293b',
                  background: '#0f172a',
                  // Mobile: fixed position
                  // Desktop: static
                }}
              >
                <div style={{
                  width: sidebarCollapsed ? '64px' : '260px',
                  height: '100%',
                  overflow: 'auto',
                }}>
                  {sidebar}
                </div>
              </aside>
            </>
          )}

          {/* Main content */}
          <main style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {children}
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  )
}

// Content wrapper with max-width
export interface ShellContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: boolean
}

const MAX_WIDTHS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
}

export function ShellContent({
  children,
  maxWidth = 'xl',
  padding = true,
  className = '',
  style,
  ...props
}: ShellContentProps) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        maxWidth: MAX_WIDTHS[maxWidth],
        marginLeft: 'auto',
        marginRight: 'auto',
        padding: padding ? '24px' : 0,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Page header
export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className = '',
  style,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginBottom: '24px',
        ...style,
      }}
      {...props}
    >
      {breadcrumbs}

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.875rem',
            fontWeight: 700,
            color: '#f8fafc',
            fontFamily: '"Crimson Pro", Georgia, serif',
          }}>
            {title}
          </h1>
          {description && (
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '0.9375rem',
              color: '#94a3b8',
            }}>
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
