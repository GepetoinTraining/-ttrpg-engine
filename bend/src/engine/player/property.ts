import { z } from "zod";

// ============================================
// PROPERTY & DEED SYSTEM
// ============================================
//
// Philosophy: PLAYERS DON'T DO THINGS. THEY OWN THINGS.
//
// The player's character is an adventurer.
// Adventurers don't run shops - they OWN shops.
// They don't craft swords - they EMPLOY smiths.
// They don't guard caravans - they HIRE guards.
//
// To own things, you need:
//   1. FAME - Recognition from a faction
//   2. DEED - Legal right to property
//   3. CAPITAL - Money to buy/build
//   4. FOLLOWERS - People to run it
//
// Properties operate in the background.
// The simulation runs them.
// Players collect the profits (or losses).
//

// ============================================
// DEED TYPES
// ============================================

export const DeedTypeSchema = z.enum([
  // Urban property
  "dwelling",              // House, apartment
  "shop",                  // Commercial storefront
  "workshop",              // Production facility
  "warehouse",             // Storage
  "tavern",                // Food, drink, lodging
  "temple",                // Religious (rare, faction-granted)

  // Rural property
  "farmland",              // Agricultural
  "pasture",               // Livestock
  "forest",                // Timber rights
  "mine",                  // Mineral extraction
  "fishery",               // Fishing rights

  // Special
  "fort",                  // Defensible structure
  "tower",                 // Wizard tower, watchtower
  "manor",                 // Noble estate
  "ship",                  // Vessel ownership
  "guild_seat",            // Position in guild (not physical)

  // Claims (not yet developed)
  "land_claim",            // Undeveloped land
  "ruin_claim",            // Abandoned structure
  "dungeon_claim",         // Cleared dungeon territory
]);
export type DeedType = z.infer<typeof DeedTypeSchema>;

// ============================================
// DEED ACQUISITION METHODS
// ============================================

export const DeedAcquisitionSchema = z.enum([
  // Legal
  "purchase",              // Bought with gold
  "grant",                 // Given by faction/noble
  "inheritance",           // From family/patron
  "reward",                // Quest reward
  "charter",               // Government charter

  // Earned
  "fame_unlock",           // Fame threshold reached
  "conquest",              // Took by force (legitimized)
  "discovery",             // Found and claimed
  "construction",          // Built from scratch

  // Questionable
  "squatter",              // Occupied unclaimed
  "forgery",               // Fake deed (risky)
  "theft",                 // Stolen deed (very risky)
]);
export type DeedAcquisition = z.infer<typeof DeedAcquisitionSchema>;

// ============================================
// DEED SCHEMA
// ============================================

export const DeedSchema = z.object({
  id: z.string().uuid(),

  // What
  type: DeedTypeSchema,
  name: z.string(),                      // "Grimstone Manor", "The Rusty Anchor"
  description: z.string().optional(),

  // Where
  settlementId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  address: z.string().optional(),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),

  // Legal status
  status: z.enum([
    "valid",                             // Legally recognized
    "contested",                         // Ownership disputed
    "pending",                           // Awaiting approval
    "revoked",                           // Taken away
    "expired",                           // Lease ended
    "forged",                            // Fake (player knows)
  ]).default("valid"),

  // How acquired
  acquisition: z.object({
    method: DeedAcquisitionSchema,
    date: z.string(),
    grantingFaction: z.string().uuid().optional(),
    grantingNpc: z.string().uuid().optional(),
    purchasePrice: z.number().optional(),
    fameRequired: z.number().optional(),
    questId: z.string().uuid().optional(),
  }),

  // Owner
  ownerId: z.string().uuid(),
  ownerType: z.enum(["character", "party", "organization"]),
  ownerName: z.string(),

  // Property details (links to actual property)
  propertyId: z.string().uuid().optional(),

  // Rights granted
  rights: z.object({
    occupy: z.boolean().default(true),
    modify: z.boolean().default(true),
    sublet: z.boolean().default(false),
    sell: z.boolean().default(true),
    bequeath: z.boolean().default(true),
    extract: z.boolean().default(false),   // Mining, logging rights
    tax: z.boolean().default(false),       // Collect taxes (noble)
    justice: z.boolean().default(false),   // Low/high justice (noble)
  }),

  // Obligations
  obligations: z.array(z.object({
    type: z.enum(["tax", "tithe", "service", "tribute", "maintenance"]),
    toFaction: z.string().uuid(),
    toFactionName: z.string(),
    amount: z.number().optional(),
    frequency: z.enum(["weekly", "monthly", "yearly", "on_demand"]),
    description: z.string(),
  })).default([]),

  // Value
  currentValue: z.number(),
  lastAppraisal: z.string(),

  // Encumbrances
  encumbrances: z.array(z.object({
    type: z.enum(["mortgage", "lien", "easement", "covenant"]),
    holder: z.string(),
    amount: z.number().optional(),
    description: z.string(),
  })).default([]),

  // History
  previousOwners: z.array(z.object({
    name: z.string(),
    from: z.string(),
    to: z.string(),
    transferMethod: z.string(),
  })).default([]),
});
export type Deed = z.infer<typeof DeedSchema>;

