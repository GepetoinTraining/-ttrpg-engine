/**
 * HUSBANDRY SYSTEM - Mortality Logic
 *
 * Death, disease, and attrition calculations for livestock.
 *
 * INVARIANT: All functions requiring randomness take rng as a REQUIRED parameter.
 * No Math.random fallbacks - deterministic RNG is mandatory.
 */

import type {
  Herd,
  LivestockSpecies,
  Season,
  HealthState,
  AgeDistribution,
} from './schema';
import { SEASON_MODIFIERS } from './schema';

// ============================================
// NATURAL MORTALITY
// ============================================

export interface MortalityResult {
  totalDeaths: number;
  infantDeaths: number;
  juvenileDeaths: number;
  adultDeaths: number;
  elderDeaths: number;
  causes: Record<string, number>;
  newAgeDistribution: AgeDistribution;
}

/**
 * Calculate natural mortality for a time period.
 */
export function calculateNaturalMortality(
  herd: Herd,
  species: LivestockSpecies,
  daysElapsed: number,
  season: Season,
  feedSufficiency: number,
  careQuality: number,
  rng: () => number
): MortalityResult {
  const mortality = species.mortalityProfile;
  const ageDistribution = { ...herd.ageDistribution };
  const causes: Record<string, number> = {};

  let infantDeaths = 0;
  let juvenileDeaths = 0;
  let adultDeaths = 0;
  let elderDeaths = 0;

  // Convert annual rates to daily rates
  const dailyInfantRate = mortality.infantMortalityRate / 365;
  const dailyAdultRate = mortality.adultMortalityRate / 365;
  const dailyElderRate = mortality.elderMortalityRate / 365;

  // Modifiers
  const seasonMod = SEASON_MODIFIERS[season].mortality;
  const careMod = careQuality > 0 ? 1 / careQuality : 2;

  // Calculate starvation modifier
  let starvationMod = 1;
  if (feedSufficiency < 0.5) {
    const daysWithoutFood = daysElapsed * (1 - feedSufficiency);
    if (daysWithoutFood >= mortality.starvationDaysToMortality) {
      starvationMod = 3; // Triple mortality at starvation
    } else {
      starvationMod = 1 + (daysWithoutFood / mortality.starvationDaysToMortality);
    }
  }

  // Process each age group
  // Infants
  if (ageDistribution.infants > 0) {
    const rate = dailyInfantRate * daysElapsed * seasonMod * careMod * starvationMod;
    for (let i = 0; i < ageDistribution.infants; i++) {
      if (rng() < rate) {
        infantDeaths++;
      }
    }
    ageDistribution.infants -= infantDeaths;
    if (infantDeaths > 0) {
      causes['natural_infant'] = (causes['natural_infant'] ?? 0) + infantDeaths;
    }
  }

  // Juveniles (use lower rate)
  if (ageDistribution.juveniles > 0) {
    const rate = (dailyAdultRate * 0.5) * daysElapsed * seasonMod * careMod * starvationMod;
    for (let i = 0; i < ageDistribution.juveniles; i++) {
      if (rng() < rate) {
        juvenileDeaths++;
      }
    }
    ageDistribution.juveniles -= juvenileDeaths;
    if (juvenileDeaths > 0) {
      causes['natural_juvenile'] = (causes['natural_juvenile'] ?? 0) + juvenileDeaths;
    }
  }

  // Adults
  if (ageDistribution.adults > 0) {
    const rate = dailyAdultRate * daysElapsed * seasonMod * careMod * starvationMod;
    for (let i = 0; i < ageDistribution.adults; i++) {
      if (rng() < rate) {
        adultDeaths++;
      }
    }
    ageDistribution.adults -= adultDeaths;
    ageDistribution.breedingEligible = Math.max(0, ageDistribution.breedingEligible - Math.floor(adultDeaths * 0.5));
    if (adultDeaths > 0) {
      causes['natural_adult'] = (causes['natural_adult'] ?? 0) + adultDeaths;
    }
  }

  // Elders
  if (ageDistribution.elders > 0) {
    const rate = dailyElderRate * daysElapsed * seasonMod * careMod * starvationMod;
    for (let i = 0; i < ageDistribution.elders; i++) {
      if (rng() < rate) {
        elderDeaths++;
      }
    }
    ageDistribution.elders -= elderDeaths;
    if (elderDeaths > 0) {
      causes['natural_elder'] = (causes['natural_elder'] ?? 0) + elderDeaths;
    }
  }

  // Starvation deaths (additional on top of natural)
  if (feedSufficiency < 0.3 && starvationMod > 1.5) {
    const starvationDeaths = Math.floor(
      (ageDistribution.adults + ageDistribution.juveniles) * 0.1 * (1 - feedSufficiency)
    );
    if (starvationDeaths > 0) {
      const fromAdults = Math.min(starvationDeaths, ageDistribution.adults);
      ageDistribution.adults -= fromAdults;
      adultDeaths += fromAdults;
      causes['starvation'] = (causes['starvation'] ?? 0) + starvationDeaths;
    }
  }

  const totalDeaths = infantDeaths + juvenileDeaths + adultDeaths + elderDeaths;

  return {
    totalDeaths,
    infantDeaths,
    juvenileDeaths,
    adultDeaths,
    elderDeaths,
    causes,
    newAgeDistribution: ageDistribution,
  };
}

