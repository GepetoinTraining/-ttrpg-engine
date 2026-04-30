/**
 * MM_SESSION — Single Play Session Orchestrator
 * ===============================================
 * 
 * One play session (3-4 hours at the table). Contains a sequence of
 * SCENE CARDS that unfold the story. Each card is an atomic
 * beat of gameplay.
 * 
 * The session MM contains:
 *   - Scene cards (story beats) in sequence
 *   - Hook-back system (for goldfish parties who lose the thread)
 *   - Combat preparation (pull enemies from .tp or insert new ones)
 *   - World mutation (.tp canonical changes from party actions)
 *   - Pocket manifold spawning (combat scenes run at 6s tick rate)
 * 
 * CARD TYPES (from session/live.ts):
 *   narrative, revelation, transition, encounter, exploration,
 *   puzzle, combat, chase, skill_challenge, downtime_reveal,
 *   loot, rest, milestone, notes, contingency
 * 
 * Every card has:
 *   - Primary content (read-aloud + description)
 *   - GM-only notes + contingencies
 *   - Layered visibility (perception/knowledge/stat gated) 
 *   - Choices with proposed deltas
 *   - Location binding to .tp
 * 
 * GM FLOW:
 *   1. PREPARE: Create scene cards for the session
 *   2. PLAY: Advance through cards, players make choices
 *   3. COMMIT: Player choices write deltas to .tpb + mutate .tp
 *   4. HOOK-BACK: If party drifts, re-present unresolved threads
 * 
 * COMBAT PREPARATION:
 *   - "Pull" enemies from .tp (faction presence at location)
 *   - "Insert" new enemies into .tp canonical (new monster den)
 *   - Either way, the combat card spawns a pocket manifold (6s tick)
 * 
 * WORLD PERSISTENCE:
 *   - Party cleared a monster den? Remove from .tp
 *   - Party made enemies with Zhentarim? New edge in .tp
 *   - Party built a base? New node in .tp
 *   - Every GM builds the world up with play
 */

import { z } from 'zod'
import { MMScene, type Combatant, type RoundResult } from './mm-scene.js'
import { TP, type WorldNode, type WorldEdge } from './tp.js'
import { TPB } from './tpb.js'
import { type CycleDelta, ZERO_DELTA, addDeltas } from './types.js'

// ============================================================
// CARD TYPES — Atomic beats of gameplay
// ============================================================

export const CardType = z.enum([
  'narrative',         // Description, dialogue, story
  'revelation',        // Information reveal (can be layered)
  'transition',        // Scene change, travel, time skip
  'encounter',         // Social encounter, NPC interaction
  'exploration',       // Investigating, searching
  'puzzle',            // Riddle, mechanism, challenge
  'combat',            // Battle (spawns pocket manifold)
  'chase',             // Pursuit sequence
  'skill_challenge',   // Group challenge, timed event
  'loot',              // Treasure, rewards
  'rest',              // Short/long rest
  'milestone',         // Level up, major achievement
])

// ============================================================
// SCENE CARD — A single beat in the adventure
// ============================================================

export const SceneCardSchema = z.object({
  id: z.string(),
  type: CardType,
  title: z.string(),
  sequenceOrder: z.number().int(),

  /** Primary content — what the GM reads to players */
  readAloud: z.string().optional(),
  description: z.string(),

  /** GM-only content */
  gmNotes: z.string().optional(),
  gmSecrets: z.array(z.string()).default([]),
  contingencies: z.array(z.object({
    trigger: z.string(),
    response: z.string(),
  })).default([]),

  /** Location binding — where in the .tp this scene takes place */
  locationId: z.string().optional(),
  locationName: z.string().optional(),

  /** NPCs present */
  npcs: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
  })).default([]),

  /** Choices — each has proposed deltas (consequences) */
  choices: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    /** Requirements to see/select */
    requirements: z.object({
      minLevel: z.number().int().optional(),
      requiredSkill: z.string().optional(),
      dcCheck: z.object({ skill: z.string(), dc: z.number().int() }).optional(),
    }).optional(),
    /** World mutations if chosen */
    worldMutations: z.array(z.object({
      type: z.enum(['add_node', 'remove_node', 'modify_node', 'add_edge', 'remove_edge']),
      target: z.string(),
      data: z.record(z.string(), z.unknown()).optional(),
    })).default([]),
  })).default([]),

  /** Combat setup — only for type 'combat' */
  combatSetup: z.object({
    /** Where enemies come from */
    enemySource: z.enum(['tp_existing', 'tp_insert', 'custom']),
    /** If tp_existing: which location to pull from */
    sourceLocationId: z.string().optional(),
    /** If tp_insert: new canonical data to add to .tp */
    newCanonicalData: z.object({
      nodeId: z.string(),
      nodeType: z.string(),
      name: z.string(),
      parentId: z.string(),
      data: z.record(z.string(), z.unknown()).default({}),
    }).optional(),
    /** The enemies */
    enemies: z.array(z.object({
      id: z.string(),
      name: z.string(),
      hpMax: z.number().int(),
      ac: z.number().int(),
      initiativeModifier: z.number().int(),
      attackModifier: z.number().int(),
      damageDice: z.object({ count: z.number().int(), sides: z.number().int(), modifier: z.number().int() }),
      damageType: z.string().default('slashing'),
      resistances: z.array(z.string()).default([]),
      vulnerabilities: z.array(z.string()).default([]),
      immunities: z.array(z.string()).default([]),
    })).default([]),
  }).optional(),

  /** Status */
  status: z.enum(['prepared', 'active', 'completed', 'skipped']).default('prepared'),
  
  /** Outcome — what happened */
  outcome: z.object({
    choiceId: z.string().optional(),
    description: z.string().optional(),
    combatResult: z.object({
      victor: z.string().optional(),
      rounds: z.number().int().optional(),
      casualties: z.array(z.object({ name: z.string(), side: z.string() })).default([]),
    }).optional(),
  }).optional(),

  /** Hook threads — unresolved plot threads this card connects to */
  hookThreads: z.array(z.string()).default([]),
})
export type SceneCard = z.infer<typeof SceneCardSchema>