// ============================================
// PROPERTY SCHEMA (Physical)
// ============================================

export const PropertyConditionSchema = z.enum([
  "ruined",                // 0-20% - Barely standing
  "dilapidated",           // 20-40% - Major repairs needed
  "worn",                  // 40-60% - Functional but shabby
  "good",                  // 60-80% - Well-maintained
  "excellent",             // 80-100% - Pristine
]);

export const PropertySchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),
  type: DeedTypeSchema,

  // Location
  settlementId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
  address: z.string().optional(),

  // Physical characteristics
  size: z.object({
    footprint: z.number(),               // Square feet
    floors: z.number().int(),
    rooms: z.number().int(),
    capacity: z.number().int(),          // People or units
  }),

  // Condition
  condition: PropertyConditionSchema,
  conditionPercent: z.number().int().min(0).max(100),

  // Features
  features: z.array(z.enum([
    // Structural
    "cellar",
    "attic",
    "tower",
    "courtyard",
    "stable",
    "garden",
    "well",
    "fortified",
    "secret_room",

    // Utilities
    "plumbing",
    "heating",
    "magical_lighting",
    "wards",

    // Commercial
    "storefront",
    "workshop_space",
    "storage",
    "loading_dock",
    "customer_area",

    // Residential
    "living_quarters",
    "servants_quarters",
    "guest_rooms",
    "kitchen",

    // Special
    "shrine",
    "library",
    "laboratory",
    "forge",
    "arena",
  ])).default([]),

  // Current state
  occupancy: z.object({
    status: z.enum(["vacant", "owner_occupied", "rented", "squatted", "condemned"]),
    occupants: z.array(z.object({
      entityId: z.string().uuid(),
      entityType: z.enum(["npc", "character", "follower", "organization"]),
      name: z.string(),
      role: z.string(),                  // "tenant", "employee", "guest", "prisoner"
    })).default([]),
    maxOccupants: z.number().int(),
  }),

  // Economics
  economics: z.object({
    purchaseValue: z.number(),           // What it would cost to buy
    rentalValue: z.number(),             // Monthly rent
    taxAssessment: z.number(),           // Tax basis
    maintenanceCost: z.number(),         // Monthly upkeep
    insuranceAvailable: z.boolean(),
    insuranceCost: z.number().optional(),
  }),

  // If operational (business)
  operation: z.object({
    isOperational: z.boolean(),
    businessType: z.string().optional(),
    employees: z.array(z.string().uuid()).optional(),
    weeklyRevenue: z.number().optional(),
    weeklyExpenses: z.number().optional(),
    inventory: z.record(z.string(), z.number()).optional(),
  }).optional(),

  // Deed link
  deedId: z.string().uuid().optional(),

  // Market status
  marketStatus: z.enum([
    "not_for_sale",
    "for_sale",
    "for_rent",
    "auction",
    "foreclosure",
  ]).default("not_for_sale"),

  askingPrice: z.number().optional(),
  askingRent: z.number().optional(),
  listedDate: z.string().optional(),
});
export type Property = z.infer<typeof PropertySchema>;

