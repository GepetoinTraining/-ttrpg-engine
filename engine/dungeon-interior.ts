/**
 * DUNGEON INTERIOR — Procedural Room & Encounter Generation
 * ===========================================================
 * 
 * When a player or NPC party enters a DungeonGate, this module generates
 * the interior structure: rooms, encounters, traps, puzzles, and loot.
 * 
 * This is the CONTENT layer — gate controls spawn/overflow,
 * this module controls what you FACE inside.
 * 
 * Design:
 *   1. Gate tier + type → room count, encounter budget, loot tier
 *   2. Rooms are generated linearly with branching (tree structure)
 *   3. Each room has: encounter, trap, puzzle (optional), and loot
 *   4. Boss room at the end (required to cap the gate)
 *   5. NPC party resolution uses aggregate difficulty
 *   6. Player parties get the full interactive experience
 * 
 * Nests inside:
 *   - dungeon-gate.ts (what spawns the dungeon)
 *   - guild.ts (NPC parties attempt to clear it)
 *   - bend/src/engine/puzzle/ (interactive puzzle types)
 */

import { z } from 'zod'

// ============================================================
// ROOM TYPES
// ============================================================

export const RoomTypeSchema = z.enum([
  'entrance',       // First room, sets the tone
  'corridor',       // Connecting passage
  'chamber',        // Standard room with encounter
  'trap_room',      // Primarily a trap/puzzle challenge
  'treasure_room',  // Guarded loot
  'shrine',         // Rest point or buff/debuff
  'lair',           // Mini-boss room
  'boss_chamber',   // Final room, gate's core
  'dead_end',       // Optional exploration (often has loot)
  'junction',       // Split path
])
export type RoomType = z.infer<typeof RoomTypeSchema>

// ============================================================
// ENCOUNTER
// ============================================================

export const EncounterDifficultySchema = z.enum([
  'trivial',    // CR < party level × 0.5
  'easy',       // CR = party level × 0.5-0.75
  'medium',     // CR = party level × 0.75-1.0
  'hard',       // CR = party level × 1.0-1.5
  'deadly',     // CR = party level × 1.5-2.0
  'boss',       // CR = party level × 2.0+
])
export type EncounterDifficulty = z.infer<typeof EncounterDifficultySchema>

export interface RoomEncounter {
  speciesId: string
  count: number
  crEach: number
  totalCR: number
  difficulty: z.infer<typeof EncounterDifficultySchema>
  behavior: 'ambush' | 'patrol' | 'guard' | 'sleeping' | 'feeding' | 'ritual'
  /** Can the encounter be avoided (stealth, diplomacy)? */
  avoidable: boolean
  avoidDC: number              // Stealth or Persuasion DC
}

// ============================================================
// TRAP
// ============================================================

export const TrapTypeSchema = z.enum([
  'pit',             // Fall damage
  'dart',            // Projectile damage
  'poison_gas',      // Area poison
  'collapsing',      // Ceiling/floor collapse
  'magical_glyph',   // Spell trigger
  'alarm',           // Alerts guards (makes next encounter harder)
  'cage',            // Restrains party
  'flame_jet',       // Fire damage
  'flooding',        // Rising water (timed escape)
  'teleport',        // Sends back to earlier room
])
export type TrapType = z.infer<typeof TrapTypeSchema>

export interface RoomTrap {
  type: z.infer<typeof TrapTypeSchema>
  detectDC: number             // Perception/Investigation to spot
  disarmDC: number             // Thieves' tools to disable
  damage: string               // Dice expression "2d6"
  damageType: string           // "piercing", "fire", "poison", etc.
  saveDC: number               // Dex/Con save to avoid
  triggered: boolean
  disarmed: boolean
  /** Narrative: what the trap looks like */
  description: string
}

// ============================================================
// PUZZLE (links to bend/src/engine/puzzle/ types)
// ============================================================

export const PuzzleCategorySchema = z.enum([
  'combination_lock',   // Dials/levers to correct position
  'sequence',          // Press runes in order
  'spatial',           // Tile slide, rotation, mirror beam
  'logic',             // Logic grid, circuit
  'word',              // Riddle, cipher
  'physical',          // Pressure plates, statues
])
export type PuzzleCategory = z.infer<typeof PuzzleCategorySchema>

