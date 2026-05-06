/**
 * WARFARE — Armies, Diplomacy, Espionage & Factional Influence
 * ==================================================
 *
 * Geography is one thing. Influence is another.
 * A factional influence overlay sits ON TOP of the world topology.
 *
 * Army hierarchy (×5 per tier):
 *   Squad (5) → Platoon (25) → Company (125) → Battalion (625) → Legion (3125)
 *
 * Diplomacy: treaties, alliances, wars — separate from faction_relations
 * Espionage: intelligence gathering, counterintelligence, sabotage
 *
 * Monthly tick:
 *   - Army upkeep (gold drain)
 *   - Readiness decay without training
 *   - Influence spread/contraction
 *   - Spy reports
 */

// ============================================================
// ARMY HIERARCHY — 5 tiers, ×5 multiplier
// ============================================================

export type ArmyTier = 'squad' | 'platoon' | 'company' | 'battalion' | 'legion'

export const ARMY_TIER_SIZE: Record<ArmyTier, number> = {
  squad:     5,
  platoon:   25,
  company:   125,
  battalion: 625,
  legion:    3125,
}

export const ARMY_TIER_ORDER: ArmyTier[] = ['squad', 'platoon', 'company', 'battalion', 'legion']

export type UnitType =
  | 'infantry' | 'cavalry' | 'archers' | 'pikemen'
  | 'siege_crew' | 'mages' | 'scouts' | 'navy'

/** Combat effectiveness multiplier by unit type */
export const UNIT_EFFECTIVENESS: Record<UnitType, { attack: number; defense: number }> = {
  infantry:   { attack: 1.0, defense: 1.2 },
  cavalry:    { attack: 1.5, defense: 0.8 },
  archers:    { attack: 1.3, defense: 0.6 },
  pikemen:    { attack: 0.8, defense: 1.5 },   // anti-cavalry
  siege_crew: { attack: 0.5, defense: 0.5 },   // only good with siege weapons
  mages:      { attack: 2.0, defense: 0.4 },   // glass cannon
  scouts:     { attack: 0.6, defense: 0.6 },   // recon, not combat
  navy:       { attack: 1.0, defense: 1.0 },   // water-only
}

// ============================================================
// ARMY UNIT — A single formation
// ============================================================

export interface ArmyUnit {
  id: string
  factionId: string
  name: string
  tier: ArmyTier
  unitType: UnitType
  /** Current effective soldiers (can be less than tier max) */
  currentStrength: number
  /** 0-100: training level, decays without upkeep */
  readiness: number
  /** 0-100: willingness to fight */
  morale: number
  /** Equipment quality 1-5 */
  equipmentTier: number
  /** Location on the world map */
  regionId: string
  /** Commander NPC */
  commanderId?: string
  /** Weekly upkeep in GP */
  weeklyUpkeepGP: number
}

/**
 * Calculate combat strength of a unit.
 * strength = soldiers × readiness × morale × equipment × type_modifier
 */
export function unitCombatStrength(unit: ArmyUnit, mode: 'attack' | 'defense'): number {
  const effectiveness = UNIT_EFFECTIVENESS[unit.unitType][mode]
  return (
    unit.currentStrength *
    (unit.readiness / 100) *
    (unit.morale / 100) *
    (unit.equipmentTier / 3) *
    effectiveness
  )
}

/**
 * Calculate weekly upkeep for a unit.
 * 1 GP per soldier per week × equipment tier modifier.
 */
export function calculateUpkeep(unit: ArmyUnit): number {
  return unit.currentStrength * unit.equipmentTier * 0.2
}

// ============================================================
// SIEGE WEAPONS
// ============================================================

export type SiegeWeaponType = 'battering_ram' | 'catapult' | 'trebuchet' | 'siege_tower' | 'ballista' | 'scorpion'

export interface SiegeWeapon {
  id: string
  type: SiegeWeaponType
  damage: number
  range: number          // hexes or abstract range units
  crewRequired: number
  /** Effectiveness vs walls/gates */
  wallDamage: number
  /** Effectiveness vs troops (anti-personnel) */
  troopDamage: number
  condition: number      // 0-100
}

