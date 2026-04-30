/**
 * MARKET ENGINE — Shops, Merchants, Price Discovery
 * =====================================================
 *
 * Merchants CLIMB THE LADDER:
 *   peddler → stall → shop → emporium → trading_house → consortium
 *
 * Every settlement has a market. Markets:
 *   - Contain venues (carts, stalls, shops, emporiums)
 *   - Run weekly price discovery (supply/demand → prices)
 *   - Simulate merchant AI decisions
 *   - Generate market events (shortages, festivals, bubbles)
 *
 * TICK INTEGRATION:
 *   Weekly: price discovery, merchant decisions, event generation
 *   On event: price shocks, festival demand, military requisition
 */

// ============================================================
// MERCHANT TIERS — The ladder every merchant climbs
// ============================================================

export type MerchantTier =
  | 'peddler'       // Wandering seller, no fixed location
  | 'stall'         // Market stall, rents space
  | 'shop'          // Owns a building, specialized
  | 'emporium'      // Large shop, multiple product lines
  | 'trading_house'  // Bulk buying/selling, routes
  | 'consortium'    // Multiple trading houses, regional

export interface TierRequirements {
  minCapital: number
  minReputation: number
  employees: number
  typicalMargin: number
}

export const TIER_REQUIREMENTS: Record<MerchantTier, TierRequirements> = {
  peddler:       { minCapital: 10,    minReputation: 0,  employees: 0,   typicalMargin: 0.30 },
  stall:         { minCapital: 100,   minReputation: 10, employees: 0,   typicalMargin: 0.25 },
  shop:          { minCapital: 500,   minReputation: 25, employees: 1,   typicalMargin: 0.20 },
  emporium:      { minCapital: 2000,  minReputation: 50, employees: 5,   typicalMargin: 0.15 },
  trading_house: { minCapital: 10000, minReputation: 70, employees: 20,  typicalMargin: 0.10 },
  consortium:    { minCapital: 50000, minReputation: 85, employees: 100, typicalMargin: 0.08 },
}

const TIER_ORDER: MerchantTier[] = ['peddler', 'stall', 'shop', 'emporium', 'trading_house', 'consortium']

// ============================================================
// MERCHANT SPECIALIZATIONS — 18 specialties
// ============================================================

export type MerchantSpecialization =
  | 'grocer' | 'clothier' | 'armorer' | 'apothecary'
  | 'jeweler' | 'bookseller' | 'chandler' | 'vintner'
  | 'spice_merchant' | 'furrier' | 'curiosities'
  | 'general_goods' | 'luxury_goods' | 'adventuring_supplies'
  | 'moneychanger' | 'pawnbroker' | 'fence'
  | 'commodities'

export const SPECIALIZATION_GOODS: Record<MerchantSpecialization, string[]> = {
  grocer:               ['grain', 'meat', 'fish', 'produce', 'salt'],
  clothier:             ['cloth', 'silk', 'wool', 'dyes', 'clothing'],
  armorer:              ['weapons', 'armor', 'shields', 'ammunition'],
  apothecary:           ['herbs', 'potions', 'medicine', 'magic_components'],
  jeweler:              ['gems', 'jewelry', 'precious_metals'],
  bookseller:           ['books', 'scrolls', 'maps', 'ink'],
  chandler:             ['candles', 'soap', 'oil', 'wax', 'tallow'],
  vintner:              ['wine', 'ale', 'spirits', 'mead'],
  spice_merchant:       ['spices', 'exotic_herbs', 'incense', 'perfume'],
  furrier:              ['furs', 'leather', 'hides', 'pelts'],
  curiosities:          ['exotic', 'artifacts', 'rarities'],
  general_goods:        ['*'],
  luxury_goods:         ['silk', 'spices', 'jewelry', 'wine', 'art'],
  adventuring_supplies: ['weapons', 'armor', 'potions', 'rations', 'rope', 'tools'],
  moneychanger:         ['currency', 'gems', 'letters_of_credit'],
  pawnbroker:           ['*'],
  fence:                ['*'],
  commodities:          ['grain', 'timber', 'ore', 'iron', 'cloth', 'leather'],
}

// ============================================================
// VENUE — Where merchants sell from
// ============================================================

export type VenueType =
  | 'cart' | 'stall' | 'tent'
  | 'shop' | 'workshop_shop' | 'emporium' | 'warehouse_outlet'
  | 'auction_house' | 'exchange' | 'bazaar_stall'
  | 'guild_hall' | 'temple_market' | 'black_market'

