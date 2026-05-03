/**
 * Drops EVERY user table in the database, not just the ones currently
 * exported from schema.ts. Used when migrating across schema reshapes
 * where old tables aren't in the new schema.
 *
 * Same safety gate as db-nuke.ts: refuses non-local URLs without
 * ALLOW_DESTRUCTIVE_DB=1.
 */
import { createClient } from '@libsql/client'

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? 'file:local.db'
  const isLocal = url.startsWith('file:') || url.includes('localhost') || url.includes('127.0.0.1')

  if (!isLocal && process.env.ALLOW_DESTRUCTIVE_DB !== '1') {
    console.error(`db-nuke-all: refusing non-local URL "${url}" without ALLOW_DESTRUCTIVE_DB=1.`)
    process.exit(1)
  }

  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })

  try {
    const list = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%'`,
    )
    const tables = list.rows.map((r: any) => String(r.name))
    console.log(`db-nuke-all: found ${tables.length} tables`)
    for (const t of tables) console.log(`         • ${t}`)
    if (tables.length === 0) {
      console.log('db-nuke-all: nothing to drop.')
      return
    }
    console.log('db-nuke-all: starting in 3s — Ctrl-C to abort...')
    await new Promise((r) => setTimeout(r, 3000))

    await client.execute('PRAGMA foreign_keys = OFF')
    let dropped = 0
    for (const t of tables) {
      try {
        await client.execute(`DROP TABLE IF EXISTS "${t}"`)
        dropped++
      } catch (e) {
        console.error(`  ✗ ${t}: ${(e as Error).message}`)
      }
    }
    await client.execute('PRAGMA foreign_keys = ON')
    console.log(`db-nuke-all: dropped ${dropped}/${tables.length} tables.`)
  } finally {
    client.close()
  }
}

main().catch((e) => {
  console.error('db-nuke-all: fatal:', e)
  process.exit(1)
})