export interface RoomPuzzle {
  category: PuzzleCategory
  /** Difficulty 1-5 (maps to puzzle builder's trivial-legendary) */
  difficulty: number
  /** Skill check DC if players want to brute-force or bypass */
  bypassDC: number
  /** What solving the puzzle does */
  reward: 'opens_door' | 'disarms_trap' | 'reveals_treasure' | 'shortcut' | 'buff'
  /** Description for narrative */
  description: string
  /** Is it required to proceed? */
  required: boolean
  solved: boolean
}

// ============================================================
// LOOT
// ============================================================

export const LootRaritySchema = z.enum([
  'common',       // GP value 1-50
  'uncommon',     // GP value 50-200
  'rare',         // GP value 200-1000
  'very_rare',    // GP value 1000-5000
  'legendary',    // GP value 5000+
])
export type LootRarity = z.infer<typeof LootRaritySchema>

export interface LootItem {
  id: string
  name: string
  rarity: LootRarity
  gpValue: number
  type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'gem' | 'art_object' | 'coin' | 'reagent' | 'key'
  magical: boolean
  description: string
}

export interface RoomLoot {
  items: LootItem[]
  totalGPValue: number
  trapped: boolean              // Mimics, cursed chest, etc.
  hidden: boolean               // Requires search check
  searchDC: number
}

// ============================================================
// DUNGEON ROOM
// ============================================================

export interface DungeonRoom {
  id: string
  index: number                // Position in dungeon (0 = entrance)
  type: RoomType
  name: string
  description: string

  // Content
  encounter?: RoomEncounter
  trap?: RoomTrap
  puzzle?: RoomPuzzle
  loot?: RoomLoot

  // Connections
  exits: string[]              // Room IDs this connects to
  enteredFrom?: string         // How the party got here

  // State
  cleared: boolean
  explored: boolean

  // Environment
  lighting: 'bright' | 'dim' | 'dark' | 'magical'
  size: 'small' | 'medium' | 'large' | 'huge'
  features: string[]           // Column, altar, pool, rubble, etc.
}

// ============================================================
// DUNGEON INTERIOR — The full layout
// ============================================================

export interface DungeonInterior {
  id: string
  gateId: string
  
  // Identity
  name: string
  tier: 1 | 2 | 3 | 4 | 5
  gateType: 'ruin' | 'lair' | 'portal' | 'corruption'
  speciesId: string
  
  // Structure
  rooms: DungeonRoom[]
  totalRooms: number
  currentRoomIndex: number     // Where the party currently is

  // Difficulty
  totalEncounterCR: number
  bossRoom: string             // room ID of the boss chamber
  
  // State
  state: 'generated' | 'in_progress' | 'cleared' | 'failed' | 'abandoned'
  roomsCleared: number
  roomsExplored: number
  
  // Loot (aggregate)
  totalLootGP: number
  lootCollected: number
  
  // Timing
  generatedOnDay: number
  enteredOnDay?: number
  completedOnDay?: number
  
  // Respawn tracking — harder each time
  generation: number           // 0 = first, 1 = first respawn, etc.
}

// ============================================================
// GENERATION TABLES
// ============================================================

/** Room count by gate tier */
const TIER_ROOM_COUNT: Record<number, { min: number; max: number }> = {
  1: { min: 3, max: 5 },
  2: { min: 4, max: 7 },
  3: { min: 6, max: 9 },
  4: { min: 7, max: 11 },
  5: { min: 8, max: 13 },
}

/** Encounter budget (total CR across all rooms) by tier */
const TIER_ENCOUNTER_BUDGET: Record<number, number> = {
  1: 6,    // ~CR 0.5 × 12 or CR 2 × 3
  2: 15,   // CR 1-3 range
  3: 30,   // CR 3-6 range
  4: 50,   // CR 6-10 range
  5: 80,   // CR 10-20 range
}

