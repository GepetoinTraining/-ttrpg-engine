/**
 * CRAFTSMAN — The Apprenticeship Road & Guild Formation
 * =======================================================
 *
 * Social mobility inside hubs. The path from untrained youth
 * to guild master, and the natural formation of guilds
 * when enough masters exist in a settlement.
 *
 * CAREER ROAD:
 *   UNTRAINED → APPRENTICE → JOURNEYMAN → MASTER
 *
 *   Untrained:    Youth from ChildPool or immigrant
 *   Apprentice:   3-7 years under a master (social contract)
 *                 Learns recipes, gains skill XP, lives in master's household
 *                 Cannot sell independently
 *
 *   Journeyman:   Passed exam (progress ≥ 100)
 *                 Can sell goods, can travel
 *                 Builds reputation, learns advanced recipes
 *                 ──── MIGRATION PRESSURE ────
 *                 Cities are saturated with masters.
 *                 Journeyman faces choice:
 *                   A) Wait years for a master spot in the city
 *                   B) Move to a smaller settlement → become master there
 *                 This is the ENGINE OF SETTLEMENT EXPANSION.
 *                 Skills flow outward from cities to developing regions.
 *
 *   Master:       Passed masterwork trial (d20 + skill vs DC)
 *                 Can own workshop, take apprentices (max 2-3)
 *                 Full guild voting rights
 *
 * GUILD FORMATION:
 *   When ≥3 masters of the same trade exist at a settlement,
 *   a guild chapter NATURALLY forms. This is emergent, not imposed.
 *
 * TICK INTEGRATION:
 *   Monthly: advance apprenticeships, check promotions
 *   Quarterly: evaluate migration pressure, attempt masterworks
 */

// ============================================================
// CRAFT TRADES — 18 crafts (from bend/guilds.ts)
// ============================================================

export type CraftTrade =
  | 'smithing'       // Blacksmiths, weaponsmiths, armorsmiths
  | 'masonry'        // Stonework, construction
  | 'carpentry'      // Woodwork, construction
  | 'weaving'        // Textiles, cloth
  | 'tanning'        // Leather working
  | 'pottery'        // Ceramics
  | 'jeweling'       // Gems, precious metals
  | 'alchemy'        // Potions, chemicals
  | 'scribing'       // Books, scrolls
  | 'shipbuilding'   // Boats, ships
  | 'coopering'      // Barrels, containers
  | 'chandlery'      // Candles, soap
  | 'dyeing'         // Fabric coloring
  | 'glassblowing'   // Glass items
  | 'brewing'        // Ale, beer
  | 'winemaking'     // Wine
  | 'baking'         // Bread, pastries
  | 'butchery'       // Meat processing

// ============================================================
// CRAFT RANK — The career ladder
// ============================================================

export type CraftRank = 'untrained' | 'apprentice' | 'journeyman' | 'master'

export const CRAFT_RANK_ORDER: Record<CraftRank, number> = {
  untrained: 0,
  apprentice: 1,
  journeyman: 2,
  master: 3,
}

// ============================================================
// RECIPE — What craftsmen can make
// ============================================================

export interface RecipeInput {
  commodityId: string
  quantity: number
}

export interface Recipe {
  id: string
  name: string
  trade: CraftTrade
  inputs: RecipeInput[]
  output: {
    commodityId: string
    quantity: number
    quality: 'poor' | 'common' | 'good' | 'excellent' | 'masterwork'
  }
  skillRequired: number     // 1-5
  rankRequired: CraftRank
  craftTimeDays: number
  baseDC: number            // d20 + skill mod vs this DC for quality
}

// ============================================================
// SEED RECIPES — 1-2 per trade, enough to demonstrate the system
// ============================================================

