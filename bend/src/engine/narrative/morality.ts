import { z } from "zod";
import { AlignmentSchema } from "../rules/creature";

// ============================================
// MORAL PHYSICS ENGINE
// ============================================
//
// In D&D, alignment isn't just flavor - it's PHYSICS.
// Detect Evil works because evil is measurable.
// Paladins smite because good has force.
//
// This module makes alignment a first-class engine concern:
//   - Villains exert evil gravity
//   - Patrons radiate good influence
//   - Conflicts emerge where forces collide
//   - The campaign has a moral topology
//

// ============================================
// ALIGNMENT VISIBILITY
// ============================================
//
// Critical: Alignment is GM-only by default.
// Players discover it through:
//   - Spells (Detect Evil/Good)
//   - Observation (actions reveal character)
//   - GM decision (dramatic reveal)
//

export const AlignmentVisibilitySchema = z.enum([
  "hidden",     // Default - GM only
  "detected",   // Revealed by spell (temporary or permanent)
  "observed",   // Actions made it apparent
  "revealed",   // GM manually revealed
  "obvious",    // Creature type makes it clear (demon, angel)
]);
export type AlignmentVisibility = z.infer<typeof AlignmentVisibilitySchema>;

export const AlignmentRevealSchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.enum(["creature", "npc", "faction", "location", "item"]),

  // The actual alignment (known to GM)
  trueAlignment: AlignmentSchema,

  // What players see
  visibility: AlignmentVisibilitySchema.default("hidden"),

  // Who knows
  revealedTo: z.array(z.object({
    playerId: z.string().uuid(),
    method: z.enum(["spell", "observation", "gm_reveal", "obvious"]),
    timestamp: z.string(),
    temporary: z.boolean().default(false), // Spell duration
    expiresAt: z.string().optional(),
  })).default([]),

  // False alignment (for deception)
  apparentAlignment: AlignmentSchema.optional(), // What it SEEMS to be
  deceptionActive: z.boolean().default(false),
  deceptionDC: z.number().int().optional(), // To see through it
});
export type AlignmentReveal = z.infer<typeof AlignmentRevealSchema>;

// ============================================
// MORAL FORCE
// ============================================
//
// Abstract representation of alignment as a force.
// Used to calculate moral "gravity" in locations,
// corruption spread, divine intervention thresholds.
//

export const MoralAxisSchema = z.object({
  // Law vs Chaos (-100 to +100)
  // Negative = Chaotic, Positive = Lawful
  lawChaos: z.number().int().min(-100).max(100).default(0),

  // Good vs Evil (-100 to +100)
  // Negative = Evil, Positive = Good
  goodEvil: z.number().int().min(-100).max(100).default(0),
});
export type MoralAxis = z.infer<typeof MoralAxisSchema>;

export const MoralForceSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Source of the force
  sourceType: z.enum([
    "villain",      // BBEG, cult leader
    "patron",       // Deity, celestial benefactor
    "artifact",     // Evil sword, holy relic
    "location",     // Cursed ground, sacred grove
    "event",        // Apocalypse in progress, divine blessing
    "faction",      // Evil empire, holy order
  ]),
  sourceId: z.string().uuid(),
  sourceName: z.string(),

  // The alignment force
  alignment: AlignmentSchema,
  axis: MoralAxisSchema,

  // Strength (affects radius and intensity)
  strength: z.number().int().min(1).max(100).default(50),

  // Reach
  radius: z.enum([
    "personal",     // Just the source
    "local",        // Building/room
    "settlement",   // Town/city
    "regional",     // Affects whole region
    "continental",  // Major force
    "planetary",    // World-shaking
    "planar",       // Crosses planes
  ]).default("local"),

  // Effects
  effects: z.object({
    // Passive aura effects
    corruptsWeak: z.boolean().default(false),      // Turns weak-willed evil
    inspiresGood: z.boolean().default(false),      // Bolsters good creatures
    wardsEvil: z.boolean().default(false),         // Repels evil
    attractsEvil: z.boolean().default(false),      // Draws evil creatures
    dampensGood: z.boolean().default(false),       // Weakens good
    distortsMagic: z.boolean().default(false),     // Affects spellcasting

    // Detection
    detectableDC: z.number().int().default(10),    // DC to sense the force
    obviousTo: z.array(z.enum([
      "paladins",
      "clerics",
      "fiends",
      "celestials",
      "undead",
      "fey",
    ])).default([]),
  }),

  // State
  active: z.boolean().default(true),
  growing: z.boolean().default(false),            // Is it spreading?
  growthRate: z.number().optional(),              // Per day/week

  // Visibility
  knownToParty: z.boolean().default(false),
});
export type MoralForce = z.infer<typeof MoralForceSchema>;

