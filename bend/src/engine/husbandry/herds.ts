/**
 * HUSBANDRY SYSTEM - Herd Management
 *
 * CRUD operations for herds (livestock cohorts).
 */

import { writeDelta } from '../timeline/deltas';
import type { WorldTimestamp } from '../timeline/substrate';
import type {
  Herd,
  AgeDistribution,
  HealthState,
  StressState,
  ExpectedBirth,
  NamedIndividual,
  LivestockSpecies,
} from './schema';

// ============================================
// HERD CREATION
// ============================================

export interface CreateHerdInput {
  campaignId: string;
  ranchId: string;
  speciesId: string;

  count: number;
  ageDistribution?: Partial<AgeDistribution>;

  breedingEnabled?: boolean;
  tags?: string[];

  worldTimestamp: WorldTimestamp;
}

/**
 * Create a new herd at a ranch.
 */
export async function createHerd(input: CreateHerdInput): Promise<Herd> {
  const now = new Date().toISOString();
  const herdId = crypto.randomUUID();

  // Default age distribution if not provided
  const defaultAgeDistribution: AgeDistribution = {
    infants: 0,
    juveniles: 0,
    adults: input.count,
    elders: 0,
    breedingEligible: Math.floor(input.count * 0.3),
  };

  const herd: Herd = {
    id: herdId,
    ranchId: input.ranchId,
    speciesId: input.speciesId,
    count: input.count,
    ageDistribution: {
      ...defaultAgeDistribution,
      ...input.ageDistribution,
    },
    healthState: {
      overall: 100,
      diseased: 0,
      injured: 0,
      malnourished: 0,
    },
    stressState: {
      overall: 0,
      overcrowding: 0,
      predatorFear: 0,
      careNeglect: 0,
    },
    breedingEnabled: input.breedingEnabled ?? true,
    pregnantCount: 0,
    expectedBirths: [],
    yieldThisCycle: 0,
    namedIndividuals: [],
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  // Write delta
  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herdId,
    operation: 'create',
    delta: { herd },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return herd;
}

// ============================================
// HERD POPULATION CHANGES
// ============================================

export interface AddToHerdInput {
  herdId: string;
  campaignId: string;
  count: number;
  ageGroup: keyof AgeDistribution;
  reason: string;
  worldTimestamp: WorldTimestamp;
}

/**
 * Add animals to a herd.
 */
export async function addToHerd(
  herd: Herd,
  input: AddToHerdInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const newAgeDistribution = { ...herd.ageDistribution };
  newAgeDistribution[input.ageGroup] += input.count;

  const updated: Herd = {
    ...herd,
    count: herd.count + input.count,
    ageDistribution: newAgeDistribution,
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      count: updated.count,
      ageDistribution: updated.ageDistribution,
      reason: input.reason,
      added: input.count,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

export interface RemoveFromHerdInput {
  herdId: string;
  campaignId: string;
  count: number;
  ageGroup: keyof AgeDistribution;
  reason: string;
  worldTimestamp: WorldTimestamp;
}

/**
 * Remove animals from a herd.
 */
export async function removeFromHerd(
  herd: Herd,
  input: RemoveFromHerdInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const newAgeDistribution = { ...herd.ageDistribution };
  newAgeDistribution[input.ageGroup] = Math.max(
    0,
    newAgeDistribution[input.ageGroup] - input.count
  );

  const newCount = Math.max(0, herd.count - input.count);

  const updated: Herd = {
    ...herd,
    count: newCount,
    ageDistribution: newAgeDistribution,
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      count: updated.count,
      ageDistribution: updated.ageDistribution,
      reason: input.reason,
      removed: input.count,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// SLAUGHTER
// ============================================

export interface SlaughterInput {
  herdId: string;
  campaignId: string;
  count: number;
  species: LivestockSpecies;
  worldTimestamp: WorldTimestamp;
}

export interface SlaughterResult {
  herd: Herd;
  meatYield: number;
  hideYield: number;
  tallowYield: number;
}

/**
 * Slaughter animals from a herd.
 */
export async function slaughterFromHerd(
  herd: Herd,
  input: SlaughterInput
): Promise<SlaughterResult> {
  const now = new Date().toISOString();

  // Prefer slaughtering adults first
  let remaining = input.count;
  const newAgeDistribution = { ...herd.ageDistribution };

  // Slaughter from adults first, then juveniles
  const fromAdults = Math.min(remaining, newAgeDistribution.adults);
  newAgeDistribution.adults -= fromAdults;
  remaining -= fromAdults;

  if (remaining > 0) {
    const fromJuveniles = Math.min(remaining, newAgeDistribution.juveniles);
    newAgeDistribution.juveniles -= fromJuveniles;
    remaining -= fromJuveniles;
  }

  const actualSlaughtered = input.count - remaining;
  const newCount = herd.count - actualSlaughtered;

  // Calculate yields
  const meatProfile = input.species.yieldProfiles.meat;
  const meatYield = meatProfile ? actualSlaughtered * meatProfile.perUnit : 0;
  const hideYield = meatProfile?.hideYield ? actualSlaughtered * meatProfile.hideYield : 0;
  const tallowYield = meatProfile?.tallowYield ? actualSlaughtered * meatProfile.tallowYield : 0;

  const updated: Herd = {
    ...herd,
    count: newCount,
    ageDistribution: newAgeDistribution,
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      count: updated.count,
      ageDistribution: updated.ageDistribution,
      slaughtered: actualSlaughtered,
      meatYield,
      hideYield,
      tallowYield,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return {
    herd: updated,
    meatYield,
    hideYield,
    tallowYield,
  };
}

// ============================================
// HEALTH & STRESS
// ============================================

export interface UpdateHealthInput {
  herdId: string;
  campaignId: string;
  healthState: Partial<HealthState>;
  worldTimestamp: WorldTimestamp;
}

/**
 * Update herd health state.
 */
export async function updateHealth(
  herd: Herd,
  input: UpdateHealthInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const updated: Herd = {
    ...herd,
    healthState: { ...herd.healthState, ...input.healthState },
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      healthState: updated.healthState,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

export interface UpdateStressInput {
  herdId: string;
  campaignId: string;
  stressState: Partial<StressState>;
  worldTimestamp: WorldTimestamp;
}

/**
 * Update herd stress state.
 */
export async function updateStress(
  herd: Herd,
  input: UpdateStressInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const updated: Herd = {
    ...herd,
    stressState: { ...herd.stressState, ...input.stressState },
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      stressState: updated.stressState,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// BREEDING
// ============================================

export interface AddPregnancyInput {
  herdId: string;
  campaignId: string;
  count: number;
  dueWorldDay: number;
  expectedOffspring: number;
  worldTimestamp: WorldTimestamp;
}

/**
 * Record new pregnancies in the herd.
 */
export async function addPregnancies(
  herd: Herd,
  input: AddPregnancyInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const newExpectedBirth: ExpectedBirth = {
    dueWorldDay: input.dueWorldDay,
    expectedCount: input.expectedOffspring,
  };

  const updated: Herd = {
    ...herd,
    pregnantCount: herd.pregnantCount + input.count,
    expectedBirths: [...herd.expectedBirths, newExpectedBirth],
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      pregnantCount: updated.pregnantCount,
      expectedBirths: updated.expectedBirths,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

export interface ProcessBirthsInput {
  herdId: string;
  campaignId: string;
  birthCount: number;
  mothersCount: number;
  worldTimestamp: WorldTimestamp;
}

/**
 * Process births in the herd.
 */
export async function processBirths(
  herd: Herd,
  input: ProcessBirthsInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const newAgeDistribution = { ...herd.ageDistribution };
  newAgeDistribution.infants += input.birthCount;

  const updated: Herd = {
    ...herd,
    count: herd.count + input.birthCount,
    ageDistribution: newAgeDistribution,
    pregnantCount: Math.max(0, herd.pregnantCount - input.mothersCount),
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      count: updated.count,
      ageDistribution: updated.ageDistribution,
      pregnantCount: updated.pregnantCount,
      births: input.birthCount,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// NAMED INDIVIDUALS
// ============================================

export interface AddNamedIndividualInput {
  herdId: string;
  campaignId: string;
  individual: NamedIndividual;
  worldTimestamp: WorldTimestamp;
}

/**
 * Add a named individual to the herd.
 */
export async function addNamedIndividual(
  herd: Herd,
  input: AddNamedIndividualInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const updated: Herd = {
    ...herd,
    namedIndividuals: [...herd.namedIndividuals, input.individual],
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      namedIndividualAdded: input.individual,
    },
    actorId: input.individual.ownerId,
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// TICK TRACKING
// ============================================

export interface UpdateTickInput {
  herdId: string;
  campaignId: string;
  tickVersion: number;
  worldTimestamp: WorldTimestamp;
}

/**
 * Update the last care tick version.
 */
export async function updateLastTick(
  herd: Herd,
  input: UpdateTickInput
): Promise<Herd> {
  const now = new Date().toISOString();

  const updated: Herd = {
    ...herd,
    lastCareTickVersion: input.tickVersion,
    lastCareTickTimestamp: now,
    updatedAt: now,
    version: herd.version + 1,
  };

  await writeDelta({
    campaignId: input.campaignId,
    sessionId: undefined,
    entityType: 'herd',
    entityId: herd.id,
    operation: 'update',
    delta: {
      lastCareTickVersion: input.tickVersion,
      lastCareTickTimestamp: now,
    },
    actorType: 'system',
    timestamp: now,
    worldTimestamp: input.worldTimestamp,
  });

  return updated;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get total population from age distribution.
 */
export function getTotalPopulation(ageDistribution: AgeDistribution): number {
  return (
    ageDistribution.infants +
    ageDistribution.juveniles +
    ageDistribution.adults +
    ageDistribution.elders
  );
}

/**
 * Get breeding-eligible count (adults not currently pregnant).
 */
export function getBreedingEligible(herd: Herd): number {
  return herd.ageDistribution.breedingEligible;
}

/**
 * Calculate average health.
 */
export function getAverageHealth(herd: Herd): number {
  return herd.healthState.overall;
}

/**
 * Check if herd is healthy.
 */
export function isHealthy(herd: Herd): boolean {
  return (
    herd.healthState.overall >= 80 &&
    herd.healthState.diseased === 0 &&
    herd.healthState.malnourished === 0
  );
}

/**
 * Check if herd is stressed.
 */
export function isStressed(herd: Herd): boolean {
  return herd.stressState.overall >= 50;
}

// ============================================
// QUERIES
// ============================================

/**
 * Get herds at a ranch.
 */
export function getHerdsByRanch(herds: Herd[], ranchId: string): Herd[] {
  return herds.filter(h => h.ranchId === ranchId);
}

/**
 * Get herds by species.
 */
export function getHerdsBySpecies(herds: Herd[], speciesId: string): Herd[] {
  return herds.filter(h => h.speciesId === speciesId);
}

/**
 * Get total animals across herds.
 */
export function getTotalAnimals(herds: Herd[]): number {
  return herds.reduce((sum, h) => sum + h.count, 0);
}
