/**
 * DUNGEON MF — Seeder Loop + MM Stamp Function
 * ================================================
 * 
 * A dungeon is a POTENTIAL that resolves into rooms.
 * 
 * The seeder loop is the dungeon's DNA — a deterministic
 * sequence of normalized values. No content selection.
 * Only three dimensions per seed:
 * 
 *   layout    (0-1) → room shape/size/connections
 *   loot      (0-1) → treasure density
 *   challenge (0-1) → difficulty relative to dungeon tier
 * 
 * The MM function (stampRoom) transforms one seed into
 * a concrete room, consuming potential from the dungeon.
 * 
 * When potential hits 0, the dungeon is fully generated.
 * 
 * MF Pattern:
 *   GRIND  → generate seeder loop from gate params
 *   SELECT → stamp seeds into rooms on observation
 *   REFILL → respawn adds new seeds at 1.2× difficulty
 * 
 * Why this is pure logic:
 *   - Same gate params → same seeder → same rooms (deterministic)
 *   - No random calls during generation
 *   - All "randomness" comes from the d20 seed input
 *   - The seeder IS the pre-computed potential
 */

import { z } from 'zod'

// ============================================================
// ROOM SEED — One iteration of the seeder loop
// ============================================================

export interface RoomSeed {
  /** Index in the loop (0 = entrance, last = boss) */
  index: number
  /** Room shape/size/connection weight (0-1) */
  layout: number
  /** Treasure density (0-1, 0 = empty, 1 = hoard) */
  loot: number
  /** Challenge fraction relative to dungeon (0-1, 1 = boss-level) */
  challenge: number
  /** How much dungeon potential this seed consumes (0-1) */
  potentialCost: number
}

// ============================================================
// DUNGEON SEEDER — The full loop
// ============================================================

export interface DungeonSeeder {
  /** Gate this seeder was generated from */
  gateId: string
  /** Dungeon tier (determines absolute scale) */
  tier: 1 | 2 | 3 | 4 | 5
  /** Gate type (determines flavor) */
  gateType: 'ruin' | 'lair' | 'portal' | 'corruption'
  /** Species that populates this dungeon */
  speciesId: string
  /** Generation number (0 = first, +1 per respawn) */
  generation: number
  
  /** The loop — deterministic sequence of room seeds */
  seeds: RoomSeed[]
  /** Total potential (all seeds sum to 1.0) */
  totalPotential: number
  /** Remaining potential (decreases as rooms are stamped) */
  remainingPotential: number
  /** How many seeds have been consumed */
  stamped: number
  
  /** Absolute scaling factors (applied during stamp) */
  encounterBudget: number   // Total CR available
  lootBudget: number        // Total GP available
  baseDC: number            // Base difficulty class
  respawnMultiplier: number  // 1.2^generation
}

// ============================================================
// STAMPED ROOM — Output of the MM function
// ============================================================

export interface StampedRoom {
  seedIndex: number
  /** Room classification derived from seed.layout */
  roomType: 'entrance' | 'corridor' | 'chamber' | 'trap_room' | 'treasure' | 'shrine' | 'miniboss' | 'boss'
  /** Room size derived from seed.layout */
  size: 'small' | 'medium' | 'large' | 'huge'
  /** Number of exits (1-3, from layout) */
  exitCount: number
  
  /** Encounter: CR allocated from seed.challenge × encounterBudget fraction */
  encounterCR: number
  /** Monster count (derived from challenge distribution) */
  monsterCount: number
  /** Can the encounter be avoided? */
  avoidable: boolean
  
  /** Loot GP allocated from seed.loot × lootBudget fraction */
  lootGP: number
  /** Is loot hidden? */
  lootHidden: boolean
  /** Is loot trapped? */
  lootTrapped: boolean
  
  /** Trap present? (from challenge curve) */
  hasTrap: boolean
  /** Trap DC if present */
  trapDC: number
  
  /** Puzzle present? (from layout extremes) */
  hasPuzzle: boolean
  /** Puzzle bypass DC */
  puzzleDC: number
  /** Is puzzle required to proceed? */
  puzzleRequired: boolean
  
