/**
 * Region Feature Generator — deterministic from seed + (q,r).
 * 
 * Computes the POTENTIAL natural features of a hex region:
 *   - Ecology: animals, plants, fungi
 *   - Geology: ores, gems, stone, terrain formations
 *   - Water features: springs, streams
 * 
 * NOTHING is written to DB — this is pure computation.
 * Only on player INTERACTION does a worldDelta get created.
 * 
 * Pure function — no DB, no side effects.
 */

import { type BiomeType } from './biome'

// ─── Types ───

export interface EcologyEntry {
  entity: string        // 'deer', 'oak_tree', 'chanterelle'
  kingdom: 'fauna' | 'flora' | 'fungi'
  category: string      // 'mammal', 'tree', 'mushroom'
  abundance: 'rare' | 'scarce' | 'moderate' | 'abundant' | 'dominant'
  season: 'year_round' | 'spring' | 'summer' | 'autumn' | 'winter'
  dangerous: boolean
  harvestable: boolean
  forageDC: number      // survival check DC to find
}

export interface GeologyEntry {
  entity: string        // 'iron_ore', 'quartz', 'limestone'
  geoType: 'ore' | 'gem' | 'crystal' | 'stone' | 'soil' | 'terrain_formation'
  depositType: string   // 'vein', 'outcrop', 'scattered', 'seam'
  depositSize: 'trace' | 'small' | 'moderate' | 'large' | 'massive'
  depth: 'surface' | 'shallow' | 'moderate' | 'deep'
  discoveryDC: number
  extractionDC: number
  surfaceVisible: boolean
}

export interface NaturalFeature {
  type: 'spring' | 'stream' | 'cave' | 'cliff' | 'clearing' | 'ancient_tree' | 'rock_formation' | 'hot_spring' | 'waterfall' | 'ravine'
  name: string
  description: string
}

export interface RegionFeatures {
  ecology: EcologyEntry[]
  geology: GeologyEntry[]
  features: NaturalFeature[]
}

// ─── Seeded RNG (same mulberry32 as noise.ts) ───

function seededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashCoord(q: number, r: number, worldSeed: number): number {
  return Math.abs((q * 73856093) ^ (r * 19349663) ^ (worldSeed * 83492791)) | 0
}

// ─── Biome Feature Tables ───

interface BiomeFeaturePool {
  fauna: { entity: string; category: string; dangerous: boolean; harvestable: boolean; weight: number }[]
  flora: { entity: string; category: string; harvestable: boolean; weight: number }[]
  fungi: { entity: string; harvestable: boolean; weight: number }[]
  geology: { entity: string; geoType: GeologyEntry['geoType']; weight: number }[]
  features: { type: NaturalFeature['type']; weight: number }[]
}

