import { Φ, field, getDefinition } from '../index'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

// ============================================
// BUTTON ATOM
// ============================================

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  style,
  ...props
}: ButtonProps) {
  // Get physics from definition
  const physics = getDefinition('Button', disabled ? 'disabled' : variant)

  // Compute tensor
  const tensor = Φ(field('Button', physics))

  // Size modifiers
  const sizeStyles: Record<string, string> = {
    sm: 'padding: 6px 12px; font-size: 0.875rem;',
    md: 'padding: 10px 18px; font-size: 1rem;',
    lg: 'padding: 14px 24px; font-size: 1.125rem;',
  }

  const combinedStyle = `
    ${tensor.css}
    ${sizeStyles[size]}
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 500;
    cursor: ${disabled || loading ? 'not-allowed' : 'pointer'};
    opacity: ${disabled ? 0.5 : 1};
    user-select: none;
    white-space: nowrap;
  `

  return (
    <button
      disabled={disabled || loading}
      className={className}
      style={{ ...parseInlineStyle(combinedStyle), ...style }}
      {...props}
    >
      {loading && <Spinner size={size === 'sm' ? 14 : 18} />}
      {children}
    </button>
  )
}

// Simple spinner for loading state
function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="32"
        strokeDashoffset="12"
      />
    </svg>
  )
}

// Helper to parse inline style string to object
function parseInlineStyle(styleString: string): React.CSSProperties {
  const style: Record<string, string> = {}

  styleString
    .split(';')
    .filter(Boolean)
    .forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim())
      if (property && value) {
        // Convert kebab-case to camelCase
        const camelProperty = property.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
        style[camelProperty] = value
      }
    })

  return style as React.CSSProperties
}
