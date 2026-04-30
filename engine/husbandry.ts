/**
 * HUSBANDRY — Food, Labor, and Living Capital
 * ==============================================
 * 
 * Food is a basic necessity. Meat, milk, eggs, wool.
 * Animals are living capital that produces commodities.
 * 
 * This ties into the larger skill/knowledge pipeline:
 *   - Knowledge seed "animal_husbandry" unlocks ranching
 *   - Knowledge seed "selective_breeding" unlocks breed improvements
 *   - Knowledge seed "beekeeping" unlocks bee hives (honey, wax)
 *   - Knowledge seed "veterinary" unlocks disease prevention
 * 
 * TICK INTEGRATION:
 *   Weekly:  yield production (milk, eggs, manure, wool shearing)
 *   Monthly: reproduction tick, mortality check, feed consumption,
 *            herd growth, age progression
 * 
 *            ┌─────────────────────────────────┐
 *            │         HERD LIFECYCLE          │
 *            │                                 │
 *  Acquire ──→ Feed daily                      │
 *            │   ├─ Weekly yield (milk, eggs)   │
 *            │   ├─ Monthly births              │
 *            │   ├─ Monthly mortality            │
 *            │   └─ Seasonal breeding            │
 *            │                                 │
 *  Slaughter → Meat, hide, tallow              │
 *            │                                 │
 *  Sell ─────→ Market (live animals)            │
 *            └─────────────────────────────────┘
 */

// ============================================================
// SPECIES DEFINITIONS
// ============================================================

export type LivestockCategory = 'MEAT' | 'DAIRY' | 'EGGS' | 'MOUNT' | 'LABOR' | 'MULTI'
export type BreedingSeason = 'spring' | 'fall' | 'year_round'

export interface YieldProfile {
  /** Meat yield in lbs when slaughtered */
  meat?: { lbs: number; maturityWeeks: number; hide?: number; tallow?: number }
  /** Milk yield per day in gallons */
  milk?: { perDay: number; lactationWeeks: number; cheeseRatio: number }
  /** Egg yield per hen per day */
  eggs?: { perDay: number; layingWeeks: number; hatchRate: number }
  /** Wool yield per shearing in lbs */
  wool?: { perShearing: number; shearingsPerYear: number }
  /** Draft labor capacity */
  labor?: { carryLbs: number; pullLbs: number; hoursPerDay: number }
  /** Manure production lbs/day */
  manure: number
}

export interface CareProfile {
  feedPerDay: number      // lbs
  feedTypes: string[]
  waterPerDay: number     // gallons
  spacePerHead: number    // sq ft
  shelterNeeded: boolean
  minSkill: number        // 0-5
  hoursPerDay: number     // per 10 animals
}

export interface ReproProfile {
  gestationWeeks: number
  offspringMin: number
  offspringMax: number
  breedingAgeWeeks: number
  maxBreedingAgeWeeks: number
  season: BreedingSeason
  twinRate?: number
}

export interface MortalityProfile {
  lifespanYears: number
  infantRate: number     // % per month
  adultRate: number      // % per month
  elderRate: number      // % per month
  winterRate: number     // additional % in winter
  starvationDays: number // days without food to die
}

export interface Species {
  id: string
  name: string
  category: LivestockCategory
  yield: YieldProfile
  care: CareProfile
  repro: ReproProfile
  mortality: MortalityProfile
  climates: string[]
  terrains: string[]
  purchasePrice: number  // GP
  salePrice: number      // GP
  /** Knowledge seed required to raise this species */
  requiredSeed?: string
}

// ============================================================
// STANDARD SPECIES — 12 domesticated types
// ============================================================