  /** Lighting condition (from gate type + layout) */
  lighting: 'bright' | 'dim' | 'dark' | 'magical'
  
  /** How much potential was consumed */
  potentialConsumed: number
}

// ============================================================
// TIER TABLES — Absolute scaling
// ============================================================

const TIER_BUDGET: Record<number, { cr: number; gp: number; baseDC: number }> = {
  1: { cr: 6,   gp: 50,    baseDC: 12 },
  2: { cr: 15,  gp: 150,   baseDC: 14 },
  3: { cr: 30,  gp: 500,   baseDC: 16 },
  4: { cr: 50,  gp: 1500,  baseDC: 18 },
  5: { cr: 80,  gp: 5000,  baseDC: 20 },
}

const TIER_ROOM_RANGE: Record<number, [number, number]> = {
  1: [3, 5],
  2: [4, 7],
  3: [6, 9],
  4: [7, 11],
  5: [8, 13],
}

// ============================================================
// SEEDER GENERATION — GRIND phase
// ============================================================

/**
 * Generate a dungeon seeder loop from gate parameters.
 * 
 * This is pure deterministic math — the d20Seed determines
 * everything. Same inputs → same seeder → same dungeon.
 * 
 * The key insight: we use a simple hash-like function to
 * distribute seeds across the (layout, loot, challenge) space.
 * No randomness, just modular arithmetic.
 */
export function generateSeeder(
  gateId: string,
  tier: 1 | 2 | 3 | 4 | 5,
  gateType: 'ruin' | 'lair' | 'portal' | 'corruption',
  speciesId: string,
  generation: number,
  /** Single d20 seed that drives everything */
  d20Seed: number,
): DungeonSeeder {
  const respawnMult = Math.pow(1.2, generation)
  const budget = TIER_BUDGET[tier]
  const [minRooms, maxRooms] = TIER_ROOM_RANGE[tier]
  
  // Room count from d20 (deterministic)
  const roomCount = minRooms + Math.floor((d20Seed / 20) * (maxRooms - minRooms + 1))
  
  // Generate seeds using deterministic distribution
  // φ (golden ratio) offset ensures even spread with no clustering
  const PHI = 1.618033988749895
  const seeds: RoomSeed[] = []
  
  // Potential distribution: entrance cheap, boss expensive, middle uniform
  // Uses a curve: potential(i) = 1 + (i / (n-1))² × 2
  // This makes later rooms cost more potential (boss costs 3× entrance)
  const rawPotentials: number[] = []
  let potentialSum = 0
  
  for (let i = 0; i < roomCount; i++) {
    const t = roomCount > 1 ? i / (roomCount - 1) : 0
    const raw = 1 + t * t * 2 // 1.0 → 3.0 curve
    rawPotentials.push(raw)
    potentialSum += raw
  }
  
  // Normalize so all potentials sum to 1.0
  for (let i = 0; i < roomCount; i++) {
    const t = roomCount > 1 ? i / (roomCount - 1) : 0
    const isFirst = i === 0
    const isLast = i === roomCount - 1
    
    // Layout: golden-ratio distributed, wrapping 0-1
    // First room always 0.0 (entrance), last always 1.0 (boss)
    const layoutRaw = isFirst ? 0.0
      : isLast ? 1.0
      : ((d20Seed * PHI + i * PHI) % 1)
    
    // Loot: sparse in corridors (low layout), dense in treasure rooms
    // Follows an exponential curve favoring later rooms
    const lootRaw = isFirst ? 0.05
      : isLast ? 0.8 + (d20Seed / 100) // Boss: 80-100% of budget slice
      : Math.pow(t, 1.5) * (0.3 + (((d20Seed * 7 + i * 13) % 20) / 20) * 0.4)
    
    // Challenge: linear ramp with floor at 0.1
    // Entrance: 0.1, Boss: 1.0, middle follows t curve
    const challengeRaw = isFirst ? 0.1
      : isLast ? 1.0
      : 0.1 + t * 0.7 + (((d20Seed * 11 + i * 3) % 20) / 20) * 0.2
    
    seeds.push({
      index: i,
      layout: clamp01(layoutRaw),
      loot: clamp01(lootRaw),
      challenge: clamp01(challengeRaw),
      potentialCost: rawPotentials[i] / potentialSum,
    })
  }
  
  return {
    gateId,
    tier,
    gateType,
    speciesId,
    generation,
    seeds,
    totalPotential: 1.0,
    remainingPotential: 1.0,
    stamped: 0,
    encounterBudget: Math.ceil(budget.cr * respawnMult),
    lootBudget: Math.ceil(budget.gp * respawnMult),
    baseDC: budget.baseDC + Math.floor(generation * 1.5),
    respawnMultiplier: respawnMult,
  }
}

