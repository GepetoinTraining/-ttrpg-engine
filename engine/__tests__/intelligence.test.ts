import { describe, it, expect } from 'vitest'
import {
  AGENT_KNOWLEDGE_DEFAULTS,
  filterKnowledge, decayMemories, retrieveMemories,
  estimateTokens, assembleContext, assembleAgentContext,
  buildIdentityPrompt, buildKnowledgePrompt, buildMemoryPrompt,
  buildSituationPrompt, buildRelationshipsPrompt, buildGoalsPrompt,
  buildConstraintsPrompt,
  type KnowledgeEntry, type KnowledgeBoundary, type AgentMemory,
  type IdentityAnchor, type ContextSection,
} from '../intelligence'

// ============================================================
// HELPERS
// ============================================================

function makeIdentity(overrides: Partial<IdentityAnchor> = {}): IdentityAnchor {
  return {
    agentId: 'npc-1',
    agentType: 'npc',
    name: 'Gareth',
    title: 'the Blacksmith',
    coreIdentity: 'A gruff but honest blacksmith who lost his wife to bandits.',
    personality: {
      values: ['honesty', 'hard work'],
      fears: ['bandits', 'losing more family'],
      desires: ['vengeance', 'peace'],
      quirks: ['hammers things when nervous'],
      flaws: ['holds grudges'],
    },
    speech: {
      vocabulary: 'simple',
      sentenceLength: 'terse',
      formality: 'casual',
      accent: 'Northern',
      catchphrases: ['Steel remembers'],
    },
    constraints: {
      canReveal: ['local gossip', 'weapon quality'],
      cannotReveal: ['cult hideout location'],
      mustMention: ['bandit sightings'],
      canLie: false,
      canFight: true,
      canTrade: true,
    },
    partyRelationship: 'Cautiously friendly — helped him once before.',
    ...overrides,
  }
}

function makeKnowledge(): KnowledgeEntry[] {
  return [
    { scope: 'personal', topic: 'wife', content: 'She died in a bandit raid', confidence: 'certain', isTrue: true, source: 'experience' },
    { scope: 'location', topic: 'tavern', content: 'The Golden Goblet has good ale', confidence: 'certain', isTrue: true, source: 'local' },
    { scope: 'faction', topic: 'guard captain', content: 'Captain is taking bribes', confidence: 'rumor', isTrue: true, source: 'overheard' },
    { scope: 'world', topic: 'dragon sighting', content: 'A red dragon was seen near mountains', confidence: 'rumor', isTrue: false, source: 'travelers' },
    { scope: 'party', topic: 'adventurers', content: 'They helped clear rats from basement', confidence: 'certain', isTrue: true, source: 'interaction' },
  ]
}

function makeMemories(): AgentMemory[] {
  return [
    { id: 'm1', memoryType: 'episodic', content: 'The party helped clear rats', worldDay: 10, importance: 5, vividness: 1.0, tags: ['party', 'help'], entityId: 'party', entityName: 'Adventurers', valence: 5 },
    { id: 'm2', memoryType: 'emotional', content: 'Wife killed by bandits', worldDay: 1, importance: 10, vividness: 1.0, tags: ['wife', 'bandits', 'loss'], entityName: 'Mara', valence: -10 },
    { id: 'm3', memoryType: 'semantic', content: 'Iron prices are rising', worldDay: 8, importance: 3, vividness: 0.8, tags: ['trade', 'iron'], valence: -2 },
    { id: 'm4', memoryType: 'episodic', content: 'Saw a stranger at the gate', worldDay: 5, importance: 2, vividness: 0.5, tags: ['stranger'], valence: 0 },
  ]
}

// ============================================================
// KNOWLEDGE BOUNDARIES
// ============================================================