export const SPECIES: Record<string, Species> = {
  cattle: {
    id: 'cattle', name: 'Cattle', category: 'MULTI',
    yield: {
      meat: { lbs: 400, maturityWeeks: 78, hide: 40, tallow: 50 },
      milk: { perDay: 2.5, lactationWeeks: 44, cheeseRatio: 10 },
      manure: 65,
    },
    care: {
      feedPerDay: 25, feedTypes: ['grain', 'hay'], waterPerDay: 12,
      spacePerHead: 400, shelterNeeded: true, minSkill: 1, hoursPerDay: 0.5,
    },
    repro: {
      gestationWeeks: 40, offspringMin: 1, offspringMax: 1,
      breedingAgeWeeks: 78, maxBreedingAgeWeeks: 520, season: 'year_round',
    },
    mortality: {
      lifespanYears: 18, infantRate: 0.05, adultRate: 0.02,
      elderRate: 0.15, winterRate: 0.03, starvationDays: 14,
    },
    climates: ['temperate', 'tropical'], terrains: ['plains', 'hills'],
    purchasePrice: 50, salePrice: 40,
  },

  sheep: {
    id: 'sheep', name: 'Sheep', category: 'MULTI',
    yield: {
      meat: { lbs: 50, maturityWeeks: 26, hide: 8 },
      milk: { perDay: 0.5, lactationWeeks: 26, cheeseRatio: 6 },
      wool: { perShearing: 8, shearingsPerYear: 2 },
      manure: 4,
    },
    care: {
      feedPerDay: 4, feedTypes: ['hay', 'pasture'], waterPerDay: 2,
      spacePerHead: 20, shelterNeeded: true, minSkill: 1, hoursPerDay: 0.3,
    },
    repro: {
      gestationWeeks: 21, offspringMin: 1, offspringMax: 3,
      breedingAgeWeeks: 52, maxBreedingAgeWeeks: 364, season: 'fall', twinRate: 0.3,
    },
    mortality: {
      lifespanYears: 12, infantRate: 0.08, adultRate: 0.03,
      elderRate: 0.2, winterRate: 0.05, starvationDays: 7,
    },
    climates: ['temperate', 'cold'], terrains: ['plains', 'hills', 'mountain'],
    purchasePrice: 8, salePrice: 6,
  },

  goats: {
    id: 'goats', name: 'Goats', category: 'MULTI',
    yield: {
      meat: { lbs: 35, maturityWeeks: 26 },
      milk: { perDay: 0.75, lactationWeeks: 40, cheeseRatio: 8 },
      manure: 3,
    },
    care: {
      feedPerDay: 3, feedTypes: ['hay', 'browse', 'grain'], waterPerDay: 2,
      spacePerHead: 25, shelterNeeded: false, minSkill: 1, hoursPerDay: 0.2,
    },
    repro: {
      gestationWeeks: 21, offspringMin: 1, offspringMax: 4,
      breedingAgeWeeks: 32, maxBreedingAgeWeeks: 416, season: 'fall', twinRate: 0.5,
    },
    mortality: {
      lifespanYears: 15, infantRate: 0.06, adultRate: 0.02,
      elderRate: 0.12, winterRate: 0.02, starvationDays: 10,
    },
    climates: ['temperate', 'arid', 'cold'], terrains: ['mountain', 'hills', 'rocky'],
    purchasePrice: 6, salePrice: 4,
  },

  pigs: {
    id: 'pigs', name: 'Pigs', category: 'MEAT',
    yield: {
      meat: { lbs: 180, maturityWeeks: 26, tallow: 30 },
      manure: 15,
    },
    care: {
      feedPerDay: 8, feedTypes: ['grain', 'scraps', 'vegetables'], waterPerDay: 4,
      spacePerHead: 80, shelterNeeded: true, minSkill: 1, hoursPerDay: 0.3,
    },
    repro: {
      gestationWeeks: 16, offspringMin: 6, offspringMax: 12,
      breedingAgeWeeks: 32, maxBreedingAgeWeeks: 260, season: 'year_round',
    },
    mortality: {
      lifespanYears: 15, infantRate: 0.15, adultRate: 0.02,
      elderRate: 0.1, winterRate: 0.02, starvationDays: 10,
    },
    climates: ['temperate', 'tropical'], terrains: ['forest', 'plains'],
    purchasePrice: 10, salePrice: 8,
  },

  chickens: {
    id: 'chickens', name: 'Chickens', category: 'EGGS',
    yield: {
      eggs: { perDay: 0.8, layingWeeks: 78, hatchRate: 0.75 },
      meat: { lbs: 4, maturityWeeks: 20 },
      manure: 0.25,
    },
    care: {
      feedPerDay: 0.25, feedTypes: ['grain', 'scraps'], waterPerDay: 0.5,
      spacePerHead: 4, shelterNeeded: true, minSkill: 0, hoursPerDay: 0.05,
    },
    repro: {
      gestationWeeks: 3, offspringMin: 8, offspringMax: 15,
      breedingAgeWeeks: 20, maxBreedingAgeWeeks: 260, season: 'spring',
    },
    mortality: {
      lifespanYears: 8, infantRate: 0.2, adultRate: 0.05,
      elderRate: 0.3, winterRate: 0.1, starvationDays: 3,
    },
    climates: ['temperate', 'tropical'], terrains: ['plains', 'forest'],
    purchasePrice: 1, salePrice: 0.5,
  },

  ducks: {
    id: 'ducks', name: 'Ducks', category: 'EGGS',
    yield: {
      eggs: { perDay: 0.6, layingWeeks: 52, hatchRate: 0.7 },
      meat: { lbs: 5, maturityWeeks: 12 },
      manure: 0.3,
    },
    care: {
      feedPerDay: 0.3, feedTypes: ['grain', 'insects', 'vegetables'], waterPerDay: 1,
      spacePerHead: 6, shelterNeeded: true, minSkill: 0, hoursPerDay: 0.05,
    },
    repro: {
      gestationWeeks: 4, offspringMin: 8, offspringMax: 12,
      breedingAgeWeeks: 26, maxBreedingAgeWeeks: 312, season: 'spring',
    },
    mortality: {
      lifespanYears: 10, infantRate: 0.15, adultRate: 0.04,
      elderRate: 0.25, winterRate: 0.08, starvationDays: 3,
    },
    climates: ['temperate', 'tropical'], terrains: ['wetland', 'plains'],
    purchasePrice: 2, salePrice: 1,
  },

  horses: {
    id: 'horses', name: 'Horses', category: 'MOUNT',
    yield: {
      labor: { carryLbs: 200, pullLbs: 1500, hoursPerDay: 8 },
      manure: 50,
    },
    care: {
      feedPerDay: 20, feedTypes: ['hay', 'grain', 'pasture'], waterPerDay: 10,
      spacePerHead: 200, shelterNeeded: true, minSkill: 2, hoursPerDay: 1.5,
    },
    repro: {
      gestationWeeks: 48, offspringMin: 1, offspringMax: 1,
      breedingAgeWeeks: 156, maxBreedingAgeWeeks: 1040, season: 'spring',
    },
    mortality: {
      lifespanYears: 28, infantRate: 0.08, adultRate: 0.01,
      elderRate: 0.1, winterRate: 0.02, starvationDays: 21,
    },
    climates: ['temperate'], terrains: ['plains', 'hills'],
    purchasePrice: 75, salePrice: 60,
  },

  oxen: {
    id: 'oxen', name: 'Oxen', category: 'LABOR',
    yield: {
      labor: { carryLbs: 300, pullLbs: 2500, hoursPerDay: 10 },
      meat: { lbs: 500, maturityWeeks: 104, hide: 60 },
      manure: 70,
    },
    care: {
      feedPerDay: 30, feedTypes: ['hay', 'grain'], waterPerDay: 15,
      spacePerHead: 500, shelterNeeded: true, minSkill: 2, hoursPerDay: 1,
    },
    repro: {
      gestationWeeks: 40, offspringMin: 1, offspringMax: 1,
      breedingAgeWeeks: 104, maxBreedingAgeWeeks: 624, season: 'year_round',
    },
    mortality: {
      lifespanYears: 20, infantRate: 0.05, adultRate: 0.02,
      elderRate: 0.12, winterRate: 0.03, starvationDays: 14,
    },
    climates: ['temperate'], terrains: ['plains', 'hills'],
    purchasePrice: 100, salePrice: 80,
  },

  donkeys: {
    id: 'donkeys', name: 'Donkeys', category: 'LABOR',
    yield: {
      labor: { carryLbs: 150, pullLbs: 800, hoursPerDay: 10 },
      manure: 25,
    },
    care: {
      feedPerDay: 10, feedTypes: ['hay', 'browse'], waterPerDay: 5,
      spacePerHead: 150, shelterNeeded: false, minSkill: 1, hoursPerDay: 0.5,
    },
    repro: {
      gestationWeeks: 52, offspringMin: 1, offspringMax: 1,
      breedingAgeWeeks: 156, maxBreedingAgeWeeks: 1040, season: 'year_round',
    },
    mortality: {
      lifespanYears: 30, infantRate: 0.06, adultRate: 0.01,
      elderRate: 0.08, winterRate: 0.01, starvationDays: 21,
    },
    climates: ['temperate', 'arid'], terrains: ['mountain', 'desert', 'hills'],
    purchasePrice: 30, salePrice: 25,
  },

  bees: {
    id: 'bees', name: 'Bees (Hive)', category: 'MULTI',
    yield: {
      meat: { lbs: 30, maturityWeeks: 26 }, // honey in lbs per hive per season
      manure: 0,
    },
    care: {
      feedPerDay: 0, feedTypes: [], waterPerDay: 0,
      spacePerHead: 10, shelterNeeded: false, minSkill: 2, hoursPerDay: 0.1,
    },
    repro: {
      gestationWeeks: 8, offspringMin: 1, offspringMax: 2,
      breedingAgeWeeks: 52, maxBreedingAgeWeeks: 260, season: 'spring',
    },
    mortality: {
      lifespanYears: 5, infantRate: 0.3, adultRate: 0.1,
      elderRate: 0.4, winterRate: 0.2, starvationDays: 7,
    },
    climates: ['temperate', 'tropical'], terrains: ['forest', 'plains', 'garden'],
    purchasePrice: 15, salePrice: 10,
    requiredSeed: 'beekeeping',
  },

  rothe: {
    id: 'rothe', name: 'Rothe', category: 'MULTI',
    yield: {
      meat: { lbs: 350, maturityWeeks: 65, hide: 35 },
      milk: { perDay: 2, lactationWeeks: 40, cheeseRatio: 8 },
      labor: { carryLbs: 250, pullLbs: 2000, hoursPerDay: 12 },
      manure: 55,
    },
    care: {
      feedPerDay: 20, feedTypes: ['fungus', 'moss', 'grain'], waterPerDay: 10,
      spacePerHead: 350, shelterNeeded: false, minSkill: 2, hoursPerDay: 0.6,
    },
    repro: {
      gestationWeeks: 36, offspringMin: 1, offspringMax: 2,
      breedingAgeWeeks: 52, maxBreedingAgeWeeks: 520, season: 'year_round',
    },
    mortality: {
      lifespanYears: 20, infantRate: 0.04, adultRate: 0.01,
      elderRate: 0.1, winterRate: 0, starvationDays: 21,
    },
    climates: ['underground'], terrains: ['cavern', 'underground'],
    purchasePrice: 80, salePrice: 65,
  },

  giant_goats: {
    id: 'giant_goats', name: 'Giant Goats', category: 'MULTI',
    yield: {
      meat: { lbs: 150, maturityWeeks: 52 },
      milk: { perDay: 1.5, lactationWeeks: 30, cheeseRatio: 7 },
      labor: { carryLbs: 180, pullLbs: 600, hoursPerDay: 8 },
      manure: 12,
    },
    care: {
      feedPerDay: 12, feedTypes: ['hay', 'browse', 'mountain_grass'], waterPerDay: 6,
      spacePerHead: 100, shelterNeeded: false, minSkill: 2, hoursPerDay: 0.5,
    },
    repro: {
      gestationWeeks: 24, offspringMin: 1, offspringMax: 2,
      breedingAgeWeeks: 78, maxBreedingAgeWeeks: 520, season: 'fall', twinRate: 0.2,
    },
    mortality: {
      lifespanYears: 18, infantRate: 0.05, adultRate: 0.02,
      elderRate: 0.1, winterRate: 0.01, starvationDays: 14,
    },
    climates: ['cold', 'temperate'], terrains: ['mountain', 'alpine', 'rocky'],
    purchasePrice: 50, salePrice: 40,
  },
}

