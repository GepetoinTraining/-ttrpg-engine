/**
 * Browser-side campaign client.
 * Wraps /api/campaign/* endpoints.
 */

export interface CreateCampaignInput {
  name: string
  slug?: string
  worldSeed?: string
  region?: string
  tone?: string
  startingLevel?: number
  playMode?: 'GROUP_DM_AI' | 'GROUP_AI' | 'SOLO_AI' | 'TRUE_SOLO'
}

export interface CreateCampaignResult {
  campaignId: string
  adventureId: string
  partyId: string
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  return postJson('/api/campaign/create', input)
}

export async function inviteToCampaign(
  campaignId: string,
  requestedId: string,
  geo: { lat: number; lon: number }
): Promise<{ token: string; campaignId: string }> {
  return postJson(`/api/campaign/${campaignId}/invite`, { requestedId, geo })
}

/**
 * Build a shareable invite URL. The player visits this URL → Auth surface
 * picks up `?invite=TOKEN&campaign=CID` and runs the redeem flow.
 */
export function buildInviteUrl(token: string, campaignId: string): string {
  if (typeof window === 'undefined') {
    return `?invite=${encodeURIComponent(token)}&campaign=${encodeURIComponent(campaignId)}`
  }
  const url = new URL(window.location.href)
  url.searchParams.set('invite', token)
  url.searchParams.set('campaign', campaignId)
  url.hash = 'auth'
  return url.toString()
}

/**
 * Browser geolocation helper. Returns lat/lon, or a fallback {0, 0}
 * if the user denies / it times out (auth still works without real geo —
 * the seed depends on it but doesn't require a *real* place).
 */
export async function captureGeo(timeoutMs = 5000): Promise<{ lat: number; lon: number }> {
  if (typeof window === 'undefined' || !window.navigator?.geolocation) {
    return { lat: 0, lon: 0 }
  }
  return new Promise((resolve) => {
    let done = false
    const t = setTimeout(() => {
      if (!done) {
        done = true
        resolve({ lat: 0, lon: 0 })
      }
    }, timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return
        done = true
        clearTimeout(t)
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {
        if (done) return
        done = true
        clearTimeout(t)
        resolve({ lat: 0, lon: 0 })
      },
      { timeout: timeoutMs, enableHighAccuracy: false }
    )
  })
}