// ============================================
// WINTER ATTRITION
// ============================================

export interface WinterAttritionResult {
  deaths: number;
  newAgeDistribution: AgeDistribution;
}

/**
 * Calculate additional winter attrition.
 */
export function calculateWinterAttrition(
  herd: Herd,
  species: LivestockSpecies,
  daysInWinter: number,
  shelterQuality: number,
  feedSufficiency: number,
  rng: () => number
): WinterAttritionResult {
  const winterRate = species.mortalityProfile.winterAttritionRate;

  if (winterRate === 0) {
    return { deaths: 0, newAgeDistribution: herd.ageDistribution };
  }

  const ageDistribution = { ...herd.ageDistribution };

  // Modify rate based on shelter and feed
  const shelterMod = shelterQuality; // 0.7 (none) to 1.1 (excellent)
  const feedMod = feedSufficiency < 0.8 ? 1 + (0.8 - feedSufficiency) : 1;

  const dailyWinterRate = (winterRate / 90) / shelterMod * feedMod; // 90 days of winter
  const effectiveRate = dailyWinterRate * daysInWinter;

  let deaths = 0;

  // Winter hits all age groups
  const totalAnimals =
    ageDistribution.infants +
    ageDistribution.juveniles +
    ageDistribution.adults +
    ageDistribution.elders;

  for (let i = 0; i < totalAnimals; i++) {
    if (rng() < effectiveRate) {
      deaths++;
    }
  }

  // Distribute deaths across age groups proportionally
  if (deaths > 0 && totalAnimals > 0) {
    const ratio = deaths / totalAnimals;

    const infantLosses = Math.floor(ageDistribution.infants * ratio);
    const juvenileLosses = Math.floor(ageDistribution.juveniles * ratio);
    const adultLosses = Math.floor(ageDistribution.adults * ratio);
    const elderLosses = deaths - infantLosses - juvenileLosses - adultLosses;

    ageDistribution.infants -= infantLosses;
    ageDistribution.juveniles -= juvenileLosses;
    ageDistribution.adults -= adultLosses;
    ageDistribution.elders = Math.max(0, ageDistribution.elders - elderLosses);
    ageDistribution.breedingEligible = Math.floor(ageDistribution.adults * 0.5);
  }

  return { deaths, newAgeDistribution: ageDistribution };
}

// ============================================
// DISEASE
// ============================================

export interface DiseaseOutbreakResult {
  infected: number;
  deaths: number;
  recovered: number;
  newHealthState: HealthState;
  diseaseId: string;
}

