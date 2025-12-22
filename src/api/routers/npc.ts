import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  campaignProcedure,
  gmProcedure,
  IdInput,
  PaginationInput,
  SearchInput,
  notFound,
} from "../trpc";
import {
  query,
  queryOne,
  queryAll,
  uuid,
  now,
  toJson,
  parseJson,
} from "../../db/client";
import {
  getGeminiClient,
  type NPCContext,
  type ConversationMessage,
} from "../../ai";

// ============================================
// NPC ROUTER
// ============================================

const NPCInput = z.object({
  name: z.string().min(1).max(100),
  race: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
  personality: z.string().max(1000),
  voice: z.string().max(500),
  motivations: z.array(z.string()).default([]),
  secrets: z.array(z.string()).optional(),
  knowledgeTopics: z.array(z.string()).default([]),
  rumors: z.array(z.string()).optional(),
  currentLocation: z.string().max(200),
  currentActivity: z.string().max(200).optional(),
  mood: z.string().max(50).default("neutral"),
  portraitUrl: z.string().url().optional(),
  statBlock: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().default(true),
});

export const npcRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get NPC by ID
   */
  get: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const npc = await queryOne<any>(
      "SELECT * FROM npcs WHERE id = ? AND campaign_id = ?",
      [input.id, ctx.campaignId],
    );
    if (!npc) notFound("NPC", input.id);

    // Hide secrets from non-GMs
    if (!ctx.checker.isGM() && npc.data) {
      const data = parseJson<any>(npc.data);
      if (data) {
        delete data.secrets;
        npc.data = toJson(data);
      }
    }

    return npc;
  }),

  /**
   * List NPCs
   */
  list: campaignProcedure
    .input(
      z
        .object({
          locationId: z.string().uuid().optional(),
          isActive: z.boolean().optional(),
          ...PaginationInput.shape,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: string[] = ["campaign_id = ?"];
      const params: any[] = [ctx.campaignId];

      if (input?.locationId) {
        conditions.push("current_location_id = ?");
        params.push(input.locationId);
      }
      if (input?.isActive !== undefined) {
        conditions.push("is_active = ?");
        params.push(input.isActive ? 1 : 0);
      }

      const page = input?.page || 1;
      const pageSize = input?.pageSize || 20;
      const offset = (page - 1) * pageSize;

      const npcs = await queryAll<any>(
        `SELECT * FROM npcs WHERE ${conditions.join(" AND ")}
         ORDER BY name LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );

      // Hide secrets from non-GMs
      if (!ctx.checker.isGM()) {
        for (const npc of npcs) {
          if (npc.data) {
            const data = parseJson<any>(npc.data);
            if (data) {
              delete data.secrets;
              npc.data = toJson(data);
            }
          }
        }
      }

      return npcs;
    }),

  /**
   * Search NPCs
   */
  search: campaignProcedure.input(SearchInput).query(async ({ ctx, input }) => {
    const searchPattern = `%${input.query}%`;

    return queryAll<any>(
      `SELECT * FROM npcs
         WHERE campaign_id = ? AND (name LIKE ? OR occupation LIKE ?)
         ORDER BY name LIMIT ?`,
      [ctx.campaignId, searchPattern, searchPattern, input.pageSize],
    );
  }),

  /**
   * Get NPC relationships
   */
  relationships: campaignProcedure
    .input(IdInput)
    .query(async ({ ctx, input }) => {
      return queryAll<any>(`SELECT * FROM npc_relationships WHERE npc_id = ?`, [
        input.id,
      ]);
    }),

  /**
   * Get conversation history
   */
  conversationHistory: campaignProcedure
    .input(
      z.object({
        npcId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return queryAll<any>(
        `SELECT * FROM agent_memories
         WHERE agent_id = ? AND type = 'conversation'
         ORDER BY created_at DESC LIMIT ?`,
        [input.npcId, input.limit],
      );
    }),

  // ==========================================
  // MUTATIONS - CRUD
  // ==========================================

  /**
   * Create NPC
   */
  create: gmProcedure.input(NPCInput).mutation(async ({ ctx, input }) => {
    const id = uuid();
    const timestamp = now();

    const data = {
      personality: input.personality,
      voice: input.voice,
      motivations: input.motivations,
      secrets: input.secrets,
      knowledgeTopics: input.knowledgeTopics,
      rumors: input.rumors,
      mood: input.mood,
      statBlock: input.statBlock,
    };

    await query(
      `INSERT INTO npcs (
          id, campaign_id, name, race, occupation,
          current_location, current_activity,
          portrait_url, data, is_active,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        ctx.campaignId,
        input.name,
        input.race || null,
        input.occupation || null,
        input.currentLocation,
        input.currentActivity || null,
        input.portraitUrl || null,
        toJson(data),
        input.isActive ? 1 : 0,
        timestamp,
        timestamp,
      ],
    );

    return queryOne("SELECT * FROM npcs WHERE id = ?", [id]);
  }),

  /**
   * Update NPC
   */
  update: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        ...NPCInput.partial().shape,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const npc = await queryOne<any>(
        "SELECT * FROM npcs WHERE id = ? AND campaign_id = ?",
        [id, ctx.campaignId],
      );
      if (!npc) notFound("NPC", id);

      const currentData = parseJson<any>(npc.data) || {};
      const newData = { ...currentData };

      if (updates.personality !== undefined)
        newData.personality = updates.personality;
      if (updates.voice !== undefined) newData.voice = updates.voice;
      if (updates.motivations !== undefined)
        newData.motivations = updates.motivations;
      if (updates.secrets !== undefined) newData.secrets = updates.secrets;
      if (updates.knowledgeTopics !== undefined)
        newData.knowledgeTopics = updates.knowledgeTopics;
      if (updates.rumors !== undefined) newData.rumors = updates.rumors;
      if (updates.mood !== undefined) newData.mood = updates.mood;
      if (updates.statBlock !== undefined)
        newData.statBlock = updates.statBlock;

      const setClauses: string[] = [
        "updated_at = ?",
        "version = version + 1",
        "data = ?",
      ];
      const params: any[] = [now(), toJson(newData)];

      if (updates.name !== undefined) {
        setClauses.push("name = ?");
        params.push(updates.name);
      }
      if (updates.race !== undefined) {
        setClauses.push("race = ?");
        params.push(updates.race);
      }
      if (updates.occupation !== undefined) {
        setClauses.push("occupation = ?");
        params.push(updates.occupation);
      }
      if (updates.currentLocation !== undefined) {
        setClauses.push("current_location = ?");
        params.push(updates.currentLocation);
      }
      if (updates.currentActivity !== undefined) {
        setClauses.push("current_activity = ?");
        params.push(updates.currentActivity);
      }
      if (updates.portraitUrl !== undefined) {
        setClauses.push("portrait_url = ?");
        params.push(updates.portraitUrl);
      }
      if (updates.isActive !== undefined) {
        setClauses.push("is_active = ?");
        params.push(updates.isActive ? 1 : 0);
      }

      params.push(id);

      await query(
        `UPDATE npcs SET ${setClauses.join(", ")} WHERE id = ?`,
        params,
      );

      return queryOne("SELECT * FROM npcs WHERE id = ?", [id]);
    }),

  /**
   * Delete NPC
   */
  delete: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query("DELETE FROM npc_relationships WHERE npc_id = ?", [input.id]);
    await query("DELETE FROM agent_memories WHERE agent_id = ?", [input.id]);
    await query("DELETE FROM npcs WHERE id = ? AND campaign_id = ?", [
      input.id,
      ctx.campaignId,
    ]);
    return { success: true };
  }),

  // ==========================================
  // MUTATIONS - RELATIONSHIPS
  // ==========================================

  /**
   * Set relationship
   */
  setRelationship: gmProcedure
    .input(
      z.object({
        npcId: z.string().uuid(),
        targetType: z.enum(["character", "npc", "faction"]),
        targetId: z.string().uuid(),
        targetName: z.string(),
        relationship: z.string().max(100),
        disposition: z.number().int().min(-100).max(100),
        notes: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await queryOne<any>(
        `SELECT id FROM npc_relationships
         WHERE npc_id = ? AND target_type = ? AND target_id = ?`,
        [input.npcId, input.targetType, input.targetId],
      );

      if (existing) {
        await query(
          `UPDATE npc_relationships SET
            relationship = ?, disposition = ?, notes = ?, target_name = ?
           WHERE id = ?`,
          [
            input.relationship,
            input.disposition,
            input.notes || null,
            input.targetName,
            existing.id,
          ],
        );
      } else {
        await query(
          `INSERT INTO npc_relationships (
            id, npc_id, target_type, target_id, target_name,
            relationship, disposition, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(),
            input.npcId,
            input.targetType,
            input.targetId,
            input.targetName,
            input.relationship,
            input.disposition,
            input.notes || null,
          ],
        );
      }

      return { success: true };
    }),

  // ==========================================
  // AI CONVERSATION
  // ==========================================

  /**
   * Generate AI response
   */
  chat: campaignProcedure
    .input(
      z.object({
        npcId: z.string().uuid(),
        sessionId: z.string().uuid(),
        message: z.string().min(1).max(1000),
        speakerName: z.string(),
        locationName: z.string(),
        locationDescription: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const npc = await queryOne<any>(
        "SELECT * FROM npcs WHERE id = ? AND campaign_id = ?",
        [input.npcId, ctx.campaignId],
      );
      if (!npc) notFound("NPC", input.npcId);

      const data = parseJson<any>(npc.data) || {};

      // Get conversation history
      const historyRows = await queryAll<any>(
        `SELECT * FROM agent_memories
         WHERE agent_id = ? AND type = 'conversation' AND session_id = ?
         ORDER BY created_at DESC LIMIT 10`,
        [input.npcId, input.sessionId],
      );

      const history: ConversationMessage[] = historyRows
        .reverse()
        .map((row) => {
          const content = parseJson<any>(row.content);
          return {
            role: content.role as "player" | "npc",
            speaker: content.speaker,
            content: content.message,
            timestamp: new Date(row.createdAt),
          };
        });

      // Get relationships
      const relationships = await queryAll<any>(
        "SELECT * FROM npc_relationships WHERE npc_id = ?",
        [input.npcId],
      );

      // Build NPC context
      const npcContext: NPCContext = {
        id: npc.id,
        name: npc.name,
        race: npc.race,
        occupation: npc.occupation,
        personality: data.personality || "",
        voice: data.voice || "",
        motivations: data.motivations || [],
        secrets: data.secrets,
        knowledgeTopics: data.knowledgeTopics || [],
        rumors: data.rumors,
        relationships: relationships.map((r: any) => ({
          characterName: r.targetName,
          relationship: r.relationship,
          disposition: r.disposition,
        })),
        mood: data.mood || "neutral",
        currentLocation: npc.currentLocation,
        currentActivity: npc.currentActivity,
      };

      // Generate response
      const client = getGeminiClient();
      const response = await client.generateNPCResponse({
        npc: npcContext,
        context: {
          sessionId: input.sessionId,
          campaignId: ctx.campaignId,
          locationName: input.locationName,
          locationDescription: input.locationDescription,
        },
        history,
        playerMessage: input.message,
      });

      // Store player message
      await query(
        `INSERT INTO agent_memories (id, agent_id, session_id, type, content, created_at)
         VALUES (?, ?, ?, 'conversation', ?, ?)`,
        [
          uuid(),
          input.npcId,
          input.sessionId,
          toJson({
            role: "player",
            speaker: input.speakerName,
            message: input.message,
          }),
          now(),
        ],
      );

      // Store NPC response
      await query(
        `INSERT INTO agent_memories (id, agent_id, session_id, type, content, created_at)
         VALUES (?, ?, ?, 'conversation', ?, ?)`,
        [
          uuid(),
          input.npcId,
          input.sessionId,
          toJson({
            role: "npc",
            speaker: npc.name,
            message: response.content,
            emotion: response.emotion,
            action: response.action,
          }),
          now(),
        ],
      );

      return {
        content: response.content,
        emotion: response.emotion,
        action: response.action,
        npcName: npc.name,
      };
    }),
});
