import type {
  EconomicIntervention,
  BlackMarket,
  BlackMarketGoodsCategory,
  Crackdown,
  CorruptOfficial,
  SmugglingRoute,
} from "./control";
import {
  calculateBlackMarketPrice,
  applyInterventionsToMarket,
  calculateInterventionUnrest,
  calculateInterventionRevenue,
  BLACK_MARKET_MULTIPLIERS,
} from "./control";

// ============================================
// FACTION CONTROL ENGINE
// ============================================
//
// The engine that makes factions shape the economy.
//
// Every tick:
//   1. Apply faction interventions to prices
//   2. Calculate faction revenues
//   3. Update black market state
//   4. Process crackdowns
//   5. Generate control events
//

// ============================================
// CONTROL TICK RESULT
// ============================================

export interface ControlTickResult {
  // Modified prices
  modifiedPrices: Record<string, {
    originalPrice: number;
    modifiedPrice: number;
    modifiers: Array<{ source: string; effect: number }>;
    restricted: boolean;
    banned: boolean;
  }>;

  // Faction revenues
  factionRevenues: Array<{
    factionId: string;
    factionName: string;
    interventionId: string;
    interventionName: string;
    revenue: number;
  }>;

  // Unrest changes
  unrestChanges: Array<{
    settlementId: string;
    previousUnrest: number;
    newUnrest: number;
    sources: string[];
  }>;

  // Black market updates
  blackMarketUpdates: Array<{
    marketId: string;
    settlementName: string;
    heatChange: number;
    newGoods: string[];
    priceChanges: Array<{ good: string; oldPrice: number; newPrice: number }>;
  }>;

  // Crackdown results
  crackdownResults: Array<{
    crackdownId: string;
    success: boolean;
    description: string;
  }>;

  // Events/news
  controlEvents: Array<{
    type: string;
    description: string;
    affectedSettlements: string[];
    publicKnowledge: boolean;
  }>;
}

// ============================================
// MAIN TICK FUNCTION
// ============================================

