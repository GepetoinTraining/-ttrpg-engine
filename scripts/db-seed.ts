/**
 * scripts/db-seed.ts — runs the post-nuke bootstrap seed.
 *
 * Run after `npm run db:push` to populate the minimum-viable rows so the
 * app boots and the user can mint an account.
 */

import { bootstrap } from '../src/db/seeds/bootstrap'

async function main() {
  console.log('db-seed: bootstrapping...')
  await bootstrap()
  console.log('db-seed: done.')
}

main().catch((e) => {
  console.error('db-seed: fatal:', e)
  process.exit(1)
})
