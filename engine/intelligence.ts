/**
 * INTELLIGENCE LAYER — Bounded AI Agent Consciousness
 * =====================================================
 *
 * Every AI agent (NPC, narrator, GM assistant) has:
 *   - IDENTITY: Who they ARE (personality, values, speech patterns)
 *   - KNOWLEDGE: What they KNOW (bounded — no omniscience)
 *   - MEMORY: What they REMEMBER (episodic, semantic, emotional)
 *   - CONTEXT: Assembled prompt within token budget
 *
 * The key insight: AI agents are NOT omniscient.
 * An NPC blacksmith doesn't know about the dragon attack 3 towns over.
 * The GM narrator knows everything. The tavern keeper knows gossip.
 *
 * KNOWLEDGE BOUNDARIES enforce this:
 *   - Personal: What they've experienced
 *   - Witnessed: What they've seen happen
 *   - Location: What's common knowledge at their node
 *   - Faction: What their faction shares
 *   - World: Common lore everyone knows
 *   - Party: What the party has told them (interactions in npc-agenda)
 *
 * Each agent type has different boundary permissions.
 * This prevents AI from leaking information the NPC wouldn't know.
 */

// ============================================================
// AGENT TYPE — Who/what is this intelligence?
// ============================================================

export type AgentType =
  | 'npc'            // A named NPC with personality and secrets
  | 'creature'       // A monster or animal (limited intelligence)
  | 'narrator'       // The voice describing the world (omniscient)
  | 'world'          // Nature, weather, environmental descriptions
  | 'faction'        // A faction's collective voice (leader speaks)
  | 'lair'           // A dungeon or location with its own "personality"
  | 'gm_assistant'   // AI helping the human DM
  | 'orchestrator'   // The AI GM itself (full control modes)

// ============================================================
// IDENTITY ANCHOR — Who they are at the core
// ============================================================

export interface PersonalityTraits {
  values: string[]      // What they believe in
  fears: string[]       // What they're afraid of
  desires: string[]     // What they want
  quirks: string[]      // Behavioral oddities
  flaws: string[]       // Character weaknesses
}

export interface SpeechPattern {
  vocabulary: 'simple' | 'educated' | 'scholarly' | 'archaic' | 'slang' | 'military' | 'merchant'
  sentenceLength: 'terse' | 'normal' | 'verbose'
  formality: 'crude' | 'casual' | 'formal' | 'courtly'
  accent?: string           // "Dwarven lilt", "Elvish cadence"
  catchphrases?: string[]   // Recurring expressions
  avoids?: string[]         // Words/topics they never use
}

export interface AgentConstraints {
  canReveal: string[]       // Topics they CAN discuss
  cannotReveal: string[]    // Topics they MUST NOT discuss (spoiler protection)
  mustMention: string[]     // Topics they MUST bring up when relevant
  canLie: boolean           // Can they deceive?
  canFight: boolean         // Will they resort to violence?
  canTrade: boolean         // Will they trade?
}

export interface IdentityAnchor {
  agentId: string
  agentType: AgentType
  name: string
  title?: string
  /** One-sentence core identity */
  coreIdentity: string
  /** Personality */
  personality: PersonalityTraits
  /** How they talk */
  speech: SpeechPattern
  /** What they can/cannot do */
  constraints: AgentConstraints
  /** Relationship to the party */
  partyRelationship: string
}

// ============================================================
// KNOWLEDGE BOUNDARY — What they know and DON'T know
// ============================================================

export type KnowledgeScope = 'personal' | 'witnessed' | 'location' | 'faction' | 'world' | 'party'

export interface KnowledgeEntry {
  scope: KnowledgeScope
  topic: string
  content: string
  /** Confidence: how sure are they? */
  confidence: 'certain' | 'probable' | 'rumor' | 'speculation'
  /** Is this actually true? (GM-only) */
  isTrue: boolean
  /** Source */
  source: string
}

export interface KnowledgeBoundary {
  /** What they know */
  entries: KnowledgeEntry[]
  /** What they explicitly DON'T know — prevents AI leaking */
  exclusions: string[]
  /** Scope permissions by agent type */
  allowedScopes: KnowledgeScope[]
}

