/**
 * MM_SCENE — Combat Encounter Orchestrator
 * ==========================================
 * 
 * The MM that contains EVERYTHING in a combat encounter.
 * 
 * MM_scene [N:N]:
 *   children = all combatants (party + enemies)
 *   settlement = one round of combat
 * 
 * D&D 5e combat reduces to:
 *   1. Roll initiative for all combatants  (MF_dice per combatant)
 *   2. Sort by initiative descending       (ties → higher DEX wins)
 *   3. Each round: iterate turn order      (? slot: skip dead/unconscious)
 *   4. Each turn: combatant acts           (MM_combat for attacks)
 *   5. Repeat until one side is eliminated
 * 
 * The MM_scene is itself a child of the TP — the local rules
 * at the party's position determine physics, magic, etc.
 * 
 * Container axioms apply:
 *   - Container provides time (rounds) to children (turns)
 *   - Container aggregates child Δω
 *   - Container detects flow break (combat ends)
 */

import { z } from 'zod'
import { mfDice, type DiceFormula, type DiceResult, type DiceReceipt } from './mf-dice'
import { mmCombatAttack, type AttackAction, type AttackResult, type AttackReceiptChain } from './mm-combat'
import { type CycleDelta, ZERO_DELTA, addDeltas, type Receipt } from './types'
import {
  decideMobIntent,
  type MobBehavior,
  type MobIntent,
  type CombatContext,
  type PositionedTarget,
  type BehaviorPrimitive,
} from './mob-ai'

// ============================================================
// COMBATANT — A participant in combat
// ============================================================

export const CombatantSchema = z.object({
  id: z.string(),
  name: z.string(),
  side: z.enum(['party', 'enemy', 'neutral']),

  /** Initiative modifier (usually DEX mod) */
  initiativeModifier: z.number().int(),

  /** Current HP state */
  hpCurrent: z.number().int(),
  hpMax: z.number().int(),
  tempHp: z.number().int().default(0),

  /** Armor Class */
  ac: z.number().int(),

  /** Attack details (simplified — one primary attack) */
  attackModifier: z.number().int(),
  damageDice: z.object({ count: z.number().int(), sides: z.number().int(), modifier: z.number().int() }),
  damageType: z.enum([
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
  ]).default('slashing'),

  /** Resistances/vulnerabilities/immunities */
  resistances: z.array(z.string()).default([]),
  vulnerabilities: z.array(z.string()).default([]),
  immunities: z.array(z.string()).default([]),

  /** Status */
  status: z.enum(['active', 'unconscious', 'dead', 'fled']).default('active'),

  /**
   * Optional 2D position. When present, mob-ai uses it for distance-based
   * decisions (kite zone, FLEE direction, ally proximity for HIVEMIND).
   * When absent, positional checks are skipped — combat reduces to plain
   * "everyone is in range of each other".
   */
  position: z.object({ x: z.number(), y: z.number() }).optional(),

  /**
   * Optional mob behavior profile. When present, this combatant's turn
   * is driven by `decideMobIntent` from mob-ai.ts (per W3.1) instead of
   * the simple "attack the first enemy" fallback. Players + party-side
   * combatants typically leave this undefined (they get target overrides
   * or use the simple AI for testing).
   */
  mobBehavior: z.object({
    objective: z.string(),
    temperament: z.string(),
    adaptations: z.array(z.unknown()).default([]),
  }).optional(),
})
export type Combatant = z.infer<typeof CombatantSchema>

// ============================================================
// INITIATIVE ENTRY — Sorted by roll
// ============================================================

export interface InitiativeEntry {
  combatantId: string
  roll: DiceResult
  receipt: DiceReceipt
  total: number
  modifier: number
}

// ============================================================
// TURN RESULT — What happened in one turn
// ============================================================

export interface TurnResult {
  combatantId: string
  combatantName: string
  action: 'attack' | 'skip' | 'none' | 'flee' | 'move' | 'idle'
  targetId?: string
  targetName?: string
  attackResult?: AttackResult
  attackReceipts?: AttackReceiptChain
  /** mob-ai decision (when this turn was driven by mob behavior). */
  mobIntent?: MobIntent
  description: string
}

// ============================================================
// ROUND RESULT — What happened in one round
// ============================================================

export interface RoundResult {
  roundNumber: number
  turns: TurnResult[]
  delta: CycleDelta
  combatOver: boolean
  victor?: 'party' | 'enemy' | 'draw'
}

// ============================================================
// COMBAT STATE — Full scene state
// ============================================================

export interface CombatState {
  combatants: Map<string, Combatant>
  initiativeOrder: InitiativeEntry[]
  round: number
  isOver: boolean
  victor?: 'party' | 'enemy' | 'draw'
}

// ============================================================
// MM_SCENE — The combat encounter container
// ============================================================

