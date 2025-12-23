import { Φ, field, getDefinition } from '../index'
import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// CARD MOLECULE
// ============================================

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'floating' | 'glass' | 'scene' | 'combat'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

const PADDING = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
}

export function Card({
  variant = 'default',
  padding = 'md',
  header,
  footer,
  children,
  className = '',
  style,
  ...props
}: CardProps) {
  const physics = getDefinition('Card', variant)
  const tensor = Φ(field('Card', physics))

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...parseInlineStyle(tensor.css),
        ...style,
      }}
      {...props}
    >
      {header && (
        <div style={{
          padding: PADDING[padding],
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          {header}
        </div>
      )}

      <div style={{ padding: PADDING[padding], flex: 1 }}>
        {children}
      </div>

      {footer && (
        <div style={{
          padding: PADDING[padding],
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}

// Card Header helper
export function CardHeader({ children, className = '', style, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Card Title helper
export function CardTitle({ children, className = '', style, ...props }: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h3
      className={className}
      style={{
        margin: 0,
        fontSize: '1.125rem',
        fontWeight: 600,
        color: '#f8fafc',
        fontFamily: '"Crimson Pro", Georgia, serif',
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
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
