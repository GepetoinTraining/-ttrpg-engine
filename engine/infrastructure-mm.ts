/**
 * INFRASTRUCTURE MM — Settlement Evolution Orchestrator
 * ======================================================
 * 
 * The MONTHLY TICK that makes settlements grow organically.
 * 
 * This isn't a tech tree. It's CONVERGENT EVOLUTION.
 * A settlement develops because its people discover things,
 * combine knowledge, and create new opportunities.
 * 
 * The flow:
 *   1. Knowledge Pool ticks → new potentials form
 *   2. Potentials activate → workshops, recipes, roles unlock
 *   3. Unlocked roles → new professions available → NPCs fill them
 *   4. Professions → guild formation threshold → guilds form
 *   5. Guilds → monopoly, training, bulk purchasing → economy deepens
 *   6. Deep economy → more trade → more seeds arrive → cycle repeats
 * 
 * Special rule:
 *   The ADVENTURERS GUILD is pre-seeded everywhere. Don't ask why. Magic.
 *   This means every settlement can receive dungeon intel, exploration
 *   seeds, and quest-driven knowledge from day 1.
 * 
 * Design principle:
 *   Seeds are hub-bound, not character-bound.
 *   Character ascension (.tp merge) preserves all seeds.
 *   Child inherits world parent built.
 */

import {
  createKnowledgePool,
  addSeed,
  tickKnowledgePool,
  ascendCharacterKnowledge,
  scanPotentials,
  type KnowledgePool,
  type HubContext,
  type KnowledgeTickResult,
} from './knowledge-pool'

// ============================================================
// PROFESSION — An NPC occupation driven by knowledge
// ============================================================

export type ProfessionTier = 'basic' | 'journeyman' | 'master' | 'expert'

export interface Profession {
  id: string
  role: string          // The role tag (matches knowledge pool + NPC agenda)
  name: string          // Human readable: "Blacksmith", "Alchemist"
  tier: ProfessionTier
  /** Knowledge seeds required for this profession to exist */
  requiredSeeds: string[]
  /** Guild type this profession belongs to (if any) */
  guildType: string | null
  /** Workshop type this profession works in */
  workshopType: string | null
  /** What this profession produces */
  outputs: string[]
  /** Minimum settlement population for this profession */
  minPopulation: number
}

// ============================================================
// STANDARD PROFESSIONS — The "periodic table" of work
// ============================================================

function prof(
  role: string, name: string, tier: ProfessionTier,
  requiredSeeds: string[], guildType: string | null,
  workshopType: string | null, outputs: string[],
  minPop: number = 0,
): Profession {
  return {
    id: `prof_${role}`,
    role, name, tier, requiredSeeds, guildType,
    workshopType, outputs, minPopulation: minPop,
  }
}

