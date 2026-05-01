// @ts-nocheck
'use client'

import React from 'react'
import { loadDiplomacy } from '@/lib/narrative'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Diplomacy.tsx — Diplomacy / intelligence briefings.
// Live data: /api/diplomacy/list bundles factions + factionRelations +
// social_contracts + wiki_articles WHERE articleType='intel_brief'.
// Mock briefings/treaties/sources stripped — drives entirely from API.

export default function Diplomacy() {
  const [data, setData] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadDiplomacy().then(setData).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">30 · World · diplomacy</div>
          <h2>Diplomacy <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">DM &amp; player view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-faction.ts + mm-social tick monthly. Briefings reuse the wiki table
        (articleType=intel_brief). Treaties live in social_contracts.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live diplomacy</h3>
          <span className="meta">→ /api/diplomacy/list</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!data && !error && <div className="tiny muted">loading…</div>}
        {data && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>factions <b>{data.factions?.length ?? 0}</b></span>
            <span>relations <b>{data.relations?.length ?? 0}</b></span>
            <span>contracts <b>{data.contracts?.length ?? 0}</b></span>
            <span>briefings <b>{data.briefings?.length ?? 0}</b></span>
          </div>
        )}
      </div>

      <div className="grid-2" style={{gap: 14}}>
        <div className="box">
          <div className="box-title"><h3>Treaties / contracts</h3><span className="meta">{data?.contracts?.length ?? 0}</span></div>
          {!data ? (
            <div className="tiny muted">loading…</div>
          ) : (data.contracts ?? []).length === 0 ? (
            <EmptyState label="no treaties" hint="bind to social_contracts. surface signed treaties + their breach/active status." />
          ) : (
            <div className="col" style={{gap: 4, fontSize: 13}}>
              {data.contracts.map((c: any) => (
                <div key={c.id} className="row" style={{justifyContent: 'space-between', borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 3}}>
                  <span><b>{c.title ?? c.kind ?? c.id}</b></span>
                  <span className="tiny muted">{c.status ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="box">
          <div className="box-title"><h3>Intel briefings</h3><span className="meta">{data?.briefings?.length ?? 0}</span></div>
          {!data ? (
            <div className="tiny muted">loading…</div>
          ) : (data.briefings ?? []).length === 0 ? (
            <EmptyState label="no briefings" hint="bind to wiki_articles WHERE articleType='intel_brief'." />
          ) : (
            <div className="col" style={{gap: 4, fontSize: 13}}>
              {data.briefings.map((b: any) => (
                <div key={b.id} className="row" style={{justifyContent: 'space-between', borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 3}}>
                  <span><b>{b.title}</b></span>
                  <span className="tiny muted">{b.tier ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