// ============================================================
// HOOK THREAD — An unresolved plot thread for hook-back
// ============================================================

export interface HookThread {
  id: string
  name: string
  description: string
  /** How many scenes since this hook was last referenced */
  staleCount: number
  /** Priority: higher = more urgent to hook back */
  priority: number
  /** Related scene cards */
  relatedCardIds: string[]
  /** Is this resolved? */
  resolved: boolean
}

// ============================================================
// WORLD MUTATION — A change to the .tp from party actions
// ============================================================

export interface WorldMutation {
  type: 'add_node' | 'remove_node' | 'modify_node' | 'add_edge' | 'remove_edge'
  target: string
  data?: Record<string, unknown>
  /** Who caused it */
  causedBy: string
  /** When */
  roundNumber?: number
  sceneCardId: string
}

// ============================================================
// MM_SESSION — The session orchestrator
// ============================================================

export class MMSession {
  private cards: SceneCard[] = []
  private currentIndex = -1
  private hooks: Map<string, HookThread> = new Map()
  private mutations: WorldMutation[] = []
  private tpb: TPB
  private sessionId: string
  private activeCombat: MMScene | null = null

  constructor(sessionId: string) {
    this.sessionId = sessionId
    this.tpb = TPB.create({ sessionId, cards: [], hooks: [] }, sessionId)
  }

  // ============================================================
  // SCENE CARD MANAGEMENT
  // ============================================================

  /**
   * Add a scene card to the session.
   * GM calls this during preparation.
   */
  addCard(card: SceneCard): void {
    const validated = SceneCardSchema.parse(card)
    this.cards.push(validated)
    // Sort by sequence order
    this.cards.sort((a, b) => a.sequenceOrder - b.sequenceOrder)
  }

  /**
   * Add multiple cards at once.
   */
  addCards(cards: SceneCard[]): void {
    for (const card of cards) this.addCard(card)
  }

  /**
   * Get all cards.
   */
  getCards(): SceneCard[] {
    return [...this.cards]
  }

