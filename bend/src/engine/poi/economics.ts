import { z } from "zod";
import { POI, POIThreatLevel, RouteBlockageType } from "./schema";

// ============================================
// POI ECONOMIC INTEGRATION
// ============================================
//
// POIs don't just sit there - they AFFECT the economy:
//   - Dangerous routes = higher shipping costs
//   - Blocked routes = no trade at all
//   - Guarded deposits = inaccessible resources
//   - Caravan raids = lost goods, price spikes
//
// When players clear POIs, they're not just getting loot -
// they're reopening trade routes, stabilizing prices,
// and making heroes of themselves to merchants.
//

// ============================================
// ROUTE DANGER CALCULATION
// ============================================

export interface RouteDangerSource {
  poiId: string;
  poiName: string;
  distanceFromRoute: number;
  threatLevel: POIThreatLevel;
  blockageType: RouteBlockageType;
  dangerContribution: number;
  raidRisk: number;
}

export interface RouteDangerAnalysis {
  routeId: string;
  totalDanger: number;  // 0-10 scale
  isBlocked: boolean;
  dangerSources: RouteDangerSource[];
  priceMultiplier: number;  // How much this increases shipping costs
  volumeMultiplier: number; // How much this reduces trade volume
  travelTimeMultiplier: number; // How much longer travel takes
  insuranceCost: number;  // Per 100gp of cargo
}

// Danger contribution by blockage type
const BLOCKAGE_DANGER: Record<RouteBlockageType, number> = {
  total: 10,
  dangerous: 6,
  toll: 3,
  delay: 2,
};

// Threat level danger modifier
const THREAT_DANGER_MOD: Record<POIThreatLevel, number> = {
  trivial: 0.3,
  easy: 0.6,
  moderate: 1.0,
  hard: 1.4,
  deadly: 1.8,
  legendary: 2.2,
  mythic: 2.5,
};

/**
 * Calculate the danger level of a trade route based on nearby POIs.
 */
export function calculateRouteDanger(
  routeId: string,
  nearbyPOIs: Array<{
    poi: POI;
    distanceFromRoute: number; // Miles
  }>,
): RouteDangerAnalysis {
  const dangerSources: RouteDangerSource[] = [];
  let totalDanger = 0;
  let isBlocked = false;

  for (const { poi, distanceFromRoute } of nearbyPOIs) {
    // Skip cleared/claimed POIs - they're not dangerous
    if (["cleared", "claimed"].includes(poi.discovery.state)) continue;

    // Check if POI explicitly blocks this route
    const routeBlock = poi.economics.blocksRoutes.find(r => r.routeId === routeId);

    if (routeBlock) {
      const blockDanger = BLOCKAGE_DANGER[routeBlock.blockageType];
      const threatMod = THREAT_DANGER_MOD[poi.threatLevel];
      const contribution = Math.min(10, blockDanger * threatMod);

      if (routeBlock.blockageType === "total") {
        isBlocked = true;
      }

      const raidRisk = poi.economics.raidsCaravans
        ? (poi.economics.raidFrequency ?? 0.1) / 2  // Biweekly raids
        : 0;

      dangerSources.push({
        poiId: poi.id,
        poiName: poi.name,
        distanceFromRoute,
        threatLevel: poi.threatLevel,
        blockageType: routeBlock.blockageType,
        dangerContribution: contribution,
        raidRisk,
      });

      totalDanger += contribution;
    } else if (poi.economics.raidsCaravans) {
      // POI doesn't explicitly block but does raid
      const raidRange = poi.economics.raidRange ?? 5;

      if (distanceFromRoute <= raidRange) {
        const threatMod = THREAT_DANGER_MOD[poi.threatLevel];
        const distanceFactor = 1 - (distanceFromRoute / raidRange);
        const contribution = 4 * threatMod * distanceFactor; // Base 4 for raiders

        dangerSources.push({
          poiId: poi.id,
          poiName: poi.name,
          distanceFromRoute,
          threatLevel: poi.threatLevel,
          blockageType: "dangerous",
          dangerContribution: contribution,
          raidRisk: (poi.economics.raidFrequency ?? 0.1) / 2,  // Biweekly raids
        });

        totalDanger += contribution;
      }
    }
  }

  // Cap total danger at 10
  totalDanger = Math.min(10, totalDanger);

  // Calculate economic effects
  const priceMultiplier = 1 + (totalDanger * 0.1); // 10% per danger level
  const volumeMultiplier = isBlocked ? 0 : Math.max(0.1, 1 - (totalDanger * 0.08)); // 8% reduction per level
  const travelTimeMultiplier = 1 + (totalDanger * 0.15); // 15% longer per level
  const insuranceCost = totalDanger * 2; // 2gp per 100gp cargo per danger level

  return {
    routeId,
    totalDanger,
    isBlocked,
    dangerSources,
    priceMultiplier,
    volumeMultiplier,
    travelTimeMultiplier,
    insuranceCost,
  };
}