// ============================================
// HOUSING MARKET
// ============================================

export const HousingMarketSchema = z.object({
  settlementId: z.string().uuid(),
  settlementName: z.string(),

  // Market conditions
  marketCondition: z.enum([
    "buyers_market",        // Lots of supply, low prices
    "balanced",
    "sellers_market",       // Low supply, high prices
    "bubble",               // Prices way too high
    "crash",                // Prices collapsing
  ]),

  priceIndex: z.number(),               // 100 = normal, 150 = 50% above
  rentIndex: z.number(),
  vacancyRate: z.number(),              // 0-1

  // Available properties
  forSale: z.array(z.object({
    propertyId: z.string().uuid(),
    propertyName: z.string(),
    type: DeedTypeSchema,
    askingPrice: z.number(),
    condition: PropertyConditionSchema,
    daysOnMarket: z.number().int(),
  })).default([]),

  forRent: z.array(z.object({
    propertyId: z.string().uuid(),
    propertyName: z.string(),
    type: DeedTypeSchema,
    monthlyRent: z.number(),
    condition: PropertyConditionSchema,
    availableDate: z.string(),
  })).default([]),

  // Recent transactions
  recentSales: z.array(z.object({
    propertyId: z.string().uuid(),
    propertyName: z.string(),
    type: DeedTypeSchema,
    salePrice: z.number(),
    date: z.string(),
  })).default([]),

  // Trends
  trends: z.object({
    priceChange30Days: z.number(),      // Percentage
    priceChange90Days: z.number(),
    volumeChange: z.number(),
    hotDistricts: z.array(z.string()),
    coldDistricts: z.array(z.string()),
  }),
});
export type HousingMarket = z.infer<typeof HousingMarketSchema>;

// ============================================
// FAME → DEED REQUIREMENTS
// ============================================

export const FAME_DEED_THRESHOLDS: Record<string, {
  fameRequired: number;
  factionTypes: string[];
  deedsUnlocked: DeedType[];
  description: string;
}> = {
  local_recognition: {
    fameRequired: 10,
    factionTypes: ["*"],
    deedsUnlocked: ["dwelling"],
    description: "Recognized locally - can purchase a home",
  },
  trusted_citizen: {
    fameRequired: 25,
    factionTypes: ["*"],
    deedsUnlocked: ["shop", "workshop"],
    description: "Trusted - can own commercial property",
  },
  respected_member: {
    fameRequired: 50,
    factionTypes: ["*"],
    deedsUnlocked: ["warehouse", "tavern", "farmland"],
    description: "Respected - larger properties available",
  },
  notable_figure: {
    fameRequired: 75,
    factionTypes: ["*"],
    deedsUnlocked: ["mine", "fort", "ship"],
    description: "Notable - strategic assets accessible",
  },
  faction_hero: {
    fameRequired: 100,
    factionTypes: ["*"],
    deedsUnlocked: ["manor", "tower", "guild_seat"],
    description: "Hero status - prestige properties",
  },
  legendary: {
    fameRequired: 150,
    factionTypes: ["*"],
    deedsUnlocked: ["temple"],
    description: "Legendary - can found institutions",
  },
};

/**
 * Check what deed types a character can acquire based on fame.
 */
export function getUnlockedDeedTypes(
  fameByFaction: Record<string, number>,
): {
  unlockedTypes: DeedType[];
  nextUnlock?: {
    fameNeeded: number;
    deedTypes: DeedType[];
    description: string;
  };
} {
  const unlocked: Set<DeedType> = new Set();
  let highestFame = 0;

  // Find highest fame
  for (const fame of Object.values(fameByFaction)) {
    if (fame > highestFame) highestFame = fame;
  }

  // Determine unlocked deeds
  const thresholds = Object.values(FAME_DEED_THRESHOLDS)
    .sort((a, b) => a.fameRequired - b.fameRequired);

  let nextThreshold: typeof thresholds[0] | undefined;

  for (const threshold of thresholds) {
    if (highestFame >= threshold.fameRequired) {
      for (const deedType of threshold.deedsUnlocked) {
        unlocked.add(deedType);
      }
    } else if (!nextThreshold) {
      nextThreshold = threshold;
    }
  }

  return {
    unlockedTypes: Array.from(unlocked),
    nextUnlock: nextThreshold ? {
      fameNeeded: nextThreshold.fameRequired,
      deedTypes: nextThreshold.deedsUnlocked,
      description: nextThreshold.description,
    } : undefined,
  };
}

