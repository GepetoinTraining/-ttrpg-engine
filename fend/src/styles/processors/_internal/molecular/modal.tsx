import { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// MODAL MOLECULE
// ============================================

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  title?: string
}

const SIZES = {
  sm: '400px',
  md: '500px',
  lg: '640px',
  xl: '800px',
  full: '100%',
}

export function Modal({
  open,
  onClose,
  children,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  title,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeOnEscape, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [open])

  // Focus trap
  useEffect(() => {
    if (open && contentRef.current) {
      contentRef.current.focus()
    }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose()
    }
  }

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'full' ? 0 : '16px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: SIZES[size],
          maxHeight: size === 'full' ? '100%' : 'calc(100vh - 32px)',
          background: '#1e293b',
          borderRadius: size === 'full' ? 0 : '12px',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
          animation: 'slideUp 200ms ease-out',
        }}
      >
        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
          }}>
            <h2
              id="modal-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#f8fafc',
                fontFamily: '"Crimson Pro", Georgia, serif',
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                padding: 0,
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'background 150ms, color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = '#f8fafc'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#94a3b8'
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  )

  // Render via portal
  return createPortal(modal, document.body)
}

// Modal Footer helper
export function ModalFooter({ children, className = '', style, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '12px',
        padding: '16px 20px',
        borderTop: '1px solid #334155',
        marginTop: 'auto',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Hook for modal state
export function useModal(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)

  const openModal = useCallback(() => setOpen(true), [])
  const closeModal = useCallback(() => setOpen(false), [])
  const toggleModal = useCallback(() => setOpen(o => !o), [])

  return { open, openModal, closeModal, toggleModal, setOpen }
}

// Need this import for useState in hook
import { useState } from 'react'
