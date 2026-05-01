/**
 * SYSTEM EDGES TESTS — Cross-system integration wires
 */
import { describe, it, expect } from 'vitest'
import {
  resolvePredation,
  computeContractFactionImpact,
  calculateKnowledgeMagicModifier,
  computeFactionReaction,
  calculateDungeonKnowledgeYield,
  generateFollowerCombatProfile,
  applyMonsterHunt,
} from '../system-edges.js'
import { createMonsterActor, resetMonsterActorIdCounter, type MonsterActorState } from '../monster-actor.js'
import { getSpecies, type WildHerd } from '../wild-fauna.js'

// ============================================================
// 1. PREDATION — Ecology → Husbandry
// ============================================================

describe('Monster Predation', () => {
  it('guards repel weak monsters', () => {
    const result = resolvePredation(2, 'wolf', 50, 10, 5)
    // DC = 10 + 10 guards = 20, attack = 5 + 2 = 7 < 20
    expect(result.eventType).toBe('repelled')
    expect(result.livestockKilled).toBe(0)
  })

  it('strong monsters kill livestock', () => {
    const result = resolvePredation(8, 'dragon', 100, 3, 15)
    // DC = 10 + 3 = 13, attack = 15 + 8 = 23 >> 13
    expect(result.livestockKilled).toBeGreaterThan(0)
    expect(result.herdFoodLost).toBeGreaterThan(0)
    expect(['minor_raid', 'major_raid', 'devastating_attack']).toContain(result.eventType)
  })

  it('at least 1 killed on successful raid', () => {
    const result = resolvePredation(5, 'goblin', 5, 0, 10)
    // DC = 10, attack = 15, small herd
    expect(result.livestockKilled).toBeGreaterThanOrEqual(1)
  })

  it('food lost is ~200 lbs per animal', () => {
    const result = resolvePredation(10, 'dragon', 100, 0, 15)
    expect(result.herdFoodLost).toBe(result.livestockKilled * 200)
  })
})

// ============================================================
// 2. SOCIAL → FACTION
// ============================================================

describe('Contract → Faction Impact', () => {
  it('cross-faction marriage creates alliance', () => {
    const impacts = computeContractFactionImpact('marriage', 'created', 'faction_a', 'faction_b')
    expect(impacts).toHaveLength(2)
    expect(impacts[0].effect).toBe('alliance_formed')
    expect(impacts[0].loyaltyChange).toBe(15)
    expect(impacts[1].effect).toBe('alliance_formed')
  })

  it('broken vassalage triggers war', () => {
    const impacts = computeContractFactionImpact('vassalage', 'breached', 'faction_a', 'faction_b')
    expect(impacts.find(i => i.effect === 'war_declared')).toBeDefined()
    expect(impacts.find(i => i.effect === 'loyalty_drop')).toBeDefined()
  })

  it('same faction = no cross-impact', () => {
    const impacts = computeContractFactionImpact('marriage', 'created', 'faction_a', 'faction_a')
    expect(impacts).toHaveLength(0)
  })

  it('fulfilled contract boosts trust', () => {
    const impacts = computeContractFactionImpact('trade_partnership', 'fulfilled', 'f1', 'f2')
    expect(impacts.every(i => i.loyaltyChange > 0)).toBe(true)
  })

  it('no factions = no impact', () => {
    const impacts = computeContractFactionImpact('marriage', 'created', null, null)
    expect(impacts).toHaveLength(0)
  })
})

// ============================================================
// 3. KNOWLEDGE → MAGIC
// ============================================================

describe('Knowledge → Magic DC Modifier', () => {
  it('arcane_metallurgy reduces enchantment DC', () => {
    const result = calculateKnowledgeMagicModifier(['arcane_metallurgy'], 'enchantment')
    expect(result.dcModifier).toBe(-2)
    expect(result.contributingSeeds).toContain('arcane_metallurgy')
  })

  it('wild_magic_research helps all schools', () => {
    const result = calculateKnowledgeMagicModifier(['wild_magic_research'], 'necromancy')
    expect(result.dcModifier).toBe(-1)
  })

  it('multiple seeds stack', () => {
    const result = calculateKnowledgeMagicModifier(
      ['ley_line_studies', 'wild_magic_research'],
      'evocation',
    )
    expect(result.dcModifier).toBe(-4) // 3 + 1
  })

  it('caps at -5', () => {
    const result = calculateKnowledgeMagicModifier(
      ['ley_line_studies', 'wild_magic_research', 'thaumaturgic_primer', 'arcane_metallurgy'],
      'abjuration',
    )
    expect(result.dcModifier).toBe(-5) // Would be -8 but capped
  })

  it('non-magic seeds have no effect', () => {
    const result = calculateKnowledgeMagicModifier(['blacksmithing', 'farming'], 'evocation')
    expect(result.dcModifier).toBe(0)
    expect(result.contributingSeeds).toHaveLength(0)
  })
})

