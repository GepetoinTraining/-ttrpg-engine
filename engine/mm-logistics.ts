/**
 * MM_LOGISTICS — Layer 2 ISimulatedMM adapter for logistics.ts
 * ==============================================================
 *
 * One MMShipment per Shipment. Sister to MMCaravan but at a different
 * abstraction level:
 *
 *   MMCaravan    — per VEHICLE on a specific edge, daily segment ticks,
 *                  detailed encounters, rumors + bullion + cargo + books
 *   MMShipment   — per DELIVERY between two nodes, daily mile progress,
 *                  abstract hazard rolls, manifest + currency
 *
 * They coexist. A real caravan picks up shipments and rumors; an abstract
 * shipment may use ANY transport mode (porter, pack_animal, cog, galleon,
 * teleportation). The logistics layer is the player-facing "I want to
 * move 500 lb of iron from Baldur's Gate to Waterdeep" surface.
 *
 * Entity position: `abstract` — shipments don't track segment-by-segment.
 * Surfaces query by ownerId or by destination instead.
 *
 * Cadence: daily. Layer: 2 (ECONOMY).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  tickShipment,
  type Shipment,
  type ShipmentTickResult,
} from './logistics.js'
import type { TP } from './tp.js'

export interface MMShipmentDomainState {
  shipment: Shipment
  cumulative: {
    daysTicked: number
    hazardsTriggered: number
    delaysIncurred: number
  }
  /** All tick results across resolves (last 30 retained). */
  tickHistory: ShipmentTickResult[]
}

export interface MMShipmentOptions {
  /** d20 source for hazard rolls. Default: deterministic from worldDay+salt. */
  getD20?: (worldDay: number, salt: number) => number
  name?: string
}

/** Stable entity id used in the TP entity registry. */
export function shipmentEntityId(shipment: Shipment): string {
  return `shipment:${shipment.id}`
}

export class MMShipment extends SimulatedMMBase {
  domain: MMShipmentDomainState
  private getD20: (worldDay: number, salt: number) => number

  constructor(shipment: Shipment, worldDay: number = 0, opts: MMShipmentOptions = {}) {
    super(
      shipmentEntityId(shipment),
      opts.name ?? `Shipment:${shipment.id}`,
      // Logical home node for resolve targeting: destination — when the
      // party arrives at the dest, observation collapses pending miles.
      shipment.destinationNodeId,
      'shipment',
      worldDay,
    )
    this.domain = {
      shipment,
      cumulative: { daysTicked: 0, hazardsTriggered: 0, delaysIncurred: 0 },
      tickHistory: [],
    }
    this.getD20 = opts.getD20 ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  /**
   * Register the shipment as an abstract entity. Shipments aren't bound
   * to a specific edge segment — the logistics layer is mode-agnostic.
   */
  registerWith(tp: TP): void {
    tp.registerEntity({
      id: this.state.id,
      type: 'shipment',
      position: { type: 'abstract' },
    })
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Daily ticking happens inside resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, _tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const ship = this.domain.shipment

    // Loading / arrived / delivered / lost — no further ticks.
    if (ship.status !== 'in_transit') {
      return {
        stateChanges: { skipped: 1, status: 0 },
        narrative: `${this.state.name}: status=${ship.status} — no transit ticks.`,
        additionalEvents: [],
      }
    }

    const startProgress = ship.progressMiles
    let arrivedDay = -1
    let lostDay = -1
    let hazardsThisResolve = 0

    for (let d = 0; d < daysResolved; d++) {
      if ((ship.status as string) !== 'in_transit') break

      const d20 = this.getD20(worldDay + d, ship.progressMiles)
      const result = tickShipment(ship, worldDay + d, d20)

      // Apply tick result back onto the shipment
      ship.progressMiles = result.progressMiles
      ship.events.push(...result.events)
      hazardsThisResolve += result.events.length

      // Apply cargo loss from any hazards that fired this day
      for (const ev of result.events) {
        if (ev.cargoLostPercent > 0 && ship.manifest.length > 0) {
          // Reduce each manifest line proportionally (rounded down)
          for (const line of ship.manifest) {
            const lost = Math.floor(line.quantity * ev.cargoLostPercent)
            line.quantity -= lost
            line.weightLbs *= (1 - ev.cargoLostPercent)
            line.valueGP *= (1 - ev.cargoLostPercent)
          }
          ship.totalWeightLbs *= (1 - ev.cargoLostPercent)
        }
      }

      this.domain.tickHistory.push(result)

      if (result.lost) {
        ship.status = 'lost'
        lostDay = worldDay + d + 1
        break
      }
      if (result.arrived) {
        ship.status = 'arrived'
        arrivedDay = worldDay + d + 1
        break
      }
    }

    if (this.domain.tickHistory.length > 60) {
      this.domain.tickHistory = this.domain.tickHistory.slice(-30)
    }

    this.domain.cumulative.daysTicked += daysResolved
    this.domain.cumulative.hazardsTriggered += hazardsThisResolve

    let narrative: string
    if (arrivedDay >= 0) {
      narrative =
        `${this.state.name}: ARRIVED at ${ship.destinationNodeId} ` +
        `(${ship.progressMiles.toFixed(0)}/${ship.distanceMiles.toFixed(0)} miles, ` +
        `${ship.events.length} events).`
    } else if (lostDay >= 0) {
      narrative =
        `${this.state.name}: LOST en route ` +
        `(${ship.progressMiles.toFixed(0)} miles in, ` +
        `${ship.events.length} events).`
    } else {
      narrative =
        `${this.state.name}: in transit, ${ship.progressMiles.toFixed(0)}/${ship.distanceMiles.toFixed(0)} miles ` +
        `(+${(ship.progressMiles - startProgress).toFixed(0)}).`
    }

    return {
      stateChanges: {
        progressMiles: ship.progressMiles,
        progressDelta: ship.progressMiles - startProgress,
        hazards: hazardsThisResolve,
        arrived: arrivedDay >= 0 ? 1 : 0,
        lost: lostDay >= 0 ? 1 : 0,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMShipmentDomainState {
    return {
      shipment: {
        ...this.domain.shipment,
        manifest: this.domain.shipment.manifest.map(m => ({ ...m })),
        currency: { ...this.domain.shipment.currency },
        events: this.domain.shipment.events.map(e => ({ ...e })),
      },
      cumulative: { ...this.domain.cumulative },
      tickHistory: this.domain.tickHistory.map(r => ({
        ...r,
        events: r.events.map(e => ({ ...e })),
      })),
    }
  }

  /** Convenience: peek the shipment without resolving. */
  getShipment(): Shipment {
    return this.domain.shipment
  }

  /** Has the shipment arrived (status === 'arrived')? */
  hasArrived(): boolean {
    return this.domain.shipment.status === 'arrived'
  }

  /** Was the shipment lost? */
  isLost(): boolean {
    return this.domain.shipment.status === 'lost'
  }

  /**
   * Mark the shipment as fully delivered (after the destination
   * container has received the manifest). Caller owns the actual
   * container deposit.
   */
  markDelivered(): boolean {
    if (this.domain.shipment.status !== 'arrived') return false
    this.domain.shipment.status = 'delivered'
    return true
  }
}
