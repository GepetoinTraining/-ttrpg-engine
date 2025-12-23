import { Badge } from '@styles/processors/_internal'
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface RollResultProps {
  expression: string
  rolls: number[]
  modifier: number
  total: number
  dc?: number
  advantage?: 'advantage' | 'disadvantage' | 'normal'
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showBreakdown?: boolean
}

export function RollResult({
  expression,
  rolls,
  modifier,
  total,
  dc,
  advantage = 'normal',
  label,
  size = 'md',
  showBreakdown = true,
}: RollResultProps) {
  const isNat20 = rolls.includes(20) && expression.toLowerCase().includes('d20')
  const isNat1 = rolls.includes(1) && expression.toLowerCase().includes('d20') && rolls.length === 1
  const success = dc !== undefined ? total >= dc : undefined

  const sizes = {
    sm: { total: '1.5rem', label: '0.6875rem', breakdown: '0.6875rem' },
    md: { total: '2rem', label: '0.75rem', breakdown: '0.75rem' },
    lg: { total: '3rem', label: '0.875rem', breakdown: '0.875rem' },
  }

  const getResultColor = () => {
    if (isNat20) return '#22c55e'
    if (isNat1) return '#ef4444'
    if (success === true) return '#22c55e'
    if (success === false) return '#ef4444'
    return '#f59e0b'
  }

  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      {/* Label */}
      {label && (
        <div style={{
          fontSize: sizes[size].label,
          color: '#94a3b8',
          fontWeight: 500,
        }}>
          {label}
        </div>
      )}

      {/* Main Result */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        {/* Advantage indicator */}
        {advantage !== 'normal' && (
          <div style={{ color: advantage === 'advantage' ? '#22c55e' : '#ef4444' }}>
            {advantage === 'advantage' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </div>
        )}

        {/* Total */}
        <div style={{
          fontSize: sizes[size].total,
          fontWeight: 700,
          color: getResultColor(),
          lineHeight: 1,
          position: 'relative',
        }}>
          {total}

          {/* Crit indicators */}
          {isNat20 && (
            <Sparkles
              size={12}
              style={{
                position: 'absolute',
                top: -4,
                right: -12,
                color: '#22c55e',
              }}
            />
          )}
        </div>

        {/* DC comparison */}
        {dc !== undefined && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: sizes[size].breakdown,
            color: '#64748b',
          }}>
            <span>vs</span>
            <Badge
              variant={success ? 'success' : 'danger'}
              style={{ fontSize: sizes[size].breakdown }}
            >
              DC {dc}
            </Badge>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {showBreakdown && (
        <div style={{
          fontSize: sizes[size].breakdown,
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{ color: '#94a3b8' }}>{expression}</span>
          {rolls.length > 0 && (
            <>
              <span>=</span>
              <span>[{rolls.map((r, i) => (
                <span
                  key={i}
                  style={{
                    color: r === 20 ? '#22c55e' : r === 1 ? '#ef4444' : '#e2e8f0',
                    fontWeight: (r === 20 || r === 1) ? 600 : 400,
                  }}
                >
                  {r}{i < rolls.length - 1 ? ', ' : ''}
                </span>
              ))}]</span>
              {modifier !== 0 && (
                <span style={{ color: modifier > 0 ? '#22c55e' : '#ef4444' }}>
                  {modifier > 0 ? '+' : ''}{modifier}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Success/Failure badge */}
      {success !== undefined && (
        <Badge variant={success ? 'success' : 'danger'}>
          {success ? 'Success' : 'Failure'}
          {isNat20 && ' (Critical!)'}
          {isNat1 && ' (Fumble!)'}
        </Badge>
      )}
    </div>
  )
}

// Compact inline version
export function InlineRollResult({
  expression,
  total,
  success,
}: {
  expression: string
  total: number
  success?: boolean
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      background: success === true
        ? 'rgba(34,197,94,0.2)'
        : success === false
          ? 'rgba(239,68,68,0.2)'
          : 'rgba(245,158,11,0.2)',
      borderRadius: '4px',
      fontSize: '0.875rem',
    }}>
      <span style={{ color: '#94a3b8' }}>{expression}:</span>
      <span style={{
        fontWeight: 600,
        color: success === true
          ? '#22c55e'
          : success === false
            ? '#ef4444'
            : '#f59e0b',
      }}>
        {total}
      </span>
    </span>
  )
}
