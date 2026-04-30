/**
 * MM_WARFARE — Layer 3 ISimulatedMM adapter for warfare.ts
 * ============================================================
 *
 * One MMWarfare per Faction's military arm. Lives at the faction's
 * headquarters node. Ticks monthly. Each resolve folds N months of:
 *
 *   - monthlyReadinessTick(units)        — readiness/morale decay
 *   - monthlyArmyUpkeep(units, factionId, treasury) — pay troops; if
 *     treasury empty, readiness + morale drop hard
 *   - monthlyDiplomaticDrift(relation)   — relations drift naturally
 *     (alliances strengthen, rivalries deepen, war erodes standing)
 *
 * Reads:
 *   κ.faction.control (at HQ — to size treasury via getTreasuryFn)
 *
 * Writes:
 *   κ.military at every region where this faction has units stationed.
 *   Aggregate {garrison, readiness, morale, upkeep, fortification?}
 *   so settlements inherit the regional military picture via ancestry.
 *
 * Commander link (intelligence ↔ warfare):
 *   ArmyUnit has a `commanderId` (an NPC). That commander's drives
 *   COULD bias readiness retention or unit-specific behavior — the
 *   hook is here via `setCommanderDrives`, but v1 doesn't apply a
 *   bias. The pattern matches MMFaction's leader integration.
 *
 * Cadence: monthly. Layer: 3 (FACTION).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  monthlyReadinessTick,
  monthlyArmyUpkeep,
  monthlyDiplomaticDrift,
  calculateUpkeep,
  type ArmyUnit,
  type DiplomaticRelation,
  type ArmyUpkeepResult,
  type DiplomaticDriftResult,
} from './warfare.js'
import type { Drives } from './intent.js'
import type { TP, MilitaryRules } from './tp.js'

// ============================================================
// MM_WARFARE
// ============================================================

export interface MMWarfareDomainState {
  factionId: string
  units: ArmyUnit[]
  /** Diplomatic relations involving this faction (incoming + outgoing). */
  relations: DiplomaticRelation[]
  /** Commander drives keyed by commanderId (NPC). Currently advisory; future will bias readiness/aggression. */
  commanderDrives: Record<string, Drives>
  cumulative: {
    monthsTicked: number
    upkeepPaid: number
    upkeepDefaults: number  // count of months where treasury couldn't cover
    statusChanges: number    // count of diplomatic-status flips
  }
  lastUpkeep: ArmyUpkeepResult | null
  lastDriftResults: DiplomaticDriftResult[]
}

export interface MMWarfareOptions {
  /** Live treasury readback — usually `() => faction.treasury` from MMFaction. */
  getTreasuryFn?: () => number
  /** Commander drive map (commanderId → Drives). */
  commanderDrives?: Record<string, Drives>
  name?: string
}

export class MMWarfare extends SimulatedMMBase {
  domain: MMWarfareDomainState
  private getTreasuryFn?: () => number

  constructor(
    factionId: string,
    headquartersNodeId: string,
    units: ArmyUnit[],
    relations: DiplomaticRelation[],
    worldDay: number = 0,
    opts: MMWarfareOptions = {},
  ) {
    super(
      `warfare:${factionId}`,
      opts.name ?? `Warfare:${factionId}`,
      headquartersNodeId,
      'warfare',
      worldDay,
    )
    this.domain = {
      factionId,
      units,
      relations,
      commanderDrives: opts.commanderDrives ?? {},
      cumulative: { monthsTicked: 0, upkeepPaid: 0, upkeepDefaults: 0, statusChanges: 0 },
      lastUpkeep: null,
      lastDriftResults: [],
    }
    this.getTreasuryFn = opts.getTreasuryFn
  }