// ============================================
// RESOURCE ACCESS CALCULATION
// ============================================

export interface ResourceAccessAnalysis {
  depositId: string;
  commodityId: string;
  commodityName: string;
  isAccessible: boolean;
  guardingPOIs: Array<{
    poiId: string;
    poiName: string;
    threatLevel: POIThreatLevel;
    mustClear: boolean;
  }>;
  outputReductionPercent: number;
  potentialDailyOutput: number;
  actualDailyOutput: number;
}

/**
 * Calculate how POIs affect access to resource deposits.
 */
export function calculateResourceAccess(
  depositId: string,
  deposit: {
    commodityId: string;
    commodityName: string;
    dailyOutput: number;
  },
  guardingPOIs: POI[],
): ResourceAccessAnalysis {
  const activePOIs = guardingPOIs.filter(
    poi => !["cleared", "claimed"].includes(poi.discovery.state)
  );

  // If no active POIs, full access
  if (activePOIs.length === 0) {
    return {
      depositId,
      commodityId: deposit.commodityId,
      commodityName: deposit.commodityName,
      isAccessible: true,
      guardingPOIs: [],
      outputReductionPercent: 0,
      potentialDailyOutput: deposit.dailyOutput,
      actualDailyOutput: deposit.dailyOutput,
    };
  }

  // Calculate access reduction
  let totalReduction = 0;
  const poiAnalysis = activePOIs.map(poi => {
    // Higher threat = more reduction
    const threatReduction: Record<POIThreatLevel, number> = {
      trivial: 10,
      easy: 20,
      moderate: 35,
      hard: 50,
      deadly: 70,
      legendary: 85,
      mythic: 100,
    };

    const reduction = threatReduction[poi.threatLevel];
    totalReduction = Math.min(100, totalReduction + reduction);

    return {
      poiId: poi.id,
      poiName: poi.name,
      threatLevel: poi.threatLevel,
      mustClear: reduction >= 50, // Significant threats must be cleared
    };
  });

  // Cap at 100% reduction
  totalReduction = Math.min(100, totalReduction);

  // Is it accessible at all?
  const isAccessible = totalReduction < 100;

  // Calculate actual output
  const actualDailyOutput = deposit.dailyOutput * (1 - totalReduction / 100);

  return {
    depositId,
    commodityId: deposit.commodityId,
    commodityName: deposit.commodityName,
    isAccessible,
    guardingPOIs: poiAnalysis,
    outputReductionPercent: totalReduction,
    potentialDailyOutput: deposit.dailyOutput,
    actualDailyOutput,
  };
}

// ============================================
// CARAVAN RAID EVENTS
// ============================================

