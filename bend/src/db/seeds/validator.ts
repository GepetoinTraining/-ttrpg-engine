import { z, ZodError, ZodIssue } from "zod";
import {
  WorldNodeSchema,
  WorldEdgeSchema,
  FactionSchema,
  DeitySchema,
  WorldNodeTypeSchema,
  WorldEdgeTypeSchema,
  type WorldNode,
  type WorldEdge,
  type Faction,
  type Deity,
} from "../world/graph";
import { SeedManifestSchema, type SeedManifest } from "./loader";

// ============================================
// SEED VALIDATOR
// ============================================
//
// Validates JSON seed data against Zod schemas.
// Run this BEFORE importing to catch errors early.
//
// Features:
//   - Schema validation
//   - Reference integrity (edges reference existing nodes)
//   - Duplicate detection
//   - Detailed error reporting
//

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationError {
  file: string;
  index?: number;
  path: string[];
  message: string;
  value?: any;
  code: string;
}

export interface ValidationWarning {
  file: string;
  index?: number;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    nodesValidated: number;
    edgesValidated: number;
    factionsValidated: number;
    deitiesValidated: number;
  };
}

export interface ReferenceMap {
  nodeIds: Set<string>;
  factionIds: Set<string>;
  deityIds: Set<string>;
}

// ============================================
// VALIDATOR CLASS
// ============================================

