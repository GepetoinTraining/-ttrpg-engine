import { runMigrations } from "./migrations";

async function main() {
  console.log("🚀 Running migrations...\n");

  const result = await runMigrations();

  if (result.success) {
    console.log("✅ Migrations completed successfully!\n");
    console.log(`📦 Tables created (${result.tablesCreated.length}):`);
    result.tablesCreated.forEach(table => console.log(`   - ${table}`));
  } else {
    console.error("❌ Migration errors:\n");
    result.errors.forEach(err => console.error(`   ${err}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error("💥 Migration failed:", err);
  process.exit(1);
});