export const CaravanRaidEventSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Source
  poiId: z.string().uuid(),
  poiName: z.string(),

  // Caravan
  caravanId: z.string().uuid().optional(),
  caravanName: z.string(),
  origin: z.string(),
  destination: z.string(),
  routeId: z.string().uuid(),

  // Raid details
  raidDate: z.string(),
  severity: z.enum(["minor", "moderate", "severe", "devastating"]),

  // Losses
  goldLost: z.number().int(),
  goodsLost: z.array(z.object({
    commodityId: z.string(),
    commodityName: z.string(),
    quantity: z.number(),
    value: z.number(),
  })),
  casualties: z.object({
    guards: z.number().int(),
    merchants: z.number().int(),
    total: z.number().int(),
  }),

  // Survivors
  survivors: z.number().int(),
  escaped: z.boolean(),

  // Consequences
  consequences: z.array(z.string()),
  priceImpacts: z.array(z.object({
    commodityId: z.string(),
    settlementId: z.string(),
    priceChangePercent: z.number(),
  })),

  // Resolution
  resolved: z.boolean().default(false),
  revengeCompleted: z.boolean().default(false),
  goodsRecovered: z.boolean().default(false),

  createdAt: z.string(),
});
export type CaravanRaidEvent = z.infer<typeof CaravanRaidEventSchema>;

// Severity modifiers
const SEVERITY_LOSS_MULTIPLIER: Record<string, number> = {
  minor: 0.2,      // 20% of cargo
  moderate: 0.5,   // 50% of cargo
  severe: 0.8,     // 80% of cargo
  devastating: 1.0, // 100% of cargo
};

const SEVERITY_CASUALTY_RATE: Record<string, number> = {
  minor: 0.05,     // 5% casualties
  moderate: 0.15,  // 15% casualties
  severe: 0.35,    // 35% casualties
  devastating: 0.6, // 60% casualties
};

/**
 * Simulate a caravan raid from a POI.
 */
export function simulateCaravanRaid(
  poi: POI,
  caravan: {
    id?: string;
    name: string;
    origin: string;
    destination: string;
    routeId: string;
    totalValue: number;
    goods: Array<{
      commodityId: string;
      commodityName: string;
      quantity: number;
      value: number;
    }>;
    guardCount: number;
    merchantCount: number;
  },
  currentDate: Date,
): CaravanRaidEvent | null {
  // Check if raid happens
  const raidChance = (poi.economics.raidFrequency ?? 0.1) / 2;  // Biweekly raids
  if (Math.random() > raidChance) return null;

  // Determine severity based on threat level and defender strength
  const severityRoll = Math.random();
  const threatBonus = THREAT_DANGER_MOD[poi.threatLevel] - 1;

  let severity: "minor" | "moderate" | "severe" | "devastating";
  if (severityRoll + threatBonus > 0.9) {
    severity = "devastating";
  } else if (severityRoll + threatBonus > 0.6) {
    severity = "severe";
  } else if (severityRoll + threatBonus > 0.3) {
    severity = "moderate";
  } else {
    severity = "minor";
  }

  // Calculate losses
  const lossMultiplier = SEVERITY_LOSS_MULTIPLIER[severity];
  const goldLost = Math.floor(caravan.totalValue * 0.1 * lossMultiplier); // 10% of value is gold

  const goodsLost = caravan.goods.map(good => ({
    ...good,
    quantity: Math.floor(good.quantity * lossMultiplier),
    value: Math.floor(good.value * lossMultiplier),
  })).filter(g => g.quantity > 0);

  // Calculate casualties
  const casualtyRate = SEVERITY_CASUALTY_RATE[severity];
  const totalPeople = caravan.guardCount + caravan.merchantCount;
  const totalCasualties = Math.floor(totalPeople * casualtyRate);
  const guardCasualties = Math.min(caravan.guardCount, Math.floor(totalCasualties * 0.7));
  const merchantCasualties = totalCasualties - guardCasualties;

  // Did anyone escape?
  const escaped = severity !== "devastating" || Math.random() > 0.5;
  const survivors = totalPeople - totalCasualties;

  // Generate consequences
  const consequences: string[] = [];
  consequences.push(`${poi.name} raided the ${caravan.name} caravan`);

  if (severity === "devastating") {
    consequences.push("The caravan was completely destroyed");
  } else if (severity === "severe") {
    consequences.push("The caravan suffered heavy losses");
  }

  if (merchantCasualties > 0) {
    consequences.push(`${merchantCasualties} merchant(s) were killed`);
  }

  if (goodsLost.length > 0) {
    const totalGoodsValue = goodsLost.reduce((sum, g) => sum + g.value, 0);
    consequences.push(`Goods worth ${totalGoodsValue}gp were stolen`);
  }

  // Price impacts
  const priceImpacts = goodsLost.map(good => ({
    commodityId: good.commodityId,
    settlementId: caravan.destination, // Destination will see price spike
    priceChangePercent: Math.min(50, good.value / 100), // Up to 50% price spike
  }));

  return {
    id: crypto.randomUUID(),
    campaignId: poi.campaignId,
    poiId: poi.id,
    poiName: poi.name,
    caravanId: caravan.id,
    caravanName: caravan.name,
    origin: caravan.origin,
    destination: caravan.destination,
    routeId: caravan.routeId,
    raidDate: currentDate.toISOString(),
    severity,
    goldLost,
    goodsLost,
    casualties: {
      guards: guardCasualties,
      merchants: merchantCasualties,
      total: totalCasualties,
    },
    survivors,
    escaped,
    consequences,
    priceImpacts,
    resolved: false,
    revengeCompleted: false,
    goodsRecovered: false,
    createdAt: currentDate.toISOString(),
  };
}

