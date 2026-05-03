'use client'

/**
 * /dm/party/[characterId] — character sheet drill-in.
 *
 * Reads the character via /api/character/:id and renders a sheet view.
 * v1 is read-only; mutations (HP edits, item moves) land next conversation
 * via the InventoryList renderActions hook.
 */

import * as React from 'react'
import { useParams } from 'next/navigation'
import { Card, EmptyState, CharacterCard, InventoryList, type InventoryItem } from '@/components/ui'
import { authFetch } from '@/lib/auth-fetch'

interface CharacterDetail {
  id: string
  name: string
  race: string
  subrace?: string | null
  classes: { className: string; level: number }[]
  hpCurrent: number
  hpMax: number
  ac?: number
  abilityScores?: Record<string, number>
  abilityModifiers?: Record<string, number>
  inventory?: InventoryItem[]
  goldGP?: number
  hook?: string
  alignment?: string
  background?: string
  status?: string
}

export default function CharacterSheetPage() {
  const params = useParams<{ characterId: string }>()
  const characterId = params?.characterId
  const [data, setData] = React.useState<CharacterDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!characterId) return
    setLoading(true)
    setError(null)
    authFetch(`/api/character/${encodeURIComponent(characterId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        const j = await r.json()
        setData(j as CharacterDetail)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'fetch failed'))
      .finally(() => setLoading(false))
  }, [characterId])

  if (loading) {
    return (
      <Card>
        <div style={{ color: 'var(--ink-3)' }}>loading sheet…</div>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          Character not found
        </h2>
        <Card variant="danger">
          <EmptyState label="couldn't load character" hint={error ?? 'no data'} />
          <a href="/dm/party" className="btn" style={{ marginTop: 8, textDecoration: 'none' }}>
            ← back to party
          </a>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          {data.name}
        </h2>
        <a href="/dm/party" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          ← party
        </a>
      </div>

      <CharacterCard
        id={data.id}
        name={data.name}
        race={data.race}
        subrace={data.subrace}
        classes={data.classes}
        hpCurrent={data.hpCurrent}
        hpMax={data.hpMax}
        ac={data.ac}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: 12,
        }}
      >
        {data.abilityScores && (
          <Card title="Abilities">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {Object.entries(data.abilityScores).map(([k, v]) => {
                const mod = data.abilityModifiers?.[k] ?? Math.floor(((v as number) - 10) / 2)
                return (
                  <div key={k} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--paper-2)', border: '1px solid var(--rule-soft)' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>
                      {k.slice(0, 3)}
                    </div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>{v}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                      {mod >= 0 ? '+' : ''}{mod}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <Card title="Inventory" meta={data.goldGP !== undefined ? `${data.goldGP} gp` : undefined}>
          <InventoryList
            items={data.inventory ?? []}
            showTotals
            emptyLabel="nothing carried"
          />
        </Card>

        {(data.hook || data.alignment || data.background) && (
          <Card title="Background">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {data.alignment && (
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>ALIGNMENT</span>
                  <div>{data.alignment}</div>
                </div>
              )}
              {data.background && (
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>BACKGROUND</span>
                  <div>{data.background}</div>
                </div>
              )}
              {data.hook && (
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>HOOK</span>
                  <div style={{ fontStyle: 'italic' }}>{data.hook}</div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
