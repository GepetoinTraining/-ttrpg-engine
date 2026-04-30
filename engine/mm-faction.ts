/**
 * MM_FACTION — Layer 3 ISimulatedMM adapter for faction.ts
 * ============================================================
 *
 * One MMFaction per Faction. Lives at the faction's headquarters node.
 * Ticks monthly. Each resolve folds N "weeks" of `tickFaction` (the
 * existing function uses weekly income/expense values; the spec doc
 * places factions at monthly cadence so we run 4 ticks per month-resolve).
 *
 * THE LEADER LINK (intelligence ↔ faction):
 *   A faction has members; one is rank='leader'. That leader is an NPC
 *   with their own drives (power / wealth / faith / knowledge / etc per
 *   intent.ts). The faction's strategic behavior is colored by the
 *   leader's drives — a wealth-driven leader advances 'increase_trade'
 *   and 'accumulate_wealth' goals faster; a power-driven warlord pushes
 *   'expand_territory' and 'eliminate_rival'.
 *
 *   MMFaction takes an optional `leaderDrives: Drives` (the leader NPC's
 *   drive profile from intent.ts). Goals aligned with the leader's
 *   strongest drives gain a progress multiplier. Without a leader (or
 *   without drives passed in), goal progress runs from tickFaction's
 *   defaults — the faction is "leaderless" / drifting.
 *
 *   The full intelligence link (knowledge boundaries, identity anchor,
 *   conversation prompt assembly) is the surface's job; here we just
 *   pull the drives because they're what changes the simulation.
 *
 * Writes:
 *   κ.faction.control at every controlled node — { influence, loyalty,
 *   stance } per faction id, so settlements show "Cormyr 80%, Zhentarim
 *   15% (covert)" via tp.resolve.
 *
 * Cadence: monthly. Layer: 3 (FACTION).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  tickFaction,
  type Faction,
  type FactionGoalType,
  type FactionTickResult,
} from './faction.js'
import type { Drives } from './intent.js'
import type { TP, FactionRules } from './tp.js'

// ============================================================
// GOAL → DRIVE MAPPING — leader's drives bias which goals advance
// ============================================================

/**
 * Each goal type maps to one or two of the leader's drives. Goal
 * progress is multiplied by 1 + (sum of aligned drives / 100), so a
 * leader maxed out on `wealth` gives a 1.9× boost to economic goals
 * (90/100 = 0.9 → 1.9× multiplier).
 */
export const GOAL_DRIVE_ALIGNMENT: Record<FactionGoalType, Array<keyof Drives>> = {
  expand_territory:  ['power', 'legacy'],
  increase_trade:    ['wealth'],
  eliminate_rival:   ['power', 'revenge'],
  protect_people:    ['safety', 'duty'],
  accumulate_wealth: ['wealth'],
  spread_faith:      ['faith'],
  acquire_power:     ['power'],
  monopolize:        ['wealth', 'power'],
  liberate:          ['duty', 'safety'],
  survive:           ['safety'],
}

/**
 * Compute the progress multiplier for a goal based on the leader's
 * drives. Returns 1.0 if no leader / no drives. Each aligned drive
 * adds (drive_value / 100) to the multiplier, summed.
 */
export function leaderProgressMultiplier(
  goalType: FactionGoalType,
  drives: Drives | undefined,
): number {
  if (!drives) return 1.0
  const aligned = GOAL_DRIVE_ALIGNMENT[goalType]
  if (!aligned || aligned.length === 0) return 1.0
  const sum = aligned.reduce((s, key) => s + (drives[key] ?? 0) / 100, 0)
  return 1.0 + sum
}

// ============================================================
// MM_FACTION
// ============================================================

export interface MMFactionDomainState {
  faction: Faction
  /** The leader NPC's id (if any). */
  leaderId: string | null
  /** The leader's drive profile, if known. */
  leaderDrives: Drives | null
  /** Cumulative tick stats. */
  cumulative: {
    monthsTicked: number
    treasuryDelta: number
    goalsCompleted: number
  }
  /** Last 4 weeks of tick results from tickFaction. */
  lastTickResults: FactionTickResult[]
}

export interface MMFactionOptions {
  /** Drive profile of the leader NPC (from intent.ts). */
  leaderDrives?: Drives
  /** Override the leader id lookup (default: scan members for rank='leader'). */
  leaderId?: string
  name?: string
}

export class MMFaction extends SimulatedMMBase {
  domain: MMFactionDomainState

