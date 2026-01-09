import { z } from "zod";

// ============================================
// LOGISTICS SYSTEM - MOVING THE WORLD
// ============================================
//
// Philosophy: ROUTES ARE THE BLOOD VESSELS
//
// Two fundamental types of traders:
//   STOCKERS - Buy low, sell high (arbitrage)
//   MOVERS   - Get paid to transport (freight)
//
// A trading company can do both, or specialize.
// They must choose HOW to move things:
//   LAND - Slower, cheaper infrastructure, limited by roads
//   SEA  - Faster for bulk, requires ports, weather-dependent
//
// Routes are PROGRAMS. Caravans execute them.
// The trader doesn't decide at each node - they follow the route.
//

// ============================================
// TRANSPORT MODES
// ============================================

export const TransportModeSchema = z.enum([
  // Land
  "porter",           // Human carrying (50 lbs, 15 mi/day)
  "pack_animal",      // Mules, donkeys (200 lbs, 20 mi/day)
  "cart",             // Horse-drawn cart (500 lbs, 20 mi/day, needs road)
  "wagon",            // Heavy wagon (2000 lbs, 15 mi/day, needs road)
  "caravan",          // Multiple wagons (10000+ lbs, 12 mi/day)

  // Sea
  "rowboat",          // Small boat (500 lbs, 20 mi/day coastal)
  "sailing_boat",     // Small sailing (2000 lbs, 40 mi/day)
  "cog",              // Merchant ship (50000 lbs, 60 mi/day)
  "galleon",          // Large merchant (200000 lbs, 80 mi/day)
  "barge",            // River barge (100000 lbs, 30 mi/day, rivers only)

  // Special
  "teleportation",    // Magic (instant, very expensive, weight limited)
  "spelljammer",      // Space travel (different rules)
]);
export type TransportMode = z.infer<typeof TransportModeSchema>;

export const TRANSPORT_SPECS: Record<TransportMode, {
  category: "land" | "sea" | "river" | "special";
  capacityLbs: number;
  milesPerDay: number;
  requiresRoad: boolean;
  requiresPort: boolean;
  crewRequired: number;
  baseCostPerMile: number;  // GP per mile
  riskModifier: number;     // Multiplier on route danger
}> = {
  // Land
  porter: {
    category: "land",
    capacityLbs: 50,
    milesPerDay: 15,
    requiresRoad: false,
    requiresPort: false,
    crewRequired: 1,
    baseCostPerMile: 0.01,
    riskModifier: 1.5,  // Vulnerable
  },
  pack_animal: {
    category: "land",
    capacityLbs: 200,
    milesPerDay: 20,
    requiresRoad: false,
    requiresPort: false,
    crewRequired: 1,
    baseCostPerMile: 0.02,
    riskModifier: 1.2,
  },
  cart: {
    category: "land",
    capacityLbs: 500,
    milesPerDay: 20,
    requiresRoad: true,
    requiresPort: false,
    crewRequired: 1,
    baseCostPerMile: 0.03,
    riskModifier: 1.0,
  },
  wagon: {
    category: "land",
    capacityLbs: 2000,
    milesPerDay: 15,
    requiresRoad: true,
    requiresPort: false,
    crewRequired: 2,
    baseCostPerMile: 0.05,
    riskModifier: 0.9,
  },
  caravan: {
    category: "land",
    capacityLbs: 10000,
    milesPerDay: 12,
    requiresRoad: true,
    requiresPort: false,
    crewRequired: 10,
    baseCostPerMile: 0.1,
    riskModifier: 0.6,  // Safety in numbers
  },

  // Sea
  rowboat: {
    category: "sea",
    capacityLbs: 500,
    milesPerDay: 20,
    requiresRoad: false,
    requiresPort: false,  // Can beach
    crewRequired: 2,
    baseCostPerMile: 0.02,
    riskModifier: 1.5,
  },
  sailing_boat: {
    category: "sea",
    capacityLbs: 2000,
    milesPerDay: 40,
    requiresRoad: false,
    requiresPort: true,
    crewRequired: 4,
    baseCostPerMile: 0.03,
    riskModifier: 1.2,
  },
  cog: {
    category: "sea",
    capacityLbs: 50000,
    milesPerDay: 60,
    requiresRoad: false,
    requiresPort: true,
    crewRequired: 15,
    baseCostPerMile: 0.02,
    riskModifier: 0.8,
  },
  galleon: {
    category: "sea",
    capacityLbs: 200000,
    milesPerDay: 80,
    requiresRoad: false,
    requiresPort: true,
    crewRequired: 50,
    baseCostPerMile: 0.015,
    riskModifier: 0.5,
  },
  barge: {
    category: "river",
    capacityLbs: 100000,
    milesPerDay: 30,
    requiresRoad: false,
    requiresPort: true,
    crewRequired: 8,
    baseCostPerMile: 0.01,
    riskModifier: 0.7,
  },

  // Special
  teleportation: {
    category: "special",
    capacityLbs: 500,
    milesPerDay: 99999,  // Instant
    requiresRoad: false,
    requiresPort: false,
    crewRequired: 1,
    baseCostPerMile: 10,  // Very expensive
    riskModifier: 0.1,
  },
  spelljammer: {
    category: "special",
    capacityLbs: 50000,
    milesPerDay: 100000000, // Space travel
    requiresRoad: false,
    requiresPort: true,  // Needs dock
    crewRequired: 20,
    baseCostPerMile: 0.001, // Efficient at scale
    riskModifier: 1.0,
  },
};

