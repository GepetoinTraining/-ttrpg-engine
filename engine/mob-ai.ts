/**
 * MOB-AI — Turn-Based Monster Decision Function
 * ================================================
 *
 * Pure function. ONE mob, ONE turn, ONE intent.
 *
 * No tick loop, no memory. The caller (mm-scene) holds round state and
 * invokes decideMobIntent() once per mob per turn. The result is a
 * BehaviorPrimitive + optional target — to be resolved by the existing
 * mm-combat pipeline (mf-check + mf-damage).
 *
 * Adapted from the real-time MobAI from world-seed-extraction-shooter:
 *   - deltaTime continuous → discrete turn
 *   - 2-second attack cooldown → action economy (1 attack per turn)
 *   - dist<2 melee threshold → "adjacent" (1 tile, modulated by selfRange.melee)
 *   - dist 4-8 kite zone → ranged tier
 *
 * Temperament + adaptation tags MODULATE the decision tree:
 *   BERSERKER     ignore morale, always APPROACH/ATTACK
 *   COWARD        flee earlier (HP < 50%)
 *   TERRITORIAL   only engage in territory; APPROACH limited
 *   HIVEMIND      target whatever ally targets
 *   CUNNING tag   prefer FLANK + low-HP target
 *   STEALTH tag   prefer FLANK if not seen, AMBUSH if hidden
 *   no_flee tag   ignore morale break
 *   prefer_melee  weight melee attacks higher
 *   gang_up       target enemy already engaged by an ally
 */

import type {
  Temperament,
  MobObjective,
} from './biome-fauna'
import type { Adaptation } from './adaptation'
import { combineModifiers } from './adaptation'

// Re-export the enums so consumers can import everything from mob-ai.
export type { Temperament, MobObjective } from './biome-fauna'

// ============================================================
// PRIMITIVES — What a mob can DO in a turn
// ============================================================

export type BehaviorPrimitive =
  | 'IDLE'
  | 'APPROACH'
  | 'FLEE'
  | 'STRAFE'
  | 'FLANK'
  | 'ATTACK_MELEE'
  | 'ATTACK_RANGED'
  | 'BLOCK'
  | 'PHASE'
  | 'SACRIFICE'
  | 'SPAWN'

// ============================================================
// BEHAVIOR PROFILE — What this mob "is"
// ============================================================

export interface MobBehavior {
  objective: MobObjective
  temperament: Temperament
  adaptations: Adaptation[]
}

// ============================================================
// COMBAT CONTEXT — What this mob "sees"
// ============================================================

export interface PositionedTarget {
  id: string
  pos: { x: number; y: number }
  hpPercent: number      // 0-1
  threat: number          // 0-1 — how much this target attacked us / our allies
}

export interface CombatContext {
  selfId: string
  selfPos: { x: number; y: number }
  selfHpPercent: number          // 0-1
  /** Range in tiles. Melee 1 = adjacent only. Ranged 0 = no ranged ability. */
  selfRange: { melee: number; ranged: number }
  /** Enemies the mob can perceive this turn. */
  enemies: PositionedTarget[]
  /** Friendly mobs the AI can coordinate with. */
  allies: PositionedTarget[]
  /** Is the mob inside its territorial bounds? */
  isInTerritory: boolean
  /** Per-enemy line-of-sight (used by STEALTH). */
  inLineOfSight: Record<string, boolean>
}

// ============================================================
// INTENT — The decision output
// ============================================================

export interface MobIntent {
  action: BehaviorPrimitive
  targetId?: string
  targetPos?: { x: number; y: number }
  /** Optional notes for narrative/logging. */
  reason?: string
}

// ============================================================
// MORALE — When does a mob flee?
// ============================================================

/**
 * Morale break threshold per temperament.
 * Returns the HP fraction below which the mob breaks (FLEE).
 */
function moraleThreshold(temperament: Temperament): number {
  switch (temperament) {
    case 'BERSERKER':   return 0.0   // Never flee
    case 'COWARD':      return 0.5   // Flee at half HP
    case 'TERRITORIAL': return 0.25  // Standard
    case 'AGGRESSIVE':  return 0.2
    case 'OPPORTUNIST': return 0.4   // Prefer survival
    case 'PASSIVE':     return 0.6   // Strong flight bias
    case 'HIVEMIND':    return 0.0   // Bound to swarm
  }
}

// ============================================================
// TARGET SELECTION
// ============================================================

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Pick the best target for this mob given its behavior and context.
 *
 *   gang_up tag → prefer enemy an ally is already on (within 2 tiles)
 *   prefer_low_hp_target tag (CUNNING) → lowest HP fraction
 *   HIVEMIND temperament → match an ally's target if they have one
 *   default → nearest by Euclidean distance
 */
function pickTarget(
  behavior: MobBehavior,
  ctx: CombatContext,
  tags: string[],
): PositionedTarget | null {
  if (ctx.enemies.length === 0) return null
  if (ctx.enemies.length === 1) return ctx.enemies[0]

  // HIVEMIND: prefer the enemy our allies are already engaged with
  if (behavior.temperament === 'HIVEMIND' && ctx.allies.length > 0) {
    const allyEngaged = ctx.enemies.find(e =>
      ctx.allies.some(a => distance(a.pos, e.pos) <= 2),
    )
    if (allyEngaged) return allyEngaged
  }

  // gang_up: same idea, surfaced via adaptation tag
  if (tags.includes('gang_up') && ctx.allies.length > 0) {
    const allyEngaged = ctx.enemies.find(e =>
      ctx.allies.some(a => distance(a.pos, e.pos) <= 2),
    )
    if (allyEngaged) return allyEngaged
  }

  // CUNNING: prefer lowest-HP enemy
  if (tags.includes('prefer_low_hp_target')) {
    return [...ctx.enemies].sort((a, b) => a.hpPercent - b.hpPercent)[0]
  }

  // Default: nearest enemy
  return [...ctx.enemies].sort(
    (a, b) => distance(ctx.selfPos, a.pos) - distance(ctx.selfPos, b.pos),
  )[0]
}

