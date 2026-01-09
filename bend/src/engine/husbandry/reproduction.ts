/**
 * HUSBANDRY SYSTEM - Reproduction Logic
 *
 * Breeding and birth calculations for livestock.
 */

import type {
  Herd,
  LivestockSpecies,
  Season,
  HealthState,
  AgeDistribution,
  ExpectedBirth,
} from './schema';
import { SEASON_MODIFIERS } from './schema';

// ============================================
// BREEDING ELIGIBILITY
// ============================================

/**
 * Check if breeding is possible in current season.
 */
export function canBreedInSeason(
  species: LivestockSpecies,
  season: Season
): boolean {
  const breedingSeason = species.reproductionProfile.breedingSeason;

  if (breedingSeason === 'year_round') return true;
  if (breedingSeason === 'seasonal') {
    return season === 'spring' || season === 'fall';
  }
  return breedingSeason === season;
}

/**
 * Get number of breeding-eligible animals (adults not currently pregnant).
 */
export function getBreedingEligible(herd: Herd): number {
  return herd.ageDistribution.breedingEligible;
}

/**
 * Calculate breeding success rate based on conditions.
 */
export function calculateBreedingSuccessRate(
  _species: LivestockSpecies,
  herd: Herd,
  season: Season,
  careQuality: number
): number {
  let baseRate = 0.7; // 70% base conception rate

  // Health modifier
  const healthMod = herd.healthState.overall / 100;

  // Stress modifier (high stress reduces breeding)
  const stressMod = 1 - (herd.stressState.overall / 200);

  // Season modifier
  const seasonMod = SEASON_MODIFIERS[season].breeding;

  // Care quality modifier
  const careMod = Math.min(1.2, careQuality);

  return baseRate * healthMod * stressMod * seasonMod * careMod;
}

// ============================================
// PREGNANCY CALCULATION
// ============================================

export interface PregnancyResult {
  newPregnancies: number;
  failedBreedings: number;
  dueDayOffset: number;  // Days from worldDay until birth
  expectedOffspring: number;
}

/**
 * Calculate new pregnancies for a breeding cycle.
 *
 * INVARIANT: rng is REQUIRED - no Math.random fallback.
 * INVARIANT: worldDay is canonical time, not wall-clock.
 */
export function calculateNewPregnancies(
  herd: Herd,
  species: LivestockSpecies,
  season: Season,
  careQuality: number,
  _worldDay: number,
  rng: () => number
): PregnancyResult {
  // Check if breeding is possible
  if (!herd.breedingEnabled) {
    return { newPregnancies: 0, failedBreedings: 0, dueDayOffset: 0, expectedOffspring: 0 };
  }

  if (!canBreedInSeason(species, season)) {
    return { newPregnancies: 0, failedBreedings: 0, dueDayOffset: 0, expectedOffspring: 0 };
  }

  const breedingEligible = getBreedingEligible(herd);
  if (breedingEligible === 0) {
    return { newPregnancies: 0, failedBreedings: 0, dueDayOffset: 0, expectedOffspring: 0 };
  }

  // Exclude already pregnant
  const availableForBreeding = breedingEligible - herd.pregnantCount;
  if (availableForBreeding <= 0) {
    return { newPregnancies: 0, failedBreedings: 0, dueDayOffset: 0, expectedOffspring: 0 };
  }

  const successRate = calculateBreedingSuccessRate(species, herd, season, careQuality);

  // Roll for each potential breeding
  let newPregnancies = 0;
  for (let i = 0; i < availableForBreeding; i++) {
    if (rng() < successRate) {
      newPregnancies++;
    }
  }

  const failedBreedings = availableForBreeding - newPregnancies;

  // Calculate due day offset (canonical days, not wall-clock)
  const dueDayOffset = species.reproductionProfile.gestationWeeks * 7;

  // Calculate expected offspring
  const repro = species.reproductionProfile;
  const avgOffspring = (repro.offspringMin + repro.offspringMax) / 2;
  const expectedOffspring = Math.round(newPregnancies * avgOffspring);

  return {
    newPregnancies,
    failedBreedings,
    dueDayOffset,
    expectedOffspring,
  };
}

// ============================================
// BIRTH PROCESSING
// ============================================

export interface BirthResult {
  totalBirths: number;
  survivingBirths: number;
  infantDeaths: number;
  mothersCompleted: number;
}

/**
 * Process births from expected births list.
 *
 * INVARIANT: rng is REQUIRED - no Math.random fallback.
 * INVARIANT: worldDay is canonical time, not wall-clock.
 */
export function processDueBirths(
  herd: Herd,
  species: LivestockSpecies,
  worldDay: number,
  healthState: HealthState,
  careQuality: number,
  rng: () => number
): BirthResult {
  let totalBirths = 0;
  let survivingBirths = 0;
  let infantDeaths = 0;
  let mothersCompleted = 0;

  for (const expectedBirth of herd.expectedBirths) {
    // Use dueWorldDay (canonical world time)
    const dueDay = expectedBirth.dueWorldDay;

    if (dueDay <= worldDay) {
      mothersCompleted++;

      // Calculate actual births (may vary from expected)
      const repro = species.reproductionProfile;
      const minOffspring = repro.offspringMin;
      const maxOffspring = repro.offspringMax;

      // Roll for actual offspring count
      const actualOffspring = Math.floor(
        minOffspring + rng() * (maxOffspring - minOffspring + 1)
      );

      // Check for twins if applicable
      let birthCount = actualOffspring;
      if (repro.twinRate && rng() < repro.twinRate) {
        birthCount = Math.min(maxOffspring, birthCount + 1);
      }

      totalBirths += birthCount;

      // Apply infant mortality
      const mortalityRate = species.mortalityProfile.infantMortalityRate;
      const healthMod = healthState.overall / 100;
      const careMod = Math.min(1.0, careQuality);

      const adjustedMortality = mortalityRate / (healthMod * careMod);

      for (let i = 0; i < birthCount; i++) {
        if (rng() < adjustedMortality) {
          infantDeaths++;
        } else {
          survivingBirths++;
        }
      }
    }
  }

  return {
    totalBirths,
    survivingBirths,
    infantDeaths,
    mothersCompleted,
  };
}

