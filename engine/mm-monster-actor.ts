/**
 * MM_MONSTER_ACTOR — Layer 5 ISimulatedMM adapter for monster-actor.ts
 * =======================================================================
 *
 * One MMMonsterActor per `MonsterActorState` (one per camp). Lives at the
 * camp's location. Monthly cadence. Each resolve folds N months of:
 *
 *   1. tickMonsterAdvancement — d20 + CR + tenure → grade → camp evolves
 *      (population, gold, food security, dangerRadius mutate in place)
 *   2. shouldChallenge → if yes, generateChallengerCR + resolveLeadership-
 *      Challenge. Loser dies or migrates. Migration is recorded as
 *      pendingMigration for surfaces to consume.
 *
 * THE LEADER CHANNEL (per the migration loop Pedro asked for):
 *   - Bad rolls → vulnerable to challenges
 *   - Lost challenges → loser MIGRATES → seeds a new lair on a new edge
 *   - The MM records the migration intent; surfaces (or higher orchestrators)
 *     pick it up and create a new MMMonsterActor at the destination
 *
 * Reads:
 *   κ.ecology.dangerLevel — to avoid clobbering higher contributions from
 *     other MMs (gates, other monsters). The MM only writes if its own
 *     contribution exceeds the existing value.
 *
 * Writes:
 *   κ.ecology.dangerLevel + .dominantThreats at the camp's node — this is
 *   how the monster's threat propagates to nearby guild quest generators.
 *
 * Cadence: monthly. Layer: 5 (ECOLOGY).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated.js'
import {
  type MonsterActorState,
  type AdvancementResult,
  type ChallengeResult,
  tickMonsterAdvancement,
  shouldChallenge,
  generateChallengerCR,
  resolveLeadershipChallenge,
} from './monster-actor.js'
import type { TP, EcologyRules } from './tp.js'

// ============================================================
// MM_MONSTER_ACTOR STATE
// ============================================================

export interface PendingMigration {
  /** Where the migrating leader came from. */
  fromNodeId: string
  /** Whether they're leaving the camp or just retiring (dies vs migrates). */
  loserAction: 'dies' | 'migrates'
  /** World day the migration was triggered. */
  triggeredOnDay: number
  /** CR of the migrating loser — used by surfaces to seed a new lair. */
  challengerCR: number
}

export interface MMMonsterActorDomainState {
  actor: MonsterActorState
  cumulative: {
    monthsTicked: number
    advancementsRolled: number
    challenges: number
    challengerWins: number
    incumbentWins: number
    fledChallenges: number
    raidsConducted: number
    migrationsTriggered: number
  }
  lastAdvancement: AdvancementResult | null
  lastChallenge: ChallengeResult | null
  /** Most recent migration intent — surfaces consume this and set null when handled. */
  pendingMigration: PendingMigration | null
  lastDangerLevel: number
}

export interface MMMonsterActorOptions {
  name?: string
  /** d20 supplier — defaults to deterministic pool keyed on worldDay. */
  getD20?: (worldDay: number, salt: number) => number
}

// ============================================================
// MM_MONSTER_ACTOR
// ============================================================

export class MMMonsterActor extends SimulatedMMBase {
  domain: MMMonsterActorDomainState
  private getD20: (worldDay: number, salt: number) => number

  constructor(
    actor: MonsterActorState,
    worldDay: number = 0,
    opts: MMMonsterActorOptions = {},
  ) {
    const id = `monster_actor:${actor.id}`
    const name = opts.name ?? `${actor.leaderName} (${actor.speciesId})`
    super(id, name, actor.campNodeId, 'monster_actor', worldDay)

    this.domain = {
      actor,
      cumulative: {
        monthsTicked: 0, advancementsRolled: 0,
        challenges: 0, challengerWins: 0, incumbentWins: 0, fledChallenges: 0,
        raidsConducted: 0, migrationsTriggered: 0,
      },
      lastAdvancement: null,
      lastChallenge: null,
      pendingMigration: null,
      lastDangerLevel: 0,
    }

    this.getD20 = opts.getD20
      ?? ((day, salt) => (((day + salt) * 1664525 + 1013904223) >>> 0) % 20 + 1)
  }

