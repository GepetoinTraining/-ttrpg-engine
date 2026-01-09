import { z } from "zod";

// ============================================
// COINING SYSTEM - WHERE MONEY COMES FROM
// ============================================
//
// Philosophy: GEMS ARE MOB LOOT
//
// In this universe, the gods made a peculiar design choice:
// Gems don't come from mines. They come from DUNGEONS.
//
// This means:
//   - Adventurers are economically NECESSARY
//   - Dungeons are effectively gem ATMs
//   - Monsters hoard treasure because... that's where gems are
//   - The monetary supply depends on dungeon-crawling
//   - Exchange houses convert gems → currency
//   - Coins are minted from metal, but gems back the economy
//
// Why? Because the god of this universe wanted adventurers
// to have a real economic role, not just be murder hobos.
//

// ============================================
// GEM TYPES (Universal Currency Substrate)
// ============================================

export const GemTypeSchema = z.enum([
  // Common (10-50gp)
  "azurite",
  "banded_agate",
  "blue_quartz",
  "eye_agate",
  "hematite",
  "lapis_lazuli",
  "malachite",
  "moss_agate",
  "obsidian",
  "rhodochrosite",
  "tiger_eye",
  "turquoise",

  // Uncommon (50-100gp)
  "bloodstone",
  "carnelian",
  "chalcedony",
  "chrysoprase",
  "citrine",
  "jasper",
  "moonstone",
  "onyx",
  "quartz",
  "sardonyx",
  "star_rose_quartz",
  "zircon",

  // Rare (100-500gp)
  "amber",
  "amethyst",
  "chrysoberyl",
  "coral",
  "garnet",
  "jade",
  "jet",
  "pearl",
  "spinel",
  "tourmaline",

  // Very Rare (500-1000gp)
  "alexandrite",
  "aquamarine",
  "black_pearl",
  "blue_spinel",
  "peridot",
  "topaz",

  // Legendary (1000-5000gp)
  "black_opal",
  "blue_sapphire",
  "emerald",
  "fire_opal",
  "opal",
  "star_ruby",
  "star_sapphire",
  "yellow_sapphire",

  // Mythic (5000+gp)
  "diamond",
  "jacinth",
  "ruby",
  "black_diamond",
  "star_diamond",
]);
export type GemType = z.infer<typeof GemTypeSchema>;

// ============================================
// GEM VALUE TIERS
// ============================================

export const GemTierSchema = z.enum([
  "common",      // 10-50gp
  "uncommon",    // 50-100gp
  "rare",        // 100-500gp
  "very_rare",   // 500-1000gp
  "legendary",   // 1000-5000gp
  "mythic",      // 5000+gp
]);
export type GemTier = z.infer<typeof GemTierSchema>;

export const GEM_TIER_VALUES: Record<GemTier, { min: number; max: number }> = {
  common: { min: 10, max: 50 },
  uncommon: { min: 50, max: 100 },
  rare: { min: 100, max: 500 },
  very_rare: { min: 500, max: 1000 },
  legendary: { min: 1000, max: 5000 },
  mythic: { min: 5000, max: 50000 },
};