// ============================================================
// HERD — Cohort of animals at a hub
// ============================================================

export interface Herd {
  hubId: string
  speciesId: string
  /** Head counts by age group */
  young: number    // Pre-maturity
  adults: number   // Breeding age
  elders: number   // Past max breeding age
  /** Pregnancies in progress */
  pregnancies: number
  /** Weeks until next births (oldest pregnancy) */
  weeksUntilBirth: number
  /** Current health 0-100 */
  health: number
  /** Weeks since last feed (0 = fed today) */
  daysSinceLastFeed: number
  /** Total meat produced this month (lbs) */
  monthlyMeatProduced: number
  /** Total milk produced this month (gallons) */
  monthlyMilkProduced: number
  /** Total eggs produced this month */
  monthlyEggsProduced: number
  /** Total manure produced this month (lbs) */
  monthlyManureProduced: number
}

export function createHerd(hubId: string, speciesId: string, adults: number = 0): Herd {
  return {
    hubId, speciesId, young: 0, adults, elders: 0,
    pregnancies: 0, weeksUntilBirth: 0, health: 100,
    daysSinceLastFeed: 0,
    monthlyMeatProduced: 0, monthlyMilkProduced: 0,
    monthlyEggsProduced: 0, monthlyManureProduced: 0,
  }
}

