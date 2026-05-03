/**
 * MM_SERVICES — Layer 6 ISimulatedMM adapter for services.ts
 * ==============================================================
 *
 * One MMServices per settlement. Lives at the settlement node. Weekly
 * cadence. Each resolve folds N weeks of `weeklyServicesTick` over the
 * settlement's providers, contracts, and risk contracts.
 *
 * Tracks:
 *   - Active service contracts (slot consumption per week)
 *   - Risk contracts (insurance — expire when their term runs out)
 *   - Provider revenue accumulation
 *
 * No κ writes — provider/contract state is the MM's own ledger. Surfaces
 * read via `serialize().domain`.
 *
 * Cadence: weekly. Layer: 6 (HUB SERVICES).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  weeklyServicesTick,
  type ServiceProvider,
  type ServiceContract,
  type RiskContract,
  type ServicesTickResult,
} from './services'
import type { TP } from './tp'

export interface MMServicesDomainState {
  hubId: string
  providers: ServiceProvider[]
  contracts: ServiceContract[]
  riskContracts: RiskContract[]
  cumulative: {
    weeksTicked: number
    contractsCompleted: number
    contractsProgressed: number
    riskContractsExpired: number
    totalProviderRevenue: number
  }
  lastTickResult: ServicesTickResult | null
}

export interface MMServicesOptions {
  providers?: ServiceProvider[]
  contracts?: ServiceContract[]
  riskContracts?: RiskContract[]
  name?: string
}

export class MMServices extends SimulatedMMBase {
  domain: MMServicesDomainState

  constructor(hubId: string, worldDay: number = 0, opts: MMServicesOptions = {}) {
    const id = `services:${hubId}`
    const name = opts.name ?? `Services@${hubId}`
    super(id, name, hubId, 'services', worldDay)

    this.domain = {
      hubId,
      providers: opts.providers ?? [],
      contracts: opts.contracts ?? [],
      riskContracts: opts.riskContracts ?? [],
      cumulative: {
        weeksTicked: 0,
        contractsCompleted: 0,
        contractsProgressed: 0,
        riskContractsExpired: 0,
        totalProviderRevenue: 0,
      },
      lastTickResult: null,
    }
  }

  // ── Public mutators (used by surfaces / orchestrators) ──

  addProvider(p: ServiceProvider): void { this.domain.providers.push(p) }
  addContract(c: ServiceContract): void { this.domain.contracts.push(c) }
  addRiskContract(rc: RiskContract): void { this.domain.riskContracts.push(rc) }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Service work runs in resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, _tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const weeks = Math.floor(daysResolved / 7)
    if (weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a week — no service tick.`,
        additionalEvents: [],
      }
    }

    let totalCompleted = 0
    let totalProgressed = 0
    let totalRiskExpired = 0
    let totalRevenue = 0
    let lastResult: ServicesTickResult | null = null

    for (let w = 0; w < weeks; w++) {
      const weekDay = worldDay - daysResolved + (w + 1) * 7
      const result = weeklyServicesTick(
        weekDay,
        this.domain.contracts,
        this.domain.riskContracts,
        this.domain.providers,
      )
      totalCompleted += result.completedContracts.length
      totalProgressed += result.progressedContracts.length
      totalRiskExpired += result.expiredRiskContracts.length
      for (const r of result.providerRevenue) totalRevenue += r.revenue
      lastResult = result
    }

    this.domain.cumulative.weeksTicked += weeks
    this.domain.cumulative.contractsCompleted += totalCompleted
    this.domain.cumulative.contractsProgressed += totalProgressed
    this.domain.cumulative.riskContractsExpired += totalRiskExpired
    this.domain.cumulative.totalProviderRevenue += totalRevenue
    this.domain.lastTickResult = lastResult

    const activeProviders = this.domain.providers.filter(p => p.status === 'active').length
    const activeContracts = this.domain.contracts.filter(c => c.status === 'active').length

    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} wks): ` +
      `${activeProviders} active providers, ${activeContracts} active contracts. ` +
      `${totalCompleted} completed, ${totalProgressed} progressed, ${totalRiskExpired} risk contracts expired. ` +
      `Revenue this resolve: ${totalRevenue}gp.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        contractsCompleted: totalCompleted,
        contractsProgressed: totalProgressed,
        riskContractsExpired: totalRiskExpired,
        providerRevenue: totalRevenue,
        activeProviders,
        activeContracts,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMServicesDomainState {
    return {
      hubId: this.domain.hubId,
      providers: this.domain.providers.map(p => ({ ...p })),
      contracts: this.domain.contracts.map(c => ({ ...c })),
      riskContracts: this.domain.riskContracts.map(r => ({ ...r })),
      cumulative: { ...this.domain.cumulative },
      lastTickResult: this.domain.lastTickResult ? {
        ...this.domain.lastTickResult,
        completedContracts: [...this.domain.lastTickResult.completedContracts],
        progressedContracts: [...this.domain.lastTickResult.progressedContracts],
        expiredRiskContracts: [...this.domain.lastTickResult.expiredRiskContracts],
        providerRevenue: this.domain.lastTickResult.providerRevenue.map(r => ({ ...r })),
      } : null,
    }
  }

  // ── Convenience ──

  getProviders(): ServiceProvider[] { return this.domain.providers }
  getContracts(): ServiceContract[] { return this.domain.contracts }
  getRiskContracts(): RiskContract[] { return this.domain.riskContracts }
}
