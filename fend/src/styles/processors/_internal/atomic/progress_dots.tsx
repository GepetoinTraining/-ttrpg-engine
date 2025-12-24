import { Φ, field, getDefinition } from '../index'

// ============================================
// PROGRESS DOTS ATOM
// ============================================

export interface ProgressDotsProps {
  steps: string[]
  current: string
  className?: string
  style?: React.CSSProperties
}

export function ProgressDots({ steps, current, className = '', style }: ProgressDotsProps) {
  const currentIndex = steps.indexOf(current)

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
    >
      {steps.map((step, i) => {
        const variant = i === currentIndex ? 'current' : i < currentIndex ? 'active' : 'inactive'
        const physics = getDefinition('ProgressDot', variant)
        const tensor = Φ(field('ProgressDot', physics))

        return (
          <div
            key={step}
            style={{
              ...parseInlineStyle(tensor.css),
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i <= currentIndex ? '#f59e0b' : '#334155',
              transition: 'background 200ms, transform 200ms',
              transform: i === currentIndex ? 'scale(1.25)' : 'scale(1)',
            }}
          />
        )
      })}
    </div>
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
