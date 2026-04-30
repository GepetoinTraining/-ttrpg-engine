/**
 * MOB-AI INTEGRATION — Mock Combat Scene
 * =========================================
 *
 * The simplest possible combat orchestrator. Builds a turn-based
 * encounter, rolls intents through `decideMobIntent`, applies the
 * resulting movement / attack / death-spawn each round, and asserts that
 * the AI behaves as intended end-to-end.
 *
 * Damage is fixed (no dice) so behavior is the only variable. d20s are
 * supplied externally so each test is deterministic.
 */

import { describe, it, expect } from 'vitest'
import {
  decideMobIntent,
  resolveDeathSpawn,
  type MobBehavior,
  type CombatContext,
  type MobIntent,
  type BehaviorPrimitive,
  type Temperament,
  type MobObjective,
} from '../mob-ai.js'
import type { Adaptation } from '../adaptation.js'

// ============================================================
// COMBAT SCENE — minimal turn-based simulator
// ============================================================

interface Combatant {
  id: string
  side: 'mob' | 'pc'
  pos: { x: number; y: number }
  hp: number
  maxHp: number
  damageMelee: number
  damageRanged: number
  range: { melee: number; ranged: number }
  speed: number              // tiles per APPROACH/FLEE/FLANK turn
  behavior?: MobBehavior     // mobs only
  visible?: boolean          // for STEALTH testing
  alive: boolean
}

interface SceneOptions {
  d20s: number[]
  maxRounds?: number
  /** Custom death-spawn handler; default uses resolveDeathSpawn → spawns minions in adjacent tile. */
  onDeathSpawn?: (deceased: Combatant) => Combatant[]
}

interface SceneResult {
  rounds: number
  log: string[]
  survivors: Combatant[]
  spawned: Combatant[]
  endedBy: 'mob_wipe' | 'pc_wipe' | 'max_rounds' | 'mutual_kill'
}

function makeCombatant(over: Partial<Combatant> & Pick<Combatant, 'id' | 'side' | 'pos'>): Combatant {
  return {
    id: over.id,
    side: over.side,
    pos: over.pos,
    hp: over.hp ?? 20,
    maxHp: over.maxHp ?? over.hp ?? 20,
    damageMelee: over.damageMelee ?? 4,
    damageRanged: over.damageRanged ?? 0,
    range: over.range ?? { melee: 1, ranged: 0 },
    speed: over.speed ?? 2,
    behavior: over.behavior,
    visible: over.visible ?? true,
    alive: over.alive ?? true,
  }
}

/**
 * Build the CombatContext for one mob's turn from the scene state.
 */
function buildContext(self: Combatant, scene: Combatant[]): CombatContext {
  const enemies = scene.filter(c => c.alive && c.side !== self.side)
  const allies = scene.filter(c => c.alive && c.side === self.side && c.id !== self.id)

  return {
    selfId: self.id,
    selfPos: self.pos,
    selfHpPercent: self.hp / self.maxHp,
    selfRange: self.range,
    enemies: enemies.map(e => ({
      id: e.id, pos: e.pos, hpPercent: e.hp / e.maxHp,
      threat: 0.5,        // simple uniform threat
    })),
    allies: allies.map(a => ({
      id: a.id, pos: a.pos, hpPercent: a.hp / a.maxHp,
      threat: 0,
    })),
    isInTerritory: true,
    inLineOfSight: Object.fromEntries(
      enemies.map(e => [e.id, self.visible ?? true]),
    ),
  }
}

/**
 * Apply a single intent to the scene. Mutates in place.
 */
