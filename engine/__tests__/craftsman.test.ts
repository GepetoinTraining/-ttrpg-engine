/**
 * CRAFTSMAN TESTS
 * =================
 * Career road, apprenticeship, masterwork trial, migration pressure,
 * crafting, guild formation, monthly tick.
 */

import { describe, it, expect } from 'vitest'
import {
  createCraftsman,
  beginApprenticeship,
  advanceApprenticeship,
  completeJourneymanExam,
  attemptMasterwork,
  craftItem,
  evaluateMigration,
  migrateCraftsman,
  evaluateGuildFormation,
  getTradeCapacity,
  monthlyCraftTick,
  getCraftRecipes,
  getMastersAt,
  getApprenticesOf,
  resetCraftsmanSeq,
  SEED_RECIPES,
  CRAFT_RANK_ORDER,
} from '../craftsman.js'

// ============================================================
// CREATION
// ============================================================

describe('Craftsman — Creation', () => {
  it('creates an untrained craftsman', () => {
    resetCraftsmanSeq()
    const c = createCraftsman('npc_1', 'Young Torm', 'smithing', 'node_suzail')
    expect(c.rank).toBe('untrained')
    expect(c.trade).toBe('smithing')
    expect(c.skillLevel).toBe(0)
    expect(c.knownRecipeIds).toHaveLength(0)
    expect(c.nodeId).toBe('node_suzail')
  })
})

// ============================================================
// APPRENTICESHIP
// ============================================================

describe('Craftsman — Apprenticeship', () => {
  it('begins apprenticeship under a master', () => {
    resetCraftsmanSeq()
    const master = createCraftsman('npc_m', 'Durnan the Smith', 'smithing', 'node_waterdeep', {
      rank: 'master', skillLevel: 5,
    })
    const youth = createCraftsman('npc_y', 'Young Pip', 'smithing', 'node_waterdeep')

    const result = beginApprenticeship(youth, master, 100)
    expect(result.success).toBe(true)
    expect(youth.rank).toBe('apprentice')
    expect(youth.masterId).toBe(master.id)
    expect(youth.skillLevel).toBe(1)
    expect(youth.knownRecipeIds.length).toBeGreaterThan(0) // Starter recipes
    expect(master.apprenticeIds).toContain(youth.id)
  })

  it('rejects non-matching trade', () => {
    resetCraftsmanSeq()
    const master = createCraftsman('m', 'Master Baker', 'baking', 'n', { rank: 'master', skillLevel: 5 })
    const youth = createCraftsman('y', 'Youth', 'smithing', 'n')
    expect(beginApprenticeship(youth, master, 100).success).toBe(false)
  })

  it('rejects if master has max apprentices', () => {
    resetCraftsmanSeq()
    const master = createCraftsman('m', 'Master', 'smithing', 'n', {
      rank: 'master', skillLevel: 5,
      apprenticeIds: ['a1', 'a2', 'a3'],
    })
    const youth = createCraftsman('y', 'Youth', 'smithing', 'n')
    expect(beginApprenticeship(youth, master, 100).success).toBe(false)
  })

  it('advances apprenticeship monthly', () => {
    resetCraftsmanSeq()
    const apprentice = createCraftsman('a', 'Apprentice', 'smithing', 'n', {
      rank: 'apprentice', skillLevel: 1,
      apprenticeshipProgress: 0,
    })

    const r1 = advanceApprenticeship(apprentice, 160)
    expect(r1.progressGained).toBeGreaterThan(1)
    expect(r1.newProgress).toBeGreaterThan(0)
    expect(r1.readyForExam).toBe(false)
  })

  it('completes exam after reaching 100% progress', () => {
    resetCraftsmanSeq()
    const apprentice = createCraftsman('a', 'Apprentice', 'smithing', 'n', {
      rank: 'apprentice', skillLevel: 2,
      apprenticeshipProgress: 99.5,
    })

    const advance = advanceApprenticeship(apprentice, 160)
    expect(advance.readyForExam).toBe(true)

    const exam = completeJourneymanExam(apprentice, 500)
    expect(exam.promoted).toBe(true)
    expect(apprentice.rank).toBe('journeyman')
  })
})