// ============================================
// VILLAIN
// ============================================
//
// The BBEG and their apparatus of evil.
// A villain isn't just an NPC - they're a moral force
// with goals, minions, and a plan.
//

export const VillainTierSchema = z.enum([
  "minion",       // Disposable evil
  "lieutenant",   // Named villain, serves greater evil
  "boss",         // Arc villain, major threat
  "bbeg",         // Campaign big bad
  "cosmic",       // Deity-level threat
]);
export type VillainTier = z.infer<typeof VillainTierSchema>;

export const VillainSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  title: z.string().optional(),                   // "The Lich King", "High Priestess of Orcus"
  aliases: z.array(z.string()).default([]),       // Other names they go by

  // Classification
  tier: VillainTierSchema,
  alignment: AlignmentSchema,
  creatureType: z.string().optional(),            // "undead", "fiend", "humanoid"

  // The moral weight
  moralForceId: z.string().uuid().optional(),     // Links to MoralForce
  evilIntensity: z.number().int().min(1).max(100).default(50),

  // NPC link (if they have stats)
  npcId: z.string().uuid().optional(),
  creatureId: z.string().uuid().optional(),

  // Visibility to party
  visibility: z.object({
    known: z.boolean().default(false),            // Party knows they exist
    nameKnown: z.boolean().default(false),        // Party knows their name
    faceKnown: z.boolean().default(false),        // Party has seen them
    alignmentRevealed: z.boolean().default(false), // Party knows they're evil
    goalsKnown: z.boolean().default(false),       // Party knows what they want
    weaknessKnown: z.boolean().default(false),    // Party knows how to stop them
  }),

  // Goals (what evil wants)
  goals: z.array(z.object({
    id: z.string().uuid(),
    description: z.string(),
    motivation: z.string(),                       // WHY they want this
    progress: z.number().int().min(0).max(100).default(0),
    deadline: z.string().optional(),              // When it must happen
    consequenceIfAchieved: z.string(),            // What happens if they win
    secret: z.boolean().default(true),            // Hidden from party
  })).default([]),

  // The Plan (how they'll achieve goals)
  masterPlan: z.object({
    summary: z.string(),
    phases: z.array(z.object({
      name: z.string(),
      description: z.string(),
      status: z.enum(["pending", "active", "completed", "failed"]),
      requiredFor: z.string().optional(),         // What goal this serves
    })).default([]),
    currentPhase: z.number().int().default(0),
  }).optional(),

  // Resources
  resources: z.object({
    lair: z.object({
      locationId: z.string().uuid().optional(),
      name: z.string(),
      description: z.string().optional(),
      defenses: z.array(z.string()).default([]),
    }).optional(),

    // Minions and lieutenants
    forces: z.object({
      minionCount: z.number().int().default(0),
      minionTypes: z.array(z.string()).default([]),
      lieutenants: z.array(z.object({
        villainId: z.string().uuid(),             // Other villain entries
        name: z.string(),
        role: z.string(),
      })).default([]),
    }),

    // Cult/Organization
    organization: z.object({
      name: z.string().optional(),                // "Cult of the Dragon"
      factionId: z.string().uuid().optional(),    // Links to faction
      size: z.enum(["cell", "network", "army"]).optional(),
    }).optional(),

    // Magical resources
    artifacts: z.array(z.object({
      name: z.string(),
      power: z.string(),
      itemId: z.string().uuid().optional(),
    })).default([]),
  }),

  // Weaknesses (how heroes can win)
  weaknesses: z.array(z.object({
    description: z.string(),
    howToExploit: z.string(),
    knownToParty: z.boolean().default(false),
    discoveryMethod: z.string().optional(),       // How party could learn this
  })).default([]),

  // Relationships
  relationships: z.object({
    serves: z.object({                            // Greater evil above them
      villainId: z.string().uuid().optional(),
      name: z.string().optional(),
      nature: z.string().optional(),              // "devoted servant", "reluctant pawn"
    }).optional(),
    rivals: z.array(z.object({                    // Other villains they oppose
      villainId: z.string().uuid(),
      name: z.string(),
      nature: z.string(),
    })).default([]),
    enemies: z.array(z.object({                   // Good forces opposing them
      type: z.enum(["patron", "faction", "npc"]),
      id: z.string().uuid(),
      name: z.string(),
    })).default([]),
  }),

  // Arc tracking
  arc: z.object({
    introduction: z.string().optional(),          // How party first encounters
    escalation: z.array(z.string()).default([]),  // How threat grows
    confrontation: z.string().optional(),         // The showdown
    resolution: z.string().optional(),            // How it ends
    status: z.enum(["lurking", "active", "confronted", "defeated", "escaped", "victorious"]),
  }),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Villain = z.infer<typeof VillainSchema>;