function applyIntent(self: Combatant, intent: MobIntent, scene: Combatant[], log: string[]): void {
  if (!self.alive) return

  switch (intent.action) {
    case 'IDLE':
      log.push(`${self.id} idles`)
      break

    case 'APPROACH':
    case 'FLANK': {
      if (intent.targetPos) {
        const dx = intent.targetPos.x - self.pos.x
        const dy = intent.targetPos.y - self.pos.y
        const dist = Math.hypot(dx, dy) || 1
        self.pos = {
          x: self.pos.x + (dx / dist) * self.speed,
          y: self.pos.y + (dy / dist) * self.speed,
        }
        log.push(`${self.id} ${intent.action.toLowerCase()} → (${self.pos.x.toFixed(1)},${self.pos.y.toFixed(1)})`)
      }
      break
    }

    case 'FLEE': {
      if (intent.targetPos) {
        const dx = intent.targetPos.x - self.pos.x
        const dy = intent.targetPos.y - self.pos.y
        const dist = Math.hypot(dx, dy) || 1
        self.pos = {
          x: self.pos.x + (dx / dist) * self.speed,
          y: self.pos.y + (dy / dist) * self.speed,
        }
        log.push(`${self.id} flees to (${self.pos.x.toFixed(1)},${self.pos.y.toFixed(1)})`)
      }
      break
    }

    case 'ATTACK_MELEE':
    case 'ATTACK_RANGED': {
      const target = scene.find(c => c.id === intent.targetId)
      if (!target || !target.alive) break
      const dmg = intent.action === 'ATTACK_MELEE' ? self.damageMelee : self.damageRanged
      target.hp = Math.max(0, target.hp - dmg)
      log.push(`${self.id} ${intent.action.toLowerCase()} ${target.id} for ${dmg} (${target.hp}/${target.maxHp})`)
      if (target.hp <= 0) {
        target.alive = false
        log.push(`${target.id} DOWN`)
      }
      break
    }
    default:
      log.push(`${self.id} ${intent.action} (no-op handler)`)
  }
}

/**
 * Run the scene. Mobs act in order they appear in `combatants`, then PCs
 * react with a simple "approach & attack" stub (so the test can isolate
 * the AI's behavior, not the PC's).
 */
function runScene(combatants: Combatant[], opts: SceneOptions): SceneResult {
  const log: string[] = []
  const maxRounds = opts.maxRounds ?? 12
  const spawned: Combatant[] = []
  let d20Idx = 0
  const nextD20 = () => opts.d20s[d20Idx++ % opts.d20s.length] ?? 10

  let rounds = 0
  let endedBy: SceneResult['endedBy'] = 'max_rounds'

  const SPAWNED_FLAG = '__SPAWNED__' as Adaptation

  while (rounds < maxRounds) {
    rounds++
    log.push(`-- Round ${rounds} --`)

    // Mob phase: each mob decides + acts
    for (const mob of combatants.filter(c => c.side === 'mob' && c.alive && c.behavior)) {
      const ctx = buildContext(mob, combatants)
      const intent = decideMobIntent(mob.behavior!, ctx, nextD20())
      applyIntent(mob, intent, combatants, log)
    }

    // PC phase: simple stub — each living PC moves toward nearest mob and attacks
    for (const pc of combatants.filter(c => c.side === 'pc' && c.alive)) {
      const livingMobs = combatants.filter(c => c.side === 'mob' && c.alive)
      if (livingMobs.length === 0) break
      const nearest = [...livingMobs].sort(
        (a, b) => Math.hypot(a.pos.x - pc.pos.x, a.pos.y - pc.pos.y)
                - Math.hypot(b.pos.x - pc.pos.x, b.pos.y - pc.pos.y),
      )[0]
      const dist = Math.hypot(nearest.pos.x - pc.pos.x, nearest.pos.y - pc.pos.y)
      if (dist <= pc.range.melee) {
        nearest.hp = Math.max(0, nearest.hp - pc.damageMelee)
        log.push(`${pc.id} attacks ${nearest.id} for ${pc.damageMelee} (${nearest.hp}/${nearest.maxHp})`)
        if (nearest.hp <= 0) {
          nearest.alive = false
          log.push(`${nearest.id} DOWN`)
        }
      } else {
        const dx = nearest.pos.x - pc.pos.x
        const dy = nearest.pos.y - pc.pos.y
        pc.pos = {
          x: pc.pos.x + (dx / dist) * pc.speed,
          y: pc.pos.y + (dy / dist) * pc.speed,
        }
        log.push(`${pc.id} closes → (${pc.pos.x.toFixed(1)},${pc.pos.y.toFixed(1)})`)
      }
    }

    // Death-spawn pass — runs after BOTH phases so spawns from kills this
    // round are visible at the time termination is checked
    for (const mob of combatants.filter(c => c.side === 'mob' && !c.alive && c.behavior)) {
      if (mob.behavior!.adaptations.includes(SPAWNED_FLAG)) continue
      const spawn = resolveDeathSpawn(mob.behavior!, 'goblin_minion', 1)
      if (!spawn) continue
      mob.behavior!.adaptations.push(SPAWNED_FLAG)
      for (let i = 0; i < spawn.count; i++) {
        const minion = makeCombatant({
          id: `${mob.id}_minion_${i}`,
          side: 'mob',
          pos: { x: mob.pos.x + i, y: mob.pos.y },
          hp: 6, maxHp: 6,
          damageMelee: 2,
          range: { melee: 1, ranged: 0 },
          speed: 2,
          behavior: { ...mob.behavior!, adaptations: [] },
        })
        spawned.push(minion)
        combatants.push(minion)
        log.push(`${mob.id} SPLIT into ${minion.id}`)
      }
    }

    // End-of-round termination check
    const livingMobs = combatants.filter(c => c.side === 'mob' && c.alive).length
    const livingPcs  = combatants.filter(c => c.side === 'pc'  && c.alive).length
    if (livingMobs === 0 && livingPcs === 0) { endedBy = 'mutual_kill'; break }
    if (livingMobs === 0) { endedBy = 'mob_wipe'; break }
    if (livingPcs === 0)  { endedBy = 'pc_wipe';  break }
  }

  return {
    rounds,
    log,
    survivors: combatants.filter(c => c.alive),
    spawned,
    endedBy,
  }
}

