/**
 * GET /api/world/spectrum  — Server-Sent Events stream of TPB entries.
 *
 * W3.4 v1 transport for the railgun spectrum (per `docs/railgun-bridge.md`).
 * In v1 this is a thin SSE wrapper around `/api/world/log` polling — every
 * connected client gets new tpb_entries pushed as they're appended (within
 * the poll cadence, ~1s).
 *
 * V2 will swap the internal poll for a notification fanout when the drain
 * job runs (still in-memory orchestrator; multi-instance routing is post-
 * prod). The public API of `subscribe → consume envelope` doesn't change.
 *
 * Public-readable: same access policy as `/api/world/log` — anyone can
 * subscribe to the spectrum. Cert-bearer auth is enforced at the
 * action-producing endpoints (slot/push), not on the read side.
 */

import { NextRequest } from 'next/server'
import { db } from '@/db/connection'
import { tpbEntries } from '@/db/schema'
import { gt, asc } from 'drizzle-orm'

// Cadence of internal poll within the SSE handler. Lower = lower latency,
// higher CPU. 1s is a reasonable balance for v1.
const POLL_INTERVAL_MS = 1000
// Cap on stream lifetime to avoid serverless-function timeouts. Vercel
// hobby plan caps at 10s; pro at 60s. We re-establish on the client.
const MAX_STREAM_MS = 50_000
// Max envelopes per poll batch (safety bound).
const MAX_BATCH = 250

interface TpbRow {
  id: number
  worldDay: number
  actionType: string
  targetId: string | null
  deltaJson: string
  timestamp: string | null
}

function rowToEnvelope(row: TpbRow): {
  id: number
  worldDay: number
  realTs: string | null
  action: unknown
} {
  let action: unknown
  try {
    action = JSON.parse(row.deltaJson)
  } catch {
    action = null
  }
  return { id: row.id, worldDay: row.worldDay, realTs: row.timestamp, action }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const initialSinceId = Number(url.searchParams.get('sinceId') ?? '0')
  const startId = Number.isFinite(initialSinceId) && initialSinceId >= 0 ? Math.floor(initialSinceId) : 0

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let lastId = startId
      const startedAt = Date.now()
      let closed = false

      const push = (event: string, data: unknown) => {
        if (closed) return
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        try {
          controller.enqueue(encoder.encode(payload))
        } catch {
          closed = true
        }
      }

      // Keep-alive comment so proxies don't drop the connection.
      const keepalive = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          closed = true
        }
      }, 15_000)

      // Initial sync: send any backlog above sinceId.
      try {
        const initial = await db
          .select()
          .from(tpbEntries)
          .where(gt(tpbEntries.id, lastId))
          .orderBy(asc(tpbEntries.id))
          .limit(MAX_BATCH)
        for (const row of initial as TpbRow[]) {
          push('envelope', rowToEnvelope(row))
          lastId = row.id
        }
        push('synced', { lastId })
      } catch (e: unknown) {
        push('error', { message: e instanceof Error ? e.message : 'sync_failed' })
      }

      // Poll loop.
      const tick = async () => {
        if (closed) return
        if (Date.now() - startedAt > MAX_STREAM_MS) {
          push('reconnect', { reason: 'max_stream_time' })
          closed = true
          clearInterval(keepalive)
          try {
            controller.close()
          } catch {}
          return
        }
        try {
          const rows = await db
            .select()
            .from(tpbEntries)
            .where(gt(tpbEntries.id, lastId))
            .orderBy(asc(tpbEntries.id))
            .limit(MAX_BATCH)
          for (const row of rows as TpbRow[]) {
            push('envelope', rowToEnvelope(row))
            lastId = row.id
          }
        } catch (e: unknown) {
          push('error', { message: e instanceof Error ? e.message : 'poll_failed' })
        }
        if (!closed) setTimeout(tick, POLL_INTERVAL_MS)
      }
      setTimeout(tick, POLL_INTERVAL_MS)

      // Abort on client disconnect.
      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(keepalive)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