export function totalHead(herd: Herd): number {
  return herd.young + herd.adults + herd.elders
}

// ============================================================
// WEEKLY YIELD TICK
// ============================================================

export interface WeeklyYield {
  meatLbs: number     // Only from scheduled slaughter
  milkGallons: number
  eggs: number
  woolLbs: number
  manureLbs: number
}

/**
 * Calculate one week's yield from a herd.
 * This fires on the WEEKLY tick of the world clock.
 */
export function weeklyYieldTick(herd: Herd, species: Species): WeeklyYield {
  const head = totalHead(herd)
  if (head === 0) return { meatLbs: 0, milkGallons: 0, eggs: 0, woolLbs: 0, manureLbs: 0 }

  const healthMod = herd.health / 100

  // Milk: adults only, modified by health
  const milkGallons = species.yield.milk
    ? herd.adults * species.yield.milk.perDay * 7 * healthMod * 0.5 // ~50% are lactating
    : 0

  // Eggs: adults only
  const eggs = species.yield.eggs
    ? herd.adults * species.yield.eggs.perDay * 7 * healthMod * 0.6 // ~60% are laying hens
    : 0

  // Wool: per shearing, spread across year
  const woolLbs = species.yield.wool
    ? (herd.adults * species.yield.wool.perShearing * species.yield.wool.shearingsPerYear) / 52
    : 0

  // Manure: all animals, every day
  const manureLbs = head * species.yield.manure * 7

  // Accumulate on the herd
  herd.monthlyMilkProduced += milkGallons
  herd.monthlyEggsProduced += eggs
  herd.monthlyManureProduced += manureLbs

  return { meatLbs: 0, milkGallons, eggs, woolLbs, manureLbs }
}