// ============================================
// ECONOMIC EVENT GENERATION
// ============================================

export const POIEconomicEventSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  type: z.enum([
    "caravan_raid",
    "route_blocked",
    "route_opened",
    "price_spike",
    "shortage",
    "supply_restored",
    "trade_disrupted",
    "trade_resumed",
  ]),
  poiId: z.string().uuid(),
  poiName: z.string(),
  description: z.string(),

  // Affected entities
  affectedRoutes: z.array(z.string().uuid()).default([]),
  affectedSettlements: z.array(z.string().uuid()).default([]),
  affectedCommodities: z.array(z.string()).default([]),

  // Economic impact
  priceChanges: z.array(z.object({
    commodityId: z.string(),
    settlementId: z.string(),
    changePercent: z.number(),
  })).default([]),

  volumeChanges: z.array(z.object({
    routeId: z.string().uuid(),
    changePercent: z.number(),
  })).default([]),

  // Timing
  eventDate: z.string(),
  duration: z.string().optional(), // "ongoing", "1 week", etc.

  // Resolution
  resolved: z.boolean().default(false),
  resolvedBy: z.string().uuid().optional(),
  resolvedAt: z.string().optional(),

  createdAt: z.string(),
});
export type POIEconomicEvent = z.infer<typeof POIEconomicEventSchema>;

/**
 * Generate economic events from POI activity over time.
 */