export const SEED_RECIPES: Recipe[] = [
  // Smithing
  { id: 'rec_iron_sword', name: 'Iron Sword', trade: 'smithing', inputs: [{ commodityId: 'iron', quantity: 3 }], output: { commodityId: 'weapons', quantity: 1, quality: 'common' }, skillRequired: 1, rankRequired: 'apprentice', craftTimeDays: 3, baseDC: 10 },
  { id: 'rec_steel_plate', name: 'Steel Plate Armor', trade: 'smithing', inputs: [{ commodityId: 'iron', quantity: 10 }, { commodityId: 'coal', quantity: 5 }], output: { commodityId: 'armor', quantity: 1, quality: 'good' }, skillRequired: 3, rankRequired: 'journeyman', craftTimeDays: 14, baseDC: 15 },
  { id: 'rec_masterwork_blade', name: 'Masterwork Blade', trade: 'smithing', inputs: [{ commodityId: 'iron', quantity: 5 }, { commodityId: 'coal', quantity: 3 }], output: { commodityId: 'weapons', quantity: 1, quality: 'masterwork' }, skillRequired: 5, rankRequired: 'master', craftTimeDays: 21, baseDC: 20 },
  // Alchemy
  { id: 'rec_healing_potion', name: 'Healing Potion', trade: 'alchemy', inputs: [{ commodityId: 'herbs', quantity: 2 }, { commodityId: 'magic_components', quantity: 1 }], output: { commodityId: 'potions', quantity: 1, quality: 'common' }, skillRequired: 1, rankRequired: 'apprentice', craftTimeDays: 1, baseDC: 10 },
  { id: 'rec_greater_potion', name: 'Greater Healing Potion', trade: 'alchemy', inputs: [{ commodityId: 'herbs', quantity: 5 }, { commodityId: 'magic_components', quantity: 3 }], output: { commodityId: 'potions', quantity: 1, quality: 'excellent' }, skillRequired: 4, rankRequired: 'journeyman', craftTimeDays: 3, baseDC: 17 },
  // Carpentry
  { id: 'rec_furniture', name: 'Furniture Set', trade: 'carpentry', inputs: [{ commodityId: 'timber', quantity: 5 }], output: { commodityId: 'furniture', quantity: 1, quality: 'common' }, skillRequired: 1, rankRequired: 'apprentice', craftTimeDays: 5, baseDC: 10 },
  { id: 'rec_cart', name: 'Trade Cart', trade: 'carpentry', inputs: [{ commodityId: 'timber', quantity: 15 }, { commodityId: 'iron', quantity: 3 }], output: { commodityId: 'carts', quantity: 1, quality: 'good' }, skillRequired: 3, rankRequired: 'journeyman', craftTimeDays: 10, baseDC: 14 },
  // Weaving
  { id: 'rec_cloth', name: 'Bolt of Cloth', trade: 'weaving', inputs: [{ commodityId: 'wool', quantity: 4 }], output: { commodityId: 'cloth', quantity: 2, quality: 'common' }, skillRequired: 1, rankRequired: 'apprentice', craftTimeDays: 3, baseDC: 8 },
  // Brewing
  { id: 'rec_ale', name: 'Barrel of Ale', trade: 'brewing', inputs: [{ commodityId: 'grain', quantity: 5 }], output: { commodityId: 'ale', quantity: 3, quality: 'common' }, skillRequired: 1, rankRequired: 'apprentice', craftTimeDays: 7, baseDC: 8 },
  // Baking
  { id: 'rec_bread', name: 'Bread Loaves', trade: 'baking', inputs: [{ commodityId: 'grain', quantity: 2 }], output: { commodityId: 'bread', quantity: 5, quality: 'common' }, skillRequired: 1, rankRequired: 'apprentice', craftTimeDays: 1, baseDC: 6 },
  // Tanning
  { id: 'rec_leather_armor', name: 'Leather Armor', trade: 'tanning', inputs: [{ commodityId: 'leather', quantity: 4 }], output: { commodityId: 'leather_armor', quantity: 1, quality: 'common' }, skillRequired: 2, rankRequired: 'journeyman', craftTimeDays: 5, baseDC: 12 },
  // Jeweling
  { id: 'rec_ring', name: 'Gold Ring', trade: 'jeweling', inputs: [{ commodityId: 'gold', quantity: 1 }, { commodityId: 'gems', quantity: 1 }], output: { commodityId: 'jewelry', quantity: 1, quality: 'good' }, skillRequired: 2, rankRequired: 'journeyman', craftTimeDays: 2, baseDC: 13 },
]

