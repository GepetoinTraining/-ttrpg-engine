import type { HTMLAttributes, ReactNode } from 'react'

// ============================================
// PILL ATOM
// ============================================

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  color?: 'slate' | 'red' | 'amber' | 'green' | 'blue' | 'purple'
  removable?: boolean
  onRemove?: () => void
}

const COLORS = {
  slate: { bg: 'rgba(100, 116, 139, 0.2)', text: '#94a3b8', border: '#475569' },
  red: { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5', border: '#dc2626' },
  amber: { bg: 'rgba(245, 158, 11, 0.2)', text: '#fcd34d', border: '#d97706' },
  green: { bg: 'rgba(34, 197, 94, 0.2)', text: '#86efac', border: '#16a34a' },
  blue: { bg: 'rgba(14, 165, 233, 0.2)', text: '#7dd3fc', border: '#0284c7' },
  purple: { bg: 'rgba(139, 92, 246, 0.2)', text: '#c4b5fd', border: '#7c3aed' },
}

export function Pill({
  children,
  color = 'slate',
  removable = false,
  onRemove,
  className = '',
  style,
  ...props
}: PillProps) {
  const colorScheme = COLORS[color]

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        fontSize: '0.75rem',
        fontWeight: 500,
        borderRadius: '9999px',
        background: colorScheme.bg,
        color: colorScheme.text,
        border: `1px solid ${colorScheme.border}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...props}
    >
      {children}
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove?.()
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '14px',
            height: '14px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            opacity: 0.7,
            transition: 'opacity 150ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          ×
        </button>
      )}
    </span>
  )
}
