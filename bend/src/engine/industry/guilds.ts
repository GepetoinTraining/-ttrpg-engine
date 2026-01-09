import { z } from "zod";

// ============================================
// GUILD SYSTEM - THE SECONDARY SECTOR
// ============================================
//
// Philosophy: GUILDS ARE PROTO-CORPORATIONS
//
// In medieval economies, individual craftsmen can't:
//   - Buy raw materials at scale
//   - Negotiate with logistics companies
//   - Set quality standards
//   - Train apprentices systematically
//   - Defend against competition
//
// Guilds solve all of this by pooling resources.
// They're also monopolies - you can't practice a trade
// without guild membership in most settlements.
//
// D&D has few industries, but guilds run them all.
//

// ============================================
// GUILD TYPES
// ============================================

export const GuildTypeSchema = z.enum([
  // Craft Guilds (SECONDARY sector)
  "smiths",           // Blacksmiths, weaponsmiths, armorsmiths
  "masons",           // Stonework, construction
  "carpenters",       // Woodwork, construction
  "weavers",          // Textiles, cloth
  "tanners",          // Leather working
  "potters",          // Ceramics
  "jewelers",         // Gems, precious metals
  "alchemists",       // Potions, chemicals
  "scribes",          // Books, scrolls
  "shipwrights",      // Boats, ships
  "coopers",          // Barrels, containers
  "chandlers",        // Candles, soap
  "dyers",            // Fabric coloring
  "glassblowers",     // Glass items
  "brewers",          // Ale, beer
  "vintners",         // Wine
  "bakers",           // Bread, pastries
  "butchers",         // Meat processing

  // Merchant Guilds (LOGISTICS/TERTIARY)
  "merchants",        // General trade
  "importers",        // Foreign goods
  "bankers",          // Money changing, loans

  // Service Guilds (TERTIARY)
  "entertainers",     // Bards, performers
  "innkeepers",       // Hospitality
  "teamsters",        // Transport workers

  // Specialized Guilds (D&D specific)
  "arcane",           // Wizards, magic item crafters
  "apothecaries",     // Healers, herbalists
  "adventurers",      // Yes, adventurer guilds exist
]);
export type GuildType = z.infer<typeof GuildTypeSchema>;

// ============================================
// GUILD RANK
// ============================================

export const GuildRankSchema = z.enum([
  "outsider",         // Not a member
  "applicant",        // Seeking membership
  "apprentice",       // Learning (3-7 years typically)
  "journeyman",       // Certified craftsman, can work for others
  "master",           // Can own workshop, take apprentices
  "guild_officer",    // Warden, secretary, etc.
  "guild_master",     // Leader of local chapter
  "grand_master",     // Leader of regional/national guild
]);
export type GuildRank = z.infer<typeof GuildRankSchema>;

export const GUILD_RANK_ORDER: Record<GuildRank, number> = {
  outsider: 0,
  applicant: 1,
  apprentice: 2,
  journeyman: 3,
  master: 4,
  guild_officer: 5,
  guild_master: 6,
  grand_master: 7,
};

// ============================================
// GUILD CHAPTER (Local presence)
// ============================================