export function tickFactionControl(
  interventions: EconomicIntervention[],
  blackMarkets: BlackMarket[],
  crackdowns: Crackdown[],
  corruptOfficials: CorruptOfficial[],
  smugglingRoutes: SmugglingRoute[],
  marketData: Record<string, {
    settlementId: string;
    settlementName: string;
    prices: Record<string, { price: number; supply: number; demand: number }>;
    weeklyVolume: number;
    currentUnrest: number;
  }>,
  daysElapsed: number = 7,
): ControlTickResult {
  const result: ControlTickResult = {
    modifiedPrices: {},
    factionRevenues: [],
    unrestChanges: [],
    blackMarketUpdates: [],
    crackdownResults: [],
    controlEvents: [],
  };

  // ─────────────────────────────────────────
  // 1. APPLY INTERVENTIONS TO EACH MARKET
  // ─────────────────────────────────────────

  for (const [marketId, market] of Object.entries(marketData)) {
    const modifiedPrices = applyInterventionsToMarket(
      market.prices,
      interventions,
      market.settlementId
    );

    // Store modified prices
    for (const [commodityId, modified] of Object.entries(modifiedPrices)) {
      result.modifiedPrices[`${marketId}:${commodityId}`] = {
        originalPrice: market.prices[commodityId]?.price || 0,
        modifiedPrice: modified.price,
        modifiers: modified.modifiers,
        restricted: modified.restricted,
        banned: modified.banned,
      };

      // Generate events for significant price changes
      const original = market.prices[commodityId]?.price || modified.price;
      const changePercent = Math.abs((modified.price - original) / original) * 100;

      if (changePercent > 20) {
        result.controlEvents.push({
          type: "price_intervention",
          description: `${commodityId} prices ${modified.price > original ? 'raised' : 'lowered'} by faction intervention in ${market.settlementName}`,
          affectedSettlements: [market.settlementId],
          publicKnowledge: true,
        });
      }

      if (modified.banned) {
        result.controlEvents.push({
          type: "goods_banned",
          description: `${commodityId} has been banned in ${market.settlementName}`,
          affectedSettlements: [market.settlementId],
          publicKnowledge: true,
        });
      }
    }

    // Calculate unrest from interventions
    const interventionUnrest = calculateInterventionUnrest(interventions, market.settlementId);
    const previousUnrest = market.currentUnrest;
    const newUnrest = Math.min(100, previousUnrest + interventionUnrest * 0.1 * (daysElapsed / 7));

    if (Math.abs(newUnrest - previousUnrest) > 1) {
      result.unrestChanges.push({
        settlementId: market.settlementId,
        previousUnrest,
        newUnrest,
        sources: interventions
          .filter(i => i.status === "active")
          .map(i => i.name),
      });
    }
  }

  // ─────────────────────────────────────────
  // 2. CALCULATE FACTION REVENUES
  // ─────────────────────────────────────────

  for (const intervention of interventions) {
    if (intervention.status !== "active") continue;

    // Sum volume of affected markets
    let totalVolume = 0;
    for (const market of Object.values(marketData)) {
      const applies =
        intervention.scope.type === "global" ||
        intervention.scope.targetIds.includes(market.settlementId);

      if (applies) {
        totalVolume += market.weeklyVolume * (daysElapsed / 7);
      }
    }

    const revenue = calculateInterventionRevenue(intervention, totalVolume);

    if (revenue > 0) {
      result.factionRevenues.push({
        factionId: intervention.factionId,
        factionName: intervention.factionName,
        interventionId: intervention.id,
        interventionName: intervention.name,
        revenue,
      });
    }
  }

  // ─────────────────────────────────────────
  // 3. UPDATE BLACK MARKETS
  // ─────────────────────────────────────────

  for (const blackMarket of blackMarkets) {
    if (blackMarket.status === "destroyed") continue;

    const market = Object.values(marketData).find(
      m => m.settlementId === blackMarket.settlementId
    );
    if (!market) continue;

    const update: ControlTickResult["blackMarketUpdates"][0] = {
      marketId: blackMarket.id,
      settlementName: blackMarket.settlementName,
      heatChange: 0,
      newGoods: [],
      priceChanges: [],
    };

    // Check for banned goods creating black market opportunity
    for (const [commodityId, data] of Object.entries(result.modifiedPrices)) {
      if (!commodityId.startsWith(`${market.settlementId}:`)) continue;

      if (data.banned) {
        // Banned goods flow to black market
        const cleanCommodityId = commodityId.split(':')[1];
        const existingGood = blackMarket.goods.find(g => g.commodityId === cleanCommodityId);

        if (!existingGood) {
          update.newGoods.push(cleanCommodityId);
          result.controlEvents.push({
            type: "black_market_expansion",
            description: `${cleanCommodityId} now available on black market in ${blackMarket.settlementName}`,
            affectedSettlements: [blackMarket.settlementId],
            publicKnowledge: false,
          });
        }
      }
    }

    // Update black market prices based on heat
    for (const good of blackMarket.goods) {
      const oldPrice = good.blackMarketPrice;
      const newPrice = calculateBlackMarketPrice(
        good.basePrice,
        good.category,
        blackMarket,
        0.5  // Default supply level
      );

      if (Math.abs(newPrice - oldPrice) > oldPrice * 0.1) {
        update.priceChanges.push({
          good: good.name,
          oldPrice,
          newPrice,
        });
      }
    }

    // Natural heat decay
    update.heatChange = -Math.floor(daysElapsed * 0.5);

    // Heat from recent crackdowns
    const recentCrackdowns = crackdowns.filter(
      c => c.settlementId === blackMarket.settlementId &&
           c.status === "completed" &&
           c.outcome?.success
    );

    for (const crackdown of recentCrackdowns) {
      update.heatChange += crackdown.outcome?.heatIncrease || 0;
    }

    if (update.heatChange !== 0 || update.newGoods.length > 0 || update.priceChanges.length > 0) {
      result.blackMarketUpdates.push(update);
    }
  }

  // ─────────────────────────────────────────
  // 4. PROCESS CRACKDOWNS
  // ─────────────────────────────────────────

  for (const crackdown of crackdowns) {
    if (crackdown.status !== "in_progress") continue;

    const blackMarket = blackMarkets.find(
      m => m.settlementId === crackdown.settlementId
    );

    // Simulate crackdown
    const crackdownResult = simulateCrackdown(crackdown, blackMarket, corruptOfficials);
    result.crackdownResults.push(crackdownResult);

    if (crackdownResult.success) {
      result.controlEvents.push({
        type: "crackdown_success",
        description: crackdownResult.description,
        affectedSettlements: [crackdown.settlementId],
        publicKnowledge: true,
      });
    } else if (crackdown.wasLeaked) {
      result.controlEvents.push({
        type: "crackdown_leaked",
        description: `Planned crackdown in ${crackdown.target.name} was leaked - criminals escaped`,
        affectedSettlements: [crackdown.settlementId],
        publicKnowledge: false,
      });
    }
  }

  // ─────────────────────────────────────────
  // 5. SMUGGLING ROUTE ACTIVITY
  // ─────────────────────────────────────────

  for (const route of smugglingRoutes) {
    if (route.status !== "active") continue;

    // Check if route evades interventions
    const relevantInterventions = interventions.filter(i =>
      i.status === "active" &&
      (i.scope.type === "route" && i.scope.targetIds.includes(route.id)) ||
      (i.type === "embargo" || i.type === "tariff")
    );

    if (relevantInterventions.length > 0 && route.currentVolume > 0) {
      // Smuggling activity detected?
      const detectionRoll = Math.random();

      if (detectionRoll < route.detectionChance) {
        result.controlEvents.push({
          type: "smuggling_detected",
          description: `Smuggling activity detected on route: ${route.name}`,
          affectedSettlements: [route.origin.settlementId, route.destination.settlementId],
          publicKnowledge: false,
        });
      }
    }
  }

  return result;
}