// ============================================================
// CRAFTSMAN — The individual
// ============================================================

export interface Craftsman {
  id: string
  entityId: string          // Links to NPC/local actor
  name: string
  trade: CraftTrade
  rank: CraftRank

  // Skill
  skillLevel: number        // 1-5
  skillXP: number           // XP towards next level
  intModifier: number       // Intelligence modifier (-2 to +5)

  // Recipes known
  knownRecipeIds: string[]

  // Apprenticeship (if rank === 'apprentice')
  masterId?: string         // Who they're apprenticed to
  masterName?: string
  apprenticeshipProgress: number  // 0-100
  apprenticeshipStartDay: number

  // Workshop (if rank === 'master')
  workshopNodeId?: string
  workshopVenueId?: string

  // Apprentices taken (if rank === 'master')
  apprenticeIds: string[]

  // Location
  nodeId: string
  reputation: number        // 0-100

  // Economics
  gold: number
  weeklyRevenue: number
  weeklyExpenses: number

  status: 'active' | 'traveling' | 'retired' | 'dead'
}

// ============================================================
// CREATION
// ============================================================

let _craftsmanSeq = 0
export function resetCraftsmanSeq(): void { _craftsmanSeq = 0 }

export function createCraftsman(
  entityId: string,
  name: string,
  trade: CraftTrade,
  nodeId: string,
  overrides: Partial<Craftsman> = {},
): Craftsman {
  return {
    id: `craft_${++_craftsmanSeq}`,
    entityId,
    name,
    trade,
    rank: 'untrained',
    skillLevel: 0,
    skillXP: 0,
    intModifier: 0,
    knownRecipeIds: [],
    apprenticeshipProgress: 0,
    apprenticeshipStartDay: 0,
    apprenticeIds: [],
    nodeId,
    reputation: 0,
    gold: 0,
    weeklyRevenue: 0,
    weeklyExpenses: 0,
    status: 'active',
    ...overrides,
  }
}

// ============================================================
// APPRENTICESHIP — Begin, advance, complete
// ============================================================

export interface ApprenticeshipResult {
  success: boolean
  reason?: string
  contractType?: string
}

/**
 * Begin an apprenticeship. The craftsman becomes an apprentice
 * under a master, gaining their first recipes.
 */
export function beginApprenticeship(
  craftsman: Craftsman,
  master: Craftsman,
  worldDay: number,
  apprenticeFee: number = 0,
): ApprenticeshipResult {
  // Validation
  if (craftsman.rank !== 'untrained') {
    return { success: false, reason: 'Already trained' }
  }
  if (master.rank !== 'master') {
    return { success: false, reason: 'Teacher is not a master' }
  }
  if (master.apprenticeIds.length >= 3) {
    return { success: false, reason: 'Master already has maximum apprentices' }
  }
  if (master.trade !== craftsman.trade) {
    return { success: false, reason: 'Trade mismatch' }
  }

  // Apply
  craftsman.rank = 'apprentice'
  craftsman.masterId = master.id
  craftsman.masterName = master.name
  craftsman.apprenticeshipProgress = 0
  craftsman.apprenticeshipStartDay = worldDay
  craftsman.nodeId = master.nodeId  // Move to master's settlement
  craftsman.skillLevel = 1

  // Learn starter recipes (skill 1 recipes for this trade)
  const starterRecipes = SEED_RECIPES.filter(
    r => r.trade === craftsman.trade && r.skillRequired <= 1
  )
  craftsman.knownRecipeIds = starterRecipes.map(r => r.id)

  // Master takes the apprentice
  master.apprenticeIds.push(craftsman.id)

  // Pay the fee
  if (apprenticeFee > 0 && craftsman.gold >= apprenticeFee) {
    craftsman.gold -= apprenticeFee
    master.gold += apprenticeFee
  }

  return {
    success: true,
    contractType: 'apprenticeship', // For social.ts contract creation
  }
}