// ============================================================
// THE DECISION FUNCTION
// ============================================================

/**
 * Decide a single mob's intent for the current turn.
 *
 * Pure function — no I/O, no global state. Same inputs → same intent.
 *
 * @param behavior - Static profile of the mob (temperament, adaptations)
 * @param ctx      - Live combat snapshot (positions, HP, LOS)
 * @param d20      - Pre-rolled d20 used for ties / nondeterministic branches
 * @returns        - Single intent describing what the mob will do this turn
 */
export function decideMobIntent(
  behavior: MobBehavior,
  ctx: CombatContext,
  d20: number,
): MobIntent {
  const mods = combineModifiers(behavior.adaptations)
  const tags = mods.behaviorTags

  // ── 1. No enemies → idle ──
  if (ctx.enemies.length === 0) {
    return { action: 'IDLE', reason: 'no_enemies_visible' }
  }

  // ── 2. TERRITORIAL: don't engage outside territory unless attacked ──
  if (behavior.temperament === 'TERRITORIAL' && !ctx.isInTerritory) {
    const beingAttacked = ctx.enemies.some(e => e.threat > 0.3)
    if (!beingAttacked) {
      return { action: 'IDLE', reason: 'outside_territory' }
    }
  }

  // ── 3. Pick a target ──
  const target = pickTarget(behavior, ctx, tags)
  if (!target) {
    return { action: 'IDLE', reason: 'no_target' }
  }
  const dist = distance(ctx.selfPos, target.pos)

  // ── 4. Morale check ──
  const threshold = moraleThreshold(behavior.temperament)
  const wouldFlee = ctx.selfHpPercent < threshold && threshold > 0
  const overrideFlee = tags.includes('no_flee')
  if (wouldFlee && !overrideFlee) {
    // Flee away from the threat
    const angle = Math.atan2(ctx.selfPos.y - target.pos.y, ctx.selfPos.x - target.pos.x)
    return {
      action: 'FLEE',
      targetPos: {
        x: ctx.selfPos.x + Math.cos(angle) * 5,
        y: ctx.selfPos.y + Math.sin(angle) * 5,
      },
      reason: 'morale_break',
    }
  }

  // ── 5. STEALTH: ambush if hidden, flank otherwise ──
  if (tags.includes('ambush')) {
    const seen = ctx.inLineOfSight[target.id] ?? true
    if (!seen) {
      // Pop out of stealth — prefer melee for the burst
      if (dist <= ctx.selfRange.melee + 1) {
        return { action: 'ATTACK_MELEE', targetId: target.id, reason: 'ambush_melee' }
      }
      return {
        action: 'APPROACH',
        targetId: target.id,
        targetPos: target.pos,
        reason: 'ambush_close',
      }
    }
  }

  // ── 6. Range-based decision ──

  // Melee range (adjacent or species-adjusted melee reach)
  if (dist <= ctx.selfRange.melee) {
    return { action: 'ATTACK_MELEE', targetId: target.id, reason: 'in_melee' }
  }

  // Ranged window: between melee and ranged max
  const hasRanged = ctx.selfRange.ranged > ctx.selfRange.melee
  if (hasRanged && dist <= ctx.selfRange.ranged && !tags.includes('prefer_melee')) {
    return { action: 'ATTACK_RANGED', targetId: target.id, reason: 'in_range' }
  }

  // Otherwise close the gap. CUNNING/STEALTH → FLANK; else APPROACH.
  if (tags.includes('flank') || tags.includes('tactical')) {
    // Tactical positioning — circle to the side
    const dx = target.pos.x - ctx.selfPos.x
    const dy = target.pos.y - ctx.selfPos.y
    // Perpendicular vector
    const flankX = ctx.selfPos.x - dy * 0.5 + dx * 0.4
    const flankY = ctx.selfPos.y + dx * 0.5 + dy * 0.4
    // d20 modulates which side to flank from
    const sideSign = d20 % 2 === 0 ? 1 : -1
    return {
      action: 'FLANK',
      targetId: target.id,
      targetPos: {
        x: ctx.selfPos.x + (flankX - ctx.selfPos.x) * sideSign,
        y: ctx.selfPos.y + (flankY - ctx.selfPos.y) * sideSign,
      },
      reason: 'tactical_flank',
    }
  }

  return {
    action: 'APPROACH',
    targetId: target.id,
    targetPos: target.pos,
    reason: 'close_to_engage',
  }
}

// ============================================================
// DEATH HOOK — SPLIT adaptation spawns minions
// ============================================================

/**
 * Resolve what should happen when a mob with this behavior dies.
 * SPLIT adaptation spawns minions; otherwise returns null.
 *
 * Caller (mm-scene) should consume the return value and add minions
 * to the encounter on the next round.
 */
export interface DeathSpawnRequest {
  speciesId: string
  count: number
  /** CR per minion — typically 0.5× parent CR */
  crEach: number
}

export function resolveDeathSpawn(
  behavior: MobBehavior,
  speciesId: string,
  parentCR: number,
): DeathSpawnRequest | null {
  const mods = combineModifiers(behavior.adaptations)
  if (!mods.spawnsMinionsOnDeath) return null
  return {
    speciesId,
    count: 2,
    crEach: Math.max(0.125, parentCR * 0.5),
  }
}
