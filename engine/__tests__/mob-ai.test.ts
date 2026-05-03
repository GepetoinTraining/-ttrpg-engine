import { describe, it, expect } from 'vitest'
import {
  decideMobIntent,
  resolveDeathSpawn,
  type MobBehavior,
  type CombatContext,
} from '../mob-ai'

function basicCtx(overrides: Partial<CombatContext> = {}): CombatContext {
  return {
    selfId: 'mob1',
    selfPos: { x: 0, y: 0 },
    selfHpPercent: 1.0,
    selfRange: { melee: 1, ranged: 0 },
    enemies: [],
    allies: [],
    isInTerritory: true,
    inLineOfSight: {},
    ...overrides,
  }
}

const AGGRESSIVE_GOBLIN: MobBehavior = {
  objective: 'KILL_PLAYER',
  temperament: 'AGGRESSIVE',
  adaptations: [],
}

const ARCHER_GOBLIN: MobBehavior = {
  ...AGGRESSIVE_GOBLIN,
  // No adaptation needed — behavior is from selfRange
}

describe('decideMobIntent — base cases', () => {
  it('IDLE when no enemies are visible', () => {
    const intent = decideMobIntent(AGGRESSIVE_GOBLIN, basicCtx(), 10)
    expect(intent.action).toBe('IDLE')
  })

  it('ATTACK_MELEE when target is at melee range', () => {
    const ctx = basicCtx({
      enemies: [{ id: 'pc1', pos: { x: 1, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(AGGRESSIVE_GOBLIN, ctx, 10)
    expect(intent.action).toBe('ATTACK_MELEE')
    expect(intent.targetId).toBe('pc1')
  })

  it('ATTACK_RANGED when target is within ranged range and mob has ranged', () => {
    const ctx = basicCtx({
      selfRange: { melee: 1, ranged: 6 },
      enemies: [{ id: 'pc1', pos: { x: 5, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(ARCHER_GOBLIN, ctx, 10)
    expect(intent.action).toBe('ATTACK_RANGED')
  })

  it('APPROACH when target is out of all attack ranges', () => {
    const ctx = basicCtx({
      selfRange: { melee: 1, ranged: 0 },
      enemies: [{ id: 'pc1', pos: { x: 10, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(AGGRESSIVE_GOBLIN, ctx, 10)
    expect(intent.action).toBe('APPROACH')
    expect(intent.targetPos).toEqual({ x: 10, y: 0 })
  })
})

describe('decideMobIntent — morale', () => {
  it('AGGRESSIVE flees below 20% HP', () => {
    const ctx = basicCtx({
      selfHpPercent: 0.15,
      enemies: [{ id: 'pc1', pos: { x: 3, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(AGGRESSIVE_GOBLIN, ctx, 10)
    expect(intent.action).toBe('FLEE')
  })

  it('COWARD flees earlier (50% HP)', () => {
    const ctx = basicCtx({
      selfHpPercent: 0.45,
      enemies: [{ id: 'pc1', pos: { x: 3, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(
      { objective: 'HOARD', temperament: 'COWARD', adaptations: [] },
      ctx,
      10,
    )
    expect(intent.action).toBe('FLEE')
  })

  it('BERSERKER never flees — engages at 1% HP', () => {
    const ctx = basicCtx({
      selfHpPercent: 0.01,
      enemies: [{ id: 'pc1', pos: { x: 1, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(
      { objective: 'KILL_PLAYER', temperament: 'BERSERKER', adaptations: [] },
      ctx,
      10,
    )
    expect(intent.action).toBe('ATTACK_MELEE')
  })

  it('no_flee tag (REGEN/SPLIT) overrides morale break', () => {
    const ctx = basicCtx({
      selfHpPercent: 0.05,
      enemies: [{ id: 'pc1', pos: { x: 1, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(
      { objective: 'KILL_PLAYER', temperament: 'AGGRESSIVE', adaptations: ['REGEN'] },
      ctx,
      10,
    )
    expect(intent.action).not.toBe('FLEE')
  })

  it('flees AWAY from the target (FLEE position is opposite vector)', () => {
    const ctx = basicCtx({
      selfPos: { x: 0, y: 0 },
      selfHpPercent: 0.1,
      enemies: [{ id: 'pc1', pos: { x: 5, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(AGGRESSIVE_GOBLIN, ctx, 10)
    expect(intent.action).toBe('FLEE')
    expect(intent.targetPos!.x).toBeLessThan(0) // flees west, away from enemy at x=5
  })
})

describe('decideMobIntent — territorial behavior', () => {
  it('TERRITORIAL idles outside territory if not threatened', () => {
    const ctx = basicCtx({
      isInTerritory: false,
      enemies: [{ id: 'pc1', pos: { x: 3, y: 0 }, hpPercent: 1, threat: 0 }],
    })
    const intent = decideMobIntent(
      { objective: 'PROTECT_ASSET', temperament: 'TERRITORIAL', adaptations: [] },
      ctx,
      10,
    )
    expect(intent.action).toBe('IDLE')
  })

  it('TERRITORIAL engages outside territory if attacked (threat > 0.3)', () => {
    const ctx = basicCtx({
      isInTerritory: false,
      enemies: [{ id: 'pc1', pos: { x: 1, y: 0 }, hpPercent: 1, threat: 0.7 }],
    })
    const intent = decideMobIntent(
      { objective: 'PROTECT_ASSET', temperament: 'TERRITORIAL', adaptations: [] },
      ctx,
      10,
    )
    expect(intent.action).toBe('ATTACK_MELEE')
  })

  it('TERRITORIAL inside territory engages normally', () => {
    const ctx = basicCtx({
      isInTerritory: true,
      enemies: [{ id: 'pc1', pos: { x: 1, y: 0 }, hpPercent: 1, threat: 0 }],
    })
    const intent = decideMobIntent(
      { objective: 'PROTECT_ASSET', temperament: 'TERRITORIAL', adaptations: [] },
      ctx,
      10,
    )
    expect(intent.action).toBe('ATTACK_MELEE')
  })
})

describe('decideMobIntent — adaptation tags', () => {
  it('CUNNING tag picks lowest-HP target', () => {
    const ctx = basicCtx({
      selfRange: { melee: 1, ranged: 6 },
      enemies: [
        { id: 'fullhp',  pos: { x: 3, y: 0 }, hpPercent: 1.0, threat: 0.5 },
        { id: 'wounded', pos: { x: 4, y: 0 }, hpPercent: 0.2, threat: 0.5 },
      ],
    })
    const intent = decideMobIntent(
      { objective: 'KILL_PLAYER', temperament: 'AGGRESSIVE', adaptations: ['CUNNING'] },
      ctx,
      10,
    )
    expect(intent.targetId).toBe('wounded')
  })

  it('CUNNING + out of range → FLANK instead of APPROACH', () => {
    const ctx = basicCtx({
      enemies: [{ id: 'pc1', pos: { x: 8, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(
      { objective: 'KILL_PLAYER', temperament: 'AGGRESSIVE', adaptations: ['CUNNING'] },
      ctx,
      10,
    )
    expect(intent.action).toBe('FLANK')
  })

  it('STEALTH + not seen → ambush melee on close target', () => {
    const ctx = basicCtx({
      enemies: [{ id: 'pc1', pos: { x: 2, y: 0 }, hpPercent: 1, threat: 0 }],
      inLineOfSight: { pc1: false },
    })
    const intent = decideMobIntent(
      { objective: 'FEED', temperament: 'OPPORTUNIST', adaptations: ['STEALTH'] },
      ctx,
      10,
    )
    expect(intent.action).toBe('ATTACK_MELEE')
    expect(intent.reason).toBe('ambush_melee')
  })

  it('STEALTH + not seen + far → APPROACH (close to ambush range)', () => {
    const ctx = basicCtx({
      enemies: [{ id: 'pc1', pos: { x: 8, y: 0 }, hpPercent: 1, threat: 0 }],
      inLineOfSight: { pc1: false },
    })
    const intent = decideMobIntent(
      { objective: 'FEED', temperament: 'OPPORTUNIST', adaptations: ['STEALTH'] },
      ctx,
      10,
    )
    expect(intent.action).toBe('APPROACH')
    expect(intent.reason).toBe('ambush_close')
  })

  it('PACK + ally engaged → focus on the same enemy (gang up)', () => {
    const ctx = basicCtx({
      enemies: [
        { id: 'pc1', pos: { x: 6, y: 0 }, hpPercent: 1, threat: 0.5 },
        { id: 'pc2', pos: { x: 4, y: 0 }, hpPercent: 1, threat: 0.5 },
      ],
      allies: [{ id: 'a1', pos: { x: 5, y: 0 }, hpPercent: 1, threat: 0 }],
    })
    const intent = decideMobIntent(
      { objective: 'KILL_PLAYER', temperament: 'AGGRESSIVE', adaptations: ['PACK'] },
      ctx,
      10,
    )
    // Ally is closer to pc1 → mob should target pc1, not the closer pc2
    expect(intent.targetId).toBe('pc1')
  })

  it('DRAIN (prefer_melee) skips ranged even when in range', () => {
    const ctx = basicCtx({
      selfRange: { melee: 1, ranged: 6 },
      enemies: [{ id: 'pc1', pos: { x: 5, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const intent = decideMobIntent(
      { objective: 'FEED', temperament: 'AGGRESSIVE', adaptations: ['DRAIN'] },
      ctx,
      10,
    )
    expect(intent.action).not.toBe('ATTACK_RANGED')
    expect(intent.action).toBe('APPROACH')
  })
})

describe('decideMobIntent — HIVEMIND', () => {
  it('targets the same enemy as nearby allies', () => {
    const ctx = basicCtx({
      enemies: [
        { id: 'pc_far', pos: { x: 6, y: 0 }, hpPercent: 1, threat: 0.5 },
        { id: 'pc_near', pos: { x: 4, y: 0 }, hpPercent: 1, threat: 0.5 },
      ],
      allies: [{ id: 'a1', pos: { x: 5, y: 0 }, hpPercent: 1, threat: 0 }],  // near pc_far
    })
    const intent = decideMobIntent(
      { objective: 'REPRODUCE', temperament: 'HIVEMIND', adaptations: [] },
      ctx,
      10,
    )
    expect(intent.targetId).toBe('pc_far')
  })
})

describe('decideMobIntent — determinism', () => {
  it('identical inputs produce identical intents', () => {
    const ctx = basicCtx({
      enemies: [{ id: 'pc1', pos: { x: 5, y: 0 }, hpPercent: 1, threat: 0.5 }],
    })
    const a = decideMobIntent(AGGRESSIVE_GOBLIN, ctx, 14)
    const b = decideMobIntent(AGGRESSIVE_GOBLIN, ctx, 14)
    expect(a).toEqual(b)
  })
})

describe('resolveDeathSpawn', () => {
  it('returns null without SPLIT', () => {
    expect(resolveDeathSpawn(AGGRESSIVE_GOBLIN, 'goblin', 1)).toBeNull()
  })

  it('returns spawn request with SPLIT', () => {
    const spawn = resolveDeathSpawn(
      { ...AGGRESSIVE_GOBLIN, adaptations: ['SPLIT'] },
      'goblin',
      2,
    )
    expect(spawn).not.toBeNull()
    expect(spawn?.count).toBe(2)
    expect(spawn?.speciesId).toBe('goblin')
    expect(spawn?.crEach).toBe(1)  // 50% of parent CR
  })

  it('floors crEach at 0.125', () => {
    const spawn = resolveDeathSpawn(
      { ...AGGRESSIVE_GOBLIN, adaptations: ['SPLIT'] },
      'goblin',
      0.125,
    )
    expect(spawn?.crEach).toBe(0.125)
  })
})
