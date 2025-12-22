import { z } from "zod";
import { DamageTypeSchema, ConditionSchema } from "./core";
import { CoordSchema } from "../grid/types";

// ============================================
// LAIR SYSTEM - THE DUNGEON BRAIN
// ============================================
//
// Philosophy: THE LAIR IS AN ENEMY
//
// A lair isn't just a map with monsters.
// It's a living, reactive entity that:
//   - Acts on its own turn (Lair Actions)
//   - Affects the region around it (Regional Effects)
//   - Reacts to intrusion (Alert Levels)
//   - Moves its defenders (Patrol Routes)
//   - Deploys hazards (Traps & Environment)
//   - Adapts to player tactics (Learning)
//   - Grows stronger near its heart (Boss Empowerment)
//
// The dungeon FIGHTS BACK.
//

// ============================================
// LAIR IDENTITY
// ============================================

export const LairTypeSchema = z.enum([
  "dungeon", // Classic underground complex
  "fortress", // Military stronghold
  "lair", // Monster's home
  "temple", // Religious site
  "tower", // Vertical structure
  "cavern", // Natural cave system
  "ruins", // Crumbling structure
  "ship", // Vessel (nautical or airship)
  "planar", // Extraplanar location
  "living", // Creature's body / organic
  "mechanical", // Clockwork / construct
  "magical", // Purely magical space
]);
export type LairType = z.infer<typeof LairTypeSchema>;

export const LairPhaseSchema = z.enum([
  "dormant", // Unaware of intrusion
  "aware", // Suspects something
  "alert", // Knows intruders present
  "hunting", // Actively searching
  "lockdown", // Full defensive mode
  "desperate", // Boss threatened, all-out
  "defeated", // Lair neutralized
]);
export type LairPhase = z.infer<typeof LairPhaseSchema>;

// ============================================
// THE LAIR ENTITY
// ============================================

