/**
 * src/db/seeds/bootstrap.ts — minimal post-nuke seed.
 *
 * Per Pedro's 2026-04-30 nuke-and-seed directive:
 *   - World content is deterministic from seeds; the database starts
 *     empty except for a single `worlds` row. Players mint their own
 *     accounts/characters via the create-account flow.
 *   - The TP graph is built in-memory by `src/lib/world-state.ts` from
 *     hardcoded node data, so no `world_regions` rows are needed for v1.
 *   - This file is intentionally TINY — keeping the reset path fast.
 *
 * Run via `npm run db:seed` after `db:nuke && db:push`.
 */

import { db } from '../connection'
import { worlds } from '../schema'

const DEFAULT_WORLD_ID = 'default'

export async function bootstrap(): Promise<void> {
  const seed = Math.floor(Math.random() * 2147483647)
  const now = new Date().toISOString()

  // Singleton `worlds` row. The world starts at day 0 with the party
  // staged at Suzail (matches `src/lib/world-state.ts` `buildDefaultTp()`).
  await db.insert(worlds).values({
    id: DEFAULT_WORLD_ID,
    name: 'Toril (default)',
    type: 'custom',
    seed,
    currentDay: 0,
    createdAt: now,
    lastCronAt: null,
    partyNodeId: 'suzail',
  }).onConflictDoNothing()

  console.log(`bootstrap: worlds row "${DEFAULT_WORLD_ID}" inserted (seed=${seed})`)
}
