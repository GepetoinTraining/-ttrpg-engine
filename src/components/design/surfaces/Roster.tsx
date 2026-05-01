// @ts-nocheck
'use client'

import React from 'react'
import { listNPCs, type NPCSummary } from '@/lib/world-detail'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Roster.tsx — DM full NPC cast.
// Live data: /api/npc/list reads npcs (+ memories on detail).
// Mock cast stripped for semi-prod — surface drives entirely from API now.

export default function Roster() {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<string>('all')
  const [live, setLive] = React.useState<NPCSummary[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    listNPCs({ limit: 200 }).then(r => setLive(r.npcs)).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const filtered = !live
    ? []
    : filter === 'all'
      ? live
      : live.filter(n => n.disposition === filter)

  const npc = live?.find(n => n.id === selected) ?? null

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">17 · DM · full cast</div>
          <h2>NPC Roster <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">everyone the AI can voice</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ Voicebox (in DM Console) is a chat surface. <b>This is the cast.</b> Search,
        filter, view loyalty &amp; agenda, and gate what each NPC <i>knows</i> before
        the AI speaks for them.
      </div>

      {/* Live engine strip */}
      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live NPC roster</h3>
          <span className="meta">→ /api/npc/list · npcs</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!live && !error && <div className="tiny muted">loading…</div>}
        {live && live.length === 0 && (
          <EmptyState label="no npcs in DB" hint="seed npcs / mm-settlement spawns to populate the roster." />
        )}
        {live && live.length > 0 && (
          <div className="tiny muted">{live.length} NPC{live.length === 1 ? '' : 's'} loaded</div>
        )}
      </div>

      <div className="row" style={{gap: 14, alignItems: 'flex-start'}}>
        {/* LEFT: list */}
        <div className="col" style={{width: 360, gap: 10}}>
          <div className="row" style={{gap: 6}}>
            <input
              className="placeholder"
              style={{flex:1, padding:'6px 10px', minHeight:0, fontFamily:'var(--mono)', fontSize: 12}}
              placeholder="🔍  search NPCs…"
            />
            <button className="btn sm">＋ new</button>
          </div>
          <div className="row" style={{gap: 4, flexWrap:'wrap'}}>
            {[
              ['all', `all · ${live?.length ?? 0}`],
              ['friendly', 'friendly'],
              ['hostile', 'hostile'],
              ['neutral', 'neutral'],
            ].map(([k, l]) => (
              <span key={k} className="chip sm" onClick={() => setFilter(k)}
                    style={{cursor:'pointer', background: filter===k?'var(--ink)':undefined, color: filter===k?'var(--paper)':undefined, borderColor: filter===k?'var(--ink)':undefined}}>
                {l}
              </span>
            ))}
          </div>

          <div className="box" style={{padding: 0}}>
            {!live && <div className="tiny muted" style={{padding: 12}}>loading…</div>}
            {live && filtered.length === 0 && (
              <div style={{padding: 12}}>
                <EmptyState label="no NPCs match" hint={filter === 'all' ? 'seed npcs to begin.' : `no NPCs with disposition '${filter}'.`} />
              </div>
            )}
            {filtered.map(n => (
              <div key={n.id} onClick={() => setSelected(n.id)}
                   style={{padding: '10px 12px', borderBottom: '1px dashed var(--rule-soft)', cursor: 'pointer',
                           background: selected === n.id ? 'var(--paper-2)' : 'transparent',
                           borderLeft: `3px solid ${
                             n.disposition === 'hostile' ? 'var(--accent-red)' :
                             n.disposition === 'friendly' ? 'var(--accent-green)' :
                             'var(--ink-3)'}`}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <span style={{fontFamily:'var(--serif)', fontSize: 15, fontWeight: 600}}>{n.name}</span>
                  <span className={`chip sm ${n.disposition === 'hostile' ? 'red' : n.disposition === 'friendly' ? 'green' : ''}`}>
                    {n.disposition}
                  </span>
                </div>
                <div className="tiny" style={{marginTop: 2}}>
                  {n.role ?? '—'} {n.craft ? `· ${n.craft}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: detail */}
        <div className="col" style={{flex: 1, gap: 14}}>
          {!npc ? (
            <div className="box">
              <EmptyState
                arrow
                label="pick an NPC"
                hint="Detail rail shows identity, loyalty, agenda, knowledge gates, relationships, and a → Voicebox link to roleplay."
              />
            </div>
          ) : (
            <>
              <div className="box">
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
                  <div>
                    <div className="tiny">NPC · {npc.id.slice(0, 8)}…</div>
                    <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2}}>{npc.name}</div>
                    <div className="hand" style={{color:'var(--accent-blue)', fontSize: 18}}>{npc.role ?? '—'}</div>
                  </div>
                  <div className="row" style={{gap: 6}}>
                    <button className="btn sm">edit</button>
                    <button className="btn sm primary">→ Voicebox</button>
                  </div>
                </div>
                <hr className="rule dashed" />
                <div className="grid-3">
                  <div>
                    <div className="tiny">DISPOSITION</div>
                    <div className="hand ink" style={{fontSize: 18}}>{npc.disposition}</div>
                  </div>
                  <div>
                    <div className="tiny">CRAFT</div>
                    <div style={{fontSize: 14}}>{npc.craft ?? '—'}</div>
                  </div>
                  <div>
                    <div className="tiny">SETTLEMENT</div>
                    <div style={{fontSize: 14, fontFamily:'var(--mono)'}}>{npc.settlementId ?? '—'}</div>
                  </div>
                </div>
              </div>

              <div className="grid-2">
                <div className="box">
                  <div className="box-title"><h3>Agenda</h3><span className="meta">npc-agenda.ts</span></div>
                  <EmptyState label="agenda pending" hint="bind to engine/npc-agenda.ts drives + escalation clock." />
                </div>
                <div className="box">
                  <div className="box-title"><h3>Knowledge pool</h3><span className="meta">gated facts</span></div>
                  <EmptyState label="knowledge gating pending" hint="bind to engine/intelligence.ts agent identity. AI cannot reveal red-tagged facts even on high persuasion rolls." />
                </div>
                <div className="box" style={{gridColumn:'span 2'}}>
                  <div className="box-title"><h3>Relationships</h3><span className="meta">to other NPCs &amp; PCs</span></div>
                  <EmptyState label="relationships pending" hint="bind to npc_relationships table once seeded." />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
