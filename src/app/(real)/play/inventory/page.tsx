'use client'

/**
 * /play/inventory — the player's carried inventory.
 *
 * Reads /api/character/:id/inventory (polymorphic owners). v1 is read-only;
 * the "transfer to party stash" + "drop" + "use" actions are wired as
 * intents that flow to the DM (next conversation when intent endpoint lands).
 */

import * as React from 'react'
import { Card, EmptyState, InventoryList, type InventoryItem } from '@/components/ui'
import { useActiveCharacter } from '../../_lib/use-active-character'
import { authFetch } from '@/lib/auth-fetch'

interface InventoryResponse {
  characterId: string
  inventories?: Array<{
    id: string
    label?: string
    containers?: Array<{
      id: string
      label?: string
      items?: InventoryItem[]
    }>
  }>
}

export default function PlayerInventoryPage() {
  const { cert, sheet, loading: charLoading } = useActiveCharacter({ withSheet: true })
  const [data, setData] = React.useState<InventoryResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const characterId = sheet?.id ?? cert?.characterDataId

  React.useEffect(() => {
    if (!characterId) return
    setLoading(true)
    setError(null)
    authFetch(`/api/character/${encodeURIComponent(characterId)}/inventory`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        const j: InventoryResponse = await r.json()
        setData(j)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'fetch failed'))
      .finally(() => setLoading(false))
  }, [characterId])

  // Flatten all items across all inventories + containers
  const allItems: InventoryItem[] = (data?.inventories ?? []).flatMap((inv) =>
    (inv.containers ?? []).flatMap((c) => c.items ?? []),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
        Inventory
      </h2>

      {!characterId && !charLoading && (
        <Card variant="danger">
          <EmptyState label="no character bound" hint="finish chargen first." />
        </Card>
      )}

      {(charLoading || loading) && (
        <Card><div style={{ color: 'var(--ink-3)' }}>loading…</div></Card>
      )}

      {error && (
        <Card variant="danger">
          <EmptyState label="inventory fetch failed" hint={error} />
        </Card>
      )}

      {data?.inventories?.map((inv) => (
        <Card key={inv.id} title={inv.label ?? 'Inventory'} meta={`${inv.containers?.length ?? 0} container${inv.containers?.length === 1 ? '' : 's'}`}>
          {(inv.containers ?? []).map((c) => (
            <div key={c.id} style={{ marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {c.label ?? 'container'}
              </div>
              <InventoryList items={c.items ?? []} showTotals emptyLabel="empty" />
            </div>
          ))}
        </Card>
      ))}

      {data && allItems.length === 0 && (
        <Card variant="dashed">
          <EmptyState
            label="nothing carried"
            hint="pick something up or have your DM hand you starting equipment."
          />
        </Card>
      )}

      <Card title="Coming soon" variant="soft">
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
          Per-item actions (use / drop / transfer to party stash) flow to the
          DM as intents. The intent endpoint is the next bigger piece — until
          then, this surface is read-only.
        </p>
      </Card>
    </div>
  )
}