export const STANDARD_PROFESSIONS: Profession[] = [
  // ── Always available (no seeds required) ──
  prof('farmer', 'Farmer', 'basic', [], null, null, ['grain', 'vegetables'], 0),
  prof('laborer', 'Laborer', 'basic', [], null, null, ['labor'], 0),
  prof('hunter', 'Hunter', 'basic', [], null, null, ['meat', 'raw_hide', 'herbs'], 0),
  prof('fisherman', 'Fisherman', 'basic', [], null, null, ['fish'], 0),
  prof('healer', 'Healer', 'basic', [], null, null, ['healing'], 0),
  prof('guard', 'Guard', 'basic', [], null, null, ['protection'], 0),
  prof('miner', 'Miner', 'basic', [], null, null, ['iron_ore', 'stone', 'clay'], 0),
  prof('woodcutter', 'Woodcutter', 'basic', [], null, null, ['timber'], 0),

  // ── Tier 1: Require basic seeds ──
  prof('blacksmith', 'Blacksmith', 'journeyman', ['metalworking'], 'smiths', 'forge', ['iron_tools', 'weapons'], 50),
  prof('tanner', 'Tanner', 'journeyman', ['hide_processing'], 'tanners', 'tannery', ['leather'], 25),
  prof('baker', 'Baker', 'journeyman', ['grain_cultivation', 'fire_mastery'], 'bakers', 'bakery', ['bread'], 50),
  prof('brewer', 'Brewer', 'journeyman', ['fermentation'], 'brewers', 'brewery', ['ale', 'beer'], 50),
  prof('carpenter', 'Carpenter', 'journeyman', ['woodcraft'], 'carpenters', 'carpentry', ['furniture', 'wooden_tools'], 50),
  prof('weaver', 'Weaver', 'journeyman', ['cloth_weaving'], 'weavers', 'loom', ['cloth', 'clothing'], 50),
  prof('potter', 'Potter', 'journeyman', ['clay_working', 'kiln_building'], 'potters', 'pottery', ['pottery', 'bricks'], 30),

  // ── Tier 2: Require specialized knowledge ──
  prof('alchemist', 'Alchemist', 'master', ['herbalism', 'glassmaking'], 'alchemists', 'alchemy_lab', ['potions'], 100),
  prof('apothecary', 'Apothecary', 'journeyman', ['herbalism', 'medicine_knowledge'], 'apothecaries', 'apothecary', ['medicines'], 75),
  prof('armorsmith', 'Armorsmith', 'master', ['metalworking', 'leather_working'], 'smiths', 'armorsmith', ['armor'], 200),
  prof('weaponsmith', 'Weaponsmith', 'master', ['metalworking', 'weapon_design'], 'smiths', 'weaponsmith', ['weapons'], 200),
  prof('tailor', 'Tailor', 'journeyman', ['cloth_weaving', 'dyeing'], 'weavers', 'tailor', ['clothing', 'dyed_cloth'], 100),
  prof('mason', 'Mason', 'master', ['stone_cutting', 'mathematics'], 'masons', 'masonry', ['cut_stone', 'fortifications'], 500),
  prof('scribe', 'Scribe', 'journeyman', ['ink_making', 'literacy'], 'scribes', 'scriptorium', ['books', 'scrolls'], 200),

  // ── Tier 3: Expert professions ──
  prof('enchanter', 'Enchanter', 'expert', ['arcane_theory', 'enchantment_theory'], 'arcane', 'enchanting_circle', ['magic_items'], 500),
  prof('jeweler', 'Jeweler', 'master', ['gem_cutting', 'metalworking'], 'jewelers', 'jeweler_bench', ['jewelry'], 300),
  prof('goldsmith', 'Goldsmith', 'expert', ['metalworking', 'gem_cutting', 'artistry'], 'jewelers', 'goldsmith', ['fine_jewelry'], 500),
  prof('shipwright', 'Shipwright', 'master', ['woodcraft', 'sail_making', 'navigation'], 'shipwrights', 'shipyard', ['boats', 'ships'], 1000),
  prof('breeder', 'Breeder', 'master', ['animal_husbandry', 'selective_breeding'], null, null, ['livestock'], 100),

  // ── Adventurer (always present — pre-seeded guild) ──
  prof('adventurer', 'Adventurer', 'basic', [], 'adventurers', null, ['loot', 'quest_completion', 'exploration_intel'], 0),
]

// ============================================================
// GUILD FORMATION — When enough professionals exist
// ============================================================

export interface GuildFormationRule {
  guildType: string
  /** Minimum professionals of this type before guild forms */
  minProfessionals: number
  /** Minimum settlement population */
  minPopulation: number
  /** The guild name template */
  nameTemplate: string
  /** Is this guild pre-seeded (exists everywhere)? */
  preSeeded: boolean
}

