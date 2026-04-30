/**
 * RELIGION — Gods, Faith, and the Divine
 * ==================================================
 *
 * Gods are .tp nodes. They exist in the topology.
 * Faith is a RESOURCE that deities accrue from followers.
 * More clergy → more faith → more divine power.
 *
 * Yearly tick:
 *   faithAccrued = Σ(clergy[i].piety × rankMultiplier[i])
 *   deity.faithPool += faithAccrued
 *   faithPool determines deity.powerTier
 *
 * Temples generate faith passively.
 * Divine interventions COST faith (deity spends from pool).
 * Dead gods have 0 faith accrual but may have residual pool.
 */

// ============================================================
// DIVINE DOMAINS — What gods govern
// ============================================================

export type DomainType =
  | 'life' | 'death' | 'war' | 'knowledge' | 'magic'
  | 'nature' | 'tempest' | 'trickery' | 'light' | 'forge'
  | 'grave' | 'order' | 'peace' | 'twilight' | 'arcana'

export interface DivineDomain {
  domain: DomainType
  /** What the deity commands followers to do */
  edicts: string[]
  /** What the deity forbids */
  anathema: string[]
  /** κ properties this domain writes to .tp nodes */
  grantedPowers: string[]
}

// ============================================================
// DEITY — Gods as .tp nodes
// ============================================================

export type DeityStatus = 'active' | 'dead' | 'dormant' | 'ascended' | 'imprisoned'
export type DeityAlignment = 'LG' | 'NG' | 'CG' | 'LN' | 'N' | 'CN' | 'LE' | 'NE' | 'CE'

export interface Deity {
  id: string
  worldId: string
  name: string
  titles: string[]         // "The Morninglord", "Lady of Mysteries"
  alignment: DeityAlignment
  domains: DivineDomain[]
  plane: string            // "Elysium", "Mechanus", "Shadowfell"
  status: DeityStatus

  // Faith resource
  faithPool: number        // Current accumulated faith
  faithPerYear: number     // Last calculated annual income (cached)
  powerTier: number        // 0-5, derived from faithPool

  // Relationships
  allies: string[]         // deity IDs
  enemies: string[]        // deity IDs
  superiorId?: string      // e.g. Ao oversees Mystra
}

// ============================================================
// FAITH — The divine resource
// ============================================================

/**
 * Power tier thresholds (faith pool → power level)
 * Higher tier = deity can grant stronger miracles
 */
export const FAITH_TIER_THRESHOLDS: readonly number[] = [
  0,        // Tier 0: forgotten god, no power
  100,      // Tier 1: minor deity, local worship
  500,      // Tier 2: regional deity
  2000,     // Tier 3: major deity
  10000,    // Tier 4: greater god
  50000,    // Tier 5: overdeity (Ao-level)
]

/** Calculate power tier from faith pool */
export function calculatePowerTier(faithPool: number): number {
  let tier = 0
  for (let i = FAITH_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (faithPool >= FAITH_TIER_THRESHOLDS[i]) {
      tier = i
      break
    }
  }
  return tier
}

// ============================================================
// CLERGY — NPCs who serve deities
// ============================================================

export type ClergyRank = 'acolyte' | 'priest' | 'high_priest' | 'archpriest' | 'chosen'

/** How much faith each rank generates per year */
export const RANK_FAITH_MULTIPLIER: Record<ClergyRank, number> = {
  acolyte:     1,
  priest:      3,
  high_priest: 10,
  archpriest:  25,
  chosen:      100,   // Chosen of Mystra etc — direct conduits
}

export interface ClergyMember {
  id: string
  deityId: string
  npcId: string
  templeId?: string      // building ID they serve at (optional for wandering clergy)
  rank: ClergyRank
  piety: number          // 0-100, personal devotion — multiplied with rank
  yearsOfService: number
  domainFocus?: DomainType  // which domain they specialize in
}

/**
 * Calculate total faith a single clergy member generates per year.
 * faith = piety × rankMultiplier / 100
 * A perfect-piety acolyte generates 1.0 faith/year.
 * A perfect-piety chosen generates 100.0 faith/year.
 */
export function clergyFaithOutput(member: ClergyMember): number {
  return (member.piety / 100) * RANK_FAITH_MULTIPLIER[member.rank]
}

// ============================================================
// TEMPLE — Buildings that passively generate faith
// ============================================================

export type TempleSize = 'shrine' | 'chapel' | 'temple' | 'cathedral' | 'grand_cathedral'

export const TEMPLE_BASE_FAITH: Record<TempleSize, number> = {
  shrine:          2,    // roadside cairn
  chapel:          5,    // village chapel
  temple:         15,    // city temple
  cathedral:      40,    // regional seat
  grand_cathedral: 100,  // world wonder
}

export interface Temple {
  id: string
  deityId: string
  settlementId: string
  buildingId: string
  size: TempleSize
  condition: number      // 0-100, deterioration affects output
  relicCount: number     // holy relics boost faith
  consecrated: boolean   // unconsecrated temples produce half faith
}

/**
 * Faith generated by a temple per year (passive, from pilgrims + prayers).
 * Relics: each adds 20% base faith
 * Condition: linear multiplier (50% condition = 50% output)
 * Unconsecrated: halved
 */
export function templeFaithOutput(temple: Temple): number {
  const base = TEMPLE_BASE_FAITH[temple.size]
  const relicBonus = 1 + temple.relicCount * 0.2
  const conditionMul = temple.condition / 100
  const consecrationMul = temple.consecrated ? 1 : 0.5
  return base * relicBonus * conditionMul * consecrationMul
}