/**
 * Monthly advancement of an apprenticeship.
 * Based on bend/guilds.ts calculateApprenticeshipProgress formula:
 *   Base: ~1.67% per month (100% / 60 months = 5 years)
 *   Modified by skill level, intelligence, hours worked
 */
export function advanceApprenticeship(
  craftsman: Craftsman,
  hoursWorkedThisMonth: number = 160,
): {
  newProgress: number
  progressGained: number
  monthsRemaining: number
  readyForExam: boolean
  skillUp: boolean
} {
  if (craftsman.rank !== 'apprentice') {
    return { newProgress: 0, progressGained: 0, monthsRemaining: 0, readyForExam: false, skillUp: false }
  }

  // Base: 100% / (5 years * 12 months)
  const baseMonthlyProgress = 100 / 60

  // Modifiers
  const skillMod = 1 + (craftsman.skillLevel - 1) * 0.1    // 1.0 to 1.4
  const intMod = 1 + craftsman.intModifier * 0.05           // INT contributes
  const hoursMod = Math.min(1.5, hoursWorkedThisMonth / 160) // Full time base

  const progressGained = baseMonthlyProgress * skillMod * intMod * hoursMod
  const newProgress = Math.min(100, craftsman.apprenticeshipProgress + progressGained)
  craftsman.apprenticeshipProgress = newProgress

  // Skill XP from working
  craftsman.skillXP += Math.floor(hoursWorkedThisMonth / 40) // 1 XP per 40 hours

  // Skill level up: every 10 XP = 1 level (max 5)
  let skillUp = false
  const newSkillLevel = Math.min(5, Math.floor(craftsman.skillXP / 10) + 1)
  if (newSkillLevel > craftsman.skillLevel) {
    craftsman.skillLevel = newSkillLevel
    skillUp = true

    // Unlock new recipes at new skill level
    const newRecipes = SEED_RECIPES.filter(
      r => r.trade === craftsman.trade &&
           r.skillRequired <= craftsman.skillLevel &&
           !craftsman.knownRecipeIds.includes(r.id)
    )
    for (const recipe of newRecipes) {
      craftsman.knownRecipeIds.push(recipe.id)
    }
  }

  const remaining = 100 - newProgress
  const avgProgress = progressGained || baseMonthlyProgress
  const monthsRemaining = Math.ceil(remaining / avgProgress)

  return {
    newProgress,
    progressGained,
    monthsRemaining,
    readyForExam: newProgress >= 100,
    skillUp,
  }
}

/**
 * Complete the journeyman exam. Promotes to journeyman if progress ≥ 100.
 */
export function completeJourneymanExam(
  craftsman: Craftsman,
  worldDay: number,
): { promoted: boolean; reason?: string } {
  if (craftsman.rank !== 'apprentice') {
    return { promoted: false, reason: 'Not an apprentice' }
  }
  if (craftsman.apprenticeshipProgress < 100) {
    return { promoted: false, reason: `Progress only ${craftsman.apprenticeshipProgress.toFixed(1)}%` }
  }

  // Promote!
  craftsman.rank = 'journeyman'
  craftsman.reputation = 10

  // Remove from master's apprentice list
  // (caller should handle this since we don't have master reference)

  return { promoted: true }
}

// ============================================================
// MASTERWORK TRIAL — Journeyman attempts to become Master
// ============================================================

export interface MasterworkTrialResult {
  success: boolean
  d20Roll: number
  totalRoll: number
  dc: number
  promoted: boolean
  reason?: string
}

/**
 * Attempt the masterwork trial. d20 + skill + INT mod vs DC 18.
 * This is the gating check for becoming a master.
 */
export function attemptMasterwork(
  craftsman: Craftsman,
  d20Roll: number,
  worldDay: number,
  dc: number = 18,
): MasterworkTrialResult {
  if (craftsman.rank !== 'journeyman') {
    return { success: false, d20Roll, totalRoll: 0, dc, promoted: false, reason: 'Not a journeyman' }
  }
  if (craftsman.skillLevel < 3) {
    return { success: false, d20Roll, totalRoll: 0, dc, promoted: false, reason: 'Skill too low (need ≥3)' }
  }

  const totalRoll = d20Roll + craftsman.skillLevel + craftsman.intModifier
  const success = totalRoll >= dc

  if (success) {
    craftsman.rank = 'master'
    craftsman.reputation = Math.max(craftsman.reputation, 30)
  }

  return { success, d20Roll, totalRoll, dc, promoted: success }
}

