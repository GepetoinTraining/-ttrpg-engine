/**
 * MM_DUNGEON_GATE TESTS
 * =======================
 * Verifies per-gate weekly fold, κ.ecology danger propagation, and the
 * overflow → migration loop (gate's danger triggers guild quest gen).
 */

import { describe, it, expect } from 'vitest'
import { TP, type WorldNode, type EcologyRules } from '../tp.js'
import {
  MMDungeonGate,
  computeDangerLevel,
  computeDominantThreats,
} from '../mm-dungeon-gate.js'
import {
  ecologyAt,
  writeAdaptationPool,
} from '../ecology-pool.js'
import {
  createDungeonGateFromEcology,
  resetGateIdCounter,
  type DungeonGate,
} from '../dungeon-gate.js'
import { MMGuild } from '../mm-guild.js'
import {
  createGuild,
  resetGuildIdCounter,
  resetJobIdCounter,
} from '../guild.js'

const SEED = 12345

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'sword_coast', type: 'region',     name: 'Sword Coast', parentId: null,         dataStatic: {} },
    { id: 'thundertree', type: 'settlement', name: 'Thundertree', parentId: 'sword_coast', dataStatic: {} },
    { id: 'phandalin',   type: 'settlement', name: 'Phandalin',   parentId: 'sword_coast', dataStatic: {} },
  ]
  tp.loadNodes(nodes)
  return tp
}

function freshGate(tp: TP) {
  resetGateIdCounter()
  const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')
  const speciesId = eco.selectSpecies('lair', 7) ?? 'goblin'
  const pool = eco.getAdaptations(speciesId)
  return createDungeonGateFromEcology({
    siteId: 'site_1',
    edgeId: 'edge_1',
    mileMarker: 25,
    gateType: 'lair',
    tier: 3,
    worldDay: 0,
    speciesId,
    d20s: [3, 9, 14, 18],
    pool,
    generation: 0,
  }).gate
}

describe('computeDangerLevel — pure function', () => {
  it('cleared → 0', () => {
    const g: DungeonGate = { state: 'cleared' } as DungeonGate
    expect(computeDangerLevel(g)).toBe(0)
  })
  it('dormant → low (~0.05)', () => {
    const g: DungeonGate = { state: 'dormant' } as DungeonGate
    expect(computeDangerLevel(g)).toBeLessThan(0.1)
  })
  it('capped → low (~0.10)', () => {
    const g: DungeonGate = { state: 'capped' } as DungeonGate
    expect(computeDangerLevel(g)).toBe(0.10)
  })
  it('active scales with tier', () => {
    const t1: DungeonGate = { state: 'active', tier: 1, overflowRadius: 0, leaderEmerged: false } as DungeonGate
    const t5: DungeonGate = { state: 'active', tier: 5, overflowRadius: 0, leaderEmerged: false } as DungeonGate
    expect(computeDangerLevel(t5)).toBeGreaterThan(computeDangerLevel(t1))
  })
  it('overflowing saturates at high overflow radius', () => {
    const g: DungeonGate = {
      state: 'overflowing', tier: 5, overflowRadius: 12, leaderEmerged: true,
    } as DungeonGate
    expect(computeDangerLevel(g)).toBeGreaterThan(0.9)
  })
  it('leader emergence adds danger', () => {
    const noLeader: DungeonGate = { state: 'overflowing', tier: 3, overflowRadius: 4, leaderEmerged: false } as DungeonGate
    const withLeader: DungeonGate = { state: 'overflowing', tier: 3, overflowRadius: 4, leaderEmerged: true } as DungeonGate
    expect(computeDangerLevel(withLeader)).toBeGreaterThan(computeDangerLevel(noLeader))
  })
})

