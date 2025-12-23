import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useRequireAuth } from './provider'

// ============================================
// ROUTE GUARDS
// ============================================

interface GuardProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Requires authentication - redirects to login if not signed in
 */
export function RequireAuth({ children, fallback }: GuardProps) {
  const { isLoading, isAuthenticated } = useRequireAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/login' })
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading) {
    return fallback || <LoadingScreen />
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return <>{children}</>
}

/**
 * Redirects authenticated users away (e.g., from login page)
 */
export function RedirectIfAuth({ children, to = '/' }: GuardProps & { to?: string }) {
  const { isLoading, isAuthenticated } = useRequireAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to })
    }
  }, [isLoading, isAuthenticated, navigate, to])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return null // Will redirect
  }

  return <>{children}</>
}

/**
 * Shows content only to GMs in the current campaign
 */
export function RequireGM({ children, campaignId }: GuardProps & { campaignId: string }) {
  // TODO: Check campaign membership role from tRPC query
  // For now, just render children
  return <>{children}</>
}

/**
 * Shows content only to campaign owner
 */
export function RequireOwner({ children, campaignId }: GuardProps & { campaignId: string }) {
  // TODO: Check campaign ownership from tRPC query
  // For now, just render children
  return <>{children}</>
}

// ============================================
// LOADING SCREEN
// ============================================

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Loading...</span>
      </div>
    </div>
  )
}
