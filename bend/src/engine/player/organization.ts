import { z } from "zod";
import { Property } from "./property";

// ============================================
// PLAYER ORGANIZATION SYSTEM
// ============================================
//
// Philosophy: PLAYERS BUILD EMPIRES, NOT SWORDS
//
// The endgame isn't a +5 sword. It's a:
//   - Trading company with routes across the continent
//   - Mercenary company that kings hire
//   - Thieves guild that controls the shadows
//   - Wizard academy that shapes the next generation
//
// Players don't DO these things. They OWN them.
// Followers DO the work.
// The simulation runs the results.
// Players make strategic decisions.
//

// ============================================
// ORGANIZATION TYPES
// ============================================

export const OrganizationTypeSchema = z.enum([
  // Commercial
  "trading_company",        // Buy/sell goods across routes
  "merchant_house",         // Own shops, warehouses
  "banking_house",          // Loans, letters of credit
  "shipping_company",       // Transport by sea/river
  "caravan_company",        // Transport by land

  // Production
  "manufacturing_guild",    // Workshops producing goods
  "mining_company",         // Extraction operations
  "farming_estate",         // Agricultural production
  "logging_company",        // Timber operations

  // Service
  "mercenary_company",      // Soldiers for hire
  "adventuring_guild",      // Adventurer organization
  "spy_network",            // Information gathering
  "assassins_guild",        // Discrete services
  "thieves_guild",          // Criminal enterprise

  // Institutional
  "wizard_academy",         // Magic education
  "temple",                 // Religious institution
  "knightly_order",         // Martial brotherhood
  "bardic_college",         // Artistic institution

  // Political
  "noble_house",            // Political dynasty
  "faction",                // Political organization
]);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

// ============================================
// ORGANIZATION SCHEMA
// ============================================

export const OrganizationSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  type: OrganizationTypeSchema,
  motto: z.string().optional(),
  description: z.string().optional(),

  // Ownership
  founders: z.array(z.object({
    entityId: z.string().uuid(),
    entityType: z.enum(["character", "npc"]),
    name: z.string(),
    sharePercent: z.number(),
    role: z.string(),
  })),

  // Leadership
  leadership: z.object({
    leaderId: z.string().uuid(),
    leaderName: z.string(),
    leaderTitle: z.string(),
    councilMembers: z.array(z.object({
      entityId: z.string().uuid(),
      name: z.string(),
      title: z.string(),
      department: z.string(),
    })).default([]),
  }),

  // Size and reach
  tier: z.number().int().min(1).max(5),  // 1=startup, 5=continental power
  headquarters: z.object({
    propertyId: z.string().uuid(),
    settlementId: z.string().uuid(),
    settlementName: z.string(),
  }).optional(),

  territories: z.array(z.string().uuid()).default([]),

  // Assets
  assets: z.object({
    properties: z.array(z.string().uuid()).default([]),   // Owned properties
    deeds: z.array(z.string().uuid()).default([]),        // Held deeds
    ships: z.array(z.string().uuid()).default([]),        // Owned vessels
    caravans: z.array(z.string().uuid()).default([]),     // Trade caravans
    treasury: z.number().default(0),                       // Liquid gold
    inventory: z.record(z.string(), z.number()).default({}), // Stockpiled goods
  }),

  // Personnel
  personnel: z.object({
    totalHeadcount: z.number().int(),
    followers: z.array(z.string().uuid()).default([]),    // Follower IDs
    hirelings: z.number().int().default(0),               // Generic workers
    specialists: z.array(z.object({
      npcId: z.string().uuid(),
      name: z.string(),
      role: z.string(),
      salary: z.number(),
    })).default([]),
  }),

  // Reputation
  reputation: z.object({
    general: z.number().int().min(-100).max(100),         // Public reputation
    byFaction: z.record(z.string(), z.number()).default({}),
    specialty: z.string().optional(),                      // What they're known for
  }),

  // Finances
  finances: z.object({
    weeklyRevenue: z.number().default(0),
    weeklyExpenses: z.number().default(0),
    weeklyProfit: z.number().default(0),
    reserveFund: z.number().default(0),
    debts: z.array(z.object({
      creditor: z.string(),
      amount: z.number(),
      interestRate: z.number(),
      dueDate: z.string(),
    })).default([]),
  }),

  // Operations
  operations: z.object({
    // Trade routes (for trading companies)
    tradeRoutes: z.array(z.string().uuid()).default([]),

    // Production (for manufacturing)
    workshops: z.array(z.string().uuid()).default([]),
    productionOrders: z.array(z.object({
      itemId: z.string(),
      quantity: z.number(),
      deadline: z.string().optional(),
    })).default([]),

    // Contracts (for mercenaries, spies, etc)
    activeContracts: z.array(z.object({
      contractId: z.string().uuid(),
      client: z.string(),
      description: z.string(),
      payment: z.number(),
      deadline: z.string().optional(),
      status: z.enum(["active", "completed", "failed"]),
    })).default([]),

    // Standing orders (ongoing operations)
    standingOrders: z.array(z.object({
      id: z.string().uuid(),
      type: z.string(),
      description: z.string(),
      resourcesAllocated: z.number(),
      priority: z.enum(["low", "medium", "high", "critical"]),
    })).default([]),
  }),

  // Status
  status: z.enum([
    "founding",             // Just started
    "operating",            // Normal operations
    "expanding",            // Growth phase
    "struggling",           // Financial trouble
    "dormant",              // Temporarily inactive
    "dissolved",            // Shut down
  ]).default("operating"),

  // History
  founded: z.string(),
  milestones: z.array(z.object({
    date: z.string(),
    event: z.string(),
    significance: z.enum(["minor", "moderate", "major", "historic"]),
  })).default([]),
});
export type Organization = z.infer<typeof OrganizationSchema>;

