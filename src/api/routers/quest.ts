import { z } from "zod";
import {
  router,
  campaignProcedure,
  gmProcedure,
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

// ============================================
// QUEST ROUTER
// ============================================

const QuestObjectiveInput = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  type: z.enum(["main", "optional", "hidden", "bonus"]).default("main"),
  isComplete: z.boolean().default(false),
  isRevealed: z.boolean().default(true),
  order: z.number().int().default(0),
});

export const questRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get quest by ID
   */
  get: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const quest = await queryOne<any>(
      "SELECT * FROM quests WHERE id = ? AND campaign_id = ?",
      [input.id, ctx.campaignId],
    );
    if (!quest) notFound("Quest", input.id);

    // Get objectives
    const objectives = await queryAll<any>(
      'SELECT * FROM quest_objectives WHERE quest_id = ? ORDER BY "order"',
      [input.id],
    );

    // Filter hidden for non-GMs
    if (!ctx.checker.isGM()) {
      quest.objectives = objectives.filter((o: any) => o.isRevealed);
      // Hide secret rewards
      const data = parseJson<any>(quest.data);
      if (data?.secretReward) delete data.secretReward;
      quest.data = toJson(data);
    } else {
      quest.objectives = objectives;
    }

    return quest;
  }),

  /**
   * List quests
   */
  list: campaignProcedure
    .input(
      z
        .object({
          status: z
            .enum(["available", "active", "completed", "failed", "abandoned"])
            .optional(),
          type: z.string().optional(),
          giverNpcId: z.string().uuid().optional(),
          ...PaginationInput.shape,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: string[] = ["campaign_id = ?"];
      const params: any[] = [ctx.campaignId];

      if (input?.status) {
        conditions.push("status = ?");
        params.push(input.status);
      }
      if (input?.type) {
        conditions.push("type = ?");
        params.push(input.type);
      }
      if (input?.giverNpcId) {
        conditions.push("giver_npc_id = ?");
        params.push(input.giverNpcId);
      }

      // Non-GMs only see revealed quests
      if (!ctx.checker.isGM()) {
        conditions.push("is_revealed = 1");
      }

      const page = input?.page || 1;
      const pageSize = input?.pageSize || 20;
      const offset = (page - 1) * pageSize;

      return queryAll<any>(
        `SELECT * FROM quests WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );
    }),

  /**
   * Get active quests
   */
  active: campaignProcedure.query(async ({ ctx }) => {
    const conditions = ctx.checker.isGM()
      ? "campaign_id = ? AND status = 'active'"
      : "campaign_id = ? AND status = 'active' AND is_revealed = 1";

    const quests = await queryAll<any>(
      `SELECT * FROM quests WHERE ${conditions} ORDER BY priority DESC, created_at`,
      [ctx.campaignId],
    );

    // Get objectives for each
    for (const quest of quests) {
      const objectives = await queryAll<any>(
        'SELECT * FROM quest_objectives WHERE quest_id = ? ORDER BY "order"',
        [quest.id],
      );
      quest.objectives = ctx.checker.isGM()
        ? objectives
        : objectives.filter((o: any) => o.isRevealed);
    }

    return quests;
  }),

  // ==========================================
  // MUTATIONS - CRUD
  // ==========================================

  /**
   * Create quest
   */
  create: gmProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(5000),
        type: z
          .enum(["main", "side", "personal", "faction", "hidden"])
          .default("side"),
        priority: z.number().int().min(0).max(10).default(5),
        giverNpcId: z.string().uuid().optional(),
        locationId: z.string().uuid().optional(),
        rewards: z
          .object({
            gold: z.number().int().optional(),
            experience: z.number().int().optional(),
            items: z.array(z.string()).optional(),
            reputation: z.record(z.string(), z.number()).optional(),
          })
          .optional(),
        secretReward: z.string().optional(),
        objectives: z.array(QuestObjectiveInput).optional(),
        isRevealed: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      const timestamp = now();

      const data = {
        rewards: input.rewards,
        secretReward: input.secretReward,
      };

      await query(
        `INSERT INTO quests (
          id, campaign_id, name, description, type, status, priority,
          giver_npc_id, location_id, data, is_revealed,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          ctx.campaignId,
          input.name,
          input.description,
          input.type,
          input.priority,
          input.giverNpcId || null,
          input.locationId || null,
          toJson(data),
          input.isRevealed ? 1 : 0,
          timestamp,
          timestamp,
        ],
      );

      // Create objectives
      if (input.objectives) {
        for (const obj of input.objectives) {
          await query(
            `INSERT INTO quest_objectives (
              id, quest_id, description, type, is_complete, is_revealed, "order"
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              obj.id || uuid(),
              id,
              obj.description,
              obj.type,
              obj.isComplete ? 1 : 0,
              obj.isRevealed ? 1 : 0,
              obj.order,
            ],
          );
        }
      }

      return queryOne("SELECT * FROM quests WHERE id = ?", [id]);
    }),

  /**
   * Update quest
   */
  update: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(5000).optional(),
        status: z
          .enum(["available", "active", "completed", "failed", "abandoned"])
          .optional(),
        priority: z.number().int().min(0).max(10).optional(),
        isRevealed: z.boolean().optional(),
        rewards: z
          .object({
            gold: z.number().int().optional(),
            experience: z.number().int().optional(),
            items: z.array(z.string()).optional(),
            reputation: z.record(z.string(), z.number()).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, rewards, ...updates } = input;

      const quest = await queryOne<any>(
        "SELECT * FROM quests WHERE id = ? AND campaign_id = ?",
        [id, ctx.campaignId],
      );
      if (!quest) notFound("Quest", id);

      const setClauses: string[] = ["updated_at = ?", "version = version + 1"];
      const params: any[] = [now()];

      if (updates.name !== undefined) {
        setClauses.push("name = ?");
        params.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push("description = ?");
        params.push(updates.description);
      }
      if (updates.status !== undefined) {
        setClauses.push("status = ?");
        params.push(updates.status);
      }
      if (updates.priority !== undefined) {
        setClauses.push("priority = ?");
        params.push(updates.priority);
      }
      if (updates.isRevealed !== undefined) {
        setClauses.push("is_revealed = ?");
        params.push(updates.isRevealed ? 1 : 0);
      }

      if (rewards !== undefined) {
        const data = parseJson<any>(quest.data) || {};
        data.rewards = rewards;
        setClauses.push("data = ?");
        params.push(toJson(data));
      }

      params.push(id);

      await query(
        `UPDATE quests SET ${setClauses.join(", ")} WHERE id = ?`,
        params,
      );

      return queryOne("SELECT * FROM quests WHERE id = ?", [id]);
    }),

  /**
   * Delete quest
   */
  delete: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query("DELETE FROM quest_objectives WHERE quest_id = ?", [input.id]);
    await query("DELETE FROM quests WHERE id = ? AND campaign_id = ?", [
      input.id,
      ctx.campaignId,
    ]);
    return { success: true };
  }),

  // ==========================================
  // MUTATIONS - OBJECTIVES
  // ==========================================

  /**
   * Add objective
   */
  addObjective: gmProcedure
    .input(
      z.object({
        questId: z.string().uuid(),
        ...QuestObjectiveInput.shape,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = input.id || uuid();

      await query(
        `INSERT INTO quest_objectives (
          id, quest_id, description, type, is_complete, is_revealed, "order"
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.questId,
          input.description,
          input.type,
          input.isComplete ? 1 : 0,
          input.isRevealed ? 1 : 0,
          input.order,
        ],
      );

      return queryOne("SELECT * FROM quest_objectives WHERE id = ?", [id]);
    }),

  /**
   * Update objective
   */
  updateObjective: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        description: z.string().max(500).optional(),
        isComplete: z.boolean().optional(),
        isRevealed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const setClauses: string[] = [];
      const params: any[] = [];

      if (updates.description !== undefined) {
        setClauses.push("description = ?");
        params.push(updates.description);
      }
      if (updates.isComplete !== undefined) {
        setClauses.push("is_complete = ?");
        params.push(updates.isComplete ? 1 : 0);
      }
      if (updates.isRevealed !== undefined) {
        setClauses.push("is_revealed = ?");
        params.push(updates.isRevealed ? 1 : 0);
      }

      if (setClauses.length === 0)
        return queryOne("SELECT * FROM quest_objectives WHERE id = ?", [id]);

      params.push(id);
      await query(
        `UPDATE quest_objectives SET ${setClauses.join(", ")} WHERE id = ?`,
        params,
      );

      return queryOne("SELECT * FROM quest_objectives WHERE id = ?", [id]);
    }),

  /**
   * Complete objective
   */
  completeObjective: campaignProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // GM or during active session
      if (!ctx.checker.isGM()) {
        // Could add session check here
      }

      await query("UPDATE quest_objectives SET is_complete = 1 WHERE id = ?", [
        input.id,
      ]);

      // Check if all main objectives complete
      const objective = await queryOne<any>(
        "SELECT quest_id FROM quest_objectives WHERE id = ?",
        [input.id],
      );

      if (objective) {
        const incomplete = await queryOne<any>(
          `SELECT COUNT(*) as count FROM quest_objectives
           WHERE quest_id = ? AND type = 'main' AND is_complete = 0`,
          [objective.questId],
        );

        // Auto-complete quest if all main objectives done
        if (incomplete?.count === 0) {
          await query(
            `UPDATE quests SET status = 'completed', updated_at = ? WHERE id = ?`,
            [now(), objective.questId],
          );
        }
      }

      return { success: true };
    }),

  // ==========================================
  // MUTATIONS - STATUS
  // ==========================================

  /**
   * Accept quest (make active)
   */
  accept: campaignProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query(
      `UPDATE quests SET status = 'active', updated_at = ?
         WHERE id = ? AND campaign_id = ? AND status = 'available'`,
      [now(), input.id, ctx.campaignId],
    );
    return queryOne("SELECT * FROM quests WHERE id = ?", [input.id]);
  }),

  /**
   * Complete quest
   */
  complete: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query(
      `UPDATE quests SET status = 'completed', updated_at = ? WHERE id = ?`,
      [now(), input.id],
    );
    return queryOne("SELECT * FROM quests WHERE id = ?", [input.id]);
  }),

  /**
   * Fail quest
   */
  fail: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query(
      `UPDATE quests SET status = 'failed', updated_at = ? WHERE id = ?`,
      [now(), input.id],
    );
    return queryOne("SELECT * FROM quests WHERE id = ?", [input.id]);
  }),

  /**
   * Reveal quest to players
   */
  reveal: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query(
      "UPDATE quests SET is_revealed = 1, updated_at = ? WHERE id = ?",
      [now(), input.id],
    );
    return { success: true };
  }),
});
