/**
 * MM_TECHNOLOGY_WEB — Layer 6 HUB SERVICES adapter for engine/technology-web.ts
 * =================================================================================
 *
 * One MMTechnologyWeb per settlement node. Owns the `unlockedTech` map for
 * that hub: `Record<purpose, Tier>` — the highest tier reached for each
 * tool/craft purpose at this settlement.
 *
 * Weekly cadence. Each resolve folds N weeks of:
 *
 *   1. Lazy-init seed F-tier blobs on first resolve (fishing-tool-F,
 *      mining-tool-F) — every settlement starts with the baseline
 *   2. Optional autonomous NPC craftsman attempts to push tier — each week
 *      gives one mock craftsman roll per active purpose; on success the
 *      tier bumps and a hub hint emits
 *
 * Reads:
 *   κ.knowledge.unlockedTech at the settlement — hydrate state across
 *   resolves and instance handover
 *
 * Writes:
 *   κ.knowledge.unlockedTech at the settlement — projected for cross-system
 *   reads (player UI, market commodity gating, hub hint feeds)
 *
 * Cadence: weekly. Layer: 6 (HUB SERVICES).
 *
 * Phase 2 wiring of Δ.6. Player intents (mfStudyTech) flow through engine-
 * client wrappers as writeKappa intents on `knowledge.unlockedTech` — not
 * handled here. The MM only does the autonomous NPC-craftsman path.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  type TechBlob,
  TECH_SEED_BLOBS,
  getSeedBlob,
  generateHubHints,
} from './technology-web.js'
import { mfStudyTech } from './mf-study-tech.js'
import { type Tier } from './tier.js'
import type { TP, KnowledgeRules } from './tp.js'

// ============================================================
// MM_TECHNOLOGY_WEB STATE
// ============================================================

export interface MMTechnologyWebDomainState {
  settlementNodeId: string
  /** purpose → tier (e.g. 'fishing-tool' → 'E'). */
  unlockedTech: Record<string, Tier>
  /** Hub hints emitted on the most recent resolve (UI / lore-bag picks up). */
  recentHints: string[]
  cumulative: {
    resolveCount: number
    weeksAccumulated: number
    npcAttempts: number
    npcSuccesses: number
    tierBumps: number
  }
  lastResolvedDay: number
}

export interface MMTechnologyWebOptions {
  settlementNodeId: string
  worldDay?: number
  /**
   * Whether autonomous NPC craftsman attempts run on resolve. Default true.
   * Set false for tests that want to verify lazy-init / hydrate behavior
   * without RNG noise.
   */
  npcAttemptsEnabled?: boolean
  /**
   * Mock NPC stats used during autonomous attempts. Real NPC integration is
   * a future pass — this lets Phase 2 produce non-trivial behavior.
   */
  npcStats?: {
    /** d20 supplier; defaults to a deterministic per-week roll. */
    getD20?: (worldDay: number, salt: number) => number
    /** Skill modifier; defaults to +0 (mediocre craftsman). */
    skillModifier?: number
  }
}

// ============================================================
// MM_TECHNOLOGY_WEB
// ============================================================

export class MMTechnologyWeb extends SimulatedMMBase {
  domain: MMTechnologyWebDomainState
  private npcAttemptsEnabled: boolean
  private getD20: (worldDay: number, salt: number) => number
  private npcSkillModifier: number

  constructor(opts: MMTechnologyWebOptions) {
    const id = `technology_web:${opts.settlementNodeId}`
    const name = `Technology Web @ ${opts.settlementNodeId}`
    const worldDay = opts.worldDay ?? 0
    super(id, name, opts.settlementNodeId, 'technology_web', worldDay)

    this.domain = {
      settlementNodeId: opts.settlementNodeId,
      unlockedTech: {},
      recentHints: [],
      cumulative: {
        resolveCount: 0,
        weeksAccumulated: 0,
        npcAttempts: 0,
        npcSuccesses: 0,
        tierBumps: 0,
      },
      lastResolvedDay: worldDay,
    }
    this.npcAttemptsEnabled = opts.npcAttemptsEnabled ?? true
    this.getD20 =
      opts.npcStats?.getD20 ??
      ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
    this.npcSkillModifier = opts.npcStats?.skillModifier ?? 0
  }