// ============================================
// CRACKDOWN SIMULATION
// ============================================

function simulateCrackdown(
  crackdown: Crackdown,
  blackMarket: BlackMarket | undefined,
  corruptOfficials: CorruptOfficial[],
): { crackdownId: string; success: boolean; description: string } {
  // Base success chance based on resources
  let successChance = 0.3;

  successChance += crackdown.resources.guards * 0.02;
  successChance += crackdown.resources.investigators * 0.05;
  successChance += crackdown.resources.gold * 0.0001;

  // Corrupt officials can sabotage
  const corruptInvolved = corruptOfficials.filter(o =>
    o.settlementId === crackdown.settlementId &&
    o.status === "active" &&
    o.protects.length > 0
  );

  for (const _corrupt of corruptInvolved) {
    successChance -= 0.1;  // Each corrupt official reduces success
  }

  // Black market size affects difficulty
  if (blackMarket) {
    const sizeModifiers: Record<string, number> = {
      tiny: 0.2,
      small: 0.1,
      moderate: 0,
      large: -0.1,
      dominant: -0.2,
    };
    successChance += sizeModifiers[blackMarket.size] || 0;
  }

  // Was it leaked?
  if (crackdown.wasLeaked) {
    successChance -= 0.4;  // Major penalty
  }

  // Roll for success
  const success = Math.random() < Math.max(0.05, Math.min(0.95, successChance));

  let description: string;
  if (success) {
    const arrests = Math.floor(Math.random() * 10) + 1;
    const seized = Math.floor(Math.random() * 1000) + 100;
    description = `Crackdown on ${crackdown.target.name} successful: ${arrests} arrests, ${seized}gp in goods seized`;
  } else {
    if (crackdown.wasLeaked) {
      description = `Crackdown on ${crackdown.target.name} failed - targets fled before raid`;
    } else {
      description = `Crackdown on ${crackdown.target.name} failed - insufficient evidence or resources`;
    }
  }

  return {
    crackdownId: crackdown.id,
    success,
    description,
  };
}

// ============================================
// BLACK MARKET DISCOVERY
// ============================================

export interface BlackMarketSearchResult {
  found: boolean;
  contactFound?: {
    npcId: string;
    name: string;
    specialty: BlackMarketGoodsCategory[];
    trustLevel: "suspicious" | "cautious" | "open";
    initialOffer?: string;
  };
  location?: {
    name: string;
    type: string;
    accessInstructions: string;
  };
  complication?: string;
  heatGenerated: number;
}

/**
 * Simulate a character searching for the black market.
 */