// ============================================================
// MASTERWORK TRIAL
// ============================================================

describe('Craftsman — Masterwork Trial', () => {
  it('promotes journeyman on successful masterwork', () => {
    resetCraftsmanSeq()
    const j = createCraftsman('j', 'Journeyman', 'smithing', 'n', {
      rank: 'journeyman', skillLevel: 4, intModifier: 2,
    })

    const result = attemptMasterwork(j, 15, 300) // 15 + 4 + 2 = 21 vs DC 18
    expect(result.success).toBe(true)
    expect(result.promoted).toBe(true)
    expect(j.rank).toBe('master')
  })

  it('fails masterwork on low roll', () => {
    resetCraftsmanSeq()
    const j = createCraftsman('j', 'Journeyman', 'smithing', 'n', {
      rank: 'journeyman', skillLevel: 3, intModifier: 0,
    })

    const result = attemptMasterwork(j, 5, 300) // 5 + 3 + 0 = 8 vs DC 18
    expect(result.success).toBe(false)
    expect(j.rank).toBe('journeyman') // Still journeyman
  })

  it('rejects if skill too low', () => {
    resetCraftsmanSeq()
    const j = createCraftsman('j', 'Weak Journeyman', 'smithing', 'n', {
      rank: 'journeyman', skillLevel: 2,
    })
    const result = attemptMasterwork(j, 20, 300)
    expect(result.success).toBe(false)
    expect(result.reason).toContain('Skill too low')
  })
})

// ============================================================
// CRAFTING
// ============================================================

describe('Craftsman — Crafting', () => {
  it('crafts an iron sword at common quality', () => {
    resetCraftsmanSeq()
    const c = createCraftsman('c', 'Smith', 'smithing', 'n', {
      rank: 'apprentice', skillLevel: 2, intModifier: 1,
      knownRecipeIds: ['rec_iron_sword'],
    })

    const result = craftItem(c, 'rec_iron_sword', 10) // 10 + 2 + 1 = 13 vs DC 10
    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.qualityAchieved).toBe('common')
  })

  it('achieves masterwork quality on high roll', () => {
    resetCraftsmanSeq()
    const c = createCraftsman('c', 'Master Smith', 'smithing', 'n', {
      rank: 'master', skillLevel: 5, intModifier: 3,
      knownRecipeIds: ['rec_iron_sword'],
    })

    const result = craftItem(c, 'rec_iron_sword', 18) // 18 + 5 + 3 = 26 vs DC 10, margin 16
    expect(result!.qualityAchieved).toBe('masterwork')
  })

  it('fails on low roll', () => {
    resetCraftsmanSeq()
    const c = createCraftsman('c', 'Apprentice', 'smithing', 'n', {
      rank: 'apprentice', skillLevel: 1, intModifier: -1,
      knownRecipeIds: ['rec_iron_sword'],
    })

    const result = craftItem(c, 'rec_iron_sword', 3) // 3 + 1 - 1 = 3 vs DC 10
    expect(result!.success).toBe(false)
    expect(result!.qualityAchieved).toBe('failed')
  })

  it('cannot craft unknown recipe', () => {
    resetCraftsmanSeq()
    const c = createCraftsman('c', 'Smith', 'smithing', 'n', {
      rank: 'master', skillLevel: 5, knownRecipeIds: ['rec_iron_sword'],
    })
    expect(craftItem(c, 'rec_healing_potion', 20)).toBeNull() // Unknown
  })
})

// ============================================================
// MIGRATION PRESSURE
// ============================================================