/**
 * Process a disease outbreak.
 */
export function processDiseaseOutbreak(
  herd: Herd,
  species: LivestockSpecies,
  diseaseId: string,
  severity: number, // 0-1
  _daysSinceOutbreak: number,
  careQuality: number,
  rng: () => number
): DiseaseOutbreakResult {
  // Find disease susceptibility
  const susceptibility = species.diseaseSusceptibility.find(
    d => d.diseaseId === diseaseId
  );

  const baseSusceptibility = susceptibility?.susceptibility ?? 0.5;
  const baseMortality = susceptibility?.mortalityIfUntreated ?? 0.2;

  const healthState = { ...herd.healthState };

  // Calculate infection spread
  const infectionRate = baseSusceptibility * severity;
  const potentialInfections = herd.count - healthState.diseased;

  let newInfections = 0;
  for (let i = 0; i < potentialInfections; i++) {
    if (rng() < infectionRate * 0.1) { // 10% of susceptibility per check
      newInfections++;
    }
  }

  // Calculate deaths from disease
  const dailyMortality = baseMortality / 14; // Assume 2 week disease course
  const mortalityMod = careQuality > 0 ? 1 / careQuality : 2;

  let deaths = 0;
  for (let i = 0; i < healthState.diseased; i++) {
    if (rng() < dailyMortality * mortalityMod) {
      deaths++;
    }
  }

  // Calculate recoveries
  const dailyRecoveryRate = 0.1 / mortalityMod;
  let recovered = 0;
  for (let i = 0; i < healthState.diseased - deaths; i++) {
    if (rng() < dailyRecoveryRate) {
      recovered++;
    }
  }

  // Update health state
  healthState.diseased = healthState.diseased + newInfections - deaths - recovered;
  healthState.overall = Math.max(0, 100 - (healthState.diseased / herd.count) * 50);

  return {
    infected: newInfections,
    deaths,
    recovered,
    newHealthState: healthState,
    diseaseId,
  };
}

/**
 * Check for random disease outbreak.
 */
export function checkForDiseaseOutbreak(
  herd: Herd,
  species: LivestockSpecies,
  careQuality: number,
  overcrowdingLevel: number,
  rng: () => number
): { outbreak: boolean; diseaseId?: string; severity?: number } {
  // Base outbreak chance (per week)
  let outbreakChance = 0.01; // 1% per week

  // Modifiers
  if (careQuality < 0.5) outbreakChance *= 2;
  if (overcrowdingLevel > 0.8) outbreakChance *= 2;
  if (herd.healthState.overall < 70) outbreakChance *= 1.5;

  if (rng() < outbreakChance) {
    // Pick a disease
    const diseases = species.diseaseSusceptibility;
    if (diseases.length > 0) {
      const disease = diseases[Math.floor(rng() * diseases.length)];
      return {
        outbreak: true,
        diseaseId: disease.diseaseId,
        severity: 0.3 + rng() * 0.5, // 30-80% severity
      };
    }

    // Generic disease
    return {
      outbreak: true,
      diseaseId: 'generic_illness',
      severity: 0.2 + rng() * 0.3,
    };
  }

  return { outbreak: false };
}

// ============================================
// PREDATOR ATTACKS
// ============================================

export interface PredatorAttackResult {
  losses: number;
  predatorType: string;
  newAgeDistribution: AgeDistribution;
}

/**
 * Calculate predator attack losses.
 */
