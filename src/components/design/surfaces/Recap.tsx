// @ts-nocheck
'use client'

import React from 'react'
import { loadTPB, type TPBList } from '@/lib/world'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Recap.tsx — Session recap / TPB timeline (engine/tpb.ts).
// Live data: /api/tpb/list reads tpb_entries (append-only, world-day keyed).
// Mock session-14 events stripped — drives entirely from tpb_entries.

export default function Recap() {
  const [tpb, setTpb] = React.useState<TPBList | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadTPB({ limit: 100 }).then(setTpb).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">19 · Session · recap</div>
          <h2>Session recap <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player &amp; DM view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ tpb_entries is the canonical append-only world log. Each row is a world action
        (tick / observe / writeKappa / entityMove / session / characterTransfer …) keyed
        by worldDay. Recap surfaces a session-scoped slice once session boundaries land.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live TPB tail</h3>
          <span className="meta">→ /api/tpb/list</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!tpb && !error && <div className="tiny muted">loading…</div>}
        {tpb && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>entries <b>{tpb.entries.length}</b></span>
            {tpb.byActionType && Object.entries(tpb.byActionType).map(([k, v]) => (
              <span key={k}>{k} <b>{v}</b></span>
            ))}
          </div>
        )}
      </div>

      <div className="box">
        <div className="box-title"><h3>Event log</h3><span className="meta">{tpb?.entries.length ?? 0} entries</span></div>
        {!tpb ? (
          <div className="tiny muted">loading…</div>
        ) : tpb.entries.length === 0 ? (
          <EmptyState label="no entries yet" hint="entries land here as the engine ticks and the party acts." />
        ) : (
          <div className="col" style={{gap: 4, fontSize: 13}}>
            {tpb.entries.map((e: any) => (
              <div key={e.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 3}}>
                <span>
                  <span className="chip sm" style={{marginRight: 6}}>day {e.worldDay}</span>
                  <span className="chip sm blue" style={{marginRight: 6}}>{e.actionType}</span>
                  <span style={{fontFamily:'var(--mono)', fontSize: 12}}>{e.targetId ?? '—'}</span>
                </span>
                <span className="tiny muted">{e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="aside" style={{marginTop: 14}}>
        ↳ session-scoped recap (filtered to a single session id) surfaces once mm-session tags entries with sessionId. Replay + diff via TPB.diff() lands in Slice 7 audit surface.
      </div>
    </div>
  )
}