/** Loot multiplier by tier */
const TIER_LOOT_MULT: Record<number, number> = {
  1: 50,
  2: 150,
  3: 500,
  4: 1500,
  5: 5000,
}

/** Room type by gate type */
const GATE_ROOM_FLAVORS: Record<string, {
  roomNames: string[]
  features: string[]
  lighting: DungeonRoom['lighting']
}> = {
  ruin: {
    roomNames: ['Crumbling Hall', 'Dusty Chamber', 'Collapsed Gallery', 'Forgotten Crypt', 'Ancient Library', 'Throne of Bones'],
    features: ['crumbling pillars', 'faded murals', 'broken altar', 'skeletal remains', 'cobwebs', 'rusted chains'],
    lighting: 'dim',
  },
  lair: {
    roomNames: ['Winding Tunnel', 'Nesting Chamber', 'Feeding Ground', 'Guard Post', 'Hoard Room', 'Alpha Den'],
    features: ['bone piles', 'crude totems', 'natural pillars', 'damp walls', 'animal hides', 'fire pit'],
    lighting: 'dark',
  },
  portal: {
    roomNames: ['Shimmering Passage', 'Elemental Nexus', 'Rift Chamber', 'Void Pocket', 'Planar Membrane', 'Gate Core'],
    features: ['floating crystals', 'energy conduits', 'dimensional tears', 'hovering debris', 'arcane runes', 'pulsing rift'],
    lighting: 'magical',
  },
  corruption: {
    roomNames: ['Warped Passage', 'Festering Chamber', 'Corruption Pool', 'Twisted Grove', 'Aberrant Nest', 'Heart of Corruption'],
    features: ['organic growths', 'pulsing walls', 'acidic pools', 'eye-covered surfaces', 'tentacle clusters', 'gibbering mass'],
    lighting: 'dim',
  },
}

// Trap descriptions by type
const TRAP_DESCRIPTIONS: Record<string, string> = {
  pit: 'A section of floor gives way, revealing a deep pit',
  dart: 'Small holes in the walls conceal poisoned dart launchers',
  poison_gas: 'Cracked vials embedded in the walls leak noxious fumes',
  collapsing: 'The ceiling is cracked and ready to fall',
  magical_glyph: 'An arcane symbol glows faintly on the floor',
  alarm: 'Thin tripwires connect to crude bells and rattles',
  cage: 'A metal cage mechanism is hidden in the ceiling',
  flame_jet: 'Blackened nozzles protrude from the walls at ankle height',
  flooding: 'Water stains on the walls suggest this room can flood',
  teleport: 'A shimmering circle on the floor pulses softly',
}

// Puzzle descriptions by category
const PUZZLE_DESCRIPTIONS: Record<string, string> = {
  combination_lock: 'A series of rotating dials adorns the locked door',
  sequence: 'Glowing runes line the wall, waiting to be pressed in order',
  spatial: 'Stone tiles on the floor can slide into new positions',
  logic: 'An inscribed grid presents a deductive challenge',
  word: 'An ancient riddle is carved above the passage',
  physical: 'Pressure plates are arranged in a pattern on the floor',
}

// ============================================================
// FACTORY — Generate dungeon interior from gate
// ============================================================

let _interiorId = 0
export function resetInteriorIdCounter(): void { _interiorId = 0 }

let _roomId = 0
let _lootId = 0