describe('Craftsman — Migration Pressure', () => {
  it('saturated city creates high pressure', () => {
    resetCraftsmanSeq()
    const j = createCraftsman('j', 'Journeyman', 'smithing', 'node_waterdeep', {
      rank: 'journeyman', skillLevel: 3, intModifier: 1,
    })

    const pressure = evaluateMigration(j, 12, 15, [
      { nodeId: 'node_daggerford', name: 'Daggerford', masterCount: 0, maxCapacity: 4, scale: 'town' },
      { nodeId: 'node_triboar', name: 'Triboar', masterCount: 1, maxCapacity: 4, scale: 'town' },
    ])

    expect(pressure.saturation).toBe(12 / 15) // 80%
    expect(pressure.options).toHaveLength(2)
    expect(pressure.options[0].targetNodeId).toBe('node_daggerford') // Untapped = most attractive
    expect(pressure.options[0].attractiveness).toBe(100) // Capped at 100
  })

  it('unsaturated city creates no pressure', () => {
    resetCraftsmanSeq()
    const j = createCraftsman('j', 'Journeyman', 'smithing', 'node_small', {
      rank: 'journeyman', skillLevel: 3,
    })

    const pressure = evaluateMigration(j, 1, 8, [
      { nodeId: 'node_other', name: 'Other', masterCount: 3, maxCapacity: 4, scale: 'town' },
    ])

    expect(pressure.saturation).toBe(1 / 8)
    expect(pressure.shouldMigrate).toBe(false)
  })

  it('untapped settlement is most attractive', () => {
    resetCraftsmanSeq()
    const j = createCraftsman('j', 'J', 'smithing', 'n', { rank: 'journeyman', skillLevel: 3 })

    const pressure = evaluateMigration(j, 10, 10, [
      { nodeId: 'a', name: 'Full Town', masterCount: 4, maxCapacity: 4, scale: 'town' },
      { nodeId: 'b', name: 'Empty Village', masterCount: 0, maxCapacity: 2, scale: 'village' },
      { nodeId: 'c', name: 'Growing Town', masterCount: 1, maxCapacity: 4, scale: 'town' },
    ])

    expect(pressure.options[0].targetNodeId).toBe('b') // Empty = first!
    expect(pressure.shouldMigrate).toBe(true)
  })

  it('migrateCraftsman moves to new node', () => {
    resetCraftsmanSeq()
    const j = createCraftsman('j', 'J', 'smithing', 'node_a', {
      rank: 'journeyman', reputation: 30,
    })

    migrateCraftsman(j, 'node_b', 500)
    expect(j.nodeId).toBe('node_b')
    expect(j.reputation).toBe(20) // Rep drops by 10 in new place
  })
})

// ============================================================
// GUILD FORMATION
// ============================================================

describe('Craftsman — Guild Formation', () => {
  it('forms guild when ≥3 masters of same trade', () => {
    resetCraftsmanSeq()
    const craftsmen = [
      createCraftsman('m1', 'Master 1', 'smithing', 'node_town', { rank: 'master' }),
      createCraftsman('m2', 'Master 2', 'smithing', 'node_town', { rank: 'master' }),
      createCraftsman('m3', 'Master 3', 'smithing', 'node_town', { rank: 'master' }),
      createCraftsman('j1', 'Journeyman', 'smithing', 'node_town', { rank: 'journeyman' }),
    ]

    const check = evaluateGuildFormation(craftsmen, 'node_town', 'smithing')
    expect(check.canForm).toBe(true)
    expect(check.masterCount).toBe(3)
    expect(check.masters).toHaveLength(3)
  })

  it('cannot form with only 2 masters', () => {
    resetCraftsmanSeq()
    const craftsmen = [
      createCraftsman('m1', 'Master 1', 'smithing', 'node_town', { rank: 'master' }),
      createCraftsman('m2', 'Master 2', 'smithing', 'node_town', { rank: 'master' }),
    ]

    const check = evaluateGuildFormation(craftsmen, 'node_town', 'smithing')
    expect(check.canForm).toBe(false)
  })

  it('trade capacity scales with settlement size', () => {
    expect(getTradeCapacity('metropolis')).toBe(15)
    expect(getTradeCapacity('city')).toBe(8)
    expect(getTradeCapacity('town')).toBe(4)
    expect(getTradeCapacity('village')).toBe(2)
    expect(getTradeCapacity('hamlet')).toBe(1)
  })
})

