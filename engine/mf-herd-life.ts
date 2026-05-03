/**
 * MF — Herd Life
 * ====================
 *
 * Atomic transformations for wild fauna populations. Pure, deterministic.
 *
 * The three primitives — graze, migrate, predation — together model the
 * full predation/hunger/survival/travel loop:
 *
 *   - mfHerdGraze:     consume flora at current node, gain food, breed
 *                      with surplus, age out, transition status if hungry
 *   - mfHerdMigrate:   advance along an edge toward a destination node;
 *                      formation determines speed; multi-day fold
 *   - mfHerdPredation: lose population to predator pressure; formation
 *                      determines defense; status may flip to fleeing or
 *                      decimated
 *
 * Caller (mm-wild-fauna onResolve, future) feeds inputs from κ + adjacent
 * MMs and persists the new herd state via the standard `writeKappa` channel.
 *
 * Per Theorem 1: each MF returns `{ output, receipt }`. The receipt is the
 * structural side-effect of the forward pass; replay-able from inputs.
 */

import {
  type WildHerd,
  type WildFaunaSpecies,
  type Formation,
  type HerdStatus,
  FORMATION_SPEED_MOD,
  FORMATION_DEFENSE_MOD,
  FORMATION_FORAGE_MOD,
  defaultFormationFor,
  isViable,
} from './wild-fauna'

// ============================================================
// COMMON SHAPES
// ============================================================

export interface HerdMFReceipt {
  herdId: string
  speciesId: string
  /** World day this fold ended on. */
  worldDay: number
  /** Population BEFORE this MF. */
  populationBefore: number
  /** Population AFTER this MF. */
  populationAfter: number
}

// ============================================================
// MF — GRAZE
// ============================================================

export interface HerdGrazeContext {
  /** Days to fold. */
  days: number
  /** Current world day at the END of the fold. */
  worldDay: number
  /**
   * Flora units available at the herd's current node, total across all `days`.
   * Caller sources from κ.ecology at the node (or Δ.1 interactable density).
   * If below population × dailyFoodNeed × days, herd starves proportionally.
   */
  floraAvailable: number
}

export interface HerdGrazeOutput {
  herdAfter: WildHerd
  /** Flora consumed by the herd over the fold. ≤ floraAvailable. */
  floraConsumed: number
  /** Net population change (births - deaths) this fold. */
  populationDelta: number
  /** Whether the herd transitioned to a different status this fold. */
  statusTransition: { from: HerdStatus; to: HerdStatus } | null
}

export function mfHerdGraze(
  herd: WildHerd,
  species: WildFaunaSpecies,
  ctx: HerdGrazeContext,
): { output: HerdGrazeOutput; receipt: HerdMFReceipt } {
  const days = Math.max(0, Math.floor(ctx.days))
  const populationBefore = herd.population

  // 1. Compute food demand vs supply, scaled by formation forage efficiency.
  const formationForage = FORMATION_FORAGE_MOD[herd.formation]
  const foodDemand = herd.population * species.dailyFoodNeed * days * formationForage
  const floraConsumed = formationForage > 0 ? Math.min(ctx.floraAvailable, foodDemand) : 0
  // Food security: ratio of consumed to demand. If formation forage is 0 (e.g.
  // defensive_box), we don't update — the herd isn't trying to eat.
  const foodRatio = foodDemand > 0 ? floraConsumed / foodDemand : herd.foodSecurity
  // Smooth toward the new ratio across the fold; recent days weight more.
  const newFood = Math.max(0, Math.min(1, foodRatio))
  // Hunger counter: each day with food < 0.7 increments; full feed resets.
  const fullFed = newFood >= 0.95
  const newDaysHungry = fullFed ? 0 : herd.daysHungry + days

  // 2. Births: scale with food security; cap at carrying capacity.
  const breedingRate = species.baseBreedingRate * Math.max(0, newFood)
  const breedingRoom = Math.max(0, species.carryingCapacity - herd.population)
  const births = Math.min(
    breedingRoom,
    Math.floor(herd.population * breedingRate * days),
  )

  // 3. Mortality: aging baseline + starvation penalty.
  const starvationFactor = newFood < 0.5 ? (0.5 - newFood) * 0.04 : 0
  const mortalityRate = species.baseMortalityRate + starvationFactor
  const deaths = Math.floor(herd.population * mortalityRate * days)

  const populationAfter = Math.max(0, populationBefore + births - deaths)

  // 4. Status transitions.
  const fromStatus = herd.status
  let toStatus: HerdStatus = fromStatus
  if (populationAfter < species.minViable) {
    toStatus = 'decimated'
  } else if (newDaysHungry >= species.hungerMigrationThreshold) {
    toStatus = 'starving'
  } else if (fromStatus === 'starving' && fullFed) {
    toStatus = 'grazing'
  } else if (fromStatus === 'grazing') {
    // stay grazing
    toStatus = 'grazing'
  }

  const newFormation: Formation =
    toStatus === fromStatus ? herd.formation : defaultFormationFor(toStatus)

  const herdAfter: WildHerd = {
    ...herd,
    population: populationAfter,
    foodSecurity: newFood,
    daysHungry: newDaysHungry,
    formation: newFormation,
    status: toStatus,
    lastTransitionDay: toStatus !== fromStatus ? ctx.worldDay : herd.lastTransitionDay,
  }

  return {
    output: {
      herdAfter,
      floraConsumed,
      populationDelta: populationAfter - populationBefore,
      statusTransition: toStatus !== fromStatus ? { from: fromStatus, to: toStatus } : null,
    },
    receipt: {
      herdId: herd.id,
      speciesId: species.id,
      worldDay: ctx.worldDay,
      populationBefore,
      populationAfter,
    },
  }
}