/** Default knowledge scope permissions by agent type */
export const AGENT_KNOWLEDGE_DEFAULTS: Record<AgentType, KnowledgeScope[]> = {
  npc:           ['personal', 'witnessed', 'location', 'faction', 'party'],
  creature:      ['personal', 'witnessed'],
  narrator:      ['personal', 'witnessed', 'location', 'faction', 'world', 'party'],
  world:         ['world'],
  faction:       ['faction', 'world'],
  lair:          ['personal', 'location'],
  gm_assistant:  ['personal', 'witnessed', 'location', 'faction', 'world', 'party'],
  orchestrator:  ['personal', 'witnessed', 'location', 'faction', 'world', 'party'],
}

/**
 * Filter knowledge entries to only what this agent is allowed to know.
 * Enforces the knowledge boundary — prevents omniscience.
 */
export function filterKnowledge(
  entries: KnowledgeEntry[],
  boundary: KnowledgeBoundary,
): KnowledgeEntry[] {
  return entries.filter(e => {
    // Must be in allowed scopes
    if (!boundary.allowedScopes.includes(e.scope)) return false
    // Must not be in exclusions
    if (boundary.exclusions.some(ex => e.topic.toLowerCase().includes(ex.toLowerCase()))) return false
    return true
  })
}

// ============================================================
// MEMORY PROTOCOL — What they remember
// ============================================================

export type MemoryType = 'episodic' | 'semantic' | 'emotional'

export interface AgentMemory {
  id: string
  memoryType: MemoryType
  content: string
  /** When it happened (world day) */
  worldDay: number
  /** How important (1-10) */
  importance: number
  /** Decay factor — memories fade (0 = forgotten, 1 = vivid) */
  vividness: number
  /** Tags for retrieval */
  tags: string[]
  /** Related entity */
  entityId?: string
  entityName?: string
  /** Emotional valence (-10 negative to +10 positive) */
  valence: number
}

/**
 * Decay memories over time.
 * Important memories decay slower.
 * Emotional memories decay slowest.
 */
export function decayMemories(memories: AgentMemory[], currentDay: number): AgentMemory[] {
  return memories.map(m => {
    const daysSince = currentDay - m.worldDay
    // Base decay: 2% per day, halved for important, quartered for emotional
    let decayRate = 0.02
    if (m.importance >= 7) decayRate *= 0.5
    if (m.memoryType === 'emotional') decayRate *= 0.25
    if (m.importance >= 9) decayRate *= 0.1 // Nearly permanent

    const newVividness = Math.max(0, m.vividness - daysSince * decayRate)
    return { ...m, vividness: newVividness }
  })
}

/**
 * Retrieve relevant memories for a given context.
 * Matches by tags and filters out forgotten memories.
 */
export function retrieveMemories(
  memories: AgentMemory[],
  tags: string[],
  minVividness = 0.1,
  limit = 10,
): AgentMemory[] {
  return memories
    .filter(m => m.vividness >= minVividness)
    .filter(m => tags.length === 0 || m.tags.some(t => tags.includes(t)))
    .sort((a, b) => {
      // Sort by relevance (tag match count) * vividness * importance
      const aRelevance = a.tags.filter(t => tags.includes(t)).length
      const bRelevance = b.tags.filter(t => tags.includes(t)).length
      return (bRelevance * b.vividness * b.importance) - (aRelevance * a.vividness * a.importance)
    })
    .slice(0, limit)
}

// ============================================================
// CONTEXT BUDGETING — Fit everything in the token window
// ============================================================

export interface ContextSection {
  name: string
  content: string
  priority: number       // 1 (must include) to 10 (drop first)
  estimatedTokens: number
}

export interface ContextBudget {
  maxTokens: number
  sections: ContextSection[]
}

/**
 * Rough token estimation: ~4 chars per token for English.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Assemble context within token budget.
 * Includes sections in priority order, drops lowest priority first.
 */