export function generateDungeonInterior(
  gateId: string,
  tier: 1 | 2 | 3 | 4 | 5,
  gateType: 'ruin' | 'lair' | 'portal' | 'corruption',
  speciesId: string,
  worldDay: number,
  generation: number,
  seedD20s: number[],
): DungeonInterior {
  const id = `interior_${++_interiorId}`
  _roomId = 0
  _lootId = 0

  const respawnMult = Math.pow(1.2, generation)
  const roomRange = TIER_ROOM_COUNT[tier]
  // Use first d20 to determine room count within range
  const roomCountSeed = seedD20s[0] ?? 10
  const totalRooms = Math.min(
    roomRange.max,
    roomRange.min + Math.floor((roomCountSeed / 20) * (roomRange.max - roomRange.min + 1))
  )

  const encounterBudget = Math.ceil(TIER_ENCOUNTER_BUDGET[tier] * respawnMult)
  const bossReserve = Math.ceil(encounterBudget * 0.4) // Reserve 40% for boss
  const nonBossBudget = encounterBudget - bossReserve
  const lootBudget = Math.ceil(TIER_LOOT_MULT[tier] * respawnMult)
  const flavor = GATE_ROOM_FLAVORS[gateType]

  // Generate rooms
  const rooms: DungeonRoom[] = []
  let crSpent = 0
  let lootSpent = 0

  for (let i = 0; i < totalRooms; i++) {
    const seed = seedD20s[(i + 1) % seedD20s.length] ?? 10
    const isFirst = i === 0
    const isLast = i === totalRooms - 1
    const isMidpoint = i === Math.floor(totalRooms / 2)

    const roomType = determineRoomType(i, totalRooms, seed, isFirst, isLast)
    const roomName = isFirst ? 'Entrance' : isLast
      ? flavor.roomNames[flavor.roomNames.length - 1]
      : flavor.roomNames[seed % (flavor.roomNames.length - 1)]

    // Features (1-3 per room)
    const featureCount = 1 + (seed % 3)
    const roomFeatures: string[] = []
    for (let f = 0; f < featureCount; f++) {
      roomFeatures.push(flavor.features[(seed + f * 3) % flavor.features.length])
    }

    const room: DungeonRoom = {
      id: `room_${++_roomId}`,
      index: i,
      type: roomType,
      name: roomName,
      description: `${roomName}: ${roomFeatures.join(', ')}.`,
      exits: [],
      cleared: false,
      explored: false,
      lighting: flavor.lighting,
      size: determineRoomSize(roomType, seed),
      features: roomFeatures,
    }

    // Encounter — boss always gets its reserved budget
    const effectiveBudget = isLast ? bossReserve : nonBossBudget
    if (shouldHaveEncounter(roomType, seed) && (isLast || crSpent < nonBossBudget)) {
      const remaining = isLast ? bossReserve : effectiveBudget - crSpent
      const encounterCR = allocateEncounterCR(
        roomType, tier, remaining, seed, isLast, respawnMult
      )
      room.encounter = {
        speciesId,
        count: encounterCR.count,
        crEach: encounterCR.crEach,
        totalCR: encounterCR.total,
        difficulty: encounterCR.difficulty,
        behavior: determineEncounterBehavior(roomType, seed),
        avoidable: roomType !== 'boss_chamber' && seed > 5,
        avoidDC: 10 + tier * 2,
      }
      crSpent += encounterCR.total
    }

    // Trap (30% of rooms, not entrance or boss)
    if (shouldHaveTrap(roomType, seed) && !isFirst) {
      room.trap = generateTrap(tier, seed, respawnMult)
    }

    // Puzzle (trap rooms + 20% of others, never entrance)
    if (shouldHavePuzzle(roomType, seed) && !isFirst) {
      room.puzzle = generatePuzzle(tier, roomType, seed)
    }

    // Loot (treasure rooms, boss, dead ends, some chambers)
    if (shouldHaveLoot(roomType, seed) && lootSpent < lootBudget) {
      const budget = isLast
        ? Math.ceil(lootBudget * 0.4) // Boss gets 40%
        : roomType === 'treasure_room'
          ? Math.ceil(lootBudget * 0.25)
          : Math.ceil(lootBudget * 0.1)
      room.loot = generateLoot(tier, Math.min(budget, lootBudget - lootSpent), seed)
      lootSpent += room.loot.totalGPValue
    }

    // Connect rooms linearly (+ branch at junctions)
    if (i > 0) {
      rooms[i - 1].exits.push(room.id)
      room.enteredFrom = rooms[i - 1].id
    }

    rooms.push(room)
  }

  return {
    id,
    gateId,
    name: `${GATE_ROOM_FLAVORS[gateType].roomNames[0]} Dungeon`,
    tier,
    gateType,
    speciesId,
    rooms,
    totalRooms,
    currentRoomIndex: 0,
    totalEncounterCR: crSpent,
    bossRoom: rooms[rooms.length - 1].id,
    state: 'generated',
    roomsCleared: 0,
    roomsExplored: 0,
    totalLootGP: lootSpent,
    lootCollected: 0,
    generatedOnDay: worldDay,
    generation,
  }
}

