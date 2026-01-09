import { z } from "zod";

// ============================================
// FACTION CONTROL LAYER
// ============================================
//
// Philosophy: THE ECONOMY IS NOT FREE
//
// Factions don't just scheme politically - they shape economics.
// Every tariff, every embargo, every monopoly is a faction decision.
// The free market is a myth. Power flows through control of trade.
//
// This layer sits ABOVE the economic simulation.
// It modifies prices, restricts goods, and creates black markets.
//

// ============================================
// ECONOMIC INTERVENTIONS
// ============================================

export const InterventionTypeSchema = z.enum([
  // Revenue extraction
  "tax",                    // Percentage of all transactions
  "tariff",                 // Import/export surcharge
  "toll",                   // Route access fee
  "tithe",                  // Religious extraction
  "tribute",                // Vassal payment

  // Trade control
  "embargo",                // Block trade with target
  "blockade",               // Physical route closure
  "monopoly",               // Exclusive trade rights
  "price_floor",            // Minimum price (protect producers)
  "price_ceiling",          // Maximum price (protect consumers)
  "rationing",              // Limit purchases per person
  "license_requirement",    // Must have permit to trade

  // Labor control
  "conscription",           // Take workers for military
  "corvée",                 // Forced labor for state
  "guild_mandate",          // Only guild members can work

  // Currency control
  "currency_debasement",    // Reduce precious metal in coins
  "counterfeiting",         // Flood market with fake currency
  "exchange_control",       // Restrict currency conversion

  // Corruption
  "bribery",                // Officials expect payment
  "protection_racket",      // Pay or suffer "accidents"
  "extortion",              // Specific target exploitation
  "graft",                  // Officials skim from transactions
]);
export type InterventionType = z.infer<typeof InterventionTypeSchema>;

export const EconomicInterventionSchema = z.object({
  id: z.string().uuid(),

  // Who imposed it
  factionId: z.string().uuid(),
  factionName: z.string(),

  // What type
  type: InterventionTypeSchema,
  name: z.string(),
  description: z.string(),

  // Scope
  scope: z.object({
    type: z.enum([
      "global",              // All territories
      "regional",            // Specific region
      "settlement",          // Single settlement
      "route",               // Trade route
      "commodity",           // Specific goods
      "faction_target",      // Against another faction
    ]),
    targetIds: z.array(z.string()),
    targetNames: z.array(z.string()),
  }),

  // What's affected
  affectedCommodities: z.array(z.string()).default([]),  // Empty = all

  // Parameters (varies by type)
  parameters: z.object({
    rate: z.number().optional(),           // Percentage for taxes/tariffs
    flatFee: z.number().optional(),        // Fixed amount
    priceModifier: z.number().optional(),  // Multiplier
    quantityLimit: z.number().optional(),  // For rationing
    durationDays: z.number().optional(),   // How long
  }),

  // Enforcement
  enforcement: z.object({
    level: z.enum(["none", "minimal", "normal", "strict", "absolute"]),
    enforcers: z.number().int(),           // Agents enforcing
    penaltyType: z.enum(["fine", "confiscation", "imprisonment", "death"]),
    penaltyAmount: z.number().optional(),  // For fines
    evasionDC: z.number().int(),           // DC to evade
    corruptible: z.boolean().default(true), // Can officials be bribed?
    bribeCost: z.number().optional(),      // Base bribe amount
  }),

  // Revenue/cost
  revenueGenerated: z.number().default(0), // GP per tick
  enforcementCost: z.number().default(0),  // Cost to maintain

  // Effects
  effects: z.array(z.object({
    type: z.enum([
      "price_modifier",
      "supply_modifier",
      "demand_modifier",
      "availability",
      "route_capacity",
      "reputation",
      "unrest",
    ]),
    target: z.string(),
    value: z.number(),
    isMultiplier: z.boolean().default(true),
  })).default([]),

  // Status
  status: z.enum(["proposed", "active", "suspended", "repealed"]).default("active"),
  startDate: z.string(),
  endDate: z.string().optional(),

  // Visibility
  publicKnowledge: z.boolean().default(true),
  knownToFactions: z.array(z.string().uuid()).default([]),

  // Resistance
  resistanceLevel: z.number().int().min(0).max(100).default(0),
  unrestGenerated: z.number().default(0),
});
export type EconomicIntervention = z.infer<typeof EconomicInterventionSchema>;

