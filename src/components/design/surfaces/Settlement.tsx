// @ts-nocheck
'use client'

import React from 'react'
import { listSettlements, loadSettlement, type SettlementSummary } from '@/lib/world-detail'
import { useHub } from '@/lib/use-hub'
import { useWorld } from '@/lib/use-world'
import { usePersonaCapabilities } from '@/lib/persona-capabilities'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Settlement.tsx — Non-owned settlement viewer.
// Live data: pick a settlement from /api/settlement/list, then load /api/settlement/:id.
// Mock Suzail body stripped — surface drives entirely from API.

export default function Settlement() {
  const [list, setList] = React.useState<SettlementSummary[] | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Hub runtime — opt-in for DM-authority personas. Hook is conditional on
  // selectedId; when null, useHub does nothing.
  const worldApi = useWorld()
  const caps = usePersonaCapabilities()
  const hub = useHub(selectedId, worldApi.character?.id ?? null)

  React.useEffect(() => {
    listSettlements({ limit: 100 }).then(r => setList(r.settlements)).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  React.useEffect(() => {
    if (!selectedId) return
    loadSettlement(selectedId).then(setDetail).catch(e => setError(e?.message ?? 'load failed'))
  }, [selectedId])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">16 · World · settlement viewer</div>
          <h2>Settlement <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player &amp; DM view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-settlement.ts ticks weekly; market, infrastructure, social, knowledge tick monthly.
        Pick a settlement to see its current state.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live settlement roster</h3>
          <span className="meta">→ /api/settlement/list</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!list && !error && <div className="tiny muted">loading…</div>}
        {list && list.length === 0 && (
          <EmptyState label="no settlements" hint="seed settlements (post-nuke bootstrap.ts inserts Suzail)." />
        )}
        {list && list.length > 0 && (
          <div className="row" style={{gap: 6, flexWrap: 'wrap'}}>
            {list.map(s => (
              <button
                key={s.id}
                className={'btn sm' + (selectedId === s.id ? ' primary' : '')}
                onClick={() => setSelectedId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="box">
        {!selectedId ? (
          <EmptyState arrow label="pick a settlement" hint="detail panel renders population, buildings, NPCs, resources, κ once selected." />
        ) : !detail ? (
          <div className="tiny muted">loading detail…</div>
        ) : (
          <div>
            <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
              <div>
                <div className="tiny">{detail.settlement.regionId?.toUpperCase() ?? 'SETTLEMENT'}</div>
                <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2}}>{detail.settlement.name}</div>
              </div>
            </div>
            <hr className="rule dashed" />
            <div className="grid-3">
              <div>
                <div className="tiny">BUILDINGS</div>
                <div className="stat" style={{fontSize: 18}}><b>{detail.buildings?.length ?? 0}</b></div>
              </div>
              <div>
                <div className="tiny">NPCs</div>
                <div className="stat" style={{fontSize: 18}}><b>{detail.npcs?.length ?? 0}</b></div>
              </div>
              <div>
                <div className="tiny">RESOURCES</div>
                <div className="stat" style={{fontSize: 18}}><b>{detail.resources?.length ?? 0}</b></div>
              </div>
            </div>
            <div className="aside" style={{marginTop: 14}}>
              ↳ full κ readout (population, stability, growth, market tier, fortification) wires when /api/settlement/[id] surfaces κ. Buildings + NPC details below pending.
            </div>

            {/* Hub runtime — gated by DM-authority capabilities (Phase Δ.7). */}
            {caps?.canTransportParty && (
              <div className="box" style={{ marginTop: 14, borderColor: 'var(--accent-blue)' }}>
                <div className="box-title">
                  <h3>Hub runtime</h3>
                  <span className="meta">
                    {hub.runtime
                      ? `${hub.runtime.status} · activeN ${hub.runtime.activeN}`
                      : '—'}
                  </span>
                </div>

                {!worldApi.character ? (
                  <EmptyState
                    label="no active character"
                    hint="log into the world via CharacterSelect; the cert is needed to attribute receipts."
                  />
                ) : !hub.runtime && !hub.loading ? (
                  <div>
                    <div className="tiny muted" style={{ marginBottom: 8 }}>
                      Multi-DM coordination layer. Open a runtime to share live hub state with other DMs;
                      receipts are ordered by a neutral observer and committed to canonical TPB on close.
                    </div>
                    <button
                      className="btn primary sm"
                      onClick={() => hub.enter()}
                      disabled={hub.loading}
                    >
                      ✦ open runtime + join
                    </button>
                  </div>
                ) : hub.loading ? (
                  <div className="tiny muted">… opening runtime</div>
                ) : (
                  <div>
                    <div className="grid-3" style={{ gap: 12, fontFamily: 'var(--mono)', fontSize: 11 }}>
                      <div>
                        <div className="tiny">RUNTIME ID</div>
                        <div>{hub.runtime!.id.slice(0, 8)}…</div>
                      </div>
                      <div>
                        <div className="tiny">STATUS</div>
                        <div>
                          <span className={`chip sm ${
                            hub.runtime!.status === 'open' ? 'green'
                              : hub.runtime!.status === 'closing' ? 'gold'
                              : hub.runtime!.status === 'committed' ? 'blue'
                              : hub.runtime!.status === 'failed' ? 'red'
                              : ''
                          }`}>{hub.runtime!.status}</span>
                        </div>
                      </div>
                      <div>
                        <div className="tiny">ACTIVE N</div>
                        <div><b>{hub.runtime!.activeN}</b></div>
                      </div>
                      <div>
                        <div className="tiny">RECEIPTS PUSHED</div>
                        <div><b>{hub.receipts.length}</b> this session</div>
                      </div>
                      <div>
                        <div className="tiny">OPENED</div>
                        <div className="muted">{new Date(hub.runtime!.openedAt).toLocaleTimeString()}</div>
                      </div>
                      <div>
                        <div className="tiny">LEASE EXPIRES</div>
                        <div className="muted">{new Date(hub.runtime!.leaseExpiresAt).toLocaleTimeString()}</div>
                      </div>
                    </div>

                    {hub.runtime!.joinedSessionIds.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div className="tiny">JOINED SESSIONS</div>
                        <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {hub.runtime!.joinedSessionIds.map((sid) => (
                            <span key={sid} className="chip sm">{sid.slice(0, 12)}…</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="row" style={{ gap: 6, marginTop: 12 }}>
                      {hub.isJoined ? (
                        <button
                          className="btn sm danger"
                          onClick={() => hub.leave()}
                        >
                          leave runtime
                        </button>
                      ) : (
                        <button
                          className="btn sm primary"
                          onClick={() => hub.enter()}
                        >
                          join runtime
                        </button>
                      )}
                      <button
                        className="btn sm"
                        onClick={() => hub.refresh()}
                      >
                        refresh
                      </button>
                    </div>

                    {hub.closed && (
                      <div className="aside blue" style={{ marginTop: 10, fontSize: 13 }}>
                        ↳ runtime closed. Receipts drained inline to canonical tpb_entries.
                      </div>
                    )}
                    {hub.error && (
                      <div className="tiny" style={{ color: 'var(--accent-red)', marginTop: 8 }}>
                        {hub.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid-2" style={{marginTop: 14, gap: 14}}>
              <div className="box">
                <div className="box-title"><h3>Buildings</h3><span className="meta">{detail.buildings?.length ?? 0}</span></div>
                {(!detail.buildings || detail.buildings.length === 0) ? (
                  <EmptyState label="no buildings" hint="seed buildings via mm-infrastructure tick." />
                ) : (
                  <div className="col" style={{gap: 4, fontSize: 13}}>
                    {detail.buildings.slice(0, 20).map((b: any) => (
                      <div key={b.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 3}}>
                        <span>{b.name ?? b.kind ?? b.id}</span>
                        <span className="tiny muted">{b.kind ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="box">
                <div className="box-title"><h3>NPCs</h3><span className="meta">{detail.npcs?.length ?? 0}</span></div>
                {(!detail.npcs || detail.npcs.length === 0) ? (
                  <EmptyState label="no NPCs" hint="seed npcs scoped to this settlement." />
                ) : (
                  <div className="col" style={{gap: 4, fontSize: 13}}>
                    {detail.npcs.slice(0, 20).map((n: any) => (
                      <div key={n.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px dashed var(--rule-soft)', paddingBottom: 3}}>
                        <span><b>{n.name}</b> <span className="muted">· {n.role ?? '—'}</span></span>
                        <span className="tiny">{n.disposition ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
