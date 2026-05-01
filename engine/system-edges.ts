/**
 * SYSTEM EDGES — Cross-system integration wires
 * =================================================
 *
 * These are the MISSING EDGES identified in the architecture review.
 * Each function connects two systems that should talk to each other
 * but don't have direct wiring yet.
 *
 * This file is the bridge. Every function here takes state from
 * system A and produces effects for system B.
 *
 * EDGES WIRED:
 *   1. Ecology → Husbandry:        Monster predation on settlement livestock
 *   2. Social → Faction:            Contract events → loyalty shifts
 *   3. Knowledge → Magic:           Seeds lower lore gate DCs
 *   4. Guild Intel → Faction:       Discoveries feed faction decisions
 *   5. Dungeon → Knowledge Pool:    Loot produces knowledge seeds
 *   6. Followers → Combat:          Follower NPCs in combat scenes
 *   7. Monster → Wild Fauna:        Camp hunt action consumes nearby wild herds
 *                                   via mfHerdPredation (Δ.0.5 wiring)
 */

import { mfHerdPredation } from './mf-herd-life.js'
import { type WildHerd, getSpecies } from './wild-fauna.js'
import type { MonsterActorState } from './monster-actor.js'

// ============================================================
// 1. ECOLOGY → HUSBANDRY: Monster Predation
// ============================================================

/**
 * When a monster actor's danger radius reaches a settlement,
 * it attacks the herd system. Wolf packs kill livestock.
 *
 * @param monsterCR       - Combined CR of the predating group
 * @param monsterType     - Species type (wolf, dragon, goblin)
 * @param herdSize        - Total head count of the targeted herd
 * @param settlementGuards - Number of guards/militia at hub
 * @param d20Roll         - Predation roll
 * @returns Livestock killed and events generated
 */
export interface PredationResult {
  livestockKilled: number
  herdFoodLost: number       // lbs of food lost to kills
  guardCasualties: number
  eventType: 'minor_raid' | 'major_raid' | 'devastating_attack' | 'repelled'
  description: string
}

export function resolvePredation(
  monsterCR: number,
  monsterType: string,
  herdSize: number,
  settlementGuards: number,
  d20Roll: number,
): PredationResult {
  // Guards defend: each guard adds +1 to defense
  const defenseDC = 10 + settlementGuards
  const attackRoll = d20Roll + monsterCR

  if (attackRoll < defenseDC) {
    return {
      livestockKilled: 0,
      herdFoodLost: 0,
      guardCasualties: monsterCR > defenseDC - 3 ? 1 : 0, // Close call
      eventType: 'repelled',
      description: `${monsterType} pack repelled by settlement guards.`,
    }
  }

  const margin = attackRoll - defenseDC
  // Kill percentage scales with margin: 5-30% of herd
  const killPercent = Math.min(0.3, 0.05 + margin * 0.02)
  const killed = Math.max(1, Math.floor(herdSize * killPercent))
  const foodLost = killed * 200 // ~200 lbs per animal average

  let eventType: PredationResult['eventType']
  if (killPercent >= 0.2) eventType = 'devastating_attack'
  else if (killPercent >= 0.1) eventType = 'major_raid'
  else eventType = 'minor_raid'

  const guardLosses = margin > 10 ? Math.floor(margin / 5) : margin > 5 ? 1 : 0

  return {
    livestockKilled: killed,
    herdFoodLost: foodLost,
    guardCasualties: guardLosses,
    eventType,
    description: `${monsterType} ${eventType.replace(/_/g, ' ')}: ${killed} livestock killed, ${guardLosses} guards lost.`,
  }
}

// ============================================================
// 2. SOCIAL → FACTION: Contract Events → Loyalty
// ============================================================

export type ContractFactionEffect =
  | 'loyalty_boost'       // Alliance, marriage across factions
  | 'loyalty_drop'        // Broken contract, breached vassalage
  | 'territory_transfer'  // Title changes hands, domain shifts
  | 'alliance_formed'     // Marriage or treaty creates alliance
  | 'war_declared'        // Broken oath triggers hostility