export const LairSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  type: LairTypeSchema,
  description: z.string().optional(),

  // The Boss (if any)
  boss: z
    .object({
      creatureId: z.string().uuid().optional(),
      name: z.string(),
      isPresent: z.boolean().default(true),
      location: z.string().optional(), // Room/area ID

      // Boss empowers the lair
      empowermentActive: z.boolean().default(true),
      empowermentEffects: z.array(z.string()).default([]),

      // When boss dies, lair weakens
      onBossDefeated: z
        .object({
          disableLairActions: z.boolean().default(true),
          disableRegionalEffects: z.boolean().default(false),
          alertLevelDrop: z.number().int().default(2),
          moralePenalty: z.number().int().default(3),
        })
        .optional(),
    })
    .optional(),

  // Current State
  phase: LairPhaseSchema.default("dormant"),
  alertLevel: z.number().int().min(0).max(10).default(0),

  // Alert thresholds
  alertThresholds: z.object({
    aware: z.number().int().default(2), // Phase changes at these levels
    alert: z.number().int().default(4),
    hunting: z.number().int().default(6),
    lockdown: z.number().int().default(8),
    desperate: z.number().int().default(10),
  }),

  // Resources
  resources: z.object({
    // Reinforcements
    reinforcementsAvailable: z.number().int().default(0),
    reinforcementType: z.string().optional(),
    reinforcementDelay: z.number().int().default(3), // Rounds to arrive

    // Alarms
    alarmsTriggered: z.number().int().default(0),
    maxAlarms: z.number().int().default(3),

    // Special resources
    magicalCharges: z.number().int().optional(),
    trapResets: z.number().int().optional(),
  }),

  // Morale (for intelligent lairs)
  morale: z
    .object({
      current: z.number().int().min(0).max(10).default(7),
      breakPoint: z.number().int().default(3), // Below this, defenders flee/surrender
      modifiers: z
        .array(
          z.object({
            source: z.string(),
            value: z.number().int(),
          }),
        )
        .default([]),
    })
    .optional(),

  // Layout
  layout: z.object({
    // Rooms/Areas
    rooms: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          type: z.enum([
            "entrance",
            "corridor",
            "chamber",
            "boss_room",
            "trap_room",
            "treasure_room",
            "barracks",
            "shrine",
            "prison",
            "armory",
            "kitchen",
            "storage",
            "secret",
            "junction",
            "hazard",
            "safe",
          ]),

          // Grid reference (if using grid)
          gridArea: z
            .object({
              topLeft: CoordSchema,
              bottomRight: CoordSchema,
            })
            .optional(),

          // Connections
          connections: z
            .array(
              z.object({
                toRoomId: z.string().uuid(),
                doorType: z.enum([
                  "open",
                  "door",
                  "locked",
                  "barred",
                  "secret",
                  "trapped",
                  "magical",
                ]),
                lockDC: z.number().int().optional(),
                trapId: z.string().uuid().optional(),
              }),
            )
            .default([]),

          // Room state
          discovered: z.boolean().default(false),
          cleared: z.boolean().default(false),
          currentOccupants: z.array(z.string().uuid()).default([]),

          // Room-specific effects
          localEffects: z.array(z.string()).default([]),
        }),
      )
      .default([]),

    // Current party location
    partyLocation: z.string().uuid().optional(),
  }),

  // Lair Actions
  lairActions: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),

        // When it can be used
        requirements: z
          .object({
            minPhase: LairPhaseSchema.optional(),
            minAlertLevel: z.number().int().optional(),
            bossAlive: z.boolean().optional(),
            roomTypes: z.array(z.string()).optional(), // Only in certain rooms
            cooldown: z.number().int().optional(), // Rounds between uses
            usesPerDay: z.number().int().optional(),
          })
          .optional(),

        // Effect
        effect: z.object({
          type: z.enum([
            "damage", // Deal damage
            "condition", // Apply condition
            "terrain", // Change terrain
            "summon", // Bring reinforcements
            "environmental", // Trigger hazard
            "movement", // Force movement
            "isolation", // Separate party
            "darkness", // Extinguish light
            "alarm", // Raise alert
            "trap", // Activate trap
            "heal", // Heal defenders
            "buff", // Buff defenders
            "debuff", // Debuff party
          ]),

          // Targeting
          targetType: z.enum([
            "all_enemies",
            "random_enemy",
            "area",
            "room",
            "single",
          ]),
          targetCount: z.number().int().optional(),
          areaSize: z.number().int().optional(),

          // Damage (if applicable)
          damage: z
            .object({
              dice: z.string(),
              type: DamageTypeSchema,
              saveDC: z.number().int().optional(),
              saveType: z.string().optional(),
              halfOnSave: z.boolean().default(true),
            })
            .optional(),

          // Condition (if applicable)
          condition: z
            .object({
              type: ConditionSchema,
              duration: z.string(),
              saveDC: z.number().int().optional(),
              saveType: z.string().optional(),
            })
            .optional(),

          // Description of what happens
          narrative: z.string(),
        }),

        // Tracking
        lastUsedRound: z.number().int().optional(),
        usesToday: z.number().int().default(0),
        enabled: z.boolean().default(true),
      }),
    )
    .default([]),

  // Regional Effects
  regionalEffects: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),

        // Scope
        scope: z.enum(["entire_lair", "near_boss", "specific_rooms", "radius"]),
        affectedRooms: z.array(z.string().uuid()).optional(),
        radiusMiles: z.number().optional(),

        // Effect
        effect: z.object({
          type: z.string(),
          mechanicalEffect: z.string().optional(),
          narrativeEffect: z.string(),
        }),

        // Conditions
        requiresBossAlive: z.boolean().default(true),
        minPhase: LairPhaseSchema.optional(),

        enabled: z.boolean().default(true),
      }),
    )
    .default([]),

  // Traps
  traps: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),

        // Location
        roomId: z.string().uuid().optional(),
        position: CoordSchema.optional(),

        // Detection
        detectionDC: z.number().int(),
        detectedBy: z.array(z.string().uuid()).default([]),

        // Disarm
        disarmDC: z.number().int().optional(),
        disarmed: z.boolean().default(false),
        disarmMethod: z.string().optional(),

        // Trigger
        trigger: z.object({
          type: z.enum([
            "pressure_plate",
            "tripwire",
            "proximity",
            "touch",
            "open",
            "magic",
            "timed",
            "manual",
          ]),
          description: z.string(),
        }),

        // Effect
        effect: z.object({
          attackBonus: z.number().int().optional(),
          saveDC: z.number().int().optional(),
          saveType: z.string().optional(),
          damage: z
            .object({
              dice: z.string(),
              type: DamageTypeSchema,
            })
            .optional(),
          condition: ConditionSchema.optional(),
          conditionDuration: z.string().optional(),
          additionalEffect: z.string().optional(),
          areaOfEffect: z
            .object({
              shape: z.enum(["sphere", "cube", "cone", "line", "cylinder"]),
              size: z.number().int(),
            })
            .optional(),
        }),

        // State
        triggered: z.boolean().default(false),

        // Reset
        canReset: z.boolean().default(true),
        resetTime: z.string().optional(), // "1 round", "1 minute", "manual"
        autoReset: z.boolean().default(false),
      }),
    )
    .default([]),

  // Patrols
  patrols: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),

        // Composition
        members: z.array(
          z.object({
            creatureId: z.string().uuid().optional(),
            name: z.string(),
            type: z.string(),
          }),
        ),

        // Route
        route: z.array(
          z.object({
            roomId: z.string().uuid(),
            duration: z.number().int(), // Rounds spent here
            action: z.string().optional(), // "guard", "search", "rest"
          }),
        ),

        // Current state
        currentRouteIndex: z.number().int().default(0),
        roundsAtCurrentStop: z.number().int().default(0),

        // Behavior
        behavior: z.object({
          onAlert: z.enum([
            "investigate",
            "reinforce_boss",
            "hold_position",
            "sound_alarm",
          ]),
          onCombat: z.enum(["fight", "flee", "call_reinforcements"]),
          perceptionBonus: z.number().int().default(0),
        }),

        // Status
        status: z
          .enum([
            "patrolling",
            "investigating",
            "combat",
            "returning",
            "eliminated",
          ])
          .default("patrolling"),
        alerted: z.boolean().default(false),
      }),
    )
    .default([]),

  // Environmental Hazards
  hazards: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),

        // Location
        roomId: z.string().uuid().optional(),
        cells: z.array(CoordSchema).optional(),

        // Type
        type: z.enum([
          "fire",
          "cold",
          "acid",
          "poison",
          "lightning",
          "necrotic",
          "radiant",
          "psychic",
          "force",
          "falling",
          "crushing",
          "drowning",
          "suffocation",
          "magical",
          "divine",
          "eldritch",
        ]),

        // Behavior
        behavior: z.enum([
          "constant", // Always active
          "periodic", // Activates on schedule
          "triggered", // Activates on condition
          "reactive", // Reacts to actions
          "random", // Random activation
        ]),

        // Periodic timing
        period: z.number().int().optional(), // Every N rounds
        nextActivation: z.number().int().optional(),

        // Effect
        effect: z.object({
          saveDC: z.number().int().optional(),
          saveType: z.string().optional(),
          damage: z
            .object({
              dice: z.string(),
              type: DamageTypeSchema,
            })
            .optional(),
          condition: ConditionSchema.optional(),
          movement: z
            .object({
              direction: z.string(),
              distance: z.number().int(),
            })
            .optional(),
          narrative: z.string(),
        }),

        // State
        active: z.boolean().default(true),
        canBeDisabled: z.boolean().default(false),
        disableMethod: z.string().optional(),
      }),
    )
    .default([]),

  // Secrets
  secrets: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),

        // Location
        roomId: z.string().uuid().optional(),
        position: CoordSchema.optional(),

        // Discovery
        discoveryMethod: z.enum([
          "perception",
          "investigation",
          "interaction",
          "magic",
          "puzzle",
          "key",
          "automatic",
        ]),
        discoveryDC: z.number().int().optional(),
        clues: z.array(z.string()).default([]),

        // What it reveals
        reveals: z.object({
          type: z.enum([
            "secret_door",
            "hidden_treasure",
            "shortcut",
            "trap_bypass",
            "lore",
            "weakness",
            "safe_room",
          ]),
          content: z.string(),
          mechanicalBenefit: z.string().optional(),
        }),

        // State
        discovered: z.boolean().default(false),
        discoveredBy: z.array(z.string().uuid()).default([]),
      }),
    )
    .default([]),

  // Lair's Memory / Learning
  memory: z.object({
    // What the lair knows about the party
    knownPartyMembers: z
      .array(
        z.object({
          characterId: z.string().uuid(),
          name: z.string(),
          lastSeenRoom: z.string().uuid().optional(),
          knownAbilities: z.array(z.string()).default([]),
          threatLevel: z
            .enum(["unknown", "low", "medium", "high", "extreme"])
            .default("unknown"),
        }),
      )
      .default([]),

    // Tactics that have been used against it
    observedTactics: z
      .array(
        z.object({
          tactic: z.string(),
          counter: z.string().optional(),
          timesUsed: z.number().int().default(1),
        }),
      )
      .default([]),

    // Rooms that have been breached
    breachedRooms: z.array(z.string().uuid()).default([]),

    // Defenses that have been bypassed
    bypassedDefenses: z.array(z.string().uuid()).default([]),
  }),

  // AI Behavior Settings
  behavior: z.object({
    // Aggression
    aggression: z.number().int().min(0).max(10).default(5),

    // Intelligence (how smart are the defenders?)
    intelligence: z
      .enum(["mindless", "animal", "low", "average", "high", "genius"])
      .default("average"),

    // Coordination (how well do defenders work together?)
    coordination: z.number().int().min(0).max(10).default(5),

    // Adaptation (how quickly does it learn?)
    adaptation: z.number().int().min(0).max(10).default(5),

    // Priorities
    priorities: z
      .array(
        z.enum([
          "protect_boss",
          "protect_treasure",
          "eliminate_intruders",
          "raise_alarm",
          "delay_intruders",
          "capture_alive",
        ]),
      )
      .default(["protect_boss", "eliminate_intruders"]),
  }),
});
export type Lair = z.infer<typeof LairSchema>;

