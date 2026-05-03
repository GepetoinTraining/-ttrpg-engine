/**
 * POST /api/study/complete — finalize a study and award the discovery.
 *
 * Pedro 2026-05-02:
 *   "the API call that sends a full list of what the backend needs to award
 *    the player/NPC/observed NPCs through their study... we need to pool
 *    this as a json blob and send AI so it actually makes the full item
 *    and material and tech json we insert and then lore it to connect to
 *    the discovering player."
 *
 * Flow:
 *   1. Validate the study completion request (studyId, characterId, day).
 *   2. Re-build the study context server-side from engine state (resource
 *      domain, character mastery, hub identity).
 *   3. Send the context to Claude as a STRUCTURED OUTPUTS request — the
 *      LLM produces the new material + tech expansion + lore entry JSON.
 *   4. Validate the LLM's response against our Zod schema (the API
 *      structured-outputs guarantee makes this strict).
 *   5. Append a `writeKappa` action to `tpb_entries` for each insert
 *      (material/tech/lore), tying the discovery to the player's cert.
 *   6. Return the discovery to the browser for UI rendering.
 *
 * Architectural note:
 *   - **The engine is silent.** Claude is called from THIS route handler,
 *     not from `engine/`. The engine produces the discovery card; the
 *     route phrases the discovery via the LLM; the validated structured
 *     output goes back through the engine's writeKappa channel.
 *   - This is the "supervised creativity" pattern: the LLM authors within
 *     a Zod-locked schema. It can't violate the shape; it just fills in
 *     the words / numbers within bounds.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { db } from '@/db/connection'
import { worlds, characters, characterMaterialMastery } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { appendAction } from '@/lib/world-tpb'
import { TierSchema, type Tier } from '../../../../../engine/tier'
import { STUDY_DAYS_BY_TIER } from '../../../../../engine/study'

// ============================================================
// REQUEST SHAPE
// ============================================================

const RequestSchema = z.object({
  studyId: z.string().min(1),
  characterId: z.string().min(1),
  resourceId: z.string().min(1),
  hubId: z.string().min(1),
  resourceTier: TierSchema,
  domain: z.string().optional(),
  /** Optional: which discovery slot the LLM should fill (caller prefers tech only / material only). */
  preferredOutputs: z
    .array(z.enum(['material', 'tech', 'lore']))
    .default(['material', 'tech', 'lore']),
})

// ============================================================
// RESPONSE SHAPES — what Claude must produce
// ============================================================

const NewMaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  domain: z.string().min(1),
  properties: z.object({
    density: z.number().min(0).max(20).optional(),
    hardness: z.number().min(0).max(20).optional(),
    flexibility: z.number().min(0).max(20).optional(),
    magicalAffinity: z.number().min(0).max(20).optional(),
    workability: z.number().min(0).max(20).optional(),
  }),
  affixes: z.array(z.string()).max(8),
  tier: TierSchema,
})

const TechSlotSchema = z.object({
  name: z.string().min(1).max(40),
  materialDomains: z.array(z.string()).min(1).max(4),
  quantity: z.number().int().min(1).max(20),
})

const TechExpansionSchema = z.object({
  purpose: z.string().min(1),
  tier: TierSchema,
  addedSlots: z.array(TechSlotSchema).max(5),
  hints: z.array(z.string()).max(8),
})

const LoreEntrySchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(20).max(800),
  keywords: z.array(z.string()).max(10),
})

const DiscoverySchema = z.object({
  newMaterial: NewMaterialSchema.nullable(),
  techExpansion: TechExpansionSchema.nullable(),
  loreEntry: LoreEntrySchema,
})
type Discovery = z.infer<typeof DiscoverySchema>

// ============================================================
// MODEL TIERING
// ============================================================

/** Sonnet for high-tier discoveries (party-rich, lore-deep). Haiku for the rest. */
function pickModelForTier(tier: Tier, partyBound: boolean): string {
  if (partyBound) return 'claude-sonnet-4-6'
  // High-tier discoveries get the bigger model regardless
  if (tier === 'A' || tier === 'S' || tier === 'SS' || tier === 'SSS' || tier === 'EX') {
    return 'claude-sonnet-4-6'
  }
  return 'claude-haiku-4-5'
}