export interface ContractFactionImpact {
  factionId: string
  effect: ContractFactionEffect
  loyaltyChange: number     // -100 to +100
  description: string
}

/**
 * When a social contract event happens, compute faction impacts.
 *
 * @param contractType - Type of social contract (marriage, vassalage, etc.)
 * @param eventType    - What happened (created, breached, terminated)
 * @param party1Faction - Faction of first party (if any)
 * @param party2Faction - Faction of second party (if any)
 */
export function computeContractFactionImpact(
  contractType: string,
  eventType: 'created' | 'breached' | 'terminated' | 'fulfilled',
  party1Faction: string | null,
  party2Faction: string | null,
): ContractFactionImpact[] {
  const impacts: ContractFactionImpact[] = []

  if (!party1Faction && !party2Faction) return impacts
  if (party1Faction === party2Faction) return impacts // Same faction, internal

  // Cross-faction marriage
  if (contractType === 'marriage' && eventType === 'created') {
    if (party1Faction) impacts.push({
      factionId: party1Faction,
      effect: 'alliance_formed',
      loyaltyChange: 15,
      description: `Marriage alliance with ${party2Faction || 'independent'}`,
    })
    if (party2Faction) impacts.push({
      factionId: party2Faction,
      effect: 'alliance_formed',
      loyaltyChange: 15,
      description: `Marriage alliance with ${party1Faction || 'independent'}`,
    })
  }

  // Vassalage broken
  if (contractType === 'vassalage' && eventType === 'breached') {
    if (party1Faction) impacts.push({
      factionId: party1Faction,
      effect: 'loyalty_drop',
      loyaltyChange: -30,
      description: 'Vassalage oath broken — trust shattered',
    })
    if (party2Faction) impacts.push({
      factionId: party2Faction,
      effect: 'war_declared',
      loyaltyChange: -50,
      description: 'Vassal rebellion — grounds for war',
    })
  }

  // Alliance terminated
  if (contractType === 'alliance' && eventType === 'terminated') {
    if (party1Faction) impacts.push({
      factionId: party1Faction,
      effect: 'loyalty_drop',
      loyaltyChange: -20,
      description: 'Alliance dissolved',
    })
    if (party2Faction) impacts.push({
      factionId: party2Faction,
      effect: 'loyalty_drop',
      loyaltyChange: -20,
      description: 'Alliance dissolved',
    })
  }

  // Trade partnership created
  if (contractType === 'trade_partnership' && eventType === 'created') {
    if (party1Faction) impacts.push({
      factionId: party1Faction,
      effect: 'loyalty_boost',
      loyaltyChange: 10,
      description: `Trade partnership with ${party2Faction || 'independent'}`,
    })
    if (party2Faction) impacts.push({
      factionId: party2Faction,
      effect: 'loyalty_boost',
      loyaltyChange: 10,
      description: `Trade partnership with ${party1Faction || 'independent'}`,
    })
  }

  // Fulfilled contract
  if (eventType === 'fulfilled') {
    if (party1Faction) impacts.push({
      factionId: party1Faction,
      effect: 'loyalty_boost',
      loyaltyChange: 5,
      description: 'Contract fulfilled — trust reinforced',
    })
    if (party2Faction) impacts.push({
      factionId: party2Faction,
      effect: 'loyalty_boost',
      loyaltyChange: 5,
      description: 'Contract fulfilled — trust reinforced',
    })
  }

  return impacts
}

// ============================================================
// 3. KNOWLEDGE POOL → MAGIC: Seeds Lower Lore Gates
// ============================================================

/**
 * Knowledge seeds at a hub can lower effective magic difficulty.
 * A hub with "arcane_metallurgy" seed makes enchantment easier.
 *
 * Returns a lore gate DC modifier (negative = easier casting).
 */

