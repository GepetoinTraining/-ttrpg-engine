/**
 * POST /api/npc/[id]/converse — render an NPC dialogue turn.
 *
 * **The engine doesn't speak — this route does.** Per `feedback_no_llm_in_engine.md`:
 *   - The engine produces a deterministic conversation card via
 *     `assembleAgentContext` from `engine/intelligence.ts`. That call has
 *     no LLM dependency and no I/O.
 *   - This route then routes the card through Anthropic's API to PHRASE
 *     the response. The LLM is constrained by the card's `cannotReveal`,
 *     `mustMention`, `speech.formality`, etc. — it can't invent, only
 *     phrase.
 *
 * Model tiering:
 *   - **Sonnet 4.6** for party-bound NPCs (followers — high interaction
 *     frequency, story-relevant). Better quality matters here.
 *   - **Haiku 4.5** for everyone else (random townspeople, distant agents,
 *     throwaway tavern keepers). Fast and cheap.
 *
 * Prompt caching: the system prompt = engine card prefix is stable for a
 * given NPC × world day. We mark `cache_control: ephemeral` on it so
 * subsequent questions to the same NPC reuse the prefix.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/db/connection'
import { npcs, npcMemories, followers, worlds } from '@/db/schema'
import {
  assembleAgentContext,
  type IdentityAnchor,
  type KnowledgeBoundary,
  type KnowledgeEntry,
  type AgentMemory,
  AGENT_KNOWLEDGE_DEFAULTS,
} from '../../../../../../engine/intelligence'

const MODEL_PARTY_BOUND = 'claude-sonnet-4-6'
const MODEL_OTHER = 'claude-haiku-4-5'

interface ConverseRequest {
  question: string
  /** Free-form note about the encounter — "you meet at the tavern, evening". */
  situation?: string
  /** When set, the response addresses this character by name. */
  speakerName?: string
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params

  let body: ConverseRequest
  try {
    body = (await req.json()) as ConverseRequest
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.question || typeof body.question !== 'string') {
    return NextResponse.json({ error: 'question_required' }, { status: 400 })
  }

  // ── Load NPC + memories ──
  const npcRows = await db.select().from(npcs).where(eq(npcs.id, id)).limit(1)
  const npc = npcRows[0]
  if (!npc) return NextResponse.json({ error: 'npc_not_found' }, { status: 404 })

  const memRows = await db.select().from(npcMemories).where(eq(npcMemories.npcId, id))

  // ── Determine party-bound (any active follower row) ──
  const followerRows = await db
    .select({ id: followers.id, partyId: followers.partyId, scope: followers.scope })
    .from(followers)
    .where(eq(followers.npcId, id))
    .limit(1)
  const partyBound = followerRows.length > 0
  const model = partyBound ? MODEL_PARTY_BOUND : MODEL_OTHER

  // ── Current world day (for memory decay) ──
  const worldRow = await db.select({ currentDay: worlds.currentDay }).from(worlds).limit(1)
  const currentDay = worldRow[0]?.currentDay ?? 0

  // ── Build the engine's conversation card ──
  const personality = npc.personalityJson ? safeParseJson(npc.personalityJson) : null
  const identity: IdentityAnchor = {
    agentId: npc.id,
    agentType: 'npc',
    name: npc.name,
    title: npc.role ?? undefined,
    coreIdentity: npc.role
      ? `${npc.name}, ${npc.role}${npc.craft ? ` (${npc.craft})` : ''}`
      : npc.name,
    personality: {
      values: personality?.values ?? [],
      fears: personality?.fears ?? [],
      desires: personality?.desires ?? [],
      quirks: personality?.quirks ?? [],
      flaws: personality?.flaws ?? [],
    },
    speech: {
      vocabulary: personality?.speech?.vocabulary ?? 'simple',
      sentenceLength: personality?.speech?.sentenceLength ?? 'normal',
      formality: personality?.speech?.formality ?? 'casual',
      accent: personality?.speech?.accent,
      catchphrases: personality?.speech?.catchphrases,
      avoids: personality?.speech?.avoids,
    },
    constraints: {
      canReveal: personality?.canReveal ?? [],
      cannotReveal: personality?.cannotReveal ?? [],
      mustMention: personality?.mustMention ?? [],
      canLie: personality?.canLie ?? false,
      canFight: personality?.canFight ?? false,
      canTrade: personality?.canTrade ?? Boolean(npc.craft),
    },
    partyRelationship: dispositionToRelationship(npc.disposition),
  }

  const knowledgeBoundary: KnowledgeBoundary = {
    entries: [],
    exclusions: personality?.cannotReveal ?? [],
    allowedScopes: AGENT_KNOWLEDGE_DEFAULTS['npc'],
  }

  // For v1, knowledge entries come straight from npc_memories rows tagged
  // as "semantic" (facts the NPC knows). Episodic + emotional memories feed
  // the AgentMemory[] path instead.
  const knowledge: KnowledgeEntry[] = memRows
    .filter((m) => m.memoryType === 'semantic')
    .map((m) => ({
      scope: 'personal',
      topic: 'general',
      content: m.content,
      confidence: 'probable',
      isTrue: m.sentiment >= 0,
      source: 'npc_memories',
    }))

  const memories: AgentMemory[] = memRows.map((m) => ({
    id: m.id,
    memoryType: (m.memoryType as 'episodic' | 'semantic' | 'emotional') ?? 'semantic',
    content: m.content,
    worldDay: m.worldDay,
    importance: clampImportance(m.sentiment),
    vividness: Math.max(0, Math.min(1, 1 - m.decay * Math.max(0, currentDay - m.worldDay))),
    tags: extractTags(m.content),
    valence: clampValence(m.sentiment * 10),
  }))

  const situation = body.situation
    ? body.situation
    : `You are ${npc.name}${npc.settlementId ? ` of ${npc.settlementId}` : ''}.${
        body.speakerName ? ` ${body.speakerName} approaches you.` : ' A stranger approaches you.'
      }`

  const card = assembleAgentContext({
    identity,
    knowledge,
    knowledgeBoundary,
    memories,
    situation,
    relationships: [],
    goals: npc.agendaJson ? extractGoalsFromAgenda(npc.agendaJson) : [],
    currentDay,
    memoryTags: extractTags(body.question),
    tokenBudget: 3000,
  })

  // ── Render via Anthropic ──
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'anthropic_key_missing' }, { status: 503 })
  }

  const client = new Anthropic({ apiKey })

  // Stable prefix → cached. Volatile player turn → not cached.
  const systemPrompt =
    `${card.prompt}\n\n` +
    `Respond IN CHARACTER as ${npc.name}. Stay within the constraints above. ` +
    `If asked about something outside your knowledge boundary, say so honestly ` +
    `(unless your constraints allow lying). Keep replies short — one or two ` +
    `sentences unless the question demands more.`

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: body.question,
        },
      ],
    })
  } catch (e: unknown) {
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: 'anthropic_error', status: e.status, message: e.message },
        { status: 502 },
      )
    }
    return NextResponse.json(
      { error: 'render_failed', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return NextResponse.json({
    npcId: id,
    npcName: npc.name,
    model,
    partyBound,
    text,
    receipt: {
      stopReason: response.stop_reason,
      usage: response.usage,
      includedSections: card.includedSections,
      droppedSections: card.droppedSections,
      cardTokenEstimate: card.totalTokens,
    },
  })
}

// ── Helpers (route-local; small enough to keep here for v1) ──

function safeParseJson(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function dispositionToRelationship(disposition: string): string {
  switch (disposition) {
    case 'friendly':
      return 'warm and welcoming'
    case 'neutral':
      return 'neutral — neither hostile nor friendly'
    case 'hostile':
      return 'wary or hostile'
    case 'helpful':
      return 'helpful and forthcoming'
    case 'reserved':
      return 'reserved, slow to trust'
    default:
      return disposition
  }
}

function clampImportance(sentiment: number): number {
  // Map sentiment magnitude (0..1) to importance (1..10).
  return Math.max(1, Math.min(10, Math.round(Math.abs(sentiment) * 10)))
}

function clampValence(v: number): number {
  return Math.max(-10, Math.min(10, v))
}

function extractTags(text: string): string[] {
  // Cheap tokenization for memory retrieval. v2 can use embeddings.
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)
    .slice(0, 12)
}

function extractGoalsFromAgenda(agendaJson: string): string[] {
  const a = safeParseJson(agendaJson)
  if (!a) return []
  if (Array.isArray(a)) return a.map((x) => String(x))
  if (typeof a === 'object') return Object.values(a).map((v) => String(v))
  return []
}
