/**
 * MM_DUNGEON_GATE — Layer 5 ISimulatedMM adapter for dungeon-gate.ts
 * =====================================================================
 *
 * One MMDungeonGate per `DungeonGate`. Lives on the edge where the gate
 * sits (entity-on-edge). Weekly cadence. Each resolve folds N weeks of
 * `tickGateWithEcology` (which itself wraps `tickDungeonGate` with the
 * adaptation pool feedback loop on respawn).
 *
 * THE OVERFLOW → MIGRATION LOOP (per Pedro):
 *   "weekly check to upgrade it to a cap from where it spawned around,
 *    if it's not cleared, create a dungeon overflow, then all adventurers
 *    around migrate to deal with it."
 *
 *   The mechanism is κ-mediated, not coupling:
 *     - On every resolve, the gate writes `κ.ecology.dangerLevel` AND
 *       `dominantThreats` at the gate's REGION node.
 *     - When the gate overflows or a leader emerges, dangerLevel jumps
 *       and the gate id is added to dominantThreats.
 *     - κ.ecology is inheritable, so every settlement in the region
 *       inherits the elevated danger.
 *     - Each MMGuild in the region reads its hub's κ and auto-generates
 *       a bounty quest with `targetId = gate:<id>`.
 *     - NPC parties dispatched on those bounties become the migration —
 *       the world's response to the overflow.
 *
 *   So the gate doesn't TELL the guilds anything. It just changes the
 *   danger level of its region. The guilds (and players) RESPOND to that
 *   on their own ticks. Decoupled, observation-driven.
 *
 * Reads:
 *   κ.ecology.adaptations[species] — via tickGateWithEcology on respawn
 *
 * Writes:
 *   κ.ecology.dangerLevel + .dominantThreats at the gate's region
 *
 * Cadence: weekly. Layer: 5 (ECOLOGY).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  type DungeonGate,
  type GateTickResult,
} from './dungeon-gate.js'
import {
  tickGateWithEcology,
} from './gate-lifecycle.js'
import type { TP, EcologyRules } from './tp.js'

// ============================================================
// MM_DUNGEON_GATE STATE
// ============================================================

export interface MMDungeonGateDomainState {
  gate: DungeonGate
  /** Region node where the adaptation pool + danger κ live. */
  regionNodeId: string
  /** Cumulative stats. */
  cumulative: {
    weeksTicked: number
    totalSpawned: number
    totalOverflowed: number
    respawnsTriggered: number
    leadersEmerged: number
  }
  /** Last tick's raw result. */
  lastTickResult: GateTickResult | null
  /** Last computed dangerLevel — for surfaces that need to read it. */
  lastDangerLevel: number
}

export interface MMDungeonGateOptions {
  name?: string
  /** d20 supplier — defaults to deterministic pool keyed on worldDay. */
  getD20?: (worldDay: number, salt: number) => number
}

// ============================================================
// MM_DUNGEON_GATE
// ============================================================

export class MMDungeonGate extends SimulatedMMBase {
  domain: MMDungeonGateDomainState
  private getD20: (worldDay: number, salt: number) => number

  constructor(
    gate: DungeonGate,
    regionNodeId: string,
    worldDay: number = 0,
    opts: MMDungeonGateOptions = {},
  ) {
    const id = `gate:${gate.id}`
    const name = opts.name ?? `${gate.name}@${gate.edgeId}:${gate.mileMarker}`
    // The MM is conceptually positioned at the region for κ inheritance,
    // but the entity registry tracks the gate on its edge.
    super(id, name, regionNodeId, 'dungeon_gate', worldDay)

    this.domain = {
      gate,
      regionNodeId,
      cumulative: {
        weeksTicked: 0, totalSpawned: 0, totalOverflowed: 0,
        respawnsTriggered: 0, leadersEmerged: 0,
      },
      lastTickResult: null,
      lastDangerLevel: 0,
    }

    this.getD20 = opts.getD20
      ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  /**
   * Register this gate as an entity in the TP entity registry. Gates
   * live ON edges (not at nodes), so the position is on_edge.
   */
  registerWith(tp: TP): void {
    const g = this.domain.gate
    tp.registerEntity({
      id: this.state.id,
      type: 'dungeon_gate',
      position: {
        type: 'on_edge',
        edgeId: g.edgeId,
        mile: g.mileMarker,
        direction: 'forward',
      },
    })
  }

  // ────────────────────────────────────────────
  // ACCUMULATE — O(1)
  // ────────────────────────────────────────────

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Gates do no work between observations. The fold runs in resolve.
  }

  // ────────────────────────────────────────────
  // RESOLVE — fold N weeks
  // ────────────────────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const gate = this.domain.gate
    const weeks = Math.floor(daysResolved / 7)

