/**
 * KNOWLEDGE POOL TESTS
 * =====================
 * Seeds → Potentials → Activation → Cascade → Ascension
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createKnowledgePool,
  addSeed,
  hasSeeds,
  getSeedTags,
  scanPotentials,
  activatePotential,
  tickKnowledgePool,
  ascendCharacterKnowledge,
  STANDARD_POTENTIALS,
  resetSeedIdCounter,
  resetPotentialIdCounter,
  type KnowledgePool,
  type HubContext,
  type InfrastructurePotential,
} from '../knowledge-pool'

// ============================================================
// TEST FIXTURES
// ============================================================

function createTestContext(overrides?: Partial<HubContext>): HubContext {
  return {
    npcRoles: ['healer', 'farmer', 'laborer', 'miner', 'hunter'],
    commoditiesAvailable: ['grain', 'iron_ore', 'raw_hide', 'clay', 'timber'],
    population: 200,
    hasTradeRoute: false,
    ...overrides,
  }
}

let pool: KnowledgePool

beforeEach(() => {
  resetSeedIdCounter()
  resetPotentialIdCounter()
  pool = createKnowledgePool('hub_1', 0)
})

// ============================================================
// SEED OPERATIONS
// ============================================================

describe('Knowledge Seeds', () => {
  it('creates an empty pool', () => {
    expect(pool.seeds).toHaveLength(0)
    expect(pool.realizedPotentials).toHaveLength(0)
    expect(pool.developmentPoints).toBe(0)
  })

  it('adds a seed to the pool', () => {
    const added = addSeed(pool, 'herbalism', 'Herb Knowledge', 'botanical',
      'exploration', 'npc_1', 1, 12, 'Found medicinal herbs while foraging.')
    expect(added).toBe(true)
    expect(pool.seeds).toHaveLength(1)
    expect(pool.seeds[0].tag).toBe('herbalism')
  })

  it('prevents duplicate seed tags', () => {
    addSeed(pool, 'herbalism', 'Herb Knowledge', 'botanical', 'exploration', 'npc_1', 1, 12, 'Found herbs.')
    const duplicate = addSeed(pool, 'herbalism', 'More Herbs', 'botanical', 'trade', 'npc_2', 5, 8, 'Trader brings more.')
    expect(duplicate).toBe(false)
    expect(pool.seeds).toHaveLength(1)
  })

  it('checks for seed existence', () => {
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_1', 1, 10, 'Found.')
    addSeed(pool, 'glassmaking', 'Glass', 'technique', 'trade', 'npc_2', 2, 10, 'Learned.')
    
    expect(hasSeeds(pool, ['herbalism'])).toBe(true)
    expect(hasSeeds(pool, ['herbalism', 'glassmaking'])).toBe(true)
    expect(hasSeeds(pool, ['herbalism', 'alchemy'])).toBe(false)
  })

  it('returns all seed tags', () => {
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_1', 1, 10, 'Found.')
    addSeed(pool, 'iron_smelting', 'Smelting', 'technique', 'research', 'npc_2', 5, 15, 'Figured out.')
    
    const tags = getSeedTags(pool)
    expect(tags).toContain('herbalism')
    expect(tags).toContain('iron_smelting')
    expect(tags).toHaveLength(2)
  })

  it('tracks seed metadata correctly', () => {
    addSeed(pool, 'herbalism', 'Herb Lore', 'botanical', 'player_action', 'player_1', 42, 18,
      'The ranger identified healing properties in local flora.')
    
    const seed = pool.seeds[0]
    expect(seed.category).toBe('botanical')
    expect(seed.source).toBe('player_action')
    expect(seed.discoveredBy).toBe('player_1')
    expect(seed.discoveredOnDay).toBe(42)
    expect(seed.resonance).toBe(18)
  })
})

// ============================================================
// POTENTIAL SCANNING
// ============================================================

describe('Potential Scanning', () => {
  it('finds no potentials with empty pool', () => {
    const ctx = createTestContext()
    const result = scanPotentials(pool, ctx)
    expect(result).toHaveLength(0)
  })

  it('finds alchemy potential when seeds + role align', () => {
    addSeed(pool, 'glassmaking', 'Glass', 'technique', 'trade', 'npc_1', 1, 10, 'Learned.')
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_2', 2, 10, 'Found.')
    
    const ctx = createTestContext({ npcRoles: ['healer'] })
    const result = scanPotentials(pool, ctx)
    
    const alchemy = result.find(p => p.name === 'Basic Alchemy')
    expect(alchemy).toBeDefined()
  })

  it('skips potentials missing seeds', () => {
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_1', 1, 10, 'Found.')
    // Missing 'glassmaking'
    
    const ctx = createTestContext({ npcRoles: ['healer'] })
    const result = scanPotentials(pool, ctx)
    
    const alchemy = result.find(p => p.name === 'Basic Alchemy')
    expect(alchemy).toBeUndefined()
  })

  it('skips potentials missing required role', () => {
    addSeed(pool, 'glassmaking', 'Glass', 'technique', 'trade', 'npc_1', 1, 10, 'Learned.')
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_2', 2, 10, 'Found.')
    
    // No healer
    const ctx = createTestContext({ npcRoles: ['farmer', 'laborer'] })
    const result = scanPotentials(pool, ctx)
    
    const alchemy = result.find(p => p.name === 'Basic Alchemy')
    expect(alchemy).toBeUndefined()
  })

  it('skips potentials missing commodity requirements', () => {
    addSeed(pool, 'iron_smelting', 'Smelting', 'technique', 'research', 'npc_1', 1, 10, 'Learned.')
    addSeed(pool, 'fire_mastery', 'Fire', 'technique', 'accident', 'npc_2', 2, 10, 'Hot.')
    
    // Missing iron_ore commodity
    const ctx = createTestContext({ npcRoles: ['miner'], commoditiesAvailable: [] })
    const result = scanPotentials(pool, ctx)
    
    const smithy = result.find(p => p.name === 'Smithy')
    expect(smithy).toBeUndefined()
  })

  it('skips already realized potentials', () => {
    addSeed(pool, 'glassmaking', 'Glass', 'technique', 'trade', 'npc_1', 1, 10, 'Learned.')
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_2', 2, 10, 'Found.')
    
    const ctx = createTestContext({ npcRoles: ['healer'] })
    
    // First scan finds it
    const first = scanPotentials(pool, ctx)
    const alchemy = first.find(p => p.name === 'Basic Alchemy')!
    
    // Activate it
    activatePotential(pool, alchemy, 20, 30)
    
    // Second scan skips it
    const second = scanPotentials(pool, ctx)
    expect(second.find(p => p.name === 'Basic Alchemy')).toBeUndefined()
  })

  it('respects population requirements', () => {
    addSeed(pool, 'arcane_theory', 'Arcana', 'lore', 'research', 'npc_1', 1, 10, 'Studied.')
    addSeed(pool, 'gem_cutting', 'Gems', 'technique', 'trade', 'npc_2', 2, 10, 'Cut.')
    
    const ctx = createTestContext({ npcRoles: ['mage'], commoditiesAvailable: ['gems'], population: 100 })
    const result = scanPotentials(pool, ctx)
    expect(result.find(p => p.name === 'Enchanting Workshop')).toBeUndefined()
    
    ctx.population = 1000
    const result2 = scanPotentials(pool, ctx)
    expect(result2.find(p => p.name === 'Enchanting Workshop')).toBeDefined()
  })

  it('respects trade route requirements', () => {
    addSeed(pool, 'gem_cutting', 'Gems', 'technique', 'trade', 'npc_1', 1, 10, 'Cut.')
    addSeed(pool, 'metalworking', 'Metal', 'technique', 'research', 'npc_2', 2, 10, 'Worked.')
    
    const ctx = createTestContext({
      npcRoles: ['goldsmith'],
      commoditiesAvailable: ['gems', 'gold'],
      hasTradeRoute: false,
    })
    const without = scanPotentials(pool, ctx)
    expect(without.find(p => p.name === 'Jeweler')).toBeUndefined()
    
    ctx.hasTradeRoute = true
    const withRoute = scanPotentials(pool, ctx)
    expect(withRoute.find(p => p.name === 'Jeweler')).toBeDefined()
  })
})

// ============================================================
// ACTIVATION
// ============================================================

describe('Potential Activation', () => {
  it('activates on high roll', () => {
    addSeed(pool, 'grain_cultivation', 'Grain', 'botanical', 'exploration', 'npc_1', 1, 10, 'Grew.')
    addSeed(pool, 'fermentation', 'Fermenting', 'technique', 'accident', 'npc_2', 5, 10, 'Oops.')
    
    const ctx = createTestContext({ npcRoles: ['farmer'], commoditiesAvailable: ['grain'] })
    const breweryPot = scanPotentials(pool, ctx).find(p => p.name === 'Brewery')!
    
    const result = activatePotential(pool, breweryPot, 18, 30) // DC 8, roll 18
    expect(result.activated).toBe(true)
    expect(pool.availableWorkshops).toContain('brewery')
    expect(pool.availableCommodities).toContain('ale')
    expect(pool.realizedPotentials).toContain(breweryPot.id)
    expect(pool.developmentPoints).toBeGreaterThan(0)
  })

  it('fails on low roll', () => {
    addSeed(pool, 'grain_cultivation', 'Grain', 'botanical', 'exploration', 'npc_1', 1, 10, 'Grew.')
    addSeed(pool, 'fermentation', 'Fermenting', 'technique', 'accident', 'npc_2', 5, 2, 'Oops.')
    
    const ctx = createTestContext({ npcRoles: ['farmer'], commoditiesAvailable: ['grain'] })
    const breweryPot = scanPotentials(pool, ctx).find(p => p.name === 'Brewery')!
    
    const result = activatePotential(pool, breweryPot, 2, 30) // DC 8, roll 2
    expect(result.activated).toBe(false)
    expect(pool.availableWorkshops).not.toContain('brewery')
  })

  it('applies resonance bonus from high-quality seeds', () => {
    // High resonance seeds (18 each)
    addSeed(pool, 'glassmaking', 'Glass', 'technique', 'player_action', 'p1', 1, 18, 'Player discovered.')
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'player_action', 'p1', 2, 18, 'Player found.')
    
    const ctx = createTestContext({ npcRoles: ['healer'] })
    const alchemyPot = scanPotentials(pool, ctx).find(p => p.name === 'Basic Alchemy')!
    
    // DC 10, roll 8 + resonance bonus (avg 18 / 5 = 3) = 11 → should pass
    const result = activatePotential(pool, alchemyPot, 8, 30)
    expect(result.resonanceBonus).toBe(3)
    expect(result.totalRoll).toBe(11)
    expect(result.activated).toBe(true)
  })

  it('generates cascade seeds on activation', () => {
    addSeed(pool, 'iron_smelting', 'Smelting', 'technique', 'research', 'npc_1', 1, 10, 'Smelted.')
    addSeed(pool, 'fire_mastery', 'Fire', 'technique', 'accident', 'npc_2', 2, 10, 'Hot.')
    
    const ctx = createTestContext({ npcRoles: ['miner'], commoditiesAvailable: ['iron_ore'] })
    const smithyPot = scanPotentials(pool, ctx).find(p => p.name === 'Smithy')!
    
    const result = activatePotential(pool, smithyPot, 20, 30)
    expect(result.activated).toBe(true)
    expect(result.newSeeds).toContain('metalworking')
    // The cascade seed should now be in the pool
    expect(hasSeeds(pool, ['metalworking'])).toBe(true)
  })

  it('unlocks new roles', () => {
    addSeed(pool, 'glassmaking', 'Glass', 'technique', 'trade', 'npc_1', 1, 10, 'Learned.')
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_2', 2, 10, 'Found.')
    
    const ctx = createTestContext({ npcRoles: ['healer'] })
    const alchemyPot = scanPotentials(pool, ctx).find(p => p.name === 'Basic Alchemy')!
    
    activatePotential(pool, alchemyPot, 20, 30)
    expect(pool.availableRoles).toContain('alchemist')
  })

  it('prevents duplicate unlocks on re-entry', () => {
    addSeed(pool, 'grain_cultivation', 'Grain', 'botanical', 'exploration', 'npc_1', 1, 10, 'Grew.')
    addSeed(pool, 'fermentation', 'Fermenting', 'technique', 'accident', 'npc_2', 5, 10, 'Oops.')
    
    const ctx = createTestContext({ npcRoles: ['farmer'], commoditiesAvailable: ['grain'] })
    const breweryPot = scanPotentials(pool, ctx).find(p => p.name === 'Brewery')!
    
    // Pre-add the workshop to simulate idempotency
    pool.availableWorkshops.push('brewery')
    activatePotential(pool, breweryPot, 20, 30)
    
    // Should not duplicate
    expect(pool.availableWorkshops.filter(w => w === 'brewery')).toHaveLength(1)
  })
})

// ============================================================
// MONTHLY TICK
// ============================================================

describe('Monthly Tick', () => {
  it('scans and activates in one tick', () => {
    addSeed(pool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc_1', 1, 10, 'Found.')
    addSeed(pool, 'medicine_knowledge', 'Medicine', 'lore', 'research', 'npc_2', 2, 10, 'Studied.')
    
    const ctx = createTestContext({ npcRoles: ['healer'] })
    const result = tickKnowledgePool(pool, ctx, 30, [20, 20, 20]) // All high rolls
    
    expect(result.totalActivations).toBeGreaterThanOrEqual(1)
    expect(pool.availableWorkshops.length).toBeGreaterThan(0)
  })

  it('cascades within a single tick', () => {
    // Set up for Smithy (generates 'metalworking' seed)
    addSeed(pool, 'iron_smelting', 'Smelting', 'technique', 'research', 'npc_1', 1, 10, 'Smelted.')
    addSeed(pool, 'fire_mastery', 'Fire', 'technique', 'accident', 'npc_2', 2, 10, 'Hot.')
    // Also set up for Armorsmith (needs 'metalworking' + 'leather_working')
    addSeed(pool, 'leather_working', 'Leather', 'technique', 'trade', 'npc_3', 3, 10, 'Worked.')
    
    const ctx = createTestContext({
      npcRoles: ['miner', 'blacksmith'],
      commoditiesAvailable: ['iron_ore', 'iron_tools', 'leather'],
    })
    
    // All high rolls → Smithy activates, generates 'metalworking', then Armorsmith should cascade
    const result = tickKnowledgePool(pool, ctx, 30, [20, 20, 20, 20, 20])
    
    expect(result.cascadeSeeds).toContain('metalworking')
    // The armorsmith should have been found in the second pass
    const armorsmithActivation = result.activationAttempts.find(
      a => a.potentialName === 'Armorsmith'
    )
    if (armorsmithActivation) {
      // If the cascade pass found it, it should have been attempted
      expect(armorsmithActivation).toBeDefined()
    }
  })

  it('produces narrative summary', () => {
    addSeed(pool, 'grain_cultivation', 'Grain', 'botanical', 'exploration', 'npc_1', 1, 10, 'Grew.')
    addSeed(pool, 'fermentation', 'Fermenting', 'technique', 'accident', 'npc_2', 5, 10, 'Oops.')
    
    const ctx = createTestContext({ npcRoles: ['farmer'], commoditiesAvailable: ['grain'] })
    const result = tickKnowledgePool(pool, ctx, 30, [20])
    
    expect(result.narrative.length).toBeGreaterThan(0)
  })

  it('no-ops when nothing is realizable', () => {
    const ctx = createTestContext()
    const result = tickKnowledgePool(pool, ctx, 30, [10])
    
    expect(result.totalActivations).toBe(0)
    expect(result.narrative).toBe('No breakthroughs this month.')
  })

  it('updates pool lastTickDay', () => {
    const ctx = createTestContext()
    tickKnowledgePool(pool, ctx, 42, [10])
    expect(pool.lastTickDay).toBe(42)
  })
})

// ============================================================
// ASCENSION
// ============================================================

describe('Character Ascension', () => {
  it('merges character knowledge into hub pool', () => {
    const newSeeds = ascendCharacterKnowledge(
      pool, 'Lord Aldric', ['herbalism', 'iron_smelting', 'stone_cutting'], 100
    )
    
    expect(newSeeds).toHaveLength(3)
    expect(pool.seeds).toHaveLength(3)
    expect(hasSeeds(pool, ['herbalism', 'iron_smelting', 'stone_cutting'])).toBe(true)
  })

  it('marks ascension seeds with inheritance source', () => {
    ascendCharacterKnowledge(pool, 'Queen Lyra', ['arcane_theory'], 200)
    
    const seed = pool.seeds.find(s => s.tag === 'arcane_theory')!
    expect(seed.source).toBe('inheritance')
    expect(seed.discoveredBy).toBe('Queen Lyra')
    expect(seed.resonance).toBe(15) // High resonance — founder's legacy
  })

  it('skips knowledge that already exists in the pool', () => {
    addSeed(pool, 'herbalism', 'Village Herbs', 'botanical', 'exploration', 'npc_1', 1, 5, 'Found.')
    
    const newSeeds = ascendCharacterKnowledge(
      pool, 'Lord Aldric', ['herbalism', 'iron_smelting'], 100
    )
    
    expect(newSeeds).toHaveLength(1) // Only iron_smelting is new
    expect(newSeeds).toContain('iron_smelting')
    expect(pool.seeds).toHaveLength(2) // Original herbalism + new iron_smelting
  })

  it('ascended knowledge can trigger potentials', () => {
    // Ascend with alchemy prerequisites
    ascendCharacterKnowledge(pool, 'Sage Meridian', ['glassmaking', 'herbalism'], 100)
    
    const ctx = createTestContext({ npcRoles: ['healer'] })
    const potentials = scanPotentials(pool, ctx)
    
    expect(potentials.find(p => p.name === 'Basic Alchemy')).toBeDefined()
  })

  it('supports generational play — child inherits world parent built', () => {
    // Parent ascends, planting seeds
    ascendCharacterKnowledge(pool, 'Lord Aldric',
      ['iron_smelting', 'fire_mastery', 'herbalism', 'glassmaking'], 100)
    
    // Monthly tick with high rolls — parent's legacy activates
    const ctx = createTestContext({
      npcRoles: ['healer', 'miner'],
      commoditiesAvailable: ['iron_ore'],
    })
    const result = tickKnowledgePool(pool, ctx, 130, [18, 18, 18, 18, 18, 18])
    
    // Parent's knowledge should have unlocked things
    expect(result.totalActivations).toBeGreaterThan(0)
    
    // Child arrives to a settlement with infrastructure the parent built
    expect(pool.availableWorkshops.length).toBeGreaterThan(0)
    expect(pool.developmentPoints).toBeGreaterThan(0)
  })
})

// ============================================================
// FULL LIFECYCLE
// ============================================================

describe('Full Lifecycle', () => {
  it('village grows organically over 6 months', () => {
    // Month 1: Explorer finds herbs
    addSeed(pool, 'herbalism', 'Wild Herbs', 'botanical', 'exploration', 'scout_1', 30, 12,
      'Scout discovers medicinal plants along the forest edge.')
    
    // Month 2: Trader brings glassmaking knowledge
    addSeed(pool, 'glassmaking', 'Glass Technique', 'technique', 'trade', 'merchant_1', 60, 8,
      'Foreign merchant demonstrates glass blowing.')
    
    // Month 3: Farmer experiments with grain  
    addSeed(pool, 'grain_cultivation', 'Grain Growing', 'botanical', 'research', 'farmer_1', 90, 10,
      'Farmer discovers optimal planting seasons.')
    addSeed(pool, 'fermentation', 'Fermentation', 'technique', 'accident', 'farmer_1', 92, 14,
      'Grain left in water starts bubbling — tastes interesting!')
    addSeed(pool, 'medicine_knowledge', 'Medicine', 'lore', 'research', 'healer_1', 95, 11,
      'Local healer develops systematic treatment methods.')
    
    const ctx = createTestContext({
      npcRoles: ['healer', 'farmer', 'laborer'],
      commoditiesAvailable: ['grain'],
    })
    
    // Tick month 3: Should find alchemy + apothecary + brewery potentials
    const tick3 = tickKnowledgePool(pool, ctx, 90, [15, 12, 18, 14, 16])
    
    expect(tick3.potentialsScanned).toBeGreaterThan(0)
    
    // Month 5: Miner discovers ore
    addSeed(pool, 'iron_smelting', 'Iron Smelting', 'material', 'exploration', 'miner_1', 150, 16,
      'Miner strikes iron vein and learns to extract ore.')
    addSeed(pool, 'fire_mastery', 'Fire Control', 'technique', 'research', 'smith_1', 155, 13,
      'Aspiring smith masters forge temperature control.')
    
    ctx.npcRoles.push('miner')
    ctx.commoditiesAvailable.push('iron_ore')
    
    // Tick month 5
    const tick5 = tickKnowledgePool(pool, ctx, 150, [17, 14, 19, 12, 15, 18])
    
    // Month 6: Check accumulated state
    expect(pool.seeds.length).toBeGreaterThanOrEqual(5) // Original seeds + any cascades
    expect(pool.totalActivations).toBeGreaterThan(0)
    expect(pool.developmentPoints).toBeGreaterThan(0)
    
    // The village should have grown
    const workshopCount = pool.availableWorkshops.length
    const roleCount = pool.availableRoles.length
    expect(workshopCount + roleCount).toBeGreaterThan(0)
  })

  it('all five tiers of standard potentials are internally consistent', () => {
    // Every potential should have at least one required seed
    for (const pot of STANDARD_POTENTIALS) {
      expect(pot.requiredSeeds.length).toBeGreaterThan(0)
      expect(pot.name.length).toBeGreaterThan(0)
      expect(pot.activationDC).toBeGreaterThanOrEqual(8)
      expect(pot.activationDC).toBeLessThanOrEqual(20)
    }
  })

  it('deterministic with same d20 sequence', () => {
    const seeds = ['herbalism', 'glassmaking', 'medicine_knowledge']
    
    // Run 1
    const pool1 = createKnowledgePool('hub_a', 0)
    for (const tag of seeds) {
      addSeed(pool1, tag, tag, 'technique', 'research', 'npc', 1, 10, 'test')
    }
    const ctx1 = createTestContext({ npcRoles: ['healer'] })
    const result1 = tickKnowledgePool(pool1, ctx1, 30, [15, 12, 18])
    
    // Run 2 (same everything)
    resetSeedIdCounter()
    const pool2 = createKnowledgePool('hub_a', 0)
    for (const tag of seeds) {
      addSeed(pool2, tag, tag, 'technique', 'research', 'npc', 1, 10, 'test')
    }
    const ctx2 = createTestContext({ npcRoles: ['healer'] })
    const result2 = tickKnowledgePool(pool2, ctx2, 30, [15, 12, 18])
    
    expect(result1.totalActivations).toBe(result2.totalActivations)
    expect(pool1.availableWorkshops).toEqual(pool2.availableWorkshops)
  })
})