describe('Intelligence — Knowledge Boundaries', () => {
  it('should define scopes for all agent types', () => {
    expect(AGENT_KNOWLEDGE_DEFAULTS.npc).toContain('personal')
    expect(AGENT_KNOWLEDGE_DEFAULTS.creature).not.toContain('faction')
    expect(AGENT_KNOWLEDGE_DEFAULTS.narrator).toHaveLength(6) // all scopes
    expect(AGENT_KNOWLEDGE_DEFAULTS.lair).toContain('location')
  })

  it('should filter knowledge by allowed scopes', () => {
    const entries = makeKnowledge()
    const boundary: KnowledgeBoundary = {
      entries,
      exclusions: [],
      allowedScopes: ['personal', 'location'], // creature-like
    }
    const filtered = filterKnowledge(entries, boundary)
    expect(filtered).toHaveLength(2)
    expect(filtered.map(e => e.scope)).toEqual(['personal', 'location'])
  })

  it('should exclude topics from knowledge', () => {
    const entries = makeKnowledge()
    const boundary: KnowledgeBoundary = {
      entries,
      exclusions: ['dragon'],  // Doesn't know about dragon
      allowedScopes: ['personal', 'location', 'faction', 'world', 'party'],
    }
    const filtered = filterKnowledge(entries, boundary)
    expect(filtered.find(e => e.topic === 'dragon sighting')).toBeUndefined()
  })

  it('narrator should see everything', () => {
    const entries = makeKnowledge()
    const boundary: KnowledgeBoundary = {
      entries,
      exclusions: [],
      allowedScopes: AGENT_KNOWLEDGE_DEFAULTS.narrator,
    }
    const filtered = filterKnowledge(entries, boundary)
    expect(filtered).toHaveLength(5)
  })
})

// ============================================================
// MEMORY PROTOCOL
// ============================================================

describe('Intelligence — Memory', () => {
  it('should decay memories over time', () => {
    const memories = makeMemories()
    const decayed = decayMemories(memories, 30) // 20-29 days later

    // Low importance episodic memories should decay more
    const stranger = decayed.find(m => m.id === 'm4')!
    expect(stranger.vividness).toBeLessThan(0.5)

    // High importance emotional memories should barely decay
    const wife = decayed.find(m => m.id === 'm2')!
    expect(wife.vividness).toBeGreaterThan(0.5)
  })

  it('should retrieve by tags', () => {
    const memories = makeMemories()
    const result = retrieveMemories(memories, ['party', 'help'])
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].content).toContain('party')
  })

  it('should filter out forgotten memories', () => {
    const memories: AgentMemory[] = [
      { id: 'm1', memoryType: 'episodic', content: 'Forgotten', worldDay: 1, importance: 1, vividness: 0.05, tags: ['old'], valence: 0 },
    ]
    const result = retrieveMemories(memories, ['old'], 0.1)
    expect(result).toHaveLength(0)
  })

  it('should limit results', () => {
    const memories = makeMemories()
    const result = retrieveMemories(memories, [], 0, 2)
    expect(result).toHaveLength(2)
  })

  it('should sort by relevance × vividness × importance', () => {
    const memories = makeMemories()
    const result = retrieveMemories(memories, ['bandits'])
    expect(result[0].id).toBe('m2') // Wife memory — highest importance + tag match
  })
})

// ============================================================
// CONTEXT BUDGETING
// ============================================================

describe('Intelligence — Context Budgeting', () => {
  it('should estimate tokens roughly at 4 chars/token', () => {
    expect(estimateTokens('Hello world')).toBe(3) // 11 chars / 4 = ceil(2.75) = 3
  })

  it('should include high priority sections first', () => {
    const result = assembleContext({
      maxTokens: 50,
      sections: [
        { name: 'Identity', content: 'I am Gareth', priority: 1, estimatedTokens: 10 },
        { name: 'Situation', content: 'At the forge', priority: 2, estimatedTokens: 10 },
        { name: 'Memories', content: 'Long detailed memories...'.repeat(20), priority: 5, estimatedTokens: 200 },
      ],
    })
    expect(result.includedSections).toContain('Identity')
    expect(result.includedSections).toContain('Situation')
    expect(result.droppedSections).toContain('Memories')
  })

  it('should drop lowest priority when over budget', () => {
    const result = assembleContext({
      maxTokens: 20,
      sections: [
        { name: 'A', content: 'Short', priority: 1, estimatedTokens: 10 },
        { name: 'B', content: 'Short', priority: 10, estimatedTokens: 10 },
        { name: 'C', content: 'Short', priority: 5, estimatedTokens: 10 },
      ],
    })
    expect(result.includedSections).toEqual(['A', 'C'])
    expect(result.droppedSections).toEqual(['B'])
  })
})

// ============================================================
// PROMPT BUILDERS
// ============================================================

