// @ts-nocheck
'use client'

import React from 'react'
import { loadCalendar, type CalendarData } from '@/lib/world'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Calendar.tsx — World calendar / time scrubber (engine/clockwork.ts).
// Live band loads parties.currentTick + clockwork_events for the active campaign.
// Note: legacy parties.currentTick semantics — refactor to worlds.currentDay
// is a separate cleanup pass.
// Mock "Eleasis 23" today + month names stripped from active rendering — months
// kept as canonical FR calendar reference, current day driven by API.

const FR_MONTHS = [
  'Hammer', 'Alturiak', 'Ches', 'Tarsakh', 'Mirtul', 'Kythorn',
  'Flamerule', 'Eleasis', 'Eleint', 'Marpenoth', 'Uktar', 'Nightal',
]

function readCampaignFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  const q = h.indexOf('?')
  if (q === -1) return null
  return new URLSearchParams(h.slice(q + 1)).get('campaign')
}

export default function Calendar() {
  const [data, setData] = React.useState<CalendarData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [campaignId, setCampaignId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cid = readCampaignFromHash()
    setCampaignId(cid)
    loadCalendar(cid ? { campaignId: cid } : undefined)
      .then(setData)
      .catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">22 · World · calendar</div>
          <h2>Calendar <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player &amp; DM view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/clockwork.ts is the heartbeat. Sessions + scheduled events + downtime resolve at known days.
        Faerûnian months: {FR_MONTHS.join(' · ')}. <i>worldDay is the canonical cron clock; partyDay diverges
        for session-time personas (player/dm/gm-ai) that fast-forward via DM authority.</i>
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live calendar</h3>
          <span className="meta">→ /api/world/calendar{campaignId ? `?campaignId=${campaignId.slice(0,8)}…` : ''}</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!data && !error && <div className="tiny muted">loading…</div>}
        {data && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>worldDay <b>{data.worldDay}</b></span>
            {data.partyDay !== null && <span>partyDay <b>{data.partyDay}</b></span>}
            {data.birthTick !== null && <span>born <b>{data.birthTick}</b></span>}
            <span>sessions <b>{data.sessions?.length ?? 0}</b></span>
            <span>upcoming <b>{data.upcomingEvents?.length ?? 0}</b></span>
          </div>
        )}
      </div>

      <div className="grid-2" style={{gap: 14}}>
        <div className="box">
          <div className="box-title"><h3>Recent sessions</h3><span className="meta">{data?.sessions?.length ?? 0}</span></div>
          {!data ? (
            <div className="tiny muted">loading…</div>
          ) : (data.sessions ?? []).length === 0 ? (
            <EmptyState label="no sessions logged" hint="bind to mm-session boundaries once they're tagged in tpb_entries." />
          ) : (
            <div className="col" style={{gap: 4, fontSize: 13}}>
              {data.sessions.map((s: any) => (
                <div key={s.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 3}}>
                  <span><b>{s.title ?? `Session ${s.number ?? s.id?.slice(0, 8) ?? '—'}`}</b></span>
                  <span className="tiny muted">day {s.worldDay ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="box">
          <div className="box-title"><h3>Upcoming events</h3><span className="meta">{data?.upcomingEvents?.length ?? 0}</span></div>
          {!data ? (
            <div className="tiny muted">loading…</div>
          ) : (data.upcomingEvents ?? []).length === 0 ? (
            <EmptyState label="no scheduled events" hint="festivals / migrations / political moves bind once mm-faction + mm-settlement schedule them." />
          ) : (
            <div className="col" style={{gap: 4, fontSize: 13}}>
              {data.upcomingEvents.map((e: any) => (
                <div key={e.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 3}}>
                  <span><b>{e.title}</b></span>
                  <span className="tiny muted">day {e.worldDay ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