// ============================================
// DUNGEON → CLAIM CONVERSION
// ============================================

export const DungeonClaimSchema = z.object({
  id: z.string().uuid(),

  // Source
  dungeonId: z.string().uuid(),
  dungeonName: z.string(),
  clearedBy: z.object({
    partyId: z.string().uuid(),
    partyName: z.string(),
    clearedDate: z.string(),
  }),

  // What can be claimed
  claimableAssets: z.array(z.object({
    type: DeedTypeSchema,
    name: z.string(),
    description: z.string(),
    condition: PropertyConditionSchema,
    estimatedValue: z.number(),
    renovationCost: z.number(),
    requirements: z.array(z.string()),   // What's needed to claim
  })),

  // Claim status
  status: z.enum([
    "unclaimed",            // Party can claim
    "claimed",              // Party has claimed
    "contested",            // Someone else claims it
    "expired",              // Too long, lost right
  ]),

  // Expiration
  expiresAt: z.string().optional(),      // Claim right expires

  // If claimed
  claimedDeedId: z.string().uuid().optional(),
});
export type DungeonClaim = z.infer<typeof DungeonClaimSchema>;

/**
 * Generate claimable assets from a cleared dungeon.
 */
export function generateDungeonClaims(
  dungeonId: string,
  dungeonName: string,
  dungeonType: string,
  dungeonSize: "small" | "medium" | "large" | "massive",
  partyId: string,
  partyName: string,
): DungeonClaim {
  const assets: DungeonClaim["claimableAssets"] = [];

  // Dungeon type determines what can be claimed
  const claimsByType: Record<string, Array<{
    type: DeedType;
    name: string;
    probability: number;
  }>> = {
    crypt: [
      { type: "ruin_claim", name: "Crypt Grounds", probability: 1.0 },
      { type: "temple", name: "Consecrated Chapel", probability: 0.2 },
    ],
    fortress: [
      { type: "fort", name: "Fortress", probability: 1.0 },
      { type: "tower", name: "Watchtower", probability: 0.5 },
      { type: "dwelling", name: "Barracks", probability: 0.7 },
    ],
    mine: [
      { type: "mine", name: "Mine Claim", probability: 1.0 },
      { type: "warehouse", name: "Ore Storage", probability: 0.5 },
    ],
    manor: [
      { type: "manor", name: "Manor House", probability: 1.0 },
      { type: "farmland", name: "Estate Grounds", probability: 0.8 },
      { type: "pasture", name: "Stables", probability: 0.5 },
    ],
    tower: [
      { type: "tower", name: "Wizard Tower", probability: 1.0 },
      { type: "dwelling", name: "Tower Quarters", probability: 0.6 },
    ],
    cave: [
      { type: "mine", name: "Natural Cavern", probability: 0.5 },
      { type: "land_claim", name: "Cave System", probability: 1.0 },
    ],
  };

  const possibleClaims = claimsByType[dungeonType] || [
    { type: "ruin_claim", name: `${dungeonName} Ruins`, probability: 1.0 },
  ];

  // Size affects value and renovation cost
  const sizeMultipliers = {
    small: { value: 1, renovation: 1, extra: 0 },
    medium: { value: 2, renovation: 1.5, extra: 1 },
    large: { value: 4, renovation: 2, extra: 2 },
    massive: { value: 8, renovation: 3, extra: 3 },
  };

  const sizeMod = sizeMultipliers[dungeonSize];

  for (const claim of possibleClaims) {
    if (Math.random() < claim.probability) {
      const baseValue = getBasePropertyValue(claim.type);

      assets.push({
        type: claim.type,
        name: claim.name,
        description: `Cleared from ${dungeonName}`,
        condition: "ruined",              // Dungeons are always ruined
        estimatedValue: baseValue * sizeMod.value,
        renovationCost: baseValue * sizeMod.renovation * 0.5,
        requirements: getRenovationRequirements(claim.type),
      });
    }
  }

  return {
    id: crypto.randomUUID(),
    dungeonId,
    dungeonName,
    clearedBy: {
      partyId,
      partyName,
      clearedDate: new Date().toISOString(),
    },
    claimableAssets: assets,
    status: "unclaimed",
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
  };
}

