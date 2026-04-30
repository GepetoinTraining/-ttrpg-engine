import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/connection'
import {
  commodityPrices,
  commodityCatalog,
  merchants,
  caravans,
} from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

/**
 * GET /api/market/:settlementId — price snapshot + merchants + in-flight caravans.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ settlementId: string }> }
) {
  try {
    const { settlementId } = await ctx.params

    const priceRows = await db
      .select({
        id: commodityPrices.id,
        commodityId: commodityPrices.commodityId,
        price: commodityPrices.price,
        supply: commodityPrices.supply,
        demand: commodityPrices.demand,
        commodityName: commodityCatalog.name,
        category: commodityCatalog.category,
        basePrice: commodityCatalog.basePrice,
        unit: commodityCatalog.unit,
      })
      .from(commodityPrices)
      .leftJoin(commodityCatalog, sql`${commodityCatalog.id} = ${commodityPrices.commodityId}`)
      .where(eq(commodityPrices.settlementId, settlementId))

    const merchantRows = await db
      .select()
      .from(merchants)
      .where(eq(merchants.settlementId, settlementId))

    // Caravans don't reference settlement directly — reference an edge. Skip for now,
    // return all caravans in transit as a coarse snapshot.
    const caravanRows = await db
      .select()
      .from(caravans)
      .where(eq(caravans.status, 'en_route'))

    return NextResponse.json({
      prices: priceRows.map((p) => ({
        id: p.id,
        commodity: p.commodityName ?? '?',
        category: p.category,
        unit: p.unit,
        basePrice: p.basePrice,
        currentPrice: p.price,
        priceDeltaPct: p.basePrice ? ((p.price - p.basePrice) / p.basePrice) * 100 : 0,
        supply: p.supply,
        demand: p.demand,
      })),
      merchants: merchantRows.map((m) => ({
        id: m.id,
        name: m.name,
        tier: m.tier,
        specialization: m.specialization,
        reputation: m.reputation,
        capital: m.capital,
      })),
      caravansInFlight: caravanRows.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'market load failed' }, { status: 500 })
  }
}
