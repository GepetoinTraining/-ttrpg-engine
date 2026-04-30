/**
 * KNOWLEDGE POOL — Settlement-Level Discovery Engine
 * =====================================================
 * 
 * Knowledge isn't a tech tree. It's a GARDEN.
 * 
 * Seeds arrive from exploration, trade, research, player actions,
 * and accidents. When the right seeds + right NPC roles + right
 * materials exist in the same hub, a POTENTIAL becomes realizable.
 * 
 * The settlement "discovers" alchemy not because it's tier 3,
 * but because a healer exists AND someone figured out glassmaking
 * AND herbs are available. Each activation cascades — alchemy
 * enables potion recipes, which unlock healer upgrades, which
 * enable combat medic roles...
 * 
 * Design:
 *   - Seeds are hub-bound, not character-bound
 *   - Character ascension (.tp merge) preserves all seeds
 *   - Generational play: parent plants seeds, child harvests
 *   - Isekai arrival = high-resonance foreign seed injection
 * 
 * MF Pattern:
 *   GRIND  → monthly: scan seeds for new potential combos
 *   SELECT → when requirements met: d20 roll for activation
 *   REFILL → activated potentials unlock NEW potential combos
 */

// ============================================================
// KNOWLEDGE SEED — A single piece of discovered knowledge
// ============================================================

export type SeedCategory =
  | 'material'       // "you can smelt iron", "this clay makes good pots"
  | 'technique'      // "weaving patterns", "forging tempering"
  | 'creature'       // "these wolves are tameable", "spider silk is strong"
  | 'botanical'      // "this herb heals", "these berries ferment well"
  | 'lore'           // "ancient dwarven recipe", "forgotten enchantment"
  | 'trade_route'    // "the coast road goes to X", "eastern spice route"
  | 'geography'      // "there's a quarry nearby", "underground river"
  | 'social'         // "a guild system exists", "neighboring village trades"

export type SeedSource =
  | 'exploration'    // Edge traversal, dungeon find
  | 'trade'          // Foreign merchant arrives
  | 'research'       // NPC with Investigation/Arcana studies
  | 'player_action'  // Player character does something
  | 'npc_arrival'    // New NPC brings knowledge from home
  | 'accident'       // Random discovery (nat 20 on monthly roll)
  | 'inheritance'    // From parent settlement or ascended character

export interface KnowledgeSeed {
  id: string
  /** The knowledge tag — this is matched against potentials */
  tag: string
  /** Human-readable name */
  name: string
  /** What kind of knowledge */
  category: SeedCategory
  /** How it was discovered */
  source: SeedSource
  /** Who discovered it (NPC ID, party ID, or 'system') */
  discoveredBy: string
  /** World day of discovery */
  discoveredOnDay: number
  /** How significant this discovery was (1-20, affects activation rolls) */
  resonance: number
  /** Brief narrative of the discovery */
  narrative: string
}

// ============================================================
// INFRASTRUCTURE POTENTIAL — An unrealized combination
// ============================================================

export interface PotentialUnlock {
  /** New workshop type available in the hub */
  workshopType?: string
  /** New recipe IDs unlocked */
  recipes?: string[]
  /** New NPC role tags that can appear (NPC agenda system) */
  roles?: string[]
  /** New commodity types that can be produced */
  commodities?: string[]
  /** New knowledge tags this enables (cascading!) */
  seedsGenerated?: string[]
  /** Character-level skill discovery rules unlocked */
  discoveryRules?: string[]
}

export interface InfrastructurePotential {
  id: string
  /** Human-readable name */
  name: string
  /** What this represents narratively */
  description: string
  
  /** ALL of these seed tags must exist in the pool */
  requiredSeeds: string[]
  /** At least one NPC in the hub must have one of these role tags */
  requiredRoles: string[]
  /** These commodities must exist in the local market */
  requiredCommodities: string[]
  
  /** What gets unlocked when this potential activates */
  unlocks: PotentialUnlock
  
  /** d20 DC to activate (lower = easier) */
  activationDC: number
  /** Minimum hub population */
  requiredPopulation: number
  /** Needs at least one trade edge */
  requiresTradeRoute: boolean
  
  /** Can this potential cascade into more potentials? */
  cascadeIds: string[]
}

// ============================================================
// KNOWLEDGE POOL — The hub's collective knowledge state
// ============================================================

