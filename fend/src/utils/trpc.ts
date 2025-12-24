import { createTRPCReact } from '@trpc/react-query'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../bend/src/api/router'

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>()

// Create vanilla client for non-React code (sync_store, etc)
export const vanillaTrpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_URL || '/api/trpc',
      async headers() {
        // Get auth token from Clerk (async!)
        const token = await (window as any).__clerk?.session?.getToken?.()
        return token ? { authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})

// Re-export types for convenience
export type { AppRouter }
