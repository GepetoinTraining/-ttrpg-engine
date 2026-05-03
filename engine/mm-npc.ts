/**
 * MM_NPC — Non-Player Character State Machine
 * ==============================================
 * 
 * An NPC is an MM placed AT a .tp node. Regular NPCs are MMs.
 * Significant entities (Elminster, factions) ARE .tp nodes —
 * they're too big to not be topological.
 * 
 * MM_NPC reuses combat stats from MM_character but adds:
 *   - Disposition (friendly → hostile)
 *   - Loyalty (0–100, for followers)
 *   - Knowledge (facts gated by .tp proximity)
 *   - Personality (traits, ideals, bonds, flaws)
 *   - Role & services
 *   - .tp positioning (homeNodeId, currentNodeId)
 * 
 * SCALE THRESHOLD:
 *   Small NPC (hired guide)  → MM only
 *   Big NPC (Elminster)      → .tp node (topological)
 *   Faction (Zhentarim)      → .tp + MM hybrid
 * 
 * This file handles the MM side. The .tp side lives in tp.ts.
 */

import { z } from 'zod'
import { 
  CharacterDataSchema, type CharacterDataInput, type Ability,
  SKILL_ABILITIES, type Skill, type DerivedStats,
} from './mm-character'
import { type Combatant } from './mm-scene'
import { type CycleDelta, ZERO_DELTA, addDeltas } from './types'

// ============================================================
// NPC-SPECIFIC SCHEMAS
// ============================================================

export const NPCRoleSchema = z.enum([
  'hireling',      // Paid to do a job
  'companion',     // Traveling ally (deeper bond)
  'informant',     // Provides intelligence
  'merchant',      // Buys/sells goods
  'quest_giver',   // Assigns quests
  'guard',         // Security/military
  'commoner',      // Regular townsfolk
  'artisan',       // Crafts items
  'priest',        // Religious services
  'sage',          // Knowledge/lore
])
export type NPCRole = z.infer<typeof NPCRoleSchema>

export const DispositionSchema = z.enum([
  'loyal',      // Will risk life for party (loyalty 80+)
  'friendly',   // Helpful, positive (loyalty 60-79)
  'neutral',    // Transactional (loyalty 40-59)
  'reluctant',  // Needs convincing (loyalty 20-39)
  'hostile',    // Actively opposing (loyalty 0-19)
])
export type Disposition = z.infer<typeof DispositionSchema>

export const NPCServiceSchema = z.enum([
  'guide',    // Navigate terrain
  'fight',    // Combat support
  'heal',     // Medical/magical healing
  'craft',    // Create items
  'info',     // Provide intelligence
  'trade',    // Buy/sell goods
  'translate',// Language interpretation
  'stealth',  // Scouting/sneaking
  'magic',    // Spellcasting services
  'social',   // Diplomacy/persuasion
])
export type NPCService = z.infer<typeof NPCServiceSchema>

export const PersonalitySchema = z.object({
  traits: z.array(z.string()).default([]),
  ideals: z.array(z.string()).default([]),
  bonds: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
})
export type Personality = z.infer<typeof PersonalitySchema>

// ============================================================
// NPC DATA — Extends character stats + NPC-specific fields
// ============================================================

