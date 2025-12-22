import { z } from "zod";

// ============================================
// ECONOMY SYSTEM - THE LIVING WORLD
// ============================================
//
// Philosophy: THE ECONOMY IS THE WORLD'S BLOODSTREAM
//
// Every settlement produces and consumes.
// Trade routes are arteries.
// Cut one, and distant settlements starve.
// Flood one, and prices crash.
//
// This enables:
//   - World that changes between sessions
//   - Multi-party campaigns with shared consequences
//   - Player actions have REAL economic impact
//   - GM can narrate economic news as world flavor
//   - Supply/demand creates adventure hooks
//
// Party A burns the grain stores
// → Party B arrives to famine prices
// → The world is ONE THING, experienced by many
//

// ============================================
// RESOURCE CATEGORIES
// ============================================

export const ResourceCategorySchema = z.enum([
  // Basic Needs
  "food", // Grain, meat, produce
  "water", // Fresh water (desert settlements)
  "fuel", // Wood, coal, oil

  // Raw Materials
  "timber", // Construction, ships
  "stone", // Construction, fortification
  "ore", // Metal ore (iron, copper, etc.)
  "gems", // Precious stones
  "cloth", // Textiles, sails
  "leather", // Armor, goods
  "herbs", // Medicine, alchemy

  // Refined Goods
  "metal", // Processed ore
  "weapons", // Arms
  "armor", // Protection
  "tools", // Equipment
  "pottery", // Containers, goods
  "glass", // Windows, vessels

  // Luxury
  "spices", // Exotic flavoring
  "silk", // Fine cloth
  "wine", // Alcohol
  "art", // Decorative items
  "jewelry", // Precious accessories
  "exotic", // Rare imports

  // Strategic
  "horses", // Mounts, cavalry
  "ships", // Naval capacity
  "siege_equipment", // Warfare
  "magic_components", // Spell materials
  "enchanted_items", // Magic goods

  // Services (abstract)
  "labor", // Workers
  "expertise", // Skilled professionals
  "mercenaries", // Hired soldiers
  "information", // Intelligence, secrets
]);
export type ResourceCategory = z.infer<typeof ResourceCategorySchema>;

// ============================================
// COMMODITY (Specific tradeable good)
// ============================================

export const CommoditySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ResourceCategorySchema,

  // Base economics
  basePrice: z.number(), // GP per unit
  unit: z.string(), // "bushel", "ton", "barrel", "each"
  bulkSize: z.number().default(1), // How much space per unit
  perishable: z.boolean().default(false),
  perishDays: z.number().int().optional(),

  // Production
  producedBy: z.array(z.string()).default([]), // Building types that produce
  productionRate: z.number().default(1), // Units per building per week

  // Consumption
  consumedBy: z.array(z.string()).default([]), // What consumes this
  consumptionRate: z.number().default(1),

  // Requirements
  requiresBuilding: z.string().optional(), // Building needed to produce
  requiresResource: z
    .array(
      z.object({
        commodityId: z.string(),
        amount: z.number(),
      }),
    )
    .optional(), // Input resources

  // Rarity
  rarity: z
    .enum(["common", "uncommon", "rare", "very_rare", "legendary"])
    .default("common"),

  // Strategic value
  militaryValue: z.boolean().default(false),
  magicalValue: z.boolean().default(false),
});
export type Commodity = z.infer<typeof CommoditySchema>;

// ============================================
// STANDARD COMMODITIES
// ============================================

export const StandardCommodities: Record<
  string,
  z.infer<typeof CommoditySchema>