// ============================================================
// DIVINE INTERVENTION — Spending faith
// ============================================================

export type InterventionType =
  | 'minor_miracle'    // heal wounds, calm weather
  | 'omen'             // prophetic warning
  | 'avatar_fragment'  // brief manifestation
  | 'smite'            // strike an enemy
  | 'blessing'         // buff a location/faction
  | 'curse'            // debuff a location/faction
  | 'resurrection'     // bring back the dead
  | 'divine_quest'     // assign quest to champion

export const INTERVENTION_COST: Record<InterventionType, number> = {
  minor_miracle:   5,
  omen:           10,
  blessing:       25,
  curse:          25,
  smite:          50,
  avatar_fragment: 100,
  divine_quest:   15,
  resurrection:   200,
}

export interface DivineIntervention {
  deityId: string
  type: InterventionType
  targetNodeId: string     // .tp node where it happens
  faithCost: number
  worldDay: number
  description: string
}

/**
 * Attempt a divine intervention. Returns null if insufficient faith.
 */
export function requestIntervention(
  deity: Deity,
  type: InterventionType,
  targetNodeId: string,
  worldDay: number,
  description: string,
): DivineIntervention | null {
  const cost = INTERVENTION_COST[type]

  // Dead gods can't intervene
  if (deity.status === 'dead') return null

  // Dormant gods pay double
  const actualCost = deity.status === 'dormant' ? cost * 2 : cost

  // Check power tier — some interventions need minimum tier
  if (type === 'resurrection' && deity.powerTier < 3) return null
  if (type === 'avatar_fragment' && deity.powerTier < 4) return null

  if (deity.faithPool < actualCost) return null

  deity.faithPool -= actualCost
  deity.powerTier = calculatePowerTier(deity.faithPool)

  return {
    deityId: deity.id,
    type,
    targetNodeId,
    faithCost: actualCost,
    worldDay,
    description,
  }
}

// ============================================================
// YEARLY FAITH TICK — The divine economy
// ============================================================

export interface FaithTickResult {
  deityId: string
  previousFaith: number
  faithFromClergy: number
  faithFromTemples: number
  totalAccrued: number
  newFaith: number
  previousTier: number
  newTier: number
  tierChanged: boolean
}

/**
 * Run the yearly faith tick for a deity.
 * Aggregates faith from all clergy + all temples.
 *
 * Dead gods: 0 accrual, faith decays by 10%/year
 * Dormant gods: 50% accrual, no decay
 * Imprisoned gods: 25% accrual
 */
export function yearlyFaithTick(
  deity: Deity,
  clergy: ClergyMember[],
  temples: Temple[],
): FaithTickResult {
  const previousFaith = deity.faithPool
  const previousTier = deity.powerTier

  // Calculate faith from clergy
  const faithFromClergy = clergy
    .filter(c => c.deityId === deity.id)
    .reduce((sum, c) => sum + clergyFaithOutput(c), 0)

  // Calculate faith from temples
  const faithFromTemples = temples
    .filter(t => t.deityId === deity.id)
    .reduce((sum, t) => sum + templeFaithOutput(t), 0)

  let totalAccrued = faithFromClergy + faithFromTemples

  // Status modifiers
  switch (deity.status) {
    case 'dead':
      totalAccrued = 0
      deity.faithPool = Math.max(0, deity.faithPool * 0.9) // decay 10%/yr
      break
    case 'dormant':
      totalAccrued *= 0.5
      break
    case 'imprisoned':
      totalAccrued *= 0.25
      break
    case 'active':
    case 'ascended':
      // full rate
      break
  }

  deity.faithPool += totalAccrued
  deity.faithPerYear = totalAccrued
  deity.powerTier = calculatePowerTier(deity.faithPool)

  return {
    deityId: deity.id,
    previousFaith,
    faithFromClergy,
    faithFromTemples,
    totalAccrued,
    newFaith: deity.faithPool,
    previousTier,
    newTier: deity.powerTier,
    tierChanged: previousTier !== deity.powerTier,
  }
}

// ============================================================
// PANTHEON — All gods in a world
// ============================================================

export interface Pantheon {
  worldId: string
  deities: Deity[]
}

/**
 * Run yearly tick for entire pantheon.
 * Returns sorted results (biggest changes first).
 */
export function yearlyPantheonTick(
  pantheon: Pantheon,
  allClergy: ClergyMember[],
  allTemples: Temple[],
): FaithTickResult[] {
  return pantheon.deities
    .map(deity => yearlyFaithTick(deity, allClergy, allTemples))
    .sort((a, b) => Math.abs(b.newTier - b.previousTier) - Math.abs(a.newTier - a.previousTier))
}

/**
 * Get the dominant deity at a settlement (most clergy + biggest temple).
 */
export function dominantDeity(
  clergy: ClergyMember[],
  temples: Temple[],
  settlementId: string,
): string | null {
  const influence = new Map<string, number>()

  // Clergy contribute their faith output
  for (const c of clergy) {
    influence.set(c.deityId, (influence.get(c.deityId) ?? 0) + clergyFaithOutput(c))
  }

  // Temples at this settlement contribute their faith output
  for (const t of temples) {
    if (t.settlementId === settlementId) {
      influence.set(t.deityId, (influence.get(t.deityId) ?? 0) + templeFaithOutput(t))
    }
  }

  if (influence.size === 0) return null

  let maxId: string | null = null
  let maxInfluence = -1
  for (const [deityId, inf] of influence) {
    if (inf > maxInfluence) {
      maxInfluence = inf
      maxId = deityId
    }
  }

  return maxId
}
