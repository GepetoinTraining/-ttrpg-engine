import { ReactNode, CSSProperties } from 'react'
import { Spinner } from '@styles/processors/_internal'
import { Loader2, Sword, Shield, Scroll, Sparkles, Dice6 } from 'lucide-react'

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  variant?: 'spinner' | 'dots' | 'skeleton' | 'themed'
  theme?: 'default' | 'combat' | 'magic' | 'loot'
  fullPage?: boolean
  style?: CSSProperties
}

const THEMED_ICONS = {
  default: Loader2,
  combat: Sword,
  magic: Sparkles,
  loot: Dice6,
}

const THEMED_MESSAGES = {
  default: ['Loading...', 'Just a moment...', 'Preparing...'],
  combat: ['Rolling initiative...', 'Drawing weapons...', 'Entering battle...'],
  magic: ['Casting spell...', 'Channeling arcana...', 'Weaving magic...'],
  loot: ['Counting gold...', 'Identifying items...', 'Opening chest...'],
}

export function Loading({
  size = 'md',
  label,
  variant = 'spinner',
  theme = 'default',
  fullPage = false,
  style,
}: LoadingProps) {
  const sizes = {
    sm: { icon: 16, text: '0.75rem', padding: '8px' },
    md: { icon: 24, text: '0.875rem', padding: '16px' },
    lg: { icon: 32, text: '1rem', padding: '24px' },
    xl: { icon: 48, text: '1.25rem', padding: '32px' },
  }

  const { icon: iconSize, text: textSize, padding } = sizes[size]

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding,
    ...(fullPage && {
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.9)',
      zIndex: 9999,
    }),
    ...style,
  }

  const displayLabel = label || THEMED_MESSAGES[theme][Math.floor(Math.random() * 3)]

  if (variant === 'dots') {
    return (
      <div style={containerStyle}>
        <DotsLoader size={iconSize} />
        {displayLabel && (
          <span style={{ marginTop: '12px', fontSize: textSize, color: '#94a3b8' }}>
            {displayLabel}
          </span>
        )}
      </div>
    )
  }

  if (variant === 'themed') {
    const Icon = THEMED_ICONS[theme]
    return (
      <div style={containerStyle}>
        <div style={{
          animation: 'spin 1.5s linear infinite',
          color: '#f59e0b',
        }}>
          <Icon size={iconSize} />
        </div>
        {displayLabel && (
          <span style={{ marginTop: '12px', fontSize: textSize, color: '#94a3b8' }}>
            {displayLabel}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <Spinner size={size === 'xl' ? 'lg' : size} />
      {displayLabel && (
        <span style={{ marginTop: '12px', fontSize: textSize, color: '#94a3b8' }}>
          {displayLabel}
        </span>
      )}
    </div>
  )
}

function DotsLoader({ size }: { size: number }) {
  const dotSize = size / 4

  return (
    <div style={{ display: 'flex', gap: dotSize / 2 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: '#f59e0b',
            animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton loader for content placeholders
 */
export function Skeleton({
  width,
  height = '1em',
  rounded = false,
  className,
  style,
}: {
  width?: string | number
  height?: string | number
  rounded?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: rounded ? '50%' : '4px',
        background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/**
 * SkeletonText - Multiple skeleton lines
 */
export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
}: {
  lines?: number
  lastLineWidth?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          height="1em"
        />
      ))}
    </div>
  )
}

/**
 * SkeletonCard - Card-shaped skeleton
 */
export function SkeletonCard({
  hasImage = true,
  imageHeight = 120,
}: {
  hasImage?: boolean
  imageHeight?: number
}) {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #334155',
    }}>
      {hasImage && (
        <Skeleton width="100%" height={imageHeight} style={{ borderRadius: 0 }} />
      )}
      <div style={{ padding: '16px' }}>
        <Skeleton width="70%" height="1.25em" style={{ marginBottom: '12px' }} />
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

/**
 * LoadingOverlay - Overlay on existing content
 */
export function LoadingOverlay({
  isLoading,
  children,
  label,
}: {
  isLoading: boolean
  children: ReactNode
  label?: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      {children}

      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: 'inherit',
          zIndex: 10,
        }}>
          <Loading label={label} />
        </div>
      )}
    </div>
  )
}

/**
 * SuspenseFallback - For React Suspense boundaries
 */
export function SuspenseFallback({ message }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '200px',
      padding: '32px',
    }}>
      <Loading size="lg" label={message} variant="themed" />
    </div>
  )
}

// CSS keyframes (should be in globals.css but included here for reference)
const keyframes = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`