// ============================================================
// TESTS
// ============================================================

const AGGRESSIVE: (a?: Adaptation[]) => MobBehavior = (a = []) => ({
  objective: 'KILL_PLAYER' as MobObjective,
  temperament: 'AGGRESSIVE' as Temperament,
  adaptations: a,
})

describe('mob-ai end-to-end — basic encounters', () => {
  it('aggressive mob closes and kills a low-HP target', () => {
    const mob = makeCombatant({
      id: 'orc1', side: 'mob', pos: { x: 6, y: 0 },
      hp: 20, damageMelee: 6, behavior: AGGRESSIVE(),
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 0, y: 0 },
      hp: 8, damageMelee: 4, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10] })
    expect(result.endedBy).toBe('pc_wipe')
    expect(result.survivors.find(s => s.id === 'orc1')).toBeDefined()
  })

  it('PCs can kill a mob with no damage output', () => {
    const mob = makeCombatant({
      id: 'punching_bag', side: 'mob', pos: { x: 1, y: 0 },
      hp: 4, damageMelee: 0, behavior: AGGRESSIVE(),
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 0, y: 0 },
      hp: 20, damageMelee: 5, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10] })
    expect(result.endedBy).toBe('mob_wipe')
  })
})

describe('mob-ai end-to-end — morale & temperament', () => {
  it('COWARD mob flees when HP drops below 50%', () => {
    const mob = makeCombatant({
      id: 'goblin1', side: 'mob', pos: { x: 0, y: 0 },
      hp: 20, damageMelee: 1,
      behavior: { objective: 'HOARD', temperament: 'COWARD', adaptations: [] },
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 1, y: 0 },
      hp: 100, damageMelee: 8, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10], maxRounds: 6 })
    // After PC hits the goblin, it should flee. Verify the log contains FLEE.
    const fled = result.log.some(l => l.includes('flees'))
    expect(fled).toBe(true)
  })

  it('BERSERKER never flees — fights to the death', () => {
    const mob = makeCombatant({
      id: 'berserker1', side: 'mob', pos: { x: 1, y: 0 },
      hp: 20, damageMelee: 0,
      behavior: { objective: 'KILL_PLAYER', temperament: 'BERSERKER', adaptations: [] },
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 0, y: 0 },
      hp: 100, damageMelee: 4, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10] })
    const fled = result.log.some(l => l.includes('flees'))
    expect(fled).toBe(false)
    expect(result.endedBy).toBe('mob_wipe')
  })

  it('REGEN adaptation provides no_flee tag — overrides AGGRESSIVE morale break', () => {
    const mob = makeCombatant({
      id: 'troll1', side: 'mob', pos: { x: 1, y: 0 },
      hp: 20, damageMelee: 0,
      behavior: AGGRESSIVE(['REGEN']),
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 0, y: 0 },
      hp: 100, damageMelee: 4, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10] })
    const fled = result.log.some(l => l.includes('flees'))
    expect(fled).toBe(false)
  })
})