// ============================================
// INTERVENTION EFFECTS
// ============================================

export const INTERVENTION_EFFECTS: Record<string, {
  priceEffect: (rate: number) => number;
  supplyEffect: (rate: number) => number;
  demandEffect: (rate: number) => number;
  unrestEffect: (rate: number) => number;
  revenueMultiplier: number;
  enforcementCostBase: number;
}> = {
  tax: {
    priceEffect: (rate) => 1 + rate,           // Prices go up by tax rate
    supplyEffect: (rate) => 1 - rate * 0.2,    // Slight supply reduction
    demandEffect: (rate) => 1 - rate * 0.3,    // Demand drops more
    unrestEffect: (rate) => rate * 20,         // Moderate unrest
    revenueMultiplier: 1.0,
    enforcementCostBase: 10,
  },
  tariff: {
    priceEffect: (rate) => 1 + rate * 1.5,     // Imports more expensive
    supplyEffect: (rate) => 1 - rate * 0.4,    // Significant supply drop
    demandEffect: (_rate) => 1,                  // Demand stays (they need it)
    unrestEffect: (rate) => rate * 15,
    revenueMultiplier: 0.8,                     // Some evade
    enforcementCostBase: 20,
  },
  embargo: {
    priceEffect: () => 3,                       // Prices triple (scarcity)
    supplyEffect: () => 0.1,                    // 90% reduction
    demandEffect: () => 1.5,                    // Demand increases (panic)
    unrestEffect: () => 40,                     // High unrest
    revenueMultiplier: 0,                       // No revenue, it's a ban
    enforcementCostBase: 50,
  },
  monopoly: {
    priceEffect: (rate) => 1 + rate * 0.8,     // Monopolist raises prices
    supplyEffect: () => 1,                      // Supply controlled
    demandEffect: () => 1,
    unrestEffect: (rate) => rate * 25,
    revenueMultiplier: 1.5,                     // Monopolist profits
    enforcementCostBase: 30,
  },
  price_ceiling: {
    priceEffect: () => 0.7,                     // Forced lower prices
    supplyEffect: () => 0.6,                    // Producers reduce supply
    demandEffect: () => 1.5,                    // Everyone wants cheap goods
    unrestEffect: () => 10,                     // Popular but creates shortages
    revenueMultiplier: 0,
    enforcementCostBase: 25,
  },
  price_floor: {
    priceEffect: () => 1.3,                     // Minimum price
    supplyEffect: () => 1.2,                    // Producers produce more
    demandEffect: () => 0.7,                    // Fewer can afford
    unrestEffect: () => 5,
    revenueMultiplier: 0,
    enforcementCostBase: 15,
  },
  conscription: {
    priceEffect: () => 1,
    supplyEffect: () => 0.7,                    // Workers gone = less production
    demandEffect: () => 0.8,
    unrestEffect: () => 35,                     // Very unpopular
    revenueMultiplier: 0,
    enforcementCostBase: 40,
  },
  protection_racket: {
    priceEffect: (rate) => 1 + rate * 0.2,     // Costs passed on
    supplyEffect: () => 0.9,
    demandEffect: () => 1,
    unrestEffect: (rate) => rate * 30,
    revenueMultiplier: 0.9,                     // Criminal efficiency
    enforcementCostBase: 5,                     // Thugs are cheap
  },
  currency_debasement: {
    priceEffect: (rate) => 1 + rate * 2,       // Inflation!
    supplyEffect: () => 1,
    demandEffect: () => 0.8,
    unrestEffect: (rate) => rate * 40,         // Very unpopular
    revenueMultiplier: 0.5,                     // One-time gain
    enforcementCostBase: 0,
  },
};

// ============================================
// BLACK MARKET
// ============================================