export const GUILD_FORMATION_RULES: GuildFormationRule[] = [
  // Pre-seeded: adventurers guild exists everywhere
  { guildType: 'adventurers', minProfessionals: 0, minPopulation: 0,
    nameTemplate: "Adventurers' Guild", preSeeded: true },

  // Form when enough craftsmen gather
  { guildType: 'smiths', minProfessionals: 3, minPopulation: 200,
    nameTemplate: "Smiths' Guild", preSeeded: false },
  { guildType: 'masons', minProfessionals: 3, minPopulation: 500,
    nameTemplate: "Masons' Guild", preSeeded: false },
  { guildType: 'carpenters', minProfessionals: 3, minPopulation: 200,
    nameTemplate: "Carpenters' Guild", preSeeded: false },
  { guildType: 'weavers', minProfessionals: 3, minPopulation: 200,
    nameTemplate: "Weavers' Guild", preSeeded: false },
  { guildType: 'tanners', minProfessionals: 2, minPopulation: 100,
    nameTemplate: "Tanners' Guild", preSeeded: false },
  { guildType: 'potters', minProfessionals: 2, minPopulation: 100,
    nameTemplate: "Potters' Guild", preSeeded: false },
  { guildType: 'alchemists', minProfessionals: 2, minPopulation: 300,
    nameTemplate: "Alchemists' Guild", preSeeded: false },
  { guildType: 'apothecaries', minProfessionals: 2, minPopulation: 200,
    nameTemplate: "Apothecaries' Guild", preSeeded: false },
  { guildType: 'brewers', minProfessionals: 2, minPopulation: 150,
    nameTemplate: "Brewers' Guild", preSeeded: false },
  { guildType: 'bakers', minProfessionals: 2, minPopulation: 150,
    nameTemplate: "Bakers' Guild", preSeeded: false },
  { guildType: 'merchants', minProfessionals: 3, minPopulation: 300,
    nameTemplate: "Merchants' Guild", preSeeded: false },
  { guildType: 'scribes', minProfessionals: 2, minPopulation: 500,
    nameTemplate: "Scribes' Guild", preSeeded: false },
  { guildType: 'jewelers', minProfessionals: 2, minPopulation: 500,
    nameTemplate: "Jewelers' Guild", preSeeded: false },
  { guildType: 'arcane', minProfessionals: 2, minPopulation: 1000,
    nameTemplate: "Arcane Order", preSeeded: false },
  { guildType: 'shipwrights', minProfessionals: 3, minPopulation: 1000,
    nameTemplate: "Shipwrights' Guild", preSeeded: false },
  { guildType: 'innkeepers', minProfessionals: 3, minPopulation: 200,
    nameTemplate: "Innkeepers' Guild", preSeeded: false },
  { guildType: 'entertainers', minProfessionals: 3, minPopulation: 300,
    nameTemplate: "Entertainers' Guild", preSeeded: false },
]

// ============================================================
// INFRASTRUCTURE STATE — Per settlement
// ============================================================

export interface InfrastructureState {
  hubId: string
  hubName: string
  /** Settlement tier (drives what's possible) */
  tier: 1 | 2 | 3 | 4 | 5  // Hamlet → Village → Town → City → Capital
  /** Population */
  population: number
  /** Has at least one trade connection */
  hasTradeRoute: boolean

  /** The knowledge engine */
  knowledgePool: KnowledgePool

  /** Active professionals in this settlement */
  activeProfessions: Map<string, number>  // role → count

  /** Formed guilds */
  formedGuilds: string[]  // guild types

  /** What workshops exist */
  workshops: string[]  // workshop types

  /** Available recipes */
  recipes: string[]

  /** Available commodities in local market */
  commodities: string[]

  /** Development score (all-time) */
  developmentScore: number

  /** Settlement specializations */
  specializations: string[]

  /** Tracking */
  lastTickDay: number
  totalMonthsTicked: number
}

// ============================================================
// FACTORY
// ============================================================

export function createInfrastructure(
  hubId: string, hubName: string, population: number,
  worldDay: number, tier: InfrastructureState['tier'] = 1,
): InfrastructureState {
  const state: InfrastructureState = {
    hubId,
    hubName,
    tier,
    population,
    hasTradeRoute: false,
    knowledgePool: createKnowledgePool(hubId, worldDay),
    activeProfessions: new Map(),
    formedGuilds: ['adventurers'], // Pre-seeded. Don't ask why. Magic.
    workshops: [],
    recipes: [],
    commodities: [],
    developmentScore: 0,
    specializations: [],
    lastTickDay: worldDay,
    totalMonthsTicked: 0,
  }

  // Seed basic professions that exist everywhere
  for (const prof of STANDARD_PROFESSIONS) {
    if (prof.requiredSeeds.length === 0 && population >= prof.minPopulation) {
      // Basic professions: population-proportional count
      const base = prof.role === 'adventurer' ? 1 : Math.max(1, Math.floor(population / 50))
      state.activeProfessions.set(prof.role, base)
    }
  }

  return state
}