// ============================================
// PATRON
// ============================================
//
// The force of good backing the party.
// Could be a deity, an organization, a powerful ally.
//

export const PatronTierSchema = z.enum([
  "local",        // Village elder, local lord
  "regional",     // Duke, high priest
  "national",     // King, archmage
  "continental",  // Emperor, archdruid
  "divine",       // Deity, celestial
]);
export type PatronTier = z.infer<typeof PatronTierSchema>;

export const PatronSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  title: z.string().optional(),

  // Classification
  tier: PatronTierSchema,
  alignment: AlignmentSchema,
  type: z.enum([
    "deity",        // God/goddess
    "celestial",    // Angel, archon
    "mortal",       // King, archmage
    "organization", // Order, church
    "spirit",       // Ancestor, nature spirit
    "abstract",     // "The Light", "Balance"
  ]),

  // The moral weight
  moralForceId: z.string().uuid().optional(),
  goodIntensity: z.number().int().min(1).max(100).default(50),

  // Links
  npcId: z.string().uuid().optional(),
  deityId: z.string().uuid().optional(),
  factionId: z.string().uuid().optional(),

  // What they want from the party
  expectations: z.array(z.object({
    description: z.string(),
    priority: z.enum(["suggested", "expected", "required"]),
    consequence: z.string().optional(),           // If not met
  })).default([]),

  // What they offer
  blessings: z.array(z.object({
    name: z.string(),
    description: z.string(),
    mechanical: z.string().optional(),            // Game effect
    active: z.boolean().default(true),
    conditionalOn: z.string().optional(),         // When it applies
  })).default([]),

  // Resources they provide
  resources: z.object({
    sanctuary: z.object({
      locationId: z.string().uuid().optional(),
      name: z.string(),
      benefits: z.array(z.string()).default([]),
    }).optional(),
    allies: z.array(z.object({
      name: z.string(),
      role: z.string(),
      npcId: z.string().uuid().optional(),
    })).default([]),
    information: z.array(z.string()).default([]), // What they know
    equipment: z.array(z.string()).default([]),   // What they can provide
  }),

  // Relationship with party
  partyStanding: z.number().int().min(-100).max(100).default(50),
  standingHistory: z.array(z.object({
    event: z.string(),
    change: z.number().int(),
    date: z.string().optional(),
  })).default([]),

  // Communication
  communication: z.object({
    method: z.enum([
      "direct",       // Face to face
      "messenger",    // Through agents
      "visions",      // Dreams, omens
      "signs",        // Portents, symbols
      "prayer",       // Cleric communion
      "rare",         // Almost never
    ]).default("messenger"),
    frequency: z.enum(["constant", "regular", "occasional", "rare", "crisis_only"]),
    lastContact: z.string().optional(),
  }),

  // Opposition
  opposes: z.array(z.object({
    villainId: z.string().uuid(),
    name: z.string(),
    reason: z.string(),
    priority: z.enum(["minor", "major", "existential"]),
  })).default([]),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Patron = z.infer<typeof PatronSchema>;

// ============================================
// CONFLICT
// ============================================
//
// Where good and evil collide.
// The campaign's moral battleground.
//

