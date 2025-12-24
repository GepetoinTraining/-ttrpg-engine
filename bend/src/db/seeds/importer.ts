import {
  transaction,
  query,
  queryOne,
  queryAll,
  batch,
  uuid,
  now,
  toJson,
  type Transaction,
} from "../client";
import type { WorldNode, WorldEdge, Faction, Deity } from "../../world/graph";
import { SeedValidator, type ValidationResult } from "./validator";
import { SeedManifestSchema, type SeedManifest } from "./loader";

// ============================================
// SEED IMPORTER
// ============================================
//
// High-performance batch import of validated seed data.
//
// Features:
//   - Batch inserts for speed
//   - Transaction support
//   - Progress callbacks
//   - Conflict resolution
//   - Rollback on error
//

// ============================================
// TYPES
// ============================================

export interface ImportOptions {
  // Conflict handling
  onConflict: "skip" | "update" | "error";

  // Batch size
  batchSize: number;

  // Validation
  validateFirst: boolean;

  // Progress callback
  onProgress?: (progress: ImportProgress) => void;

  // Dry run (validate only, don't insert)
  dryRun: boolean;
}

export interface ImportProgress {
  phase: "validating" | "importing" | "complete";
  entity: "factions" | "deities" | "nodes" | "edges" | null;
  current: number;
  total: number;
  percent: number;
}

export interface ImportStats {
  factions: { imported: number; skipped: number; updated: number };
  deities: { imported: number; skipped: number; updated: number };
  nodes: { imported: number; skipped: number; updated: number };
  edges: { imported: number; skipped: number; updated: number };
  duration: number;
}

export interface ImportResult {
  success: boolean;
  stats: ImportStats;
  validation: ValidationResult | null;
  errors: string[];
}

const DEFAULT_OPTIONS: ImportOptions = {
  onConflict: "skip",
  batchSize: 100,
  validateFirst: true,
  dryRun: false,
};

// ============================================
// IMPORTER CLASS
// ============================================

export class SeedImporter {
  private options: ImportOptions;
  private errors: string[] = [];
  private stats: ImportStats = {
    factions: { imported: 0, skipped: 0, updated: 0 },
    deities: { imported: 0, skipped: 0, updated: 0 },
    nodes: { imported: 0, skipped: 0, updated: 0 },
    edges: { imported: 0, skipped: 0, updated: 0 },
    duration: 0,
  };