/** Seeds that affect magic difficulty */
const MAGIC_SEEDS: Record<string, { dcReduction: number; schools: string[] }> = {
  arcane_metallurgy:    { dcReduction: 2, schools: ['transmutation', 'enchantment'] },
  ley_line_studies:     { dcReduction: 3, schools: ['evocation', 'abjuration'] },
  planar_theory:        { dcReduction: 2, schools: ['conjuration', 'divination'] },
  necromantic_texts:    { dcReduction: 2, schools: ['necromancy'] },
  illusion_mastery:     { dcReduction: 2, schools: ['illusion'] },
  wild_magic_research:  { dcReduction: 1, schools: ['*'] }, // All schools
  thaumaturgic_primer:  { dcReduction: 1, schools: ['*'] }, // All schools
  divine_scripture:     { dcReduction: 2, schools: ['abjuration', 'divination'] },
  herbalism_advanced:   { dcReduction: 1, schools: ['transmutation'] },
  runic_inscription:    { dcReduction: 2, schools: ['enchantment', 'abjuration'] },
}

export function calculateKnowledgeMagicModifier(
  activeSeeds: string[],
  school?: string,
): { dcModifier: number; contributingSeeds: string[] } {
  let totalReduction = 0
  const contributing: string[] = []

  for (const seed of activeSeeds) {
    const magicSeed = MAGIC_SEEDS[seed]
    if (!magicSeed) continue

    // Check if this seed affects the requested school
    if (magicSeed.schools.includes('*') || !school || magicSeed.schools.includes(school)) {
      totalReduction += magicSeed.dcReduction
      contributing.push(seed)
    }
  }

  // Cap at -5 DC (don't trivialize magic)
  return {
    dcModifier: totalReduction === 0 ? 0 : Math.max(-5, -totalReduction),
    contributingSeeds: contributing,
  }
}

// ============================================================
// 4. GUILD INTEL → FACTION: Discoveries Feed Decisions
// ============================================================

export type IntelType = 'resource_discovery' | 'monster_lair' | 'route_danger' | 'faction_movement' | 'trade_opportunity'

export interface IntelReport {
  type: IntelType
  sourceGuildId: string
  nodeId: string          // .tp node where discovered
  detail: string
  value: number           // Estimated economic/strategic value (0-100)
  timestamp: number       // World day
}

export interface FactionReaction {
  factionId: string
  action: 'claim' | 'contest' | 'negotiate' | 'monitor' | 'ignore'
  priority: number        // 1-10
  reasoning: string
}

/**
 * When guild intel reveals something, compute how nearby factions would react.
 *
 * @param intel - The discovery/intelligence report
 * @param factions - Array of {id, strengthPercent, goalType} for nearby factions
 */
export function computeFactionReaction(
  intel: IntelReport,
  factions: Array<{ id: string; strength: number; goal: string; distanceNodes: number }>,
): FactionReaction[] {
  return factions.map(faction => {
    // Proximity discount: farther factions care less
    const proximityWeight = Math.max(0.1, 1 - faction.distanceNodes * 0.2)
    const adjustedValue = intel.value * proximityWeight

    // Faction goal alignment
    let goalBonus = 0
    if (intel.type === 'resource_discovery' && (faction.goal === 'expand' || faction.goal === 'trade')) goalBonus = 20
    if (intel.type === 'monster_lair' && faction.goal === 'eliminate') goalBonus = 30
    if (intel.type === 'trade_opportunity' && faction.goal === 'trade') goalBonus = 25
    if (intel.type === 'faction_movement' && faction.goal === 'eliminate') goalBonus = 20

    const interestScore = adjustedValue + goalBonus

    // Decide action based on strength and interest
    let action: FactionReaction['action']
    if (interestScore < 20) action = 'ignore'
    else if (interestScore < 40) action = 'monitor'
    else if (faction.strength > 60) action = 'claim'
    else if (faction.strength > 30) action = 'contest'
    else action = 'negotiate'

    return {
      factionId: faction.id,
      action,
      priority: Math.min(10, Math.ceil(interestScore / 10)),
      reasoning: `${intel.type} at node ${intel.nodeId}: value=${Math.round(adjustedValue)}, goal_alignment=${goalBonus > 0 ? 'yes' : 'no'}`,
    }
  })
}

// ============================================================
// 5. DUNGEON → KNOWLEDGE POOL: Loot Produces Seeds
// ============================================================

