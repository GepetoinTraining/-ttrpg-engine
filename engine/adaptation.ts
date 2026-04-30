/**
 * ADAPTATION — Evolutionary Pressure for Monster Populations
 * ============================================================
 *
 * Per-species adaptation pools that evolve via gate-clear events.
 *
 * Each species has a pool of 10 mutation weights. When a gate respawns
 * or a monster-actor is created, draws are made from the weighted pool.
 * Outcomes (clears, casualties, gate caps) feed back as fitness data,
 * re-weighting the pool for the next generation.
 *
 * NOT a tick-driven MM. Pool state lives in κ.ecology.adaptations
 * (region-scope). Fitness reports fire on event (gate clear/respawn),
 * never on a heartbeat. Zero tick burden.
 *
 * THE 10 ADAPTATIONS:
 *   ARMORED  — damage resistance, stand ground
 *   SWIFT    — initiative + dash, dangerRadius +1
 *   PACK     — group cohesion, troops ×1.2, gang up
 *   REGEN    — self-heal, no flee
 *   STEALTH  — ambush bonus (DC +2), prefer flank
 *   REFLECT  — spell return (CR effective +0.75)
 *   DRAIN    — life-steal, prefer melee
 *   SPLIT    — minions on death, no flee
 *   ADAPT    — gains last party's worst element resistance
 *   CUNNING  — tactical AI (DC +1), prefer low-HP target
 */

import { z } from 'zod'

// ============================================================
// ADAPTATION TYPES
// ============================================================

export const AdaptationSchema = z.enum([
  'ARMORED',
  'SWIFT',
  'PACK',
  'REGEN',
  'STEALTH',
  'REFLECT',
  'DRAIN',
  'SPLIT',
  'ADAPT',
  'CUNNING',
])
export type Adaptation = z.infer<typeof AdaptationSchema>

export const ALL_ADAPTATIONS: Adaptation[] = [
  'ARMORED', 'SWIFT', 'PACK', 'REGEN', 'STEALTH',
  'REFLECT', 'DRAIN', 'SPLIT', 'ADAPT', 'CUNNING',
]

// ============================================================
// FITNESS — Per-adaptation effectiveness tracking
// ============================================================

export const FitnessStatsSchema = z.object({
  /** How many times this adaptation has been spawned */
  spawned: z.number().int().nonnegative().default(0),
  /** Clears that didn't permanently end the population (gate respawned) */
  survivedClears: z.number().int().nonnegative().default(0),
  /** Total casualties caused by populations carrying this adaptation */
  causedCasualties: z.number().int().nonnegative().default(0),
  /** Generation at which this adaptation was last present */
  lastSeenAtGen: z.number().int().nonnegative().default(0),
})
export type FitnessStats = z.infer<typeof FitnessStatsSchema>

export const EMPTY_FITNESS: FitnessStats = {
  spawned: 0,
  survivedClears: 0,
  causedCasualties: 0,
  lastSeenAtGen: 0,
}

// ============================================================
// ADAPTATION POOL — Per-species weighted pool
// ============================================================

export const AdaptationPoolSchema = z.object({
  speciesId: z.string(),
  weights: z.record(AdaptationSchema, z.number()),
  generation: z.number().int().nonnegative().default(0),
  fitness: z.record(AdaptationSchema, FitnessStatsSchema),
})
export type AdaptationPool = z.infer<typeof AdaptationPoolSchema>

/**
 * Create a fresh pool with all adaptations at weight 1.0.
 */
export function createAdaptationPool(speciesId: string): AdaptationPool {
  const weights = {} as Record<Adaptation, number>
  const fitness = {} as Record<Adaptation, FitnessStats>
  for (const a of ALL_ADAPTATIONS) {
    weights[a] = 1.0
    fitness[a] = { ...EMPTY_FITNESS }
  }
  return { speciesId, weights, generation: 0, fitness }
}

// ============================================================
// SELECT — Draw adaptations weighted by pool
// ============================================================

/**
 * Select N adaptations from the pool, weighted by current weights.
 * Deterministic given d20s (one per pick).
 *
 * Returns at most ALL_ADAPTATIONS.length items, with no duplicates.
 */