  /**
   * Register this actor in the entity registry. Camps live at_node by
   * default; if the camp is on an edge (campEdgeId set), use on_edge.
   */
  registerWith(tp: TP): void {
    const a = this.domain.actor
    if (a.campEdgeId != null && a.campMileMarker != null) {
      tp.registerEntity({
        id: this.state.id,
        type: 'monster_actor',
        position: {
          type: 'on_edge',
          edgeId: a.campEdgeId,
          mile: a.campMileMarker,
          direction: 'forward',
        },
      })
    } else {
      tp.registerEntity({
        id: this.state.id,
        type: 'monster_actor',
        position: { type: 'at_node', nodeId: a.campNodeId },
      })
    }
  }

  /** Surfaces call this after handling a migration. */
  clearPendingMigration(): void {
    this.domain.pendingMigration = null
  }

  // ────────────────────────────────────────────
  // ACCUMULATE — O(1)
  // ────────────────────────────────────────────

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // The camp does no work between observations.
  }

  // ────────────────────────────────────────────
  // RESOLVE — fold N months
  // ────────────────────────────────────────────

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const actor = this.domain.actor
    const months = Math.floor(daysResolved / 30)

    if (months === 0) {
      return {
        stateChanges: { monthsTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a month — no advancement.`,
        additionalEvents: [],
      }
    }

    let advancementsRolled = 0
    let challenges = 0
    let challengerWins = 0
    let incumbentWins = 0
    let fledChallenges = 0
    let migrationsTriggered = 0
    let raidsThisResolve = 0
    let lastAdvancement: AdvancementResult | null = null
    let lastChallenge: ChallengeResult | null = null

    for (let m = 0; m < months; m++) {
      const monthDay = worldDay - daysResolved + (m + 1) * 30

      // 1. Monthly advancement
      const d20 = this.getD20(monthDay, 0)
      const actionD20 = this.getD20(monthDay, 1)
      const advancement = tickMonsterAdvancement(actor, d20, actionD20)
      advancementsRolled++
      if (advancement.action === 'raid_settlement') raidsThisResolve++
      lastAdvancement = advancement

      // 2. Leadership challenge?
      const challengeRoll = this.getD20(monthDay, 2)
      if (shouldChallenge(actor, challengeRoll)) {
        challenges++
        const crRoll = this.getD20(monthDay, 3)
        const challengerCR = generateChallengerCR(actor.leaderCR, crRoll)
        const incRoll = this.getD20(monthDay, 4)
        const chalRoll = this.getD20(monthDay, 5)
        const fateRoll = this.getD20(monthDay, 6)
        const result = resolveLeadershipChallenge(actor, challengerCR, incRoll, chalRoll, fateRoll)
        lastChallenge = result

        switch (result.outcome) {
          case 'challenger_wins':
            challengerWins++
            // Incumbent loses — migrates or dies
            if (result.loserAction === 'migrates') {
              this.domain.pendingMigration = {
                fromNodeId: actor.campNodeId,
                loserAction: 'migrates',
                triggeredOnDay: monthDay,
                challengerCR: challengerCR,
              }
              migrationsTriggered++
            }
            break
          case 'incumbent_wins':
            incumbentWins++
            // Challenger loses — also migrates or dies (but we don't track them)
            break
          case 'challenger_flees':
            fledChallenges++
            break
        }
      }
    }

    // 3. Update cumulative
    this.domain.cumulative.monthsTicked += months
    this.domain.cumulative.advancementsRolled += advancementsRolled
    this.domain.cumulative.challenges += challenges
    this.domain.cumulative.challengerWins += challengerWins
    this.domain.cumulative.incumbentWins += incumbentWins
    this.domain.cumulative.fledChallenges += fledChallenges
    this.domain.cumulative.raidsConducted += raidsThisResolve
    this.domain.cumulative.migrationsTriggered += migrationsTriggered
    this.domain.lastAdvancement = lastAdvancement
    this.domain.lastChallenge = lastChallenge

    // 4. Compute and contribute danger to κ.ecology
    const danger = computeMonsterDanger(actor)
    this.domain.lastDangerLevel = danger
    if (tp) {
      contributeDanger(tp, actor.campNodeId, danger, [actor.speciesId])
    }

    // 5. Narrative
    const lastGradeNote = lastAdvancement
      ? ` (${lastAdvancement.grade} ${lastAdvancement.action})`
      : ''
    const challengeNote = challenges > 0
      ? ` Challenges: ${challenges} (incumbent ${incumbentWins}, challenger ${challengerWins}, fled ${fledChallenges}).`
      : ''
    const migrationNote = migrationsTriggered > 0
      ? ` Leader migrated.`
      : ''

    const narrative =
      `${this.state.name} (${daysResolved}d, ${months} mo)${lastGradeNote}: ` +
      `pop ${actor.population}, troops ${actor.troops}, food ${actor.foodSecurity.toFixed(2)}, ` +
      `radius ${actor.dangerRadius}, leader CR ${actor.leaderCR.toFixed(2)} (${actor.tenure}mo).` +
      challengeNote + migrationNote

    return {
      stateChanges: {
        monthsTicked: months,
        advancementsRolled,
        challenges,
        raidsConducted: raidsThisResolve,
        migrationsTriggered,
        population: actor.population,
        troops: actor.troops,
        leaderCR: actor.leaderCR,
        dangerLevel: danger,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMMonsterActorDomainState {
    return {
      actor: { ...this.domain.actor },
      cumulative: { ...this.domain.cumulative },
      lastAdvancement: this.domain.lastAdvancement ? { ...this.domain.lastAdvancement } : null,
      lastChallenge: this.domain.lastChallenge ? { ...this.domain.lastChallenge } : null,
      pendingMigration: this.domain.pendingMigration ? { ...this.domain.pendingMigration } : null,
      lastDangerLevel: this.domain.lastDangerLevel,
    }
  }

  // ────────────────────────────────────────────
  // CONVENIENCE
  // ────────────────────────────────────────────

  getActor(): MonsterActorState {
    return this.domain.actor
  }

  getDangerLevel(): number {
    return this.domain.lastDangerLevel
  }

  getPendingMigration(): PendingMigration | null {
    return this.domain.pendingMigration
  }
}

// ============================================================
// DANGER COMPUTATION — actor state → κ.ecology.dangerLevel
// ============================================================

/**
 * Map a monster actor's current state to a danger contribution in [0, 1].
 *
 * Components:
 *   baseline              0.10 (any active camp)
 *   population factor     up to +0.25 (saturates at 100 troops worth)
 *   leader CR factor      up to +0.25 (saturates at CR 10)
 *   danger radius factor  up to +0.25 (saturates at 12 mi)
 *   adaptation bonus      +0.05 per adaptation
 *   weakness penalty      ×0.7 if last grade was 'backfire' (recently rocked)
 *
 * Returns 0 when the population is zero (camp is wiped).
 */
export function computeMonsterDanger(actor: MonsterActorState): number {
  if (actor.population <= 0) return 0

  const popFactor    = Math.min(1, actor.population / 100)
  const crFactor     = Math.min(1, actor.leaderCR / 10)
  const radiusFactor = Math.min(1, actor.dangerRadius / 12)
  const adaptBonus   = (actor.adaptations?.length ?? 0) * 0.05

  let danger = 0.10
    + popFactor * 0.25
    + crFactor * 0.25
    + radiusFactor * 0.25
    + adaptBonus

  if (actor.lastAdvancementGrade === 'backfire') {
    danger *= 0.7
  }

  return Math.min(1, danger)
}

// ============================================================
// CONTRIBUTE DANGER — κ write that respects existing higher values
// ============================================================

/**
 * Contribute a danger level + threats to a node's κ.ecology, taking the
 * MAX with the existing inherited value and UNION-ing the threats array.
 * This avoids one MM clobbering another's higher contribution.
 *
 * Read-modify-write — so contention between MMs is not perfectly atomic,
 * but in the single-resolve-loop model that's fine.
 */
export function contributeDanger(
  tp: TP,
  nodeId: string,
  level: number,
  threats: string[],
): boolean {
  const ctx = tp.resolve(nodeId)
  const existing = ctx?.ecology as EcologyRules | undefined
  const existingLevel = existing?.dangerLevel ?? 0
  const existingThreats = existing?.dominantThreats ?? []

  const newLevel = Math.max(existingLevel, level)

  // Union without dedup-by-equality
  const merged = [...existingThreats]
  for (const t of threats) {
    if (!merged.includes(t)) merged.push(t)
  }

  return tp.writeDomain(nodeId, 'ecology', {
    dangerLevel: newLevel,
    dominantThreats: merged,
  } as EcologyRules)
}
