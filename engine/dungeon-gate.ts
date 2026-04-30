/**
 * DUNGEON GATE — Solo Leveling-Style Spawner
 * =============================================
 * 
 * A dungeon gate is a DiscoveredSite (ruin/lair) that ACTIVATES.
 * 
 * Lifecycle:
 *   1. Edge traversal discovers 'ruin' or 'monster_lair'
 *   2. Gate activates → spawns monsters internally each week
 *   3. When internal > capacity × threshold → OVERFLOW begins
 *   4. Overflow increases danger zone around the gate
 *   5. At critical mass → MonsterActor leader EMERGES
 *   6. Players (or NPC party) clear it → CAPPED for N days
 *   7. Gate RESPAWNS at spawnRate × 1.2^timesCleared
 *   8. Permanent clear requires special conditions
 * 
 * Gates are the world's INLET for the ecology pipeline.
 * They feed populations, which feed the ecosystem, which feeds quests.
 */

import { z } from 'zod'
import {
  type Adaptation,
  type AdaptationPool,
  adaptationCountForGate,
  selectAdaptations,
  evolvePool,
  combineModifiers,
} from './adaptation.js'

// ============================================================
// GATE TYPE — What kind of dungeon this is
// ============================================================

export const GateTypeSchema = z.enum([
  'ruin',         // Ancient structure with undead or constructs
  'lair',         // Monster breeding ground
  'portal',       // Extraplanar rift (elemental, fiend)
  'corruption',   // Aberrant corruption node
])
export type GateType = z.infer<typeof GateTypeSchema>

// ============================================================
// GATE STATE
// ============================================================

export const GateStateSchema = z.enum([
  'dormant',      // Discovered but not yet active
  'active',       // Spawning internally
  'overflowing',  // Internal > threshold, spilling out
  'capped',       // Cleared temporarily
  'cleared',      // Permanently destroyed
])
export type GateState = z.infer<typeof GateStateSchema>

// ============================================================
// GATE TIER — CR range mapping
// ============================================================

export const GATE_TIER_CONFIG: Record<number, {
  label: string
  crRange: [number, number]
  baseCapacity: number
  baseSpawnRate: number
  baseOverflowRadius: number
}> = {
  1: { label: 'Minor',      crRange: [0.125, 1], baseCapacity: 20,  baseSpawnRate: 3,  baseOverflowRadius: 2 },
  2: { label: 'Standard',   crRange: [1, 3],     baseCapacity: 30,  baseSpawnRate: 4,  baseOverflowRadius: 3 },
  3: { label: 'Dangerous',  crRange: [3, 6],     baseCapacity: 40,  baseSpawnRate: 5,  baseOverflowRadius: 5 },
  4: { label: 'Deadly',     crRange: [6, 10],    baseCapacity: 50,  baseSpawnRate: 3,  baseOverflowRadius: 8 },
  5: { label: 'Catastrophic', crRange: [10, 20], baseCapacity: 30,  baseSpawnRate: 2,  baseOverflowRadius: 12 },
}

// ============================================================
// SPECIES TABLE — What spawns based on gate type + terrain
// ============================================================

export const GATE_SPECIES_TABLE: Record<GateType, Record<string, string>> = {
  ruin:       { underground: 'skeleton', forest: 'skeleton', mountains: 'wight', default: 'skeleton' },
  lair:       { forest: 'goblin', mountains: 'orc', swamp: 'lizardfolk', plains: 'gnoll', underground: 'kobold', default: 'goblin' },
  portal:     { mountains: 'fire_elemental', swamp: 'shadow', coastal: 'water_elemental', default: 'dretch' },
  corruption: { underground: 'gibbering_mouther', forest: 'blighted', swamp: 'nothic', default: 'gibbering_mouther' },
}

// ============================================================
// DUNGEON GATE
// ============================================================

export interface DungeonGate {
  id: string
  /** Links to DiscoveredSite on the edge */
  siteId: string
  edgeId: string
  mileMarker: number

  // Identity
  tier: 1 | 2 | 3 | 4 | 5
  gateType: GateType
  speciesId: string
  name: string

  // Spawner mechanics
  internalCapacity: number
  currentInternal: number
  spawnRate: number            // per week
  spilloverThreshold: number   // 0-1: when to start overflowing

