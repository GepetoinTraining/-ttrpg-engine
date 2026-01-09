import {
  MonsterPopulation,
  MonsterSpecies,
  RegionalEcosystem,
  getTierFromCount,
} from "./population";
import { Spawner, calculateWeeklyOutput } from "./spawner";
import {
  MigrationEvent,
  PredationEvent,
  CompetitionEvent,
  CivilizationInteraction,
  calculatePredationPressure,
  shouldMigrate,
  selectMigrationDestination,
} from "./ecology";

// ============================================
// POPULATION TICK ENGINE
// ============================================
//
// The weekly heartbeat of the monster ecosystem.
//
// Each week:
// 1. Spawners produce monsters
// 2. Populations grow naturally
// 3. Predators eat prey
// 4. Species compete for territory
// 5. Civilization pushes back
// 6. Overpressured populations migrate
//

// ============================================
// TICK RESULT
// ============================================

export interface PopulationTickResult {
  updatedPopulations: MonsterPopulation[];

  births: Array<{ populationId: string; speciesName: string; count: number }>;
  deaths: Array<{ populationId: string; speciesName: string; count: number; cause: string }>;
  migrations: MigrationEvent[];
  predations: PredationEvent[];
  competitions: CompetitionEvent[];
  civilizationEvents: CivilizationInteraction[];

  spawnerOutputs: Array<{
    spawnerId: string;
    spawnerName: string;
    produced: number;
    spilled: number;
    targetPopulationId?: string;
  }>;

  ecosystemUpdates: Array<{
    regionId: string;
    previousStability: number;
    newStability: number;
    changes: string[];
  }>;

  weekNumber: number;
  processedAt: string;
}

// ============================================
// TICK CONTEXT
// ============================================

export interface PopulationTickContext {
  populations: MonsterPopulation[];
  species: Map<string, MonsterSpecies>;
  ecosystems: Map<string, RegionalEcosystem>;
  spawners: Spawner[];

  // Settlement data
  settlements: Array<{
    id: string;
    name: string;
    regionId: string;
    population: number;
    militaryStrength: number;
    patrolRange: number;
  }>;

  // Trade routes
  tradeRoutes: Array<{
    id: string;
    regionIds: string[];
    trafficLevel: number;
  }>;

  // Adjacent regions for migration
  regionAdjacency: Map<string, Array<{
    regionId: string;
    regionName: string;
    habitatMatch: number;
    civilizationPresence: number;
  }>>;

  currentDate: Date;
  weekNumber: number;
  daysElapsed: number;
}

// ============================================
// MAIN TICK FUNCTION
// ============================================