  /**
   * Get current card.
   */
  getCurrentCard(): SceneCard | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.cards.length) return null
    return this.cards[this.currentIndex]
  }

  // ============================================================
  // SCENE ADVANCEMENT
  // ============================================================

  /**
   * Advance to the next card.
   * Increments stale count on all hooks.
   * Returns the next card + any hook-back suggestions.
   */
  advance(): { card: SceneCard | null; hookBacks: HookThread[] } {
    // Mark current card as completed if active
    if (this.currentIndex >= 0 && this.currentIndex < this.cards.length) {
      if (this.cards[this.currentIndex].status === 'active') {
        this.cards[this.currentIndex].status = 'completed'
      }
    }

    // Advance
    this.currentIndex++

    // Increment stale count on all unresolved hooks
    for (const hook of this.hooks.values()) {
      if (!hook.resolved) {
        hook.staleCount++
      }
    }

    if (this.currentIndex >= this.cards.length) {
      return { card: null, hookBacks: this.getStaleHooks() }
    }

    const card = this.cards[this.currentIndex]
    card.status = 'active'

    // Record in .tpb
    this.tpb.append(
      `scene:${card.id}:${card.type}:${card.title}`,
      { currentCard: card.id, cardType: card.type },
      { sessionId: this.sessionId },
    )

    // Register any new hook threads from this card
    for (const threadId of card.hookThreads) {
      if (!this.hooks.has(threadId)) {
        this.hooks.set(threadId, {
          id: threadId,
          name: threadId,
          description: `Hook from card: ${card.title}`,
          staleCount: 0,
          priority: 1,
          relatedCardIds: [card.id],
          resolved: false,
        })
      } else {
        // Reset stale count — the hook is being referenced
        const hook = this.hooks.get(threadId)!
        hook.staleCount = 0
        hook.relatedCardIds.push(card.id)
      }
    }

    return { card, hookBacks: this.getStaleHooks() }
  }

  /**
   * Skip the current card.
   */
  skip(): { card: SceneCard | null; hookBacks: HookThread[] } {
    if (this.currentIndex >= 0 && this.currentIndex < this.cards.length) {
      this.cards[this.currentIndex].status = 'skipped'
    }
    return this.advance()
  }

  // ============================================================
  // HOOK-BACK SYSTEM — For goldfish parties
  // ============================================================

  /**
   * Register a plot hook thread.
   */
  addHook(hook: HookThread): void {
    this.hooks.set(hook.id, hook)
  }

  /**
   * Get stale hooks — threads the party has forgotten.
   * Default threshold: 3 scenes without reference.
   */
  getStaleHooks(threshold = 3): HookThread[] {
    return Array.from(this.hooks.values())
      .filter(h => !h.resolved && h.staleCount >= threshold)
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Resolve a hook thread.
   */
  resolveHook(hookId: string): void {
    const hook = this.hooks.get(hookId)
    if (hook) hook.resolved = true
  }

  /**
   * Get all hooks.
   */
  getHooks(): HookThread[] {
    return Array.from(this.hooks.values())
  }

  // ============================================================
  // COMBAT PREPARATION — Pocket manifold spawning
  // ============================================================

  /**
   * Prepare combat from a combat scene card.
   * 
   * Three enemy sources:
   *   1. tp_existing: Pull enemies from .tp faction presence
   *   2. tp_insert: Create new canonical entry + insert enemies
   *   3. custom: Enemies defined directly on the card
   * 
   * Returns the pocket manifold (MMScene) with 6-second tick rate.
   * 
   * @param cardId - The combat scene card to prepare
   * @param party - The party combatants
   * @param tp - The world topology (for pulls/inserts)
   * @param seed - Deterministic seed
   */
  prepareCombat(
    cardId: string,
    party: Combatant[],
    tp: TP,
    seed?: number,
  ): { scene: MMScene; mutations: WorldMutation[] } {
    const card = this.cards.find(c => c.id === cardId)
    if (!card) throw new Error(`Card not found: ${cardId}`)
    if (card.type !== 'combat') throw new Error(`Card ${cardId} is not a combat card`)
    if (!card.combatSetup) throw new Error(`Card ${cardId} has no combat setup`)

    const setup = card.combatSetup
    const roundMutations: WorldMutation[] = []

    // Handle enemy source
    if (setup.enemySource === 'tp_insert' && setup.newCanonicalData) {
      // Insert new canonical data into .tp
      const newNode: WorldNode = {
        id: setup.newCanonicalData.nodeId,
        type: setup.newCanonicalData.nodeType,
        name: setup.newCanonicalData.name,
        parentId: setup.newCanonicalData.parentId,
        dataStatic: setup.newCanonicalData.data,
      }
      tp.loadNodes([newNode])

      roundMutations.push({
        type: 'add_node',
        target: newNode.id,
        data: { node: newNode },
        causedBy: 'gm_prep',
        sceneCardId: cardId,
      })
    }

    // Build enemy combatants
    const enemies: Combatant[] = setup.enemies.map(e => ({
      id: e.id,
      name: e.name,
      side: 'enemy' as const,
      initiativeModifier: e.initiativeModifier,
      hpCurrent: e.hpMax,
      hpMax: e.hpMax,
      tempHp: 0,
      ac: e.ac,
      attackModifier: e.attackModifier,
      damageDice: e.damageDice,
      damageType: e.damageType as Combatant['damageType'],
      resistances: e.resistances,
      vulnerabilities: e.vulnerabilities,
      immunities: e.immunities,
      status: 'active' as const,
    }))

    // Spawn the pocket manifold (6-second tick rate)
    const scene = new MMScene([...party, ...enemies], seed)
    this.activeCombat = scene

    // Record in .tpb
    this.tpb.append(
      `combat:start:${cardId}`,
      {
        combatActive: true,
        partyCount: party.length,
        enemyCount: enemies.length,
        initiativeOrder: scene.getInitiativeOrder(),
      },
      { sessionId: this.sessionId },
    )

    return { scene, mutations: roundMutations }
  }

  /**
   * Resolve combat — collapse pocket manifold back to world time.
   * 
   * Applies world mutations based on outcome:
   *   - Enemy den cleared? Remove from .tp
   *   - Party allied with faction? New edge in .tp
   */
  resolveCombat(
    cardId: string,
    tp: TP,
    worldMutations?: WorldMutation[],
  ): { summary: ReturnType<MMScene['summary']>; mutations: WorldMutation[] } {
    if (!this.activeCombat) throw new Error('No active combat to resolve')
    
    const card = this.cards.find(c => c.id === cardId)
    if (!card) throw new Error(`Card not found: ${cardId}`)

    const summary = this.activeCombat.summary()

    // Apply world mutations
    const allMutations = [...(worldMutations ?? [])]
    
    for (const mutation of allMutations) {
      mutation.sceneCardId = cardId
      this.mutations.push(mutation)
      
      // Apply to .tp
      if (mutation.type === 'add_node' && mutation.data?.node) {
        tp.loadNodes([mutation.data.node as WorldNode])
      }
      if (mutation.type === 'add_edge' && mutation.data?.edge) {
        tp.loadEdges([mutation.data.edge as WorldEdge])
      }
    }

    // Record outcome on the card
    card.outcome = {
      description: `Combat resolved in ${summary.rounds} rounds. Victor: ${summary.victor}`,
      combatResult: {
        victor: summary.victor,
        rounds: summary.rounds,
        casualties: summary.casualties,
      },
    }

    // Record in .tpb
    this.tpb.append(
      `combat:end:${cardId}`,
      {
        combatActive: false,
        victor: summary.victor,
        rounds: summary.rounds,
        partyDamageDealt: summary.totalDamageByParty,
        enemyDamageDealt: summary.totalDamageByEnemy,
        casualties: summary.casualties,
        worldMutations: allMutations.length,
      },
      {
        sessionId: this.sessionId,
        delta: {
          potential: -summary.totalDamageByEnemy,
          archival: summary.casualties.length,
          omega: summary.totalDamageByParty,
        },
      },
    )

    this.activeCombat = null
    return { summary, mutations: allMutations }
  }

  // ============================================================
  // CHOICE RESOLUTION — Player choices commit world changes
  // ============================================================

  /**
   * Apply a player's choice on a scene card.
   * Commits world mutations to .tp.
   */
  applyChoice(
    cardId: string,
    choiceId: string,
    tp: TP,
  ): { mutations: WorldMutation[] } {
    const card = this.cards.find(c => c.id === cardId)
    if (!card) throw new Error(`Card not found: ${cardId}`)

    const choice = card.choices.find(c => c.id === choiceId)
    if (!choice) throw new Error(`Choice not found: ${choiceId}`)

    const appliedMutations: WorldMutation[] = []

    for (const mutation of choice.worldMutations) {
      const wm: WorldMutation = {
        type: mutation.type,
        target: mutation.target,
        data: mutation.data,
        causedBy: `player:choice:${choiceId}`,
        sceneCardId: cardId,
      }
      this.mutations.push(wm)
      appliedMutations.push(wm)

      // Apply to .tp
      if (mutation.type === 'add_node' && mutation.data?.node) {
        tp.loadNodes([mutation.data.node as WorldNode])
      }
      if (mutation.type === 'add_edge' && mutation.data?.edge) {
        tp.loadEdges([mutation.data.edge as WorldEdge])
      }
    }

    // Record the choice
    card.outcome = { choiceId, description: `Chose: ${choice.label}` }

    // Record in .tpb
    this.tpb.append(
      `choice:${cardId}:${choiceId}`,
      { choiceId, choiceLabel: choice.label, mutations: appliedMutations.length },
      { sessionId: this.sessionId },
    )

    return { mutations: appliedMutations }
  }

  // ============================================================
  // STATE ACCESS
  // ============================================================

  /** Get the active combat scene (pocket manifold). */
  getActiveCombat(): MMScene | null {
    return this.activeCombat
  }

  /** Get all world mutations from this session. */
  getMutations(): WorldMutation[] {
    return [...this.mutations]
  }

  /** Get the session's .tpb history. */
  getHistory(): TPB {
    return this.tpb
  }

  /** Get the session ID. */
  getSessionId(): string {
    return this.sessionId
  }
}