export function generateEconomicEventsFromPOI(
  poi: POI,
  daysElapsed: number,
  affectedRoutes: Array<{
    id: string;
    settlements: string[];
    commodities: string[];
  }>,
  currentDate: Date,
): POIEconomicEvent[] {
  const events: POIEconomicEvent[] = [];

  // Skip if POI is cleared/claimed
  if (["cleared", "claimed"].includes(poi.discovery.state)) {
    return events;
  }

  // Route blocking events (check if newly blocking)
  for (const routeBlock of poi.economics.blocksRoutes) {
    const route = affectedRoutes.find(r => r.id === routeBlock.routeId);
    if (!route) continue;

    if (routeBlock.blockageType === "total") {
      // Generate shortage events for affected commodities
      for (const commodityId of route.commodities) {
        const shortageEvent: POIEconomicEvent = {
          id: crypto.randomUUID(),
          campaignId: poi.campaignId,
          type: "shortage",
          poiId: poi.id,
          poiName: poi.name,
          description: `${poi.name} has completely blocked trade, causing shortages`,
          affectedRoutes: [routeBlock.routeId],
          affectedSettlements: route.settlements,
          affectedCommodities: [commodityId],
          priceChanges: route.settlements.map(sid => ({
            commodityId,
            settlementId: sid,
            changePercent: 30 + Math.random() * 20, // 30-50% price spike
          })),
          volumeChanges: [{
            routeId: routeBlock.routeId,
            changePercent: -100, // Complete stoppage
          }],
          eventDate: currentDate.toISOString(),
          duration: "ongoing",
          resolved: false,
          createdAt: currentDate.toISOString(),
        };
        events.push(shortageEvent);
      }
    } else if (routeBlock.blockageType === "dangerous") {
      // Price spike from danger
      const spikeEvent: POIEconomicEvent = {
        id: crypto.randomUUID(),
        campaignId: poi.campaignId,
        type: "price_spike",
        poiId: poi.id,
        poiName: poi.name,
        description: `Danger from ${poi.name} is driving up shipping costs`,
        affectedRoutes: [routeBlock.routeId],
        affectedSettlements: route.settlements,
        affectedCommodities: route.commodities,
        priceChanges: route.settlements.flatMap(sid =>
          route.commodities.map(cid => ({
            commodityId: cid,
            settlementId: sid,
            changePercent: 10 + routeBlock.dangerLevel * 2, // 10-30% based on danger
          }))
        ),
        volumeChanges: [{
          routeId: routeBlock.routeId,
          changePercent: -routeBlock.dangerLevel * 5, // 5-50% reduction
        }],
        eventDate: currentDate.toISOString(),
        duration: "ongoing",
        resolved: false,
        createdAt: currentDate.toISOString(),
      };
      events.push(spikeEvent);
    }
  }

  // Caravan raiding events
  if (poi.economics.raidsCaravans && daysElapsed > 0) {
    const raidsPerWeek = (poi.economics.raidFrequency ?? 0.1) / 2;  // Biweekly raids
    const expectedRaids = (daysElapsed / 7) * raidsPerWeek;

    // Chance of at least one raid
    if (Math.random() < expectedRaids) {
      const raidEvent: POIEconomicEvent = {
        id: crypto.randomUUID(),
        campaignId: poi.campaignId,
        type: "caravan_raid",
        poiId: poi.id,
        poiName: poi.name,
        description: `Creatures from ${poi.name} have been raiding caravans`,
        affectedRoutes: poi.economics.blocksRoutes.map(r => r.routeId),
        affectedSettlements: [],
        affectedCommodities: [],
        priceChanges: [],
        volumeChanges: [],
        eventDate: currentDate.toISOString(),
        resolved: false,
        createdAt: currentDate.toISOString(),
      };
      events.push(raidEvent);
    }
  }

  return events;
}

// ============================================
// CLEARING BENEFITS
// ============================================

export interface ClearingBenefitAnalysis {
  poiId: string;
  poiName: string;

  // Route benefits
  routesOpened: Array<{
    routeId: string;
    routeName?: string;
    previousDanger: number;
    newDanger: number;
    priceReduction: number;
    volumeIncrease: number;
  }>;

  // Resource benefits
  depositsAccessible: Array<{
    depositId: string;
    commodityName: string;
    previousOutput: number;
    newOutput: number;
    dailyValueGain: number;
  }>;

  // Trade benefits
  tradeVolumeIncrease: number;
  priceStabilization: string[];

  // Total economic impact
  dailyEconomicBenefit: number;
  annualEconomicBenefit: number;

  // Political benefits
  reputationGains: Array<{
    entityId: string;
    entityName: string;
    entityType: string;
    reputationGain: number;
    reason: string;
  }>;
}

/**
 * Calculate the benefits of clearing a POI.
 */