export interface Venue {
  id: string
  name: string
  type: VenueType
  hubId: string
  districtId?: string
  ownerId?: string
  rentCostWeekly: number
  displayCapacity: number
  storageCapacity: number
  customerCapacity: number
  status: 'open' | 'closed' | 'for_rent' | 'condemned'
}

export function createVenue(
  name: string,
  type: VenueType,
  hubId: string,
  overrides: Partial<Venue> = {},
): Venue {
  const defaults: Record<VenueType, { display: number; storage: number; customers: number; rent: number }> = {
    cart:             { display: 10,  storage: 5,    customers: 3,   rent: 0 },
    stall:            { display: 20,  storage: 10,   customers: 5,   rent: 5 },
    tent:             { display: 30,  storage: 20,   customers: 8,   rent: 3 },
    shop:             { display: 50,  storage: 40,   customers: 10,  rent: 15 },
    workshop_shop:    { display: 30,  storage: 50,   customers: 5,   rent: 20 },
    emporium:         { display: 200, storage: 200,  customers: 30,  rent: 50 },
    warehouse_outlet: { display: 100, storage: 500,  customers: 15,  rent: 40 },
    auction_house:    { display: 50,  storage: 100,  customers: 50,  rent: 60 },
    exchange:         { display: 0,   storage: 0,    customers: 20,  rent: 100 },
    bazaar_stall:     { display: 25,  storage: 15,   customers: 8,   rent: 8 },
    guild_hall:       { display: 40,  storage: 60,   customers: 15,  rent: 0 },
    temple_market:    { display: 30,  storage: 40,   customers: 10,  rent: 0 },
    black_market:     { display: 15,  storage: 30,   customers: 5,   rent: 0 },
  }
  const d = defaults[type]
  return {
    id: `venue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, type, hubId,
    rentCostWeekly: d.rent,
    displayCapacity: d.display,
    storageCapacity: d.storage,
    customerCapacity: d.customers,
    status: 'open',
    ...overrides,
  }
}

// ============================================================
// MERCHANT — The NPC who sells things
// ============================================================

export interface InventorySlot {
  commodityId: string
  quantity: number
  purchasePrice: number
  quality: 'poor' | 'common' | 'good' | 'excellent' | 'masterwork'
}

export interface Merchant {
  id: string
  npcId?: string
  name: string
  tier: MerchantTier
  specialization: MerchantSpecialization
  hubId: string
  venueId?: string
  capital: number
  inventory: InventorySlot[]
  reputation: number   // 0-100
  weeklyRevenue: number
  weeklyExpenses: number
  personality: {
    greed: number      // 0-1 how hard they bargain
    patience: number   // 0-1 rounds before walking away
    honesty: number    // 0-1 will they cheat?
    risk: number       // 0-1 speculative behavior
  }
  employeeCount: number
  goal: 'survive' | 'grow' | 'specialize' | 'diversify' | 'upgrade_tier' | 'retire'
  status: 'operating' | 'closed' | 'bankrupt' | 'traveling'
}

export function createMerchant(
  name: string,
  hubId: string,
  specialization: MerchantSpecialization,
  overrides: Partial<Merchant> = {},
): Merchant {
  return {
    id: `merch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, hubId, specialization,
    tier: 'peddler',
    capital: 10,
    inventory: [],
    reputation: 0,
    weeklyRevenue: 0,
    weeklyExpenses: 0,
    personality: { greed: 0.5, patience: 0.5, honesty: 0.7, risk: 0.3 },
    employeeCount: 0,
    goal: 'grow',
    status: 'operating',
    ...overrides,
  }
}

// ============================================================
// PRICE DISCOVERY — Supply/demand → price
// ============================================================

export interface CommodityPrice {
  commodityId: string
  basePrice: number
  currentPrice: number
  supply: number
  demand: number
  trend: 'crashing' | 'falling' | 'stable' | 'rising' | 'spiking'
  available: boolean
}

export interface PriceDiscoveryResult {
  commodityId: string
  previousPrice: number
  newPrice: number
  trend: CommodityPrice['trend']
  supplyDemandRatio: number
  factors: { name: string; impact: number }[]
}

