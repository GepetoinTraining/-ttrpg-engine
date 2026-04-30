/**
 * MM_NARRATIVE — Layer 6 ISimulatedMM adapter for narrative.ts
 * ================================================================
 *
 * One MMNarrative per campaign. Lives at the campaign root node (planet
 * or continent — whatever the adventure considers "home"). Weekly cadence
 * (cheap; the heavy lifting happens on session events).
 *
 * Each resolve:
 *   1. Recomputes campaign progress snapshot (arcs/quests/beats counters).
 *   2. Suggests the next beat type via `suggestNextBeat` based on the
 *      recent beat history.
 *   3. Escalates rabbit-hole depth where applicable
 *      (active rabbit hole + N weeks → next depth tier).
 *
 * Most of narrative is event-driven (DM marks beats occurred, players
 * complete quests). The MM is a CALCULATOR + STATE CONTAINER. Surfaces
 * read via `serialize().domain`.
 *
 * Cadence: weekly. Layer: 6 (HUB SERVICES).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  calculateProgress,
  suggestNextBeat,
  escalateDepth,
  shouldConnect,
  type CampaignNarrative,
  type CampaignProgress,
  type PacingSuggestion,
  type PacingBias,
  type BeatType,
} from './narrative.js'
import type { TP } from './tp.js'

export interface MMNarrativeDomainState {
  campaignId: string
  narrative: CampaignNarrative
  /** Pacing bias affects next-beat suggestions. */
  pacingBias: PacingBias
  /** Last party HP fraction (0..1) — feeds pacing. Updated by caller. */
  lastPartyHpPercent: number
  /** Last N beat types — feeds variety logic. */
  recentBeatTypes: BeatType[]
  cumulative: {
    weeksTicked: number
    beatsSuggested: number
    rabbitHolesEscalated: number
    rabbitHolesPromoted: number
  }
  lastProgress: CampaignProgress | null
  lastSuggestion: PacingSuggestion | null
}

export interface MMNarrativeOptions {
  pacingBias?: PacingBias
  recentBeatTypes?: BeatType[]
  partyHpPercent?: number
  name?: string
}

export class MMNarrative extends SimulatedMMBase {
  domain: MMNarrativeDomainState

  constructor(
    campaignNodeId: string,
    narrative: CampaignNarrative,
    worldDay: number = 0,
    opts: MMNarrativeOptions = {},
  ) {
    const id = `narrative:${narrative.campaignId}`
    const name = opts.name ?? `Narrative:${narrative.campaignId}`
    super(id, name, campaignNodeId, 'narrative', worldDay)

    this.domain = {
      campaignId: narrative.campaignId,
      narrative,
      pacingBias: opts.pacingBias ?? 'balanced',
      lastPartyHpPercent: opts.partyHpPercent ?? 1.0,
      recentBeatTypes: opts.recentBeatTypes ?? [],
      cumulative: {
        weeksTicked: 0, beatsSuggested: 0,
        rabbitHolesEscalated: 0, rabbitHolesPromoted: 0,
      },
      lastProgress: null,
      lastSuggestion: null,
    }
  }

  // ── Mutators (DM/surface controls) ──

  recordBeatOccurred(beatId: string, beatType: BeatType): void {
    const beat = this.domain.narrative.beats.find(b => b.id === beatId)
    if (beat) beat.status = 'occurred'
    this.domain.recentBeatTypes.push(beatType)
    if (this.domain.recentBeatTypes.length > 10) {
      this.domain.recentBeatTypes.shift()
    }
  }

  setPartyHpPercent(hp: number): void {
    this.domain.lastPartyHpPercent = Math.max(0, Math.min(1, hp))
  }

  setPacingBias(bias: PacingBias): void {
    this.domain.pacingBias = bias
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1).
  }

  protected onResolve(daysResolved: number, _worldDay: number, _tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const weeks = Math.floor(daysResolved / 7)
    if (weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a week — story holds.`,
        additionalEvents: [],
      }
    }

    // 1. Snapshot progress
    const progress = calculateProgress(this.domain.narrative)

    // 2. Suggest next beat
    const suggestion = suggestNextBeat(
      this.domain.recentBeatTypes,
      progress.quests.active,
      this.domain.lastPartyHpPercent,
      this.domain.pacingBias,
    )

    // 3. Escalate rabbit holes that have been active for a while
    let escalated = 0
    let promoted = 0
    for (const h of this.domain.narrative.rabbitHoles) {
      if (h.status !== 'active') continue
      if (shouldConnect(h)) {
        h.status = 'promoted'
        h.depthLevel = 'side_arc'
        promoted++
        continue
      }
      // escalateDepth mutates hole.currentDepth + hole.depthLevel
      const before = h.depthLevel
      const after = escalateDepth(h)
      if (after !== before) escalated++
    }

    this.domain.cumulative.weeksTicked += weeks
    this.domain.cumulative.beatsSuggested += weeks
    this.domain.cumulative.rabbitHolesEscalated += escalated
    this.domain.cumulative.rabbitHolesPromoted += promoted
    this.domain.lastProgress = progress
    this.domain.lastSuggestion = suggestion

    const narrativeText =
      `${this.state.name} (${daysResolved}d, ${weeks} wks): ` +
      `progress ${progress.overallPercent}%, ${progress.arcs.active} active arcs, ${progress.quests.active} active quests. ` +
      `Next beat: ${suggestion.suggestedBeatType} (tension ${suggestion.tension.toFixed(2)}). ` +
      `${escalated} rabbit holes escalated, ${promoted} promoted to side arcs.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        progressPercent: progress.overallPercent,
        activeQuests: progress.quests.active,
        activeArcs: progress.arcs.active,
        rabbitHolesEscalated: escalated,
        rabbitHolesPromoted: promoted,
        tension: suggestion.tension,
      },
      narrative: narrativeText,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMNarrativeDomainState {
    return {
      campaignId: this.domain.campaignId,
      narrative: this.domain.narrative,   // shallow — narrative state mutates in place
      pacingBias: this.domain.pacingBias,
      lastPartyHpPercent: this.domain.lastPartyHpPercent,
      recentBeatTypes: [...this.domain.recentBeatTypes],
      cumulative: { ...this.domain.cumulative },
      lastProgress: this.domain.lastProgress ? { ...this.domain.lastProgress } : null,
      lastSuggestion: this.domain.lastSuggestion ? { ...this.domain.lastSuggestion } : null,
    }
  }

  // ── Convenience ──

  getProgress(): CampaignProgress | null { return this.domain.lastProgress }
  getSuggestion(): PacingSuggestion | null { return this.domain.lastSuggestion }
}
