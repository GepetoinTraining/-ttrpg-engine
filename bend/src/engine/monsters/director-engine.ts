import {
  WorldDirectorState,
  SpeciesFitness,
  RegionalThreatLevel,
  EncounterRecord,
  EvolutionCycleResult,
  ThreatOutcome,
  AdaptationType,
  STANDARD_ADAPTATIONS,
  calculateFitness,
  adjustThreatLevel,
} from "./director";
import { MonsterPopulation } from "./population";

// ============================================
// DIRECTOR ENGINE
// ============================================
//
// The Director watches. The Director learns.
//
// After each encounter:
// 1. Update species fitness
// 2. Adjust regional threat levels
// 3. Track party profiles
//
// Weekly evolution cycle:
// 1. Grant adaptations to successful species
// 2. Remove adaptations from failing species
// 3. Adjust spawn weights
//

// ============================================
// TICK CONTEXT & RESULT
// ============================================

export interface DirectorTickContext {
  directorState: WorldDirectorState;
  populations: MonsterPopulation[];
  recentEncounters: EncounterRecord[];
  weekNumber: number;
  currentDate: Date;
}

export interface DirectorTickResult {
  updatedState: WorldDirectorState;
  evolutionResult: EvolutionCycleResult | null;
  newAdaptations: Array<{
    speciesId: string;
    regionId: string;
    adaptation: AdaptationType;
  }>;
  threatChanges: Array<{
    regionId: string;
    oldThreat: number;
    newThreat: number;
  }>;
}

// ============================================
// MAIN TICK FUNCTION
// ============================================