// ============================================
// TRADER TYPES
// ============================================

export const TraderTypeSchema = z.enum([
  "stocker",     // Buys low, sells high (arbitrage)
  "mover",       // Paid to transport (freight)
  "hybrid",      // Does both
]);
export type TraderType = z.infer<typeof TraderTypeSchema>;

// ============================================
// TRADING COMPANY
// ============================================

export const TradingCompanySchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  type: TraderTypeSchema,
  reputation: z.number().min(0).max(100).default(50),

  // Ownership
  ownerId: z.string().uuid(),
  ownerType: z.enum(["faction", "npc", "character", "party"]),
  ownerName: z.string(),

  // Headquarters
  headquartersSettlementId: z.string().uuid(),
  headquartersName: z.string(),

  // Fleet & Assets
  fleet: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),                    // "The Dawn Trader", "Ironhoof Wagon Train"
    mode: TransportModeSchema,
    condition: z.number().min(0).max(100).default(100),
    currentLocationId: z.string().uuid().optional(),
    currentRouteId: z.string().uuid().optional(),
    status: z.enum(["idle", "loading", "in_transit", "unloading", "maintenance", "lost"]),
    crew: z.number().int().default(0),
    cargoCapacity: z.number().default(0),
    currentCargo: z.array(z.object({
      commodityId: z.string(),
      quantity: z.number(),
      purchasePrice: z.number(),         // For stockers
      destinationId: z.string().uuid().optional(),
      ownerId: z.string().uuid().optional(), // For movers: who owns the cargo
    })).default([]),
  })).default([]),

  // Routes (programs the company executes)
  routes: z.array(z.string().uuid()).default([]),

  // Finances
  treasury: z.number().default(0),
  creditRating: z.number().min(0).max(100).default(50),

  // Operations
  operatingCostsPerDay: z.number().default(0),
  revenueThisMonth: z.number().default(0),
  expensesThisMonth: z.number().default(0),
  profitMargin: z.number().default(0),

  // Licenses & Permissions
  tradeLicenses: z.array(z.object({
    grantedBy: z.string().uuid(),        // Faction ID
    grantedByName: z.string(),
    scope: z.enum(["local", "regional", "continental"]),
    commodities: z.array(z.string()).default([]), // Empty = all
    expiresAt: z.string().optional(),
    taxRate: z.number().min(0).max(1).default(0.05),
  })).default([]),

  // Relationships
  factionStandings: z.record(z.string(), z.number()).default({}), // factionId -> standing

  // Employees
  employees: z.array(z.object({
    npcId: z.string().uuid(),
    role: z.enum(["captain", "driver", "guard", "clerk", "factor", "apprentice"]),
    wage: z.number(),
    assignedTo: z.string().uuid().optional(), // Fleet item ID
  })).default([]),

  // Warehouses
  warehouses: z.array(z.object({
    id: z.string().uuid(),
    settlementId: z.string().uuid(),
    settlementName: z.string(),
    capacity: z.number(),
    currentUsed: z.number(),
    inventory: z.record(z.string(), z.number()).default({}), // commodityId -> quantity
    rentPerMonth: z.number(),
  })).default([]),

  // Tracking
  totalCargoMovedAllTime: z.number().default(0),
  totalRevenueAllTime: z.number().default(0),
  routesCompletedAllTime: z.number().int().default(0),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TradingCompany = z.infer<typeof TradingCompanySchema>;

