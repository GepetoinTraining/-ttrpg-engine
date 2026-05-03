/**
 * Browser-side spectrum subscription (W3.4).
 *
 * Wraps `EventSource` against `/api/world/spectrum`. Auto-reconnects when
 * the server hits its max-stream-time. Falls back to polling-via-fetch if
 * `EventSource` isn't available or the connection fails repeatedly.
 *
 * Public API (mirrors the railgun "orbit consumes envelopes" idea):
 *   const sub = subscribeSpectrum({ sinceId: 0, onEnvelope, onError })
 *   ...
 *   sub.close()
 */

import { fetchWorldLog } from './world-client'

export interface SpectrumEnvelope {
  id: number
  worldDay: number
  realTs: string | null
  action: { type: string; [k: string]: unknown }
}

export interface SubscribeOpts {
  /** Last id seen — only envelopes with id > sinceId will be delivered. */
  sinceId?: number
  /** Called for each new envelope from the spectrum. */
  onEnvelope: (envelope: SpectrumEnvelope) => void
  /** Optional error notification. */
  onError?: (msg: string) => void
}

export interface Subscription {
  close: () => void
  /** Currently-known last id received (advances as envelopes arrive). */
  lastId: () => number
}

/**
 * Subscribe to the world spectrum. Returns a `Subscription` handle with
 * `close()` to tear down. Auto-reconnects through transient failures.
 */
export function subscribeSpectrum(opts: SubscribeOpts): Subscription {
  let lastId = opts.sinceId ?? 0
  let closed = false
  let es: EventSource | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let failureCount = 0
  const FALLBACK_AFTER_FAILURES = 3
  const POLL_FALLBACK_MS = 5000

  const startEventSource = () => {
    if (closed) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      startPollingFallback()
      return
    }
    try {
      es = new EventSource(`/api/world/spectrum?sinceId=${lastId}`)
    } catch (e: unknown) {
      opts.onError?.(e instanceof Error ? e.message : 'eventsource_construct_failed')
      startPollingFallback()
      return
    }

    es.addEventListener('envelope', (ev: MessageEvent) => {
      try {
        const env = JSON.parse(ev.data) as SpectrumEnvelope
        if (env.id > lastId) lastId = env.id
        opts.onEnvelope(env)
        failureCount = 0
      } catch {
        // skip malformed
      }
    })

    es.addEventListener('reconnect', () => {
      es?.close()
      es = null
      if (!closed) startEventSource()
    })

    es.addEventListener('error', () => {
      if (closed) return
      es?.close()
      es = null
      failureCount++
      if (failureCount >= FALLBACK_AFTER_FAILURES) {
        opts.onError?.('spectrum_unreachable_falling_back')
        startPollingFallback()
        return
      }
      setTimeout(startEventSource, 1000 * failureCount)
    })
  }

  const startPollingFallback = () => {
    if (closed) return
    const tick = async () => {
      if (closed) return
      try {
        const entries = await fetchWorldLog(50)
        for (const e of entries) {
          if (e.id > lastId) {
            opts.onEnvelope({
              id: e.id,
              worldDay: e.worldDay,
              realTs: e.realTs,
              action: e.action,
            })
            lastId = e.id
          }
        }
      } catch (err: unknown) {
        opts.onError?.(err instanceof Error ? err.message : 'fallback_poll_failed')
      }
      if (!closed) pollTimer = setTimeout(tick, POLL_FALLBACK_MS)
    }
    pollTimer = setTimeout(tick, 0)
  }

  startEventSource()

  return {
    close: () => {
      closed = true
      es?.close()
      es = null
      if (pollTimer) clearTimeout(pollTimer)
    },
    lastId: () => lastId,
  }
}