export function searchForBlackMarket(
  blackMarket: BlackMarket,
  searcherSkill: number,        // Investigation/Streetwise modifier
  searcherReputation: number,   // 0-100 criminal reputation
  searchMethod: "tavern_gossip" | "follow_criminal" | "bribe_guard" | "contact_fence",
  hoursSpent: number,
): BlackMarketSearchResult {
  const result: BlackMarketSearchResult = {
    found: false,
    heatGenerated: 0,
  };

  // Base DC from market access difficulty
  let dc = blackMarket.accessDifficulty.findContactDC;

  // Method modifiers
  const methodModifiers: Record<string, { dcMod: number; heatMod: number }> = {
    tavern_gossip: { dcMod: 0, heatMod: 1 },
    follow_criminal: { dcMod: -2, heatMod: 3 },
    bribe_guard: { dcMod: -5, heatMod: 5 },
    contact_fence: { dcMod: -3, heatMod: 2 },
  };

  const method = methodModifiers[searchMethod];
  dc += method.dcMod;
  result.heatGenerated = method.heatMod;

  // Time spent helps
  dc -= Math.floor(hoursSpent / 2);

  // Reputation helps
  dc -= Math.floor(searcherReputation / 20);

  // Roll (simulated as skill + d20)
  const roll = Math.floor(Math.random() * 20) + 1 + searcherSkill;

  if (roll >= dc) {
    result.found = true;

    // Find a contact
    if (blackMarket.fences.length > 0) {
      const fence = blackMarket.fences[Math.floor(Math.random() * blackMarket.fences.length)];

      result.contactFound = {
        npcId: fence.npcId,
        name: fence.name,
        specialty: fence.specialty,
        trustLevel: searcherReputation > 50 ? "open" :
                    searcherReputation > 25 ? "cautious" : "suspicious",
        initialOffer: fence.specialty.length > 0
          ? `"Looking for ${fence.specialty[0]}? I might know someone..."`
          : undefined,
      };
    }

    // Find a location
    const knownLocations = blackMarket.locations.filter(l => !l.knownToParty);
    if (knownLocations.length > 0) {
      const location = knownLocations[Math.floor(Math.random() * knownLocations.length)];
      result.location = {
        name: location.name,
        type: location.type,
        accessInstructions: `Available ${location.operatingHours}. Use the phrase "looking for exotic goods."`,
      };
    }
  } else if (roll < dc - 5) {
    // Failed badly - complication
    const complications = [
      "You asked the wrong person - they're an informant",
      "A guard noticed your inquiries",
      "Someone thinks you're a rival and sends a warning",
      "You find a fake black market (scam operation)",
    ];
    result.complication = complications[Math.floor(Math.random() * complications.length)];
    result.heatGenerated += 5;
  }

  return result;
}

// ============================================
// BRIBE RESOLUTION
// ============================================

export interface BribeResult {
  success: boolean;
  outcome: string;
  costPaid: number;
  serviceProvided?: string;
  complication?: string;
  relationshipChange: number;  // With official
  heatGenerated: number;
}

/**
 * Attempt to bribe an official.
 */
export function attemptBribe(
  official: CorruptOfficial,
  bribeAmount: number,
  serviceRequested: string,
  briber: {
    charismaModifier: number;
    reputation: number;  // Criminal reputation
    previousBribes: number;  // Times bribed this official
  },
): BribeResult {
  // Find the service
  const service = official.services.find(s =>
    s.service.toLowerCase().includes(serviceRequested.toLowerCase())
  );

  if (!service) {
    return {
      success: false,
      outcome: `${official.name} cannot help with that request`,
      costPaid: 0,
      relationshipChange: -5,
      heatGenerated: 2,
    };
  }

  // Check if bribe is sufficient
  const requiredAmount = service.baseCost * (1 + official.suspicionLevel / 100);

  if (bribeAmount < requiredAmount * 0.5) {
    return {
      success: false,
      outcome: `${official.name} is insulted by the paltry offer`,
      costPaid: 0,
      relationshipChange: -10,
      heatGenerated: 3,
      complication: Math.random() < 0.2 ? "The official reports your bribe attempt" : undefined,
    };
  }

  // Calculate success chance
  let successChance = 0.5;

  // Corruption level
  const corruptionBonus: Record<string, number> = {
    opportunistic: 0,
    regular: 0.2,
    deep: 0.3,
    total: 0.4,
  };
  successChance += corruptionBonus[official.corruptionLevel] || 0;

  // Bribe amount vs required
  if (bribeAmount >= requiredAmount) {
    successChance += 0.2;
  }
  if (bribeAmount >= requiredAmount * 1.5) {
    successChance += 0.1;
  }

  // Previous relationship
  successChance += briber.previousBribes * 0.05;

  // Charisma helps
  successChance += briber.charismaModifier * 0.02;

  // Service risk reduces chance
  const riskPenalty: Record<string, number> = {
    low: 0,
    medium: -0.1,
    high: -0.2,
  };
  successChance += riskPenalty[service.riskToOfficial] || 0;

  // Roll
  const success = Math.random() < Math.max(0.1, Math.min(0.9, successChance));

  if (success) {
    return {
      success: true,
      outcome: `${official.name} agrees to ${service.service}`,
      costPaid: Math.max(bribeAmount, requiredAmount),
      serviceProvided: service.service,
      relationshipChange: 5,
      heatGenerated: 1,
    };
  } else {
    // Failed but not reported (usually)
    const reported = Math.random() < 0.1 && official.corruptionLevel === "opportunistic";

    return {
      success: false,
      outcome: `${official.name} refuses - too risky right now`,
      costPaid: 0,
      relationshipChange: 0,
      heatGenerated: reported ? 10 : 2,
      complication: reported ? "The official reports your bribe attempt to their superiors" : undefined,
    };
  }
}

