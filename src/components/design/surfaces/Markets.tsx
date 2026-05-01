// @ts-nocheck
'use client'

import React from 'react'
import { listSettlements, loadMarket, type SettlementSummary, type PriceRow } from '@/lib/world-detail'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Markets.tsx — economy dashboard.
// Live data: pick a settlement, load /api/market/:settlementId for prices/merchants.
// Mock commodity table stripped — drives entirely from API.

export default function Markets() {
  const [list, setList] = React.useState<SettlementSummary[] | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [market, setMarket] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    listSettlements({ limit: 100 }).then(r => setList(r.settlements)).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  React.useEffect(() => {
    if (!selectedId) return
    loadMarket(selectedId).then(setMarket).catch(e => setError(e?.message ?? 'load failed'))
  }, [selectedId])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">20 · Economy · markets</div>
          <h2>Markets <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player &amp; DM view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-market.ts re-prices weekly from supply/demand κ. Caravan arrivals shift supply;
        observation collapses pending potential into actual κ writes. Prices are per-settlement.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live market</h3>
          <span className="meta">→ /api/market/[settlementId]</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!list && !error && <div className="tiny muted">loading…</div>}
        {list && list.length === 0 && (
          <EmptyState label="no settlements" hint="seed settlements first." />
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
          <EmptyState arrow label="pick a settlement" hint="commodity prices, merchants, caravans-in-transit, supply/demand deltas surface once a market loads." />
        ) : !market ? (
          <div className="tiny muted">loading market…</div>
        ) : (
          <>
            <div className="grid-3">
              <div>
                <div className="tiny">PRICES TRACKED</div>
                <div className="stat" style={{fontSize: 18}}><b>{market.prices?.length ?? 0}</b></div>
              </div>
              <div>
                <div className="tiny">MERCHANTS</div>
                <div className="stat" style={{fontSize: 18}}><b>{market.merchants?.length ?? 0}</b></div>
              </div>
              <div>
                <div className="tiny">CARAVANS IN TRANSIT</div>
                <div className="stat" style={{fontSize: 18}}><b>{market.caravansInTransit?.length ?? 0}</b></div>
              </div>
            </div>

            <hr className="rule dashed" />

            {(!market.prices || market.prices.length === 0) ? (
              <EmptyState label="no commodity prices" hint="seed commodity_prices, then mm-market tick will write current bands." />
            ) : (
              <table className="inv">
                <thead><tr><th>commodity</th><th>price</th><th>Δ%</th><th>supply</th><th>demand</th></tr></thead>
                <tbody>
                  {market.prices.map((p: PriceRow) => (
                    <tr key={p.commodityId}>
                      <td><b>{p.commodityName}</b> <span className="muted">· {p.commodityId}</span></td>
                      <td className="stat">{p.currentPrice?.toFixed?.(1) ?? p.currentPrice}gp</td>
                      <td className="stat" style={{color: (p.priceDeltaPct ?? 0) > 0 ? 'var(--accent-green)' : (p.priceDeltaPct ?? 0) < 0 ? 'var(--accent-red)' : 'var(--ink)'}}>
                        {(p.priceDeltaPct ?? 0) > 0 ? '+' : ''}{(p.priceDeltaPct ?? 0).toFixed?.(1) ?? p.priceDeltaPct ?? 0}%
                      </td>
                      <td className="tiny">{p.supply ?? '—'}</td>
                      <td className="tiny">{p.demand ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}
