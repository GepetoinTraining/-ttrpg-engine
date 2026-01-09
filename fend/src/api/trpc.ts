import { createTRPCProxyClient, httpBatchLink, loggerLink } from '@trpc/client'
import type { AppRouter } from '../../../bend/src/api/router'

// Debug mode - set to true to see all tRPC traffic
const DEBUG = true

// Storage key for certificate
const STORAGE_KEY_CERT = 'topology-cert'

/**
 * Get certificate hash from localStorage
 * This is used for quick auth (no challenge/response)
 */
async function getCertificateHash(): Promise<string | null> {
  try {
    const cert = localStorage.getItem(STORAGE_KEY_CERT)
    if (!cert) return null

    // Parse certificate
    const decoded = atob(cert)
    const parsed = JSON.parse(decoded)

    if (!parsed.seed || !parsed.deviceId) return null

    // Compute hash: sha256 of "cert:{seed}:{deviceId}"
    const data = `cert:${parsed.seed}:${parsed.deviceId}`
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    return hashHex
  } catch (e) {
    console.error('[Auth] Failed to get certificate hash:', e)
    return null
  }
}

/**
 * Get current campaign ID from store
 */
function getCurrentCampaignId(): string | null {
  // Read directly from localStorage to avoid circular dependency with Pinia
  return localStorage.getItem('current-campaign-id')
}

/**
 * Get topology auth headers for requests
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  // Add auth header
  const certHash = await getCertificateHash()
  if (certHash) {
    headers['x-topology-cert'] = certHash
  }

  // Add campaign context header
  const campaignId = getCurrentCampaignId()
  if (campaignId) {
    headers['x-campaign-id'] = campaignId
  }

  return headers
}

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    // Logger link - logs all requests/responses
    loggerLink({
      enabled: () => DEBUG,
      colorMode: 'ansi',
      console: {
        log: (...args) => {
          console.log('[tRPC]', ...args)
        },
        error: (...args) => {
          console.error('[tRPC ERROR]', ...args)
        },
      },
    }),
    httpBatchLink({
      url: '/api/trpc',
      headers: async () => {
        // Add topology auth headers to every request
        return await getAuthHeaders()
      },
      // Add request logging
      fetch: async (url, options) => {
        if (DEBUG) {
          console.log('[tRPC Request]', {
            url,
            method: options?.method,
            headers: options?.headers,
            body: options?.body ? JSON.parse(options.body as string) : undefined,
          })
        }

        const start = performance.now()
        const response = await fetch(url, options)
        const duration = performance.now() - start

        if (DEBUG) {
          const clone = response.clone()
          try {
            const data = await clone.json()
            console.log('[tRPC Response]', {
              status: response.status,
              duration: `${duration.toFixed(0)}ms`,
              data,
            })
          } catch {
            console.log('[tRPC Response]', {
              status: response.status,
              duration: `${duration.toFixed(0)}ms`,
              body: await clone.text(),
            })
          }
        }

        return response
      },
    }),
  ],
})

/**
 * Create a tRPC client with full auth (challenge/response)
 * Use this for sensitive operations
 */
export async function createAuthenticatedClient() {
  // Dynamic import to avoid circular dependency
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()

  const headers = await authStore.getFullAuthHeaders()

  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        headers: () => headers,
      }),
    ],
  })
}