/**
 * When a dungeon is cleared, certain loot can produce knowledge seeds
 * for the nearest hub's knowledge pool. This is THE CIVILIZATION FLYWHEEL.
 *
 * Adventurers explore → find knowledge → hub levels up → unlocks infra →
 * attracts NPCs → economy grows → funds more adventuring
 */

export interface DungeonKnowledgeYield {
  seeds: string[]
  potentialPoints: number
  description: string
}

/** Map dungeon room types / loot categories to potential knowledge seeds */
const LOOT_SEED_MAP: Record<string, { seeds: string[]; potentialPerRoom: number }> = {
  ancient_forge:     { seeds: ['dwarven_metallurgy', 'arcane_metallurgy'],  potentialPerRoom: 5 },
  library:           { seeds: ['thaumaturgic_primer', 'planar_theory'],    potentialPerRoom: 8 },
  alchemist_lab:     { seeds: ['herbalism_advanced', 'potioncraft'],       potentialPerRoom: 6 },
  temple_ruins:      { seeds: ['divine_scripture', 'restoration_arts'],    potentialPerRoom: 5 },
  arcane_workshop:   { seeds: ['runic_inscription', 'enchanting'],         potentialPerRoom: 7 },
  monster_study:     { seeds: ['beast_mastery', 'monster_anatomy'],        potentialPerRoom: 4 },
  treasure_vault:    { seeds: [],                                           potentialPerRoom: 3 },
  throne_room:       { seeds: ['governance', 'heraldry'],                  potentialPerRoom: 4 },
  necromancer_lair:  { seeds: ['necromantic_texts'],                        potentialPerRoom: 6 },
  druid_grove:       { seeds: ['herbalism_advanced', 'wild_magic_research'], potentialPerRoom: 5 },
  observatory:       { seeds: ['ley_line_studies', 'planar_theory'],       potentialPerRoom: 7 },
  barracks:          { seeds: ['martial_training', 'siege_engineering'],   potentialPerRoom: 3 },
}

export function calculateDungeonKnowledgeYield(
  clearedRoomTypes: string[],
  dungeonTier: number,
  existingSeeds: string[],
): DungeonKnowledgeYield {
  const newSeeds = new Set<string>()
  let totalPotential = 0

  for (const roomType of clearedRoomTypes) {
    const mapping = LOOT_SEED_MAP[roomType]
    if (!mapping) continue

    totalPotential += mapping.potentialPerRoom * dungeonTier

    for (const seed of mapping.seeds) {
      if (!existingSeeds.includes(seed)) {
        newSeeds.add(seed)
      }
    }
  }

  const seedsArray = Array.from(newSeeds)

  return {
    seeds: seedsArray,
    potentialPoints: totalPotential,
    description: seedsArray.length > 0
      ? `Recovered knowledge: ${seedsArray.join(', ')}. +${totalPotential} potential points.`
      : `+${totalPotential} potential points from dungeon exploration.`,
  }
}

// ============================================================
// 6. FOLLOWERS → COMBAT: Follower Stats for Scene Integration
// ============================================================

export interface FollowerCombatProfile {
  followerId: string
  name: string
  hp: number
  ac: number
  attackBonus: number
  damagePerHit: number
  initiative: number       // Modifier
  specialAbilities: string[]
}

/**
 * Generate combat profiles for followers based on their type and level.
 * These feed into MM_scene initiative and attack resolution.
 */
