import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, campaignProcedure, gmProcedure } from "../trpc";
import { query, queryOne, queryAll, uuid, now, toJson, parseJson } from "../../db/client";
import { NPCAI } from "../../ai/npc";
import { GeminiClient } from "../../ai/client";
import { buildContext } from "../../ai/context";

// =============================================================================
// AI ROUTER
// =============================================================================

export const aiRouter = router({
  // ---------------------------------------------------------------------------
  // NPC CHAT - Conversation with an NPC
  // ---------------------------------------------------------------------------
  npcChat: campaignProcedure
    .input(z.object({
      npcId: z.string().uuid(),
      message: z.string().min(1).max(2000),
      sessionId: z.string().uuid().optional(),
      speakerContext: z.object({
        isGM: z.boolean(),
        speakAs: z.enum(["gm", "character"]),
        characterName: z.string().optional(),
      }).optional(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get NPC
      const npc = await queryOne<{
        id: string;
        name: string;
        role: string;
        personality: string;
        background: string;
        secrets: string;
        voice_style: string;
        depth: number;
      }>(
        "SELECT id, name, role, personality, background, secrets, voice_style, depth FROM npcs WHERE id = ? AND campaign_id = ?",
        [input.npcId, ctx.campaignId]
      );

      if (!npc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NPC not found" });
      }

      // Build context
      const context = await buildContext(ctx.campaignId, {
        sessionId: input.sessionId,
        includeLocation: true,
      });

      // Generate response
      const npcAI = new NPCAI(npc, context);
      const response = await npcAI.generateDialogue(input.message, {
        speakerContext: input.speakerContext,
        conversationHistory: input.conversationHistory,
      });

      // Log interaction
      await query(
        `INSERT INTO npc_interactions (id, npc_id, campaign_id, user_id, message, response, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), input.npcId, ctx.campaignId, ctx.auth.userId, input.message, response.message, now()]
      );

      return response;
    }),

  // ---------------------------------------------------------------------------
  // DEEPEN NPC - Expand an NPC's depth level
  // ---------------------------------------------------------------------------
  deepenNpc: gmProcedure
    .input(z.object({
      npcId: z.string().uuid(),
      targetDepth: z.number().min(1).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const npc = await queryOne<{
        id: string;
        name: string;
        role: string;
        depth: number;
        personality: string;
        background: string;
      }>(
        "SELECT id, name, role, depth, personality, background FROM npcs WHERE id = ? AND campaign_id = ?",
        [input.npcId, ctx.campaignId]
      );

      if (!npc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NPC not found" });
      }

      if (input.targetDepth <= npc.depth) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Target depth must be greater than current depth" });
      }

      // Get campaign context for coherent generation
      const context = await buildContext(ctx.campaignId, { includeWorld: true });

      const client = new GeminiClient("gemini-2.5-pro"); // Pro for deep generation
      const result = await client.generate({
        systemInstruction: `You are a TTRPG content generator. Generate deeper character details that are coherent with the existing campaign world and character.`,
        prompt: `
Campaign Context:
${context.summary}

Existing NPC:
- Name: ${npc.name}
- Role: ${npc.role}
- Current Depth: D${npc.depth}
- Personality: ${npc.personality || "Not defined"}
- Background: ${npc.background || "Not defined"}

Generate content for Depth Level ${input.targetDepth}:
${getDepthPrompt(input.targetDepth)}

Respond in JSON format:
{
  "personality": "expanded personality traits",
  "background": "deeper backstory",
  "secrets": ["secret 1", "secret 2"],
  "motivations": ["motivation 1", "motivation 2"],
  "connections": [{"name": "NPC name", "relationship": "description"}],
  "quirks": ["quirk 1", "quirk 2"]
}`,
      });

      const generated = JSON.parse(result.text);

      // Update NPC
      await query(
        `UPDATE npcs SET
          depth = ?,
          personality = ?,
          background = ?,
          secrets = ?,
          motivations = ?,
          connections = ?,
          quirks = ?,
          updated_at = ?
         WHERE id = ?`,
        [
          input.targetDepth,
          generated.personality || npc.personality,
          generated.background || npc.background,
          toJson(generated.secrets || []),
          toJson(generated.motivations || []),
          toJson(generated.connections || []),
          toJson(generated.quirks || []),
          now(),
          input.npcId,
        ]
      );

      return {
        newDepth: input.targetDepth,
        generated,
      };
    }),

  // ---------------------------------------------------------------------------
  // GENERATE NPC - Create a new NPC from scratch
  // ---------------------------------------------------------------------------
  generateNpc: gmProcedure
    .input(z.object({
      role: z.string().optional(),
      location: z.string().optional(),
      context: z.string().optional(),
      depth: z.number().min(0).max(3).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const campaignContext = await buildContext(ctx.campaignId, { includeWorld: true });

      const client = new GeminiClient("gemini-2.5-flash");
      const result = await client.generate({
        systemInstruction: `You are a TTRPG NPC generator. Create interesting, memorable NPCs that fit the campaign world.`,
        prompt: `
Campaign: ${campaignContext.summary}
${input.location ? `Location: ${input.location}` : ""}
${input.role ? `Requested Role: ${input.role}` : ""}
${input.context ? `Additional Context: ${input.context}` : ""}

Generate an NPC at Depth ${input.depth}. Respond in JSON:
{
  "name": "Full name",
  "role": "Their role/occupation",
  "race": "Fantasy race",
  "description": "Physical appearance, 2-3 sentences",
  "personality": "Key personality traits",
  "voice": "How they speak (accent, mannerisms)",
  "hook": "What makes them interesting/memorable",
  "secret": "One hidden detail (GM only)"
}`,
      });

      const generated = JSON.parse(result.text);

      // Insert NPC
      const npcId = uuid();
      await query(
        `INSERT INTO npcs (id, campaign_id, name, role, race, description, personality, voice_style, depth, secrets, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          npcId,
          ctx.campaignId,
          generated.name,
          generated.role,
          generated.race || "Human",
          generated.description,
          generated.personality,
          generated.voice,
          input.depth,
          toJson([generated.secret]),
          now(),
          now(),
        ]
      );

      return {
        id: npcId,
        ...generated,
      };
    }),

  // ---------------------------------------------------------------------------
  // GENERATE ENCOUNTER
  // ---------------------------------------------------------------------------
  generateEncounter: gmProcedure
    .input(z.object({
      partyLevel: z.number().min(1).max(20),
      partySize: z.number().min(1).max(10).default(4),
      difficulty: z.enum(["easy", "medium", "hard", "deadly"]),
      environment: z.string().optional(),
      theme: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const context = await buildContext(ctx.campaignId, { includeLocation: true });

      const client = new GeminiClient("gemini-2.5-flash");
      const result = await client.generate({
        systemInstruction: `You are a D&D 5e encounter designer. Create balanced, interesting combat encounters.`,
        prompt: `
Campaign Context: ${context.summary}
Party: ${input.partySize} players, level ${input.partyLevel}
Difficulty: ${input.difficulty}
${input.environment ? `Environment: ${input.environment}` : ""}
${input.theme ? `Theme: ${input.theme}` : ""}

Design an encounter. Respond in JSON:
{
  "name": "Encounter name",
  "description": "Brief scene-setting description",
  "enemies": [
    {"name": "Creature name", "count": 2, "cr": "1/2", "notes": "tactical notes"}
  ],
  "terrain": ["terrain feature 1", "terrain feature 2"],
  "tactics": "How enemies fight",
  "twist": "Optional complication or twist",
  "loot": "What they're carrying"
}`,
      });

      const generated = JSON.parse(result.text);
      return generated;
    }),

  // ---------------------------------------------------------------------------
  // GENERATE LOOT
  // ---------------------------------------------------------------------------
  generateLoot: gmProcedure
    .input(z.object({
      partyLevel: z.number().min(1).max(20),
      tier: z.enum(["individual", "hoard", "boss"]),
      theme: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = new GeminiClient("gemini-2.5-flash");

      const goldMultiplier = {
        individual: 1,
        hoard: 10,
        boss: 25,
      };

      const result = await client.generate({
        systemInstruction: `You are a D&D 5e loot generator. Create interesting, level-appropriate treasure.`,
        prompt: `
Party Level: ${input.partyLevel}
Loot Tier: ${input.tier}
${input.theme ? `Theme: ${input.theme}` : ""}

Generate treasure. Respond in JSON:
{
  "gold": ${Math.floor(input.partyLevel * 10 * goldMultiplier[input.tier])},
  "items": [
    {
      "name": "Item name",
      "rarity": "common|uncommon|rare|very_rare|legendary",
      "type": "weapon|armor|potion|scroll|wondrous|other",
      "description": "Brief description or effect"
    }
  ]
}

Include ${input.tier === "individual" ? "0-1" : input.tier === "hoard" ? "2-4" : "3-6"} magic items appropriate for level ${input.partyLevel}.`,
      });

      const generated = JSON.parse(result.text);
      return generated;
    }),

  // ---------------------------------------------------------------------------
  // GM ASSISTANT - Out-of-character help
  // ---------------------------------------------------------------------------
  gmAssist: gmProcedure
    .input(z.object({
      question: z.string().min(1).max(2000),
      sessionId: z.string().uuid().optional(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const context = await buildContext(ctx.campaignId, {
        sessionId: input.sessionId,
        includeWorld: true,
        includeParty: true,
      });

      const client = new GeminiClient("gemini-2.5-flash");
      const result = await client.generate({
        systemInstruction: `You are an experienced TTRPG Game Master assistant. Help with rules questions, story advice, pacing, and improvisation. Be concise and practical. Reference D&D 5e rules when relevant but note that house rules may apply.`,
        prompt: `
Campaign Context:
${context.summary}

${input.conversationHistory?.length ? `Previous conversation:\n${input.conversationHistory.map(m => `${m.role}: ${m.content}`).join("\n")}\n` : ""}

GM Question: ${input.question}`,
      });

      // Categorize the response
      const category = categorizeGmResponse(input.question);

      return {
        message: result.text,
        category,
      };
    }),

  // ---------------------------------------------------------------------------
  // ORCHESTRATE - Multi-agent routing
  // ---------------------------------------------------------------------------
  orchestrate: campaignProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      sessionId: z.string().uuid().optional(),
      context: z.object({
        currentScene: z.string().optional(),
        currentLocation: z.string().optional(),
        activeNpcs: z.array(z.string()).optional(),
        combatActive: z.boolean().optional(),
      }).optional(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // First, classify the request
      const client = new GeminiClient("gemini-2.5-flash");

      const classificationResult = await client.generate({
        systemInstruction: `Classify the user's TTRPG request into one category. Respond with only the category name.`,
        prompt: `
Categories:
- narrator: Narration, scene description, story progression
- npc: Talking to or about a specific NPC
- rules: Rules questions, mechanics, how things work
- combat: Combat tactics, initiative, damage
- world: World lore, locations, factions
- general: Everything else

User message: "${input.message}"

Category:`,
      });

      const agent = classificationResult.text.trim().toLowerCase() as string;
      const validAgents = ["narrator", "npc", "rules", "combat", "world", "general"];
      const selectedAgent = validAgents.includes(agent) ? agent : "general";

      // Build context based on agent type
      const campaignContext = await buildContext(ctx.campaignId, {
        sessionId: input.sessionId,
        includeWorld: selectedAgent === "world" || selectedAgent === "narrator",
        includeParty: selectedAgent === "combat",
        includeLocation: true,
      });

      // Generate response with agent-specific system prompt
      const systemPrompts: Record<string, string> = {
        narrator: "You are a TTRPG narrator. Describe scenes vividly but concisely. Use second person ('You see...').",
        npc: "You roleplay as NPCs in character. Use distinct voices. Stay in character.",
        rules: "You are a D&D 5e rules expert. Cite specific rules when possible. Be precise.",
        combat: "You are a combat advisor. Help with tactics, positioning, and action economy.",
        world: "You are a lorekeeper. Share world information that the characters would know.",
        general: "You are a helpful TTRPG assistant. Be concise and practical.",
      };

      const response = await client.generate({
        systemInstruction: systemPrompts[selectedAgent],
        prompt: `
Campaign: ${campaignContext.summary}
${input.context?.currentScene ? `Current Scene: ${input.context.currentScene}` : ""}
${input.context?.currentLocation ? `Location: ${input.context.currentLocation}` : ""}
${input.context?.combatActive ? "Combat is active." : ""}

${input.conversationHistory?.length ? `Conversation:\n${input.conversationHistory.map(m => `${m.role}: ${m.content}`).join("\n")}\n` : ""}

User: ${input.message}`,
      });

      return {
        message: response.text,
        agent: selectedAgent,
      };
    }),
});

// =============================================================================
// HELPERS
// =============================================================================

function getDepthPrompt(depth: number): string {
  const prompts: Record<number, string> = {
    1: "Surface details: Expand personality, add 1-2 quirks, basic motivation.",
    2: "Medium depth: Full backstory, relationships, fears, 2-3 secrets.",
    3: "Deep: Hidden agendas, dark past, complex motivations, campaign hooks.",
    4: "Very deep: Campaign-altering revelations, major secrets, true nature.",
    5: "Abyss: Fundamental truths that reshape reality, cosmic connections.",
  };
  return prompts[depth] || prompts[1];
}

function categorizeGmResponse(question: string): string {
  const lower = question.toLowerCase();
  if (lower.includes("rule") || lower.includes("how does") || lower.includes("can i") || lower.includes("does")) {
    return "rules";
  }
  if (lower.includes("advice") || lower.includes("should") || lower.includes("idea") || lower.includes("help")) {
    return "advice";
  }
  if (lower.includes("remind") || lower.includes("remember") || lower.includes("last session")) {
    return "reminder";
  }
  return "general";
}