// ============================================================
// CRAFTING — Make items from recipes
// ============================================================

export interface CraftResult {
  success: boolean
  recipe: Recipe
  qualityAchieved: string
  d20Roll: number
  totalRoll: number
}

/**
 * Attempt to craft an item. d20 + skill vs recipe DC.
 * Higher roll = better quality.
 */
export function craftItem(
  craftsman: Craftsman,
  recipeId: string,
  d20Roll: number,
): CraftResult | null {
  const recipe = SEED_RECIPES.find(r => r.id === recipeId)
  if (!recipe) return null
  if (!craftsman.knownRecipeIds.includes(recipeId)) return null
  if (CRAFT_RANK_ORDER[craftsman.rank] < CRAFT_RANK_ORDER[recipe.rankRequired]) return null

  const totalRoll = d20Roll + craftsman.skillLevel + craftsman.intModifier
  const success = totalRoll >= recipe.baseDC

  // Quality ladder based on how much you beat the DC by
  let qualityAchieved: string
  const margin = totalRoll - recipe.baseDC
  if (!success)           qualityAchieved = 'failed'
  else if (margin >= 10)  qualityAchieved = 'masterwork'
  else if (margin >= 7)   qualityAchieved = 'excellent'
  else if (margin >= 4)   qualityAchieved = 'good'
  else                    qualityAchieved = 'common'

  // Gain skill XP from crafting (success or failure)
  craftsman.skillXP += success ? 2 : 1

  return { success, recipe, qualityAchieved, d20Roll, totalRoll }
}

// ============================================================
// MIGRATION PRESSURE — The engine of settlement expansion
// ============================================================
//
// Cities are saturated. There are already N masters in Waterdeep
// competing for the same customers. A journeyman faces:
//   A) Wait years in the city, paying high rent, low chance of
//      becoming master while spots are filled
//   B) Move to a developing settlement where they can be THE smith,
//      THE brewer, THE carpenter — instant master potential
//
// This naturally drives skilled labor from cities → towns → villages,
// developing those settlements and creating new guild chapters.

export interface MigrationOption {
  targetNodeId: string
  targetName: string
  /** How many masters of this trade are already there (0 = untapped) */
  existingMasters: number
  /** Settlement scale — smaller = easier to dominate */
  scale: string
  /** Migration attractiveness score (higher = more attractive) */
  attractiveness: number
  /** Reason for the score */
  reasoning: string
}

export interface MigrationPressure {
  /** How saturated the current settlement is (0-1, higher = more pressure) */
  saturation: number
  /** Estimated months to master promotion if staying */
  monthsToMasterIfStaying: number
  /** Available migration options */
  options: MigrationOption[]
  /** Should they migrate? */
  shouldMigrate: boolean
}

/**
 * Evaluate migration pressure for a journeyman.
 *
 * @param craftsman - The journeyman considering migration
 * @param localMasterCount - How many masters of this trade are at their current settlement
 * @param localMaxCapacity - How many masters the settlement can support for this trade
 * @param nearbySettlements - Neighboring settlements with their master counts
 */
