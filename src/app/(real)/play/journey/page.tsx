'use client'

/**
 * /play/journey — recent log filtered to events that touched my character.
 *
 * Reads /api/world/log and filters by:
 *   - action.system contains my cert id (player-intent / propose-investment / etc.)
 *   - action.value.characterId === my character id
 *   - actions tagged with my recent intent ids
 */

import * as React from 'react'
import { Card, EmptyState } from '@/components/ui'
import { useActiveCharacter } from '../../_lib/use-active-character'
import { fetchWorldLog, type TpbLogEntryClient } from '@/lib/world-client'

export default function JourneyPage() {
  const { cert, sheet, loading: charLoading } = useActiveCharacter({ withSheet: true })
  const [entries, setEntries] = React.useState<TpbLogEntryClient[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showAll, setShowAll] = React.useState(false)

  const characterId = sheet?.id ?? cert?.characterDataId
  const certId = cert?.id

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchWorldLog(200)
      setEntries(rows)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (cert) load()
  }, [cert, load])

  // Filter entries to those touching this character.
  const filtered = React.useMemo(() => {
    if (showAll) return entries
    if (!certId && !characterId) return []
    return entries.filter((e) => {
      const action = e.action as Record<string, unknown>
      const system = typeof action.system === 'string' ? action.system : ''
      if (certId && system.includes(certId)) return true
      const value = action.value as Record<string, unknown> | undefined
      if (value && characterId && value.characterId === characterId) return true
      // observe action with partyId — match if it's the party
      if (action.type === 'observe' && action.partyId === 'party') return true
      return false
    })
  }, [entries, certId, characterId, showAll])

  if (charLoading) {
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          Journey
        </h2>
        <span style={{ flex: 1 }} />
        <button
          className="btn sm"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'mine only' : 'show all'}
        </button>
        <button className="btn sm" onClick={load} disabled={loading}>
          {loading ? '…' : '↻ refresh'}
        </button>
      </div>

      {error && (
        <Card variant="danger">
          <div style={{ color: 'var(--accent-red)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            {error}
          </div>
        </Card>
      )}

      <Card title="Recent log" meta={`${filtered.length} entries`}>
        {loading && entries.length === 0 ? (
          <div style={{ color: 'var(--ink-3)' }}>loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            label={showAll ? 'no log entries yet' : 'nothing touching this character'}
            hint={showAll ? 'the world log is empty.' : 'declare an intent or take a downtime action and it will appear here.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map((e) => (
              <JourneyRow key={e.id} entry={e} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function JourneyRow({ entry }: { entry: TpbLogEntryClient }) {
  const action = entry.action as Record<string, unknown>
  const system = typeof action.system === 'string' ? action.system : ''
  const verb = system.startsWith('player-intent:') ? 'intent'
    : system.startsWith('propose-investment:') ? 'investment'
    : system.startsWith('discovery-') ? 'discovery'
    : action.type as string

  const value = action.value as Record<string, unknown> | undefined
  const description =
    (value && (value.description as string)) ??
    (typeof action.paths === 'object' && Array.isArray((action as any).paths)
      ? ((action as any).paths as string[])[0]
      : null) ??
    action.type as string

  const ts = entry.realTs ? new Date(entry.realTs) : null
  const tsLabel = ts ? ts.toLocaleTimeString() : `day ${entry.worldDay}`

  return (
    <div
      style={{
        padding: '6px 10px',
        background: 'var(--paper-2)',
        border: '1px solid var(--rule-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--ink-3)',
          flexWrap: 'wrap',
          alignItems: 'baseline',
        }}
      >
        <span>{tsLabel}</span>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{verb}</span>
        <span>day {entry.worldDay}</span>
      </div>
      <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{description}</div>
    </div>
  )
}