export function assembleContext(budget: ContextBudget): { assembled: string; includedSections: string[]; droppedSections: string[] } {
  // Sort by priority (1 = highest, 10 = lowest)
  const sorted = [...budget.sections].sort((a, b) => a.priority - b.priority)

  let totalTokens = 0
  const included: ContextSection[] = []
  const dropped: string[] = []

  for (const section of sorted) {
    if (totalTokens + section.estimatedTokens <= budget.maxTokens) {
      included.push(section)
      totalTokens += section.estimatedTokens
    } else {
      dropped.push(section.name)
    }
  }

  return {
    assembled: included.map(s => `## ${s.name}\n${s.content}`).join('\n\n'),
    includedSections: included.map(s => s.name),
    droppedSections: dropped,
  }
}

// ============================================================
// PROMPT BUILDERS — Structured prompt sections
// ============================================================

export function buildIdentityPrompt(anchor: IdentityAnchor): ContextSection {
  const lines: string[] = [
    `You are ${anchor.name}${anchor.title ? `, ${anchor.title}` : ''}.`,
    anchor.coreIdentity,
    '',
    `Personality: ${anchor.personality.values.join(', ')}`,
    `Fears: ${anchor.personality.fears.join(', ')}`,
    `Desires: ${anchor.personality.desires.join(', ')}`,
  ]

  if (anchor.personality.quirks.length > 0) {
    lines.push(`Quirks: ${anchor.personality.quirks.join(', ')}`)
  }

  lines.push('')
  lines.push(`Speech: ${anchor.speech.vocabulary}, ${anchor.speech.sentenceLength} sentences, ${anchor.speech.formality}`)
  if (anchor.speech.accent) lines.push(`Accent: ${anchor.speech.accent}`)
  if (anchor.speech.catchphrases?.length) lines.push(`Catchphrases: "${anchor.speech.catchphrases.join('", "')}"`)

  if (anchor.constraints.cannotReveal.length > 0) {
    lines.push('')
    lines.push(`DO NOT reveal: ${anchor.constraints.cannotReveal.join(', ')}`)
  }
  if (anchor.constraints.mustMention.length > 0) {
    lines.push(`Must mention when relevant: ${anchor.constraints.mustMention.join(', ')}`)
  }

  const content = lines.join('\n')
  return {
    name: 'Identity',
    content,
    priority: 1,
    estimatedTokens: estimateTokens(content),
  }
}

export function buildKnowledgePrompt(entries: KnowledgeEntry[]): ContextSection {
  if (entries.length === 0) {
    return { name: 'Knowledge', content: 'You have no special knowledge beyond common sense.', priority: 3, estimatedTokens: 15 }
  }

  const grouped: Record<KnowledgeScope, KnowledgeEntry[]> = {
    personal: [], witnessed: [], location: [], faction: [], world: [], party: [],
  }
  for (const e of entries) grouped[e.scope].push(e)

  const lines: string[] = []
  for (const [scope, items] of Object.entries(grouped)) {
    if (items.length === 0) continue
    lines.push(`### ${scope.charAt(0).toUpperCase() + scope.slice(1)} Knowledge`)
    for (const item of items) {
      const confidence = item.confidence !== 'certain' ? ` (${item.confidence})` : ''
      lines.push(`- ${item.topic}: ${item.content}${confidence}`)
    }
  }

  const content = lines.join('\n')
  return {
    name: 'Knowledge',
    content,
    priority: 3,
    estimatedTokens: estimateTokens(content),
  }
}

export function buildMemoryPrompt(memories: AgentMemory[]): ContextSection {
  if (memories.length === 0) {
    return { name: 'Memories', content: 'No relevant memories.', priority: 5, estimatedTokens: 5 }
  }

  const lines = memories.map(m => {
    const emo = m.valence > 0 ? '(positive)' : m.valence < 0 ? '(negative)' : '(neutral)'
    return `- Day ${m.worldDay}: ${m.content} ${emo} [vividness: ${m.vividness.toFixed(1)}]`
  })

  const content = lines.join('\n')
  return {
    name: 'Memories',
    content,
    priority: 5,
    estimatedTokens: estimateTokens(content),
  }
}

