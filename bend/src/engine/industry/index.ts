// ============================================
// INDUSTRY SYSTEM - THE SECONDARY SECTOR
// ============================================
//
// Where raw materials become finished goods.
//
// Guilds: Proto-corporations that pool resources
//   - Bulk purchasing power
//   - Quality standards
//   - Training (apprentice → master)
//   - Monopoly enforcement
//
// Workshops: Physical production sites
//   - Transform inputs → outputs via recipes
//   - Craftsman skill affects quality
//   - Tool quality matters
//   - Production queues
//
// The flow:
//   PRIMARY (extraction) → LOGISTICS (transport) → SECONDARY (transform)
//                                                       ↓
//                                               TERTIARY (services)
//                                                       ↓
//                                               CONSUMPTION
//

// ─────────────────────────────────────────
// GUILDS
// ─────────────────────────────────────────

export {
  // Schemas
  GuildTypeSchema,
  GuildRankSchema,
  GuildChapterSchema,
  GuildSchema,
  GuildMembershipSchema,
  GuildPurchaseOrderSchema,

  // Types
  type GuildType,
  type GuildRank,
  type GuildChapter,
  type Guild,
  type GuildMembership,
  type GuildPurchaseOrder,

  // Constants
  GUILD_RANK_ORDER,
  GUILD_MEMBER_BENEFITS,
  GUILD_COMMODITIES,

  // Functions
  calculateGuildPrice,
  canPracticeTrade,
  calculateApprenticeshipProgress,
  calculateGuildPurchasingPower,
} from "./guilds";

// ─────────────────────────────────────────
// WORKSHOPS
// ─────────────────────────────────────────

export {
  // Schemas
  WorkshopTypeSchema,
  RecipeSchema,
  WorkshopSchema,
  ProductionOrderSchema,

  // Types
  type WorkshopType,
  type Recipe,
  type Workshop,
  type ProductionOrder,

  // Constants
  QUALITY_LEVELS,
  STANDARD_RECIPES,
  WORKSHOP_GUILD_MAP,

  // Functions
  determineQuality,
  calculateProductionTime,
  canProduceRecipe,
  calculateDailyOperatingCosts,
} from "./workshop";

// ============================================
// QUICK START EXAMPLE
// ============================================
/*

// ─────────────────────────────────────────
// GUILD MEMBERSHIP FLOW
// ─────────────────────────────────────────

import {
  GuildChapter,
  GuildMembership,
  calculateGuildPrice,
  canPracticeTrade
} from './industry';

// 1. Check if non-member can work
const canWork = canPracticeTrade(null, smithsGuildChapter, 'sell');
// { allowed: false, reason: 'Absolute guild monopoly - no outsiders' }

// 2. Join guild as apprentice
const membership: GuildMembership = {
  memberId: 'player-character-id',
  memberType: 'character',
  rank: 'apprentice',
  guildId: smithsGuild.id,
  chapterId: waterdeepSmithsChapter.id,
  apprenticeship: {
    masterId: 'master-grimm-id',
    masterName: 'Master Grimm',
    startedAt: new Date().toISOString(),
    progress: 0,
  },
  // ...
};

// 3. Buy materials at guild discount
const ironPrice = 5; // Base market price
const memberPrice = calculateGuildPrice(ironPrice, 'apprentice', 0.1);
// 5 * (1 - 0.05 - 0.1) = 4.25gp (15% off)


// ─────────────────────────────────────────
// WORKSHOP PRODUCTION FLOW
// ─────────────────────────────────────────

import {
  Workshop,
  Recipe,
  canProduceRecipe,
  determineQuality,
  calculateProductionTime
} from './industry';

// 1. Check if workshop can make longsword
const check = canProduceRecipe(grimmsForge, longswordRecipe);
// { canProduce: true, missingMaterials: [], ... }

// 2. Calculate production time
const time = calculateProductionTime(
  longswordRecipe.baseSlots,  // 8 slots base
  4,                          // Skill level 4
  true,                       // Has apprentice
  'excellent'                 // Tool quality
);
// { slots: 4, hoursApprox: 2 }

// 3. Roll for quality when complete
const qualityResult = determineQuality(
  4,           // Skill level
  2,           // Excellent tools
  12,          // Recipe difficulty
  15           // d20 roll
);
// { quality: 'excellent', total: 21, success: true }

// 4. Masterwork sword worth 3x base price!


// ─────────────────────────────────────────
// GUILD BULK PURCHASING
// ─────────────────────────────────────────

// Smiths guild needs iron for all members
const purchasing = calculateGuildPurchasingPower(waterdeepSmithsChapter, 3);
// {
//   totalDemand: { iron_ore: 3000, coal: 1500 },
//   totalBudget: 5000,
//   canNegotiateBulk: true
// }

// Guild places bulk order with trading company
// Gets 20% discount for volume
// Distributes to members at guild price

*/