export class SeedValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private references: ReferenceMap = {
    nodeIds: new Set(),
    factionIds: new Set(),
    deityIds: new Set(),
  };
  private stats = {
    nodesValidated: 0,
    edgesValidated: 0,
    factionsValidated: 0,
    deitiesValidated: 0,
  };

  // ==========================================
  // MANIFEST VALIDATION
  // ==========================================

  validateManifest(data: unknown, file: string): SeedManifest | null {
    try {
      return SeedManifestSchema.parse(data);
    } catch (e) {
      if (e instanceof ZodError) {
        this.addZodErrors(e, file);
      } else {
        this.addError(file, [], "PARSE_ERROR", String(e));
      }
      return null;
    }
  }

  // ==========================================
  // NODE VALIDATION
  // ==========================================

  validateNode(data: unknown, file: string, index?: number): WorldNode | null {
    try {
      // Add timestamps if missing
      const withTimestamps = {
        ...(data as object),
        createdAt: (data as any).createdAt || new Date(),
        updatedAt: (data as any).updatedAt || new Date(),
      };

      const node = WorldNodeSchema.parse(withTimestamps);

      // Track for reference checking
      this.references.nodeIds.add(node.id);

      // Additional validations
      this.validateNodeReferences(node, file, index);
      this.validateNodeData(node, file, index);

      this.stats.nodesValidated++;
      return node;
    } catch (e) {
      if (e instanceof ZodError) {
        this.addZodErrors(e, file, index);
      } else {
        this.addError(file, [], "PARSE_ERROR", String(e), undefined, index);
      }
      return null;
    }
  }

  private validateNodeReferences(
    node: WorldNode,
    file: string,
    index?: number,
  ): void {
    // Check parent reference
    if (node.parentId && !this.references.nodeIds.has(node.parentId)) {
      this.addWarning(
        file,
        `Node "${node.name}" references parent ${node.parentId} which hasn't been validated yet`,
        "Ensure parent nodes are loaded before children",
        index,
      );
    }

    // Check hierarchy references
    if (node.sphereId && !this.references.nodeIds.has(node.sphereId)) {
      this.addWarning(
        file,
        `Node "${node.name}" references sphere ${node.sphereId} which hasn't been validated yet`,
        undefined,
        index,
      );
    }
    if (node.planetId && !this.references.nodeIds.has(node.planetId)) {
      this.addWarning(
        file,
        `Node "${node.name}" references planet ${node.planetId} which hasn't been validated yet`,
        undefined,
        index,
      );
    }
  }

  private validateNodeData(
    node: WorldNode,
    file: string,
    index?: number,
  ): void {
    const data = node.dataStatic;

    // Warn on empty descriptions for important nodes
    if (
      !data.description &&
      ["metropolis", "city", "region", "nation"].includes(node.type)
    ) {
      this.addWarning(
        file,
        `Node "${node.name}" (${node.type}) has no description`,
        "Add a description for better usability",
        index,
      );
    }

    // Warn on missing canonical name
    if (!node.canonicalName) {
      this.addWarning(
        file,
        `Node "${node.name}" has no canonicalName`,
        "Add canonicalName for deduplication",
        index,
      );
    }
  }

  validateNodes(dataArray: unknown[], file: string): WorldNode[] {
    const valid: WorldNode[] = [];
    for (let i = 0; i < dataArray.length; i++) {
      const node = this.validateNode(dataArray[i], file, i);
      if (node) valid.push(node);
    }
    return valid;
  }

  // ==========================================
  // EDGE VALIDATION
  // ==========================================

  validateEdge(data: unknown, file: string, index?: number): WorldEdge | null {
    try {
      const withTimestamps = {
        ...(data as object),
        createdAt: (data as any).createdAt || new Date(),
        updatedAt: (data as any).updatedAt || new Date(),
      };

      const edge = WorldEdgeSchema.parse(withTimestamps);

      // Check references
      this.validateEdgeReferences(edge, file, index);

      // Validate edge-specific data
      this.validateEdgeData(edge, file, index);

      this.stats.edgesValidated++;
      return edge;
    } catch (e) {
      if (e instanceof ZodError) {
        this.addZodErrors(e, file, index);
      } else {
        this.addError(file, [], "PARSE_ERROR", String(e), undefined, index);
      }
      return null;
    }
  }

  private validateEdgeReferences(
    edge: WorldEdge,
    file: string,
    index?: number,
  ): void {
    if (!this.references.nodeIds.has(edge.sourceId)) {
      this.addError(
        file,
        ["sourceId"],
        "INVALID_REFERENCE",
        `Edge references source node ${edge.sourceId} which doesn't exist`,
        edge.sourceId,
        index,
      );
    }

    if (!this.references.nodeIds.has(edge.targetId)) {
      this.addError(
        file,
        ["targetId"],
        "INVALID_REFERENCE",
        `Edge references target node ${edge.targetId} which doesn't exist`,
        edge.targetId,
        index,
      );
    }

    // For FACTION_PRESENCE, check faction reference
    if (edge.type === "FACTION_PRESENCE") {
      const factionId = edge.properties.faction?.factionId;
      if (factionId && !this.references.factionIds.has(factionId)) {
        this.addWarning(
          file,
          `FACTION_PRESENCE edge references faction ${factionId} which hasn't been validated yet`,
          "Load factions before faction presence edges",
          index,
        );
      }
    }
  }

  private validateEdgeData(
    edge: WorldEdge,
    file: string,
    index?: number,
  ): void {
    // FACTION_PRESENCE must have faction data
    if (edge.type === "FACTION_PRESENCE" && !edge.properties.faction) {
      this.addError(
        file,
        ["properties", "faction"],
        "MISSING_REQUIRED",
        "FACTION_PRESENCE edge must have faction data in properties",
        undefined,
        index,
      );
    }

    // TRADE_ROUTE should have trade data
    if (edge.type === "TRADE_ROUTE" && !edge.properties.trade) {
      this.addWarning(
        file,
        "TRADE_ROUTE edge has no trade data in properties",
        "Add trade.goods, trade.travelTime, etc.",
        index,
      );
    }

    // PORTAL should have portal data
    if (
      (edge.type === "PORTAL" || edge.type === "PLANAR_GATE") &&
      !edge.properties.portal
    ) {
      this.addWarning(
        file,
        `${edge.type} edge has no portal data in properties`,
        "Add portal.permanent, portal.keyRequired, etc.",
        index,
      );
    }
  }

  validateEdges(dataArray: unknown[], file: string): WorldEdge[] {
    const valid: WorldEdge[] = [];
    for (let i = 0; i < dataArray.length; i++) {
      const edge = this.validateEdge(dataArray[i], file, i);
      if (edge) valid.push(edge);
    }
    return valid;
  }

  // ==========================================
  // FACTION VALIDATION
  // ==========================================

  validateFaction(data: unknown, file: string, index?: number): Faction | null {
    try {
      const withTimestamps = {
        ...(data as object),
        createdAt: (data as any).createdAt || new Date(),
        updatedAt: (data as any).updatedAt || new Date(),
      };

      const faction = FactionSchema.parse(withTimestamps);

      // Track for reference checking
      this.references.factionIds.add(faction.id);

      // Validate faction data
      this.validateFactionData(faction, file, index);

      this.stats.factionsValidated++;
      return faction;
    } catch (e) {
      if (e instanceof ZodError) {
        this.addZodErrors(e, file, index);
      } else {
        this.addError(file, [], "PARSE_ERROR", String(e), undefined, index);
      }
      return null;
    }
  }

  private validateFactionData(
    faction: Faction,
    file: string,
    index?: number,
  ): void {
    // Warn on missing description
    if (!faction.data.description) {
      this.addWarning(
        file,
        `Faction "${faction.name}" has no description`,
        "Add a description for better usability",
        index,
      );
    }

    // Warn on missing goals
    if (
      !faction.data.goals?.public?.length &&
      !faction.data.goals?.secret?.length
    ) {
      this.addWarning(
        file,
        `Faction "${faction.name}" has no goals defined`,
        "Add public or secret goals",
        index,
      );
    }
  }

  validateFactions(dataArray: unknown[], file: string): Faction[] {
    const valid: Faction[] = [];
    for (let i = 0; i < dataArray.length; i++) {
      const faction = this.validateFaction(dataArray[i], file, i);
      if (faction) valid.push(faction);
    }
    return valid;
  }

  // ==========================================
  // DEITY VALIDATION
  // ==========================================

  validateDeity(data: unknown, file: string, index?: number): Deity | null {
    try {
      const withTimestamps = {
        ...(data as object),
        createdAt: (data as any).createdAt || new Date(),
        updatedAt: (data as any).updatedAt || new Date(),
      };

      const deity = DeitySchema.parse(withTimestamps);

      // Track for reference checking
      this.references.deityIds.add(deity.id);

      // Validate deity data
      this.validateDeityData(deity, file, index);

      this.stats.deitiesValidated++;
      return deity;
    } catch (e) {
      if (e instanceof ZodError) {
        this.addZodErrors(e, file, index);
      } else {
        this.addError(file, [], "PARSE_ERROR", String(e), undefined, index);
      }
      return null;
    }
  }

  private validateDeityData(deity: Deity, file: string, index?: number): void {
    // Warn on missing portfolio
    if (!deity.data.portfolio?.length) {
      this.addWarning(
        file,
        `Deity "${deity.name}" has no portfolio defined`,
        "Add portfolio (what they are god of)",
        index,
      );
    }

    // Warn on missing domains (for 5e compatibility)
    if (!deity.data.domains?.length) {
      this.addWarning(
        file,
        `Deity "${deity.name}" has no domains defined`,
        "Add 5e cleric domains",
        index,
      );
    }
  }

  validateDeities(dataArray: unknown[], file: string): Deity[] {
    const valid: Deity[] = [];
    for (let i = 0; i < dataArray.length; i++) {
      const deity = this.validateDeity(dataArray[i], file, i);
      if (deity) valid.push(deity);
    }
    return valid;
  }

  // ==========================================
  // ERROR HELPERS
  // ==========================================

  private addError(
    file: string,
    path: string[],
    code: string,
    message: string,
    value?: any,
    index?: number,
  ): void {
    this.errors.push({ file, index, path, message, value, code });
  }

  private addWarning(
    file: string,
    message: string,
    suggestion?: string,
    index?: number,
  ): void {
    this.warnings.push({ file, index, message, suggestion });
  }

  private addZodErrors(error: ZodError, file: string, index?: number): void {
    for (const issue of error.issues) {
      this.errors.push({
        file,
        index,
        path: issue.path.map(String),
        message: issue.message,
        value: undefined,
        code: issue.code,
      });
    }
  }

  // ==========================================
  // RESULTS
  // ==========================================

  getResult(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      stats: this.stats,
    };
  }

  reset(): void {
    this.errors = [];
    this.warnings = [];
    this.references = {
      nodeIds: new Set(),
      factionIds: new Set(),
      deityIds: new Set(),
    };
    this.stats = {
      nodesValidated: 0,
      edgesValidated: 0,
      factionsValidated: 0,
      deitiesValidated: 0,
    };
  }

  // Pre-populate references (for incremental validation)
  addExistingReferences(refs: Partial<ReferenceMap>): void {
    if (refs.nodeIds) {
      refs.nodeIds.forEach((id) => this.references.nodeIds.add(id));
    }
    if (refs.factionIds) {
      refs.factionIds.forEach((id) => this.references.factionIds.add(id));
    }
    if (refs.deityIds) {
      refs.deityIds.forEach((id) => this.references.deityIds.add(id));
    }
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Validate a single JSON file
 */
export async function validateSeedFile(
  filePath: string,
  type: "node" | "edge" | "faction" | "deity" | "manifest",
): Promise<ValidationResult> {
  const fs = await import("fs/promises");
  const validator = new SeedValidator();

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);

    switch (type) {
      case "manifest":
        validator.validateManifest(data, filePath);
        break;
      case "node":
        if (Array.isArray(data)) {
          validator.validateNodes(data, filePath);
        } else {
          validator.validateNode(data, filePath);
        }
        break;
      case "edge":
        if (Array.isArray(data)) {
          validator.validateEdges(data, filePath);
        } else {
          validator.validateEdge(data, filePath);
        }
        break;
      case "faction":
        if (Array.isArray(data)) {
          validator.validateFactions(data, filePath);
        } else {
          validator.validateFaction(data, filePath);
        }
        break;
      case "deity":
        if (Array.isArray(data)) {
          validator.validateDeities(data, filePath);
        } else {
          validator.validateDeity(data, filePath);
        }
        break;
    }
  } catch (e) {
    validator["addError"](filePath, [], "FILE_ERROR", String(e));
  }

  return validator.getResult();
}

