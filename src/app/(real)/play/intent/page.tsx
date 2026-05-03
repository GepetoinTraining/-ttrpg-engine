'use client'

/**
 * /play/intent — the player declares an action.
 *
 * Per the DM-as-math-host architecture: player intents flow to the DM's
 * machine, the DM resolves the math, the bundle gets signed at session end.
 *
 * v1: stores intents in localStorage (per-character key) so the player has
 * a record of what they asked for. The intent endpoint that relays to the
 * DM's machine lands when sessions go in.
 */

import * as React from 'react'
import { Card, EmptyState, IntentForm, type IntentPayload } from '@/components/ui'
import { useActiveCharacter } from '../../_lib/use-active-character'
import { authFetch } from '@/lib/auth-fetch'

interface RecordedIntent extends IntentPayload {
  id: string
  ts: number
  status: 'queued' | 'sent' | 'resolved' | 'failed'
  error?: string
}

const LS_KEY = (cid: string) => `claudedm:intents:${cid}`

function loadIntents(cid: string): RecordedIntent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY(cid))
    return raw ? (JSON.parse(raw) as RecordedIntent[]) : []
  } catch {
    return []
  }
}

function saveIntents(cid: string, list: RecordedIntent[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_KEY(cid), JSON.stringify(list))
}

export default function IntentPage() {
  const { cert, sheet, loading } = useActiveCharacter({ withSheet: true })
  const [intents, setIntents] = React.useState<RecordedIntent[]>([])

  React.useEffect(() => {
    if (cert) setIntents(loadIntents(cert.id))
  }, [cert])

  const handleSubmit = async (payload: IntentPayload) => {
    if (!cert) return
    const id = `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const ts = Date.now()
    const intent: RecordedIntent = { ...payload, id, ts, status: 'queued' }

    // Optimistic local store
    const next = [intent, ...intents].slice(0, 50)
    setIntents(next)
    saveIntents(cert.id, next)

    // Push as a writeKappa action through the slot-push flywheel.
    // The DM polls /api/world/log filtered by system='player-intent:<cert>'
    // to see incoming intents and resolve them through their EngineClient.
    try {
      const action = {
        type: 'writeKappa' as const,
        nodeId: 'party',
        domain: 'intent',
        paths: [
          `intent.player.${payload.verb}`,
          `intent.player.${payload.verb}.id:${id}`,
        ],
        system: `player-intent:${cert.id}`,
        value: {
          intentId: id,
          characterId: cert.characterDataId ?? cert.id,
          verb: payload.verb,
          target: payload.target ?? null,
          ability: payload.ability ?? null,
          description: payload.description,
          d20: payload.d20 ?? null,
          ts,
        },
      }
      const res = await authFetch('/api/world/slot/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'solo',
          sourceCertId: cert.id,
          atDay: 0,
          actions: [action],
          receipts: [],
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `${res.status}`)
      }
      const updated: RecordedIntent = { ...intent, status: 'sent' }
      const list = next.map((i) => (i.id === id ? updated : i))
      setIntents(list)
      saveIntents(cert.id, list)
    } catch (e: unknown) {
      const failed: RecordedIntent = {
        ...intent,
        status: 'failed',
        error: e instanceof Error ? e.message : 'push failed',
      }
      const list = next.map((i) => (i.id === id ? failed : i))
      setIntents(list)
      saveIntents(cert.id, list)
    }
  }

  if (loading) {
    return <Card><div style={{ color: 'var(--ink-3)' }}>loading…</div></Card>
  }

  if (!cert) {
    return (
      <Card variant="danger">
        <EmptyState label="no character bound" hint="finish chargen first." />
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          Make a choice
        </h2>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          declare an action — your DM resolves it; you tell the story
        </div>
      </div>

      <Card title="Declare">
        <IntentForm
          preface={
            sheet ? (
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                speaking as <b style={{ fontFamily: 'var(--serif)' }}>{sheet.name}</b>
                {sheet.race && <> · {sheet.race}</>}
                {sheet.classes?.[0] && <> · {sheet.classes[0].className} {sheet.classes[0].level}</>}
              </div>
            ) : null
          }
          onSubmit={handleSubmit}
        />
      </Card>

      <Card title="Recent intents" meta={`${intents.length}`}>
        {intents.length === 0 ? (
          <EmptyState label="no intents declared" hint="your declared actions appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {intents.map((i) => (
              <div
                key={i.id}
                style={{
                  padding: '8px 10px',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--rule-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                  <span>{new Date(i.ts).toLocaleTimeString()}</span>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{i.verb}</span>
                  {i.target && <span>→ {i.target}</span>}
                  {i.ability && <span>· {i.ability}</span>}
                  {i.d20 !== undefined && <span>· d20: <b>{i.d20}</b></span>}
                  <span style={{ flex: 1 }} />
                  <span
                    style={{
                      color:
                        i.status === 'resolved' ? 'var(--accent-green)' :
                        i.status === 'sent' ? 'var(--accent-blue)' :
                        i.status === 'failed' ? 'var(--accent-red)' :
                        'var(--ink-3)',
                    }}
                  >
                    {i.status}
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>{i.description}</div>
                {i.status === 'failed' && i.error && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-red)' }}>
                    {i.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