  constructor(options: Partial<ImportOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ==========================================
  // MAIN IMPORT METHOD
  // ==========================================

  async import(data: {
    factions: Faction[];
    deities: Deity[];
    nodes: WorldNode[];
    edges: WorldEdge[];
  }): Promise<ImportResult> {
    const startTime = Date.now();
    this.reset();

    let validation: ValidationResult | null = null;

    // Validate first if requested
    if (this.options.validateFirst) {
      this.reportProgress("validating", null, 0, 1);
      validation = this.validate(data);

      if (!validation.valid) {
        return {
          success: false,
          stats: this.stats,
          validation,
          errors: ["Validation failed. Fix errors before importing."],
        };
      }
    }

    // Dry run stops here
    if (this.options.dryRun) {
      this.stats.duration = Date.now() - startTime;
      return {
        success: true,
        stats: this.stats,
        validation,
        errors: [],
      };
    }

    try {
      // Import in order: factions -> deities -> nodes -> edges
      await this.importFactions(data.factions);
      await this.importDeities(data.deities);
      await this.importNodes(data.nodes);
      await this.importEdges(data.edges);

      this.reportProgress("complete", null, 1, 1);
    } catch (e) {
      this.errors.push(`Import failed: ${e}`);
    }

    this.stats.duration = Date.now() - startTime;

    return {
      success: this.errors.length === 0,
      stats: this.stats,
      validation,
      errors: this.errors,
    };
  }

  // ==========================================
  // VALIDATION
  // ==========================================

  private validate(data: {
    factions: Faction[];
    deities: Deity[];
    nodes: WorldNode[];
    edges: WorldEdge[];
  }): ValidationResult {
    const validator = new SeedValidator();

    // Validate in order
    for (const faction of data.factions) {
      validator.validateFaction(faction, "import");
    }
    for (const deity of data.deities) {
      validator.validateDeity(deity, "import");
    }
    for (const node of data.nodes) {
      validator.validateNode(node, "import");
    }
    for (const edge of data.edges) {
      validator.validateEdge(edge, "import");
    }

    return validator.getResult();
  }

  // ==========================================
  // FACTION IMPORT
  // ==========================================

  private async importFactions(factions: Faction[]): Promise<void> {
    const total = factions.length;
    if (total === 0) return;

    for (let i = 0; i < total; i += this.options.batchSize) {
      const batch = factions.slice(i, i + this.options.batchSize);
      this.reportProgress("importing", "factions", i, total);

      await transaction(async (tx) => {
        for (const faction of batch) {
          await this.importFaction(tx, faction);
        }
      });
    }

    this.reportProgress("importing", "factions", total, total);
  }

  private async importFaction(
    tx: Transaction,
    faction: Faction,
  ): Promise<void> {
    const existing = await tx.queryOne<{ id: string }>(
      "SELECT id FROM factions WHERE id = ?",
      [faction.id],
    );

    if (existing) {
      if (this.options.onConflict === "skip") {
        this.stats.factions.skipped++;
        return;
      }
      if (this.options.onConflict === "error") {
        throw new Error(`Faction ${faction.id} already exists`);
      }
      // Update
      await tx.query(
        `UPDATE factions SET
          name = ?, alternate_names = ?, type = ?, scope = ?,
          home_sphere_id = ?, home_planet_id = ?,
          data = ?, is_seeded = 1, is_canonical = ?,
          updated_at = ?, version = version + 1
         WHERE id = ?`,
        [
          faction.name,
          toJson(faction.alternateNames || []),
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
      this.stats.factions.updated++;
      return;
    }

    await tx.query(
      `INSERT INTO factions (
        id, name, alternate_names, type, scope,
        home_sphere_id, home_planet_id,
        data, is_seeded, is_canonical,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)`,
      [
        faction.id,
        faction.name,
        toJson(faction.alternateNames || []),
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
    this.stats.factions.imported++;
  }

  // ==========================================
  // DEITY IMPORT
  // ==========================================

  private async importDeities(deities: Deity[]): Promise<void> {
    const total = deities.length;
    if (total === 0) return;

    for (let i = 0; i < total; i += this.options.batchSize) {
      const batch = deities.slice(i, i + this.options.batchSize);
      this.reportProgress("importing", "deities", i, total);

      await transaction(async (tx) => {
        for (const deity of batch) {
          await this.importDeity(tx, deity);
        }
      });
    }

    this.reportProgress("importing", "deities", total, total);
  }

  private async importDeity(tx: Transaction, deity: Deity): Promise<void> {
    const existing = await tx.queryOne<{ id: string }>(
      "SELECT id FROM deities WHERE id = ?",
      [deity.id],
    );

    if (existing) {
      if (this.options.onConflict === "skip") {
        this.stats.deities.skipped++;
        return;
      }
      if (this.options.onConflict === "error") {
        throw new Error(`Deity ${deity.id} already exists`);
      }
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
      this.stats.deities.updated++;
      return;
    }

    await tx.query(
      `INSERT INTO deities (
        id, name, pantheon, rank, alignment,
        sphere_id, planet_id,
        data, is_seeded, is_canonical,
        created_at, updated_at, version
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
    this.stats.deities.imported++;
  }

  // ==========================================
  // NODE IMPORT
  // ==========================================

  private async importNodes(nodes: WorldNode[]): Promise<void> {
    const total = nodes.length;
    if (total === 0) return;

    // Sort by hierarchy (parents first)
    const sorted = this.sortNodesByHierarchy(nodes);

    for (let i = 0; i < total; i += this.options.batchSize) {
      const batch = sorted.slice(i, i + this.options.batchSize);
      this.reportProgress("importing", "nodes", i, total);

      await transaction(async (tx) => {
        for (const node of batch) {
          await this.importNode(tx, node);
        }
      });
    }

    this.reportProgress("importing", "nodes", total, total);
  }

  private sortNodesByHierarchy(nodes: WorldNode[]): WorldNode[] {
    const sorted: WorldNode[] = [];
    const remaining = [...nodes];
    const added = new Set<string>();

    // First: nodes without parents
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (!remaining[i].parentId) {
        sorted.push(remaining[i]);
        added.add(remaining[i].id);
        remaining.splice(i, 1);
      }
    }

    // Then: nodes whose parents are added
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

    // Add orphans
    sorted.push(...remaining);
    return sorted;
  }

  private async importNode(tx: Transaction, node: WorldNode): Promise<void> {
    const existing = await tx.queryOne<{ id: string }>(
      "SELECT id FROM world_nodes WHERE id = ?",
      [node.id],
    );

    if (existing) {
      if (this.options.onConflict === "skip") {
        this.stats.nodes.skipped++;
        return;
      }
      if (this.options.onConflict === "error") {
        throw new Error(`Node ${node.id} already exists`);
      }
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
      this.stats.nodes.updated++;
      return;
    }

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
    this.stats.nodes.imported++;
  }

  // ==========================================
  // EDGE IMPORT
  // ==========================================

  private async importEdges(edges: WorldEdge[]): Promise<void> {
    const total = edges.length;
    if (total === 0) return;

    for (let i = 0; i < total; i += this.options.batchSize) {
      const batch = edges.slice(i, i + this.options.batchSize);
      this.reportProgress("importing", "edges", i, total);

      await transaction(async (tx) => {
        for (const edge of batch) {
          await this.importEdge(tx, edge);
        }
      });
    }

    this.reportProgress("importing", "edges", total, total);
  }

  private async importEdge(tx: Transaction, edge: WorldEdge): Promise<void> {
    const existing = await tx.queryOne<{ id: string }>(
      "SELECT id FROM world_edges WHERE id = ?",
      [edge.id],
    );

    if (existing) {
      if (this.options.onConflict === "skip") {
        this.stats.edges.skipped++;
        return;
      }
      if (this.options.onConflict === "error") {
        throw new Error(`Edge ${edge.id} already exists`);
      }
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
      this.stats.edges.updated++;
      return;
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
    this.stats.edges.imported++;
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private reportProgress(
    phase: ImportProgress["phase"],
    entity: ImportProgress["entity"],
    current: number,
    total: number,
  ): void {
    if (this.options.onProgress) {
      this.options.onProgress({
        phase,
        entity,
        current,
        total,
        percent: total > 0 ? Math.round((current / total) * 100) : 0,
      });
    }
  }

  private reset(): void {
    this.errors = [];
    this.stats = {
      factions: { imported: 0, skipped: 0, updated: 0 },
      deities: { imported: 0, skipped: 0, updated: 0 },
      nodes: { imported: 0, skipped: 0, updated: 0 },
      edges: { imported: 0, skipped: 0, updated: 0 },
      duration: 0,
    };
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Import from manifest file path
 */
export async function importFromManifest(
  manifestPath: string,
  options: Partial<ImportOptions> = {},
): Promise<ImportResult> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const basePath = path.dirname(manifestPath);

  // Load manifest
  const manifestContent = await fs.readFile(manifestPath, "utf-8");
  const manifest = SeedManifestSchema.parse(JSON.parse(manifestContent));

  // Load all files
  const factions: Faction[] = [];
  const deities: Deity[] = [];
  const nodes: WorldNode[] = [];
  const edges: WorldEdge[] = [];

  // Load factions
  for (const file of manifest.files.factions) {
    const content = await fs.readFile(path.join(basePath, file), "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      factions.push(...data);
    } else {
      factions.push(data);
    }
  }

  // Load deities
  for (const file of manifest.files.deities) {
    const content = await fs.readFile(path.join(basePath, file), "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      deities.push(...data);
    } else {
      deities.push(data);
    }
  }

  // Load nodes
  for (const file of manifest.files.nodes) {
    const content = await fs.readFile(path.join(basePath, file), "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      nodes.push(...data);
    } else {
      nodes.push(data);
    }
  }

  // Load edges
  for (const file of manifest.files.edges) {
    const content = await fs.readFile(path.join(basePath, file), "utf-8");
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      edges.push(...data);
    } else {
      edges.push(data);
    }
  }

  // Import
  const importer = new SeedImporter(options);
  return importer.import({ factions, deities, nodes, edges });
}

/**
 * Quick import with progress logging
 */
export async function importWithLogging(
  manifestPath: string,
  options: Partial<ImportOptions> = {},
): Promise<ImportResult> {
  return importFromManifest(manifestPath, {
    ...options,
    onProgress: (progress) => {
      if (progress.phase === "validating") {
        console.log("[Import] Validating...");
      } else if (progress.phase === "importing" && progress.entity) {
        console.log(
          `[Import] ${progress.entity}: ${progress.current}/${progress.total} (${progress.percent}%)`,
        );
      } else if (progress.phase === "complete") {
        console.log("[Import] Complete!");
      }
    },
  });
}

/**
 * Format import result for console
 */
export function formatImportResult(result: ImportResult): string {
  const lines: string[] = [];

  lines.push(`\n${"=".repeat(60)}`);
  lines.push(`IMPORT RESULT: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
  lines.push(`${"=".repeat(60)}\n`);

  lines.push(`Duration: ${result.stats.duration}ms\n`);

  lines.push("Stats:");
  lines.push(
    `  Factions: ${result.stats.factions.imported} imported, ${result.stats.factions.skipped} skipped, ${result.stats.factions.updated} updated`,
  );
  lines.push(
    `  Deities:  ${result.stats.deities.imported} imported, ${result.stats.deities.skipped} skipped, ${result.stats.deities.updated} updated`,
  );
  lines.push(
    `  Nodes:    ${result.stats.nodes.imported} imported, ${result.stats.nodes.skipped} skipped, ${result.stats.nodes.updated} updated`,
  );
  lines.push(
    `  Edges:    ${result.stats.edges.imported} imported, ${result.stats.edges.skipped} skipped, ${result.stats.edges.updated} updated`,
  );
  lines.push("");

  if (result.errors.length > 0) {
    lines.push(`❌ Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      lines.push(`  • ${err}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
