import { z } from "zod";

// ============================================
// MARKETS SYSTEM - THE TERTIARY SECTOR
// ============================================
//
// Philosophy: MERCHANTS CLIMB THE LADDER
//
// Stall → Shop → Emporium → Trading House → Walmart
//
// The merchant's dream:
//   - Start with a cart and a dream
//   - Get a stall at the market
//   - Save enough for a shop
//   - Expand to an emporium
//   - Become a trading house (stocker/mover)
//   - Or... become the everything store
//
// Above shop level, you're in LOGISTICS territory
// (bulk distribution, stockers, the proto-Walmart)
//

// ============================================
// MERCHANT PROGRESSION
// ============================================

export const MerchantTierSchema = z.enum([
  // TERTIARY (retail/services)
  "peddler",        // Wandering seller, no fixed location
  "stall",          // Market stall, rents space
  "shop",           // Owns a building, specialized
  "emporium",       // Large shop, multiple product lines

  // LOGISTICS (wholesale/distribution)
  "trading_house",  // Bulk buying/selling, routes
  "consortium",     // Multiple trading houses, regional
  "megamart",       // The everything store - proto-Walmart
]);
export type MerchantTier = z.infer<typeof MerchantTierSchema>;

export const MERCHANT_TIER_REQUIREMENTS: Record<MerchantTier, {
  minCapital: number;          // GP needed to operate at this level
  minReputation: number;       // 0-100 reputation score
  guildMembership: boolean;    // Must be in merchant guild?
  employees: number;           // Minimum staff
  licenses: string[];          // Required permits
  typicalMargin: number;       // Profit margin percentage
  riskLevel: string;           // Business risk
}> = {
  peddler: {
    minCapital: 10,
    minReputation: 0,
    guildMembership: false,
    employees: 0,
    licenses: [],
    typicalMargin: 0.3,        // 30% markup on small volumes
    riskLevel: "high",         // No protection, theft, weather
  },
  stall: {
    minCapital: 100,
    minReputation: 10,
    guildMembership: false,    // Recommended but not required
    employees: 0,
    licenses: ["market_permit"],
    typicalMargin: 0.25,
    riskLevel: "medium",
  },
  shop: {
    minCapital: 500,
    minReputation: 25,
    guildMembership: true,     // Must be in merchant guild
    employees: 1,
    licenses: ["market_permit", "business_license"],
    typicalMargin: 0.2,
    riskLevel: "low",
  },
  emporium: {
    minCapital: 2000,
    minReputation: 50,
    guildMembership: true,
    employees: 5,
    licenses: ["market_permit", "business_license", "import_license"],
    typicalMargin: 0.15,
    riskLevel: "low",
  },
  trading_house: {
    minCapital: 10000,
    minReputation: 70,
    guildMembership: true,
    employees: 20,
    licenses: ["market_permit", "business_license", "import_license", "warehouse_license"],
    typicalMargin: 0.1,        // Lower margin, higher volume
    riskLevel: "medium",       // Route risks
  },
  consortium: {
    minCapital: 50000,
    minReputation: 85,
    guildMembership: true,
    employees: 100,
    licenses: ["market_permit", "business_license", "import_license", "warehouse_license", "banking_license"],
    typicalMargin: 0.08,
    riskLevel: "medium",
  },
  megamart: {
    minCapital: 100000,
    minReputation: 90,
    guildMembership: true,     // Probably RUNS the guild
    employees: 500,
    licenses: ["everything"],
    typicalMargin: 0.05,       // Walmart model: tiny margins, massive volume
    riskLevel: "low",          // Too big to fail (mostly)
  },
};

// ============================================
// MERCHANT SPECIALIZATION
// ============================================