// ============================================================
// PROFESSION EVALUATION — Which professions can exist?
// ============================================================

/**
 * Evaluate which professions can NOW exist in this settlement,
 * given its knowledge pool and population.
 */
export function evaluateProfessions(state: InfrastructureState): Profession[] {
  const available: Profession[] = []

  for (const prof of STANDARD_PROFESSIONS) {
    // Population check
    if (state.population < prof.minPopulation) continue

    // Seed check: does the knowledge pool contain all required seeds?
    if (prof.requiredSeeds.length > 0) {
      const poolTags = state.knowledgePool.seeds.map(s => s.tag)
      const hasAll = prof.requiredSeeds.every(tag => poolTags.includes(tag))
      if (!hasAll) continue
    }

    // Workshop check: if profession needs a workshop, must be available
    if (prof.workshopType && !state.workshops.includes(prof.workshopType)) {
      // Unless the knowledge pool just unlocked it
      if (!state.knowledgePool.availableWorkshops.includes(prof.workshopType)) continue
    }

    available.push(prof)
  }

  return available
}

// ============================================================
// GUILD FORMATION CHECK
// ============================================================

export interface GuildFormationEvent {
  guildType: string
  guildName: string
  professionalCount: number
  narrative: string
}

/**
 * Check if any new guilds should form.
 */
export function checkGuildFormation(state: InfrastructureState): GuildFormationEvent[] {
  const events: GuildFormationEvent[] = []

  for (const rule of GUILD_FORMATION_RULES) {
    // Skip pre-seeded (already formed)
    if (rule.preSeeded) continue

    // Skip already formed
    if (state.formedGuilds.includes(rule.guildType)) continue

    // Population check
    if (state.population < rule.minPopulation) continue

    // Count relevant professionals
    let profCount = 0
    for (const prof of STANDARD_PROFESSIONS) {
      if (prof.guildType === rule.guildType) {
        profCount += state.activeProfessions.get(prof.role) ?? 0
      }
    }

    if (profCount >= rule.minProfessionals) {
      events.push({
        guildType: rule.guildType,
        guildName: rule.nameTemplate,
        professionalCount: profCount,
        narrative: `The ${rule.nameTemplate} forms in ${state.hubName} with ${profCount} founding members.`,
      })
    }
  }

  return events
}

// ============================================================
// INFRASTRUCTURE TICK — The monthly heartbeat
// ============================================================

export interface InfrastructureTickResult {
  hubId: string
  hubName: string
  worldDay: number
  month: number

  /** Knowledge pool results */
  knowledgeResult: KnowledgeTickResult

  /** New professions that became available */
  newProfessions: string[]
  /** New guilds that formed */
  newGuilds: GuildFormationEvent[]
  /** New workshops that appeared */
  newWorkshops: string[]
  /** New commodities producible */
  newCommodities: string[]

  /** Total development change */
  developmentDelta: number

  /** Narrative summary */
  narrative: string
}

/**
 * Tick a settlement's infrastructure forward one month.
 * 
 * @param d20s — Deterministic roll array for knowledge activation
 */