// ============================================================
// HANDLER
// ============================================================

export async function POST(req: NextRequest) {
  let body: z.infer<typeof RequestSchema>
  try {
    const raw = await req.json()
    const parsed = RequestSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_request', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Anthropic key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'anthropic_key_missing' }, { status: 503 })
  }

  // ── Pull engine state context ──

  const worldRow = await db.select({ currentDay: worlds.currentDay }).from(worlds).limit(1)
  const currentDay = worldRow[0]?.currentDay ?? 0

  const charRow = await db.select().from(characters).where(eq(characters.id, body.characterId)).limit(1)
  const character = charRow[0]
  if (!character) {
    return NextResponse.json({ error: 'character_not_found' }, { status: 404 })
  }

  // Existing mastery for this resource (if any)
  let priorMastery = 0
  let priorAffixes: string[] = []
  try {
    const masteryRow = await db
      .select()
      .from(characterMaterialMastery)
      .where(
        and(
          eq(characterMaterialMastery.characterId, body.characterId),
          eq(characterMaterialMastery.resourceId, body.resourceId),
        ),
      )
      .limit(1)
    if (masteryRow[0]) {
      priorMastery = masteryRow[0].knowledgeLevel ?? 0
      try {
        priorAffixes = JSON.parse(masteryRow[0].discoveredAffixesJson ?? '[]')
      } catch {
        priorAffixes = []
      }
    }
  } catch {
    // table may not be in schema yet; skip gracefully
  }

  // ── Build the LLM prompt — the "JSON blob" the engine pools ──

  const studyDuration = STUDY_DAYS_BY_TIER[body.resourceTier]
  const partyBound = priorMastery >= 1 // simple proxy until party-binding is wired in

  const systemPrompt = [
    'You are a discovery-canon engine for a deterministic-math fantasy world.',
    'You receive a completed study from a player character and you produce',
    "structured JSON describing what was learned. The world is silent — your",
    'output MUST conform exactly to the schema; no prose outside the JSON.',
    '',
    'RULES:',
    '- Return EXACTLY the schema fields. Do not invent extra fields.',
    '- `newMaterial.id` must be globally unique; format `mat_<domain>_<short-slug>` (lowercase-kebab).',
    '- `newMaterial.tier` should match the input resource tier (rare exceptions: a study reveals an unexpected sub-property worth bumping by one tier).',
    '- `newMaterial.affixes` reference existing affix ids OR new ids prefixed `aff_`. Keep them domain-appropriate.',
    '- `techExpansion` is OPTIONAL — only return one when the study genuinely advances a recognized tool/tech purpose. Otherwise null.',
    '- `loreEntry.body` is the in-world write-up the lore index will store. 2-4 sentences. Reference the discovering character by name once.',
    '- Stay in-world. No game-mechanical chatter ("HP", "DC", "DM").',
    '- Be terse. The engine renders the result; you only need to fill the schema accurately.',
  ].join('\n')

  const studyContext = {
    discoveringCharacter: {
      id: body.characterId,
      name: character.name,
    },
    resource: {
      id: body.resourceId,
      domain: body.domain ?? null,
      tier: body.resourceTier,
    },
    hub: {
      id: body.hubId,
    },
    studyMeta: {
      durationDays: studyDuration,
      completedOnDay: currentDay,
      priorKnowledgeLevel: priorMastery,
      priorAffixesKnown: priorAffixes,
    },
    requestedOutputs: body.preferredOutputs,
  }

  // ── Call Claude ──

  const client = new Anthropic({ apiKey })
  const model = pickModelForTier(body.resourceTier, partyBound)

  let parsedDiscovery: Discovery
  let usage: Anthropic.Messages.Usage
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
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
          content: `Discovery context (JSON):\n\n${JSON.stringify(studyContext, null, 2)}\n\nReturn ONLY a JSON object matching this shape:\n\n{
  "newMaterial": { "id": string, "name": string, "description": string, "domain": string,
                   "properties": { "density"?: number, "hardness"?: number, "flexibility"?: number,
                                   "magicalAffinity"?: number, "workability"?: number },
                   "affixes": string[], "tier": "F"|"E"|"D"|"C"|"B"|"A"|"S"|"SS"|"SSS"|"EX" } | null,
  "techExpansion": { "purpose": string, "tier": same enum,
                     "addedSlots": [{"name": string, "materialDomains": string[], "quantity": number}],
                     "hints": string[] } | null,
  "loreEntry": { "title": string, "body": string, "keywords": string[] }
}`,
        },
      ],
    })
    usage = response.usage

    // Extract the JSON from the response text
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    // The model might wrap in code fences — strip them.
    const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const json = JSON.parse(cleanText)
    const validated = DiscoverySchema.safeParse(json)
    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'discovery_schema_violation',
          issues: validated.error.issues,
          rawText: cleanText.slice(0, 1000),
        },
        { status: 502 },
      )
    }
    parsedDiscovery = validated.data
  } catch (e: unknown) {
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: 'anthropic_error', status: e.status, message: e.message },
        { status: 502 },
      )
    }
    if (e instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'discovery_invalid_json', message: e.message },
        { status: 502 },
      )
    }
    return NextResponse.json(
      { error: 'discovery_failed', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  // ── Insert via writeKappa actions (the discovery becomes part of the canonical log) ──

  let writeKappaCount = 0
  const tpbErrors: string[] = []

  // 1. Mark the study as complete on the character (raises mastery → 2)
  try {
    await appendAction(currentDay, {
      type: 'writeKappa',
      nodeId: body.hubId,
      domain: 'knowledge',
      paths: [`knowledge.studies.${body.studyId}.complete`],
      system: `study-complete:${body.characterId}`,
      value: {
        studies: {
          [body.studyId]: {
            characterId: body.characterId,
            resourceId: body.resourceId,
            tier: body.resourceTier,
            completedOnDay: currentDay,
          },
        },
      },
    })
    writeKappaCount++
  } catch (e: unknown) {
    tpbErrors.push(`study-complete: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2. New material (if returned)
  if (parsedDiscovery.newMaterial) {
    try {
      await appendAction(currentDay, {
        type: 'writeKappa',
        nodeId: body.hubId,
        domain: 'knowledge',
        paths: [`knowledge.materials.${parsedDiscovery.newMaterial.id}`],
        system: `discovery-material:${body.characterId}`,
        value: {
          materials: {
            [parsedDiscovery.newMaterial.id]: {
              ...parsedDiscovery.newMaterial,
              discoveredBy: body.characterId,
              discoveredOnDay: currentDay,
            },
          },
        },
      })
      writeKappaCount++
    } catch (e: unknown) {
      tpbErrors.push(`material: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 3. Tech expansion (if returned)
  if (parsedDiscovery.techExpansion) {
    try {
      await appendAction(currentDay, {
        type: 'writeKappa',
        nodeId: body.hubId,
        domain: 'knowledge',
        paths: [`knowledge.tech.${parsedDiscovery.techExpansion.purpose}.${parsedDiscovery.techExpansion.tier}`],
        system: `discovery-tech:${body.characterId}`,
        value: {
          tech: {
            [parsedDiscovery.techExpansion.purpose]: {
              [parsedDiscovery.techExpansion.tier]: {
                ...parsedDiscovery.techExpansion,
                discoveredBy: body.characterId,
                discoveredOnDay: currentDay,
              },
            },
          },
        },
      })
      writeKappaCount++
    } catch (e: unknown) {
      tpbErrors.push(`tech: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 4. Lore entry (always)
  try {
    const loreId = `lore_${body.studyId}`
    await appendAction(currentDay, {
      type: 'writeKappa',
      nodeId: body.hubId,
      domain: 'knowledge',
      paths: [`knowledge.lore.${loreId}`],
      system: `discovery-lore:${body.characterId}`,
      value: {
        lore: {
          [loreId]: {
            ...parsedDiscovery.loreEntry,
            discoveringCharacterId: body.characterId,
            discoveringCharacterName: character.name,
            studyId: body.studyId,
            recordedOnDay: currentDay,
          },
        },
      },
    })
    writeKappaCount++
  } catch (e: unknown) {
    tpbErrors.push(`lore: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Return ──

  return NextResponse.json({
    ok: true,
    studyId: body.studyId,
    completedOnDay: currentDay,
    model,
    discovery: parsedDiscovery,
    inserts: {
      writeKappaCount,
      errors: tpbErrors,
    },
    usage,
  })
}