function getBasePropertyValue(type: DeedType): number {
  const values: Record<DeedType, number> = {
    dwelling: 500,
    shop: 1000,
    workshop: 1500,
    warehouse: 2000,
    tavern: 2500,
    temple: 10000,
    farmland: 1000,
    pasture: 800,
    forest: 1500,
    mine: 5000,
    fishery: 1200,
    fort: 8000,
    tower: 6000,
    manor: 15000,
    ship: 10000,
    guild_seat: 5000,
    land_claim: 500,
    ruin_claim: 200,
    dungeon_claim: 100,
  };

  return values[type] || 1000;
}

function getRenovationRequirements(type: DeedType): string[] {
  const requirements: Record<DeedType, string[]> = {
    dwelling: ["Masons Guild contract", "3 months labor"],
    shop: ["Masons Guild contract", "Merchant Guild approval", "4 months labor"],
    workshop: ["Masons Guild contract", "Relevant craft guild approval", "6 months labor"],
    warehouse: ["Masons Guild contract", "5 months labor"],
    tavern: ["Masons Guild contract", "Innkeepers Guild license", "6 months labor"],
    temple: ["Masons Guild contract", "Religious order blessing", "12 months labor", "Consecration"],
    farmland: ["Land survey", "Seed stock", "Farm equipment"],
    pasture: ["Fencing", "Livestock stock"],
    forest: ["Forester license", "Logging equipment"],
    mine: ["Mining guild assessment", "Safety equipment", "6 months labor"],
    fishery: ["Fishing rights", "Boats and equipment"],
    fort: ["Military architect", "Masons Guild contract", "12 months labor", "Garrison"],
    tower: ["Architect", "Specialized masons", "9 months labor"],
    manor: ["Architect", "Masons Guild contract", "18 months labor", "Staff"],
    ship: ["Shipwrights Guild", "6 months labor", "Crew"],
    guild_seat: ["Guild nomination", "Entrance fee"],
    land_claim: ["Survey", "Boundary markers"],
    ruin_claim: ["Survey", "Safety assessment"],
    dungeon_claim: ["Full clear certification", "Survey"],
  };

  return requirements[type] || ["Survey", "Basic repairs"];
}

// ============================================
// PROPERTY TRANSACTIONS
// ============================================

export interface PropertyPurchaseResult {
  success: boolean;
  deedId?: string;
  propertyId?: string;
  totalCost: number;
  breakdown: {
    purchasePrice: number;
    taxes: number;
    fees: number;
    bribes?: number;
  };
  newOwner: string;
  failureReason?: string;
}

/**
 * Attempt to purchase a property.
 */