export const SIEGE_WEAPON_STATS: Record<SiegeWeaponType, Omit<SiegeWeapon, 'id' | 'condition'>> = {
  battering_ram: { type: 'battering_ram', damage: 20, range: 0, crewRequired: 10, wallDamage: 30, troopDamage: 5 },
  catapult:      { type: 'catapult',      damage: 15, range: 3, crewRequired: 5,  wallDamage: 20, troopDamage: 15 },
  trebuchet:     { type: 'trebuchet',      damage: 25, range: 5, crewRequired: 8,  wallDamage: 35, troopDamage: 10 },
  siege_tower:   { type: 'siege_tower',    damage: 0,  range: 0, crewRequired: 15, wallDamage: 0,  troopDamage: 0 },
  ballista:      { type: 'ballista',       damage: 12, range: 4, crewRequired: 3,  wallDamage: 10, troopDamage: 20 },
  scorpion:      { type: 'scorpion',       damage: 8,  range: 3, crewRequired: 2,  wallDamage: 5,  troopDamage: 15 },
}

// ============================================================
// BATTLE RESOLUTION
// ============================================================

export interface BattleForce {
  units: ArmyUnit[]
  siegeWeapons: SiegeWeapon[]
  terrainModifier: number    // 0.5 - 2.0 (defensive terrain advantage)
  weatherModifier: number    // 0.5 - 1.5 (weather κ from weather.ts)
  fortificationLevel: number // 0-5 (walls, towers, etc.)
}

export interface BattleResult {
  attackerStrength: number
  defenderStrength: number
  victor: 'attacker' | 'defender' | 'draw'
  attackerCasualties: number  // percentage
  defenderCasualties: number  // percentage
  d20Roll: number
}

/**
 * Resolve a battle between two forces.
 * Total strength = sum of unit strengths + siege bonuses + modifiers.
 */
export function resolveBattle(
  attacker: BattleForce,
  defender: BattleForce,
  d20: number,
): BattleResult {
  // Attacker strength
  let attackStr = attacker.units.reduce((sum, u) => sum + unitCombatStrength(u, 'attack'), 0)
  attackStr += attacker.siegeWeapons.reduce((sum, sw) => sum + sw.troopDamage * (sw.condition / 100), 0)
  attackStr *= attacker.weatherModifier

  // Siege bonus vs fortifications
  if (defender.fortificationLevel > 0) {
    const siegeDamage = attacker.siegeWeapons.reduce((sum, sw) => sum + sw.wallDamage * (sw.condition / 100), 0)
    const fortReduction = Math.min(1, siegeDamage / (defender.fortificationLevel * 50))
    // Reduce defender's fortification bonus by siege effectiveness
    attackStr += attackStr * fortReduction * 0.3
  }

  // Defender strength
  let defendStr = defender.units.reduce((sum, u) => sum + unitCombatStrength(u, 'defense'), 0)
  defendStr *= defender.terrainModifier
  defendStr *= defender.weatherModifier
  // Fortification bonus
  defendStr *= (1 + defender.fortificationLevel * 0.2)

  // d20 roll adds randomness (±15%)
  const luckFactor = 1 + ((d20 - 10.5) / 10.5) * 0.15
  attackStr *= luckFactor

  const ratio = attackStr / Math.max(1, defendStr)
  let victor: BattleResult['victor']
  let attackerCasualties: number
  let defenderCasualties: number

  if (ratio > 1.5) {
    victor = 'attacker'
    attackerCasualties = 0.1   // decisive win, few losses
    defenderCasualties = 0.6
  } else if (ratio > 1.0) {
    victor = 'attacker'
    attackerCasualties = 0.3
    defenderCasualties = 0.5
  } else if (ratio > 0.8) {
    victor = 'draw'
    attackerCasualties = 0.4
    defenderCasualties = 0.3
  } else {
    victor = 'defender'
    attackerCasualties = 0.6
    defenderCasualties = 0.15
  }

  return {
    attackerStrength: attackStr,
    defenderStrength: defendStr,
    victor,
    attackerCasualties,
    defenderCasualties,
    d20Roll: d20,
  }
}

/**
 * Apply casualties to units after battle.
 */
export function applyCasualties(units: ArmyUnit[], casualtyRate: number): void {
  for (const unit of units) {
    const losses = Math.floor(unit.currentStrength * casualtyRate)
    unit.currentStrength = Math.max(0, unit.currentStrength - losses)
    unit.morale = Math.max(0, unit.morale - casualtyRate * 30)
  }
}

// ============================================================
// DIPLOMACY — Relations beyond faction_relations
// ============================================================

export type DiplomaticStatus =
  | 'alliance' | 'trade_pact' | 'non_aggression' | 'neutral'
  | 'rivalry' | 'cold_war' | 'war' | 'vassalage' | 'subjugation'

// === REALMS-OF-SHOD ALIGNMENT: treaty ===
// See: docs/realms-of-shod-mapping.md
// Downgrade: src/lib/realms-of-shod-export.ts toRealmsTreaty()
//
// Promoted from `DiplomaticRelation.treaties: string[]` to a first-class
// entity. Preserves the specific terms agreed, the signing day, and
// dissolution provenance. Diplomatic intrigue becomes specific.

