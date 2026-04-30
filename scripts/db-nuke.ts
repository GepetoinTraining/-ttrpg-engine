/**
 * scripts/db-nuke.ts — drop every table defined in schema.ts.
 *
 * Per Pedro's 2026-04-30 directive ("we'll simply nuke 'drop tables' and
 * remake it from ground up then seed"). No real users, no migration to
 * preserve. Wipe is cleaner than incremental migrations across the 5+
 * pending schema reshapes.
 *
 * Usage:
 *   npm run db:nuke         # drop tables
 *   npm run db:push         # recreate from schema.ts
 *   npm run db:seed         # bootstrap world row + minimal data
 *
 * Or one-shot via:
 *   npm run db:reset        # nuke && push && seed
 *
 * SAFETY:
 *   - Refuses to run against a non-localhost / non-`file:` URL unless
 *     ALLOW_DESTRUCTIVE_DB=1 is set in env. Production wipes need explicit
 *     opt-in to prevent accidental Turso prod nukes.
 *   - Prints the table list and pauses 3s before executing.
 */

import { createClient } from '@libsql/client'
import { getTableName, isTable } from 'drizzle-orm'
import * as schema from '../src/db/schema'

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? 'file:local.db'
  const isLocal = url.startsWith('file:') || url.includes('localhost') || url.includes('127.0.0.1')

  if (!isLocal && process.env.ALLOW_DESTRUCTIVE_DB !== '1') {
    console.error(
      `❌ db-nuke: refusing to run against non-local URL "${url}" without ALLOW_DESTRUCTIVE_DB=1 env var.`,
    )
    process.exit(1)
  }

  // Collect every drizzle table exported from schema.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables: { exportName: string; tableName: string }[] = []
  for (const [exportName, value] of Object.entries(schema)) {
    if (value && typeof value === 'object' && isTable(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tables.push({ exportName, tableName: getTableName(value as any) })
    }
  }

  if (tables.length === 0) {
    console.error('❌ db-nuke: no tables found in schema.ts — refusing to proceed.')
    process.exit(1)
  }

  console.log(`db-nuke: target = ${url}`)
  console.log(`db-nuke: ${tables.length} tables to drop:`)
  for (const t of tables) console.log(`         • ${t.tableName}`)
  console.log('db-nuke: starting in 3s — Ctrl-C to abort...')
  await new Promise((r) => setTimeout(r, 3000))

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  try {
    // Disable FK enforcement for the duration of the wipe so drop order
    // doesn't matter.
    await client.execute('PRAGMA foreign_keys = OFF')

    let dropped = 0
    for (const t of tables) {
      try {
        await client.execute(`DROP TABLE IF EXISTS "${t.tableName}"`)
        dropped++
      } catch (e) {
        console.error(`  ✗ ${t.tableName}: ${(e as Error).message}`)
      }
    }

    await client.execute('PRAGMA foreign_keys = ON')

    console.log(`db-nuke: dropped ${dropped}/${tables.length} tables.`)
    console.log('db-nuke: next steps →')
    console.log('         npm run db:push     # recreate schema')
    console.log('         npm run db:seed     # bootstrap world row')
  } finally {
    client.close()
  }
}

main().catch((e) => {
  console.error('db-nuke: fatal:', e)
  process.exit(1)
})
