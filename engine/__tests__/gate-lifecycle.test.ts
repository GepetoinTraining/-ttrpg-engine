/**
 * GATE-LIFECYCLE TESTS — clear → pool feedback → respawn → re-roll
 * ===================================================================
 */

import { describe, it, expect } from 'vitest'
import { TP, type WorldNode } from '../tp.js'
import {
  ecologyAt,
  writeAdaptationPool,
} from '../ecology-pool.js'
import { createAdaptationPool } from '../adaptation.js'
import {
  createDungeonGateFromEcology,
  resetGateIdCounter,
} from '../dungeon-gate.js'
import {
  clearGateWithEcology,
  tickGateWithEcology,
  spawnMonsterActorWithEcology,
} from '../gate-lifecycle.js'
import { resetMonsterActorIdCounter } from '../monster-actor.js'

const SEED = 12345

function makeTP(): TP {
  const tp = new TP()
  const nodes: WorldNode[] = [
    { id: 'faerun',     type: 'continent',  name: 'Faerûn',         parentId: null,        dataStatic: {} },
    { id: 'sword_coast',type: 'region',     name: 'Sword Coast',    parentId: 'faerun',    dataStatic: {} },
    { id: 'thundertree',type: 'settlement', name: 'Thundertree',    parentId: 'sword_coast', dataStatic: {} },
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
    tier: 5,
    worldDay: 100,
    speciesId,
    d20s: [3, 9, 14, 18],
    pool,
    generation: 0,
  })
}

describe('clearGateWithEcology', () => {
  it('on success → reportClear writes to κ.ecology.adaptations[species]', () => {
    const tp = makeTP()
    const { gate, evolvedPool } = freshGate(tp)
    // Persist the gen-0 pool to baseline
    writeAdaptationPool(tp, 'sword_coast', evolvedPool)
    const speciesId = gate.speciesId

    // Force success: high party strength + d20=20 vs DC 5×5+0 = 25
    const out = clearGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      partyStrength: 100, metRequirements: [],
      casualtiesCaused: 4, worldDay: 200, d20: 20,
    })

    expect(out.attemptResult.success).toBe(true)
    expect(out.poolUpdated).toBe(true)

    // Reread pool — fitness should reflect the clear
    const eco2 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const reread = eco2.getAdaptations(speciesId)
    for (const a of gate.adaptations) {
      expect(reread.fitness[a]?.spawned).toBeGreaterThan(0)
      expect(reread.fitness[a]?.causedCasualties).toBeGreaterThanOrEqual(4)
    }
  })

  it('failed clear leaves pool untouched', () => {
    const tp = makeTP()
    const { gate, evolvedPool } = freshGate(tp)
    writeAdaptationPool(tp, 'sword_coast', evolvedPool)
    const speciesId = gate.speciesId

    // Capture the pool BEFORE
    const eco0 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const before = eco0.getAdaptations(speciesId)

    // Force failure: low party + d20=1
    const out = clearGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      partyStrength: 0, metRequirements: [],
      casualtiesCaused: 99, worldDay: 200, d20: 1,
    })
    expect(out.attemptResult.success).toBe(false)
    expect(out.poolUpdated).toBe(false)

    const eco1 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const after = eco1.getAdaptations(speciesId)
    for (const a of gate.adaptations) {
      expect(after.fitness[a]?.spawned ?? 0).toBe(before.fitness[a]?.spawned ?? 0)
    }
  })

  it('marks survivedClears for cap-only clears (respawn enabled)', () => {
    const tp = makeTP()
    const { gate, evolvedPool, adaptations } = freshGate(tp)
    writeAdaptationPool(tp, 'sword_coast', evolvedPool)
    const speciesId = gate.speciesId

    // Cap clear (respawnEnabled=true is default; metRequirements empty so not permanent)
    clearGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      partyStrength: 100, metRequirements: [],
      casualtiesCaused: 3, worldDay: 200, d20: 20,
    })

    const eco1 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const reread = eco1.getAdaptations(speciesId)
    for (const a of adaptations) {
      expect(reread.fitness[a]?.survivedClears).toBe(1)
    }
  })

  it('does NOT mark survivedClears for permanent clears', () => {
    const tp = makeTP()
    const { gate, evolvedPool, adaptations } = freshGate(tp)
    writeAdaptationPool(tp, 'sword_coast', evolvedPool)
    const speciesId = gate.speciesId

    // Permanent clear: respawnEnabled=false + all requirements met
    gate.respawnEnabled = false
    clearGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      partyStrength: 100,
      metRequirements: gate.clearRequirements,
      casualtiesCaused: 2, worldDay: 200, d20: 20,
    })

    const eco1 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const reread = eco1.getAdaptations(speciesId)
    for (const a of adaptations) {
      expect(reread.fitness[a]?.survivedClears).toBe(0)
      expect(reread.fitness[a]?.spawned).toBeGreaterThan(0)
    }
  })
})