// ============================================================
// ROOM GENERATION HELPERS
// ============================================================

function determineRoomType(index: number, total: number, seed: number, isFirst: boolean, isLast: boolean): RoomType {
  if (isFirst) return 'entrance'
  if (isLast) return 'boss_chamber'
  if (index === Math.floor(total * 0.6) && total >= 6) return 'shrine' // rest point at 60%
  if (seed <= 3) return 'dead_end'
  if (seed <= 6) return 'trap_room'
  if (seed <= 8) return 'treasure_room'
  if (seed <= 10 && total >= 7) return 'junction'
  if (seed <= 14 && index === Math.floor(total * 0.7)) return 'lair' // mini-boss at 70%
  if (seed <= 16) return 'corridor'
  return 'chamber'
}

function determineRoomSize(type: RoomType, seed: number): DungeonRoom['size'] {
  if (type === 'boss_chamber' || type === 'lair') return 'huge'
  if (type === 'treasure_room' || type === 'shrine') return 'medium'
  if (type === 'corridor') return 'small'
  return seed > 15 ? 'large' : seed > 8 ? 'medium' : 'small'
}

function shouldHaveEncounter(type: RoomType, seed: number): boolean {
  if (type === 'entrance') return seed <= 5 // 25% for entrance
  if (type === 'boss_chamber' || type === 'lair') return true
  if (type === 'shrine' || type === 'dead_end') return seed <= 8 // 40%
  if (type === 'trap_room') return seed <= 6 // 30%
  return seed > 4 // 80% for chambers, corridors
}

function shouldHaveTrap(type: RoomType, seed: number): boolean {
  if (type === 'trap_room') return true
  if (type === 'treasure_room') return seed <= 14 // 70%
  if (type === 'boss_chamber') return seed <= 10 // 50%
  return seed <= 6 // 30% base
}

function shouldHavePuzzle(type: RoomType, seed: number): boolean {
  if (type === 'trap_room') return seed <= 14 // 70%
  if (type === 'treasure_room') return seed <= 10 // 50%
  return seed <= 4 // 20% base
}

function shouldHaveLoot(type: RoomType, seed: number): boolean {
  if (type === 'boss_chamber' || type === 'treasure_room') return true
  if (type === 'dead_end') return seed <= 14 // 70%
  if (type === 'lair') return true
  return seed <= 6 // 30%
}

// ============================================================
// ENCOUNTER GENERATION
// ============================================================

function allocateEncounterCR(
  roomType: RoomType,
  tier: number,
  remainingBudget: number,
  seed: number,
  isBoss: boolean,
  respawnMult: number,
): { count: number; crEach: number; total: number; difficulty: z.infer<typeof EncounterDifficultySchema> } {
  const tierCR: Record<number, [number, number]> = {
    1: [0.125, 1],
    2: [0.5, 3],
    3: [2, 6],
    4: [4, 10],
    5: [8, 20],
  }
  const [minCR, maxCR] = tierCR[tier]

  if (isBoss) {
    // Boss: single strong creature
    const crEach = Math.min(maxCR * respawnMult, remainingBudget)
    return { count: 1, crEach, total: crEach, difficulty: 'boss' }
  }

  if (roomType === 'lair') {
    // Mini-boss: one strong creature + minions
    const bossCR = (minCR + maxCR) / 2 * respawnMult
    const minionCR = minCR * respawnMult
    const minionCount = Math.max(1, Math.floor(seed / 8))
    const total = bossCR + minionCR * minionCount
    return {
      count: 1 + minionCount,
      crEach: bossCR,
      total: Math.min(total, remainingBudget),
      difficulty: 'hard',
    }
  }

  // Normal: pack of creatures
  const crEach = Math.max(minCR, minCR + (seed / 20) * (maxCR - minCR) * 0.5) * respawnMult
  const count = Math.max(1, Math.min(6, Math.floor(seed / 5) + 1))
  const total = crEach * count

  const difficulty: z.infer<typeof EncounterDifficultySchema> =
    total > remainingBudget * 0.5 ? 'hard'
      : total > remainingBudget * 0.3 ? 'medium'
        : total > remainingBudget * 0.15 ? 'easy'
          : 'trivial'

  return {
    count,
    crEach: Math.round(crEach * 4) / 4, // Round to 0.25
    total: Math.min(total, remainingBudget),
    difficulty,
  }
}