export const GEM_DATA: Record<GemType, { tier: GemTier; baseValue: number }> = {
  // Common
  azurite: { tier: "common", baseValue: 10 },
  banded_agate: { tier: "common", baseValue: 10 },
  blue_quartz: { tier: "common", baseValue: 10 },
  eye_agate: { tier: "common", baseValue: 10 },
  hematite: { tier: "common", baseValue: 10 },
  lapis_lazuli: { tier: "common", baseValue: 10 },
  malachite: { tier: "common", baseValue: 10 },
  moss_agate: { tier: "common", baseValue: 10 },
  obsidian: { tier: "common", baseValue: 10 },
  rhodochrosite: { tier: "common", baseValue: 10 },
  tiger_eye: { tier: "common", baseValue: 10 },
  turquoise: { tier: "common", baseValue: 10 },

  // Uncommon
  bloodstone: { tier: "uncommon", baseValue: 50 },
  carnelian: { tier: "uncommon", baseValue: 50 },
  chalcedony: { tier: "uncommon", baseValue: 50 },
  chrysoprase: { tier: "uncommon", baseValue: 50 },
  citrine: { tier: "uncommon", baseValue: 50 },
  jasper: { tier: "uncommon", baseValue: 50 },
  moonstone: { tier: "uncommon", baseValue: 50 },
  onyx: { tier: "uncommon", baseValue: 50 },
  quartz: { tier: "uncommon", baseValue: 50 },
  sardonyx: { tier: "uncommon", baseValue: 50 },
  star_rose_quartz: { tier: "uncommon", baseValue: 50 },
  zircon: { tier: "uncommon", baseValue: 50 },

  // Rare
  amber: { tier: "rare", baseValue: 100 },
  amethyst: { tier: "rare", baseValue: 100 },
  chrysoberyl: { tier: "rare", baseValue: 100 },
  coral: { tier: "rare", baseValue: 100 },
  garnet: { tier: "rare", baseValue: 100 },
  jade: { tier: "rare", baseValue: 100 },
  jet: { tier: "rare", baseValue: 100 },
  pearl: { tier: "rare", baseValue: 100 },
  spinel: { tier: "rare", baseValue: 100 },
  tourmaline: { tier: "rare", baseValue: 100 },

  // Very Rare
  alexandrite: { tier: "very_rare", baseValue: 500 },
  aquamarine: { tier: "very_rare", baseValue: 500 },
  black_pearl: { tier: "very_rare", baseValue: 500 },
  blue_spinel: { tier: "very_rare", baseValue: 500 },
  peridot: { tier: "very_rare", baseValue: 500 },
  topaz: { tier: "very_rare", baseValue: 500 },

  // Legendary
  black_opal: { tier: "legendary", baseValue: 1000 },
  blue_sapphire: { tier: "legendary", baseValue: 1000 },
  emerald: { tier: "legendary", baseValue: 1000 },
  fire_opal: { tier: "legendary", baseValue: 1000 },
  opal: { tier: "legendary", baseValue: 1000 },
  star_ruby: { tier: "legendary", baseValue: 1000 },
  star_sapphire: { tier: "legendary", baseValue: 1000 },
  yellow_sapphire: { tier: "legendary", baseValue: 1000 },

  // Mythic
  diamond: { tier: "mythic", baseValue: 5000 },
  jacinth: { tier: "mythic", baseValue: 5000 },
  ruby: { tier: "mythic", baseValue: 5000 },
  black_diamond: { tier: "mythic", baseValue: 10000 },
  star_diamond: { tier: "mythic", baseValue: 25000 },
};

// ============================================
// GEM INSTANCE (Actual gem item)
// ============================================

export const GemInstanceSchema = z.object({
  id: z.string().uuid(),
  type: GemTypeSchema,

  // Quality affects value
  quality: z.enum([
    "flawed",      // 0.5x value
    "average",     // 1x value
    "good",        // 1.25x value
    "excellent",   // 1.5x value
    "perfect",     // 2x value
  ]).default("average"),

  // Size affects value (carats equivalent)
  size: z.enum([
    "tiny",        // 0.5x value
    "small",       // 0.75x value
    "medium",      // 1x value
    "large",       // 1.5x value
    "huge",        // 2x value
    "legendary",   // 3x value
  ]).default("medium"),

  // Calculated value
  baseValue: z.number(),
  currentValue: z.number(),

  // Origin (WHERE IT CAME FROM - always dungeon/encounter)
  origin: z.object({
    type: z.enum([
      "dungeon_loot",
      "monster_drop",
      "treasure_hoard",
      "quest_reward",
      "ancient_cache",
      "planar_bleed",    // Gems from other planes
    ]),
    sourceId: z.string().uuid().optional(),  // Dungeon or encounter ID
    sourceName: z.string().optional(),
    encounterId: z.string().uuid().optional(),
    foundAt: z.string(),                     // ISO date
    foundBy: z.string().uuid().optional(),   // Character/party ID
  }),

  // NOT from mining - this is enforced
  // The extraction system CANNOT produce gems

  // Current owner
  ownerId: z.string().uuid().optional(),
  ownerType: z.enum(["character", "party", "npc", "faction", "exchange_house"]).optional(),

  // Tracking
  timesTraded: z.number().int().default(0),
  lastTradedAt: z.string().optional(),
});
export type GemInstance = z.infer<typeof GemInstanceSchema>;

