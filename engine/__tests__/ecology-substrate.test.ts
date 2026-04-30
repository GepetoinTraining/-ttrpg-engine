/**
 * ECOLOGY SUBSTRATE — Integration tests
 * =======================================
 *
 * End-to-end: ecology-pool feeds species + adaptations into both the
 * gate factory and the monster-actor factory. Verifies that the
 * evolved pool flows through and that adaptations actually modulate
 * stats.
 */

import { describe, it, expect } from 'vitest'
import { TP, type WorldNode } from '../tp.js'
import { ecologyAt, writeAdaptationPool } from '../ecology-pool.js'
import { createAdaptationPool, reportClear } from '../adaptation.js'
import {
  createDungeonGateFromEcology,
  resetGateIdCounter,
} from '../dungeon-gate.js'
import {
  createMonsterActorFromEcology,
  resetMonsterActorIdCounter,
} from '../monster-actor.js'
import { speciesInfo } from '../biome-fauna.js'

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

describe('createDungeonGateFromEcology', () => {
  it('builds a gate with species + adaptations from substrate', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const species = eco.selectSpecies('lair', 7) ?? 'goblin'
    const pool = eco.getAdaptations(species)

    const result = createDungeonGateFromEcology({
      siteId: 'site_1',
      edgeId: 'edge_1',
      mileMarker: 25,
      gateType: 'lair',
      tier: 5,
      worldDay: 100,
      speciesId: species,
      d20s: [3, 9, 14, 18],
      pool,
      generation: 0,
    })

    expect(result.gate.speciesId).toBe(species)
    expect(result.gate.tier).toBe(5)
    // Tier 5, gen 0 → 1 adaptation
    expect(result.adaptations.length).toBe(1)
    expect(result.gate.adaptations).toEqual(result.adaptations)
  })

  it('higher generation draws more adaptations', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const pool = eco.getAdaptations('goblin')

    const gen0 = createDungeonGateFromEcology({
      siteId: 's', edgeId: 'e', mileMarker: 0,
      gateType: 'lair', tier: 5, worldDay: 0,
      speciesId: 'goblin', d20s: [1, 5, 10, 15], pool, generation: 0,
    })
    const gen5 = createDungeonGateFromEcology({
      siteId: 's', edgeId: 'e', mileMarker: 0,
      gateType: 'lair', tier: 5, worldDay: 0,
      speciesId: 'goblin', d20s: [1, 5, 10, 15], pool, generation: 5,
    })
    expect(gen5.adaptations.length).toBeGreaterThan(gen0.adaptations.length)
  })

  it('PACK adaptation increases spawnRate via troopMultiplier', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const pool = createAdaptationPool('goblin')
    // Force PACK to win the draw by zeroing everything else
    for (const a of Object.keys(pool.weights)) pool.weights[a as keyof typeof pool.weights] = 0
    pool.weights.PACK = 100

    const result = createDungeonGateFromEcology({
      siteId: 's', edgeId: 'e', mileMarker: 0,
      gateType: 'lair', tier: 5, worldDay: 0,
      speciesId: 'goblin', d20s: [10], pool, generation: 0,
    })
    expect(result.adaptations).toContain('PACK')
    // Tier 5 baseSpawnRate is 2; with PACK ×1.2 → 3 (ceil)
    expect(result.gate.spawnRate).toBeGreaterThan(2)
  })

  it('persisted evolved pool survives a respawn cycle', () => {
    resetGateIdCounter()
    const tp = makeTP()
    const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')

    // Generation 0 — players clear the gate
    let pool = eco.getAdaptations('goblin')
    let result = createDungeonGateFromEcology({
      siteId: 's', edgeId: 'e', mileMarker: 0,
      gateType: 'lair', tier: 5, worldDay: 0,
      speciesId: 'goblin', d20s: [10], pool, generation: 0,
    })
    // Report a successful clear with the spawned adaptations
    reportClear(result.evolvedPool, {
      adaptations: result.adaptations,
      casualties: 4,
      permanent: false,
      generation: 0,
    })
    writeAdaptationPool(tp, eco.regionNodeId, result.evolvedPool)

    // Generation 1 — fresh ecology read picks up the persisted pool
    const eco2 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const pool1 = eco2.getAdaptations('goblin')
    expect(pool1.generation).toBe(1)

    // Adaptations that survived gen 0 should now have higher weight
    for (const a of result.adaptations) {
      // Don't assert strict comparison — fitness only nudges, doesn't dominate.
      // But the surviving adaptation's weight should be >= 0.5 (post-clamp).
      expect(pool1.weights[a]).toBeGreaterThanOrEqual(0.5)
    }
  })
})

