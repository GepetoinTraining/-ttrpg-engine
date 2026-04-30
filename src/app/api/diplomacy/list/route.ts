import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { factionRelations, socialContracts, factions, wikiArticles } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/diplomacy/list
 *
 * Returns the three Diplomacy tabs in one shot:
 *   - factions (label dictionary)
 *   - factionRelations (treaty matrix: stance + trust per pair)
 *   - socialContracts (active contracts inbox)
 *   - wikiArticles WHERE articleType='intel_brief' (briefings; reuse wiki, no new schema)
 */
export async function GET(_req: NextRequest) {
  try {
    const [factionRows, relationRows, contractRows, briefingRows] = await Promise.all([
      db.select().from(factions),
      db.select().from(factionRelations),
      db.select().from(socialContracts).where(eq(socialContracts.status, 'active')),
      db.select().from(wikiArticles).where(eq(wikiArticles.articleType, 'intel_brief')).orderBy(desc(wikiArticles.worldDay)).limit(50),
    ])

    return NextResponse.json({
      factions: factionRows,
      relations: relationRows,
      contracts: contractRows.map((c) => ({
        id: c.id,
        type: c.type,
        partyA: c.partyA,
        partyB: c.partyB,
        status: c.status,
        terms: c.termsJson ? JSON.parse(c.termsJson) : null,
        worldDay: c.worldDay,
      })),
      briefings: briefingRows.map((b) => ({
        id: b.id,
        title: b.title,
        content: b.content,
        reliability: b.depthOfKnowledge,
        worldDay: b.worldDay,
        observerId: b.observerId,
      })),
      counts: {
        factions: factionRows.length,
        relations: relationRows.length,
        contracts: contractRows.length,
        briefings: briefingRows.length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'diplomacy load failed' }, { status: 500 })
  }
}