export const BlackMarketGoodsCategorySchema = z.enum([
  // Universally illegal
  "poisons",                // Assassination tools
  "slaves",                 // Sentient trafficking
  "necromancy_components",  // Body parts, soul gems
  "demons_contracts",       // Infernal dealings

  // Conditionally illegal
  "stolen_goods",           // Fenced items
  "contraband",             // Banned imports
  "unlicensed_weapons",     // Weapons without permit
  "forbidden_magic",        // Banned spells/scrolls
  "narcotics",              // Drugs
  "counterfeit_currency",   // Fake money
  "counterfeit_goods",      // Knockoffs

  // Regulated (illegal without license)
  "restricted_potions",     // Dangerous alchemicals
  "military_equipment",     // Armor, siege weapons
  "exotic_creatures",       // Dangerous pets
  "restricted_information", // Maps, secrets

  // Tax evaded
  "smuggled_luxury",        // Untaxed luxury goods
  "smuggled_commodity",     // Untaxed bulk goods
]);
export type BlackMarketGoodsCategory = z.infer<typeof BlackMarketGoodsCategorySchema>;

export const BlackMarketSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),
  settlementName: z.string(),

  // Size and influence
  size: z.enum(["tiny", "small", "moderate", "large", "dominant"]),
  monthlyVolume: z.number(),             // GP worth of trade
  controllingFaction: z.string().uuid().optional(),

  // What's available
  availableCategories: z.array(BlackMarketGoodsCategorySchema).default([]),

  // Specific goods and prices
  goods: z.array(z.object({
    category: BlackMarketGoodsCategorySchema,
    commodityId: z.string(),
    name: z.string(),
    quantity: z.number(),

    // Pricing
    basePrice: z.number(),               // Legal market price
    blackMarketPrice: z.number(),        // Includes risk premium
    priceMultiplier: z.number(),         // How much more expensive

    // Source
    source: z.enum([
      "stolen",                          // Fenced goods
      "smuggled",                        // Avoided tariffs
      "produced",                        // Illegal manufacture
      "diverted",                        // Stolen from legal supply
    ]),
  })).default([]),

  // Access
  accessDifficulty: z.object({
    findContactDC: z.number().int(),     // Investigation/Streetwise
    gainTrustDC: z.number().int(),       // Persuasion/Reputation
    requiresIntroduction: z.boolean(),
    knownContacts: z.array(z.string().uuid()).default([]),  // NPCs who can introduce
  }),

  // Locations
  locations: z.array(z.object({
    name: z.string(),
    type: z.enum(["tavern_backroom", "warehouse", "sewer", "docks", "shop_front", "traveling"]),
    address: z.string().optional(),
    operatingHours: z.string(),
    knownToParty: z.boolean(),
  })).default([]),

  // Key NPCs
  fences: z.array(z.object({
    npcId: z.string().uuid(),
    name: z.string(),
    specialty: z.array(BlackMarketGoodsCategorySchema),
    trustworthiness: z.number().int().min(0).max(100),
    priceModifier: z.number(),           // Their cut
    knownToParty: z.boolean(),
  })).default([]),

  // Risk
  heatLevel: z.number().int().min(0).max(100).default(20),
  recentCrackdowns: z.array(z.object({
    date: z.string(),
    description: z.string(),
    casualties: z.number().int(),
    goodsSeized: z.number(),
  })).default([]),

  // Relationship with authorities
  corruptOfficials: z.array(z.object({
    npcId: z.string().uuid(),
    name: z.string(),
    position: z.string(),
    bribeAmount: z.number(),             // Regular payment
    services: z.array(z.string()),       // What they provide
  })).default([]),

  // Status
  status: z.enum(["thriving", "active", "suppressed", "underground", "destroyed"]).default("active"),
});
export type BlackMarket = z.infer<typeof BlackMarketSchema>;

// ============================================
// BLACK MARKET PRICING
// ============================================