export const GuildChapterSchema = z.object({
  id: z.string().uuid(),

  // Parent guild
  guildId: z.string().uuid(),
  guildName: z.string(),
  guildType: GuildTypeSchema,

  // Location
  settlementId: z.string().uuid(),
  settlementName: z.string(),

  // Hall
  guildHallId: z.string().uuid().optional(),    // Building ID
  guildHallName: z.string().optional(),

  // Leadership
  guildMasterId: z.string().uuid().optional(),  // NPC ID
  guildMasterName: z.string().optional(),
  officers: z.array(z.object({
    npcId: z.string().uuid(),
    name: z.string(),
    role: z.string(),                           // "Warden", "Secretary", "Treasurer"
  })).default([]),

  // Membership
  members: z.object({
    apprentices: z.number().int().default(0),
    journeymen: z.number().int().default(0),
    masters: z.number().int().default(0),
    total: z.number().int().default(0),
  }),

  // Named members (important NPCs)
  namedMembers: z.array(z.object({
    npcId: z.string().uuid(),
    name: z.string(),
    rank: GuildRankSchema,
    specialty: z.string().optional(),
    reputation: z.number().int().default(50),
  })).default([]),

  // Finances
  treasury: z.number().default(0),
  monthlyDues: z.number().default(0),           // From members
  monthlyExpenses: z.number().default(0),

  // Pooled Purchasing
  commodityPool: z.object({
    // What commodities they buy together
    commodities: z.array(z.object({
      commodityId: z.string(),
      monthlyNeed: z.number(),                  // Total for all members
      currentStock: z.number(),
      lastPurchasePrice: z.number(),
      preferredSupplier: z.string().uuid().optional(),
    })).default([]),

    // Bulk buying power
    purchasingPower: z.number().default(0),     // GP available for purchases
    bulkDiscount: z.number().min(0).max(0.5).default(0.1), // 10% typical
  }),

  // Monopoly Control
  monopoly: z.object({
    hasMonopoly: z.boolean().default(false),
    enforcementLevel: z.enum(["none", "weak", "moderate", "strong", "absolute"]).default("none"),

    // What non-members face
    nonMemberPenalties: z.object({
      cannotSell: z.boolean().default(false),   // Can't sell goods in settlement
      cannotBuy: z.boolean().default(false),    // Can't buy materials
      priceMarkup: z.number().default(0),       // Extra % on materials
      fines: z.number().default(0),             // Per offense
    }),

    // License fees for non-members (if allowed at all)
    licenseFee: z.number().optional(),
    licenseType: z.enum(["none", "temporary", "permanent", "impossible"]).default("none"),
  }),

  // Quality Standards
  qualityControl: z.object({
    standardsLevel: z.enum(["none", "minimal", "standard", "high", "masterwork"]).default("standard"),
    inspectionRequired: z.boolean().default(true),
    guildMark: z.string().optional(),           // Official seal/stamp
    warrantyDays: z.number().int().default(30),
  }),

  // Training
  training: z.object({
    acceptingApprentices: z.boolean().default(true),
    apprenticeFee: z.number().default(0),       // To start apprenticeship
    apprenticeshipYears: z.number().int().default(5),
    journeymanExamFee: z.number().default(0),
    masterworkRequired: z.boolean().default(true), // Must create masterwork to become master
  }),

  // Political Power
  politicalInfluence: z.number().int().min(0).max(100).default(30),
  factionRelations: z.record(z.string(), z.number()).default({}), // factionId -> standing

  // Reputation
  reputation: z.number().int().min(0).max(100).default(50),
  specializations: z.array(z.string()).default([]), // What they're known for

  // Status
  status: z.enum(["thriving", "stable", "declining", "struggling", "defunct"]).default("stable"),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GuildChapter = z.infer<typeof GuildChapterSchema>;

// ============================================
// GUILD (Parent organization)
// ============================================

export const GuildSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),                             // "The Ironmongers Guild", "Order of Artificers"
  type: GuildTypeSchema,
  motto: z.string().optional(),
  symbol: z.string().optional(),
  colors: z.array(z.string()).optional(),

  // Scope
  scope: z.enum(["local", "regional", "national", "continental"]).default("regional"),

  // Headquarters
  headquartersSettlementId: z.string().uuid().optional(),
  headquartersName: z.string().optional(),

  // Chapters
  chapterIds: z.array(z.string().uuid()).default([]),
  totalChapters: z.number().int().default(0),

  // Grand Leadership
  grandMasterId: z.string().uuid().optional(),
  grandMasterName: z.string().optional(),
  councilMembers: z.array(z.object({
    npcId: z.string().uuid(),
    name: z.string(),
    role: z.string(),
    chapterId: z.string().uuid(),
  })).default([]),

  // Total Membership
  totalMembership: z.object({
    apprentices: z.number().int().default(0),
    journeymen: z.number().int().default(0),
    masters: z.number().int().default(0),
    total: z.number().int().default(0),
  }),

  // Economics
  annualRevenue: z.number().default(0),
  centralTreasury: z.number().default(0),

  // What they transform
  primaryInputs: z.array(z.string()).default([]),   // Commodity IDs they buy
  primaryOutputs: z.array(z.string()).default([]),  // What they produce

  // Trade agreements
  preferredSuppliers: z.array(z.object({
    companyId: z.string().uuid(),
    companyName: z.string(),
    commodityId: z.string(),
    discountRate: z.number(),
    exclusiveContract: z.boolean().default(false),
  })).default([]),

  // Political
  overallInfluence: z.number().int().min(0).max(100).default(40),
  alliedFactions: z.array(z.string().uuid()).default([]),
  rivalGuilds: z.array(z.string().uuid()).default([]),

  // History
  foundedYear: z.string().optional(),
  founder: z.string().optional(),
  majorEvents: z.array(z.object({
    date: z.string(),
    event: z.string(),
  })).default([]),

  // Rules
  bylaws: z.array(z.object({
    rule: z.string(),
    penalty: z.string(),
  })).default([]),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Guild = z.infer<typeof GuildSchema>;

// ============================================
// GUILD MEMBERSHIP
// ============================================

export const GuildMembershipSchema = z.object({
  id: z.string().uuid(),

  // Who
  memberId: z.string().uuid(),                  // NPC or Character ID
  memberType: z.enum(["npc", "character"]),
  memberName: z.string(),

  // Which guild
  guildId: z.string().uuid(),
  guildName: z.string(),
  chapterId: z.string().uuid(),
  chapterSettlement: z.string(),

  // Status
  rank: GuildRankSchema,
  joinedAt: z.string(),
  promotedAt: z.string().optional(),            // When they reached current rank

  // For apprentices
  apprenticeship: z.object({
    masterId: z.string().uuid().optional(),
    masterName: z.string().optional(),
    startedAt: z.string().optional(),
    expectedCompletion: z.string().optional(),
    progress: z.number().min(0).max(100).default(0),
  }).optional(),

  // Specialty
  specialty: z.string().optional(),             // "Swordsmithing", "Siege Engines"

  // Standing
  standing: z.number().int().min(0).max(100).default(50),
  violations: z.array(z.object({
    date: z.string(),
    offense: z.string(),
    penalty: z.string(),
    resolved: z.boolean(),
  })).default([]),

  // Contributions
  duesPaid: z.number().default(0),
  lastDuesPayment: z.string().optional(),
  duesOwed: z.number().default(0),

  // Benefits used
  materialsPurchased: z.number().default(0),    // GP value at guild prices
  trainingReceived: z.number().default(0),      // Hours

  // Voting rights
  canVote: z.boolean().default(false),
  votingPower: z.number().int().default(0),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GuildMembership = z.infer<typeof GuildMembershipSchema>;

// ============================================
// COMMODITY PURCHASE ORDER
// ============================================

export const GuildPurchaseOrderSchema = z.object({
  id: z.string().uuid(),

  // Who's buying
  chapterId: z.string().uuid(),
  chapterName: z.string(),

  // What
  commodityId: z.string(),
  quantity: z.number(),
  maxPricePerUnit: z.number(),                  // Won't pay more than this

  // From
  preferredSupplierId: z.string().uuid().optional(),
  preferredSupplierName: z.string().optional(),

  // When
  createdAt: z.string(),
  neededBy: z.string(),                         // Deadline

  // Status
  status: z.enum([
    "pending",
    "seeking_supplier",
    "negotiating",
    "ordered",
    "in_transit",
    "delivered",
    "cancelled",
    "failed",
  ]).default("pending"),

  // Resolution
  actualSupplierId: z.string().uuid().optional(),
  actualPrice: z.number().optional(),
  deliveredQuantity: z.number().optional(),
  deliveredAt: z.string().optional(),

  // Notes
  notes: z.string().optional(),
});
export type GuildPurchaseOrder = z.infer<typeof GuildPurchaseOrderSchema>;

// ============================================
// GUILD BENEFITS (What members get)
// ============================================

export const GUILD_MEMBER_BENEFITS: Record<GuildRank, {
  bulkDiscount: number;      // % off materials
  canSellGoods: boolean;
  canTakeApprentices: boolean;
  canVote: boolean;
  canHoldOffice: boolean;
  legalProtection: boolean;  // Guild defends in disputes
  trainingAccess: boolean;
  toolRental: boolean;
  workspaceAccess: boolean;
}> = {
  outsider: {
    bulkDiscount: 0,
    canSellGoods: false,
    canTakeApprentices: false,
    canVote: false,
    canHoldOffice: false,
    legalProtection: false,
    trainingAccess: false,
    toolRental: false,
    workspaceAccess: false,
  },
  applicant: {
    bulkDiscount: 0,
    canSellGoods: false,
    canTakeApprentices: false,
    canVote: false,
    canHoldOffice: false,
    legalProtection: false,
    trainingAccess: false,
    toolRental: false,
    workspaceAccess: false,
  },
  apprentice: {
    bulkDiscount: 0.05,
    canSellGoods: false,        // Works for master
    canTakeApprentices: false,
    canVote: false,
    canHoldOffice: false,
    legalProtection: true,
    trainingAccess: true,
    toolRental: true,
    workspaceAccess: true,
  },
  journeyman: {
    bulkDiscount: 0.1,
    canSellGoods: true,
    canTakeApprentices: false,
    canVote: true,
    canHoldOffice: false,
    legalProtection: true,
    trainingAccess: true,
    toolRental: true,
    workspaceAccess: true,
  },
  master: {
    bulkDiscount: 0.15,
    canSellGoods: true,
    canTakeApprentices: true,
    canVote: true,
    canHoldOffice: true,
    legalProtection: true,
    trainingAccess: true,
    toolRental: true,
    workspaceAccess: true,
  },
  guild_officer: {
    bulkDiscount: 0.2,
    canSellGoods: true,
    canTakeApprentices: true,
    canVote: true,
    canHoldOffice: true,
    legalProtection: true,
    trainingAccess: true,
    toolRental: true,
    workspaceAccess: true,
  },
  guild_master: {
    bulkDiscount: 0.25,
    canSellGoods: true,
    canTakeApprentices: true,
    canVote: true,
    canHoldOffice: true,
    legalProtection: true,
    trainingAccess: true,
    toolRental: true,
    workspaceAccess: true,
  },
  grand_master: {
    bulkDiscount: 0.3,
    canSellGoods: true,
    canTakeApprentices: true,
    canVote: true,
    canHoldOffice: true,
    legalProtection: true,
    trainingAccess: true,
    toolRental: true,
    workspaceAccess: true,
  },
};

// ============================================
// GUILD ↔ COMMODITY MAPPING
// ============================================

export const GUILD_COMMODITIES: Record<GuildType, {
  inputs: string[];           // What they buy
  outputs: string[];          // What they produce
  relatedSkills: string[];    // D&D skills
}> = {
  smiths: {
    inputs: ["iron_ore", "iron", "coal", "copper_ore", "gold_ore"],
    outputs: ["weapons", "armor", "tools", "metal"],
    relatedSkills: ["smith_tools"],
  },
  masons: {
    inputs: ["stone"],
    outputs: ["buildings", "fortifications", "monuments"],
    relatedSkills: ["mason_tools"],
  },
  carpenters: {
    inputs: ["timber"],
    outputs: ["furniture", "buildings", "carts", "tools"],
    relatedSkills: ["carpenter_tools"],
  },
  weavers: {
    inputs: ["cloth", "wool", "silk"],
    outputs: ["textiles", "clothing", "tapestries"],
    relatedSkills: ["weaver_tools"],
  },
  tanners: {
    inputs: ["leather", "hides"],
    outputs: ["leather_armor", "leather_goods", "parchment"],
    relatedSkills: ["leatherworker_tools"],
  },
  potters: {
    inputs: ["clay"],
    outputs: ["pottery", "containers", "tiles"],
    relatedSkills: ["potter_tools"],
  },
  jewelers: {
    inputs: ["gems", "gold", "silver", "mithril"],
    outputs: ["jewelry", "gem_settings", "fine_goods"],
    relatedSkills: ["jeweler_tools"],
  },
  alchemists: {
    inputs: ["herbs", "magic_components", "reagents"],
    outputs: ["potions", "acids", "alchemical_items"],
    relatedSkills: ["alchemist_supplies", "arcana"],
  },
  scribes: {
    inputs: ["parchment", "ink", "leather"],
    outputs: ["books", "scrolls", "documents"],
    relatedSkills: ["calligrapher_supplies"],
  },
  shipwrights: {
    inputs: ["timber", "cloth", "rope", "iron"],
    outputs: ["ships", "boats"],
    relatedSkills: ["carpenter_tools", "navigation"],
  },
  coopers: {
    inputs: ["timber", "iron"],
    outputs: ["barrels", "casks", "containers"],
    relatedSkills: ["carpenter_tools"],
  },
  chandlers: {
    inputs: ["tallow", "wax", "fat"],
    outputs: ["candles", "soap"],
    relatedSkills: [],
  },
  dyers: {
    inputs: ["cloth", "pigments", "mordants"],
    outputs: ["dyed_cloth", "inks"],
    relatedSkills: [],
  },
  glassblowers: {
    inputs: ["sand", "soda", "limestone"],
    outputs: ["glass", "bottles", "windows"],
    relatedSkills: ["glassblower_tools"],
  },
  brewers: {
    inputs: ["grain", "hops", "yeast"],
    outputs: ["ale", "beer"],
    relatedSkills: ["brewer_supplies"],
  },
  vintners: {
    inputs: ["wine_grapes"],
    outputs: ["wine"],
    relatedSkills: [],
  },
  bakers: {
    inputs: ["grain", "flour"],
    outputs: ["bread", "pastries"],
    relatedSkills: ["cook_utensils"],
  },
  butchers: {
    inputs: ["meat", "livestock"],
    outputs: ["prepared_meat", "sausages", "preserved_meat"],
    relatedSkills: ["cook_utensils"],
  },
  merchants: {
    inputs: [],    // Buy everything
    outputs: [],   // Sell everything
    relatedSkills: ["persuasion", "insight"],
  },
  importers: {
    inputs: ["exotic", "spices", "silk"],
    outputs: [],
    relatedSkills: ["persuasion", "history"],
  },
  bankers: {
    inputs: ["gems", "gold"],
    outputs: ["loans", "letters_of_credit"],
    relatedSkills: ["insight", "investigation"],
  },
  entertainers: {
    inputs: [],
    outputs: ["performances", "music"],
    relatedSkills: ["performance", "acrobatics"],
  },
  innkeepers: {
    inputs: ["food", "ale", "wine"],
    outputs: ["lodging", "meals"],
    relatedSkills: ["persuasion", "insight"],
  },
  teamsters: {
    inputs: ["horses", "fodder"],
    outputs: ["transport_services"],
    relatedSkills: ["animal_handling"],
  },
  arcane: {
    inputs: ["magic_components", "gems", "rare_materials"],
    outputs: ["magic_items", "spell_scrolls", "enchantments"],
    relatedSkills: ["arcana"],
  },
  apothecaries: {
    inputs: ["herbs", "reagents"],
    outputs: ["medicines", "poultices", "antidotes"],
    relatedSkills: ["medicine", "nature"],
  },
  adventurers: {
    inputs: ["weapons", "armor", "potions"],
    outputs: ["gems", "loot", "quest_completion"],
    relatedSkills: [],  // All of them
  },
};

// ============================================
// GUILD FUNCTIONS
// ============================================

/**
 * Calculate the price a guild member pays for materials.
 */
export function calculateGuildPrice(
  basePrice: number,
  rank: GuildRank,
  chapterBulkDiscount: number
): number {
  const personalDiscount = GUILD_MEMBER_BENEFITS[rank].bulkDiscount;
  const totalDiscount = Math.min(0.4, personalDiscount + chapterBulkDiscount);
  return basePrice * (1 - totalDiscount);
}

/**
 * Check if someone can work a trade in a settlement.
 */
export function canPracticeTrade(
  membership: GuildMembership | null,
  chapter: GuildChapter,
  wantsToDo: "sell" | "buy_materials" | "take_apprentice"
): { allowed: boolean; reason?: string; penalty?: number } {

  // No monopoly = anyone can work
  if (!chapter.monopoly.hasMonopoly || chapter.monopoly.enforcementLevel === "none") {
    return { allowed: true };
  }

  // Member in good standing
  if (membership && membership.chapterId === chapter.id) {
    const benefits = GUILD_MEMBER_BENEFITS[membership.rank];

    if (wantsToDo === "sell" && !benefits.canSellGoods) {
      return { allowed: false, reason: "Rank too low to sell independently" };
    }
    if (wantsToDo === "take_apprentice" && !benefits.canTakeApprentices) {
      return { allowed: false, reason: "Only masters can take apprentices" };
    }

    return { allowed: true };
  }

  // Non-member trying to work
  switch (chapter.monopoly.enforcementLevel) {
    case "weak":
      // Can work but with penalties
      return {
        allowed: true,
        reason: "Operating without guild membership",
        penalty: chapter.monopoly.nonMemberPenalties.priceMarkup,
      };

    case "moderate":
      // Can get temporary license
      if (chapter.monopoly.licenseType !== "none" && chapter.monopoly.licenseFee) {
        return {
          allowed: true,
          reason: `Requires license (${chapter.monopoly.licenseFee}gp)`,
          penalty: chapter.monopoly.licenseFee,
        };
      }
      return { allowed: false, reason: "Must join guild or purchase license" };

    case "strong":
      // License only, expensive
      if (chapter.monopoly.licenseType === "temporary" && chapter.monopoly.licenseFee) {
        return {
          allowed: true,
          reason: `Temporary license only (${chapter.monopoly.licenseFee}gp)`,
          penalty: chapter.monopoly.licenseFee,
        };
      }
      return { allowed: false, reason: "Guild membership required" };

    case "absolute":
      // No exceptions
      return { allowed: false, reason: "Absolute guild monopoly - no outsiders" };

    default:
      return { allowed: true };
  }
}

/**
 * Calculate how long until apprentice becomes journeyman.
 */
export function calculateApprenticeshipProgress(
  membership: GuildMembership,
  skillLevel: number,          // 1-5
  intelligenceModifier: number,
  hoursWorkedThisMonth: number
): {
  newProgress: number;
  monthsRemaining: number;
  readyForExam: boolean;
} {
  if (membership.rank !== "apprentice" || !membership.apprenticeship) {
    return { newProgress: 0, monthsRemaining: 0, readyForExam: false };
  }

  // Base progress: 100% / (5 years * 12 months) = ~1.67% per month
  const baseMonthlyProgress = 100 / 60;

  // Modifiers
  const skillModifier = 1 + (skillLevel - 1) * 0.1;  // 1.0 to 1.4
  const intModifier = 1 + intelligenceModifier * 0.05;
  const hoursModifier = Math.min(1.5, hoursWorkedThisMonth / 160); // Full time = 160 hrs

  const progressGained = baseMonthlyProgress * skillModifier * intModifier * hoursModifier;
  const newProgress = Math.min(100, membership.apprenticeship.progress + progressGained);

  // Estimate remaining
  const remaining = 100 - newProgress;
  const avgMonthlyProgress = progressGained || baseMonthlyProgress;
  const monthsRemaining = Math.ceil(remaining / avgMonthlyProgress);

  return {
    newProgress,
    monthsRemaining,
    readyForExam: newProgress >= 100,
  };
}

/**
 * Calculate guild's total purchasing power for bulk orders.
 */
export function calculateGuildPurchasingPower(
  chapter: GuildChapter,
  months: number = 1
): {
  totalDemand: Record<string, number>;  // commodityId -> quantity needed
  totalBudget: number;
  canNegotiateBulk: boolean;
} {
  const totalDemand: Record<string, number> = {};

  for (const commodity of chapter.commodityPool.commodities) {
    totalDemand[commodity.commodityId] = commodity.monthlyNeed * months;
  }

  const totalBudget = chapter.commodityPool.purchasingPower + chapter.treasury * 0.5;

  // Can negotiate bulk if ordering significant quantity
  const totalUnits = Object.values(totalDemand).reduce((sum, q) => sum + q, 0);
  const canNegotiateBulk = totalUnits >= 100 || totalBudget >= 1000;

  return { totalDemand, totalBudget, canNegotiateBulk };
}