export function tickInfrastructure(
  state: InfrastructureState,
  worldDay: number,
  d20s: number[],
): InfrastructureTickResult {
  const beforeWorkshops = [...state.workshops]
  const beforeGuilds = [...state.formedGuilds]
  const beforeCommodities = [...state.commodities]
  const beforeProfessions = new Set(state.activeProfessions.keys())

  // ── Phase 1: Knowledge Pool Tick ──
  const hubContext: HubContext = {
    npcRoles: Array.from(state.activeProfessions.keys()),
    commoditiesAvailable: state.commodities,
    population: state.population,
    hasTradeRoute: state.hasTradeRoute,
  }

  const knowledgeResult = tickKnowledgePool(
    state.knowledgePool, hubContext, worldDay, d20s,
  )

  // ── Phase 2: Sync unlocked workshops/commodities/recipes ──
  for (const w of state.knowledgePool.availableWorkshops) {
    if (!state.workshops.includes(w)) state.workshops.push(w)
  }
  for (const r of state.knowledgePool.availableRecipes) {
    if (!state.recipes.includes(r)) state.recipes.push(r)
  }
  for (const c of state.knowledgePool.availableCommodities) {
    if (!state.commodities.includes(c)) state.commodities.push(c)
  }

  // ── Phase 3: Evaluate professions ──
  const availableProfessions = evaluateProfessions(state)
  const newProfessions: string[] = []

  for (const prof of availableProfessions) {
    if (!state.activeProfessions.has(prof.role)) {
      // New profession! Start with 1 NPC
      state.activeProfessions.set(prof.role, 1)
      newProfessions.push(prof.name)
    }
  }

  // Also add roles from knowledge pool
  for (const role of state.knowledgePool.availableRoles) {
    if (!state.activeProfessions.has(role)) {
      state.activeProfessions.set(role, 1)
      if (!newProfessions.includes(role)) {
        newProfessions.push(role)
      }
    }
  }

  // ── Phase 4: Guild formation ──
  const newGuilds = checkGuildFormation(state)
  for (const ge of newGuilds) {
    state.formedGuilds.push(ge.guildType)
  }

  // ── Phase 5: Development scoring ──
  const newWorkshops = state.workshops.filter(w => !beforeWorkshops.includes(w))
  const newCommodities = state.commodities.filter(c => !beforeCommodities.includes(c))

  const developmentDelta =
    knowledgeResult.totalActivations * 10 +
    newProfessions.length * 5 +
    newGuilds.length * 20 +
    newWorkshops.length * 8 +
    newCommodities.length * 3

  state.developmentScore += developmentDelta

  // ── Phase 6: Tier advancement check ──
  checkTierAdvancement(state)

  // ── Tracking ──
  state.lastTickDay = worldDay
  state.totalMonthsTicked++

  // ── Narrative ──
  const parts: string[] = []
  if (knowledgeResult.totalActivations > 0) {
    parts.push(knowledgeResult.narrative)
  }
  if (newProfessions.length > 0) {
    parts.push(`New professions: ${newProfessions.join(', ')}`)
  }
  if (newGuilds.length > 0) {
    parts.push(newGuilds.map(g => g.narrative).join(' '))
  }
  if (newWorkshops.length > 0) {
    parts.push(`New workshops: ${newWorkshops.join(', ')}`)
  }
  const narrative = parts.length > 0
    ? `Month ${state.totalMonthsTicked}: ${parts.join('. ')}.`
    : `Month ${state.totalMonthsTicked}: Steady progress in ${state.hubName}.`

  return {
    hubId: state.hubId,
    hubName: state.hubName,
    worldDay,
    month: state.totalMonthsTicked,
    knowledgeResult,
    newProfessions,
    newGuilds,
    newWorkshops,
    newCommodities,
    developmentDelta,
    narrative,
  }
}

// ============================================================
// TIER ADVANCEMENT
// ============================================================

const TIER_THRESHOLDS: Record<number, { pop: number; dev: number; guilds: number }> = {
  1: { pop: 0, dev: 0, guilds: 0 },        // Hamlet
  2: { pop: 100, dev: 50, guilds: 1 },      // Village
  3: { pop: 500, dev: 200, guilds: 3 },     // Town
  4: { pop: 2000, dev: 500, guilds: 6 },    // City
  5: { pop: 10000, dev: 1000, guilds: 10 }, // Capital
}

function checkTierAdvancement(state: InfrastructureState): void {
  for (let tier = 5; tier >= 2; tier--) {
    const req = TIER_THRESHOLDS[tier]
    if (
      state.population >= req.pop &&
      state.developmentScore >= req.dev &&
      state.formedGuilds.length >= req.guilds &&
      state.tier < tier
    ) {
      state.tier = tier as InfrastructureState['tier']
      break
    }
  }
}

// ============================================================
// SEED INJECTION HELPERS
// ============================================================

/**
 * Inject seeds from exploration (NPC party returns from edge traversal).
 */
