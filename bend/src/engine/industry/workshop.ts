import { z } from "zod";
import { GuildRankSchema, GuildType } from "./guilds";

// ============================================
// WORKSHOP SYSTEM - WHERE TRANSFORMATION HAPPENS
// ============================================
//
// Workshops are where raw materials become finished goods.
// They're the physical manifestation of the SECONDARY sector.
//
// Key concepts:
//   - Recipes: Input materials → Output products
//   - Capacity: How much can be produced per slot
//   - Quality: Skill affects output quality
//   - Tool requirements: Can't forge without an anvil
//

// ============================================
// WORKSHOP TYPES
// ============================================

export const WorkshopTypeSchema = z.enum([
  // Metalworking
  "forge",              // Iron/steel work
  "foundry",            // Casting, large metal items
  "weaponsmith",        // Specialized weapons
  "armorsmith",         // Specialized armor
  "goldsmith",          // Precious metals
  "tinsmith",           // Tin, pewter

  // Woodworking
  "carpentry",          // General woodwork
  "bowyer",             // Bows, crossbows
  "wheelwright",        // Wheels, carts
  "shipyard",           // Ships, boats
  "cooperage",          // Barrels

  // Textiles
  "loom",               // Weaving
  "tailor",             // Clothing
  "cobbler",            // Shoes
  "tannery",            // Leather processing
  "leatherworker",      // Leather goods

  // Food/Drink
  "bakery",             // Bread, pastries
  "brewery",            // Beer, ale
  "winery",             // Wine
  "butchery",           // Meat processing
  "kitchen",            // Prepared food

  // Construction
  "masonry",            // Stone work
  "pottery",            // Ceramics
  "glassworks",         // Glass

  // Specialized
  "alchemy_lab",        // Potions, chemicals
  "scriptorium",        // Books, scrolls
  "enchanting_circle",  // Magic items
  "jeweler_bench",      // Gems, jewelry
  "apothecary",         // Medicines
]);
export type WorkshopType = z.infer<typeof WorkshopTypeSchema>;

// ============================================
// RECIPE (Transformation formula)
// ============================================

