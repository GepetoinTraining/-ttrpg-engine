/**
 * MIGRATIONS INDEX
 *
 * Central registry of all database migrations.
 * Migrations are run in order by version number.
 */

import { MIGRATION_001_CORE } from './001_core';
import { MIGRATION_002_WORLD } from './002_world';
import { MIGRATION_003_HUB } from './003_hub';
import { MIGRATION_004_INVENTORY } from './004_inventory';
import { MIGRATION_005_SKILLS } from './005_skills';
import { MIGRATION_006_MAGIC } from './006_magic';
import { MIGRATION_007_ECONOMY } from './007_economy';
import { MIGRATION_008_COMBAT } from './008_combat';
import { MIGRATION_009_SESSIONS } from './009_sessions';
import { MIGRATION_010_NPCS } from './010_npcs';
import { MIGRATION_011_TIMELINE } from './011_timeline';
import { MIGRATION_012_SOCIAL } from './012_social';
import { MIGRATION_013_HUSBANDRY } from './013_husbandry';
import { MIGRATION_014_GM_MODULE } from './014_gm_module';
import { MIGRATION_015_ECONOMY_SERVICES_CONTRACTS } from './015_economy_services_contracts';
import { MIGRATION_016_ENTITY_INVENTORY } from './016_entity_inventory';
import { MIGRATION_017_TOPOLOGY_AUTH } from './017_topology_auth';
import { MIGRATION_018_CHARACTER_TOKENS } from './018_character_tokens';
import { MIGRATION_019_GENESIS_ATOMS } from './019_genesis_atoms';

// ============================================
// MIGRATION TYPE
// ============================================

export interface Migration {
  version: number;
  name: string;
  tables: Array<{
    name: string;
    sql: string;
  }>;
  indexes: string[];
}

// ============================================
// ALL MIGRATIONS (ordered by version)
// ============================================

export const ALL_MIGRATIONS: Migration[] = [
  MIGRATION_001_CORE,
  MIGRATION_002_WORLD,
  MIGRATION_003_HUB,
  MIGRATION_004_INVENTORY,
  MIGRATION_005_SKILLS,
  MIGRATION_006_MAGIC,
  MIGRATION_007_ECONOMY,
  MIGRATION_008_COMBAT,
  MIGRATION_009_SESSIONS,
  MIGRATION_010_NPCS,
  MIGRATION_011_TIMELINE,
  MIGRATION_012_SOCIAL,
  MIGRATION_013_HUSBANDRY,
  MIGRATION_014_GM_MODULE,
  MIGRATION_015_ECONOMY_SERVICES_CONTRACTS,
  MIGRATION_016_ENTITY_INVENTORY,
  MIGRATION_017_TOPOLOGY_AUTH,
  MIGRATION_018_CHARACTER_TOKENS,
  MIGRATION_019_GENESIS_ATOMS,
].sort((a, b) => a.version - b.version);

// ============================================
// MIGRATION SUMMARY
// ============================================

export function getMigrationSummary(): {
  totalMigrations: number;
  totalTables: number;
  totalIndexes: number;
  tablesByMigration: Record<string, string[]>;
} {
  const tablesByMigration: Record<string, string[]> = {};
  let totalTables = 0;
  let totalIndexes = 0;

  for (const migration of ALL_MIGRATIONS) {
    tablesByMigration[migration.name] = migration.tables.map(t => t.name);
    totalTables += migration.tables.length;
    totalIndexes += migration.indexes.length;
  }

  return {
    totalMigrations: ALL_MIGRATIONS.length,
    totalTables,
    totalIndexes,
    tablesByMigration,
  };
}

// Re-export individual migrations for direct access
export {
  MIGRATION_001_CORE,
  MIGRATION_002_WORLD,
  MIGRATION_003_HUB,
  MIGRATION_004_INVENTORY,
  MIGRATION_005_SKILLS,
  MIGRATION_006_MAGIC,
  MIGRATION_007_ECONOMY,
  MIGRATION_008_COMBAT,
  MIGRATION_009_SESSIONS,
  MIGRATION_010_NPCS,
  MIGRATION_011_TIMELINE,
  MIGRATION_012_SOCIAL,
  MIGRATION_013_HUSBANDRY,
  MIGRATION_014_GM_MODULE,
  MIGRATION_015_ECONOMY_SERVICES_CONTRACTS,
  MIGRATION_016_ENTITY_INVENTORY,
  MIGRATION_017_TOPOLOGY_AUTH,
  MIGRATION_018_CHARACTER_TOKENS,
  MIGRATION_019_GENESIS_ATOMS,
};
