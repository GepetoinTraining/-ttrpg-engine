/**
 * LORE — Knowledge as a Resource
 * ==================================================
 *
 * Knowledge is topology. Candlekeep IS a .tp node.
 * Books are items. Rumors are volatile knowledge with decay.
 * Research converts time + skill → new knowledge entries.
 *
 * Knowledge creation pipeline:
 *   observation → rumor → study → lore → codified (book)
 *
 * Libraries are .tp nodes with knowledge density.
 * Guilds, temples, and factions all have knowledge reserves.
 *
 * Monthly tick:
 *   - Rumors decay (lose fidelity, eventually vanish)
 *   - Libraries grow from research + donated books
 *   - Knowledge spreads along trade routes via bards/caravans
 */

// ============================================================
// KNOWLEDGE TYPES
// ============================================================

export type KnowledgeCategory =
  | 'history' | 'geography' | 'arcana' | 'religion'
  | 'nature' | 'politics' | 'military' | 'trade'
  | 'crafting' | 'monster' | 'planar' | 'secret'

export type KnowledgeForm =
  | 'rumor'          // volatile, decays, may be false
  | 'oral_tradition' // passed down, slow to spread
  | 'observation'    // firsthand, reliable but personal
  | 'lore'           // studied, verified
  | 'codified'       // written in a book, permanent
  | 'forbidden'      // dangerous knowledge, restricted access

export interface KnowledgeEntry {
  id: string
  topic: string
  category: KnowledgeCategory
  form: KnowledgeForm
  /** 0.0 = pure fiction, 1.0 = absolute truth */
  accuracy: number
  /** How widely known (0 = secret, 100 = common knowledge) */
  spread: number
  /** World day when created/discovered */
  discoveredDay: number
  /** Who/what holds this knowledge */
  holderId: string
  holderType: 'character' | 'npc' | 'library' | 'guild' | 'faction' | 'settlement'
  /** DC to discover via research */
  researchDC: number
  /** Optional: the actual content/description */
  content?: string
}

// ============================================================
// RUMOR — Volatile knowledge
// ============================================================

export interface Rumor extends KnowledgeEntry {
  form: 'rumor'
  /** Fidelity: how much the rumor has mutated from truth (0-1) */
  fidelity: number
  /** Days until this rumor is forgotten */
  decayDaysRemaining: number
  /** Source chain: who told whom */
  sourceChain: string[]
}

/**
 * Create a rumor from an observation or event.
 * Rumors start with high fidelity and decay over time.
 */
export function createRumor(
  topic: string,
  category: KnowledgeCategory,
  accuracy: number,
  holderId: string,
  sourceNpcId: string,
  worldDay: number,
  decayDays: number = 60,
): Rumor {
  return {
    id: `rumor_${holderId}_${worldDay}`,
    topic,
    category,
    form: 'rumor',
    accuracy,
    spread: 1,
    discoveredDay: worldDay,
    holderId,
    holderType: 'npc',
    researchDC: 5, // rumors are easy to "find" but hard to verify
    fidelity: 1.0,
    decayDaysRemaining: decayDays,
    sourceChain: [sourceNpcId],
  }
}

/**
 * Spread a rumor to another NPC.
 * Each retelling has a chance to mutate (reduce fidelity).
 */
export function spreadRumor(rumor: Rumor, toNpcId: string, d20: number): Rumor {
  const fidelityLoss = d20 >= 15 ? 0 : d20 >= 10 ? 0.05 : 0.1
  return {
    ...rumor,
    id: `${rumor.id}_spread_${toNpcId}`,
    holderId: toNpcId,
    fidelity: Math.max(0, rumor.fidelity - fidelityLoss),
    spread: rumor.spread + 1,
    sourceChain: [...rumor.sourceChain, toNpcId],
    // Accuracy degrades with fidelity
    accuracy: rumor.accuracy * Math.max(0, rumor.fidelity - fidelityLoss),
  }
}

/**
 * Weekly rumor decay. Rumors lose days and fidelity.
 * Returns true if rumor should be removed (forgotten).
 */
export function decayRumor(rumor: Rumor, daysPassed: number): boolean {
  rumor.decayDaysRemaining -= daysPassed
  rumor.fidelity = Math.max(0, rumor.fidelity - 0.02 * daysPassed)
  return rumor.decayDaysRemaining <= 0 || rumor.fidelity <= 0
}

// ============================================================
// LIBRARIES — Knowledge .tp nodes
// ============================================================

export type LibraryTier = 'private_shelf' | 'guild_archive' | 'civic_library' | 'great_library' | 'wonder'

export const LIBRARY_CAPACITY: Record<LibraryTier, number> = {
  private_shelf: 20,
  guild_archive: 100,
  civic_library: 500,
  great_library: 2000,   // Candlekeep
  wonder:        10000,  // mythical repository
}

