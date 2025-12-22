import { z } from "zod";

// ============================================
// COORDINATE SYSTEMS
// ============================================

// Square grid uses standard (x, y)
export const SquareCoordSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});
export type SquareCoord = z.infer<typeof SquareCoordSchema>;

// Hex grid uses cube coordinates (q, r, s) where q + r + s = 0
// This makes distance and rotation calculations trivial
export const HexCoordSchema = z
  .object({
    q: z.number().int(),
    r: z.number().int(),
    s: z.number().int(),
  })
  .refine((coord) => coord.q + coord.r + coord.s === 0, {
    message: "Hex coordinates must satisfy q + r + s = 0",
  });
export type HexCoord = z.infer<typeof HexCoordSchema>;

// Axial coordinates (q, r) - s is derived
export const HexAxialSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
});
export type HexAxial = z.infer<typeof HexAxialSchema>;

// Universal coordinate - works with both systems
export const CoordinateSchema = z.union([
  z.object({ type: z.literal("square"), coord: SquareCoordSchema }),
  z.object({ type: z.literal("hex"), coord: HexCoordSchema }),
]);
export type Coordinate = z.infer<typeof CoordinateSchema>;

// ============================================
// GRID CONFIGURATION
// ============================================

export const GridTypeSchema = z.enum(["square", "hex-pointy", "hex-flat"]);
export type GridType = z.infer<typeof GridTypeSchema>;

export const GridConfigSchema = z.object({
  type: GridTypeSchema,

  // Size in cells
  width: z.number().int().positive(),
  height: z.number().int().positive(),

  // Cell size in pixels (for rendering)
  cellSize: z.number().positive().default(70),

  // Grid scale (feet per cell, typically 5 for D&D)
  scale: z.number().positive().default(5),

  // Origin offset for rendering
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
});
export type GridConfig = z.infer<typeof GridConfigSchema>;

// ============================================
// TERRAIN & CELL PROPERTIES
// ============================================

export const TerrainTypeSchema = z.enum([
  "normal",
  "difficult",
  "hazardous",
  "impassable",
  "water_shallow",
  "water_deep",
  "lava",
  "pit",
  "stairs_up",
  "stairs_down",
  "door",
  "door_locked",
  "door_secret",
  "wall",
]);
export type TerrainType = z.infer<typeof TerrainTypeSchema>;

export const CoverTypeSchema = z.enum([
  "none",
  "half", // +2 AC
  "three_quarters", // +5 AC
  "full", // can't be targeted directly
]);
export type CoverType = z.infer<typeof CoverTypeSchema>;

export const ElevationSchema = z.number().int(); // in 5-foot increments

export const CellSchema = z.object({
  // Position
  x: z.number().int(),
  y: z.number().int(),

  // Terrain
  terrain: TerrainTypeSchema.default("normal"),
  movementCost: z.number().positive().default(1), // 1 = normal, 2 = difficult

  // Elevation (for 3D combat)
  elevation: ElevationSchema.default(0),

  // Cover provided BY this cell (e.g., a pillar)
  providesCover: CoverTypeSchema.default("none"),

  // Lighting
  lightLevel: z
    .enum(["bright", "dim", "darkness", "magical_darkness"])
    .default("bright"),

  // Effects
  effects: z.array(z.string()).default([]), // "on_fire", "slippery", etc.

  // Metadata
  notes: z.string().optional(),
  color: z.string().optional(), // for GM visualization
});
export type Cell = z.infer<typeof CellSchema>;

// ============================================
// TOKENS (CREATURES ON THE GRID)
// ============================================

export const SizeSchema = z.enum([
  "tiny", // 2.5 ft, shares space
  "small", // 5 ft, 1x1
  "medium", // 5 ft, 1x1
  "large", // 10 ft, 2x2
  "huge", // 15 ft, 3x3
  "gargantuan", // 20+ ft, 4x4+
]);
export type Size = z.infer<typeof SizeSchema>;