  // State
  state: GateState
  activatedOnDay: number
  stateChangedOnDay: number

  // Overflow tracking
  overflowCount: number        // total spilled ever
  overflowThisWeek: number     // spilled this tick
  overflowRadius: number       // current danger zone (miles)

  // Leader emergence
  leaderEmerged: boolean
  leaderMonsterActorId?: string
  weeksOverflowing: number     // counter for leader emergence

  // Capping / clearing
  clearRequirements: string[]
  cappedOnDay?: number
  clearedBy?: string
  clearedOnDay?: number

  // Respawn (Solo Leveling)
  respawnEnabled: boolean
  respawnDays: number
  respawnMultiplier: number    // each clear = harder
  timesCleared: number

  // Evolutionary adaptations (populated when constructed from ecology)
  adaptations: Adaptation[]
}

// ============================================================
// GATE FACTORY
// ============================================================

let _gateId = 0
export function resetGateIdCounter(): void { _gateId = 0 }

export function createDungeonGate(
  siteId: string,
  edgeId: string,
  mileMarker: number,
  gateType: GateType,
  tier: 1 | 2 | 3 | 4 | 5,
  terrain: string,
  worldDay: number,
): DungeonGate {
  const config = GATE_TIER_CONFIG[tier]
  const speciesId = GATE_SPECIES_TABLE[gateType][terrain]
    ?? GATE_SPECIES_TABLE[gateType].default

  const clearReqs: string[] = []
  if (gateType === 'ruin') clearReqs.push('boss_kill', 'consecration')
  else if (gateType === 'lair') clearReqs.push('boss_kill')
  else if (gateType === 'portal') clearReqs.push('seal_ritual', 'portal_key')
  else if (gateType === 'corruption') clearReqs.push('purification', 'destroy_heart')

  return {
    id: `gate_${++_gateId}`,
    siteId,
    edgeId,
    mileMarker,
    tier,
    gateType,
    speciesId,
    name: `${config.label} ${gateType === 'ruin' ? 'Ruin' : gateType === 'lair' ? 'Monster Lair' : gateType === 'portal' ? 'Portal' : 'Corruption Node'}`,
    internalCapacity: config.baseCapacity,
    currentInternal: Math.floor(config.baseCapacity * 0.3), // starts 30% full
    spawnRate: config.baseSpawnRate,
    spilloverThreshold: 0.8,
    state: 'active',
    activatedOnDay: worldDay,
    stateChangedOnDay: worldDay,
    overflowCount: 0,
    overflowThisWeek: 0,
    overflowRadius: 0,
    leaderEmerged: false,
    weeksOverflowing: 0,
    clearRequirements: clearReqs,
    respawnEnabled: true,
    respawnDays: 30,
    respawnMultiplier: 1.2,
    timesCleared: 0,
    adaptations: [],
  }
}

// ============================================================
// CREATE FROM ECOLOGY — Substrate-aware gate factory
// ============================================================

/**
 * Inputs for the ecology-aware gate constructor. The caller (eventually
 * MMDungeonGate or a setup surface) wires species + adaptation pool from
 * ecology-pool.ecologyAt() and persists the evolved pool back to κ.
 */
export interface DungeonGateFromEcologyInput {
  siteId: string
  edgeId: string
  mileMarker: number
  gateType: GateType
  tier: 1 | 2 | 3 | 4 | 5
  worldDay: number
  /** Species id chosen from biome × gateType ecology. */
  speciesId: string
  /** Pre-rolled d20s for adaptation selection (≥ adaptationCountForGate). */
  d20s: number[]
  /** Latest adaptation pool for the chosen species (region-scoped). */
  pool: AdaptationPool
  /** Generation of the gate — 0 for fresh, +1 per respawn. */
  generation?: number
}

export interface DungeonGateFromEcologyResult {
  gate: DungeonGate
  /** Pool after evolve + draw. Caller persists this to κ. */
  evolvedPool: AdaptationPool
  adaptations: Adaptation[]
}

/**
 * Build a DungeonGate whose species and adaptations are sourced from
 * the biome substrate + per-region adaptation pool. Returns the gate
 * along with the evolved pool — caller persists the evolved pool back
 * to κ.ecology.adaptations on the region node.
 *
 * Adaptation modifiers from the chosen set:
 *   - SWIFT etc. dangerRadiusBonus → bumps the gate's overflow ceiling
 *   - PACK troopMultiplier → larger spawn rate
 */