// ============================================
// TRADE ROUTE (The Program)
// ============================================

export const TradeRouteProgramSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),                      // "Iron Road", "Sword Coast Run"

  // Owner
  companyId: z.string().uuid().optional(), // If owned by company
  public: z.boolean().default(false),    // Can others use this route?

  // Route type
  routeType: z.enum([
    "circuit",      // A → B → C → A (loop)
    "shuttle",      // A → B → A (back and forth)
    "one_way",      // A → B (single direction)
    "hub_spoke",    // A → B, A → C, A → D (from hub)
  ]),

  // Nodes (stops along the route)
  nodes: z.array(z.object({
    settlementId: z.string().uuid(),
    settlementName: z.string(),
    order: z.number().int(),             // Sequence in route

    // What to do at this stop
    actions: z.array(z.object({
      type: z.enum([
        "buy",         // Purchase commodity (stockers)
        "sell",        // Sell commodity (stockers)
        "load",        // Load cargo (movers)
        "unload",      // Unload cargo (movers)
        "resupply",    // Restock provisions
        "rest",        // Crew rest
        "maintenance", // Vehicle repair
      ]),
      commodityId: z.string().optional(),
      quantity: z.number().optional(),     // Max quantity
      priceThreshold: z.number().optional(), // Only buy if below / sell if above
      duration: z.number().int().optional(), // Slots to spend
    })).default([]),

    // How long to stay
    minStaySlots: z.number().int().default(2),
    maxStaySlots: z.number().int().default(8),
  })).min(2),

  // Edges (connections between nodes)
  edges: z.array(z.object({
    fromOrder: z.number().int(),
    toOrder: z.number().int(),
    worldEdgeId: z.string().uuid().optional(), // Link to world graph edge
    distance: z.number(),                // Miles
    terrain: z.array(z.string()).default([]),
    dangerLevel: z.enum(["safe", "patrolled", "risky", "dangerous", "deadly"]),
    tolls: z.number().default(0),        // GP to traverse
  })).min(1),

  // Preferred transport
  preferredMode: TransportModeSchema.optional(),
  allowedModes: z.array(TransportModeSchema).default([]),

  // Economics
  estimatedRevenue: z.number().optional(),    // Per circuit
  estimatedCost: z.number().optional(),
  estimatedProfit: z.number().optional(),
  estimatedDuration: z.number().optional(),   // Days per circuit

  // Commodities this route typically moves
  primaryCommodities: z.array(z.string()).default([]),

  // Risk assessment
  overallRisk: z.enum(["low", "medium", "high", "extreme"]).default("medium"),
  knownHazards: z.array(z.string()).default([]),

  // Season effects
  seasonalModifiers: z.object({
    spring: z.number().default(1),
    summer: z.number().default(1),
    autumn: z.number().default(1),
    winter: z.number().default(1),
  }).default({ spring: 1, summer: 1, autumn: 1, winter: 1 }),

  // Status
  status: z.enum(["active", "suspended", "blocked", "abandoned"]).default("active"),
  lastTraversedAt: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TradeRouteProgram = z.infer<typeof TradeRouteProgramSchema>;

// ============================================
// CARAVAN (Executing a Route)
// ============================================

