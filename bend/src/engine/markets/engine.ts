import {
  Merchant,
  MerchantTier,
  MarketVenue,
  MarketEvent,
  MarketEventType,
  SettlementMarketComplete,
  SpeculativePosition,
  MERCHANT_TIER_REQUIREMENTS,
  SPECIALIZATION_COMMODITIES,
  canUpgradeTier,
  calculateOperatingCosts,
} from "./schema";

// ============================================
// MARKET ENGINE
// ============================================
//
// The engine that makes markets LIVE:
//   - Price discovery from supply/demand
//   - Merchant AI (buy low, sell high, upgrade)
//   - Market events (shortages, gluts, bubbles)
//   - Speculation (smart NPCs bet on the future)
//

// ============================================
// PRICE DISCOVERY
// ============================================

export interface PriceDiscoveryResult {
  commodityId: string;
  previousPrice: number;
  newPrice: number;
  priceChange: number;
  priceChangePercent: number;
  trend: "crashing" | "falling" | "stable" | "rising" | "spiking";
  supply: number;
  demand: number;
  supplyDemandRatio: number;
  factors: Array<{
    name: string;
    impact: number;
    description: string;
  }>;
}

/**
 * Core price discovery algorithm.
 *
 * Price emerges from:
 *   1. Supply/demand ratio (fundamental)
 *   2. Market events (temporary shocks)
 *   3. Speculation (smart money betting)
 *   4. Regulations (floors/ceilings)
 *   5. Information asymmetry (stale prices)
 */
