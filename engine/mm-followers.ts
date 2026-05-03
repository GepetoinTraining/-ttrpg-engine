/**
 * MM_FOLLOWERS — Party NPC Container (Local + Global)
 * =====================================================
 * 
 * NPCs attached to the party split into two pools:
 * 
 *   LOCAL  — physically with the party (same .tp node)
 *            join combat, consume resources, have daily cost
 * 
 *   GLOBAL — at their OWN .tp nodes (allies elsewhere)
 *            provide info, supplies, political cover remotely
 *            contacted through scene cards or downtime
 * 
 * An NPC can be promoted (global→local: "Renaer joins you")
 * or demoted (local→global: "Miri stays in Suzail").
 * 
 * IMPORTANT: This is the LOCAL observer's view.
 * The party experiences local followers directly.
 * Global followers are non-local — their actions happen
 * at their own .tp position. Like κ resolution:
 * the party only sees the collapsed result.
 * 
 * Container principles:
 *   - Container provides time to followers (daily tick)
 *   - Container aggregates follower Δω into party delta
 *   - Local followers participate in rest/combat
 *   - Global followers participate in downtime/intel
 */

import { MMNPC, type NPCDataInput, type NPCService, type Disposition } from './mm-npc'
import { type Combatant } from './mm-scene'
import { type CycleDelta, ZERO_DELTA, addDeltas } from './types'

// ============================================================
// LOYALTY EVENT — Something that affects loyalty
// ============================================================

export interface LoyaltyEvent {
  /** Which NPC this applies to ('*' = all) */
  targetId: string
  /** Loyalty change (+/-) */
  delta: number
  /** Why */
  reason: string
}

// ============================================================
// MM_FOLLOWERS — The dual container
// ============================================================

export class MMFollowers {
  private local: Map<string, MMNPC> = new Map()
  private global: Map<string, MMNPC> = new Map()

  // ============================================================
  // ADD / REMOVE
  // ============================================================

  /** Add an NPC as a local follower (travels with party). */
  addLocal(data: NPCDataInput): MMNPC {
    const npc = new MMNPC(data)
    this.local.set(npc.getId(), npc)
    return npc
  }

  /** Add an NPC as a global follower (at their own .tp). */
  addGlobal(data: NPCDataInput): MMNPC {
    const npc = new MMNPC(data)
    this.global.set(npc.getId(), npc)
    return npc
  }

  /** Add an existing MMNPC instance as a local follower. */
  addLocalNPC(npc: MMNPC): void {
    this.local.set(npc.getId(), npc)
  }

  /** Add an existing MMNPC instance as a global follower. */
  addGlobalNPC(npc: MMNPC): void {
    this.global.set(npc.getId(), npc)
  }

  /**
   * Promote a global follower to local (NPC joins party physically).
   * Moves them to the party's current .tp node.
   */
  promoteToLocal(id: string, partyNodeId: string): MMNPC | null {
    const npc = this.global.get(id)
    if (!npc) return null
    this.global.delete(id)
    npc.moveTo(partyNodeId)
    this.local.set(id, npc)
    return npc
  }

  /**
   * Demote a local follower to global (NPC leaves party).
   * They return to their home .tp node.
   */
  demoteToGlobal(id: string): MMNPC | null {
    const npc = this.local.get(id)
    if (!npc) return null
    this.local.delete(id)
    npc.moveTo(npc.getHomeNodeId())
    this.global.set(id, npc)
    return npc
  }