export type TreatyStatus = 'active' | 'dissolved' | 'violated' | 'expired'

export interface Treaty {
  id: string
  factionA: string
  factionB: string
  /** Plain-language terms of the treaty */
  terms: string[]
  signedDay: number
  status: TreatyStatus
  /** Faction or character that brokered this treaty */
  sponsorId?: string
}

let _treatyCounter = 0
export function resetTreatyIdCounter(): void { _treatyCounter = 0 }

export function createTreaty(
  factionA: string,
  factionB: string,
  terms: string[],
  signedDay: number,
  sponsorId?: string,
): Treaty {
  return {
    id: `treaty_${++_treatyCounter}`,
    factionA,
    factionB,
    terms,
    signedDay,
    status: 'active',
    sponsorId,
  }
}

export function dissolveTreaty(treaty: Treaty, reason: TreatyStatus = 'dissolved'): void {
  treaty.status = reason
}

export interface DiplomaticRelation {
  id: string
  factionA: string
  factionB: string
  status: DiplomaticStatus
  /** -100 (hatred) to +100 (devotion) */
  standing: number
  /** Active treaties (promoted from string[] to first-class Treaty entities) */
  treaties: Treaty[]
  /** World day of last status change */
  lastChangedDay: number
}

/**
 * Diplomatic status thresholds (standing → status).
 */
export function statusFromStanding(standing: number): DiplomaticStatus {
  if (standing >= 80) return 'alliance'
  if (standing >= 50) return 'trade_pact'
  if (standing >= 20) return 'non_aggression'
  if (standing >= -20) return 'neutral'
  if (standing >= -50) return 'rivalry'
  if (standing >= -80) return 'cold_war'
  return 'war'
}

// ============================================================
// ESPIONAGE — Intelligence & Counter-Intelligence
// ============================================================

export type SpyMission =
  | 'intelligence' | 'sabotage' | 'assassination' | 'counterintelligence'
  | 'steal_knowledge' | 'spread_propaganda' | 'incite_revolt'

export interface SpyAgent {
  id: string
  npcId: string
  factionId: string
  coverSettlementId: string  // where they're operating
  skillMod: number
  detected: boolean
  missionsCompleted: number
}

export interface SpyMissionResult {
  agentId: string
  mission: SpyMission
  success: boolean
  detected: boolean
  d20: number
  totalCheck: number
  intelGathered?: string
}

/**
 * Execute a spy mission. DC varies by mission type.
 */
export function executeSpyMission(
  agent: SpyAgent,
  mission: SpyMission,
  d20: number,
  counterIntelMod: number = 0,
): SpyMissionResult {
  const missionDC: Record<SpyMission, number> = {
    intelligence: 10,
    sabotage: 15,
    assassination: 20,
    counterintelligence: 12,
    steal_knowledge: 14,
    spread_propaganda: 10,
    incite_revolt: 18,
  }

  const dc = missionDC[mission] + counterIntelMod
  const totalCheck = d20 + agent.skillMod
  const success = totalCheck >= dc

  // Detection: failing by 5+ or nat 1
  const detected = d20 === 1 || (!success && totalCheck < dc - 5)
  if (detected) agent.detected = true
  if (success) agent.missionsCompleted++

  return {
    agentId: agent.id,
    mission,
    success,
    detected,
    d20,
    totalCheck,
    intelGathered: success && mission === 'intelligence' ? 'intelligence report' : undefined,
  }
}

// ============================================================
// FACTIONAL INFLUENCE — Topological overlay
// ============================================================

/**
 * Influence map: Each region has influence percentages per faction.
 * This is a SEPARATE overlay from physical geography.
 * Total influence in a region sums to ~100%.
 */
export interface RegionInfluence {
  regionId: string
  influences: Map<string, number>  // factionId → percentage (0-100)
}

/**
 * Set influence for a faction in a region.
 */
export function setInfluence(region: RegionInfluence, factionId: string, amount: number): void {
  region.influences.set(factionId, Math.max(0, Math.min(100, amount)))
  // Normalize if total exceeds 100
  normalizeInfluence(region)
}

/**
 * Normalize influence so total ≤ 100%.
 */
export function normalizeInfluence(region: RegionInfluence): void {
  const total = Array.from(region.influences.values()).reduce((s, v) => s + v, 0)
  if (total > 100) {
    const scale = 100 / total
    for (const [k, v] of region.influences) {
      region.influences.set(k, v * scale)
    }
  }
}

/**
 * Get the dominant faction in a region.
 */
