import {
  query,
  queryOne,
  queryAll,
  transaction,
  parseJson,
  toJson,
  uuid,
  now,
  NotFoundError,
} from "../client";

// ============================================
// FACTION QUERIES
// ============================================

// ============================================
// TYPES
// ============================================

export interface FactionRow {
  id: string;
  name: string;
  alternateNames: string; // JSON array
  type: string;
  scope: string;
  homeSphereId: string | null;
  homePlanetId: string | null;
  data: string; // JSON
  isSeeded: number;
  isCanonical: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FactionRelationRow {
  id: string;
  faction1Id: string;
  faction2Id: string;
  relation: string;
  properties: string; // JSON
  version: number;
}

export interface CreateFactionInput {
  id?: string;
  name: string;
  alternateNames?: string[];
  type: string;
  scope:
    | "local"
    | "regional"
    | "continental"
    | "planetary"
    | "planar"
    | "cosmic";
  homeSphereId?: string;
  homePlanetId?: string;
  data?: Record<string, any>;
  isCanonical?: boolean;
}

export interface UpdateFactionInput {
  name?: string;
  alternateNames?: string[];
  type?: string;
  scope?: string;
  data?: Record<string, any>;
}

export interface FactionFilters {
  type?: string;
  scope?: string;
  homePlanetId?: string;
  isSeeded?: boolean;
  isCanonical?: boolean;
  search?: string;
}

// ============================================
// FACTION CRUD
// ============================================

export async function getFaction(id: string): Promise<FactionRow | null> {
  return queryOne<FactionRow>("SELECT * FROM factions WHERE id = ?", [id]);
}

export async function getFactionOrThrow(id: string): Promise<FactionRow> {
  const faction = await getFaction(id);
  if (!faction) throw new NotFoundError("Faction", id);
  return faction;
}

export async function getFactionByName(
  name: string,
): Promise<FactionRow | null> {
  return queryOne<FactionRow>(
    `SELECT * FROM factions
     WHERE name = ? OR json_extract(alternate_names, '$') LIKE ?`,
    [name, `%"${name}"%`],
  );
}

export async function createFaction(
  input: CreateFactionInput,
): Promise<FactionRow> {
  const id = input.id || uuid();
  const timestamp = now();

  await query(
    `INSERT INTO factions (
      id, name, alternate_names, type, scope,
      home_sphere_id, home_planet_id,
      data, is_seeded, is_canonical,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)`,
    [
      id,
      input.name,
      toJson(input.alternateNames || []),
      input.type,
      input.scope,
      input.homeSphereId || null,
      input.homePlanetId || null,
      toJson(input.data || {}),
      input.isCanonical !== false ? 1 : 0,
      timestamp,
      timestamp,
    ],
  );

  return getFactionOrThrow(id);
}

export async function updateFaction(
  id: string,
  input: UpdateFactionInput,
): Promise<FactionRow> {
  const updates: string[] = ["updated_at = ?", "version = version + 1"];
  const params: any[] = [now()];

  if (input.name !== undefined) {
    updates.push("name = ?");
    params.push(input.name);
  }
  if (input.alternateNames !== undefined) {
    updates.push("alternate_names = ?");
    params.push(toJson(input.alternateNames));
  }
  if (input.type !== undefined) {
    updates.push("type = ?");
    params.push(input.type);
  }
  if (input.scope !== undefined) {
    updates.push("scope = ?");
    params.push(input.scope);
  }
  if (input.data !== undefined) {
    updates.push("data = ?");
    params.push(toJson(input.data));
  }

  params.push(id);

  await query(`UPDATE factions SET ${updates.join(", ")} WHERE id = ?`, params);

  return getFactionOrThrow(id);
}

export async function deleteFaction(id: string): Promise<void> {
  await transaction(async (tx) => {
    // Delete relations
    await tx.query(
      "DELETE FROM faction_relations WHERE faction1_id = ? OR faction2_id = ?",
      [id, id],
    );
    // Delete presence edges
    await tx.query(
      `DELETE FROM world_edges
       WHERE type = 'FACTION_PRESENCE'
       AND json_extract(properties, '$.faction.factionId') = ?`,
      [id],
    );
    // Delete faction
    await tx.query("DELETE FROM factions WHERE id = ?", [id]);
  });
}

// ============================================
// QUERY OPERATIONS
// ============================================

export async function listFactions(
  filters: FactionFilters = {},
  page: number = 1,
  pageSize: number = 50,
): Promise<{ factions: FactionRow[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.type) {
    conditions.push("type = ?");
    params.push(filters.type);
  }
  if (filters.scope) {
    conditions.push("scope = ?");
    params.push(filters.scope);
  }
  if (filters.homePlanetId) {
    conditions.push("home_planet_id = ?");
    params.push(filters.homePlanetId);
  }
  if (filters.isSeeded !== undefined) {
    conditions.push("is_seeded = ?");
    params.push(filters.isSeeded ? 1 : 0);
  }
  if (filters.isCanonical !== undefined) {
    conditions.push("is_canonical = ?");
    params.push(filters.isCanonical ? 1 : 0);
  }
  if (filters.search) {
    conditions.push("(name LIKE ? OR alternate_names LIKE ?)");
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM factions ${whereClause}`,
    params,
  );

  const offset = (page - 1) * pageSize;
  const factions = await queryAll<FactionRow>(
    `SELECT * FROM factions ${whereClause}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return { factions, total: countResult?.count || 0 };
}

export async function getFactionsByType(type: string): Promise<FactionRow[]> {
  return queryAll<FactionRow>(
    "SELECT * FROM factions WHERE type = ? ORDER BY name",
    [type],
  );
}

export async function getFactionsInSphere(
  sphereId: string,
): Promise<FactionRow[]> {
  return queryAll<FactionRow>(
    "SELECT * FROM factions WHERE home_sphere_id = ? ORDER BY name",
    [sphereId],
  );
}

export async function getFactionsOnPlanet(
  planetId: string,
): Promise<FactionRow[]> {
  return queryAll<FactionRow>(
    "SELECT * FROM factions WHERE home_planet_id = ? ORDER BY name",
    [planetId],
  );
}

// ============================================
// FACTION RELATIONS
// ============================================

export async function getFactionRelation(
  faction1Id: string,
  faction2Id: string,
): Promise<FactionRelationRow | null> {
  return queryOne<FactionRelationRow>(
    `SELECT * FROM faction_relations
     WHERE (faction1_id = ? AND faction2_id = ?)
        OR (faction1_id = ? AND faction2_id = ?)`,
    [faction1Id, faction2Id, faction2Id, faction1Id],
  );
}

export async function setFactionRelation(
  faction1Id: string,
  faction2Id: string,
  relation:
    | "allied"
    | "friendly"
    | "neutral"
    | "competitive"
    | "rival"
    | "hostile"
    | "war",
  properties?: Record<string, any>,
): Promise<FactionRelationRow> {
  const existing = await getFactionRelation(faction1Id, faction2Id);

  if (existing) {
    await query(
      `UPDATE faction_relations SET
        relation = ?,
        properties = ?,
        version = version + 1
       WHERE id = ?`,
      [relation, toJson(properties || {}), existing.id],
    );
    const updated = await queryOne<FactionRelationRow>(
      "SELECT * FROM faction_relations WHERE id = ?",
      [existing.id],
    );
    if (!updated) throw new Error("Relation disappeared");
    return updated;
  }

  const id = uuid();
  await query(
    `INSERT INTO faction_relations (
      id, faction1_id, faction2_id, relation, properties, version
    ) VALUES (?, ?, ?, ?, ?, 1)`,
    [id, faction1Id, faction2Id, relation, toJson(properties || {})],
  );

  const result = await queryOne<FactionRelationRow>(
    "SELECT * FROM faction_relations WHERE id = ?",
    [id],
  );
  if (!result) throw new Error("Failed to create relation");
  return result;
}

export async function getFactionRelations(factionId: string): Promise<
  {
    relation: FactionRelationRow;
    otherFaction: FactionRow;
  }[]
> {
  const relations = await queryAll<FactionRelationRow>(
    `SELECT * FROM faction_relations
     WHERE faction1_id = ? OR faction2_id = ?`,
    [factionId, factionId],
  );

  const results: { relation: FactionRelationRow; otherFaction: FactionRow }[] =
    [];

  for (const rel of relations) {
    const otherId =
      rel.faction1Id === factionId ? rel.faction2Id : rel.faction1Id;
    const otherFaction = await getFaction(otherId);
    if (otherFaction) {
      results.push({ relation: rel, otherFaction });
    }
  }

  return results;
}

export async function getHostileFactions(
  factionId: string,
): Promise<FactionRow[]> {
  const relations = await queryAll<FactionRelationRow>(
    `SELECT * FROM faction_relations
     WHERE (faction1_id = ? OR faction2_id = ?)
       AND relation IN ('hostile', 'war')`,
    [factionId, factionId],
  );

  const factions: FactionRow[] = [];
  for (const rel of relations) {
    const otherId =
      rel.faction1Id === factionId ? rel.faction2Id : rel.faction1Id;
    const faction = await getFaction(otherId);
    if (faction) factions.push(faction);
  }

  return factions;
}

export async function getAlliedFactions(
  factionId: string,
): Promise<FactionRow[]> {
  const relations = await queryAll<FactionRelationRow>(
    `SELECT * FROM faction_relations
     WHERE (faction1_id = ? OR faction2_id = ?)
       AND relation IN ('allied', 'friendly')`,
    [factionId, factionId],
  );

  const factions: FactionRow[] = [];
  for (const rel of relations) {
    const otherId =
      rel.faction1Id === factionId ? rel.faction2Id : rel.faction1Id;
    const faction = await getFaction(otherId);
    if (faction) factions.push(faction);
  }

  return factions;
}

// ============================================
// FACTION PRESENCE (via edges)
// ============================================

export interface FactionPresenceInfo {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  influence: number;
  visibility: string;
  currentAgenda: string | null;
  activities: string[];
}

export async function getFactionPresence(
  factionId: string,
): Promise<FactionPresenceInfo[]> {
  const edges = await queryAll<{
    targetId: string;
    properties: string;
  }>(
    `SELECT e.target_id, e.properties, n.name as node_name, n.type as node_type
     FROM world_edges e
     JOIN world_nodes n ON e.target_id = n.id
     WHERE e.type = 'FACTION_PRESENCE'
       AND json_extract(e.properties, '$.faction.factionId') = ?
     ORDER BY json_extract(e.properties, '$.faction.influence') DESC`,
    [factionId],
  );

  return edges.map((e: any) => {
    const props = parseJson<any>(e.properties) || {};
    const faction = props.faction || {};
    return {
      nodeId: e.targetId,
      nodeName: e.nodeName || e.node_name,
      nodeType: e.nodeType || e.node_type,
      influence: faction.influence || 0,
      visibility: faction.visibility || "unknown",
      currentAgenda: faction.currentAgenda || null,
      activities: faction.activities || [],
    };
  });
}

export async function getLocationFactions(nodeId: string): Promise<
  {
    faction: FactionRow;
    influence: number;
    visibility: string;
    currentAgenda: string | null;
  }[]
> {
  const edges = await queryAll<{ sourceId: string; properties: string }>(
    `SELECT source_id, properties FROM world_edges
     WHERE target_id = ? AND type = 'FACTION_PRESENCE'
     ORDER BY json_extract(properties, '$.faction.influence') DESC`,
    [nodeId],
  );

  const results: {
    faction: FactionRow;
    influence: number;
    visibility: string;
    currentAgenda: string | null;
  }[] = [];

  for (const edge of edges) {
    const props = parseJson<any>(edge.properties) || {};
    const factionInfo = props.faction || {};
    const factionId = factionInfo.factionId || edge.sourceId;

    const faction = await getFaction(factionId);
    if (faction) {
      results.push({
        faction,
        influence: factionInfo.influence || 0,
        visibility: factionInfo.visibility || "unknown",
        currentAgenda: factionInfo.currentAgenda || null,
      });
    }
  }

  return results;
}

// ============================================
// FACTION DATA HELPERS
// ============================================

export function getFactionGoals(faction: FactionRow): {
  public: string[];
  secret: string[];
} {
  const data = parseJson<any>(faction.data) || {};
  return {
    public: data.goals?.public || [],
    secret: data.goals?.secret || [],
  };
}

export function getFactionResources(faction: FactionRow): {
  wealth: number;
  military: number;
  political: number;
  magical: number;
  information: number;
} {
  const data = parseJson<any>(faction.data) || {};
  return {
    wealth: data.resources?.wealth || 0,
    military: data.resources?.military || 0,
    political: data.resources?.political || 0,
    magical: data.resources?.magical || 0,
    information: data.resources?.information || 0,
  };
}

export function getFactionLeader(faction: FactionRow): {
  title: string | null;
  name: string | null;
} {
  const data = parseJson<any>(faction.data) || {};
  return {
    title: data.structure?.leaderTitle || null,
    name: data.structure?.leader || null,
  };
}