export const MerchantSpecializationSchema = z.enum([
  // Single-category specialists
  "grocer",           // Food
  "clothier",         // Textiles, clothing
  "armorer",          // Weapons and armor (overlaps with smiths guild)
  "apothecary",       // Potions, medicine, herbs
  "jeweler",          // Gems, jewelry
  "bookseller",       // Books, scrolls, maps
  "chandler",         // Candles, soap, oils
  "vintner",          // Wine, spirits
  "tobacconist",      // Pipes, tobacco, exotic herbs
  "furrier",          // Furs, leather goods
  "spice_merchant",   // Spices (high value, low volume)
  "curiosities",      // Exotic items, oddities

  // Multi-category
  "general_goods",    // A bit of everything
  "luxury_goods",     // High-end everything
  "adventuring_supplies", // Gear for adventurers

  // Services (still merchants)
  "moneychanger",     // Currency exchange
  "pawnbroker",       // Buy/sell used goods
  "fence",            // Buy/sell stolen goods (illegal)

  // Wholesale only (trading_house+)
  "commodities",      // Raw materials in bulk
  "importer",         // Foreign goods
  "exporter",         // Local goods to foreign markets
]);
export type MerchantSpecialization = z.infer<typeof MerchantSpecializationSchema>;

// What commodities each specialization deals in
export const SPECIALIZATION_COMMODITIES: Record<string, string[]> = {
  grocer: ["grain", "meat", "fish", "produce", "salt", "preserved_food"],
  clothier: ["cloth", "silk", "wool", "linen", "dyes", "clothing"],
  armorer: ["weapons", "armor", "shields", "ammunition"],
  apothecary: ["herbs", "potions", "medicine", "poisons", "magic_components"],
  jeweler: ["gems", "jewelry", "precious_metals", "art_objects"],
  bookseller: ["books", "scrolls", "maps", "ink", "paper"],
  chandler: ["candles", "soap", "oil", "wax", "tallow"],
  vintner: ["wine", "ale", "spirits", "mead", "cider"],
  spice_merchant: ["spices", "exotic_herbs", "incense", "perfume"],
  furrier: ["furs", "leather", "hides", "pelts"],
  curiosities: ["exotic", "artifacts", "rarities", "foreign_goods"],
  general_goods: ["*"],  // Everything
  luxury_goods: ["silk", "spices", "jewelry", "wine", "art", "exotic"],
  adventuring_supplies: ["weapons", "armor", "potions", "rations", "rope", "tools", "camping_gear"],
  moneychanger: ["currency", "gems", "letters_of_credit"],
  pawnbroker: ["*"],     // Everything (used)
  fence: ["*"],          // Everything (stolen)
  commodities: ["grain", "timber", "ore", "iron", "cloth", "leather"],
  importer: ["exotic", "spices", "silk", "foreign_goods"],
  exporter: ["local_goods", "commodities"],
};

// ============================================
// MERCHANT NPC
// ============================================