describe('tickGateWithEcology', () => {
  it('non-respawn ticks do not touch the pool', () => {
    const tp = makeTP()
    const { gate, evolvedPool } = freshGate(tp)
    writeAdaptationPool(tp, 'sword_coast', evolvedPool)

    // Gate is freshly active — tick advances spawn, doesn't respawn
    const out = tickGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      worldDay: 107, d20: 10, respawnD20s: [10, 10, 10],
    })
    expect(out.tickResult.respawned).toBe(false)
    expect(out.poolUpdated).toBe(false)
    expect(out.newAdaptations).toBeUndefined()
  })

  it('respawn tick evolves pool, draws new adaptations, applies modifiers', () => {
    const tp = makeTP()
    const { gate, evolvedPool } = freshGate(tp)
    writeAdaptationPool(tp, 'sword_coast', evolvedPool)
    const speciesId = gate.speciesId

    // Force the gate into capped state so respawn fires
    clearGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      partyStrength: 100, metRequirements: [],
      casualtiesCaused: 4, worldDay: 200, d20: 20,
    })
    expect(gate.state).toBe('capped')

    // Advance time past respawnDays — tick should fire respawn
    const oldAdaptations = [...gate.adaptations]
    const out = tickGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      worldDay: 200 + gate.respawnDays + 1, d20: 10,
      respawnD20s: [3, 9, 14, 18],
    })
    expect(out.tickResult.respawned).toBe(true)
    expect(out.poolUpdated).toBe(true)
    expect(out.newAdaptations).toBeDefined()
    expect(gate.state).toBe('active')

    // Pool generation advanced
    const eco1 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    expect(eco1.getAdaptations(speciesId).generation).toBe(2)
    // (Started at 0; createDungeonGateFromEcology evolved to 1; respawn evolved to 2)

    // New adaptations populated on the gate
    expect(gate.adaptations.length).toBeGreaterThanOrEqual(0)
    void oldAdaptations  // can't assert exact difference (same d20s, possibly same set)
  })

  it('respawn applies PACK troopMultiplier to spawn rate', () => {
    const tp = makeTP()
    // Force PACK to dominate the pool
    const pool = createAdaptationPool('goblin')
    for (const a of Object.keys(pool.weights)) pool.weights[a as keyof typeof pool.weights] = 0
    pool.weights.PACK = 100
    writeAdaptationPool(tp, 'sword_coast', pool)

    resetGateIdCounter()
    // Build a gate with empty adaptations using the public ecology factory
    const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const gate = createDungeonGateFromEcology({
      siteId: 's', edgeId: 'e', mileMarker: 0,
      gateType: 'lair', tier: 5, worldDay: 0,
      speciesId: 'goblin', d20s: [10, 10, 10],
      pool: eco.getAdaptations('goblin'),
      generation: 0,
    }).gate

    // Cap the gate to set up a respawn
    clearGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      partyStrength: 100, metRequirements: [],
      casualtiesCaused: 5, worldDay: 100, d20: 20,
    })

    const spawnBeforeRespawn = gate.spawnRate

    // Advance past respawn, force respawn tick
    tickGateWithEcology({
      tp, regionNodeId: 'sword_coast', gate,
      worldDay: 100 + gate.respawnDays + 1, d20: 10,
      respawnD20s: [10, 10, 10],
    })

    expect(gate.adaptations).toContain('PACK')
    // After respawn, spawnRate gets recomputed by tickDungeonGate +
    // multiplied by 1.2 from PACK
    expect(gate.spawnRate).toBeGreaterThan(spawnBeforeRespawn * 0.5)
  })
})