export function injectExplorationSeeds(
  state: InfrastructureState,
  discoveries: Array<{ tag: string; name: string; category: 'material' | 'creature' | 'botanical' | 'geography' }>,
  discoveredBy: string,
  worldDay: number,
): string[] {
  const added: string[] = []
  for (const d of discoveries) {
    const ok = addSeed(
      state.knowledgePool, d.tag, d.name, d.category,
      'exploration', discoveredBy, worldDay,
      Math.floor(Math.random() * 10) + 5, // 5-14 resonance
      `Discovered during exploration by ${discoveredBy}.`,
    )
    if (ok) added.push(d.tag)
  }
  return added
}

/**
 * Inject seeds from trade (foreign merchant arrives).
 */
export function injectTradeSeeds(
  state: InfrastructureState,
  techniques: Array<{ tag: string; name: string }>,
  merchantName: string,
  worldDay: number,
): string[] {
  const added: string[] = []
  for (const t of techniques) {
    const ok = addSeed(
      state.knowledgePool, t.tag, t.name, 'technique',
      'trade', merchantName, worldDay, 8,
      `Technique brought by ${merchantName} via trade route.`,
    )
    if (ok) added.push(t.tag)
  }
  return added
}

/**
 * Inject seeds from a player action (high resonance!).
 */
export function injectPlayerDiscovery(
  state: InfrastructureState,
  tag: string, name: string,
  category: 'material' | 'technique' | 'creature' | 'botanical' | 'lore',
  playerName: string,
  worldDay: number,
  narrative: string,
): boolean {
  return addSeed(
    state.knowledgePool, tag, name, category,
    'player_action', playerName, worldDay,
    18, // High resonance — player discoveries are potent
    narrative,
  )
}

/**
 * Inject seeds from NPC research (monthly roll by scholars).
 */
export function injectResearchSeed(
  state: InfrastructureState,
  tag: string, name: string,
  researcherName: string,
  worldDay: number,
  d20: number,
): boolean {
  // DC 15 to discover something through research
  if (d20 < 15) return false

  return addSeed(
    state.knowledgePool, tag, name, 'lore',
    'research', researcherName, worldDay,
    Math.min(20, d20), // Resonance = the roll itself
    `Discovered through systematic study by ${researcherName}.`,
  )
}

/**
 * Ascend a character — merge their knowledge into the settlement.
 * The character becomes topological. Their child plays next.
 */
export function ascendCharacter(
  state: InfrastructureState,
  characterName: string,
  characterKnowledge: string[],
  worldDay: number,
): { newSeeds: string[]; narrative: string } {
  const newSeeds = ascendCharacterKnowledge(
    state.knowledgePool, characterName, characterKnowledge, worldDay,
  )

  const narrative = newSeeds.length > 0
    ? `${characterName} ascends to lordship of ${state.hubName}. Their legacy: ${newSeeds.join(', ')}.`
    : `${characterName} ascends to lordship of ${state.hubName}.`

  return { newSeeds, narrative }
}

// ============================================================
// SNAPSHOT — Serializable state summary
// ============================================================

export interface InfrastructureSnapshot {
  hubId: string
  hubName: string
  tier: number
  tierName: string
  population: number
  developmentScore: number
  seedCount: number
  professionCount: number
  professions: string[]
  guildCount: number
  guilds: string[]
  workshopCount: number
  workshops: string[]
  commodityCount: number
  specializations: string[]
  monthsTicked: number
}

const TIER_NAMES = ['Hamlet', 'Village', 'Town', 'City', 'Capital'] as const

export function snapshotInfrastructure(state: InfrastructureState): InfrastructureSnapshot {
  return {
    hubId: state.hubId,
    hubName: state.hubName,
    tier: state.tier,
    tierName: TIER_NAMES[state.tier - 1],
    population: state.population,
    developmentScore: state.developmentScore,
    seedCount: state.knowledgePool.seeds.length,
    professionCount: state.activeProfessions.size,
    professions: Array.from(state.activeProfessions.keys()),
    guildCount: state.formedGuilds.length,
    guilds: state.formedGuilds,
    workshopCount: state.workshops.length,
    workshops: state.workshops,
    commodityCount: state.commodities.length,
    specializations: state.specializations,
    monthsTicked: state.totalMonthsTicked,
  }
}