export const MerchantSchema = z.object({
  id: z.string().uuid(),
  npcId: z.string().uuid(),           // Links to NPC system
  name: z.string(),

  // Business tier
  tier: MerchantTierSchema,
  specialization: MerchantSpecializationSchema,

  // Location
  settlementId: z.string().uuid(),
  venueId: z.string().uuid().optional(), // Stall, shop, etc.

  // Economics
  capital: z.number(),                 // Current liquid assets
  inventory: z.array(z.object({
    commodityId: z.string(),
    quantity: z.number(),
    purchasePrice: z.number(),         // What they paid
    quality: z.enum(["poor", "common", "good", "excellent", "masterwork"]).default("common"),
  })).default([]),

  weeklyRevenue: z.number().default(0),
  weeklyExpenses: z.number().default(0),
  profitMargin: z.number().default(0.2),

  // Reputation
  reputation: z.number().int().min(0).max(100).default(25),
  reputationFactors: z.array(z.object({
    source: z.string(),
    modifier: z.number(),
    reason: z.string(),
  })).default([]),

  // Personality (affects haggling)
  personality: z.object({
    greed: z.number().min(0).max(1).default(0.5),      // How hard they bargain
    patience: z.number().min(0).max(1).default(0.5),   // How long before walking away
    honesty: z.number().min(0).max(1).default(0.7),    // Will they cheat?
    risk: z.number().min(0).max(1).default(0.3),       // Will they speculate?
  }),

  // Relationships
  suppliers: z.array(z.object({
    merchantId: z.string().uuid(),
    commodities: z.array(z.string()),
    discount: z.number(),              // Loyalty discount
    reliability: z.number(),           // 0-1
  })).default([]),

  regularCustomers: z.array(z.object({
    entityId: z.string().uuid(),
    entityType: z.enum(["npc", "character", "faction"]),
    discount: z.number(),
    lastPurchase: z.string(),
  })).default([]),

  // Guild membership
  guildMembership: z.object({
    guildId: z.string().uuid().optional(),
    rank: z.string().optional(),
    standing: z.enum(["poor", "fair", "good", "excellent"]).optional(),
  }).optional(),

  // Operating hours
  schedule: z.object({
    openHour: z.number().int().min(0).max(23).default(8),
    closeHour: z.number().int().min(0).max(23).default(18),
    daysOpen: z.array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])).default(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]),
    marketDays: z.array(z.string()).default([]),  // Special market days
  }),

  // Staff
  employees: z.array(z.object({
    npcId: z.string().uuid(),
    role: z.enum(["apprentice", "clerk", "guard", "porter", "bookkeeper"]),
    wage: z.number(),
  })).default([]),

  // Status
  status: z.enum(["operating", "closed", "bankrupt", "traveling", "retired"]).default("operating"),

  // Goals (for AI/simulation)
  currentGoal: z.enum([
    "survive",           // Just making ends meet
    "grow",              // Expanding business
    "specialize",        // Becoming expert in niche
    "diversify",         // Adding product lines
    "upgrade_tier",      // Moving to next tier
    "retire",            // Winding down
    "corner_market",     // Monopoly attempt
  ]).default("grow"),

  // History
  established: z.string(),
  previousTiers: z.array(z.object({
    tier: MerchantTierSchema,
    from: z.string(),
    to: z.string(),
  })).default([]),
});
export type Merchant = z.infer<typeof MerchantSchema>;

// ============================================
// MARKET VENUES
// ============================================

export const MarketVenueTypeSchema = z.enum([
  // Outdoor
  "cart",              // Mobile, follows crowds
  "stall",             // Fixed spot in market square
  "tent",              // Semi-permanent, market fairs

  // Indoor
  "shop",              // Single storefront
  "workshop_shop",     // Craftsman selling direct (smithy, bakery)
  "emporium",          // Large shop, multiple rooms
  "warehouse_outlet",  // Bulk sales, minimal service

  // Specialized
  "auction_house",     // Bidding on goods
  "exchange",          // Commodities trading
  "bazaar_stall",      // Foreign goods market

  // Institutions
  "guild_hall",        // Guild-controlled sales
  "temple_market",     // Religious goods, tithed
  "black_market",      // Illegal goods
]);
export type MarketVenueType = z.infer<typeof MarketVenueTypeSchema>;

export const MarketVenueSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: MarketVenueTypeSchema,

  // Location
  settlementId: z.string().uuid(),
  districtId: z.string().uuid().optional(),
  address: z.string().optional(),

  // Ownership
  ownerId: z.string().uuid().optional(),     // Merchant who owns it
  ownerType: z.enum(["merchant", "guild", "faction", "settlement"]).optional(),
  rentedBy: z.string().uuid().optional(),    // Current tenant if rented

  // Economics
  rentCost: z.number().default(0),           // Weekly rent (if rented)
  propertyValue: z.number().default(0),
  maintenanceCost: z.number().default(0),

  // Capacity
  displayCapacity: z.number().int(),         // How many items can display
  storageCapacity: z.number().int(),         // Back room storage
  customerCapacity: z.number().int(),        // Max customers at once

  // Features
  features: z.array(z.enum([
    "secure_storage",      // Reduces theft
    "display_cases",       // +reputation for jewelry/curiosities
    "workshop_attached",   // Can craft on-site
    "living_quarters",     // Owner lives here
    "loading_dock",        // Easy bulk delivery
    "prestigious_location", // +reputation
    "poor_location",       // -reputation, -rent
    "signage",             // Attracts customers
    "guard_post",          // Security
  ])).default([]),

  // Operating status
  status: z.enum(["open", "closed", "under_construction", "condemned", "for_rent", "for_sale"]).default("open"),

  // Traffic
  dailyFootTraffic: z.number().int().default(0),
  peakHours: z.array(z.number().int()).default([10, 11, 12, 17, 18]),

  // License requirements
  requiredLicenses: z.array(z.string()).default([]),
});
export type MarketVenue = z.infer<typeof MarketVenueSchema>;

