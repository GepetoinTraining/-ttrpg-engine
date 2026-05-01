// @ts-nocheck
'use client'

import React from 'react'
import { loadWiki, type WikiArticle } from '@/lib/narrative'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Lore.tsx — Codified lore wiki + world firsts.
// Live data: /api/wiki/list?type=lore reads wiki_articles. Lore reuses the
// existing wiki table with articleType='lore'.
// Mock entries (Kaelith/Selvys references) stripped — drives entirely from API.

export default function Lore() {
  const [articles, setArticles] = React.useState<WikiArticle[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadWiki({ type: 'lore' }).then(r => setArticles(r.articles)).catch(e => setError(e?.message ?? 'load failed'))
  }, [])

  const selected = articles?.find(a => a.id === selectedId) ?? null

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">24 · World · lore</div>
          <h2>Lore wiki <FidelityBadge level="partial" /></h2>
        </div>
        <span className="who">player &amp; DM view</span>
      </div>

      <div className="aside" style={{maxWidth: 820, marginBottom: 18}}>
        ↳ codified lore reuses the wiki table (articleType=lore). World firsts (first kill,
        first settlement, first cleared gate) wires once mm-world emits firsts to wiki.
      </div>

      <div className="box" style={{marginBottom: 14, padding: 12, borderColor:'var(--accent-blue)'}}>
        <div className="box-title">
          <h3>Live lore</h3>
          <span className="meta">→ /api/wiki/list?type=lore</span>
        </div>
        {error && <div className="tiny" style={{color:'var(--accent-red)'}}>{error}</div>}
        {!articles && !error && <div className="tiny muted">loading…</div>}
        {articles && (
          <div className="row" style={{gap: 14, fontFamily:'var(--mono)', fontSize: 12}}>
            <span>articles <b>{articles.length}</b></span>
          </div>
        )}
      </div>

      <div className="row" style={{gap: 14, alignItems: 'flex-start'}}>
        <div className="col" style={{width: 320, gap: 6}}>
          <div className="box" style={{padding: 0}}>
            {!articles ? (
              <div className="tiny muted" style={{padding: 12}}>loading…</div>
            ) : articles.length === 0 ? (
              <div style={{padding: 12}}>
                <EmptyState label="no lore" hint="seed lore articles via narrative authoring or world ticks (first-of-kind events)." />
              </div>
            ) : (
              articles.map(a => (
                <div key={a.id} onClick={() => setSelectedId(a.id)}
                     style={{padding: '10px 12px', borderBottom: '1px dashed var(--rule-soft)', cursor: 'pointer',
                             background: selectedId === a.id ? 'var(--paper-2)' : 'transparent'}}>
                  <div style={{fontFamily:'var(--serif)', fontWeight: 600, fontSize: 14}}>{a.title}</div>
                  <div className="tiny muted">{a.tags?.join(' · ') ?? '—'}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="box" style={{flex: 1}}>
          {!selected ? (
            <EmptyState arrow label="pick an article" hint="codified lore renders here — text body, links to factions, NPCs, locations." />
          ) : (
            <div>
              <div className="tiny">{(selected.tags?.join(' · ') ?? '').toUpperCase()}</div>
              <div style={{fontFamily:'var(--serif)', fontSize: 26, fontWeight: 600, marginTop: 2}}>{selected.title}</div>
              <hr className="rule dashed" />
              <p style={{fontSize: 14, color:'var(--ink-2)', whiteSpace: 'pre-wrap'}}>{selected.body ?? '— no body —'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
