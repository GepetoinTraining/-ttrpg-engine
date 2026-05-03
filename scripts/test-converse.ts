/**
 * Smoke test for /api/npc/[id]/converse.
 *
 * Walks the full flow:
 *   1. Mint an account cert (POST /api/account/create with fake geo)
 *   2. List NPCs (with bearer)
 *   3. POST /api/npc/[firstNpc.id]/converse with a player question
 *   4. Print the response, model used, and cache stats
 *
 * Usage:
 *   npm run dev                 # in another terminal
 *   npx tsx scripts/test-converse.ts
 *
 * Required env (auto-loaded by Next dev from .env.local):
 *   ANTHROPIC_API_KEY  — must be set in the dev server's environment
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

interface AccountCert {
  id: string
  seed: string
}

interface NpcListItem {
  id: string
  name: string
}

async function jsonOrThrow(res: Response, label: string): Promise<any> {
  const text = await res.text()
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { rawText: text }
  }
  if (!res.ok) {
    throw new Error(`${label} ${res.status}: ${JSON.stringify(parsed).slice(0, 400)}`)
  }
  return parsed
}

async function main() {
  console.log(`→ minting account at ${BASE}/api/account/create`)
  const mintRes = await fetch(`${BASE}/api/account/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ geo: { lat: -23.5505, lon: -46.6333 } }), // São Paulo
  })
  const cert = (await jsonOrThrow(mintRes, 'account.create')) as AccountCert
  console.log(`  account ${cert.id.slice(0, 12)}…`)

  const bearer = `Bearer ${cert.id}:${cert.seed}`

  console.log(`→ listing NPCs`)
  const listRes = await fetch(`${BASE}/api/npc/list`, { headers: { authorization: bearer } })
  const list = (await jsonOrThrow(listRes, 'npc.list')) as { npcs: NpcListItem[] }
  if (!list.npcs || list.npcs.length === 0) {
    throw new Error('no NPCs in DB — run npm run db:seed first')
  }
  const target = list.npcs[0]
  console.log(`  picked ${target.name} (${target.id})`)

  const question = 'What can you tell me about your work?'

  console.log(`→ first converse: "${question}"`)
  const t1 = Date.now()
  const r1 = await fetch(`${BASE}/api/npc/${encodeURIComponent(target.id)}/converse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: bearer },
    body: JSON.stringify({ question, speakerName: 'Kaelith' }),
  })
  const out1 = await jsonOrThrow(r1, 'converse#1')
  console.log(`  model: ${out1.model}  partyBound: ${out1.partyBound}  ${Date.now() - t1}ms`)
  console.log(`  ${target.name}: "${out1.text}"`)
  console.log(`  usage: input=${out1.receipt.usage.input_tokens} output=${out1.receipt.usage.output_tokens} cache_create=${out1.receipt.usage.cache_creation_input_tokens ?? 0} cache_read=${out1.receipt.usage.cache_read_input_tokens ?? 0}`)

  // Second turn — same NPC, different question. System prompt is the same → expect cache_read > 0.
  const question2 = 'And how long have you lived here?'
  console.log(`→ second converse (same NPC, expect cache hit): "${question2}"`)
  const t2 = Date.now()
  const r2 = await fetch(`${BASE}/api/npc/${encodeURIComponent(target.id)}/converse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: bearer },
    body: JSON.stringify({ question: question2, speakerName: 'Kaelith' }),
  })
  const out2 = await jsonOrThrow(r2, 'converse#2')
  console.log(`  model: ${out2.model}  ${Date.now() - t2}ms`)
  console.log(`  ${target.name}: "${out2.text}"`)
  console.log(`  usage: input=${out2.receipt.usage.input_tokens} output=${out2.receipt.usage.output_tokens} cache_create=${out2.receipt.usage.cache_creation_input_tokens ?? 0} cache_read=${out2.receipt.usage.cache_read_input_tokens ?? 0}`)

  if ((out2.receipt.usage.cache_read_input_tokens ?? 0) > 0) {
    console.log(`✓ prompt caching working (cache_read > 0 on second call)`)
  } else {
    console.log(`⚠ no cache hit on second call — system prompt may have varied, or below 1024-token threshold`)
  }
}

main().catch((e) => {
  console.error('test-converse: fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