const BIOME_POOLS: Partial<Record<BiomeType, BiomeFeaturePool>> = {
  forest: {
    fauna: [
      { entity: 'deer', category: 'mammal', dangerous: false, harvestable: true, weight: 8 },
      { entity: 'wolf', category: 'mammal', dangerous: true, harvestable: true, weight: 4 },
      { entity: 'boar', category: 'mammal', dangerous: true, harvestable: true, weight: 5 },
      { entity: 'rabbit', category: 'mammal', dangerous: false, harvestable: true, weight: 9 },
      { entity: 'owl', category: 'bird', dangerous: false, harvestable: false, weight: 6 },
      { entity: 'bear', category: 'mammal', dangerous: true, harvestable: true, weight: 2 },
      { entity: 'fox', category: 'mammal', dangerous: false, harvestable: true, weight: 5 },
      { entity: 'woodpecker', category: 'bird', dangerous: false, harvestable: false, weight: 7 },
    ],
    flora: [
      { entity: 'oak_tree', category: 'tree', harvestable: true, weight: 9 },
      { entity: 'pine_tree', category: 'tree', harvestable: true, weight: 8 },
      { entity: 'birch_tree', category: 'tree', harvestable: true, weight: 6 },
      { entity: 'wild_berries', category: 'shrub', harvestable: true, weight: 7 },
      { entity: 'medicinal_herbs', category: 'herb', harvestable: true, weight: 4 },
      { entity: 'ferns', category: 'fern', harvestable: false, weight: 8 },
      { entity: 'moss', category: 'moss', harvestable: true, weight: 7 },
    ],
    fungi: [
      { entity: 'chanterelle', harvestable: true, weight: 5 },
      { entity: 'porcini', harvestable: true, weight: 4 },
      { entity: 'death_cap', harvestable: true, weight: 2 },
      { entity: 'shelf_fungus', harvestable: true, weight: 6 },
    ],
    geology: [
      { entity: 'limestone', geoType: 'stone', weight: 6 },
      { entity: 'clay_deposit', geoType: 'soil', weight: 5 },
      { entity: 'flint', geoType: 'stone', weight: 4 },

    ],
    features: [
      { type: 'clearing', weight: 6 },
      { type: 'ancient_tree', weight: 3 },
      { type: 'stream', weight: 5 },
      { type: 'spring', weight: 3 },
      { type: 'cave', weight: 2 },
    ],
  },

  mountains: {
    fauna: [
      { entity: 'mountain_goat', category: 'mammal', dangerous: false, harvestable: true, weight: 7 },
      { entity: 'eagle', category: 'bird', dangerous: false, harvestable: false, weight: 6 },
      { entity: 'mountain_lion', category: 'mammal', dangerous: true, harvestable: true, weight: 3 },
      { entity: 'marmot', category: 'mammal', dangerous: false, harvestable: true, weight: 5 },
      { entity: 'snow_hare', category: 'mammal', dangerous: false, harvestable: true, weight: 4 },
    ],
    flora: [
      { entity: 'alpine_herbs', category: 'herb', harvestable: true, weight: 5 },
      { entity: 'edelweiss', category: 'flower', harvestable: true, weight: 2 },
      { entity: 'mountain_pine', category: 'tree', harvestable: true, weight: 4 },
      { entity: 'lichen', category: 'moss', harvestable: true, weight: 7 },
    ],
    fungi: [
      { entity: 'cave_mushroom', harvestable: true, weight: 3 },
    ],
    geology: [
      { entity: 'iron_ore', geoType: 'ore', weight: 6 },
      { entity: 'copper_ore', geoType: 'ore', weight: 5 },
      { entity: 'silver_ore', geoType: 'ore', weight: 2 },
      { entity: 'granite', geoType: 'stone', weight: 8 },
      { entity: 'marble', geoType: 'stone', weight: 3 },

    ],
    features: [
      { type: 'cave', weight: 6 },
      { type: 'cliff', weight: 7 },
      { type: 'rock_formation', weight: 5 },
      { type: 'ravine', weight: 4 },
      { type: 'hot_spring', weight: 1 },
      { type: 'waterfall', weight: 2 },
    ],
  },

  plains: {
    fauna: [
      { entity: 'rabbit', category: 'mammal', dangerous: false, harvestable: true, weight: 9 },
      { entity: 'wild_horse', category: 'mammal', dangerous: false, harvestable: false, weight: 4 },
      { entity: 'pheasant', category: 'bird', dangerous: false, harvestable: true, weight: 7 },
      { entity: 'prairie_dog', category: 'mammal', dangerous: false, harvestable: false, weight: 6 },
      { entity: 'hawk', category: 'bird', dangerous: false, harvestable: false, weight: 5 },
      { entity: 'coyote', category: 'mammal', dangerous: true, harvestable: true, weight: 3 },
    ],
    flora: [
      { entity: 'wild_grass', category: 'grass', harvestable: false, weight: 10 },
      { entity: 'wildflowers', category: 'flower', harvestable: true, weight: 7 },
      { entity: 'grain_grass', category: 'grass', harvestable: true, weight: 6 },
      { entity: 'healing_weed', category: 'herb', harvestable: true, weight: 3 },
    ],
    fungi: [
      { entity: 'meadow_mushroom', harvestable: true, weight: 4 },
    ],
    geology: [
      { entity: 'clay_deposit', geoType: 'soil', weight: 7 },
      { entity: 'flint', geoType: 'stone', weight: 5 },
      { entity: 'sandstone', geoType: 'stone', weight: 4 },
    ],
    features: [
      { type: 'clearing', weight: 5 },
      { type: 'spring', weight: 4 },
      { type: 'stream', weight: 3 },
      { type: 'rock_formation', weight: 2 },
    ],
  },

  hills: {
    fauna: [
      { entity: 'fox', category: 'mammal', dangerous: false, harvestable: true, weight: 6 },
      { entity: 'sheep', category: 'mammal', dangerous: false, harvestable: true, weight: 5 },
      { entity: 'badger', category: 'mammal', dangerous: true, harvestable: true, weight: 4 },
      { entity: 'skylark', category: 'bird', dangerous: false, harvestable: false, weight: 7 },
    ],
    flora: [
      { entity: 'heather', category: 'shrub', harvestable: true, weight: 8 },
      { entity: 'gorse', category: 'shrub', harvestable: false, weight: 6 },
      { entity: 'wild_thyme', category: 'herb', harvestable: true, weight: 5 },
      { entity: 'hawthorn', category: 'tree', harvestable: true, weight: 4 },
    ],
    fungi: [
      { entity: 'field_mushroom', harvestable: true, weight: 5 },
    ],
    geology: [
      { entity: 'copper_ore', geoType: 'ore', weight: 5 },
      { entity: 'tin_ore', geoType: 'ore', weight: 4 },
      { entity: 'limestone', geoType: 'stone', weight: 7 },
      { entity: 'slate', geoType: 'stone', weight: 5 },
    ],
    features: [
      { type: 'cave', weight: 4 },
      { type: 'spring', weight: 5 },
      { type: 'rock_formation', weight: 6 },
      { type: 'cliff', weight: 3 },
    ],
  },

  desert: {
    fauna: [
      { entity: 'scorpion', category: 'arachnid', dangerous: true, harvestable: true, weight: 7 },
      { entity: 'rattlesnake', category: 'reptile', dangerous: true, harvestable: true, weight: 6 },
      { entity: 'vulture', category: 'bird', dangerous: false, harvestable: false, weight: 5 },
      { entity: 'desert_lizard', category: 'reptile', dangerous: false, harvestable: true, weight: 7 },
      { entity: 'fennec_fox', category: 'mammal', dangerous: false, harvestable: true, weight: 3 },
    ],
    flora: [
      { entity: 'cactus', category: 'succulent', harvestable: true, weight: 8 },
      { entity: 'desert_sage', category: 'herb', harvestable: true, weight: 5 },
      { entity: 'tumbleweed', category: 'shrub', harvestable: false, weight: 6 },
    ],
    fungi: [],
    geology: [
      { entity: 'sandstone', geoType: 'stone', weight: 9 },

      { entity: 'gold_dust', geoType: 'ore', weight: 1 },
      { entity: 'obsidian', geoType: 'stone', weight: 2 },
    ],
    features: [
      { type: 'rock_formation', weight: 6 },
      { type: 'cave', weight: 3 },
      { type: 'ravine', weight: 4 },
      { type: 'spring', weight: 1 },
    ],
  },

  swamp: {
    fauna: [
      { entity: 'frog', category: 'amphibian', dangerous: false, harvestable: true, weight: 9 },
      { entity: 'leech', category: 'invertebrate', dangerous: false, harvestable: true, weight: 7 },
      { entity: 'heron', category: 'bird', dangerous: false, harvestable: false, weight: 5 },
      { entity: 'alligator', category: 'reptile', dangerous: true, harvestable: true, weight: 3 },
      { entity: 'mosquito_swarm', category: 'insect', dangerous: true, harvestable: false, weight: 8 },
    ],
    flora: [
      { entity: 'cattail', category: 'grass', harvestable: true, weight: 8 },
      { entity: 'water_lily', category: 'flower', harvestable: true, weight: 6 },
      { entity: 'willow_tree', category: 'tree', harvestable: true, weight: 5 },
      { entity: 'swamp_moss', category: 'moss', harvestable: true, weight: 7 },
    ],
    fungi: [
      { entity: 'puffball', harvestable: true, weight: 5 },
      { entity: 'glowing_fungus', harvestable: true, weight: 2 },
      { entity: 'rot_mold', harvestable: true, weight: 6 },
    ],
    geology: [
      { entity: 'peat', geoType: 'soil', weight: 8 },
      { entity: 'bog_iron', geoType: 'ore', weight: 4 },
      { entity: 'clay_deposit', geoType: 'soil', weight: 6 },
    ],
    features: [
      { type: 'spring', weight: 4 },
      { type: 'stream', weight: 3 },
      { type: 'ancient_tree', weight: 2 },
    ],
  },

  coast: {
    fauna: [
      { entity: 'fish', category: 'fish', dangerous: false, harvestable: true, weight: 9 },
      { entity: 'crab', category: 'crustacean', dangerous: false, harvestable: true, weight: 8 },
      { entity: 'seagull', category: 'bird', dangerous: false, harvestable: false, weight: 7 },
      { entity: 'seal', category: 'mammal', dangerous: false, harvestable: true, weight: 3 },
      { entity: 'jellyfish', category: 'invertebrate', dangerous: true, harvestable: true, weight: 4 },
    ],
    flora: [
      { entity: 'kelp', category: 'seaweed', harvestable: true, weight: 8 },
      { entity: 'beach_grass', category: 'grass', harvestable: false, weight: 7 },
      { entity: 'sea_holly', category: 'herb', harvestable: true, weight: 3 },
    ],
    fungi: [],
    geology: [
      { entity: 'salt_deposit', geoType: 'ore', weight: 7 },
      { entity: 'shells', geoType: 'stone', weight: 8 },
      { entity: 'driftwood', geoType: 'terrain_formation', weight: 6 },

    ],
    features: [
      { type: 'cliff', weight: 5 },
      { type: 'cave', weight: 3 },
      { type: 'rock_formation', weight: 4 },
      { type: 'stream', weight: 3 },
    ],
  },

  dense_forest: {
    fauna: [
      { entity: 'bear', category: 'mammal', dangerous: true, harvestable: true, weight: 4 },
      { entity: 'wolf_pack', category: 'mammal', dangerous: true, harvestable: true, weight: 5 },
      { entity: 'deer', category: 'mammal', dangerous: false, harvestable: true, weight: 6 },
      { entity: 'giant_spider', category: 'arachnid', dangerous: true, harvestable: true, weight: 2 },
      { entity: 'owl', category: 'bird', dangerous: false, harvestable: false, weight: 5 },
    ],
    flora: [
      { entity: 'ancient_oak', category: 'tree', harvestable: true, weight: 7 },
      { entity: 'strangling_vine', category: 'vine', harvestable: false, weight: 5 },
      { entity: 'rare_herbs', category: 'herb', harvestable: true, weight: 3 },
      { entity: 'giant_fern', category: 'fern', harvestable: false, weight: 6 },
      { entity: 'nightshade', category: 'herb', harvestable: true, weight: 2 },
    ],
    fungi: [
      { entity: 'glowing_fungus', harvestable: true, weight: 4 },
      { entity: 'death_cap', harvestable: true, weight: 3 },
      { entity: 'truffle', harvestable: true, weight: 1 },
    ],
    geology: [
      { entity: 'mossy_stone', geoType: 'stone', weight: 7 },
      { entity: 'clay_deposit', geoType: 'soil', weight: 5 },
    ],
    features: [
      { type: 'ancient_tree', weight: 6 },
      { type: 'clearing', weight: 3 },
      { type: 'cave', weight: 4 },
      { type: 'spring', weight: 3 },
      { type: 'ravine', weight: 2 },
    ],
  },

  tundra: {
    fauna: [
      { entity: 'arctic_fox', category: 'mammal', dangerous: false, harvestable: true, weight: 5 },
      { entity: 'reindeer', category: 'mammal', dangerous: false, harvestable: true, weight: 6 },
      { entity: 'snowy_owl', category: 'bird', dangerous: false, harvestable: false, weight: 5 },
      { entity: 'arctic_wolf', category: 'mammal', dangerous: true, harvestable: true, weight: 3 },
    ],
    flora: [
      { entity: 'lichen', category: 'moss', harvestable: true, weight: 8 },
      { entity: 'arctic_moss', category: 'moss', harvestable: true, weight: 7 },
      { entity: 'crowberry', category: 'shrub', harvestable: true, weight: 4 },
    ],
    fungi: [
      { entity: 'tundra_truffle', harvestable: true, weight: 1 },
    ],
    geology: [
      { entity: 'permafrost_stone', geoType: 'stone', weight: 7 },
      { entity: 'flint', geoType: 'stone', weight: 5 },
      { entity: 'iron_ore', geoType: 'ore', weight: 3 },
    ],
    features: [
      { type: 'rock_formation', weight: 5 },
      { type: 'hot_spring', weight: 1 },
      { type: 'ravine', weight: 3 },
    ],
  },

  snow: {
    fauna: [
      { entity: 'snow_hare', category: 'mammal', dangerous: false, harvestable: true, weight: 5 },
      { entity: 'ice_bear', category: 'mammal', dangerous: true, harvestable: true, weight: 2 },
      { entity: 'snow_eagle', category: 'bird', dangerous: false, harvestable: false, weight: 3 },
    ],
    flora: [
      { entity: 'snow_moss', category: 'moss', harvestable: true, weight: 5 },
      { entity: 'ice_flower', category: 'flower', harvestable: true, weight: 1 },
    ],
    fungi: [],
    geology: [

      { entity: 'frozen_stone', geoType: 'stone', weight: 7 },
      { entity: 'mithral_trace', geoType: 'ore', weight: 1 },
    ],
    features: [
      { type: 'cave', weight: 4 },
      { type: 'cliff', weight: 5 },
      { type: 'hot_spring', weight: 1 },
    ],
  },
}

