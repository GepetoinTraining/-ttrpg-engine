/**
 * MM_EXTRACTION — Layer 1 ISimulatedMM adapter for production-chain.tickExtraction
 * ====================================================================================
 *
 * One MMExtraction per Extraction operation (a workforce assigned to a
 * Deposit). Lives at the deposit's .tp node. Ticks weekly. Each resolve
 * folds daysResolved days of tickExtraction:
 *
 *   - Daily output = baseOutputPerDay × laborRatio × quality × efficiency
 *   - Reserves drop on non-renewable; capacity drops + regen on renewable
 *   - When reserves hit 0, extraction.status flips to 'exhausted'
 *   - Output accumulates into extraction.stockpile
 *   - Summary κ.economy.commodities at the node gets the supply boost
 *
 * Slow-life note: this is the NPC-driven side. The PLAYER side
 * (interactions.resolveExtract) writes to the SAME deposit. They share
 * state. If a player drains the iron vein, the next NPC tick finds it
 * depleted; if NPCs work it down between sessions, players arrive to
 * find less than they remember. That's the living-world feature.
 *
 * Cadence: weekly. Layer: 1 (EXTRACTION — reads weather κ from L0).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  tickExtraction,
  type Deposit,
  type Extraction,
} from './production-chain'
import type { TP } from './tp'

export interface MMExtractionDomainState {
  extraction: Extraction
  deposit: Deposit
  /** Total commodities produced during the most recent resolve. */
  lastTotal: Record<string, number>
  /** Cumulative produced across all resolves of this MM. */
  cumulativeTotal: Record<string, number>
}

export class MMExtraction extends SimulatedMMBase {
  domain: MMExtractionDomainState

  constructor(
    extraction: Extraction,
    deposit: Deposit,
    worldDay: number = 0,
    name?: string,
  ) {
    super(
      `extraction:${extraction.id}`,
      name ?? `Extraction:${extraction.id}`,
      deposit.nodeId,
      'extraction',
      worldDay,
    )
    this.domain = {
      extraction,
      deposit,
      lastTotal: {},
      cumulativeTotal: {},
    }
  }

  // O(1) — extraction's daily output is folded inside resolve, not here.
  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // Intentionally empty. base class already tracks daysPending.
  }

  protected onResolve(daysResolved: number, _worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const total: Record<string, number> = {}

    // Fold daysResolved days of NPC-driven extraction. tickExtraction
    // mutates extraction + deposit in place; subsequent days see the
    // updated state (so depletion stops further yield mid-fold).
    for (let i = 0; i < daysResolved; i++) {
      const dailyOut = tickExtraction(this.domain.extraction, this.domain.deposit)
      for (const [id, qty] of Object.entries(dailyOut)) {
        total[id] = (total[id] ?? 0) + qty
      }
      // If the extraction exhausted reserves, stop the fold early.
      if (this.domain.extraction.status === 'exhausted') break
    }

    this.domain.lastTotal = total
    for (const [id, qty] of Object.entries(total)) {
      this.domain.cumulativeTotal[id] = (this.domain.cumulativeTotal[id] ?? 0) + qty
    }

    // Push the supply increment into κ.economy.commodities at the deposit's
    // node. We deep-merge with whatever's already there (other extractions
    // at the same node aggregate into the same supply pool).
    if (tp && Object.keys(total).length > 0) {
      const ctx = tp.resolve(this.state.nodeId)
      const existing = (ctx?.economy?.commodities ?? {}) as Record<
        string,
        { supply?: number; demand?: number; price?: number; trend?: 'rising'|'stable'|'falling' }
      >
      const supplyUpdate: typeof existing = {}
      for (const [id, qty] of Object.entries(total)) {
        const prevSupply = existing[id]?.supply ?? 0
        supplyUpdate[id] = { supply: prevSupply + qty }
      }
      tp.writeDomain(this.state.nodeId, 'economy', { commodities: supplyUpdate })
    }

    const primary = this.domain.deposit.primaryCommodityId
    const primaryProduced = total[primary] ?? 0
    const status = this.domain.extraction.status
    const reserveNote = this.domain.deposit.remainingReserves !== undefined
      ? ` Reserves: ${this.domain.deposit.remainingReserves.toFixed(0)}.`
      : ''
    const narrative =
      `${this.state.name} (${daysResolved}d, ${status}): produced ` +
      `${primaryProduced.toFixed(1)} ${primary}` +
      (Object.keys(total).length > 1 ? ` + ${Object.keys(total).length - 1} byproduct(s)` : '') +
      `.${reserveNote}`

    return {
      stateChanges: { primaryProduced, daysWorked: daysResolved },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMExtractionDomainState {
    return {
      extraction: { ...this.domain.extraction },
      deposit: { ...this.domain.deposit },
      lastTotal: { ...this.domain.lastTotal },
      cumulativeTotal: { ...this.domain.cumulativeTotal },
    }
  }

  /** Convenience: peek the current extraction state without re-resolving. */
  getExtraction(): Extraction {
    return { ...this.domain.extraction }
  }
  getDeposit(): Deposit {
    return { ...this.domain.deposit }
  }
}