describe('computeDominantThreats', () => {
  it('non-overflowing returns species only', () => {
    const g: DungeonGate = { state: 'active', tier: 2, leaderEmerged: false, speciesId: 'goblin', id: 'gate_1' } as DungeonGate
    expect(computeDominantThreats(g)).toEqual(['goblin'])
  })
  it('overflowing gate adds gate id at front', () => {
    const g: DungeonGate = { state: 'overflowing', tier: 2, leaderEmerged: false, speciesId: 'goblin', id: 'gate_1' } as DungeonGate
    expect(computeDominantThreats(g)).toEqual(['gate:gate_1', 'goblin'])
  })
  it('leader emerged also escalates', () => {
    const g: DungeonGate = { state: 'active', tier: 4, leaderEmerged: true, speciesId: 'orc', id: 'gate_2' } as DungeonGate
    expect(computeDominantThreats(g)).toEqual(['gate:gate_2', 'orc'])
  })
  it('cleared gate has no threats', () => {
    const g: DungeonGate = { state: 'cleared', tier: 2, leaderEmerged: false, speciesId: 'goblin', id: 'gate_1' } as DungeonGate
    expect(computeDominantThreats(g)).toEqual([])
  })
})

describe('MMDungeonGate — construction', () => {
  it('uses gate:<id> as stable identity', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    const mm = new MMDungeonGate(gate, 'sword_coast', 0)
    expect(mm.state.id).toBe(`gate:${gate.id}`)
    expect(mm.state.mmType).toBe('dungeon_gate')
    expect(mm.state.nodeId).toBe('sword_coast')   // region for κ inheritance
  })

  it('registerWith places the gate on the edge in the entity registry', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    const mm = new MMDungeonGate(gate, 'sword_coast', 0)
    mm.registerWith(tp)
    const entities = tp.getEntitiesOnEdge(gate.edgeId)
    expect(entities.length).toBe(1)
    expect(entities[0].type).toBe('dungeon_gate')
    expect(entities[0].position.type).toBe('on_edge')
  })
})

describe('MMDungeonGate — weekly fold', () => {
  it('runs tickGateWithEcology N times per resolve', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    const mm = new MMDungeonGate(gate, 'sword_coast', 0)

    // 4 weeks
    mm.accumulatePotential(28, 28)
    const result = mm.resolve(28, tp)

    expect(result.stateChanges.weeksTicked).toBe(4)
    expect(result.stateChanges.spawned).toBeGreaterThan(0)
  })

  it('writes κ.ecology.dangerLevel + dominantThreats at the region', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    const mm = new MMDungeonGate(gate, 'sword_coast', 0)

    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    const ctx = tp.resolve('sword_coast')
    const eco = ctx?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBeGreaterThan(0)
    expect(eco?.dominantThreats?.length).toBeGreaterThan(0)
  })

  it('a child settlement inherits the region\'s ecology danger', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    const mm = new MMDungeonGate(gate, 'sword_coast', 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    // Child settlement should see the danger via κ inheritance
    const childCtx = tp.resolve('thundertree')
    const childEco = childCtx?.ecology as EcologyRules | undefined
    expect(childEco?.dangerLevel).toBeGreaterThan(0)
  })

  it('serialize captures cumulative state', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    const mm = new MMDungeonGate(gate, 'sword_coast', 0)
    mm.accumulatePotential(14, 14)
    mm.resolve(14, tp)
    const dom = mm.serialize().domain as ReturnType<MMDungeonGate['getDomainState']>
    expect(dom.cumulative.weeksTicked).toBe(2)
    expect(dom.cumulative.totalSpawned).toBeGreaterThan(0)
  })
})