/**
 * Core price discovery: supply/demand ratio → price multiplier.
 *
 * ratio ≥ 3.0  →  ×0.25 (glut)
 * ratio ≥ 2.0  →  ×0.40
 * ratio ≥ 1.5  →  ×0.70
 * ratio ≥ 0.8  →  ×1.00 (balanced)
 * ratio ≥ 0.5  →  ×1.50 (shortage)
 * ratio ≥ 0.25 →  ×2.50 (severe)
 * ratio < 0.25 →  ×4.00 (critical)
 *
 * Plus: event modifiers, regulation floors/ceilings, tax.
 */
export function discoverPrice(
  commodityId: string,
  basePrice: number,
  supply: number,
  demand: number,
  eventModifier: number = 1.0,
  regulations: { priceFloor?: number; priceCeiling?: number; taxRate?: number } = {},
): PriceDiscoveryResult {
  const factors: PriceDiscoveryResult['factors'] = []
  const ratio = demand > 0 ? supply / demand : 2

  // Supply/demand multiplier
  let sdMult: number
  if (ratio >= 3.0)      { sdMult = 0.25; factors.push({ name: 'Massive Oversupply', impact: -0.75 }) }
  else if (ratio >= 2.0) { sdMult = 0.40; factors.push({ name: 'Oversupply', impact: -0.60 }) }
  else if (ratio >= 1.5) { sdMult = 0.70; factors.push({ name: 'Surplus', impact: -0.30 }) }
  else if (ratio >= 0.8) { sdMult = 1.00; factors.push({ name: 'Balanced', impact: 0 }) }
  else if (ratio >= 0.5) { sdMult = 1.50; factors.push({ name: 'Shortage', impact: 0.50 }) }
  else if (ratio >= 0.25) { sdMult = 2.50; factors.push({ name: 'Severe Shortage', impact: 1.50 }) }
  else                    { sdMult = 4.00; factors.push({ name: 'Critical Shortage', impact: 3.00 }) }

  let price = basePrice * sdMult

  // Event modifier
  if (eventModifier !== 1.0) {
    price *= eventModifier
    factors.push({ name: 'Market Event', impact: eventModifier - 1 })
  }

  // Regulations
  if (regulations.priceFloor && price < regulations.priceFloor) {
    factors.push({ name: 'Price Floor', impact: (regulations.priceFloor - price) / price })
    price = regulations.priceFloor
  }
  if (regulations.priceCeiling && price > regulations.priceCeiling) {
    factors.push({ name: 'Price Ceiling', impact: (regulations.priceCeiling - price) / price })
    price = regulations.priceCeiling
  }
  if (regulations.taxRate) {
    price *= (1 + regulations.taxRate)
    factors.push({ name: 'Tax', impact: regulations.taxRate })
  }

  price = Math.round(price * 100) / 100

  const changePercent = basePrice > 0 ? ((price - basePrice) / basePrice) * 100 : 0
  let trend: CommodityPrice['trend']
  if (changePercent <= -20) trend = 'crashing'
  else if (changePercent <= -5) trend = 'falling'
  else if (changePercent >= 20) trend = 'spiking'
  else if (changePercent >= 5) trend = 'rising'
  else trend = 'stable'

  return { commodityId, previousPrice: basePrice, newPrice: price, trend, supplyDemandRatio: ratio, factors }
}

// ============================================================
// HAGGLING — d20 persuasion vs seller resistance
// ============================================================

export function calculateSellerResistance(merchant: Merchant): number {
  let dc = 10
  dc += Math.floor(merchant.personality.greed * 10)  // 0-10
  if (merchant.personality.patience < 0.3) dc += 2    // Impatient
  dc -= Math.floor(merchant.reputation / 25)           // Rep helps at all tiers
  return Math.max(5, Math.min(25, dc))
}

export interface HaggleResult {
  success: boolean
  discount: number
  finalPrice: number
  response: string
}

export function resolveHaggle(
  merchant: Merchant,
  askingPrice: number,
  d20Roll: number,
  persuasionBonus: number,
  buyerReputation: number = 0,
): HaggleResult {
  const dc = calculateSellerResistance(merchant) - Math.floor(buyerReputation / 25)
  const total = d20Roll + persuasionBonus
  const margin = total - dc

  let discount: number
  let response: string

  if (d20Roll === 20) {
    discount = 0.20 + Math.max(0, margin * 0.01)
    response = 'You drive a hard bargain! Fine, take it.'
  } else if (d20Roll === 1) {
    discount = -0.10
    response = 'Are you trying to insult me? The price just went up!'
  } else if (margin >= 10) {
    discount = 0.15
    response = 'Alright, you win this round.'
  } else if (margin >= 5) {
    discount = 0.10
    response = "I can come down a little..."
  } else if (margin >= 0) {
    discount = 0.05
    response = "You're persistent, I'll give you that."
  } else {
    discount = 0
    response = 'The price is fair as is.'
  }

  const finalPrice = Math.round(askingPrice * (1 - discount) * 100) / 100

  return { success: discount > 0, discount, finalPrice, response }
}