export const BLACK_MARKET_MULTIPLIERS: Record<string, {
  baseMultiplier: number;      // How much more expensive than legal
  riskPremium: number;         // Added % per heat level
  scarcityMultiplier: number;  // When supply is low
}> = {
  poisons: { baseMultiplier: 2.0, riskPremium: 0.02, scarcityMultiplier: 1.5 },
  slaves: { baseMultiplier: 1.5, riskPremium: 0.03, scarcityMultiplier: 2.0 },
  necromancy_components: { baseMultiplier: 3.0, riskPremium: 0.05, scarcityMultiplier: 2.0 },
  demons_contracts: { baseMultiplier: 5.0, riskPremium: 0.10, scarcityMultiplier: 3.0 },
  stolen_goods: { baseMultiplier: 0.5, riskPremium: 0.01, scarcityMultiplier: 1.2 },  // Cheaper!
  contraband: { baseMultiplier: 1.8, riskPremium: 0.02, scarcityMultiplier: 1.5 },
  unlicensed_weapons: { baseMultiplier: 1.3, riskPremium: 0.01, scarcityMultiplier: 1.3 },
  forbidden_magic: { baseMultiplier: 2.5, riskPremium: 0.04, scarcityMultiplier: 2.0 },
  narcotics: { baseMultiplier: 3.0, riskPremium: 0.03, scarcityMultiplier: 2.5 },
  counterfeit_currency: { baseMultiplier: 0.3, riskPremium: 0.05, scarcityMultiplier: 1.0 },  // Buy fake money cheap
  smuggled_luxury: { baseMultiplier: 0.7, riskPremium: 0.01, scarcityMultiplier: 1.2 },  // Avoid taxes = cheaper
  smuggled_commodity: { baseMultiplier: 0.8, riskPremium: 0.01, scarcityMultiplier: 1.3 },
};

/**
 * Calculate black market price for an item.
 */
export function calculateBlackMarketPrice(
  basePrice: number,
  category: BlackMarketGoodsCategory,
  market: BlackMarket,
  supplyLevel: number,  // 0-1, where 0 = none, 1 = abundant
): number {
  const config = BLACK_MARKET_MULTIPLIERS[category] || {
    baseMultiplier: 2.0,
    riskPremium: 0.02,
    scarcityMultiplier: 1.5
  };

  let price = basePrice * config.baseMultiplier;

  // Risk premium based on heat
  price *= (1 + config.riskPremium * market.heatLevel);

  // Scarcity premium
  if (supplyLevel < 0.3) {
    price *= config.scarcityMultiplier * (1 - supplyLevel);
  }

  // Fence cut (10-30% typically)
  const fenceCut = 0.15;
  price *= (1 + fenceCut);

  return Math.round(price * 100) / 100;
}

// ============================================
// ENFORCEMENT & CRACKDOWNS
// ============================================

export const CrackdownTypeSchema = z.enum([
  "raid",                   // Physical raid on location
  "sweep",                  // Widespread arrests
  "infiltration",           // Undercover operation
  "embargo_enforcement",    // Seize smuggled goods
  "audit",                  // Financial investigation
  "execution",              // Public punishment
]);
export type CrackdownType = z.infer<typeof CrackdownTypeSchema>;

export const CrackdownSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),

  // Who ordered it
  orderingFaction: z.string().uuid(),
  orderingOfficialName: z.string(),

  // Type and target
  type: CrackdownTypeSchema,
  target: z.object({
    type: z.enum(["black_market", "smuggling_ring", "specific_goods", "specific_fence"]),
    id: z.string().optional(),
    name: z.string(),
  }),

  // Execution
  resources: z.object({
    guards: z.number().int(),
    investigators: z.number().int(),
    gold: z.number(),
  }),

  // Outcome
  status: z.enum(["planned", "in_progress", "completed", "failed"]),
  outcome: z.object({
    success: z.boolean(),
    arrestsMade: z.number().int(),
    goodsSeized: z.number(),           // GP value
    heatIncrease: z.number().int(),
    locationsCompromised: z.array(z.string()),
    fencesExposed: z.array(z.string().uuid()),
    bribePrevented: z.boolean(),
  }).optional(),

  // Dates
  plannedDate: z.string(),
  executedDate: z.string().optional(),

  // Leaks
  wasLeaked: z.boolean().default(false),
  leakedTo: z.array(z.string().uuid()).default([]),
});
export type Crackdown = z.infer<typeof CrackdownSchema>;

// ============================================
// CORRUPTION SYSTEM
// ============================================

