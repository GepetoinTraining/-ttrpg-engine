/**
 * DATABASE MIGRATIONS
 *
 * Runs all migrations in order to ensure database schema is up to date.
 * Uses IF NOT EXISTS for idempotency - safe to run multiple times.
 *
 * Migrations are organized by domain:
 * - 001_core: Users, campaigns, parties, characters
 * - 002_world: World nodes, edges, factions, deities, POIs
 * - 003_hub: Settlements, districts, chunks, buildings
 * - 004_inventory: Items, containers, mounts, followers
 * - 005_skills: Character skills, discovery rules
 * - 006_magic: Spellcasting, rest events, entropy
 * - 007_economy: Markets, merchants, extraction, logistics
 * - 008_combat: Combats, participants, lairs
 * - 009_sessions: Sessions, quests, downtime
 * - 010_npcs: NPCs, AI agents, memories
 * - 011_timeline: Sync log, deltas, audit
 */

import { query, queryAll } from "./client";
import { ALL_MIGRATIONS, getMigrationSummary, type Migration } from "./migrations/index";

// ============================================
// MIGRATION RESULT
// ============================================

export interface MigrationResult {
  success: boolean;
  migrationsRun: number;
  tablesCreated: string[];
  indexesCreated: number;
  errors: string[];
  duration: number;
}

// ============================================
// RUN ALL MIGRATIONS
// ============================================

/**
 * Run all migrations in order.
 * Safe to call multiple times - uses IF NOT EXISTS.
 */
export async function runMigrations(): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: true,
    migrationsRun: 0,
    tablesCreated: [],
    indexesCreated: 0,
    errors: [],
    duration: 0,
  };

  console.log(`[MIGRATIONS] Starting ${ALL_MIGRATIONS.length} migrations...`);

  for (const migration of ALL_MIGRATIONS) {
    try {
      await runMigration(migration, result);
      result.migrationsRun++;
      console.log(`[MIGRATIONS] ✓ ${migration.name} (${migration.tables.length} tables)`);
    } catch (error) {
      result.success = false;
      const errorMsg = `Migration ${migration.name} failed: ${error}`;
      result.errors.push(errorMsg);
      console.error(`[MIGRATIONS] ✗ ${migration.name}: ${error}`);
      // Continue with other migrations
    }
  }

  result.duration = Date.now() - startTime;

  const summary = getMigrationSummary();
  console.log(`[MIGRATIONS] Complete: ${result.tablesCreated.length}/${summary.totalTables} tables, ${result.indexesCreated}/${summary.totalIndexes} indexes in ${result.duration}ms`);

  if (result.errors.length > 0) {
    console.error(`[MIGRATIONS] Errors: ${result.errors.length}`);
  }

  return result;
}

/**
 * Run a single migration.
 */
async function runMigration(migration: Migration, result: MigrationResult): Promise<void> {
  // Create tables
  for (const table of migration.tables) {
    try {
      await query(table.sql);
      result.tablesCreated.push(table.name);
    } catch (error) {
      throw new Error(`Table ${table.name}: ${error}`);
    }
  }

  // Create indexes
  for (const indexSql of migration.indexes) {
    try {
      await query(indexSql);
      result.indexesCreated++;
    } catch (error) {
      // Index errors are non-fatal
      result.errors.push(`Index warning: ${error}`);
    }
  }
}

// ============================================
// DROP ALL TABLES
// ============================================

/**
 * Drop all tables (for testing/reset).
 * DANGEROUS - only use in development!
 */
export async function dropAllTables(): Promise<void> {
  console.log('[MIGRATIONS] Dropping all tables...');

  // Collect all table names in reverse order (for foreign key dependencies)
  const allTables: string[] = [];
  for (const migration of [...ALL_MIGRATIONS].reverse()) {
    for (const table of [...migration.tables].reverse()) {
      allTables.push(table.name);
    }
  }

  // Drop each table
  for (const table of allTables) {
    try {
      await query(`DROP TABLE IF EXISTS ${table}`);
    } catch (error) {
      console.warn(`[MIGRATIONS] Could not drop ${table}: ${error}`);
    }
  }

  console.log(`[MIGRATIONS] Dropped ${allTables.length} tables`);
}

// ============================================
// MIGRATION STATUS
// ============================================

/**
 * Check which tables exist.
 */
export async function getMigrationStatus(): Promise<{
  existingTables: string[];
  missingTables: string[];
  totalExpected: number;
}> {
  const summary = getMigrationSummary();
  const allExpectedTables = Object.values(summary.tablesByMigration).flat();

  // Query SQLite for existing tables
  const existingTables = await queryAll<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  ).then(rows => rows.map(r => r.name));
  const missingTables = allExpectedTables.filter(t => !existingTables.includes(t));

  return {
    existingTables,
    missingTables,
    totalExpected: allExpectedTables.length,
  };
}

// ============================================
// RE-EXPORTS
// ============================================

export { ALL_MIGRATIONS, getMigrationSummary } from "./migrations/index";
export type { Migration } from "./migrations/index";
