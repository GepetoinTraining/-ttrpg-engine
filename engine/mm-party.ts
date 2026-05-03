/**
 * MM_PARTY — Party Container Machine
 * =====================================
 * 
 * A party IS a collection of MM_characters with shared state.
 * The party MM manages:
 *   - Character roster (add/remove members)
 *   - Shared resources (gold, party inventory)
 *   - Marching order
 *   - Group checks (use average or best-of)
 *   - Bridge to MM_session (project all characters to combatants)
 *   - Short/long rest orchestration (all characters simultaneously)
 * 
 * Party is one level up from character, one level down from session.
 * 
 * Container principles:
 *   - Party provides time to its characters (rest = all rest)
 *   - Party aggregates character deltas into party delta
 *   - Party holds shared resources characters can't hold individually
 */

import { MMCharacter, type CharacterDataInput, type DerivedStats, type Ability } from './mm-character'
import { type Combatant } from './mm-scene'
import { type CycleDelta, ZERO_DELTA, addDeltas } from './types'

// ============================================================
// PARTY STATE
// ============================================================

export interface PartyState {
  id: string
  name: string
  /** Gold pieces (shared party fund) */
  gold: number
  /** Marching order (character IDs in order) */
  marchingOrder: string[]
  /** Party notes */
  notes: string[]
}

// ============================================================
// MM_PARTY — The party container
// ============================================================

export class MMParty {
  private state: PartyState
  private members: Map<string, MMCharacter> = new Map()
  private deltaAccumulator: CycleDelta = { ...ZERO_DELTA }

  constructor(id: string, name: string) {
    this.state = { id, name, gold: 0, marchingOrder: [], notes: [] }
  }

  // ============================================================
  // ROSTER MANAGEMENT
  // ============================================================

  /** Add a character to the party. */
  addMember(data: CharacterDataInput): MMCharacter {
    const character = new MMCharacter(data)
    this.members.set(character.getId(), character)
    this.state.marchingOrder.push(character.getId())
    return character
  }

  /** Remove a character from the party. */
  removeMember(id: string): boolean {
    const removed = this.members.delete(id)
    if (removed) {
      this.state.marchingOrder = this.state.marchingOrder.filter(m => m !== id)
    }
    return removed
  }

  /** Get a specific character. */
  getMember(id: string): MMCharacter | undefined {
    return this.members.get(id)
  }

  /** Get all characters. */
  getMembers(): MMCharacter[] {
    return Array.from(this.members.values())
  }

  /** Get party size. */
  size(): number {
    return this.members.size
  }

  // ============================================================
  // MARCHING ORDER
  // ============================================================

  /** Set marching order. */
  setMarchingOrder(order: string[]): void {
    // Validate all IDs exist
    for (const id of order) {
      if (!this.members.has(id)) throw new Error(`Character not found: ${id}`)
    }
    this.state.marchingOrder = order
  }

  /** Get marching order. */
  getMarchingOrder(): { position: number; character: MMCharacter }[] {
    return this.state.marchingOrder
      .map((id, i) => ({ position: i, character: this.members.get(id)! }))
      .filter(m => m.character != null)
  }

  // ============================================================
  // SHARED RESOURCES
  // ============================================================

  /** Add gold to party fund. */
  addGold(amount: number): void {
    this.state.gold += amount
  }

  /** Spend gold from party fund. */
  spendGold(amount: number): boolean {
    if (this.state.gold < amount) return false
    this.state.gold -= amount
    return true
  }

  /** Split gold evenly among party members. */
  splitGold(): { perCharacter: number; remainder: number } {
    const count = this.members.size
    if (count === 0) return { perCharacter: 0, remainder: this.state.gold }
    const perCharacter = Math.floor(this.state.gold / count)
    const remainder = this.state.gold - (perCharacter * count)
    this.state.gold = remainder
    return { perCharacter, remainder }
  }

  /** Get current gold. */
  getGold(): number {
    return this.state.gold
  }

  // ============================================================
  // GROUP OPERATIONS
  // ============================================================

