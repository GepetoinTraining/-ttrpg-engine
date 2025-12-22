import { z } from "zod";
import {
  router,
  gmProcedure,
  ownerProcedure,
  IdInput,
  PaginationInput,
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
import * as nodes from "../../db/queries/nodes";
import * as campaigns from "../../db/queries/campaigns";

// ============================================
// GM ROUTER
// ============================================
//
// GM-only tools for campaign management.
//

export const gmRouter = router({
  // ==========================================
  // GM NOTES
  // ==========================================

  /**
   * Get GM notes for entity
   */
  getNotes: gmProcedure
    .input(
      z.object({
        entityType: z.enum([
          "campaign",
          "session",
          "location",
          "npc",
          "quest",
          "faction",
          "character",
        ]),
        entityId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return queryAll<any>(
        `SELECT * FROM gm_notes
         WHERE campaign_id = ? AND entity_type = ? AND entity_id = ?
         ORDER BY created_at DESC`,
        [ctx.campaignId, input.entityType, input.entityId],
      );
    }),

  /**
   * Create GM note
   */
  createNote: gmProcedure
    .input(
      z.object({
        entityType: z.enum([
          "campaign",
          "session",
          "location",
          "npc",
          "quest",
          "faction",
          "character",
        ]),
        entityId: z.string().uuid(),
        title: z.string().max(200).optional(),
        content: z.string(),
        tags: z.array(z.string()).optional(),
        isSecret: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      const timestamp = now();

      await query(
        `INSERT INTO gm_notes (
          id, campaign_id, entity_type, entity_id,
          title, content, tags, is_secret,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.campaignId,
          input.entityType,
          input.entityId,
          input.title || null,
          input.content,
          toJson(input.tags || []),
          input.isSecret ? 1 : 0,
          ctx.auth.userId,
          timestamp,
          timestamp,
        ],
      );

      return queryOne("SELECT * FROM gm_notes WHERE id = ?", [id]);
    }),

  /**
   * Update GM note
   */
  updateNote: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().max(200).optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isSecret: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const setClauses: string[] = ["updated_at = ?"];
      const params: any[] = [now()];

      if (updates.title !== undefined) {
        setClauses.push("title = ?");
        params.push(updates.title);
      }
      if (updates.content !== undefined) {
        setClauses.push("content = ?");
        params.push(updates.content);
      }
      if (updates.tags !== undefined) {
        setClauses.push("tags = ?");
        params.push(toJson(updates.tags));
      }
      if (updates.isSecret !== undefined) {
        setClauses.push("is_secret = ?");
        params.push(updates.isSecret ? 1 : 0);
      }

      params.push(id);
      await query(
        `UPDATE gm_notes SET ${setClauses.join(", ")} WHERE id = ?`,
        params,
      );

      return queryOne("SELECT * FROM gm_notes WHERE id = ?", [id]);
    }),

  /**
   * Delete GM note
   */
  deleteNote: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query("DELETE FROM gm_notes WHERE id = ? AND campaign_id = ?", [
      input.id,
      ctx.campaignId,
    ]);
    return { success: true };
  }),

  /**
   * Search GM notes
   */
  searchNotes: gmProcedure
    .input(
      z.object({
        query: z.string().min(1),
        entityType: z.string().optional(),
        tags: z.array(z.string()).optional(),
        ...PaginationInput.shape,
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions: string[] = [
        "campaign_id = ?",
        "(title LIKE ? OR content LIKE ?)",
      ];
      const searchPattern = `%${input.query}%`;
      const params: any[] = [ctx.campaignId, searchPattern, searchPattern];

      if (input.entityType) {
        conditions.push("entity_type = ?");
        params.push(input.entityType);
      }

      const offset = (input.page - 1) * input.pageSize;

      return queryAll<any>(
        `SELECT * FROM gm_notes WHERE ${conditions.join(" AND ")}
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
        [...params, input.pageSize, offset],
      );
    }),

  // ==========================================
  // SECRETS
  // ==========================================

  /**
   * Get all campaign secrets
   */
  secrets: gmProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          revealed: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: string[] = ["campaign_id = ?"];
      const params: any[] = [ctx.campaignId];

      if (input?.category) {
        conditions.push("category = ?");
        params.push(input.category);
      }
      if (input?.revealed !== undefined) {
        conditions.push("is_revealed = ?");
        params.push(input.revealed ? 1 : 0);
      }

      return queryAll<any>(
        `SELECT * FROM campaign_secrets WHERE ${conditions.join(" AND ")}
         ORDER BY importance DESC, created_at`,
        params,
      );
    }),

  /**
   * Create secret
   */
  createSecret: gmProcedure
    .input(
      z.object({
        title: z.string().max(200),
        content: z.string(),
        category: z.enum(["plot", "npc", "location", "item", "lore", "other"]),
        importance: z.number().int().min(1).max(10).default(5),
        revealCondition: z.string().optional(),
        linkedEntityType: z.string().optional(),
        linkedEntityId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      const timestamp = now();

      await query(
        `INSERT INTO campaign_secrets (
          id, campaign_id, title, content, category,
          importance, reveal_condition,
          linked_entity_type, linked_entity_id,
          is_revealed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          id,
          ctx.campaignId,
          input.title,
          input.content,
          input.category,
          input.importance,
          input.revealCondition || null,
          input.linkedEntityType || null,
          input.linkedEntityId || null,
          timestamp,
          timestamp,
        ],
      );

      return queryOne("SELECT * FROM campaign_secrets WHERE id = ?", [id]);
    }),

  /**
   * Reveal secret
   */
  revealSecret: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        revealedTo: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await query(
        `UPDATE campaign_secrets SET
          is_revealed = 1,
          revealed_at = ?,
          revealed_to = ?
         WHERE id = ?`,
        [now(), toJson(input.revealedTo || []), input.id],
      );

      return queryOne("SELECT * FROM campaign_secrets WHERE id = ?", [
        input.id,
      ]);
    }),

  // ==========================================
  // TIMELINE / EVENTS
  // ==========================================

  /**
   * Get campaign timeline
   */
  timeline: gmProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: string[] = ["campaign_id = ?"];
      const params: any[] = [ctx.campaignId];

      if (input?.startDate) {
        conditions.push("event_date >= ?");
        params.push(input.startDate);
      }
      if (input?.endDate) {
        conditions.push("event_date <= ?");
        params.push(input.endDate);
      }
      if (input?.type) {
        conditions.push("type = ?");
        params.push(input.type);
      }

      return queryAll<any>(
        `SELECT * FROM campaign_timeline WHERE ${conditions.join(" AND ")}
         ORDER BY event_date, created_at`,
        params,
      );
    }),

  /**
   * Add timeline event
   */
  addTimelineEvent: gmProcedure
    .input(
      z.object({
        eventDate: z.string(),
        title: z.string().max(200),
        description: z.string().max(2000).optional(),
        type: z.enum(["session", "world", "character", "faction", "custom"]),
        importance: z.number().int().min(1).max(10).default(5),
        linkedSessionId: z.string().uuid().optional(),
        isPlayerVisible: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();

      await query(
        `INSERT INTO campaign_timeline (
          id, campaign_id, event_date, title, description,
          type, importance, linked_session_id, is_player_visible, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.campaignId,
          input.eventDate,
          input.title,
          input.description || null,
          input.type,
          input.importance,
          input.linkedSessionId || null,
          input.isPlayerVisible ? 1 : 0,
          now(),
        ],
      );

      return queryOne("SELECT * FROM campaign_timeline WHERE id = ?", [id]);
    }),

  // ==========================================
  // RANDOM GENERATORS
  // ==========================================

  /**
   * Random encounter
   */
  randomEncounter: gmProcedure
    .input(
      z.object({
        environment: z.enum([
          "forest",
          "mountain",
          "desert",
          "swamp",
          "urban",
          "dungeon",
          "coastal",
          "arctic",
          "plains",
          "underdark",
        ]),
        partyLevel: z.number().int().min(1).max(20),
        difficulty: z.enum(["easy", "medium", "hard", "deadly"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Placeholder - would integrate with monster data
      const encounters: Record<string, string[]> = {
        forest: ["Wolves", "Bandits", "Owlbear", "Green Hag", "Treant"],
        urban: [
          "Thugs",
          "Noble with Guards",
          "Spy",
          "Assassin",
          "Thieves Guild",
        ],
        dungeon: ["Goblins", "Skeletons", "Gelatinous Cube", "Mimic", "Dragon"],
      };

      const options = encounters[input.environment] || encounters.forest;
      const encounter = options[Math.floor(Math.random() * options.length)];

      return {
        encounter,
        environment: input.environment,
        suggestedCR: input.partyLevel,
        difficulty: input.difficulty,
      };
    }),

  /**
   * Random NPC
   */
  randomNPC: gmProcedure
    .input(
      z.object({
        race: z.string().optional(),
        occupation: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const races = [
        "Human",
        "Elf",
        "Dwarf",
        "Halfling",
        "Gnome",
        "Half-Orc",
        "Tiefling",
      ];
      const occupations = [
        "Merchant",
        "Guard",
        "Innkeeper",
        "Scholar",
        "Farmer",
        "Artisan",
        "Sailor",
      ];
      const traits = [
        "Friendly",
        "Suspicious",
        "Nervous",
        "Boastful",
        "Quiet",
        "Curious",
        "Grumpy",
      ];
      const quirks = [
        "Talks to self",
        "Collects coins",
        "Afraid of dogs",
        "Always hungry",
        "Tells bad jokes",
      ];

      return {
        race: input.race || races[Math.floor(Math.random() * races.length)],
        occupation:
          input.occupation ||
          occupations[Math.floor(Math.random() * occupations.length)],
        personality: traits[Math.floor(Math.random() * traits.length)],
        quirk: quirks[Math.floor(Math.random() * quirks.length)],
      };
    }),

  /**
   * Random loot
   */
  randomLoot: gmProcedure
    .input(
      z.object({
        cr: z.number().int().min(0).max(30),
        type: z.enum(["individual", "hoard"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Simplified loot tables
      const goldMultiplier = input.type === "hoard" ? 10 : 1;
      const baseGold =
        Math.floor(Math.random() * (10 * input.cr + 10)) * goldMultiplier;

      const items = [];
      if (input.type === "hoard" && Math.random() > 0.5) {
        items.push("Magic Item (roll on appropriate table)");
      }
      if (Math.random() > 0.7) {
        items.push("Gems worth " + Math.floor(baseGold * 0.5) + " gp");
      }

      return {
        gold: baseGold,
        silver: Math.floor(Math.random() * 50),
        copper: Math.floor(Math.random() * 100),
        items,
        cr: input.cr,
        type: input.type,
      };
    }),

  // ==========================================
  // CAMPAIGN SETTINGS
  // ==========================================

  /**
   * Get campaign settings
   */
  settings: gmProcedure.query(async ({ ctx }) => {
    const campaign = await campaigns.getCampaign(ctx.campaignId);
    return campaign?.settings || {};
  }),

  /**
   * Update campaign settings
   */
  updateSettings: ownerProcedure
    .input(
      z.object({
        settings: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return campaigns.updateCampaign(ctx.campaignId, {
        settings: input.settings,
      });
    }),

  // ==========================================
  // AUDIT LOG
  // ==========================================

  /**
   * Get audit log
   */
  auditLog: ownerProcedure
    .input(
      z
        .object({
          entityType: z.string().optional(),
          actorId: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: string[] = ["campaign_id = ?"];
      const params: any[] = [ctx.campaignId];

      if (input?.entityType) {
        conditions.push("entity_type = ?");
        params.push(input.entityType);
      }
      if (input?.actorId) {
        conditions.push("actor_id = ?");
        params.push(input.actorId);
      }

      return queryAll<any>(
        `SELECT * FROM audit_log WHERE ${conditions.join(" AND ")}
         ORDER BY timestamp DESC LIMIT ?`,
        [...params, input?.limit || 50],
      );
    }),
});
