/**
 * MONSTER ACTOR — Intelligent Monster Leadership
 * =================================================
 * 
 * An intelligent monster (goblin chief, orc warlord, lich) is an ACTOR
 * with a single monthly action type: EXPANSION.
 * 
 * Monthly tick:
 *   1. Leader rolls d20 + CR modifier for "advancement"
 *   2. Result determines camp state (growth, stagnation, vulnerability)
 *   3. Bad rolls → vulnerable to LEADERSHIP CHALLENGES
 *   4. Challengers fight incumbent (d20 + CR + tenure)
 *   5. Loser dies or MIGRATES to seed a new lair
 * 
 * This creates an organic spread of lairs across the world:
 *   Gate spawns → leader emerges → bad month → challenged
 *   → loser walks away → seeds new lair on random edge
 *   → new gate activates → cycle continues
 */

import { z } from 'zod'
import {
  type Adaptation,
  type AdaptationPool,
  adaptationCountForGate,
  selectAdaptations,
  combineModifiers,
  evolvePool,
} from './adaptation'
import { deriveBaseCR } from './biome-fauna'

// ============================================================
// EXPANSION ACTION — What the leader does each month
// ============================================================

export const ExpansionActionSchema = z.enum([
  'raid_settlement',    // Attack nearest hub for food/gold
  'expand_territory',   // Claim adjacent edge segment
  'fortify_camp',       // Increase defenses
  'recruit',            // Boost population from spawner
  'hunt',               // Predation phase for food security
  'migrate',            // Move camp to better location
])
export type ExpansionAction = z.infer<typeof ExpansionActionSchema>

// ============================================================
// ADVANCEMENT GRADE — Monthly roll outcome
// ============================================================

export const AdvancementGradeSchema = z.enum([
  'backfire',    // ≤5:  Leader weakened, vulnerable to challenges
  'failure',     // 6-10: Stagnation
  'partial',     // 11-15: Modest growth
  'success',     // 16-20: Expansion
  'great',       // 21-25: Major growth
  'critical',    // 26+: Boss evolution
])
export type AdvancementGrade = z.infer<typeof AdvancementGradeSchema>

// ============================================================
// CHALLENGE OUTCOME
// ============================================================

export const ChallengeOutcomeSchema = z.enum([
  'incumbent_wins',    // Current leader keeps control
  'challenger_wins',   // Challenger takes over
  'challenger_flees',  // Challenger backs down before fight
])
export type ChallengeOutcome = z.infer<typeof ChallengeOutcomeSchema>

// ============================================================
// MONSTER ACTOR STATE
// ============================================================

export interface MonsterActorState {
  id: string
  // Leader identity
  leaderId: string
  leaderName: string
  leaderCR: number
  speciesId: string
  
  // Camp location
  campNodeId: string         // POI ID, edge site ID, or hub node ID
  campEdgeId?: string        // If on an edge
  campMileMarker?: number    // If on an edge
  
  // Population
  population: number
  carryingCapacity: number
  
  // Monthly state
  lastAdvancementGrade: AdvancementGrade
  lastAction: ExpansionAction
  monthsEstablished: number
  tenure: number              // +1/month for incumbent, bonus to defense
  
  // Spawner link
  gateId?: string             // Linked dungeon gate
  
  // Territory
  claimedEdgeSegments: string[] // Edge segment IDs this camp patrols
  dangerRadius: number          // Miles of influence
  
  // Resources
  foodSecurity: number         // 0-1
  gold: number                 // Looted
  troops: number               // Combat-ready members (subset of population)
  
  // History
  challengesSurvived: number
  raidsConducted: number
  settlementsRaided: string[]
  
  // Director — populated by adaptation.ts evolutionary pressure system
  adaptations: Adaptation[]
}

// ============================================================
// FACTORY
// ============================================================

let _monsterActorId = 0
export function resetMonsterActorIdCounter(): void { _monsterActorId = 0 }

export function createMonsterActor(
  speciesId: string,
  leaderCR: number,
  campNodeId: string,
  population: number,
  worldDay: number,
  options: {
    gateId?: string
    campEdgeId?: string
    campMileMarker?: number
  } = {},
): MonsterActorState {
  const id = `monster_actor_${++_monsterActorId}`
  return {
    id,
    leaderId: `leader_${id}`,
    leaderName: `${speciesId} chieftain`,
    leaderCR,
    speciesId,
    campNodeId,
    campEdgeId: options.campEdgeId,
    campMileMarker: options.campMileMarker,
    population,
    carryingCapacity: population * 3,
    lastAdvancementGrade: 'partial',
    lastAction: 'fortify_camp',
    monthsEstablished: 0,
    tenure: 0,
    gateId: options.gateId,
    claimedEdgeSegments: [],
    dangerRadius: Math.max(1, Math.floor(leaderCR)),
    foodSecurity: 0.7,
    gold: 0,
    troops: Math.floor(population * 0.5),
    challengesSurvived: 0,
    raidsConducted: 0,
    settlementsRaided: [],
    adaptations: [],
  }
}