export const NPCDataSchema = z.object({
  /** Base identity */
  id: z.string(),
  name: z.string(),

  /** Race/Species */
  race: z.string(),

  /** Classes (simplified — most NPCs are single-class) */
  classes: z.array(z.object({
    name: z.string(),
    level: z.number().int().min(1).max(20),
    subclass: z.string().optional(),
    hitDie: z.enum(['d6', 'd8', 'd10', 'd12']),
    isStartingClass: z.boolean().default(false),
  })).min(1),

  /** Raw ability scores */
  abilityScores: z.object({
    strength: z.number().int().min(1).max(30),
    dexterity: z.number().int().min(1).max(30),
    constitution: z.number().int().min(1).max(30),
    intelligence: z.number().int().min(1).max(30),
    wisdom: z.number().int().min(1).max(30),
    charisma: z.number().int().min(1).max(30),
  }),

  /** HP state */
  hpMax: z.number().int(),
  hpCurrent: z.number().int(),

  /** AC */
  baseAC: z.number().int().default(10),
  armorType: z.enum(['none', 'light', 'medium', 'heavy']).default('none'),

  /** Combat info */
  speed: z.number().int().default(30),
  damageType: z.enum([
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
  ]).default('slashing'),

  /** Status */
  status: z.enum(['active', 'unconscious', 'dead', 'fled']).default('active'),

  // ============================================================
  // NPC-SPECIFIC FIELDS (not in CharacterData)
  // ============================================================

  /** What role does this NPC fill? */
  role: NPCRoleSchema,

  /** Current emotional state toward the party */
  disposition: DispositionSchema.default('neutral'),

  /** Loyalty score (0–100). Only meaningful for followers. */
  loyalty: z.number().int().min(0).max(100).default(50),

  /** Where they belong in the world (.tp node ID) */
  homeNodeId: z.string(),

  /** Where they are RIGHT NOW (.tp node ID) */
  currentNodeId: z.string(),

  /** What they know (facts, rumors, lore) */
  knowledge: z.array(z.string()).default([]),

  /** D&D 5e personality block */
  personality: PersonalitySchema.default({ traits: [], ideals: [], bonds: [], flaws: [] }),

  /** Services this NPC can provide */
  services: z.array(NPCServiceSchema).default([]),

  /** Daily cost to retain (in gold, 0 = free) */
  dailyCost: z.number().default(0),

  /** Days they've been with the party */
  daysWithParty: z.number().int().default(0),
})
export type NPCData = z.infer<typeof NPCDataSchema>
export type NPCDataInput = z.input<typeof NPCDataSchema>

// ============================================================
// DISPOSITION THRESHOLDS
// ============================================================

const DISPOSITION_THRESHOLDS: { min: number; disposition: Disposition }[] = [
  { min: 80, disposition: 'loyal' },
  { min: 60, disposition: 'friendly' },
  { min: 40, disposition: 'neutral' },
  { min: 20, disposition: 'reluctant' },
  { min: 0,  disposition: 'hostile' },
]

function loyaltyToDisposition(loyalty: number): Disposition {
  for (const t of DISPOSITION_THRESHOLDS) {
    if (loyalty >= t.min) return t.disposition
  }
  return 'hostile'
}

// ============================================================
// DERIVED NPC STATS — Pure function (MF)
// ============================================================

export interface NPCDerivedStats {
  totalLevel: number
  proficiencyBonus: number
  abilityModifiers: Record<Ability, number>
  ac: number
  initiativeModifier: number
  attackModifier: number
  /** Can this NPC still act? */
  isActive: boolean
}

function deriveNPCStats(d: NPCData): NPCDerivedStats {
  const totalLevel = d.classes.reduce((sum, c) => sum + c.level, 0)
  const proficiencyBonus = Math.ceil(totalLevel / 4) + 1

  const abilityModifiers: Record<string, number> = {}
  for (const [ability, score] of Object.entries(d.abilityScores)) {
    abilityModifiers[ability] = Math.floor((score - 10) / 2)
  }

  // AC: base + DEX mod (simplified for NPCs)
  let ac = d.baseAC
  if (d.armorType === 'none' || d.armorType === 'light') {
    ac += abilityModifiers.dexterity
  } else if (d.armorType === 'medium') {
    ac += Math.min(2, abilityModifiers.dexterity)
  }
  // heavy: no DEX bonus

  return {
    totalLevel,
    proficiencyBonus,
    abilityModifiers: abilityModifiers as Record<Ability, number>,
    ac,
    initiativeModifier: abilityModifiers.dexterity,
    attackModifier: proficiencyBonus + Math.max(
      abilityModifiers.strength,
      abilityModifiers.dexterity,
    ),
    isActive: d.status === 'active',
  }
}