// ============================================
// MARKET DISTRICT (collection of venues)
// ============================================

export const MarketDistrictSchema = z.object({
  id: z.string().uuid(),
  settlementId: z.string().uuid(),
  name: z.string(),

  // Character
  character: z.enum([
    "general_market",      // Mixed goods, town square
    "luxury_quarter",      // High-end shops
    "docks_market",        // Near port, imports
    "craft_district",      // Workshops selling direct
    "foreign_bazaar",      // Exotic goods
    "night_market",        // After-hours, seedier
    "temple_market",       // Religious district sales
    "wholesale_district",  // Bulk trading
  ]),

  // Venues in this district
  venueIds: z.array(z.string().uuid()).default([]),

  // Economics
  averageRent: z.number(),
  footTraffic: z.enum(["dead", "slow", "moderate", "busy", "packed"]),
  wealthLevel: z.enum(["poor", "modest", "comfortable", "wealthy", "aristocratic"]),

  // Control
  controlledBy: z.string().uuid().optional(),  // Faction, guild
  taxRate: z.number().default(0.05),           // District tax
  protectionFee: z.number().default(0),        // "Protection" money

  // Events
  marketDays: z.array(z.object({
    dayOfWeek: z.string(),
    name: z.string(),
    bonusTraffic: z.number(),
  })).default([]),

  // Safety
  crimeRate: z.enum(["none", "low", "moderate", "high", "dangerous"]).default("low"),
  guardPresence: z.enum(["none", "minimal", "normal", "heavy", "martial_law"]).default("normal"),

  // Atmosphere
  atmosphere: z.array(z.string()).default([]),  // "bustling", "exotic", "dangerous", "refined"
});
export type MarketDistrict = z.infer<typeof MarketDistrictSchema>;

// ============================================
// AUCTION HOUSE
// ============================================

export const AuctionSchema = z.object({
  id: z.string().uuid(),
  auctionHouseId: z.string().uuid(),

  // Item
  item: z.object({
    name: z.string(),
    description: z.string(),
    commodityId: z.string().optional(),
    quantity: z.number().default(1),
    quality: z.string().optional(),
    isUnique: z.boolean().default(false),
  }),

  // Seller
  sellerId: z.string().uuid(),
  sellerName: z.string(),
  reservePrice: z.number(),              // Minimum they'll accept

  // Auction state
  status: z.enum(["upcoming", "active", "sold", "unsold", "cancelled"]),
  startTime: z.string(),
  endTime: z.string(),

  // Bidding
  currentBid: z.number().default(0),
  currentBidderId: z.string().uuid().optional(),
  bidHistory: z.array(z.object({
    bidderId: z.string().uuid(),
    bidderName: z.string(),
    amount: z.number(),
    time: z.string(),
  })).default([]),

  // Fees
  buyerPremium: z.number().default(0.1),   // 10% added to hammer price
  sellerCommission: z.number().default(0.15), // 15% taken from seller
});
export type Auction = z.infer<typeof AuctionSchema>;