// ============================================================
// MONTHLY ADVANCEMENT — The main tick
// ============================================================

export interface AdvancementResult {
  grade: AdvancementGrade
  action: ExpansionAction
  populationChange: number
  goldChange: number
  foodSecurityChange: number
  dangerRadiusChange: number
  vulnerable: boolean        // Can be challenged this month
  narrative: string
}

/**
 * Roll monthly advancement for a monster actor.
 * d20 + CR mod determines outcome grade.
 * Action is selected based on camp state.
 */
export function tickMonsterAdvancement(
  actor: MonsterActorState,
  d20: number,
  actionD20: number,
): AdvancementResult {
  // Select action based on camp needs
  const action = selectAction(actor, actionD20)
  
  // Roll: d20 + floor(CR / 2) + tenure bonus (capped at +3)
  const crMod = Math.floor(actor.leaderCR / 2)
  const tenureBonus = Math.min(3, Math.floor(actor.tenure / 3))
  const total = d20 + crMod + tenureBonus
  
  // Grade
  const grade = gradeFromTotal(total)
  
  // Apply effects
  const result = applyAdvancementEffects(actor, grade, action, d20)
  
  // Update actor state
  actor.lastAdvancementGrade = grade
  actor.lastAction = action
  actor.monthsEstablished++
  actor.tenure++
  
  return result
}

function selectAction(actor: MonsterActorState, d20: number): ExpansionAction {
  // Priority: survival first, then growth
  if (actor.foodSecurity < 0.3) return 'hunt'
  if (actor.foodSecurity < 0.5 && d20 <= 10) return 'raid_settlement'
  if (actor.population > actor.carryingCapacity * 0.9) return 'migrate'
  if (actor.population < actor.carryingCapacity * 0.3) return 'recruit'
  if (d20 <= 5) return 'fortify_camp'
  if (d20 <= 12) return 'expand_territory'
  return 'raid_settlement'
}

function gradeFromTotal(total: number): AdvancementGrade {
  if (total <= 5) return 'backfire'
  if (total <= 10) return 'failure'
  if (total <= 15) return 'partial'
  if (total <= 20) return 'success'
  if (total <= 25) return 'great'
  return 'critical'
}

function applyAdvancementEffects(
  actor: MonsterActorState,
  grade: AdvancementGrade,
  action: ExpansionAction,
  d20: number,
): AdvancementResult {
  let popChange = 0
  let goldChange = 0
  let foodChange = 0
  let dangerChange = 0
  let vulnerable = false
  let narrative = ''

  switch (grade) {
    case 'backfire':
      popChange = -Math.floor(actor.population * 0.1)
      foodChange = -0.15
      vulnerable = true
      narrative = `${actor.leaderName} suffers a disaster — population scattered, leader weakened.`
      break
    case 'failure':
      foodChange = -0.05
      narrative = `${actor.leaderName}'s camp stagnates. No growth this month.`
      break
    case 'partial':
      popChange = Math.floor(d20 / 10) + 1 // +1-2
      foodChange = 0.05
      narrative = `${actor.leaderName} achieves modest ${action}: +${popChange} population.`
      break
    case 'success':
      popChange = Math.floor(d20 / 5) + 2 // +3-6
      goldChange = d20 * 5
      foodChange = 0.10
      dangerChange = 1
      narrative = `${actor.leaderName} expands aggressively via ${action}. Danger zone grows.`
      break
    case 'great':
      popChange = Math.floor(actor.population * 0.2)
      goldChange = d20 * 10
      foodChange = 0.15
      dangerChange = 2
      narrative = `${actor.leaderName} has a great month — major ${action}. Territory expands.`
      break
    case 'critical':
      popChange = Math.floor(actor.population * 0.3)
      goldChange = d20 * 20
      foodChange = 0.20
      dangerChange = 3
      narrative = `${actor.leaderName} achieves a critical ${action}! Boss-level evolution possible.`
      break
  }

  // Apply action-specific modifiers
  if (action === 'raid_settlement') {
    goldChange += grade === 'backfire' ? -50 : grade === 'failure' ? 0 : 50 * (d20 / 5)
    actor.raidsConducted++
  }
  if (action === 'hunt') foodChange += 0.1
  if (action === 'recruit' && grade !== 'backfire') popChange += 2
  if (action === 'fortify_camp') dangerChange = 0 // no expansion

  // Clamp and apply
  actor.population = Math.max(0, actor.population + popChange)
  actor.gold = Math.max(0, actor.gold + goldChange)
  actor.foodSecurity = Math.max(0, Math.min(1, actor.foodSecurity + foodChange))
  actor.dangerRadius = Math.max(1, actor.dangerRadius + dangerChange)
  actor.troops = Math.floor(actor.population * 0.5)

  return {
    grade,
    action,
    populationChange: popChange,
    goldChange,
    foodSecurityChange: foodChange,
    dangerRadiusChange: dangerChange,
    vulnerable,
    narrative,
  }
}

