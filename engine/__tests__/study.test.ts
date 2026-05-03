/**
 * STUDY tests — slot system, tier-day completion, tool gate, queue replay.
 */

import { describe, it, expect } from 'vitest'
import {
  STUDY_DAYS_BY_TIER,
  maxStudySlots,
  canHarvest,
  makeStudyEntry,
  computeStudyQueue,
  nextFreeSlot,
  canStartStudy,
  resolveChopTree,
  type StartStudyValue,
  type CompleteStudyValue,
} from '../study'

describe('maxStudySlots', () => {
  it('returns int modifier, capped at [1, 8]', () => {
    expect(maxStudySlots(-2)).toBe(1)
    expect(maxStudySlots(0)).toBe(1)
    expect(maxStudySlots(1)).toBe(1)
    expect(maxStudySlots(3)).toBe(3)
    expect(maxStudySlots(5)).toBe(5)
    expect(maxStudySlots(10)).toBe(8)
  })
})

describe('canHarvest — tool tier gate', () => {
  it('allows tool ≥ material', () => {
    expect(canHarvest('A', 'C')).toBe(true)
    expect(canHarvest('C', 'C')).toBe(true)
    expect(canHarvest('EX', 'F')).toBe(true)
  })
  it('blocks tool < material', () => {
    expect(canHarvest('F', 'A')).toBe(false)
    expect(canHarvest('C', 'B')).toBe(false)
    expect(canHarvest('SS', 'SSS')).toBe(false)
  })
})