export function generateFollowerCombatProfile(
  followerId: string,
  name: string,
  followerType: string,
  level: number,
  d20Roll: number = Math.floor(Math.random() * 20) + 1,
): FollowerCombatProfile {
  // Base stats by type
  const typeStats: Record<string, { baseHP: number; baseAC: number; atk: number; dmg: number; init: number; abilities: string[] }> = {
    warrior:    { baseHP: 12, baseAC: 16, atk: 4,  dmg: 8,  init: 1, abilities: ['shield_wall', 'opportunity_attack'] },
    archer:     { baseHP: 8,  baseAC: 14, atk: 5,  dmg: 6,  init: 3, abilities: ['volley', 'covering_fire'] },
    healer:     { baseHP: 8,  baseAC: 12, atk: 2,  dmg: 4,  init: 0, abilities: ['heal_ally', 'bless'] },
    scout:      { baseHP: 8,  baseAC: 14, atk: 4,  dmg: 5,  init: 4, abilities: ['sneak_attack', 'evasion'] },
    mage:       { baseHP: 6,  baseAC: 12, atk: 3,  dmg: 10, init: 1, abilities: ['spell_attack', 'shield'] },
    beast:      { baseHP: 10, baseAC: 13, atk: 4,  dmg: 6,  init: 2, abilities: ['pack_tactics', 'keen_senses'] },
    hireling:   { baseHP: 6,  baseAC: 11, atk: 2,  dmg: 4,  init: 0, abilities: [] },
    squire:     { baseHP: 8,  baseAC: 14, atk: 3,  dmg: 5,  init: 1, abilities: ['aid_action'] },
  }

  const stats = typeStats[followerType] || typeStats.hireling

  return {
    followerId,
    name,
    hp: stats.baseHP + level * 5 + (d20Roll > 15 ? 3 : 0),
    ac: stats.baseAC + Math.floor(level / 3),
    attackBonus: stats.atk + Math.floor(level / 2),
    damagePerHit: stats.dmg + level,
    initiative: stats.init + Math.floor(level / 4),
    specialAbilities: stats.abilities,
  }
}

// ============================================================
// 7. MONSTER → WILD FAUNA: Camp Hunt → Real Predation (Δ.0.5 wire)
// ============================================================

/**
 * Replaces the abstract `+0.1 foodSecurity` placeholder for a monster camp's
 * `hunt` action with real predation against nearby wild herds. Per-herd
 * predation is folded via `mfHerdPredation` with a single-day pressure window
 * scaled by camp size + leader CR.
 *
 * The result.foodSecurityBoost STACKS on top of the placeholder bump in
 * `applyAdvancementEffects` (engine/monster-actor.ts) — past-Claude's hunt
 * baseline becomes "minimum food bump even if no herds nearby"; real kills
 * give more on top. Caller (mm-monster-actor.onResolve) writes the updated
 * herds back to κ.ecology.herds.
 */
export interface MonsterHuntInput {
  actor: MonsterActorState
  /** Wild herds nearby — typically read from κ.ecology.herds at the camp's region. */
  herds: WildHerd[]
  worldDay: number
}

export interface MonsterHuntResult {
  herdsAfter: WildHerd[]
  totalKilled: number
  /** Predator pressure used for mfHerdPredation, 0..1. Useful for narrative. */
  pressure: number
  /** Additional foodSecurity bump from real kills, capped at +0.2. Stacks with the placeholder. */
  foodSecurityBoost: number
}

export function applyMonsterHunt(input: MonsterHuntInput): MonsterHuntResult {
  const { actor, herds, worldDay } = input
  // Predator pressure 0..1 — saturates around 50 troops + CR 5.
  const troopFactor = Math.min(1, actor.troops / 50)
  const crFactor = Math.min(1, actor.leaderCR / 5)
  const pressure = Math.max(0, Math.min(1, troopFactor * 0.7 + crFactor * 0.3))

  if (herds.length === 0 || pressure <= 0) {
    return { herdsAfter: [], totalKilled: 0, pressure, foodSecurityBoost: 0 }
  }

  let totalKilled = 0
  const herdsAfter: WildHerd[] = []
  for (const herd of herds) {
    const species = getSpecies(herd.speciesId)
    const result = mfHerdPredation(herd, species, {
      pressure,
      days: 1,
      worldDay,
    })
    totalKilled += result.output.predated
    herdsAfter.push(result.output.herdAfter)
  }

  // Each kill ≈ +0.01 food security, capped at +0.2 per hunt action.
  const foodSecurityBoost = Math.min(0.2, totalKilled * 0.01)

  return { herdsAfter, totalKilled, pressure, foodSecurityBoost }
}