export function evaluateMigration(
  craftsman: Craftsman,
  localMasterCount: number,
  localMaxCapacity: number,
  nearbySettlements: { nodeId: string; name: string; masterCount: number; maxCapacity: number; scale: string }[],
): MigrationPressure {
  if (craftsman.rank !== 'journeyman') {
    return { saturation: 0, monthsToMasterIfStaying: 0, options: [], shouldMigrate: false }
  }

  // Saturation: how full is this settlement for this trade?
  const saturation = localMaxCapacity > 0 ? localMasterCount / localMaxCapacity : 1

  // Estimated time to master if staying: more masters = longer wait
  // Base: 12 months to accumulate skill. Per excess master: +6 months
  const excessMasters = Math.max(0, localMasterCount - Math.floor(localMaxCapacity * 0.7))
  const monthsToMasterIfStaying = 12 + excessMasters * 6

  // Score nearby settlements
  const options: MigrationOption[] = nearbySettlements.map(s => {
    const theirSaturation = s.maxCapacity > 0 ? s.masterCount / s.maxCapacity : 1
    const vacancy = s.maxCapacity - s.masterCount

    // Attractiveness formula:
    //   High vacancy + low saturation + smaller scale = more attractive
    let attractiveness = 0
    let reasoning = ''

    if (s.masterCount === 0) {
      // Untapped market — huge opportunity
      attractiveness = 100
      reasoning = 'No competition — become the first master!'
    } else if (theirSaturation < 0.5) {
      attractiveness = 70 + vacancy * 5
      reasoning = `Low competition (${s.masterCount}/${s.maxCapacity} masters)`
    } else if (theirSaturation < 0.8) {
      attractiveness = 40
      reasoning = `Growing market (${s.masterCount}/${s.maxCapacity} masters)`
    } else {
      attractiveness = 10
      reasoning = `Saturated (${s.masterCount}/${s.maxCapacity} masters)`
    }

    // Personality modifier: risk-tolerant journeymen prefer frontier
    attractiveness += (craftsman.intModifier * 3) // Smart → sees opportunity

    return {
      targetNodeId: s.nodeId,
      targetName: s.name,
      existingMasters: s.masterCount,
      scale: s.scale,
      attractiveness: Math.max(0, Math.min(100, attractiveness)),
      reasoning,
    }
  }).sort((a, b) => b.attractiveness - a.attractiveness)

  // Should migrate? If local saturation > 80% AND best option > 50 attractiveness
  const shouldMigrate = saturation > 0.8
    && options.length > 0
    && options[0].attractiveness > 50

  return { saturation, monthsToMasterIfStaying, options, shouldMigrate }
}

/**
 * Execute a migration. Moves the craftsman to a new settlement.
 */
export function migrateCraftsman(
  craftsman: Craftsman,
  targetNodeId: string,
  worldDay: number,
): void {
  craftsman.nodeId = targetNodeId
  craftsman.status = 'active'
  craftsman.reputation = Math.max(5, craftsman.reputation - 10) // Reputation drops in new place
}

// ============================================================
// GUILD FORMATION — Natural emergence when enough masters
// ============================================================

export interface GuildFormationCheck {
  canForm: boolean
  trade: CraftTrade
  nodeId: string
  masterCount: number
  requiredMasters: number
  masters: { id: string; name: string }[]
}

/**
 * Check if a guild chapter can form at a settlement.
 * Requires ≥3 masters of the same trade.
 */
export function evaluateGuildFormation(
  craftsmen: Craftsman[],
  nodeId: string,
  trade: CraftTrade,
  requiredMasters: number = 3,
): GuildFormationCheck {
  const localMasters = craftsmen.filter(
    c => c.nodeId === nodeId && c.trade === trade && c.rank === 'master' && c.status === 'active'
  )

  return {
    canForm: localMasters.length >= requiredMasters,
    trade,
    nodeId,
    masterCount: localMasters.length,
    requiredMasters,
    masters: localMasters.map(m => ({ id: m.id, name: m.name })),
  }
}

/**
 * How many masters of a trade a settlement can support.
 * Based on settlement population/scale.
 */
export function getTradeCapacity(settlementScale: string): number {
  switch (settlementScale) {
    case 'metropolis': return 15  // Many masters, very saturated
    case 'city':       return 8
    case 'town':       return 4
    case 'village':    return 2   // Room for 1-2 masters
    case 'hamlet':     return 1   // One at most
    default:           return 2
  }
}

// ============================================================
// MONTHLY CRAFT TICK — Advance all craftsmen at a settlement
// ============================================================

export interface CraftTickResult {
  nodeId: string
  apprenticesAdvanced: number
  journeymanExams: number
  masterworkTrials: { id: string; name: string; success: boolean }[]
  migrations: { id: string; name: string; toNodeId: string }[]
  guildFormations: { trade: CraftTrade; masterCount: number }[]
  skillUps: number
}

