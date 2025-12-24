import { z } from "zod";
import {
  router,
  publicProcedure,
  campaignProcedure,
  gmProcedure,
  IdInput,
  PaginationInput,
  SearchInput,
  notFound,
} from "../trpc";
import * as nodes from "../../db/queries/nodes";
import * as edges from "../../db/queries/edges";
import * as factions from "../../db/queries/factions";

// ============================================
// WORLD ROUTER
// ============================================
//
// API for world graph: nodes, edges, factions.
// Based on SCHEMA_CONTRACT.md architecture.
//

export const worldRouter = router({
  // ==========================================
  // NODE QUERIES
  // ==========================================

  /**
   * Get node by ID
   */
  getNode: publicProcedure.input(IdInput).query(async ({ input }) => {
    const node = await nodes.getNode(input.id);
    if (!node) notFound("WorldNode", input.id);
    return node;
  }),

  /**
   * Get node with children
   */
  getNodeWithChildren: publicProcedure.input(IdInput).query(async ({ input }) => {
    const node = await nodes.getNode(input.id);
    if (!node) notFound("WorldNode", input.id);

    const children = await nodes.getChildren(input.id);
    return { node, children };
  }),

  /**
   * Get node hierarchy (ancestors)
   */
  getHierarchy: publicProcedure.input(IdInput).query(async ({ input }) => {
    return nodes.getHierarchy(input.id);
  }),

  /**
   * Search nodes
   */
  searchNodes: publicProcedure.input(SearchInput).query(async ({ input }) => {
    return nodes.searchNodes(input.query, { limit: input.pageSize });
  }),

  /**
   * Get nodes by type
   */
  getNodesByType: publicProcedure
    .input(
      z.object({
        type: z.string(),
        parentId: z.string().uuid().optional(),
        ...PaginationInput.shape,
      }),
    )
    .query(async ({ input }) => {
      return nodes.getNodesByType(input.type, input.parentId);
    }),

  /**
   * Get children of a node
   */
  getChildren: publicProcedure.input(IdInput).query(async ({ input }) => {
    return nodes.getChildren(input.id);
  }),

  // ==========================================
  // EDGE QUERIES
  // ==========================================

  /**
   * Get edges by source/target
   */
  getEdges: publicProcedure
    .input(
      z.object({
        sourceId: z.string().uuid().optional(),
        targetId: z.string().uuid().optional(),
        type: z.enum([
          "CONTAINS", "BORDERS", "TRADE_ROUTE", "ROAD", "RIVER", "SEA_ROUTE",
          "ORBIT", "FLOW_RIVER", "PORTAL", "PLANAR_GATE", "MANIFEST_ZONE", "COTERMINOUS",
          "GOVERNS", "VASSAL_OF", "ALLIED_WITH", "AT_WAR_WITH", "TREATY_WITH",
          "FACTION_PRESENCE", "FACTION_HQ", "FACTION_CONFLICT",
          "CULTURAL_TIE", "RELIGIOUS_TIE", "TRADE_PARTNER",
          "HISTORICAL_EVENT", "PROPHECY_LINK", "SECRET_CONNECTION",
        ]).optional(),
      }),
    )
    .query(async ({ input }) => {
      return edges.getEdges(input);
    }),

  /**
   * Get edges from node
   */
  getEdgesFrom: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        type: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return edges.getEdgesFrom(input.nodeId, input.type as any);
    }),

  /**
   * Get edges to node
   */
  getEdgesTo: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        type: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return edges.getEdgesTo(input.nodeId, input.type as any);
    }),

  /**
   * Check if nodes are connected
   */
  areConnected: publicProcedure
    .input(
      z.object({
        sourceId: z.string().uuid(),
        targetId: z.string().uuid(),
        edgeType: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return edges.areConnected(input.sourceId, input.targetId, input.edgeType as any);
    }),

  /**
   * Get trade routes from location
   */
  getTradeRoutes: publicProcedure.input(IdInput).query(async ({ input }) => {
    return edges.getTradeRoutes(input.id);
  }),

  /**
   * Get portals from location
   */
  getPortals: publicProcedure.input(IdInput).query(async ({ input }) => {
    return edges.getPortals(input.id);
  }),

  // ==========================================
  // FACTION QUERIES
  // ==========================================

  /**
   * Get faction by ID
   */
  getFaction: publicProcedure.input(IdInput).query(async ({ input }) => {
    const faction = await factions.getFaction(input.id);
    if (!faction) notFound("Faction", input.id);
    return faction;
  }),

  /**
   * List factions
   */
  listFactions: publicProcedure
    .input(
      z
        .object({
          type: z.string().optional(),
          scope: z.string().optional(),
          search: z.string().optional(),
          ...PaginationInput.shape,
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return factions.listFactions(input, input?.page, input?.pageSize);
    }),

  /**
   * Get faction relations
   */
  getFactionRelations: publicProcedure.input(IdInput).query(async ({ input }) => {
    return factions.getFactionRelations(input.id);
  }),

  /**
   * Get faction presence (where are they)
   */
  getFactionPresence: publicProcedure.input(IdInput).query(async ({ input }) => {
    return factions.getFactionPresence(input.id);
  }),

  /**
   * Get factions at location
   */
  getLocationFactions: publicProcedure.input(IdInput).query(async ({ input }) => {
    return factions.getLocationFactions(input.id);
  }),

  // ==========================================
  // GM MUTATIONS - NODES
  // ==========================================

  /**
   * Create node
   */
  createNode: gmProcedure
    .input(
      z.object({
        parentId: z.string().uuid().optional(),
        type: z.string(),
        name: z.string(),
        canonicalName: z.string().optional(),
        dataStatic: z.any().default({}),
      }),
    )
    .mutation(async ({ input }) => {
      return nodes.createNode({
        ...input,
        dataStatic: input.dataStatic ?? {},
      });
    }),

  /**
   * Update node
   */
  updateNode: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        dataStatic: z.any().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return nodes.updateNode(id, data);
    }),

  /**
   * Delete node
   */
  deleteNode: gmProcedure.input(IdInput).mutation(async ({ input }) => {
    return nodes.deleteNode(input.id);
  }),

  // ==========================================
  // GM MUTATIONS - EDGES
  // ==========================================

  /**
   * Create edge
   */
  createEdge: gmProcedure
    .input(
      z.object({
        sourceId: z.string().uuid(),
        targetId: z.string().uuid(),
        type: z.enum([
          "CONTAINS", "BORDERS", "TRADE_ROUTE", "ROAD", "RIVER", "SEA_ROUTE",
          "ORBIT", "FLOW_RIVER", "PORTAL", "PLANAR_GATE", "MANIFEST_ZONE", "COTERMINOUS",
          "GOVERNS", "VASSAL_OF", "ALLIED_WITH", "AT_WAR_WITH", "TREATY_WITH",
          "FACTION_PRESENCE", "FACTION_HQ", "FACTION_CONFLICT",
          "CULTURAL_TIE", "RELIGIOUS_TIE", "TRADE_PARTNER",
          "HISTORICAL_EVENT", "PROPHECY_LINK", "SECRET_CONNECTION",
        ]),
        properties: z.any().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return edges.createEdge(input as any);
    }),

  /**
   * Update edge
   */
  updateEdge: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        properties: z.any().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return edges.updateEdge(id, data);
    }),

  /**
   * Delete edge
   */
  deleteEdge: gmProcedure.input(IdInput).mutation(async ({ input }) => {
    return edges.deleteEdge(input.id);
  }),

  // ==========================================
  // GM MUTATIONS - FACTIONS
  // ==========================================

  /**
   * Create faction
   */
  createFaction: gmProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.string(),
        scope: z.string().optional(),
        description: z.string().optional(),
        goals: z.any().optional(),
        resources: z.any().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return factions.createFaction(input as any);
    }),

  /**
   * Update faction
   */
  updateFaction: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        description: z.string().optional(),
        goals: z.any().optional(),
        resources: z.any().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return factions.updateFaction(id, data);
    }),

  /**
   * Delete faction
   */
  deleteFaction: gmProcedure.input(IdInput).mutation(async ({ input }) => {
    return factions.deleteFaction(input.id);
  }),

  /**
   * Set faction relation
   */
  setFactionRelation: gmProcedure
    .input(
      z.object({
        faction1Id: z.string().uuid(),
        faction2Id: z.string().uuid(),
        relation: z.enum(["neutral", "allied", "friendly", "competitive", "rival", "hostile", "war"]),
        strength: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return factions.setFactionRelation(
        input.faction1Id,
        input.faction2Id,
        input.relation,
        input.strength ? { strength: input.strength } : undefined,
      );
    }),

});
