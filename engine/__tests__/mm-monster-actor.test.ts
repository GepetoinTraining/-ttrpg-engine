/**
 * MM_MONSTER_ACTOR TESTS
 * ========================
 * Per-camp, monthly fold. Verifies advancement, challenge resolution,
 * migration recording, danger contribution to κ.
 */

import { describe, it, expect } from 'vitest'
import { TP, type WorldNode, type EcologyRules } from '../tp.js'
import {
  MMMonsterActor,
  computeMonsterDanger,
  contributeDanger,
} from '../mm-monster-actor.js'
import {
  createMonsterActor,
  resetMonsterActorIdCounter,
  type MonsterActorState,
} from '../monster-actor.js'
import { generateQuestForChapter } from '../guild-quest-generator.js'
import { createGuild, resetGuildIdCounter, resetJobIdCounter } from '../guild.js'

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region',     name: 'Sword Coast', parentId: null,         dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function freshActor(opts: Partial<MonsterActorState> = {}): MonsterActorState {
  resetMonsterActorIdCounter()
  const actor = createMonsterActor('orc', 2, 'thundertree', 30, 0)
  return Object.assign(actor, opts)
}

describe('computeMonsterDanger', () => {
  it('zero population → 0', () => {
    const a = freshActor({ population: 0 })
    expect(computeMonsterDanger(a)).toBe(0)
  })

  it('baseline active camp → ~0.1+', () => {
    const a = freshActor({ population: 5, leaderCR: 1, dangerRadius: 1, adaptations: [] })
    expect(computeMonsterDanger(a)).toBeGreaterThan(0.10)
  })

  it('saturated camp (large pop, high CR, big radius) → near 1', () => {
    const a = freshActor({
      population: 200, leaderCR: 12, dangerRadius: 14,
      adaptations: ['ARMORED', 'PACK', 'CUNNING'],
    })
    expect(computeMonsterDanger(a)).toBeGreaterThan(0.85)
  })

  it('backfire grade dampens danger', () => {
    const strong = freshActor({ population: 50, leaderCR: 5, dangerRadius: 5, lastAdvancementGrade: 'success' })
    const rocked = freshActor({ population: 50, leaderCR: 5, dangerRadius: 5, lastAdvancementGrade: 'backfire' })
    expect(computeMonsterDanger(rocked)).toBeLessThan(computeMonsterDanger(strong))
  })

  it('adaptations add to danger', () => {
    const plain = freshActor({ population: 50, leaderCR: 5, dangerRadius: 5, adaptations: [] })
    const adapted = freshActor({ population: 50, leaderCR: 5, dangerRadius: 5, adaptations: ['ARMORED', 'CUNNING', 'PACK'] })
    expect(computeMonsterDanger(adapted)).toBeGreaterThan(computeMonsterDanger(plain))
  })
})

describe('contributeDanger', () => {
  it('writes when no existing danger', () => {
    const tp = makeTP()
    contributeDanger(tp, 'thundertree', 0.5, ['orc'])
    const eco = tp.resolve('thundertree')?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBe(0.5)
    expect(eco?.dominantThreats).toContain('orc')
  })

  it('takes the MAX with existing higher value', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.8, dominantThreats: ['gate:gate_5'] })
    contributeDanger(tp, 'thundertree', 0.4, ['orc'])
    const eco = tp.resolve('thundertree')?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBe(0.8)
    expect(eco?.dominantThreats).toContain('gate:gate_5')
    expect(eco?.dominantThreats).toContain('orc')
  })

  it('lifts existing lower value', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.2, dominantThreats: ['vermin'] })
    contributeDanger(tp, 'thundertree', 0.7, ['orc_warband'])
    const eco = tp.resolve('thundertree')?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBe(0.7)
    expect(eco?.dominantThreats).toEqual(expect.arrayContaining(['vermin', 'orc_warband']))
  })

  it('does not duplicate threats already present', () => {
    const tp = makeTP()
    tp.writeDomain('thundertree', 'ecology', { dangerLevel: 0.3, dominantThreats: ['orc'] })
    contributeDanger(tp, 'thundertree', 0.5, ['orc'])
    const eco = tp.resolve('thundertree')?.ecology as EcologyRules | undefined
    expect(eco?.dominantThreats?.filter(t => t === 'orc').length).toBe(1)
  })
})