// ─── Feature Name Generation ───

const FEATURE_NAME_PARTS: Record<NaturalFeature['type'], { adjectives: string[]; nouns: string[] }> = {
  spring:         { adjectives: ['Clear', 'Hidden', 'Babbling', 'Cold', 'Sweet'], nouns: ['Spring', 'Well', 'Source'] },
  stream:         { adjectives: ['Winding', 'Rocky', 'Gentle', 'Swift', 'Shallow'], nouns: ['Brook', 'Creek', 'Rill'] },
  cave:           { adjectives: ['Dark', 'Deep', 'Echoing', 'Mossy', 'Narrow'], nouns: ['Cave', 'Grotto', 'Cavern'] },
  cliff:          { adjectives: ['Sheer', 'Windswept', 'Red', 'White', 'Crumbling'], nouns: ['Cliff', 'Bluff', 'Escarpment'] },
  clearing:       { adjectives: ['Sunlit', 'Quiet', 'Hidden', 'Mossy', 'Wide'], nouns: ['Clearing', 'Glade', 'Meadow'] },
  ancient_tree:   { adjectives: ['Ancient', 'Twisted', 'Hollow', 'Great', 'Sacred'], nouns: ['Oak', 'Yew', 'Sentinel'] },
  rock_formation: { adjectives: ['Standing', 'Weathered', 'Tall', 'Split', 'Balanced'], nouns: ['Stone', 'Monolith', 'Tor'] },
  hot_spring:     { adjectives: ['Steaming', 'Warm', 'Sulphurous', 'Healing', 'Bubbling'], nouns: ['Hot Spring', 'Pool', 'Geyser'] },
  waterfall:      { adjectives: ['Roaring', 'Misty', 'Hidden', 'Cascading', 'Silver'], nouns: ['Falls', 'Cascade', 'Cataract'] },
  ravine:         { adjectives: ['Deep', 'Dark', 'Narrow', 'Winding', 'Steep'], nouns: ['Ravine', 'Gorge', 'Chasm'] },
}