// ============================================================
// MM_NPC — The NPC manifold machine
// ============================================================

export class MMNPC {
  private data: NPCData
  private deltaAccumulator: CycleDelta = { ...ZERO_DELTA }

  constructor(data: NPCDataInput) {
    this.data = NPCDataSchema.parse(data)
    // Sync disposition from loyalty (schema default may not match)
    this.data.disposition = loyaltyToDisposition(this.data.loyalty)
  }

  // ============================================================
  // DERIVED STATS (pure MF)
  // ============================================================

  /** Compute derived statistics from raw data. */
  derive(): NPCDerivedStats {
    return deriveNPCStats(this.data)
  }

  // ============================================================
  // LOYALTY & DISPOSITION
  // ============================================================

  /** 
   * Adjust loyalty. Returns the new value and any disposition change.
   * Loyalty clamps to [0, 100].
   */
  adjustLoyalty(delta: number): {
    loyaltyBefore: number
    loyaltyAfter: number
    dispositionBefore: Disposition
    dispositionAfter: Disposition
    changed: boolean
  } {
    const loyaltyBefore = this.data.loyalty
    const dispositionBefore = this.data.disposition

    this.data.loyalty = Math.max(0, Math.min(100, this.data.loyalty + delta))
    this.data.disposition = loyaltyToDisposition(this.data.loyalty)

    return {
      loyaltyBefore,
      loyaltyAfter: this.data.loyalty,
      dispositionBefore,
      dispositionAfter: this.data.disposition,
      changed: dispositionBefore !== this.data.disposition,
    }
  }

  /** Get current loyalty. */
  getLoyalty(): number { return this.data.loyalty }

  /** Get current disposition. */
  getDisposition(): Disposition { return this.data.disposition }

  /**
   * Check if NPC is willing to perform a service.
   * Based on disposition + whether they have the service.
   */
  isWillingTo(service: NPCService): boolean {
    if (!this.data.services.includes(service)) return false
    // Hostile NPCs refuse everything
    if (this.data.disposition === 'hostile') return false
    // Reluctant NPCs refuse risky services
    if (this.data.disposition === 'reluctant') {
      const riskyServices: NPCService[] = ['fight', 'stealth', 'magic']
      return !riskyServices.includes(service)
    }
    return true
  }

  // ============================================================
  // KNOWLEDGE
  // ============================================================

  /** Add a fact to this NPC's knowledge. */
  addKnowledge(fact: string): void {
    if (!this.data.knowledge.includes(fact)) {
      this.data.knowledge.push(fact)
    }
  }

  /** Get all known facts. */
  getKnowledge(): string[] { return [...this.data.knowledge] }

  /** Search knowledge by keyword. */
  searchKnowledge(keyword: string): string[] {
    const lower = keyword.toLowerCase()
    return this.data.knowledge.filter(k => k.toLowerCase().includes(lower))
  }

  // ============================================================
  // POSITION (.tp node)
  // ============================================================

  /** Get home .tp node. */
  getHomeNodeId(): string { return this.data.homeNodeId }

  /** Get current .tp node. */
  getCurrentNodeId(): string { return this.data.currentNodeId }

  /** Move NPC to a new .tp node. */
  moveTo(nodeId: string): void {
    this.data.currentNodeId = nodeId
  }

  /** Is this NPC at their home? */
  isAtHome(): boolean {
    return this.data.currentNodeId === this.data.homeNodeId
  }

  // ============================================================
  // COMBAT SUPPORT
  // ============================================================