export function discoverPrice(
  commodityId: string,
  basePrice: number,
  supply: number,
  demand: number,
  activeEvents: MarketEvent[],
  speculativePositions: SpeculativePosition[],
  regulations: {
    priceFloor?: number;
    priceCeiling?: number;
    taxRate?: number;
  },
  volatility: number = 0.2,
): PriceDiscoveryResult {
  const factors: PriceDiscoveryResult["factors"] = [];
  let price = basePrice;

  // ─────────────────────────────────────────
  // 1. SUPPLY/DEMAND RATIO
  // ─────────────────────────────────────────

  const ratio = demand > 0 ? supply / demand : 2;
  let sdMultiplier: number;

  if (ratio >= 3) {
    // Massive glut
    sdMultiplier = 0.25;
    factors.push({
      name: "Massive Oversupply",
      impact: -0.75,
      description: `Supply (${supply}) is 3x+ demand (${demand})`,
    });
  } else if (ratio >= 2) {
    // Significant oversupply
    sdMultiplier = 0.4;
    factors.push({
      name: "Oversupply",
      impact: -0.6,
      description: `Supply exceeds demand 2:1`,
    });
  } else if (ratio >= 1.5) {
    // Mild oversupply
    sdMultiplier = 0.7;
    factors.push({
      name: "Surplus",
      impact: -0.3,
      description: `Supply exceeds demand`,
    });
  } else if (ratio >= 0.8) {
    // Balanced
    sdMultiplier = 1.0;
    factors.push({
      name: "Balanced Market",
      impact: 0,
      description: `Supply roughly matches demand`,
    });
  } else if (ratio >= 0.5) {
    // Shortage
    sdMultiplier = 1.5;
    factors.push({
      name: "Shortage",
      impact: 0.5,
      description: `Demand exceeds supply`,
    });
  } else if (ratio >= 0.25) {
    // Severe shortage
    sdMultiplier = 2.5;
    factors.push({
      name: "Severe Shortage",
      impact: 1.5,
      description: `Demand far exceeds supply`,
    });
  } else {
    // Critical shortage
    sdMultiplier = 4.0;
    factors.push({
      name: "Critical Shortage",
      impact: 3.0,
      description: `Almost no supply available`,
    });
  }

  price *= sdMultiplier;

  // ─────────────────────────────────────────
  // 2. MARKET EVENTS
  // ─────────────────────────────────────────

  for (const event of activeEvents) {
    if (event.status !== "active") continue;
    if (!event.affectedCommodities.includes(commodityId)) continue;

    for (const effect of event.effects) {
      if (effect.commodityId !== commodityId) continue;

      if (effect.type === "price") {
        if (effect.isMultiplier) {
          price *= effect.modifier;
        } else {
          price += effect.modifier;
        }
        factors.push({
          name: event.name,
          impact: effect.isMultiplier ? effect.modifier - 1 : effect.modifier / basePrice,
          description: event.description,
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // 3. SPECULATION PRESSURE
  // ─────────────────────────────────────────

  const relevantPositions = speculativePositions.filter(
    p => p.commodityId === commodityId && p.status === "open"
  );

  if (relevantPositions.length > 0) {
    let longVolume = 0;
    let shortVolume = 0;

    for (const pos of relevantPositions) {
      if (pos.positionType === "long") {
        longVolume += pos.quantity;
      } else {
        shortVolume += pos.quantity;
      }
    }

    // Net speculative pressure
    const netPressure = (longVolume - shortVolume) / Math.max(supply, 1);

    if (Math.abs(netPressure) > 0.1) {
      const specImpact = netPressure * 0.2;  // Speculation adds up to 20% pressure
      price *= (1 + specImpact);

      factors.push({
        name: "Speculative Pressure",
        impact: specImpact,
        description: netPressure > 0
          ? `Speculators betting on price rise`
          : `Speculators betting on price fall`,
      });
    }
  }

  // ─────────────────────────────────────────
  // 4. VOLATILITY (random noise)
  // ─────────────────────────────────────────

  const noise = (Math.random() - 0.5) * 2 * volatility * 0.1;
  price *= (1 + noise);

  // ─────────────────────────────────────────
  // 5. REGULATIONS
  // ─────────────────────────────────────────

  if (regulations.priceFloor && price < regulations.priceFloor) {
    factors.push({
      name: "Price Floor",
      impact: (regulations.priceFloor - price) / price,
      description: `Government minimum price: ${regulations.priceFloor}gp`,
    });
    price = regulations.priceFloor;
  }

  if (regulations.priceCeiling && price > regulations.priceCeiling) {
    factors.push({
      name: "Price Ceiling",
      impact: (regulations.priceCeiling - price) / price,
      description: `Government maximum price: ${regulations.priceCeiling}gp`,
    });
    price = regulations.priceCeiling;
  }

  if (regulations.taxRate && regulations.taxRate > 0) {
    price *= (1 + regulations.taxRate);
    factors.push({
      name: "Sales Tax",
      impact: regulations.taxRate,
      description: `${Math.round(regulations.taxRate * 100)}% tax applied`,
    });
  }

  // ─────────────────────────────────────────
  // FINALIZE
  // ─────────────────────────────────────────

  price = Math.round(price * 100) / 100;  // Round to copper
  const priceChange = price - basePrice;
  const priceChangePercent = basePrice > 0 ? (priceChange / basePrice) * 100 : 0;

  // Determine trend
  let trend: PriceDiscoveryResult["trend"];
  if (priceChangePercent <= -20) trend = "crashing";
  else if (priceChangePercent <= -5) trend = "falling";
  else if (priceChangePercent >= 20) trend = "spiking";
  else if (priceChangePercent >= 5) trend = "rising";
  else trend = "stable";

  return {
    commodityId,
    previousPrice: basePrice,
    newPrice: price,
    priceChange,
    priceChangePercent,
    trend,
    supply,
    demand,
    supplyDemandRatio: ratio,
    factors,
  };
}

// ============================================
// MERCHANT AI
// ============================================

export interface MerchantDecision {
  merchantId: string;
  decision:
    | { type: "buy"; commodityId: string; quantity: number; maxPrice: number }
    | { type: "sell"; commodityId: string; quantity: number; minPrice: number }
    | { type: "hold" }
    | { type: "upgrade_tier" }
    | { type: "hire"; role: string }
    | { type: "fire"; employeeId: string }
    | { type: "relocate"; venueId: string }
    | { type: "speculate"; commodityId: string; direction: "long" | "short"; amount: number }
    | { type: "close_position"; positionId: string }
    | { type: "nothing" };
  reasoning: string;
}

/**
 * Simulate a merchant's weekly decision.
 * Merchants try to:
 *   1. Maintain profitable inventory
 *   2. Avoid stockouts
 *   3. Progress to next tier
 *   4. React to market conditions
 */
export function simulateMerchantDecision(
  merchant: Merchant,
  market: SettlementMarketComplete,
  _venue: MarketVenue | undefined,
  weeklyOperatingCosts: number,
): MerchantDecision {
  const decisions: MerchantDecision[] = [];

  // ─────────────────────────────────────────
  // 1. SURVIVAL CHECK
  // ─────────────────────────────────────────

  if (merchant.capital < weeklyOperatingCosts * 2) {
    // Desperate - need to sell inventory
    const mostValuable = merchant.inventory
      .sort((a, b) => (b.quantity * market.prices[b.commodityId]?.currentPrice || 0) -
                       (a.quantity * market.prices[a.commodityId]?.currentPrice || 0))[0];

    if (mostValuable && mostValuable.quantity > 0) {
      return {
        merchantId: merchant.id,
        decision: {
          type: "sell",
          commodityId: mostValuable.commodityId,
          quantity: Math.ceil(mostValuable.quantity * 0.5),  // Liquidate half
          minPrice: mostValuable.purchasePrice * 0.8,       // Accept 20% loss
        },
        reasoning: "Desperate for capital - liquidating inventory",
      };
    }
  }

  // ─────────────────────────────────────────
  // 2. RESTOCKING
  // ─────────────────────────────────────────

  const specialization = merchant.specialization;
  const commodities = SPECIALIZATION_COMMODITIES[specialization] || [];

  for (const commodityId of commodities) {
    if (commodityId === "*") continue;  // Skip wildcard

    const stock = merchant.inventory.find(i => i.commodityId === commodityId);
    const priceData = market.prices[commodityId];

    if (!priceData || !priceData.available) continue;

    // Need to restock if low
    const currentQty = stock?.quantity || 0;
    const optimalStock = getOptimalStock(merchant.tier, commodityId);

    if (currentQty < optimalStock * 0.3) {
      // Below 30% of optimal - definitely restock
      const buyQty = optimalStock - currentQty;
      const maxAffordable = Math.floor(merchant.capital * 0.3 / priceData.currentPrice);
      const actualBuy = Math.min(buyQty, maxAffordable, priceData.supply);

      if (actualBuy > 0 && priceData.trend !== "spiking") {
        decisions.push({
          merchantId: merchant.id,
          decision: {
            type: "buy",
            commodityId,
            quantity: actualBuy,
            maxPrice: priceData.currentPrice * 1.1,  // Up to 10% above current
          },
          reasoning: `Restocking ${commodityId} - only ${currentQty} units, need ${optimalStock}`,
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // 3. ARBITRAGE/SPECULATION (Smart merchants)
  // ─────────────────────────────────────────

  if (merchant.personality.risk > 0.5 && merchant.tier !== "peddler") {
    // Look for underpriced goods to hoard
    for (const [commodityId, priceData] of Object.entries(market.prices)) {
      if (!priceData.available) continue;

      // Buy if crashing (expecting rebound)
      if (priceData.trend === "crashing" && merchant.personality.risk > 0.7) {
        const specBudget = merchant.capital * 0.1;  // Risk 10%
        const qty = Math.floor(specBudget / priceData.currentPrice);

        if (qty > 0) {
          decisions.push({
            merchantId: merchant.id,
            decision: {
              type: "buy",
              commodityId,
              quantity: qty,
              maxPrice: priceData.currentPrice,
            },
            reasoning: `Speculative buy - ${commodityId} price crashed, expecting rebound`,
          });
        }
      }

      // Sell if spiking (take profits)
      const stock = merchant.inventory.find(i => i.commodityId === commodityId);
      if (stock && priceData.trend === "spiking") {
        const profit = priceData.currentPrice - stock.purchasePrice;
        if (profit > stock.purchasePrice * 0.5) {  // 50%+ profit
          decisions.push({
            merchantId: merchant.id,
            decision: {
              type: "sell",
              commodityId,
              quantity: Math.ceil(stock.quantity * 0.7),  // Sell 70%
              minPrice: stock.purchasePrice * 1.4,        // At least 40% profit
            },
            reasoning: `Taking profits on ${commodityId} - price spiking`,
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────
  // 4. TIER UPGRADE CHECK
  // ─────────────────────────────────────────

  if (merchant.currentGoal === "upgrade_tier" || merchant.currentGoal === "grow") {
    const upgradeCheck = canUpgradeTier(merchant);

    if (upgradeCheck.canUpgrade) {
      decisions.push({
        merchantId: merchant.id,
        decision: { type: "upgrade_tier" },
        reasoning: `Ready to upgrade to ${upgradeCheck.nextTier}!`,
      });
    }
  }

  // ─────────────────────────────────────────
  // 5. STAFFING DECISIONS
  // ─────────────────────────────────────────

  const tierRequirements = MERCHANT_TIER_REQUIREMENTS[merchant.tier];

  // Hire if understaffed and can afford
  if (merchant.employees.length < tierRequirements.employees) {
    const weeklyWage = 10;  // Assume 10gp/week for basic staff
    if (merchant.capital > weeklyWage * 12) {  // Can afford 3 months
      decisions.push({
        merchantId: merchant.id,
        decision: { type: "hire", role: "clerk" },
        reasoning: `Need more staff for ${merchant.tier} operations`,
      });
    }
  }

  // Fire if overstaffed and losing money
  if (merchant.weeklyRevenue < merchant.weeklyExpenses && merchant.employees.length > tierRequirements.employees) {
    const lastHired = merchant.employees[merchant.employees.length - 1];
    if (lastHired) {
      decisions.push({
        merchantId: merchant.id,
        decision: { type: "fire", employeeId: lastHired.npcId },
        reasoning: `Reducing staff to cut costs`,
      });
    }
  }

  // ─────────────────────────────────────────
  // 6. SELECT BEST DECISION
  // ─────────────────────────────────────────

  if (decisions.length === 0) {
    return {
      merchantId: merchant.id,
      decision: { type: "nothing" },
      reasoning: "No action needed this week",
    };
  }

  // Priority: survival > restocking > upgrade > speculation > staffing
  const priority = ["sell", "buy", "upgrade_tier", "speculate", "hire", "fire"];

  decisions.sort((a, b) => {
    const aType = a.decision.type;
    const bType = b.decision.type;
    return priority.indexOf(aType) - priority.indexOf(bType);
  });

  return decisions[0];
}

function getOptimalStock(tier: MerchantTier, _commodityId: string): number {
  // How much stock should a merchant of this tier carry?
  const tierMultipliers: Record<MerchantTier, number> = {
    peddler: 5,
    stall: 20,
    shop: 50,
    emporium: 200,
    trading_house: 1000,
    consortium: 5000,
    megamart: 10000,
  };

  return tierMultipliers[tier];
}

// ============================================
// MARKET EVENTS GENERATOR
// ============================================

export function generateMarketEvent(
  market: SettlementMarketComplete,
  _recentEvents: MarketEvent[],
  worldState: {
    isWartime: boolean;
    season: string;
    recentDisasters: string[];
  },
): MarketEvent | null {
  // Base 5% chance per week of a market event
  if (Math.random() > 0.05) return null;

  // Determine event type based on conditions
  const possibleEvents: Array<{ type: MarketEventType; weight: number; commodities: string[] }> = [];

  // Always possible
  possibleEvents.push({ type: "new_merchant", weight: 10, commodities: [] });
  possibleEvents.push({ type: "merchant_bankruptcy", weight: 5, commodities: [] });
  possibleEvents.push({ type: "shipment_arrived", weight: 15, commodities: Object.keys(market.prices) });
  possibleEvents.push({ type: "shipment_delayed", weight: 10, commodities: Object.keys(market.prices) });

  // Conditional events
  if (worldState.isWartime) {
    possibleEvents.push({ type: "military_requisition", weight: 20, commodities: ["weapons", "armor", "horses", "grain"] });
  }

  if (worldState.season === "harvest") {
    possibleEvents.push({ type: "festival_demand", weight: 15, commodities: ["wine", "food", "clothing"] });
  }

  if (market.health.volatility === "chaotic") {
    possibleEvents.push({ type: "speculation_bubble", weight: 10, commodities: ["gems", "spices", "silk"] });
    possibleEvents.push({ type: "bubble_burst", weight: 5, commodities: ["gems", "spices", "silk"] });
  }

  // Check for shortages that could trigger price wars
  for (const [commodityId, price] of Object.entries(market.prices)) {
    if (price.trend === "spiking") {
      possibleEvents.push({ type: "price_war", weight: 5, commodities: [commodityId] });
    }
  }

  // Weighted random selection
  const totalWeight = possibleEvents.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;

  let selected = possibleEvents[0];
  for (const event of possibleEvents) {
    roll -= event.weight;
    if (roll <= 0) {
      selected = event;
      break;
    }
  }

  // Build the event
  const commodityId = selected.commodities.length > 0
    ? selected.commodities[Math.floor(Math.random() * selected.commodities.length)]
    : undefined;

  return buildMarketEvent(selected.type, market, commodityId);
}

function buildMarketEvent(
  type: MarketEventType,
  market: SettlementMarketComplete,
  commodityId?: string,
): MarketEvent {
  const eventTemplates: Record<MarketEventType, {
    name: (c?: string) => string;
    description: (c?: string) => string;
    effects: (c?: string) => MarketEvent["effects"];
    duration: string;
  }> = {
    shipment_arrived: {
      name: (c) => `Large ${c || "Goods"} Shipment Arrives`,
      description: (c) => `A major shipment of ${c || "various goods"} has arrived from afar.`,
      effects: (c) => c ? [{ type: "supply", commodityId: c, modifier: 1.5, isMultiplier: true }] : [],
      duration: "1 week",
    },
    shipment_delayed: {
      name: (c) => `${c || "Goods"} Shipment Delayed`,
      description: (c) => `Expected shipment of ${c || "goods"} has been delayed by weather or banditry.`,
      effects: (c) => c ? [{ type: "supply", commodityId: c, modifier: 0.7, isMultiplier: true }] : [],
      duration: "2 weeks",
    },
    shipment_lost: {
      name: (c) => `${c || "Goods"} Shipment Lost!`,
      description: (c) => `A major shipment of ${c || "goods"} was lost to disaster or raiders.`,
      effects: (c) => c ? [{ type: "supply", commodityId: c, modifier: 0.3, isMultiplier: true }] : [],
      duration: "4 weeks",
    },
    warehouse_fire: {
      name: () => "Warehouse Fire!",
      description: () => "A fire has destroyed a significant warehouse.",
      effects: () => [{ type: "supply", commodityId: "general", modifier: 0.5, isMultiplier: true }],
      duration: "2 weeks",
    },
    spoilage: {
      name: () => "Spoilage Outbreak",
      description: () => "A rot has spread through stored food supplies.",
      effects: () => [{ type: "supply", commodityId: "food", modifier: 0.6, isMultiplier: true }],
      duration: "1 week",
    },
    festival_demand: {
      name: () => "Festival Season",
      description: () => "A major festival drives up demand for luxuries.",
      effects: () => [
        { type: "demand", commodityId: "wine", modifier: 2, isMultiplier: true },
        { type: "demand", commodityId: "food", modifier: 1.5, isMultiplier: true },
      ],
      duration: "1 week",
    },
    military_requisition: {
      name: () => "Military Requisition",
      description: () => "The army is buying up weapons and supplies.",
      effects: () => [
        { type: "demand", commodityId: "weapons", modifier: 3, isMultiplier: true },
        { type: "demand", commodityId: "armor", modifier: 2.5, isMultiplier: true },
        { type: "demand", commodityId: "horses", modifier: 2, isMultiplier: true },
      ],
      duration: "ongoing",
    },
    noble_order: {
      name: (c) => `Noble Orders ${c || "Luxury Goods"}`,
      description: (c) => `A noble house has placed a massive order for ${c || "luxury items"}.`,
      effects: (c) => c ? [{ type: "demand", commodityId: c, modifier: 1.8, isMultiplier: true }] : [],
      duration: "3 weeks",
    },
    fashion_change: {
      name: () => "Fashion Shifts",
      description: () => "What's fashionable has changed - some goods now more desirable.",
      effects: () => [{ type: "demand", commodityId: "silk", modifier: 1.5, isMultiplier: true }],
      duration: "2 months",
    },
    price_war: {
      name: (c) => `Price War on ${c || "Goods"}`,
      description: (c) => `Merchants are undercutting each other on ${c || "goods"}.`,
      effects: (c) => c ? [{ type: "price", commodityId: c, modifier: 0.7, isMultiplier: true }] : [],
      duration: "2 weeks",
    },
    price_fixing: {
      name: (c) => `${c || "Goods"} Cartel Formed`,
      description: (c) => `Major merchants have agreed to fix prices on ${c || "certain goods"}.`,
      effects: (c) => c ? [{ type: "price", commodityId: c, modifier: 1.4, isMultiplier: true }] : [],
      duration: "ongoing",
    },
    currency_fluctuation: {
      name: () => "Currency Instability",
      description: () => "The value of local currency is fluctuating.",
      effects: () => [],  // Affects all prices
      duration: "1 month",
    },
    speculation_bubble: {
      name: (c) => `${c || "Commodity"} Bubble Forming`,
      description: (c) => `Speculators are driving up ${c || "commodity"} prices beyond reason.`,
      effects: (c) => c ? [{ type: "price", commodityId: c, modifier: 2, isMultiplier: true }] : [],
      duration: "4 weeks",
    },
    bubble_burst: {
      name: (c) => `${c || "Commodity"} Bubble Bursts!`,
      description: (c) => `The speculative bubble in ${c || "commodities"} has collapsed.`,
      effects: (c) => c ? [{ type: "price", commodityId: c, modifier: 0.4, isMultiplier: true }] : [],
      duration: "2 weeks",
    },
    new_merchant: {
      name: () => "New Merchant in Town",
      description: () => "A new merchant has set up shop, increasing competition.",
      effects: () => [],
      duration: "permanent",
    },
    merchant_bankruptcy: {
      name: () => "Merchant Bankruptcy",
      description: () => "A local merchant has gone bankrupt - goods being liquidated.",
      effects: () => [],
      duration: "1 week",
    },
    guild_action: {
      name: () => "Guild Action",
      description: () => "The merchant guild is taking collective action.",
      effects: () => [],
      duration: "2 weeks",
    },
    government_regulation: {
      name: () => "New Trade Regulations",
      description: () => "The government has imposed new trading rules.",
      effects: () => [],
      duration: "permanent",
    },
    black_market_crackdown: {
      name: () => "Black Market Crackdown",
      description: () => "Authorities are cracking down on illegal trade.",
      effects: () => [{ type: "availability", commodityId: "illegal", modifier: 0.3, isMultiplier: true }],
      duration: "1 month",
    },
    foreign_traders: {
      name: () => "Foreign Traders Arrive",
      description: () => "Exotic merchants from distant lands have arrived.",
      effects: () => [{ type: "supply", commodityId: "exotic", modifier: 2, isMultiplier: true }],
      duration: "2 weeks",
    },
    trade_fair: {
      name: () => "Trade Fair",
      description: () => "A major trade fair brings merchants from across the region.",
      effects: () => [],
      duration: "1 week",
    },
    embargo_effect: {
      name: (c) => `Embargo Affects ${c || "Trade"}`,
      description: (c) => `Trade restrictions are limiting ${c || "certain goods"}.`,
      effects: (c) => c ? [{ type: "supply", commodityId: c, modifier: 0.4, isMultiplier: true }] : [],
      duration: "ongoing",
    },
  };

  const template = eventTemplates[type];

  return {
    id: crypto.randomUUID(),
    type,
    name: template.name(commodityId),
    description: template.description(commodityId),
    settlementId: market.settlementId,
    affectedCommodities: commodityId ? [commodityId] : [],
    affectedMerchants: [],
    effects: template.effects(commodityId),
    startDate: new Date().toISOString(),
    duration: template.duration,
    publicKnowledge: true,
    rumorText: `"Have you heard? ${template.description(commodityId)}"`,
    status: "active",
  };
}

// ============================================
// MARKET TICK
// ============================================

export interface MarketTickResult {
  market: SettlementMarketComplete;
  priceDiscoveries: PriceDiscoveryResult[];
  merchantDecisions: MerchantDecision[];
  newEvents: MarketEvent[];
  resolvedEvents: string[];
  news: string[];
}

/**
 * Main market simulation tick (weekly).
 */
export function tickMarket(
  market: SettlementMarketComplete,
  merchants: Merchant[],
  venues: MarketVenue[],
  speculativePositions: SpeculativePosition[],
  worldState: {
    isWartime: boolean;
    season: string;
    recentDisasters: string[];
  },
): MarketTickResult {
  const priceDiscoveries: PriceDiscoveryResult[] = [];
  const merchantDecisions: MerchantDecision[] = [];
  const newEvents: MarketEvent[] = [];
  const resolvedEvents: string[] = [];
  const news: string[] = [];

  // ─────────────────────────────────────────
  // 1. PRICE DISCOVERY for all commodities
  // ─────────────────────────────────────────

  for (const [commodityId, priceData] of Object.entries(market.prices)) {
    const result = discoverPrice(
      commodityId,
      priceData.basePrice,
      priceData.supply,
      priceData.demand,
      market.activeEvents,
      speculativePositions.filter(p => p.commodityId === commodityId),
      {
        priceFloor: market.regulations.priceFloors[commodityId],
        priceCeiling: market.regulations.priceCeilings[commodityId],
        taxRate: market.regulations.tariffs[commodityId],
      },
    );

    priceDiscoveries.push(result);

    // Update market prices
    market.prices[commodityId] = {
      ...priceData,
      currentPrice: result.newPrice,
      trend: result.trend,
    };

    // Generate news for significant changes
    if (result.trend === "spiking") {
      news.push(`${commodityId.toUpperCase()} prices skyrocket in ${market.settlementName}!`);
    } else if (result.trend === "crashing") {
      news.push(`${commodityId.toUpperCase()} prices collapse in ${market.settlementName}!`);
    }
  }

  // ─────────────────────────────────────────
  // 2. MERCHANT DECISIONS
  // ─────────────────────────────────────────

  for (const merchant of merchants) {
    if (merchant.status !== "operating") continue;

    const venue = venues.find(v => v.id === merchant.venueId);
    const operatingCosts = calculateOperatingCosts(merchant, venue);

    const decision = simulateMerchantDecision(merchant, market, venue, operatingCosts);
    merchantDecisions.push(decision);

    // Apply decision effects (simplified)
    if (decision.decision.type === "upgrade_tier") {
      news.push(`${merchant.name} has expanded their business!`);
    } else if (decision.decision.type === "buy" || decision.decision.type === "sell") {
      // Would affect supply/demand for next tick
    }
  }

  // ─────────────────────────────────────────
  // 3. GENERATE NEW EVENTS
  // ─────────────────────────────────────────

  const newEvent = generateMarketEvent(market, market.activeEvents, worldState);
  if (newEvent) {
    newEvents.push(newEvent);
    market.activeEvents.push(newEvent);
    news.push(newEvent.rumorText || newEvent.description);
  }

  // ─────────────────────────────────────────
  // 4. RESOLVE EXPIRING EVENTS
  // ─────────────────────────────────────────

  const now = new Date();
  market.activeEvents = market.activeEvents.filter(event => {
    if (event.endDate && new Date(event.endDate) < now) {
      resolvedEvents.push(event.id);
      event.status = "resolved";
      return false;
    }
    return true;
  });

  // ─────────────────────────────────────────
  // 5. UPDATE MARKET HEALTH
  // ─────────────────────────────────────────

  // Volatility based on recent price swings
  const avgChange = priceDiscoveries.reduce((sum, p) =>
    sum + Math.abs(p.priceChangePercent), 0) / priceDiscoveries.length;

  if (avgChange > 20) market.health.volatility = "chaotic";
  else if (avgChange > 10) market.health.volatility = "volatile";
  else if (avgChange > 5) market.health.volatility = "normal";
  else market.health.volatility = "stable";

  // Confidence based on event severity
  const negativeEvents = market.activeEvents.filter(e =>
    e.type.includes("lost") || e.type.includes("burst") || e.type.includes("fire")
  ).length;

  market.health.confidence = Math.max(0, Math.min(100,
    market.health.confidence - negativeEvents * 10 + 5  // Slow recovery
  ));

  market.lastUpdated = now.toISOString();

  return {
    market,
    priceDiscoveries,
    merchantDecisions,
    newEvents,
    resolvedEvents,
    news,
  };
}