  /** 
   * Group ability check. Returns the average of individual checks.
   * In D&D 5e, group check succeeds if at least half succeed.
   */
  getGroupCheckModifier(ability: Ability): number {
    const members = this.getMembers()
    if (members.length === 0) return 0
    const total = members.reduce((sum, m) => {
      return sum + m.derive().abilityModifiers[ability]
    }, 0)
    return Math.floor(total / members.length)
  }

  /** Get the best modifier in the party for a given ability. */
  getBestModifier(ability: Ability): { character: MMCharacter; modifier: number } {
    let best: { character: MMCharacter; modifier: number } | null = null
    for (const member of this.members.values()) {
      const mod = member.derive().abilityModifiers[ability]
      if (!best || mod > best.modifier) {
        best = { character: member, modifier: mod }
      }
    }
    if (!best) throw new Error('Party is empty')
    return best
  }

  /** Get party level (average of all character total levels). */
  getPartyLevel(): number {
    const members = this.getMembers()
    if (members.length === 0) return 0
    const total = members.reduce((sum, m) => sum + m.derive().totalLevel, 0)
    return Math.floor(total / members.length)
  }

  /** Get the highest passive perception in the party. */
  getHighestPassivePerception(): { character: MMCharacter; value: number } {
    let best: { character: MMCharacter; value: number } | null = null
    for (const member of this.members.values()) {
      const pp = member.derive().passivePerception
      if (!best || pp > best.value) {
        best = { character: member, value: pp }
      }
    }
    if (!best) throw new Error('Party is empty')
    return best
  }

  // ============================================================
  // REST ORCHESTRATION (container provides time)
  // ============================================================

  /** Short rest for the whole party. */
  shortRest(hitDicePerCharacter: Record<string, number> = {}): {
    results: { characterId: string; name: string; hpHealed: number; diceSpent: number }[]
  } {
    const results = []
    for (const [id, member] of this.members) {
      const dice = hitDicePerCharacter[id] ?? 0
      if (dice > 0) {
        const r = member.shortRest(dice)
        results.push({ characterId: id, name: member.getName(), ...r })
      } else {
        results.push({ characterId: id, name: member.getName(), hpHealed: 0, diceSpent: 0 })
      }
    }
    return { results }
  }

  /** Long rest for the whole party. */
  longRest(): {
    results: { characterId: string; name: string; hpRestored: number; hitDiceRestored: number; spellSlotsRestored: number }[]
  } {
    const results = []
    for (const [id, member] of this.members) {
      const r = member.longRest()
      results.push({ characterId: id, name: member.getName(), ...r })
    }
    return { results }
  }

  // ============================================================
  // BRIDGE: Project party to combatants for MM_scene
  // ============================================================

  /** Convert all active party members to combatants. */
  toCombatants(): Combatant[] {
    return this.getMembers()
      .filter(m => m.getStatus() === 'active')
      .map(m => m.toCombatant())
  }

  // ============================================================
  // PARTY HEALTH SUMMARY
  // ============================================================

  /** Get a summary of party health status. */
  getHealthSummary(): {
    totalHP: number
    maxHP: number
    percentage: number
    membersDown: number
    membersDead: number
    membersActive: number
  } {
    let totalHP = 0, maxHP = 0, membersDown = 0, membersDead = 0, membersActive = 0
    for (const member of this.members.values()) {
      const hp = member.getHp()
      totalHP += hp.current
      maxHP += hp.max
      const status = member.getStatus()
      if (status === 'dead') membersDead++
      else if (status === 'unconscious') membersDown++
      else membersActive++
    }
    return {
      totalHP, maxHP,
      percentage: maxHP > 0 ? Math.round((totalHP / maxHP) * 100) : 0,
      membersDown, membersDead, membersActive,
    }
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  getId(): string { return this.state.id }
  getName(): string { return this.state.name }
  getState(): PartyState { return { ...this.state } }
  getDelta(): CycleDelta {
    // Aggregate all character deltas
    let total: CycleDelta = { ...this.deltaAccumulator }
    for (const member of this.members.values()) {
      total = addDeltas(total, member.getDelta())
    }
    return total
  }
}