export const AuctionHouseSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  name: z.string(),

  // Specialization
  specialization: z.enum([
    "general",           // Everything
    "art_antiques",      // Art, artifacts
    "magical",           // Magic items
    "livestock",         // Animals
    "real_estate",       // Property
    "commodities",       // Bulk goods futures
    "slaves",            // If legal in setting
  ]),

  // Reputation
  reputation: z.number().int().min(0).max(100),
  exclusivity: z.enum(["public", "members", "invitation"]),
  minimumLotValue: z.number(),           // Won't auction below this

  // Schedule
  auctionDays: z.array(z.string()).default(["saturday"]),

  // Active auctions
  activeAuctionIds: z.array(z.string().uuid()).default([]),
  upcomingAuctionIds: z.array(z.string().uuid()).default([]),

  // Fees
  buyerPremium: z.number().default(0.1),
  sellerCommission: z.number().default(0.15),
  listingFee: z.number().default(10),
});
export type AuctionHouse = z.infer<typeof AuctionHouseSchema>;

// ============================================
// HAGGLING SYSTEM
// ============================================

export const HaggleContextSchema = z.object({
  // Participants
  buyerId: z.string().uuid(),
  buyerName: z.string(),
  buyerCharisma: z.number().int(),
  buyerReputation: z.number().int().default(0),

  sellerId: z.string().uuid(),
  sellerName: z.string(),
  sellerPersonality: z.object({
    greed: z.number(),
    patience: z.number(),
    honesty: z.number(),
  }),

  // Item
  item: z.object({
    name: z.string(),
    commodityId: z.string().optional(),
    quantity: z.number(),
    quality: z.string().optional(),
  }),

  // Prices
  basePrice: z.number(),
  askingPrice: z.number(),              // Seller's opening
  offerPrice: z.number(),               // Buyer's current offer

  // Context modifiers
  modifiers: z.array(z.object({
    source: z.string(),
    value: z.number(),
    description: z.string(),
  })).default([]),

  // State
  round: z.number().int().default(1),
  maxRounds: z.number().int().default(5),  // Patience limit
  status: z.enum(["negotiating", "deal", "no_deal", "walked_away"]).default("negotiating"),

  // Final result
  finalPrice: z.number().optional(),
  discount: z.number().optional(),         // Percentage off asking
});
export type HaggleContext = z.infer<typeof HaggleContextSchema>;

// ============================================
// HAGGLING MECHANICS
// ============================================

/**
 * Calculate the seller's resistance to discounts.
 * Higher = harder to haggle down.
 */
export function calculateSellerResistance(merchant: Merchant, context: HaggleContext): number {
  let resistance = 10;  // Base DC

  // Greed increases resistance
  resistance += Math.floor(merchant.personality.greed * 10);

  // Low stock = higher resistance
  const itemStock = merchant.inventory.find(i => i.commodityId === context.item.commodityId);
  if (itemStock && itemStock.quantity < 5) {
    resistance += 3;  // Scarce item
  }

  // High margin items = more room to negotiate
  if (merchant.profitMargin > 0.3) {
    resistance -= 2;
  }

  // Buyer reputation helps
  resistance -= Math.floor(context.buyerReputation / 25);

  // Regular customer discount already applied
  const isRegular = merchant.regularCustomers.some(c => c.entityId === context.buyerId);
  if (isRegular) {
    resistance -= 3;
  }

  return Math.max(5, Math.min(25, resistance));  // Clamp to 5-25
}

/**
 * Resolve a haggling attempt.
 * Returns the discount percentage achieved (0-1).
 */