export const RecipeSchema = z.object({
  id: z.string().uuid(),

  // Identity
  name: z.string(),                           // "Iron Longsword"
  description: z.string().optional(),

  // What workshop can make this
  workshopType: WorkshopTypeSchema,

  // Inputs (what you need)
  inputs: z.array(z.object({
    commodityId: z.string(),
    quantity: z.number(),
    consumed: z.boolean().default(true),      // Catalysts aren't consumed
  })).min(1),

  // Outputs (what you get)
  outputs: z.array(z.object({
    itemId: z.string().optional(),            // If producing item
    commodityId: z.string().optional(),       // If producing commodity
    quantity: z.number(),
    qualityInherited: z.boolean().default(true), // Does craftsman skill affect quality?
  })).min(1),

  // Time (in slots)
  baseSlots: z.number().int().min(1),         // Base time to produce one batch

  // Requirements
  minimumRank: GuildRankSchema.default("apprentice"),
  minimumSkillLevel: z.number().int().min(1).max(5).default(1),
  requiredTools: z.array(z.string()).default([]), // Tool IDs/names

  // Quality
  baseDifficulty: z.number().int().default(10), // DC for quality check
  canProduceMasterwork: z.boolean().default(true),

  // Economics
  baseLaborCost: z.number().default(0),       // GP in wages
  baseValue: z.number().optional(),           // Output value

  // Is this known?
  isSecret: z.boolean().default(false),
  knownBy: z.array(z.string().uuid()).default([]), // Guild/NPC IDs

  createdAt: z.string(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

// ============================================
// WORKSHOP
// ============================================

export const WorkshopSchema = z.object({
  id: z.string().uuid(),

  // Location
  settlementId: z.string().uuid(),
  settlementName: z.string(),
  buildingId: z.string().uuid().optional(),   // Hub building ID
  districtId: z.string().uuid().optional(),

  // Identity
  name: z.string(),                           // "Grimm's Forge"
  type: WorkshopTypeSchema,

  // Ownership
  ownerId: z.string().uuid(),
  ownerType: z.enum(["npc", "character", "guild", "faction"]),
  ownerName: z.string(),

  // Guild affiliation
  guildChapterId: z.string().uuid().optional(),
  guildName: z.string().optional(),

  // Capacity
  capacity: z.object({
    workstations: z.number().int().default(1), // How many can work at once
    maxWorkers: z.number().int().default(4),
    storageCapacity: z.number().default(1000), // Weight in lbs
  }),

  // Current state
  workers: z.array(z.object({
    npcId: z.string().uuid(),
    name: z.string(),
    rank: GuildRankSchema,
    skillLevel: z.number().int().min(1).max(5),
    wage: z.number(),                         // Per day
    hoursThisWeek: z.number().default(0),
  })).default([]),

  // Tools & Equipment
  tools: z.array(z.object({
    toolId: z.string(),
    name: z.string(),
    condition: z.number().min(0).max(100).default(100),
    qualityModifier: z.number().default(0),   // +/- to quality rolls
  })).default([]),

  // Inventory
  materialInventory: z.record(z.string(), z.number()).default({}), // commodityId -> quantity
  productInventory: z.array(z.object({
    itemId: z.string().optional(),
    commodityId: z.string().optional(),
    name: z.string(),
    quantity: z.number(),
    quality: z.enum(["poor", "common", "good", "excellent", "masterwork"]),
    createdAt: z.string(),
  })).default([]),

  // Known recipes
  knownRecipes: z.array(z.string().uuid()).default([]),

  // Production queue
  productionQueue: z.array(z.object({
    recipeId: z.string().uuid(),
    recipeName: z.string(),
    quantity: z.number().int(),
    slotsRemaining: z.number().int(),
    assignedWorkerId: z.string().uuid().optional(),
    priority: z.number().int().default(1),
    forCustomerId: z.string().uuid().optional(), // Custom order
    customerName: z.string().optional(),
  })).default([]),

  // Quality
  reputationQuality: z.number().int().min(0).max(100).default(50),
  specializations: z.array(z.string()).default([]), // What they're known for

  // Finances
  operatingCostsPerDay: z.number().default(0),
  revenueThisMonth: z.number().default(0),
  expensesThisMonth: z.number().default(0),

  // Status
  status: z.enum([
    "operational",
    "understaffed",
    "no_materials",
    "maintenance",
    "closed",
  ]).default("operational"),

  // Operating hours
  operatingHours: z.object({
    openSlot: z.number().int().default(12),   // 6 AM
    closeSlot: z.number().int().default(40),  // 8 PM
    daysOff: z.array(z.number().int()).default([]), // Day indices
  }),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workshop = z.infer<typeof WorkshopSchema>;

// ============================================
// PRODUCTION ORDER
// ============================================

export const ProductionOrderSchema = z.object({
  id: z.string().uuid(),

  // What
  workshopId: z.string().uuid(),
  workshopName: z.string(),
  recipeId: z.string().uuid(),
  recipeName: z.string(),
  quantity: z.number().int().min(1),

  // For whom
  customerId: z.string().uuid().optional(),
  customerType: z.enum(["npc", "character", "guild", "faction", "stock"]).optional(),
  customerName: z.string().optional(),

  // Materials
  materialsReserved: z.boolean().default(false),
  materialsSource: z.enum(["workshop_stock", "customer_provided", "guild_pool", "purchase"]).default("workshop_stock"),

  // Timeline
  orderedAt: z.string(),
  startedAt: z.string().optional(),
  dueDate: z.string().optional(),
  completedAt: z.string().optional(),

  // Progress
  slotsRequired: z.number().int(),
  slotsCompleted: z.number().int().default(0),
  percentComplete: z.number().min(0).max(100).default(0),

  // Assigned craftsman
  craftsmanId: z.string().uuid().optional(),
  craftsmanName: z.string().optional(),
  craftsmanSkill: z.number().int().optional(),

  // Quality (determined on completion)
  qualityRoll: z.number().int().optional(),
  qualityResult: z.enum(["poor", "common", "good", "excellent", "masterwork"]).optional(),

  // Payment
  agreedPrice: z.number().optional(),
  depositPaid: z.number().default(0),
  balanceDue: z.number().default(0),

  // Status
  status: z.enum([
    "pending",          // Waiting for materials/time
    "in_progress",      // Being worked on
    "quality_check",    // Awaiting inspection
    "completed",        // Ready for pickup
    "delivered",        // Given to customer
    "cancelled",        // Cancelled
    "failed",           // Production failed
  ]).default("pending"),

  // Notes
  specialInstructions: z.string().optional(),
  failureReason: z.string().optional(),
});
export type ProductionOrder = z.infer<typeof ProductionOrderSchema>;

// ============================================
// QUALITY LEVELS
// ============================================

export const QUALITY_LEVELS = {
  poor: { modifier: -2, priceMultiplier: 0.5, durabilityMultiplier: 0.5 },
  common: { modifier: 0, priceMultiplier: 1.0, durabilityMultiplier: 1.0 },
  good: { modifier: 1, priceMultiplier: 1.5, durabilityMultiplier: 1.25 },
  excellent: { modifier: 2, priceMultiplier: 2.0, durabilityMultiplier: 1.5 },
  masterwork: { modifier: 3, priceMultiplier: 3.0, durabilityMultiplier: 2.0 },
};

// ============================================
// STANDARD RECIPES
// ============================================

export const STANDARD_RECIPES: Partial<Recipe>[] = [
  // Smithing
  {
    name: "Iron Ingot",
    workshopType: "forge",
    inputs: [
      { commodityId: "iron_ore", quantity: 2, consumed: true },
      { commodityId: "coal", quantity: 1, consumed: true },
    ],
    outputs: [
      { commodityId: "iron", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 2,
    minimumSkillLevel: 1,
    baseDifficulty: 8,
  },
  {
    name: "Longsword",
    workshopType: "weaponsmith",
    inputs: [
      { commodityId: "iron", quantity: 3, consumed: true },
      { commodityId: "timber", quantity: 1, consumed: true },
      { commodityId: "leather", quantity: 1, consumed: true },
    ],
    outputs: [
      { itemId: "longsword", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 8,
    minimumSkillLevel: 2,
    baseDifficulty: 12,
    canProduceMasterwork: true,
  },
  {
    name: "Chain Mail",
    workshopType: "armorsmith",
    inputs: [
      { commodityId: "iron", quantity: 10, consumed: true },
    ],
    outputs: [
      { itemId: "chain_mail", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 16,
    minimumSkillLevel: 3,
    baseDifficulty: 15,
    canProduceMasterwork: true,
  },

  // Woodworking
  {
    name: "Wooden Shield",
    workshopType: "carpentry",
    inputs: [
      { commodityId: "timber", quantity: 2, consumed: true },
      { commodityId: "iron", quantity: 1, consumed: true },
    ],
    outputs: [
      { itemId: "shield", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 4,
    minimumSkillLevel: 1,
    baseDifficulty: 10,
  },
  {
    name: "Longbow",
    workshopType: "bowyer",
    inputs: [
      { commodityId: "timber", quantity: 2, consumed: true },
      { commodityId: "cloth", quantity: 1, consumed: true },
    ],
    outputs: [
      { itemId: "longbow", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 6,
    minimumSkillLevel: 2,
    baseDifficulty: 13,
    canProduceMasterwork: true,
  },

  // Alchemy
  {
    name: "Healing Potion",
    workshopType: "alchemy_lab",
    inputs: [
      { commodityId: "herbs", quantity: 3, consumed: true },
      { commodityId: "magic_components", quantity: 1, consumed: true },
    ],
    outputs: [
      { itemId: "potion_healing", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 4,
    minimumSkillLevel: 2,
    baseDifficulty: 13,
    minimumRank: "journeyman",
  },
  {
    name: "Antidote",
    workshopType: "apothecary",
    inputs: [
      { commodityId: "herbs", quantity: 2, consumed: true },
    ],
    outputs: [
      { itemId: "antidote", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 2,
    minimumSkillLevel: 1,
    baseDifficulty: 10,
  },

  // Food
  {
    name: "Bread Loaf",
    workshopType: "bakery",
    inputs: [
      { commodityId: "grain", quantity: 2, consumed: true },
    ],
    outputs: [
      { commodityId: "bread", quantity: 4, qualityInherited: false },
    ],
    baseSlots: 1,
    minimumSkillLevel: 1,
    baseDifficulty: 5,
  },
  {
    name: "Ale Barrel",
    workshopType: "brewery",
    inputs: [
      { commodityId: "grain", quantity: 10, consumed: true },
      { commodityId: "water", quantity: 5, consumed: true },
    ],
    outputs: [
      { commodityId: "ale", quantity: 1, qualityInherited: true },
    ],
    baseSlots: 8,
    minimumSkillLevel: 1,
    baseDifficulty: 8,
  },
];

// ============================================
// WORKSHOP FUNCTIONS
// ============================================

/**
 * Calculate quality of produced item.
 */
export function determineQuality(
  craftsmanSkill: number,      // 1-5
  toolQualityBonus: number,    // -2 to +2
  recipeDifficulty: number,    // DC
  roll: number                 // d20 result
): {
  quality: keyof typeof QUALITY_LEVELS;
  total: number;
  success: boolean;
} {
  const total = roll + craftsmanSkill + toolQualityBonus;
  const margin = total - recipeDifficulty;

  let quality: keyof typeof QUALITY_LEVELS;

  if (margin < -5) {
    quality = "poor";
  } else if (margin < 0) {
    quality = "poor";  // Failure but salvageable
  } else if (margin < 5) {
    quality = "common";
  } else if (margin < 10) {
    quality = "good";
  } else if (margin < 15) {
    quality = "excellent";
  } else {
    quality = "masterwork";
  }

  // Natural 1 = always poor, natural 20 = bump up one level
  if (roll === 1) {
    quality = "poor";
  } else if (roll === 20 && quality !== "masterwork") {
    const levels: Array<keyof typeof QUALITY_LEVELS> = ["poor", "common", "good", "excellent", "masterwork"];
    const idx = levels.indexOf(quality);
    quality = levels[Math.min(idx + 1, levels.length - 1)];
  }

  return {
    quality,
    total,
    success: margin >= 0,
  };
}

/**
 * Calculate production time based on craftsman skill.
 */
export function calculateProductionTime(
  baseSlots: number,
  craftsmanSkill: number,     // 1-5
  hasApprentice: boolean,
  toolQuality: "poor" | "common" | "good" | "excellent" | "masterwork"
): {
  slots: number;
  hoursApprox: number;
} {
  // Skill reduces time (velocity concept)
  const skillMultiplier = 1 / (0.5 + craftsmanSkill * 0.25); // 1 → 0.5, 5 → 0.33

  // Apprentice helps
  const apprenticeMultiplier = hasApprentice ? 0.8 : 1.0;

  // Tool quality affects speed slightly
  const toolMultiplier = {
    poor: 1.2,
    common: 1.0,
    good: 0.95,
    excellent: 0.9,
    masterwork: 0.85,
  }[toolQuality];

  const finalSlots = Math.ceil(baseSlots * skillMultiplier * apprenticeMultiplier * toolMultiplier);
  const hoursApprox = finalSlots * 0.5; // 1 slot = 30 min

  return { slots: finalSlots, hoursApprox };
}

/**
 * Check if workshop can produce a recipe.
 */
export function canProduceRecipe(
  workshop: Workshop,
  recipe: Recipe
): {
  canProduce: boolean;
  missingMaterials: Array<{ commodityId: string; needed: number; have: number }>;
  missingTools: string[];
  insufficientSkill: boolean;
  noAvailableWorker: boolean;
} {
  const missingMaterials: Array<{ commodityId: string; needed: number; have: number }> = [];
  const missingTools: string[] = [];
  let insufficientSkill = true;
  let noAvailableWorker = workshop.workers.length === 0;

  // Check materials
  for (const input of recipe.inputs) {
    const have = workshop.materialInventory[input.commodityId] || 0;
    if (have < input.quantity) {
      missingMaterials.push({
        commodityId: input.commodityId,
        needed: input.quantity,
        have,
      });
    }
  }

  // Check tools
  for (const requiredTool of recipe.requiredTools) {
    const hasTool = workshop.tools.some(t =>
      t.toolId === requiredTool || t.name.toLowerCase().includes(requiredTool.toLowerCase())
    );
    if (!hasTool) {
      missingTools.push(requiredTool);
    }
  }

  // Check skill
  for (const worker of workshop.workers) {
    if (worker.skillLevel >= recipe.minimumSkillLevel) {
      insufficientSkill = false;
      break;
    }
  }

  // Check worker availability
  const queuedSlots = workshop.productionQueue.reduce((sum, item) => sum + item.slotsRemaining, 0);
  const availableCapacity = workshop.capacity.workstations * 48 - queuedSlots; // Per day
  noAvailableWorker = availableCapacity <= 0;

  return {
    canProduce: missingMaterials.length === 0 &&
                missingTools.length === 0 &&
                !insufficientSkill &&
                !noAvailableWorker,
    missingMaterials,
    missingTools,
    insufficientSkill,
    noAvailableWorker,
  };
}

/**
 * Calculate daily operating costs for a workshop.
 */
export function calculateDailyOperatingCosts(workshop: Workshop): {
  wages: number;
  materials: number;
  rent: number;
  maintenance: number;
  total: number;
} {
  // Wages
  const wages = workshop.workers.reduce((sum, w) => sum + w.wage, 0);

  // Consumed materials (estimated from queue)
  const materials = 0; // Would calculate from production queue

  // Rent (based on settlement, assume 1gp/day for basic workshop)
  const rent = workshop.capacity.workstations * 0.5;

  // Maintenance (tools wear out)
  const maintenance = workshop.tools.length * 0.1;

  return {
    wages,
    materials,
    rent,
    maintenance,
    total: wages + materials + rent + maintenance,
  };
}

// ============================================
// WORKSHOP TYPE ↔ GUILD TYPE MAPPING
// ============================================

export const WORKSHOP_GUILD_MAP: Record<WorkshopType, GuildType> = {
  forge: "smiths",
  foundry: "smiths",
  weaponsmith: "smiths",
  armorsmith: "smiths",
  goldsmith: "jewelers",
  tinsmith: "smiths",
  carpentry: "carpenters",
  bowyer: "carpenters",
  wheelwright: "carpenters",
  shipyard: "shipwrights",
  cooperage: "coopers",
  loom: "weavers",
  tailor: "weavers",
  cobbler: "tanners",
  tannery: "tanners",
  leatherworker: "tanners",
  bakery: "bakers",
  brewery: "brewers",
  winery: "vintners",
  butchery: "butchers",
  kitchen: "innkeepers",
  masonry: "masons",
  pottery: "potters",
  glassworks: "glassblowers",
  alchemy_lab: "alchemists",
  scriptorium: "scribes",
  enchanting_circle: "arcane",
  jeweler_bench: "jewelers",
  apothecary: "apothecaries",
};