// ============================================
// LAIR ACTION SELECTION
// ============================================

export const LairActionSelectionSchema = z.object({
  lairId: z.string().uuid(),
  round: z.number().int(),

  // Context for AI decision
  context: z.object({
    currentPhase: LairPhaseSchema,
    alertLevel: z.number().int(),
    bossAlive: z.boolean(),
    bossHP: z.number().int().optional(),

    // Party state
    partyLocations: z.array(
      z.object({
        characterId: z.string().uuid(),
        roomId: z.string().uuid(),
        hp: z.number().int(),
        conditions: z.array(z.string()),
      }),
    ),

    // Recent events
    recentDamageToLair: z.number().int(),
    defendersKilled: z.number().int(),
    roundsInCombat: z.number().int(),
  }),

  // Available actions (filtered by requirements)
  availableActions: z.array(
    z.object({
      actionId: z.string().uuid(),
      name: z.string(),
      effectType: z.string(),
      priority: z.number().int(), // AI-calculated priority
    }),
  ),

  // Selected action
  selectedActionId: z.string().uuid().optional(),
  selectedActionReason: z.string().optional(),
});
export type LairActionSelection = z.infer<typeof LairActionSelectionSchema>;

// ============================================
// ALERT EVENTS
// ============================================

export const AlertEventSchema = z.object({
  id: z.string().uuid(),
  lairId: z.string().uuid(),

  // What caused it
  eventType: z.enum([
    "noise", // Loud combat, spell, etc.
    "alarm_triggered", // Magical or mechanical alarm
    "patrol_missing", // Patrol didn't check in
    "body_found", // Found dead defender
    "intruder_spotted", // Direct visual
    "trap_triggered", // Trap went off
    "magic_detected", // Magical intrusion detected
    "door_breached", // Forced entry
    "prisoner_escaped", // Prisoner(s) freed
    "treasure_stolen", // Theft detected
  ]),

  // Details
  description: z.string(),
  location: z.string().uuid().optional(),

  // Alert change
  alertIncrease: z.number().int(),
  newAlertLevel: z.number().int(),
  phaseChange: LairPhaseSchema.optional(),

  // Response triggered
  responseTriggered: z.object({
    reinforcements: z.boolean().default(false),
    patrolsAlerted: z.boolean().default(false),
    lockdown: z.boolean().default(false),
    bossNotified: z.boolean().default(false),
  }),

  timestamp: z.date(),
  round: z.number().int().optional(),
});
export type AlertEvent = z.infer<typeof AlertEventSchema>;