export function calculateClearingBenefits(
  poi: POI,
  affectedRoutes: Array<{
    id: string;
    name?: string;
    currentDanger: number;
    settlements: Array<{ id: string; name: string }>;
    dailyTradeValue: number;
  }>,
  affectedDeposits: Array<{
    id: string;
    commodityName: string;
    potentialOutput: number;
    currentOutput: number;
    unitValue: number;
  }>,
): ClearingBenefitAnalysis {
  // Route benefits
  const routesOpened = affectedRoutes
    .filter(route => poi.economics.blocksRoutes.some(b => b.routeId === route.id))
    .map(route => {
      const block = poi.economics.blocksRoutes.find(b => b.routeId === route.id)!;
      const dangerReduction = BLOCKAGE_DANGER[block.blockageType] * THREAT_DANGER_MOD[poi.threatLevel];

      return {
        routeId: route.id,
        routeName: route.name,
        previousDanger: route.currentDanger,
        newDanger: Math.max(0, route.currentDanger - dangerReduction),
        priceReduction: dangerReduction * 10, // 10% per danger level removed
        volumeIncrease: block.blockageType === "total" ? 100 : dangerReduction * 8,
      };
    });

  // Deposit benefits
  const depositsAccessible = affectedDeposits
    .filter(dep => poi.economics.guardsDeposits.includes(dep.id))
    .map(dep => ({
      depositId: dep.id,
      commodityName: dep.commodityName,
      previousOutput: dep.currentOutput,
      newOutput: dep.potentialOutput,
      dailyValueGain: (dep.potentialOutput - dep.currentOutput) * dep.unitValue,
    }));

  // Calculate totals
  const tradeVolumeIncrease = routesOpened.reduce((sum, r) => sum + r.volumeIncrease, 0) / Math.max(1, routesOpened.length);

  const priceStabilization = [...new Set(
    poi.economics.blocksRoutes.flatMap(b => {
      const route = affectedRoutes.find(r => r.id === b.routeId);
      return route ? route.settlements.map(s => s.name) : [];
    })
  )];

  // Daily economic benefit
  const routeBenefit = routesOpened.reduce((sum, r) => {
    const route = affectedRoutes.find(ar => ar.id === r.routeId);
    if (!route) return sum;
    const volumeGain = route.dailyTradeValue * (r.volumeIncrease / 100);
    const priceGain = route.dailyTradeValue * (r.priceReduction / 100) * 0.3; // Price benefit is partial
    return sum + volumeGain + priceGain;
  }, 0);

  const depositBenefit = depositsAccessible.reduce((sum, d) => sum + d.dailyValueGain, 0);
  const dailyEconomicBenefit = routeBenefit + depositBenefit;

  // Reputation gains
  const reputationGains: ClearingBenefitAnalysis["reputationGains"] = [];

  // Add standing from POI's faction context
  for (const change of poi.factionContext.standingChangesOnClear) {
    reputationGains.push({
      entityId: change.factionId,
      entityName: change.factionName,
      entityType: "faction",
      reputationGain: change.change,
      reason: change.reason,
    });
  }

  // Add settlement reputation for route clearing
  for (const route of routesOpened) {
    const routeData = affectedRoutes.find(r => r.id === route.routeId);
    if (!routeData) continue;

    for (const settlement of routeData.settlements) {
      reputationGains.push({
        entityId: settlement.id,
        entityName: settlement.name,
        entityType: "settlement",
        reputationGain: Math.min(15, Math.floor(route.previousDanger)),
        reason: `Cleared threat from ${poi.name}, reopening trade`,
      });
    }
  }

  return {
    poiId: poi.id,
    poiName: poi.name,
    routesOpened,
    depositsAccessible,
    tradeVolumeIncrease,
    priceStabilization,
    dailyEconomicBenefit,
    annualEconomicBenefit: dailyEconomicBenefit * 365,
    reputationGains,
  };
}

// ============================================
// MARKET IMPACT PROPAGATION
// ============================================

export interface MarketImpact {
  settlementId: string;
  settlementName: string;
  commodityId: string;
  commodityName: string;
  priceChangePercent: number;
  supplyChangePercent: number;
  demandChangePercent: number;
  reason: string;
  sourcePoiId: string;
  timestamp: string;
}

