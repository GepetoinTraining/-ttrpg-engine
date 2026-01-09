/**
 * HUSBANDRY SYSTEM - Species Definitions
 *
 * Standard livestock species with realistic yield/care profiles.
 * Only DOMESTICATED animals enter the husbandry system.
 */

import type { LivestockSpecies } from './schema';

// ============================================
// LIVESTOCK SPECIES DEFINITIONS
// ============================================

export const LIVESTOCK_SPECIES: Record<string, LivestockSpecies> = {
  // ============================================
  // CATTLE
  // ============================================
  cattle: {
    id: 'cattle',
    name: 'Cattle',
    description: 'Domesticated bovines raised for meat, milk, and leather.',
    category: 'MULTI',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      meat: { perUnit: 400, maturityWeeks: 78, hideYield: 40, tallowYield: 50 },
      milk: { perDay: 2.5, lactationWeeks: 44, cheeseRatio: 10 },
      manure: { perDay: 65 },
    },
    careRequirements: {
      feedPerDay: 25,
      feedTypes: ['grain', 'hay'],
      waterPerDay: 12,
      spacePerHead: 400,
      shelterNeeded: true,
      minCareSkill: 1,
      careHoursPerDay: 0.5,
    },
    reproductionProfile: {
      gestationWeeks: 40,
      offspringMin: 1,
      offspringMax: 1,
      breedingAgeWeeks: 78,
      maxBreedingAgeWeeks: 520,
      breedingSeason: 'year_round',
    },
    mortalityProfile: {
      baseLifespanYears: 18,
      infantMortalityRate: 0.05,
      adultMortalityRate: 0.02,
      elderMortalityRate: 0.15,
      winterAttritionRate: 0.03,
      starvationDaysToMortality: 14,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'tropical'],
    terrainAdaptations: ['plains', 'hills'],
    basePurchasePrice: 50,
    baseSalePrice: 40,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // SHEEP
  // ============================================
  sheep: {
    id: 'sheep',
    name: 'Sheep',
    description: 'Domesticated ovines raised for wool, meat, and milk.',
    category: 'MULTI',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      meat: { perUnit: 50, maturityWeeks: 26, hideYield: 8 },
      wool: { perShearing: 8, shearingsPerYear: 2, qualityGrade: 'standard' },
      milk: { perDay: 0.5, lactationWeeks: 26, cheeseRatio: 6 },
      manure: { perDay: 4 },
    },
    careRequirements: {
      feedPerDay: 4,
      feedTypes: ['hay', 'pasture'],
      waterPerDay: 2,
      spacePerHead: 20,
      shelterNeeded: true,
      minCareSkill: 1,
      careHoursPerDay: 0.3,
    },
    reproductionProfile: {
      gestationWeeks: 21,
      offspringMin: 1,
      offspringMax: 3,
      breedingAgeWeeks: 52,
      maxBreedingAgeWeeks: 364,
      breedingSeason: 'fall',
      twinRate: 0.3,
    },
    mortalityProfile: {
      baseLifespanYears: 12,
      infantMortalityRate: 0.08,
      adultMortalityRate: 0.03,
      elderMortalityRate: 0.2,
      winterAttritionRate: 0.05,
      starvationDaysToMortality: 7,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'cold'],
    terrainAdaptations: ['plains', 'hills', 'mountain'],
    basePurchasePrice: 8,
    baseSalePrice: 6,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // GOATS
  // ============================================
  goats: {
    id: 'goats',
    name: 'Goats',
    description: 'Hardy domesticated caprines raised for milk, meat, and fiber.',
    category: 'MULTI',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      meat: { perUnit: 35, maturityWeeks: 26 },
      milk: { perDay: 0.75, lactationWeeks: 40, cheeseRatio: 8 },
      manure: { perDay: 3 },
    },
    careRequirements: {
      feedPerDay: 3,
      feedTypes: ['hay', 'browse', 'grain'],
      waterPerDay: 2,
      spacePerHead: 25,
      shelterNeeded: false,
      minCareSkill: 1,
      careHoursPerDay: 0.2,
    },
    reproductionProfile: {
      gestationWeeks: 21,
      offspringMin: 1,
      offspringMax: 4,
      breedingAgeWeeks: 32,
      maxBreedingAgeWeeks: 416,
      breedingSeason: 'fall',
      twinRate: 0.5,
    },
    mortalityProfile: {
      baseLifespanYears: 15,
      infantMortalityRate: 0.06,
      adultMortalityRate: 0.02,
      elderMortalityRate: 0.12,
      winterAttritionRate: 0.02,
      starvationDaysToMortality: 10,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'arid', 'cold'],
    terrainAdaptations: ['mountain', 'hills', 'rocky'],
    basePurchasePrice: 6,
    baseSalePrice: 4,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // PIGS
  // ============================================
  pigs: {
    id: 'pigs',
    name: 'Pigs',
    description: 'Domesticated swine raised for meat and fat.',
    category: 'MEAT',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      meat: { perUnit: 180, maturityWeeks: 26, tallowYield: 30 },
      manure: { perDay: 15 },
    },
    careRequirements: {
      feedPerDay: 8,
      feedTypes: ['grain', 'scraps', 'vegetables'],
      waterPerDay: 4,
      spacePerHead: 80,
      shelterNeeded: true,
      minCareSkill: 1,
      careHoursPerDay: 0.3,
    },
    reproductionProfile: {
      gestationWeeks: 16,
      offspringMin: 6,
      offspringMax: 12,
      breedingAgeWeeks: 32,
      maxBreedingAgeWeeks: 260,
      breedingSeason: 'year_round',
    },
    mortalityProfile: {
      baseLifespanYears: 15,
      infantMortalityRate: 0.15,
      adultMortalityRate: 0.02,
      elderMortalityRate: 0.1,
      winterAttritionRate: 0.02,
      starvationDaysToMortality: 10,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'tropical'],
    terrainAdaptations: ['forest', 'plains'],
    basePurchasePrice: 10,
    baseSalePrice: 8,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // CHICKENS
  // ============================================
  chickens: {
    id: 'chickens',
    name: 'Chickens',
    description: 'Domestic fowl raised for eggs and meat.',
    category: 'EGGS',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      eggs: { perDay: 0.8, layingWeeks: 78, hatchRate: 0.75 },
      meat: { perUnit: 4, maturityWeeks: 20 },
      manure: { perDay: 0.25 },
    },
    careRequirements: {
      feedPerDay: 0.25,
      feedTypes: ['grain', 'scraps'],
      waterPerDay: 0.5,
      spacePerHead: 4,
      shelterNeeded: true,
      minCareSkill: 0,
      careHoursPerDay: 0.05,
    },
    reproductionProfile: {
      gestationWeeks: 3,
      offspringMin: 8,
      offspringMax: 15,
      breedingAgeWeeks: 20,
      maxBreedingAgeWeeks: 260,
      breedingSeason: 'spring',
    },
    mortalityProfile: {
      baseLifespanYears: 8,
      infantMortalityRate: 0.2,
      adultMortalityRate: 0.05,
      elderMortalityRate: 0.3,
      winterAttritionRate: 0.1,
      starvationDaysToMortality: 3,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'tropical'],
    terrainAdaptations: ['plains', 'forest'],
    basePurchasePrice: 1,
    baseSalePrice: 0.5,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // DUCKS
  // ============================================
  ducks: {
    id: 'ducks',
    name: 'Ducks',
    description: 'Domesticated waterfowl raised for eggs, meat, and feathers.',
    category: 'EGGS',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      eggs: { perDay: 0.6, layingWeeks: 52, hatchRate: 0.7 },
      meat: { perUnit: 5, maturityWeeks: 12 },
      manure: { perDay: 0.3 },
    },
    careRequirements: {
      feedPerDay: 0.3,
      feedTypes: ['grain', 'insects', 'vegetables'],
      waterPerDay: 1,
      spacePerHead: 6,
      shelterNeeded: true,
      minCareSkill: 0,
      careHoursPerDay: 0.05,
    },
    reproductionProfile: {
      gestationWeeks: 4,
      offspringMin: 8,
      offspringMax: 12,
      breedingAgeWeeks: 26,
      maxBreedingAgeWeeks: 312,
      breedingSeason: 'spring',
    },
    mortalityProfile: {
      baseLifespanYears: 10,
      infantMortalityRate: 0.15,
      adultMortalityRate: 0.04,
      elderMortalityRate: 0.25,
      winterAttritionRate: 0.08,
      starvationDaysToMortality: 3,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'tropical'],
    terrainAdaptations: ['wetland', 'plains'],
    basePurchasePrice: 2,
    baseSalePrice: 1,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // HORSES
  // ============================================
  horses: {
    id: 'horses',
    name: 'Horses',
    description: 'Domesticated equines used for riding and draft work.',
    category: 'MOUNT',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      labor: { carryCapacity: 200, pullStrength: 1500, workHoursPerDay: 8 },
      manure: { perDay: 50 },
    },
    careRequirements: {
      feedPerDay: 20,
      feedTypes: ['hay', 'grain', 'pasture'],
      waterPerDay: 10,
      spacePerHead: 200,
      shelterNeeded: true,
      minCareSkill: 2,
      careHoursPerDay: 1.5,
    },
    reproductionProfile: {
      gestationWeeks: 48,
      offspringMin: 1,
      offspringMax: 1,
      breedingAgeWeeks: 156,
      maxBreedingAgeWeeks: 1040,
      breedingSeason: 'spring',
    },
    mortalityProfile: {
      baseLifespanYears: 28,
      infantMortalityRate: 0.08,
      adultMortalityRate: 0.01,
      elderMortalityRate: 0.1,
      winterAttritionRate: 0.02,
      starvationDaysToMortality: 21,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate'],
    terrainAdaptations: ['plains', 'hills'],
    basePurchasePrice: 75,
    baseSalePrice: 60,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // OXEN
  // ============================================
  oxen: {
    id: 'oxen',
    name: 'Oxen',
    description: 'Castrated male cattle trained for heavy draft work.',
    category: 'LABOR',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      labor: { carryCapacity: 300, pullStrength: 2500, workHoursPerDay: 10 },
      meat: { perUnit: 500, maturityWeeks: 104, hideYield: 60 },
      manure: { perDay: 70 },
    },
    careRequirements: {
      feedPerDay: 30,
      feedTypes: ['hay', 'grain'],
      waterPerDay: 15,
      spacePerHead: 500,
      shelterNeeded: true,
      minCareSkill: 2,
      careHoursPerDay: 1,
    },
    reproductionProfile: {
      gestationWeeks: 40,
      offspringMin: 1,
      offspringMax: 1,
      breedingAgeWeeks: 104,
      maxBreedingAgeWeeks: 624,
      breedingSeason: 'year_round',
    },
    mortalityProfile: {
      baseLifespanYears: 20,
      infantMortalityRate: 0.05,
      adultMortalityRate: 0.02,
      elderMortalityRate: 0.12,
      winterAttritionRate: 0.03,
      starvationDaysToMortality: 14,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate'],
    terrainAdaptations: ['plains', 'hills'],
    basePurchasePrice: 100,
    baseSalePrice: 80,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // DONKEYS
  // ============================================
  donkeys: {
    id: 'donkeys',
    name: 'Donkeys',
    description: 'Hardy pack animals with excellent endurance.',
    category: 'LABOR',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      labor: { carryCapacity: 150, pullStrength: 800, workHoursPerDay: 10 },
      manure: { perDay: 25 },
    },
    careRequirements: {
      feedPerDay: 10,
      feedTypes: ['hay', 'browse'],
      waterPerDay: 5,
      spacePerHead: 150,
      shelterNeeded: false,
      minCareSkill: 1,
      careHoursPerDay: 0.5,
    },
    reproductionProfile: {
      gestationWeeks: 52,
      offspringMin: 1,
      offspringMax: 1,
      breedingAgeWeeks: 156,
      maxBreedingAgeWeeks: 1040,
      breedingSeason: 'year_round',
    },
    mortalityProfile: {
      baseLifespanYears: 30,
      infantMortalityRate: 0.06,
      adultMortalityRate: 0.01,
      elderMortalityRate: 0.08,
      winterAttritionRate: 0.01,
      starvationDaysToMortality: 21,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'arid'],
    terrainAdaptations: ['mountain', 'desert', 'hills'],
    basePurchasePrice: 30,
    baseSalePrice: 25,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // BEES
  // ============================================
  bees: {
    id: 'bees',
    name: 'Bees (Hive)',
    description: 'Domesticated honeybees kept in hives for honey and wax.',
    category: 'MULTI',
    domesticationClass: 'SYMBIOTIC',
    creatureType: 'beast',
    yieldProfiles: {
      // Special: yields are per hive per year
      meat: { perUnit: 30, maturityWeeks: 26 },  // honey in lbs
      manure: { perDay: 0 },
    },
    careRequirements: {
      feedPerDay: 0,
      feedTypes: [],
      waterPerDay: 0,
      spacePerHead: 10,
      shelterNeeded: false,
      minCareSkill: 2,
      careHoursPerDay: 0.1,
    },
    reproductionProfile: {
      gestationWeeks: 8,
      offspringMin: 1,
      offspringMax: 2,
      breedingAgeWeeks: 52,
      maxBreedingAgeWeeks: 260,
      breedingSeason: 'spring',
    },
    mortalityProfile: {
      baseLifespanYears: 5,
      infantMortalityRate: 0.3,
      adultMortalityRate: 0.1,
      elderMortalityRate: 0.4,
      winterAttritionRate: 0.2,
      starvationDaysToMortality: 7,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['temperate', 'tropical'],
    terrainAdaptations: ['forest', 'plains', 'garden'],
    basePurchasePrice: 15,
    baseSalePrice: 10,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // ROTHE (Underdark)
  // ============================================
  rothe: {
    id: 'rothe',
    name: 'Rothe',
    description: 'Underdark cattle adapted to darkness. Raised by drow and other subterranean races.',
    category: 'MULTI',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'monstrosity',
    yieldProfiles: {
      meat: { perUnit: 350, maturityWeeks: 65, hideYield: 35 },
      milk: { perDay: 2, lactationWeeks: 40 },
      labor: { carryCapacity: 250, pullStrength: 2000, workHoursPerDay: 12 },
      manure: { perDay: 55 },
    },
    careRequirements: {
      feedPerDay: 20,
      feedTypes: ['fungus', 'moss', 'grain'],
      waterPerDay: 10,
      spacePerHead: 350,
      shelterNeeded: false,
      minCareSkill: 2,
      careHoursPerDay: 0.6,
    },
    reproductionProfile: {
      gestationWeeks: 36,
      offspringMin: 1,
      offspringMax: 2,
      breedingAgeWeeks: 52,
      maxBreedingAgeWeeks: 520,
      breedingSeason: 'year_round',
    },
    mortalityProfile: {
      baseLifespanYears: 20,
      infantMortalityRate: 0.04,
      adultMortalityRate: 0.01,
      elderMortalityRate: 0.1,
      winterAttritionRate: 0,
      starvationDaysToMortality: 21,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['underground'],
    terrainAdaptations: ['cavern', 'underground'],
    basePurchasePrice: 80,
    baseSalePrice: 65,
    isCanonical: true,
    version: 1,
  },

  // ============================================
  // GIANT GOATS (Mountain)
  // ============================================
  giant_goats: {
    id: 'giant_goats',
    name: 'Giant Goats',
    description: 'Large mountain goats used as mounts and pack animals by dwarves and mountain folk.',
    category: 'MULTI',
    domesticationClass: 'DOMESTICATED',
    creatureType: 'beast',
    yieldProfiles: {
      meat: { perUnit: 150, maturityWeeks: 52 },
      milk: { perDay: 1.5, lactationWeeks: 30 },
      labor: { carryCapacity: 180, pullStrength: 600, workHoursPerDay: 8 },
      manure: { perDay: 12 },
    },
    careRequirements: {
      feedPerDay: 12,
      feedTypes: ['hay', 'browse', 'mountain_grass'],
      waterPerDay: 6,
      spacePerHead: 100,
      shelterNeeded: false,
      minCareSkill: 2,
      careHoursPerDay: 0.5,
    },
    reproductionProfile: {
      gestationWeeks: 24,
      offspringMin: 1,
      offspringMax: 2,
      breedingAgeWeeks: 78,
      maxBreedingAgeWeeks: 520,
      breedingSeason: 'fall',
      twinRate: 0.2,
    },
    mortalityProfile: {
      baseLifespanYears: 18,
      infantMortalityRate: 0.05,
      adultMortalityRate: 0.02,
      elderMortalityRate: 0.1,
      winterAttritionRate: 0.01,
      starvationDaysToMortality: 14,
    },
    diseaseSusceptibility: [],
    preferredClimates: ['cold', 'temperate'],
    terrainAdaptations: ['mountain', 'alpine', 'rocky'],
    basePurchasePrice: 50,
    baseSalePrice: 40,
    isCanonical: true,
    version: 1,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a species by ID.
 */
export function getSpecies(speciesId: string): LivestockSpecies | undefined {
  return LIVESTOCK_SPECIES[speciesId];
}

/**
 * Get all species in a category.
 */
export function getSpeciesByCategory(category: string): LivestockSpecies[] {
  return Object.values(LIVESTOCK_SPECIES).filter(s => s.category === category);
}

/**
 * Get all domesticated species (those that can enter husbandry).
 */
export function getDomesticatedSpecies(): LivestockSpecies[] {
  return Object.values(LIVESTOCK_SPECIES).filter(
    s => s.domesticationClass === 'DOMESTICATED'
  );
}

/**
 * Get species suitable for a climate.
 */
export function getSpeciesForClimate(climate: string): LivestockSpecies[] {
  return Object.values(LIVESTOCK_SPECIES).filter(
    s => s.preferredClimates.includes(climate) || s.preferredClimates.length === 0
  );
}

/**
 * Calculate feed cost per day for a herd.
 */
export function calculateDailyFeedCost(
  species: LivestockSpecies,
  count: number,
  feedPricePerLb: number = 0.01
): number {
  return species.careRequirements.feedPerDay * count * feedPricePerLb;
}

/**
 * Calculate space requirements for a herd.
 */
export function calculateSpaceRequired(
  species: LivestockSpecies,
  count: number
): number {
  return species.careRequirements.spacePerHead * count;
}

/**
 * Calculate labor hours needed per day for a herd.
 */
export function calculateLaborHours(
  species: LivestockSpecies,
  count: number
): number {
  return species.careRequirements.careHoursPerDay * (count / 10);
}

/**
 * Estimate annual meat yield from a herd.
 */
export function estimateAnnualMeatYield(
  species: LivestockSpecies,
  breedingFemales: number
): { meatLbs: number; hideLbs: number } {
  const profile = species.yieldProfiles.meat;
  if (!profile) return { meatLbs: 0, hideLbs: 0 };

  const repro = species.reproductionProfile;
  const avgOffspring = (repro.offspringMin + repro.offspringMax) / 2;
  const gestationsPerYear = 52 / repro.gestationWeeks;
  const annualOffspring = breedingFemales * avgOffspring * gestationsPerYear * 0.8; // 80% survival

  const slaughterablePerYear = annualOffspring * 0.5; // keep half for breeding

  return {
    meatLbs: slaughterablePerYear * profile.perUnit,
    hideLbs: slaughterablePerYear * (profile.hideYield ?? 0),
  };
}

/**
 * Estimate annual milk yield from a herd.
 */
export function estimateAnnualMilkYield(
  species: LivestockSpecies,
  lactatingCount: number
): number {
  const profile = species.yieldProfiles.milk;
  if (!profile) return 0;

  const daysLactating = profile.lactationWeeks * 7;
  return lactatingCount * profile.perDay * daysLactating;
}

/**
 * Estimate annual wool yield from a herd.
 */
export function estimateAnnualWoolYield(
  species: LivestockSpecies,
  adultCount: number
): number {
  const profile = species.yieldProfiles.wool;
  if (!profile) return 0;

  return adultCount * profile.perShearing * profile.shearingsPerYear;
}

/**
 * Estimate annual egg yield from a flock.
 */
export function estimateAnnualEggYield(
  species: LivestockSpecies,
  layingCount: number
): number {
  const profile = species.yieldProfiles.eggs;
  if (!profile) return 0;

  const daysLaying = profile.layingWeeks * 7;
  return layingCount * profile.perDay * daysLaying;
}