  /** Take damage. */
  takeDamage(amount: number): { hpAfter: number; statusChange?: string } {
    const hpBefore = this.data.hpCurrent
    this.data.hpCurrent = Math.max(0, this.data.hpCurrent - amount)

    let statusChange: string | undefined
    if (this.data.hpCurrent === 0) {
      const overkill = amount - hpBefore
      if (overkill >= this.data.hpMax) {
        this.data.status = 'dead'
        statusChange = 'dead'
      } else {
        this.data.status = 'unconscious'
        statusChange = 'unconscious'
      }
    }

    this.deltaAccumulator = addDeltas(this.deltaAccumulator, {
      potential: -amount, archival: 0, omega: amount,
    })

    return { hpAfter: this.data.hpCurrent, statusChange }
  }

  /** Heal. */
  heal(amount: number): { hpAfter: number } {
    this.data.hpCurrent = Math.min(this.data.hpMax, this.data.hpCurrent + amount)
    if (this.data.status === 'unconscious' && this.data.hpCurrent > 0) {
      this.data.status = 'active'
    }
    return { hpAfter: this.data.hpCurrent }
  }

  /** Project this NPC to a Combatant for MM_scene. */
  toCombatant(side: 'party' | 'enemy' | 'neutral' = 'party'): Combatant {
    const stats = this.derive()
    return {
      id: this.data.id,
      name: this.data.name,
      side,
      initiativeModifier: stats.initiativeModifier,
      hpCurrent: this.data.hpCurrent,
      hpMax: this.data.hpMax,
      tempHp: 0,
      ac: stats.ac,
      attackModifier: stats.attackModifier,
      damageDice: { count: 1, sides: 8, modifier: stats.abilityModifiers.strength },
      damageType: this.data.damageType,
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      status: this.data.status === 'active' ? 'active' : this.data.status as 'unconscious' | 'dead' | 'fled',
    }
  }

  // ============================================================
  // WORLD-DAY TICK
  // ============================================================

  /**
   * Called each world-day. Handles:
   * - Daily cost tracking
   * - Loyalty drift (toward 50 baseline if no events)
   * - Days-with-party counter
   */
  tick(): { dailyCost: number; loyaltyDrift: number } {
    this.data.daysWithParty++
    const dailyCost = this.data.dailyCost

    // Loyalty drifts toward 50 by 1 per day if no events
    let drift = 0
    if (this.data.loyalty > 50) {
      drift = -1
      this.data.loyalty = Math.max(50, this.data.loyalty - 1)
    } else if (this.data.loyalty < 50) {
      drift = 1
      this.data.loyalty = Math.min(50, this.data.loyalty + 1)
    }

    // Update disposition from new loyalty
    this.data.disposition = loyaltyToDisposition(this.data.loyalty)

    return { dailyCost, loyaltyDrift: drift }
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  getId(): string { return this.data.id }
  getName(): string { return this.data.name }
  getRole(): NPCRole { return this.data.role }
  getServices(): NPCService[] { return [...this.data.services] }
  getStatus(): string { return this.data.status }
  getHp(): { current: number; max: number } {
    return { current: this.data.hpCurrent, max: this.data.hpMax }
  }
  getDaysWithParty(): number { return this.data.daysWithParty }
  getDailyCost(): number { return this.data.dailyCost }
  getPersonality(): Personality { return { ...this.data.personality } }
  getDelta(): CycleDelta { return { ...this.deltaAccumulator } }

  /** Full NPC summary. */
  summary(): {
    id: string
    name: string
    role: NPCRole
    disposition: Disposition
    loyalty: number
    location: string
    home: string
    services: NPCService[]
    isActive: boolean
    daysWithParty: number
  } {
    return {
      id: this.data.id,
      name: this.data.name,
      role: this.data.role,
      disposition: this.data.disposition,
      loyalty: this.data.loyalty,
      location: this.data.currentNodeId,
      home: this.data.homeNodeId,
      services: [...this.data.services],
      isActive: this.data.status === 'active',
      daysWithParty: this.data.daysWithParty,
    }
  }
}