// ============================================
// ORGANIZATION TIER REQUIREMENTS
// ============================================

export const ORGANIZATION_TIER_REQUIREMENTS: Record<number, {
  minFollowers: number;
  minProperties: number;
  minTreasury: number;
  minReputation: number;
  capabilities: string[];
  monthlyUpkeep: number;
}> = {
  1: {
    minFollowers: 1,
    minProperties: 0,
    minTreasury: 100,
    minReputation: 0,
    capabilities: ["Basic operations", "Local presence"],
    monthlyUpkeep: 50,
  },
  2: {
    minFollowers: 5,
    minProperties: 1,
    minTreasury: 1000,
    minReputation: 10,
    capabilities: ["Expanded operations", "Multiple locations"],
    monthlyUpkeep: 200,
  },
  3: {
    minFollowers: 20,
    minProperties: 3,
    minTreasury: 5000,
    minReputation: 25,
    capabilities: ["Regional influence", "Specialist roles"],
    monthlyUpkeep: 1000,
  },
  4: {
    minFollowers: 50,
    minProperties: 5,
    minTreasury: 20000,
    minReputation: 50,
    capabilities: ["Multi-regional", "Political influence"],
    monthlyUpkeep: 5000,
  },
  5: {
    minFollowers: 100,
    minProperties: 10,
    minTreasury: 100000,
    minReputation: 75,
    capabilities: ["Continental reach", "Shape world events"],
    monthlyUpkeep: 25000,
  },
};

// ============================================
// PLAYER BUSINESS
// ============================================

export const PlayerBusinessTypeSchema = z.enum([
  // Retail (TERTIARY)
  "general_store",
  "specialty_shop",
  "tavern_inn",
  "apothecary",
  "jeweler",
  "armorer",
  "bookseller",

  // Production (SECONDARY)
  "smithy",
  "tannery",
  "brewery",
  "bakery",
  "carpentry",
  "alchemy_lab",
  "enchanting_shop",

  // Extraction (PRIMARY)
  "mine",
  "farm",
  "ranch",
  "fishery",
  "logging_camp",

  // Services
  "bank",
  "moneychanger",
  "shipping",
  "messenger_service",
  "stable",
]);
export type PlayerBusinessType = z.infer<typeof PlayerBusinessTypeSchema>;

