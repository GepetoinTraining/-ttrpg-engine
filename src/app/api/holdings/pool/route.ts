import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/holdings/pool?campaignId=…
 *
 * Returns the party shared pool — gold + items the PCs have transferred.
 * v1 placeholder: pool data lives in tpb_entries as writeKappa actions
 * with system='party-pool'. Aggregating them is a follow-up; for now
 * return an empty pool so the UI shells render cleanly.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const campaignId = url.searchParams.get('campaignId')

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  // TODO: aggregate from tpb_entries where action.system === 'party-pool:*'
  // and reconstruct the current pool state.
  return NextResponse.json({
    campaignId,
    goldGP: 0,
    items: [],
    contributors: [],
    notes: 'pool aggregation not yet wired — UIs render empty pool with structure intact',
  })
}