  /** Dismiss a follower entirely (removed from both pools). */
  dismiss(id: string): MMNPC | null {
    const npc = this.local.get(id) ?? this.global.get(id)
    if (!npc) return null
    this.local.delete(id)
    this.global.delete(id)
    npc.adjustLoyalty(-npc.getLoyalty()) // drop to 0
    return npc
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  /** Get a specific follower (searches both pools). */
  get(id: string): MMNPC | undefined {
    return this.local.get(id) ?? this.global.get(id)
  }

  /** Is this NPC a local follower? */
  isLocal(id: string): boolean { return this.local.has(id) }

  /** Is this NPC a global follower? */
  isGlobal(id: string): boolean { return this.global.has(id) }

  /** Get all local followers. */
  getLocal(): MMNPC[] { return Array.from(this.local.values()) }

  /** Get all global followers. */
  getGlobal(): MMNPC[] { return Array.from(this.global.values()) }

  /** Get all followers. */
  getAll(): MMNPC[] { return [...this.getLocal(), ...this.getGlobal()] }

  /** Total follower count. */
  size(): { local: number; global: number; total: number } {
    return {
      local: this.local.size,
      global: this.global.size,
      total: this.local.size + this.global.size,
    }
  }

  // ============================================================
  // COMBAT (local followers only)
  // ============================================================

  /** Project all active local followers to combatants. */
  getLocalCombatants(side: 'party' | 'enemy' | 'neutral' = 'party'): Combatant[] {
    return this.getLocal()
      .filter(npc => npc.getStatus() === 'active')
      .map(npc => npc.toCombatant(side))
  }

  // ============================================================
  // KNOWLEDGE QUERY
  // ============================================================

  /**
   * Search what any follower knows about a topic.
   * Optionally filter by .tp proximity (only followers at/near a node).
   */
  queryKnowledge(keyword: string, filterNodeId?: string): {
    npcId: string
    npcName: string
    isLocal: boolean
    facts: string[]
  }[] {
    const results: { npcId: string; npcName: string; isLocal: boolean; facts: string[] }[] = []

    for (const [id, npc] of this.local) {
      const facts = npc.searchKnowledge(keyword)
      if (facts.length > 0) {
        results.push({ npcId: id, npcName: npc.getName(), isLocal: true, facts })
      }
    }

    for (const [id, npc] of this.global) {
      // If filterNodeId provided, only include globals at that node
      if (filterNodeId && npc.getCurrentNodeId() !== filterNodeId) continue
      const facts = npc.searchKnowledge(keyword)
      if (facts.length > 0) {
        results.push({ npcId: id, npcName: npc.getName(), isLocal: false, facts })
      }
    }

    return results
  }

  /**
   * Find global followers at a specific .tp node.
   */
  getFollowersAtNode(nodeId: string): MMNPC[] {
    return this.getGlobal().filter(npc => npc.getCurrentNodeId() === nodeId)
  }

  // ============================================================
  // LOYALTY MANAGEMENT
  // ============================================================

  /**
   * Apply loyalty events to followers.
   * Events with targetId '*' apply to all followers.
   */
  tickLoyalty(events: LoyaltyEvent[]): {
    changes: { npcId: string; npcName: string; reason: string; loyaltyAfter: number; dispositionAfter: Disposition; changed: boolean }[]
    desertions: MMNPC[]
  } {
    const changes: { npcId: string; npcName: string; reason: string; loyaltyAfter: number; dispositionAfter: Disposition; changed: boolean }[] = []
    const desertions: MMNPC[] = []

    for (const event of events) {
      const targets: MMNPC[] = []

      if (event.targetId === '*') {
        targets.push(...this.getAll())
      } else {
        const npc = this.get(event.targetId)
        if (npc) targets.push(npc)
      }

      for (const npc of targets) {
        const result = npc.adjustLoyalty(event.delta)
        changes.push({
          npcId: npc.getId(),
          npcName: npc.getName(),
          reason: event.reason,
          loyaltyAfter: result.loyaltyAfter,
          dispositionAfter: result.dispositionAfter,
          changed: result.changed,
        })

        // Hostile followers may desert
        if (result.dispositionAfter === 'hostile') {
          desertions.push(npc)
        }
      }
    }

    return { changes, desertions }
  }

  // ============================================================
  // WORLD-DAY TICK
  // ============================================================

  /**
   * Called each world-day. Ticks all followers.
   * Returns total daily cost and any disposition shifts.
   */
  dailyTick(): {
    totalDailyCost: number
    shifts: { npcId: string; npcName: string; dispositionNow: Disposition }[]
  } {
    let totalDailyCost = 0
    const shifts: { npcId: string; npcName: string; dispositionNow: Disposition }[] = []

    for (const npc of this.getAll()) {
      const dispositionBefore = npc.getDisposition()
      const { dailyCost } = npc.tick()
      totalDailyCost += dailyCost
      const dispositionAfter = npc.getDisposition()

      if (dispositionBefore !== dispositionAfter) {
        shifts.push({
          npcId: npc.getId(),
          npcName: npc.getName(),
          dispositionNow: dispositionAfter,
        })
      }
    }

    return { totalDailyCost, shifts }
  }

  /**
   * Move all local followers to a new .tp node.
   * Called when the party moves.
   */
  moveLocalTo(nodeId: string): void {
    for (const npc of this.local.values()) {
      npc.moveTo(nodeId)
    }
  }

  // ============================================================
  // DELTA AGGREGATION (container axiom)
  // ============================================================

  /** Aggregate all follower deltas. */
  getDelta(): CycleDelta {
    let total: CycleDelta = { ...ZERO_DELTA }
    for (const npc of this.getAll()) {
      total = addDeltas(total, npc.getDelta())
    }
    return total
  }

  // ============================================================
  // SERVICES AVAILABLE
  // ============================================================

  /** What services are available from all willing followers? */
  getAvailableServices(): { service: NPCService; providers: { id: string; name: string; isLocal: boolean }[] }[] {
    const serviceMap = new Map<NPCService, { id: string; name: string; isLocal: boolean }[]>()

    for (const npc of this.getLocal()) {
      for (const service of npc.getServices()) {
        if (npc.isWillingTo(service)) {
          const list = serviceMap.get(service) ?? []
          list.push({ id: npc.getId(), name: npc.getName(), isLocal: true })
          serviceMap.set(service, list)
        }
      }
    }

    for (const npc of this.getGlobal()) {
      for (const service of npc.getServices()) {
        if (npc.isWillingTo(service)) {
          const list = serviceMap.get(service) ?? []
          list.push({ id: npc.getId(), name: npc.getName(), isLocal: false })
          serviceMap.set(service, list)
        }
      }
    }

    return Array.from(serviceMap.entries()).map(([service, providers]) => ({
      service,
      providers,
    }))
  }

  // ============================================================
  // SUMMARY
  // ============================================================

  summary(): {
    localCount: number
    globalCount: number
    totalDailyCost: number
    avgLoyalty: number
    services: NPCService[]
    hostileFollowers: string[]
  } {
    const all = this.getAll()
    const totalLoyalty = all.reduce((sum, npc) => sum + npc.getLoyalty(), 0)
    const totalCost = all.reduce((sum, npc) => sum + npc.getDailyCost(), 0)
    const services = new Set<NPCService>()
    const hostile: string[] = []

    for (const npc of all) {
      for (const s of npc.getServices()) services.add(s)
      if (npc.getDisposition() === 'hostile') hostile.push(npc.getName())
    }

    return {
      localCount: this.local.size,
      globalCount: this.global.size,
      totalDailyCost: totalCost,
      avgLoyalty: all.length > 0 ? Math.round(totalLoyalty / all.length) : 0,
      services: Array.from(services),
      hostileFollowers: hostile,
    }
  }
}
