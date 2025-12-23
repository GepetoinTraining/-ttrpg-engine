import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

// ============================================
// TOAST MOLECULE
// ============================================

type ToastType = 'info' | 'success' | 'warning' | 'error'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

// Shorthand methods
export function useToastActions() {
  const { addToast } = useToast()

  return {
    info: (title: string, description?: string) =>
      addToast({ type: 'info', title, description }),
    success: (title: string, description?: string) =>
      addToast({ type: 'success', title, description }),
    warning: (title: string, description?: string) =>
      addToast({ type: 'warning', title, description }),
    error: (title: string, description?: string) =>
      addToast({ type: 'error', title, description }),
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { ...toast, id }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>,
    document.body
  )
}

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
  info: {
    bg: 'rgba(14, 165, 233, 0.1)',
    border: '#0ea5e9',
    icon: 'ℹ',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.1)',
    border: '#22c55e',
    icon: '✓',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.1)',
    border: '#f59e0b',
    icon: '⚠',
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.1)',
    border: '#ef4444',
    icon: '✕',
  },
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { type, title, description, duration = 5000 } = toast
  const styles = TYPE_STYLES[type]

  // Auto-dismiss
  useEffect(() => {
    if (duration <= 0) return

    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        background: '#1e293b',
        border: `1px solid ${styles.border}`,
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        minWidth: '300px',
        maxWidth: '420px',
        pointerEvents: 'auto',
        animation: 'slideUp 200ms ease-out',
      }}
    >
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: styles.bg,
        color: styles.border,
        fontSize: '12px',
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {styles.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#f8fafc',
          marginBottom: description ? '4px' : 0,
        }}>
          {title}
        </div>
        {description && (
          <div style={{
            fontSize: '0.8125rem',
            color: '#94a3b8',
          }}>
            {description}
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          padding: 0,
          border: 'none',
          borderRadius: '4px',
          background: 'transparent',
          color: '#64748b',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 150ms, color 150ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
          e.currentTarget.style.color = '#f8fafc'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#64748b'
        }}
      >
        ✕
      </button>
    </div>
  )
}

// Standalone toast (no provider needed)
export function toast(options: Omit<Toast, 'id'>) {
  // Create temporary container if needed
  let container = document.getElementById('toast-standalone')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-standalone'
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 9999;
    `
    document.body.appendChild(container)
  }

  const id = `toast-${Date.now()}`
  const div = document.createElement('div')
  div.id = id
  container.appendChild(div)

  const styles = TYPE_STYLES[options.type]

  div.innerHTML = `
    <div role="alert" style="
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #1e293b;
      border: 1px solid ${styles.border};
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      min-width: 300px;
      max-width: 420px;
      animation: slideUp 200ms ease-out;
    ">
      <span style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${styles.bg};
        color: ${styles.border};
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
      ">${styles.icon}</span>
      <div style="flex: 1;">
        <div style="font-size: 0.875rem; font-weight: 600; color: #f8fafc;">
          ${options.title}
        </div>
        ${options.description ? `
          <div style="font-size: 0.8125rem; color: #94a3b8; margin-top: 4px;">
            ${options.description}
          </div>
        ` : ''}
      </div>
    </div>
  `

  // Auto remove
  setTimeout(() => {
    div.style.animation = 'fadeOut 200ms ease-out'
    setTimeout(() => div.remove(), 200)
  }, options.duration || 5000)
}

// Shorthand functions
toast.info = (title: string, description?: string) => toast({ type: 'info', title, description })
toast.success = (title: string, description?: string) => toast({ type: 'success', title, description })
toast.warning = (title: string, description?: string) => toast({ type: 'warning', title, description })
toast.error = (title: string, description?: string) => toast({ type: 'error', title, description })
