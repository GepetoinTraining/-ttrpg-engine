import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// LIST MOLECULE
// ============================================

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  gap?: 'none' | 'sm' | 'md' | 'lg'
  dividers?: boolean
}

const GAPS = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '16px',
}

export function List({
  children,
  gap = 'sm',
  dividers = false,
  className = '',
  style,
  ...props
}: ListProps) {
  return (
    <div
      role="list"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: dividers ? '0' : GAPS[gap],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  selected?: boolean
  disabled?: boolean
  divider?: boolean
}

export function ListItem({
  children,
  leading,
  trailing,
  selected = false,
  disabled = false,
  divider = false,
  className = '',
  style,
  onClick,
  ...props
}: ListItemProps) {
  const isInteractive = !!onClick && !disabled

  return (
    <div
      role="listitem"
      className={className}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={isInteractive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(e as any)
        }
      } : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '6px',
        background: selected ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
        borderBottom: divider ? '1px solid rgba(255,255,255,0.05)' : 'none',
        cursor: isInteractive ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 150ms ease-out',
        ...(isInteractive && !selected ? {
          // Hover handled via CSS-in-JS
        } : {}),
        ...style,
      }}
      {...props}
    >
      {leading && (
        <span style={{ flexShrink: 0, color: '#64748b' }}>
          {leading}
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>

      {trailing && (
        <span style={{ flexShrink: 0, color: '#64748b' }}>
          {trailing}
        </span>
      )}
    </div>
  )
}

// List Header
export function ListHeader({ children, className = '', style, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={className}
      style={{
        padding: '8px 12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Empty state
export function ListEmpty({ children, className = '', style, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={className}
      style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