export const CorruptOfficialSchema = z.object({
  id: z.string().uuid(),
  npcId: z.string().uuid(),
  name: z.string(),

  // Position
  position: z.string(),                  // "Harbor Master", "Tax Collector"
  factionId: z.string().uuid(),          // Who they work for
  settlementId: z.string().uuid(),

  // What they control
  authority: z.array(z.enum([
    "customs",                           // Import/export
    "taxes",                             // Tax collection
    "licenses",                          // Business permits
    "patrols",                           // Guard routes
    "investigations",                    // Who gets investigated
    "courts",                            // Legal outcomes
    "prisons",                           // Who gets released
    "records",                           // Falsify documents
  ])),

  // Corruption level
  corruptionLevel: z.enum(["opportunistic", "regular", "deep", "total"]),

  // Pricing
  services: z.array(z.object({
    service: z.string(),                 // "Look the other way", "Lose paperwork"
    baseCost: z.number(),
    riskToOfficial: z.enum(["low", "medium", "high"]),
  })),

  // Relationships
  worksWith: z.array(z.string().uuid()),  // Other corrupt officials
  protects: z.array(z.string().uuid()),   // Criminals they shield

  // Risk
  suspicionLevel: z.number().int().min(0).max(100).default(0),
  investigatedBy: z.array(z.string().uuid()).default([]),

  // Status
  status: z.enum(["active", "suspended", "exposed", "arrested", "fled"]).default("active"),
});
export type CorruptOfficial = z.infer<typeof CorruptOfficialSchema>;

// ============================================
// SMUGGLING ROUTES
// ============================================

export const SmugglingRouteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),

  // Route
  origin: z.object({
    settlementId: z.string().uuid(),
    name: z.string(),
  }),
  destination: z.object({
    settlementId: z.string().uuid(),
    name: z.string(),
  }),
  waypoints: z.array(z.object({
    name: z.string(),
    type: z.enum(["cache", "safehouse", "bribe_point", "crossing"]),
  })).default([]),

  // Method
  method: z.enum([
    "hidden_cargo",          // Goods hidden in legitimate shipments
    "false_documentation",   // Paperwork says something else
    "overland_bypass",       // Avoid checkpoints entirely
    "underground",           // Literal tunnels/sewers
    "bribed_passage",        // Officials paid off
    "magical",               // Teleportation, dimensional
  ]),

  // Capacity
  weeklyCapacity: z.number(),            // GP worth of goods
  currentVolume: z.number(),

  // Goods
  primaryGoods: z.array(z.string()),     // What usually flows

  // Control
  controlledBy: z.string().uuid().optional(),
  operatorCut: z.number(),               // Percentage taken

  // Risk
  detectionChance: z.number(),           // Per shipment
  compromised: z.boolean().default(false),

  // Economics
  costPerShipment: z.number(),           // Base cost to use route

  // Status
  status: z.enum(["active", "watched", "compromised", "closed"]).default("active"),
});
export type SmugglingRoute = z.infer<typeof SmugglingRouteSchema>;

// ============================================
// PLAYER INTERACTION WITH CONTROL LAYER
// ============================================

export const PlayerControlInteractionSchema = z.object({
  characterId: z.string().uuid(),

  // Black market standing
  blackMarketReputation: z.record(z.string().uuid(), z.object({
    standing: z.number().int().min(-100).max(100),
    accessLevel: z.enum(["none", "basic", "trusted", "inner_circle"]),
    knownFences: z.array(z.string().uuid()),
    debts: z.number(),
    favorsOwed: z.number().int(),
  })).default({}),

  // Corrupt contacts
  corruptContacts: z.array(z.object({
    officialId: z.string().uuid(),
    relationship: z.enum(["none", "known", "used", "regular", "partner"]),
    totalBribesPaid: z.number(),
  })).default([]),

  // Smuggling
  smugglingRoutesKnown: z.array(z.string().uuid()).default([]),
  goodsSmuggled: z.array(z.object({
    date: z.string(),
    goods: z.string(),
    value: z.number(),
    route: z.string().uuid(),
    success: z.boolean(),
  })).default([]),

  // Heat
  personalHeat: z.record(z.string().uuid(), z.number().int()).default({}),  // Per settlement

  // Bounties
  bountiesActive: z.array(z.object({
    factionId: z.string().uuid(),
    factionName: z.string(),
    amount: z.number(),
    reason: z.string(),
    status: z.enum(["active", "paid", "withdrawn"]),
  })).default([]),
});
export type PlayerControlInteraction = z.infer<typeof PlayerControlInteractionSchema>;