export function dominantFaction(region: RegionInfluence): { factionId: string; influence: number } | null {
  let max = 0
  let maxId: string | null = null
  for (const [id, inf] of region.influences) {
    if (inf > max) { max = inf; maxId = id }
  }
  if (!maxId) return null
  return { factionId: maxId, influence: max }
}

/**
 * Monthly influence tick: armies project influence, unoccupied regions decay.
 * Each army unit projects influence proportional to its strength.
 */
export function monthlyInfluenceTick(
  regions: RegionInfluence[],
  armies: ArmyUnit[],
): void {
  for (const region of regions) {
    // Decay: all influences shrink 5% per month without military presence
    for (const [k, v] of region.influences) {
      region.influences.set(k, v * 0.95)
    }

    // Army projection: units in this region add influence
    const localUnits = armies.filter(u => u.regionId === region.regionId)
    for (const unit of localUnits) {
      const projection = unitCombatStrength(unit, 'defense') * 0.1
      const current = region.influences.get(unit.factionId) ?? 0
      region.influences.set(unit.factionId, current + projection)
    }

    normalizeInfluence(region)
  }
}

/**
 * Monthly army readiness tick: without training, readiness decays.
 */
export function monthlyReadinessTick(units: ArmyUnit[]): void {
  for (const unit of units) {
    unit.readiness = Math.max(0, unit.readiness - 3) // 3% decay per month
    // Morale also decays slightly
    unit.morale = Math.max(10, unit.morale - 1)
  }
}

// ============================================================
// MONTHLY TICKS — Army upkeep & diplomatic drift
// ============================================================

export interface ArmyUpkeepResult {
  factionId: string
  totalUpkeep: number
  unitCount: number
  /** Did the faction fail to pay? (caller checks treasury) */
  canAfford: boolean
}

/**
 * Calculate monthly army upkeep for a faction.
 * Armies cost gold. No gold → readiness/morale penalties.
 * Upkeep = sum(calculateUpkeep(unit)) × 4 weeks/month.
 */
export function monthlyArmyUpkeep(
  units: ArmyUnit[],
  factionId: string,
  treasuryGP: number,
): ArmyUpkeepResult {
  const factionUnits = units.filter(u => u.factionId === factionId)
  const weeklyTotal = factionUnits.reduce((sum, u) => sum + calculateUpkeep(u), 0)
  const monthlyTotal = weeklyTotal * 4
  const canAfford = treasuryGP >= monthlyTotal

  if (!canAfford) {
    // Can't pay → readiness and morale drop hard
    for (const unit of factionUnits) {
      unit.readiness = Math.max(0, unit.readiness - 10)
      unit.morale = Math.max(0, unit.morale - 15)
    }
  }

  return {
    factionId,
    totalUpkeep: monthlyTotal,
    unitCount: factionUnits.length,
    canAfford,
  }
}

export interface DiplomaticDriftResult {
  relationId: string
  previousStanding: number
  newStanding: number
  previousStatus: DiplomaticStatus
  newStatus: DiplomaticStatus
  statusChanged: boolean
}

/**
 * Monthly diplomatic drift: standings shift naturally.
 * - Trade pacts drift toward alliance (+1/month)
 * - Rivalries drift toward cold war (-1/month)
 * - War drains standing (-3/month)
 * - Neutral drifts toward 0 (regression to mean)
 */
export function monthlyDiplomaticDrift(
  relation: DiplomaticRelation,
  worldDay: number,
): DiplomaticDriftResult {
  const prev = relation.standing
  const prevStatus = relation.status

  switch (relation.status) {
    case 'alliance':     relation.standing = Math.min(100, relation.standing + 1); break
    case 'trade_pact':   relation.standing = Math.min(100, relation.standing + 1); break
    case 'non_aggression': break // stable
    case 'neutral':      relation.standing += relation.standing > 0 ? -1 : relation.standing < 0 ? 1 : 0; break
    case 'rivalry':      relation.standing = Math.max(-100, relation.standing - 1); break
    case 'cold_war':     relation.standing = Math.max(-100, relation.standing - 2); break
    case 'war':          relation.standing = Math.max(-100, relation.standing - 3); break
    case 'vassalage':    break // imposed, doesn't drift
    case 'subjugation':  relation.standing = Math.max(-100, relation.standing - 1); break
  }

  const newStatus = statusFromStanding(relation.standing)
  if (newStatus !== prevStatus) {
    relation.status = newStatus
    relation.lastChangedDay = worldDay
  }

  return {
    relationId: relation.id,
    previousStanding: prev,
    newStanding: relation.standing,
    previousStatus: prevStatus,
    newStatus: relation.status,
    statusChanged: prevStatus !== relation.status,
  }
}