export interface KnowledgePool {
  hubId: string
  /** All discovered knowledge */
  seeds: KnowledgeSeed[]
  /** Potentials that have been identified but not yet activated */
  pendingPotentials: string[]  // Potential IDs
  /** Potentials that have been activated (realized) */
  realizedPotentials: string[] // Potential IDs
  /** What the hub can currently produce */
  availableWorkshops: string[]
  availableRecipes: string[]
  availableRoles: string[]
  availableCommodities: string[]
  /** Development score (each activation increases this) */
  developmentPoints: number
  /** What this hub is known for */
  specializations: string[]
  /** Tracking */
  lastTickDay: number
  totalActivations: number
}

// ============================================================
// STANDARD POTENTIALS — The organic "tech web"
// ============================================================

let _potentialId = 0
export function resetPotentialIdCounter(): void { _potentialId = 0 }

function pot(
  name: string,
  requiredSeeds: string[],
  requiredRoles: string[],
  requiredCommodities: string[],
  unlocks: PotentialUnlock,
  dc: number,
  opts?: Partial<InfrastructurePotential>,
): InfrastructurePotential {
  return {
    id: `pot_${++_potentialId}`,
    name,
    description: `${name} — unlocked when ${requiredSeeds.join(' + ')} combine`,
    requiredSeeds,
    requiredRoles,
    requiredCommodities,
    unlocks,
    activationDC: dc,
    requiredPopulation: opts?.requiredPopulation ?? 0,
    requiresTradeRoute: opts?.requiresTradeRoute ?? false,
    cascadeIds: opts?.cascadeIds ?? [],
  }
}

export const STANDARD_POTENTIALS: InfrastructurePotential[] = [
  // ── Tier 1: Basic discoveries ──
  pot('Basic Alchemy', ['glassmaking', 'herbalism'], ['healer'],
    [], { workshopType: 'alchemy_lab', roles: ['alchemist'], seedsGenerated: ['potion_brewing'] }, 10),

  pot('Apothecary', ['herbalism', 'medicine_knowledge'], ['healer'],
    [], { workshopType: 'apothecary', recipes: ['healing_salve', 'antidote'], roles: ['apothecary'] }, 8),

  pot('Brewery', ['grain_cultivation', 'fermentation'], ['farmer'],
    ['grain'], { workshopType: 'brewery', commodities: ['ale', 'beer'], roles: ['brewer'] }, 8),

  pot('Tannery', ['animal_husbandry', 'hide_processing'], ['hunter'],
    ['raw_hide'], { workshopType: 'tannery', commodities: ['leather'], roles: ['tanner'] }, 8),

  pot('Pottery Workshop', ['clay_working', 'kiln_building'], ['laborer'],
    ['clay'], { workshopType: 'pottery', commodities: ['pottery', 'bricks'] }, 8),

  pot('Smithy', ['iron_smelting', 'fire_mastery'], ['miner'],
    ['iron_ore'], { workshopType: 'forge', commodities: ['iron_tools'], roles: ['blacksmith'], seedsGenerated: ['metalworking'] }, 10),

  // ── Tier 2: Combinations requiring Tier 1 ──
  pot('Armorsmith', ['metalworking', 'leather_working'], ['blacksmith'],
    ['iron_tools', 'leather'], { workshopType: 'armorsmith', recipes: ['chain_mail', 'leather_armor'], roles: ['armorsmith'] }, 12),

  pot('Weaponsmith', ['metalworking', 'weapon_design'], ['blacksmith'],
    ['iron_tools'], { workshopType: 'weaponsmith', recipes: ['longsword', 'spear', 'shield'], roles: ['weaponsmith'] }, 12),

  pot('Tailoring', ['cloth_weaving', 'dyeing'], ['weaver'],
    ['cloth'], { workshopType: 'tailor', commodities: ['clothing', 'dyed_cloth'], roles: ['tailor'] }, 10),

  pot('Bakery', ['grain_cultivation', 'fire_mastery'], ['farmer'],
    ['grain'], { workshopType: 'bakery', commodities: ['bread', 'pastries'], roles: ['baker'] }, 8),

  pot('Carpentry Workshop', ['woodcraft', 'tool_making'], ['laborer'],
    ['timber'], { workshopType: 'carpentry', commodities: ['furniture', 'wooden_tools'], roles: ['carpenter'] }, 10),

  pot('Glassworks', ['sand_collection', 'kiln_building', 'fire_mastery'], ['laborer'],
    [], { workshopType: 'glassworks', commodities: ['glass', 'glass_bottles'], seedsGenerated: ['glassmaking'] }, 12),

  // ── Tier 3: Advanced — requires trade or research ──
  pot('Jeweler', ['gem_cutting', 'metalworking'], ['goldsmith'],
    ['gems', 'gold'], { workshopType: 'jeweler_bench', commodities: ['jewelry'], roles: ['jeweler'] }, 14,
    { requiresTradeRoute: true }),

  pot('Enchanting Workshop', ['arcane_theory', 'gem_cutting'], ['mage'],
    ['gems'], { workshopType: 'enchanting_circle', roles: ['enchanter'], seedsGenerated: ['enchantment_theory'] }, 16,
    { requiredPopulation: 500 }),

  pot('Scriptorium', ['ink_making', 'parchment_craft', 'literacy'], ['scholar'],
    ['parchment', 'ink'], { workshopType: 'scriptorium', commodities: ['books', 'scrolls'], roles: ['scribe'] }, 12),

  pot('Shipyard', ['woodcraft', 'sail_making', 'navigation'], ['sailor'],
    ['timber', 'cloth'], { workshopType: 'shipyard', commodities: ['boats'], roles: ['shipwright'] }, 14,
    { requiredPopulation: 1000, requiresTradeRoute: true }),

  pot('Masonry Guild', ['stone_cutting', 'mathematics', 'engineering'], ['builder'],
    ['stone'], { workshopType: 'masonry', commodities: ['cut_stone', 'fortifications'], roles: ['mason'] }, 14,
    { requiredPopulation: 500 }),

  // ── Tier 4: Specialized — cascading from multiple chains ──
  pot('Monster Reagents', ['monster_lore', 'herbalism', 'potion_brewing'], ['alchemist'],
    [], { recipes: ['potion_of_strength', 'potion_of_resistance'], commodities: ['monster_reagents'], seedsGenerated: ['advanced_alchemy'] }, 16),

  pot('Breeding Program', ['animal_husbandry', 'selective_breeding', 'veterinary'], ['rancher'],
    ['livestock'], { roles: ['breeder'], seedsGenerated: ['advanced_husbandry'] }, 14),

  pot('Goldsmith Workshop', ['metalworking', 'gem_cutting', 'artistry'], ['jeweler'],
    ['gold'], { workshopType: 'goldsmith', commodities: ['fine_jewelry', 'gold_work'], roles: ['goldsmith'] }, 14,
    { requiresTradeRoute: true }),
]