export class MMScene {
  private state: CombatState
  private receipts: Receipt[] = []
  private roundResults: RoundResult[] = []

  constructor(combatants: Combatant[], seed?: number) {
    this.state = {
      combatants: new Map(combatants.map(c => [c.id, { ...c }])),
      initiativeOrder: [],
      round: 0,
      isOver: false,
    }

    // Roll initiative for everyone
    this.rollInitiative(seed)
  }

  /**
   * Roll initiative for all combatants.
   * MF_dice: 1d20 + initiative modifier per combatant.
   * Sort descending. Ties broken by higher modifier.
   */
  private rollInitiative(seed?: number): void {
    const entries: InitiativeEntry[] = []
    let tickSeed = seed ?? Math.floor(Math.random() * 2147483647)

    for (const combatant of this.state.combatants.values()) {
      const formula: DiceFormula = { count: 1, sides: 20, modifier: combatant.initiativeModifier }
      const { output, receipt } = mfDice(formula, tickSeed++)

      entries.push({
        combatantId: combatant.id,
        roll: output,
        receipt,
        total: output.total,
        modifier: combatant.initiativeModifier,
      })

      this.receipts.push({
        mfId: `mf_dice:initiative:${combatant.id}`,
        tick: this.receipts.length,
        input: { formula, combatantId: combatant.id },
        output,
        verification: receipt,
        timestamp: Date.now(),
      })
    }

    // Sort: highest total first, ties broken by higher modifier
    entries.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return b.modifier - a.modifier
    })

    this.state.initiativeOrder = entries
  }

  /**
   * Get the current initiative order.
   */
  getInitiativeOrder(): { id: string; name: string; total: number; side: string }[] {
    return this.state.initiativeOrder.map(entry => {
      const c = this.state.combatants.get(entry.combatantId)!
      return { id: c.id, name: c.name, total: entry.total, side: c.side }
    })
  }

  /**
   * Get current state of all combatants.
   */
  getCombatants(): Combatant[] {
    return Array.from(this.state.combatants.values())
  }

  /**
   * Get a specific combatant.
   */
  getCombatant(id: string): Combatant | undefined {
    return this.state.combatants.get(id)
  }

  /**
   * Is combat over?
   */
  isOver(): boolean {
    return this.state.isOver
  }

  /**
   * Who won?
   */
  getVictor(): string | undefined {
    return this.state.victor
  }

  /**
   * Execute one full round of combat.
   * 
   * Each active combatant in initiative order takes a turn.
   * ? slot: unconscious/dead/fled combatants are skipped.
   * 
   * Target selection: simple AI — attack the nearest live enemy.
   * (This can be overridden by passing targetOverrides.)
   * 
   * @param seed - Deterministic seed for this round
   * @param targetOverrides - Map of combatant ID → target ID
   * @returns RoundResult
   */
  executeRound(seed?: number, targetOverrides?: Map<string, string>): RoundResult {
    if (this.state.isOver) {
      return {
        roundNumber: this.state.round,
        turns: [],
        delta: { ...ZERO_DELTA },
        combatOver: true,
        victor: this.state.victor,
      }
    }

    this.state.round++
    const turns: TurnResult[] = []
    let roundDelta: CycleDelta = { ...ZERO_DELTA }
    let attackSeed = seed ?? Math.floor(Math.random() * 2147483647)

    for (const entry of this.state.initiativeOrder) {
      const combatant = this.state.combatants.get(entry.combatantId)!

      // ? slot: skip if not active
      if (combatant.status !== 'active') {
        turns.push({
          combatantId: combatant.id,
          combatantName: combatant.name,
          action: 'skip',
          description: `${combatant.name} is ${combatant.status} — skipped`,
        })
        continue
      }

      // ── Mob-AI dispatch (W3.1) ──
      // If this combatant carries a mobBehavior, run decideMobIntent to
      // pick action + target. The intent maps to:
      //   ATTACK_MELEE / ATTACK_RANGED → fall through to attack pipeline
      //   FLEE   → status='fled', skip
      //   IDLE   → no action this turn
      //   APPROACH / STRAFE / FLANK / BLOCK → "move" turn (no attack)
      //   PHASE / SACRIFICE / SPAWN → v1: treat as idle
      let mobIntent: MobIntent | undefined
      let mobOverrideTargetId: string | undefined
      if (combatant.mobBehavior) {
        const ctx = this.buildCombatContext(combatant)
        const d20 = (mfDice({ count: 1, sides: 20, modifier: 0 }, attackSeed++).output.rolls[0])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mobIntent = decideMobIntent(combatant.mobBehavior as any, ctx, d20)
        mobOverrideTargetId = mobIntent.targetId

        // Non-attack intents → emit turn and continue.
        if (mobIntent.action === 'FLEE') {
          combatant.status = 'fled'
          turns.push({
            combatantId: combatant.id,
            combatantName: combatant.name,
            action: 'flee',
            mobIntent,
            description: `${combatant.name} breaks and flees! (${mobIntent.reason ?? 'morale broken'})`,
          })
          continue
        }
        if (mobIntent.action === 'IDLE' || mobIntent.action === 'PHASE' || mobIntent.action === 'SACRIFICE' || mobIntent.action === 'SPAWN' || mobIntent.action === 'BLOCK') {
          turns.push({
            combatantId: combatant.id,
            combatantName: combatant.name,
            action: 'idle',
            mobIntent,
            description: `${combatant.name} holds position (${mobIntent.action.toLowerCase()}${mobIntent.reason ? ': ' + mobIntent.reason : ''})`,
          })
          continue
        }
        if (mobIntent.action === 'APPROACH' || mobIntent.action === 'STRAFE' || mobIntent.action === 'FLANK') {
          turns.push({
            combatantId: combatant.id,
            combatantName: combatant.name,
            action: 'move',
            targetId: mobOverrideTargetId,
            targetName: mobOverrideTargetId ? this.state.combatants.get(mobOverrideTargetId)?.name : undefined,
            mobIntent,
            description: `${combatant.name} ${mobIntent.action.toLowerCase()}s${mobOverrideTargetId ? ' toward ' + this.state.combatants.get(mobOverrideTargetId)?.name : ''}`,
          })
          continue
        }
        // ATTACK_MELEE / ATTACK_RANGED → fall through with mob's chosen target
      }

      // Find target — mob-ai's choice overrides default.
      const targetId = mobOverrideTargetId ?? targetOverrides?.get(combatant.id) ?? this.selectTarget(combatant)

      if (!targetId) {
        turns.push({
          combatantId: combatant.id,
          combatantName: combatant.name,
          action: 'none',
          mobIntent,
          description: `${combatant.name} has no valid targets`,
        })
        continue
      }

      const target = this.state.combatants.get(targetId)!

      // Execute attack via MM_combat
      const action: AttackAction = {
        attackerId: combatant.id,
        targetId: target.id,
        attackFormula: { count: 1, sides: 20, modifier: combatant.attackModifier },
        targetAC: target.ac,
        advantage: 'normal',
        damageFormula: combatant.damageDice,
        damageType: combatant.damageType,
        target: {
          hpCurrent: target.hpCurrent,
          hpMax: target.hpMax,
          tempHp: target.tempHp,
          resistances: target.resistances,
          vulnerabilities: target.vulnerabilities,
          immunities: target.immunities,
        },
        seed: attackSeed++,
      }

      const { result, receipts } = mmCombatAttack(action)

      // Apply damage to target state
      if (result.hit && result.damageResult) {
        target.hpCurrent = result.damageResult.hpAfter
        target.tempHp = 0 // Simplified — absorbed tracked in result

        if (result.damageResult.statusChange === 'unconscious' || result.damageResult.statusChange === 'dead') {
          target.status = result.damageResult.statusChange
        }
      }

      // Build turn description
      let desc: string
      if (!result.hit) {
        if (result.fumble) {
          desc = `${combatant.name} critically misses ${target.name}! (nat 1)`
        } else {
          desc = `${combatant.name} attacks ${target.name} — miss (${result.attackRoll.total} vs AC ${target.ac})`
        }
      } else if (result.critical) {
        desc = `${combatant.name} CRITICAL HIT on ${target.name}! ${result.damageResult!.damageDealt} ${combatant.damageType} damage (HP: ${result.damageResult!.hpAfter}/${target.hpMax})`
      } else {
        desc = `${combatant.name} hits ${target.name} for ${result.damageResult!.damageDealt} ${combatant.damageType} damage (HP: ${result.damageResult!.hpAfter}/${target.hpMax})`
      }

      if (target.status === 'unconscious') desc += ` — ${target.name} falls unconscious!`
      if (target.status === 'dead') desc += ` — ${target.name} is slain!`

      turns.push({
        combatantId: combatant.id,
        combatantName: combatant.name,
        action: 'attack',
        targetId: target.id,
        targetName: target.name,
        attackResult: result,
        attackReceipts: receipts,
        mobIntent,
        description: desc,
      })

      roundDelta = addDeltas(roundDelta, result.delta)

      // Store receipts
      this.receipts.push(...receipts.chain)

      // Check if combat is over after each turn
      if (this.checkCombatEnd()) break
    }

    const roundResult: RoundResult = {
      roundNumber: this.state.round,
      turns,
      delta: roundDelta,
      combatOver: this.state.isOver,
      victor: this.state.victor,
    }

    this.roundResults.push(roundResult)
    return roundResult
  }

  /**
   * Simple target selection: attack the first active enemy.
   */
  private selectTarget(combatant: Combatant): string | null {
    const enemySide = combatant.side === 'party' ? 'enemy' : 'party'

    for (const entry of this.state.initiativeOrder) {
      const potential = this.state.combatants.get(entry.combatantId)!
      if (potential.side === enemySide && potential.status === 'active') {
        return potential.id
      }
    }
    return null
  }

  /**
   * Build a CombatContext snapshot for mob-ai. When combatants carry no
   * `position`, fakes a deterministic spread by side so distance-based
   * decisions still resolve coherently (without actually modeling movement).
   */
  private buildCombatContext(self: Combatant): CombatContext {
    const enemySide = self.side === 'party' ? 'enemy' : 'party'
    const positionFor = (c: Combatant): { x: number; y: number } => {
      if (c.position) return c.position
      // Default: party at x=0, enemies at x=5; y by id-hash so it's stable.
      const baseX = c.side === 'party' ? 0 : 5
      let h = 0
      for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) & 0x7fffffff
      return { x: baseX, y: (h % 5) - 2 }
    }
    const enemies: PositionedTarget[] = []
    const allies: PositionedTarget[] = []
    for (const c of this.state.combatants.values()) {
      if (c.id === self.id) continue
      if (c.status !== 'active') continue
      const target: PositionedTarget = {
        id: c.id,
        pos: positionFor(c),
        hpPercent: c.hpMax > 0 ? c.hpCurrent / c.hpMax : 0,
        threat: 0.5, // simplified — no per-enemy threat tracking yet
      }
      if (c.side === enemySide) enemies.push(target)
      else if (c.side === self.side) allies.push(target)
    }
    const inLineOfSight: Record<string, boolean> = {}
    for (const e of enemies) inLineOfSight[e.id] = true

    return {
      selfId: self.id,
      selfPos: positionFor(self),
      selfHpPercent: self.hpMax > 0 ? self.hpCurrent / self.hpMax : 0,
      selfRange: { melee: 1, ranged: 0 },
      enemies,
      allies,
      isInTerritory: true,
      inLineOfSight,
    }
  }

  /**
   * Check if combat has ended.
   * Combat ends when all combatants on one side are down.
   */
  private checkCombatEnd(): boolean {
    const partyAlive = Array.from(this.state.combatants.values())
      .filter(c => c.side === 'party' && c.status === 'active')
    const enemyAlive = Array.from(this.state.combatants.values())
      .filter(c => c.side === 'enemy' && c.status === 'active')

    if (partyAlive.length === 0 && enemyAlive.length === 0) {
      this.state.isOver = true
      this.state.victor = 'draw'
      return true
    }
    if (partyAlive.length === 0) {
      this.state.isOver = true
      this.state.victor = 'enemy'
      return true
    }
    if (enemyAlive.length === 0) {
      this.state.isOver = true
      this.state.victor = 'party'
      return true
    }

    return false
  }

  /**
   * Run combat to completion.
   * Returns all round results.
   * Safety: max 100 rounds to prevent infinite loops.
   */
  runToCompletion(seed?: number, maxRounds = 100): RoundResult[] {
    let roundSeed = seed ?? Math.floor(Math.random() * 2147483647)

    while (!this.state.isOver && this.state.round < maxRounds) {
      this.executeRound(roundSeed++)
    }

    return this.roundResults
  }

  /**
   * Get the full receipt chain for the entire combat.
   */
  getAllReceipts(): Receipt[] {
    return this.receipts
  }

  /**
   * Get all round results.
   */
  getRoundResults(): RoundResult[] {
    return this.roundResults
  }

  /**
   * Get current round number.
   */
  getRound(): number {
    return this.state.round
  }

  /**
   * Generate a combat summary.
   */
  summary(): {
    rounds: number
    victor: string | undefined
    totalDamageByParty: number
    totalDamageByEnemy: number
    casualties: { name: string; side: string; status: string }[]
  } {
    let totalPartyDmg = 0
    let totalEnemyDmg = 0

    for (const round of this.roundResults) {
      for (const turn of round.turns) {
        if (turn.attackResult?.hit && turn.attackResult.damageResult) {
          const combatant = this.state.combatants.get(turn.combatantId)!
          if (combatant.side === 'party') {
            totalPartyDmg += turn.attackResult.damageResult.damageDealt
          } else {
            totalEnemyDmg += turn.attackResult.damageResult.damageDealt
          }
        }
      }
    }

    const casualties = Array.from(this.state.combatants.values())
      .filter(c => c.status !== 'active')
      .map(c => ({ name: c.name, side: c.side, status: c.status }))

    return {
      rounds: this.state.round,
      victor: this.state.victor,
      totalDamageByParty: totalPartyDmg,
      totalDamageByEnemy: totalEnemyDmg,
      casualties,
    }
  }
}
