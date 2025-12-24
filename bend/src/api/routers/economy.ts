import { z } from "zod";
import {
  router,
  campaignProcedure,
  gmProcedure,
  IdInput,
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
import * as edges from "../../db/queries/edges";

// ============================================
// ECONOMY ROUTER
// ============================================

export const economyRouter = router({
  // ==========================================
  // QUERIES - SETTLEMENTS
  // ==========================================

  /**
   * Get settlement economy data
   */
  settlement: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const node = await nodes.getNode(input.id);
    if (!node) notFound("Settlement", input.id);

    // Get trade routes
    const tradeRoutes = await edges.getTradeRoutes(input.id);

    // Get economic events
    const events = await queryAll<any>(
      `SELECT * FROM economic_events
         WHERE location_id = ? AND campaign_id = ?
         ORDER BY created_at DESC LIMIT 20`,
      [input.id, ctx.campaignId],
    );

    // dataStatic is already parsed as an object from the DB layer
    const staticData = (node.dataStatic as Record<string, any>) || {};

    return {
      settlement: node,
      economy: staticData.economy || {},
      tradeRoutes,
      recentEvents: events,
    };
  }),

  /**
   * Get trade routes from settlement
   */
  tradeRoutes: campaignProcedure
    .input(IdInput)
    .query(async ({ ctx, input }) => {
      return edges.getTradeRoutes(input.id);
    }),

  /**
   * Get item prices at location
   */
  prices: campaignProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        category: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const node = await nodes.getNode(input.locationId);
      if (!node) notFound("Location", input.locationId);

      // dataStatic is already parsed as an object from the DB layer
      const staticData = (node.dataStatic as Record<string, any>) || {};
      const economy = staticData.economy || {};

      // Get price modifiers from events
      const events = await queryAll<any>(
        `SELECT * FROM economic_events
         WHERE location_id = ? AND campaign_id = ? AND status = 'active'
         AND (expires_at IS NULL OR expires_at > ?)`,
        [input.locationId, ctx.campaignId, now()],
      );

      const priceModifiers: Record<string, number> = {};
      for (const event of events) {
        const data = parseJson<any>(event.data);
        if (data?.priceModifiers) {
          Object.assign(priceModifiers, data.priceModifiers);
        }
      }

      return {
        basePrices: economy.prices || {},
        modifiers: priceModifiers,
        wealthLevel: economy.wealthLevel || "moderate",
        specialties: economy.specialties || [],
        shortages: economy.shortages || [],
      };
    }),

  /**
   * Get regional economic overview
   */
  region: campaignProcedure.input(IdInput).query(async ({ ctx, input }) => {
    const region = await nodes.getNode(input.id);
    if (!region) notFound("Region", input.id);

    // Get settlements in region
    const settlements = await nodes.getChildren(input.id);

    const economyData = [];
    for (const settlement of settlements) {
      // dataStatic is already parsed as an object from the DB layer
      const staticData = (settlement.dataStatic as Record<string, any>) || {};
      economyData.push({
        id: settlement.id,
        name: settlement.name,
        type: settlement.type,
        economy: staticData.economy || {},
      });
    }

    // Get inter-settlement trade routes
    const tradeNetwork = await queryAll<any>(
      `SELECT * FROM world_edges
         WHERE type = 'TRADE_ROUTE'
         AND (source_id IN (?) OR target_id IN (?))`,
      [
        settlements.map((s) => s.id).join(","),
        settlements.map((s) => s.id).join(","),
      ],
    );

    return {
      region,
      settlements: economyData,
      tradeNetwork,
    };
  }),

  // ==========================================
  // MUTATIONS - GM TOOLS
  // ==========================================

  /**
   * Set settlement economy
   */
  setSettlementEconomy: gmProcedure
    .input(
      z.object({
        settlementId: z.string().uuid(),
        wealthLevel: z
          .enum([
            "destitute",
            "poor",
            "moderate",
            "prosperous",
            "wealthy",
            "opulent",
          ])
          .optional(),
        primaryIndustries: z.array(z.string()).optional(),
        specialties: z.array(z.string()).optional(),
        shortages: z.array(z.string()).optional(),
        tradeGoods: z
          .array(
            z.object({
              name: z.string(),
              availability: z.enum([
                "abundant",
                "common",
                "uncommon",
                "rare",
                "unavailable",
              ]),
              priceModifier: z.number().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const node = await nodes.getNode(input.settlementId);
      if (!node) notFound("Settlement", input.settlementId);

      // dataStatic is already parsed as an object from the DB layer
      const staticData = (node.dataStatic as Record<string, any>) || {};
      staticData.economy = {
        ...staticData.economy,
        wealthLevel: input.wealthLevel ?? staticData.economy?.wealthLevel,
        primaryIndustries:
          input.primaryIndustries ?? staticData.economy?.primaryIndustries,
        specialties: input.specialties ?? staticData.economy?.specialties,
        shortages: input.shortages ?? staticData.economy?.shortages,
        tradeGoods: input.tradeGoods ?? staticData.economy?.tradeGoods,
      };

      return nodes.updateNode(input.settlementId, { dataStatic: staticData });
    }),

  /**
   * Create economic event
   */
  createEvent: gmProcedure
    .input(
      z.object({
        locationId: z.string().uuid(),
        type: z.enum([
          "shortage",
          "surplus",
          "festival",
          "disaster",
          "trade_disruption",
          "new_trade_route",
          "tax_change",
          "guild_action",
          "war_effect",
          "custom",
        ]),
        name: z.string().max(100),
        description: z.string().max(1000),
        priceModifiers: z.record(z.string(), z.number()).optional(),
        affectedGoods: z.array(z.string()).optional(),
        severity: z
          .enum(["minor", "moderate", "major", "catastrophic"])
          .default("moderate"),
        duration: z.number().int().optional(), // days
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();
      const timestamp = now();

      const expiresAt = input.duration
        ? new Date(
            Date.now() + input.duration * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null;

      await query(
        `INSERT INTO economic_events (
          id, campaign_id, location_id, type, name, description,
          data, status, severity, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        [
          id,
          ctx.campaignId,
          input.locationId,
          input.type,
          input.name,
          input.description,
          toJson({
            priceModifiers: input.priceModifiers,
            affectedGoods: input.affectedGoods,
          }),
          input.severity,
          expiresAt,
          timestamp,
        ],
      );

      return queryOne("SELECT * FROM economic_events WHERE id = ?", [id]);
    }),

  /**
   * End economic event
   */
  endEvent: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await query(
      `UPDATE economic_events SET status = 'ended', expires_at = ? WHERE id = ?`,
      [now(), input.id],
    );
    return { success: true };
  }),

  /**
   * Create trade route
   */
  createTradeRoute: gmProcedure
    .input(
      z.object({
        sourceId: z.string().uuid(),
        targetId: z.string().uuid(),
        goods: z.array(z.string()),
        travelTime: z.number().int(), // days
        danger: z.enum(["safe", "low", "moderate", "high", "extreme"]),
        volume: z.enum(["minimal", "light", "moderate", "heavy", "major"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return edges.createEdge({
        sourceId: input.sourceId,
        targetId: input.targetId,
        type: "TRADE_ROUTE",
        bidirectional: true,
        properties: {
          trade: {
            goods: input.goods,
            travelTime: input.travelTime,
            danger: input.danger,
            volume: input.volume,
            notes: input.notes,
          },
        },
      });
    }),

  // ==========================================
  // TRANSACTIONS
  // ==========================================

  /**
   * Log transaction
   */
  logTransaction: campaignProcedure
    .input(
      z.object({
        sessionId: z.string().uuid().optional(),
        locationId: z.string().uuid(),
        characterId: z.string().uuid(),
        type: z.enum([
          "purchase",
          "sale",
          "service",
          "tax",
          "bribe",
          "donation",
          "theft",
          "reward",
        ]),
        description: z.string().max(200),
        goldAmount: z.number(),
        items: z
          .array(
            z.object({
              name: z.string(),
              quantity: z.number().int(),
              unitPrice: z.number(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuid();

      await query(
        `INSERT INTO economic_events (
          id, campaign_id, location_id, type, name, description,
          data, status, severity, created_at
        ) VALUES (?, ?, ?, 'transaction', ?, ?, ?, 'completed', 'minor', ?)`,
        [
          id,
          ctx.campaignId,
          input.locationId,
          `${input.type}: ${input.description}`,
          input.description,
          toJson({
            transactionType: input.type,
            characterId: input.characterId,
            sessionId: input.sessionId,
            goldAmount: input.goldAmount,
            items: input.items,
          }),
          now(),
        ],
      );

      return { success: true, transactionId: id };
    }),

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Calculate travel cost
   */
  travelCost: campaignProcedure
    .input(
      z.object({
        fromId: z.string().uuid(),
        toId: z.string().uuid(),
        partySize: z.number().int().min(1),
        travelStyle: z.enum(["poor", "modest", "comfortable", "wealthy"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Try to find direct route
      const directRoute = await edges.getEdgeBetween(input.fromId, input.toId);

      const dailyCosts: Record<string, number> = {
        poor: 2, // 2sp
        modest: 10, // 1gp
        comfortable: 20, // 2gp
        wealthy: 40, // 4gp
      };

      if (directRoute && directRoute.type === "TRADE_ROUTE") {
        // Type the trade properties
        const trade = (directRoute.properties.trade || {}) as {
          travelTime?: string | number;
          dangerLevel?: string;
          goods?: string[];
          volume?: string;
        };
        // Parse travelTime as number, default to 1
        const days = parseInt(String(trade.travelTime ?? 1), 10) || 1;
        const dailyCost = dailyCosts[input.travelStyle] / 10; // convert to gold

        return {
          route: "direct",
          days,
          costPerPerson: days * dailyCost,
          totalCost: days * dailyCost * input.partySize,
          danger: trade.dangerLevel || "unknown",
        };
      }

      // Estimate if no direct route
      return {
        route: "estimated",
        days: 3,
        costPerPerson: (3 * dailyCosts[input.travelStyle]) / 10,
        totalCost: ((3 * dailyCosts[input.travelStyle]) / 10) * input.partySize,
        danger: "unknown",
        note: "No direct trade route found. Estimate based on typical travel.",
      };
    }),
});
