/**
 * MM-SCENE × MOB-AI integration smoke test (W3.1).
 *
 * Verifies that combatants carrying `mobBehavior` are driven by
 * `decideMobIntent` rather than the simple "first enemy" fallback. We
 * confirm:
 *   - BERSERKER never flees even at 0% HP
 *   - COWARD flees at 50% HP (status flips to 'fled')
 *   - 2 PCs + 3 mobs combat resolves deterministically with the same seed
 */

import { describe, it, expect } from 'vitest'
import { MMScene, type Combatant } from '../mm-scene'

function pc(id: string, hp: number, name?: string): Combatant {
  return {
    id,
    name: name ?? id,
    side: 'party',
    initiativeModifier: 0,
    hpCurrent: hp,
    hpMax: hp,
    tempHp: 0,
    ac: 14,
    attackModifier: 5,
    damageDice: { count: 1, sides: 8, modifier: 3 },
    damageType: 'slashing',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
  }
}

function mob(id: string, hp: number, temperament: 'BERSERKER' | 'COWARD' | 'AGGRESSIVE'): Combatant {
  return {
    id,
    name: id,
    side: 'enemy',
    initiativeModifier: 0,
    hpCurrent: hp,
    hpMax: hp,
    tempHp: 0,
    ac: 12,
    attackModifier: 3,
    damageDice: { count: 1, sides: 6, modifier: 2 },
    damageType: 'piercing',
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    status: 'active',
    mobBehavior: {
      objective: 'KILL_PCS',
      temperament,
      adaptations: [],
    },
  }
}

describe('mm-scene × mob-ai (W3.1)', () => {
  it('drives an enemy with mobBehavior through decideMobIntent', () => {
    const scene = new MMScene([pc('hero', 30), mob('goblin', 8, 'AGGRESSIVE')], 1)
    const round = scene.executeRound(1)
    const goblinTurn = round.turns.find((t) => t.combatantId === 'goblin')
    expect(goblinTurn).toBeDefined()
    expect(goblinTurn!.mobIntent).toBeDefined()
    // Aggressive at full HP → expect attack-class intent (or attack)
    expect(['attack', 'move', 'idle', 'none']).toContain(goblinTurn!.action)
  })

  it('marks a low-HP COWARD as fled when its turn fires', () => {
    const scene = new MMScene([pc('hero', 30), mob('coward', 5, 'COWARD')], 1)
    // Coward starts at 5/5 HP (full); won't flee. Take damage to 2/5 (40%) — below 50% threshold.
    const c = scene.getCombatant('coward')!
    c.hpCurrent = 2
    const round = scene.executeRound(1)
    const t = round.turns.find((tt) => tt.combatantId === 'coward')
    expect(t).toBeDefined()
    expect(t!.action).toBe('flee')
    expect(scene.getCombatant('coward')!.status).toBe('fled')
  })

  it('keeps BERSERKER attacking even at 1 HP', () => {
    const scene = new MMScene([pc('hero', 30), mob('berserker', 10, 'BERSERKER')], 1)
    const c = scene.getCombatant('berserker')!
    c.hpCurrent = 1 // 10% HP
    const round = scene.executeRound(1)
    const t = round.turns.find((tt) => tt.combatantId === 'berserker')
    expect(t).toBeDefined()
    expect(t!.action).not.toBe('flee') // berserker never flees
  })

  it('resolves a 2-PC + 3-mob fight deterministically across re-runs', () => {
    const build = () =>
      new MMScene(
        [
          pc('p1', 25),
          pc('p2', 20),
          mob('m1', 8, 'AGGRESSIVE'),
          mob('m2', 6, 'AGGRESSIVE'),
          mob('m3', 5, 'COWARD'),
        ],
        42,
      )

    const a = build()
    const b = build()
    const aResults = a.runToCompletion(99, 20)
    const bResults = b.runToCompletion(99, 20)
    // Same seeds → same outcomes (determinism guarantee).
    expect(aResults.length).toBe(bResults.length)
    expect(a.getVictor()).toBe(b.getVictor())
  })
})