describe('MMMonsterActor — construction', () => {
  it('uses monster_actor:<id> as stable identity', () => {
    const a = freshActor()
    const mm = new MMMonsterActor(a, 0)
    expect(mm.state.id).toBe(`monster_actor:${a.id}`)
    expect(mm.state.mmType).toBe('monster_actor')
    expect(mm.state.nodeId).toBe('thundertree')
  })

  it('registerWith places at_node when no edge position', () => {
    const tp = makeTP()
    const mm = new MMMonsterActor(freshActor(), 0)
    mm.registerWith(tp)
    const at = tp.getEntitiesAt('thundertree')
    expect(at.find(e => e.type === 'monster_actor')).toBeDefined()
  })

  it('registerWith places on_edge when camp is on an edge', () => {
    const tp = makeTP()
    const a = freshActor({ campEdgeId: 'high_road', campMileMarker: 25 })
    const mm = new MMMonsterActor(a, 0)
    mm.registerWith(tp)
    const onEdge = tp.getEntitiesOnEdge('high_road')
    expect(onEdge.find(e => e.type === 'monster_actor')).toBeDefined()
  })
})

describe('MMMonsterActor — monthly fold', () => {
  it('runs tickMonsterAdvancement N times per resolve', () => {
    const tp = makeTP()
    const a = freshActor({ population: 30, leaderCR: 2, foodSecurity: 0.7 })
    const mm = new MMMonsterActor(a, 0)

    // 3 months
    mm.accumulatePotential(90, 90)
    const result = mm.resolve(90, tp)

    expect(result.stateChanges.monthsTicked).toBe(3)
    expect(result.stateChanges.advancementsRolled).toBe(3)
    // monthsEstablished is monotonic; tenure can reset on lost challenges
    expect(a.monthsEstablished).toBe(3)
    expect(a.tenure).toBeGreaterThanOrEqual(0)
  })

  it('writes κ.ecology.dangerLevel at the camp node', () => {
    const tp = makeTP()
    const a = freshActor({ population: 50, leaderCR: 5, dangerRadius: 6 })
    const mm = new MMMonsterActor(a, 0)
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)

    const eco = tp.resolve('thundertree')?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBeGreaterThan(0)
    expect(eco?.dominantThreats).toContain('orc')
  })

  it('does not over-write a higher danger from another source', () => {
    const tp = makeTP()
    // A gate already wrote a high danger to the region (sword_coast)
    tp.writeDomain('sword_coast', 'ecology', {
      dangerLevel: 0.9, dominantThreats: ['gate:gate_X', 'goblin'],
    })

    const a = freshActor({ population: 5, leaderCR: 0.25, dangerRadius: 1 })
    const mm = new MMMonsterActor(a, 0)
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)

    // The settlement κ should reflect the higher region danger via inheritance
    // PLUS the local monster threat. The MAX in contributeDanger means
    // the settlement override doesn't go below 0.9.
    const eco = tp.resolve('thundertree')?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBeGreaterThanOrEqual(0.9)
    expect(eco?.dominantThreats).toEqual(expect.arrayContaining(['gate:gate_X', 'orc']))
  })

  it('serialize captures cumulative state', () => {
    const tp = makeTP()
    const a = freshActor()
    const mm = new MMMonsterActor(a, 0)
    mm.accumulatePotential(60, 60)
    mm.resolve(60, tp)
    const dom = mm.serialize().domain as ReturnType<MMMonsterActor['getDomainState']>
    expect(dom.cumulative.monthsTicked).toBe(2)
  })
})