// ============================================================
// 4. GUILD INTEL → FACTION
// ============================================================

describe('Guild Intel → Faction Reactions', () => {
  it('strong nearby faction claims resource', () => {
    const reactions = computeFactionReaction(
      { type: 'resource_discovery', sourceGuildId: 'g1', nodeId: 'n1', detail: 'gold vein', value: 80, timestamp: 100 },
      [{ id: 'f1', strength: 70, goal: 'expand', distanceNodes: 1 }],
    )
    expect(reactions[0].action).toBe('claim')
    expect(reactions[0].priority).toBeGreaterThan(5)
  })

  it('weak far faction ignores low-value intel', () => {
    const reactions = computeFactionReaction(
      { type: 'route_danger', sourceGuildId: 'g1', nodeId: 'n5', detail: 'wolves', value: 15, timestamp: 100 },
      [{ id: 'f1', strength: 20, goal: 'survive', distanceNodes: 4 }],
    )
    expect(reactions[0].action).toBe('ignore')
  })

  it('trade-focused faction negotiates for trade opportunity', () => {
    const reactions = computeFactionReaction(
      { type: 'trade_opportunity', sourceGuildId: 'g1', nodeId: 'n2', detail: 'spice route', value: 60, timestamp: 100 },
      [{ id: 'f1', strength: 25, goal: 'trade', distanceNodes: 1 }],
    )
    expect(reactions[0].action).toBe('negotiate')
  })
})

// ============================================================
// 5. DUNGEON → KNOWLEDGE: The Civilization Flywheel
// ============================================================

describe('Dungeon → Knowledge Yield', () => {
  it('ancient forge yields metallurgy seeds', () => {
    const result = calculateDungeonKnowledgeYield(['ancient_forge'], 3, [])
    expect(result.seeds).toContain('dwarven_metallurgy')
    expect(result.seeds).toContain('arcane_metallurgy')
    expect(result.potentialPoints).toBe(15) // 5 * tier 3
  })

  it('library yields high-value knowledge', () => {
    const result = calculateDungeonKnowledgeYield(['library'], 2, [])
    expect(result.seeds).toContain('thaumaturgic_primer')
    expect(result.potentialPoints).toBe(16) // 8 * tier 2
  })

  it('existing seeds not re-added', () => {
    const result = calculateDungeonKnowledgeYield(
      ['ancient_forge'],
      3,
      ['dwarven_metallurgy'], // Already known
    )
    expect(result.seeds).toContain('arcane_metallurgy')
    expect(result.seeds).not.toContain('dwarven_metallurgy')
  })

  it('multiple rooms accumulate potential', () => {
    const result = calculateDungeonKnowledgeYield(
      ['ancient_forge', 'library', 'observatory'],
      1,
      [],
    )
    expect(result.potentialPoints).toBe(5 + 8 + 7) // All at tier 1
    expect(result.seeds.length).toBeGreaterThanOrEqual(4)
  })

  it('treasure vault adds potential but no seeds', () => {
    const result = calculateDungeonKnowledgeYield(['treasure_vault'], 5, [])
    expect(result.seeds).toHaveLength(0)
    expect(result.potentialPoints).toBe(15) // 3 * tier 5
  })
})

// ============================================================
// 6. FOLLOWERS → COMBAT
// ============================================================

describe('Follower Combat Profiles', () => {
  it('warrior has high HP and AC', () => {
    const profile = generateFollowerCombatProfile('f1', 'Sir Reginald', 'warrior', 5, 10)
    expect(profile.hp).toBeGreaterThan(30)
    expect(profile.ac).toBeGreaterThanOrEqual(17)
    expect(profile.specialAbilities).toContain('shield_wall')
  })

  it('mage has high damage but low HP', () => {
    const profile = generateFollowerCombatProfile('f2', 'Elara', 'mage', 5, 10)
    expect(profile.damagePerHit).toBeGreaterThan(12)
    expect(profile.hp).toBeLessThan(profile.damagePerHit * 3)
    expect(profile.specialAbilities).toContain('spell_attack')
  })

  it('scout has highest initiative', () => {
    const scout = generateFollowerCombatProfile('f3', 'Pip', 'scout', 5, 10)
    const warrior = generateFollowerCombatProfile('f4', 'Grunt', 'warrior', 5, 10)
    expect(scout.initiative).toBeGreaterThan(warrior.initiative)
  })

  it('level increases all stats', () => {
    const low = generateFollowerCombatProfile('f5', 'Newbie', 'warrior', 1, 10)
    const high = generateFollowerCombatProfile('f6', 'Veteran', 'warrior', 10, 10)
    expect(high.hp).toBeGreaterThan(low.hp)
    expect(high.attackBonus).toBeGreaterThan(low.attackBonus)
    expect(high.damagePerHit).toBeGreaterThan(low.damagePerHit)
  })

  it('hireling has no special abilities', () => {
    const profile = generateFollowerCombatProfile('f7', 'Bob', 'hireling', 1, 10)
    expect(profile.specialAbilities).toHaveLength(0)
  })
})