describe('STUDY_DAYS_BY_TIER', () => {
  it('is monotonically increasing F → EX', () => {
    const tiers: (keyof typeof STUDY_DAYS_BY_TIER)[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX']
    for (let i = 1; i < tiers.length; i++) {
      expect(STUDY_DAYS_BY_TIER[tiers[i]]).toBeGreaterThan(STUDY_DAYS_BY_TIER[tiers[i - 1]])
    }
  })
  it('F is 1 day, EX is 360 days', () => {
    expect(STUDY_DAYS_BY_TIER.F).toBe(1)
    expect(STUDY_DAYS_BY_TIER.EX).toBe(360)
  })
})

describe('makeStudyEntry', () => {
  it('computes completionDay = startDay + tier days', () => {
    const start: StartStudyValue = {
      studyId: 's1',
      characterId: 'kael',
      resourceId: 'oak',
      hubId: 'suzail',
      resourceTier: 'D',
      startDay: 100,
      slotIndex: 0,
    }
    const entry = makeStudyEntry(start)
    expect(entry.completionDay).toBe(100 + STUDY_DAYS_BY_TIER.D)
  })
})

describe('computeStudyQueue — TPB replay', () => {
  const charId = 'kael'
  it('puts active studies in `active` list', () => {
    const start: StartStudyValue = {
      studyId: 's1',
      characterId: charId,
      resourceId: 'oak',
      hubId: 'suzail',
      resourceTier: 'D',
      startDay: 100,
      slotIndex: 0,
    }
    const q = computeStudyQueue([start], [], charId, 105) // currentDay 105 < completionDay (107)
    expect(q.active).toHaveLength(1)
    expect(q.pendingClaim).toHaveLength(0)
    expect(q.completed).toHaveLength(0)
  })

  it('moves studies to `pendingClaim` when completionDay reached', () => {
    const start: StartStudyValue = {
      studyId: 's1',
      characterId: charId,
      resourceId: 'oak',
      hubId: 'suzail',
      resourceTier: 'F',
      startDay: 100,
      slotIndex: 0,
    }
    const q = computeStudyQueue([start], [], charId, 102) // F = 1d, completionDay = 101 < 102
    expect(q.active).toHaveLength(0)
    expect(q.pendingClaim).toHaveLength(1)
    expect(q.completed).toHaveLength(0)
  })

  it('moves studies to `completed` when complete_study action present', () => {
    const start: StartStudyValue = {
      studyId: 's1',
      characterId: charId,
      resourceId: 'oak',
      hubId: 'suzail',
      resourceTier: 'F',
      startDay: 100,
      slotIndex: 0,
    }
    const complete: CompleteStudyValue = { studyId: 's1', characterId: charId, worldDay: 102 }
    const q = computeStudyQueue([start], [complete], charId, 105)
    expect(q.active).toHaveLength(0)
    expect(q.pendingClaim).toHaveLength(0)
    expect(q.completed).toHaveLength(1)
  })

  it('only returns studies for the requested character', () => {
    const a: StartStudyValue = {
      studyId: 's1', characterId: 'kael', resourceId: 'r', hubId: 'h',
      resourceTier: 'F', startDay: 100, slotIndex: 0,
    }
    const b: StartStudyValue = {
      studyId: 's2', characterId: 'mira', resourceId: 'r', hubId: 'h',
      resourceTier: 'F', startDay: 100, slotIndex: 0,
    }
    const q = computeStudyQueue([a, b], [], 'kael', 102)
    expect(q.pendingClaim.map((e) => e.studyId)).toEqual(['s1'])
  })
})

describe('nextFreeSlot + canStartStudy', () => {
  const mkActive = (slots: number[]) =>
    slots.map((slotIndex, i) => ({
      studyId: `s${i}`,
      characterId: 'kael',
      resourceId: 'r',
      hubId: 'h',
      resourceTier: 'F' as const,
      startDay: 100,
      completionDay: 110,
      slotIndex,
    }))

  it('finds first unused slot', () => {
    expect(nextFreeSlot(mkActive([0, 2]), 4)).toBe(1)
    expect(nextFreeSlot(mkActive([0, 1, 2]), 4)).toBe(3)
  })
  it('returns null when all slots used', () => {
    expect(nextFreeSlot(mkActive([0, 1, 2]), 3)).toBeNull()
  })
  it('canStartStudy ok when slots available', () => {
    const result = canStartStudy('kael', mkActive([0]), 3) // 3 slots, 1 used
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.slotIndex).toBe(1)
  })
  it('canStartStudy fails when all slots used', () => {
    const result = canStartStudy('kael', mkActive([0, 1]), 2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no_free_slots')
  })
})

describe('resolveChopTree', () => {
  it('refuses when tool too weak', () => {
    const out = resolveChopTree({
      characterId: 'kael',
      hubId: 'h',
      treeId: 't1',
      treeDomain: 'flora-wood-ironwood',
      treeTier: 'A',
      toolItemId: 'axe_iron',
      toolTier: 'D',
      worldDay: 100,
      d20: 12,
    })
    expect(out.ok).toBe(false)
    expect(out.reason).toBe('tool_too_weak')
    expect(out.logs.quantity).toBe(0)
  })

  it('produces base yield when tool == tree tier', () => {
    const out = resolveChopTree({
      characterId: 'kael',
      hubId: 'h',
      treeId: 't1',
      treeDomain: 'flora-wood-oak',
      treeTier: 'D',
      toolItemId: 'axe_iron',
      toolTier: 'D',
      worldDay: 100,
      d20: 10,
    })
    expect(out.ok).toBe(true)
    expect(out.logs.quantity).toBe(4)
    expect(out.toolMargin).toBe(0)
  })

  it('adds bonus logs when tool exceeds tree tier', () => {
    const out = resolveChopTree({
      characterId: 'kael',
      hubId: 'h',
      treeId: 't1',
      treeDomain: 'flora-wood-oak',
      treeTier: 'D',
      toolItemId: 'axe_mithril',
      toolTier: 'A',
      worldDay: 100,
      d20: 10,
    })
    expect(out.ok).toBe(true)
    expect(out.logs.quantity).toBe(7) // 4 base + 3 (margin D→A)
  })

  it('caps margin bonus at +5', () => {
    const out = resolveChopTree({
      characterId: 'kael',
      hubId: 'h',
      treeId: 't1',
      treeDomain: 'flora-wood-oak',
      treeTier: 'F',
      toolItemId: 'axe_starforged',
      toolTier: 'EX',
      worldDay: 100,
      d20: 10,
    })
    expect(out.ok).toBe(true)
    expect(out.logs.quantity).toBe(9) // 4 base + 5 cap
  })

  it('quality maps from d20 buckets', () => {
    const args = {
      characterId: 'k', hubId: 'h', treeId: 't', treeDomain: 'flora-wood-oak',
      treeTier: 'D' as const, toolItemId: 'axe', toolTier: 'D' as const, worldDay: 100,
    }
    expect(resolveChopTree({ ...args, d20: 1 }).logs.quality).toBe('poor')
    expect(resolveChopTree({ ...args, d20: 8 }).logs.quality).toBe('fair')
    expect(resolveChopTree({ ...args, d20: 15 }).logs.quality).toBe('good')
    expect(resolveChopTree({ ...args, d20: 20 }).logs.quality).toBe('masterwork')
  })

  it('is deterministic given inputs', () => {
    const args = {
      characterId: 'k', hubId: 'h', treeId: 't', treeDomain: 'flora-wood-oak',
      treeTier: 'D' as const, toolItemId: 'axe', toolTier: 'D' as const, worldDay: 100, d20: 17,
    }
    const a = resolveChopTree(args)
    const b = resolveChopTree(args)
    expect(a).toEqual(b)
  })
})
