import { z } from "zod";
import { ResourceTypeSchema } from "./downtime";

// ============================================
// FOLLOWERS & ORGANIZATIONS
// ============================================

export const FollowerTypeSchema = z.enum([
  "soldier",
  "archer",
  "cavalry",
  "guard",
  "sergeant",
  "knight",
  "spy",
  "assassin",
  "scout",
  "thief",
  "informant",
  "servant",
  "craftsman",
  "healer",
  "mage",
  "priest",
  "diplomat",
  "merchant",
  "sage",
  "engineer",
  "captain",
  "lieutenant",
  "advisor",
  "steward",
]);
export type FollowerType = z.infer<typeof FollowerTypeSchema>;

export const FollowerQualitySchema = z.enum([
  "green",
  "trained",
  "veteran",
  "elite",
  "legendary",
]);
export type FollowerQuality = z.infer<typeof FollowerQualitySchema>;

export const FollowerStatusSchema = z.enum([
  "available",
  "on_mission",
  "recovering",
  "training",
  "traveling",
  "captured",
  "missing",
  "dead",
]);
export type FollowerStatus = z.infer<typeof FollowerStatusSchema>;

export const FollowerSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  ownerId: z.string().uuid(),
  ownerType: z.enum(["character", "party", "organization"]),

  name: z.string(),
  type: FollowerTypeSchema,
  quality: FollowerQualitySchema.default("trained"),
  status: FollowerStatusSchema.default("available"),
  currentMission: z.string().uuid().optional(),

  stats: z.object({
    combat: z.number().int().min(0).max(10).default(3),
    stealth: z.number().int().min(0).max(10).default(3),
    social: z.number().int().min(0).max(10).default(3),
    knowledge: z.number().int().min(0).max(10).default(3),
    loyalty: z.number().int().min(0).max(10).default(5),
    morale: z.number().int().min(0).max(10).default(5),
  }),

  specialties: z.array(z.string()).default([]),
  upkeep: z.object({
    gold: z.number().default(0),
    provisions: z.number().default(0),
  }),

  personality: z
    .object({
      traits: z.array(z.string()).default([]),
      motivation: z.string().optional(),
    })
    .optional(),

  recruitedAt: z.date(),
});
export type Follower = z.infer<typeof FollowerSchema>;

export const FollowerUnitSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  ownerId: z.string().uuid(),

  name: z.string(),
  type: FollowerTypeSchema,
  size: z.number().int().positive(),
  quality: FollowerQualitySchema,
  status: FollowerStatusSchema.default("available"),

  stats: z.object({
    effectiveness: z.number().int().min(0).max(10),
    morale: z.number().int().min(0).max(10),
    cohesion: z.number().int().min(0).max(10),
  }),

  upkeep: z.object({
    gold: z.number(),
    provisions: z.number(),
  }),
});
export type FollowerUnit = z.infer<typeof FollowerUnitSchema>;

// ============================================
// ORGANIZATION
// ============================================

export const OrganizationTypeSchema = z.enum([
  "mercenary_company",
  "thieves_guild",
  "merchant_house",
  "noble_house",
  "religious_order",
  "arcane_circle",
  "spy_network",
  "knightly_order",
  "criminal_syndicate",
  "trading_company",
  "military_unit",
]);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  name: z.string(),
  type: OrganizationTypeSchema,
  motto: z.string().optional(),

  tier: z.number().int().min(1).max(5).default(1),
  // 1: Local (1-20), 2: Regional (20-100), 3: National (100-500), 4: Continental, 5: Global

  leaders: z.array(
    z.object({
      characterId: z.string().uuid(),
      title: z.string(),
    }),
  ),

  totalMembers: z.number().int().default(0),
  followers: z.array(z.string().uuid()).default([]),
  units: z.array(z.string().uuid()).default([]),

  resources: z.object({
    gold: z.number().default(0),
    materials: z.number().default(0),
    influence: z.number().default(0),
    information: z.number().default(0),
  }),

  headquarters: z
    .object({
      name: z.string(),
      locationId: z.string().uuid().optional(),
    })
    .optional(),

  holdings: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        locationId: z.string().uuid().optional(),
      }),
    )
    .default([]),

  capabilities: z.array(z.string()).default([]),
  reputation: z.number().int().min(-100).max(100).default(0),
});
export type Organization = z.infer<typeof OrganizationSchema>;

// ============================================
// COST TABLES
// ============================================

export const FollowerCosts: Record<
  FollowerType,
  { recruit: number; upkeep: number }
> = {
  soldier: { recruit: 50, upkeep: 5 },
  archer: { recruit: 75, upkeep: 6 },
  cavalry: { recruit: 200, upkeep: 15 },
  guard: { recruit: 60, upkeep: 5 },
  sergeant: { recruit: 150, upkeep: 10 },
  knight: { recruit: 500, upkeep: 25 },
  spy: { recruit: 200, upkeep: 15 },
  assassin: { recruit: 500, upkeep: 25 },
  scout: { recruit: 100, upkeep: 8 },
  thief: { recruit: 150, upkeep: 10 },
  informant: { recruit: 50, upkeep: 10 },
  servant: { recruit: 10, upkeep: 2 },
  craftsman: { recruit: 100, upkeep: 8 },
  healer: { recruit: 200, upkeep: 12 },
  mage: { recruit: 1000, upkeep: 50 },
  priest: { recruit: 300, upkeep: 15 },
  diplomat: { recruit: 300, upkeep: 20 },
  merchant: { recruit: 200, upkeep: 10 },
  sage: { recruit: 400, upkeep: 20 },
  engineer: { recruit: 350, upkeep: 18 },
  captain: { recruit: 300, upkeep: 15 },
  lieutenant: { recruit: 250, upkeep: 15 },
  advisor: { recruit: 500, upkeep: 30 },
  steward: { recruit: 400, upkeep: 25 },
};

export const QualityMultiplier: Record<FollowerQuality, number> = {
  green: 0.5,
  trained: 1.0,
  veteran: 2.0,
  elite: 4.0,
  legendary: 10.0,
};
