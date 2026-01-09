import { z } from "zod";
import {
  Caravan,
  TradeRouteProgram,
  TradingCompany,
  TransportMode,
  TRANSPORT_SPECS,
  ArbitrageOpportunity,
} from "./schema";

// ============================================
// LOGISTICS ENGINE
// ============================================
//
// Routes are programs. Caravans execute them.
// The engine ticks caravans forward through their routes.
//
// Turn substrate:
//   1 slot = 600 turns = 30 minutes
//   1 day = 48 slots
//   Caravan position updates per slot
//

export const SLOTS_PER_DAY = 48;

// ============================================
// CARAVAN TICK RESULT
// ============================================

export const CaravanTickResultSchema = z.object({
  caravanId: z.string().uuid(),

  // What happened
  events: z.array(z.object({
    type: z.enum([
      "departed",
      "arrived",
      "loaded_cargo",
      "unloaded_cargo",
      "bought_commodity",
      "sold_commodity",
      "resupplied",
      "rested",
      "encountered_hazard",
      "weather_delay",
      "breakdown",
      "attacked",
      "completed_circuit",
    ]),
    description: z.string(),
    data: z.record(z.string(), z.unknown()).optional(),
  })).default([]),

  // Position change
  previousNode: z.number().int().optional(),
  currentNode: z.number().int(),
  progressOnEdge: z.number().min(0).max(1).optional(),

  // Cargo changes
  cargoLoaded: z.record(z.string(), z.number()).default({}),
  cargoUnloaded: z.record(z.string(), z.number()).default({}),

  // Financial changes
  revenue: z.number().default(0),
  expenses: z.number().default(0),

  // Status change
  newStatus: z.string().optional(),

  // Problems
  newProblems: z.array(z.object({
    type: z.string(),
    severity: z.string(),
    description: z.string(),
  })).default([]),

  processedAt: z.string(),
  slotsProcessed: z.number().int(),
});
export type CaravanTickResult = z.infer<typeof CaravanTickResultSchema>;

// ============================================
// LOGISTICS ENGINE CLASS
// ============================================

export class LogisticsEngine {

