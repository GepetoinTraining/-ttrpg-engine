import { useState, ReactNode } from 'react'
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { Button, Badge } from '@styles/processors/_internal'

export interface SecretLayerProps {
  children: ReactNode
  secretContent: ReactNode
  isGM: boolean
  requiredPerception?: number
  playerPerception?: number
  isRevealed?: boolean
  onReveal?: () => void
  revealedTo?: string[]
  label?: string
}

/**
 * SecretLayer - Wraps content that may have hidden information
 *
 * For GMs: Shows both public and secret content
 * For Players: Shows public content, secret shown only if perception check passes
 *              or if explicitly revealed
 */
export function SecretLayer({
  children,
  secretContent,
  isGM,
  requiredPerception,
  playerPerception,
  isRevealed = false,
  onReveal,
  revealedTo = [],
  label = 'Secret',
}: SecretLayerProps) {
  const [showSecret, setShowSecret] = useState(false)

  // Determine if player can see the secret
  const playerCanSee = isRevealed ||
    (requiredPerception !== undefined &&
     playerPerception !== undefined &&
     playerPerception >= requiredPerception)

  // GM always sees everything
  if (isGM) {
    return (
      <div style={{ position: 'relative' }}>
        {/* Public content */}
        {children}

        {/* Secret indicator & content */}
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={14} style={{ color: '#c4b5fd' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c4b5fd' }}>
                {label.toUpperCase()}
              </span>
              {requiredPerception && (
                <Badge variant="default" style={{ fontSize: '0.625rem' }}>
                  DC {requiredPerception}
                </Badge>
              )}
              {isRevealed && (
                <Badge variant="success" style={{ fontSize: '0.625rem' }}>
                  Revealed
                </Badge>
              )}
            </div>

            {onReveal && !isRevealed && (
              <Button variant="ghost" size="sm" onClick={onReveal}>
                <Unlock size={14} /> Reveal
              </Button>
            )}
          </div>

          <div style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>
            {secretContent}
          </div>

          {revealedTo.length > 0 && (
            <div style={{
              marginTop: '8px',
              fontSize: '0.6875rem',
              color: '#64748b'
            }}>
              Revealed to: {revealedTo.join(', ')}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Player view
  if (!playerCanSee) {
    // Player can't see the secret - show only public content
    return <>{children}</>
  }

  // Player can see the secret
  return (
    <div style={{ position: 'relative' }}>
      {children}

      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: 'rgba(34, 197, 94, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(34, 197, 94, 0.3)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <Eye size={14} style={{ color: '#86efac' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#86efac' }}>
            DISCOVERED
          </span>
        </div>

        <div style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>
          {secretContent}
        </div>
      </div>
    </div>
  )
}

/**
 * HiddenText - Inline text that can be revealed
 */
export function HiddenText({
  children,
  isGM,
  isRevealed = false,
  revealOnHover = false,
}: {
  children: ReactNode
  isGM: boolean
  isRevealed?: boolean
  revealOnHover?: boolean
}) {
  const [isHovered, setIsHovered] = useState(false)

  const shouldShow = isGM || isRevealed || (revealOnHover && isHovered)

  return (
    <span
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: shouldShow ? 'rgba(139, 92, 246, 0.2)' : '#1e293b',
        color: shouldShow ? '#e2e8f0' : '#1e293b',
        padding: '0 4px',
        borderRadius: '2px',
        cursor: revealOnHover ? 'help' : 'default',
        transition: 'all 200ms',
        userSelect: shouldShow ? 'auto' : 'none',
      }}
    >
      {children}
    </span>
  )
}

/**
 * PerceptionGate - Only renders children if perception check passes
 */
export function PerceptionGate({
  children,
  requiredDC,
  playerPerception,
  isGM,
  fallback,
}: {
  children: ReactNode
  requiredDC: number
  playerPerception?: number
  isGM: boolean
  fallback?: ReactNode
}) {
  const passes = isGM || (playerPerception !== undefined && playerPerception >= requiredDC)

  if (passes) {
    return <>{children}</>
  }

  return fallback ? <>{fallback}</> : null
}
