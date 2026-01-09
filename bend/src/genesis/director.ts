/**
 * DIRECTOR - Evolutionary Pressure
 *
 * The Director watches. The Director learns. The Director adapts.
 *
 * Entities that succeed get reinforced.
 * Entities that fail get pruned.
 * The world evolves toward challenge.
 *
 * This is natural selection applied to game design.
 */

import { PHI_INVERSE, VIOLENCE } from './laws';

// What can be mutated
export type MutationType =
  | 'ARMOR'      // Damage resistance
  | 'SPEED'      // Movement/attack speed
  | 'SWARM'      // Group behavior
  | 'REGEN'      // Health recovery
  | 'VOLATILE'   // Explosive on death
  | 'STEALTH'    // Detection evasion
  | 'REFLECT'    // Damage reflection
  | 'DRAIN'      // Life steal
  | 'SPLIT'      // Spawn on death
  | 'ADAPT';     // Counter recent player tactics

// Mutation tracking
export interface MutationStats {
  spawnCount: number;
  playerKills: number;
  playerDeaths: number;  // Deaths caused TO players
  averageLifespan: number;
  damageDealt: number;
  damageReceived: number;
}

// Director state
export interface DirectorState {
  // Mutation weights - higher = more likely to spawn
  weights: Record<MutationType, number>;

  // Current session stats
  sessionStats: Record<MutationType, MutationStats>;

  // Global difficulty multiplier
  pressure: number;

  // Violence level of current session
  violence: number;

  // Generation counter (how many evolution cycles)
  generation: number;
}

/**
 * Create initial director state
 */
export function createDirector(): DirectorState {
  const mutations: MutationType[] = [
    'ARMOR', 'SPEED', 'SWARM', 'REGEN', 'VOLATILE',
    'STEALTH', 'REFLECT', 'DRAIN', 'SPLIT', 'ADAPT'
  ];

  const weights: Record<MutationType, number> = {} as any;
  const sessionStats: Record<MutationType, MutationStats> = {} as any;

  for (const mutation of mutations) {
    weights[mutation] = 1.0; // All start equal
    sessionStats[mutation] = {
      spawnCount: 0,
      playerKills: 0,
      playerDeaths: 0,
      averageLifespan: 0,
      damageDealt: 0,
      damageReceived: 0,
    };
  }

  return {
    weights,
    sessionStats,
    pressure: 1.0,
    violence: VIOLENCE.PEACEFUL,
    generation: 0,
  };
}

/**
 * Report a spawn event
 */
export function reportSpawn(
  state: DirectorState,
  mutations: MutationType[]
): DirectorState {
  const newStats = { ...state.sessionStats };

  for (const mutation of mutations) {
    newStats[mutation] = {
      ...newStats[mutation],
      spawnCount: newStats[mutation].spawnCount + 1,
    };
  }

  return { ...state, sessionStats: newStats };
}

/**
 * Report entity death
 */
export function reportDeath(
  state: DirectorState,
  mutations: MutationType[],
  lifespanMs: number,
  killedPlayer: boolean
): DirectorState {
  const newStats = { ...state.sessionStats };
  const lifespanSeconds = lifespanMs / 1000;

  for (const mutation of mutations) {
    const stats = newStats[mutation];
    const oldTotal = stats.averageLifespan * (stats.spawnCount - 1);

    newStats[mutation] = {
      ...stats,
      playerDeaths: stats.playerDeaths + (killedPlayer ? 1 : 0),
      averageLifespan: (oldTotal + lifespanSeconds) / stats.spawnCount,
    };
  }

  // Increase violence if player died
  let newViolence = state.violence;
  if (killedPlayer) {
    newViolence = Math.min(VIOLENCE.CATACLYSM, state.violence + 0.1);
  }

  return { ...state, sessionStats: newStats, violence: newViolence };
}

/**
 * Report player kill (player killed an entity)
 */
export function reportPlayerKill(
  state: DirectorState,
  mutations: MutationType[]
): DirectorState {
  const newStats = { ...state.sessionStats };

  for (const mutation of mutations) {
    newStats[mutation] = {
      ...newStats[mutation],
      playerKills: newStats[mutation].playerKills + 1,
    };
  }

  // Decrease violence slightly when player succeeds
  const newViolence = Math.max(VIOLENCE.PEACEFUL, state.violence - 0.05);

  return { ...state, sessionStats: newStats, violence: newViolence };
}