export function tickDirector(ctx: DirectorTickContext): DirectorTickResult {
  const state = structuredClone(ctx.directorState);
  const result: DirectorTickResult = {
    updatedState: state,
    evolutionResult: null,
    newAdaptations: [],
    threatChanges: [],
  };

  // Add new encounters to history
  state.recentEncounters.push(...ctx.recentEncounters);

  // Keep only last 100 encounters
  if (state.recentEncounters.length > 100) {
    state.recentEncounters = state.recentEncounters.slice(-100);
  }

  // ─────────────────────────────────────────
  // UPDATE SPECIES FITNESS
  // ─────────────────────────────────────────

  const speciesRegionPairs = new Set<string>();

  for (const encounter of ctx.recentEncounters) {
    for (const speciesId of encounter.monsterSide.speciesIds) {
      speciesRegionPairs.add(`${speciesId}:${encounter.regionId}`);
    }
  }

  for (const pair of speciesRegionPairs) {
    const [speciesId, regionId] = pair.split(":");

    const relevantEncounters = ctx.recentEncounters.filter(e =>
      e.monsterSide.speciesIds.includes(speciesId) &&
      e.regionId === regionId
    );

    if (relevantEncounters.length === 0) continue;

    const newFitness = calculateFitness(relevantEncounters, speciesId);

    let fitnessRecord = state.speciesFitness.find(f =>
      f.speciesId === speciesId && f.regionId === regionId
    );

    if (!fitnessRecord) {
      // Get species name from populations
      const pop = ctx.populations.find(p => p.speciesId === speciesId);

      fitnessRecord = {
        speciesId,
        speciesName: pop?.speciesName || speciesId,
        regionId,
        encounters: 0,
        victories: 0,
        defeats: 0,
        draws: 0,
        fitness: 1,
        adventurersKilled: 0,
        adventurersRouted: 0,
        totalDamageDealt: 0,
        averageSurvivalRounds: 0,
        averageSurvivalRate: 0,
        effectiveTactics: [],
        effectiveAbilities: [],
        countered: [],
        trend: "stable",
        lastUpdated: ctx.currentDate.toISOString(),
      };
      state.speciesFitness.push(fitnessRecord);
    }

    // Update stats
    fitnessRecord.encounters += relevantEncounters.length;

    for (const enc of relevantEncounters) {
      switch (enc.outcome) {
        case "party_defeat":
        case "party_retreat":
          fitnessRecord.victories++;
          break;
        case "party_victory":
          fitnessRecord.defeats++;
          break;
        default:
          fitnessRecord.draws++;
      }

      fitnessRecord.adventurersKilled += enc.casualties.adventurerDeaths;
      fitnessRecord.adventurersRouted += enc.outcome === "party_retreat" ? 1 : 0;
      fitnessRecord.totalDamageDealt += enc.effectiveness.damageDealtToParty;

      // Track effective tactics
      for (const tactic of enc.effectiveness.effectiveTactics) {
        const existing = fitnessRecord.effectiveTactics.find(t => t.tactic === tactic);
        if (existing) {
          existing.useCount++;
          existing.successRate = (existing.successRate * (existing.useCount - 1) + 1) / existing.useCount;
        } else {
          fitnessRecord.effectiveTactics.push({
            tactic,
            successRate: 1,
            useCount: 1,
          });
        }
      }

      // Track counters
      for (const counter of enc.effectiveness.countered) {
        const existing = fitnessRecord.countered.find(c => c.counter === counter);
        if (existing) {
          existing.effectiveness += 0.1;
        } else {
          fitnessRecord.countered.push({
            counter,
            effectiveness: 0.5,
          });
        }
      }

      // Update survival rounds average
      const oldTotal = fitnessRecord.averageSurvivalRounds * (fitnessRecord.encounters - 1);
      fitnessRecord.averageSurvivalRounds = (oldTotal + enc.effectiveness.roundsLasted) / fitnessRecord.encounters;
    }

    // Smooth fitness update (70% old, 30% new)
    fitnessRecord.fitness = fitnessRecord.fitness * 0.7 + newFitness * 0.3;

    // Determine trend
    if (newFitness > fitnessRecord.fitness * 1.1) {
      fitnessRecord.trend = "rising";
    } else if (newFitness < fitnessRecord.fitness * 0.9) {
      fitnessRecord.trend = "declining";
    } else {
      fitnessRecord.trend = "stable";
    }

    fitnessRecord.lastUpdated = ctx.currentDate.toISOString();
  }

  // ─────────────────────────────────────────
  // UPDATE VIOLENCE INDEX & THREAT LEVELS
  // ─────────────────────────────────────────

  const regionOutcomes = new Map<string, ThreatOutcome[]>();

  for (const encounter of ctx.recentEncounters) {
    const outcomes = regionOutcomes.get(encounter.regionId) || [];
    outcomes.push(encounter.outcome);
    regionOutcomes.set(encounter.regionId, outcomes);
  }

  for (const [regionId, outcomes] of regionOutcomes) {
    let threat = state.regionalThreats.find(t => t.regionId === regionId);

    if (!threat) {
      threat = {
        regionId,
        regionName: regionId, // Would get real name from context
        currentThreat: 5,
        baseThreat: 5,
        modifiers: [],
        violenceIndex: 5,
        history: [],
        dominantSpecies: [],
        activeAdaptations: [],
        lastUpdated: ctx.currentDate.toISOString(),
      };
      state.regionalThreats.push(threat);
    }

    // Adjust violence index
    for (const outcome of outcomes) {
      switch (outcome) {
        case "party_defeat":
          threat.violenceIndex = Math.min(10, threat.violenceIndex + 1);
          break;
        case "party_retreat":
          threat.violenceIndex = Math.min(10, threat.violenceIndex + 0.3);
          break;
        case "party_victory":
          threat.violenceIndex = Math.max(0, threat.violenceIndex - 0.5);
          break;
      }
    }

    // Natural decay
    threat.violenceIndex *= (1 - state.settings.violenceDecayRate);

    // Update threat level
    const oldThreat = threat.currentThreat;
    threat.currentThreat = adjustThreatLevel(
      threat.currentThreat,
      threat.violenceIndex,
      outcomes,
    );

    if (Math.abs(threat.currentThreat - oldThreat) > 0.5) {
      result.threatChanges.push({
        regionId,
        oldThreat,
        newThreat: threat.currentThreat,
      });
    }

    // Update dominant species
    const regionalFitness = state.speciesFitness.filter(f => f.regionId === regionId);
    threat.dominantSpecies = regionalFitness
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, 5)
      .map(f => {
        const pop = ctx.populations.find(p =>
          p.speciesId === f.speciesId && p.regionId === regionId
        );
        return {
          speciesId: f.speciesId,
          speciesName: f.speciesName,
          populationId: pop?.id || "",
          threatContribution: f.fitness * (pop?.count || 0) * 0.01,
          fitness: f.fitness,
        };
      });

    threat.lastUpdated = ctx.currentDate.toISOString();
  }

  // ─────────────────────────────────────────
  // UPDATE PARTY PROFILES
  // ─────────────────────────────────────────

  for (const encounter of ctx.recentEncounters) {
    let profile = state.partyProfiles.find(p =>
      p.partyId === encounter.adventurerSide.partyId
    );

    if (!profile) {
      profile = {
        partyId: encounter.adventurerSide.partyId,
        preferredDamageTypes: [],
        preferredTactics: [],
        weaknesses: [],
        totalEncounters: 0,
        victories: 0,
        averageEncounterDuration: 0,
        lastUpdated: ctx.currentDate.toISOString(),
      };
      state.partyProfiles.push(profile);
    }

    profile.totalEncounters++;

    if (encounter.outcome === "party_victory") {
      profile.victories++;
    }

    // Track what countered the party (their weaknesses)
    if (encounter.outcome === "party_defeat" || encounter.outcome === "party_retreat") {
      for (const tactic of encounter.effectiveness.effectiveTactics) {
        if (!profile.weaknesses.includes(tactic)) {
          profile.weaknesses.push(tactic);
        }
      }
    }

    // Update average duration
    const oldTotal = profile.averageEncounterDuration * (profile.totalEncounters - 1);
    profile.averageEncounterDuration = (oldTotal + encounter.effectiveness.roundsLasted) / profile.totalEncounters;

    profile.lastUpdated = ctx.currentDate.toISOString();
  }

  // ─────────────────────────────────────────
  // EVOLUTION CYCLE (Weekly)
  // ─────────────────────────────────────────

  if (state.settings.evolutionEnabled && ctx.weekNumber > state.lastEvolutionCycle) {
    const evolutionResult = runEvolutionCycle(state, ctx);
    result.evolutionResult = evolutionResult;
    result.newAdaptations = evolutionResult.adaptationsGranted.map(a => ({
      speciesId: a.speciesId,
      regionId: a.regionId,
      adaptation: a.adaptation,
    }));

    state.lastEvolutionCycle = ctx.weekNumber;
    state.evolutionHistory.push(evolutionResult);

    // Keep only last 52 cycles
    if (state.evolutionHistory.length > 52) {
      state.evolutionHistory = state.evolutionHistory.slice(-52);
    }
  }

  state.updatedAt = ctx.currentDate.toISOString();
  result.updatedState = state;

  return result;
}

