// @ts-nocheck
'use client'

import React from 'react'
import { loadScenes } from '@/lib/narrative'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/SceneEditor.tsx — author scene cards.
// READ-ONLY wiring for now: lists existing scene_cards + hook_threads.
// AUTHORING capability requires scene_contingencies + scene_mutations child tables.
// Mock scene list stripped — drives entirely from /api/scene/list.

export default function SceneEditor() {
  const [scenes, setScenes] = React.useState<any>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadScenes().then(setScenes).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">18 · Narrative · scene authoring</div>
          <h2>Scene editor <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">DM view · read-only for now</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ scene_cards + hook_threads are read-only today. Full authoring (contingencies,
        mutations, visibility gates) lands once child tables are added — flagged as the
        most-stable next schema move per Pedro&rsquo;s direction.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live scenes</h3>
          <span className="meta">→ /api/scene/list</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!scenes && !error && <div className="tiny muted">loading…</div>}
        {scenes && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12, flexWrap:'wrap'}}>
            <span>scenes <b>{scenes.scenes?.length ?? 0}</b></span>
            <span>hooks <b>{scenes.hookThreads?.length ?? 0}</b></span>
          </div>
        )}
      </div>

      <div className="box">
        <div className="box-title"><h3>Scenes</h3><span className="meta">{scenes?.scenes?.length ?? 0}</span></div>
        {!scenes ? (
          <div className="tiny muted">loading…</div>
        ) : (scenes.scenes ?? []).length === 0 ? (
          <EmptyState label="no scene cards" hint="seed scenes via mm-session prep, or wait until DM authors one in DMConsole." />
        ) : (
          <div className="col" style={{gap: 6, fontSize: 13}}>
            {scenes.scenes.map((s: any) => (
              <div key={s.id} style={{borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 6}}>
                <div className="row" style={{justifyContent: 'space-between'}}>
                  <span><b>{s.title ?? s.id}</b></span>
                  <span className="tiny muted">{s.cardType ?? s.kind ?? '—'}</span>
                </div>
                {s.summary && <div className="tiny" style={{marginTop: 2}}>{s.summary}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="box" style={{marginTop: 14}}>
        <div className="box-title"><h3>Hook threads</h3><span className="meta">{scenes?.hookThreads?.length ?? 0}</span></div>
        {!scenes ? (
          <div className="tiny muted">loading…</div>
        ) : (scenes.hookThreads ?? []).length === 0 ? (
          <EmptyState label="no hook threads" hint="hooks tag scenes for callback / pickup later. seed via mm-session." />
        ) : (
          <div className="col" style={{gap: 4, fontSize: 13}}>
            {scenes.hookThreads.map((h: any) => (
              <div key={h.id} className="row" style={{justifyContent: 'space-between', borderBottom: '1px dashed var(--rule-soft)', paddingBottom: 3}}>
                <span>{h.label ?? h.id}</span>
                <span className="tiny muted">staleness {h.staleness ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