// ============================================
// LAIR TURN (What happens on initiative 20)
// ============================================

export const LairTurnSchema = z.object({
  lairId: z.string().uuid(),
  round: z.number().int(),

  // Lair action taken
  lairAction: z
    .object({
      actionId: z.string().uuid(),
      name: z.string(),
      description: z.string(),

      // Results
      targetsAffected: z.array(
        z.object({
          characterId: z.string().uuid(),
          name: z.string(),
          effect: z.string(),
          damage: z.number().int().optional(),
          conditionApplied: z.string().optional(),
          saved: z.boolean().optional(),
        }),
      ),

      narrativeResult: z.string(),
    })
    .optional(),

  // Hazards that activated
  hazardsActivated: z
    .array(
      z.object({
        hazardId: z.string().uuid(),
        name: z.string(),
        effect: z.string(),
        targetsAffected: z.array(z.string()),
      }),
    )
    .default([]),

  // Patrols that moved
  patrolMovements: z
    .array(
      z.object({
        patrolId: z.string().uuid(),
        fromRoom: z.string().uuid(),
        toRoom: z.string().uuid(),
        detected: z.boolean(),
      }),
    )
    .default([]),

  // Traps that reset
  trapsReset: z.array(z.string().uuid()).default([]),

  // Reinforcements arriving
  reinforcementsArriving: z
    .object({
      arriving: z.boolean(),
      count: z.number().int().optional(),
      type: z.string().optional(),
      location: z.string().uuid().optional(),
    })
    .optional(),

  // Regional effects active
  activeRegionalEffects: z.array(z.string()).default([]),
});
export type LairTurn = z.infer<typeof LairTurnSchema>;