function determineEncounterBehavior(type: RoomType, seed: number): RoomEncounter['behavior'] {
  if (type === 'boss_chamber') return 'guard'
  if (type === 'entrance') return 'patrol'
  if (seed <= 4) return 'ambush'
  if (seed <= 8) return 'patrol'
  if (seed <= 12) return 'guard'
  if (seed <= 15) return 'sleeping'
  if (seed <= 18) return 'feeding'
  return 'ritual'
}

// ============================================================
// TRAP GENERATION
// ============================================================

function generateTrap(tier: number, seed: number, respawnMult: number): RoomTrap {
  const trapTypes: Array<z.infer<typeof TrapTypeSchema>> = [
    'pit', 'dart', 'poison_gas', 'collapsing', 'magical_glyph',
    'alarm', 'cage', 'flame_jet', 'flooding', 'teleport',
  ]
  const type = trapTypes[seed % trapTypes.length]
  const baseDC = 10 + tier * 2
  const scaledDC = Math.ceil(baseDC * respawnMult)

  const damageTypes: Record<string, string> = {
    pit: 'bludgeoning', dart: 'piercing', poison_gas: 'poison',
    collapsing: 'bludgeoning', magical_glyph: 'force', alarm: 'none',
    cage: 'none', flame_jet: 'fire', flooding: 'bludgeoning', teleport: 'none',
  }

  const damageDice = `${tier}d6`

  return {
    type,
    detectDC: scaledDC,
    disarmDC: scaledDC + 2,
    damage: type === 'alarm' || type === 'cage' || type === 'teleport' ? '0' : damageDice,
    damageType: damageTypes[type],
    saveDC: scaledDC,
    triggered: false,
    disarmed: false,
    description: TRAP_DESCRIPTIONS[type],
  }
}

// ============================================================
// PUZZLE GENERATION
// ============================================================

function generatePuzzle(tier: number, roomType: RoomType, seed: number): RoomPuzzle {
  const categories: PuzzleCategory[] = [
    'combination_lock', 'sequence', 'spatial', 'logic', 'word', 'physical',
  ]
  const category = categories[seed % categories.length]

  const reward: RoomPuzzle['reward'] =
    roomType === 'trap_room' ? 'disarms_trap'
      : roomType === 'treasure_room' ? 'reveals_treasure'
        : seed > 15 ? 'buff'
          : seed > 10 ? 'shortcut'
            : 'opens_door'

  return {
    category,
    difficulty: Math.min(5, Math.max(1, tier)),
    bypassDC: 12 + tier * 3,
    reward,
    description: PUZZLE_DESCRIPTIONS[category],
    required: roomType === 'trap_room' || reward === 'opens_door',
    solved: false,
  }
}

// ============================================================
// LOOT GENERATION
// ============================================================

function generateLoot(tier: number, budget: number, seed: number): RoomLoot {
  const items: LootItem[] = []
  let spent = 0

  // Always some coins
  const coinValue = Math.floor(budget * 0.3)
  items.push({
    id: `loot_${++_lootId}`,
    name: `${coinValue} gold coins`,
    rarity: 'common',
    gpValue: coinValue,
    type: 'coin',
    magical: false,
    description: 'A pile of gold coins',
  })
  spent += coinValue

  // Roll for items
  const itemRolls = Math.max(1, Math.floor(seed / 5))
  for (let i = 0; i < itemRolls && spent < budget; i++) {
    const itemSeed = (seed * 7 + i * 13) % 20 + 1
    const remaining = budget - spent
    const item = generateLootItem(tier, remaining, itemSeed)
    items.push(item)
    spent += item.gpValue
  }

  return {
    items,
    totalGPValue: spent,
    trapped: seed <= 4, // 20% mimic/curse
    hidden: seed > 14, // 30% hidden
    searchDC: 10 + tier * 2,
  }
}