  /**
   * Tick a caravan forward by N slots.
   */
  static tickCaravan(
    caravan: Caravan,
    route: TradeRouteProgram,
    slotsElapsed: number = 1,
    marketPrices: Map<string, Map<string, number>>, // settlementId -> commodityId -> price
    random: () => number = Math.random
  ): CaravanTickResult {
    const events: CaravanTickResult["events"] = [];
    const cargoLoaded: Record<string, number> = {};
    const cargoUnloaded: Record<string, number> = {};
    let revenue = 0;
    let expenses = 0;
    let newStatus: string | undefined;
    const newProblems: CaravanTickResult["newProblems"] = [];

    // Get transport specs
    const mode = this.getCaravanMode(caravan);
    const specs = TRANSPORT_SPECS[mode];

    // ─────────────────────────────────────────
    // IN TRANSIT - Move along edge
    // ─────────────────────────────────────────

    if (caravan.inTransit && caravan.transitFromOrder !== undefined && caravan.transitToOrder !== undefined) {
      const edge = route.edges.find(
        e => e.fromOrder === caravan.transitFromOrder && e.toOrder === caravan.transitToOrder
      );

      if (edge) {
        // Calculate progress
        const milesPerSlot = specs.milesPerDay / SLOTS_PER_DAY;
        const slotsForEdge = edge.distance / milesPerSlot;
        const progressPerSlot = 1 / slotsForEdge;

        let newProgress = caravan.transitProgress + (progressPerSlot * slotsElapsed);

        // Check for hazards
        if (random() < this.calculateHazardChance(edge.dangerLevel, specs.riskModifier, slotsElapsed)) {
          const hazard = this.generateHazard(edge.dangerLevel, random);
          events.push({
            type: "encountered_hazard",
            description: hazard.description,
            data: { hazardType: hazard.type, severity: hazard.severity },
          });

          newProblems.push({
            type: hazard.type,
            severity: hazard.severity,
            description: hazard.description,
          });

          // Hazards slow progress
          newProgress *= 0.8;

          // Severe hazards may cause losses
          if (hazard.severity === "severe" || hazard.severity === "critical") {
            const lossRate = hazard.severity === "critical" ? 0.3 : 0.1;
            for (const cargo of caravan.cargo) {
              cargoUnloaded[cargo.commodityId] = (cargoUnloaded[cargo.commodityId] || 0) +
                Math.floor(cargo.quantity * lossRate);
            }
          }
        }

        // Daily expenses while traveling
        const daysElapsed = slotsElapsed / SLOTS_PER_DAY;
        expenses += this.calculateDailyExpenses(caravan, specs) * daysElapsed;

        // Toll at edge start
        if (caravan.transitProgress === 0) {
          expenses += edge.tolls;
        }

        // Check if arrived
        if (newProgress >= 1) {
          newProgress = 0;
          const toNode = route.nodes.find(n => n.order === caravan.transitToOrder);

          events.push({
            type: "arrived",
            description: `Arrived at ${toNode?.settlementName || 'destination'}`,
            data: { settlementId: toNode?.settlementId },
          });

          return {
            caravanId: caravan.id,
            events,
            previousNode: caravan.transitFromOrder,
            currentNode: caravan.transitToOrder!,
            cargoLoaded,
            cargoUnloaded,
            revenue,
            expenses,
            newStatus: "arrived",
            newProblems,
            processedAt: new Date().toISOString(),
            slotsProcessed: slotsElapsed,
          };
        }

        return {
          caravanId: caravan.id,
          events,
          currentNode: caravan.currentNodeOrder,
          progressOnEdge: newProgress,
          cargoLoaded,
          cargoUnloaded,
          revenue,
          expenses,
          newProblems,
          processedAt: new Date().toISOString(),
          slotsProcessed: slotsElapsed,
        };
      }
    }

    // ─────────────────────────────────────────
    // AT NODE - Execute node actions
    // ─────────────────────────────────────────

    const currentNode = route.nodes.find(n => n.order === caravan.currentNodeOrder);
    if (!currentNode) {
      throw new Error(`Caravan at invalid node order: ${caravan.currentNodeOrder}`);
    }

    const settlementPrices = marketPrices.get(currentNode.settlementId) || new Map();

    // Execute actions based on caravan status
    for (const action of currentNode.actions) {
      switch (action.type) {
        case "buy":
          if (action.commodityId) {
            const price = settlementPrices.get(action.commodityId) || 0;
            if (action.priceThreshold === undefined || price <= action.priceThreshold) {
              const quantity = Math.min(
                action.quantity || Infinity,
                this.getRemainingCapacity(caravan, specs)
              );
              if (quantity > 0) {
                const cost = price * quantity;
                cargoLoaded[action.commodityId] = quantity;
                expenses += cost;
                events.push({
                  type: "bought_commodity",
                  description: `Bought ${quantity} ${action.commodityId} at ${price}gp each`,
                  data: { commodityId: action.commodityId, quantity, price },
                });
              }
            }
          }
          break;

        case "sell":
          if (action.commodityId) {
            const price = settlementPrices.get(action.commodityId) || 0;
            if (action.priceThreshold === undefined || price >= action.priceThreshold) {
              const cargoItem = caravan.cargo.find(c => c.commodityId === action.commodityId);
              if (cargoItem) {
                const quantity = Math.min(action.quantity || cargoItem.quantity, cargoItem.quantity);
                const saleRevenue = price * quantity;
                cargoUnloaded[action.commodityId] = quantity;
                revenue += saleRevenue;
                events.push({
                  type: "sold_commodity",
                  description: `Sold ${quantity} ${action.commodityId} at ${price}gp each`,
                  data: { commodityId: action.commodityId, quantity, price },
                });
              }
            }
          }
          break;

        case "load":
          // For movers - load freight
          if (action.commodityId && action.quantity) {
            cargoLoaded[action.commodityId] = action.quantity;
            events.push({
              type: "loaded_cargo",
              description: `Loaded ${action.quantity} ${action.commodityId}`,
              data: { commodityId: action.commodityId, quantity: action.quantity },
            });
          }
          break;

        case "unload":
          // For movers - deliver freight
          if (action.commodityId) {
            const cargoItem = caravan.cargo.find(c => c.commodityId === action.commodityId);
            if (cargoItem) {
              const quantity = action.quantity || cargoItem.quantity;
              cargoUnloaded[action.commodityId] = quantity;
              events.push({
                type: "unloaded_cargo",
                description: `Unloaded ${quantity} ${action.commodityId}`,
                data: { commodityId: action.commodityId, quantity },
              });
            }
          }
          break;

        case "resupply":
          expenses += this.calculateResupplyCost(caravan);
          events.push({
            type: "resupplied",
            description: "Restocked provisions",
          });
          break;

        case "rest":
          events.push({
            type: "rested",
            description: "Crew rested",
          });
          break;
      }
    }

    // Determine next action - depart to next node
    const nextNodeOrder = this.getNextNodeOrder(route, caravan.currentNodeOrder);
    if (nextNodeOrder !== null) {
      events.push({
        type: "departed",
        description: `Departing for ${route.nodes.find(n => n.order === nextNodeOrder)?.settlementName}`,
      });
      newStatus = "traveling";
    } else {
      // Completed circuit
      events.push({
        type: "completed_circuit",
        description: `Completed circuit #${caravan.circuitNumber}`,
      });
      newStatus = "preparing";
    }

    return {
      caravanId: caravan.id,
      events,
      previousNode: caravan.currentNodeOrder,
      currentNode: nextNodeOrder ?? caravan.currentNodeOrder,
      cargoLoaded,
      cargoUnloaded,
      revenue,
      expenses,
      newStatus,
      newProblems,
      processedAt: new Date().toISOString(),
      slotsProcessed: slotsElapsed,
    };
  }