/**
 * Monthly tick for all craftsmen at a settlement.
 * Advances apprenticeships, checks promotions, evaluates migration.
 */
export function monthlyCraftTick(
  craftsmen: Craftsman[],
  nodeId: string,
  settlementScale: string,
  worldDay: number,
  d20Roll: () => number,
  nearbySettlements: { nodeId: string; name: string; masterCount: number; maxCapacity: number; scale: string }[] = [],
): CraftTickResult {
  const result: CraftTickResult = {
    nodeId,
    apprenticesAdvanced: 0,
    journeymanExams: 0,
    masterworkTrials: [],
    migrations: [],
    guildFormations: [],
    skillUps: 0,
  }

  const localCraftsmen = craftsmen.filter(c => c.nodeId === nodeId && c.status === 'active')
  const capacity = getTradeCapacity(settlementScale)

  for (const craftsman of localCraftsmen) {
    // ── Apprentice advancement ──
    if (craftsman.rank === 'apprentice') {
      const advance = advanceApprenticeship(craftsman)
      result.apprenticesAdvanced++
      if (advance.skillUp) result.skillUps++

      if (advance.readyForExam) {
        const exam = completeJourneymanExam(craftsman, worldDay)
        if (exam.promoted) result.journeymanExams++
      }
    }

    // ── Journeyman masterwork attempt (quarterly, simulated monthly) ──
    if (craftsman.rank === 'journeyman' && craftsman.skillLevel >= 3) {
      // Only attempt every ~3 months (33% chance per month)
      if (d20Roll() <= 7) { // ~33% of d20 range
        const trial = attemptMasterwork(craftsman, d20Roll(), worldDay)
        result.masterworkTrials.push({
          id: craftsman.id,
          name: craftsman.name,
          success: trial.promoted,
        })
      }
    }

    // ── Journeyman migration pressure ──
    if (craftsman.rank === 'journeyman' && nearbySettlements.length > 0) {
      const localMasters = localCraftsmen.filter(
        c => c.trade === craftsman.trade && c.rank === 'master'
      ).length

      const pressure = evaluateMigration(
        craftsman, localMasters, capacity, nearbySettlements,
      )

      if (pressure.shouldMigrate && pressure.options.length > 0) {
        // Roll for willingness: only migrate if personality allows
        // (d20 roll > 10 = willing to take the risk)
        if (d20Roll() > 10) {
          const target = pressure.options[0]
          migrateCraftsman(craftsman, target.targetNodeId, worldDay)
          result.migrations.push({
            id: craftsman.id,
            name: craftsman.name,
            toNodeId: target.targetNodeId,
          })
        }
      }
    }
  }

  // ── Guild formation check (per trade) ──
  const trades = [...new Set(localCraftsmen.map(c => c.trade))]
  for (const trade of trades) {
    const formation = evaluateGuildFormation(craftsmen, nodeId, trade)
    if (formation.canForm) {
      result.guildFormations.push({
        trade,
        masterCount: formation.masterCount,
      })
    }
  }

  return result
}

// ============================================================
// QUERY HELPERS
// ============================================================

export function getCraftRecipes(trade: CraftTrade, rank: CraftRank, skillLevel: number): Recipe[] {
  return SEED_RECIPES.filter(
    r => r.trade === trade
      && CRAFT_RANK_ORDER[rank] >= CRAFT_RANK_ORDER[r.rankRequired]
      && skillLevel >= r.skillRequired
  )
}

export function getMastersAt(craftsmen: Craftsman[], nodeId: string, trade?: CraftTrade): Craftsman[] {
  return craftsmen.filter(c =>
    c.nodeId === nodeId &&
    c.rank === 'master' &&
    c.status === 'active' &&
    (!trade || c.trade === trade)
  )
}

export function getApprenticesOf(craftsmen: Craftsman[], masterId: string): Craftsman[] {
  return craftsmen.filter(c => c.masterId === masterId && c.rank === 'apprentice')
}
