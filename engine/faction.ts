/**
 * FACTION — Loyalty-Based Alignment & Economic Power
 * =====================================================
 * 
 * Alignment is NOT Good/Evil. It's WHO YOU SERVE.
 * 
 * Every entity (NPC, player, faction) has a loyalty graph:
 *   loyalties: Record<factionId, -100..+100>
 *     -100 = sworn enemy (kill on sight)
 *       -50 = hostile (active opposition)
 *         0 = neutral
 *       +50 = allied (mutual aid)
 *     +100 = blood oath (die for them)
 * 
 * Factions shape the world:
 *   - Control hub nodes → set laws, taxes, garrison
 *   - Control edge segments → tolls, patrols, trade routes
 *   - Own production → extraction bonuses, market influence
 *   - Employ NPCs → loyalty network, skill bonuses
 * 
 * ECONOMIC IMPACT:
 *   A faction controlling a trade hub with skilled merchants
 *   gives a price modifier. A faction with master smiths gives
 *   quality bonuses on weapon production. NPCs aren't cattle —
 *   their skills feed back into the economy.
 */

import { z } from 'zod'

// ============================================================
// FACTION TYPES
// ============================================================

export const FactionTypeSchema = z.enum([
  'guild',         // Artisans, merchants, thieves
  'noble_house',   // Feudal ruling family
  'criminal',      // Organized crime, cartels
  'religious',     // Temples, cults, orders
  'military',      // Armies, mercenary companies
  'merchant',      // Trading companies, banks
  'arcane',        // Mage colleges, cabals
  'government',    // City state, kingdom bureaucracy
  'tribal',        // Nomadic or indigenous
  'revolutionary', // Resistance, insurgency
  // === REALMS-OF-SHOD ALIGNMENT: cult / sanctuary ===
  // See: docs/realms-of-shod-mapping.md
  // Downgrade: src/lib/realms-of-shod-export.ts toRealmsCult / toRealmsSanctuary
  'cult',          // Secret religious/occult group — distinct from open 'religious' factions
  'sanctuary',     // Refuge organization (temple-as-asylum, monastery, protected enclave)
])
export type FactionType = z.infer<typeof FactionTypeSchema>

// ============================================================
// FACTION GOALS — What they're working toward
// ============================================================

export const FactionGoalTypeSchema = z.enum([
  'expand_territory',   // Control more hubs/edges
  'increase_trade',     // More trade routes, better prices
  'eliminate_rival',    // Destroy another faction
  'protect_people',     // Guard settlements, reduce danger
  'accumulate_wealth',  // Grow treasury
  'spread_faith',       // Convert populace, build temples
  'acquire_power',      // Political or magical power
  'monopolize',         // Control specific commodity
  'liberate',           // Free territory from another faction
  'survive',            // Defensive, under threat
])
export type FactionGoalType = z.infer<typeof FactionGoalTypeSchema>

export const FactionGoalSchema = z.object({
  id: z.string(),
  type: FactionGoalTypeSchema,
  description: z.string(),
  /** Target (node ID, faction ID, commodity ID, etc.) */
  targetId: z.string().optional(),
  /** Progress 0-100 */
  progress: z.number().min(0).max(100).default(0),
  /** Priority (higher = more resources allocated) */
  priority: z.number().int().min(1).max(10).default(5),
  /** Is this goal active? */
  active: z.boolean().default(true),
})
export type FactionGoal = z.infer<typeof FactionGoalSchema>

// ============================================================
// FACTION RANKS — Hierarchy
// ============================================================

export const FactionRankSchema = z.enum([
  'recruit',       // New member, limited trust
  'member',        // Full member, basic access
  'trusted',       // Proven, inner missions
  'officer',       // Commands others, local authority
  'commander',     // Regional authority
  'inner_circle',  // Top leadership
  'leader',        // The boss
])
export type FactionRank = z.infer<typeof FactionRankSchema>

