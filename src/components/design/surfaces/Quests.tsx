// @ts-nocheck
'use client'

import React from 'react'
import { loadQuests } from '@/lib/narrative'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Quests.tsx — Quest + beat tracker.
// Live data: /api/quest/list?adventureId=X reads quests + beats joined under arcs.
// Mock arcs/quests/beats stripped — drives entirely from API.

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Quests() {
  const [data, setData] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [adventureId, setAdventureId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    setAdventureId(cid)
    loadQuests(cid ? { campaignId: cid } : undefined)
      .then(setData)
      .catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">28 · Narrative · quests</div>
          <h2>Quests <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">DM &amp; player view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/narrative.ts holds arcs (main / side / character / faction / world).
        Each arc has quests; each quest has beats (15 beat types, triggers + rewards).
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live quests</h3>
          <span className="meta">→ /api/quest/list{adventureId ? `?adventureId=${adventureId.slice(0,8)}…` : ''}</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!data && !error && <div className="tiny muted">loading…</div>}
        {data && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>arcs <b>{data.arcs?.length ?? 0}</b></span>
            <span>quests <b>{data.questCount ?? data.quests?.length ?? 0}</b></span>
            <span>beats <b>{data.beatCount ?? '—'}</b></span>
          </div>
        )}
      </div>

      <div className="box">
        <div className="box-title"><h3>Arcs &amp; quests</h3><span className="meta">{data?.arcs?.length ?? 0}</span></div>
        {!data ? (
          <div className="tiny muted">loading…</div>
        ) : (data.arcs ?? []).length === 0 ? (
          <EmptyState label="no arcs / quests" hint="seed via narrative authoring. binds to arcs + quests + beats tables." />
        ) : (
          <div className="col" style={{gap: 14}}>
            {data.arcs.map((arc: any) => (
              <div key={arc.id} className="box soft">
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <div>
                    <div className="tiny">{(arc.kind ?? 'ARC').toUpperCase()} · {arc.id.slice(0, 8)}…</div>
                    <div style={{fontFamily:'var(--serif)', fontSize: 18, fontWeight: 600}}>{arc.title}</div>
                  </div>
                  <span className="chip sm">{arc.status ?? '—'}</span>
                </div>
                {(arc.quests ?? []).length === 0 ? (
                  <div className="tiny muted" style={{marginTop: 8}}>no quests under this arc</div>
                ) : (
                  <div className="col" style={{gap: 4, marginTop: 8, fontSize: 13}}>
                    {arc.quests.map((q: any) => (
                      <div key={q.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 3}}>
                        <span><b>{q.title}</b></span>
                        <span className="tiny muted">{q.beats?.length ?? 0} beats · {q.status ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