const FEATURE_DESCRIPTIONS: Record<NaturalFeature['type'], string> = {
  spring: 'Fresh water bubbles up from the ground here.',
  stream: 'A narrow watercourse winds through the terrain.',
  cave: 'A dark opening leads underground.',
  cliff: 'A steep rock face rises above the landscape.',
  clearing: 'An open area amid the surrounding terrain.',
  ancient_tree: 'A massive, ancient tree dominates this area.',
  rock_formation: 'Unusual stone formations rise from the ground.',
  hot_spring: 'Warm water steams in a natural pool.',
  waterfall: 'Water cascades down from a height.',
  ravine: 'A deep cut in the earth drops away sharply.',
}

// ─── Generator ───

function weightedPick<T extends { weight: number }>(pool: T[], rng: () => number): T {
  const total = pool.reduce((s, p) => s + p.weight, 0)
  let roll = rng() * total
  for (const item of pool) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return pool[pool.length - 1]
}

function abundanceFromRoll(roll: number): EcologyEntry['abundance'] {
  if (roll < 0.1) return 'rare'
  if (roll < 0.3) return 'scarce'
  if (roll < 0.6) return 'moderate'
  if (roll < 0.85) return 'abundant'
  return 'dominant'
}

function depositSizeFromRoll(roll: number): GeologyEntry['depositSize'] {
  if (roll < 0.15) return 'trace'
  if (roll < 0.4) return 'small'
  if (roll < 0.7) return 'moderate'
  if (roll < 0.9) return 'large'
  return 'massive'
}