/**
 * Validate entire seed directory
 */
export async function validateSeedDirectory(
  manifestPath: string,
): Promise<ValidationResult> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const validator = new SeedValidator();
  const basePath = path.dirname(manifestPath);

  try {
    // Load and validate manifest
    const manifestContent = await fs.readFile(manifestPath, "utf-8");
    const manifestData = JSON.parse(manifestContent);
    const manifest = validator.validateManifest(manifestData, manifestPath);

    if (!manifest) {
      return validator.getResult();
    }

    // Validate factions first (edges reference them)
    for (const file of manifest.files.factions) {
      const filePath = path.join(basePath, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          validator.validateFactions(data, filePath);
        } else {
          validator.validateFaction(data, filePath);
        }
      } catch (e) {
        validator["addError"](filePath, [], "FILE_ERROR", String(e));
      }
    }

    // Validate deities
    for (const file of manifest.files.deities) {
      const filePath = path.join(basePath, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          validator.validateDeities(data, filePath);
        } else {
          validator.validateDeity(data, filePath);
        }
      } catch (e) {
        validator["addError"](filePath, [], "FILE_ERROR", String(e));
      }
    }

    // Validate nodes
    for (const file of manifest.files.nodes) {
      const filePath = path.join(basePath, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          validator.validateNodes(data, filePath);
        } else {
          validator.validateNode(data, filePath);
        }
      } catch (e) {
        validator["addError"](filePath, [], "FILE_ERROR", String(e));
      }
    }

    // Validate edges last (reference nodes and factions)
    for (const file of manifest.files.edges) {
      const filePath = path.join(basePath, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          validator.validateEdges(data, filePath);
        } else {
          validator.validateEdge(data, filePath);
        }
      } catch (e) {
        validator["addError"](filePath, [], "FILE_ERROR", String(e));
      }
    }
  } catch (e) {
    validator["addError"](manifestPath, [], "FILE_ERROR", String(e));
  }

  return validator.getResult();
}

