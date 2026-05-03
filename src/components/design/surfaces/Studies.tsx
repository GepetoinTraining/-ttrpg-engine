// @ts-nocheck
'use client'

import * as React from 'react'
import { useWorld } from '@/lib/use-world'
import {
  computeStudyQueue,
  extractStudyValuesFromActions,
  maxStudySlots,
  STUDY_DAYS_BY_TIER,
  type StudyEntry,
  type StartStudyValue,
  type CompleteStudyValue,
  type Tier,
} from '../../../../engine/study'
import { EmptyState, FidelityBadge } from './_chips'

// surfaces/Studies.tsx — Surface 49.
//
// Player-facing study queue. Reads from useWorld() — no local game-state.
// Intent loop:
//   1. Filter worldApi.log → extractStudyValuesFromActions → computeStudyQueue
//   2. Render Active / Pending Claim / Completed
//   3. Start form emits worldApi.startStudy(value) + push()
//   4. Claim button calls worldApi.completeStudy(value) + push() THEN
//      POSTs /api/study/complete for the LLM-supervised discovery
//
// Eligibility (per Pedro 2026-05-02):
//   Studies are supposed to happen only inside a claimed slot (a tendable
//   claim of type building / workshop / deposit / farm_plot / node held by
//   the active character at the current node) OR inside a "rest inn area".
//   The full eligibility check requires a claims endpoint or claim-on-TPB
//   replay — not in scope this slice. v1 shows the queue unconditionally
//   and the start form is open; the eligibility banner notes the deferral.

