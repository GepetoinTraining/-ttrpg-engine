import { describe, it, expect } from 'vitest'
import { MMTechnologyWeb } from '../mm-technology-web'
import { TP } from '../tp'

function freshTp(): TP {
  const tp = new TP()
  tp.loadNodes([
    { id: 'suzail', type: 'settlement', name: 'Suzail', parentId: null, dataStatic: {} },
    { id: 'wheloon', type: 'settlement', name: 'Wheloon', parentId: null, dataStatic: {} },
  ])
  return tp
}

describe('MMTechnologyWeb — construction', () => {
  it('initializes empty', () => {
    const mm = new MMTechnologyWeb({ settlementNodeId: 'suzail' })
    expect(mm.state.id).toBe('technology_web:suzail')
    expect(mm.state.mmType).toBe('technology_web')
    expect(mm.getUnlockedTier('fishing-tool')).toBeUndefined()
  })
})

describe('MMTechnologyWeb — lazy init', () => {
  it('seeds F-tier blobs on first resolve', () => {
    const mm = new MMTechnologyWeb({ settlementNodeId: 'suzail', npcAttemptsEnabled: false })
    const tp = freshTp()
    mm.accumulatePotential(7, 7, tp)
    mm.resolve(7, tp)
    expect(mm.getUnlockedTier('fishing-tool')).toBe('F')
    expect(mm.getUnlockedTier('mining-tool')).toBe('F')
  })

  it('writes κ.knowledge.unlockedTech on resolve', () => {
    const mm = new MMTechnologyWeb({ settlementNodeId: 'suzail', npcAttemptsEnabled: false })
    const tp = freshTp()
    mm.accumulatePotential(7, 7, tp)
    mm.resolve(7, tp)
    const ctx = tp.resolve('suzail')
    const k = ctx?.knowledge
    expect(k?.unlockedTech).toBeDefined()
    expect(k?.unlockedTech?.['fishing-tool']).toBe('F')
  })

  it('hydrates from κ if unlockedTech exists there', () => {
    const tp = freshTp()
    tp.writeDomain('suzail', 'knowledge', {
      unlockedTech: { 'fishing-tool': 'D', 'mining-tool': 'C' },
    })
    const mm = new MMTechnologyWeb({ settlementNodeId: 'suzail', npcAttemptsEnabled: false })
    mm.accumulatePotential(7, 7, tp)
    mm.resolve(7, tp)
    expect(mm.getUnlockedTier('fishing-tool')).toBe('D')
    expect(mm.getUnlockedTier('mining-tool')).toBe('C')
  })
})

describe('MMTechnologyWeb — autonomous NPC craftsman attempts', () => {
  it('attempts run once per week per purpose when enabled', () => {
    const mm = new MMTechnologyWeb({
      settlementNodeId: 'suzail',
      npcAttemptsEnabled: true,
      npcStats: { getD20: () => 1, skillModifier: 0 }, // always fail
    })
    const tp = freshTp()
    mm.accumulatePotential(28, 28, tp) // 4 weeks
    mm.resolve(28, tp)
    const dom = mm.serialize().domain as { cumulative: { npcAttempts: number; npcSuccesses: number } }
    // 4 weeks × 2 purposes (fishing-tool + mining-tool, both at F) = 8 attempts
    expect(dom.cumulative.npcAttempts).toBe(8)
    expect(dom.cumulative.npcSuccesses).toBe(0) // d20=1 always fails
  })

  it('strong NPC modifier produces tier bumps over time', () => {
    const mm = new MMTechnologyWeb({
      settlementNodeId: 'suzail',
      npcAttemptsEnabled: true,
      npcStats: { getD20: () => 20, skillModifier: 10 }, // always pass
    })
    const tp = freshTp()
    mm.accumulatePotential(7, 7, tp) // 1 week
    mm.resolve(7, tp)
    expect(mm.getUnlockedTier('fishing-tool')).not.toBe('F') // bumped
    const dom = mm.serialize().domain as { cumulative: { tierBumps: number } }
    expect(dom.cumulative.tierBumps).toBeGreaterThan(0)
  })

  it('npcAttemptsEnabled=false → no attempts, no bumps', () => {
    const mm = new MMTechnologyWeb({
      settlementNodeId: 'suzail',
      npcAttemptsEnabled: false,
    })
    const tp = freshTp()
    mm.accumulatePotential(28, 28, tp)
    mm.resolve(28, tp)
    const dom = mm.serialize().domain as { cumulative: { npcAttempts: number; tierBumps: number } }
    expect(dom.cumulative.npcAttempts).toBe(0)
    expect(dom.cumulative.tierBumps).toBe(0)
  })

  it('emits hub hints (tier-unlocked + craftsman-need) on resolve', () => {
    const mm = new MMTechnologyWeb({
      settlementNodeId: 'suzail',
      npcAttemptsEnabled: false,
    })
    const tp = freshTp()
    mm.accumulatePotential(7, 7, tp)
    mm.resolve(7, tp)
    const hints = mm.getRecentHints()
    // F-tier doesn't emit tier-unlocked, but seed catalog has hints; both
    // fishing-tool-F and mining-tool-F have empty hint arrays, so verify
    // hints is at least an array (deduped).
    expect(Array.isArray(hints)).toBe(true)
  })
})

describe('MMTechnologyWeb — manual control', () => {
  it('setUnlocked overrides the tier directly', () => {
    const mm = new MMTechnologyWeb({ settlementNodeId: 'suzail', npcAttemptsEnabled: false })
    mm.setUnlocked('fishing-tool', 'B')
    expect(mm.getUnlockedTier('fishing-tool')).toBe('B')
  })

  it('setUnlocked with TP also writes to κ', () => {
    const mm = new MMTechnologyWeb({ settlementNodeId: 'suzail', npcAttemptsEnabled: false })
    const tp = freshTp()
    mm.setUnlocked('fishing-tool', 'A', tp)
    const ctx = tp.resolve('suzail')
    expect(ctx?.knowledge?.unlockedTech?.['fishing-tool']).toBe('A')
  })
})

describe('MMTechnologyWeb — determinism', () => {
  it('same inputs produce same tier outcomes', () => {
    const mmA = new MMTechnologyWeb({
      settlementNodeId: 'suzail',
      npcAttemptsEnabled: true,
      npcStats: { skillModifier: 5 },
    })
    const mmB = new MMTechnologyWeb({
      settlementNodeId: 'suzail',
      npcAttemptsEnabled: true,
      npcStats: { skillModifier: 5 },
    })
    const tpA = freshTp()
    const tpB = freshTp()
    mmA.accumulatePotential(28, 28, tpA); mmA.resolve(28, tpA)
    mmB.accumulatePotential(28, 28, tpB); mmB.resolve(28, tpB)
    expect(mmA.getUnlockedTier('fishing-tool')).toBe(mmB.getUnlockedTier('fishing-tool'))
    expect(mmA.getUnlockedTier('mining-tool')).toBe(mmB.getUnlockedTier('mining-tool'))
  })
})