describe('mob-ai end-to-end — adaptation behavior', () => {
  it('CUNNING targets the lowest-HP enemy', () => {
    const mob = makeCombatant({
      id: 'cunning1', side: 'mob', pos: { x: 0, y: 0 },
      hp: 30, damageMelee: 4, range: { melee: 1, ranged: 6 },
      behavior: AGGRESSIVE(['CUNNING']),
    })
    const fullhp = makeCombatant({ id: 'fullhp', side: 'pc', pos: { x: 4, y: 0 }, hp: 50, maxHp: 50 })
    const wounded = makeCombatant({ id: 'wounded', side: 'pc', pos: { x: 5, y: 0 }, hp: 5,  maxHp: 50 })
    const result = runScene([mob, fullhp, wounded], { d20s: [10, 12, 14], maxRounds: 3 })
    // The mob should have attacked the wounded one first (and possibly killed it)
    const targetedWounded = result.log.some(l => l.includes('cunning1') && l.includes('wounded') && l.includes('attack'))
    expect(targetedWounded).toBe(true)
  })

  it('PACK gangs up — mobs target the same enemy', () => {
    const m1 = makeCombatant({
      id: 'pack1', side: 'mob', pos: { x: 1, y: 0 },
      hp: 20, damageMelee: 3, behavior: AGGRESSIVE(['PACK']),
    })
    const m2 = makeCombatant({
      id: 'pack2', side: 'mob', pos: { x: 1, y: 1 },
      hp: 20, damageMelee: 3, behavior: AGGRESSIVE(['PACK']),
    })
    const m3 = makeCombatant({
      id: 'pack3', side: 'mob', pos: { x: 2, y: 0 },
      hp: 20, damageMelee: 3, behavior: AGGRESSIVE(['PACK']),
    })
    const closer = makeCombatant({ id: 'closer_pc', side: 'pc', pos: { x: 0, y: 0 }, hp: 50, range: { melee: 1, ranged: 0 } })
    const farther = makeCombatant({ id: 'far_pc',     side: 'pc', pos: { x: 8, y: 0 }, hp: 50, range: { melee: 1, ranged: 0 } })
    const result = runScene([m1, m2, m3, closer, farther], { d20s: [10, 11, 12, 13, 14], maxRounds: 4 })
    // closer_pc should be attacked WAY more than far_pc (concentration of fire on engaged enemy)
    const hitsOnCloser = result.log.filter(l => l.includes('closer_pc') && l.includes('attack')).length
    const hitsOnFar    = result.log.filter(l => l.includes('far_pc') && l.includes('attack')).length
    expect(hitsOnCloser).toBeGreaterThan(hitsOnFar)
  })

  it('STEALTH + not visible → ambush attack on adjacent enemy', () => {
    const stalker = makeCombatant({
      id: 'stalker1', side: 'mob', pos: { x: 2, y: 0 },
      hp: 20, damageMelee: 8,
      behavior: AGGRESSIVE(['STEALTH']),
      visible: false,         // PC can't see the mob → ambush available
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 0, y: 0 },
      hp: 30, damageMelee: 2, range: { melee: 1, ranged: 0 }, speed: 1,
    })
    const result = runScene([stalker, pc], { d20s: [10], maxRounds: 4 })
    const ambushAttack = result.log.some(l => l.includes('stalker1') && l.includes('attack_melee'))
    expect(ambushAttack).toBe(true)
  })

  it('DRAIN prefers melee even when ranged is available', () => {
    const mob = makeCombatant({
      id: 'vampire1', side: 'mob', pos: { x: 0, y: 0 },
      hp: 30, damageMelee: 5, damageRanged: 5, range: { melee: 1, ranged: 6 },
      behavior: AGGRESSIVE(['DRAIN']),
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 5, y: 0 },
      hp: 30, damageMelee: 0, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10], maxRounds: 5 })
    const usedRanged = result.log.some(l => l.includes('vampire1') && l.includes('attack_ranged'))
    const usedMelee  = result.log.some(l => l.includes('vampire1') && l.includes('attack_melee'))
    expect(usedRanged).toBe(false)
    expect(usedMelee).toBe(true)
  })

  it('SPLIT spawns minions on death', () => {
    const mob = makeCombatant({
      id: 'splitter', side: 'mob', pos: { x: 0, y: 0 },
      hp: 4, damageMelee: 0,                       // gets killed quickly
      behavior: AGGRESSIVE(['SPLIT']),
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 0, y: 0 },
      hp: 100, damageMelee: 10, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10], maxRounds: 6 })
    expect(result.spawned.length).toBeGreaterThan(0)
    // Spawned minions are present in the survivor count or logged
    expect(result.spawned.every(s => s.id.startsWith('splitter_minion_'))).toBe(true)
  })

  it('CUNNING + out of range → FLANKs (not just APPROACH)', () => {
    const mob = makeCombatant({
      id: 'tactician', side: 'mob', pos: { x: 0, y: 0 },
      hp: 30, damageMelee: 5,
      behavior: AGGRESSIVE(['CUNNING']),
    })
    const pc = makeCombatant({
      id: 'pc1', side: 'pc', pos: { x: 9, y: 0 },
      hp: 30, damageMelee: 0, range: { melee: 1, ranged: 0 },
    })
    const result = runScene([mob, pc], { d20s: [10], maxRounds: 1 })
    const flanked = result.log.some(l => l.includes('tactician') && l.includes('flank'))
    expect(flanked).toBe(true)
  })
})