  /**
   * Find arbitrage opportunities between two settlements.
   */
  static findArbitrageOpportunities(
    buyMarket: { settlementId: string; settlementName: string; prices: Map<string, { price: number; supply: number }> },
    sellMarket: { settlementId: string; settlementName: string; prices: Map<string, { price: number; demand: number }> },
    route: { distance: number; dangerLevel: string; travelDays: number; routeId?: string },
    transportMode: TransportMode
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const specs = TRANSPORT_SPECS[transportMode];

    for (const [commodityId, buyData] of Array.from(buyMarket.prices.entries())) {
      const sellData = sellMarket.prices.get(commodityId);
      if (!sellData) continue;

      const priceDifferential = sellData.price - buyData.price;
      if (priceDifferential <= 0) continue;

      // Transport cost
      const transportCost = route.distance * specs.baseCostPerMile;
      const netProfitPerUnit = priceDifferential - transportCost;

      if (netProfitPerUnit <= 0) continue;

      // Max quantity is limited by supply and demand
      const maxQuantity = Math.min(buyData.supply, sellData.demand);
      const totalPotentialProfit = netProfitPerUnit * maxQuantity;
      const investment = buyData.price * maxQuantity;
      const roi = investment > 0 ? (totalPotentialProfit / investment) * 100 : 0;

      // Risk adjustment
      const riskMultiplier = {
        safe: 1.0,
        patrolled: 0.95,
        risky: 0.8,
        dangerous: 0.6,
        deadly: 0.3,
      }[route.dangerLevel] || 0.5;

      opportunities.push({
        id: crypto.randomUUID(),
        commodityId,
        commodityName: commodityId,
        buySettlementId: buyMarket.settlementId,
        buySettlementName: buyMarket.settlementName,
        buyPrice: buyData.price,
        buyQuantityAvailable: buyData.supply,
        sellSettlementId: sellMarket.settlementId,
        sellSettlementName: sellMarket.settlementName,
        sellPrice: sellData.price,
        sellDemand: sellData.demand,
        routeId: route.routeId,
        distanceMiles: route.distance,
        travelDays: route.travelDays,
        priceDifferential,
        transportCost,
        netProfitPerUnit,
        totalPotentialProfit,
        returnOnInvestment: roi,
        routeRisk: route.dangerLevel as ArbitrageOpportunity["routeRisk"],
        riskAdjustedProfit: totalPotentialProfit * riskMultiplier,
        discoveredAt: new Date().toISOString(),
        knownTo: [],
        publicKnowledge: false,
      });
    }

    // Sort by risk-adjusted profit
    return opportunities.sort((a, b) => b.riskAdjustedProfit - a.riskAdjustedProfit);
  }

