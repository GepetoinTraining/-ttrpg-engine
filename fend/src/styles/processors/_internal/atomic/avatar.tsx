import type { HTMLAttributes } from 'react'

// ============================================
// AVATAR ATOM
// ============================================

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'away' | 'busy'
}

const SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
}

const STATUS_COLORS = {
  online: '#22c55e',
  offline: '#64748b',
  away: '#f59e0b',
  busy: '#ef4444',
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  status,
  className = '',
  style,
  ...props
}: AvatarProps) {
  const pixelSize = SIZES[size]
  const initials = name ? getInitials(name) : '?'
  const fontSize = pixelSize * 0.4

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: pixelSize,
        height: pixelSize,
        borderRadius: '50%',
        flexShrink: 0,
        ...style,
      }}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: getAvatarColor(name || 'Unknown'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          style={{
            position: 'absolute',
            bottom: size === 'xs' ? -1 : 0,
            right: size === 'xs' ? -1 : 0,
            width: pixelSize * 0.3,
            height: pixelSize * 0.3,
            borderRadius: '50%',
            background: STATUS_COLORS[status],
            border: '2px solid #0f172a',
          }}
        />
      )}
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
}

function getAvatarColor(name: string): string {
  const colors = [
    '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}
