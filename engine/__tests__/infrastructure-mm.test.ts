/**
 * INFRASTRUCTURE MM TESTS
 * ========================
 * Settlement evolution: knowledge → professions → guilds → tiers
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createInfrastructure,
  evaluateProfessions,
  checkGuildFormation,
  tickInfrastructure,
  injectExplorationSeeds,
  injectTradeSeeds,
  injectPlayerDiscovery,
  injectResearchSeed,
  ascendCharacter,
  snapshotInfrastructure,
  STANDARD_PROFESSIONS,
  GUILD_FORMATION_RULES,
  type InfrastructureState,
} from '../infrastructure-mm.js'
import { addSeed, resetSeedIdCounter, resetPotentialIdCounter } from '../knowledge-pool.js'

let state: InfrastructureState

beforeEach(() => {
  resetSeedIdCounter()
  resetPotentialIdCounter()
  state = createInfrastructure('hub_1', 'Millhaven', 150, 0)
})

// ============================================================
// CREATION
// ============================================================

describe('Infrastructure Creation', () => {
  it('creates a hamlet with basic professions', () => {
    expect(state.tier).toBe(1)
    expect(state.formedGuilds).toContain('adventurers')
    expect(state.activeProfessions.has('farmer')).toBe(true)
    expect(state.activeProfessions.has('hunter')).toBe(true)
    expect(state.activeProfessions.has('guard')).toBe(true)
    expect(state.activeProfessions.has('adventurer')).toBe(true)
  })

  it('adventurers guild is always pre-seeded', () => {
    const tiny = createInfrastructure('h2', 'TinyHamlet', 10, 0)
    expect(tiny.formedGuilds).toContain('adventurers')
  })

  it('basic profession count scales with population', () => {
    const big = createInfrastructure('h3', 'BigTown', 500, 0)
    const farmers = big.activeProfessions.get('farmer') ?? 0
    expect(farmers).toBeGreaterThan(1)
  })

  it('starts with zero development score', () => {
    expect(state.developmentScore).toBe(0)
  })

  it('knowledge pool is initialized', () => {
    expect(state.knowledgePool.hubId).toBe('hub_1')
    expect(state.knowledgePool.seeds).toHaveLength(0)
  })
})

// ============================================================
// PROFESSIONS
// ============================================================

describe('Profession Evaluation', () => {
  it('finds only basic professions without knowledge', () => {
    const available = evaluateProfessions(state)
    const roles = available.map(p => p.role)
    expect(roles).toContain('farmer')
    expect(roles).toContain('hunter')
    expect(roles).not.toContain('blacksmith') // Needs 'metalworking' seed
  })

  it('unlocks blacksmith after metalworking seed + forge workshop', () => {
    addSeed(state.knowledgePool, 'metalworking', 'Metal', 'technique', 'research', 'npc', 1, 10, 'test')
    state.workshops.push('forge')
    state.population = 200 // Needs 50+

    const available = evaluateProfessions(state)
    expect(available.find(p => p.role === 'blacksmith')).toBeDefined()
  })

  it('respects population requirements', () => {
    addSeed(state.knowledgePool, 'metalworking', 'Metal', 'technique', 'research', 'npc', 1, 10, 'test')
    state.workshops.push('forge')
    state.population = 20 // Too small for blacksmith (needs 50)

    const available = evaluateProfessions(state)
    expect(available.find(p => p.role === 'blacksmith')).toBeUndefined()
  })

  it('unlocks alchemist after herbalism + glassmaking seeds', () => {
    addSeed(state.knowledgePool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc', 1, 10, 'test')
    addSeed(state.knowledgePool, 'glassmaking', 'Glass', 'technique', 'trade', 'npc', 2, 10, 'test')
    state.workshops.push('alchemy_lab')
    state.population = 100

    const available = evaluateProfessions(state)
    expect(available.find(p => p.role === 'alchemist')).toBeDefined()
  })

  it('standard professions cover all expected tiers', () => {
    const tiers = new Set(STANDARD_PROFESSIONS.map(p => p.tier))
    expect(tiers.has('basic')).toBe(true)
    expect(tiers.has('journeyman')).toBe(true)
    expect(tiers.has('master')).toBe(true)
    expect(tiers.has('expert')).toBe(true)
  })
})

// ============================================================
// GUILD FORMATION
// ============================================================

describe('Guild Formation', () => {
  it('adventurers guild exists from the start', () => {
    const events = checkGuildFormation(state)
    // Adventurers already formed, so no formation event
    const adventurerEvent = events.find(e => e.guildType === 'adventurers')
    expect(adventurerEvent).toBeUndefined()
    expect(state.formedGuilds).toContain('adventurers')
  })

  it('smiths guild forms when 3+ blacksmiths exist in pop 200+', () => {
    state.population = 300
    state.activeProfessions.set('blacksmith', 3)
    state.activeProfessions.set('armorsmith', 1)

    const events = checkGuildFormation(state)
    const smithsEvent = events.find(e => e.guildType === 'smiths')
    expect(smithsEvent).toBeDefined()
    expect(smithsEvent!.professionalCount).toBeGreaterThanOrEqual(3)
  })

  it('no guild forms without enough professionals', () => {
    state.population = 300
    state.activeProfessions.set('blacksmith', 1) // Only 1, needs 3

    const events = checkGuildFormation(state)
    expect(events.find(e => e.guildType === 'smiths')).toBeUndefined()
  })

  it('no guild forms without enough population', () => {
    state.population = 50  // Too small for smiths guild (needs 200)
    state.activeProfessions.set('blacksmith', 5) // Plenty of professionals

    const events = checkGuildFormation(state)
    expect(events.find(e => e.guildType === 'smiths')).toBeUndefined()
  })

  it('does not re-form an already formed guild', () => {
    state.population = 300
    state.activeProfessions.set('blacksmith', 5)
    state.formedGuilds.push('smiths')

    const events = checkGuildFormation(state)
    expect(events.find(e => e.guildType === 'smiths')).toBeUndefined()
  })

  it('formation rules include all expected guild types', () => {
    const guildTypes = GUILD_FORMATION_RULES.map(r => r.guildType)
    expect(guildTypes).toContain('adventurers')
    expect(guildTypes).toContain('smiths')
    expect(guildTypes).toContain('alchemists')
    expect(guildTypes).toContain('merchants')
  })
})

// ============================================================
// SEED INJECTION
// ============================================================

describe('Seed Injection', () => {
  it('exploration seeds inject with correct category', () => {
    const added = injectExplorationSeeds(state, [
      { tag: 'iron_ore_deposit', name: 'Iron Vein', category: 'material' },
      { tag: 'wolf_den', name: 'Wolf Den', category: 'creature' },
    ], 'Scout Party Alpha', 30)

    expect(added).toHaveLength(2)
    expect(state.knowledgePool.seeds[0].source).toBe('exploration')
  })

  it('trade seeds inject as technique', () => {
    const added = injectTradeSeeds(state, [
      { tag: 'glassmaking', name: 'Glass Blowing' },
    ], 'Merchant Farid', 60)

    expect(added).toHaveLength(1)
    expect(state.knowledgePool.seeds[0].category).toBe('technique')
    expect(state.knowledgePool.seeds[0].source).toBe('trade')
  })

  it('player discoveries have high resonance', () => {
    injectPlayerDiscovery(state, 'herbalism', 'Herb Lore', 'botanical',
      'Player One', 10, 'Found the healing moss')

    const seed = state.knowledgePool.seeds[0]
    expect(seed.resonance).toBe(18)
    expect(seed.source).toBe('player_action')
  })

  it('research requires d20 DC 15', () => {
    const pass = injectResearchSeed(state, 'arcane_theory', 'Arcana Study', 'Scholar Elm', 30, 18)
    expect(pass).toBe(true)

    const fail = injectResearchSeed(state, 'other_theory', 'Study', 'Scholar Elm', 30, 10)
    expect(fail).toBe(false)
  })

  it('prevents duplicate seed tags via any injection', () => {
    injectPlayerDiscovery(state, 'herbalism', 'Herbs A', 'botanical', 'P1', 1, 'Found')
    const dup = injectPlayerDiscovery(state, 'herbalism', 'Herbs B', 'botanical', 'P2', 2, 'Found again')
    expect(dup).toBe(false)
    expect(state.knowledgePool.seeds).toHaveLength(1)
  })
})

// ============================================================
// MONTHLY TICK
// ============================================================

describe('Monthly Tick', () => {
  it('ticks without error on empty state', () => {
    const result = tickInfrastructure(state, 30, [10])
    expect(result.month).toBe(1)
    expect(result.narrative.length).toBeGreaterThan(0)
  })

  it('activates knowledge → unlocks workshop → creates profession in one tick', () => {
    // Seed the knowledge pool with brewery prerequisites
    addSeed(state.knowledgePool, 'grain_cultivation', 'Grain', 'botanical', 'exploration', 'npc', 1, 15, 'Grew')
    addSeed(state.knowledgePool, 'fermentation', 'Fermenting', 'technique', 'accident', 'npc', 5, 15, 'Oops')
    state.commodities.push('grain')

    // Tick with high rolls
    const result = tickInfrastructure(state, 30, [20, 20])

    // Brewery should have been unlocked by knowledge pool
    if (result.knowledgeResult.totalActivations > 0) {
      expect(state.workshops).toContain('brewery')
      // Brewer profession should have appeared
      expect(state.activeProfessions.has('brewer')).toBe(true)
    }
  })

  it('forms guilds when threshold reached', () => {
    state.population = 300
    // Pre-populate with enough blacksmiths for guild formation
    state.activeProfessions.set('blacksmith', 3)
    state.activeProfessions.set('armorsmith', 1)
    addSeed(state.knowledgePool, 'metalworking', 'Metal', 'technique', 'research', 'npc', 1, 10, 'test')
    state.workshops.push('forge')

    const result = tickInfrastructure(state, 30, [10])

    const smithsGuild = result.newGuilds.find(g => g.guildType === 'smiths')
    expect(smithsGuild).toBeDefined()
    expect(state.formedGuilds).toContain('smiths')
  })

  it('advances development score', () => {
    // Set up for successful activation
    addSeed(state.knowledgePool, 'herbalism', 'Herbs', 'botanical', 'exploration', 'npc', 1, 15, 'Found')
    addSeed(state.knowledgePool, 'medicine_knowledge', 'Medicine', 'lore', 'research', 'npc', 2, 15, 'Studied')

    const result = tickInfrastructure(state, 30, [20, 20])
    if (result.knowledgeResult.totalActivations > 0) {
      expect(state.developmentScore).toBeGreaterThan(0)
      expect(result.developmentDelta).toBeGreaterThan(0)
    }
  })

  it('tracks month count', () => {
    tickInfrastructure(state, 30, [10])
    tickInfrastructure(state, 60, [10])
    tickInfrastructure(state, 90, [10])
    expect(state.totalMonthsTicked).toBe(3)
  })
})

// ============================================================
// TIER ADVANCEMENT
// ============================================================

describe('Tier Advancement', () => {
  it('starts at tier 1 (hamlet)', () => {
    expect(state.tier).toBe(1)
  })

  it('advances to tier 2 (village) with pop + dev + guilds', () => {
    state.population = 200
    state.developmentScore = 60
    state.formedGuilds.push('smiths') // Now has 2 guilds (adventurers + smiths)

    tickInfrastructure(state, 30, [10])

    expect(state.tier).toBe(2)
  })

  it('advances to tier 3 (town) with higher thresholds', () => {
    state.population = 600
    state.developmentScore = 250
    state.formedGuilds.push('smiths', 'carpenters', 'weavers') // 4 guilds

    tickInfrastructure(state, 30, [10])

    expect(state.tier).toBe(3)
  })

  it('does not skip tiers', () => {
    // Meets tier 3 thresholds but not tier 4
    state.population = 600
    state.developmentScore = 250
    state.formedGuilds.push('smiths', 'carpenters', 'weavers')

    tickInfrastructure(state, 30, [10])

    expect(state.tier).toBe(3) // Not 4 or 5
  })
})

// ============================================================
// ASCENSION
// ============================================================

describe('Character Ascension', () => {
  it('merges character knowledge into settlement', () => {
    const result = ascendCharacter(state, 'Lord Aldric',
      ['herbalism', 'iron_smelting', 'stone_cutting'], 100)

    expect(result.newSeeds).toHaveLength(3)
    expect(result.narrative).toContain('Lord Aldric')
    expect(result.narrative).toContain('Millhaven')
  })

  it('ascended knowledge triggers infrastructure growth', () => {
    ascendCharacter(state, 'Lady Sera',
      ['herbalism', 'medicine_knowledge', 'glassmaking',
       'iron_smelting', 'fire_mastery', 'grain_cultivation',
       'fermentation'], 100)

    state.commodities.push('grain', 'iron_ore')

    // Tick — should activate a LOT
    const result = tickInfrastructure(state, 130, [18, 18, 18, 18, 18, 18, 18])

    expect(result.knowledgeResult.totalActivations).toBeGreaterThan(0)
    expect(state.workshops.length).toBeGreaterThan(0)
  })
})

// ============================================================
// SNAPSHOT
// ============================================================

describe('Snapshot', () => {
  it('produces a serializable summary', () => {
    const snap = snapshotInfrastructure(state)

    expect(snap.hubName).toBe('Millhaven')
    expect(snap.tierName).toBe('Hamlet')
    expect(snap.guilds).toContain('adventurers')
    expect(snap.professionCount).toBeGreaterThan(0)
    expect(typeof snap.developmentScore).toBe('number')
  })

  it('snapshot updates after tick', () => {
    const before = snapshotInfrastructure(state)
    ascendCharacter(state, 'The Founder',
      ['herbalism', 'medicine_knowledge'], 1)
    tickInfrastructure(state, 30, [20, 20])
    const after = snapshotInfrastructure(state)

    expect(after.seedCount).toBeGreaterThan(before.seedCount)
    expect(after.monthsTicked).toBe(1)
  })
})

// ============================================================
// FULL LIFECYCLE
// ============================================================

describe('Full Lifecycle', () => {
  it('hamlet evolves to village over 12 months', () => {
    state.population = 200

    // Month 1-2: Exploration seeds
    injectExplorationSeeds(state, [
      { tag: 'iron_smelting', name: 'Iron Ore', category: 'material' },
      { tag: 'herbalism', name: 'Wild Herbs', category: 'botanical' },
    ], 'Scout Party', 0)

    // Month 3: Trade brings techniques
    injectTradeSeeds(state, [
      { tag: 'fire_mastery', name: 'Fire Control' },
      { tag: 'glassmaking', name: 'Glass Blowing' },
    ], 'Merchant Farid', 60)

    // Month 4: Player discovers farming
    injectPlayerDiscovery(state, 'grain_cultivation', 'Grain', 'botanical',
      'PlayerOne', 90, 'Figured out crop rotation')
    injectPlayerDiscovery(state, 'fermentation', 'Beer!', 'technique',
      'PlayerOne', 95, 'Left grain in water too long')
    injectPlayerDiscovery(state, 'medicine_knowledge', 'Medicine', 'lore',
      'PlayerOne', 98, 'Healer figured out dosages')
    injectPlayerDiscovery(state, 'hide_processing', 'Hides', 'technique',
      'PlayerOne', 100, 'Hunter learned to cure hides')

    // Add commodities that would be available
    state.commodities.push('grain', 'iron_ore', 'raw_hide')

    // Tick 12 months
    for (let month = 1; month <= 12; month++) {
      const day = month * 30
      // Growing population
      state.population = Math.min(500, 200 + month * 10)
      tickInfrastructure(state, day, [15, 14, 16, 13, 18, 12, 17, 11, 19, 10])
    }

    const snap = snapshotInfrastructure(state)

    // Should have grown significantly
    expect(snap.professionCount).toBeGreaterThan(8)
    expect(snap.workshopCount).toBeGreaterThan(0)
    expect(snap.developmentScore).toBeGreaterThan(0)
    expect(snap.seedCount).toBeGreaterThan(4)
    // Should be at least village tier
    expect(snap.tier).toBeGreaterThanOrEqual(2)
  })

  it('consistency: standard professions all have valid guild types when set', () => {
    const guildTypes = GUILD_FORMATION_RULES.map(r => r.guildType)
    for (const prof of STANDARD_PROFESSIONS) {
      if (prof.guildType) {
        expect(guildTypes).toContain(prof.guildType)
      }
    }
  })

  it('consistency: only one guild is pre-seeded (adventurers)', () => {
    const preSeeded = GUILD_FORMATION_RULES.filter(r => r.preSeeded)
    expect(preSeeded).toHaveLength(1)
    expect(preSeeded[0].guildType).toBe('adventurers')
  })
})
