import { Φ, field, getDefinition } from '../index'
import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// BADGE ATOM
// ============================================

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  dot?: boolean
  children?: ReactNode
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className = '',
  style,
  ...props
}: BadgeProps) {
  const physics = getDefinition('Badge', variant)
  const tensor = Φ(field('Badge', physics))

  const sizeStyles = {
    sm: dot
      ? 'width: 8px; height: 8px;'
      : 'padding: 2px 6px; font-size: 0.7rem;',
    md: dot
      ? 'width: 10px; height: 10px;'
      : 'padding: 3px 10px; font-size: 0.75rem;',
  }

  const computedStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    borderRadius: dot ? '50%' : '9999px',
    whiteSpace: 'nowrap',
    ...parseInlineStyle(tensor.css),
    ...parseInlineStyle(sizeStyles[size]),
    ...style,
  }

  return (
    <span className={className} style={computedStyle} {...props}>
      {!dot && children}
    </span>
  )
}

function parseInlineStyle(styleString: string): React.CSSProperties {
  const style: Record<string, string> = {}

  styleString
    .split(';')
    .filter(Boolean)
    .forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim())
      if (property && value) {
        const camelProperty = property.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
        style[camelProperty] = value
      }
    })

  return style as React.CSSProperties
}