// ============================================
// EVOLUTION CYCLE
// ============================================

function runEvolutionCycle(
  state: WorldDirectorState,
  ctx: DirectorTickContext,
): EvolutionCycleResult {
  const result: EvolutionCycleResult = {
    cycleWeek: ctx.weekNumber,
    processedAt: ctx.currentDate.toISOString(),
    fitnessChanges: [],
    populationAdjustments: [],
    adaptationsGranted: [],
    adaptationsRemoved: [],
    threatChanges: [],
    summary: "",
  };

  // ─────────────────────────────────────────
  // GRANT ADAPTATIONS TO HIGH-FITNESS SPECIES
  // ─────────────────────────────────────────

  for (const fitness of state.speciesFitness) {
    if (fitness.fitness < 1.2) continue;
    if (fitness.encounters < 3) continue;

    const partyProfile = state.partyProfiles[0];

    for (const adaptation of STANDARD_ADAPTATIONS) {
      // Check if already has this adaptation
      const existing = state.activeAdaptations.find(a =>
        a.speciesId === fitness.speciesId &&
        a.regionId === fitness.regionId &&
        a.adaptations.includes(adaptation.type)
      );

      if (existing) continue;

      // Check requirements
      if (fitness.fitness < adaptation.requirements.minFitness) continue;
      if (fitness.encounters < adaptation.requirements.minEncounters) continue;

      // Check triggers
      const triggered = adaptation.requirements.triggeredBy.length === 0 ||
        adaptation.requirements.triggeredBy.some(trigger => {
          if (partyProfile?.preferredDamageTypes.includes(trigger)) return true;
          if (partyProfile?.preferredTactics.includes(trigger)) return true;
          if (fitness.effectiveTactics.some(t => t.tactic === trigger)) return true;
          return false;
        });

      if (!triggered) continue;

      // Roll for adaptation
      const adaptChance = adaptation.spreadChance * state.settings.adaptationRate;
      if (Math.random() > adaptChance) continue;

      // Grant adaptation
      let activeAdapt = state.activeAdaptations.find(a =>
        a.speciesId === fitness.speciesId &&
        a.regionId === fitness.regionId
      );

      if (!activeAdapt) {
        activeAdapt = {
          speciesId: fitness.speciesId,
          regionId: fitness.regionId,
          adaptations: [],
          grantedAt: ctx.currentDate.toISOString(),
        };
        state.activeAdaptations.push(activeAdapt);
      }

      activeAdapt.adaptations.push(adaptation.type);

      result.adaptationsGranted.push({
        speciesId: fitness.speciesId,
        regionId: fitness.regionId,
        adaptation: adaptation.type,
        reason: `High fitness (${fitness.fitness.toFixed(2)})`,
      });

      // Update population director data
      const pop = ctx.populations.find(p =>
        p.speciesId === fitness.speciesId &&
        p.regionId === fitness.regionId
      );
      if (pop) {
        pop.directorData.adaptations.push(adaptation.type);
      }

      // Only one adaptation per cycle per species
      break;
    }
  }

  // ─────────────────────────────────────────
  // REMOVE ADAPTATIONS FROM LOW-FITNESS SPECIES
  // ─────────────────────────────────────────

  for (const fitness of state.speciesFitness) {
    if (fitness.fitness >= 0.8) continue;

    const activeAdapt = state.activeAdaptations.find(a =>
      a.speciesId === fitness.speciesId &&
      a.regionId === fitness.regionId
    );

    if (!activeAdapt || activeAdapt.adaptations.length === 0) continue;

    // Remove random adaptation
    const removedIdx = Math.floor(Math.random() * activeAdapt.adaptations.length);
    const removed = activeAdapt.adaptations.splice(removedIdx, 1)[0];

    result.adaptationsRemoved.push({
      speciesId: fitness.speciesId,
      regionId: fitness.regionId,
      adaptation: removed,
      reason: `Low fitness (${fitness.fitness.toFixed(2)})`,
    });

    // Update population director data
    const pop = ctx.populations.find(p =>
      p.speciesId === fitness.speciesId &&
      p.regionId === fitness.regionId
    );
    if (pop) {
      pop.directorData.adaptations = pop.directorData.adaptations.filter(a => a !== removed);
    }
  }

  // ─────────────────────────────────────────
  // ADJUST SPAWN WEIGHTS
  // ─────────────────────────────────────────

  for (const pop of ctx.populations) {
    const fitness = state.speciesFitness.find(f =>
      f.speciesId === pop.speciesId &&
      f.regionId === pop.regionId
    );

    if (!fitness) continue;

    const spawnWeightChange = (fitness.fitness - 1) * 0.1;

    if (Math.abs(spawnWeightChange) > 0.02) {
      result.populationAdjustments.push({
        populationId: pop.id,
        speciesId: pop.speciesId,
        regionId: pop.regionId,
        spawnWeightChange,
        reason: `Fitness: ${fitness.fitness.toFixed(2)}`,
      });

      // Apply to population
      pop.directorData.fitness = fitness.fitness;
    }
  }

  // ─────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────

  const parts: string[] = [];

  if (result.adaptationsGranted.length > 0) {
    parts.push(`${result.adaptationsGranted.length} adaptation(s) evolved`);
  }

  if (result.adaptationsRemoved.length > 0) {
    parts.push(`${result.adaptationsRemoved.length} adaptation(s) lost`);
  }

  if (result.threatChanges.length > 0) {
    const increased = result.threatChanges.filter(t => t.newThreat > t.previousThreat).length;
    const decreased = result.threatChanges.length - increased;
    if (increased > 0) parts.push(`threat increased in ${increased} region(s)`);
    if (decreased > 0) parts.push(`threat decreased in ${decreased} region(s)`);
  }

  result.summary = parts.length > 0 ? parts.join(", ") : "No significant changes";

  return result;
}