export const LIBRARY_RESEARCH_BONUS: Record<LibraryTier, number> = {
  private_shelf: 1,
  guild_archive: 3,
  civic_library: 5,
  great_library: 10,
  wonder:        20,
}

export interface Library {
  id: string
  name: string
  nodeId: string          // .tp node
  settlementId: string
  tier: LibraryTier
  bookCount: number
  /** Knowledge entries cataloged here */
  knowledgeIds: string[]
  /** Entry fee (Candlekeep requires a book donation, not gold) */
  entryRequirement: 'free' | 'fee' | 'membership' | 'book_donation' | 'invitation'
  /** Faction that controls this library */
  controllingFactionId?: string
}

// ============================================================
// RESEARCH — Converting time into knowledge
// ============================================================

export interface ResearchAttempt {
  researcherId: string   // character or NPC
  libraryId?: string     // optional: researching at a library
  topic: string
  category: KnowledgeCategory
  skillMod: number       // Int + relevant proficiency
  daysSpent: number
  d20: number
}

export interface ResearchResult {
  success: boolean
  knowledgeEntry?: KnowledgeEntry
  d20: number
  totalCheck: number
  daysSpent: number
  /** Knowledge form depends on check result */
  formDiscovered?: KnowledgeForm
}

/**
 * Attempt research. Higher check + more time + better library = better results.
 * DC modified by: library bonus, days spent, category rarity.
 */
export function attemptResearch(
  attempt: ResearchAttempt,
  baseDC: number,
  library?: Library,
): ResearchResult {
  const libraryBonus = library ? LIBRARY_RESEARCH_BONUS[library.tier] : 0
  const timeBonus = Math.floor(attempt.daysSpent / 7) // +1 per week spent
  const totalCheck = attempt.d20 + attempt.skillMod + libraryBonus + timeBonus
  const effectiveDC = baseDC

  if (totalCheck < effectiveDC) {
    return { success: false, d20: attempt.d20, totalCheck, daysSpent: attempt.daysSpent }
  }

  // Quality of knowledge depends on margin of success
  const margin = totalCheck - effectiveDC
  let form: KnowledgeForm
  if (margin >= 15) form = 'codified'       // publishable quality
  else if (margin >= 10) form = 'lore'      // verified knowledge
  else if (margin >= 5) form = 'observation' // personal insight
  else form = 'oral_tradition'               // rough understanding

  return {
    success: true,
    d20: attempt.d20,
    totalCheck,
    daysSpent: attempt.daysSpent,
    formDiscovered: form,
    knowledgeEntry: {
      id: `know_${attempt.researcherId}_${attempt.topic}`,
      topic: attempt.topic,
      category: attempt.category,
      form,
      accuracy: Math.min(1, 0.5 + margin * 0.03),
      spread: 0,
      discoveredDay: 0, // caller sets this
      holderId: attempt.researcherId,
      holderType: 'character',
      researchDC: baseDC,
    },
  }
}

// ============================================================
// BOOK — Codified knowledge (item in inventory)
// ============================================================

export interface Book {
  id: string
  title: string
  author: string
  knowledgeIds: string[]   // knowledge entries contained
  category: KnowledgeCategory
  language: string
  /** Rarity as item */
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary'
  /** Value in GP */
  valueGP: number
  /** Can be copied? (some are originals only) */
  copyable: boolean
}

/**
 * Value a book based on its contents.
 * Rare categories + more knowledge entries = higher value.
 */
export function appraiseBook(book: Book): number {
  const categoryMul: Record<KnowledgeCategory, number> = {
    history: 1, geography: 1, nature: 1, trade: 1,
    crafting: 2, religion: 2, politics: 2,
    arcana: 3, military: 3, monster: 3,
    planar: 5, secret: 10,
  }
  const base = book.knowledgeIds.length * 10
  const rarityMul = { common: 1, uncommon: 2, rare: 5, very_rare: 20, legendary: 100 }
  return base * (categoryMul[book.category] ?? 1) * rarityMul[book.rarity]
}

// ============================================================
// KNOWLEDGE NETWORK — How knowledge flows
// ============================================================

export interface KnowledgeFlowResult {
  settlementId: string
  newRumors: number
  knowledgeDisseminated: number
  booksTraded: number
}

/**
 * Calculate knowledge flow along a trade route (weekly).
 * Caravans carry books + bards carry rumors.
 * Settlements with libraries absorb more.
 */
export function knowledgeFlowTick(
  sourceSettlementId: string,
  targetSettlementId: string,
  rumorsInTransit: number,
  booksInTransit: number,
  targetLibrary?: Library,
): KnowledgeFlowResult {
  const libraryAbsorption = targetLibrary ? LIBRARY_RESEARCH_BONUS[targetLibrary.tier] : 1
  return {
    settlementId: targetSettlementId,
    newRumors: rumorsInTransit,
    knowledgeDisseminated: Math.floor(rumorsInTransit * libraryAbsorption / 5),
    booksTraded: booksInTransit,
  }
}
