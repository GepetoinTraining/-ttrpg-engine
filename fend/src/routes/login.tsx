import { ShellContent } from '@styles/processors/_internal'
import { SignInForm, RedirectIfAuth } from '@auth/provider'
import { RedirectIfAuth as RedirectGuard } from '@auth/guards'
import { Swords } from 'lucide-react'

export function LoginPage() {
  return (
    <RedirectGuard>
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

          <SignInForm />
        </div>
      </ShellContent>
    </RedirectGuard>
  )
}