> = {
  // Food
  grain: {
    id: "grain",
    name: "Grain",
    category: "food",
    basePrice: 0.01,
    unit: "bushel",
    bulkSize: 1,
    perishable: true,
    perishDays: 90,
    producedBy: ["farm", "plantation"],
    productionRate: 100,
    rarity: "common",
    militaryValue: false,
    magicalValue: false,
  },
  meat: {
    id: "meat",
    name: "Meat",
    category: "food",
    basePrice: 0.1,
    unit: "lb",
    bulkSize: 1,
    perishable: true,
    perishDays: 7,
    producedBy: ["ranch", "hunting_lodge"],
    productionRate: 50,
    rarity: "common",
    militaryValue: false,
    magicalValue: false,
  },
  fish: {
    id: "fish",
    name: "Fish",
    category: "food",
    basePrice: 0.05,
    unit: "lb",
    bulkSize: 1,
    perishable: true,
    perishDays: 3,
    producedBy: ["fishery", "dock"],
    productionRate: 75,
    rarity: "common",
    militaryValue: false,
    magicalValue: false,
  },

  // Raw Materials
  timber: {
    id: "timber",
    name: "Timber",
    category: "timber",
    basePrice: 0.5,
    unit: "log",
    bulkSize: 10,
    perishable: false,
    producedBy: ["lumber_camp", "sawmill"],
    productionRate: 20,
    rarity: "common",
    militaryValue: false,
    magicalValue: false,
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    category: "ore",
    basePrice: 1,
    unit: "ton",
    bulkSize: 20,
    perishable: false,
    producedBy: ["mine"],
    productionRate: 10,
    rarity: "uncommon",
    militaryValue: true,
    magicalValue: false,
  },

  // Refined
  iron: {
    id: "iron",
    name: "Iron Ingots",
    category: "metal",
    basePrice: 5,
    unit: "ingot",
    bulkSize: 2,
    perishable: false,
    producedBy: ["smithy", "foundry"],
    productionRate: 5,
    requiresResource: [{ commodityId: "iron_ore", amount: 2 }],
    rarity: "uncommon",
    militaryValue: true,
    magicalValue: false,
  },
  weapons: {
    id: "weapons",
    name: "Weapons",
    category: "weapons",
    basePrice: 25,
    unit: "weapon",
    bulkSize: 2,
    perishable: false,
    producedBy: ["weaponsmith", "armory"],
    productionRate: 2,
    requiresResource: [{ commodityId: "iron", amount: 2 }],
    rarity: "uncommon",
    militaryValue: true,
    magicalValue: false,
  },

  // Luxury
  wine: {
    id: "wine",
    name: "Wine",
    category: "wine",
    basePrice: 2,
    unit: "barrel",
    bulkSize: 5,
    perishable: false, // Improves with age!
    producedBy: ["vineyard", "winery"],
    productionRate: 10,
    rarity: "uncommon",
    militaryValue: false,
    magicalValue: false,
  },
  spices: {
    id: "spices",
    name: "Spices",
    category: "spices",
    basePrice: 50,
    unit: "lb",
    bulkSize: 0.1,
    perishable: false,
    producedBy: ["exotic_plantation"],
    productionRate: 1,
    rarity: "rare",
    militaryValue: false,
    magicalValue: false,
  },

  // Strategic
  horses: {
    id: "horses",
    name: "Horses",
    category: "horses",
    basePrice: 75,
    unit: "horse",
    bulkSize: 50,
    perishable: false,
    producedBy: ["stable", "horse_ranch"],
    productionRate: 2,
    rarity: "uncommon",
    militaryValue: true,
    magicalValue: false,
  },

  // Magical
  magic_components: {
    id: "magic_components",
    name: "Magic Components",
    category: "magic_components",
    basePrice: 100,
    unit: "pouch",
    bulkSize: 0.5,
    perishable: false,
    producedBy: ["mage_tower", "alchemist"],
    productionRate: 1,
    rarity: "rare",
    militaryValue: false,
    magicalValue: true,
  },
};

// ============================================
// MARKET STATE (Per settlement)
// ============================================

export const MarketPriceSchema = z.object({
  commodityId: z.string(),

  // Current state
  currentPrice: z.number(), // Actual price now
  basePrice: z.number(), // Reference price
  priceMultiplier: z.number().default(1), // Current multiplier

  // Supply/Demand
  supply: z.number().int().default(0), // Units available
  demand: z.number().int().default(0), // Units wanted
  supplyDemandRatio: z.number().default(1),

  // History
  priceHistory: z
    .array(
      z.object({
        date: z.string(),
        price: z.number(),
        supply: z.number().int(),
        demand: z.number().int(),
      }),
    )
    .default([]),

  // Trend
  trend: z
    .enum(["crashing", "falling", "stable", "rising", "spiking"])
    .default("stable"),
  weeklyChange: z.number().default(0), // Percentage

  // Controls
  priceFloor: z.number().optional(), // Minimum (regulations)
  priceCeiling: z.number().optional(), // Maximum (price controls)
  taxRate: z.number().default(0), // Additional tax

  // Availability
  available: z.boolean().default(true),
  blackMarketOnly: z.boolean().default(false),
  restricted: z.boolean().default(false), // Requires license

  // Last transaction
  lastTradeDate: z.string().optional(),
  lastTradeVolume: z.number().int().optional(),
});
export type MarketPrice = z.infer<typeof MarketPriceSchema>;