export function selectAdaptations(
  pool: AdaptationPool,
  count: number,
  d20s: number[],
): Adaptation[] {
  if (count <= 0) return []

  const selected: Adaptation[] = []
  const candidates = ALL_ADAPTATIONS.filter(a => (pool.weights[a] ?? 0) > 0)

  for (let i = 0; i < count; i++) {
    const remaining = candidates.filter(a => !selected.includes(a))
    if (remaining.length === 0) break

    const totalWeight = remaining.reduce((s, a) => s + (pool.weights[a] ?? 0), 0)
    if (totalWeight <= 0) break

    const d20 = d20s[i] ?? (((i * 7919 + selected.length * 13) % 20) + 1)
    let roll = (d20 / 20) * totalWeight

    let picked: Adaptation | null = null
    for (const adaptation of remaining) {
      roll -= pool.weights[adaptation] ?? 0
      if (roll <= 0) {
        picked = adaptation
        break
      }
    }
    // Fallback (floating-point edge): take last remaining
    if (!picked) picked = remaining[remaining.length - 1]
    selected.push(picked)
  }

  return selected
}

// ============================================================
// HOW MANY ADAPTATIONS PER GATE
// ============================================================

/**
 * How many adaptations a population should carry at a given gate
 * generation and tier. Caps at 3.
 *
 *   gen 0, tier 1 → 0   (fresh weak gate, no traits)
 *   gen 0, tier 5 → 1   (fresh epic gate, baseline trait)
 *   gen 5, tier 1 → 2   (well-evolved weak gate, two traits)
 *   gen 5, tier 5 → 3   (well-evolved epic gate, three traits)
 */
export function adaptationCountForGate(generation: number, tier: number): number {
  const fromGen = Math.min(2, Math.floor(generation / 2))   // 0,1→0; 2,3→1; 4+→2
  const fromTier = Math.max(0, tier - 4)                     // 1-4→0; 5→1
  return Math.min(3, fromGen + fromTier)
}

// ============================================================
// REPORT — Fitness updates from clear events
// ============================================================

export interface ClearReport {
  /** Adaptations the cleared population had */
  adaptations: Adaptation[]
  /** How many casualties that population caused before being cleared */
  casualties: number
  /** Was the gate permanently cleared (true) or just capped (false) */
  permanent: boolean
  /** Generation at which the clear happened */
  generation: number
}

/**
 * Report a gate clear event back to the pool.
 * Updates fitness for each adaptation that was present.
 *
 *   Permanent clear → no survivedClears increment (population didn't persist)
 *   Cap clear (respawn) → +1 survivedClears (trait passed through)
 *   Casualties always count toward kill score
 *
 * MUTATES the pool in place.
 */
export function reportClear(pool: AdaptationPool, report: ClearReport): void {
  for (const adaptation of report.adaptations) {
    const stats = pool.fitness[adaptation] ?? { ...EMPTY_FITNESS }
    stats.spawned++
    if (!report.permanent) stats.survivedClears++
    stats.causedCasualties += report.casualties
    stats.lastSeenAtGen = report.generation
    pool.fitness[adaptation] = stats
  }
}

// ============================================================
// EVOLVE — Re-weight pool from accumulated fitness
// ============================================================

/**
 * Compute fitness score from accumulated stats.
 * Higher = adaptation produces populations that survive and kill.
 *
 *   Base 0.5 (neutral floor)
 *   + survivalRate (0–1.0)            ← kept the population alive
 *   + min(1.0, killRate / 3)          ← caused casualties (3+ saturates)
 *
 * Returns a number in [0.1, 3.0] used as a weight multiplier.
 */
function computeFitnessScore(stats: FitnessStats): number {
  if (stats.spawned === 0) return 1.0  // No data → neutral

  const survivalRate = stats.survivedClears / stats.spawned
  const killRate = stats.causedCasualties / stats.spawned

  let fitness = 0.5
  fitness += survivalRate
  fitness += Math.min(1.0, killRate / 3)

  return Math.max(0.1, Math.min(3.0, fitness))
}

/**
 * Run an evolution cycle:
 *   - Compute fitness per adaptation from accumulated stats
 *   - Re-weight pool (damped multiplicative update, clamped [0.1, 5.0])
 *   - Increment generation
 *   - Reset fitness counters
 *
 * Returns a NEW pool (does not mutate input). Call this when a gate
 * respawns — the previous generation's fitness feeds the next.
 */