// ============================================
// LAIR AI PROMPT
// ============================================

export function buildLairActionPrompt(
  lair: Lair,
  combatContext: {
    round: number;
    partyPositions: Array<{
      name: string;
      room: string;
      hp: number;
      maxHp: number;
      conditions: string[];
      recentActions: string[];
    }>;
    defenderStatus: Array<{
      name: string;
      room: string;
      hp: number;
      maxHp: number;
      status: string;
    }>;
    recentEvents: string[];
  },
): string {
  const availableActions = lair.lairActions.filter((a) => {
    if (!a.enabled) return false;
    if (
      a.requirements?.minPhase &&
      getLairPhaseOrder(lair.phase) < getLairPhaseOrder(a.requirements.minPhase)
    )
      return false;
    if (
      a.requirements?.minAlertLevel &&
      lair.alertLevel < a.requirements.minAlertLevel
    )
      return false;
    if (a.requirements?.bossAlive && !lair.boss?.isPresent) return false;
    if (
      a.requirements?.cooldown &&
      a.lastUsedRound &&
      combatContext.round - a.lastUsedRound < a.requirements.cooldown
    )
      return false;
    if (a.requirements?.usesPerDay && a.usesToday >= a.requirements.usesPerDay)
      return false;
    return true;
  });

  return `
# LAIR ACTION SELECTION: ${lair.name}

You are the intelligence behind this ${lair.type}. Select the most effective lair action for this round.

## LAIR STATUS
Phase: ${lair.phase}
Alert Level: ${lair.alertLevel}/10
Boss: ${lair.boss?.name ?? "None"} (${lair.boss?.isPresent ? "Present" : "Absent"})
Morale: ${lair.morale?.current ?? "N/A"}/10
Reinforcements Available: ${lair.resources.reinforcementsAvailable}

## BEHAVIOR PROFILE
Intelligence: ${lair.behavior.intelligence}
Aggression: ${lair.behavior.aggression}/10
Coordination: ${lair.behavior.coordination}/10
Adaptation: ${lair.behavior.adaptation}/10
Priorities: ${lair.behavior.priorities.join(", ")}

## COMBAT - ROUND ${combatContext.round}

### INTRUDERS
${combatContext.partyPositions
  .map(
    (p) =>
      `- ${p.name}: ${p.room}, HP ${p.hp}/${p.maxHp}, ${p.conditions.length ? p.conditions.join(", ") : "no conditions"}
   Recent: ${p.recentActions.join(", ")}`,
  )
  .join("\n")}

### DEFENDERS
${combatContext.defenderStatus
  .map((d) => `- ${d.name}: ${d.room}, HP ${d.hp}/${d.maxHp}, ${d.status}`)
  .join("\n")}

### RECENT EVENTS
${combatContext.recentEvents.map((e) => `- ${e}`).join("\n")}

## AVAILABLE LAIR ACTIONS

${availableActions
  .map(
    (a, i) => `
${i + 1}. **${a.name}**
   Effect: ${a.effect.type} - ${a.effect.narrative}
   Target: ${a.effect.targetType}${a.effect.damage ? `, Damage: ${a.effect.damage.dice} ${a.effect.damage.type}` : ""}
`,
  )
  .join("\n")}

## WHAT THE LAIR KNOWS
- Known party members: ${lair.memory.knownPartyMembers.map((m) => `${m.name} (${m.threatLevel})`).join(", ")}
- Observed tactics: ${lair.memory.observedTactics.map((t) => t.tactic).join(", ")}
- Breached rooms: ${lair.memory.breachedRooms.length}

## YOUR TASK

Select the best lair action based on:
1. Current priorities (${lair.behavior.priorities.join(" > ")})
2. Party positions and vulnerabilities
3. Defender status and needs
4. What would be most dramatic/effective

Provide:
1. Which action to use
2. How to target it (if applicable)
3. Narrative description of what happens
4. Why this choice fits the lair's intelligence and goals
`.trim();
}