// ============================================================
// SLAUGHTER
// ============================================================

export interface SlaughterResult {
  meatLbs: number
  hideLbs: number
  tallowLbs: number
}

/** Slaughter N animals from the herd. Returns yield. */
export function slaughter(herd: Herd, species: Species, count: number): SlaughterResult {
  const actual = Math.min(count, herd.adults + herd.elders)
  const fromElders = Math.min(actual, herd.elders)
  const fromAdults = actual - fromElders

  herd.elders -= fromElders
  herd.adults -= fromAdults

  const meatProfile = species.yield.meat
  if (!meatProfile) return { meatLbs: 0, hideLbs: 0, tallowLbs: 0 }

  const result = {
    meatLbs: actual * meatProfile.lbs,
    hideLbs: actual * (meatProfile.hide ?? 0),
    tallowLbs: actual * (meatProfile.tallow ?? 0),
  }

  herd.monthlyMeatProduced += result.meatLbs
  return result
}

// ============================================================
// MONTHLY TICK — Reproduction, mortality, aging
// ============================================================

export interface MonthlyTickResult {
  births: number
  deaths: number
  newPregnancies: number
  starvationDeaths: number
  aged: { youngToAdult: number; adultToElder: number }
  feedConsumedLbs: number
  waterConsumedGallons: number
}

/**
 * Monthly herd tick. This fires on the MONTHLY cadence.
 * Handles reproduction, mortality, aging, and resource consumption.
 * 
 * @param d20s — Array of d20 rolls for deterministic testing
 * @param isWinter — Whether it's winter (extra mortality)
 * @param currentSeason — For breeding season checks
 */
