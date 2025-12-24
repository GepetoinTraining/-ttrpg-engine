import { useState } from 'react'
import { Φ, field, getDefinition } from '../index'

// ============================================
// ROLE CARD MOLECULE
// ============================================

export interface RoleCardProps {
  icon: string
  title: string
  description: string
  selected: boolean
  onClick: () => void
  className?: string
  style?: React.CSSProperties
}

export function RoleCard({
  icon,
  title,
  description,
  selected,
  onClick,
  className = '',
  style,
}: RoleCardProps) {
  const [hover, setHover] = useState(false)

  const variant = selected ? 'selected' : hover ? 'hover' : 'idle'
  const physics = getDefinition('RoleCard', variant)
  const tensor = Φ(field('RoleCard', physics))

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        ...parseInlineStyle(tensor.css),
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        outline: 'none',
        ...style,
      }}
    >
      <div style={{
        fontSize: 32,
        lineHeight: 1,
        filter: selected ? 'none' : 'grayscale(50%)',
        transition: 'filter 200ms',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: selected ? '#f59e0b' : '#f1f5f9',
          transition: 'color 200ms',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: '0.8125rem',
          color: '#94a3b8',
          marginTop: 2,
        }}>
          {description}
        </div>
      </div>
      {selected && (
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0f172a',
          fontSize: 14,
          fontWeight: 700,
        }}>
          ✓
        </div>
      )}
    </button>
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
