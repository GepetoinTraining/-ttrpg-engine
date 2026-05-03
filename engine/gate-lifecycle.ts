/**
 * GATE-LIFECYCLE — Orchestrator for clear → pool feedback → respawn
 * ====================================================================
 *
 * Wires the bare-state-machine primitives in `dungeon-gate.ts` to the
 * region-scoped adaptation pool in `ecology-pool.ts`. The two flows:
 *
 *   clearGateWithEcology(...)
 *     1. attemptClearGate (mutates gate state)
 *     2. on success → reportClear(pool, gate.adaptations, casualties, permanent, gen)
 *     3. writeAdaptationPool(tp, region, pool)
 *
 *   tickGateWithEcology(...)
 *     1. tickDungeonGate (handles spawn/overflow/leader-emerge/auto-respawn)
 *     2. if respawn fired:
 *          a. evolvePool(pool) — apply last gen's fitness
 *          b. selectAdaptations from evolved pool
 *          c. apply adaptation modifiers to gate.spawnRate
 *          d. writeAdaptationPool(tp, region, evolvedPool)
 *
 * The bare primitives in dungeon-gate.ts are kept untouched. This module
 * is the recipe that combines them with the substrate. Surfaces (and
 * eventual MMDungeonGate) call THESE rather than the primitives directly.
 */

import type { TP } from './tp'
import {
  type DungeonGate,
  type ClearAttemptResult,
  type GateTickResult,
  attemptClearGate,
  tickDungeonGate,
} from './dungeon-gate'
import {
  type MonsterActorState,
  createMonsterActorFromEcology,
  type MonsterActorFromEcologyInput,
} from './monster-actor'
import {
  type Adaptation,
  reportClear,
  evolvePool,
  selectAdaptations,
  adaptationCountForGate,
  combineModifiers,
} from './adaptation'
import {
  getAdaptationPool,
  writeAdaptationPool,
} from './ecology-pool'

// ============================================================
// CLEAR — players (or NPCs) try to clear the gate
// ============================================================

export interface ClearGateInput {
  tp: TP
  regionNodeId: string
  gate: DungeonGate
  partyStrength: number
  metRequirements: string[]
  /** Casualties the gate's monster population caused before being cleared. */
  casualtiesCaused: number
  worldDay: number
  d20: number
}

export interface ClearGateOutput {
  attemptResult: ClearAttemptResult
  /** True if the adaptation pool was updated and persisted to κ. */
  poolUpdated: boolean
}

/**
 * Run a clear attempt. On success, feed the outcome (with gate's current
 * adaptations) back to the species adaptation pool and persist the update.
 *
 * On failure, the gate keeps its state and no pool write happens —
 * failed attempts don't generate evolutionary signal (the population
 * survived without the player's adaptations being effective).
 */
export function clearGateWithEcology(input: ClearGateInput): ClearGateOutput {
  const result = attemptClearGate(
    input.gate,
    input.partyStrength,
    input.metRequirements,
    input.worldDay,
    input.d20,
  )

  if (!result.success) {
    return { attemptResult: result, poolUpdated: false }
  }

  // Read the current pool, report the clear, write back.
  const pool = getAdaptationPool(input.tp, input.regionNodeId, input.gate.speciesId)
  reportClear(pool, {
    adaptations: input.gate.adaptations,
    casualties: input.casualtiesCaused,
    permanent: result.permanent,
    generation: input.gate.timesCleared,
  })
  const ok = writeAdaptationPool(input.tp, input.regionNodeId, pool)

  return { attemptResult: result, poolUpdated: ok }
}

// ============================================================
// TICK — weekly tick wrapping the respawn-evolve cycle
// ============================================================

export interface TickGateInput {
  tp: TP
  regionNodeId: string
  gate: DungeonGate
  worldDay: number
  /** d20 used by tickDungeonGate for spawn modulation + leader emergence. */
  d20: number
  /** d20s used to draw fresh adaptations IF the gate respawns this tick. */
  respawnD20s: number[]
}

export interface TickGateOutput {
  tickResult: GateTickResult
  /** Set ONLY when the gate respawned this tick — the new adaptation set. */
  newAdaptations?: Adaptation[]
  /** True if the adaptation pool was evolved and persisted. */
  poolUpdated: boolean
}

/**
 * Tick a gate. If the gate transitions from `capped` → `active` this
 * tick, evolve the pool, draw fresh adaptations, apply their modifiers
 * to the gate, and persist the evolved pool.
 *
 * Non-respawn ticks (regular spawn/overflow/leader-emerge) don't touch
 * the pool — those signals are accumulated only on clear events.
 */
export function tickGateWithEcology(input: TickGateInput): TickGateOutput {
  const tickResult = tickDungeonGate(input.gate, input.worldDay, input.d20)

  if (!tickResult.respawned) {
    return { tickResult, poolUpdated: false }
  }

  // Respawn fired. Evolve the pool, draw new adaptations, apply mods.
  const pool = getAdaptationPool(input.tp, input.regionNodeId, input.gate.speciesId)
  const evolvedPool = evolvePool(pool)

  const want = adaptationCountForGate(input.gate.timesCleared, input.gate.tier)
  const newAdaptations = selectAdaptations(evolvedPool, want, input.respawnD20s)

  // Apply new adaptations to gate stats. tickDungeonGate already reset
  // spawnRate to (baseSpawnRate × respawnMultiplier^timesCleared); we
  // multiply by the new troop multiplier on top.
  const mods = combineModifiers(newAdaptations)
  input.gate.adaptations = newAdaptations
  input.gate.spawnRate = Math.ceil(input.gate.spawnRate * mods.troopMultiplier)

  const ok = writeAdaptationPool(input.tp, input.regionNodeId, evolvedPool)

  return { tickResult, newAdaptations, poolUpdated: ok }
}

// ============================================================
// MONSTER ACTOR SPAWN — persisted evolution
// ============================================================

export interface SpawnMonsterActorInput
  extends Omit<MonsterActorFromEcologyInput, 'pool'> {
  /** TP for κ read/write. */
  tp: TP
  /** Region node where the adaptation pool lives. */
  regionNodeId: string
}

export interface SpawnMonsterActorOutput {
  actor: MonsterActorState
  adaptations: Adaptation[]
  poolUpdated: boolean
}

/**
 * Spawn a monster actor whose adaptations come from the region's pool,
 * AND persist the evolved pool back to κ in one step. Convenience wrapper
 * around createMonsterActorFromEcology + writeAdaptationPool.
 *
 * Use this when the actor lives at a fixed lair tied to a known region.
 * Migration (lair-seeds-new-lair-on-different-edge) should call this with
 * the DESTINATION region's nodeId so the new lair evolves from that region's
 * pool, not the parent's.
 */
export function spawnMonsterActorWithEcology(
  input: SpawnMonsterActorInput,
): SpawnMonsterActorOutput {
  // Read the latest pool for the destination region
  const pool = getAdaptationPool(input.tp, input.regionNodeId, input.speciesId)

  const result = createMonsterActorFromEcology({
    campNodeId: input.campNodeId,
    campEdgeId: input.campEdgeId,
    campMileMarker: input.campMileMarker,
    gateId: input.gateId,
    tier: input.tier,
    generation: input.generation,
    population: input.population,
    worldDay: input.worldDay,
    d20s: input.d20s,
    speciesId: input.speciesId,
    pool,
  })

  const ok = writeAdaptationPool(input.tp, input.regionNodeId, result.evolvedPool)

  return {
    actor: result.actor,
    adaptations: result.adaptations,
    poolUpdated: ok,
  }
}