  constructor(faction: Faction, worldDay: number = 0, opts: MMFactionOptions = {}) {
    super(
      `faction:${faction.id}`,
      opts.name ?? `Faction:${faction.name}`,
      faction.headquartersNodeId,
      'faction',
      worldDay,
    )

    const leaderId = opts.leaderId
      ?? faction.members.find(m => m.rank === 'leader')?.entityId
      ?? null

    this.domain = {
      faction,
      leaderId,
      leaderDrives: opts.leaderDrives ?? null,
      cumulative: { monthsTicked: 0, treasuryDelta: 0, goalsCompleted: 0 },
      lastTickResults: [],
    }
  }

  /**
   * Update the leader's drive profile (called when intelligence layer
   * has fresh data — leader's drives shifted from a recent event).
   */
  setLeaderDrives(drives: Drives): void {
    this.domain.leaderDrives = drives
  }

  /** Look up the current leader's NPC id. Re-scans members on demand. */
  getLeaderId(): string | null {
    return this.domain.faction.members.find(m => m.rank === 'leader')?.entityId
      ?? this.domain.leaderId
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Strategic logic runs in resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const faction = this.domain.faction
    // tickFaction uses weekly income/expense values; we run one tick per
    // week of resolved time so a monthly resolve = 4 ticks.
    const weeks = Math.floor(daysResolved / 7)
    if (weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a week — no faction tick.`,
        additionalEvents: [],
      }
    }

    let totalTreasuryDelta = 0
    const goalsCompletedThisResolve: string[] = []
    const tickResults: FactionTickResult[] = []

    for (let w = 0; w < weeks; w++) {
      const result = tickFaction(faction)
      totalTreasuryDelta += result.treasuryDelta

      // Apply leader-drive bias to goal progress AFTER tickFaction.
      // (tickFaction already advanced each goal; we add the leader bonus.)
      if (this.domain.leaderDrives) {
        for (const goal of faction.goals) {
          if (!goal.active) continue
          const mult = leaderProgressMultiplier(goal.type, this.domain.leaderDrives)
          if (mult > 1.0) {
            const baseProgress = (goal.priority * 0.5 + Math.min(faction.members.length, 50) * 0.1)
            const bonus = baseProgress * (mult - 1)
            goal.progress = Math.min(100, goal.progress + bonus)
          }
        }
      }

      // Detect goals that hit 100 this tick
      for (const goal of faction.goals) {
        if (goal.active && goal.progress >= 100) {
          goal.active = false
          goalsCompletedThisResolve.push(goal.id)
        }
      }

      tickResults.push(result)
    }

    this.domain.cumulative.monthsTicked += weeks / 4
    this.domain.cumulative.treasuryDelta += totalTreasuryDelta
    this.domain.cumulative.goalsCompleted += goalsCompletedThisResolve.length
    this.domain.lastTickResults = tickResults

    // ── Write κ.faction.control at every controlled node ──
    if (tp) {
      for (const nodeId of faction.controlledNodes) {
        const influence = faction.influence[nodeId] ?? 0
        const stance = pickStance(influence, faction.loyalties)
        const factionKappa: FactionRules = {
          control: {
            [faction.id]: {
              influence,
              loyalty: faction.loyalties[faction.id] ?? 100,  // self-loyalty
              stance,
            },
          },
        }
        tp.writeDomain(nodeId, 'faction', factionKappa)
      }
    }

    const leaderNote = this.domain.leaderDrives
      ? ` (leader drives biasing goals)`
      : ` (no active leader)`
    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} wks)${leaderNote}: ` +
      `treasury ${faction.treasury.toFixed(0)} (Δ ${totalTreasuryDelta >= 0 ? '+' : ''}${totalTreasuryDelta.toFixed(0)}), ` +
      `${faction.goals.filter(g => g.active).length} active goals, ` +
      `${goalsCompletedThisResolve.length} completed.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        treasuryDelta: totalTreasuryDelta,
        goalsCompleted: goalsCompletedThisResolve.length,
        controlledNodes: faction.controlledNodes.length,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMFactionDomainState {
    return {
      faction: { ...this.domain.faction },
      leaderId: this.domain.leaderId,
      leaderDrives: this.domain.leaderDrives ? { ...this.domain.leaderDrives } : null,
      cumulative: { ...this.domain.cumulative },
      lastTickResults: this.domain.lastTickResults.map(r => ({ ...r })),
    }
  }

  /** Convenience: peek the underlying faction. */
  getFaction(): Faction {
    return this.domain.faction
  }
}

// ============================================================
// HELPERS
// ============================================================

function pickStance(
  influence: number,
  _loyalties: Record<string, number>,
): 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied' {
  // Influence-only stance for v1; loyalties array filters when we
  // wire two-faction comparisons in faction-vs-faction relations.
  if (influence >= 80) return 'allied'
  if (influence >= 50) return 'friendly'
  if (influence >= 25) return 'neutral'
  if (influence >= 10) return 'unfriendly'
  return 'hostile'
}