export function buildSituationPrompt(situation: string): ContextSection {
  return {
    name: 'Current Situation',
    content: situation,
    priority: 2,
    estimatedTokens: estimateTokens(situation),
  }
}

export function buildRelationshipsPrompt(
  relationships: { name: string; disposition: string; history: string }[],
): ContextSection {
  if (relationships.length === 0) {
    return { name: 'Relationships', content: 'No established relationships.', priority: 6, estimatedTokens: 5 }
  }

  const lines = relationships.map(r => `- ${r.name} (${r.disposition}): ${r.history}`)
  const content = lines.join('\n')
  return {
    name: 'Relationships',
    content,
    priority: 4,
    estimatedTokens: estimateTokens(content),
  }
}

export function buildGoalsPrompt(goals: string[]): ContextSection {
  const content = goals.length > 0
    ? goals.map(g => `- ${g}`).join('\n')
    : 'No active goals.'

  return {
    name: 'Goals',
    content,
    priority: 3,
    estimatedTokens: estimateTokens(content),
  }
}

export function buildConstraintsPrompt(constraints: AgentConstraints): ContextSection {
  const lines: string[] = []

  if (constraints.canReveal.length > 0) lines.push(`Can discuss: ${constraints.canReveal.join(', ')}`)
  if (constraints.cannotReveal.length > 0) lines.push(`NEVER reveal: ${constraints.cannotReveal.join(', ')}`)
  if (constraints.mustMention.length > 0) lines.push(`Bring up: ${constraints.mustMention.join(', ')}`)
  if (!constraints.canLie) lines.push('You always tell the truth.')
  if (!constraints.canFight) lines.push('You will not resort to violence.')

  const content = lines.length > 0 ? lines.join('\n') : 'No special constraints.'
  return {
    name: 'Constraints',
    content,
    priority: 2,
    estimatedTokens: estimateTokens(content),
  }
}

// ============================================================
// FULL AGENT CONTEXT ASSEMBLY
// ============================================================

export interface AgentContextInput {
  identity: IdentityAnchor
  knowledge: KnowledgeEntry[]
  knowledgeBoundary: KnowledgeBoundary
  memories: AgentMemory[]
  situation: string
  relationships: { name: string; disposition: string; history: string }[]
  goals: string[]
  currentDay: number
  memoryTags: string[]
  tokenBudget: number
}

/**
 * The core function: assemble full agent context within token budget.
 *
 * Order of priority:
 *   1. Identity (who they are — never dropped)
 *   2. Situation (what's happening now)
 *   2. Constraints (what they can/can't do)
 *   3. Knowledge (what they know — filtered)
 *   3. Goals (what they want)
 *   4. Relationships (who they know)
 *   5. Memories (what they remember)
 */
export function assembleAgentContext(input: AgentContextInput): {
  prompt: string
  includedSections: string[]
  droppedSections: string[]
  totalTokens: number
} {
  // Filter knowledge through boundary
  const filteredKnowledge = filterKnowledge(input.knowledge, input.knowledgeBoundary)

  // Decay and retrieve relevant memories
  const decayedMemories = decayMemories(input.memories, input.currentDay)
  const relevantMemories = retrieveMemories(decayedMemories, input.memoryTags)

  // Build sections
  const sections: ContextSection[] = [
    buildIdentityPrompt(input.identity),
    buildSituationPrompt(input.situation),
    buildConstraintsPrompt(input.identity.constraints),
    buildKnowledgePrompt(filteredKnowledge),
    buildGoalsPrompt(input.goals),
    buildRelationshipsPrompt(input.relationships),
    buildMemoryPrompt(relevantMemories),
  ]

  // Assemble within budget
  const result = assembleContext({ maxTokens: input.tokenBudget, sections })

  return {
    prompt: result.assembled,
    includedSections: result.includedSections,
    droppedSections: result.droppedSections,
    totalTokens: estimateTokens(result.assembled),
  }
}