export const SettlementMarketSchema = z.object({
  settlementId: z.string().uuid(),
  settlementName: z.string(),

  // Market characteristics
  marketSize: z.enum([
    "none",
    "village",
    "town",
    "city",
    "metropolis",
    "trade_hub",
  ]),

  // Available goods
  prices: z.array(MarketPriceSchema).default([]),

  // Trade capacity
  weeklyTradeVolume: z.number().int().default(0), // GP worth of trade
  warehouseCapacity: z.number().int().default(0), // Storage

  // Special features
  specializations: z.array(z.string()).default([]), // What they're known for
  restrictions: z
    .array(
      z.object({
        commodityId: z.string(),
        type: z.enum(["banned", "taxed", "licensed", "rationed"]),
        details: z.string().optional(),
      }),
    )
    .default([]),

  // Market events
  activeEvents: z.array(z.string().uuid()).default([]),

  // Last update
  lastUpdated: z.string(),
});
export type SettlementMarket = z.infer<typeof SettlementMarketSchema>;

// ============================================
// TRADE ROUTES
// ============================================

export const TradeRouteSchema = z.object({
  id: z.string().uuid(),

  // Endpoints
  fromSettlementId: z.string().uuid(),
  fromSettlementName: z.string(),
  toSettlementId: z.string().uuid(),
  toSettlementName: z.string(),

  // Route characteristics
  distance: z.number().int(), // Miles
  travelDays: z.number().int(), // Standard travel time
  terrain: z
    .array(
      z.enum([
        "road",
        "trail",
        "wilderness",
        "mountain",
        "river",
        "sea",
        "desert",
        "swamp",
        "forest",
        "underground",
      ]),
    )
    .default(["road"]),

  // Capacity
  weeklyCapacity: z.number().int(), // Units that can move per week
  currentVolume: z.number().int().default(0),

  // Safety
  safety: z
    .enum(["safe", "patrolled", "risky", "dangerous", "deadly"])
    .default("patrolled"),
  dangerSources: z.array(z.string()).default([]), // "bandits", "monsters", "war"
  lossRate: z.number().default(0), // Percentage lost to dangers

  // Status
  status: z
    .enum(["active", "disrupted", "blocked", "destroyed"])
    .default("active"),
  disruptionReason: z.string().optional(),
  reopenDate: z.string().optional(),

  // Control
  controlledBy: z.string().uuid().optional(), // Faction ID
  tollRate: z.number().default(0), // Percentage toll

  // Goods that flow
  primaryGoods: z.array(z.string()).default([]), // Commodity IDs

  // Merchants
  activeMerchants: z.number().int().default(0),

  // History
  establishedDate: z.string().optional(),
});
export type TradeRoute = z.infer<typeof TradeRouteSchema>;

// ============================================
// ECONOMIC EVENTS
// ============================================

export const EconomicEventTypeSchema = z.enum([
  // Natural
  "bumper_harvest", // +food supply
  "crop_failure", // -food supply
  "drought", // -water, -food
  "flood", // Destroys goods
  "plague", // -labor, -demand
  "natural_disaster", // Various destruction

  // Discovery
  "new_mine", // +ore supply
  "resource_depletion", // -production
  "new_trade_route", // New connections
  "treasure_discovery", // Currency influx

  // Human
  "war", // Disruption, military demand
  "peace_treaty", // Routes reopen
  "embargo", // Trade blocked
  "tariff_change", // Price adjustments
  "guild_strike", // Production halt
  "festival", // Demand spike
  "refugee_influx", // Labor increase, food demand

  // Player-caused
  "player_destruction", // Players destroyed something
  "player_creation", // Players built something
  "player_trade", // Major trade deal
  "player_disruption", // Killed merchants, etc.
  "player_investment", // Funded something

  // Magical
  "magical_blight", // Magical crop failure
  "planar_incursion", // Exotic goods/disruption
  "divine_blessing", // Production bonus
  "curse", // Various negative
]);
export type EconomicEventType = z.infer<typeof EconomicEventTypeSchema>;

