import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ClerkProvider } from '@clerk/clerk-react'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import { trpc } from '@api/trpc'
import { router } from './router'

// Clerk publishable key - set in .env
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY - auth will not work')
}

export function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }))

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers() {
            return {
              // Clerk token will be added by interceptor
            }
          },
        }),
      ],
    })
  )

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY || ''}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </trpc.Provider>
    </ClerkProvider>
  )
}