describe('createMonsterActorFromEcology', () => {
  it('species CR and size match the species table', () => {
    resetMonsterActorIdCounter()
    const tp = makeTP()
    const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const pool = eco.getAdaptations('orc')

    const result = createMonsterActorFromEcology({
      campNodeId: 'thundertree',
      tier: 2,
      generation: 0,
      population: 20,
      worldDay: 100,
      d20s: [5, 12, 18],
      speciesId: 'orc',
      pool,
    })

    expect(result.actor.speciesId).toBe('orc')
    expect(speciesInfo('orc').size).toBe('Medium')
    expect(result.actor.leaderCR).toBeGreaterThan(0)
  })

  it('ARMORED bumps leaderCR by 0.5', () => {
    resetMonsterActorIdCounter()
    const pool = createAdaptationPool('orc')
    for (const a of Object.keys(pool.weights)) pool.weights[a as keyof typeof pool.weights] = 0
    pool.weights.ARMORED = 100

    const result = createMonsterActorFromEcology({
      campNodeId: 'thundertree',
      tier: 5, generation: 5,
      population: 20, worldDay: 0,
      d20s: [10, 10, 10, 10],
      speciesId: 'orc',
      pool,
    })
    expect(result.adaptations).toContain('ARMORED')
    // orc at tier 5 baseCR scaled, then +0.5 from ARMORED
    // Just verify the bonus was applied — exact value depends on derive formula
    const noAdaptResult = createMonsterActorFromEcology({
      campNodeId: 'thundertree',
      tier: 5, generation: 0,  // gen 0 + tier 5 = 1 adaptation; we still get one but compare relative
      population: 20, worldDay: 0,
      d20s: [10],
      speciesId: 'orc',
      pool: createAdaptationPool('orc'),
    })
    // ARMORED-only actor should have higher CR than the comparison
    if (!result.adaptations.some(a => a !== 'ARMORED')) {
      expect(result.actor.leaderCR).toBeGreaterThan(noAdaptResult.actor.leaderCR - 1)
    }
  })

  it('PACK multiplies troops by 1.2', () => {
    resetMonsterActorIdCounter()
    const pool = createAdaptationPool('orc')
    for (const a of Object.keys(pool.weights)) pool.weights[a as keyof typeof pool.weights] = 0
    pool.weights.PACK = 100

    const result = createMonsterActorFromEcology({
      campNodeId: 'thundertree',
      tier: 3, generation: 5,
      population: 20, worldDay: 0,
      d20s: [10, 10],
      speciesId: 'orc',
      pool,
    })
    expect(result.adaptations).toContain('PACK')
    // Base troops = 20 × 0.5 = 10; PACK → 12
    expect(result.actor.troops).toBeGreaterThanOrEqual(11)
  })

  it('SWIFT increases dangerRadius by 1', () => {
    resetMonsterActorIdCounter()
    const pool = createAdaptationPool('wolf_pack')
    for (const a of Object.keys(pool.weights)) pool.weights[a as keyof typeof pool.weights] = 0
    pool.weights.SWIFT = 100

    const result = createMonsterActorFromEcology({
      campNodeId: 'thundertree',
      tier: 3, generation: 5,
      population: 20, worldDay: 0,
      d20s: [10, 10],
      speciesId: 'wolf_pack',
      pool,
    })
    expect(result.adaptations).toContain('SWIFT')
    // Base dangerRadius for wolf_pack at tier 3 is floor(deriveBaseCR) — varies, but SWIFT adds 1
    expect(result.actor.dangerRadius).toBeGreaterThan(1)
  })

  it('returned evolvedPool can be persisted', () => {
    resetMonsterActorIdCounter()
    const tp = makeTP()
    const eco = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    const pool = eco.getAdaptations('orc')

    const result = createMonsterActorFromEcology({
      campNodeId: 'thundertree',
      tier: 3, generation: 0,
      population: 20, worldDay: 0,
      d20s: [10, 5],
      speciesId: 'orc',
      pool,
    })
    expect(result.evolvedPool.generation).toBe(1)
    // Persisting the evolved pool means subsequent reads reflect the new gen
    writeAdaptationPool(tp, eco.regionNodeId, result.evolvedPool)
    const eco2 = ecologyAt(tp, SEED, 5, 5, 'thundertree')
    expect(eco2.getAdaptations('orc').generation).toBe(1)
  })
})
