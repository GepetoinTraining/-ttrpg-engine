import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignIn, useAuth } from '@clerk/clerk-react'
import { ShellContent } from '@styles/processors/_internal'
import { Swords } from 'lucide-react'
import { useEffect } from 'react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

export function LoginPage() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      navigate({ to: '/' })
    }
  }, [isSignedIn])

  if (isSignedIn) return null

  return (
    <ShellContent maxWidth="sm">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 200px)',
        gap: '32px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Swords size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 700,
            color: '#f8fafc',
            fontFamily: '"Crimson Pro", Georgia, serif',
            margin: '0 0 8px',
          }}>
            Welcome Back
          </h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Sign in to continue your adventures
          </p>
        </div>

        <SignIn />
      </div>
    </ShellContent>
  )
}