export const RANK_AUTHORITY: Record<FactionRank, number> = {
  recruit:      1,
  member:       2,
  trusted:      3,
  officer:      5,
  commander:    7,
  inner_circle: 9,
  leader:       10,
}

// ============================================================
// FACTION MEMBER — An entity's membership
// ============================================================

export const FactionMemberSchema = z.object({
  entityId: z.string(),
  entityName: z.string(),
  rank: FactionRankSchema,
  joinedDay: z.number().int(),
  /** Contribution score (missions completed, gold donated, etc.) */
  contribution: z.number().int().default(0),
  /** Is membership secret? */
  isSecret: z.boolean().default(false),
  // Economic contribution
  /** What skill does this member bring? */
  primarySkill: z.string().optional(),
  /** Skill modifier (affects production bonuses) */
  skillModifier: z.number().int().default(0),
})
export type FactionMember = z.infer<typeof FactionMemberSchema>

// ============================================================
// FACTION — The full faction entity
// ============================================================

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: FactionTypeSchema,
  /** Motto / creed */
  motto: z.string().default(''),

  /** Headquarters hub node ID */
  headquartersNodeId: z.string(),

  /** Territory: hub nodes this faction controls */
  controlledNodes: z.array(z.string()).default([]),
  /** Territory: edge segment claims (edgeId + mile range) */
  controlledEdges: z.array(z.object({
    edgeId: z.string(),
    startMile: z.number(),
    endMile: z.number(),
  })).default([]),

  /** Treasury (GP) — economic power */
  treasury: z.number().nonnegative().default(0),
  /** Weekly income (from taxes, trade, production) */
  weeklyIncome: z.number().default(0),
  /** Weekly expenses (soldiers, operations, maintenance) */
  weeklyExpenses: z.number().default(0),

  /** Members */
  members: z.array(FactionMemberSchema).default([]),

  /** Goals */
  goals: z.array(FactionGoalSchema).default([]),

  /** Loyalty graph: how this faction feels about others */
  loyalties: z.record(z.string(), z.number().int().min(-100).max(100)).default({}),

  /** Influence in each hub (0-100, how much sway they have) */
  influence: z.record(z.string(), z.number().min(0).max(100)).default({}),

  /** Commodities this faction has monopoly/influence over */
  commodityInfluence: z.record(z.string(), z.object({
    /** Price modifier: 0.8 = 20% cheaper, 1.3 = 30% markup */
    priceModifier: z.number(),
    /** Supply modifier: how much they control supply */
    supplyControl: z.number().min(0).max(1),
  })).default({}),

  /** Production bonuses from skilled members */
  productionBonuses: z.record(z.string(), z.number()).default({}),

  /** Founded on world day */
  foundedDay: z.number().int().default(0),
  /** Is this faction active? */
  active: z.boolean().default(true),

  // === REALMS-OF-SHOD ALIGNMENT: cult ===
  // Secrecy level — only meaningful when type === 'cult'.
  // Changes how loyalty math propagates: hidden cults don't broadcast
  // influence, can be hunted by inquisitions, recruit secretly.
  secrecyLevel: z.enum(['open', 'discreet', 'hidden', 'forbidden']).optional(),

  // === REALMS-OF-SHOD ALIGNMENT: sanctuary ===
  // Protection covenant — only meaningful when type === 'sanctuary'.
  refugeProtections: z.array(z.string()).optional(),
  accessRules: z.string().optional(),
})
export type Faction = z.infer<typeof FactionSchema>

// ============================================================
// LOYALTY OPERATIONS — The alignment system
// ============================================================

/**
 * Get loyalty between two entities.
 * Works for faction→faction, npc→faction, player→faction.
 */
export function getLoyalty(
  loyalties: Record<string, number>,
  targetId: string,
): number {
  return loyalties[targetId] ?? 0
}

/**
 * Shift loyalty (clamped to -100..+100).
 */
