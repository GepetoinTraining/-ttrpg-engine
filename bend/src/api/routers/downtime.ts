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
import * as characters from "../../db/queries/characters";

// ============================================
// DOWNTIME ROUTER
// ============================================

const DowntimeActivityType = z.enum([
  "work",
  "craft",
  "research",
  "train",
  "recuperate",
  "socialize",
  "crime",
  "gambling",
  "pit_fighting",
  "running_business",
  "religious_service",
  "custom",
]);

export const downtimeRouter = router({
  // ==========================================
  // QUERIES
  // ==========================================

  /**
   * Get downtime period by ID
   */
  get: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const period = await queryOne<any>(
      "SELECT * FROM downtime_periods WHERE id = ? AND campaign_id = ?",
      [input.id, ctx.campaignId],
    );
    if (!period) notFound("DowntimePeriod", input.id);

    // Get activities
    period.activities = await queryAll<any>(
      "SELECT * FROM downtime_actions WHERE period_id = ? ORDER BY created_at",
      [input.id],
    );

    return period;
  }),

  /**
   * List downtime periods
   */
  list: campaignProcedure
    .input(
      z
        .object({
          status: z.enum(["active", "completed"]).optional(),
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

      const page = input?.page || 1;
      const pageSize = input?.pageSize || 20;
      const offset = (page - 1) * pageSize;

      return queryAll<any>(
        `SELECT * FROM downtime_periods WHERE ${conditions.join(" AND ")}
         ORDER BY start_date DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );
    }),

  /**
   * Get active downtime
   */
  active: campaignProcedure.query(async ({ ctx }) => {
    const period = await queryOne<any>(
      `SELECT * FROM downtime_periods
         WHERE campaign_id = ? AND status = 'active'
         ORDER BY start_date DESC LIMIT 1`,
      [ctx.campaignId],
    );

    if (period) {
      period.activities = await queryAll<any>(
        "SELECT * FROM downtime_actions WHERE period_id = ? ORDER BY created_at",
        [period.id],
      );
    }

    return period;
  }),

  /**
   * Get character's activities
   */
  characterActivities: campaignProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        periodId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.periodId) {
        return queryAll<any>(
          "SELECT * FROM downtime_actions WHERE character_id = ? AND period_id = ?",
          [input.characterId, input.periodId],
        );
      }
      return queryAll<any>(
        `SELECT da.*, dp.name as period_name FROM downtime_actions da
         JOIN downtime_periods dp ON da.period_id = dp.id
         WHERE da.character_id = ?
         ORDER BY da.created_at DESC LIMIT 50`,
        [input.characterId],
      );
    }),

  // ==========================================
  // MUTATIONS - PERIODS
  // ==========================================

  /**
   * Start downtime period
   */
  startPeriod: gmProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        startDate: z.string(),
        endDate: z.string().optional(),
        daysAvailable: z.number().int().min(1).default(7),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      const timestamp = now();

      await query(
        `INSERT INTO downtime_periods (
          id, campaign_id, name, status,
          start_date, end_date, days_available,
          description, created_at, updated_at
        ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.campaignId,
          input.name,
          input.startDate,
          input.endDate || null,
          input.daysAvailable,
          input.description || null,
          timestamp,
          timestamp,
        ],
      );

      return queryOne("SELECT * FROM downtime_periods WHERE id = ?", [id]);
    }),

  /**
   * End downtime period
   */
  endPeriod: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        endDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await query(
        `UPDATE downtime_periods SET
          status = 'completed',
          end_date = COALESCE(?, end_date, ?),
          updated_at = ?
         WHERE id = ?`,
        [input.endDate || null, now(), now(), input.id],
      );

      return queryOne("SELECT * FROM downtime_periods WHERE id = ?", [
        input.id,
      ]);
    }),

  /**
   * Update period
   */
  updatePeriod: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().max(100).optional(),
        daysAvailable: z.number().int().min(1).optional(),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const setClauses: string[] = ["updated_at = ?"];
      const params: any[] = [now()];

      if (updates.name !== undefined) {
        setClauses.push("name = ?");
        params.push(updates.name);
      }
      if (updates.daysAvailable !== undefined) {
        setClauses.push("days_available = ?");
        params.push(updates.daysAvailable);
      }
      if (updates.description !== undefined) {
        setClauses.push("description = ?");
        params.push(updates.description);
      }

      params.push(id);
      await query(
        `UPDATE downtime_periods SET ${setClauses.join(", ")} WHERE id = ?`,
        params,
      );

      return queryOne("SELECT * FROM downtime_periods WHERE id = ?", [id]);
    }),

  // ==========================================
  // MUTATIONS - ACTIVITIES
  // ==========================================

  /**
   * Start activity
   */
  startActivity: campaignProcedure
    .input(
      z.object({
        periodId: z.string().uuid(),
        characterId: z.string().uuid(),
        type: DowntimeActivityType,
        name: z.string().max(100).optional(),
        daysSpent: z.number().int().min(1),
        goldSpent: z.number().int().min(0).default(0),
        description: z.string().max(1000).optional(),
        targetSkill: z.string().optional(),
        targetItem: z.string().optional(),
        targetLanguage: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const character = await characters.getCharacter(input.characterId);
      if (!character) notFound("Character", input.characterId);

      // Check ownership
      if (character.ownerId !== ctx.auth.userId && !ctx.checker.isGM()) {
        notFound("Character", input.characterId);
      }

      const id = uuid();

      const data = {
        description: input.description,
        targetSkill: input.targetSkill,
        targetItem: input.targetItem,
        targetLanguage: input.targetLanguage,
      };

      await query(
        `INSERT INTO downtime_actions (
          id, period_id, character_id, type, name,
          days_spent, gold_spent, status, data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)`,
        [
          id,
          input.periodId,
          input.characterId,
          input.type,
          input.name || input.type,
          input.daysSpent,
          input.goldSpent,
          toJson(data),
          now(),
        ],
      );

      return queryOne("SELECT * FROM downtime_actions WHERE id = ?", [id]);
    }),

  /**
   * Complete activity
   */
  completeActivity: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        success: z.boolean(),
        outcome: z.string().max(1000),
        goldEarned: z.number().int().optional(),
        itemsGained: z.array(z.string()).optional(),
        experienceGained: z.number().int().optional(),
        complications: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activity = await queryOne<any>(
        "SELECT * FROM downtime_actions WHERE id = ?",
        [input.id],
      );
      if (!activity) notFound("DowntimeAction", input.id);

      const data = parseJson<any>(activity.data) || {};
      data.outcome = input.outcome;
      data.success = input.success;
      data.goldEarned = input.goldEarned;
      data.itemsGained = input.itemsGained;
      data.experienceGained = input.experienceGained;
      data.complications = input.complications;

      await query(
        `UPDATE downtime_actions SET
          status = 'completed',
          data = ?
         WHERE id = ?`,
        [toJson(data), input.id],
      );

      // Apply rewards to character
      if (input.goldEarned && input.goldEarned > 0) {
        await characters.addCurrency(activity.characterId, {
          gold: input.goldEarned,
        });
      }

      if (input.itemsGained) {
        for (const item of input.itemsGained) {
          await characters.addInventoryItem(activity.characterId, {
            name: item,
            type: "misc",
            quantity: 1,
          });
        }
      }

      return queryOne("SELECT * FROM downtime_actions WHERE id = ?", [
        input.id,
      ]);
    }),

  /**
   * Cancel activity
   */
  cancelActivity: campaignProcedure
    .input(IdInput)
    .mutation(async ({ ctx, input }) => {
      const activity = await queryOne<any>(
        "SELECT * FROM downtime_actions WHERE id = ?",
        [input.id],
      );
      if (!activity) notFound("DowntimeAction", input.id);

      const character = await characters.getCharacter(activity.characterId);
      if (!character) notFound("Character", activity.characterId);

      if (character.ownerId !== ctx.auth.userId && !ctx.checker.isGM()) {
        notFound("DowntimeAction", input.id);
      }

      await query("UPDATE downtime_actions SET status = ? WHERE id = ?", [
        "cancelled",
        input.id,
      ]);

      return { success: true };
    }),

  // ==========================================
  // CONVENIENCE - SPECIFIC ACTIVITIES
  // ==========================================

  /**
   * Work for gold
   */
  work: campaignProcedure
    .input(
      z.object({
        periodId: z.string().uuid(),
        characterId: z.string().uuid(),
        days: z.number().int().min(1),
        lifestyle: z.enum([
          "wretched",
          "squalid",
          "poor",
          "modest",
          "comfortable",
          "wealthy",
          "aristocratic",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lifestyleCosts: Record<string, number> = {
        wretched: 0,
        squalid: 1,
        poor: 2,
        modest: 10,
        comfortable: 20,
        wealthy: 40,
        aristocratic: 100,
      };

      const dailyEarnings: Record<string, number> = {
        wretched: 1,
        squalid: 2,
        poor: 5,
        modest: 10,
        comfortable: 20,
        wealthy: 40,
        aristocratic: 100,
      };

      const goldSpent = (lifestyleCosts[input.lifestyle] * input.days) / 10; // per day
      const potentialEarnings =
        (dailyEarnings[input.lifestyle] * input.days) / 10;

      const id = uuid();

      await query(
        `INSERT INTO downtime_actions (
          id, period_id, character_id, type, name,
          days_spent, gold_spent, status, data, created_at
        ) VALUES (?, ?, ?, 'work', 'Working', ?, ?, 'in_progress', ?, ?)`,
        [
          id,
          input.periodId,
          input.characterId,
          input.days,
          goldSpent,
          toJson({ lifestyle: input.lifestyle, potentialEarnings }),
          now(),
        ],
      );

      return queryOne("SELECT * FROM downtime_actions WHERE id = ?", [id]);
    }),

  /**
   * Train skill or tool
   */
  train: campaignProcedure
    .input(
      z.object({
        periodId: z.string().uuid(),
        characterId: z.string().uuid(),
        days: z.number().int().min(1),
        trainingType: z.enum(["language", "tool", "weapon", "skill"]),
        target: z.string(),
        instructorCost: z.number().int().default(250), // 250 days at 1gp/day
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const goldSpent = (input.instructorCost * input.days) / 250;

      const id = uuid();

      await query(
        `INSERT INTO downtime_actions (
          id, period_id, character_id, type, name,
          days_spent, gold_spent, status, data, created_at
        ) VALUES (?, ?, ?, 'train', ?, ?, ?, 'in_progress', ?, ?)`,
        [
          id,
          input.periodId,
          input.characterId,
          `Training: ${input.target}`,
          input.days,
          goldSpent,
          toJson({
            trainingType: input.trainingType,
            target: input.target,
            daysRequired: 250,
            daysCompleted: input.days,
          }),
          now(),
        ],
      );

      return queryOne("SELECT * FROM downtime_actions WHERE id = ?", [id]);
    }),

  /**
   * Craft item
   */
  craft: campaignProcedure
    .input(
      z.object({
        periodId: z.string().uuid(),
        characterId: z.string().uuid(),
        days: z.number().int().min(1),
        itemName: z.string(),
        itemValue: z.number().int(), // in gold
        toolProficiency: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 5gp progress per day, materials = half value
      const progressPerDay = 5;
      const daysRequired = Math.ceil(input.itemValue / progressPerDay);
      const materialCost = Math.floor(input.itemValue / 2);

      const id = uuid();

      await query(
        `INSERT INTO downtime_actions (
          id, period_id, character_id, type, name,
          days_spent, gold_spent, status, data, created_at
        ) VALUES (?, ?, ?, 'craft', ?, ?, ?, 'in_progress', ?, ?)`,
        [
          id,
          input.periodId,
          input.characterId,
          `Crafting: ${input.itemName}`,
          input.days,
          materialCost,
          toJson({
            itemName: input.itemName,
            itemValue: input.itemValue,
            toolProficiency: input.toolProficiency,
            daysRequired,
            daysCompleted: input.days,
            progress: Math.min(100, (input.days / daysRequired) * 100),
          }),
          now(),
        ],
      );

      return queryOne("SELECT * FROM downtime_actions WHERE id = ?", [id]);
    }),
});
