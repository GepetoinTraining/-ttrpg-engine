/**
 * MM_LORE — Layer 6 ISimulatedMM adapter for lore.ts
 * ======================================================
 *
 * One MMLore per knowledge holder (a settlement's wider lore pool, a
 * library, a guild's archive, etc.). Lives at the holder's node. Monthly
 * cadence. Each resolve folds N months of rumor decay (volatile knowledge
 * fading) and accumulates research output if the holder has a library.
 *
 * Note: rumor SPREAD is event-driven (caravans, NPCs retelling) and lives
 * in `lore.spreadRumor` + `mm-caravan` ingestion. mm-lore here is the
 * holder's own lore pool maintenance.
 *
 * No κ writes — knowledge is the holder's private store. Surfaces read
 * via `serialize().domain`. (A future MM-aggregate could surface a region
 * "lore density" κ but that's not in scope for L6.)
 *
 * Cadence: monthly. Layer: 6.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  decayRumor,
  type Rumor,
  type KnowledgeEntry,
  type Library,
} from './lore.js'
import type { TP } from './tp.js'

export interface MMLoreDomainState {
  holderId: string
  /** Active rumors at this holder. Decays + prunes monthly. */
  rumors: Rumor[]
  /** Settled lore entries (lore-form, codified, etc — durable). */
  knowledge: KnowledgeEntry[]
  /** Optional library at this node — bonus to absorption + capacity. */
  library: Library | null
  cumulative: {
    monthsTicked: number
    rumorsDecayed: number
    rumorsPruned: number
  }
}

export interface MMLoreOptions {
  rumors?: Rumor[]
  knowledge?: KnowledgeEntry[]
  library?: Library
  name?: string
}

export class MMLore extends SimulatedMMBase {
  domain: MMLoreDomainState

  constructor(holderId: string, worldDay: number = 0, opts: MMLoreOptions = {}) {
    const id = `lore:${holderId}`
    const name = opts.name ?? `Lore@${holderId}`
    super(id, name, holderId, 'lore', worldDay)
    this.domain = {
      holderId,
      rumors: opts.rumors ?? [],
      knowledge: opts.knowledge ?? [],
      library: opts.library ?? null,
      cumulative: { monthsTicked: 0, rumorsDecayed: 0, rumorsPruned: 0 },
    }
  }

  // ── Mutators ──

  addRumor(r: Rumor): void { this.domain.rumors.push(r) }
  addKnowledge(k: KnowledgeEntry): void { this.domain.knowledge.push(k) }
  setLibrary(l: Library | null): void { this.domain.library = l }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Decay runs in resolve.
  }

  protected onResolve(daysResolved: number, _worldDay: number, _tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const months = Math.floor(daysResolved / 30)
    if (months === 0) {
      return {
        stateChanges: { monthsTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a month — no decay.`,
        additionalEvents: [],
      }
    }

    const totalDays = months * 30
    let decayed = 0
    const survivors: Rumor[] = []
    for (const r of this.domain.rumors) {
      const expired = decayRumor(r, totalDays)
      decayed++
      if (!expired) survivors.push(r)
    }
    const pruned = this.domain.rumors.length - survivors.length
    this.domain.rumors = survivors

    this.domain.cumulative.monthsTicked += months
    this.domain.cumulative.rumorsDecayed += decayed
    this.domain.cumulative.rumorsPruned += pruned

    const narrative =
      `${this.state.name} (${daysResolved}d, ${months} mo): ` +
      `${decayed} rumors decayed, ${pruned} pruned. ` +
      `${this.domain.rumors.length} rumors, ${this.domain.knowledge.length} lore entries remain.` +
      (this.domain.library ? ` Library: ${this.domain.library.tier} (${this.domain.library.bookCount} books).` : '')

    return {
      stateChanges: {
        monthsTicked: months,
        rumorsDecayed: decayed,
        rumorsPruned: pruned,
        rumorsRemaining: this.domain.rumors.length,
        knowledgeEntries: this.domain.knowledge.length,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMLoreDomainState {
    return {
      holderId: this.domain.holderId,
      rumors: this.domain.rumors.map(r => ({ ...r, sourceChain: [...r.sourceChain] })),
      knowledge: this.domain.knowledge.map(k => ({ ...k })),
      library: this.domain.library ? { ...this.domain.library, knowledgeIds: [...this.domain.library.knowledgeIds] } : null,
      cumulative: { ...this.domain.cumulative },
    }
  }

  // ── Convenience ──

  getRumors(): Rumor[] { return this.domain.rumors }
  getKnowledge(): KnowledgeEntry[] { return this.domain.knowledge }
  getLibrary(): Library | null { return this.domain.library }
}
