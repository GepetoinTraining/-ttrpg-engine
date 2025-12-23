import { useAuth, useUser, SignIn, SignUp } from '@clerk/clerk-react'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

// ============================================
// AUTH CONTEXT
// ============================================

interface AuthContextValue {
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  user: {
    id: string
    email: string
    name: string
    imageUrl: string | null
  } | null
  getToken: () => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useAuth()
  const { user } = useUser()

  const value = useMemo<AuthContextValue>(() => ({
    isLoaded,
    isSignedIn: !!isSignedIn,
    userId: userId || null,
    user: user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      name: user.fullName || user.firstName || 'Unknown',
      imageUrl: user.imageUrl || null,
    } : null,
    getToken,
    signOut,
  }), [isLoaded, isSignedIn, userId, user, getToken, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================
// HOOKS
// ============================================

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}

export function useRequireAuth() {
  const auth = useAuthContext()

  if (!auth.isLoaded) {
    return { isLoading: true, isAuthenticated: false, user: null }
  }

  return {
    isLoading: false,
    isAuthenticated: auth.isSignedIn,
    user: auth.user,
  }
}

// ============================================
// COMPONENTS
// ============================================

export function SignInForm() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-slate-900 border border-slate-700',
        },
      }}
    />
  )
}

export function SignUpForm() {
  return (
    <SignUp
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-slate-900 border border-slate-700',
        },
      }}
    />
  )
}

// Re-export Clerk hooks for convenience
export { useAuth, useUser } from '@clerk/clerk-react'
