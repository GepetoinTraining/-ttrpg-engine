import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import { wikiArticles } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'

/**
 * GET /api/wiki/list?type=lore&nodeId=X&limit=N
 *
 * Reads wiki_articles. The Lore surface and Diplomacy briefings tab both
 * sit on this table — Lore filters articleType='lore', Diplomacy filters
 * articleType='intel_brief'. The depthOfKnowledge column doubles as the
 * source-reliability indicator for briefings.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type')
    const nodeId = url.searchParams.get('nodeId')
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? 100))

    const filters: any[] = []
    if (type) filters.push(eq(wikiArticles.articleType, type))
    if (nodeId) filters.push(eq(wikiArticles.nodeId, nodeId))

    let q: any = db.select().from(wikiArticles)
    if (filters.length === 1) q = q.where(filters[0])
    else if (filters.length > 1) q = q.where(and(...filters))
    const rows = await q.orderBy(desc(wikiArticles.worldDay)).limit(limit)

    return NextResponse.json({
      articles: rows.map((r: any) => ({
        id: r.id,
        nodeId: r.nodeId,
        worldDay: r.worldDay,
        articleType: r.articleType,
        title: r.title,
        content: r.content,
        depthOfKnowledge: r.depthOfKnowledge,
        supersedesId: r.supersedesId,
        observerId: r.observerId,
      })),
      total: rows.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'wiki list failed' }, { status: 500 })
  }
}