/**
 * Get remaining expected births after processing.
 *
 * INVARIANT: worldDay is canonical time, not wall-clock.
 */
export function getRemainingExpectedBirths(
  expectedBirths: ExpectedBirth[],
  worldDay: number
): ExpectedBirth[] {
  return expectedBirths.filter(eb => eb.dueWorldDay > worldDay);
}

// ============================================
// AGE PROGRESSION
// ============================================

export interface AgeProgressionResult {
  newAgeDistribution: AgeDistribution;
  infantsMatured: number;
  juvenilesMatured: number;
  adultsAged: number;
}

/**
 * Progress age distribution over time.
 * Call this on weekly or monthly basis.
 *
 * INVARIANT: rng is REQUIRED - no Math.random fallback.
 */
export function progressAges(
  ageDistribution: AgeDistribution,
  species: LivestockSpecies,
  weeksElapsed: number,
  _rng: () => number
): AgeProgressionResult {
  const result: AgeDistribution = { ...ageDistribution };
  let infantsMatured = 0;
  let juvenilesMatured = 0;
  let adultsAged = 0;

  // Approximate maturation rates
  // Infants mature to juveniles after ~8 weeks
  // Juveniles mature to adults at breeding age
  // Adults become elders after ~70% of lifespan

  const repro = species.reproductionProfile;
  const mortality = species.mortalityProfile;

  // Weekly maturation rate for infants (roughly 8 weeks to juvenile)
  const infantMaturationRate = weeksElapsed / 8;

  // Weekly maturation rate for juveniles
  const weeksToAdult = repro.breedingAgeWeeks - 8; // Subtract infant phase
  const juvenileMaturationRate = weeksElapsed / weeksToAdult;

  // Weekly aging rate for adults to elders
  const weeksToElder = mortality.baseLifespanYears * 52 * 0.7;
  const adultAgingRate = weeksElapsed / weeksToElder;

  // Process maturation
  if (result.infants > 0) {
    const toMature = Math.floor(result.infants * infantMaturationRate);
    infantsMatured = Math.min(result.infants, toMature);
    result.infants -= infantsMatured;
    result.juveniles += infantsMatured;
  }

  if (result.juveniles > 0) {
    const toMature = Math.floor(result.juveniles * juvenileMaturationRate);
    juvenilesMatured = Math.min(result.juveniles, toMature);
    result.juveniles -= juvenilesMatured;
    result.adults += juvenilesMatured;

    // Update breeding count (assume 50% of adults are breeding females)
    result.breedingEligible = Math.floor(result.adults * 0.5);
  }

  if (result.adults > 0) {
    const toAge = Math.floor(result.adults * adultAgingRate);
    adultsAged = Math.min(result.adults, toAge);
    result.adults -= adultsAged;
    result.elders += adultsAged;

    // Update breeding count
    result.breedingEligible = Math.floor(result.adults * 0.5);
  }

  return {
    newAgeDistribution: result,
    infantsMatured,
    juvenilesMatured,
    adultsAged,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Estimate time until next breeding window.
 */
export function getNextBreedingWindow(
  species: LivestockSpecies,
  currentSeason: Season
): { season: Season; weeksAway: number } {
  const breedingSeason = species.reproductionProfile.breedingSeason;

  if (breedingSeason === 'year_round') {
    return { season: currentSeason, weeksAway: 0 };
  }

  const seasonOrder: Season[] = ['spring', 'summer', 'fall', 'winter'];
  const currentIndex = seasonOrder.indexOf(currentSeason);

  const targetSeasons = breedingSeason === 'seasonal'
    ? ['spring', 'fall']
    : [breedingSeason];

  for (let i = 0; i < 4; i++) {
    const checkIndex = (currentIndex + i) % 4;
    const checkSeason = seasonOrder[checkIndex];
    if (targetSeasons.includes(checkSeason)) {
      return { season: checkSeason, weeksAway: i * 13 };
    }
  }

  return { season: currentSeason, weeksAway: 0 };
}

/**
 * Estimate herd growth rate.
 */
export function estimateAnnualGrowthRate(
  species: LivestockSpecies,
  breedingFemales: number,
  careQuality: number = 1.0
): number {
  const repro = species.reproductionProfile;
  const mortality = species.mortalityProfile;

  // Births per year
  const gestationsPerYear = 52 / repro.gestationWeeks;
  const avgOffspring = (repro.offspringMin + repro.offspringMax) / 2;
  const birthsPerYear = breedingFemales * gestationsPerYear * avgOffspring * 0.7 * careQuality;

  // Deaths per year (rough estimate)
  const deathRate = mortality.adultMortalityRate + mortality.infantMortalityRate * 0.3;

  return birthsPerYear - (breedingFemales * 2 * deathRate);
}
