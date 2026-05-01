// @ts-nocheck
'use client'

import React from 'react'
import { loadWeather } from '@/lib/world'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Weather.tsx — Weather observer + forecast (engine/weather.ts).
// Live band loads weather_state for all regions.
// Mock 7-day forecast stripped — surface drives entirely from API.

export default function Weather() {
  const [weather, setWeather] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadWeather().then(setWeather).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">27 · World · weather</div>
          <h2>Weather <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player &amp; DM view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ engine/mm-weather.ts ticks weekly per region. weather_state holds current
        modifiers (yieldModifier, travelMod, spoilageMult). Forecast / omens land
        once mm-weather exposes future-cast.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live weather state</h3>
          <span className="meta">→ /api/world/weather</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!weather && !error && <div className="tiny muted">loading…</div>}
        {weather && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>regions <b>{weather.states?.length ?? 0}</b></span>
            {weather.season && <span>season <b>{weather.season}</b></span>}
          </div>
        )}
      </div>

      <div className="box">
        <div className="box-title"><h3>Per-region weather</h3><span className="meta">{weather?.states?.length ?? 0}</span></div>
        {!weather ? (
          <div className="tiny muted">loading…</div>
        ) : (weather.states ?? []).length === 0 ? (
          <EmptyState label="no weather states" hint="seed regions; mm-weather will write conditions on weekly tick." />
        ) : (
          <table className="inv">
            <thead><tr><th>region</th><th>condition</th><th>yield mod</th><th>travel mod</th><th>updated</th></tr></thead>
            <tbody>
              {weather.states.map((w: any) => (
                <tr key={w.regionId}>
                  <td><b>{w.regionName ?? w.regionId}</b></td>
                  <td>{w.condition ?? '—'}</td>
                  <td className="stat">×{w.yieldModifier?.toFixed?.(2) ?? '—'}</td>
                  <td className="stat">×{w.travelMod?.toFixed?.(2) ?? '—'}</td>
                  <td className="tiny muted">{w.updatedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="box" style={{marginTop: 14}}>
        <div className="box-title"><h3>Forecast / omens</h3><span className="meta">—</span></div>
        <EmptyState label="forecast pending" hint="mm-weather doesn't yet emit future-cast; surface will show 7-day forecast + omens once it does." />
      </div>
    </div>
  )
}
