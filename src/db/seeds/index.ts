// ============================================
// SEED LOADER / VALIDATOR / IMPORTER
// ============================================
//
// Tools for importing JSON seed data (from Gemini) into Turso.
//
// File Structure Expected:
//
// seeds/
// └── faerun/
//     ├── manifest.json      <- Load this first
//     ├── nodes/
//     │   ├── toril.json
//     │   ├── faerun.json
//     │   ├── sword_coast.json
//     │   └── waterdeep.json
//     ├── edges/
//     │   ├── contains.json
//     │   ├── trade_routes.json
//     │   └── faction_presence.json
//     ├── factions/
//     │   ├── harpers.json
//     │   └── zhentarim.json
//     └── deities/
//         └── faerunian.json
//
// ============================================
// WORKFLOW
// ============================================
//
// 1. VALIDATE first (catch errors before DB):
//
//   import { validateSeedDirectory, formatValidationResult } from '@/seeds';
//
//   const result = await validateSeedDirectory('./seeds/faerun/manifest.json');
//   console.log(formatValidationResult(result));
//
//   if (!result.valid) {
//     // Fix errors in JSON files
//   }
//
// 2. IMPORT after validation passes:
//
//   import { importFromManifest, formatImportResult } from '@/seeds';
//
//   const result = await importFromManifest('./seeds/faerun/manifest.json', {
//     onConflict: 'skip',      // 'skip' | 'update' | 'error'
//     validateFirst: true,     // Re-validate before import
//     batchSize: 100,          // Batch insert size
//   });
//
//   console.log(formatImportResult(result));
//
// 3. Or use quick import with logging:
//
//   import { importWithLogging } from '@/seeds';
//
//   await importWithLogging('./seeds/faerun/manifest.json');
//
// ============================================
// MODULES
// ============================================

// Loader - file loading and manifest parsing
export * from "./loader";

// Validator - schema validation with detailed errors
export * from "./validator";

// Importer - batch database insertion
export * from "./importer";