// Helper function for phase ordering
function getLairPhaseOrder(phase: LairPhase): number {
  const order: Record<LairPhase, number> = {
    dormant: 0,
    aware: 1,
    alert: 2,
    hunting: 3,
    lockdown: 4,
    desperate: 5,
    defeated: 6,
  };
  return order[phase];
}

// ============================================
// STANDARD LAIR ACTIONS
// ============================================

export const StandardLairActions = {
  // Dragon Lair
  dragonLair: [
    {
      name: "Magma Eruption",
      description: "Magma erupts from a point on the ground",
      effect: {
        type: "damage" as const,
        targetType: "area" as const,
        areaSize: 20,
        damage: {
          dice: "6d6",
          type: "fire" as const,
          saveDC: 15,
          saveType: "DEX",
          halfOnSave: true,
        },
        narrative: "The ground cracks and molten rock surges upward!",
      },
    },
    {
      name: "Volcanic Gas",
      description: "Poisonous gas vents from fissures",
      effect: {
        type: "condition" as const,
        targetType: "room" as const,
        condition: {
          type: "poisoned" as const,
          duration: "1 round",
          saveDC: 13,
          saveType: "CON",
        },
        narrative: "Sulfurous gas billows through the chamber!",
      },
    },
    {
      name: "Tremor",
      description: "The ground shakes violently",
      effect: {
        type: "movement" as const,
        targetType: "all_enemies" as const,
        condition: {
          type: "prone" as const,
          duration: "instant",
          saveDC: 15,
          saveType: "DEX",
        },
        narrative:
          "The entire cavern shudders as the dragon's presence stirs the earth!",
      },
    },
  ],

  // Undead Crypt
  undeadCrypt: [
    {
      name: "Grasp of the Grave",
      description: "Skeletal hands reach from the ground",
      effect: {
        type: "condition" as const,
        targetType: "area" as const,
        areaSize: 10,
        condition: {
          type: "restrained" as const,
          duration: "1 round",
          saveDC: 13,
          saveType: "STR",
        },
        narrative: "Bony hands burst from the floor, grasping at the living!",
      },
    },
    {
      name: "Deathly Chill",
      description: "Supernatural cold fills the area",
      effect: {
        type: "damage" as const,
        targetType: "room" as const,
        damage: {
          dice: "3d6",
          type: "cold" as const,
          saveDC: 12,
          saveType: "CON",
          halfOnSave: true,
        },
        narrative: "An unnatural cold seeps into your bones...",
      },
    },
    {
      name: "Rise Again",
      description: "Fallen undead reanimate",
      effect: {
        type: "summon" as const,
        targetType: "room" as const,
        narrative: "The destroyed undead begin to stir once more!",
      },
    },
  ],

  // Thieves Guild
  thievesGuild: [
    {
      name: "Hidden Crossbows",
      description: "Concealed crossbows fire",
      effect: {
        type: "damage" as const,
        targetType: "random_enemy" as const,
        targetCount: 2,
        damage: { dice: "2d6", type: "piercing" as const },
        narrative: "Click! Hidden crossbows fire from the walls!",
      },
    },
    {
      name: "Smoke Screen",
      description: "Smoke bombs fill the room",
      effect: {
        type: "terrain" as const,
        targetType: "room" as const,
        narrative: "Smoke bombs burst, filling the room with obscuring fog!",
      },
    },
    {
      name: "Escape Routes",
      description: "Thieves vanish through secret passages",
      effect: {
        type: "movement" as const,
        targetType: "room" as const,
        narrative:
          "Several thieves slip through hidden passages, repositioning!",
      },
    },
  ],

  // Elemental Temple
  elementalTemple: [
    {
      name: "Elemental Surge",
      description: "Raw elemental energy cascades through the area",
      effect: {
        type: "damage" as const,
        targetType: "all_enemies" as const,
        damage: {
          dice: "4d8",
          type: "force" as const,
          saveDC: 14,
          saveType: "DEX",
          halfOnSave: true,
        },
        narrative: "The temple channels raw elemental fury!",
      },
    },
    {
      name: "Planar Instability",
      description: "Reality warps and shifts",
      effect: {
        type: "movement" as const,
        targetType: "random_enemy" as const,
        targetCount: 1,
        narrative: "Space folds and a party member is teleported!",
      },
    },
  ],
};