export const PlayerBusinessSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  type: PlayerBusinessTypeSchema,

  // Ownership
  ownerId: z.string().uuid(),
  ownerType: z.enum(["character", "party", "organization"]),
  organizationId: z.string().uuid().optional(),

  // Location
  propertyId: z.string().uuid(),
  settlementId: z.string().uuid(),
  districtId: z.string().uuid().optional(),

  // Guild affiliation
  guildId: z.string().uuid().optional(),
  guildRank: z.string().optional(),

  // Staff
  manager: z.object({
    followerId: z.string().uuid().optional(),
    npcId: z.string().uuid().optional(),
    name: z.string(),
    skill: z.number().int().min(1).max(5),
    salary: z.number(),
  }).optional(),

  employees: z.array(z.object({
    entityId: z.string().uuid(),
    entityType: z.enum(["follower", "npc", "hireling"]),
    name: z.string(),
    role: z.string(),
    skill: z.number().int().min(1).max(5),
    salary: z.number(),
  })).default([]),

  // Operations
  operatingHours: z.object({
    open: z.number().int().min(0).max(23),
    close: z.number().int().min(0).max(23),
    daysOpen: z.array(z.string()),
  }),

  // Inventory (for retail/production)
  inventory: z.array(z.object({
    commodityId: z.string(),
    quantity: z.number(),
    purchasePrice: z.number(),
    salePrice: z.number(),
    quality: z.string(),
  })).default([]),

  // Production (for workshops)
  production: z.object({
    recipes: z.array(z.string()).default([]),
    currentOrders: z.array(z.object({
      recipeId: z.string(),
      quantity: z.number(),
      progress: z.number(),
      deadline: z.string().optional(),
    })).default([]),
    weeklyCapacity: z.number().default(0),
  }).optional(),

  // Financials
  financials: z.object({
    weeklyRevenue: z.number(),
    weeklyExpenses: z.number(),
    weeklyProfit: z.number(),
    revenueHistory: z.array(z.object({
      week: z.string(),
      revenue: z.number(),
      expenses: z.number(),
      profit: z.number(),
    })).default([]),
  }),

  // Reputation
  reputation: z.object({
    quality: z.number().int().min(0).max(100),    // Product/service quality
    reliability: z.number().int().min(0).max(100), // On-time, honest
    value: z.number().int().min(0).max(100),       // Price fairness
    overall: z.number().int().min(0).max(100),
  }),

  // Customer base
  customers: z.object({
    regularCount: z.number().int(),
    averageSpend: z.number(),
    satisfaction: z.number().int().min(0).max(100),
    notableCustomers: z.array(z.object({
      entityId: z.string().uuid(),
      name: z.string(),
      spendLevel: z.enum(["low", "medium", "high", "vip"]),
    })).default([]),
  }),

  // Status
  status: z.enum([
    "preparing",            // Not yet open
    "open",                 // Normal operations
    "busy",                 // High demand
    "struggling",           // Low demand
    "closed_temporary",     // Temporarily closed
    "closed_permanent",     // Out of business
  ]).default("open"),

  // Established
  established: z.string(),
});
export type PlayerBusiness = z.infer<typeof PlayerBusinessSchema>;

// ============================================
// BUSINESS OPERATIONS
// ============================================

export interface BusinessTickResult {
  businessId: string;
  businessName: string;

  revenue: number;
  expenses: number;
  profit: number;

  events: Array<{
    type: string;
    description: string;
    impact: number;
  }>;

  inventoryChanges: Array<{
    commodityId: string;
    change: number;
    reason: string;
  }>;

  reputationChange: number;
  customerChange: number;

  managerReport: string;
}

/**
 * Simulate a business for one week.
 */