// ============================================================
// MERCHANT AI — Weekly decision-making
// ============================================================

export type MerchantDecisionType =
  | 'restock' | 'liquidate' | 'upgrade_tier' | 'hire' | 'fire' | 'nothing'

export interface MerchantDecision {
  merchantId: string
  type: MerchantDecisionType
  detail: string
  commodityId?: string
  quantity?: number
}

export function canUpgradeTier(merchant: Merchant): { canUpgrade: boolean; nextTier: MerchantTier | null } {
  const idx = TIER_ORDER.indexOf(merchant.tier)
  if (idx >= TIER_ORDER.length - 1) return { canUpgrade: false, nextTier: null }

  const nextTier = TIER_ORDER[idx + 1]
  const reqs = TIER_REQUIREMENTS[nextTier]

  const canUpgrade =
    merchant.capital >= reqs.minCapital &&
    merchant.reputation >= reqs.minReputation &&
    merchant.employeeCount >= reqs.employees

  return { canUpgrade, nextTier }
}

/**
 * Simulate a merchant's weekly decision.
 * Priority: survive → restock → upgrade → hire → nothing.
 */
export function simulateMerchantDecision(
  merchant: Merchant,
  prices: Record<string, CommodityPrice>,
  weeklyOperatingCost: number,
): MerchantDecision {
  // 1. SURVIVAL — liquidate if broke
  if (merchant.capital < weeklyOperatingCost * 2) {
    const mostValuable = merchant.inventory
      .filter(s => s.quantity > 0)
      .sort((a, b) => (b.quantity * (prices[b.commodityId]?.currentPrice || 0)) -
                       (a.quantity * (prices[a.commodityId]?.currentPrice || 0)))[0]

    if (mostValuable) {
      return {
        merchantId: merchant.id,
        type: 'liquidate',
        detail: `Liquidating ${mostValuable.commodityId} to survive`,
        commodityId: mostValuable.commodityId,
        quantity: Math.ceil(mostValuable.quantity * 0.5),
      }
    }
  }

  // 2. RESTOCK — if any goods below 30% optimal
  const goods = SPECIALIZATION_GOODS[merchant.specialization] || []
  for (const commodityId of goods) {
    if (commodityId === '*') continue
    const priceData = prices[commodityId]
    if (!priceData || !priceData.available) continue
    const stock = merchant.inventory.find(s => s.commodityId === commodityId)
    const optimal = getOptimalStock(merchant.tier)
    const current = stock?.quantity || 0
    if (current < optimal * 0.3) {
      const buyQty = Math.min(
        optimal - current,
        Math.floor((merchant.capital * 0.3) / priceData.currentPrice),
      )
      if (buyQty > 0 && priceData.trend !== 'spiking') {
        return {
          merchantId: merchant.id,
          type: 'restock',
          detail: `Restocking ${commodityId}: ${current}/${optimal}`,
          commodityId,
          quantity: buyQty,
        }
      }
    }
  }

  // 3. UPGRADE TIER
  if (merchant.goal === 'upgrade_tier' || merchant.goal === 'grow') {
    const { canUpgrade, nextTier } = canUpgradeTier(merchant)
    if (canUpgrade && nextTier) {
      return {
        merchantId: merchant.id,
        type: 'upgrade_tier',
        detail: `Upgrading to ${nextTier}`,
      }
    }
  }

  // 4. STAFFING
  const reqs = TIER_REQUIREMENTS[merchant.tier]
  if (merchant.employeeCount < reqs.employees && merchant.capital > 10 * 12) {
    return { merchantId: merchant.id, type: 'hire', detail: 'Hiring staff to meet tier requirements' }
  }
  if (merchant.weeklyRevenue < merchant.weeklyExpenses && merchant.employeeCount > reqs.employees) {
    return { merchantId: merchant.id, type: 'fire', detail: 'Cutting staff to reduce costs' }
  }

  return { merchantId: merchant.id, type: 'nothing', detail: 'No action needed this week' }
}