describe('MMMonsterActor — challenges and migration', () => {
  it('vulnerable leader (backfire grade) is more likely to be challenged', () => {
    const tp = makeTP()
    const a = freshActor({
      population: 30, leaderCR: 3,
      lastAdvancementGrade: 'backfire',  // pre-set to vulnerable
    })
    const mm = new MMMonsterActor(a, 0)
    // Force the d20s to make a challenge happen and resolve dramatically.
    // Custom getD20: returns very-high challenger d20s, low incumbent d20s.
    let i = 0
    const seq = [10, 10, 20, 18, 20, 5, 15]  // advance, action, challenge=20 (yes), challengerCR roll, incumbent low, challenger high, fate>10 (migrate)
    const mm2 = new MMMonsterActor(freshActor({
      population: 30, leaderCR: 3,
      lastAdvancementGrade: 'backfire',
    }), 0, {
      getD20: () => seq[i++ % seq.length] ?? 10,
    })
    mm2.accumulatePotential(30, 30)
    const result = mm2.resolve(30, tp)
    expect(result.stateChanges.challenges).toBeGreaterThan(0)
  })

  it('migration is recorded as pendingMigration when leader migrates', () => {
    const tp = makeTP()
    // Force a challenge → challenger wins → migrate
    // d20s ordered: advance, action, challenge, challengerCR, incumbent, challenger, fate
    const seq = [
      10, 10,    // advance / action
      20,        // challenge happens (vulnerable + d20=20)
      18,        // challenger CR ~ 1.4 × leader (high)
      3,         // incumbent rolls 3
      18,        // challenger rolls 18
      15,        // fate > 10 → migrate
    ]
    let i = 0
    const a = freshActor({
      population: 30, leaderCR: 3,
      lastAdvancementGrade: 'backfire',
    })
    const mm = new MMMonsterActor(a, 0, { getD20: () => seq[i++ % seq.length] })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)

    const dom = mm.serialize().domain as ReturnType<MMMonsterActor['getDomainState']>
    expect(dom.pendingMigration).not.toBeNull()
    expect(dom.pendingMigration?.fromNodeId).toBe('thundertree')
    expect(dom.pendingMigration?.loserAction).toBe('migrates')
  })

  it('clearPendingMigration resets the migration intent', () => {
    const tp = makeTP()
    const seq = [10, 10, 20, 18, 3, 18, 15]
    let i = 0
    const a = freshActor({ lastAdvancementGrade: 'backfire' })
    const mm = new MMMonsterActor(a, 0, { getD20: () => seq[i++ % seq.length] })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)
    expect(mm.getPendingMigration()).not.toBeNull()
    mm.clearPendingMigration()
    expect(mm.getPendingMigration()).toBeNull()
  })

  it('successful incumbents never set pendingMigration', () => {
    const tp = makeTP()
    // Force challenge → incumbent wins
    const seq = [
      10, 10,
      20,         // challenge happens
      10,         // challengerCR ~ 1.0×
      18,         // incumbent rolls 18 — wins
      3,          // challenger rolls 3
      5,          // fate ≤ 10 → dies
    ]
    let i = 0
    const a = freshActor({
      population: 30, leaderCR: 3,
      lastAdvancementGrade: 'backfire',
    })
    const mm = new MMMonsterActor(a, 0, { getD20: () => seq[i++ % seq.length] })
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)
    expect(mm.getPendingMigration()).toBeNull()
  })
})

describe('MMMonsterActor + MMGuild — integration', () => {
  it('a strong monster camp triggers a bounty quest at the same hub\'s guild', () => {
    const tp = makeTP()
    // Strong orc camp at Thundertree → high local danger
    const a = freshActor({
      population: 80, leaderCR: 5, dangerRadius: 8,
      adaptations: ['ARMORED', 'PACK', 'CUNNING'],
    })
    const mm = new MMMonsterActor(a, 0)
    mm.accumulatePotential(30, 30)
    mm.resolve(30, tp)

    // Verify danger was written
    const eco = tp.resolve('thundertree')?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBeGreaterThan(0.5)

    // Now a guild at Thundertree should detect the threat on its tick
    // We test via the quest generator directly to keep the assertion focused
    resetGuildIdCounter(); resetJobIdCounter()
    const guild = createGuild('AG', 'adventurers', 'thundertree', 'Thundertree')
    const out = generateQuestForChapter({
      tp, guild, chapter: guild.chapters[0],
      hubNodeId: 'thundertree', worldDay: 30, d20: 10,
    })
    expect(out.pickedNeed?.kind).toBe('monster_threat')
    expect(out.job?.targetId).toBe('orc')   // the dominant threat
  })
})
