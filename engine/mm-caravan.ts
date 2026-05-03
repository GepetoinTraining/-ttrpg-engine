/**
 * MM_CARAVAN — Layer 2 ISimulatedMM adapter for caravan.ts
 * ============================================================
 *
 * Caravans are the lifeblood of Faerûn. They:
 *   - Move CARGO (commodities) between hubs                  → unloadCaravan
 *   - Carry BULLION shipments between bank vaults            → mm-banking hook
 *   - Spread RUMORS — each retelling decays fidelity          → lore.spreadRumor
 *   - Carry BOOKS (knowledge that passes intact)             → lore.knowledgeFlowTick
 *
 * One MMCaravan per Caravan. Entity-on-edge: `position.type='on_edge'`,
 * `mile` updates each day as segments tick by. When the caravan arrives
 * at its destination hub, position flips to `at_node` and the `arrived`
 * flag fires the unload package.
 *
 * Daily resolve fold:
 *   for each day until arrived/destroyed:
 *     1. Look up current segment's danger + toll (via callback)
 *     2. Read weather κ for speedMod + spoilageMult at the destination hub
 *     3. advanceCaravanDay(...) → segments advanced, encounter, arrival
 *     4. Update entity position on the edge
 *
 * On arrival: collects unload + bullion + rumor effects into a single
 * `CaravanArrivalResult` envelope the caller acts on.
 *
 * Cadence: daily (caravans move every day they're en route).
 * Layer: 2 (ECONOMY).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  advanceCaravanDay,
  unloadCaravan,
  type Caravan,
  type CaravanDayResult,
  type UnloadResult,
} from './caravan'
import {
  spreadRumor,
  knowledgeFlowTick,
  type Rumor,
  type KnowledgeFlowResult,
  type Library,
} from './lore'
import type { BullionShipment } from './mm-banking'
import type { TP, WeatherRules } from './tp'

// ============================================================
// SEGMENT INFO — what each step of the journey looks like
// ============================================================

export interface SegmentInfo {
  /** 0–10 danger level (0 = safe road, 10 = goblin-infested mountain pass) */
  dangerLevel: number
  /** GP toll for traversing this segment (0 = free road) */
  toll: number
}

export interface MMCaravanOptions {
  /**
   * Look up danger + toll for a given segment index.
   * Default: { dangerLevel: 0, toll: 0 } (safe + free).
   * Callers integrating with world-edge.ts pass a real lookup that reads
   * from `edge.segments[segmentAtMile(...)].danger / .tollGp`.
   */
  getSegmentInfo?: (caravan: Caravan, segmentIndex: number) => SegmentInfo
  /**
   * Optional library at the destination — boosts rumor absorption per
   * `LIBRARY_RESEARCH_BONUS[tier]`. Lookup since libraries can change.
   */
  getDestinationLibrary?: (destinationHubId: string) => Library | undefined
  /** Pre-rolled d20 source. Default: deterministic from worldDay+salt. */
  getD20?: (worldDay: number, salt: number) => number
  name?: string
}

// ============================================================
// ARRIVAL ENVELOPE — what the caller acts on
// ============================================================

export interface CaravanArrivalResult {
  caravan: Caravan
  unload: UnloadResult
  /** Bullion shipments to deliver to destination banks. */
  bullionDelivered: BullionShipment[]
  /** Aggregate knowledge flow at destination (rumors absorbed + books traded). */
  knowledgeFlow?: KnowledgeFlowResult
  /**
   * Each rumor carried, mutated by one spread step. Surface or hub system
   * decides which NPCs receive these (or seed them broadly).
   */
  rumorsSpread: Rumor[]
}

// ============================================================
// MM_CARAVAN
// ============================================================

export interface MMCaravanDomainState {
  caravan: Caravan
  /** Rumors picked up at origin, spread on arrival. */
  rumorsCarried: Rumor[]
  /** Books in transit (count — books are items, this is for knowledge flow). */
  booksCarried: number
  /** Bullion shipments aboard this caravan. Linked to source MMBanking. */
  bullionAboard: BullionShipment[]
  /** Daily advance results across all resolves (last 30 by default for memory). */
  dayResults: CaravanDayResult[]
  /** Set once the caravan arrives or is destroyed. */
  arrival: CaravanArrivalResult | null
}

export function caravanEntityId(caravan: Caravan): string {
  return `caravan:${caravan.id}`
}

export class MMCaravan extends SimulatedMMBase {
  domain: MMCaravanDomainState
  private getSegmentInfo: (caravan: Caravan, segmentIndex: number) => SegmentInfo
  private getDestinationLibrary?: (hubId: string) => Library | undefined
  private getD20: (worldDay: number, salt: number) => number