export function tickBusiness(
  business: PlayerBusiness,
  marketConditions: {
    demandMultiplier: number;
    priceMultiplier: number;
    competitionLevel: number;
  },
  _managerPresent: boolean,
): BusinessTickResult {
  const events: BusinessTickResult["events"] = [];
  const inventoryChanges: BusinessTickResult["inventoryChanges"] = [];

  // Base revenue from customer base
  let baseRevenue = business.customers.regularCount * business.customers.averageSpend;

  // Manager skill affects revenue
  const managerBonus = business.manager
    ? (business.manager.skill - 3) * 0.1  // +/- 10% per skill above/below 3
    : -0.2;  // No manager = 20% penalty

  baseRevenue *= (1 + managerBonus);

  // Market conditions
  baseRevenue *= marketConditions.demandMultiplier;

  // Reputation affects revenue
  const repBonus = (business.reputation.overall - 50) / 100;  // +/- 50%
  baseRevenue *= (1 + repBonus * 0.5);

  // Random events (5% chance each)
  if (Math.random() < 0.05) {
    const positiveEvents = [
      { type: "big_order", description: "Large order from wealthy customer", impact: baseRevenue * 0.5 },
      { type: "good_review", description: "Word of mouth brings new customers", impact: baseRevenue * 0.2 },
      { type: "lucky_find", description: "Found valuable item in inventory", impact: 100 },
    ];
    const event = positiveEvents[Math.floor(Math.random() * positiveEvents.length)];
    events.push(event);
    baseRevenue += event.impact;
  }

  if (Math.random() < 0.05) {
    const negativeEvents = [
      { type: "theft", description: "Inventory stolen", impact: -baseRevenue * 0.3 },
      { type: "bad_review", description: "Unhappy customer spreads complaints", impact: -baseRevenue * 0.1 },
      { type: "spoilage", description: "Goods spoiled or damaged", impact: -50 },
    ];
    const event = negativeEvents[Math.floor(Math.random() * negativeEvents.length)];
    events.push(event);
    baseRevenue += event.impact;
  }

  // Calculate expenses
  let expenses = 0;

  // Staff wages
  if (business.manager) {
    expenses += business.manager.salary;
  }
  for (const employee of business.employees) {
    expenses += employee.salary;
  }

  // Operating costs (rent, utilities, supplies)
  const operatingCosts = business.financials.weeklyExpenses -
    (business.manager?.salary || 0) -
    business.employees.reduce((sum, e) => sum + e.salary, 0);
  expenses += operatingCosts;

  // Guild dues
  if (business.guildId) {
    expenses += 10;  // Base guild dues
  }

  const profit = Math.max(0, baseRevenue) - expenses;

  // Update inventory (simplified)
  // Would integrate with actual market/production systems

  // Reputation change
  let reputationChange = 0;
  if (profit > 0 && business.customers.satisfaction > 70) {
    reputationChange = 1;
  } else if (profit < 0 || business.customers.satisfaction < 30) {
    reputationChange = -1;
  }

  // Customer change
  let customerChange = 0;
  if (business.reputation.overall > 60) {
    customerChange = Math.floor(Math.random() * 3);
  } else if (business.reputation.overall < 40) {
    customerChange = -Math.floor(Math.random() * 3);
  }

  // Manager report
  const managerReport = generateManagerReport(business, profit, events);

  return {
    businessId: business.id,
    businessName: business.name,
    revenue: Math.round(baseRevenue * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    events,
    inventoryChanges,
    reputationChange,
    customerChange,
    managerReport,
  };
}

function generateManagerReport(
  business: PlayerBusiness,
  profit: number,
  events: BusinessTickResult["events"],
): string {
  const managerName = business.manager?.name || "Acting Manager";

  let report = `Weekly Report from ${managerName}:\n\n`;

  if (profit > 0) {
    report += `Business is doing well. Profit of ${profit.toFixed(2)}gp this week.\n`;
  } else if (profit < 0) {
    report += `Difficult week. Lost ${Math.abs(profit).toFixed(2)}gp.\n`;
  } else {
    report += `Broke even this week.\n`;
  }

  if (events.length > 0) {
    report += `\nNotable events:\n`;
    for (const event of events) {
      report += `- ${event.description}\n`;
    }
  }

  if (business.inventory.length > 0) {
    const lowStock = business.inventory.filter(i => i.quantity < 10);
    if (lowStock.length > 0) {
      report += `\nLow stock warning: ${lowStock.map(i => i.commodityId).join(", ")}\n`;
    }
  }

  return report;
}

// ============================================
// FOLLOWER ASSIGNMENT
// ============================================

export const FollowerAssignmentSchema = z.object({
  followerId: z.string().uuid(),
  followerName: z.string(),

  // Assignment
  assignmentType: z.enum([
    "property_manager",     // Run a property
    "business_manager",     // Run a business
    "caravan_leader",       // Lead a trade caravan
    "ship_captain",         // Captain a vessel
    "expedition_leader",    // Lead exploration
    "garrison_commander",   // Command defenses
    "workshop_foreman",     // Supervise production
    "spy_handler",          // Manage information network
    "personal_assistant",   // Attend the player
    "trainer",              // Train other followers
    "guard",                // Security
    "unassigned",           // Available
  ]),

  assignedTo: z.object({
    entityId: z.string().uuid().optional(),
    entityType: z.enum(["property", "business", "caravan", "ship", "organization"]).optional(),
    entityName: z.string().optional(),
  }).optional(),

  // Performance
  performance: z.object({
    efficiency: z.number().min(0).max(2),  // 1.0 = normal
    loyalty: z.number().min(0).max(100),
    morale: z.number().min(0).max(100),
    lastReview: z.string(),
  }),

  // Compensation
  salary: z.number(),
  bonuses: z.number().default(0),
  housing: z.enum(["none", "barracks", "quarters", "private"]).default("none"),

  // Status
  status: z.enum(["active", "injured", "missing", "dead", "retired", "deserted"]).default("active"),

  // Assignment history
  history: z.array(z.object({
    assignment: z.string(),
    from: z.string(),
    to: z.string(),
    performance: z.string(),
  })).default([]),
});
export type FollowerAssignment = z.infer<typeof FollowerAssignmentSchema>;

/**
 * Calculate follower efficiency based on skill match.
 */
export function calculateFollowerEfficiency(
  follower: {
    skills: Record<string, number>;
    traits: string[];
  },
  assignmentType: FollowerAssignment["assignmentType"],
): number {
  // Base efficiency
  let efficiency = 1.0;

  // Skills that help each assignment
  const relevantSkills: Record<string, string[]> = {
    property_manager: ["administration", "persuasion", "insight"],
    business_manager: ["administration", "persuasion", "appraisal"],
    caravan_leader: ["survival", "animal_handling", "perception"],
    ship_captain: ["navigation", "leadership", "athletics"],
    expedition_leader: ["survival", "investigation", "nature"],
    garrison_commander: ["leadership", "tactics", "intimidation"],
    workshop_foreman: ["crafting", "administration", "perception"],
    spy_handler: ["deception", "insight", "stealth"],
    personal_assistant: ["persuasion", "insight", "history"],
    trainer: ["teaching", "insight", "athletics"],
    guard: ["perception", "athletics", "intimidation"],
    unassigned: [],
  };

  const skills = relevantSkills[assignmentType] || [];

  for (const skill of skills) {
    const skillLevel = follower.skills[skill] || 0;
    efficiency += (skillLevel - 10) * 0.05;  // +/- 5% per point above/below 10
  }

  // Traits
  const helpfulTraits: Record<string, string[]> = {
    property_manager: ["organized", "diplomatic", "honest"],
    business_manager: ["shrewd", "charismatic", "numerate"],
    caravan_leader: ["hardy", "vigilant", "experienced_traveler"],
    garrison_commander: ["disciplined", "brave", "tactical"],
    spy_handler: ["paranoid", "observant", "discrete"],
  };

  const harmful: Record<string, string[]> = {
    property_manager: ["lazy", "corrupt", "violent"],
    business_manager: ["honest_to_a_fault", "lazy", "addicted"],
    spy_handler: ["trusting", "talkative", "honest"],
  };

  const helpful = helpfulTraits[assignmentType] || [];
  const bad = harmful[assignmentType] || [];

  for (const trait of follower.traits) {
    if (helpful.includes(trait)) efficiency += 0.1;
    if (bad.includes(trait)) efficiency -= 0.15;
  }

  return Math.max(0.5, Math.min(2.0, efficiency));
}

// ============================================
// DOWNTIME ORDERS
// ============================================

export const DowntimeOrderTypeSchema = z.enum([
  // Business
  "expand_business",        // Grow existing business
  "restock_inventory",      // Buy goods for shop
  "adjust_prices",          // Change pricing strategy
  "hire_employee",          // Add staff
  "fire_employee",          // Remove staff
  "run_promotion",          // Marketing

  // Property
  "renovate_property",      // Improve condition
  "fortify_property",       // Add defenses
  "expand_property",        // Add space
  "collect_rent",           // Gather income

  // Production
  "produce_goods",          // Make items
  "research_recipe",        // Learn new recipe
  "upgrade_workshop",       // Better equipment

  // Trade
  "launch_caravan",         // Send goods
  "establish_route",        // Create new route
  "negotiate_contract",     // Get trade deal

  // Organization
  "recruit_followers",      // Get new followers
  "train_followers",        // Improve skills
  "assign_follower",        // Change assignments
  "expand_operations",      // Grow org

  // Special
  "gather_information",     // Spy network
  "conduct_ritual",         // Magic operations
  "political_maneuvering",  // Faction influence
  "throw_party",            // Reputation boost
]);
export type DowntimeOrderType = z.infer<typeof DowntimeOrderTypeSchema>;

export const DowntimeOrderSchema = z.object({
  id: z.string().uuid(),

  // Who issued
  issuerId: z.string().uuid(),
  issuerName: z.string(),

  // What
  type: DowntimeOrderTypeSchema,
  description: z.string(),

  // Target
  target: z.object({
    entityId: z.string().uuid(),
    entityType: z.enum(["business", "property", "organization", "follower", "caravan"]),
    entityName: z.string(),
  }),

  // Parameters
  parameters: z.record(z.string(), z.any()).default({}),

  // Resources
  goldAllocated: z.number().default(0),
  followersAssigned: z.array(z.string().uuid()).default([]),

  // Timing
  issuedAt: z.string(),
  startAt: z.string().optional(),            // When to start
  duration: z.number().int().optional(),      // Slots to complete
  deadline: z.string().optional(),            // Must finish by

  // Priority
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),

  // Status
  status: z.enum([
    "queued",               // Waiting to start
    "in_progress",          // Being executed
    "completed",            // Finished successfully
    "failed",               // Could not complete
    "cancelled",            // Cancelled by player
    "blocked",              // Waiting on something
  ]).default("queued"),

  // Progress
  progress: z.number().min(0).max(100).default(0),
  blockedBy: z.string().optional(),

  // Result
  result: z.object({
    success: z.boolean(),
    outcome: z.string(),
    rewards: z.array(z.object({
      type: z.string(),
      value: z.any(),
    })).optional(),
    costs: z.array(z.object({
      type: z.string(),
      value: z.any(),
    })).optional(),
  }).optional(),

  // Logging
  log: z.array(z.object({
    timestamp: z.string(),
    message: z.string(),
  })).default([]),
});
export type DowntimeOrder = z.infer<typeof DowntimeOrderSchema>;