export const EconomicEventSchema = z.object({
  id: z.string().uuid(),
  worldId: z.string().uuid(),

  // Event details
  type: EconomicEventTypeSchema,
  name: z.string(),
  description: z.string(),

  // Source
  causedBy: z.object({
    type: z.enum(["natural", "faction", "player", "random", "triggered"]),
    partyId: z.string().uuid().optional(),
    partyName: z.string().optional(),
    factionId: z.string().uuid().optional(),
    factionName: z.string().optional(),
    actionDescription: z.string().optional(),
  }),

  // Scope
  scope: z.enum(["local", "regional", "continental", "global"]),
  affectedSettlements: z.array(z.string().uuid()).default([]),
  affectedRoutes: z.array(z.string().uuid()).default([]),
  affectedCommodities: z.array(z.string()).default([]),

  // Effects
  effects: z
    .array(
      z.object({
        type: z.enum([
          "price_modifier",
          "supply_modifier",
          "demand_modifier",
          "production_modifier",
          "route_disruption",
          "route_creation",
          "settlement_damage",
          "population_change",
        ]),
        target: z.string(), // Settlement/Route/Commodity ID
        modifier: z.number(), // Multiplier or delta
        isMultiplier: z.boolean().default(true),
      }),
    )
    .default([]),

  // Timing
  startDate: z.string(),
  endDate: z.string().optional(),
  duration: z.string().optional(), // "2 weeks", "1 month", "permanent"

  // State
  status: z
    .enum(["pending", "active", "resolved", "permanent"])
    .default("active"),

  // Visibility
  publiclyKnown: z.boolean().default(true),
  knownToFactions: z.array(z.string().uuid()).default([]),
  knownToParties: z.array(z.string().uuid()).default([]),

  // Narrative
  newsHeadline: z.string().optional(),
  rumorText: z.string().optional(),

  // Ripple effects (generated events)
  triggeredEvents: z.array(z.string().uuid()).default([]),
});
export type EconomicEvent = z.infer<typeof EconomicEventSchema>;

// ============================================
// SETTLEMENT ECONOMY (Extended from settlements.ts)
// ============================================