// ============================================================
// MM STAMP FUNCTION — SELECT phase
// ============================================================

/**
 * Stamp the next seed into a concrete room.
 * Consumes potential from the seeder.
 * 
 * This is the MM function: seeder → room.
 * Each call transforms one seed and reduces
 * remaining potential by seed.potentialCost.
 * 
 * Returns null if all seeds are consumed.
 */
export function stampRoom(seeder: DungeonSeeder): StampedRoom | null {
  if (seeder.stamped >= seeder.seeds.length) return null
  
  const seed = seeder.seeds[seeder.stamped]
  const isFirst = seed.index === 0
  const isLast = seed.index === seeder.seeds.length - 1
  
  // ── Room type from layout ──
  const roomType = layoutToRoomType(seed.layout, isFirst, isLast)
  
  // ── Size from layout ──
  const size: StampedRoom['size'] =
    isLast || roomType === 'miniboss' ? 'huge'
    : seed.layout > 0.75 ? 'large'
    : seed.layout > 0.35 ? 'medium'
    : 'small'
  
  // ── Exits from layout ──
  const exitCount = isLast ? 0  // boss = dead end
    : isFirst ? 1
    : seed.layout > 0.8 ? 3
    : seed.layout > 0.4 ? 2
    : 1
  
  // ── Encounter from challenge × budget ──
  const crAllocation = seed.challenge * seed.potentialCost * seeder.encounterBudget
  const encounterCR = Math.round(crAllocation * 4) / 4 // Round to 0.25
  const monsterCount = isLast ? 1
    : seed.challenge > 0.7 ? 1 // Strong single
    : Math.max(1, Math.ceil(seed.challenge * 4))
  const avoidable = !isLast && seed.challenge < 0.6
  
  // ── Loot from loot × budget ──
  const lootAllocation = seed.loot * seed.potentialCost * seeder.lootBudget
  const lootGP = Math.floor(lootAllocation)
  const lootHidden = seed.loot > 0.3 && seed.loot < 0.6
  const lootTrapped = seed.loot > 0.7
  
  // ── Trap from challenge thresholds ──
  const hasTrap = !isFirst && seed.challenge > 0.3 && roomType !== 'shrine'
  const trapDC = hasTrap ? seeder.baseDC + Math.floor(seed.challenge * 4) : 0
  
  // ── Puzzle from layout extremes ──
  const hasPuzzle = !isFirst && (roomType === 'trap_room' || (seed.layout > 0.5 && seed.layout < 0.7))
  const puzzleDC = hasPuzzle ? seeder.baseDC + Math.floor(seed.layout * 6) : 0
  const puzzleRequired = roomType === 'trap_room'
  
  // ── Lighting from gate type ──
  const lightingMap: Record<string, StampedRoom['lighting']> = {
    ruin: 'dim', lair: 'dark', portal: 'magical', corruption: 'dim',
  }
  const lighting = lightingMap[seeder.gateType] ?? 'dim'
  
  // ── Consume potential ──
  seeder.remainingPotential -= seed.potentialCost
  seeder.stamped++
  
  return {
    seedIndex: seed.index,
    roomType,
    size,
    exitCount,
    encounterCR,
    monsterCount,
    avoidable,
    lootGP,
    lootHidden,
    lootTrapped,
    hasTrap,
    trapDC,
    hasPuzzle,
    puzzleDC,
    puzzleRequired,
    lighting,
    potentialConsumed: seed.potentialCost,
  }
}

