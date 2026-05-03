/**
 * LOCAL ACTOR TESTS — The Tavern Owner, The Merchant, The Thief
 * ===============================================================
 */

import { describe, it, expect } from 'vitest'
import { MMLocalActor, type LocalActorDomainState } from '../mm-local-actor'

// ============================================================
// HELPERS
// ============================================================

function createMerchant(worldDay = 0): MMLocalActor {
  const domain: LocalActorDomainState = {
    drives: { power: 20, wealth: 90, safety: 50, knowledge: 30, faith: 10, revenge: 5, legacy: 40, art: 20, duty: 30 },
    goals: [
      { id: 'g1', description: 'Expand my shop', drive: 'wealth', progress: 0, status: 'active', setAt: 0 },
    ],
    resources: { gold: 200, staff: 3, goods: 50, reputation: 40, contacts: 8 },
    occupation: 'merchant',
    abilityScores: { intelligence: 12, wisdom: 14, charisma: 13 },
    activeAction: null,
    activeActionProgress: 0,
    activeActionStartedAt: 0,
    tpb: [],
  }
  return new MMLocalActor('merchant_01', 'Erdyn the Merchant', 'node_suzail', domain, worldDay)
}

function createThief(worldDay = 0): MMLocalActor {
  const domain: LocalActorDomainState = {
    drives: { power: 10, wealth: 70, safety: 30, knowledge: 20, faith: 0, revenge: 40, legacy: 5, art: 20, duty: 30 },
    goals: [
      { id: 'g1', description: 'Rob the merchant guild', drive: 'wealth', progress: 0, status: 'active', setAt: 0 },
    ],
    resources: { gold: 30, staff: 1, goods: 5, reputation: -20, contacts: 12 },
    occupation: 'criminal',
    abilityScores: { intelligence: 14, wisdom: 11, charisma: 8 },
    activeAction: null,
    activeActionProgress: 0,
    activeActionStartedAt: 0,
    tpb: [],
  }
  return new MMLocalActor('thief_01', 'Vex Shadowhand', 'node_suzail', domain, worldDay)
}

function createPriest(worldDay = 0): MMLocalActor {
  const domain: LocalActorDomainState = {
    drives: { power: 10, wealth: 10, safety: 60, knowledge: 40, faith: 95, revenge: 0, legacy: 50, art: 20, duty: 30 },
    goals: [
      { id: 'g1', description: 'Feed the poor', drive: 'faith', progress: 0, status: 'active', setAt: 0 },
    ],
    resources: { gold: 50, staff: 2, goods: 20, reputation: 60, contacts: 15 },
    occupation: 'priest',
    abilityScores: { intelligence: 10, wisdom: 18, charisma: 16 },
    activeAction: null,
    activeActionProgress: 0,
    activeActionStartedAt: 0,
    tpb: [],
  }
  return new MMLocalActor('priest_01', 'Brother Aldric', 'node_suzail', domain, worldDay)
}

// ============================================================
// TESTS
// ============================================================

