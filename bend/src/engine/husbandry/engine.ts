/**
 * HUSBANDRY SYSTEM - Main Engine
 *
 * Core tick engine for processing husbandry operations.
 * Calculates yields, applies care effects, and generates events.
 *
 * INVARIANTS:
 * - Slaughter count is the primary conserved quantity (meat derived from count)
 * - Canonical time must be explicitly provided (no wall-clock defaults)
 * - Deterministic RNG is mandatory for any tick that emits deltas
 * - Outputs are quantities, not prices (economy layer handles pricing)
 */

import type {
  Ranch,
  Herd,
  HusbandryOperation,
  LivestockSpecies,
  Season,
  HusbandryTickResult,
  HusbandryEventType,
  EventSeverity,
} from './schema';
import {
  PASTURE_QUALITY_MULTIPLIERS,
  SHELTER_QUALITY_MULTIPLIERS,
  SEASON_MODIFIERS,
} from './schema';
import { calculateCareQuality, calculateFeedQuality } from './operations';
import { calculateNewPregnancies, processDueBirths, progressAges } from './reproduction';
import {
  calculateNaturalMortality,
  calculateWinterAttrition,
  calculateHealthRecovery,
  checkForDiseaseOutbreak,
  checkForPredatorAttack,
} from './mortality';

// ============================================
// SEEDED RNG
// ============================================

/**
 * Simple seeded RNG for deterministic simulation.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Derive a deterministic seed from canonical identifiers.
 * Use this when no explicit seed is provided.
 */
