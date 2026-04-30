/**
 * Browser-side world helpers — calendar, weather, TPB.
 */

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
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

export interface CalendarData {
  adventure: { id: string; name: string }
  party: { currentTick: number; birthTick: number; level: number; name: string } | null
  today: number
  recentSessions: any[]
  upcoming: { id: string; eventType: string; title: string; description: string | null; sceneType: string; difficulty: string | null; worldDay: number }[]
}

export async function loadCalendar(opts: { adventureId?: string; campaignId?: string }): Promise<CalendarData> {
  const params = new URLSearchParams()
  if (opts.adventureId) params.set('adventureId', opts.adventureId)
  if (opts.campaignId) params.set('campaignId', opts.campaignId)
  return getJson<CalendarData>(`/api/world/calendar?${params}`)
}

export interface WeatherSnapshot {
  region: { id: string; name?: string } | null
  weather: {
    id: string
    regionId: string
    climate: string
    season: string
    temperature: number
    severity: number
    modifiersJson: string | null
  } | null
}
export interface WeatherAll {
  regions: any[]
  weather: any[]
}

export async function loadWeather(regionId?: string): Promise<WeatherSnapshot | WeatherAll> {
  const params = new URLSearchParams()
  if (regionId) params.set('regionId', regionId)
  return getJson(`/api/world/weather?${params}`)
}

export interface TPBEntry {
  id: number
  worldDay: number
  actionType: string
  targetId: string | null
  timestamp: string | null
  delta: any | null
}

export interface TPBList {
  entries: TPBEntry[]
  counts: Record<string, number>
  total: number
}

export async function loadTPB(opts: {
  sinceDay?: number
  untilDay?: number
  limit?: number
} = {}): Promise<TPBList> {
  const params = new URLSearchParams()
  if (opts.sinceDay != null) params.set('sinceDay', String(opts.sinceDay))
  if (opts.untilDay != null) params.set('untilDay', String(opts.untilDay))
  if (opts.limit != null) params.set('limit', String(opts.limit))
  return getJson<TPBList>(`/api/tpb/list?${params}`)
}
