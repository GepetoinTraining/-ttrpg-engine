import type { LucideIcon } from 'lucide-react'
import type { HTMLAttributes } from 'react'

// ============================================
// ICON ATOM
// ============================================

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  icon: LucideIcon
  size?: number | 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  strokeWidth?: number
}

const SIZES = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
}

export function Icon({
  icon: LucideIcon,
  size = 'md',
  color = 'currentColor',
  strokeWidth = 2,
  className = '',
  style,
  ...props
}: IconProps) {
  const pixelSize = typeof size === 'number' ? size : SIZES[size]

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: pixelSize,
        height: pixelSize,
        flexShrink: 0,
        ...style,
      }}
      {...props}
    >
      <LucideIcon
        size={pixelSize}
        color={color}
        strokeWidth={strokeWidth}
      />
    </span>
  )
}