describe('MMDungeonGate — overflow → migration loop', () => {
  it('an overflowing gate raises dangerLevel and includes the gate id in threats', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    // Force the gate over threshold so it overflows on next tick
    gate.currentInternal = Math.floor(gate.internalCapacity * 0.95)
    gate.tier = 4   // higher tier amplifies the danger

    const mm = new MMDungeonGate(gate, 'sword_coast', 0)
    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)

    expect(gate.state).toBe('overflowing')

    const ctx = tp.resolve('sword_coast')
    const eco = ctx?.ecology as EcologyRules | undefined
    expect(eco?.dangerLevel).toBeGreaterThan(0.4)
    expect(eco?.dominantThreats?.[0]).toBe(`gate:${gate.id}`)
  })

  it('overflow → MMGuild at the same region auto-posts a bounty for the gate', () => {
    resetGateIdCounter()
    resetGuildIdCounter()
    resetJobIdCounter()
    const tp = makeTP()

    // Build an overflowing gate
    const gate = freshGate(tp)
    gate.currentInternal = Math.floor(gate.internalCapacity * 0.95)
    gate.tier = 4
    const mmGate = new MMDungeonGate(gate, 'sword_coast', 0)

    // Build a guild chapter at Thundertree (which inherits from sword_coast)
    const guild = createGuild('Adventurers Guild — Thundertree', 'adventurers', 'thundertree', 'Thundertree')
    const mmGuild = new MMGuild(guild, 'thundertree', 0)

    // Tick the gate first → writes danger to region
    mmGate.accumulatePotential(7, 7)
    mmGate.resolve(7, tp)

    // Now tick the guild → should detect the inherited danger and post a bounty
    mmGuild.accumulatePotential(7, 7)
    const guildResult = mmGuild.resolve(7, tp)

    expect(guildResult.stateChanges.questsGenerated).toBe(1)
    expect(guild.jobBoard[0].type).toBe('bounty')
    expect(guild.jobBoard[0].targetId).toBe(`gate:${gate.id}`)
  })

  it('multiple guilds in the same region all see the threat (the migration)', () => {
    resetGateIdCounter()
    resetGuildIdCounter()
    resetJobIdCounter()
    const tp = makeTP()

    const gate = freshGate(tp)
    gate.currentInternal = Math.floor(gate.internalCapacity * 0.95)
    gate.tier = 4
    const mmGate = new MMDungeonGate(gate, 'sword_coast', 0)

    const thunderGuild = createGuild('AG — Thundertree', 'adventurers', 'thundertree', 'Thundertree')
    const phandalinGuild = createGuild('AG — Phandalin',    'adventurers', 'phandalin',   'Phandalin')
    const mmThunder = new MMGuild(thunderGuild,   'thundertree', 0)
    const mmPhandalin = new MMGuild(phandalinGuild, 'phandalin',   0)

    mmGate.accumulatePotential(7, 7)
    mmGate.resolve(7, tp)

    mmThunder.accumulatePotential(7, 7)
    mmThunder.resolve(7, tp)
    mmPhandalin.accumulatePotential(7, 7)
    mmPhandalin.resolve(7, tp)

    // Both chapters posted a bounty on the same gate
    const thunderJobs = thunderGuild.jobBoard.filter(j => j.targetId === `gate:${gate.id}`)
    const phandalinJobs = phandalinGuild.jobBoard.filter(j => j.targetId === `gate:${gate.id}`)
    expect(thunderJobs.length).toBeGreaterThan(0)
    expect(phandalinJobs.length).toBeGreaterThan(0)
  })

  it('cleared gate stops broadcasting danger (next tick clears κ)', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const gate = freshGate(tp)
    const mm = new MMDungeonGate(gate, 'sword_coast', 0)

    mm.accumulatePotential(7, 7)
    mm.resolve(7, tp)
    const before = (tp.resolve('sword_coast')?.ecology as EcologyRules | undefined)?.dangerLevel ?? 0
    expect(before).toBeGreaterThan(0)

    // Permanent clear
    gate.state = 'cleared'
    mm.accumulatePotential(7, 14)
    mm.resolve(14, tp)
    const after = (tp.resolve('sword_coast')?.ecology as EcologyRules | undefined)?.dangerLevel ?? -1
    expect(after).toBe(0)
  })
})