const TIER_OPTIONS: Tier[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX']

function intModifierFromCharacter(c: any): number {
  // CharacterListItem has no abilities yet (see src/lib/character.ts:124).
  // Try common shapes; fall back to 0 (=> 1 slot).
  if (!c) return 0
  if (typeof c.intModifier === 'number') return c.intModifier
  if (typeof c.intMod === 'number') return c.intMod
  const score =
    c?.abilities?.int ??
    c?.abilities?.INT ??
    c?.modifiers?.int ??
    c?.finalScores?.int
  if (typeof score === 'number') return Math.floor((score - 10) / 2)
  return 0
}

export default function Studies() {
  const worldApi = useWorld()
  const [resourceId, setResourceId] = React.useState('')
  const [tier, setTier] = React.useState<Tier>('F')
  const [actionFeedback, setActionFeedback] = React.useState<string | null>(null)
  const [claiming, setClaiming] = React.useState<string | null>(null)
  const [pushing, setPushing] = React.useState(false)

  const character = worldApi.character
  const worldStatus = worldApi.worldStatus
  const partyNodeId = worldStatus?.partyNodeId
  const worldDay = worldStatus?.worldDay ?? 0

  // INT modifier — derive from active member if shape allows, default 0.
  const activeMember = worldApi.partyMembers.find((c: any) => c.id === character?.id)
  const intMod = intModifierFromCharacter(activeMember)

  // Reconstruct queue from TPB log tail (last 50 entries via use-world poll).
  const queue = React.useMemo(() => {
    if (!character) return null
    const actions = worldApi.log.map((e: any) => e.action)
    const { starts, completes } = extractStudyValuesFromActions(actions)
    return computeStudyQueue(starts, completes, character.id, worldDay)
  }, [worldApi.log, character?.id, worldDay])

  if (!character || !worldStatus) {
    return (
      <div>
        <div className="surface-head">
          <div>
            <div className="crumbs">49 · studies · research queue</div>
            <h2>Studies <FidelityBadge level="partial" /></h2>
          </div>
        </div>
        <EmptyState
          label="no active character"
          hint="log into the world from CharacterSelect to begin a study."
        />
      </div>
    )
  }

  const slotCap = maxStudySlots(intMod)
  const slotsUsed = queue?.active.length ?? 0
  const canStart = slotsUsed < slotCap

  const handleStart = async () => {
    if (!resourceId || !canStart || !partyNodeId) return
    const studyId = `study_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const value: StartStudyValue = {
      studyId,
      characterId: character.id,
      resourceId,
      hubId: partyNodeId,
      resourceTier: tier,
      startDay: worldDay,
      slotIndex: slotsUsed,
    }
    setPushing(true)
    try {
      worldApi.startStudy(value)
      await worldApi.push()
      setActionFeedback(`started study on ${resourceId} (tier ${tier})`)
      setResourceId('')
    } catch (e: unknown) {
      setActionFeedback(`push failed: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setPushing(false)
      setTimeout(() => setActionFeedback(null), 2400)
    }
  }

  const handleClaim = async (entry: StudyEntry) => {
    setClaiming(entry.studyId)
    try {
      // Optimistic local intent — record the complete_study writeKappa first
      // so the queue reflects the claim attempt immediately on next poll.
      const value: CompleteStudyValue = {
        studyId: entry.studyId,
        characterId: character.id,
        worldDay,
      }
      worldApi.completeStudy(value)
      await worldApi.push()

      // Trigger the LLM-supervised discovery.
      const res = await fetch('/api/study/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          studyId: entry.studyId,
          characterId: character.id,
          worldDay,
        }),
      })
      if (!res.ok) {
        let msg = `${res.status}`
        try {
          const j = await res.json()
          if (j?.error) msg = j.error
        } catch {}
        throw new Error(msg)
      }
      const j = await res.json().catch(() => ({}))
      const title = j?.discovery?.title ?? j?.title ?? entry.studyId
      setActionFeedback(`claimed: ${title}`)
      await worldApi.refresh()
    } catch (e: unknown) {
      setActionFeedback(`claim failed: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setClaiming(null)
      setTimeout(() => setActionFeedback(null), 3000)
    }
  }

  return (
    <div>
      <div className="surface-head">
        <div>
          <div className="crumbs">
            49 · studies · research queue · {character.personaType}
          </div>
          <h2>Studies <FidelityBadge level="partial" /></h2>
        </div>
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <span className="tiny">
            slots <b>{slotsUsed}/{slotCap}</b> · INT mod {intMod >= 0 ? '+' : ''}{intMod}
          </span>
        </div>
      </div>

      <div className="aside" style={{ maxWidth: 880, marginBottom: 16 }}>
        ↳ start a study on a resource you've gathered. completion takes time
        by tier (F = 1d → EX = 360d). when a study finishes, claim it for an
        LLM-supervised discovery — a recipe, a property, a monster habit.
      </div>

      {/* ── Eligibility banner — placeholder pending claim/inn check ── */}
      <div className="box" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="tiny">LOCATION</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginTop: 2 }}>
              {worldStatus.partyNodeLabel ?? partyNodeId}
            </div>
          </div>
          <span className="chip sm">day {worldDay}</span>
        </div>
        <hr className="rule dashed" />
        <div className="tiny muted">
          ↳ studying must happen at a claim you hold (workshop, deposit, plot,
          building) <em>or</em> a rest inn area. full eligibility check pending —
          v1 starts unconditionally; the engine tracks ownership in
          <code style={{ marginLeft: 4, marginRight: 4 }}>engine/claims.ts</code>
          and the gating reads will land alongside the claims surface.
        </div>
      </div>

      {/* ── Active queue ── */}
      <div className="box" style={{ marginBottom: 12 }}>
        <div className="box-title">
          <h3>Active</h3>
          <span className="meta">{queue?.active.length ?? 0}</span>
        </div>
        {!queue || queue.active.length === 0 ? (
          <EmptyState label="no studies in flight" hint="start one below." />
        ) : (
          <div className="col" style={{ gap: 6, marginTop: 6 }}>
            {queue.active.map((s) => {
              const remaining = Math.max(0, s.completionDay - worldDay)
              return (
                <div
                  key={s.studyId}
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    borderBottom: '1px dashed var(--rule-soft)',
                    paddingBottom: 4,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>
                      {s.resourceId}
                    </div>
                    <div className="tiny muted">
                      {s.hubId} · tier {s.resourceTier} · slot {s.slotIndex}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 96 }}>
                    <div className="tiny">{remaining}d remaining</div>
                    <div className="bar gold" style={{ width: 80, marginLeft: 'auto' }}>
                      <span
                        style={{
                          width: `${Math.min(100, ((STUDY_DAYS_BY_TIER[s.resourceTier] - remaining) / STUDY_DAYS_BY_TIER[s.resourceTier]) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Pending claim ── */}
      {queue && queue.pendingClaim.length > 0 && (
        <div className="box" style={{ marginBottom: 12 }}>
          <div className="box-title">
            <h3>Ready to claim</h3>
            <span className="meta">{queue.pendingClaim.length}</span>
          </div>
          <div className="col" style={{ gap: 6, marginTop: 6 }}>
            {queue.pendingClaim.map((s) => (
              <div
                key={s.studyId}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px dashed var(--rule-soft)',
                  paddingBottom: 4,
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>
                    {s.resourceId}
                  </div>
                  <div className="tiny muted">
                    {s.hubId} · tier {s.resourceTier} · finished day {s.completionDay}
                  </div>
                </div>
                <button
                  className="btn sm primary"
                  disabled={claiming === s.studyId}
                  onClick={() => handleClaim(s)}
                >
                  {claiming === s.studyId ? '… claiming' : '✦ Claim'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Completed history ── */}
      {queue && queue.completed.length > 0 && (
        <div className="box" style={{ marginBottom: 12 }}>
          <div className="box-title">
            <h3>Completed</h3>
            <span className="meta">{queue.completed.length}</span>
          </div>
          <div className="col" style={{ gap: 4, marginTop: 6 }}>
            {queue.completed.slice(-10).map((s) => (
              <div
                key={s.studyId}
                className="row"
                style={{ justifyContent: 'space-between', fontSize: 13 }}
              >
                <span>{s.resourceId}</span>
                <span className="muted">
                  {s.hubId} · tier {s.resourceTier}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Start form ── */}
      <div className="box">
        <div className="box-title">
          <h3>Start a new study</h3>
          {actionFeedback && (
            <span className="tiny" style={{ color: 'var(--accent-green)' }}>
              ✓ {actionFeedback}
            </span>
          )}
        </div>
        <div
          className="row"
          style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="tiny">Resource id</div>
            <input
              type="text"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              placeholder='e.g. "flora-wood-oak"'
              style={{
                width: '100%',
                padding: '6px 8px',
                fontFamily: 'var(--mono)',
                background: 'var(--paper)',
                border: '1px solid var(--rule)',
                color: 'var(--ink)',
              }}
            />
          </div>
          <div>
            <div className="tiny">Tier</div>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              style={{
                padding: '6px 8px',
                fontFamily: 'var(--mono)',
                background: 'var(--paper)',
                border: '1px solid var(--rule)',
                color: 'var(--ink)',
              }}
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} · {STUDY_DAYS_BY_TIER[t]}d
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn sm primary"
            disabled={!resourceId || !canStart || pushing}
            onClick={handleStart}
          >
            {pushing ? '… pushing' : '✦ Start study'}
          </button>
        </div>
        {!canStart && (
          <div className="tiny" style={{ color: 'var(--accent-red)', marginTop: 6 }}>
            ↳ all {slotCap} slots in use. claim or wait for an active study to free a slot.
          </div>
        )}
        <div className="tiny muted" style={{ marginTop: 6 }}>
          ↳ resource id is the wire-domain string ({STUDY_INTENT_HINT}). once
          inventory is wired, this becomes a picker scoped to what you've gathered.
        </div>
      </div>
    </div>
  )
}

const STUDY_INTENT_HINT = 'flora-wood-*, mining-metal-*, fauna-hide-*, etc'