// ============================================
// SMUGGLING OPERATION
// ============================================

export interface SmugglingResult {
  success: boolean;
  goodsDelivered: number;      // Percentage
  goodsSeized: number;         // GP value
  profitMade: number;
  heatGenerated: number;
  routeCompromised: boolean;
  complication?: string;
}

/**
 * Attempt to smuggle goods along a route.
 */
export function attemptSmuggling(
  route: SmugglingRoute,
  goods: {
    commodityId: string;
    quantity: number;
    value: number;
    category: BlackMarketGoodsCategory;
  },
  smuggler: {
    skill: number;             // Relevant skill modifier
    resources: number;         // GP for bribes etc
  },
  interventions: EconomicIntervention[],
): SmugglingResult {
  // Base success chance
  let successChance = 0.7;

  // Route quality
  if (route.status === "watched") successChance -= 0.2;
  if (route.status === "compromised") successChance -= 0.4;
  if (route.method === "bribed_passage") successChance += 0.1;
  if (route.method === "magical") successChance += 0.2;

  // Goods risk
  const riskMultipliers = BLACK_MARKET_MULTIPLIERS[goods.category];
  if (riskMultipliers) {
    successChance -= riskMultipliers.riskPremium * 10;
  }

  // Skill
  successChance += smuggler.skill * 0.03;

  // Enforcement level of relevant interventions
  for (const intervention of interventions) {
    if (intervention.type === "embargo" || intervention.type === "tariff") {
      const enforcementPenalty: Record<string, number> = {
        none: 0,
        minimal: -0.05,
        normal: -0.1,
        strict: -0.2,
        absolute: -0.4,
      };
      successChance += enforcementPenalty[intervention.enforcement.level] || 0;
    }
  }

  // Roll
  const roll = Math.random();

  if (roll < successChance) {
    // Full success
    const profit = goods.value * 0.3;  // 30% profit margin

    return {
      success: true,
      goodsDelivered: 100,
      goodsSeized: 0,
      profitMade: profit - route.costPerShipment,
      heatGenerated: 2,
      routeCompromised: false,
    };
  } else if (roll < successChance + 0.2) {
    // Partial success - some goods lost
    const lostPercent = Math.floor(Math.random() * 40) + 10;
    const delivered = 100 - lostPercent;
    const profit = (goods.value * delivered / 100 * 0.3) - route.costPerShipment;

    return {
      success: true,
      goodsDelivered: delivered,
      goodsSeized: goods.value * lostPercent / 100,
      profitMade: profit,
      heatGenerated: 5,
      routeCompromised: false,
      complication: `${lostPercent}% of goods had to be dumped to avoid detection`,
    };
  } else {
    // Failure
    const seized = Math.floor(Math.random() * 80) + 20;
    const routeCompromised = Math.random() < 0.3;

    const complications = [
      "Smuggler arrested - may talk under interrogation",
      "Guards alerted - increased patrols on route",
      "Goods confiscated and traced back to source",
      "Rival smugglers tipped off the authorities",
    ];

    return {
      success: false,
      goodsDelivered: 100 - seized,
      goodsSeized: goods.value * seized / 100,
      profitMade: -route.costPerShipment,
      heatGenerated: 15,
      routeCompromised,
      complication: complications[Math.floor(Math.random() * complications.length)],
    };
  }
}