  // ────────────────────────────────────────────
  // ACCUMULATE — O(1)
  // ────────────────────────────────────────────

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Cheap — autonomous attempts fold on resolve.
  }

  // ────────────────────────────────────────────
  // RESOLVE — fold N weeks of NPC craftsman attempts
  // ────────────────────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    // Hydrate from κ if available.
    if (tp) {
      const ctx = tp.resolve(this.domain.settlementNodeId)
      const k = ctx?.knowledge as KnowledgeRules | undefined
      if (k?.unlockedTech) {
        this.domain.unlockedTech = { ...k.unlockedTech } as Record<string, Tier>
      }
    }

    // Lazy-init: seed every F-tier blob from TECH_SEED_BLOBS.
    if (Object.keys(this.domain.unlockedTech).length === 0) {
      for (const blob of TECH_SEED_BLOBS) {
        if (blob.tier === 'F') {
          this.domain.unlockedTech[blob.purpose] = 'F'
        }
      }
    }

    const weeks = Math.floor(daysResolved / 7)
    const recentHints: string[] = []
    let npcAttempts = 0
    let npcSuccesses = 0
    let tierBumps = 0

    if (this.npcAttemptsEnabled && weeks > 0) {
      // Try to bump each unlocked purpose by one tier per week (one attempt
      // per week per purpose). The mediocre default modifier means most
      // attempts fail at higher tiers — Phase 2 just needs the wire.
      const purposes = Object.keys(this.domain.unlockedTech)
      let salt = 0
      for (let w = 0; w < weeks; w++) {
        const weekDay = worldDay - daysResolved + (w + 1) * 7
        for (const purpose of purposes) {
          const currentTier = this.domain.unlockedTech[purpose]
          if (currentTier === 'EX') continue
          const blob = getSeedBlob(purpose, currentTier)
          if (!blob) continue
          npcAttempts += 1
          const d20 = this.getD20(weekDay, salt++)
          const r = mfStudyTech(blob, {
            d20,
            skillModifier: this.npcSkillModifier,
            seedKey: `npc:${this.domain.settlementNodeId}:${weekDay}:${purpose}`,
          })
          if (r.receipt.success && r.output.blob) {
            npcSuccesses += 1
            tierBumps += 1
            this.domain.unlockedTech[purpose] = r.output.blob.tier
            for (const h of r.output.hubHints) recentHints.push(h)
          }
        }
      }
    }

    // Always emit current-tier hub hints for picked-up by craftsman MMs.
    for (const purpose in this.domain.unlockedTech) {
      const tier = this.domain.unlockedTech[purpose]
      const blob = getSeedBlob(purpose, tier)
      if (blob) {
        for (const h of generateHubHints(blob)) recentHints.push(h)
      }
    }

    // Dedupe hints (multiple weeks may emit the same tier-unlocked line).
    this.domain.recentHints = Array.from(new Set(recentHints))
    this.domain.cumulative.resolveCount += 1
    this.domain.cumulative.weeksAccumulated += weeks
    this.domain.cumulative.npcAttempts += npcAttempts
    this.domain.cumulative.npcSuccesses += npcSuccesses
    this.domain.cumulative.tierBumps += tierBumps
    this.domain.lastResolvedDay = worldDay

    if (tp) {
      tp.writeDomain(this.domain.settlementNodeId, 'knowledge', {
        unlockedTech: { ...this.domain.unlockedTech },
      } as KnowledgeRules)
    }

    return {
      stateChanges: {
        resolveCount: 1,
        weeksAccumulated: weeks,
        purposes: Object.keys(this.domain.unlockedTech).length,
        npcAttempts,
        npcSuccesses,
        tierBumps,
      },
      narrative:
        `${this.state.name} (${daysResolved}d, ${weeks}w): ` +
        `${Object.keys(this.domain.unlockedTech).length} purposes, ` +
        `npc ${npcSuccesses}/${npcAttempts}, ${tierBumps} tier bumps.`,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMTechnologyWebDomainState {
    return {
      ...this.domain,
      unlockedTech: { ...this.domain.unlockedTech },
      recentHints: [...this.domain.recentHints],
      cumulative: { ...this.domain.cumulative },
    }
  }

  // ────────────────────────────────────────────
  // CONVENIENCE
  // ────────────────────────────────────────────

  getUnlockedTier(purpose: string): Tier | undefined {
    return this.domain.unlockedTech[purpose]
  }

  getRecentHints(): string[] {
    return this.domain.recentHints
  }

  /**
   * Set the unlocked tier for a purpose. Used by callers that want to seed
   * scenarios or apply a player's mfStudyTech result directly.
   */
  setUnlocked(purpose: string, tier: Tier, tp?: TP): void {
    this.domain.unlockedTech[purpose] = tier
    if (tp) {
      tp.writeDomain(this.domain.settlementNodeId, 'knowledge', {
        unlockedTech: { ...this.domain.unlockedTech },
      } as KnowledgeRules)
    }
  }
}
