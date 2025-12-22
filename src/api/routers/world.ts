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
  getNodeWithChildren: publicProcedure
    .input(IdInput)
    .query(async ({ input }) => {
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
    return nodes.searchNodes(input.query, input.page, input.pageSize);
  }),

  /**
   * List nodes by type
   */
  listByType: publicProcedure
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
   * Get children of node
   */
  getChildren: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        type: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return nodes.getChildren(input.id, input.type);
    }),

  /**
   * Get siblings of node
   */
  getSiblings: publicProcedure.input(IdInput).query(async ({ input }) => {
    return nodes.getSiblings(input.id);
  }),

  // ==========================================
  // EDGE QUERIES
  // ==========================================

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
      return edges.getEdgesFrom(input.nodeId, input.type);
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
      return edges.getEdgesTo(input.nodeId, input.type);
    }),

  /**
   * Get connected nodes
   */
  getConnected: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        edgeType: z.string().optional(),
        direction: z.enum(["outgoing", "incoming", "both"]).default("both"),
      }),
    )
    .query(async ({ input }) => {
      return edges.getConnectedNodes(
        input.nodeId,
        input.edgeType,
        input.direction,
      );
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
  getFactionRelations: publicProcedure
    .input(IdInput)
    .query(async ({ input }) => {
      return factions.getFactionRelations(input.id);
    }),

  /**
   * Get faction presence (where are they)
   */
  getFactionPresence: publicProcedure
    .input(IdInput)
    .query(async ({ input }) => {
      return factions.getFactionPresence(input.id);
    }),

  /**
   * Get factions at location
   */
  getLocationFactions: publicProcedure
    .input(IdInput)
    .query(async ({ input }) => {
      return factions.getLocationFactions(input.id);
    }),

  // ==========================================
  // GM MUTATIONS - NODES
  // ==========================================

  /**
   * Create node (GM only, for campaign-specific content)
   */
  createNode: gmProcedure
    .input(
      z.object({
        type: z.string(),
        name: z.string().min(1).max(200),
        parentId: z.string().uuid().optional(),
        canonicalName: z.string().optional(),
        dataStatic: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return nodes.createNode({
        ...input,
        isCanonical: false, // Campaign-created nodes are not canonical
      });
    }),

  /**
   * Update node (GM only)
   */
  updateNode: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        dataStatic: z.record(z.string(), z.any()).optional(),
        isHidden: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      return nodes.updateNode(id, updates);
    }),

  /**
   * Delete node (GM only, non-canonical only)
   */
  deleteNode: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    const node = await nodes.getNode(input.id);
    if (!node) notFound("WorldNode", input.id);

    // Can't delete canonical/seeded nodes
    if (node.isCanonical || node.isSeeded) {
      throw new Error("Cannot delete canonical or seeded nodes");
    }

    await nodes.deleteNode(input.id);
    return { success: true };
  }),

  // ==========================================
  // GM MUTATIONS - EDGES
  // ==========================================

  /**
   * Create edge (GM only)
   */
  createEdge: gmProcedure
    .input(
      z.object({
        sourceId: z.string().uuid(),
        targetId: z.string().uuid(),
        type: z.string(),
        bidirectional: z.boolean().default(false),
        properties: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return edges.createEdge(input);
    }),

  /**
   * Update edge (GM only)
   */
  updateEdge: gmProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        properties: z.record(z.string(), z.any()).optional(),
        bidirectional: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      return edges.updateEdge(id, updates);
    }),

  /**
   * Delete edge (GM only)
   */
  deleteEdge: gmProcedure.input(IdInput).mutation(async ({ ctx, input }) => {
    await edges.deleteEdge(input.id);
    return { success: true };
  }),

  // ==========================================
  // GM MUTATIONS - FACTIONS
  // ==========================================

  /**
   * Set faction relation
   */
  setFactionRelation: gmProcedure
    .input(
      z.object({
        faction1Id: z.string().uuid(),
        faction2Id: z.string().uuid(),
        relation: z.enum([
          "allied",
          "friendly",
          "neutral",
          "competitive",
          "rival",
          "hostile",
          "war",
        ]),
        properties: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return factions.setFactionRelation(
        input.faction1Id,
        input.faction2Id,
        input.relation,
        input.properties,
      );
    }),
});