export function resolveHaggle(
  context: HaggleContext,
  merchant: Merchant,
  roll: number,                           // d20 roll
  persuasionBonus: number,                // Buyer's persuasion modifier
): {
  success: boolean;
  discount: number;
  newAskingPrice: number;
  merchantResponse: string;
  roundsRemaining: number;
} {
  const resistance = calculateSellerResistance(merchant, context);
  const total = roll + persuasionBonus;
  const margin = total - resistance;

  let discount = 0;
  let response: string;
  let roundsUsed = 1;

  if (roll === 20) {
    // Natural 20: Best possible deal
    discount = 0.2 + (margin > 0 ? margin * 0.01 : 0);  // 20%+ off
    response = pickResponse(merchant, "nat20");
  } else if (roll === 1) {
    // Natural 1: Merchant gets offended
    discount = -0.1;  // Price goes UP
    response = pickResponse(merchant, "nat1");
    roundsUsed = 2;  // Lose extra round
  } else if (margin >= 10) {
    // Great success
    discount = 0.15;
    response = pickResponse(merchant, "great");
  } else if (margin >= 5) {
    // Good success
    discount = 0.10;
    response = pickResponse(merchant, "good");
  } else if (margin >= 0) {
    // Marginal success
    discount = 0.05;
    response = pickResponse(merchant, "marginal");
  } else if (margin >= -5) {
    // Failure, but can continue
    discount = 0;
    response = pickResponse(merchant, "fail");
  } else {
    // Bad failure
    discount = 0;
    response = pickResponse(merchant, "bad_fail");
    roundsUsed = 2;
  }

  // Apply discount to current asking price
  const newAskingPrice = context.askingPrice * (1 - discount);
  const roundsRemaining = context.maxRounds - context.round - roundsUsed + 1;

  return {
    success: discount > 0,
    discount,
    newAskingPrice: Math.round(newAskingPrice * 100) / 100,
    merchantResponse: response,
    roundsRemaining: Math.max(0, roundsRemaining),
  };
}

function pickResponse(_merchant: Merchant, result: string): string {
  const responses: Record<string, string[]> = {
    nat20: [
      "You drive a hard bargain! Fine, take it.",
      "*sighs* My children will go hungry, but... deal.",
      "Are you a wizard? You've enchanted me somehow.",
    ],
    nat1: [
      "Are you trying to insult me? The price just went up!",
      "I've never been so offended. Get out of my shop!",
      "Do I look like a fool to you?",
    ],
    great: [
      "Alright, alright, you win this round.",
      "I can see you know your way around a deal.",
      "For you, friend, a special price.",
    ],
    good: [
      "I suppose I can come down a little...",
      "You're killing me here, but fine.",
      "Only because I like your face.",
    ],
    marginal: [
      "Mmm... I suppose I could budge a tiny bit.",
      "One copper less, that's my final offer.",
      "You're persistent, I'll give you that.",
    ],
    fail: [
      "I think not. The price is fair.",
      "My prices are already reasonable.",
      "Perhaps you'd find better luck elsewhere?",
    ],
    bad_fail: [
      "You're wasting my time. Buy or leave.",
      "I have other customers to attend to.",
      "This conversation is over.",
    ],
  };

  const options = responses[result] || responses["fail"];
  return options[Math.floor(Math.random() * options.length)];
}

// ============================================
// MARKET EVENTS
// ============================================

export const MarketEventTypeSchema = z.enum([
  // Supply events
  "shipment_arrived",      // New goods in town
  "shipment_delayed",      // Expected goods late
  "shipment_lost",         // Goods never arriving
  "warehouse_fire",        // Stock destroyed
  "spoilage",              // Perishables ruined

  // Demand events
  "festival_demand",       // Holiday buying spree
  "military_requisition",  // Army buys up supplies
  "noble_order",           // Large private order
  "fashion_change",        // What's "in" shifts

  // Price events
  "price_war",             // Merchants undercutting
  "price_fixing",          // Cartel behavior
  "currency_fluctuation",  // Money value changes
  "speculation_bubble",    // Prices artificially high
  "bubble_burst",          // Speculation collapse

  // Market structure
  "new_merchant",          // Competition arrives
  "merchant_bankruptcy",   // Competition leaves
  "guild_action",          // Guild intervention
  "government_regulation", // New rules
  "black_market_crackdown", // Illegal trade disrupted

  // External
  "foreign_traders",       // Exotic goods available
  "trade_fair",            // Special market day
  "embargo_effect",        // Trade restriction impact
]);
export type MarketEventType = z.infer<typeof MarketEventTypeSchema>;