// ============================================
// STANDARD TRAPS
// ============================================

export const StandardTraps = [
  {
    name: "Pit Trap",
    detectionDC: 12,
    disarmDC: 10,
    trigger: {
      type: "pressure_plate" as const,
      description: "Weight on false floor",
    },
    effect: {
      saveDC: 12,
      saveType: "DEX",
      damage: { dice: "2d6", type: "bludgeoning" as const },
      additionalEffect: "Fall 20 feet into pit",
    },
    canReset: false,
  },
  {
    name: "Poison Dart",
    detectionDC: 15,
    disarmDC: 13,
    trigger: { type: "tripwire" as const, description: "Wire across passage" },
    effect: {
      attackBonus: 6,
      damage: { dice: "1d4", type: "piercing" as const },
      condition: "poisoned" as const,
      conditionDuration: "1 hour (DC 13 CON)",
    },
    canReset: true,
    autoReset: true,
    resetTime: "1 minute",
  },
  {
    name: "Scything Blade",
    detectionDC: 14,
    disarmDC: 15,
    trigger: {
      type: "pressure_plate" as const,
      description: "Pressure plate in floor",
    },
    effect: {
      attackBonus: 8,
      damage: { dice: "4d6", type: "slashing" as const },
    },
    canReset: true,
    resetTime: "1 round",
  },
  {
    name: "Fire Trap",
    detectionDC: 15,
    disarmDC: 14,
    trigger: {
      type: "touch" as const,
      description: "Opening the trapped object",
    },
    effect: {
      saveDC: 14,
      saveType: "DEX",
      damage: { dice: "5d6", type: "fire" as const },
      areaOfEffect: { shape: "sphere" as const, size: 20 },
    },
    canReset: false,
  },
  {
    name: "Glyph of Warding",
    detectionDC: 16,
    disarmDC: 16,
    trigger: {
      type: "magic" as const,
      description: "Creature enters area or touches object",
    },
    effect: {
      saveDC: 15,
      saveType: "DEX",
      damage: { dice: "5d8", type: "lightning" as const },
      areaOfEffect: { shape: "sphere" as const, size: 20 },
    },
    canReset: false,
  },
];

