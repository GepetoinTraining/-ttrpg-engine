import { ReactNode } from 'react'
import { Eye, Lock } from 'lucide-react'

export interface GmOnlyProps {
  children: ReactNode
  isGM: boolean
  showIndicator?: boolean
  indicatorPosition?: 'top-left' | 'top-right' | 'inline'
  fallback?: ReactNode
}

/**
 * GmOnly - Wrapper that only renders content for GMs
 *
 * Usage:
 * <GmOnly isGM={isGM}>
 *   <SecretNpcMotivations npc={npc} />
 * </GmOnly>
 */
export function GmOnly({
  children,
  isGM,
  showIndicator = true,
  indicatorPosition = 'top-right',
  fallback = null,
}: GmOnlyProps) {
  if (!isGM) {
    return <>{fallback}</>
  }

  if (!showIndicator) {
    return <>{children}</>
  }

  const indicatorStyles: Record<string, React.CSSProperties> = {
    'top-left': {
      position: 'absolute',
      top: '-8px',
      left: '-8px',
    },
    'top-right': {
      position: 'absolute',
      top: '-8px',
      right: '-8px',
    },
    'inline': {
      display: 'inline-flex',
      marginRight: '8px',
    },
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* GM Indicator */}
      <div
        style={{
          ...indicatorStyles[indicatorPosition],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: indicatorPosition === 'inline' ? 'auto' : '20px',
          height: '20px',
          padding: indicatorPosition === 'inline' ? '2px 8px' : undefined,
          background: 'rgba(139, 92, 246, 0.9)',
          borderRadius: indicatorPosition === 'inline' ? '4px' : '50%',
          zIndex: 10,
        }}
        title="GM Only"
      >
        <Eye size={12} style={{ color: '#fff' }} />
        {indicatorPosition === 'inline' && (
          <span style={{
            fontSize: '0.625rem',
            fontWeight: 600,
            color: '#fff',
            marginLeft: '4px',
          }}>
            GM
          </span>
        )}
      </div>

      {children}
    </div>
  )
}

/**
 * GmOnlyInline - For inline text that only GMs should see
 */
export function GmOnlyInline({
  children,
  isGM,
}: {
  children: ReactNode
  isGM: boolean
}) {
  if (!isGM) return null

  return (
    <span style={{
      background: 'rgba(139, 92, 246, 0.2)',
      padding: '0 6px',
      borderRadius: '4px',
      fontSize: '0.875em',
    }}>
      <Eye size={10} style={{
        color: '#c4b5fd',
        marginRight: '4px',
        verticalAlign: 'middle',
      }} />
      {children}
    </span>
  )
}

/**
 * GmOnlySection - A clearly marked section for GM content
 */
export function GmOnlySection({
  children,
  isGM,
  title = 'GM Information',
}: {
  children: ReactNode
  isGM: boolean
  title?: string
}) {
  if (!isGM) return null

  return (
    <div style={{
      padding: '16px',
      background: 'rgba(139, 92, 246, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      marginTop: '16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
      }}>
        <Lock size={16} style={{ color: '#c4b5fd' }} />
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#c4b5fd',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {title}
        </span>
      </div>

      {children}
    </div>
  )
}