  /**
   * Calculate freight rate for a contract.
   */
  static calculateFreightRate(
    weight: number,
    distance: number,
    dangerLevel: string,
    transportMode: TransportMode,
    urgency: "normal" | "rush" | "emergency" = "normal"
  ): { baseRate: number; riskPremium: number; urgencyPremium: number; totalRate: number } {
    const specs = TRANSPORT_SPECS[transportMode];

    // Base rate: weight × distance × rate per mile
    const baseRate = (weight / specs.capacityLbs) * distance * specs.baseCostPerMile * 10; // 10x for profit

    // Risk premium
    const riskMultiplier = {
      safe: 1.0,
      patrolled: 1.1,
      risky: 1.3,
      dangerous: 1.6,
      deadly: 2.5,
    }[dangerLevel] || 1.5;
    const riskPremium = baseRate * (riskMultiplier - 1);

    // Urgency premium
    const urgencyMultiplier = {
      normal: 1.0,
      rush: 1.5,
      emergency: 3.0,
    }[urgency];
    const urgencyPremium = baseRate * (urgencyMultiplier - 1);

    return {
      baseRate,
      riskPremium,
      urgencyPremium,
      totalRate: baseRate + riskPremium + urgencyPremium,
    };
  }

  // ─────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────

  private static getCaravanMode(_caravan: Caravan): TransportMode {
    // Default to wagon if no fleet info
    return "wagon";
  }

  private static getRemainingCapacity(caravan: Caravan, specs: typeof TRANSPORT_SPECS[TransportMode]): number {
    const usedWeight = caravan.totalCargoWeight || 0;
    return Math.max(0, specs.capacityLbs - usedWeight);
  }

  private static calculateDailyExpenses(caravan: Caravan, specs: typeof TRANSPORT_SPECS[TransportMode]): number {
    // Crew wages + provisions + maintenance
    const crewCost = caravan.crewCount * 1; // 1gp/day per crew
    const guardCost = caravan.guardCount * 2; // 2gp/day per guard
    const provisionsCost = (caravan.crewCount + caravan.guardCount) * 0.5; // 0.5gp/day food
    const maintenanceCost = specs.baseCostPerMile * 10; // Rough estimate

    return crewCost + guardCost + provisionsCost + maintenanceCost;
  }

  private static calculateResupplyCost(caravan: Caravan): number {
    const people = caravan.crewCount + caravan.guardCount;
    return people * 7 * 0.5; // 1 week of provisions at 0.5gp/day
  }

  private static getNextNodeOrder(route: TradeRouteProgram, currentOrder: number): number | null {
    const currentNodeIndex = route.nodes.findIndex(n => n.order === currentOrder);

    switch (route.routeType) {
      case "circuit":
        return route.nodes[(currentNodeIndex + 1) % route.nodes.length].order;

      case "shuttle":
        if (currentNodeIndex === route.nodes.length - 1) {
          return route.nodes[0].order; // Go back
        }
        return route.nodes[currentNodeIndex + 1].order;

      case "one_way":
        if (currentNodeIndex === route.nodes.length - 1) {
          return null; // End of route
        }
        return route.nodes[currentNodeIndex + 1].order;

      case "hub_spoke":
        // Always return to hub (node 0)
        if (currentOrder === route.nodes[0].order) {
          // At hub, go to next spoke
          const nextSpoke = route.nodes.find((n, i) => i > 0 && !this.hasVisitedThisCircuit(route, currentOrder, n.order));
          return nextSpoke?.order || null;
        }
        return route.nodes[0].order;

      default:
        return null;
    }
  }

  private static hasVisitedThisCircuit(_route: TradeRouteProgram, _hubOrder: number, _spokeOrder: number): boolean {
    // Placeholder - would need caravan state
    return false;
  }

  private static calculateHazardChance(dangerLevel: string, riskModifier: number, slots: number): number {
    const baseChance = {
      safe: 0.001,
      patrolled: 0.005,
      risky: 0.02,
      dangerous: 0.05,
      deadly: 0.1,
    }[dangerLevel] || 0.01;

    // Chance per slot, adjusted by transport risk modifier
    return baseChance * riskModifier * slots;
  }