export function shiftLoyalty(
  loyalties: Record<string, number>,
  targetId: string,
  delta: number,
): void {
  const current = loyalties[targetId] ?? 0
  loyalties[targetId] = Math.max(-100, Math.min(100, current + delta))
}

/**
 * Get human-readable loyalty stance.
 */
export function getLoyaltyStance(value: number): string {
  if (value >= 80)  return 'blood_oath'
  if (value >= 50)  return 'allied'
  if (value >= 20)  return 'friendly'
  if (value >= -20) return 'neutral'
  if (value >= -50) return 'unfriendly'
  if (value >= -80) return 'hostile'
  return 'sworn_enemy'
}

/**
 * Check if two factions are at war (both below -60).
 */
export function areAtWar(
  factionA: Faction,
  factionB: Faction,
): boolean {
  const aToB = getLoyalty(factionA.loyalties, factionB.id)
  const bToA = getLoyalty(factionB.loyalties, factionA.id)
  return aToB <= -60 && bToA <= -60
}

// ============================================================
// ECONOMIC INFLUENCE — Factions shape markets
// ============================================================

/**
 * Calculate production bonus from faction's skilled members.
 * Master smiths give quality bonus. Expert farmers give yield bonus.
 */
export function calculateProductionBonus(
  faction: Faction,
  commodityId: string,
): number {
  // Sum skill modifiers of members working in this commodity
  const relevantMembers = faction.members.filter(m => {
    if (!m.primarySkill) return false
    return SKILL_COMMODITY_MAP[m.primarySkill]?.includes(commodityId) ?? false
  })

  if (relevantMembers.length === 0) return 0

  // Average skill modifier × count factor
  const avgSkill = relevantMembers.reduce((sum, m) => sum + m.skillModifier, 0) / relevantMembers.length
  const countFactor = Math.min(2.0, 1.0 + relevantMembers.length * 0.05) // diminishing returns

  // +1% per skill modifier point, scaled by count
  return Math.floor(avgSkill * countFactor)
}

/**
 * Calculate price modifier a faction applies in a hub.
 * Based on influence level + commodity control.
 */
export function calculateFactionPriceModifier(
  faction: Faction,
  hubNodeId: string,
  commodityId: string,
): number {
  const influence = faction.influence[hubNodeId] ?? 0
  const commodityControl = faction.commodityInfluence[commodityId]

  if (!commodityControl || influence < 10) return 1.0

  // More influence = more control over prices
  const influenceFactor = influence / 100
  return 1.0 + (commodityControl.priceModifier - 1.0) * influenceFactor
}

/** Which skills affect which commodities */
const SKILL_COMMODITY_MAP: Record<string, string[]> = {
  // Crafting skills
  'smithing':    ['weapons', 'armor', 'tools', 'iron'],
  'woodworking': ['timber', 'tools', 'furniture'],
  'alchemy':     ['potions', 'magic_components', 'herbs'],
  'brewing':     ['ale', 'wine'],
  'cooking':     ['bread', 'meat', 'grain'],
  'tailoring':   ['cloth', 'leather', 'clothing'],
  'masonry':     ['stone', 'building_materials'],
  // Gathering skills
  'mining':      ['iron_ore', 'gold_ore', 'copper_ore', 'coal', 'stone'],
  'farming':     ['grain', 'herbs', 'cotton'],
  'fishing':     ['fish', 'salt'],
  'logging':     ['timber'],
  'hunting':     ['leather', 'game', 'meat'],
  // Commerce skills
  'appraisal':   ['jewelry', 'art', 'gems'],
  'negotiation': [], // affects all prices via member modifier
  // Magic
  'enchanting':  ['magic_components', 'scrolls'],
  'herbalism':   ['herbs', 'potions'],
}

// ============================================================
// FACTION TICK — Weekly advancement
// ============================================================

export interface FactionTickResult {
  /** Treasury change */
  treasuryDelta: number
  /** Goals that advanced */
  goalsAdvanced: string[]
  /** Loyalty shifts from events */
  loyaltyShifts: Array<{ targetId: string; delta: number }>
  /** Influence changes */
  influenceChanges: Record<string, number>
}

