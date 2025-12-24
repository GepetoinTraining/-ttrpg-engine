import {
  query,
  queryOne,
  queryAll,
  transaction,
  buildInsert,
  buildUpdate,
  parseJson,
  toJson,
  uuid,
  now,
  NotFoundError,
} from "../client";
import type { WorldEdge, WorldEdgeType, WorldNode } from "../../world/graph";

// ============================================
// WORLD EDGE QUERIES
// ============================================

// ============================================
// TYPES
// ============================================

export interface WorldEdgeRow {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  bidirectional: number;
  properties: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateEdgeInput {
  id?: string;
  sourceId: string;
  targetId: string;
  type: WorldEdgeType;
  bidirectional?: boolean;
  properties: Record<string, any>;
}

export interface UpdateEdgeInput {
  bidirectional?: boolean;
  properties?: Record<string, any>;
}

export interface EdgeFilters {
  sourceId?: string;
  targetId?: string;
  type?: WorldEdgeType | WorldEdgeType[];
  bidirectional?: boolean;
  nodeId?: string; // Either source or target
}

// ============================================
// ROW TO ENTITY
// ============================================

function rowToEdge(row: WorldEdgeRow): WorldEdge {
  // Parse properties with defaults for required fields
  const parsedProps = parseJson(row.properties) || {};
  const properties = {
    active: true,
    hidden: false,
    ...parsedProps,
  };

  return {
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    type: row.type as WorldEdgeType,
    bidirectional: row.bidirectional === 1,
    properties,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    version: row.version,
  };
}

// ============================================
// CREATE
// ============================================

export async function createEdge(input: CreateEdgeInput): Promise<WorldEdge> {
  const id = input.id || uuid();
  const timestamp = now();

  // Ensure properties has required defaults
  const properties = {
    active: true,
    hidden: false,
    ...input.properties,
  };

  const data = {
    id,
    sourceId: input.sourceId,
    targetId: input.targetId,
    type: input.type,
    bidirectional: input.bidirectional !== false ? 1 : 0,
    properties: toJson(properties),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };

  const { sql, params } = buildInsert("world_edges", data);
  await query(sql, params);

  return getEdgeById(id) as Promise<WorldEdge>;
}

/**
 * Create multiple edges in a batch (for seeding)
 */
export async function createEdges(inputs: CreateEdgeInput[]): Promise<number> {
  const timestamp = now();

  return transaction(async (tx) => {
    let count = 0;

    for (const input of inputs) {
      const id = input.id || uuid();

      // Ensure properties has required defaults
      const properties = {
        active: true,
        hidden: false,
        ...input.properties,
      };

      await tx.query(
        `INSERT INTO world_edges
         (id, source_id, target_id, type, bidirectional, properties, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.sourceId,
          input.targetId,
          input.type,
          input.bidirectional !== false ? 1 : 0,
          toJson(properties),
          timestamp,
          timestamp,
          1,
        ],
      );
      count++;
    }

    return count;
  });
}

// ============================================
// READ
// ============================================

export async function getEdgeById(id: string): Promise<WorldEdge | null> {
  const row = await queryOne<WorldEdgeRow>(
    "SELECT * FROM world_edges WHERE id = ?",
    [id],
  );

  return row ? rowToEdge(row) : null;
}

export async function getEdgeByIdOrThrow(id: string): Promise<WorldEdge> {
  const edge = await getEdgeById(id);
  if (!edge) throw new NotFoundError("WorldEdge", id);
  return edge;
}

/**
 * Get edges with filters
 */
export async function getEdges(
  filters: EdgeFilters = {},
): Promise<WorldEdge[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.sourceId) {
    conditions.push("source_id = ?");
    params.push(filters.sourceId);
  }

  if (filters.targetId) {
    conditions.push("target_id = ?");
    params.push(filters.targetId);
  }

  if (filters.type) {
    if (Array.isArray(filters.type)) {
      conditions.push(`type IN (${filters.type.map(() => "?").join(", ")})`);
      params.push(...filters.type);
    } else {
      conditions.push("type = ?");
      params.push(filters.type);
    }
  }

  if (filters.bidirectional !== undefined) {
    conditions.push("bidirectional = ?");
    params.push(filters.bidirectional ? 1 : 0);
  }

  if (filters.nodeId) {
    conditions.push("(source_id = ? OR target_id = ?)");
    params.push(filters.nodeId, filters.nodeId);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await queryAll<WorldEdgeRow>(
    `SELECT * FROM world_edges ${whereClause} ORDER BY created_at`,
    params,
  );

  return rows.map(rowToEdge);
}

// ============================================
// RELATIONSHIP QUERIES
// ============================================

/**
 * Get all edges FROM a node
 */
export async function getOutgoingEdges(
  nodeId: string,
  type?: WorldEdgeType | WorldEdgeType[],
): Promise<WorldEdge[]> {
  return getEdges({ sourceId: nodeId, type });
}

/**
 * Get all edges TO a node
 */
export async function getIncomingEdges(
  nodeId: string,
  type?: WorldEdgeType | WorldEdgeType[],
): Promise<WorldEdge[]> {
  return getEdges({ targetId: nodeId, type });
}

/**
 * Get all connected edges (both directions, respecting bidirectional)
 */
export async function getConnectedEdges(
  nodeId: string,
  type?: WorldEdgeType | WorldEdgeType[],
): Promise<WorldEdge[]> {
  let typeCondition = "";
  const params: any[] = [nodeId, nodeId, nodeId];

  if (type) {
    if (Array.isArray(type)) {
      typeCondition = `AND type IN (${type.map(() => "?").join(", ")})`;
      params.push(...type);
    } else {
      typeCondition = "AND type = ?";
      params.push(type);
    }
  }

  const rows = await queryAll<WorldEdgeRow>(
    `SELECT * FROM world_edges
     WHERE (source_id = ? OR (target_id = ? AND bidirectional = 1))
     ${typeCondition}
     UNION
     SELECT * FROM world_edges
     WHERE target_id = ?
     ${typeCondition}`,
    params,
  );

  // Deduplicate
  const seen = new Set<string>();
  const edges: WorldEdge[] = [];

  for (const row of rows) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      edges.push(rowToEdge(row));
    }
  }

  return edges;
}

/**
 * Get neighbors of a node (connected node IDs)
 */
export async function getNeighborIds(
  nodeId: string,
  type?: WorldEdgeType | WorldEdgeType[],
): Promise<string[]> {
  const edges = await getConnectedEdges(nodeId, type);
  const neighborIds = new Set<string>();

  for (const edge of edges) {
    if (edge.sourceId === nodeId) {
      neighborIds.add(edge.targetId);
    } else {
      neighborIds.add(edge.sourceId);
    }
  }

  return Array.from(neighborIds);
}

/**
 * Check if two nodes are directly connected
 */
export async function areConnected(
  nodeId1: string,
  nodeId2: string,
  type?: WorldEdgeType,
): Promise<boolean> {
  let typeCondition = "";
  const params = [nodeId1, nodeId2, nodeId2, nodeId1];

  if (type) {
    typeCondition = "AND type = ?";
    params.push(type);
  }

  const result = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM world_edges
     WHERE ((source_id = ? AND target_id = ?) OR
            (source_id = ? AND target_id = ? AND bidirectional = 1))
     ${typeCondition}`,
    params,
  );

  return (result?.count || 0) > 0;
}

/**
 * Get edge between two specific nodes
 */
export async function getEdgeBetween(
  sourceId: string,
  targetId: string,
  type?: WorldEdgeType,
): Promise<WorldEdge | null> {
  let sql = "SELECT * FROM world_edges WHERE source_id = ? AND target_id = ?";
  const params: any[] = [sourceId, targetId];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " LIMIT 1";

  const row = await queryOne<WorldEdgeRow>(sql, params);
  return row ? rowToEdge(row) : null;
}

// ============================================
// FACTION PRESENCE QUERIES
// ============================================

/**
 * Get all faction presence edges for a location
 */
export async function getFactionPresenceAt(
  nodeId: string,
): Promise<WorldEdge[]> {
  return getIncomingEdges(nodeId, "FACTION_PRESENCE");
}

/**
 * Get all locations where a faction has presence
 */
export async function getFactionLocations(
  factionId: string,
): Promise<WorldEdge[]> {
  const rows = await queryAll<WorldEdgeRow>(
    `SELECT * FROM world_edges
     WHERE type = 'FACTION_PRESENCE'
     AND json_extract(properties, '$.faction.factionId') = ?`,
    [factionId],
  );

  return rows.map(rowToEdge);
}

// ============================================
// TRADE ROUTE QUERIES
// ============================================

/**
 * Get trade routes from/to a node
 */
export async function getTradeRoutes(nodeId: string): Promise<WorldEdge[]> {
  return getConnectedEdges(nodeId, "TRADE_ROUTE");
}

// ============================================
// PORTAL QUERIES
// ============================================

/**
 * Get portals from a node
 */
export async function getPortals(nodeId: string): Promise<WorldEdge[]> {
  return getConnectedEdges(nodeId, ["PORTAL", "PLANAR_GATE"]);
}

// ============================================
// GRAPH TRAVERSAL
// ============================================

/**
 * Find path between two nodes (BFS)
 */
export async function findPath(
  startId: string,
  endId: string,
  options: {
    types?: WorldEdgeType[];
    maxDepth?: number;
  } = {},
): Promise<{ path: string[]; edges: WorldEdge[] } | null> {
  const maxDepth = options.maxDepth || 20;
  const visited = new Set<string>();
  const queue: { nodeId: string; path: string[]; edges: WorldEdge[] }[] = [
    { nodeId: startId, path: [startId], edges: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.nodeId === endId) {
      return { path: current.path, edges: current.edges };
    }

    if (current.path.length > maxDepth) continue;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    const edges = await getConnectedEdges(current.nodeId, options.types);

    for (const edge of edges) {
      const nextId =
        edge.sourceId === current.nodeId ? edge.targetId : edge.sourceId;

      if (!visited.has(nextId)) {
        queue.push({
          nodeId: nextId,
          path: [...current.path, nextId],
          edges: [...current.edges, edge],
        });
      }
    }
  }

  return null; // No path found
}

// ============================================
// UPDATE
// ============================================

export async function updateEdge(
  id: string,
  input: UpdateEdgeInput,
): Promise<WorldEdge> {
  const existing = await getEdgeById(id);
  if (!existing) throw new NotFoundError("WorldEdge", id);

  const updates: Record<string, any> = {
    updatedAt: now(),
    version: existing.version + 1,
  };

  if (input.bidirectional !== undefined) {
    updates.bidirectional = input.bidirectional ? 1 : 0;
  }

  if (input.properties !== undefined) {
    updates.properties = toJson({
      ...existing.properties,
      ...input.properties,
    });
  }

  const { sql, params } = buildUpdate("world_edges", updates, { id });
  await query(sql, params);

  return getEdgeByIdOrThrow(id);
}

/**
 * Update edge properties (partial update)
 */
export async function updateEdgeProperties(
  id: string,
  path: string,
  value: any,
): Promise<WorldEdge> {
  const existing = await getEdgeById(id);
  if (!existing) throw new NotFoundError("WorldEdge", id);

  await query(
    `UPDATE world_edges
     SET properties = json_set(properties, ?, ?),
         updated_at = ?,
         version = version + 1
     WHERE id = ?`,
    [`$.${path}`, toJson(value), now(), id],
  );

  return getEdgeByIdOrThrow(id);
}

// ============================================
// DELETE
// ============================================

export async function deleteEdge(id: string): Promise<void> {
  await query("DELETE FROM world_edges WHERE id = ?", [id]);
}

/**
 * Delete all edges connected to a node
 */
export async function deleteEdgesForNode(nodeId: string): Promise<number> {
  const result = await query(
    "DELETE FROM world_edges WHERE source_id = ? OR target_id = ?",
    [nodeId, nodeId],
  );

  return result.rowsAffected;
}

/**
 * Delete edges between two specific nodes
 */
export async function deleteEdgesBetween(
  nodeId1: string,
  nodeId2: string,
): Promise<number> {
  const result = await query(
    `DELETE FROM world_edges
     WHERE (source_id = ? AND target_id = ?)
        OR (source_id = ? AND target_id = ?)`,
    [nodeId1, nodeId2, nodeId2, nodeId1],
  );

  return result.rowsAffected;
}

// ============================================
// STATS
// ============================================

export async function getEdgeStats(): Promise<{
  total: number;
  byType: Record<string, number>;
}> {
  const total = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM world_edges",
  );

  const byTypeRows = await queryAll<{ type: string; count: number }>(
    "SELECT type, COUNT(*) as count FROM world_edges GROUP BY type",
  );

  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.type] = row.count;
  }

  return {
    total: total?.count || 0,
    byType,
  };
}

