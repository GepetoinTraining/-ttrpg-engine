/**
 * MM_CURRENCY — Layer 2 ISimulatedMM adapter for currency.ts
 * =============================================================
 *
 * One MMCurrency per region/kingdom group. Lives at the highest .tp
 * node where the rate set logically applies — typically the planet or
 * a continent so settlements inherit `κ.economy.exchangeRates` via
 * ancestry resolve.
 *
 * Each resolve folds N weeks of `weeklyExchangeTick(rate, from, to,
 * d20, worldDay)` for every rate in the set:
 *
 *   - Volume decays toward baseline (0.95× per week)
 *   - Trust-differential pressure
 *   - Inactive currencies depreciate
 *   - d20 noise for low-volume rates
 *
 * Writes κ.economy.exchangeRates as a flat
 *   `${fromCurrencyId}->${toCurrencyId}` → rate map.
 *
 * Banking interacts with currency: a vault holding "gold pieces" needs
 * a CurrencySystem to know whether those are Cormyrean Lions, Sembian
 * Crowns, or Calishite Pegasi. MMBanking holds a `currencyId` reference;
 * inter-bank transfers use `convertCurrency` against a rate from this MM.
 *
 * Cadence: weekly. Layer: 2 (ECONOMY).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  weeklyExchangeTick,
  type CurrencySystem,
  type ExchangeRate,
  type ExchangeTickResult,
} from './currency.js'
import type { TP } from './tp.js'

export interface MMCurrencyDomainState {
  /** All currencies tracked by this MM (typically one per kingdom). */
  currencies: CurrencySystem[]
  /** All exchange rates between pairs. */
  rates: ExchangeRate[]
  /** Most recent tick's rate-by-rate result. */
  lastTickResults: ExchangeTickResult[]
  /** Cumulative weeks ticked. */
  weeksTicked: number
}

export interface MMCurrencyOptions {
  getD20?: (worldDay: number, salt: number) => number
  name?: string
}

export class MMCurrency extends SimulatedMMBase {
  domain: MMCurrencyDomainState
  private getD20: (worldDay: number, salt: number) => number

  constructor(
    nodeId: string,
    currencies: CurrencySystem[],
    rates: ExchangeRate[],
    worldDay: number = 0,
    opts: MMCurrencyOptions = {},
  ) {
    super(`currency:${nodeId}`, opts.name ?? `Currency:${nodeId}`, nodeId, 'currency', worldDay)
    this.domain = {
      currencies,
      rates,
      lastTickResults: [],
      weeksTicked: 0,
    }
    this.getD20 = opts.getD20 ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). All drift logic runs in resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const weeks = Math.floor(daysResolved / 7)
    if (weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a week — no drift.`,
        additionalEvents: [],
      }
    }

    const currencyById = new Map(this.domain.currencies.map(c => [c.id, c]))
    let lastResults: ExchangeTickResult[] = []

    for (let w = 0; w < weeks; w++) {
      const weekResults: ExchangeTickResult[] = []
      for (let i = 0; i < this.domain.rates.length; i++) {
        const rate = this.domain.rates[i]
        const from = currencyById.get(rate.fromCurrencyId)
        const to = currencyById.get(rate.toCurrencyId)
        if (!from || !to) continue
        const d20 = this.getD20(worldDay + w * 7, i)
        weekResults.push(weeklyExchangeTick(rate, from, to, d20, worldDay + w * 7))
      }
      lastResults = weekResults
    }

    this.domain.lastTickResults = lastResults
    this.domain.weeksTicked += weeks

    // Write κ.economy.exchangeRates — flat lookup map for downstream
    // converters (banks, money changers, caravan price calc).
    if (tp && this.domain.rates.length > 0) {
      const exchangeRates: Record<string, number> = {}
      for (const r of this.domain.rates) {
        exchangeRates[`${r.fromCurrencyId}->${r.toCurrencyId}`] = r.rate
      }
      tp.writeDomain(this.state.nodeId, 'economy', { exchangeRates })
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} weeks): ` +
      `${this.domain.rates.length} rates re-priced across ${this.domain.currencies.length} currencies.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        ratesPriced: this.domain.rates.length,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMCurrencyDomainState {
    return {
      currencies: this.domain.currencies.map(c => ({ ...c })),
      rates: this.domain.rates.map(r => ({ ...r })),
      lastTickResults: this.domain.lastTickResults.map(r => ({ ...r })),
      weeksTicked: this.domain.weeksTicked,
    }
  }

  /** Look up a currency by id. */
  getCurrency(id: string): CurrencySystem | undefined {
    return this.domain.currencies.find(c => c.id === id)
  }

  /** Look up an exchange rate between two currencies (one direction). */
  getRate(fromCurrencyId: string, toCurrencyId: string): ExchangeRate | undefined {
    return this.domain.rates.find(
      r => r.fromCurrencyId === fromCurrencyId && r.toCurrencyId === toCurrencyId,
    )
  }
}
