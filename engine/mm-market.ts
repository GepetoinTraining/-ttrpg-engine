/**
 * MM_MARKET — Layer 2 ISimulatedMM adapter for market.ts
 * =========================================================
 *
 * One MMMarket per SettlementMarket. Lives at the settlement node.
 * Ticks weekly. Each resolve folds N weeks of `weeklyMarketTick`:
 *
 *   For each week:
 *     1. Sync supply from κ.economy.commodities at the node (the
 *        L1 producers — extraction, agriculture, husbandry — wrote
 *        these supply numbers in earlier-layer ticks).
 *     2. Run weeklyMarketTick(market, d20):
 *        - Tick down active events
 *        - Run discoverPrice for each commodity (supply + demand →
 *          new price + trend)
 *        - Simulate merchant decisions (upgrade / hire / fire)
 *        - Detect bankruptcies
 *        - Roll new events on low d20
 *     3. Write computed prices back into κ.economy.commodities at
 *        the node (price + trend; supply preserved from L1 input).
 *
 * Cadence: weekly. Layer: 2 (ECONOMY — reads L1 extraction κ).
 *
 * Slow-life: this is where extracted ore becomes liquidity. Player
 * intent `sell_item` consults market.prices[resource] to compute
 * gold owed; `buy_item` (future) checks merchant inventories.
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  weeklyMarketTick,
  type SettlementMarket,
  type MarketTickResult,
} from './market.js'
import type { TP } from './tp.js'

export interface MMMarketDomainState {
  market: SettlementMarket
  /** Cumulative bankruptcies / new events / etc across all resolves. */
  cumulative: {
    weeksTicked: number
    bankruptcies: number
    eventsGenerated: number
    eventsResolved: number
  }
  /** Last tick result (most recent week). */
  lastTick: MarketTickResult | null
}

export interface MMMarketOptions {
  getD20?: (worldDay: number, salt: number) => number
  name?: string
}

export class MMMarket extends SimulatedMMBase {
  domain: MMMarketDomainState
  private getD20: (worldDay: number, salt: number) => number

  constructor(market: SettlementMarket, worldDay: number = 0, opts: MMMarketOptions = {}) {
    super(`market:${market.hubId}`, opts.name ?? `Market:${market.hubId}`,
          market.hubId, 'market', worldDay)
    this.domain = {
      market,
      cumulative: { weeksTicked: 0, bankruptcies: 0, eventsGenerated: 0, eventsResolved: 0 },
      lastTick: null,
    }
    this.getD20 = opts.getD20 ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Price discovery + merchant decisions run inside resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const market = this.domain.market
    const weeks = Math.floor(daysResolved / 7)
    if (weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a week — no tick.`,
        additionalEvents: [],
      }
    }

    let totalBankruptcies = 0
    let totalNewEvents = 0
    let totalResolvedEvents = 0
    let lastResult: MarketTickResult | null = null

    for (let w = 0; w < weeks; w++) {
      // Sync supply from κ before each tick — L1 producers may have
      // written fresh supply numbers via mm-extraction / mm-agriculture
      // / mm-husbandry earlier this resolve cycle.
      this.syncSupplyFromKappa(tp)

      const d20 = this.getD20(worldDay, w)
      const result = weeklyMarketTick(market, d20)
      totalBankruptcies += result.bankruptcies.length
      totalNewEvents += result.newEvents.length
      totalResolvedEvents += result.resolvedEvents.length
      lastResult = result
    }

    this.domain.cumulative.weeksTicked += weeks
    this.domain.cumulative.bankruptcies += totalBankruptcies
    this.domain.cumulative.eventsGenerated += totalNewEvents
    this.domain.cumulative.eventsResolved += totalResolvedEvents
    this.domain.lastTick = lastResult

    // Write computed prices back into κ.economy.commodities.
    if (tp && Object.keys(market.prices).length > 0) {
      this.writePricesToKappa(tp)
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} weeks): ` +
      `${Object.keys(market.prices).length} commodities priced, ` +
      `${totalNewEvents} new events, ${totalResolvedEvents} resolved` +
      (totalBankruptcies > 0 ? `, ${totalBankruptcies} merchant bankruptcies` : '') +
      `.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        commoditiesPriced: Object.keys(market.prices).length,
        bankruptcies: totalBankruptcies,
        newEvents: totalNewEvents,
        resolvedEvents: totalResolvedEvents,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMMarketDomainState {
    return {
      market: { ...this.domain.market },
      cumulative: { ...this.domain.cumulative },
      lastTick: this.domain.lastTick ? { ...this.domain.lastTick } : null,
    }
  }

  /** Convenience: peek the market state. */
  getMarket(): SettlementMarket {
    return this.domain.market
  }

  /** Convenience: get the current price of a commodity. */
  getPrice(commodityId: string): number | undefined {
    return this.domain.market.prices[commodityId]?.currentPrice
  }

  // ── Helpers ──

  /**
   * Read κ.economy.commodities[*].supply at the hub and copy into
   * market.prices[*].supply. Commodities listed in market.prices
   * but absent from κ stay at their existing supply (no override).
   */
  private syncSupplyFromKappa(tp?: TP): void {
    if (!tp) return
    const ctx = tp.resolve(this.domain.market.hubId)
    const commodities = (ctx?.economy?.commodities ?? {}) as Record<
      string, { supply?: number }
    >
    for (const [id, priceData] of Object.entries(this.domain.market.prices)) {
      const externalSupply = commodities[id]?.supply
      if (typeof externalSupply === 'number') {
        priceData.supply = externalSupply
      }
    }
  }

  /**
   * Write market.prices[*] back into κ.economy.commodities[*]. Only
   * sets price + trend; supply is owned by L1 producers and we don't
   * stomp it.
   */
  private writePricesToKappa(tp: TP): void {
    const update: Record<string, { price?: number; trend?: 'rising' | 'stable' | 'falling' }> = {}
    for (const [id, p] of Object.entries(this.domain.market.prices)) {
      const trend = p.trend === 'rising' || p.trend === 'spiking' ? 'rising'
        : p.trend === 'falling' || p.trend === 'crashing' ? 'falling'
        : 'stable'
      update[id] = { price: p.currentPrice, trend }
    }
    tp.writeDomain(this.domain.market.hubId, 'economy', { commodities: update })
  }
}
