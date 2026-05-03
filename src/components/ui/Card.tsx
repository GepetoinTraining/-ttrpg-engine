'use client'

/**
 * Card — universal container primitive for the real surfaces.
 *
 * Wraps the existing `.ui-card` CSS class. Supports a head row (title +
 * meta tag) and free children. No fixed widths — sizes to its container.
 *
 * Variants: `dashed` / `soft` / `filled` / `danger` / `gold`.
 */

import * as React from 'react'

interface CardProps {
  title?: React.ReactNode
  meta?: React.ReactNode
  variant?: 'plain' | 'dashed' | 'soft' | 'filled' | 'danger' | 'gold'
  /** Optional cap — default uncapped (fills container). */
  maxWidth?: number | string
  /** Optional flex prop when used inside a flex row. */
  flex?: number | string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function Card({
  title,
  meta,
  variant = 'plain',
  maxWidth,
  flex,
  className = '',
  style,
  children,
}: CardProps) {
  const variantClass = variant === 'plain' ? '' : variant
  return (
    <div
      className={`ui-card ${variantClass} ${className}`.trim()}
      style={{
        ...(maxWidth !== undefined ? { maxWidth } : {}),
        ...(flex !== undefined ? { flex } : {}),
        minWidth: 0,
        ...style,
      }}
    >
      {(title || meta) && (
        <div className="ui-card-head">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {meta && <span className="meta">{meta}</span>}
        </div>
      )}
      {children}
    </div>
  )
}