/**
 * Tick a faction forward by one week.
 * Processes income, expenses, goal progress, and influence.
 */
export function tickFaction(faction: Faction): FactionTickResult {
  const result: FactionTickResult = {
    treasuryDelta: 0,
    goalsAdvanced: [],
    loyaltyShifts: [],
    influenceChanges: {},
  }

  // Income - expenses
  const netIncome = faction.weeklyIncome - faction.weeklyExpenses
  faction.treasury = Math.max(0, faction.treasury + netIncome)
  result.treasuryDelta = netIncome

  // Advance active goals (progress based on resources + members)
  for (const goal of faction.goals) {
    if (!goal.active) continue
    // Base progress: priority × member count / 100
    const memberBonus = Math.min(faction.members.length, 50) * 0.1
    const progressDelta = (goal.priority * 0.5 + memberBonus) * (faction.treasury > 0 ? 1 : 0.3)
    goal.progress = Math.min(100, goal.progress + progressDelta)
    result.goalsAdvanced.push(goal.id)
  }

  // Influence in controlled nodes grows slightly
  for (const nodeId of faction.controlledNodes) {
    const current = faction.influence[nodeId] ?? 0
    const growth = current < 80 ? 1 : 0.1
    faction.influence[nodeId] = Math.min(100, current + growth)
    result.influenceChanges[nodeId] = growth
  }

  // Recalculate production bonuses from members
  faction.productionBonuses = {}
  for (const [skill, commodities] of Object.entries(SKILL_COMMODITY_MAP)) {
    for (const commodity of commodities) {
      const bonus = calculateProductionBonus(faction, commodity)
      if (bonus > 0) {
        faction.productionBonuses[commodity] = (faction.productionBonuses[commodity] ?? 0) + bonus
      }
    }
  }

  return result
}

// ============================================================
// FACTION FACTORY
// ============================================================

let _factionId = 0
export function resetFactionIdCounter(): void { _factionId = 0 }

export function createFaction(
  name: string,
  type: FactionType,
  headquartersNodeId: string,
  opts?: {
    motto?: string
    treasury?: number
    controlledNodes?: string[]
    loyalties?: Record<string, number>
  },
): Faction {
  return {
    id: `faction_${++_factionId}`,
    name,
    type,
    motto: opts?.motto ?? '',
    headquartersNodeId,
    controlledNodes: opts?.controlledNodes ?? [headquartersNodeId],
    controlledEdges: [],
    treasury: opts?.treasury ?? 0,
    weeklyIncome: 0,
    weeklyExpenses: 0,
    members: [],
    goals: [],
    loyalties: opts?.loyalties ?? {},
    influence: { [headquartersNodeId]: 50 },
    commodityInfluence: {},
    productionBonuses: {},
    foundedDay: 0,
    active: true,
  }
}

/**
 * Add a member to a faction.
 */
export function addMember(
  faction: Faction,
  entityId: string,
  entityName: string,
  rank: FactionRank = 'recruit',
  worldDay: number = 0,
  opts?: { primarySkill?: string; skillModifier?: number; isSecret?: boolean },
): void {
  faction.members.push({
    entityId,
    entityName,
    rank,
    joinedDay: worldDay,
    contribution: 0,
    isSecret: opts?.isSecret ?? false,
    primarySkill: opts?.primarySkill,
    skillModifier: opts?.skillModifier ?? 0,
  })
}

/**
 * Add a goal to a faction.
 */
export function addGoal(
  faction: Faction,
  type: FactionGoalType,
  description: string,
  priority: number = 5,
  targetId?: string,
): void {
  faction.goals.push({
    id: `goal_${faction.id}_${faction.goals.length}`,
    type,
    description,
    targetId,
    progress: 0,
    priority,
    active: true,
  })
}