function generateLootItem(tier: number, maxValue: number, seed: number): LootItem {
  const types: LootItem['type'][] = ['gem', 'art_object', 'potion', 'scroll', 'weapon', 'armor', 'reagent']
  const type = types[seed % types.length]

  const rarityByTier: Record<number, LootRarity[]> = {
    1: ['common', 'common', 'uncommon'],
    2: ['common', 'uncommon', 'uncommon'],
    3: ['uncommon', 'rare', 'rare'],
    4: ['rare', 'rare', 'very_rare'],
    5: ['rare', 'very_rare', 'legendary'],
  }
  const rarities = rarityByTier[tier]
  const rarity = rarities[seed % rarities.length]

  const valueByRarity: Record<LootRarity, [number, number]> = {
    common: [5, 50],
    uncommon: [50, 200],
    rare: [200, 1000],
    very_rare: [1000, 5000],
    legendary: [5000, 25000],
  }
  const [minV, maxV] = valueByRarity[rarity]
  const gpValue = Math.min(maxValue, Math.floor(minV + (seed / 20) * (maxV - minV)))

  const magical = rarity !== 'common' && seed > 8

  const names: Record<string, string[]> = {
    gem: ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Topaz'],
    art_object: ['Gold Statuette', 'Jeweled Crown', 'Silver Chalice', 'Painted Portrait', 'Ivory Carving'],
    potion: ['Healing Potion', 'Strength Potion', 'Invisibility Potion', 'Speed Potion', 'Fire Resistance Potion'],
    scroll: ['Scroll of Fireball', 'Scroll of Shield', 'Scroll of Detect Magic', 'Scroll of Fly', 'Scroll of Hold Person'],
    weapon: ['Enchanted Sword', 'Dagger of Venom', 'Mighty Warhammer', 'Elven Longbow', 'Frost Brand'],
    armor: ['Mithral Chain', 'Shield of Faith', 'Dragon Scale Mail', 'Cloak of Protection', 'Boots of Speed'],
    reagent: ['Dragon Blood', 'Phoenix Feather', 'Basilisk Eye', 'Lich Dust', 'Unicorn Horn'],
  }
  const name = names[type][seed % names[type].length]

  return {
    id: `loot_${++_lootId}`,
    name,
    rarity,
    gpValue,
    type,
    magical,
    description: `A ${rarity} ${type}: ${name}`,
  }
}

// ============================================================
// ROOM RESOLUTION — NPC party auto-clearing
// ============================================================

export interface RoomResolutionResult {
  success: boolean
  encounterDefeated: boolean
  trapTriggered: boolean
  trapDisarmed: boolean
  puzzleSolved: boolean
  puzzleBypassed: boolean
  lootCollected: number
  casualties: number
  narrative: string
}

/**
 * Resolve a party clearing a single room (for NPC auto-resolve).
 * Player parties would use the full interactive system instead.
 */