// ============================================
// INTERVENTION RESOLUTION
// ============================================

/**
 * Apply faction interventions to market prices.
 */
export function applyInterventionsToMarket(
  basePrices: Record<string, { price: number; supply: number; demand: number }>,
  interventions: EconomicIntervention[],
  settlementId: string,
): Record<string, {
  price: number;
  supply: number;
  demand: number;
  modifiers: Array<{ source: string; effect: number }>;
  restricted: boolean;
  banned: boolean;
}> {
  const result: Record<string, {
    price: number;
    supply: number;
    demand: number;
    modifiers: Array<{ source: string; effect: number }>;
    restricted: boolean;
    banned: boolean;
  }> = {};

  // Initialize from base prices
  for (const [commodityId, base] of Object.entries(basePrices)) {
    result[commodityId] = {
      price: base.price,
      supply: base.supply,
      demand: base.demand,
      modifiers: [],
      restricted: false,
      banned: false,
    };
  }

  // Apply each intervention
  for (const intervention of interventions) {
    if (intervention.status !== "active") continue;

    // Check if this intervention applies to this settlement
    const appliesToSettlement =
      intervention.scope.type === "global" ||
      (intervention.scope.type === "settlement" &&
       intervention.scope.targetIds.includes(settlementId)) ||
      (intervention.scope.type === "regional");  // Would need region lookup

    if (!appliesToSettlement) continue;

    // Get commodities affected
    const affectedCommodities = intervention.affectedCommodities.length > 0
      ? intervention.affectedCommodities
      : Object.keys(result);

    const effects = INTERVENTION_EFFECTS[intervention.type];
    if (!effects) continue;

    const rate = intervention.parameters.rate || 0;

    for (const commodityId of affectedCommodities) {
      if (!result[commodityId]) continue;

      const commodity = result[commodityId];

      // Apply price effect
      const priceEffect = effects.priceEffect(rate);
      commodity.price *= priceEffect;
      commodity.modifiers.push({
        source: `${intervention.factionName}: ${intervention.name}`,
        effect: priceEffect,
      });

      // Apply supply effect
      commodity.supply *= effects.supplyEffect(rate);

      // Apply demand effect
      commodity.demand *= effects.demandEffect(rate);

      // Check for bans/restrictions
      if (intervention.type === "embargo" || intervention.type === "blockade") {
        commodity.banned = true;
      }
      if (intervention.type === "license_requirement" || intervention.type === "rationing") {
        commodity.restricted = true;
      }
    }
  }

  // Round prices
  for (const commodity of Object.values(result)) {
    commodity.price = Math.round(commodity.price * 100) / 100;
    commodity.supply = Math.round(commodity.supply);
    commodity.demand = Math.round(commodity.demand);
  }

  return result;
}

/**
 * Calculate total unrest from interventions.
 */
export function calculateInterventionUnrest(
  interventions: EconomicIntervention[],
  settlementId: string,
): number {
  let totalUnrest = 0;

  for (const intervention of interventions) {
    if (intervention.status !== "active") continue;

    // Check if applies to settlement
    const applies =
      intervention.scope.type === "global" ||
      intervention.scope.targetIds.includes(settlementId);

    if (!applies) continue;

    const effects = INTERVENTION_EFFECTS[intervention.type];
    if (!effects) continue;

    const rate = intervention.parameters.rate || 0;
    totalUnrest += effects.unrestEffect(rate);
  }

  return Math.min(100, totalUnrest);
}

/**
 * Calculate faction revenue from interventions.
 */
export function calculateInterventionRevenue(
  intervention: EconomicIntervention,
  marketVolume: number,  // Total GP traded in affected markets
): number {
  const effects = INTERVENTION_EFFECTS[intervention.type];
  if (!effects) return 0;

  const rate = intervention.parameters.rate || 0;
  const baseRevenue = marketVolume * rate;

  // Apply efficiency multiplier
  const revenue = baseRevenue * effects.revenueMultiplier;

  // Subtract enforcement cost
  const enforcementCost = effects.enforcementCostBase * intervention.enforcement.enforcers;

  return Math.max(0, revenue - enforcementCost);
}