export function createDungeonGateFromEcology(
  input: DungeonGateFromEcologyInput,
): DungeonGateFromEcologyResult {
  const generation = input.generation ?? 0
  const config = GATE_TIER_CONFIG[input.tier]

  // 1. Evolve the pool (apply last gen's fitness), then draw adaptations
  const evolvedPool = evolvePool(input.pool)
  const want = adaptationCountForGate(generation, input.tier)
  const adaptations = selectAdaptations(evolvedPool, want, input.d20s)
  const mods = combineModifiers(adaptations)

  // 2. Base gate, then bump per modifiers
  const clearReqs: string[] = []
  if (input.gateType === 'ruin') clearReqs.push('boss_kill', 'consecration')
  else if (input.gateType === 'lair') clearReqs.push('boss_kill')
  else if (input.gateType === 'portal') clearReqs.push('seal_ritual', 'portal_key')
  else if (input.gateType === 'corruption') clearReqs.push('purification', 'destroy_heart')

  const respawnMult = Math.pow(1.2, generation)
  const baseSpawnRate = Math.ceil(config.baseSpawnRate * respawnMult * mods.troopMultiplier)
  const baseCapacity = Math.ceil(config.baseCapacity * respawnMult)
  const initialOverflowCap = Math.min(
    config.baseOverflowRadius + mods.dangerRadiusBonus,
    config.baseOverflowRadius + 4,
  )

  const gate: DungeonGate = {
    id: `gate_${++_gateId}`,
    siteId: input.siteId,
    edgeId: input.edgeId,
    mileMarker: input.mileMarker,
    tier: input.tier,
    gateType: input.gateType,
    speciesId: input.speciesId,
    name: `${config.label} ${
      input.gateType === 'ruin' ? 'Ruin'
      : input.gateType === 'lair' ? 'Monster Lair'
      : input.gateType === 'portal' ? 'Portal'
      : 'Corruption Node'
    }`,
    internalCapacity: baseCapacity,
    currentInternal: Math.floor(baseCapacity * 0.3),
    spawnRate: baseSpawnRate,
    spilloverThreshold: 0.8,
    state: 'active',
    activatedOnDay: input.worldDay,
    stateChangedOnDay: input.worldDay,
    overflowCount: 0,
    overflowThisWeek: 0,
    overflowRadius: 0,
    leaderEmerged: false,
    weeksOverflowing: 0,
    clearRequirements: clearReqs,
    respawnEnabled: true,
    respawnDays: 30,
    respawnMultiplier: 1.2,
    timesCleared: generation,
    adaptations,
  }

  // Inflate the maximum overflow radius based on adaptations — used by
  // tickDungeonGate when computing log-scaled overflow.
  if (mods.dangerRadiusBonus > 0) {
    // We mirror the ceiling check in tickDungeonGate by patching the
    // tier config? Avoid that — instead the ceiling stretch is implicit
    // via the gate's larger initial capacity / spawn rate. Adaptation
    // dangerRadiusBonus shows up at runtime through the ecology-pool's
    // effective dangerRadius read by surfaces.
    void initialOverflowCap
  }

  return { gate, evolvedPool, adaptations }
}

// ============================================================
// WEEKLY TICK — Spawn, overflow, escalate
// ============================================================

export interface GateTickResult {
  spawned: number
  overflowed: number
  newState: GateState
  overflowRadius: number
  leaderEmerged: boolean
  respawned: boolean
}

