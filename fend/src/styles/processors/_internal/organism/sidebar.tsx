import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// SIDEBAR ORGANISM
// ============================================

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  collapsed?: boolean
}

export function Sidebar({
  header,
  footer,
  children,
  collapsed = false,
  className = '',
  style,
  ...props
}: SidebarProps) {
  return (
    <nav
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: collapsed ? '12px 8px' : '12px',
        ...style,
      }}
      {...props}
    >
      {header && (
        <div style={{
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #1e293b',
        }}>
          {header}
        </div>
      )}

      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {children}
      </div>

      {footer && (
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #1e293b',
        }}>
          {footer}
        </div>
      )}
    </nav>
  )
}

// Sidebar Section
export interface SidebarSectionProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  children: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function SidebarSection({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className = '',
  style,
  ...props
}: SidebarSectionProps) {
  return (
    <div
      className={className}
      style={{
        marginBottom: '16px',
        ...style,
      }}
      {...props}
    >
      {title && (
        <div style={{
          padding: '8px 12px',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {title}
        </div>
      )}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {children}
      </div>
    </div>
  )
}

// Sidebar Item
export interface SidebarItemProps extends HTMLAttributes<HTMLAnchorElement> {
  href?: string
  active?: boolean
  icon?: ReactNode
  badge?: ReactNode
  disabled?: boolean
  children: ReactNode
  collapsed?: boolean
}

export function SidebarItem({
  href,
  active = false,
  icon,
  badge,
  disabled = false,
  children,
  collapsed = false,
  className = '',
  style,
  onClick,
  ...props
}: SidebarItemProps) {
  const Component = href ? 'a' : 'button'

  return (
    <Component
      href={disabled ? undefined : href}
      onClick={disabled ? undefined : onClick as any}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : '12px',
        padding: collapsed ? '10px' : '10px 12px',
        background: active ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: disabled ? '#475569' : active ? '#f59e0b' : '#94a3b8',
        fontSize: '0.875rem',
        fontWeight: 500,
        textDecoration: 'none',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms, color 150ms',
        width: '100%',
        ...style,
      }}
      onMouseEnter={(e: any) => {
        if (!active && !disabled) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
          e.currentTarget.style.color = '#e2e8f0'
        }
      }}
      onMouseLeave={(e: any) => {
        if (!active && !disabled) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#94a3b8'
        }
      }}
      {...props as any}
    >
      {icon && (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          flexShrink: 0,
        }}>
          {icon}
        </span>
      )}

      {!collapsed && (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {children}
          </span>

          {badge && (
            <span style={{ flexShrink: 0 }}>
              {badge}
            </span>
          )}
        </>
      )}
    </Component>
  )
}

// Sidebar Divider
export function SidebarDivider({ className = '', style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        height: '1px',
        background: '#1e293b',
        margin: '8px 0',
        ...style,
      }}
      {...props}
    />
  )
}

// Sidebar Collapse Toggle
export interface SidebarCollapseProps extends HTMLAttributes<HTMLButtonElement> {
  collapsed: boolean
  onToggle: () => void
}

export function SidebarCollapse({
  collapsed,
  onToggle,
  className = '',
  style,
  ...props
}: SidebarCollapseProps) {
  return (
    <button
      onClick={onToggle}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '8px',
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: '#64748b',
        cursor: 'pointer',
        transition: 'background 150ms, color 150ms',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
        e.currentTarget.style.color = '#94a3b8'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#64748b'
      }}
      {...props}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{
          transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 200ms',
        }}
      >
        <path
          d="M10 12L6 8L10 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