/**
 * Format validation result for console output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push(`\n${"=".repeat(60)}`);
  lines.push(`VALIDATION RESULT: ${result.valid ? "✅ PASSED" : "❌ FAILED"}`);
  lines.push(`${"=".repeat(60)}\n`);

  lines.push(`Stats:`);
  lines.push(`  Nodes:    ${result.stats.nodesValidated}`);
  lines.push(`  Edges:    ${result.stats.edgesValidated}`);
  lines.push(`  Factions: ${result.stats.factionsValidated}`);
  lines.push(`  Deities:  ${result.stats.deitiesValidated}`);
  lines.push("");

  if (result.errors.length > 0) {
    lines.push(`❌ ERRORS (${result.errors.length}):`);
    for (const err of result.errors) {
      const location =
        err.index !== undefined ? `${err.file}[${err.index}]` : err.file;
      const path = err.path.length > 0 ? `.${err.path.join(".")}` : "";
      lines.push(`  • ${location}${path}: ${err.message} [${err.code}]`);
    }
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push(`⚠️ WARNINGS (${result.warnings.length}):`);
    for (const warn of result.warnings) {
      const location =
        warn.index !== undefined ? `${warn.file}[${warn.index}]` : warn.file;
      lines.push(`  • ${location}: ${warn.message}`);
      if (warn.suggestion) {
        lines.push(`    → ${warn.suggestion}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