/**
 * Calculate how POI events propagate to markets.
 */
export function propagateMarketImpacts(
  events: POIEconomicEvent[],
  settlements: Array<{
    id: string;
    name: string;
    markets: Array<{
      commodityId: string;
      commodityName: string;
      basePrice: number;
    }>;
  }>,
): MarketImpact[] {
  const impacts: MarketImpact[] = [];

  for (const event of events) {
    for (const priceChange of event.priceChanges) {
      const settlement = settlements.find(s => s.id === priceChange.settlementId);
      if (!settlement) continue;

      const market = settlement.markets.find(m => m.commodityId === priceChange.commodityId);
      if (!market) continue;

      impacts.push({
        settlementId: settlement.id,
        settlementName: settlement.name,
        commodityId: market.commodityId,
        commodityName: market.commodityName,
        priceChangePercent: priceChange.changePercent,
        supplyChangePercent: event.type === "shortage" ? -50 : -priceChange.changePercent * 0.5,
        demandChangePercent: 0, // Demand usually stays stable
        reason: event.description,
        sourcePoiId: event.poiId,
        timestamp: event.eventDate,
      });
    }
  }

  return impacts;
}

// ============================================
// TRADE ROUTE PROFITABILITY
// ============================================

export interface RouteProfitability {
  routeId: string;
  routeName?: string;
  baseProfitMargin: number;
  adjustedProfitMargin: number;
  riskAdjustedValue: number;
  recommendedAction: "avoid" | "caution" | "normal" | "profitable" | "highly_profitable";
  riskFactors: string[];
}

/**
 * Calculate profitability of trade routes considering POI dangers.
 */
export function calculateRouteProfitability(
  routeId: string,
  routeData: {
    name?: string;
    baseProfitMargin: number; // As percentage
    cargoValue: number;
    travelDays: number;
  },
  dangerAnalysis: RouteDangerAnalysis,
): RouteProfitability {
  const { baseProfitMargin, cargoValue } = routeData;

  // Adjust for danger costs
  const insuranceCost = dangerAnalysis.insuranceCost * (cargoValue / 100);
  const expectedRaidLoss = dangerAnalysis.dangerSources.reduce((sum, source) => {
    return sum + (source.raidRisk * cargoValue * 0.5); // Average 50% loss on raid
  }, 0);

  const additionalCosts = insuranceCost + expectedRaidLoss;
  const profitLoss = (additionalCosts / cargoValue) * 100;

  const adjustedProfitMargin = baseProfitMargin - profitLoss;

  // Risk-adjusted value (expected profit minus risk)
  const riskAdjustedValue = (adjustedProfitMargin / 100) * cargoValue -
    (dangerAnalysis.totalDanger * cargoValue * 0.02); // 2% per danger level

  // Recommendation
  let recommendedAction: RouteProfitability["recommendedAction"];
  if (dangerAnalysis.isBlocked) {
    recommendedAction = "avoid";
  } else if (adjustedProfitMargin < 0) {
    recommendedAction = "avoid";
  } else if (adjustedProfitMargin < 5) {
    recommendedAction = "caution";
  } else if (adjustedProfitMargin < 15) {
    recommendedAction = "normal";
  } else if (adjustedProfitMargin < 30) {
    recommendedAction = "profitable";
  } else {
    recommendedAction = "highly_profitable";
  }

  // Risk factors
  const riskFactors: string[] = [];
  if (dangerAnalysis.isBlocked) {
    riskFactors.push("Route completely blocked");
  }
  for (const source of dangerAnalysis.dangerSources) {
    if (source.raidRisk > 0.3) {
      riskFactors.push(`High raid risk from ${source.poiName}`);
    } else if (source.dangerContribution > 5) {
      riskFactors.push(`Significant threat from ${source.poiName}`);
    }
  }

  return {
    routeId,
    routeName: routeData.name,
    baseProfitMargin,
    adjustedProfitMargin,
    riskAdjustedValue,
    recommendedAction,
    riskFactors,
  };
}