// ============================================
// GM LAIR CONTROL PANEL
// ============================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏰 LAIR CONTROL: The Sunken Temple                            Initiative 20│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STATUS                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Phase: 🟡 ALERT          Alert: ████████░░ 8/10        Round: 5    │    │
│  │ Boss: Aboleth (Present)  Morale: ██████░░░░ 6/10                    │    │
│  │ Reinforcements: 3 ready  Next arrival: 2 rounds                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  LAIR ACTIONS (Choose one)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ○ Psychic Torment - 3d6 psychic to all in Chamber of Whispers       │    │
│  │ ● Flood Chamber - Fill room with water, STR 15 or pushed            │    │
│  │ ○ Summon Spawn - Bring 2 chuul from the depths (3 round delay)      │    │
│  │ ○ Dominate - Attempt to dominate weakest party member               │    │
│  │                                                                     │    │
│  │ [Execute Selected] [Skip Lair Action] [AI Suggest]                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ACTIVE HAZARDS                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ⚡ Flooded Floor (Entrance)    - Difficult terrain, lightning risk  │    │
│  │ 🔥 Bioluminescent Spores (Lab) - DC 12 CON or poisoned (active)     │    │
│  │ ❄️ Aboleth Mucus (All)         - DC 14 CON or can't breathe air     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  PATROLS                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🔴 Patrol A (2 Chuul)     - COMBAT in Chamber of Whispers           │    │
│  │ 🟡 Patrol B (3 Kuo-toa)   - INVESTIGATING noise in Lab             │    │
│  │ 🟢 Patrol C (1 Chuul)     - PATROLLING, 2 rooms from party         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  TRAPS                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Entrance Pit - TRIGGERED (Kira fell in)                           │    │
│  │ ⚠ Glyph at Altar - DETECTED by Theron                               │    │
│  │ ○ Poison Needles (Chest) - Ready                                    │    │
│  │ ○ Flooding Corridor - Ready (trigger: alarm at shrine)              │    │
│  │                                                                     │    │
│  │ [Trigger Trap] [Reset Trap] [Disable Trap]                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  QUICK ACTIONS                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ [+1 Alert] [-1 Alert] [Call Reinforcements] [Sound Alarm]           │    │
│  │ [Lockdown] [Boss Aware] [Morale Check] [Advance Phase]              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
*/