  constructor(caravan: Caravan, worldDay: number = 0, opts: MMCaravanOptions = {}) {
    super(
      caravanEntityId(caravan),
      opts.name ?? `Caravan:${caravan.id}`,
      // Position-by-node: while en_route the caravan's "home node" for
      // observation purposes is its destination — when the party reaches
      // the destination, the caravan should resolve.
      caravan.destinationHubId,
      'caravan',
      worldDay,
    )
    this.domain = {
      caravan,
      rumorsCarried: [],
      booksCarried: 0,
      bullionAboard: [],
      dayResults: [],
      arrival: null,
    }
    this.getSegmentInfo = opts.getSegmentInfo ?? (() => ({ dangerLevel: 0, toll: 0 }))
    this.getDestinationLibrary = opts.getDestinationLibrary
    this.getD20 = opts.getD20 ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  /**
   * Register the caravan as an entity on its current edge so spatial
   * queries find it.  Position updates on each resolve.
   */
  registerWith(tp: TP): void {
    tp.registerEntity({
      id: this.state.id,
      type: 'caravan',
      position: this.computePosition(),
    })
  }

  /** Load a rumor into the caravan before departure. */
  loadRumor(rumor: Rumor): void {
    this.domain.rumorsCarried.push(rumor)
  }

  /** Load N books for transport. */
  loadBooks(count: number): void {
    this.domain.booksCarried += count
  }

  /** Attach a bullion shipment to the caravan (from MMBanking.shipBullion). */
  loadBullion(shipment: BullionShipment): void {
    this.domain.bullionAboard.push(shipment)
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Daily advance happens inside resolve so we read live κ.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const c = this.domain.caravan

    // If already arrived/destroyed, no-op (resolve was already triggered).
    if (c.status === 'arrived' || c.status === 'destroyed') {
      return {
        stateChanges: { alreadyResolved: 1 },
        narrative: `${this.state.name}: already ${c.status}.`,
        additionalEvents: [],
      }
    }

    let arrivedDay = -1
    let destroyedDay = -1

    for (let d = 0; d < daysResolved; d++) {
      if (c.status !== 'en_route') break

      const seg = this.getSegmentInfo(c, c.currentSegment)
      const wMod = readSpeedModifier(tp, c.destinationHubId)
      const sMod = readSpoilageMultiplier(tp, c.destinationHubId)
      const d20 = this.getD20(worldDay + d, c.currentSegment)

      const result = advanceCaravanDay(c, seg.dangerLevel, seg.toll, wMod, d20, sMod)
      this.domain.dayResults.push(result)

      // Update entity position on the edge if TP available
      if (tp) {
        tp.moveEntity(this.state.id, this.computePosition())
      }

      if (result.arrived) {
        arrivedDay = worldDay + d + 1
        break
      }
      // advanceCaravanDay can mutate status to 'destroyed' on a failed
      // encounter — TS doesn't see the mutation across the call boundary,
      // so we re-check via a runtime status snapshot.
      const statusAfter: string = c.status
      if (statusAfter === 'destroyed') {
        destroyedDay = worldDay + d + 1
        break
      }
    }

    // Trim memory of dayResults
    if (this.domain.dayResults.length > 60) {
      this.domain.dayResults = this.domain.dayResults.slice(-30)
    }

    let narrative: string
    if (arrivedDay >= 0) {
      this.domain.arrival = this.fireArrival(arrivedDay, tp)
      // Move the entity to the destination hub
      if (tp) {
        tp.moveEntity(this.state.id, { type: 'at_node', nodeId: c.destinationHubId })
      }
      narrative =
        `${this.state.name}: arrived at ${c.destinationHubId} (${c.daysTraveled}d). ` +
        `Unloaded ${this.domain.arrival.unload.deliveredItems.length} items, ` +
        `delivered ${this.domain.arrival.bullionDelivered.length} bullion shipments, ` +
        `spread ${this.domain.arrival.rumorsSpread.length} rumors.`
    } else if (destroyedDay >= 0) {
      this.domain.arrival = this.fireDestruction(destroyedDay)
      narrative =
        `${this.state.name}: DESTROYED en route (${c.daysTraveled}d). ` +
        `${this.domain.arrival.bullionDelivered.length} bullion lost.`
    } else {
      narrative =
        `${this.state.name}: en route — segment ${c.currentSegment}/${c.totalSegments}, ` +
        `${c.cargo.length} cargo items, ${c.daysTraveled}d traveled.`
    }

    return {
      stateChanges: {
        segment: c.currentSegment,
        cargoCount: c.cargo.length,
        guards: c.guards,
        arrived: arrivedDay >= 0 ? 1 : 0,
        destroyed: destroyedDay >= 0 ? 1 : 0,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMCaravanDomainState {
    return {
      caravan: { ...this.domain.caravan, cargo: [...this.domain.caravan.cargo] },
      rumorsCarried: this.domain.rumorsCarried.map(r => ({ ...r })),
      booksCarried: this.domain.booksCarried,
      bullionAboard: this.domain.bullionAboard.map(b => ({ ...b })),
      dayResults: this.domain.dayResults.map(r => ({ ...r })),
      arrival: this.domain.arrival ? { ...this.domain.arrival } : null,
    }
  }

  /** Convenience: peek the arrival result if the caravan has reached destination. */
  getArrival(): CaravanArrivalResult | null {
    return this.domain.arrival
  }

  // ── Helpers ──

  private computePosition() {
    const c = this.domain.caravan
    if (c.status === 'arrived') {
      return { type: 'at_node' as const, nodeId: c.destinationHubId }
    }
    // mile is approximate — segments are abstracted slices of the edge
    const fraction = c.totalSegments > 0
      ? Math.min(1, c.currentSegment / c.totalSegments)
      : 0
    return {
      type: 'on_edge' as const,
      edgeId: c.edgeId,
      mile: fraction,
      direction: 'forward' as const,
    }
  }

  /**
   * Compute the arrival package: unload cargo, deliver bullion, spread
   * rumors. Mutates bullion shipments to 'delivered' status. Each rumor
   * spreads once with fidelity drift (more spreads happen at the hub
   * level via NPC-to-NPC retelling — out of scope for v1).
   */
  private fireArrival(worldDay: number, tp?: TP): CaravanArrivalResult {
    const c = this.domain.caravan

    // Operating cost = days × profile.costPerDay + tolls already deducted
    const totalCost = c.daysTraveled * 0  // cost is per-day result, sum elsewhere
    const unload = unloadCaravan(c, totalCost)

    // Bullion: mark all aboard shipments as delivered. Caller should also
    // call MMBanking.receiveBullion at the destination + mark source.
    const bullionDelivered: BullionShipment[] = []
    for (const ship of this.domain.bullionAboard) {
      if (ship.status === 'in_transit' || ship.status === 'staged') {
        ship.status = 'delivered'
        ship.deliveredDay = worldDay
      }
      bullionDelivered.push({ ...ship })
    }

    // Rumors: each carried rumor mutates per spread. Use a deterministic
    // d20 per rumor based on worldDay + index.
    const rumorsSpread = this.domain.rumorsCarried.map((rumor, i) => {
      const d20 = this.getD20(worldDay, 1000 + i)
      // Spread to "destination hub" as a synthetic recipient
      return spreadRumor(rumor, c.destinationHubId, d20)
    })

    // Knowledge flow aggregate
    let knowledgeFlow: KnowledgeFlowResult | undefined
    if (this.domain.rumorsCarried.length > 0 || this.domain.booksCarried > 0) {
      const lib = this.getDestinationLibrary?.(c.destinationHubId)
      knowledgeFlow = knowledgeFlowTick(
        c.originHubId,
        c.destinationHubId,
        this.domain.rumorsCarried.length,
        this.domain.booksCarried,
        lib,
      )
    }

    // Suppress unused-tp warning — kept for future κ.lore writes when the
    // domain is added to the inheritable schema.
    void tp

    return { caravan: { ...c }, unload, bullionDelivered, knowledgeFlow, rumorsSpread }
  }

  /**
   * Compute the destruction package: all aboard bullion is lost; cargo
   * is lost; no rumors arrive (they die with the messengers).
   */
  private fireDestruction(worldDay: number): CaravanArrivalResult {
    const c = this.domain.caravan
    const bullionLost: BullionShipment[] = []
    for (const ship of this.domain.bullionAboard) {
      if (ship.status !== 'delivered') {
        ship.status = 'lost'
        ship.lossReason = `Caravan ${c.id} destroyed en route`
      }
      bullionLost.push({ ...ship })
    }
    void worldDay
    return {
      caravan: { ...c },
      unload: {
        deliveredItems: [],
        totalValueGp: 0,
        profitGp: 0,
        tripDays: c.daysTraveled,
        totalCost: 0,
      },
      bullionDelivered: bullionLost,  // includes lost ones; caller checks status
      rumorsSpread: [],
    }
  }
}

// ── κ readers ──

function readSpeedModifier(tp: TP | undefined, nodeId: string): number {
  if (!tp) return 1.0
  const ctx = tp.resolve(nodeId)
  const w = ctx?.weather as WeatherRules | undefined
  return w?.modifiers?.travelSpeed ?? 1.0
}

function readSpoilageMultiplier(tp: TP | undefined, nodeId: string): number {
  if (!tp) return 1.0
  const ctx = tp.resolve(nodeId)
  const w = ctx?.weather as WeatherRules | undefined
  return w?.modifiers?.spoilageRate ?? 1.0
}