export function monthlyHerdTick(
  herd: Herd,
  species: Species,
  d20s: number[],
  isWinter: boolean,
  currentSeason: BreedingSeason,
): MonthlyTickResult {
  let rollIdx = 0
  const d20 = () => d20s[rollIdx++ % d20s.length]

  const result: MonthlyTickResult = {
    births: 0, deaths: 0, newPregnancies: 0,
    starvationDeaths: 0, aged: { youngToAdult: 0, adultToElder: 0 },
    feedConsumedLbs: 0, waterConsumedGallons: 0,
  }

  const head = totalHead(herd)
  if (head === 0) return result

  // ── Phase 1: Feed consumption (30 days) ──
  result.feedConsumedLbs = head * species.care.feedPerDay * 30
  result.waterConsumedGallons = head * species.care.waterPerDay * 30

  // ── Phase 2: Starvation check ──
  if (herd.daysSinceLastFeed >= species.mortality.starvationDays) {
    // Every day past starvation threshold kills ~10% of herd
    const excessDays = herd.daysSinceLastFeed - species.mortality.starvationDays
    const starvationRate = Math.min(0.5, excessDays * 0.1)
    const starveDead = Math.floor(head * starvationRate)
    herd.young = Math.max(0, herd.young - Math.floor(starveDead * 0.4))
    herd.adults = Math.max(0, herd.adults - Math.floor(starveDead * 0.3))
    herd.elders = Math.max(0, herd.elders - Math.floor(starveDead * 0.3))
    result.starvationDeaths = starveDead
    result.deaths += starveDead
    herd.health = Math.max(10, herd.health - 20)
  }

  // ── Phase 3: Natural mortality ──
  // Young
  if (herd.young > 0) {
    const infantDeaths = Math.floor(herd.young * species.mortality.infantRate)
    const roll = d20()
    const actual = roll <= 5 ? infantDeaths + 1 : Math.max(0, infantDeaths - 1) // variance
    const dead = Math.min(actual, herd.young)
    herd.young -= dead
    result.deaths += dead
  }

  // Adults
  if (herd.adults > 0) {
    const adultDeaths = Math.floor(herd.adults * species.mortality.adultRate)
    const dead = Math.min(adultDeaths, herd.adults)
    herd.adults -= dead
    result.deaths += dead
  }

  // Elders
  if (herd.elders > 0) {
    const elderDeaths = Math.max(1, Math.floor(herd.elders * species.mortality.elderRate))
    const dead = Math.min(elderDeaths, herd.elders)
    herd.elders -= dead
    result.deaths += dead
  }

  // Winter attrition
  if (isWinter && species.mortality.winterRate > 0) {
    const newHead = totalHead(herd)
    const winterDead = Math.floor(newHead * species.mortality.winterRate)
    if (winterDead > 0) {
      herd.young = Math.max(0, herd.young - Math.ceil(winterDead * 0.5))
      herd.elders = Math.max(0, herd.elders - Math.ceil(winterDead * 0.3))
      herd.adults = Math.max(0, herd.adults - Math.ceil(winterDead * 0.2))
      result.deaths += winterDead
    }
  }

  // ── Phase 4: Births (from existing pregnancies) ──
  if (herd.pregnancies > 0 && herd.weeksUntilBirth <= 0) {
    const avgOffspring = (species.repro.offspringMin + species.repro.offspringMax) / 2
    const born = Math.floor(herd.pregnancies * avgOffspring)
    herd.young += born
    result.births = born
    herd.pregnancies = 0
  } else if (herd.pregnancies > 0) {
    herd.weeksUntilBirth = Math.max(0, herd.weeksUntilBirth - 4) // ~4 weeks per month
  }

  // ── Phase 5: New pregnancies (seasonal breeding) ──
  const canBreed = species.repro.season === 'year_round' || species.repro.season === currentSeason
  if (canBreed && herd.adults >= 2 && herd.pregnancies === 0) {
    // ~50% of adults are female, ~70% conceive
    const breedingFemales = Math.floor(herd.adults * 0.5)
    const roll = d20()
    const conceptionRate = roll >= 15 ? 0.8 : roll >= 10 ? 0.7 : roll >= 5 ? 0.6 : 0.5
    const conceived = Math.max(1, Math.floor(breedingFemales * conceptionRate))
    herd.pregnancies = conceived
    herd.weeksUntilBirth = species.repro.gestationWeeks
    result.newPregnancies = conceived
  }

  // ── Phase 6: Age progression ──
  // Young → Adult (simplified: ~10% mature per month after maturity age reached)
  if (herd.young > 0) {
    const maturing = Math.max(1, Math.floor(herd.young * 0.1))
    const actual = Math.min(maturing, herd.young)
    herd.young -= actual
    herd.adults += actual
    result.aged.youngToAdult = actual
  }

  // Adult → Elder (very slow: ~1% per month after max breeding age)
  if (herd.adults > 10) {
    const aging = Math.max(0, Math.floor(herd.adults * 0.01))
    herd.adults -= aging
    herd.elders += aging
    result.aged.adultToElder = aging
  }

  // ── Phase 7: Health recovery ──
  if (herd.daysSinceLastFeed === 0 && herd.health < 100) {
    herd.health = Math.min(100, herd.health + 5)
  }

  // Reset monthly counters
  herd.monthlyMeatProduced = 0
  herd.monthlyMilkProduced = 0
  herd.monthlyEggsProduced = 0
  herd.monthlyManureProduced = 0

  return result
}

