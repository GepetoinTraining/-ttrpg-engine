import {
  query,
  queryOne,
  queryAll,
  transaction,
  buildInsert,
  buildUpdate,
  buildWhere,
  buildPagination,
  parseJson,
  toJson,
  uuid,
  now,
  NotFoundError,
} from "../client";
import type { WorldNode } from "../../world/graph";

// ============================================
// WORLD NODE QUERIES
// ============================================

// ============================================
// TYPES
// ============================================

export interface WorldNodeRow {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  canonicalName: string | null;
  sphereId: string | null;
  planetId: string | null;
  continentId: string | null;
  regionId: string | null;
  isSeeded: number;
  isCanonical: number;
  isHidden: number;
  dataStatic: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateNodeInput {
  id?: string;
  parentId?: string;
  type: string;
  name: string;
  canonicalName?: string;
  sphereId?: string;
  planetId?: string;
  continentId?: string;
  regionId?: string;
  isSeeded?: boolean;
  isCanonical?: boolean;
  isHidden?: boolean;
  dataStatic: Record<string, any>;
}

export interface UpdateNodeInput {
  parentId?: string;
  name?: string;
  canonicalName?: string;
  isHidden?: boolean;
  dataStatic?: Record<string, any>;
}

export interface NodeFilters {
  type?: string | string[];
  parentId?: string;
  sphereId?: string;
  planetId?: string;
  continentId?: string;
  regionId?: string;
  isSeeded?: boolean;
  isCanonical?: boolean;
  isHidden?: boolean;
  search?: string;
}

// ============================================
// ROW TO ENTITY
// ============================================

function rowToNode(row: WorldNodeRow): WorldNode {
  return {
    id: row.id,
    parentId: row.parentId || undefined,
    type: row.type as any,
    name: row.name,
    canonicalName: row.canonicalName || undefined,
    sphereId: row.sphereId || undefined,
    planetId: row.planetId || undefined,
    continentId: row.continentId || undefined,
    regionId: row.regionId || undefined,
    isSeeded: row.isSeeded === 1,
    isCanonical: row.isCanonical === 1,
    isHidden: row.isHidden === 1,
    dataStatic: parseJson(row.dataStatic) || {},
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    version: row.version,
  };
}

// ============================================
// CREATE
// ============================================

export async function createNode(input: CreateNodeInput): Promise<WorldNode> {
  const id = input.id || uuid();
  const timestamp = now();

  const data = {
    id,
    parentId: input.parentId || null,
    type: input.type,
    name: input.name,
    canonicalName:
      input.canonicalName ||
      input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    sphereId: input.sphereId || null,
    planetId: input.planetId || null,
    continentId: input.continentId || null,
    regionId: input.regionId || null,
    isSeeded: input.isSeeded ? 1 : 0,
    isCanonical: input.isCanonical !== false ? 1 : 0,
    isHidden: input.isHidden ? 1 : 0,
    dataStatic: toJson(input.dataStatic),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };

  const { sql, params } = buildInsert("world_nodes", data);
  await query(sql, params);

  return getNodeById(id) as Promise<WorldNode>;
}

/**
 * Create multiple nodes in a batch (for seeding)
 */
export async function createNodes(inputs: CreateNodeInput[]): Promise<number> {
  const timestamp = now();

  return transaction(async (tx) => {
    let count = 0;

    for (const input of inputs) {
      const id = input.id || uuid();

      await tx.query(
        `INSERT INTO world_nodes
         (id, parent_id, type, name, canonical_name, sphere_id, planet_id,
          continent_id, region_id, is_seeded, is_canonical, is_hidden,
          data_static, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.parentId || null,
          input.type,
          input.name,
          input.canonicalName ||
            input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          input.sphereId || null,
          input.planetId || null,
          input.continentId || null,
          input.regionId || null,
          input.isSeeded ? 1 : 0,
          input.isCanonical !== false ? 1 : 0,
          input.isHidden ? 1 : 0,
          toJson(input.dataStatic),
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

export async function getNodeById(id: string): Promise<WorldNode | null> {
  const row = await queryOne<WorldNodeRow>(
    "SELECT * FROM world_nodes WHERE id = ?",
    [id],
  );

  return row ? rowToNode(row) : null;
}

export async function getNodeByIdOrThrow(id: string): Promise<WorldNode> {
  const node = await getNodeById(id);
  if (!node) throw new NotFoundError("WorldNode", id);
  return node;
}

export async function getNodeByCanonicalName(
  canonicalName: string,
): Promise<WorldNode | null> {
  const row = await queryOne<WorldNodeRow>(
    "SELECT * FROM world_nodes WHERE canonical_name = ?",
    [canonicalName],
  );

  return row ? rowToNode(row) : null;
}

export async function getNodes(
  filters: NodeFilters = {},
  page: number = 1,
  pageSize: number = 50,
): Promise<{ nodes: WorldNode[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.type) {
    if (Array.isArray(filters.type)) {
      conditions.push(`type IN (${filters.type.map(() => "?").join(", ")})`);
      params.push(...filters.type);
    } else {
      conditions.push("type = ?");
      params.push(filters.type);
    }
  }

  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      conditions.push("parent_id IS NULL");
    } else {
      conditions.push("parent_id = ?");
      params.push(filters.parentId);
    }
  }

  if (filters.sphereId) {
    conditions.push("sphere_id = ?");
    params.push(filters.sphereId);
  }

  if (filters.planetId) {
    conditions.push("planet_id = ?");
    params.push(filters.planetId);
  }

  if (filters.continentId) {
    conditions.push("continent_id = ?");
    params.push(filters.continentId);
  }

  if (filters.regionId) {
    conditions.push("region_id = ?");
    params.push(filters.regionId);
  }

  if (filters.isSeeded !== undefined) {
    conditions.push("is_seeded = ?");
    params.push(filters.isSeeded ? 1 : 0);
  }

  if (filters.isCanonical !== undefined) {
    conditions.push("is_canonical = ?");
    params.push(filters.isCanonical ? 1 : 0);
  }

  if (filters.isHidden !== undefined) {
    conditions.push("is_hidden = ?");
    params.push(filters.isHidden ? 1 : 0);
  }

  if (filters.search) {
    conditions.push("(name LIKE ? OR canonical_name LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total count
  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM world_nodes ${whereClause}`,
    params,
  );
  const total = countResult?.count || 0;

  // Get page
  const offset = (page - 1) * pageSize;
  const rows = await queryAll<WorldNodeRow>(
    `SELECT * FROM world_nodes ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    nodes: rows.map(rowToNode),
    total,
  };
}

// ============================================
// HIERARCHY QUERIES
// ============================================

/**
 * Get all ancestors of a node (for inheritance resolution)
 */
export async function getAncestors(nodeId: string): Promise<WorldNode[]> {
  const ancestors: WorldNode[] = [];
  let currentId: string | null = nodeId;

  while (currentId) {
    const node = await getNodeById(currentId);
    if (!node) break;

    if (node.parentId) {
      const parent = await getNodeById(node.parentId);
      if (parent) {
        ancestors.push(parent);
        currentId = parent.parentId || null;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return ancestors; // Nearest first
}

/**
 * Get direct children of a node
 */
export async function getChildren(
  parentId: string,
  type?: string | string[],
): Promise<WorldNode[]> {
  let sql = "SELECT * FROM world_nodes WHERE parent_id = ?";
  const params: any[] = [parentId];

  if (type) {
    if (Array.isArray(type)) {
      sql += ` AND type IN (${type.map(() => "?").join(", ")})`;
      params.push(...type);
    } else {
      sql += " AND type = ?";
      params.push(type);
    }
  }

  sql += " ORDER BY name";

  const rows = await queryAll<WorldNodeRow>(sql, params);
  return rows.map(rowToNode);
}

/**
 * Get all descendants of a node (recursive)
 */
export async function getDescendants(
  nodeId: string,
  maxDepth: number = 10,
): Promise<WorldNode[]> {
  const descendants: WorldNode[] = [];
  const visited = new Set<string>();

  async function recurse(parentId: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    if (visited.has(parentId)) return;
    visited.add(parentId);

    const children = await getChildren(parentId);
    for (const child of children) {
      descendants.push(child);
      await recurse(child.id, depth + 1);
    }
  }

  await recurse(nodeId, 0);
  return descendants;
}

/**
 * Get full path from root to node
 */
export async function getPath(nodeId: string): Promise<WorldNode[]> {
  const ancestors = await getAncestors(nodeId);
  const node = await getNodeById(nodeId);

  if (!node) return [];

  return [...ancestors.reverse(), node]; // Root first
}

// ============================================
// UPDATE
// ============================================

export async function updateNode(
  id: string,
  input: UpdateNodeInput,
): Promise<WorldNode> {
  const existing = await getNodeById(id);
  if (!existing) throw new NotFoundError("WorldNode", id);

  const updates: Record<string, any> = {
    updatedAt: now(),
    version: existing.version + 1,
  };

  if (input.parentId !== undefined) {
    updates.parentId = input.parentId;
  }

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.canonicalName !== undefined) {
    updates.canonicalName = input.canonicalName;
  }

  if (input.isHidden !== undefined) {
    updates.isHidden = input.isHidden ? 1 : 0;
  }

  if (input.dataStatic !== undefined) {
    // Merge with existing data
    updates.dataStatic = toJson({
      ...existing.dataStatic,
      ...input.dataStatic,
    });
  }

  const { sql, params } = buildUpdate("world_nodes", updates, { id });
  await query(sql, params);

  return getNodeByIdOrThrow(id);
}

/**
 * Update just the dataStatic JSON (partial update)
 */
export async function updateNodeData(
  id: string,
  path: string,
  value: any,
): Promise<WorldNode> {
  const existing = await getNodeById(id);
  if (!existing) throw new NotFoundError("WorldNode", id);

  // Use json_set for partial update
  await query(
    `UPDATE world_nodes
     SET data_static = json_set(data_static, ?, ?),
         updated_at = ?,
         version = version + 1
     WHERE id = ?`,
    [`$.${path}`, toJson(value), now(), id],
  );

  return getNodeByIdOrThrow(id);
}

// ============================================
// DELETE
// ============================================

export async function deleteNode(id: string): Promise<void> {
  await query("DELETE FROM world_nodes WHERE id = ?", [id]);
}

/**
 * Delete node and all descendants
 */
export async function deleteNodeCascade(id: string): Promise<number> {
  return transaction(async (tx) => {
    // Get all descendants
    const descendants = await getDescendants(id);
    const ids = [id, ...descendants.map((d) => d.id)];

    // Delete edges first
    const placeholders = ids.map(() => "?").join(", ");
    await tx.query(
      `DELETE FROM world_edges WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`,
      [...ids, ...ids],
    );

    // Delete nodes
    await tx.query(
      `DELETE FROM world_nodes WHERE id IN (${placeholders})`,
      ids,
    );

    return ids.length;
  });
}

// ============================================
// SEARCH
// ============================================

/**
 * Full-text search on nodes
 */
export async function searchNodes(
  searchTerm: string,
  options: {
    types?: string[];
    sphereId?: string;
    limit?: number;
  } = {},
): Promise<WorldNode[]> {
  const conditions = [
    '(name LIKE ? OR json_extract(data_static, "$.description") LIKE ?)',
  ];
  const params: any[] = [`%${searchTerm}%`, `%${searchTerm}%`];

  if (options.types && options.types.length > 0) {
    conditions.push(`type IN (${options.types.map(() => "?").join(", ")})`);
    params.push(...options.types);
  }

  if (options.sphereId) {
    conditions.push("sphere_id = ?");
    params.push(options.sphereId);
  }

  const limit = options.limit || 20;

  const rows = await queryAll<WorldNodeRow>(
    `SELECT * FROM world_nodes WHERE ${conditions.join(" AND ")} ORDER BY name LIMIT ?`,
    [...params, limit],
  );

  return rows.map(rowToNode);
}

// ============================================
// STATS
// ============================================

export async function getNodeStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  seeded: number;
}> {
  const total = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM world_nodes",
  );

  const byTypeRows = await queryAll<{ type: string; count: number }>(
    "SELECT type, COUNT(*) as count FROM world_nodes GROUP BY type",
  );

  const seeded = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM world_nodes WHERE is_seeded = 1",
  );

  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.type] = row.count;
  }

  return {
    total: total?.count || 0,
    byType,
    seeded: seeded?.count || 0,
  };
}