export function calculatePredatorAttack(
  herd: Herd,
  securityLevel: number, // 0-1
  isWilderness: boolean,
  predatorType: string,
  rng: () => number
): PredatorAttackResult {
  const ageDistribution = { ...herd.ageDistribution };

  // Base attack severity
  let maxLosses = isWilderness ? 5 : 2;

  // Security reduces losses
  maxLosses = Math.floor(maxLosses * (1 - securityLevel * 0.8));

  if (maxLosses === 0) {
    return { losses: 0, predatorType, newAgeDistribution: ageDistribution };
  }

  // Predators target young first
  let losses = Math.floor(1 + rng() * maxLosses);
  let remaining = losses;

  // Take from infants first
  const fromInfants = Math.min(remaining, ageDistribution.infants);
  ageDistribution.infants -= fromInfants;
  remaining -= fromInfants;

  // Then juveniles
  if (remaining > 0) {
    const fromJuveniles = Math.min(remaining, ageDistribution.juveniles);
    ageDistribution.juveniles -= fromJuveniles;
    remaining -= fromJuveniles;
  }

  // Then adults if desperate
  if (remaining > 0) {
    const fromAdults = Math.min(remaining, ageDistribution.adults);
    ageDistribution.adults -= fromAdults;
    ageDistribution.breedingEligible = Math.floor(ageDistribution.adults * 0.5);
  }

  return { losses, predatorType, newAgeDistribution: ageDistribution };
}

/**
 * Check for predator attack.
 */
export function checkForPredatorAttack(
  securityLevel: number,
  isWilderness: boolean,
  season: Season,
  rng: () => number
): { attack: boolean; predatorType?: string } {
  // Base attack chance (per week)
  let attackChance = isWilderness ? 0.1 : 0.02;

  // Security reduces chance
  attackChance *= (1 - securityLevel * 0.9);

  // Winter increases attacks (animals desperate for food)
  if (season === 'winter') attackChance *= 1.5;

  if (rng() < attackChance) {
    const predators = ['wolves', 'bears', 'wild dogs', 'big cats', 'raptors'];
    const predatorType = predators[Math.floor(rng() * predators.length)];
    return { attack: true, predatorType };
  }

  return { attack: false };
}

// ============================================
// RAID LOSSES
// ============================================

export interface RaidResult {
  losses: number;
  raiderFaction: string;
  newAgeDistribution: AgeDistribution;
}

/**
 * Calculate raid losses.
 */
export function calculateRaidLosses(
  herd: Herd,
  securityLevel: number,
  raidSeverity: number, // 0-1
  raiderFaction: string,
  _rng: () => number
): RaidResult {
  const ageDistribution = { ...herd.ageDistribution };

  // Calculate what raiders can take
  const maxStealable = Math.floor(herd.count * raidSeverity * 0.3);
  const actualStolen = Math.floor(maxStealable * (1 - securityLevel));

  if (actualStolen === 0) {
    return { losses: 0, raiderFaction, newAgeDistribution: ageDistribution };
  }

  // Raiders prefer adults (more valuable)
  let remaining = actualStolen;

  const fromAdults = Math.min(remaining, ageDistribution.adults);
  ageDistribution.adults -= fromAdults;
  remaining -= fromAdults;

  if (remaining > 0) {
    const fromJuveniles = Math.min(remaining, ageDistribution.juveniles);
    ageDistribution.juveniles -= fromJuveniles;
  }

  ageDistribution.breedingEligible = Math.floor(ageDistribution.adults * 0.5);

  return { losses: actualStolen, raiderFaction, newAgeDistribution: ageDistribution };
}

// ============================================
// HEALTH RECOVERY
// ============================================

/**
 * Calculate health recovery over time.
 */
export function calculateHealthRecovery(
  healthState: HealthState,
  careQuality: number,
  feedSufficiency: number,
  daysElapsed: number
): HealthState {
  const result = { ...healthState };

  // Recovery rate based on care
  const dailyRecovery = careQuality * feedSufficiency * 2;
  const totalRecovery = dailyRecovery * daysElapsed;

  result.overall = Math.min(100, result.overall + totalRecovery);

  // Reduce injury count
  if (result.injured > 0) {
    result.injured = Math.max(0, result.injured - Math.floor(daysElapsed / 7));
  }

  // Reduce malnourished if feed is good
  if (feedSufficiency > 0.8 && result.malnourished > 0) {
    result.malnourished = Math.max(0, result.malnourished - Math.floor(daysElapsed / 3));
  }

  return result;
}
