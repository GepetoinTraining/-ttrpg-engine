import { z } from "zod";
import {
  transaction,
  query,
  queryOne,
  uuid,
  now,
  toJson,
  type Transaction,
} from "../db/client";
import {
  WorldNodeSchema,
  WorldEdgeSchema,
  FactionSchema,
  DeitySchema,
  type WorldNode,
  type WorldEdge,
  type Faction,
  type Deity,
} from "../world/graph";

// ============================================
// SEED LOADER
// ============================================
//
// Imports JSON seed data (from Gemini) into Turso.
//
// Usage:
//   const loader = new SeedLoader();
//   await loader.loadManifest('./seeds/faerun/manifest.json');
//   await loader.import();
//

// ============================================
// MANIFEST SCHEMA
// ============================================

export const SeedManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  type: z.enum([
    "world",
    "crystal_sphere",
    "region",
    "settlement_pack",
    "faction_pack",
  ]),
  description: z.string(),

  // Dependencies
  requires: z.array(z.string()).default([]),

  // Files to load (relative to manifest)
  files: z.object({
    nodes: z.array(z.string()).default([]),
    edges: z.array(z.string()).default([]),
    factions: z.array(z.string()).default([]),
    deities: z.array(z.string()).default([]),
  }),

  // Stats
  stats: z
    .object({
      nodes: z.number().int().default(0),
      edges: z.number().int().default(0),
      factions: z.number().int().default(0),
      deities: z.number().int().default(0),
    })
    .optional(),
});
export type SeedManifest = z.infer<typeof SeedManifestSchema>;

// ============================================
// IMPORT RESULT
// ============================================

export interface ImportResult {
  success: boolean;
  seedId: string;
  imported: {
    nodes: number;
    edges: number;
    factions: number;
    deities: number;
  };
  skipped: {
    nodes: number;
    edges: number;
    factions: number;
    deities: number;
  };
  errors: string[];
  duration: number;
}

// ============================================
// SEED LOADER CLASS
// ============================================

export class SeedLoader {
  private manifest: SeedManifest | null = null;
  private basePath: string = "";

  private nodes: WorldNode[] = [];
  private edges: WorldEdge[] = [];
  private factions: Faction[] = [];
  private deities: Deity[] = [];

  private errors: string[] = [];

  // ==========================================
  // LOADING
  // ==========================================

  /**
   * Load manifest from JSON file
   */
  async loadManifest(manifestPath: string): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    this.basePath = path.dirname(manifestPath);

    const content = await fs.readFile(manifestPath, "utf-8");
    const data = JSON.parse(content);

    this.manifest = SeedManifestSchema.parse(data);

