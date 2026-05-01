// @ts-nocheck
'use client'

import React from 'react'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/DMConsole.tsx — Session HQ for human DMs.
// Composes: scene strip + initiative tracker + AI orchestrator panel + party HP
// rail + tabbed logs (session/NPC/whisper/rolls/villain).
//
// Wiring status: strip-only. Nothing here binds yet. The AI panel needs the
// orchestrator wired (engine/gm.ts), initiative needs mm-scene, party HP
// needs mm-party, logs need /api/world/log + a per-session filter. Stripped
// hardcoded mock content for semi-prod.

export default function DMConsole() {
  const [aiView, setAiView] = React.useState<'orchestrator' | 'npc' | 'whisper'>('orchestrator')
  const [logTab, setLogTab] = React.useState<'session' | 'npc' | 'whisper' | 'rolls' | 'villain'>('session')

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">02 · Session HQ — live + prep</div>
          <h2>DM Console <FidelityBadge level="strip-only" /></h2>
        </div>
        <span className="who">DM laptop view</span>
      </div>

      <div className="aside" style={{ marginBottom: 18 }}>
        ↳ session HQ for the human DM. orchestrates AI assistance, NPC voicing, whispers,
        and tracks the live session state. <i>nothing wired yet — needs engine/gm.ts orchestrator
        + mm-scene initiative + mm-party HP bridge.</i>
      </div>

      {/* Top strip: scene + initiative + party HP */}
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <div className="box" style={{ gridColumn: 'span 2' }}>
          <div className="box-title">
            <h3>Current Scene</h3>
            <span className="meta">—</span>
          </div>
          <EmptyState
            label="no active scene"
            hint="bind to mm-session.activeCard once a session is running. surface scene description, conditions, lighting, weather."
          />
        </div>

        <div className="box">
          <div className="box-title"><h3>Initiative</h3><span className="meta">—</span></div>
          <EmptyState label="no combat in progress" hint="bind to mm-scene.initiativeOrder when a fight starts." />
        </div>
      </div>

      {/* AI Panel + side rail */}
      <div className="grid-3">
        <div style={{ gridColumn: 'span 2' }}>
          <div className="ai-panel">
            <div className="ai-tabs">
              <div className={`ai-tab ${aiView === 'orchestrator' ? 'active' : ''}`} onClick={() => setAiView('orchestrator')}>
                Orchestrator
                <span className="sub">DM ↔ AI · context</span>
              </div>
              <div className={`ai-tab ${aiView === 'npc' ? 'active' : ''}`} onClick={() => setAiView('npc')}>
                NPC Voicebox
                <span className="sub">in-character · DM-piloted</span>
              </div>
              <div className={`ai-tab ${aiView === 'whisper' ? 'active' : ''}`} onClick={() => setAiView('whisper')}>
                Whispers · Q&amp;A
                <span className="sub">private to one player</span>
              </div>
            </div>

            <div className="ai-body">
              {aiView === 'orchestrator' && (
                <EmptyState
                  label="orchestrator pending"
                  hint="wires to engine/gm.ts (4 play modes). DM drafts intent → AI returns scene flares, NPC reactions, stat-block lookups, alt-rolls."
                />
              )}
              {aiView === 'npc' && (
                <EmptyState
                  label="NPC voicebox pending"
                  hint="bind to engine/intelligence.ts agent identities. DM picks an NPC, AI voices in-character with personality + memory frame."
                />
              )}
              {aiView === 'whisper' && (
                <EmptyState
                  label="whisper channel pending"
                  hint="per-player private Q&A. requires the railgun spectrum for cert-scoped fan-out."
                />
              )}
            </div>

            <div className="composer">
              <div className="input">
                {aiView === 'npc' ? 'steer NPC… (or type their line)' :
                 aiView === 'whisper' ? 'whisper to player…' :
                 'ask the AI to draft, lookup, or summarize…'}
              </div>
              <button className="btn" disabled>attach card</button>
              <button className="btn primary" disabled>send <span className="kbd">↵</span></button>
            </div>
          </div>
        </div>

        {/* Right rail: party HP + quick actions */}
        <div className="col">
          <div className="box">
            <div className="box-title"><h3>Party</h3><span className="meta">—</span></div>
            <EmptyState label="party state pending" hint="bind to mm-party once cert-hash party formation lands." />
          </div>

          <div className="box dashed">
            <div className="box-title"><h3>Quick Actions</h3><span className="meta">DM-only</span></div>
            <div className="col" style={{ gap: 6 }}>
              <button className="btn" disabled>＋ apply damage / heal</button>
              <button className="btn" disabled>＋ add condition</button>
              <button className="btn" disabled>＋ secret roll</button>
              <button className="btn" disabled>＋ split off whisper</button>
              <button className="btn" disabled>＋ tick villain clock</button>
            </div>
            <div className="tiny muted" style={{ marginTop: 6 }}>actions enabled once mm-scene + mm-character bridge is wired.</div>
          </div>

          <div className="box filled">
            <div className="box-title"><h3>On Deck</h3><span className="meta">prepared</span></div>
            <EmptyState label="no prep loaded" hint="bind to mm-session prepared cards / hooks ahead of the next beat." />
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="section-title">Tabbed logs · everything the AI has done</div>
      <div className="tabs">
        {([
          ['session', 'Session log'],
          ['npc', 'NPC log'],
          ['whisper', 'Whisper log'],
          ['rolls', 'Rolls'],
          ['villain', 'Villain ticks'],
        ] as const).map(([k, lbl]) => (
          <div key={k} className={`tab ${logTab === k ? 'active' : ''}`} onClick={() => setLogTab(k)}>{lbl}</div>
        ))}
      </div>
      <div className="box" style={{ borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <EmptyState
          label={`${logTab} log empty`}
          hint="bind each log to the appropriate filter on /api/world/log (session-id scoped, npc-action scoped, whisper-cert scoped, dice receipts, villain ticks)."
        />
      </div>
    </div>
  )
}
