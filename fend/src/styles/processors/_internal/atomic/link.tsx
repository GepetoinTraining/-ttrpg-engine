/**
 * LINK - Prime 17
 * Traversal. Connection between realities.
 * Seventeen: the first prime that stays prime when reversed.
 */

import { Link as RouterLink } from '@tanstack/react-router'
import { Φ, field, getDefinition } from '../index'
import type { ReactNode } from 'react'

// ============================================
// LINK ATOM
// ============================================

export interface LinkProps {
  to: string
  children: ReactNode
  external?: boolean
  variant?: 'default' | 'muted' | 'action'
  className?: string
  style?: React.CSSProperties
}

export function Link({
  to,
  children,
  external = false,
  variant = 'default',
  className = '',
  style,
}: LinkProps) {
  const physics = getDefinition('Link', variant)
  const tensor = Φ(field('Link', physics))

  const baseStyle: React.CSSProperties = {
    ...parseInlineStyle(tensor.css),
    color: 'var(--info, #0ea5e9)',
    textDecoration: 'none',
    cursor: 'pointer',
    ...style,
  }

  // External link - use regular anchor
  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={baseStyle}
      >
        {children} ↗
      </a>
    )
  }

  // Internal link - use router
  return (
    <RouterLink
      to={to}
      className={className}
      style={baseStyle}
    >
      {children}
    </RouterLink>
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