/**
 * Calculate fitness score for a mutation
 * Higher = more effective at challenging players
 */
function calculateFitness(stats: MutationStats): number {
  if (stats.spawnCount === 0) return 1.0; // No data yet

  let fitness = 1.0;

  // Kill rate bonus (did it kill players?)
  const killRate = stats.playerDeaths / stats.spawnCount;
  if (killRate > 0.1) fitness += 0.5;
  if (killRate > 0.3) fitness += 0.5;
  if (killRate > 0.5) fitness += 1.0; // Very lethal

  // Survival bonus (did it live long?)
  if (stats.averageLifespan > 30) fitness += 0.3;
  if (stats.averageLifespan > 60) fitness += 0.3;
  if (stats.averageLifespan < 5) fitness -= 0.3; // Died too fast

  // Death rate penalty (did players kill it easily?)
  const deathRate = stats.playerKills / stats.spawnCount;
  if (deathRate > 0.8) fitness -= 0.2; // Too easy to kill
  if (deathRate < 0.3) fitness += 0.2; // Hard to kill

  return Math.max(0.1, fitness); // Never go below 0.1
}

/**
 * EVOLVE - Run an evolution cycle
 * Call this at end of session/day/match
 */
export function evolve(state: DirectorState): DirectorState {
  console.log(`[DIRECTOR] EVOLUTION CYCLE ${state.generation + 1}`);

  const newWeights = { ...state.weights };
  const mutations = Object.keys(state.weights) as MutationType[];

  for (const mutation of mutations) {
    const stats = state.sessionStats[mutation];
    const fitness = calculateFitness(stats);

    // Apply evolution with clamping for diversity
    // We don't want one mutation to dominate completely
    const newWeight = Math.max(0.1, Math.min(5.0, state.weights[mutation] * fitness));

    console.log(
      `[DIRECTOR] ${mutation}: fitness=${fitness.toFixed(2)}, ` +
      `weight=${state.weights[mutation].toFixed(2)} → ${newWeight.toFixed(2)}`
    );

    newWeights[mutation] = newWeight;
  }

  // Reset session stats for next cycle
  const freshStats: Record<MutationType, MutationStats> = {} as any;
  for (const mutation of mutations) {
    freshStats[mutation] = {
      spawnCount: 0,
      playerKills: 0,
      playerDeaths: 0,
      averageLifespan: 0,
      damageDealt: 0,
      damageReceived: 0,
    };
  }

  // Increase pressure slightly each generation
  const newPressure = Math.min(3.0, state.pressure * (1 + PHI_INVERSE * 0.1));

  return {
    weights: newWeights,
    sessionStats: freshStats,
    pressure: newPressure,
    violence: VIOLENCE.PEACEFUL, // Reset violence
    generation: state.generation + 1,
  };
}

/**
 * Select mutations for a new entity based on current weights
 */
export function selectMutations(
  state: DirectorState,
  rng: () => number,
  count: number = 2
): MutationType[] {
  const selected: MutationType[] = [];
  const mutations = Object.keys(state.weights) as MutationType[];

  // Calculate total weight
  const totalWeight = mutations.reduce((sum, m) => sum + state.weights[m], 0);

  for (let i = 0; i < count; i++) {
    let roll = rng() * totalWeight;

    for (const mutation of mutations) {
      roll -= state.weights[mutation];
      if (roll <= 0 && !selected.includes(mutation)) {
        selected.push(mutation);
        break;
      }
    }
  }

  return selected;
}

/**
 * Get difficulty multiplier for current state
 * Used to scale entity stats
 */
export function getDifficultyMultiplier(state: DirectorState): number {
  // Base pressure * violence modifier * phi for good scaling
  return state.pressure * (1 + state.violence) * PHI_INVERSE;
}

/**
 * Serialize director state for persistence
 */
export function serialize(state: DirectorState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize director state
 */
export function deserialize(json: string): DirectorState {
  return JSON.parse(json);
}