// ============================================================
// SETTLEMENT FOOD CALCULATION
// ============================================================

export interface FoodSufficiency {
  totalMeatPerMonth: number
  totalMilkPerMonth: number
  totalEggsPerMonth: number
  feedRequired: number
  populationFeedable: number // How many people this herd can feed
  isSufficient: boolean      // Feeds enough for the hub population?
}

/**
 * Calculate food sufficiency of a settlement's herds.
 * Assumes ~3 lbs meat + 1 gallon milk per person per week.
 */
export function calculateFoodSufficiency(
  herds: Herd[],
  hubPopulation: number,
): FoodSufficiency {
  let totalMeat = 0
  let totalMilk = 0
  let totalEggs = 0
  let feedRequired = 0

  for (const herd of herds) {
    const species = SPECIES[herd.speciesId]
    if (!species) continue

    const head = totalHead(herd)
    const healthMod = herd.health / 100

    // Monthly meat from sustainable slaughter (~5% of adults per month)
    if (species.yield.meat) {
      const slaughterable = Math.floor(herd.adults * 0.05)
      totalMeat += slaughterable * species.yield.meat.lbs
    }

    // Monthly milk
    if (species.yield.milk) {
      totalMilk += herd.adults * species.yield.milk.perDay * 30 * healthMod * 0.5
    }

    // Monthly eggs
    if (species.yield.eggs) {
      totalEggs += herd.adults * species.yield.eggs.perDay * 30 * healthMod * 0.6
    }

    feedRequired += head * species.care.feedPerDay * 30
  }

  // How many people can this feed?
  // ~3 lbs meat/week/person = ~12 lbs/month
  // ~1 gallon milk/week/person = ~4 gallons/month
  const meatFeeds = totalMeat / 12
  const milkFeeds = totalMilk / 4
  const eggFeeds = totalEggs / 30 // ~30 eggs per person per month
  const populationFeedable = Math.floor(Math.max(meatFeeds, milkFeeds, eggFeeds))

  return {
    totalMeatPerMonth: totalMeat,
    totalMilkPerMonth: totalMilk,
    totalEggsPerMonth: totalEggs,
    feedRequired,
    populationFeedable,
    isSufficient: populationFeedable >= hubPopulation,
  }
}

// ============================================================
// HELPERS
// ============================================================

export function getSpecies(id: string): Species | undefined {
  return SPECIES[id]
}

export function getSpeciesByCategory(cat: LivestockCategory): Species[] {
  return Object.values(SPECIES).filter(s => s.category === cat)
}

export function getSpeciesForClimate(climate: string): Species[] {
  return Object.values(SPECIES).filter(s => s.climates.includes(climate))
}

export function getSpeciesForTerrain(terrain: string): Species[] {
  return Object.values(SPECIES).filter(s => s.terrains.includes(terrain))
}

export function dailyFeedCost(species: Species, count: number, pricePerLb: number = 0.01): number {
  return species.care.feedPerDay * count * pricePerLb
}

export function spaceRequired(species: Species, count: number): number {
  return species.care.spacePerHead * count
}
