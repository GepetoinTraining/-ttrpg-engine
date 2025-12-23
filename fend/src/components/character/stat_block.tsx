import { CSSProperties } from 'react'

export interface Stats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface StatBlockProps {
  stats: Stats
  size?: 'sm' | 'md' | 'lg'
  layout?: 'horizontal' | 'grid'
  showModifiers?: boolean
  highlightedStats?: (keyof Stats)[]
  style?: CSSProperties
}

const STAT_LABELS: Record<keyof Stats, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

const STAT_FULL_NAMES: Record<keyof Stats, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

export function StatBlock({
  stats,
  size = 'md',
  layout = 'horizontal',
  showModifiers = true,
  highlightedStats = [],
  style,
}: StatBlockProps) {
  const sizeStyles = {
    sm: { width: 48, fontSize: '0.75rem', modSize: '0.875rem' },
    md: { width: 64, fontSize: '0.875rem', modSize: '1.25rem' },
    lg: { width: 80, fontSize: '1rem', modSize: '1.5rem' },
  }

  const { width, fontSize, modSize } = sizeStyles[size]

  const containerStyle: CSSProperties = {
    display: layout === 'horizontal' ? 'flex' : 'grid',
    gridTemplateColumns: layout === 'grid' ? 'repeat(3, 1fr)' : undefined,
    gap: size === 'sm' ? '8px' : '12px',
    justifyContent: layout === 'horizontal' ? 'center' : undefined,
    ...style,
  }

  return (
    <div style={containerStyle}>
      {(Object.keys(stats) as (keyof Stats)[]).map(stat => {
        const value = stats[stat]
        const modifier = getModifier(value)
        const isHighlighted = highlightedStats.includes(stat)

        return (
          <div
            key={stat}
            title={STAT_FULL_NAMES[stat]}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: size === 'sm' ? '8px' : '12px',
              background: isHighlighted
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.1))'
                : '#1e293b',
              borderRadius: '8px',
              border: isHighlighted
                ? '1px solid rgba(245, 158, 11, 0.4)'
                : '1px solid #334155',
              minWidth: width,
            }}
          >
            {/* Stat Label */}
            <div style={{
              fontSize,
              fontWeight: 600,
              color: isHighlighted ? '#f59e0b' : '#94a3b8',
              marginBottom: '4px',
            }}>
              {STAT_LABELS[stat]}
            </div>

            {/* Modifier (large) */}
            {showModifiers && (
              <div style={{
                fontSize: modSize,
                fontWeight: 700,
                color: isHighlighted ? '#fcd34d' : '#e2e8f0',
                lineHeight: 1,
              }}>
                {modifier >= 0 ? `+${modifier}` : modifier}
              </div>
            )}

            {/* Score (small) */}
            <div style={{
              fontSize: size === 'sm' ? '0.625rem' : '0.75rem',
              color: '#64748b',
              marginTop: '4px',
            }}>
              {value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

// Compact inline stat display
export function StatInline({
  stat,
  value,
  showModifier = true
}: {
  stat: keyof Stats
  value: number
  showModifier?: boolean
}) {
  const modifier = getModifier(value)

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      background: '#1e293b',
      borderRadius: '4px',
      fontSize: '0.8125rem',
    }}>
      <span style={{ color: '#94a3b8', fontWeight: 500 }}>{STAT_LABELS[stat]}</span>
      <span style={{ color: '#e2e8f0' }}>{value}</span>
      {showModifier && (
        <span style={{ color: modifier >= 0 ? '#22c55e' : '#ef4444' }}>
          ({modifier >= 0 ? `+${modifier}` : modifier})
        </span>
      )}
    </span>
  )
}