export function resolveRoom(
  room: DungeonRoom,
  partyCR: number,
  partyLevel: number,
  d20: number,
): RoomResolutionResult {
  const result: RoomResolutionResult = {
    success: true,
    encounterDefeated: false,
    trapTriggered: false,
    trapDisarmed: false,
    puzzleSolved: false,
    puzzleBypassed: false,
    lootCollected: 0,
    casualties: 0,
    narrative: '',
  }

  // Encounter
  if (room.encounter && !room.cleared) {
    const encounterCheck = d20 + Math.floor(partyCR / 3) - Math.floor(room.encounter.totalCR)
    if (encounterCheck >= 10) {
      result.encounterDefeated = true
      result.narrative += `Defeated ${room.encounter.count} ${room.encounter.speciesId}. `
    } else if (encounterCheck >= 5) {
      result.encounterDefeated = true
      result.casualties = 1
      result.narrative += `Defeated ${room.encounter.speciesId} but took losses. `
    } else {
      result.success = false
      result.casualties = Math.min(2, Math.ceil(room.encounter.totalCR / partyCR))
      result.narrative += `Overwhelmed by ${room.encounter.speciesId}! `
      return result // Failed, don't continue
    }
  }

  // Trap
  if (room.trap && !room.trap.disarmed && !room.trap.triggered) {
    const trapCheck = d20 + partyLevel
    if (trapCheck >= room.trap.disarmDC) {
      result.trapDisarmed = true
      room.trap.disarmed = true
      result.narrative += 'Disarmed trap. '
    } else if (trapCheck >= room.trap.detectDC) {
      result.narrative += 'Spotted trap but couldn\'t disarm — avoided. '
    } else {
      result.trapTriggered = true
      room.trap.triggered = true
      if (d20 <= 5) result.casualties += 1
      result.narrative += `Triggered ${room.trap.type} trap! `
    }
  }

  // Puzzle
  if (room.puzzle && !room.puzzle.solved) {
    const puzzleCheck = d20 + partyLevel
    if (puzzleCheck >= room.puzzle.bypassDC) {
      result.puzzleSolved = true
      room.puzzle.solved = true
      result.narrative += `Solved ${room.puzzle.category} puzzle. `
    } else if (room.puzzle.required) {
      result.puzzleBypassed = false
      result.success = false
      result.narrative += `Stuck on required ${room.puzzle.category} puzzle. `
      return result
    } else {
      result.narrative += `Skipped optional puzzle. `
    }
  }

  // Loot
  if (room.loot && result.success) {
    if (room.loot.hidden) {
      const searchCheck = d20 + partyLevel
      if (searchCheck >= room.loot.searchDC) {
        result.lootCollected = room.loot.totalGPValue
        result.narrative += `Found hidden loot: ${room.loot.totalGPValue}gp. `
      }
    } else {
      result.lootCollected = room.loot.totalGPValue
      result.narrative += `Collected ${room.loot.totalGPValue}gp in loot. `
    }
  }

  if (result.success) {
    room.cleared = true
    room.explored = true
  }

  return result
}

// ============================================================
// FULL DUNGEON RESOLUTION — NPC party auto-clear
// ============================================================

export interface DungeonResolutionResult {
  success: boolean
  roomsCleared: number
  totalRooms: number
  totalLoot: number
  totalCasualties: number
  bossDefeated: boolean
  roomResults: RoomResolutionResult[]
  narrative: string
}

/**
 * Auto-resolve an entire dungeon for an NPC party.
 * Goes room by room. Stops on failure.
 */
export function resolveDungeon(
  interior: DungeonInterior,
  partyCR: number,
  partyLevel: number,
  d20Seeds: number[],
): DungeonResolutionResult {
  const roomResults: RoomResolutionResult[] = []
  let totalLoot = 0
  let totalCasualties = 0
  let roomsCleared = 0

  for (let i = 0; i < interior.rooms.length; i++) {
    const room = interior.rooms[i]
    const d20 = d20Seeds[i % d20Seeds.length] ?? 10

    const result = resolveRoom(room, partyCR, partyLevel, d20)
    roomResults.push(result)
    totalLoot += result.lootCollected
    totalCasualties += result.casualties

    if (result.success) {
      roomsCleared++
    } else {
      // Failed — party retreats
      interior.state = 'failed'
      interior.roomsCleared = roomsCleared
      return {
        success: false,
        roomsCleared,
        totalRooms: interior.totalRooms,
        totalLoot,
        totalCasualties,
        bossDefeated: false,
        roomResults,
        narrative: `Party cleared ${roomsCleared}/${interior.totalRooms} rooms before retreating. ${totalCasualties} casualties.`,
      }
    }
  }

  // Full clear!
  interior.state = 'cleared'
  interior.roomsCleared = roomsCleared

  return {
    success: true,
    roomsCleared,
    totalRooms: interior.totalRooms,
    totalLoot,
    totalCasualties,
    bossDefeated: true,
    roomResults,
    narrative: `Party cleared all ${interior.totalRooms} rooms! Boss defeated. Collected ${totalLoot}gp. ${totalCasualties} casualties.`,
  }
}