export const SizeToGridMap: Record<Size, number> = {
  tiny: 1,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

export const TokenSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(), // links to NPC/PC/creature

  // Position (top-left corner for large creatures)
  x: z.number().int(),
  y: z.number().int(),

  // Size
  size: SizeSchema,

  // Facing (optional, for flanking rules)
  facing: z.number().min(0).max(360).optional(),

  // Movement
  speed: z.number().int().nonnegative().default(30),
  speedFlying: z.number().int().nonnegative().optional(),
  speedSwimming: z.number().int().nonnegative().optional(),
  speedClimbing: z.number().int().nonnegative().optional(),
  speedBurrowing: z.number().int().nonnegative().optional(),

  // Current movement remaining this turn
  movementRemaining: z.number().int().nonnegative().default(30),

  // Elevation (for flying, etc.)
  elevation: ElevationSchema.default(0),

  // Conditions affecting movement
  conditions: z.array(z.string()).default([]),

  // Visibility
  visible: z.boolean().default(true),
  visibleTo: z.array(z.string().uuid()).optional(), // if not visible to all

  // Display
  imageUrl: z.string().url().optional(),
  color: z.string().optional(), // fallback color
  label: z.string().optional(),
});
export type Token = z.infer<typeof TokenSchema>;

// ============================================
// LINE OF SIGHT & VISION
// ============================================

export const VisionTypeSchema = z.enum([
  "normal",
  "darkvision",
  "blindsight",
  "truesight",
  "tremorsense",
]);
export type VisionType = z.infer<typeof VisionTypeSchema>;

export const VisionSchema = z.object({
  type: VisionTypeSchema,
  range: z.number().int().positive(), // in feet
});
export type Vision = z.infer<typeof VisionSchema>;

export const LineOfSightResultSchema = z.object({
  canSee: z.boolean(),
  distance: z.number(), // in feet
  cover: CoverTypeSchema,
  obstructions: z.array(
    z.object({
      x: z.number().int(),
      y: z.number().int(),
      type: z.string(),
    }),
  ),
});
export type LineOfSightResult = z.infer<typeof LineOfSightResultSchema>;

// ============================================
// MOVEMENT & PATHFINDING
// ============================================

export const MovementTypeSchema = z.enum([
  "walk",
  "fly",
  "swim",
  "climb",
  "burrow",
  "teleport",
]);
export type MovementType = z.infer<typeof MovementTypeSchema>;

export const PathNodeSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  cost: z.number(), // movement cost to reach this node
  totalCost: z.number(), // total cost from start
});
export type PathNode = z.infer<typeof PathNodeSchema>;

export const PathResultSchema = z.object({
  valid: z.boolean(),
  path: z.array(PathNodeSchema),
  totalCost: z.number(),
  movementRequired: z.number(), // in feet
  canComplete: z.boolean(), // has enough movement
  triggersOpportunityAttacks: z.array(z.string().uuid()), // token IDs
});
export type PathResult = z.infer<typeof PathResultSchema>;

// ============================================
// AREAS OF EFFECT
// ============================================

export const AoeShapeSchema = z.enum([
  "circle", // radius from point
  "sphere", // 3D radius
  "cone", // from origin in direction
  "cube", // from origin point
  "cylinder", // radius + height
  "line", // width x length from origin
  "square", // alias for cube in 2D
]);
export type AoeShape = z.infer<typeof AoeShapeSchema>;

export const AreaOfEffectSchema = z.object({
  shape: AoeShapeSchema,

  // Origin
  originX: z.number().int(),
  originY: z.number().int(),
  originElevation: z.number().int().default(0),

  // Dimensions (in feet)
  radius: z.number().int().positive().optional(),
  length: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),

  // Direction (for cones, lines)
  direction: z.number().min(0).max(360).optional(), // degrees

  // For cones
  angle: z.number().min(0).max(360).default(90), // typically 90 degrees
});
export type AreaOfEffect = z.infer<typeof AreaOfEffectSchema>;

export const AoeResultSchema = z.object({
  affectedCells: z.array(
    z.object({
      x: z.number().int(),
      y: z.number().int(),
    }),
  ),
  affectedTokens: z.array(z.string().uuid()),
});
export type AoeResult = z.infer<typeof AoeResultSchema>;
