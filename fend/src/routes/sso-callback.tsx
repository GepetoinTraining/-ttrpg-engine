import { createFileRoute } from '@tanstack/react-router'
import { useClerk } from '@clerk/clerk-react'
import { useEffect } from 'react'

export const Route = createFileRoute('/sso-callback')({
  component: SSOCallback,
})

function SSOCallback() {
  const { handleRedirectCallback } = useClerk()

  useEffect(() => {
    async function handleCallback() {
      try {
        await handleRedirectCallback()
        // Redirect to home after successful auth
        window.location.href = '/'
      } catch (error) {
        console.error('SSO callback error:', error)
        window.location.href = '/login'
      }
    }

    handleCallback()
  }, [handleRedirectCallback])

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      <p>Completing sign in...</p>
    </div>
  )
}