// ============================================================
// 7. MONSTER HUNT — Camp → Wild Fauna (Δ.0.5 wire)
// ============================================================

function freshActor(over: Partial<MonsterActorState> = {}): MonsterActorState {
  resetMonsterActorIdCounter()
  const a = createMonsterActor('goblin', 2, 'forest-region-1', 30, 0)
  return Object.assign(a, over)
}

function freshWildHerd(speciesId: string, over: Partial<WildHerd> = {}): WildHerd {
  const sp = getSpecies(speciesId)
  return {
    id: `forest-region-1:${speciesId}`,
    speciesId,
    currentNodeId: 'forest-region-1',
    destinationNodeId: null,
    edgeId: null,
    edgeMile: 0,
    edgeTotalMiles: 0,
    population: sp.baseHerdSize,
    daysHungry: 0,
    foodSecurity: 1.0,
    formation: 'spread',
    status: 'grazing',
    bornDay: 0,
    lastTransitionDay: 0,
    ...over,
  }
}

describe('Monster Hunt → Wild Fauna', () => {
  it('no herds → no kills, no boost', () => {
    const result = applyMonsterHunt({
      actor: freshActor(),
      herds: [],
      worldDay: 1,
    })
    expect(result.totalKilled).toBe(0)
    expect(result.foodSecurityBoost).toBe(0)
    expect(result.herdsAfter).toEqual([])
  })

  it('camp with herds → real kills + foodSecurityBoost', () => {
    const result = applyMonsterHunt({
      actor: freshActor({ troops: 30, leaderCR: 4 }),
      herds: [freshWildHerd('rabbit'), freshWildHerd('deer')],
      worldDay: 1,
    })
    expect(result.totalKilled).toBeGreaterThan(0)
    expect(result.foodSecurityBoost).toBeGreaterThan(0)
    expect(result.foodSecurityBoost).toBeLessThanOrEqual(0.2)
    expect(result.herdsAfter.length).toBe(2)
    // Each herd's population should be ≤ original
    expect(result.herdsAfter[0].population).toBeLessThanOrEqual(getSpecies('rabbit').baseHerdSize)
  })

  it('higher pressure with bigger camp → more kills', () => {
    const small = applyMonsterHunt({
      actor: freshActor({ troops: 5, leaderCR: 1 }),
      herds: [freshWildHerd('rabbit')],
      worldDay: 1,
    })
    const big = applyMonsterHunt({
      actor: freshActor({ troops: 50, leaderCR: 5 }),
      herds: [freshWildHerd('rabbit')],
      worldDay: 1,
    })
    expect(big.pressure).toBeGreaterThan(small.pressure)
    expect(big.totalKilled).toBeGreaterThanOrEqual(small.totalKilled)
  })

  it('foodSecurityBoost is capped at 0.2', () => {
    // Throw a ton of herds at it to drive kills very high
    const herds: WildHerd[] = []
    for (let i = 0; i < 20; i++) {
      herds.push(freshWildHerd('rabbit', { id: `forest-region-1:rabbit-${i}`, population: 100 }))
    }
    const result = applyMonsterHunt({
      actor: freshActor({ troops: 100, leaderCR: 10 }),
      herds,
      worldDay: 1,
    })
    expect(result.foodSecurityBoost).toBeLessThanOrEqual(0.2)
  })

  it('zero troops → zero pressure → zero kills', () => {
    const result = applyMonsterHunt({
      actor: freshActor({ troops: 0, leaderCR: 0 }),
      herds: [freshWildHerd('rabbit')],
      worldDay: 1,
    })
    expect(result.pressure).toBe(0)
    expect(result.totalKilled).toBe(0)
    expect(result.foodSecurityBoost).toBe(0)
  })
})