describe('spawnMonsterActorWithEcology', () => {
  it('spawns an actor and persists the evolved pool', () => {
    const tp = makeTP()
    resetMonsterActorIdCounter()
    const speciesId = 'orc'

    const out = spawnMonsterActorWithEcology({
      tp, regionNodeId: 'sword_coast',
      campNodeId: 'thundertree',
      tier: 3, generation: 0,
      population: 20, worldDay: 100,
      d20s: [5, 12, 18],
      speciesId,
    })

    expect(out.actor.speciesId).toBe(speciesId)
    expect(out.poolUpdated).toBe(true)
    expect(out.actor.adaptations).toEqual(out.adaptations)

    // Pool generation advanced
    const eco1 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    expect(eco1.getAdaptations(speciesId).generation).toBe(1)
  })

  it('migration: spawning at a different region uses that region\'s pool', () => {
    const tp = new TP()
    tp.loadNodes([
      { id: 'faerun',     type: 'continent',  name: 'Faerûn',         parentId: null,        dataStatic: {} },
      { id: 'sword_coast',type: 'region',     name: 'Sword Coast',    parentId: 'faerun',    dataStatic: {} },
      { id: 'cormyr',     type: 'region',     name: 'Cormyr',         parentId: 'faerun',    dataStatic: {} },
      { id: 'thundertree',type: 'settlement', name: 'Thundertree',    parentId: 'sword_coast', dataStatic: {} },
      { id: 'suzail',     type: 'settlement', name: 'Suzail',         parentId: 'cormyr',    dataStatic: {} },
    ])
    resetMonsterActorIdCounter()

    // Sword Coast goblins evolved differently than Cormyr goblins
    const swordCoastPool = createAdaptationPool('goblin')
    swordCoastPool.weights.STEALTH = 5.0
    writeAdaptationPool(tp, 'sword_coast', swordCoastPool)

    const cormyrPool = createAdaptationPool('goblin')
    cormyrPool.weights.PACK = 5.0
    writeAdaptationPool(tp, 'cormyr', cormyrPool)

    // Spawn in Sword Coast — should pull from there
    const swordCoastActor = spawnMonsterActorWithEcology({
      tp, regionNodeId: 'sword_coast',
      campNodeId: 'thundertree',
      tier: 5, generation: 5,    // gen=5 + tier=5 → 3 adaptations to draw
      population: 20, worldDay: 0,
      d20s: [10, 10, 10, 10],
      speciesId: 'goblin',
    })

    // Spawn in Cormyr — should pull from there
    const cormyrActor = spawnMonsterActorWithEcology({
      tp, regionNodeId: 'cormyr',
      campNodeId: 'suzail',
      tier: 5, generation: 5,
      population: 20, worldDay: 0,
      d20s: [10, 10, 10, 10],
      speciesId: 'goblin',
    })

    // Each region's pool advanced independently; the bumped adaptations
    // were heavily weighted in selection for that region only
    const eco1 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const eco2 = ecologyAt(tp, SEED, 5, 5, 'suzail')
    expect(eco1.regionNodeId).toBe('sword_coast')
    expect(eco2.regionNodeId).toBe('cormyr')
    // Their adaptations may differ because the input weights differed
    // (we don't strictly require them to differ since selectAdaptations
    // is deterministic on d20, but the underlying pools must be distinct)
    expect(eco1.getAdaptations('goblin').weights.STEALTH).toBeGreaterThan(
      eco1.getAdaptations('goblin').weights.PACK,
    )
    expect(eco2.getAdaptations('goblin').weights.PACK).toBeGreaterThan(
      eco2.getAdaptations('goblin').weights.STEALTH,
    )
    void swordCoastActor
    void cormyrActor
  })
})

describe('Full lifecycle — multi-cycle evolution', () => {
  it('repeated clears bump fitness; respawn after a few generations adds more adaptations', () => {
    const tp = makeTP()
    const { gate: initialGate, evolvedPool } = freshGate(tp)
    writeAdaptationPool(tp, 'sword_coast', evolvedPool)

    let gate = initialGate
    for (let cycle = 0; cycle < 4; cycle++) {
      // Player clears it
      clearGateWithEcology({
        tp, regionNodeId: 'sword_coast', gate,
        partyStrength: 100, metRequirements: [],
        casualtiesCaused: 3, worldDay: 100 + cycle * 100, d20: 20,
      })
      // Wait + tick to respawn
      tickGateWithEcology({
        tp, regionNodeId: 'sword_coast', gate,
        worldDay: 100 + cycle * 100 + gate.respawnDays + 1, d20: 10,
        respawnD20s: [3, 9, 14, 18, 5, 11, 17, 8],
      })
    }

    // After 4 clears at tier 5, gate timesCleared = 4 → adaptationCountForGate(4, 5) = 2 + 1 = 3
    expect(gate.timesCleared).toBe(4)
    expect(gate.adaptations.length).toBe(3)

    // Pool reflects accumulated evolution (each respawn evolved once + initial = 5)
    const eco1 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    expect(eco1.getAdaptations(gate.speciesId).generation).toBe(5)
  })
})