export const ConflictSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // The clash
  name: z.string(),
  description: z.string(),

  // Combatants
  evilSide: z.object({
    villains: z.array(z.string().uuid()),         // Villain IDs
    factions: z.array(z.string().uuid()),         // Faction IDs
    forces: z.string(),                           // Description of evil forces
  }),
  goodSide: z.object({
    patrons: z.array(z.string().uuid()),          // Patron IDs
    factions: z.array(z.string().uuid()),         // Faction IDs
    forces: z.string(),                           // Description of good forces
  }),

  // Stakes
  stakes: z.object({
    ifEvilWins: z.string(),
    ifGoodWins: z.string(),
    scope: z.enum(["local", "regional", "continental", "world", "planar"]),
  }),

  // State
  status: z.enum([
    "brewing",        // Tension building
    "cold",           // Open hostility, no fighting
    "skirmishing",    // Small conflicts
    "war",            // Full conflict
    "climax",         // Final battle approaching
    "resolved",       // One side won
  ]),

  // Balance of power (-100 evil winning, +100 good winning)
  balance: z.number().int().min(-100).max(100).default(0),

  // Key battlegrounds
  battlegrounds: z.array(z.object({
    locationId: z.string().uuid().optional(),
    name: z.string(),
    importance: z.enum(["minor", "significant", "critical"]),
    controlledBy: z.enum(["evil", "contested", "good"]),
  })).default([]),

  // Party involvement
  partyRole: z.enum([
    "unaware",        // Don't know about it
    "bystanders",     // Know but not involved
    "minor_players",  // Small role
    "key_players",    // Important
    "champions",      // Central heroes
  ]).default("unaware"),

  // Resolution
  resolution: z.object({
    outcome: z.enum(["evil_victory", "good_victory", "pyrrhic", "stalemate", "ongoing"]).optional(),
    description: z.string().optional(),
    consequences: z.array(z.string()).default([]),
  }).optional(),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Conflict = z.infer<typeof ConflictSchema>;

// ============================================
// MORAL TOPOLOGY
// ============================================
//
// The campaign's moral landscape.
// Shows where good and evil hold sway.
//

export const MoralTopologySchema = z.object({
  campaignId: z.string().uuid(),

  // All moral forces
  forces: z.array(z.string().uuid()),             // MoralForce IDs

  // All villains
  villains: z.array(z.string().uuid()),

  // All patrons
  patrons: z.array(z.string().uuid()),

  // Active conflicts
  conflicts: z.array(z.string().uuid()),

  // Global moral state
  worldState: z.object({
    // Overall balance
    balance: z.number().int().min(-100).max(100).default(0),
    trend: z.enum(["darkening", "stable", "brightening"]).default("stable"),

    // Major events affecting it
    recentShifts: z.array(z.object({
      description: z.string(),
      change: z.number().int(),
      date: z.string(),
    })).default([]),
  }),

  // Updated
  updatedAt: z.date(),
});
export type MoralTopology = z.infer<typeof MoralTopologySchema>;

// ============================================
// HELPER: Calculate alignment from axes
// ============================================

export function axesToAlignment(axis: MoralAxis): z.infer<typeof AlignmentSchema> {
  const lawChaos = axis.lawChaos;
  const goodEvil = axis.goodEvil;

  // Determine law/chaos
  let lc: "lawful" | "neutral" | "chaotic";
  if (lawChaos >= 30) lc = "lawful";
  else if (lawChaos <= -30) lc = "chaotic";
  else lc = "neutral";

  // Determine good/evil
  let ge: "good" | "neutral" | "evil";
  if (goodEvil >= 30) ge = "good";
  else if (goodEvil <= -30) ge = "evil";
  else ge = "neutral";

  // Combine
  if (lc === "neutral" && ge === "neutral") return "true_neutral";
  if (lc === "neutral") return `neutral_${ge}` as any;
  if (ge === "neutral") return `${lc}_neutral` as any;
  return `${lc}_${ge}` as any;
}

// ============================================
// HELPER: Alignment to axes
// ============================================

export function alignmentToAxes(alignment: z.infer<typeof AlignmentSchema>): MoralAxis {
  const map: Record<string, MoralAxis> = {
    lawful_good: { lawChaos: 75, goodEvil: 75 },
    neutral_good: { lawChaos: 0, goodEvil: 75 },
    chaotic_good: { lawChaos: -75, goodEvil: 75 },
    lawful_neutral: { lawChaos: 75, goodEvil: 0 },
    true_neutral: { lawChaos: 0, goodEvil: 0 },
    chaotic_neutral: { lawChaos: -75, goodEvil: 0 },
    lawful_evil: { lawChaos: 75, goodEvil: -75 },
    neutral_evil: { lawChaos: 0, goodEvil: -75 },
    chaotic_evil: { lawChaos: -75, goodEvil: -75 },
    unaligned: { lawChaos: 0, goodEvil: 0 },
  };
  return map[alignment] || { lawChaos: 0, goodEvil: 0 };
}

// ============================================
// EXPORTS
// ============================================

export {
  AlignmentSchema,
};
