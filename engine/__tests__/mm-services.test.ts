import { describe, it, expect } from 'vitest'
import { MMServices } from '../mm-services'
import {
  createProvider,
  createServiceContract,
  acceptServiceContract,
  type ServiceContract,
} from '../services'

function freshContract(providerId: string, worldDay = 0): ServiceContract {
  const c = createServiceContract(providerId, 'pc1', 'character', 'artisan_craft', worldDay, 'routine', 12)
  acceptServiceContract(c)
  return c
}

describe('MMServices — construction', () => {
  it('uses services:<hubId> as stable id', () => {
    const mm = new MMServices('thundertree', 0)
    expect(mm.state.id).toBe('services:thundertree')
    expect(mm.state.mmType).toBe('services')
    expect(mm.state.nodeId).toBe('thundertree')
  })

  it('starts with empty state when no options provided', () => {
    const mm = new MMServices('thundertree', 0)
    expect(mm.getProviders()).toHaveLength(0)
    expect(mm.getContracts()).toHaveLength(0)
    expect(mm.getRiskContracts()).toHaveLength(0)
  })
})

describe('MMServices — weekly fold', () => {
  it('progresses active contracts each week', () => {
    const provider = createProvider('thundertree', 'artisan')
    const contract = freshContract(provider.id, 0)   // estimatedSlots = 4

    const mm = new MMServices('thundertree', 0, {
      providers: [provider],
      contracts: [contract],
    })

    // 1 week → 1 slot consumed
    mm.accumulatePotential(7, 7)
    let result = mm.resolve(7, undefined)
    expect(result.stateChanges.weeksTicked).toBe(1)
    expect(contract.slotsConsumed).toBe(1)

    // 4 more weeks → contract completes
    mm.accumulatePotential(28, 35)
    result = mm.resolve(35, undefined)
    expect(contract.status).toBe('completed')
    expect(result.stateChanges.contractsCompleted).toBeGreaterThanOrEqual(1)
  })

  it('credits provider with revenue on contract completion', () => {
    const provider = createProvider('thundertree', 'artisan')
    const initialCapital = provider.capitalGp
    const contract = freshContract(provider.id, 0)

    const mm = new MMServices('thundertree', 0, {
      providers: [provider],
      contracts: [contract],
    })

    mm.accumulatePotential(28, 28)
    mm.resolve(28, undefined)
    expect(provider.capitalGp).toBeGreaterThan(initialCapital)
  })

  it('cumulative state tracks across multiple resolves', () => {
    const provider = createProvider('thundertree', 'artisan')
    const c1 = freshContract(provider.id, 0)
    const c2 = freshContract(provider.id, 0)

    const mm = new MMServices('thundertree', 0, {
      providers: [provider],
      contracts: [c1, c2],
    })

    mm.accumulatePotential(70, 70)
    mm.resolve(70, undefined)
    const dom = mm.serialize().domain as ReturnType<MMServices['getDomainState']>
    expect(dom.cumulative.weeksTicked).toBe(10)
    expect(dom.cumulative.contractsCompleted).toBe(2)
  })

  it('zero days resolves to no-op', () => {
    const mm = new MMServices('thundertree', 0)
    const result = mm.resolve(0, undefined)
    expect(result.stateChanges.weeksTicked).toBe(0)
  })
})

describe('MMServices — public mutators', () => {
  it('addProvider / addContract / addRiskContract update lists', () => {
    const mm = new MMServices('thundertree', 0)
    const provider = createProvider('thundertree', 'artisan')
    const contract = freshContract(provider.id, 0)
    mm.addProvider(provider)
    mm.addContract(contract)
    expect(mm.getProviders()).toHaveLength(1)
    expect(mm.getContracts()).toHaveLength(1)
  })
})
