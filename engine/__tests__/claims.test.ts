/**
 * CLAIMS TESTS — register, contest, lapse, forfeit, inherit.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ClaimRegistry,
  createClaim,
  resetClaimIdCounter,
  ClaimSchema,
} from '../claims'

beforeEach(() => resetClaimIdCounter())

describe('Claim schema parses with defaults', () => {
  it('minimal valid input promotes to a full Claim', () => {
    const c = ClaimSchema.parse({
      id: 'c_1',
      claimantId: 'kaelith',
      targetType: 'farm_plot',
      targetId: 'plot_1',
      nodeId: 'thundertree',
      claimedDay: 0,
    })
    expect(c.status).toBe('pending')
    expect(c.yieldShare).toBe(1)
    expect(c.taxRate).toBe(0)
    expect(c.legitimacy).toBe('self')
  })
})

describe('createClaim helper', () => {
  it('mints sequential ids', () => {
    const a = createClaim({ claimantId: 'a', targetType: 'farm_plot', targetId: 'p1', nodeId: 'n', claimedDay: 1 })
    const b = createClaim({ claimantId: 'b', targetType: 'farm_plot', targetId: 'p2', nodeId: 'n', claimedDay: 1 })
    expect(a.id).toBe('claim_1')
    expect(b.id).toBe('claim_2')
  })
})

describe('ClaimRegistry — register and lookup', () => {
  it('an unclaimed target lets the new claim go straight to active', () => {
    const reg = new ClaimRegistry()
    const c = createClaim({
      claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1',
      nodeId: 'thundertree', claimedDay: 1,
    })
    const { claim, contestedExisting } = reg.register(c)
    expect(claim.status).toBe('active')
    expect(contestedExisting).toEqual([])
    expect(reg.getActiveOwner('farm_plot', 'p1')).toBe('kaelith')
  })

  it('filing on an already-active target flips both to contested', () => {
    const reg = new ClaimRegistry()
    reg.register(createClaim({
      claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1',
      nodeId: 'thundertree', claimedDay: 1,
    }))
    const second = reg.register(createClaim({
      claimantId: 'rivanon', targetType: 'farm_plot', targetId: 'p1',
      nodeId: 'thundertree', claimedDay: 5,
    }))
    expect(second.claim.status).toBe('contested')
    expect(second.contestedExisting.length).toBe(1)
    expect(second.contestedExisting[0].claimantId).toBe('kaelith')
    expect(second.contestedExisting[0].status).toBe('contested')
    // Nobody owns it actively while contested
    expect(reg.getActiveOwner('farm_plot', 'p1')).toBeUndefined()
  })

  it('findByClaimant returns all claims a character holds', () => {
    const reg = new ClaimRegistry()
    reg.register(createClaim({ claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1', nodeId: 'n', claimedDay: 1 }))
    reg.register(createClaim({ claimantId: 'kaelith', targetType: 'deposit', targetId: 'd1', nodeId: 'n', claimedDay: 1 }))
    reg.register(createClaim({ claimantId: 'rivanon', targetType: 'building', targetId: 'b1', nodeId: 'n', claimedDay: 1 }))
    expect(reg.findByClaimant('kaelith').length).toBe(2)
    expect(reg.findByClaimant('rivanon').length).toBe(1)
  })

  it('findAtNode aggregates across target types at one node', () => {
    const reg = new ClaimRegistry()
    reg.register(createClaim({ claimantId: 'a', targetType: 'farm_plot', targetId: 'p1', nodeId: 'thundertree', claimedDay: 1 }))
    reg.register(createClaim({ claimantId: 'b', targetType: 'deposit', targetId: 'd1', nodeId: 'thundertree', claimedDay: 1 }))
    reg.register(createClaim({ claimantId: 'c', targetType: 'farm_plot', targetId: 'p2', nodeId: 'phandalin', claimedDay: 1 }))
    expect(reg.findAtNode('thundertree').length).toBe(2)
    expect(reg.findAtNode('phandalin').length).toBe(1)
  })

  it('unregister removes from all indexes', () => {
    const reg = new ClaimRegistry()
    const { claim } = reg.register(createClaim({
      claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1', nodeId: 'n', claimedDay: 1,
    }))
    expect(reg.size()).toBe(1)
    reg.unregister(claim.id)
    expect(reg.size()).toBe(0)
    expect(reg.findOnTarget('farm_plot', 'p1')).toEqual([])
    expect(reg.findByClaimant('kaelith')).toEqual([])
    expect(reg.findAtNode('n')).toEqual([])
  })
})

describe('ClaimRegistry — lifecycle', () => {
  it('tend updates lastTendedDay and rescues a lapsed claim', () => {
    const reg = new ClaimRegistry()
    const { claim } = reg.register(createClaim({
      claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1',
      nodeId: 'n', claimedDay: 1, lapseAfterDays: 30,
    }))
    // Sweep at day 100 → claim lapses
    const lapsed = reg.sweepLapses(100)
    expect(lapsed).toContain(claim.id)
    expect(reg.getClaim(claim.id)!.status).toBe('lapsed')
    // Tend brings it back
    expect(reg.tend(claim.id, 105)).toBe(true)
    expect(reg.getClaim(claim.id)!.status).toBe('active')
    expect(reg.getClaim(claim.id)!.lastTendedDay).toBe(105)
  })

  it('forfeit marks status without removing from registry', () => {
    const reg = new ClaimRegistry()
    const { claim } = reg.register(createClaim({
      claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1', nodeId: 'n', claimedDay: 1,
    }))
    expect(reg.forfeit(claim.id)).toBe(true)
    expect(reg.getClaim(claim.id)!.status).toBe('forfeit')
    // Still findable for audit
    expect(reg.findOnTarget('farm_plot', 'p1').length).toBe(1)
    // But no active owner
    expect(reg.getActiveOwner('farm_plot', 'p1')).toBeUndefined()
  })

  it('claims without lapseAfterDays never auto-lapse', () => {
    const reg = new ClaimRegistry()
    const { claim } = reg.register(createClaim({
      claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1',
      nodeId: 'n', claimedDay: 1, legitimacy: 'crown',
      // no lapseAfterDays
    }))
    reg.sweepLapses(10000)
    expect(reg.getClaim(claim.id)!.status).toBe('active')
  })

  it('resolveContest awards winner, forfeits losers', () => {
    const reg = new ClaimRegistry()
    const { claim: a } = reg.register(createClaim({
      claimantId: 'kaelith', targetType: 'farm_plot', targetId: 'p1', nodeId: 'n', claimedDay: 1,
    }))
    const { claim: b } = reg.register(createClaim({
      claimantId: 'rivanon', targetType: 'farm_plot', targetId: 'p1', nodeId: 'n', claimedDay: 5,
    }))
    expect(a.status).toBe('contested')
    expect(b.status).toBe('contested')
    const losers = reg.resolveContest(a.id)
    expect(reg.getClaim(a.id)!.status).toBe('active')
    expect(reg.getClaim(b.id)!.status).toBe('forfeit')
    expect(losers).toEqual([b.id])
    expect(reg.getActiveOwner('farm_plot', 'p1')).toBe('kaelith')
  })

  it('serialize / fromSerialized round-trips', () => {
    const reg = new ClaimRegistry()
    reg.register(createClaim({ claimantId: 'a', targetType: 'farm_plot', targetId: 'p1', nodeId: 'n1', claimedDay: 1 }))
    reg.register(createClaim({ claimantId: 'b', targetType: 'deposit', targetId: 'd1', nodeId: 'n2', claimedDay: 2 }))
    const data = reg.serialize()
    expect(data.length).toBe(2)
    const restored = ClaimRegistry.fromSerialized(data)
    expect(restored.size()).toBe(2)
    expect(restored.getActiveOwner('farm_plot', 'p1')).toBe('a')
    expect(restored.getActiveOwner('deposit', 'd1')).toBe('b')
  })
})
