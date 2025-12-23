import type { HTMLAttributes } from 'react'

// ============================================
// SPINNER ATOM
// ============================================

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  color?: string
  label?: string
}

const SIZES = {
  sm: 16,
  md: 24,
  lg: 40,
}

export function Spinner({
  size = 'md',
  color = '#f59e0b',
  label,
  className = '',
  style,
  ...props
}: SpinnerProps) {
  const pixelSize = SIZES[size]

  return (
    <div
      role="status"
      aria-label={label || 'Loading'}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        ...style,
      }}
      {...props}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'spin 1s linear infinite' }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="32"
          strokeDashoffset="12"
          opacity="0.3"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="32"
          strokeDashoffset="64"
        />
      </svg>
      {label && (
        <span style={{ fontSize: size === 'sm' ? '0.75rem' : '0.875rem', color: '#94a3b8' }}>
          {label}
        </span>
      )}
    </div>
  )
}

// Full-page loading state
export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
      }}
    >
      <Spinner size="lg" />
      <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
        {message}
      </span>
    </div>
  )
}