// ============================================================
// POOL FACTORY
// ============================================================

let _seedId = 0
export function resetSeedIdCounter(): void { _seedId = 0 }

export function createKnowledgePool(hubId: string, worldDay: number): KnowledgePool {
  return {
    hubId,
    seeds: [],
    pendingPotentials: [],
    realizedPotentials: [],
    availableWorkshops: [],
    availableRecipes: [],
    availableRoles: [],
    availableCommodities: [],
    developmentPoints: 0,
    specializations: [],
    lastTickDay: worldDay,
    totalActivations: 0,
  }
}

// ============================================================
// SEED OPERATIONS
// ============================================================

/**
 * Add a knowledge seed to the pool.
 * Returns true if the seed is NEW (tag didn't exist before).
 */
export function addSeed(
  pool: KnowledgePool,
  tag: string,
  name: string,
  category: SeedCategory,
  source: SeedSource,
  discoveredBy: string,
  worldDay: number,
  resonance: number,
  narrative: string,
): boolean {
  // Check if this tag already exists
  if (pool.seeds.some(s => s.tag === tag)) return false
  
  pool.seeds.push({
    id: `seed_${++_seedId}`,
    tag,
    name,
    category,
    source,
    discoveredBy,
    discoveredOnDay: worldDay,
    resonance,
    narrative,
  })
  
  return true
}

/**
 * Check if all required seeds exist in the pool.
 */
export function hasSeeds(pool: KnowledgePool, tags: string[]): boolean {
  return tags.every(tag => pool.seeds.some(s => s.tag === tag))
}

/**
 * Get all seed tags in the pool.
 */
export function getSeedTags(pool: KnowledgePool): string[] {
  return pool.seeds.map(s => s.tag)
}

// ============================================================
// POTENTIAL SCANNING — Find new realizable potentials
// ============================================================

export interface HubContext {
  /** NPC roles present in this hub (from npc-agenda.ts) */
  npcRoles: string[]
  /** Commodities available in local market (from production-chain.ts) */
  commoditiesAvailable: string[]
  /** Hub population */
  population: number
  /** Does the hub have at least one trade edge? */
  hasTradeRoute: boolean
}

/**
 * Scan for potentials that are newly realizable given the current pool and hub state.
 * Returns potential IDs that haven't been activated yet and whose requirements are met.
 */
