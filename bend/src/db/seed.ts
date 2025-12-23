import path from "path";
import { closeClient } from "../client";
import { runMigrations } from "../migrations";
import { importWithLogging } from "./importer";

// ============================================
// MASTER SEED SCRIPT
// ============================================
//
// Usage:
//   bun run src/db/seeds/seed.ts
//
// Workflow:
//   1. Run Migrations (ensure tables exist)
//   2. Load Manifest (src/db/seeds/00_system/manifest.json)
//   3. Validate JSON Structure (Zod)
//   4. Batch Import to Turso
//

async function main() {
  console.log("\n🌱 GENESIS ENGINE: STARTING SEED PROCESS\n");

  const startTime = Date.now();

  try {
    // ------------------------------------------
    // STEP 1: PREPARE DATABASE
    // ------------------------------------------
    console.log("🛠️  Step 1: Running Migrations...");
    const migrationResult = await runMigrations();

    if (!migrationResult.success) {
      console.error("❌ Migration Failed:", migrationResult.errors);
      process.exit(1);
    }
    console.log("✅ Tables checked/created successfully.\n");

    // ------------------------------------------
    // STEP 2: DEFINE MANIFEST PATHS
    // ------------------------------------------
    // We import the Root Manifest which points to all others
    const manifestPath = path.join(
      process.cwd(),
      "src/db/seeds/00_system/manifest.json",
    );

    console.log(`📂 Step 2: Loading Manifest from: ${manifestPath}`);

    // ------------------------------------------
    // STEP 3: EXECUTE IMPORT
    // ------------------------------------------
    // The 'importWithLogging' function handles:
    //   - Loading the JSON files
    //   - Validating them against Zod schemas
    //   - Transactional Batch Inserts
    //   - Console Progress Bars
    console.log("🚀 Step 3: Importing Data...");

    const result = await importWithLogging(manifestPath, {
      onConflict: "update", // Update existing nodes if we re-run
      batchSize: 50, // Smaller batches for stability
      validateFirst: true, // Safety check
    });

    // ------------------------------------------
    // STEP 4: REPORT
    // ------------------------------------------
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(50));

    if (result.success) {
      console.log(`✨ SEEDING COMPLETE in ${duration}s`);
      console.log(
        `   - Nodes:    ${result.stats.nodes.imported} imported / ${result.stats.nodes.updated} updated`,
      );
      console.log(
        `   - Edges:    ${result.stats.edges.imported} imported / ${result.stats.edges.updated} updated`,
      );
      console.log(`   - Factions: ${result.stats.factions.imported} imported`);
    } else {
      console.error(`❌ SEEDING FAILED in ${duration}s`);
      console.error("Errors:");
      result.errors.forEach((e) => console.error(`   - ${e}`));
      if (result.validation?.errors) {
        console.error("Validation Errors:");
        result.validation.errors.forEach((e) =>
          console.error(`   - ${e.message} at ${e.path.join(".")}`),
        );
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 FATAL ERROR:", error);
    process.exit(1);
  } finally {
    // ------------------------------------------
    // CLEANUP
    // ------------------------------------------
    await closeClient();
    console.log("\n🔌 Database connection closed.");
  }
}

// Execute
main();