  // ============================================
  // ROUTER COMPATIBILITY EXPORTS
  // ============================================

  // Aliases for existing functions
  export const getEdgesFrom = getOutgoingEdges;
  export const getEdgesTo = getIncomingEdges;

  /**
   * Get connected nodes (actual node objects, not just IDs)
   */
  export async function getConnectedNodes(
    nodeId: string,
    type?: WorldEdgeType | WorldEdgeType[],
    direction: 'from' | 'to' | 'both' = 'both',
  ): Promise<WorldNode[]> {
    // Import dynamically to avoid circular dependency
    const { getNodeById } = await import("./nodes");

    let edges: WorldEdge[];

    if (direction === 'from') {
      edges = await getOutgoingEdges(nodeId, type);
    } else if (direction === 'to') {
      edges = await getIncomingEdges(nodeId, type);
    } else {
      edges = await getConnectedEdges(nodeId, type);
    }

    const nodeIds = new Set<string>();
    for (const edge of edges) {
      if (edge.sourceId === nodeId) {
        nodeIds.add(edge.targetId);
      } else {
        nodeIds.add(edge.sourceId);
      }
    }

    const nodes: WorldNode[] = [];
    for (const id of nodeIds) {
      const node = await getNodeById(id);
      if (node) nodes.push(node);
    }

    return nodes;
  }