// ============================================================
// LEADERSHIP CHALLENGE
// ============================================================

export interface ChallengeResult {
  outcome: ChallengeOutcome
  challengerCR: number
  incumbentRoll: number
  challengerRoll: number
  loserAction: 'dies' | 'migrates'
  narrative: string
}

/**
 * Resolve a leadership challenge.
 * Both roll d20 + CR + tenure (incumbent only).
 * Loser either dies (d20 <= 10) or migrates to seed a new lair.
 */
export function resolveLeadershipChallenge(
  actor: MonsterActorState,
  challengerCR: number,
  incumbentD20: number,
  challengerD20: number,
  fateD20: number,
): ChallengeResult {
  // Challenger intimidation check: if way outmatched, flees
  if (actor.leaderCR > challengerCR * 2 && fateD20 <= 10) {
    return {
      outcome: 'challenger_flees',
      challengerCR,
      incumbentRoll: 0,
      challengerRoll: 0,
      loserAction: 'migrates',
      narrative: `Challenger (CR ${challengerCR}) takes one look at ${actor.leaderName} (CR ${actor.leaderCR}) and flees.`,
    }
  }

  // Combat: d20 + CR + tenure bonus (incumbent only)
  const tenureBonus = Math.min(3, Math.floor(actor.tenure / 3))
  const incumbentTotal = incumbentD20 + Math.floor(actor.leaderCR) + tenureBonus
  const challengerTotal = challengerD20 + Math.floor(challengerCR)

  const challengerWins = challengerTotal > incumbentTotal

  // Loser fate: d20 <= 10 = dies, > 10 = migrates
  const loserAction: 'dies' | 'migrates' = fateD20 <= 10 ? 'dies' : 'migrates'

  if (challengerWins) {
    // Challenger takes over
    const oldLeaderName = actor.leaderName
    actor.leaderCR = challengerCR
    actor.leaderName = `${actor.speciesId} warlord`
    actor.leaderId = `leader_challenger_${actor.id}_${actor.monthsEstablished}`
    actor.tenure = 0
    actor.challengesSurvived = 0

    return {
      outcome: 'challenger_wins',
      challengerCR,
      incumbentRoll: incumbentTotal,
      challengerRoll: challengerTotal,
      loserAction,
      narrative: `Challenger (${challengerTotal}) defeats ${oldLeaderName} (${incumbentTotal}). Old leader ${loserAction}. New warlord takes command.`,
    }
  }

  // Incumbent wins
  actor.challengesSurvived++

  return {
    outcome: 'incumbent_wins',
    challengerCR,
    incumbentRoll: incumbentTotal,
    challengerRoll: challengerTotal,
    loserAction,
    narrative: `${actor.leaderName} (${incumbentTotal}) defeats challenger (${challengerTotal}). Challenger ${loserAction}.`,
  }
}

// ============================================================
// SHOULD CHALLENGE — Determine if a challenge occurs this month
// ============================================================

/**
 * A challenge occurs when:
 * - Leader had a backfire grade last month (vulnerable)
 * - OR population is above carrying capacity (too many mouths, dissent)
 * - AND d20 roll meets threshold
 */
export function shouldChallenge(
  actor: MonsterActorState,
  d20: number,
): boolean {
  if (actor.lastAdvancementGrade === 'backfire') {
    return d20 >= 6 // 75% chance when vulnerable
  }
  if (actor.population > actor.carryingCapacity) {
    return d20 >= 14 // 35% chance when overcrowded
  }
  return d20 >= 18 // 15% base chance
}

// ============================================================
// GENERATE CHALLENGER CR
// ============================================================