export const CaravanSchema = z.object({
  id: z.string().uuid(),

  // What route are we executing
  routeId: z.string().uuid(),
  routeName: z.string(),

  // Who owns this caravan
  companyId: z.string().uuid(),
  companyName: z.string(),

  // Fleet items in this caravan
  fleetIds: z.array(z.string().uuid()),

  // Current position
  currentNodeOrder: z.number().int(),
  currentSettlementId: z.string().uuid().optional(),
  currentSettlementName: z.string().optional(),

  // If in transit
  inTransit: z.boolean().default(false),
  transitFromOrder: z.number().int().optional(),
  transitToOrder: z.number().int().optional(),
  transitProgress: z.number().min(0).max(1).default(0), // 0-1
  transitStartedAt: z.string().optional(),
  estimatedArrival: z.string().optional(),

  // Cargo manifest
  cargo: z.array(z.object({
    commodityId: z.string(),
    quantity: z.number(),
    weightLbs: z.number(),
    value: z.number(),
    origin: z.string(),                  // Settlement name
    destination: z.string().optional(),  // For movers
    ownerId: z.string().uuid().optional(),
  })).default([]),
  totalCargoWeight: z.number().default(0),
  totalCargoValue: z.number().default(0),

  // Crew & Guards
  captain: z.object({
    npcId: z.string().uuid().optional(),
    name: z.string(),
    skill: z.number().int().default(1),
  }).optional(),
  crewCount: z.number().int().default(0),
  guardCount: z.number().int().default(0),

  // Provisions
  provisions: z.object({
    food: z.number().default(0),         // Days of food
    water: z.number().default(0),
    fodder: z.number().default(0),       // For animals
  }),

  // Status
  status: z.enum([
    "preparing",    // At origin, loading
    "traveling",    // On the road/sea
    "arrived",      // At destination, unloading
    "trading",      // Buying/selling
    "resting",      // Crew rest
    "stranded",     // Problem occurred
    "lost",         // Destroyed/captured
  ]).default("preparing"),

  // Problems
  problems: z.array(z.object({
    type: z.enum([
      "bandit_attack",
      "monster_attack",
      "weather_delay",
      "breakdown",
      "illness",
      "mutiny",
      "cargo_spoiled",
      "toll_dispute",
    ]),
    severity: z.enum(["minor", "moderate", "severe", "critical"]),
    description: z.string(),
    occurredAt: z.string(),
    resolved: z.boolean().default(false),
  })).default([]),

  // Circuit tracking
  circuitNumber: z.number().int().default(1),
  circuitStartedAt: z.string(),

  // Financials for this run
  runRevenue: z.number().default(0),
  runExpenses: z.number().default(0),
  runProfit: z.number().default(0),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Caravan = z.infer<typeof CaravanSchema>;

// ============================================
// FREIGHT CONTRACT (Mover business)
// ============================================

export const FreightContractSchema = z.object({
  id: z.string().uuid(),

  // Parties
  shipperId: z.string().uuid(),          // Who wants cargo moved
  shipperType: z.enum(["faction", "npc", "character", "party", "company"]),
  shipperName: z.string(),

  carrierId: z.string().uuid(),          // Trading company moving it
  carrierName: z.string(),

  // Cargo
  cargo: z.array(z.object({
    commodityId: z.string(),
    quantity: z.number(),
    weightLbs: z.number(),
    declaredValue: z.number(),           // For insurance
  })),
  totalWeight: z.number(),
  totalDeclaredValue: z.number(),

  // Route
  originSettlementId: z.string().uuid(),
  originName: z.string(),
  destinationSettlementId: z.string().uuid(),
  destinationName: z.string(),
  routeId: z.string().uuid().optional(), // Specific route to use

  // Terms
  paymentAmount: z.number(),             // GP for the job
  paymentTerms: z.enum([
    "upfront",           // Pay before departure
    "on_delivery",       // Pay on arrival
    "split",             // Half and half
    "on_credit",         // Pay later (reputation required)
  ]),
  insuranceIncluded: z.boolean().default(false),
  insuranceValue: z.number().default(0),

  // Deadlines
  agreedAt: z.string(),
  pickupDeadline: z.string(),
  deliveryDeadline: z.string(),

  // Penalties
  lateDeliveryPenalty: z.number().default(0),     // GP per day late
  damagePenalty: z.number().default(0),           // Percentage of declared value

  // Status
  status: z.enum([
    "proposed",
    "accepted",
    "pickup_scheduled",
    "in_transit",
    "delivered",
    "disputed",
    "cancelled",
    "defaulted",
  ]).default("proposed"),

  // Tracking
  pickedUpAt: z.string().optional(),
  deliveredAt: z.string().optional(),

  // Resolution
  actualPayment: z.number().optional(),
  penalties: z.number().optional(),
  damages: z.number().optional(),
  disputeReason: z.string().optional(),

  createdAt: z.string(),
});
export type FreightContract = z.infer<typeof FreightContractSchema>;

// ============================================
// COMMODITY ARBITRAGE (Stocker business)
// ============================================

export const ArbitrageOpportunitySchema = z.object({
  id: z.string().uuid(),

  // What
  commodityId: z.string(),
  commodityName: z.string(),

  // Where
  buySettlementId: z.string().uuid(),
  buySettlementName: z.string(),
  buyPrice: z.number(),
  buyQuantityAvailable: z.number(),

  sellSettlementId: z.string().uuid(),
  sellSettlementName: z.string(),
  sellPrice: z.number(),
  sellDemand: z.number(),

  // Route
  routeId: z.string().uuid().optional(),
  distanceMiles: z.number(),
  travelDays: z.number(),

  // Economics
  priceDifferential: z.number(),         // Sell - Buy
  transportCost: z.number(),             // Per unit
  netProfitPerUnit: z.number(),
  totalPotentialProfit: z.number(),      // For max quantity
  returnOnInvestment: z.number(),        // Percentage

  // Risk
  routeRisk: z.enum(["low", "medium", "high", "extreme"]),
  riskAdjustedProfit: z.number(),

  // Timing
  discoveredAt: z.string(),
  validUntil: z.string().optional(),     // Prices may change

  // Who knows about it
  knownTo: z.array(z.string().uuid()).default([]),
  publicKnowledge: z.boolean().default(false),
});
export type ArbitrageOpportunity = z.infer<typeof ArbitrageOpportunitySchema>;

// ============================================
// PORT / WAYSTATION
// ============================================

export const LogisticsHubSchema = z.object({
  id: z.string().uuid(),

  // Location
  settlementId: z.string().uuid(),
  settlementName: z.string(),

  // Type
  hubType: z.enum([
    "port",          // Sea access
    "river_port",    // River access
    "caravan_stop",  // Land routes
    "waystation",    // Road rest stop
    "warehouse",     // Storage only
  ]),

  // Capabilities
  canDock: z.array(TransportModeSchema).default([]),
  dockingCapacity: z.number().int().default(0),    // How many at once
  currentDocked: z.number().int().default(0),

  storageCapacity: z.number().default(0),          // Total weight
  currentStorageUsed: z.number().default(0),

  // Services
  services: z.object({
    repair: z.boolean().default(false),
    resupply: z.boolean().default(true),
    crewHiring: z.boolean().default(false),
    moneyChanging: z.boolean().default(false),
    warehousing: z.boolean().default(true),
    customsInspection: z.boolean().default(false),
  }),

  // Fees
  dockingFeePerDay: z.number().default(0),
  storageFeePerDayPerTon: z.number().default(0),
  repairCostMultiplier: z.number().default(1),

  // Customs
  customsRequired: z.boolean().default(false),
  customsInspectionChance: z.number().min(0).max(1).default(0.1),
  customsFeePercentage: z.number().min(0).max(1).default(0.05),

  // Contraband
  contrabandList: z.array(z.string()).default([]), // Commodity IDs

  // Control
  controlledBy: z.string().uuid().optional(),      // Faction
  controllerName: z.string().optional(),

  // Traffic
  averageShipsPerDay: z.number().default(0),
  averageCaravansPerDay: z.number().default(0),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LogisticsHub = z.infer<typeof LogisticsHubSchema>;
