import { useState, useRef, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

// ============================================
// DROPDOWN MOLECULE
// ============================================

export interface DropdownOption<T = string> {
  value: T
  label: string
  icon?: ReactNode
  disabled?: boolean
}

export interface DropdownProps<T = string> {
  options: DropdownOption<T>[]
  value?: T
  onChange?: (value: T) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  label?: string
  className?: string
}

export function Dropdown<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  error,
  label,
  className = '',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)

  // Close on outside click
  useEffect(() => {
    if (!open) return

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open && highlightedIndex >= 0) {
          const option = options[highlightedIndex]
          if (!option.disabled) {
            onChange?.(option.value)
            setOpen(false)
          }
        } else {
          setOpen(true)
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!open) {
          setOpen(true)
        } else {
          setHighlightedIndex(i => Math.min(i + 1, options.length - 1))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(i => Math.max(i - 1, 0))
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }, [open, highlightedIndex, options, disabled, onChange])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      {label && (
        <label style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#94a3b8',
        }}>
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(!open)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '10px 14px',
            background: '#1e293b',
            border: `1px solid ${error ? '#ef4444' : open ? '#f59e0b' : '#334155'}`,
            borderRadius: '8px',
            color: selectedOption ? '#e2e8f0' : '#64748b',
            fontSize: '1rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'border-color 150ms',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedOption?.icon}
            {selectedOption?.label || placeholder}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              transition: 'transform 150ms',
              transform: open ? 'rotate(180deg)' : 'rotate(0)',
            }}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              zIndex: 50,
              maxHeight: '240px',
              overflow: 'auto',
              animation: 'slideUp 150ms ease-out',
            }}
          >
            {options.map((option, index) => (
              <div
                key={String(option.value)}
                onClick={() => {
                  if (!option.disabled) {
                    onChange?.(option.value)
                    setOpen(false)
                  }
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  color: option.disabled ? '#475569' : '#e2e8f0',
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                  background:
                    option.value === value ? 'rgba(245, 158, 11, 0.15)' :
                    highlightedIndex === index ? 'rgba(255, 255, 255, 0.05)' :
                    'transparent',
                  transition: 'background 100ms',
                }}
              >
                {option.icon}
                {option.label}
                {option.value === value && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ marginLeft: 'auto' }}
                  >
                    <path
                      d="M13 4L6 11L3 8"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
          {error}
        </span>
      )}
    </div>
  )
}