/**
 * Challenger CR is based on the gate tier / species,
 * with some d20 variance.
 */
export function generateChallengerCR(
  leaderCR: number,
  d20: number,
): number {
  // Challenger is 0.5-1.5× leader CR, biased by d20
  const multiplier = 0.5 + (d20 / 20) // 0.55 to 1.5
  return Math.max(0.25, Math.round(leaderCR * multiplier * 4) / 4) // round to 0.25
}

// ============================================================
// ADAPTATIONS — Apply evolutionary modifiers to a monster actor
// ============================================================

/**
 * Apply combined adaptation modifiers to a monster actor's stats.
 *
 *   crBonus           → leaderCR (effective)
 *   troopMultiplier   → troops count
 *   dangerRadiusBonus → danger radius (miles)
 *
 * MUTATES the actor in place. Idempotent given the same adaptation list:
 * the actor remembers its baseCR via... well, it doesn't, so we pass the
 * base in. This is meant to be called once at creation, not repeatedly.
 */
export function applyAdaptationsToActor(
  actor: MonsterActorState,
  adaptations: Adaptation[],
  baseCR: number,
  baseTroops: number,
  baseDangerRadius: number,
): void {
  const mods = combineModifiers(adaptations)
  actor.adaptations = adaptations
  actor.leaderCR = baseCR + mods.crBonus
  actor.troops = Math.floor(baseTroops * mods.troopMultiplier)
  actor.dangerRadius = Math.max(1, baseDangerRadius + mods.dangerRadiusBonus)
}

// ============================================================
// CREATE FROM ECOLOGY — Substrate-aware factory
// ============================================================

/**
 * Inputs the ecology-aware factory needs from the surrounding system.
 * Decoupled from ecology-pool to avoid circular deps. The caller (e.g.
 * MMDungeonGate or a surface) wires these together.
 */
export interface MonsterActorFromEcologyInput {
  /** Where the camp is (POI / edge site / hub). */
  campNodeId: string
  /** Optional edge position if the camp is on a road segment. */
  campEdgeId?: string
  campMileMarker?: number
  /** Linked dungeon gate id, if any. */
  gateId?: string
  /** Tier of the parent gate (or equivalent encounter difficulty). */
  tier: number
  /** Generation of the gate (Solo Leveling respawn count). */
  generation: number
  /** Initial population. */
  population: number
  /** World day at creation. */
  worldDay: number
  /** Pre-rolled d20s — used for adaptation selection (≥ adaptationCountForGate). */
  d20s: number[]
  /** Species id chosen from the biome × gate-type ecology pool. */
  speciesId: string
  /** Latest adaptation pool for this species (read from κ). */
  pool: AdaptationPool
}

export interface MonsterActorFromEcologyResult {
  actor: MonsterActorState
  /** The pool AFTER evolve+draw. Caller should write this back to κ. */
  evolvedPool: AdaptationPool
  /** Adaptations drawn for this actor (already applied). */
  adaptations: Adaptation[]
}

/**
 * Build a monster actor whose species, CR, and adaptations come from
 * the biome+evolution substrate. Returns the actor PLUS the evolved
 * pool — caller is responsible for persisting the evolved pool to κ
 * via ecology-pool.writeAdaptationPool().
 *
 * Cycle ordering (matches the gen-N → gen-(N+1) handoff):
 *   1. evolvePool(input.pool) — applies last gen's fitness
 *   2. selectAdaptations from the evolved pool
 *   3. createMonsterActor with the chosen species + base CR
 *   4. applyAdaptationsToActor with modifiers
 */
export function createMonsterActorFromEcology(
  input: MonsterActorFromEcologyInput,
): MonsterActorFromEcologyResult {
  const baseCR = deriveBaseCR(input.speciesId, input.tier)
  const baseTroops = Math.floor(input.population * 0.5)
  const baseDangerRadius = Math.max(1, Math.floor(baseCR))

  // Evolve last generation's data → updated weights for this gen
  const evolvedPool = evolvePool(input.pool)

  const want = adaptationCountForGate(input.generation, input.tier)
  const adaptations = selectAdaptations(evolvedPool, want, input.d20s)

  const actor = createMonsterActor(
    input.speciesId,
    baseCR,
    input.campNodeId,
    input.population,
    input.worldDay,
    {
      gateId: input.gateId,
      campEdgeId: input.campEdgeId,
      campMileMarker: input.campMileMarker,
    },
  )

  applyAdaptationsToActor(actor, adaptations, baseCR, baseTroops, baseDangerRadius)

  return { actor, evolvedPool, adaptations }
}
