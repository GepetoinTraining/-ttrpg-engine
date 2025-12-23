import { useState } from 'react'
import { Φ, field, getDefinition } from '../index'
import type { InputHTMLAttributes, ReactNode } from 'react'

// ============================================
// INPUT ATOM
// ============================================

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  size?: 'sm' | 'md' | 'lg'
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Input({
  label,
  error,
  hint,
  size = 'md',
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false)

  // Determine variant
  let variant = 'default'
  if (disabled) variant = 'disabled'
  else if (error) variant = 'error'
  else if (focused) variant = 'focused'

  const physics = getDefinition('Input', variant)
  const tensor = Φ(field('Input', physics))

  const sizeStyles = {
    sm: { padding: '6px 10px', fontSize: '0.875rem' },
    md: { padding: '10px 14px', fontSize: '1rem' },
    lg: { padding: '14px 18px', fontSize: '1.125rem' },
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    onBlur?.(e)
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {label && (
        <label style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#94a3b8',
        }}>
          {label}
        </label>
      )}

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}>
        {leftIcon && (
          <span style={{
            position: 'absolute',
            left: '12px',
            color: '#64748b',
            pointerEvents: 'none',
          }}>
            {leftIcon}
          </span>
        )}

        <input
          disabled={disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{
            width: '100%',
            color: '#e2e8f0',
            outline: 'none',
            ...parseInlineStyle(tensor.css),
            ...sizeStyles[size],
            paddingLeft: leftIcon ? '40px' : sizeStyles[size].padding.split(' ')[1],
            paddingRight: rightIcon ? '40px' : sizeStyles[size].padding.split(' ')[1],
          }}
          {...props}
        />

        {rightIcon && (
          <span style={{
            position: 'absolute',
            right: '12px',
            color: '#64748b',
          }}>
            {rightIcon}
          </span>
        )}
      </div>

      {(error || hint) && (
        <span style={{
          fontSize: '0.75rem',
          color: error ? '#ef4444' : '#64748b',
        }}>
          {error || hint}
        </span>
      )}
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