    if (!tp || weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): ${weeks === 0 ? 'less than a week — no tick' : 'no tp'}.`,
        additionalEvents: [],
      }
    }

    let totalSpawned = 0
    let totalOverflowed = 0
    let respawnsTriggered = 0
    let leadersEmerged = 0
    let lastResult: GateTickResult | null = null

    for (let w = 0; w < weeks; w++) {
      const weekDay = worldDay - daysResolved + (w + 1) * 7
      const out = tickGateWithEcology({
        tp,
        regionNodeId: this.domain.regionNodeId,
        gate,
        worldDay: weekDay,
        d20: this.getD20(weekDay, 0),
        respawnD20s: [
          this.getD20(weekDay, 1),
          this.getD20(weekDay, 2),
          this.getD20(weekDay, 3),
          this.getD20(weekDay, 4),
        ],
      })
      totalSpawned += out.tickResult.spawned
      totalOverflowed += out.tickResult.overflowed
      if (out.tickResult.respawned) respawnsTriggered++
      if (out.tickResult.leaderEmerged) leadersEmerged++
      lastResult = out.tickResult
    }

    // Write κ.ecology — danger propagation. This is HOW the migration loop fires.
    const dangerLevel = computeDangerLevel(gate)
    const dominantThreats = computeDominantThreats(gate)
    tp.writeDomain(this.domain.regionNodeId, 'ecology', {
      dangerLevel,
      dominantThreats,
    } as EcologyRules)

    this.domain.cumulative.weeksTicked += weeks
    this.domain.cumulative.totalSpawned += totalSpawned
    this.domain.cumulative.totalOverflowed += totalOverflowed
    this.domain.cumulative.respawnsTriggered += respawnsTriggered
    this.domain.cumulative.leadersEmerged += leadersEmerged
    this.domain.lastTickResult = lastResult
    this.domain.lastDangerLevel = dangerLevel

    const stateNote = gate.state === 'overflowing'
      ? ` OVERFLOWING (radius ${gate.overflowRadius} mi, ${gate.weeksOverflowing} wks)`
      : gate.state === 'capped'
        ? ` capped (${gate.timesCleared} clears)`
        : ''

    const leaderNote = leadersEmerged > 0
      ? ` LEADER EMERGED.`
      : gate.leaderEmerged
        ? ` (leader present)`
        : ''

    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} wks)${stateNote}${leaderNote}: ` +
      `+${totalSpawned} spawned, ${totalOverflowed} overflowed` +
      (respawnsTriggered > 0 ? `, ${respawnsTriggered} respawns` : '') +
      `. dangerLevel=${dangerLevel.toFixed(2)}.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        spawned: totalSpawned,
        overflowed: totalOverflowed,
        respawnsTriggered,
        leadersEmerged,
        dangerLevel,
        currentInternal: gate.currentInternal,
        overflowRadius: gate.overflowRadius,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMDungeonGateDomainState {
    return {
      gate: { ...this.domain.gate },
      regionNodeId: this.domain.regionNodeId,
      cumulative: { ...this.domain.cumulative },
      lastTickResult: this.domain.lastTickResult ? { ...this.domain.lastTickResult } : null,
      lastDangerLevel: this.domain.lastDangerLevel,
    }
  }

  // ────────────────────────────────────────────
  // CONVENIENCE
  // ────────────────────────────────────────────

  /** Read access for surfaces. */
  getGate(): DungeonGate {
    return this.domain.gate
  }

  /** Last computed danger level (after most recent resolve). */
  getDangerLevel(): number {
    return this.domain.lastDangerLevel
  }
}

// ============================================================
// DANGER COMPUTATION — gate state → κ.ecology.dangerLevel
// ============================================================

/**
 * Map a gate's current state to a danger level in [0, 1] suitable for
 * `κ.ecology.dangerLevel`.
 *
 *   cleared       → 0       (permanent destruction)
 *   capped        → 0.10    (recently sealed, mild lingering danger)
 *   dormant       → 0.05    (discovered but inert)
 *   active (T1)   → 0.20    (low-tier active gate)
 *   active (T5)   → 0.60    (epic active gate, even contained)
 *   overflowing   → up to 1.00 — scaled by overflow radius and tier
 *
 * Tier weighs more heavily because higher-tier gates produce stronger
 * monsters; overflow weighs heavily because it's the SIGNAL the gate is
 * actively bleeding into the world.
 */
export function computeDangerLevel(gate: DungeonGate): number {
  if (gate.state === 'cleared') return 0
  if (gate.state === 'capped') return 0.10
  if (gate.state === 'dormant') return 0.05

  const tierFactor = gate.tier / 5      // 0.2 .. 1.0

  if (gate.state === 'overflowing') {
    // Overflow ramps fast: radius alone can saturate at high tiers
    const overflowFactor = Math.min(1, gate.overflowRadius / 12)
    const leaderBoost = gate.leaderEmerged ? 0.15 : 0
    return Math.min(1, 0.4 + tierFactor * 0.25 + overflowFactor * 0.35 + leaderBoost)
  }

  // active state — moderate danger scaled by tier
  return Math.min(0.6, 0.2 + tierFactor * 0.4)
}

/**
 * Build the dominantThreats array surfaced via κ.ecology. For
 * overflowing gates / emerged leaders, the gate id leads the list so
 * quest generators can target the gate directly. The species always
 * appears as a fallback.
 */
export function computeDominantThreats(gate: DungeonGate): string[] {
  if (gate.state === 'cleared') return []
  if (gate.state === 'overflowing' || gate.leaderEmerged) {
    return [`gate:${gate.id}`, gate.speciesId]
  }
  return [gate.speciesId]
}