/**
 * Stamp ALL seeds at once. Returns the full dungeon layout.
 * Equivalent to calling stampRoom() in a loop until null.
 */
export function stampAll(seeder: DungeonSeeder): StampedRoom[] {
  const rooms: StampedRoom[] = []
  let room: StampedRoom | null
  while ((room = stampRoom(seeder)) !== null) {
    rooms.push(room)
  }
  return rooms
}

// ============================================================
// RESPAWN — REFILL phase
// ============================================================

/**
 * Create a new seeder for a respawned dungeon.
 * Same gate params but generation+1 → 1.2× harder.
 * 
 * The seeder loop shifts: same structure but
 * challenge values scale up, loot increases.
 * The dungeon "remembers" it was cleared.
 */
export function respawnSeeder(
  previousSeeder: DungeonSeeder,
  d20Seed: number,
): DungeonSeeder {
  return generateSeeder(
    previousSeeder.gateId,
    previousSeeder.tier,
    previousSeeder.gateType,
    previousSeeder.speciesId,
    previousSeeder.generation + 1,
    d20Seed,
  )
}

// ============================================================
// AGGREGATE DIFFICULTY — For NPC party evaluation
// ============================================================

export interface SeederDifficultyProfile {
  totalCR: number
  peakCR: number         // Highest single-room CR (the boss)
  averageCR: number
  trapCount: number
  puzzleCount: number
  requiredPuzzles: number
  totalLootGP: number
  /** Minimum party CR to have >50% chance */
  recommendedPartyCR: number
}

/**
 * Evaluate the difficulty profile of a seeder WITHOUT stamping it.
 * Used by guild system to decide if an NPC party is strong enough.
 * 
 * This is a "peek" — no potential is consumed.
 */
export function evaluateSeeder(seeder: DungeonSeeder): SeederDifficultyProfile {
  let totalCR = 0
  let peakCR = 0
  let trapCount = 0
  let puzzleCount = 0
  let requiredPuzzles = 0
  let totalLootGP = 0
  
  for (const seed of seeder.seeds) {
    const cr = seed.challenge * seed.potentialCost * seeder.encounterBudget
    totalCR += cr
    if (cr > peakCR) peakCR = cr
    
    totalLootGP += seed.loot * seed.potentialCost * seeder.lootBudget
    
    const isFirst = seed.index === 0
    const isLast = seed.index === seeder.seeds.length - 1
    const roomType = layoutToRoomType(seed.layout, isFirst, isLast)
    
    if (!isFirst && seed.challenge > 0.3 && roomType !== 'shrine') trapCount++
    if (!isFirst && (roomType === 'trap_room' || (seed.layout > 0.5 && seed.layout < 0.7))) {
      puzzleCount++
      if (roomType === 'trap_room') requiredPuzzles++
    }
  }
  
  const averageCR = totalCR / seeder.seeds.length
  // Rule of thumb: party CR should be ≥ 60% of total CR to have >50% success
  const recommendedPartyCR = Math.ceil(totalCR * 0.6)
  
  return {
    totalCR: Math.round(totalCR * 4) / 4,
    peakCR: Math.round(peakCR * 4) / 4,
    averageCR: Math.round(averageCR * 4) / 4,
    trapCount,
    puzzleCount,
    requiredPuzzles,
    totalLootGP: Math.floor(totalLootGP),
    recommendedPartyCR,
  }
}

// ============================================================
// HELPERS
// ============================================================

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function layoutToRoomType(
  layout: number,
  isFirst: boolean,
  isLast: boolean,
): StampedRoom['roomType'] {
  if (isFirst) return 'entrance'
  if (isLast) return 'boss'
  if (layout < 0.15) return 'corridor'
  if (layout < 0.3) return 'chamber'
  if (layout < 0.45) return 'trap_room'
  if (layout < 0.6) return 'treasure'
  if (layout < 0.7) return 'shrine'
  if (layout < 0.85) return 'chamber'
  return 'miniboss'
}