export function scanPotentials(
  pool: KnowledgePool,
  hubContext: HubContext,
  potentials: InfrastructurePotential[] = STANDARD_POTENTIALS,
): InfrastructurePotential[] {
  const realizable: InfrastructurePotential[] = []
  
  for (const pot of potentials) {
    // Skip already realized
    if (pool.realizedPotentials.includes(pot.id)) continue
    
    // Check seed requirements
    if (!hasSeeds(pool, pot.requiredSeeds)) continue
    
    // Check role requirements (at least one matching role in hub)
    if (pot.requiredRoles.length > 0) {
      const hasRole = pot.requiredRoles.some(role =>
        hubContext.npcRoles.includes(role)
      )
      if (!hasRole) continue
    }
    
    // Check commodity requirements
    if (pot.requiredCommodities.length > 0) {
      const hasCommodities = pot.requiredCommodities.every(c =>
        hubContext.commoditiesAvailable.includes(c)
      )
      if (!hasCommodities) continue
    }
    
    // Check population
    if (pot.requiredPopulation > hubContext.population) continue
    
    // Check trade route
    if (pot.requiresTradeRoute && !hubContext.hasTradeRoute) continue
    
    realizable.push(pot)
  }
  
  return realizable
}

// ============================================================
// ACTIVATION — Roll to realize a potential
// ============================================================

export interface ActivationResult {
  potentialId: string
  potentialName: string
  activated: boolean
  d20Roll: number
  dc: number
  resonanceBonus: number
  totalRoll: number
  unlocked: PotentialUnlock
  /** New seeds generated by this activation (cascading!) */
  newSeeds: string[]
  narrative: string
}

/**
 * Attempt to activate a potential. Uses a d20 + resonance bonus vs DC.
 * 
 * Resonance bonus = average resonance of the required seeds / 5 (max +4).
 * This means high-quality discoveries make activation easier.
 */
export function activatePotential(
  pool: KnowledgePool,
  potential: InfrastructurePotential,
  d20: number,
  worldDay: number,
): ActivationResult {
  // Calculate resonance bonus from the required seeds
  const relevantSeeds = pool.seeds.filter(s =>
    potential.requiredSeeds.includes(s.tag)
  )
  const avgResonance = relevantSeeds.length > 0
    ? relevantSeeds.reduce((sum, s) => sum + s.resonance, 0) / relevantSeeds.length
    : 0
  const resonanceBonus = Math.min(4, Math.floor(avgResonance / 5))
  
  const totalRoll = d20 + resonanceBonus
  const activated = totalRoll >= potential.activationDC

  if (!activated) {
    return {
      potentialId: potential.id,
      potentialName: potential.name,
      activated: false,
      d20Roll: d20,
      dc: potential.activationDC,
      resonanceBonus,
      totalRoll,
      unlocked: { },
      newSeeds: [],
      narrative: `${potential.name} remains unrealized (rolled ${totalRoll} vs DC ${potential.activationDC}).`,
    }
  }
  
  // Activate! Apply unlocks to the pool
  const unlocks = potential.unlocks
  
  if (unlocks.workshopType && !pool.availableWorkshops.includes(unlocks.workshopType)) {
    pool.availableWorkshops.push(unlocks.workshopType)
  }
  if (unlocks.recipes) {
    for (const r of unlocks.recipes) {
      if (!pool.availableRecipes.includes(r)) pool.availableRecipes.push(r)
    }
  }
  if (unlocks.roles) {
    for (const r of unlocks.roles) {
      if (!pool.availableRoles.includes(r)) pool.availableRoles.push(r)
    }
  }
  if (unlocks.commodities) {
    for (const c of unlocks.commodities) {
      if (!pool.availableCommodities.includes(c)) pool.availableCommodities.push(c)
    }
  }
  
  // Generate cascade seeds
  const newSeeds: string[] = []
  if (unlocks.seedsGenerated) {
    for (const tag of unlocks.seedsGenerated) {
      const added = addSeed(
        pool, tag, `${tag} (from ${potential.name})`, 'technique', 'research',
        'system', worldDay, 10, `Emerged from the development of ${potential.name}.`,
      )
      if (added) newSeeds.push(tag)
    }
  }
  
  pool.realizedPotentials.push(potential.id)
  pool.developmentPoints += potential.activationDC // Harder = more points
  pool.totalActivations++
  
  return {
    potentialId: potential.id,
    potentialName: potential.name,
    activated: true,
    d20Roll: d20,
    dc: potential.activationDC,
    resonanceBonus,
    totalRoll,
    unlocked: unlocks,
    newSeeds,
    narrative: `${potential.name} realized! ${Object.entries(unlocks)
      .filter(([_, v]) => v && (typeof v === 'string' || (Array.isArray(v) && v.length > 0)))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('. ')}.`,
  }
}

