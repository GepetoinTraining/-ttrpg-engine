/**
 * MM_BANKING TESTS — wraps weeklyBankingTick + bullion shipment hook.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MMBanking, bankEntityId, resetShipmentIdCounter } from '../mm-banking.js'
import { Clockwork } from '../clockwork.js'
import { TP, type WorldNode } from '../tp.js'
import {
  createVault,
  createAccount,
  resetLedgerSeq,
} from '../banking.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region', name: 'Sword Coast', parentId: null, dataStatic: {} },
    { id: 'baldurs_gate', type: 'settlement', name: "Baldur's Gate", parentId: 'sword_coast', dataStatic: {} },
    { id: 'waterdeep', type: 'settlement', name: 'Waterdeep', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

beforeEach(() => {
  resetLedgerSeq()
  resetShipmentIdCounter()
})

describe('MMBanking — adapter for weeklyBankingTick', () => {
  it('constructs with stable id derived from vault providerId', () => {
    const vault = createVault('bank_baldurs', 50_000)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'currency_baldurs', [], [], 0)
    expect(mm.state.id).toBe(bankEntityId(vault))
    expect(mm.state.id).toBe('bank:bank_baldurs')
    expect(mm.state.nodeId).toBe('baldurs_gate')
    expect(mm.state.mmType).toBe('banking')
    expect(mm.getFactionOwner()).toBe('banking_family')
    expect(mm.getCurrencyId()).toBe('currency_baldurs')
  })

  it('registerWith puts the bank in the entity registry', () => {
    const tp = makeTP()
    const vault = createVault('bank_baldurs', 50_000)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'currency_baldurs', [], [], 0)
    mm.registerWith(tp)
    const at = tp.getEntitiesAt('baldurs_gate')
    const bank = at.find(e => e.type === 'bank')
    expect(bank).toBeDefined()
    expect(bank?.id).toBe('bank:bank_baldurs')
  })

  it('weekly tick accrues interest on a savings account', () => {
    const vault = createVault('bank_baldurs', 50_000)
    const account = createAccount('bank_baldurs', 'kaelith', 'character', 'savings', 1000, 0)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr', [account], [], 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    // Savings @ 5%/yr → ~5/52 = 0.0962 gp per week on 1000 balance
    expect(account.balanceGP).toBeGreaterThan(1000)
    expect(account.balanceGP).toBeCloseTo(1000 + 1000 * 0.05 / 52, 2)
  })

  it('multi-week fold compounds across weeks', () => {
    const vault = createVault('bank_baldurs', 50_000)
    const account = createAccount('bank_baldurs', 'kaelith', 'character', 'savings', 1000, 0)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr', [account], [], 0)
    mm.accumulatePotential(28, 28)  // 4 weeks
    mm.resolve(28)
    expect(account.balanceGP).toBeGreaterThan(1000 + 1000 * 0.05 / 52 * 4)
    const dom = mm.serialize().domain as ReturnType<MMBanking['getDomainState']>
    expect(dom.cumulative.weeksTicked).toBe(4)
  })

  it('custody account pays fee, not interest', () => {
    const vault = createVault('bank_baldurs', 50_000)
    const account = createAccount('bank_baldurs', 'rivanon', 'character', 'custody', 1000, 0)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr', [account], [], 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    // Custody @ 1% fee/yr
    expect(account.balanceGP).toBeLessThan(1000)
  })

  it('vault.totalDepositsGP recomputed from current account balances', () => {
    const vault = createVault('bank_baldurs', 50_000)
    const account1 = createAccount('bank_baldurs', 'kaelith', 'character', 'savings', 1000, 0)
    const account2 = createAccount('bank_baldurs', 'rivanon', 'character', 'savings', 500, 0)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr', [account1, account2], [], 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7)
    expect(vault.totalDepositsGP).toBeCloseTo(account1.balanceGP + account2.balanceGP, 2)
  })

  it('integrates with Clockwork — registers weekly, observes', () => {
    const tp = makeTP()
    const clockwork = new Clockwork(tp, 0)
    const vault = createVault('bank_baldurs', 50_000)
    const account = createAccount('bank_baldurs', 'kaelith', 'character', 'savings', 1000, 0)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr', [account], [], 0)
    mm.registerWith(tp)
    clockwork.register(mm, 2, 'weekly')
    clockwork.crankTo(28)

    const obs = clockwork.observeNode('baldurs_gate')
    expect(obs.resolved.length).toBe(1)
    expect(obs.resolved[0].mmId).toBe('bank:bank_baldurs')
    expect(account.balanceGP).toBeGreaterThan(1000)
  })
})

describe('MMBanking — bullion shipment (caravan hook)', () => {
  it('shipBullion deducts from vault and stages a shipment', () => {
    const vault = createVault('bank_baldurs', 10_000)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr_baldurs', [], [], 0)
    const shipment = mm.shipBullion('bank:bank_waterdeep', 2000, 5)
    expect(shipment).not.toBeNull()
    expect(shipment!.status).toBe('staged')
    expect(shipment!.amount).toBe(2000)
    expect(shipment!.currencyId).toBe('curr_baldurs')
    expect(shipment!.fromBankId).toBe('bank:bank_baldurs')
    expect(shipment!.toBankId).toBe('bank:bank_waterdeep')
    expect(shipment!.stagedDay).toBe(5)
    expect(vault.vaultGP).toBe(8000)
  })

  it('shipBullion fails on insufficient vault', () => {
    const vault = createVault('bank_baldurs', 100)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr', [], [], 0)
    const shipment = mm.shipBullion('bank:elsewhere', 5000, 5)
    expect(shipment).toBeNull()
    expect(vault.vaultGP).toBe(100)  // unchanged
  })

  it('caravan picks up: status → in_transit, edge + caravan recorded', () => {
    const vault = createVault('bank_baldurs', 10_000)
    const mm = new MMBanking('baldurs_gate', vault, 'banking_family', 'curr', [], [], 0)
    const ship = mm.shipBullion('bank:elsewhere', 2000, 5)!
    const ok = mm.markShipmentInTransit(ship.id, 'edge:trade_road_42', 'caravan:cara_7')
    expect(ok).toBe(true)
    const updated = mm.getPendingShipments().find(s => s.id === ship.id)!
    expect(updated.status).toBe('in_transit')
    expect(updated.edgeId).toBe('edge:trade_road_42')
    expect(updated.caravanId).toBe('caravan:cara_7')
  })

  it('destination receiveBullion adds to vault, returns delivered shipment', () => {
    const dstVault = createVault('bank_waterdeep', 5_000)
    const dstMM = new MMBanking('waterdeep', dstVault, 'banking_family', 'curr_wd', [], [], 0)
    const result = dstMM.receiveBullion('bullion_42', 'bank:bank_baldurs', 1900, 12)
    expect(result.newVaultGP).toBe(6900)
    expect(result.shipment.status).toBe('delivered')
    expect(result.shipment.deliveredDay).toBe(12)
  })

  it('source bank can mark shipment delivered or lost', () => {
    const vault = createVault('bank_a', 10_000)
    const mm = new MMBanking('node_a', vault, 'fac', 'c', [], [], 0)
    const s1 = mm.shipBullion('bank_b', 1000, 5)!
    const s2 = mm.shipBullion('bank_c', 500, 5)!

    expect(mm.markShipmentDelivered(s1.id, 20)).toBe(true)
    expect(mm.markShipmentLost(s2.id, 'bandits at edge_42')).toBe(true)

    const dom = mm.serialize().domain as ReturnType<MMBanking['getDomainState']>
    const ship1 = dom.pendingShipments.find(s => s.id === s1.id)!
    const ship2 = dom.pendingShipments.find(s => s.id === s2.id)!
    expect(ship1.status).toBe('delivered')
    expect(ship1.deliveredDay).toBe(20)
    expect(ship2.status).toBe('lost')
    expect(ship2.lossReason).toMatch(/bandits/)
  })

  it('getPendingShipments excludes delivered + lost', () => {
    const vault = createVault('bank_a', 10_000)
    const mm = new MMBanking('node_a', vault, 'fac', 'c', [], [], 0)
    const s1 = mm.shipBullion('bank_b', 1000, 5)!
    mm.shipBullion('bank_c', 500, 5)
    const s3 = mm.shipBullion('bank_d', 800, 5)!

    mm.markShipmentDelivered(s1.id, 20)
    mm.markShipmentLost(s3.id, 'shipwreck')

    const pending = mm.getPendingShipments()
    expect(pending.length).toBe(1)  // only s2 still staged
  })

  it('faction-owned banks track currency separately — multi-kingdom network', () => {
    // The "global Banking Family" with branches in different kingdoms,
    // each branch denominating in local currency. Shipping bullion
    // between branches preserves the family's network total.
    const vaultA = createVault('bank_baldurs', 10_000)
    const vaultB = createVault('bank_calimport', 5_000)
    const branchA = new MMBanking('baldurs_gate', vaultA, 'house_thann', 'curr_baldurs', [], [], 0)
    const branchB = new MMBanking('calimport', vaultB, 'house_thann', 'curr_calim', [], [], 0)

    expect(branchA.getFactionOwner()).toBe('house_thann')
    expect(branchB.getFactionOwner()).toBe('house_thann')
    expect(branchA.getCurrencyId()).toBe('curr_baldurs')
    expect(branchB.getCurrencyId()).toBe('curr_calim')

    // Branch A ships 1000 Baldurian gp to Branch B
    const ship = branchA.shipBullion(branchB.state.id, 1000, 5)!
    expect(ship.currencyId).toBe('curr_baldurs')  // source currency

    // Conversion happens at receive (caller computes via MMCurrency.getRate)
    // For test: 1 baldurian gp = 0.85 calim gp
    const convertedAmount = 1000 * 0.85
    branchB.receiveBullion(ship.id, branchA.state.id, convertedAmount, 12)
    branchA.markShipmentDelivered(ship.id, 12)

    expect(vaultA.vaultGP).toBe(9000)   // 10k - 1k shipped
    expect(vaultB.vaultGP).toBe(5850)   // 5k + 850 received
  })
})