/**
 * Process a downtime order for one tick.
 */
export function processDowntimeOrder(
  order: DowntimeOrder,
  context: {
    business?: PlayerBusiness;
    property?: Property;
    organization?: Organization;
    followers?: FollowerAssignment[];
    marketConditions?: any;
  },
): {
  order: DowntimeOrder;
  progressMade: number;
  events: string[];
  completed: boolean;
} {
  const events: string[] = [];
  let progressMade = 0;

  // Base progress depends on order type
  const baseProgress: Record<DowntimeOrderType, number> = {
    expand_business: 5,
    restock_inventory: 20,
    adjust_prices: 100,
    hire_employee: 15,
    fire_employee: 100,
    run_promotion: 10,
    renovate_property: 3,
    fortify_property: 2,
    expand_property: 2,
    collect_rent: 50,
    produce_goods: 10,
    research_recipe: 5,
    upgrade_workshop: 3,
    launch_caravan: 25,
    establish_route: 10,
    negotiate_contract: 15,
    recruit_followers: 10,
    train_followers: 5,
    assign_follower: 100,
    expand_operations: 5,
    gather_information: 10,
    conduct_ritual: 10,
    political_maneuvering: 5,
    throw_party: 20,
  };

  progressMade = baseProgress[order.type] || 10;

  // Follower efficiency bonus
  if (order.followersAssigned.length > 0 && context.followers) {
    const avgEfficiency = context.followers
      .filter(f => order.followersAssigned.includes(f.followerId))
      .reduce((sum, f) => sum + f.performance.efficiency, 0) / order.followersAssigned.length;

    progressMade *= avgEfficiency;
  }

  // Gold allocation helps
  if (order.goldAllocated > 0) {
    const goldBonus = Math.min(0.5, order.goldAllocated / 1000);
    progressMade *= (1 + goldBonus);
  }

  // Update progress
  const newProgress = Math.min(100, order.progress + progressMade);
  const completed = newProgress >= 100;

  // Log
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: completed
      ? `Order completed: ${order.description}`
      : `Progress: ${newProgress.toFixed(1)}%`,
  };

  const updatedOrder: DowntimeOrder = {
    ...order,
    progress: newProgress,
    status: completed ? "completed" : "in_progress",
    log: [...order.log, logEntry],
    result: completed ? {
      success: true,
      outcome: `Successfully completed: ${order.description}`,
    } : undefined,
  };

  return {
    order: updatedOrder,
    progressMade,
    events,
    completed,
  };
}