// ============================================
// ENCOUNTER RECORDING
// ============================================

export function recordEncounter(
  state: WorldDirectorState,
  encounter: Omit<EncounterRecord, "id">,
): EncounterRecord {
  const record: EncounterRecord = {
    ...encounter,
    id: crypto.randomUUID(),
  };

  state.recentEncounters.push(record);

  return record;
}

// ============================================
// GET SPECIES ADAPTATIONS
// ============================================

export function getSpeciesAdaptations(
  state: WorldDirectorState,
  speciesId: string,
  regionId: string,
): AdaptationType[] {
  const active = state.activeAdaptations.find(a =>
    a.speciesId === speciesId &&
    a.regionId === regionId
  );

  return active?.adaptations || [];
}

// ============================================
// GET REGIONAL THREAT
// ============================================

export function getRegionalThreat(
  state: WorldDirectorState,
  regionId: string,
): RegionalThreatLevel | undefined {
  return state.regionalThreats.find(t => t.regionId === regionId);
}

// ============================================
// GET SPECIES FITNESS
// ============================================

export function getSpeciesFitness(
  state: WorldDirectorState,
  speciesId: string,
  regionId: string,
): SpeciesFitness | undefined {
  return state.speciesFitness.find(f =>
    f.speciesId === speciesId &&
    f.regionId === regionId
  );
}

// ============================================
// APPLY ADAPTATION EFFECTS
// ============================================

export interface AdaptationEffects {
  hpMultiplier: number;
  damageMultiplier: number;
  acBonus: number;
  crIncrease: number;
  newAbilities: string[];
  behaviorChanges: string[];
}

export function calculateAdaptationEffects(
  adaptations: AdaptationType[],
): AdaptationEffects {
  const effects: AdaptationEffects = {
    hpMultiplier: 1,
    damageMultiplier: 1,
    acBonus: 0,
    crIncrease: 0,
    newAbilities: [],
    behaviorChanges: [],
  };

  for (const adaptationType of adaptations) {
    const adaptation = STANDARD_ADAPTATIONS.find(a => a.type === adaptationType);
    if (!adaptation) continue;

    effects.hpMultiplier *= adaptation.effects.hpMultiplier;
    effects.damageMultiplier *= adaptation.effects.damageMultiplier;
    effects.acBonus += adaptation.effects.acBonus;
    effects.crIncrease += adaptation.effects.crIncrease;
    effects.newAbilities.push(...adaptation.effects.newAbilities);
    effects.behaviorChanges.push(...adaptation.effects.behaviorChanges);
  }

  return effects;
}