  /** Update commander drives mid-life (intelligence layer push). */
  setCommanderDrives(commanderId: string, drives: Drives): void {
    this.domain.commanderDrives[commanderId] = drives
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). All monthly logic runs in resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const months = Math.floor(daysResolved / 30)
    if (months === 0) {
      return {
        stateChanges: { monthsTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a month — no military tick.`,
        additionalEvents: [],
      }
    }

    let totalUpkeep = 0
    let defaults = 0
    let statusChanges = 0
    let lastUpkeep: ArmyUpkeepResult | null = null
    const driftResults: DiplomaticDriftResult[] = []

    for (let m = 0; m < months; m++) {
      // 1. Readiness/morale decay
      monthlyReadinessTick(this.domain.units)

      // 2. Upkeep (drains readiness/morale further if treasury can't pay)
      const treasury = this.getTreasuryFn?.() ?? Infinity
      const upkeep = monthlyArmyUpkeep(this.domain.units, this.domain.factionId, treasury)
      lastUpkeep = upkeep
      totalUpkeep += upkeep.totalUpkeep
      if (!upkeep.canAfford) defaults++

      // 3. Diplomatic drift on every relation involving this faction
      for (const relation of this.domain.relations) {
        const drift = monthlyDiplomaticDrift(relation, worldDay + m * 30)
        driftResults.push(drift)
        if (drift.statusChanged) statusChanges++
      }
    }

    this.domain.cumulative.monthsTicked += months
    this.domain.cumulative.upkeepPaid += totalUpkeep
    this.domain.cumulative.upkeepDefaults += defaults
    this.domain.cumulative.statusChanges += statusChanges
    this.domain.lastUpkeep = lastUpkeep
    this.domain.lastDriftResults = driftResults.slice(-20)

    // ── κ writes: military at every region with stationed units ──
    if (tp) {
      const byRegion = new Map<string, ArmyUnit[]>()
      for (const u of this.domain.units) {
        if (!u.regionId) continue
        const arr = byRegion.get(u.regionId) ?? []
        arr.push(u)
        byRegion.set(u.regionId, arr)
      }
      for (const [regionId, regionUnits] of byRegion) {
        const garrison = regionUnits.reduce((s, u) => s + u.currentStrength, 0)
        const avgReadiness = avg(regionUnits, u => u.readiness) / 100
        const avgMorale = avg(regionUnits, u => u.morale) / 100
        const monthlyUpkeep = regionUnits.reduce((s, u) => s + calculateUpkeep(u), 0) * 4
        const military: MilitaryRules = {
          garrison,
          readiness: avgReadiness,
          morale: avgMorale,
          upkeep: monthlyUpkeep,
        }
        tp.writeDomain(regionId, 'military', military)
      }
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${months} mo): ` +
      `${this.domain.units.length} units, upkeep ${totalUpkeep.toFixed(0)} gp` +
      (defaults > 0 ? ` (${defaults} default month${defaults > 1 ? 's' : ''} — readiness suffering)` : '') +
      `, ${statusChanges} diplomatic status flips.`

    return {
      stateChanges: {
        monthsTicked: months,
        unitCount: this.domain.units.length,
        upkeepPaid: totalUpkeep,
        defaults,
        statusChanges,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMWarfareDomainState {
    return {
      factionId: this.domain.factionId,
      units: this.domain.units.map(u => ({ ...u })),
      relations: this.domain.relations.map(r => ({ ...r })),
      commanderDrives: { ...this.domain.commanderDrives },
      cumulative: { ...this.domain.cumulative },
      lastUpkeep: this.domain.lastUpkeep ? { ...this.domain.lastUpkeep } : null,
      lastDriftResults: this.domain.lastDriftResults.map(r => ({ ...r })),
    }
  }

  /** Convenience accessors. */
  getUnits(): ArmyUnit[] {
    return this.domain.units
  }
  getRelations(): DiplomaticRelation[] {
    return this.domain.relations
  }
  /** Total monthly upkeep for currently-held units. */
  totalMonthlyUpkeep(): number {
    return this.domain.units.reduce((s, u) => s + calculateUpkeep(u), 0) * 4
  }
}

// ============================================================
// HELPERS
// ============================================================

function avg<T>(arr: T[], pick: (t: T) => number): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, x) => s + pick(x), 0) / arr.length
}