// ============================================================
// RECIPES & QUERIES
// ============================================================

describe('Craftsman — Recipes & Queries', () => {
  it('getCraftRecipes filters by trade, rank, and skill', () => {
    const smithRecipes = getCraftRecipes('smithing', 'apprentice', 1)
    expect(smithRecipes.length).toBeGreaterThan(0)
    expect(smithRecipes.every(r => r.trade === 'smithing')).toBe(true)
    expect(smithRecipes.every(r => r.skillRequired <= 1)).toBe(true)

    // Master-level recipe not available to apprentice
    const masterRecipes = getCraftRecipes('smithing', 'master', 5)
    expect(masterRecipes.length).toBeGreaterThan(smithRecipes.length)
  })

  it('has seed recipes for multiple trades', () => {
    const trades = new Set(SEED_RECIPES.map(r => r.trade))
    expect(trades.size).toBeGreaterThanOrEqual(6) // At least 6 trades covered
  })

  it('getMastersAt queries correctly', () => {
    resetCraftsmanSeq()
    const craftsmen = [
      createCraftsman('m1', 'M1', 'smithing', 'n1', { rank: 'master' }),
      createCraftsman('m2', 'M2', 'baking', 'n1', { rank: 'master' }),
      createCraftsman('m3', 'M3', 'smithing', 'n2', { rank: 'master' }),
      createCraftsman('j1', 'J1', 'smithing', 'n1', { rank: 'journeyman' }),
    ]

    expect(getMastersAt(craftsmen, 'n1')).toHaveLength(2) // M1 + M2
    expect(getMastersAt(craftsmen, 'n1', 'smithing')).toHaveLength(1) // Only M1
    expect(getMastersAt(craftsmen, 'n2')).toHaveLength(1) // M3
  })

  it('getApprenticesOf finds apprentices', () => {
    resetCraftsmanSeq()
    const master = createCraftsman('m', 'Master', 'smithing', 'n', { rank: 'master' })
    const a1 = createCraftsman('a1', 'A1', 'smithing', 'n', { rank: 'apprentice', masterId: master.id })
    const a2 = createCraftsman('a2', 'A2', 'smithing', 'n', { rank: 'apprentice', masterId: master.id })
    const a3 = createCraftsman('a3', 'A3', 'smithing', 'n', { rank: 'apprentice', masterId: 'other' })

    expect(getApprenticesOf([a1, a2, a3], master.id)).toHaveLength(2)
  })
})

// ============================================================
// MONTHLY TICK
// ============================================================

describe('Craftsman — Monthly Tick', () => {
  it('advances apprentices and detects guild formation', () => {
    resetCraftsmanSeq()
    const craftsmen = [
      createCraftsman('m1', 'Master 1', 'smithing', 'n', { rank: 'master', skillLevel: 5 }),
      createCraftsman('m2', 'Master 2', 'smithing', 'n', { rank: 'master', skillLevel: 5 }),
      createCraftsman('m3', 'Master 3', 'smithing', 'n', { rank: 'master', skillLevel: 5 }),
      createCraftsman('a1', 'Apprentice 1', 'smithing', 'n', {
        rank: 'apprentice', skillLevel: 1,
        apprenticeshipProgress: 0, masterId: 'craft_1',
      }),
    ]

    let rollIdx = 0
    const d20 = () => [15, 10, 8, 12, 14, 18][rollIdx++ % 6]

    const result = monthlyCraftTick(craftsmen, 'n', 'town', 100, d20)

    expect(result.apprenticesAdvanced).toBe(1)
    expect(result.guildFormations).toHaveLength(1)
    expect(result.guildFormations[0].trade).toBe('smithing')
    expect(result.guildFormations[0].masterCount).toBe(3)
  })
})