// ============================================================
// MONTHLY TICK — Full scan + activation cycle
// ============================================================

export interface KnowledgeTickResult {
  hubId: string
  worldDay: number
  newSeedsAdded: string[]
  potentialsScanned: number
  activationAttempts: ActivationResult[]
  totalActivations: number
  cascadeSeeds: string[]
  narrative: string
}

/**
 * Monthly tick for the knowledge pool.
 * 
 * 1. NPC research rolls (chance to discover new seeds)
 * 2. Scan for realizable potentials
 * 3. Attempt activation for each (one d20 per potential)
 * 4. Cascade: new seeds from activations might unlock MORE potentials
 * 
 * @param d20s — Deterministic seed array for rolls
 */
export function tickKnowledgePool(
  pool: KnowledgePool,
  hubContext: HubContext,
  worldDay: number,
  d20s: number[],
  potentials: InfrastructurePotential[] = STANDARD_POTENTIALS,
): KnowledgeTickResult {
  const result: KnowledgeTickResult = {
    hubId: pool.hubId,
    worldDay,
    newSeedsAdded: [],
    potentialsScanned: 0,
    activationAttempts: [],
    totalActivations: 0,
    cascadeSeeds: [],
    narrative: '',
  }

  let rollIndex = 0
  const nextD20 = () => d20s[rollIndex++ % d20s.length] ?? 10
  
  // Phase 1: NPC research — each researcher-type NPC can discover a seed
  // (This is a simplified version — the caller can pre-inject seeds for
  //  exploration/trade/player actions before calling tick)
  
  // Phase 2: Scan for realizable potentials (may run twice for cascade)
  for (let pass = 0; pass < 2; pass++) {
    const realizable = scanPotentials(pool, hubContext, potentials)
    result.potentialsScanned += realizable.length
    
    for (const pot of realizable) {
      const roll = nextD20()
      const activation = activatePotential(pool, pot, roll, worldDay)
      result.activationAttempts.push(activation)
      
      if (activation.activated) {
        result.totalActivations++
        
        // Track cascade seeds
        if (activation.newSeeds.length > 0) {
          result.cascadeSeeds.push(...activation.newSeeds)
        }
        
        // Update hub context with newly available roles/commodities
        // so the second pass can use them
        if (activation.unlocked.roles) {
          for (const r of activation.unlocked.roles) {
            if (!hubContext.npcRoles.includes(r)) hubContext.npcRoles.push(r)
          }
        }
        if (activation.unlocked.commodities) {
          for (const c of activation.unlocked.commodities) {
            if (!hubContext.commoditiesAvailable.includes(c)) {
              hubContext.commoditiesAvailable.push(c)
            }
          }
        }
      }
    }
    
    // If no cascade seeds were generated, skip second pass
    if (result.cascadeSeeds.length === 0) break
  }
  
  pool.lastTickDay = worldDay
  
  // Generate narrative
  const parts: string[] = []
  if (result.totalActivations > 0) {
    const names = result.activationAttempts
      .filter(a => a.activated)
      .map(a => a.potentialName)
    parts.push(`${result.totalActivations} breakthrough(s): ${names.join(', ')}`)
  }
  if (result.cascadeSeeds.length > 0) {
    parts.push(`cascade discoveries: ${result.cascadeSeeds.join(', ')}`)
  }
  result.narrative = parts.length > 0
    ? parts.join('. ')
    : 'No breakthroughs this month.'
  
  return result
}

// ============================================================
// ASCENSION — Fold character knowledge into hub pool
// ============================================================

/**
 * When a character ascends (becomes topological), all their
 * personal knowledge gets permanently merged into the hub pool.
 * 
 * Their unique discoveries get "inheritance" source, marking
 * them as part of the settlement's foundational knowledge.
 */
export function ascendCharacterKnowledge(
  pool: KnowledgePool,
  characterName: string,
  /** Tags the character has personally discovered or mastered */
  characterKnowledgeTags: string[],
  worldDay: number,
): string[] {
  const newSeeds: string[] = []
  
  for (const tag of characterKnowledgeTags) {
    const added = addSeed(
      pool, tag, `${tag} (legacy of ${characterName})`,
      'lore', 'inheritance',
      characterName, worldDay, 15, // High resonance — this is a founder's legacy
      `Part of the foundational knowledge established by ${characterName} upon their ascension.`,
    )
    if (added) newSeeds.push(tag)
  }
  
  return newSeeds
}