function getOptimalStock(tier: MerchantTier): number {
  const m: Record<MerchantTier, number> = {
    peddler: 5, stall: 20, shop: 50, emporium: 200, trading_house: 1000, consortium: 5000,
  }
  return m[tier]
}

// ============================================================
// MARKET EVENT — Random occurrences that shake prices
// ============================================================

export type MarketEventType =
  | 'shipment_arrived' | 'shipment_delayed' | 'shipment_lost'
  | 'warehouse_fire' | 'spoilage'
  | 'festival_demand' | 'military_requisition' | 'noble_order'
  | 'price_war' | 'price_fixing'
  | 'new_merchant' | 'merchant_bankruptcy'
  | 'foreign_traders' | 'trade_fair' | 'embargo_effect'
  | 'black_market_crackdown'

export interface MarketEvent {
  id: string
  type: MarketEventType
  name: string
  description: string
  hubId: string
  affectedCommodities: string[]
  priceMultiplier: number        // 1.0 = no effect
  supplyMultiplier: number       // 1.0 = no effect
  demandMultiplier: number       // 1.0 = no effect
  durationWeeks: number
  weeksRemaining: number
  status: 'active' | 'resolved'
}

const EVENT_TEMPLATES: Record<MarketEventType, { name: string; priceMul: number; supplyMul: number; demandMul: number; weeks: number }> = {
  shipment_arrived:       { name: 'Large Shipment Arrives',     priceMul: 1.0, supplyMul: 1.5, demandMul: 1.0, weeks: 1 },
  shipment_delayed:       { name: 'Shipment Delayed',           priceMul: 1.0, supplyMul: 0.7, demandMul: 1.0, weeks: 2 },
  shipment_lost:          { name: 'Shipment Lost!',             priceMul: 1.0, supplyMul: 0.3, demandMul: 1.0, weeks: 4 },
  warehouse_fire:         { name: 'Warehouse Fire!',            priceMul: 1.0, supplyMul: 0.5, demandMul: 1.0, weeks: 2 },
  spoilage:               { name: 'Spoilage Outbreak',          priceMul: 1.0, supplyMul: 0.6, demandMul: 1.0, weeks: 1 },
  festival_demand:        { name: 'Festival Season',            priceMul: 1.0, supplyMul: 1.0, demandMul: 2.0, weeks: 1 },
  military_requisition:   { name: 'Military Requisition',       priceMul: 1.0, supplyMul: 1.0, demandMul: 3.0, weeks: 4 },
  noble_order:            { name: 'Noble Order',                priceMul: 1.0, supplyMul: 1.0, demandMul: 1.8, weeks: 3 },
  price_war:              { name: 'Price War',                  priceMul: 0.7, supplyMul: 1.0, demandMul: 1.0, weeks: 2 },
  price_fixing:           { name: 'Cartel Price Fixing',        priceMul: 1.4, supplyMul: 1.0, demandMul: 1.0, weeks: 8 },
  new_merchant:           { name: 'New Merchant in Town',       priceMul: 1.0, supplyMul: 1.1, demandMul: 1.0, weeks: 1 },
  merchant_bankruptcy:    { name: 'Merchant Bankruptcy',        priceMul: 0.8, supplyMul: 1.3, demandMul: 1.0, weeks: 1 },
  foreign_traders:        { name: 'Foreign Traders Arrive',     priceMul: 1.0, supplyMul: 2.0, demandMul: 1.0, weeks: 2 },
  trade_fair:             { name: 'Trade Fair',                 priceMul: 0.9, supplyMul: 1.5, demandMul: 1.5, weeks: 1 },
  embargo_effect:         { name: 'Trade Embargo',              priceMul: 1.0, supplyMul: 0.4, demandMul: 1.0, weeks: 8 },
  black_market_crackdown: { name: 'Black Market Crackdown',     priceMul: 1.0, supplyMul: 0.3, demandMul: 0.5, weeks: 4 },
}