describe('mob-ai end-to-end — multi-round encounter resolves', () => {
  it('a 3-mob vs 2-PC encounter terminates within max rounds', () => {
    const mobs = [
      makeCombatant({ id: 'm1', side: 'mob', pos: { x: 5, y: 0 }, hp: 12, damageMelee: 3, behavior: AGGRESSIVE() }),
      makeCombatant({ id: 'm2', side: 'mob', pos: { x: 5, y: 1 }, hp: 12, damageMelee: 3, behavior: AGGRESSIVE() }),
      makeCombatant({ id: 'm3', side: 'mob', pos: { x: 4, y: 0 }, hp: 12, damageMelee: 3, behavior: AGGRESSIVE(['PACK']) }),
    ]
    const pcs = [
      makeCombatant({ id: 'pc1', side: 'pc', pos: { x: 0, y: 0 }, hp: 25, damageMelee: 4, range: { melee: 1, ranged: 0 } }),
      makeCombatant({ id: 'pc2', side: 'pc', pos: { x: 0, y: 1 }, hp: 25, damageMelee: 4, range: { melee: 1, ranged: 0 } }),
    ]
    const result = runScene([...mobs, ...pcs], { d20s: [10, 11, 12, 13, 14, 15, 16, 17, 18], maxRounds: 12 })
    expect(['mob_wipe', 'pc_wipe', 'mutual_kill']).toContain(result.endedBy)
    expect(result.rounds).toBeLessThanOrEqual(12)
  })

  it('determinism: same setup + same d20s → same outcome', () => {
    const mk = () => [
      makeCombatant({ id: 'm1', side: 'mob' as const, pos: { x: 5, y: 0 }, hp: 12, damageMelee: 3, behavior: AGGRESSIVE() }),
      makeCombatant({ id: 'pc1', side: 'pc' as const, pos: { x: 0, y: 0 }, hp: 25, damageMelee: 4, range: { melee: 1, ranged: 0 } }),
    ]
    const r1 = runScene(mk(), { d20s: [7, 13, 18, 4] })
    const r2 = runScene(mk(), { d20s: [7, 13, 18, 4] })
    expect(r1.endedBy).toBe(r2.endedBy)
    expect(r1.rounds).toBe(r2.rounds)
  })
})
