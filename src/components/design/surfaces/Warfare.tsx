// @ts-nocheck
'use client'

import React from 'react'
import { loadArmies } from '@/lib/narrative'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Warfare.tsx — Warfare / armies / sieges.
// READ-ONLY wiring of armies + army_units. Full siege resolver parked in
// project_warfare_model memory. Mock army/fortification arrays stripped —
// surface drives entirely from API.

export default function Warfare() {
  const [data, setData] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadArmies().then(setData).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">31 · World · warfare</div>
          <h2>Warfare <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">DM view · read-only roster</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-warfare.ts ticks readiness / morale / upkeep monthly.
        Full siege resolver (geography/strategy/preparation/armaments, health portions,
        front/back line, freshness, real-time when PCs present) is spec&rsquo;d in
        project_warfare_model memory; not yet wired to a resolver UI.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live armies</h3>
          <span className="meta">→ /api/army/list (read-only)</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!data && !error && <div className="tiny muted">loading…</div>}
        {data && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>armies <b>{data.armies?.length ?? 0}</b></span>
            <span>units <b>{data.units?.length ?? 0}</b></span>
          </div>
        )}
      </div>

      <div className="box">
        <div className="box-title"><h3>Armies on the board</h3><span className="meta">{data?.armies?.length ?? 0}</span></div>
        {!data ? (
          <div className="tiny muted">loading…</div>
        ) : (data.armies ?? []).length === 0 ? (
          <EmptyState label="no armies" hint="bind to armies + army_units. siege resolver UI deferred per project_warfare_model." />
        ) : (
          <table className="inv">
            <thead><tr><th>army</th><th>faction</th><th>strength</th><th>readiness</th><th>morale</th></tr></thead>
            <tbody>
              {data.armies.map((a: any) => (
                <tr key={a.id}>
                  <td><b>{a.name ?? a.id}</b></td>
                  <td>{a.factionName ?? a.factionId ?? '—'}</td>
                  <td className="stat">{a.strength ?? '—'}</td>
                  <td className="stat">{a.readiness?.toFixed?.(2) ?? '—'}</td>
                  <td className="stat">{a.morale?.toFixed?.(2) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