export function createMarketEvent(
  type: MarketEventType,
  hubId: string,
  affectedCommodities: string[],
): MarketEvent {
  const t = EVENT_TEMPLATES[type]
  return {
    id: `mevt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type, name: t.name, description: `${t.name} affecting ${affectedCommodities.join(', ') || 'the market'}`,
    hubId, affectedCommodities,
    priceMultiplier: t.priceMul, supplyMultiplier: t.supplyMul, demandMultiplier: t.demandMul,
    durationWeeks: t.weeks, weeksRemaining: t.weeks,
    status: 'active',
  }
}

// ============================================================
// SETTLEMENT MARKET — Complete market state
// ============================================================

export interface SettlementMarket {
  hubId: string
  prices: Record<string, CommodityPrice>
  merchants: Merchant[]
  venues: Venue[]
  activeEvents: MarketEvent[]
  taxRate: number
}

export function createSettlementMarket(hubId: string, taxRate: number = 0.05): SettlementMarket {
  return { hubId, prices: {}, merchants: [], venues: [], activeEvents: [], taxRate }
}

// ============================================================
// WEEKLY MARKET TICK
// ============================================================

export interface MarketTickResult {
  priceChanges: PriceDiscoveryResult[]
  merchantDecisions: MerchantDecision[]
  newEvents: MarketEvent[]
  resolvedEvents: string[]
  bankruptcies: string[]
}

/**
 * The weekly heartbeat of the economy at a hub.
 *
 * 1. Tick down active events
 * 2. Calculate aggregate event modifiers per commodity
 * 3. Run price discovery for every commodity
 * 4. Simulate merchant decisions
 * 5. Detect bankruptcies
 */
export function weeklyMarketTick(
  market: SettlementMarket,
  d20Roll: number = Math.floor(Math.random() * 20) + 1,
): MarketTickResult {
  const result: MarketTickResult = {
    priceChanges: [],
    merchantDecisions: [],
    newEvents: [],
    resolvedEvents: [],
    bankruptcies: [],
  }

  // Phase 1: Tick events
  for (const event of market.activeEvents) {
    if (event.status !== 'active') continue
    event.weeksRemaining--
    if (event.weeksRemaining <= 0) {
      event.status = 'resolved'
      result.resolvedEvents.push(event.id)
    }
  }

  // Phase 2: Price discovery
  for (const [commodityId, priceData] of Object.entries(market.prices)) {
    // Aggregate event modifiers for this commodity
    let eventMod = 1.0
    let adjustedSupply = priceData.supply
    let adjustedDemand = priceData.demand

    for (const event of market.activeEvents) {
      if (event.status !== 'active') continue
      if (event.affectedCommodities.length === 0 || event.affectedCommodities.includes(commodityId)) {
        eventMod *= event.priceMultiplier
        adjustedSupply = Math.round(adjustedSupply * event.supplyMultiplier)
        adjustedDemand = Math.round(adjustedDemand * event.demandMultiplier)
      }
    }

    const discovery = discoverPrice(
      commodityId,
      priceData.basePrice,
      adjustedSupply,
      adjustedDemand,
      eventMod,
      { taxRate: market.taxRate },
    )

    result.priceChanges.push(discovery)

    // Update market state
    priceData.currentPrice = discovery.newPrice
    priceData.trend = discovery.trend
  }

  // Phase 3: Merchant decisions
  const weeklyRent = (merchant: Merchant) => {
    const venue = market.venues.find(v => v.id === merchant.venueId)
    return (venue?.rentCostWeekly || 0) + merchant.employeeCount * 10
  }

  for (const merchant of market.merchants) {
    if (merchant.status !== 'operating') continue

    const decision = simulateMerchantDecision(merchant, market.prices, weeklyRent(merchant))
    result.merchantDecisions.push(decision)

    // Apply decision effects
    if (decision.type === 'upgrade_tier') {
      const { nextTier } = canUpgradeTier(merchant)
      if (nextTier) merchant.tier = nextTier
    }
    if (decision.type === 'hire') merchant.employeeCount++
    if (decision.type === 'fire' && merchant.employeeCount > 0) merchant.employeeCount--

    // Deduct operating costs
    merchant.capital -= weeklyRent(merchant)
    if (merchant.capital < 0) {
      merchant.status = 'bankrupt'
      result.bankruptcies.push(merchant.id)
    }
  }

  // Phase 4: Random event generation (1-3 on d20 = event)
  if (d20Roll <= 3) {
    const eventTypes: MarketEventType[] = [
      'shipment_arrived', 'shipment_delayed', 'festival_demand',
      'new_merchant', 'foreign_traders', 'trade_fair',
    ]
    const type = eventTypes[d20Roll % eventTypes.length]
    const commodities = Object.keys(market.prices)
    const affected = commodities.length > 0 ? [commodities[d20Roll % commodities.length]] : []
    const event = createMarketEvent(type, market.hubId, affected)
    market.activeEvents.push(event)
    result.newEvents.push(event)
  }

  return result
}