  private static generateHazard(dangerLevel: string, random: () => number): {
    type: string;
    severity: string;
    description: string;
  } {
    const hazards = {
      safe: [
        { type: "weather_delay", severity: "minor", description: "Light rain slowed travel" },
      ],
      patrolled: [
        { type: "weather_delay", severity: "minor", description: "Muddy roads slowed progress" },
        { type: "breakdown", severity: "minor", description: "Wheel needed repair" },
      ],
      risky: [
        { type: "bandit_attack", severity: "moderate", description: "Bandits attempted robbery" },
        { type: "breakdown", severity: "moderate", description: "Axle broke" },
        { type: "weather_delay", severity: "moderate", description: "Storm forced shelter" },
      ],
      dangerous: [
        { type: "bandit_attack", severity: "severe", description: "Large bandit group attacked" },
        { type: "monster_attack", severity: "moderate", description: "Wolves attacked at night" },
        { type: "cargo_spoiled", severity: "moderate", description: "Some cargo was damaged" },
      ],
      deadly: [
        { type: "monster_attack", severity: "severe", description: "Ogres attacked the caravan" },
        { type: "bandit_attack", severity: "critical", description: "Organized bandits ambushed" },
        { type: "monster_attack", severity: "critical", description: "Dragon spotted nearby" },
      ],
    };

    const options = hazards[dangerLevel as keyof typeof hazards] || hazards.risky;
    return options[Math.floor(random() * options.length)];
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Apply caravan tick result to update caravan state.
 */
export function applyCaravanTickResult(
  caravan: Caravan,
  result: CaravanTickResult
): Caravan {
  const updated = { ...caravan };

  // Update position
  updated.currentNodeOrder = result.currentNode;

  if (result.progressOnEdge !== undefined) {
    updated.inTransit = true;
    updated.transitProgress = result.progressOnEdge;
  } else {
    updated.inTransit = false;
    updated.transitProgress = 0;
  }

  // Update cargo
  for (const [commodityId, quantity] of Object.entries(result.cargoLoaded)) {
    const existing = updated.cargo.find(c => c.commodityId === commodityId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      updated.cargo.push({
        commodityId,
        quantity,
        weightLbs: quantity, // Assume 1 lb per unit, adjust as needed
        value: 0,
        origin: "",
      });
    }
  }

  for (const [commodityId, quantity] of Object.entries(result.cargoUnloaded)) {
    const existing = updated.cargo.find(c => c.commodityId === commodityId);
    if (existing) {
      existing.quantity -= quantity;
      if (existing.quantity <= 0) {
        updated.cargo = updated.cargo.filter(c => c.commodityId !== commodityId);
      }
    }
  }

  // Update financials
  updated.runRevenue += result.revenue;
  updated.runExpenses += result.expenses;
  updated.runProfit = updated.runRevenue - updated.runExpenses;

  // Update status
  if (result.newStatus) {
    updated.status = result.newStatus as Caravan["status"];
  }

  // Add problems
  for (const problem of result.newProblems) {
    updated.problems.push({
      type: problem.type as Caravan["problems"][0]["type"],
      severity: problem.severity as Caravan["problems"][0]["severity"],
      description: problem.description,
      occurredAt: result.processedAt,
      resolved: false,
    });
  }

  // Recalculate totals
  updated.totalCargoWeight = updated.cargo.reduce((sum, c) => sum + c.weightLbs, 0);
  updated.totalCargoValue = updated.cargo.reduce((sum, c) => sum + c.value, 0);

  updated.updatedAt = result.processedAt;

  return updated;
}

/**
 * Create a new caravan to execute a route.
 */
export function createCaravan(
  route: TradeRouteProgram,
  company: TradingCompany,
  fleetIds: string[]
): Caravan {
  const now = new Date().toISOString();
  const startNode = route.nodes.find(n => n.order === 0) || route.nodes[0];

  return {
    id: crypto.randomUUID(),
    routeId: route.id,
    routeName: route.name,
    companyId: company.id,
    companyName: company.name,
    fleetIds,
    currentNodeOrder: startNode.order,
    currentSettlementId: startNode.settlementId,
    currentSettlementName: startNode.settlementName,
    inTransit: false,
    transitProgress: 0,
    cargo: [],
    totalCargoWeight: 0,
    totalCargoValue: 0,
    crewCount: 0,
    guardCount: 0,
    provisions: { food: 0, water: 0, fodder: 0 },
    status: "preparing",
    problems: [],
    circuitNumber: 1,
    circuitStartedAt: now,
    runRevenue: 0,
    runExpenses: 0,
    runProfit: 0,
    createdAt: now,
    updatedAt: now,
  };
}