export const MarketEventSchema = z.object({
  id: z.string().uuid(),
  type: MarketEventTypeSchema,
  name: z.string(),
  description: z.string(),

  // Scope
  settlementId: z.string().uuid(),
  districtId: z.string().uuid().optional(),
  affectedCommodities: z.array(z.string()).default([]),
  affectedMerchants: z.array(z.string().uuid()).default([]),

  // Effects
  effects: z.array(z.object({
    type: z.enum(["supply", "demand", "price", "availability"]),
    commodityId: z.string(),
    modifier: z.number(),
    isMultiplier: z.boolean(),
  })).default([]),

  // Duration
  startDate: z.string(),
  endDate: z.string().optional(),
  duration: z.string().optional(),

  // Visibility
  publicKnowledge: z.boolean().default(true),
  rumorText: z.string().optional(),

  // Status
  status: z.enum(["upcoming", "active", "resolved"]).default("active"),
});
export type MarketEvent = z.infer<typeof MarketEventSchema>;

// ============================================
// SPECULATION SYSTEM
// ============================================

export const SpeculativePositionSchema = z.object({
  id: z.string().uuid(),

  // Speculator
  traderId: z.string().uuid(),
  traderName: z.string(),
  traderType: z.enum(["merchant", "npc", "character", "faction"]),

  // Position
  commodityId: z.string(),
  positionType: z.enum(["long", "short"]),  // Betting on rise or fall
  quantity: z.number(),
  entryPrice: z.number(),

  // Dates
  openedAt: z.string(),
  expiresAt: z.string().optional(),        // Futures contract expiry

  // Current state
  currentPrice: z.number(),
  unrealizedPnL: z.number(),               // Profit/loss if closed now

  // Margin/collateral
  marginDeposited: z.number(),
  marginRequired: z.number(),
  marginCallTriggered: z.boolean().default(false),

  // Status
  status: z.enum(["open", "closed", "liquidated", "expired"]).default("open"),
  closedAt: z.string().optional(),
  realizedPnL: z.number().optional(),
});
export type SpeculativePosition = z.infer<typeof SpeculativePositionSchema>;

// ============================================
// SETTLEMENT MARKET (complete picture)
// ============================================

export const SettlementMarketCompleteSchema = z.object({
  settlementId: z.string().uuid(),
  settlementName: z.string(),

  // Size/type
  marketSize: z.enum(["none", "village", "town", "city", "metropolis", "trade_hub"]),
  marketType: z.enum(["subsistence", "local", "regional", "continental", "international"]),

  // Districts
  districts: z.array(MarketDistrictSchema).default([]),

  // All venues
  venues: z.array(MarketVenueSchema).default([]),

  // All merchants
  merchants: z.array(z.string().uuid()).default([]),  // Merchant IDs

  // Auction houses
  auctionHouses: z.array(AuctionHouseSchema).default([]),

  // Current prices (from economy.ts)
  prices: z.record(z.string(), z.object({
    basePrice: z.number(),
    currentPrice: z.number(),
    supply: z.number(),
    demand: z.number(),
    trend: z.enum(["crashing", "falling", "stable", "rising", "spiking"]),
    available: z.boolean(),
  })).default({}),

  // Active events
  activeEvents: z.array(MarketEventSchema).default([]),

  // Speculative positions (if trading hub)
  speculativePositions: z.array(z.string().uuid()).default([]),

  // Market health
  health: z.object({
    liquidity: z.enum(["frozen", "thin", "normal", "liquid", "very_liquid"]),
    volatility: z.enum(["stable", "normal", "volatile", "chaotic"]),
    confidence: z.number().int().min(0).max(100),
  }),

  // Trade capacity
  weeklyTurnover: z.number(),             // GP worth of trade
  importCapacity: z.number(),             // How much can come in
  exportCapacity: z.number(),             // How much can go out

  // Regulations
  regulations: z.object({
    priceCeilings: z.record(z.string(), z.number()).default({}),
    priceFloors: z.record(z.string(), z.number()).default({}),
    bannedGoods: z.array(z.string()).default([]),
    licensedGoods: z.array(z.string()).default([]),
    tariffs: z.record(z.string(), z.number()).default({}),
  }),

  // Black market (if exists)
  blackMarket: z.object({
    exists: z.boolean(),
    size: z.enum(["tiny", "small", "moderate", "large", "dominant"]).optional(),
    goods: z.array(z.string()).optional(),
    accessDifficulty: z.number().int().optional(),  // DC to find
  }).default({ exists: false }),

  // Last update
  lastUpdated: z.string(),
});
export type SettlementMarketComplete = z.infer<typeof SettlementMarketCompleteSchema>;