export function tickPopulations(ctx: PopulationTickContext): PopulationTickResult {
  const result: PopulationTickResult = {
    updatedPopulations: [],
    births: [],
    deaths: [],
    migrations: [],
    predations: [],
    competitions: [],
    civilizationEvents: [],
    spawnerOutputs: [],
    ecosystemUpdates: [],
    weekNumber: ctx.weekNumber,
    processedAt: new Date().toISOString(),
  };

  // Clone populations for modification
  const populations = ctx.populations.map(p => structuredClone(p));

  // ─────────────────────────────────────────
  // PHASE 1: SPAWNER OUTPUT
  // ─────────────────────────────────────────

  for (const spawner of ctx.spawners) {
    const outputs = calculateWeeklyOutput(spawner, ctx.daysElapsed);

    for (const output of outputs) {
      const targetRegionId = output.destination === "spillover" && output.targetRegionId
        ? output.targetRegionId
        : spawner.regionId;

      // Find or create target population
      let targetPop = populations.find(p =>
        p.speciesId === output.speciesId &&
        p.regionId === targetRegionId
      );

      if (!targetPop) {
        const species = ctx.species.get(output.speciesId);
        if (!species) continue;

        targetPop = createNewPopulation(
          output.speciesId,
          output.speciesName,
          species,
          targetRegionId,
          spawner.poiId,
          ctx.currentDate,
        );
        populations.push(targetPop);
      }

      targetPop.count += output.count;

      if (output.destination === "spillover") {
        targetPop.growth.immigrationThisWeek += output.count;
      }

      result.spawnerOutputs.push({
        spawnerId: spawner.id,
        spawnerName: spawner.name,
        produced: output.count,
        spilled: output.destination === "spillover" ? output.count : 0,
        targetPopulationId: targetPop.id,
      });
    }
  }

  // ─────────────────────────────────────────
  // PHASE 2: NATURAL GROWTH
  // ─────────────────────────────────────────

  for (const pop of populations) {
    if (pop.count === 0) continue;

    const species = ctx.species.get(pop.speciesId);
    if (!species) continue;

    // Undead/constructs don't reproduce naturally
    if (species.ecology.role === "undead" || species.ecology.role === "construct") {
      continue;
    }

    // Calculate effective growth rate
    let growthRate = species.reproduction.baseGrowthRate;

    // Food security
    growthRate *= pop.health.foodSecurity;

    // Territory pressure (carrying capacity)
    if (pop.count >= pop.carryingCapacity) {
      growthRate *= 0.1;
    } else if (pop.count >= pop.carryingCapacity * 0.8) {
      growthRate *= 0.5;
    }

    // Predation pressure
    growthRate *= (1 - pop.health.predationPressure * 0.5);

    // Disease
    growthRate *= (1 - pop.health.diseaseLevel * 0.7);

    // Apply modifiers
    for (const mod of pop.growth.growthModifiers) {
      growthRate *= (1 + mod.modifier);
    }

    // Calculate births
    const births = Math.floor(pop.count * growthRate * (ctx.daysElapsed / 7));

    if (births > 0) {
      pop.count += births;
      pop.growth.birthsThisWeek = births;
      result.births.push({
        populationId: pop.id,
        speciesName: pop.speciesName,
        count: births,
      });
    }

    pop.growth.currentGrowthRate = growthRate;
  }

  // ─────────────────────────────────────────
  // PHASE 3: PREDATION
  // ─────────────────────────────────────────

  for (const pop of populations) {
    if (pop.count === 0) continue;

    const species = ctx.species.get(pop.speciesId);
    if (!species) continue;

    // Only predators hunt
    if (species.ecology.role !== "predator" && species.ecology.role !== "apex_predator") {
      continue;
    }

    // Find prey in same region
    const preyPops = populations.filter(p =>
      p.regionId === pop.regionId &&
      p.id !== pop.id &&
      p.count > 0 &&
      species.ecology.preySpecies.includes(p.speciesId)
    );

    for (const prey of preyPops) {
      // Each predator kills ~0.1 prey per week on average
      const killRate = 0.1 * species.resources.foodPerWeek;
      const killed = Math.min(
        prey.count,
        Math.floor(pop.count * killRate * (ctx.daysElapsed / 7))
      );

      if (killed > 0) {
        prey.count -= killed;
        prey.growth.deathsThisWeek += killed;

        // Predator benefits
        pop.health.foodSecurity = Math.min(1, pop.health.foodSecurity + killed * 0.01);

        result.predations.push({
          id: crypto.randomUUID(),
          predatorPopulationId: pop.id,
          predatorSpeciesId: pop.speciesId,
          predatorSpeciesName: pop.speciesName,
          preyPopulationId: prey.id,
          preySpeciesId: prey.speciesId,
          preySpeciesName: prey.speciesName,
          regionId: pop.regionId,
          preyKilled: killed,
          predatorCasualties: 0,
          occurredAt: ctx.currentDate.toISOString(),
        });

        result.deaths.push({
          populationId: prey.id,
          speciesName: prey.speciesName,
          count: killed,
          cause: `predation by ${pop.speciesName}`,
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // PHASE 4: COMPETITION
  // ─────────────────────────────────────────

  const processedCompetitions = new Set<string>();

  for (const pop of populations) {
    if (pop.count === 0) continue;

    const species = ctx.species.get(pop.speciesId);
    if (!species) continue;

    const competitors = populations.filter(p =>
      p.regionId === pop.regionId &&
      p.id !== pop.id &&
      p.count > 0 &&
      species.ecology.competitorSpecies.includes(p.speciesId)
    );

    for (const competitor of competitors) {
      // Avoid processing same pair twice
      const pairKey = [pop.id, competitor.id].sort().join(":");
      if (processedCompetitions.has(pairKey)) continue;
      processedCompetitions.add(pairKey);

      // Competition only triggers if both are above 50% capacity
      const popPressure = pop.count / pop.carryingCapacity;
      const compPressure = competitor.count / competitor.carryingCapacity;

      if (popPressure > 0.5 && compPressure > 0.5) {
        const popStrength = pop.count * (species.combatProfile?.averageDamagePerRound || 1);
        const compSpecies = ctx.species.get(competitor.speciesId);
        const compStrength = competitor.count * (compSpecies?.combatProfile?.averageDamagePerRound || 1);

        const winner = popStrength > compStrength ? pop : competitor;
        const loser = popStrength > compStrength ? competitor : pop;

        const loserCasualties = Math.floor(loser.count * 0.1);
        const winnerCasualties = Math.floor(winner.count * 0.05);

        loser.count -= loserCasualties;
        winner.count -= winnerCasualties;
        loser.growth.deathsThisWeek += loserCasualties;
        winner.growth.deathsThisWeek += winnerCasualties;

        result.competitions.push({
          id: crypto.randomUUID(),
          populationAId: pop.id,
          speciesAId: pop.speciesId,
          speciesAName: pop.speciesName,
          populationBId: competitor.id,
          speciesBId: competitor.speciesId,
          speciesBName: competitor.speciesName,
          regionId: pop.regionId,
          competitionType: "territory",
          winnerId: winner.id,
          loserEffect: "reduced",
          casualties: {
            populationA: pop.id === winner.id ? winnerCasualties : loserCasualties,
            populationB: competitor.id === winner.id ? winnerCasualties : loserCasualties,
          },
          occurredAt: ctx.currentDate.toISOString(),
        });

        result.deaths.push({
          populationId: loser.id,
          speciesName: loser.speciesName,
          count: loserCasualties,
          cause: `competition with ${winner.speciesName}`,
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // PHASE 5: CIVILIZATION PRESSURE
  // ─────────────────────────────────────────

  for (const pop of populations) {
    if (pop.count === 0) continue;

    const species = ctx.species.get(pop.speciesId);
    if (!species) continue;

    const nearbySettlements = ctx.settlements.filter(s => s.regionId === pop.regionId);

    for (const settlement of nearbySettlements) {
      const patrolPressure = settlement.militaryStrength * 0.01;

      // Patrol encounter
      if (Math.random() < patrolPressure * (ctx.daysElapsed / 7)) {
        const monsterCasualties = Math.floor(pop.count * 0.05);
        pop.count -= monsterCasualties;
        pop.growth.deathsThisWeek += monsterCasualties;

        result.civilizationEvents.push({
          id: crypto.randomUUID(),
          populationId: pop.id,
          speciesId: pop.speciesId,
          speciesName: pop.speciesName,
          settlementId: settlement.id,
          settlementName: settlement.name,
          interactionType: "patrol_clash",
          outcome: {
            monsterCasualties,
            guardCasualties: Math.floor(monsterCasualties * 0.2),
          },
          effects: {
            bountyGenerated: false,
            populationPushedBack: monsterCasualties > pop.count * 0.1,
          },
          occurredAt: ctx.currentDate.toISOString(),
        });

        result.deaths.push({
          populationId: pop.id,
          speciesName: pop.speciesName,
          count: monsterCasualties,
          cause: `settlement patrols from ${settlement.name}`,
        });
      }

      // Monster raiding
      if (
        species.ecology.aggressive &&
        pop.health.foodSecurity < 0.6 &&
        Math.random() < 0.1 * (ctx.daysElapsed / 7)
      ) {
        const raiderCount = Math.floor(pop.count * 0.1);
        const monsterCasualties = Math.floor(raiderCount * 0.3);
        pop.count -= monsterCasualties;
        pop.growth.deathsThisWeek += monsterCasualties;
        pop.conflicts.settlementRaids++;

        // Successful raid improves food security
        pop.health.foodSecurity = Math.min(1, pop.health.foodSecurity + 0.2);

        result.civilizationEvents.push({
          id: crypto.randomUUID(),
          populationId: pop.id,
          speciesId: pop.speciesId,
          speciesName: pop.speciesName,
          settlementId: settlement.id,
          settlementName: settlement.name,
          interactionType: "raid",
          outcome: {
            monsterCasualties,
            civilianCasualties: Math.floor(Math.random() * 5),
            goldLost: Math.floor(Math.random() * 100),
            livestockLost: Math.floor(Math.random() * 10),
          },
          effects: {
            settlementUnrestChange: 5,
            bountyGenerated: true,
            populationPushedBack: false,
          },
          occurredAt: ctx.currentDate.toISOString(),
        });
      }
    }

    // Caravan attacks
    const routesThroughRegion = ctx.tradeRoutes.filter(r =>
      r.regionIds.includes(pop.regionId)
    );

    if (
      species.ecology.aggressive &&
      routesThroughRegion.length > 0 &&
      Math.random() < 0.05 * (ctx.daysElapsed / 7)
    ) {
      pop.conflicts.caravanAttacks++;
      pop.health.foodSecurity = Math.min(1, pop.health.foodSecurity + 0.1);
    }
  }

  // ─────────────────────────────────────────
  // PHASE 6: MIGRATION
  // ─────────────────────────────────────────

  for (const pop of populations) {
    if (pop.count === 0) continue;

    const species = ctx.species.get(pop.speciesId);
    if (!species) continue;

    // Undead/constructs don't migrate
    if (species.ecology.role === "undead" || species.ecology.role === "construct") {
      continue;
    }

    if (shouldMigrate(
      pop.health.foodSecurity,
      pop.health.territoryPressure,
      pop.health.predationPressure,
      species.behavior.migrationTendency,
    )) {
      const adjacentRegions = ctx.regionAdjacency.get(pop.regionId) || [];

      // Add population density to adjacent regions
      const regionsWithDensity = adjacentRegions.map(r => {
        const regionPops = populations.filter(p => p.regionId === r.regionId);
        const totalCount = regionPops.reduce((sum, p) => sum + p.count, 0);
        const ecosystem = ctx.ecosystems.get(r.regionId);
        const capacity = ecosystem?.resources.totalCarryingCapacity || 100;

        return {
          ...r,
          currentPopulationDensity: totalCount / capacity,
        };
      });

      const destination = selectMigrationDestination(regionsWithDensity);

      if (destination) {
        const migrants = Math.floor(pop.count * 0.3);
        pop.count -= migrants;
        pop.growth.emigrationThisWeek = migrants;

        // Find or create population in destination
        let destPop = populations.find(p =>
          p.speciesId === pop.speciesId &&
          p.regionId === destination.regionId
        );

        if (!destPop) {
          destPop = createNewPopulation(
            pop.speciesId,
            pop.speciesName,
            species,
            destination.regionId,
            undefined,
            ctx.currentDate,
          );
          destPop.regionName = destination.regionName;
          populations.push(destPop);
        }

        destPop.count += migrants;
        destPop.growth.immigrationThisWeek += migrants;

        const cause = pop.health.foodSecurity < 0.5 ? "food_shortage" :
                     pop.health.territoryPressure > 1.5 ? "overpopulation" :
                     pop.health.predationPressure > 0.5 ? "predation" : "seasonal";

        result.migrations.push({
          id: crypto.randomUUID(),
          populationId: pop.id,
          speciesId: pop.speciesId,
          speciesName: pop.speciesName,
          migrantsCount: migrants,
          originRegionId: pop.regionId,
          originRegionName: pop.regionName,
          destinationRegionId: destination.regionId,
          destinationRegionName: destination.regionName,
          cause,
          status: "complete",
          startedAt: ctx.currentDate.toISOString(),
          expectedArrival: ctx.currentDate.toISOString(),
          progress: 1,
          hazards: {
            exposedToSettlements: false,
            crossesTradeRoutes: false,
            passesOtherTerritories: [],
          },
          losses: 0,
          lossReasons: [],
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // PHASE 7: UPDATE HEALTH & FINALIZE
  // ─────────────────────────────────────────

  for (const pop of populations) {
    // Update tier
    pop.tier = getTierFromCount(pop.count);

    // Update health metrics
    pop.health.territoryPressure = pop.count / Math.max(1, pop.carryingCapacity);

    // Calculate predation pressure from predators in same region
    const predators = populations.filter(p =>
      p.regionId === pop.regionId &&
      p.id !== pop.id &&
      p.count > 0
    );

    const predatorData = predators.map(p => {
      const s = ctx.species.get(p.speciesId);
      return {
        speciesId: p.speciesId,
        count: p.count,
        preySpecies: s?.ecology.preySpecies || [],
      };
    });

    pop.health.predationPressure = calculatePredationPressure(
      { speciesId: pop.speciesId, count: pop.count },
      predatorData,
    );

    // Food security natural decay/recovery
    const species = ctx.species.get(pop.speciesId);
    if (species && species.ecology.role !== "undead" && species.ecology.role !== "construct") {
      // Decay towards equilibrium based on territory pressure
      const targetFoodSecurity = Math.max(0.2, 1 - pop.health.territoryPressure * 0.3);
      pop.health.foodSecurity += (targetFoodSecurity - pop.health.foodSecurity) * 0.2;
    }

    // Add to history
    pop.history.push({
      week: ctx.weekNumber,
      count: pop.count,
      event: pop.growth.deathsThisWeek > pop.count * 0.1 ? "heavy_losses" :
             pop.growth.birthsThisWeek > pop.count * 0.2 ? "population_boom" : undefined,
    });

    // Keep history to last 52 weeks
    if (pop.history.length > 52) {
      pop.history = pop.history.slice(-52);
    }

    // Reset weekly counters
    pop.growth.birthsThisWeek = 0;
    pop.growth.deathsThisWeek = 0;
    pop.growth.immigrationThisWeek = 0;
    pop.growth.emigrationThisWeek = 0;

    // Clean expired modifiers
    pop.growth.growthModifiers = pop.growth.growthModifiers.filter(mod => {
      if (!mod.expires) return true;
      return new Date(mod.expires) > ctx.currentDate;
    });

    pop.updatedAt = ctx.currentDate.toISOString();
  }

  // Filter out extinct populations (optional - keep for history)
  result.updatedPopulations = populations;

  return result;
}

// ============================================
// HELPER: CREATE NEW POPULATION
// ============================================

function createNewPopulation(
  speciesId: string,
  speciesName: string,
  species: MonsterSpecies,
  regionId: string,
  poiId: string | undefined,
  currentDate: Date,
): MonsterPopulation {
  const carryingCapacity = 100; // Default, would be calculated from ecosystem

  return {
    id: crypto.randomUUID(),
    campaignId: "", // Set by caller
    speciesId,
    speciesName,
    regionId,
    regionName: "", // Set by caller
    poiId,
    count: 0,
    tier: "extinct",
    carryingCapacity,
    growth: {
      currentGrowthRate: species.reproduction.baseGrowthRate,
      birthsThisWeek: 0,
      deathsThisWeek: 0,
      immigrationThisWeek: 0,
      emigrationThisWeek: 0,
      growthModifiers: [],
    },
    health: {
      foodSecurity: 1,
      territoryPressure: 0,
      predationPressure: 0,
      diseaseLevel: 0,
    },
    behavior: {
      aggression: 0.5,
      expansion: false,
    },
    conflicts: {
      adventurerKills: 0,
      adventurerDefeats: 0,
      speciesConflicts: [],
      settlementRaids: 0,
      caravanAttacks: 0,
    },
    directorData: {
      fitness: 1,
      adaptations: [],
      threatRating: 0,
    },
    history: [],
    createdAt: currentDate.toISOString(),
    updatedAt: currentDate.toISOString(),
  };
}

// ============================================
// HELPER: APPLY ADVENTURER ENCOUNTER
// ============================================

export function applyAdventurerEncounter(
  population: MonsterPopulation,
  casualties: number,
  outcome: "victory" | "defeat" | "retreat",
): MonsterPopulation {
  const updated = { ...population };

  updated.count = Math.max(0, updated.count - casualties);
  updated.growth.deathsThisWeek += casualties;

  if (outcome === "defeat") {
    updated.conflicts.adventurerDefeats++;
  } else {
    updated.conflicts.adventurerKills += casualties;
  }

  updated.conflicts.lastEncounter = new Date().toISOString();
  updated.tier = getTierFromCount(updated.count);

  return updated;
}