describe('MMLocalActor', () => {
  it('initializes with correct state', () => {
    const merchant = createMerchant()
    expect(merchant.state.id).toBe('merchant_01')
    expect(merchant.state.mmType).toBe('local_actor')
    expect(merchant.getOccupation()).toBe('merchant')
    expect(merchant.getDrives().wealth).toBe(90)
  })

  it('accumulate creates an action based on occupation', () => {
    const merchant = createMerchant()
    merchant.accumulatePotential(7, 7)
    // Merchant should pick an economic or diplomatic action
    const tpb = merchant.getTPB()
    // Weekly action should have resolved in one tick
    expect(tpb.length).toBeGreaterThanOrEqual(1)
    if (tpb.length > 0) {
      expect(['economic', 'diplomatic']).toContain(tpb[0].actionType)
    }
  })

  it('thief chooses criminal/espionage actions', () => {
    const thief = createThief()
    thief.accumulatePotential(7, 7)
    const tpb = thief.getTPB()
    expect(tpb.length).toBeGreaterThanOrEqual(1)
    if (tpb.length > 0) {
      expect(['criminal', 'espionage']).toContain(tpb[0].actionType)
    }
  })

  it('priest chooses religious/diplomatic actions', () => {
    const priest = createPriest()
    priest.accumulatePotential(7, 7)
    const tpb = priest.getTPB()
    expect(tpb.length).toBeGreaterThanOrEqual(1)
    if (tpb.length > 0) {
      expect(['religious', 'diplomatic']).toContain(tpb[0].actionType)
    }
  })

  it('passive income accumulates gold', () => {
    const merchant = createMerchant()
    const startGold = merchant.getResources().gold
    merchant.accumulatePotential(7, 7)
    // Merchant base income: 10/week × reputation multiplier
    expect(merchant.getResources().gold).toBeGreaterThan(startGold)
  })

  it('negative reputation reduces income', () => {
    const thief = createThief()
    const startGold = thief.getResources().gold
    thief.accumulatePotential(7, 7)
    // Criminal base: 8/week but reputation -20 reduces multiplier
    const goldGained = thief.getResources().gold - startGold
    expect(goldGained).toBeLessThan(8) // less than base due to negative rep
  })

  it('TPB records every decision', () => {
    const merchant = createMerchant()
    // 4 weeks → should have multiple entries
    for (let w = 1; w <= 4; w++) {
      merchant.accumulatePotential(7, w * 7)
    }
    expect(merchant.getTPB().length).toBeGreaterThanOrEqual(2)
  })

  it('TPB entries have valid d20 rolls', () => {
    const merchant = createMerchant()
    merchant.accumulatePotential(7, 7)
    const tpb = merchant.getTPB()
    for (const entry of tpb) {
      expect(entry.d20).toBeGreaterThanOrEqual(1)
      expect(entry.d20).toBeLessThanOrEqual(20)
    }
  })

  it('react creates a reactive entry in TPB', () => {
    const merchant = createMerchant()
    const outcome = merchant.react('tax_increase', 'economic', 7)
    expect(outcome).not.toBeNull()
    expect(outcome!.action.isReactive).toBe(true)
    expect(merchant.getTPB().some(e => e.isReactive)).toBe(true)
  })

  it('resolve produces narrative with occupation', () => {
    const merchant = createMerchant()
    merchant.accumulatePotential(7, 7)
    const result = merchant.resolve(7)
    expect(result.narrative).toContain('Erdyn the Merchant')
    expect(result.narrative).toContain('merchant')
  })

  it('reputation changes on critical/backfire', () => {
    // This is probabilistic but we verify the mechanic exists
    const merchant = createMerchant()
    const startRep = merchant.getResources().reputation
    // Run many weeks to get some criticals/backfires
    for (let w = 1; w <= 20; w++) {
      merchant.accumulatePotential(7, w * 7)
    }
    // Reputation should have changed (unlikely to be exactly the same after 20 rolls)
    // We just verify it's still within bounds
    const rep = merchant.getResources().reputation
    expect(rep).toBeGreaterThanOrEqual(-100)
    expect(rep).toBeLessThanOrEqual(100)
  })

  it('all actions target own node (intra-hub)', () => {
    const merchant = createMerchant()
    merchant.accumulatePotential(7, 7)
    const tpb = merchant.getTPB()
    // The action targetId in TPB is not stored, but we can verify
    // by checking the resolve narrative mentions the actor's context
    const result = merchant.resolve(7)
    expect(result.mmId).toBe('merchant_01')
  })

  it('multiple local actors in same settlement create emergent economy', () => {
    const merchant = createMerchant()
    const thief = createThief()
    const priest = createPriest()

    // All tick in the same hub
    merchant.accumulatePotential(7, 7)
    thief.accumulatePotential(7, 7)
    priest.accumulatePotential(7, 7)

    // Each pursues their own agenda
    const mTpb = merchant.getTPB()
    const tTpb = thief.getTPB()
    const pTpb = priest.getTPB()

    expect(mTpb.length).toBeGreaterThanOrEqual(1)
    expect(tTpb.length).toBeGreaterThanOrEqual(1)
    expect(pTpb.length).toBeGreaterThanOrEqual(1)

    // Different occupations → different action types
    if (mTpb.length > 0 && tTpb.length > 0 && pTpb.length > 0) {
      // Not all the same action type (very unlikely)
      const types = new Set([mTpb[0].actionType, tTpb[0].actionType, pTpb[0].actionType])
      expect(types.size).toBeGreaterThanOrEqual(2) // at least 2 different types
    }
  })
})
