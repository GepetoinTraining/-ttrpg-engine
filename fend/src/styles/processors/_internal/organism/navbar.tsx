import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// NAVBAR ORGANISM
// ============================================

export interface NavbarProps extends HTMLAttributes<HTMLElement> {
  logo?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}

export function Navbar({
  logo,
  children,
  actions,
  className = '',
  style,
  ...props
}: NavbarProps) {
  return (
    <nav
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '60px',
        padding: '0 20px',
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        ...style,
      }}
      {...props}
    >
      {/* Left: Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        {logo}
      </div>

      {/* Center: Navigation items */}
      {children && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          {children}
        </div>
      )}

      {/* Right: Actions */}
      {actions && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {actions}
        </div>
      )}
    </nav>
  )
}

// Navbar Item
export interface NavbarItemProps extends HTMLAttributes<HTMLAnchorElement> {
  href?: string
  active?: boolean
  icon?: ReactNode
  children: ReactNode
}

export function NavbarItem({
  href,
  active = false,
  icon,
  children,
  className = '',
  style,
  onClick,
  ...props
}: NavbarItemProps) {
  const Component = href ? 'a' : 'button'

  return (
    <Component
      href={href}
      onClick={onClick as any}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        background: active ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: active ? '#f59e0b' : '#94a3b8',
        fontSize: '0.875rem',
        fontWeight: 500,
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'background 150ms, color 150ms',
        ...style,
      }}
      onMouseEnter={(e: any) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
          e.currentTarget.style.color = '#e2e8f0'
        }
      }}
      onMouseLeave={(e: any) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#94a3b8'
        }
      }}
      {...props as any}
    >
      {icon}
      {children}
    </Component>
  )
}

// Navbar Brand/Logo
export interface NavbarBrandProps extends HTMLAttributes<HTMLAnchorElement> {
  href?: string
  children: ReactNode
}

export function NavbarBrand({
  href = '/',
  children,
  className = '',
  style,
  ...props
}: NavbarBrandProps) {
  return (
    <a
      href={href}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        color: '#f8fafc',
        fontFamily: '"Crimson Pro", Georgia, serif',
        fontSize: '1.25rem',
        fontWeight: 700,
        ...style,
      }}
      {...props}
    >
      {children}
    </a>
  )
}

// Navbar Divider
export function NavbarDivider({ className = '', style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        width: '1px',
        height: '24px',
        background: '#334155',
        margin: '0 8px',
        ...style,
      }}
      {...props}
    />
  )
}

// Navbar Group
export interface NavbarGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function NavbarGroup({
  children,
  className = '',
  style,
  ...props
}: NavbarGroupProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