describe('Intelligence — Prompt Builders', () => {
  it('should build identity prompt with personality', () => {
    const identity = makeIdentity()
    const section = buildIdentityPrompt(identity)
    expect(section.name).toBe('Identity')
    expect(section.priority).toBe(1)
    expect(section.content).toContain('Gareth')
    expect(section.content).toContain('Blacksmith')
    expect(section.content).toContain('honesty')
    expect(section.content).toContain('Steel remembers')
    expect(section.content).toContain('cult hideout')
  })

  it('should build knowledge prompt grouped by scope', () => {
    const entries = makeKnowledge()
    const section = buildKnowledgePrompt(entries)
    expect(section.content).toContain('Personal')
    expect(section.content).toContain('wife')
    expect(section.content).toContain('(rumor)')
  })

  it('should build empty knowledge prompt', () => {
    const section = buildKnowledgePrompt([])
    expect(section.content).toContain('no special knowledge')
  })

  it('should build memory prompt with valence', () => {
    const memories = makeMemories()
    const section = buildMemoryPrompt(memories)
    expect(section.content).toContain('(positive)')
    expect(section.content).toContain('(negative)')
    expect(section.content).toContain('vividness')
  })

  it('should build situation prompt', () => {
    const section = buildSituationPrompt('A stranger enters the forge')
    expect(section.priority).toBe(2)
    expect(section.content).toContain('stranger')
  })

  it('should build relationships prompt', () => {
    const section = buildRelationshipsPrompt([
      { name: 'Aric', disposition: 'friendly', history: 'Helped clear rats' },
    ])
    expect(section.content).toContain('Aric')
    expect(section.content).toContain('friendly')
  })

  it('should build goals prompt', () => {
    const section = buildGoalsPrompt(['Find wife\'s killers', 'Expand the forge'])
    expect(section.content).toContain('killers')
    expect(section.content).toContain('forge')
  })

  it('should build constraints prompt', () => {
    const section = buildConstraintsPrompt(makeIdentity().constraints)
    expect(section.content).toContain('NEVER reveal')
    expect(section.content).toContain('cult hideout')
    expect(section.content).toContain('truth')
  })
})

// ============================================================
// FULL AGENT CONTEXT ASSEMBLY
// ============================================================

describe('Intelligence — Full Context Assembly', () => {
  it('should assemble complete agent context within budget', () => {
    const result = assembleAgentContext({
      identity: makeIdentity(),
      knowledge: makeKnowledge(),
      knowledgeBoundary: {
        entries: makeKnowledge(),
        exclusions: [],
        allowedScopes: AGENT_KNOWLEDGE_DEFAULTS.npc,
      },
      memories: makeMemories(),
      situation: 'A hooded stranger enters the forge at dusk.',
      relationships: [{ name: 'Aric', disposition: 'friendly', history: 'Helped before' }],
      goals: ['Find wife\'s killers'],
      currentDay: 15,
      memoryTags: ['party'],
      tokenBudget: 2000,
    })

    expect(result.prompt).toContain('Gareth')
    expect(result.prompt).toContain('stranger')
    expect(result.includedSections.length).toBeGreaterThan(0)
    expect(result.totalTokens).toBeGreaterThan(0)
    expect(result.totalTokens).toBeLessThanOrEqual(2000)
  })

  it('should drop low priority sections under tight budget', () => {
    const result = assembleAgentContext({
      identity: makeIdentity(),
      knowledge: makeKnowledge(),
      knowledgeBoundary: {
        entries: makeKnowledge(),
        exclusions: [],
        allowedScopes: AGENT_KNOWLEDGE_DEFAULTS.npc,
      },
      memories: makeMemories(),
      situation: 'A fight breaks out.',
      relationships: [],
      goals: [],
      currentDay: 15,
      memoryTags: [],
      tokenBudget: 100, // Very tight
    })

    // Identity should always be included (priority 1)
    expect(result.includedSections).toContain('Identity')
    // Some sections should be dropped
    expect(result.droppedSections.length).toBeGreaterThan(0)
  })

  it('should filter knowledge through boundary', () => {
    const result = assembleAgentContext({
      identity: makeIdentity({ agentType: 'creature' }),
      knowledge: makeKnowledge(),
      knowledgeBoundary: {
        entries: makeKnowledge(),
        exclusions: [],
        allowedScopes: AGENT_KNOWLEDGE_DEFAULTS.creature, // personal + witnessed only
      },
      memories: [],
      situation: 'Growl.',
      relationships: [],
      goals: [],
      currentDay: 1,
      memoryTags: [],
      tokenBudget: 2000,
    })

    // Creature shouldn't know about faction or world knowledge
    expect(result.prompt).not.toContain('guard captain')
    expect(result.prompt).not.toContain('dragon')
  })
})