export const SettlementEconomySchema = z.object({
  settlementId: z.string().uuid(),

  // Population economics
  population: z.object({
    total: z.number().int(),
    workers: z.number().int(), // Available labor
    unemployed: z.number().int(),
    slaves: z.number().int().optional(),
  }),

  // Production
  production: z
    .array(
      z.object({
        commodityId: z.string(),
        weeklyOutput: z.number(),
        buildings: z.array(z.string()), // Building IDs producing
        modifiers: z
          .array(
            z.object({
              source: z.string(),
              value: z.number(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),

  // Consumption
  consumption: z
    .array(
      z.object({
        commodityId: z.string(),
        weeklyNeed: z.number(),
        currentStock: z.number(),
        daysOfSupply: z.number(), // How long current stock lasts
        status: z.enum(["surplus", "adequate", "low", "critical", "depleted"]),
      }),
    )
    .default([]),

  // Wealth
  treasury: z.number().default(0), // Settlement funds
  weeklyIncome: z.number().default(0),
  weeklyExpenses: z.number().default(0),
  taxRate: z.number().default(0.1), // 10% default

  // Trade balance
  exports: z
    .array(
      z.object({
        commodityId: z.string(),
        weeklyVolume: z.number(),
        destinations: z.array(z.string().uuid()),
        revenue: z.number(),
      }),
    )
    .default([]),

  imports: z
    .array(
      z.object({
        commodityId: z.string(),
        weeklyVolume: z.number(),
        sources: z.array(z.string().uuid()),
        cost: z.number(),
      }),
    )
    .default([]),

  tradeBalance: z.number().default(0), // Exports - Imports

  // Economic health
  prosperity: z.number().int().min(0).max(100).default(50),
  stability: z.number().int().min(0).max(100).default(50),
  growth: z.number().default(0), // Percentage weekly growth

  // Issues
  economicIssues: z
    .array(
      z.object({
        type: z.enum([
          "famine",
          "shortage",
          "unemployment",
          "inflation",
          "deflation",
          "debt",
          "corruption",
          "monopoly",
          "trade_deficit",
          "labor_shortage",
        ]),
        severity: z.enum(["minor", "moderate", "severe", "critical"]),
        affectedCommodity: z.string().optional(),
        description: z.string(),
      }),
    )
    .default([]),

  // Connected routes
  tradeRoutes: z.array(z.string().uuid()).default([]),

  // Last simulation
  lastSimulated: z.string(),
});
export type SettlementEconomy = z.infer<typeof SettlementEconomySchema>;

// ============================================
// WORLD ECONOMY (Global state)
// ============================================

export const WorldEconomySchema = z.object({
  id: z.string().uuid(),
  worldId: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Current date in world
  currentDate: z.string(),

  // All settlements
  settlements: z.array(SettlementEconomySchema).default([]),

  // All markets
  markets: z.array(SettlementMarketSchema).default([]),

  // All trade routes
  tradeRoutes: z.array(TradeRouteSchema).default([]),

  // Active events
  activeEvents: z.array(z.string().uuid()).default([]),
  eventHistory: z
    .array(
      z.object({
        eventId: z.string().uuid(),
        summary: z.string(),
        date: z.string(),
      }),
    )
    .default([]),

  // Global indicators
  globalIndicators: z.object({
    averageProsperity: z.number(),
    totalTradeVolume: z.number(),
    inflationRate: z.number(),
    warIndex: z.number().min(0).max(100), // 0=peace, 100=total war
    famineIndex: z.number().min(0).max(100),
    plagueIndex: z.number().min(0).max(100),
  }),

  // Regional groupings
  regions: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        settlements: z.array(z.string().uuid()),
        dominantFaction: z.string().uuid().optional(),
        economicCharacter: z.string(), // "agricultural", "mercantile", "industrial"
      }),
    )
    .default([]),

  // Multi-party tracking
  partyImpacts: z
    .array(
      z.object({
        partyId: z.string().uuid(),
        partyName: z.string(),
        totalEconomicImpact: z.number(), // GP equivalent
        eventsTriggered: z.array(z.string().uuid()),
        settlementsAffected: z.array(z.string().uuid()),
        lastAction: z.string(),
        lastActionDate: z.string(),
      }),
    )
    .default([]),

  // Simulation settings
  simulationSettings: z.object({
    autoSimulate: z.boolean().default(true),
    simulationInterval: z
      .enum(["daily", "weekly", "monthly"])
      .default("weekly"),
    volatility: z.number().min(0).max(1).default(0.2), // Price swing intensity
    eventProbability: z.number().min(0).max(1).default(0.1), // Random event chance
  }),

  // Last simulation
  lastSimulated: z.string(),
  nextSimulation: z.string().optional(),
});
export type WorldEconomy = z.infer<typeof WorldEconomySchema>;

// ============================================
// ECONOMIC SIMULATION
// ============================================

export function simulateEconomicTick(
  economy: WorldEconomy,
  daysElapsed: number = 7,
): {
  economy: WorldEconomy;
  events: EconomicEvent[];
  news: string[];
  priceChanges: Array<{
    settlement: string;
    commodity: string;
    oldPrice: number;
    newPrice: number;
    reason: string;
  }>;
} {
  // This would be the main simulation function
  // Returns updated economy, new events, news headlines, and notable price changes

  // Placeholder - actual implementation would:
  // 1. Calculate production for each settlement
  // 2. Calculate consumption
  // 3. Determine surplus/deficit
  // 4. Flow goods along trade routes
  // 5. Update prices based on supply/demand
  // 6. Generate random events
  // 7. Apply event effects
  // 8. Track party impacts
  // 9. Generate news/rumors

  return {
    economy,
    events: [],
    news: [],
    priceChanges: [],
  };
}

// ============================================
// PRICE CALCULATION
// ============================================

export function calculatePrice(
  basePrice: number,
  supply: number,
  demand: number,
  volatility: number = 0.2,
): { price: number; multiplier: number; trend: string } {
  // Basic supply/demand pricing
  const ratio = demand > 0 ? supply / demand : 2;

  let multiplier: number;
  let trend: string;

  if (ratio >= 2) {
    // Massive oversupply - prices crash
    multiplier = 0.3 + Math.random() * volatility * 0.2;
    trend = "crashing";
  } else if (ratio >= 1.5) {
    // Oversupply
    multiplier = 0.6 + Math.random() * volatility * 0.2;
    trend = "falling";
  } else if (ratio >= 0.8) {
    // Balanced
    multiplier = 0.9 + Math.random() * volatility * 0.2;
    trend = "stable";
  } else if (ratio >= 0.5) {
    // Undersupply
    multiplier = 1.3 + Math.random() * volatility * 0.3;
    trend = "rising";
  } else {
    // Severe shortage
    multiplier = 2 + Math.random() * volatility * 1;
    trend = "spiking";
  }

  return {
    price: Math.round(basePrice * multiplier * 100) / 100,
    multiplier,
    trend,
  };
}

// ============================================
// RIPPLE EFFECTS
// ============================================

export function calculateRippleEffects(
  event: EconomicEvent,
  economy: WorldEconomy,
): EconomicEvent[] {
  // When an event happens, calculate secondary effects
  // e.g., grain shortage → bread price spike → unrest

  const ripples: EconomicEvent[] = [];

  // Example: Famine spreads to dependent settlements
  if (event.type === "crop_failure" || event.type === "drought") {
    for (const settlementId of event.affectedSettlements) {
      const settlement = economy.settlements.find(
        (s) => s.settlementId === settlementId,
      );
      if (settlement) {
        // Check if other settlements depend on this one for food
        for (const route of economy.tradeRoutes) {
          if (
            route.fromSettlementId === settlementId &&
            route.primaryGoods.includes("grain")
          ) {
            // Dependent settlement may face shortage
            ripples.push({
              id: crypto.randomUUID(),
              worldId: economy.worldId,
              type: "player_disruption", // Or create new type
              name: `Supply Disruption in ${route.toSettlementName}`,
              description: `Food supplies from ${settlement.settlementId} have been disrupted`,
              causedBy: {
                type: "triggered",
                actionDescription: `Ripple effect from ${event.name}`,
              },
              scope: "local",
              affectedSettlements: [route.toSettlementId],
              affectedRoutes: [route.id],
              affectedCommodities: ["grain", "food"],
              effects: [
                {
                  type: "supply_modifier",
                  target: "grain",
                  modifier: 0.5, // 50% reduction
                  isMultiplier: true,
                },
              ],
              startDate: event.startDate,
              duration: "2 weeks",
              status: "active",
              publiclyKnown: true,
              knownToFactions: [],
              knownToParties: [],
              newsHeadline: `Food Shortages Reported in ${route.toSettlementName}`,
              rumorText: `Merchants say grain from the east has stopped coming...`,
              triggeredEvents: [],
            });
          }
        }
      }
    }
  }

  return ripples;
}

// ============================================
// PLAYER ACTION IMPACT
// ============================================

export const PlayerEconomicActionSchema = z.object({
  id: z.string().uuid(),
  partyId: z.string().uuid(),
  partyName: z.string(),

  // What they did
  actionType: z.enum([
    "destroyed_building",
    "destroyed_goods",
    "killed_merchants",
    "blocked_route",
    "opened_route",
    "invested",
    "stole_treasury",
    "flooded_market", // Sold lots of something
    "cornered_market", // Bought all of something
    "established_business",
    "protection_racket",
    "liberated_slaves",
    "freed_prisoners",
    "saved_harvest",
    "killed_monster_threat",
  ]),

  // Target
  targetType: z.enum([
    "settlement",
    "route",
    "building",
    "commodity",
    "faction",
  ]),
  targetId: z.string(),
  targetName: z.string(),

  // Details
  description: z.string(),
  quantity: z.number().optional(), // How many/much
  value: z.number().optional(), // GP value involved

  // When
  date: z.string(),

  // Calculated impact
  immediateEffects: z
    .array(
      z.object({
        type: z.string(),
        target: z.string(),
        change: z.number(),
        description: z.string(),
      }),
    )
    .default([]),

  // Generated event ID
  generatedEventId: z.string().uuid().optional(),
});
export type PlayerEconomicAction = z.infer<typeof PlayerEconomicActionSchema>;

export function processPlayerAction(
  action: PlayerEconomicAction,
  economy: WorldEconomy,
): { event: EconomicEvent; updatedEconomy: WorldEconomy } {
  // Convert player action to economic event and apply it

  let eventType: EconomicEventType = "player_disruption";
  let effects: EconomicEvent["effects"] = [];
  let scope: "local" | "regional" | "continental" | "global" = "local";

  switch (action.actionType) {
    case "destroyed_building":
      eventType = "player_destruction";
      // Reduce production of whatever that building made
      effects.push({
        type: "production_modifier",
        target: action.targetId,
        modifier: 0, // Building destroyed = no production
        isMultiplier: true,
      });
      break;

    case "destroyed_goods":
      eventType = "player_destruction";
      effects.push({
        type: "supply_modifier",
        target: action.targetId,
        modifier: -(action.quantity || 0),
        isMultiplier: false,
      });
      break;

    case "blocked_route":
      eventType = "player_disruption";
      effects.push({
        type: "route_disruption",
        target: action.targetId,
        modifier: 0,
        isMultiplier: true,
      });
      scope = "regional";
      break;

    case "killed_monster_threat":
      eventType = "player_creation";
      // Route becomes safer, trade increases
      effects.push({
        type: "route_creation",
        target: action.targetId,
        modifier: 1.5, // 50% more trade
        isMultiplier: true,
      });
      break;

    // ... more cases
  }

  const event: EconomicEvent = {
    id: crypto.randomUUID(),
    worldId: economy.worldId,
    type: eventType,
    name: `${action.partyName}: ${action.description}`,
    description: action.description,
    causedBy: {
      type: "player",
      partyId: action.partyId,
      partyName: action.partyName,
      actionDescription: action.description,
    },
    scope,
    affectedSettlements:
      action.targetType === "settlement" ? [action.targetId] : [],
    affectedRoutes: action.targetType === "route" ? [action.targetId] : [],
    affectedCommodities:
      action.targetType === "commodity" ? [action.targetId] : [],
    effects,
    startDate: action.date,
    status: "active",
    publiclyKnown: true,
    knownToFactions: [],
    knownToParties: [action.partyId],
    newsHeadline: generateNewsHeadline(action),
    rumorText: generateRumor(action),
    triggeredEvents: [],
  };

  // Apply event to economy
  // ... (implementation)

  return { event, updatedEconomy: economy };
}

function generateNewsHeadline(action: PlayerEconomicAction): string {
  switch (action.actionType) {
    case "destroyed_building":
      return `${action.targetName} Destroyed by Adventurers!`;
    case "destroyed_goods":
      return `Mysterious Fire Claims Goods in ${action.targetName}`;
    case "blocked_route":
      return `Trade Route to ${action.targetName} Closed`;
    case "killed_monster_threat":
      return `Heroes Clear ${action.targetName} - Trade to Resume!`;
    case "stole_treasury":
      return `${action.targetName} Treasury Robbed - Culprits Unknown`;
    default:
      return `Unusual Activity Reported in ${action.targetName}`;
  }
}

function generateRumor(action: PlayerEconomicAction): string {
  switch (action.actionType) {
    case "destroyed_building":
      return `"I heard a band of mercenaries burned down the ${action.targetName}. Dark times..."`;
    case "killed_monster_threat":
      return `"Those adventurers cleared the road! Maybe prices will come down now..."`;
    case "stole_treasury":
      return `"They say the ${action.targetName} was emptied overnight. Inside job, some reckon."`;
    default:
      return `"Strange things happening in ${action.targetName}, mark my words."`;
  }
}

// ============================================
// ECONOMIC NEWS GENERATOR
// ============================================

export function generateEconomicNews(
  economy: WorldEconomy,
  forSettlement?: string,
  forParty?: string,
): string[] {
  const news: string[] = [];

  // Price spikes/crashes
  for (const market of economy.markets) {
    if (forSettlement && market.settlementId !== forSettlement) continue;

    for (const price of market.prices) {
      if (price.trend === "spiking") {
        news.push(
          `${price.commodityId.toUpperCase()} prices in ${market.settlementName} have skyrocketed to ${price.currentPrice}gp!`,
        );
      } else if (price.trend === "crashing") {
        news.push(
          `${price.commodityId.toUpperCase()} floods ${market.settlementName} market - prices at all-time low!`,
        );
      }
    }
  }

  // Active events
  for (const eventId of economy.activeEvents) {
    // Look up event and add news
    // news.push(event.newsHeadline);
  }

  // Trade route disruptions
  for (const route of economy.tradeRoutes) {
    if (route.status === "blocked") {
      news.push(
        `Trade route between ${route.fromSettlementName} and ${route.toSettlementName} remains blocked!`,
      );
    } else if (route.safety === "dangerous" || route.safety === "deadly") {
      news.push(
        `Merchants warn: the road to ${route.toSettlementName} has become treacherous.`,
      );
    }
  }

  // Settlement issues
  for (const settlement of economy.settlements) {
    for (const issue of settlement.economicIssues) {
      if (issue.severity === "severe" || issue.severity === "critical") {
        news.push(
          `${settlement.settlementId} faces ${issue.severity} ${issue.type}!`,
        );
      }
    }
  }

  return news;
}

// ============================================
// MULTI-PARTY SYNCHRONIZATION
// ============================================

export const MultiPartySyncSchema = z.object({
  worldId: z.string().uuid(),

  // All active parties
  parties: z
    .array(
      z.object({
        partyId: z.string().uuid(),
        partyName: z.string(),
        currentLocation: z.string().uuid(),
        lastSessionDate: z.string(), // Real world date
        inWorldDate: z.string(), // In-game date

        // What they've done
        economicActions: z.array(z.string().uuid()),

        // What they know
        knownEvents: z.array(z.string().uuid()),
        visitedSettlements: z.array(z.string().uuid()),
        knownPrices: z.record(z.string(), z.record(z.string(), z.number())), // settlement -> commodity -> price they saw
      }),
    )
    .default([]),

  // Timeline reconciliation
  timelineMode: z
    .enum([
      "synchronized", // All parties on same date
      "independent", // Each party has own timeline
      "convergent", // Timelines will meet
    ])
    .default("synchronized"),

  // Pending effects (things that happened but not all parties have seen)
  pendingEffects: z
    .array(
      z.object({
        eventId: z.string().uuid(),
        causedByParty: z.string().uuid(),
        affectedParties: z.array(z.string().uuid()),
        acknowledged: z.array(z.string().uuid()), // Parties that have "seen" this
      }),
    )
    .default([]),
});
export type MultiPartySync = z.infer<typeof MultiPartySyncSchema>;

// ============================================
// AI PROMPTS
// ============================================

export function buildEconomicSimulationPrompt(
  economy: WorldEconomy,
  daysElapsed: number,
  recentPlayerActions: PlayerEconomicAction[],
): string {
  return `
# ECONOMIC SIMULATION: ${daysElapsed} Days Elapsed

You are simulating the economy of a fantasy world. Calculate the effects of time passing and player actions.

## CURRENT STATE

### Settlements
${economy.settlements
  .map(
    (s) => `
**${s.settlementId}**
- Population: ${s.population.total} (${s.population.workers} workers)
- Prosperity: ${s.prosperity}%
- Treasury: ${s.treasury}gp
- Issues: ${s.economicIssues.map((i) => i.type).join(", ") || "None"}
- Production: ${s.production.map((p) => `${p.commodityId}: ${p.weeklyOutput}/week`).join(", ")}
- Consumption: ${s.consumption.map((c) => `${c.commodityId}: ${c.status}`).join(", ")}
`,
  )
  .join("\n")}

### Trade Routes
${economy.tradeRoutes
  .map(
    (r) => `
- ${r.fromSettlementName} ↔ ${r.toSettlementName}: ${r.status} (${r.safety})
  Goods: ${r.primaryGoods.join(", ")}
  ${r.status !== "active" ? `Disrupted: ${r.disruptionReason}` : ""}
`,
  )
  .join("\n")}

### Recent Player Actions
${
  recentPlayerActions
    .map(
      (a) => `
- [${a.partyName}] ${a.description}
  Target: ${a.targetName}
  Type: ${a.actionType}
`,
    )
    .join("\n") || "None"
}

### Active Events
${economy.activeEvents.length > 0 ? "Events active..." : "No major events"}

## YOUR TASK

Simulate ${daysElapsed} days passing. Determine:

1. **Production/Consumption**: Calculate what each settlement produced and consumed
2. **Trade Flow**: Move goods along active routes
3. **Price Changes**: Update prices based on supply/demand
4. **New Events**: Should any random events trigger? (${Math.round(economy.simulationSettings.eventProbability * 100)}% base chance)
5. **Ripple Effects**: Do player actions cause secondary effects?
6. **News**: What would people be talking about?

Respond with:
1. Price changes (settlement, commodity, old price, new price, reason)
2. New events (if any)
3. Settlement status updates
4. Trade route changes
5. News headlines (3-5)
6. Rumors (2-3)

Consider: Wars reduce trade. Famines spread. Monster threats disrupt routes. Player actions have consequences.
`.trim();
}

export function buildEconomicNewsPrompt(
  economy: WorldEconomy,
  targetAudience: "common_folk" | "merchants" | "nobles" | "adventurers",
): string {
  return `
# GENERATE ECONOMIC NEWS

Create ${targetAudience === "nobles" ? "formal briefings" : "tavern gossip"} about the current economic situation.

## CURRENT STATE
${JSON.stringify(economy.globalIndicators, null, 2)}

## RECENT EVENTS
${economy.eventHistory
  .slice(-5)
  .map((e) => e.summary)
  .join("\n")}

## TARGET AUDIENCE
${targetAudience}

Generate 5-8 pieces of news/gossip appropriate for this audience.
For common folk: simple language, personal impact
For merchants: trade routes, prices, opportunities
For nobles: political implications, investments
For adventurers: opportunities, dangers, rewards

Make it feel ALIVE. These are real people talking about real impacts on their lives.
`.trim();
}