// ============================================================
// MF — MIGRATE
// ============================================================

export interface HerdMigrateContext {
  days: number
  worldDay: number
  /** Edge id the herd is traveling along. */
  edgeId: string
  /** Total miles on this edge. */
  edgeTotalMiles: number
  /** Destination node id once miles reach edgeTotalMiles. */
  destinationNodeId: string
  /** Baseline miles per day the species can cover (from species + terrain). */
  baseMilesPerDay: number
  /** Encounter danger 0..10 along this segment (used for fleeing override). */
  segmentDanger?: number
}

export interface HerdMigrateOutput {
  herdAfter: WildHerd
  /** Miles advanced this fold. */
  milesAdvanced: number
  /** True if the herd reached the destination this fold. */
  arrived: boolean
  /** Status transition if any. */
  statusTransition: { from: HerdStatus; to: HerdStatus } | null
}

export function mfHerdMigrate(
  herd: WildHerd,
  species: WildFaunaSpecies,
  ctx: HerdMigrateContext,
): { output: HerdMigrateOutput; receipt: HerdMFReceipt } {
  if (!isViable(herd, species)) {
    throw new Error(`mfHerdMigrate: herd ${herd.id} below min viable population`)
  }
  const days = Math.max(0, Math.floor(ctx.days))
  const populationBefore = herd.population

  // Pick formation based on threat and status.
  const fromStatus = herd.status
  const wasOnEdge = herd.edgeId !== null
  const startingFormation: Formation = wasOnEdge ? herd.formation : 'column'
  let formation: Formation = startingFormation
  let toStatus: HerdStatus = fromStatus === 'grazing' ? 'migrating' : fromStatus

  if ((ctx.segmentDanger ?? 0) >= 6 && fromStatus !== 'fleeing') {
    formation = 'scattered'
    toStatus = 'fleeing'
  } else if (toStatus === 'fleeing' && (ctx.segmentDanger ?? 0) < 3) {
    formation = 'column'
    toStatus = 'migrating'
  } else if (toStatus === 'migrating') {
    formation = 'column'
  }

  // Speed = base × formation modifier × (1 + flee bonus when scattered).
  const formationSpeed = FORMATION_SPEED_MOD[formation]
  const fleeBonus = formation === 'scattered' ? species.fleeSpeedMod - 1.0 : 0
  const milesPerDay = Math.max(0.1, ctx.baseMilesPerDay * (formationSpeed + fleeBonus))
  const milesAdvanced = milesPerDay * days
  const newMile = Math.min(ctx.edgeTotalMiles, herd.edgeMile + milesAdvanced)
  const arrived = newMile >= ctx.edgeTotalMiles

  // Stragglers attrition under scattered formation — formation defense low,
  // some heads lost per day in panic. Apply same rate as base mortality × 2.
  const formationDefense = FORMATION_DEFENSE_MOD[formation]
  const defenseGap = Math.max(0, 1 - formationDefense)
  const attritionRate = species.baseMortalityRate * (1 + defenseGap * 2)
  const attrition = Math.floor(herd.population * attritionRate * days)
  const populationAfter = Math.max(0, populationBefore - attrition)

  // Land at destination if arrived.
  const finalStatus: HerdStatus = arrived
    ? populationAfter < species.minViable
      ? 'decimated'
      : 'grazing'
    : toStatus

  const finalFormation: Formation = arrived ? defaultFormationFor(finalStatus) : formation

  const herdAfter: WildHerd = {
    ...herd,
    population: populationAfter,
    formation: finalFormation,
    status: finalStatus,
    edgeId: arrived ? null : ctx.edgeId,
    edgeMile: arrived ? 0 : newMile,
    edgeTotalMiles: arrived ? 0 : ctx.edgeTotalMiles,
    currentNodeId: arrived ? ctx.destinationNodeId : herd.currentNodeId,
    destinationNodeId: arrived ? null : ctx.destinationNodeId,
    lastTransitionDay:
      finalStatus !== fromStatus ? ctx.worldDay : herd.lastTransitionDay,
  }

  return {
    output: {
      herdAfter,
      milesAdvanced: arrived ? ctx.edgeTotalMiles - herd.edgeMile : milesAdvanced,
      arrived,
      statusTransition:
        finalStatus !== fromStatus ? { from: fromStatus, to: finalStatus } : null,
    },
    receipt: {
      herdId: herd.id,
      speciesId: species.id,
      worldDay: ctx.worldDay,
      populationBefore,
      populationAfter,
    },
  }
}