export function purchaseProperty(
  property: Property,
  buyer: {
    id: string;
    name: string;
    type: "character" | "party" | "organization";
    availableGold: number;
    fameByFaction: Record<string, number>;
  },
  settlement: {
    id: string;
    name: string;
    taxRate: number;
    controllingFaction: string;
  },
): PropertyPurchaseResult {
  // Check fame requirements
  const { unlockedTypes } = getUnlockedDeedTypes(buyer.fameByFaction);

  if (!unlockedTypes.includes(property.type)) {
    return {
      success: false,
      totalCost: 0,
      breakdown: { purchasePrice: 0, taxes: 0, fees: 0 },
      newOwner: buyer.name,
      failureReason: `Insufficient fame to purchase ${property.type}. Need higher reputation.`,
    };
  }

  // Calculate total cost
  const purchasePrice = property.askingPrice || property.economics.purchaseValue;
  const taxes = purchasePrice * settlement.taxRate;
  const fees = purchasePrice * 0.02;  // 2% transaction fees
  const totalCost = purchasePrice + taxes + fees;

  if (buyer.availableGold < totalCost) {
    return {
      success: false,
      totalCost,
      breakdown: { purchasePrice, taxes, fees },
      newOwner: buyer.name,
      failureReason: `Insufficient funds. Need ${totalCost}gp, have ${buyer.availableGold}gp.`,
    };
  }

  // Create deed
  const deed: Deed = {
    id: crypto.randomUUID(),
    type: property.type,
    name: property.name,
    settlementId: property.settlementId,
    address: property.address,
    status: "valid",
    acquisition: {
      method: "purchase",
      date: new Date().toISOString(),
      purchasePrice,
    },
    ownerId: buyer.id,
    ownerType: buyer.type,
    ownerName: buyer.name,
    propertyId: property.id,
    rights: {
      occupy: true,
      modify: true,
      sublet: true,
      sell: true,
      bequeath: true,
      extract: property.type === "mine" || property.type === "forest" || property.type === "fishery",
      tax: false,
      justice: false,
    },
    obligations: [{
      type: "tax",
      toFaction: settlement.controllingFaction,
      toFactionName: settlement.name,
      amount: property.economics.taxAssessment * settlement.taxRate,
      frequency: "yearly",
      description: "Annual property tax",
    }],
    currentValue: purchasePrice,
    lastAppraisal: new Date().toISOString(),
    previousOwners: [],
    encumbrances: [],
  };

  return {
    success: true,
    deedId: deed.id,
    propertyId: property.id,
    totalCost,
    breakdown: { purchasePrice, taxes, fees },
    newOwner: buyer.name,
  };
}

// ============================================
// PROPERTY INCOME/EXPENSE
// ============================================

export interface PropertyFinancials {
  propertyId: string;
  propertyName: string;
  period: string;

  revenue: {
    rent: number;
    businessIncome: number;
    extractionIncome: number;
    other: number;
    total: number;
  };

  expenses: {
    maintenance: number;
    wages: number;
    taxes: number;
    insurance: number;
    supplies: number;
    other: number;
    total: number;
  };

  netIncome: number;
  cashFlow: number;
}

/**
 * Calculate property financials for a period.
 */
export function calculatePropertyFinancials(
  property: Property,
  deed: Deed,
  employees: Array<{ wage: number }>,
  period: "weekly" | "monthly",
): PropertyFinancials {
  const periodMultiplier = period === "weekly" ? 1 : 4;

  // Revenue
  let rentIncome = 0;
  let businessIncome = 0;
  let extractionIncome = 0;

  if (property.occupancy.status === "rented") {
    rentIncome = property.economics.rentalValue * periodMultiplier;
  }

  if (property.operation?.isOperational) {
    businessIncome = (property.operation.weeklyRevenue || 0) * periodMultiplier;
  }

  if (deed.rights.extract && property.operation?.isOperational) {
    // Would link to extraction system
    extractionIncome = 0;  // Calculated from extraction engine
  }

  const totalRevenue = rentIncome + businessIncome + extractionIncome;

  // Expenses
  const maintenance = property.economics.maintenanceCost * periodMultiplier;
  const wages = employees.reduce((sum, e) => sum + e.wage, 0) * periodMultiplier;
  const taxes = deed.obligations
    .filter(o => o.type === "tax")
    .reduce((sum, o) => sum + (o.amount || 0) / (o.frequency === "yearly" ? 52 :
                                                  o.frequency === "monthly" ? 4 : 1), 0) * periodMultiplier;
  const insurance = (property.economics.insuranceCost || 0) * periodMultiplier;
  const supplies = (property.operation?.weeklyExpenses || 0) * periodMultiplier;

  const totalExpenses = maintenance + wages + taxes + insurance + supplies;

  return {
    propertyId: property.id,
    propertyName: property.name,
    period,
    revenue: {
      rent: rentIncome,
      businessIncome,
      extractionIncome,
      other: 0,
      total: totalRevenue,
    },
    expenses: {
      maintenance,
      wages,
      taxes,
      insurance,
      supplies,
      other: 0,
      total: totalExpenses,
    },
    netIncome: totalRevenue - totalExpenses,
    cashFlow: totalRevenue - totalExpenses,
  };
}
