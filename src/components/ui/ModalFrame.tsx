'use client'

/**
 * ModalFrame — extracted from src/components/design/dungeon/DungeonModals.tsx.
 *
 * Generic dialog frame: dimmed backdrop, centered card, esc-to-close,
 * click-outside-to-close. Width is `max-width` only — never fixed pixel
 * (per `feedback_responsive_no_fixed_widths.md`). Children flow vertically.
 */

import * as React from 'react'

interface ModalFrameProps {
  title: string
  subtitle?: string
  onClose: () => void
  /** max-width cap; defaults to 480 — set higher for wide modals or pass null for unconstrained. */
  maxWidth?: number | string | null
  /** Optional sticky footer. */
  footer?: React.ReactNode
  children: React.ReactNode
}

export function ModalFrame({
  title,
  subtitle,
  onClose,
  maxWidth = 480,
  footer,
  children,
}: ModalFrameProps) {
  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(31,27,22,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--paper)',
          border: '2px solid var(--ink)',
          boxShadow: '6px 6px 0 var(--ink)',
          width: '100%',
          maxWidth: maxWidth === null ? undefined : maxWidth,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            padding: '14px 16px 10px',
            borderBottom: '1px solid var(--rule-soft)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {subtitle && (
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {subtitle}
              </div>
            )}
            <div
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.2,
                marginTop: subtitle ? 2 : 0,
              }}
            >
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              fontSize: 22,
              background: 'transparent',
              border: 'none',
              color: 'var(--ink)',
              cursor: 'pointer',
              padding: '0 8px',
              marginLeft: 8,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>{children}</div>

        {footer && (
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--rule-soft)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