function depthFromRoll(roll: number): GeologyEntry['depth'] {
  if (roll < 0.3) return 'surface'
  if (roll < 0.6) return 'shallow'
  if (roll < 0.85) return 'moderate'
  return 'deep'
}

const SEASONS: EcologyEntry['season'][] = ['year_round', 'spring', 'summer', 'autumn', 'winter']

/**
 * Generate the potential natural features of a region hex.
 * Deterministic: same seed + (q,r) + biome → same features always.
 */
export function generateRegionFeatures(
  worldSeed: number,
  q: number,
  r: number,
  biome: BiomeType
): RegionFeatures {
  const pool = BIOME_POOLS[biome]
  if (!pool || biome === 'ocean') {
    return { ecology: [], geology: [], features: [] }
  }

  const hash = hashCoord(q, r, worldSeed)
  const rng = seededRng(hash)

  // ─── Ecology ───
  const ecology: EcologyEntry[] = []

  // Fauna: 2-5 species
  const faunaCount = 2 + Math.floor(rng() * 4)
  const usedFauna = new Set<string>()
  for (let i = 0; i < faunaCount && pool.fauna.length > 0; i++) {
    const pick = weightedPick(pool.fauna, rng)
    if (usedFauna.has(pick.entity)) continue
    usedFauna.add(pick.entity)
    ecology.push({
      entity: pick.entity,
      kingdom: 'fauna',
      category: pick.category,
      abundance: abundanceFromRoll(rng()),
      season: SEASONS[Math.floor(rng() * 3)], // favor year_round, spring, summer
      dangerous: pick.dangerous,
      harvestable: pick.harvestable,
      forageDC: 8 + Math.floor(rng() * 10),
    })
  }

  // Flora: 3-6 species
  const floraCount = 3 + Math.floor(rng() * 4)
  const usedFlora = new Set<string>()
  for (let i = 0; i < floraCount && pool.flora.length > 0; i++) {
    const pick = weightedPick(pool.flora, rng)
    if (usedFlora.has(pick.entity)) continue
    usedFlora.add(pick.entity)
    ecology.push({
      entity: pick.entity,
      kingdom: 'flora',
      category: pick.category,
      abundance: abundanceFromRoll(rng()),
      season: rng() < 0.6 ? 'year_round' : SEASONS[1 + Math.floor(rng() * 4)],
      dangerous: false,
      harvestable: pick.harvestable,
      forageDC: 5 + Math.floor(rng() * 8),
    })
  }

  // Fungi: 0-3 species
  const fungiCount = Math.floor(rng() * 4)
  const usedFungi = new Set<string>()
  for (let i = 0; i < fungiCount && pool.fungi.length > 0; i++) {
    const pick = weightedPick(pool.fungi, rng)
    if (usedFungi.has(pick.entity)) continue
    usedFungi.add(pick.entity)
    ecology.push({
      entity: pick.entity,
      kingdom: 'fungi',
      category: 'mushroom',
      abundance: abundanceFromRoll(rng()),
      season: rng() < 0.4 ? 'autumn' : 'year_round',
      dangerous: pick.entity.includes('death') || pick.entity.includes('rot'),
      harvestable: pick.harvestable,
      forageDC: 10 + Math.floor(rng() * 8),
    })
  }

  // ─── Geology ───
  const geology: GeologyEntry[] = []
  const geoCount = 1 + Math.floor(rng() * 3)
  const depositTypes = ['vein', 'outcrop', 'scattered', 'seam', 'surface']
  const usedGeo = new Set<string>()

  for (let i = 0; i < geoCount && pool.geology.length > 0; i++) {
    const pick = weightedPick(pool.geology, rng)
    if (usedGeo.has(pick.entity)) continue
    usedGeo.add(pick.entity)
    const depth = depthFromRoll(rng())
    geology.push({
      entity: pick.entity,
      geoType: pick.geoType,
      depositType: depositTypes[Math.floor(rng() * depositTypes.length)],
      depositSize: depositSizeFromRoll(rng()),
      depth,
      discoveryDC: depth === 'surface' ? 5 : depth === 'shallow' ? 10 : 15 + Math.floor(rng() * 5),
      extractionDC: 10 + Math.floor(rng() * 8),
      surfaceVisible: depth === 'surface' && rng() > 0.3,
    })
  }

  // ─── Natural Features ───
  const features: NaturalFeature[] = []
  const featureCount = Math.floor(rng() * 3) // 0-2 features per hex
  const usedFeatures = new Set<string>()

  for (let i = 0; i < featureCount && pool.features.length > 0; i++) {
    const pick = weightedPick(pool.features, rng)
    if (usedFeatures.has(pick.type)) continue
    usedFeatures.add(pick.type)

    const parts = FEATURE_NAME_PARTS[pick.type]
    const adj = parts.adjectives[Math.floor(rng() * parts.adjectives.length)]
    const noun = parts.nouns[Math.floor(rng() * parts.nouns.length)]

    features.push({
      type: pick.type,
      name: `${adj} ${noun}`,
      description: FEATURE_DESCRIPTIONS[pick.type],
    })
  }

  return { ecology, geology, features }
}