export function deriveSeed(worldDay: number, ranchId: string, herdId: string): number {
  // Simple hash combining the inputs
  let hash = worldDay;
  for (let i = 0; i < ranchId.length; i++) {
    hash = ((hash << 5) - hash) + ranchId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  for (let i = 0; i < herdId.length; i++) {
    hash = ((hash << 5) - hash) + herdId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================
// HUSBANDRY ENGINE
// ============================================

export class HusbandryEngine {
  /**
   * Main tick function - processes N days of husbandry.
   * Called when ranch is observed/scheduled/touched.
   *
   * INVARIANT: worldDay and rngSeed are REQUIRED. No wall-clock or Math.random fallbacks.
   */
  static tick(
    ranch: Ranch,
    herd: Herd,
    operation: HusbandryOperation,
    species: LivestockSpecies,
    worldDay: number,
    rngSeed: number,
    daysElapsed: number = 1,
    feedAvailable: Record<string, number> = {},
    currentSeason: Season = 'summer',
  ): HusbandryTickResult {
    // Deterministic RNG - no Math.random fallback
    const rng = createSeededRng(rngSeed);

    const events: Array<{
      type: HusbandryEventType;
      description: string;
      severity?: EventSeverity;
      data?: Record<string, unknown>;
    }> = [];

    // Track initial state
    let currentAgeDistribution = { ...herd.ageDistribution };
    let currentHealthState = { ...herd.healthState };
    let currentStressState = { ...herd.stressState };

    // 1. Calculate care and feed quality
    const careQuality = calculateCareQuality(operation, herd, species);
    const feedQuality = calculateFeedQuality(operation, herd, species);

    // Calculate feed consumption
    const dailyFeedRequired = species.careRequirements.feedPerDay * herd.count;
    const totalFeedRequired = dailyFeedRequired * daysElapsed;
    const feedConsumed: Record<string, number> = {};

    let feedSufficiency = 1.0;
    if (operation.feedSource === 'stockpile' || operation.feedSource === 'market') {
      // Check if enough feed is available
      const totalFeedAvailable = Object.values(feedAvailable).reduce((a, b) => a + b, 0);
      feedSufficiency = Math.min(1, totalFeedAvailable / totalFeedRequired);

      // Consume from available feeds
      let remaining = totalFeedRequired;
      for (const [feedType, amount] of Object.entries(feedAvailable)) {
        const consumed = Math.min(amount, remaining);
        feedConsumed[feedType] = consumed;
        remaining -= consumed;
        if (remaining <= 0) break;
      }

      if (feedSufficiency < 0.8) {
        events.push({
          type: 'FEED_SHORTAGE',
          description: `Feed shortage: ${Math.round(feedSufficiency * 100)}% of required feed available`,
          severity: feedSufficiency < 0.5 ? 'danger' : 'warning',
          data: { feedSufficiency, shortfall: totalFeedRequired - totalFeedAvailable },
        });
      }
    } else if (operation.feedSource === 'pasture') {
      // Pasture provides free feed based on quality
      const pastureMultiplier = PASTURE_QUALITY_MULTIPLIERS[ranch.pastureQuality];
      feedSufficiency = Math.min(1.2, pastureMultiplier);
    }

    // 2. Apply care effects to stress
    if (careQuality < 0.7) {
      currentStressState.careNeglect = Math.min(100, currentStressState.careNeglect + 10 * (0.7 - careQuality));
      events.push({
        type: 'CARE_MISSED',
        description: 'Insufficient care provided to herd',
        severity: 'warning',
        data: { careQuality },
      });
    } else {
      currentStressState.careNeglect = Math.max(0, currentStressState.careNeglect - 5);
    }

    // Check for overcrowding
    const capacityUtilization = ranch.currentOccupancy / ranch.totalCapacity;
    if (capacityUtilization > 1) {
      currentStressState.overcrowding = Math.min(100, (capacityUtilization - 1) * 100);
    } else {
      currentStressState.overcrowding = Math.max(0, currentStressState.overcrowding - 10);
    }

    // Calculate overall stress
    currentStressState.overall = Math.min(100, (
      currentStressState.overcrowding +
      currentStressState.predatorFear +
      currentStressState.careNeglect
    ) / 3);

    // 3. Apply mortality
    const mortalityResult = calculateNaturalMortality(
      { ...herd, ageDistribution: currentAgeDistribution, healthState: currentHealthState },
      species,
      daysElapsed,
      currentSeason,
      feedSufficiency,
      careQuality,
      rng
    );

    let totalDeaths = mortalityResult.totalDeaths;
    currentAgeDistribution = mortalityResult.newAgeDistribution;

    if (totalDeaths > 0) {
      events.push({
        type: 'ANIMAL_DIED',
        description: `${totalDeaths} animals died from natural causes`,
        severity: totalDeaths > 5 ? 'danger' : 'warning',
        data: { deaths: totalDeaths, causes: mortalityResult.causes },
      });
    }

    // Winter attrition
    if (currentSeason === 'winter') {
      const shelterMod = SHELTER_QUALITY_MULTIPLIERS[ranch.shelterQuality];
      const winterResult = calculateWinterAttrition(
        { ...herd, ageDistribution: currentAgeDistribution },
        species,
        daysElapsed,
        shelterMod,
        feedSufficiency,
        rng
      );

      if (winterResult.deaths > 0) {
        totalDeaths += winterResult.deaths;
        currentAgeDistribution = winterResult.newAgeDistribution;
        events.push({
          type: 'WINTER_ATTRITION',
          description: `${winterResult.deaths} animals lost to winter conditions`,
          severity: winterResult.deaths > 3 ? 'danger' : 'warning',
          data: { deaths: winterResult.deaths },
        });
      }
    }

    // Check for predator attacks
    const isWilderness = !ranch.hubId && !!ranch.worldNodeId;
    const securityMod = {
      none: 0,
      basic: 0.3,
      guarded: 0.6,
      fortified: 0.9,
    }[ranch.securityLevel];

    const predatorCheck = checkForPredatorAttack(securityMod, isWilderness, currentSeason, rng);
    if (predatorCheck.attack && predatorCheck.predatorType) {
      const { calculatePredatorAttack } = require('./mortality');
      const attackResult = calculatePredatorAttack(
        { ...herd, ageDistribution: currentAgeDistribution },
        securityMod,
        isWilderness,
        predatorCheck.predatorType,
        rng
      );

      if (attackResult.losses > 0) {
        totalDeaths += attackResult.losses;
        currentAgeDistribution = attackResult.newAgeDistribution;
        currentStressState.predatorFear = Math.min(100, currentStressState.predatorFear + 30);
        events.push({
          type: 'PREDATOR_ATTACK',
          description: `${attackResult.losses} animals lost to ${predatorCheck.predatorType}`,
          severity: 'danger',
          data: { losses: attackResult.losses, predatorType: predatorCheck.predatorType },
        });
      }
    } else {
      currentStressState.predatorFear = Math.max(0, currentStressState.predatorFear - 5);
    }

    // Check for disease
    const diseaseCheck = checkForDiseaseOutbreak(
      { ...herd, ageDistribution: currentAgeDistribution, healthState: currentHealthState, stressState: currentStressState } as Herd,
      species,
      careQuality,
      capacityUtilization,
      rng
    );

    if (diseaseCheck.outbreak && diseaseCheck.diseaseId) {
      events.push({
        type: 'DISEASE_OUTBREAK',
        description: `Disease outbreak: ${diseaseCheck.diseaseId}`,
        severity: 'danger',
        data: { diseaseId: diseaseCheck.diseaseId, severity: diseaseCheck.severity },
      });
      currentHealthState.overall = Math.max(50, currentHealthState.overall - 20);
    }

    // 4. Process reproduction
    let births = 0;
    if (operation.mode === 'BREEDING' || operation.mode === 'MIXED') {
      // Process due births
      const birthResult = processDueBirths(
        { ...herd, ageDistribution: currentAgeDistribution, healthState: currentHealthState } as Herd,
        species,
        worldDay,
        currentHealthState,
        careQuality,
        rng
      );

      if (birthResult.survivingBirths > 0) {
        births = birthResult.survivingBirths;
        currentAgeDistribution.infants += births;
        events.push({
          type: 'HERD_BORN',
          description: `${births} new animals born`,
          severity: 'info',
          data: { births, infantDeaths: birthResult.infantDeaths },
        });
      }

      // Calculate new pregnancies
      const pregnancyResult = calculateNewPregnancies(
        { ...herd, ageDistribution: currentAgeDistribution } as Herd,
        species,
        currentSeason,
        careQuality,
        worldDay,
        rng
      );

      if (pregnancyResult.newPregnancies > 0) {
        events.push({
          type: 'BREEDING_SUCCESS',
          description: `${pregnancyResult.newPregnancies} successful breedings`,
          severity: 'info',
          data: pregnancyResult as unknown as Record<string, unknown>,
        });
      }
    }

    // Age progression (weekly)
    if (daysElapsed >= 7) {
      const weeksElapsed = Math.floor(daysElapsed / 7);
      const ageResult = progressAges(currentAgeDistribution, species, weeksElapsed, rng);
      currentAgeDistribution = ageResult.newAgeDistribution;
    }

    // 5. Calculate yields based on operation mode
    // INVARIANT: For MEAT mode, slaughter count is conserved first, then meat derived from count.
    let slaughtered = 0;

    // Handle slaughter FIRST for MEAT mode (conservation invariant)
    if (operation.mode === 'MEAT' && species.yieldProfiles.meat) {
      // Slaughter rate based on operation intensity: 2% per day at full operation
      const slaughterRate = 0.02;
      slaughtered = Math.floor(currentAgeDistribution.adults * slaughterRate * daysElapsed);

      if (slaughtered > 0) {
        // Remove slaughtered from herd BEFORE yield calculation
        const fromAdults = Math.min(slaughtered, currentAgeDistribution.adults);
        currentAgeDistribution.adults -= fromAdults;
        currentAgeDistribution.breedingEligible = Math.floor(currentAgeDistribution.adults * 0.5);
      }
    }

    // Now compute yields (for MEAT mode, computeYield receives the slaughter count)
    const output = HusbandryEngine.computeYield(
      { ...herd, ageDistribution: currentAgeDistribution, healthState: currentHealthState } as Herd,
      species,
      operation,
      daysElapsed,
      careQuality,
      feedQuality,
      currentSeason,
      rng,
      slaughtered // Pass slaughter count for MEAT mode derivation
    );

    // Emit slaughter event after yield computation (so we have meat/hide numbers)
    if (operation.mode === 'MEAT' && slaughtered > 0) {
      events.push({
        type: 'HERD_SLAUGHTERED',
        description: `${slaughtered} animals slaughtered for meat`,
        severity: 'info',
        data: { slaughtered, meatYield: output.meat ?? 0, hideYield: output.hides ?? 0 },
      });
    }

    // Emit yield event
    if (Object.values(output).some(v => v > 0)) {
      events.push({
        type: 'YIELD_COLLECTED',
        description: 'Production collected from herd',
        severity: 'info',
        data: { yields: output },
      });
    }

    // 6. Health recovery
    currentHealthState = calculateHealthRecovery(
      currentHealthState,
      careQuality,
      feedSufficiency,
      daysElapsed
    );

    // Calculate new population
    const newPopulation =
      currentAgeDistribution.infants +
      currentAgeDistribution.juveniles +
      currentAgeDistribution.adults +
      currentAgeDistribution.elders;

    // INVARIANT: No pricing authority here - output quantities only.
    // Economy layer handles pricing separately.
    return {
      ranchId: ranch.id,
      operationId: operation.id,
      herdId: herd.id,
      worldDay,
      output,
      births,
      deaths: totalDeaths,
      slaughtered,
      newPopulation,
      feedConsumed,
      laborUsed: ranch.totalWorkers * daysElapsed,
      events,
      newHealthState: currentHealthState,
      newStressState: currentStressState,
      newAgeDistribution: currentAgeDistribution,
      daysProcessed: daysElapsed,
    };
  }

  /**
   * Compute yield for a specific operation mode.
   *
   * INVARIANT: For MEAT mode, slaughterCount is the conserved primary quantity.
   * Meat/hides/tallow are derived from slaughterCount, never the reverse.
   */
  static computeYield(
    herd: Herd,
    species: LivestockSpecies,
    operation: HusbandryOperation,
    daysElapsed: number,
    careQuality: number,
    feedQuality: number,
    season: Season,
    _rng: () => number,
    slaughterCount: number = 0
  ): Record<string, number> {
    const output: Record<string, number> = {};
    const profiles = species.yieldProfiles;

    const seasonMod = SEASON_MODIFIERS[season].yield;
    const qualityMod = careQuality * feedQuality * seasonMod;
    const healthMod = herd.healthState.overall / 100;
    const stressMod = 1 - (herd.stressState.overall / 200);

    const totalMod = qualityMod * healthMod * stressMod;

    switch (operation.mode) {
      case 'DAIRY':
        if (profiles.milk) {
          // Assume 30% of adults are lactating
          const lactatingCount = Math.floor(herd.ageDistribution.adults * 0.3);
          output.milk = lactatingCount * profiles.milk.perDay * daysElapsed * totalMod;

          // Optional: cheese production
          if (profiles.milk.cheeseRatio) {
            output.cheese = output.milk / profiles.milk.cheeseRatio * 0.1; // 10% goes to cheese
          }
        }
        // Manure always produced
        if (profiles.manure) {
          output.manure = herd.count * profiles.manure.perDay * daysElapsed;
        }
        break;

      case 'MEAT':
        // INVARIANT: slaughterCount is the conserved primary; meat/hides/tallow derived from it
        if (profiles.meat && slaughterCount > 0) {
          // Derive meat from slaughter count (quality modifiers apply to yield per animal)
          output.meat = slaughterCount * profiles.meat.perUnit * totalMod;
          output.slaughteredCount = slaughterCount; // Record conserved quantity
          if (profiles.meat.hideYield) {
            output.hides = slaughterCount * profiles.meat.hideYield;
          }
          if (profiles.meat.tallowYield) {
            output.tallow = slaughterCount * profiles.meat.tallowYield;
          }
        }
        break;

      case 'WOOL':
        if (profiles.wool) {
          // Shearing happens at intervals
          const shearingIntervalDays = 365 / profiles.wool.shearingsPerYear;
          const shearingsDue = Math.floor(daysElapsed / shearingIntervalDays);
          if (shearingsDue > 0) {
            output.wool = herd.ageDistribution.adults * profiles.wool.perShearing * shearingsDue * totalMod;
          }
        }
        if (profiles.manure) {
          output.manure = herd.count * profiles.manure.perDay * daysElapsed;
        }
        break;

      case 'EGGS':
        if (profiles.eggs) {
          // Laying rate
          const layingCount = Math.floor(herd.ageDistribution.adults * 0.8);
          output.eggs = layingCount * profiles.eggs.perDay * daysElapsed * totalMod;
        }
        if (profiles.manure) {
          output.manure = herd.count * profiles.manure.perDay * daysElapsed;
        }
        break;

      case 'DRAFT':
        if (profiles.labor) {
          // Draft labor output (abstract labor hours)
          const workAnimals = herd.ageDistribution.adults;
          output.laborHours = workAnimals * profiles.labor.workHoursPerDay * daysElapsed * totalMod;
        }
        if (profiles.manure) {
          output.manure = herd.count * profiles.manure.perDay * daysElapsed;
        }
        break;

      case 'BREEDING':
        // Breeding mode focuses on reproduction, minimal other output
        if (profiles.manure) {
          output.manure = herd.count * profiles.manure.perDay * daysElapsed;
        }
        break;

      case 'MIXED':
        // Balanced output at reduced rates
        if (profiles.milk) {
          const lactatingCount = Math.floor(herd.ageDistribution.adults * 0.2);
          output.milk = lactatingCount * profiles.milk.perDay * daysElapsed * totalMod * 0.7;
        }
        if (profiles.wool) {
          const shearingIntervalDays = 365 / profiles.wool.shearingsPerYear;
          const shearingsDue = Math.floor(daysElapsed / shearingIntervalDays);
          if (shearingsDue > 0) {
            output.wool = herd.ageDistribution.adults * profiles.wool.perShearing * shearingsDue * totalMod * 0.7;
          }
        }
        if (profiles.eggs) {
          const layingCount = Math.floor(herd.ageDistribution.adults * 0.6);
          output.eggs = layingCount * profiles.eggs.perDay * daysElapsed * totalMod * 0.7;
        }
        if (profiles.manure) {
          output.manure = herd.count * profiles.manure.perDay * daysElapsed;
        }
        break;
    }

    // Round all outputs
    for (const key in output) {
      output[key] = Math.round(output[key] * 100) / 100;
    }

    return output;
  }

  /**
   * Estimate potential yield for planning.
   */
  static estimatePotentialYield(
    species: LivestockSpecies,
    herdSize: number,
    mode: string,
    careQuality: number = 1
  ): { perDay: Record<string, number>; perWeek: Record<string, number> } {
    const mockHerd = {
      count: herdSize,
      ageDistribution: {
        infants: Math.floor(herdSize * 0.1),
        juveniles: Math.floor(herdSize * 0.2),
        adults: Math.floor(herdSize * 0.6),
        elders: Math.floor(herdSize * 0.1),
        breedingEligible: Math.floor(herdSize * 0.3),
      },
      healthState: { overall: 100, diseased: 0, injured: 0, malnourished: 0 },
      stressState: { overall: 0, overcrowding: 0, predatorFear: 0, careNeglect: 0 },
    } as unknown as Herd;

    const mockOperation = { mode } as HusbandryOperation;

    const perDay = HusbandryEngine.computeYield(
      mockHerd,
      species,
      mockOperation,
      1,
      careQuality,
      careQuality,
      'summer',
      Math.random
    );

    const perWeek: Record<string, number> = {};
    for (const [key, value] of Object.entries(perDay)) {
      perWeek[key] = value * 7;
    }

    return { perDay, perWeek };
  }
}