// ============================================
// MERCHANT PROGRESSION FUNCTIONS
// ============================================

/**
 * Check if a merchant can upgrade to the next tier.
 */
export function canUpgradeTier(merchant: Merchant): {
  canUpgrade: boolean;
  nextTier: MerchantTier | null;
  missingRequirements: string[];
} {
  const tierOrder: MerchantTier[] = [
    "peddler", "stall", "shop", "emporium",
    "trading_house", "consortium", "megamart"
  ];

  const currentIndex = tierOrder.indexOf(merchant.tier);
  if (currentIndex >= tierOrder.length - 1) {
    return { canUpgrade: false, nextTier: null, missingRequirements: ["Already at max tier"] };
  }

  const nextTier = tierOrder[currentIndex + 1];
  const requirements = MERCHANT_TIER_REQUIREMENTS[nextTier];
  const missing: string[] = [];

  if (merchant.capital < requirements.minCapital) {
    missing.push(`Need ${requirements.minCapital}gp capital (have ${merchant.capital})`);
  }

  if (merchant.reputation < requirements.minReputation) {
    missing.push(`Need ${requirements.minReputation} reputation (have ${merchant.reputation})`);
  }

  if (requirements.guildMembership && !merchant.guildMembership?.guildId) {
    missing.push("Must be guild member");
  }

  if (merchant.employees.length < requirements.employees) {
    missing.push(`Need ${requirements.employees} employees (have ${merchant.employees.length})`);
  }

  return {
    canUpgrade: missing.length === 0,
    nextTier,
    missingRequirements: missing,
  };
}

/**
 * Calculate merchant's weekly operating costs.
 */
export function calculateOperatingCosts(merchant: Merchant, venue?: MarketVenue): number {
  let costs = 0;

  // Rent
  if (venue && venue.ownerId !== merchant.id) {
    costs += venue.rentCost;
  }

  // Maintenance (if owner)
  if (venue && venue.ownerId === merchant.id) {
    costs += venue.maintenanceCost;
  }

  // Employee wages
  for (const emp of merchant.employees) {
    costs += emp.wage * 7;  // Weekly
  }

  // Guild dues (if member)
  if (merchant.guildMembership?.guildId) {
    const tierCosts: Record<MerchantTier, number> = {
      peddler: 0,
      stall: 2,
      shop: 10,
      emporium: 50,
      trading_house: 200,
      consortium: 1000,
      megamart: 5000,
    };
    costs += tierCosts[merchant.tier];
  }

  // Licenses (monthly, so /4 for weekly)
  const licenseCosts: Record<string, number> = {
    market_permit: 5,
    business_license: 20,
    import_license: 50,
    warehouse_license: 30,
    banking_license: 100,
  };
  // Simplified: assume they have required licenses
  const requirements = MERCHANT_TIER_REQUIREMENTS[merchant.tier];
  for (const license of requirements.licenses) {
    costs += (licenseCosts[license] || 0) / 4;
  }

  return costs;
}