// ============================================
// QUALITY & SIZE MULTIPLIERS
// ============================================

export const QUALITY_MULTIPLIERS = {
  flawed: 0.5,
  average: 1.0,
  good: 1.25,
  excellent: 1.5,
  perfect: 2.0,
};

export const SIZE_MULTIPLIERS = {
  tiny: 0.5,
  small: 0.75,
  medium: 1.0,
  large: 1.5,
  huge: 2.0,
  legendary: 3.0,
};

// ============================================
// EXCHANGE HOUSE (Converts gems to currency)
// ============================================

export const ExchangeHouseSchema = z.object({
  id: z.string().uuid(),

  // Location
  settlementId: z.string().uuid(),
  settlementName: z.string(),
  districtId: z.string().uuid().optional(),

  // Identity
  name: z.string(),                          // "The Golden Scale", "Deepcoin Exchange"
  reputation: z.number().min(0).max(100).default(50),

  // Ownership
  ownerId: z.string().uuid().optional(),     // Faction, guild, or individual
  ownerType: z.enum(["faction", "guild", "npc", "crown"]).optional(),
  ownerName: z.string().optional(),

  // Fees and rates
  exchangeRate: z.number().min(0).max(1).default(0.95), // 95% = 5% fee
  appraisalFee: z.number().default(1),                  // GP per gem appraised
  minimumTransaction: z.number().default(10),            // Minimum GP

  // Premium/discount by gem tier
  tierModifiers: z.record(GemTierSchema, z.number()).default({
    common: 0.9,      // Less interested in cheap gems
    uncommon: 0.95,
    rare: 1.0,
    very_rare: 1.0,
    legendary: 1.05,  // Premium for rare gems
    mythic: 1.1,
  }),

  // Currency reserves (what they can pay out)
  reserves: z.object({
    platinum: z.number().default(0),
    gold: z.number().default(0),
    electrum: z.number().default(0),
    silver: z.number().default(0),
    copper: z.number().default(0),
  }),
  totalReservesGP: z.number().default(0),

  // Gem inventory (what they've bought)
  gemInventory: z.array(z.object({
    gemId: z.string().uuid(),
    gemType: GemTypeSchema,
    acquiredValue: z.number(),
    acquiredAt: z.string(),
  })).default([]),
  totalGemValueHeld: z.number().default(0),

  // Transaction limits
  dailyLimit: z.number().optional(),         // Max GP per day
  dailyTransacted: z.number().default(0),
  lastResetAt: z.string().optional(),

  // Services offered
  services: z.object({
    buyGems: z.boolean().default(true),      // Buy gems from adventurers
    sellGems: z.boolean().default(false),    // Sell gems (rare)
    appraisal: z.boolean().default(true),    // Appraise gem value
    currencyExchange: z.boolean().default(true), // Exchange currencies
    letterOfCredit: z.boolean().default(false),  // Issue credit letters
    gemCutting: z.boolean().default(false),      // Improve gem quality
  }),

  // Operating hours (slot-based)
  operatingHours: z.object({
    openSlot: z.number().int().default(16),  // 8 AM (slot 16 of 48)
    closeSlot: z.number().int().default(36), // 6 PM (slot 36 of 48)
    closedDays: z.array(z.number().int()).default([]), // Day indices
  }),

  // Security
  securityLevel: z.enum(["minimal", "standard", "high", "fortress"]).default("standard"),
  guards: z.number().int().default(2),

  // Connected to faction economy
  factionId: z.string().uuid().optional(),
  taxRate: z.number().min(0).max(1).default(0.05), // Tax on transactions

  // Tracking
  totalTransactionsAllTime: z.number().default(0),
  totalValueExchangedAllTime: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExchangeHouse = z.infer<typeof ExchangeHouseSchema>;

// ============================================
// EXCHANGE TRANSACTION
// ============================================

export const ExchangeTransactionSchema = z.object({
  id: z.string().uuid(),
  exchangeHouseId: z.string().uuid(),

  // Who's exchanging
  customerId: z.string().uuid(),
  customerType: z.enum(["character", "party", "npc"]),
  customerName: z.string(),

  // What's being exchanged
  type: z.enum([
    "gem_to_currency",   // Adventurer sells gems
    "currency_to_gem",   // Rare - buying gems
    "currency_exchange", // Platinum ↔ Gold ↔ Silver
    "appraisal_only",    // Just identify value
  ]),

  // Gems involved
  gemsExchanged: z.array(z.object({
    gemId: z.string().uuid(),
    gemType: GemTypeSchema,
    appraisedValue: z.number(),
    paidValue: z.number(),      // After fees
  })).default([]),

  // Currency involved
  currencyIn: z.object({
    platinum: z.number().default(0),
    gold: z.number().default(0),
    electrum: z.number().default(0),
    silver: z.number().default(0),
    copper: z.number().default(0),
  }).optional(),

  currencyOut: z.object({
    platinum: z.number().default(0),
    gold: z.number().default(0),
    electrum: z.number().default(0),
    silver: z.number().default(0),
    copper: z.number().default(0),
  }).optional(),

  // Totals
  totalGemValue: z.number().default(0),
  totalFees: z.number().default(0),
  totalTax: z.number().default(0),
  netPayout: z.number().default(0),

  // Timestamp
  transactedAt: z.string(),

  // Session context
  sessionId: z.string().uuid().optional(),
});
export type ExchangeTransaction = z.infer<typeof ExchangeTransactionSchema>;

// ============================================
// GEM LOOT GENERATION
// ============================================

export interface GemLootConfig {
  cr: number;                    // Challenge rating of encounter
  treasureType: "individual" | "hoard";
  dungeonTier: "low" | "mid" | "high" | "legendary";
}

/**
 * Generate gem loot from an encounter.
 * This is the ONLY way gems enter the economy.
 */
export function generateGemLoot(
  config: GemLootConfig,
  encounterId: string,
  encounterName: string,
  random: () => number = Math.random
): GemInstance[] {
  const gems: GemInstance[] = [];

  // Determine number of gems based on CR and treasure type
  let gemCount = 0;
  let tierWeights: Record<GemTier, number>;

  if (config.treasureType === "individual") {
    // Individual treasure - fewer, lower tier gems
    gemCount = Math.floor(random() * 3); // 0-2 gems
    tierWeights = {
      common: 0.5,
      uncommon: 0.3,
      rare: 0.15,
      very_rare: 0.04,
      legendary: 0.01,
      mythic: 0,
    };
  } else {
    // Hoard treasure - more gems, better tiers based on dungeon tier
    switch (config.dungeonTier) {
      case "low":
        gemCount = Math.floor(random() * 6) + 2; // 2-7 gems
        tierWeights = {
          common: 0.4,
          uncommon: 0.35,
          rare: 0.2,
          very_rare: 0.05,
          legendary: 0,
          mythic: 0,
        };
        break;
      case "mid":
        gemCount = Math.floor(random() * 8) + 4; // 4-11 gems
        tierWeights = {
          common: 0.2,
          uncommon: 0.3,
          rare: 0.3,
          very_rare: 0.15,
          legendary: 0.05,
          mythic: 0,
        };
        break;
      case "high":
        gemCount = Math.floor(random() * 10) + 6; // 6-15 gems
        tierWeights = {
          common: 0.1,
          uncommon: 0.2,
          rare: 0.3,
          very_rare: 0.25,
          legendary: 0.12,
          mythic: 0.03,
        };
        break;
      case "legendary":
        gemCount = Math.floor(random() * 15) + 10; // 10-24 gems
        tierWeights = {
          common: 0,
          uncommon: 0.1,
          rare: 0.2,
          very_rare: 0.3,
          legendary: 0.3,
          mythic: 0.1,
        };
        break;
    }
  }

  // CR modifier
  gemCount = Math.floor(gemCount * (1 + config.cr / 20));

  // Generate each gem
  for (let i = 0; i < gemCount; i++) {
    const tier = rollTier(tierWeights, random);
    const gemType = rollGemOfTier(tier, random);
    const quality = rollQuality(random);
    const size = rollSize(random);

    const baseValue = GEM_DATA[gemType].baseValue;
    const qualityMult = QUALITY_MULTIPLIERS[quality];
    const sizeMult = SIZE_MULTIPLIERS[size];
    const currentValue = Math.floor(baseValue * qualityMult * sizeMult);

    gems.push({
      id: crypto.randomUUID(),
      type: gemType,
      quality,
      size,
      baseValue,
      currentValue,
      origin: {
        type: config.treasureType === "hoard" ? "treasure_hoard" : "monster_drop",
        sourceId: encounterId,
        sourceName: encounterName,
        encounterId,
        foundAt: new Date().toISOString(),
      },
      timesTraded: 0,
    });
  }

  return gems;
}

function rollTier(weights: Record<GemTier, number>, random: () => number): GemTier {
  const roll = random();
  let cumulative = 0;

  for (const [tier, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) {
      return tier as GemTier;
    }
  }

  return "common"; // Fallback
}

function rollGemOfTier(tier: GemTier, random: () => number): GemType {
  const gemsOfTier = Object.entries(GEM_DATA)
    .filter(([_, data]) => data.tier === tier)
    .map(([type]) => type as GemType);

  return gemsOfTier[Math.floor(random() * gemsOfTier.length)];
}

function rollQuality(random: () => number): GemInstance["quality"] {
  const roll = random();
  if (roll < 0.1) return "flawed";
  if (roll < 0.5) return "average";
  if (roll < 0.8) return "good";
  if (roll < 0.95) return "excellent";
  return "perfect";
}

function rollSize(random: () => number): GemInstance["size"] {
  const roll = random();
  if (roll < 0.1) return "tiny";
  if (roll < 0.3) return "small";
  if (roll < 0.7) return "medium";
  if (roll < 0.9) return "large";
  if (roll < 0.98) return "huge";
  return "legendary";
}

// ============================================
// EXCHANGE FUNCTIONS
// ============================================

/**
 * Calculate the payout for exchanging gems at an exchange house.
 */
export function calculateGemPayout(
  gems: GemInstance[],
  exchangeHouse: ExchangeHouse
): {
  totalAppraisedValue: number;
  totalFees: number;
  totalTax: number;
  netPayout: number;
  breakdown: Array<{
    gemId: string;
    gemType: GemType;
    appraisedValue: number;
    tierModifier: number;
    afterTierMod: number;
    afterExchangeRate: number;
    fee: number;
    tax: number;
    payout: number;
  }>;
  canComplete: boolean;
  insufficientReserves: boolean;
} {
  const breakdown: Array<{
    gemId: string;
    gemType: GemType;
    appraisedValue: number;
    tierModifier: number;
    afterTierMod: number;
    afterExchangeRate: number;
    fee: number;
    tax: number;
    payout: number;
  }> = [];

  let totalAppraisedValue = 0;
  let totalFees = 0;
  let totalTax = 0;
  let netPayout = 0;

  for (const gem of gems) {
    const tier = GEM_DATA[gem.type].tier;
    const tierModifier = exchangeHouse.tierModifiers[tier] || 1.0;
    const appraisedValue = gem.currentValue;

    const afterTierMod = Math.floor(appraisedValue * tierModifier);
    const afterExchangeRate = Math.floor(afterTierMod * exchangeHouse.exchangeRate);
    const fee = exchangeHouse.appraisalFee;
    const tax = Math.floor(afterExchangeRate * exchangeHouse.taxRate);
    const payout = Math.max(0, afterExchangeRate - fee - tax);

    totalAppraisedValue += appraisedValue;
    totalFees += fee;
    totalTax += tax;
    netPayout += payout;

    breakdown.push({
      gemId: gem.id,
      gemType: gem.type,
      appraisedValue,
      tierModifier,
      afterTierMod,
      afterExchangeRate,
      fee,
      tax,
      payout,
    });
  }

  const canComplete = netPayout >= exchangeHouse.minimumTransaction;
  const insufficientReserves = netPayout > exchangeHouse.totalReservesGP;

  return {
    totalAppraisedValue,
    totalFees,
    totalTax,
    netPayout,
    breakdown,
    canComplete: canComplete && !insufficientReserves,
    insufficientReserves,
  };
}

/**
 * Execute a gem exchange transaction.
 */
export function executeGemExchange(
  gems: GemInstance[],
  exchangeHouse: ExchangeHouse,
  customerId: string,
  customerType: ExchangeTransaction["customerType"],
  customerName: string
): {
  transaction: ExchangeTransaction;
  updatedExchangeHouse: ExchangeHouse;
  currencyPayout: {
    platinum: number;
    gold: number;
    electrum: number;
    silver: number;
    copper: number;
  };
} {
  const payout = calculateGemPayout(gems, exchangeHouse);

  if (!payout.canComplete) {
    throw new Error(
      payout.insufficientReserves
        ? "Exchange house has insufficient reserves"
        : `Transaction below minimum (${exchangeHouse.minimumTransaction}gp)`
    );
  }

  // Convert net payout to currency (prefer gold)
  let remaining = payout.netPayout;
  const platinum = Math.floor(remaining / 10);
  remaining -= platinum * 10;
  const gold = Math.floor(remaining);
  remaining -= gold;
  const silver = Math.floor(remaining * 10);
  remaining -= silver / 10;
  const copper = Math.floor(remaining * 100);

  const currencyPayout = { platinum, gold, electrum: 0, silver, copper };

  // Create transaction
  const transaction: ExchangeTransaction = {
    id: crypto.randomUUID(),
    exchangeHouseId: exchangeHouse.id,
    customerId,
    customerType,
    customerName,
    type: "gem_to_currency",
    gemsExchanged: payout.breakdown.map(b => ({
      gemId: b.gemId,
      gemType: b.gemType,
      appraisedValue: b.appraisedValue,
      paidValue: b.payout,
    })),
    currencyOut: currencyPayout,
    totalGemValue: payout.totalAppraisedValue,
    totalFees: payout.totalFees,
    totalTax: payout.totalTax,
    netPayout: payout.netPayout,
    transactedAt: new Date().toISOString(),
  };

  // Update exchange house
  const updatedExchangeHouse = { ...exchangeHouse };

  // Deduct from reserves
  updatedExchangeHouse.reserves.platinum -= platinum;
  updatedExchangeHouse.reserves.gold -= gold;
  updatedExchangeHouse.reserves.silver -= silver;
  updatedExchangeHouse.reserves.copper -= copper;
  updatedExchangeHouse.totalReservesGP -= payout.netPayout;

  // Add gems to inventory
  for (const gem of gems) {
    updatedExchangeHouse.gemInventory.push({
      gemId: gem.id,
      gemType: gem.type,
      acquiredValue: payout.breakdown.find(b => b.gemId === gem.id)?.payout || 0,
      acquiredAt: new Date().toISOString(),
    });
  }
  updatedExchangeHouse.totalGemValueHeld += payout.totalAppraisedValue;

  // Update tracking
  updatedExchangeHouse.dailyTransacted += payout.netPayout;
  updatedExchangeHouse.totalTransactionsAllTime += 1;
  updatedExchangeHouse.totalValueExchangedAllTime += payout.netPayout;
  updatedExchangeHouse.updatedAt = new Date().toISOString();

  return {
    transaction,
    updatedExchangeHouse,
    currencyPayout,
  };
}

// ============================================
// MONETARY SUPPLY TRACKING
// ============================================

export const MonetarySupplySchema = z.object({
  worldId: z.string().uuid(),

  // Total gems in circulation
  totalGemsInWorld: z.number().int().default(0),
  totalGemValueInWorld: z.number().default(0),

  // Gems by tier
  gemsByTier: z.record(GemTierSchema, z.number().int()).default({
    common: 0,
    uncommon: 0,
    rare: 0,
    very_rare: 0,
    legendary: 0,
    mythic: 0,
  }),

  // Gems by location
  gemsInCirculation: z.number().int().default(0),       // Held by players/NPCs
  gemsInExchangeHouses: z.number().int().default(0),    // In exchange inventories
  gemsInHoards: z.number().int().default(0),            // Undiscovered in dungeons

  // Currency in circulation (minted from metals, but backed by gems)
  currencyInCirculation: z.object({
    platinum: z.number().default(0),
    gold: z.number().default(0),
    electrum: z.number().default(0),
    silver: z.number().default(0),
    copper: z.number().default(0),
  }),
  totalCurrencyGP: z.number().default(0),

  // Historical
  gemsExtractedAllTime: z.number().int().default(0),    // From dungeons
  gemsExchangedAllTime: z.number().int().default(0),    // Converted to currency

  // Velocity (how fast gems move)
  averageGemTurnoverDays: z.number().default(30),

  // Last computed
  computedAt: z.string(),
});
export type MonetarySupply = z.infer<typeof MonetarySupplySchema>;