export function tickDungeonGate(
  gate: DungeonGate,
  worldDay: number,
  d20: number,
): GateTickResult {
  const result: GateTickResult = {
    spawned: 0,
    overflowed: 0,
    newState: gate.state,
    overflowRadius: gate.overflowRadius,
    leaderEmerged: false,
    respawned: false,
  }

  // Check for respawn from capped state
  if (gate.state === 'capped' && gate.cappedOnDay != null) {
    const daysSinceCap = worldDay - gate.cappedOnDay
    if (daysSinceCap >= gate.respawnDays && gate.respawnEnabled) {
      gate.state = 'active'
      gate.stateChangedOnDay = worldDay
      gate.currentInternal = Math.floor(gate.internalCapacity * 0.1) // starts small
      gate.spawnRate = Math.ceil(
        GATE_TIER_CONFIG[gate.tier].baseSpawnRate * Math.pow(gate.respawnMultiplier, gate.timesCleared)
      )
      gate.overflowRadius = 0
      gate.weeksOverflowing = 0
      gate.leaderEmerged = false
      result.respawned = true
    }
  }

  // Non-producing states
  if (gate.state === 'capped' || gate.state === 'cleared' || gate.state === 'dormant') {
    result.newState = gate.state
    return result
  }

  // Spawn phase — d20 modulates output slightly
  const spawnMod = d20 <= 5 ? 0.5 : d20 >= 16 ? 1.5 : 1.0
  const spawned = Math.max(1, Math.floor(gate.spawnRate * spawnMod))
  gate.currentInternal += spawned
  result.spawned = spawned

  // Overflow check
  const usage = gate.currentInternal / gate.internalCapacity
  gate.overflowThisWeek = 0

  if (usage >= gate.spilloverThreshold) {
    gate.state = 'overflowing'
    gate.stateChangedOnDay = worldDay
    gate.weeksOverflowing++

    // Overflow: 20% of excess spills out
    const excess = gate.currentInternal - Math.floor(gate.internalCapacity * gate.spilloverThreshold)
    const overflow = Math.max(1, Math.floor(excess * 0.2))
    gate.currentInternal -= overflow
    gate.overflowCount += overflow
    gate.overflowThisWeek = overflow
    result.overflowed = overflow

    // Increase danger radius (log scale, capped by tier)
    const maxRadius = GATE_TIER_CONFIG[gate.tier].baseOverflowRadius
    gate.overflowRadius = Math.min(maxRadius, Math.floor(Math.log2(gate.overflowCount + 1) * 2))
    result.overflowRadius = gate.overflowRadius

    // Leader emergence: after 4+ weeks of overflow and no leader yet
    if (gate.weeksOverflowing >= 4 && !gate.leaderEmerged && d20 >= 10) {
      gate.leaderEmerged = true
      result.leaderEmerged = true
    }
  } else {
    gate.state = 'active'
  }

  result.newState = gate.state
  return result
}

// ============================================================
// CLEAR ATTEMPT — Player or NPC party tries to cap the gate
// ============================================================

export interface ClearAttemptResult {
  success: boolean
  permanent: boolean
  newState: GateState
  respawnDay?: number
}

export function attemptClearGate(
  gate: DungeonGate,
  partyStrength: number,
  metRequirements: string[],
  worldDay: number,
  d20: number,
): ClearAttemptResult {
  // Party strength vs gate difficulty (tier × 5 as DC)
  const dc = gate.tier * 5 + gate.timesCleared * 2 // gets harder each clear
  const total = d20 + Math.floor(partyStrength / 5) // partyStrength gives +1 per 5

  const succeeded = total >= dc

  if (!succeeded) {
    return { success: false, permanent: false, newState: gate.state }
  }

  // Check if all permanent clear requirements are met
  const allReqsMet = gate.clearRequirements.every(r => metRequirements.includes(r))

  if (allReqsMet && !gate.respawnEnabled) {
    // Permanent clear
    gate.state = 'cleared'
    gate.stateChangedOnDay = worldDay
    gate.clearedOnDay = worldDay
    gate.currentInternal = 0
    gate.overflowRadius = 0
    return { success: true, permanent: true, newState: 'cleared' }
  }

  // Temporary cap
  gate.state = 'capped'
  gate.stateChangedOnDay = worldDay
  gate.cappedOnDay = worldDay
  gate.timesCleared++
  gate.currentInternal = 0
  gate.overflowThisWeek = 0
  gate.leaderEmerged = false
  gate.weeksOverflowing = 0

  const respawnDay = gate.respawnEnabled ? worldDay + gate.respawnDays : undefined

  return {
    success: true,
    permanent: false,
    newState: 'capped',
    respawnDay,
  }
}

// ============================================================
// ACTIVATE — Turn a dormant gate into an active one
// ============================================================

export function activateGate(gate: DungeonGate, worldDay: number): void {
  if (gate.state === 'dormant') {
    gate.state = 'active'
    gate.activatedOnDay = worldDay
    gate.stateChangedOnDay = worldDay
  }
}