export function evolvePool(pool: AdaptationPool): AdaptationPool {
  const newWeights = {} as Record<Adaptation, number>
  const freshFitness = {} as Record<Adaptation, FitnessStats>

  for (const adaptation of ALL_ADAPTATIONS) {
    const oldWeight = pool.weights[adaptation] ?? 1.0
    const stats = pool.fitness[adaptation] ?? EMPTY_FITNESS
    const fitness = computeFitnessScore(stats)

    // Damped: w' = w × (0.5 + 0.5 × fitness). Clamped to [0.1, 5.0].
    const updated = oldWeight * (0.5 + 0.5 * fitness)
    newWeights[adaptation] = Math.max(0.1, Math.min(5.0, updated))
    freshFitness[adaptation] = { ...EMPTY_FITNESS, lastSeenAtGen: pool.generation + 1 }
  }

  return {
    speciesId: pool.speciesId,
    weights: newWeights,
    generation: pool.generation + 1,
    fitness: freshFitness,
  }
}

// ============================================================
// APPLY — Convert adaptation list to monster stat modifiers
// ============================================================

export interface AdaptationModifiers {
  /** CR-effective bonus — boost difficulty without changing leaderCR */
  crBonus: number
  /** Multiplier on troop count (PACK → more swarm) */
  troopMultiplier: number
  /** Bonus to attack/save DC */
  dcBonus: number
  /** Bonus to dangerRadius (miles of influence) */
  dangerRadiusBonus: number
  /** Spawns minions on death (SPLIT) */
  spawnsMinionsOnDeath: boolean
  /** Tags consumed by mob-ai for behavior modulation */
  behaviorTags: string[]
}

const ADAPTATION_MODIFIERS: Record<Adaptation, AdaptationModifiers> = {
  ARMORED: { crBonus: 0.5,  troopMultiplier: 1.0, dcBonus: 0, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['stand_ground'] },
  SWIFT:   { crBonus: 0.25, troopMultiplier: 1.0, dcBonus: 0, dangerRadiusBonus: 1, spawnsMinionsOnDeath: false, behaviorTags: ['dash', 'initiative_bonus'] },
  PACK:    { crBonus: 0.0,  troopMultiplier: 1.2, dcBonus: 0, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['gang_up', 'flank'] },
  REGEN:   { crBonus: 0.5,  troopMultiplier: 1.0, dcBonus: 0, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['stand_ground', 'no_flee'] },
  STEALTH: { crBonus: 0.0,  troopMultiplier: 1.0, dcBonus: 2, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['ambush', 'flank'] },
  REFLECT: { crBonus: 0.75, troopMultiplier: 1.0, dcBonus: 0, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['stand_ground'] },
  DRAIN:   { crBonus: 0.5,  troopMultiplier: 1.0, dcBonus: 0, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['prefer_melee'] },
  SPLIT:   { crBonus: 0.25, troopMultiplier: 1.0, dcBonus: 0, dangerRadiusBonus: 0, spawnsMinionsOnDeath: true,  behaviorTags: ['no_flee'] },
  ADAPT:   { crBonus: 0.5,  troopMultiplier: 1.0, dcBonus: 0, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['element_resist_last_party'] },
  CUNNING: { crBonus: 0.0,  troopMultiplier: 1.0, dcBonus: 1, dangerRadiusBonus: 0, spawnsMinionsOnDeath: false, behaviorTags: ['flank', 'tactical', 'prefer_low_hp_target'] },
}

/** Modifiers for a single adaptation. */
export function modifiersFor(adaptation: Adaptation): AdaptationModifiers {
  return ADAPTATION_MODIFIERS[adaptation]
}

/**
 * Sum modifiers across multiple adaptations.
 * troopMultiplier multiplies; everything else adds.
 * spawnsMinionsOnDeath OR-aggregates.
 * behaviorTags concatenate (no dedup — duplicates are meaningful weight).
 */
export function combineModifiers(adaptations: Adaptation[]): AdaptationModifiers {
  const result: AdaptationModifiers = {
    crBonus: 0,
    troopMultiplier: 1.0,
    dcBonus: 0,
    dangerRadiusBonus: 0,
    spawnsMinionsOnDeath: false,
    behaviorTags: [],
  }
  for (const a of adaptations) {
    const m = ADAPTATION_MODIFIERS[a]
    result.crBonus += m.crBonus
    result.troopMultiplier *= m.troopMultiplier
    result.dcBonus += m.dcBonus
    result.dangerRadiusBonus += m.dangerRadiusBonus
    if (m.spawnsMinionsOnDeath) result.spawnsMinionsOnDeath = true
    result.behaviorTags.push(...m.behaviorTags)
  }
  return result
}