// ============================================================
// MF — PREDATION
// ============================================================

export interface HerdPredationContext {
  worldDay: number
  /** Predator pressure 0..1 — caller computes from carnivore count + danger κ. */
  pressure: number
  /** Days the pressure is applied across. */
  days: number
}

export interface HerdPredationOutput {
  herdAfter: WildHerd
  /** Heads lost to predation this fold. */
  predated: number
  statusTransition: { from: HerdStatus; to: HerdStatus } | null
}

export function mfHerdPredation(
  herd: WildHerd,
  species: WildFaunaSpecies,
  ctx: HerdPredationContext,
): { output: HerdPredationOutput; receipt: HerdMFReceipt } {
  const days = Math.max(0, Math.floor(ctx.days))
  const populationBefore = herd.population
  const pressure = Math.max(0, Math.min(1, ctx.pressure))

  // Defense reduces effective pressure.
  const formationDefense = FORMATION_DEFENSE_MOD[herd.formation]
  const effectivePressure = Math.max(0, pressure / Math.max(0.1, formationDefense))
  // Per-day fraction lost, capped at 5% of population per day to avoid
  // single-step extinction; herds either flee or decimate gradually.
  const dailyLoss = Math.min(0.05, effectivePressure * 0.04)
  const predated = Math.floor(populationBefore * dailyLoss * days)
  const populationAfter = Math.max(0, populationBefore - predated)

  // Status transition: heavy predation → fleeing; below viable → decimated.
  const fromStatus = herd.status
  let toStatus: HerdStatus = fromStatus
  if (populationAfter < species.minViable) {
    toStatus = 'decimated'
  } else if (pressure >= 0.5 && fromStatus !== 'fleeing') {
    toStatus = 'fleeing'
  } else if (pressure < 0.2 && fromStatus === 'fleeing') {
    toStatus = 'grazing'
  }

  const newFormation: Formation =
    toStatus === fromStatus ? herd.formation : defaultFormationFor(toStatus)

  const herdAfter: WildHerd = {
    ...herd,
    population: populationAfter,
    formation: newFormation,
    status: toStatus,
    lastTransitionDay: toStatus !== fromStatus ? ctx.worldDay : herd.lastTransitionDay,
  }

  return {
    output: {
      herdAfter,
      predated,
      statusTransition: toStatus !== fromStatus ? { from: fromStatus, to: toStatus } : null,
    },
    receipt: {
      herdId: herd.id,
      speciesId: species.id,
      worldDay: ctx.worldDay,
      populationBefore,
      populationAfter,
    },
  }
}