    console.log(
      `[Seed] Loaded manifest: ${this.manifest.name} v${this.manifest.version}`,
    );
  }

  /**
   * Load all data files referenced in manifest
   */
  async loadFiles(): Promise<void> {
    if (!this.manifest) {
      throw new Error("Manifest not loaded. Call loadManifest first.");
    }

    const fs = await import("fs/promises");
    const path = await import("path");

    // Load nodes
    for (const file of this.manifest.files.nodes) {
      await this.loadNodeFile(path.join(this.basePath, file), fs);
    }

    // Load edges
    for (const file of this.manifest.files.edges) {
      await this.loadEdgeFile(path.join(this.basePath, file), fs);
    }

    // Load factions
    for (const file of this.manifest.files.factions) {
      await this.loadFactionFile(path.join(this.basePath, file), fs);
    }

    // Load deities
    for (const file of this.manifest.files.deities) {
      await this.loadDeityFile(path.join(this.basePath, file), fs);
    }

    console.log(
      `[Seed] Loaded: ${this.nodes.length} nodes, ${this.edges.length} edges, ${this.factions.length} factions, ${this.deities.length} deities`,
    );
  }

  private async loadNodeFile(filePath: string, fs: any): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      // Handle single node or array
      const nodes = Array.isArray(data) ? data : [data];

      for (const node of nodes) {
        try {
          // Validate against schema
          const validated = WorldNodeSchema.parse({
            ...node,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          this.nodes.push(validated);
        } catch (e) {
          this.errors.push(`Node validation error in ${filePath}: ${e}`);
        }
      }
    } catch (e) {
      this.errors.push(`Failed to load ${filePath}: ${e}`);
    }
  }

  private async loadEdgeFile(filePath: string, fs: any): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const edges = Array.isArray(data) ? data : [data];

      for (const edge of edges) {
        try {
          const validated = WorldEdgeSchema.parse({
            ...edge,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          this.edges.push(validated);
        } catch (e) {
          this.errors.push(`Edge validation error in ${filePath}: ${e}`);
        }
      }
    } catch (e) {
      this.errors.push(`Failed to load ${filePath}: ${e}`);
    }
  }

  private async loadFactionFile(filePath: string, fs: any): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const factions = Array.isArray(data) ? data : [data];

      for (const faction of factions) {
        try {
          const validated = FactionSchema.parse({
            ...faction,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          this.factions.push(validated);
        } catch (e) {
          this.errors.push(`Faction validation error in ${filePath}: ${e}`);
        }
      }
    } catch (e) {
      this.errors.push(`Failed to load ${filePath}: ${e}`);
    }
  }

  private async loadDeityFile(filePath: string, fs: any): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      const deities = Array.isArray(data) ? data : [data];

      for (const deity of deities) {
        try {
          const validated = DeitySchema.parse({
            ...deity,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          this.deities.push(validated);
        } catch (e) {
          this.errors.push(`Deity validation error in ${filePath}: ${e}`);
        }
      }
    } catch (e) {
      this.errors.push(`Failed to load ${filePath}: ${e}`);
    }
  }

  // ==========================================
  // IMPORTING
  // ==========================================

  /**
   * Import all loaded data into database
   */
  async import(
    options: {
      skipExisting?: boolean;
      updateExisting?: boolean;
    } = {},
  ): Promise<ImportResult> {
    if (!this.manifest) {
      throw new Error("Manifest not loaded");
    }

    const startTime = Date.now();
    const result: ImportResult = {
      success: true,
      seedId: this.manifest.id,
      imported: { nodes: 0, edges: 0, factions: 0, deities: 0 },
      skipped: { nodes: 0, edges: 0, factions: 0, deities: 0 },
      errors: [...this.errors],
      duration: 0,
    };

    try {
      await transaction(async (tx) => {
        // Import factions first (edges reference them)
        for (const faction of this.factions) {
          const imported = await this.importFaction(tx, faction, options);
          if (imported) result.imported.factions++;
          else result.skipped.factions++;
        }

        // Import deities
        for (const deity of this.deities) {
          const imported = await this.importDeity(tx, deity, options);
          if (imported) result.imported.deities++;
          else result.skipped.deities++;
        }

        // Import nodes (parent before children)
        const sortedNodes = this.sortNodesByHierarchy();
        for (const node of sortedNodes) {
          const imported = await this.importNode(tx, node, options);
          if (imported) result.imported.nodes++;
          else result.skipped.nodes++;
        }

        // Import edges last (reference nodes)
        for (const edge of this.edges) {
          const imported = await this.importEdge(tx, edge, options);
          if (imported) result.imported.edges++;
          else result.skipped.edges++;
        }
      });
    } catch (e) {
      result.success = false;
      result.errors.push(`Transaction failed: ${e}`);
    }

    result.duration = Date.now() - startTime;

    console.log(`[Seed] Import complete in ${result.duration}ms`);
    console.log(
      `[Seed] Imported: ${result.imported.nodes} nodes, ${result.imported.edges} edges, ${result.imported.factions} factions, ${result.imported.deities} deities`,
    );

    if (result.errors.length > 0) {
      console.warn(`[Seed] ${result.errors.length} errors occurred`);
    }

    return result;
  }

  private sortNodesByHierarchy(): WorldNode[] {
    // Sort so parents come before children
    const sorted: WorldNode[] = [];
    const remaining = [...this.nodes];
    const added = new Set<string>();

    // First pass: nodes without parents
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (!remaining[i].parentId) {
        sorted.push(remaining[i]);
        added.add(remaining[i].id);
        remaining.splice(i, 1);
      }
    }

    // Subsequent passes: add nodes whose parents are already added
    let maxIterations = 100;
    while (remaining.length > 0 && maxIterations > 0) {
      for (let i = remaining.length - 1; i >= 0; i--) {
        const node = remaining[i];
        if (!node.parentId || added.has(node.parentId)) {
          sorted.push(node);
          added.add(node.id);
          remaining.splice(i, 1);
        }
      }
      maxIterations--;
    }

    // Add any remaining (orphans or circular refs)
    sorted.push(...remaining);

    return sorted;
  }

  private async importNode(
    tx: Transaction,
    node: WorldNode,
    options: { skipExisting?: boolean; updateExisting?: boolean },
  ): Promise<boolean> {
    // Check if exists
    const existing = await tx.queryOne(
      "SELECT id FROM world_nodes WHERE id = ?",
      [node.id],
    );

    if (existing) {
      if (options.skipExisting) return false;
      if (options.updateExisting) {
        await tx.query(
          `UPDATE world_nodes SET
            parent_id = ?, type = ?, name = ?, canonical_name = ?,
            sphere_id = ?, planet_id = ?, continent_id = ?, region_id = ?,
            is_seeded = 1, is_canonical = ?, is_hidden = ?,
            data_static = ?, updated_at = ?, version = version + 1
          WHERE id = ?`,
          [
            node.parentId || null,
            node.type,
            node.name,
            node.canonicalName || null,
            node.sphereId || null,
            node.planetId || null,
            node.continentId || null,
            node.regionId || null,
            node.isCanonical ? 1 : 0,
            node.isHidden ? 1 : 0,
            toJson(node.dataStatic),
            now(),
            node.id,
          ],
        );
        return true;
      }
      return false;
    }

    // Insert new
    await tx.query(
      `INSERT INTO world_nodes (
        id, parent_id, type, name, canonical_name,
        sphere_id, planet_id, continent_id, region_id,
        is_seeded, is_canonical, is_hidden,
        data_static, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1)`,
      [
        node.id,
        node.parentId || null,
        node.type,
        node.name,
        node.canonicalName || null,
        node.sphereId || null,
        node.planetId || null,
        node.continentId || null,
        node.regionId || null,
        node.isCanonical ? 1 : 0,
        node.isHidden ? 1 : 0,
        toJson(node.dataStatic),
        now(),
        now(),
      ],
    );

    return true;
  }

  private async importEdge(
    tx: Transaction,
    edge: WorldEdge,
    options: { skipExisting?: boolean; updateExisting?: boolean },
  ): Promise<boolean> {
    const existing = await tx.queryOne(
      "SELECT id FROM world_edges WHERE id = ?",
      [edge.id],
    );

    if (existing) {
      if (options.skipExisting) return false;
      if (options.updateExisting) {
        await tx.query(
          `UPDATE world_edges SET
            source_id = ?, target_id = ?, type = ?, bidirectional = ?,
            properties = ?, updated_at = ?, version = version + 1
          WHERE id = ?`,
          [
            edge.sourceId,
            edge.targetId,
            edge.type,
            edge.bidirectional ? 1 : 0,
            toJson(edge.properties),
            now(),
            edge.id,
          ],
        );
        return true;
      }
      return false;
    }

    await tx.query(
      `INSERT INTO world_edges (
        id, source_id, target_id, type, bidirectional,
        properties, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        edge.id,
        edge.sourceId,
        edge.targetId,
        edge.type,
        edge.bidirectional ? 1 : 0,
        toJson(edge.properties),
        now(),
        now(),
      ],
    );

    return true;
  }

  private async importFaction(
    tx: Transaction,
    faction: Faction,
    options: { skipExisting?: boolean; updateExisting?: boolean },
  ): Promise<boolean> {
    const existing = await tx.queryOne("SELECT id FROM factions WHERE id = ?", [
      faction.id,
    ]);

    if (existing) {
      if (options.skipExisting) return false;
      if (options.updateExisting) {
        await tx.query(
          `UPDATE factions SET
            name = ?, type = ?, scope = ?,
            home_sphere_id = ?, home_planet_id = ?,
            data = ?, is_seeded = 1, is_canonical = ?,
            updated_at = ?, version = version + 1
          WHERE id = ?`,
          [
            faction.name,
            faction.type,
            faction.scope,
            faction.homeSphereId || null,
            faction.homePlanetId || null,
            toJson(faction.data),
            faction.isCanonical ? 1 : 0,
            now(),
            faction.id,
          ],
        );
        return true;
      }
      return false;
    }

    await tx.query(
      `INSERT INTO factions (
        id, name, type, scope, home_sphere_id, home_planet_id,
        data, is_seeded, is_canonical, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)`,
      [
        faction.id,
        faction.name,
        faction.type,
        faction.scope,
        faction.homeSphereId || null,
        faction.homePlanetId || null,
        toJson(faction.data),
        faction.isCanonical ? 1 : 0,
        now(),
        now(),
      ],
    );

    return true;
  }

  private async importDeity(
    tx: Transaction,
    deity: Deity,
    options: { skipExisting?: boolean; updateExisting?: boolean },
  ): Promise<boolean> {
    const existing = await tx.queryOne("SELECT id FROM deities WHERE id = ?", [
      deity.id,
    ]);

    if (existing) {
      if (options.skipExisting) return false;
      if (options.updateExisting) {
        await tx.query(
          `UPDATE deities SET
            name = ?, pantheon = ?, rank = ?, alignment = ?,
            sphere_id = ?, planet_id = ?,
            data = ?, is_seeded = 1, is_canonical = ?,
            updated_at = ?, version = version + 1
          WHERE id = ?`,
          [
            deity.name,
            deity.pantheon || null,
            deity.rank || null,
            deity.alignment || null,
            deity.sphereId || null,
            deity.planetId || null,
            toJson(deity.data),
            deity.isCanonical ? 1 : 0,
            now(),
            deity.id,
          ],
        );
        return true;
      }
      return false;
    }

    await tx.query(
      `INSERT INTO deities (
        id, name, pantheon, rank, alignment,
        sphere_id, planet_id,
        data, is_seeded, is_canonical, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)`,
      [
        deity.id,
        deity.name,
        deity.pantheon || null,
        deity.rank || null,
        deity.alignment || null,
        deity.sphereId || null,
        deity.planetId || null,
        toJson(deity.data),
        deity.isCanonical ? 1 : 0,
        now(),
        now(),
      ],
    );

    return true;
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Get loaded stats
   */
  getStats(): {
    nodes: number;
    edges: number;
    factions: number;
    deities: number;
  } {
    return {
      nodes: this.nodes.length,
      edges: this.edges.length,
      factions: this.factions.length,
      deities: this.deities.length,
    };
  }

  /**
   * Get validation errors
   */
  getErrors(): string[] {
    return [...this.errors];
  }

  /**
   * Clear loaded data
   */
  clear(): void {
    this.manifest = null;
    this.basePath = "";
    this.nodes = [];
    this.edges = [];
    this.factions = [];
    this.deities = [];
    this.errors = [];
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick import from manifest path
 */
export async function importSeed(
  manifestPath: string,
  options?: { skipExisting?: boolean; updateExisting?: boolean },
): Promise<ImportResult> {
  const loader = new SeedLoader();
  await loader.loadManifest(manifestPath);
  await loader.loadFiles();
  return loader.import(options);
}

/**
 * Check if a seed is already imported
 */
export async function isSeedImported(seedId: string): Promise<boolean> {
  const result = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM world_nodes
     WHERE is_seeded = 1
     AND json_extract(data_static, '$.source.seedId') = ?`,
    [seedId],
  );
  return (result?.count || 0) > 0;
}

/**
 * Get imported seed info
 */
export async function getImportedSeeds(): Promise<string[]> {
  const results = await query(
    `SELECT DISTINCT json_extract(data_static, '$.source.seedId') as seed_id
     FROM world_nodes
     WHERE is_seeded = 1
       AND json_extract(data_static, '$.source.seedId') IS NOT NULL`,
  );

  return results.rows.map((r: any) => r[0] || r.seed_id).filter(Boolean);
}
