import { z } from "zod";

// ============================================
// PUZZLE SYSTEM
// ============================================
//
// Philosophy: PUZZLES SHOULD BE FUN, NOT FRUSTRATING
//
// Problems with traditional TTRPG puzzles:
//   - GM describes, players imagine differently
//   - No feedback on progress
//   - Binary: solved or stuck
//   - One player solves, others watch
//   - Easy to softlock the session
//
// Our solution:
//   - Visual, interactive puzzles
//   - State tracking (what's been tried)
//   - Progressive hints (earned, not given)
//   - Partial progress rewarded
//   - Multiple solution paths
//   - The puzzle teaches itself
//   - Everyone can participate
//

// ============================================
// PUZZLE TYPES
// ============================================

export const PuzzleTypeSchema = z.enum([
  // Combination/Lock
  "combination_lock", // Enter correct sequence (numbers, symbols)
  "pattern_lock", // Trace correct pattern
  "key_lock", // Find/use correct key(s)

  // Sequence
  "sequence", // Do things in correct order
  "simon_says", // Repeat pattern that grows
  "musical", // Play correct notes/melody

  // Spatial
  "tile_slide", // Slide tiles to form image/pattern
  "rotation", // Rotate pieces to align
  "jigsaw", // Assemble pieces
  "tangram", // Fit shapes into outline
  "maze", // Navigate path
  "mirror_beam", // Direct light/energy beams

  // Logic
  "logic_grid", // Deduce who/what/where
  "truth_liar", // Figure out who lies
  "balance_scale", // Deduce weights
  "circuit", // Connect power flow

  // Word/Symbol
  "riddle", // Answer a riddle
  "cipher", // Decode message
  "anagram", // Rearrange letters
  "rebus", // Picture = word puzzle
  "rune_translation", // Translate symbols

  // Physical (in-world)
  "pressure_plates", // Weight/position puzzle
  "lever_combination", // Correct lever positions
  "statue_positioning", // Move statues to positions
  "element_mixing", // Combine elements correctly
  "color_mixing", // Mix colors to target

  // Meta
  "multi_stage", // Puzzle with multiple phases
  "cooperative", // Requires multiple players
  "timed", // Must solve under pressure
  "custom", // GM-defined special puzzle
]);
export type PuzzleType = z.infer<typeof PuzzleTypeSchema>;

export const PuzzleDifficultySchema = z.enum([
  "trivial", // Solvable in 1-2 minutes
  "easy", // 5-10 minutes, obvious hints
  "medium", // 10-20 minutes, requires thought
  "hard", // 20-30 minutes, multiple steps
  "expert", // 30+ minutes, complex logic
  "legendary", // Session-spanning, major reward
]);
export type PuzzleDifficulty = z.infer<typeof PuzzleDifficultySchema>;

// ============================================
// PUZZLE ELEMENT (Interactive component)
// ============================================

export const PuzzleElementTypeSchema = z.enum([
  // Input
  "button", // Clickable button
  "lever", // On/off or multi-position
  "dial", // Rotatable dial
  "slider", // Sliding value
  "input_field", // Text/number input
  "keypad", // Number/symbol pad

  // Moveable
  "draggable", // Can be dragged
  "rotatable", // Can be rotated
  "tile", // Slideable tile
  "piece", // Jigsaw piece

  // Display
  "indicator", // Shows state (light, gauge)
  "display", // Shows text/number
  "image", // Static or dynamic image
  "symbol", // Rune/glyph
  "beam", // Light/energy beam

  // Container
  "slot", // Accepts draggables
  "grid", // Grid of cells
  "track", // Path for movement

  // Feedback
  "sound_emitter", // Plays sound on interaction
  "particle_emitter", // Visual effect
]);
export type PuzzleElementType = z.infer<typeof PuzzleElementTypeSchema>;

export const PuzzleElementSchema = z.object({
  id: z.string(),
  type: PuzzleElementTypeSchema,

  // Position & Size
  position: z.object({
    x: z.number(), // Percentage or pixels
    y: z.number(),
    unit: z.enum(["%", "px"]).default("%"),
  }),
  size: z
    .object({
      width: z.number(),
      height: z.number(),
      unit: z.enum(["%", "px"]).default("%"),
    })
    .optional(),

  // Appearance
  appearance: z
    .object({
      // Image-based
      image: z.string().optional(),
      imageStates: z.record(z.string(), z.string()).optional(), // state -> image URL

      // Style-based
      backgroundColor: z.string().optional(),
      borderColor: z.string().optional(),
      borderWidth: z.number().optional(),
      borderRadius: z.number().optional(),

      // Text
      text: z.string().optional(),
      textColor: z.string().optional(),
      fontSize: z.number().optional(),

      // Symbol/Icon
      symbol: z.string().optional(),
      symbolFont: z.string().optional(),

      // Visibility
      visible: z.boolean().default(true),
      opacity: z.number().min(0).max(1).default(1),

      // Animation
      animation: z
        .enum(["none", "pulse", "glow", "shake", "spin", "bounce"])
        .optional(),
    })
    .optional(),

  // Current state
  state: z
    .object({
      value: z
        .union([z.string(), z.number(), z.boolean(), z.array(z.any())])
        .optional(),
      position: z.object({ x: z.number(), y: z.number() }).optional(), // For draggables
      rotation: z.number().optional(), // Degrees
      active: z.boolean().optional(),
      locked: z.boolean().default(false),
      correctlyPlaced: z.boolean().optional(), // For validation feedback
    })
    .default({}),

  // Interaction rules
  interaction: z
    .object({
      draggable: z.boolean().default(false),
      rotatable: z.boolean().default(false),
      clickable: z.boolean().default(true),

      // Drag constraints
      dragBounds: z
        .object({
          minX: z.number().optional(),
          maxX: z.number().optional(),
          minY: z.number().optional(),
          maxY: z.number().optional(),
        })
        .optional(),
      snapToGrid: z
        .object({
          cellWidth: z.number(),
          cellHeight: z.number(),
        })
        .optional(),
      snapToSlots: z.array(z.string()).optional(), // Slot IDs it can snap to

      // Click behavior
      onClick: z
        .object({
          action: z.enum([
            "toggle",
            "cycle",
            "increment",
            "emit_event",
            "custom",
          ]),
          values: z.array(z.any()).optional(), // For cycle
          event: z.string().optional(), // For emit_event
        })
        .optional(),

      // Rotation constraints
      rotationSteps: z.number().optional(), // e.g., 4 = 90° increments
    })
    .optional(),

  // Connections (for circuits, beams, etc.)
  connections: z
    .object({
      inputs: z.array(z.string()).optional(), // Element IDs that feed into this
      outputs: z.array(z.string()).optional(), // Element IDs this feeds into
      connectionPoints: z
        .array(
          z.object({
            id: z.string(),
            position: z.enum(["top", "right", "bottom", "left", "center"]),
            type: z.enum(["in", "out", "both"]),
          }),
        )
        .optional(),
    })
    .optional(),

  // Validation
  validation: z
    .object({
      correctValue: z.any().optional(),
      correctPosition: z.object({ x: z.number(), y: z.number() }).optional(),
      correctRotation: z.number().optional(),
      correctSlot: z.string().optional(),
      tolerance: z.number().optional(), // For position matching
    })
    .optional(),

  // Hints about this element
  hintText: z.string().optional(),

  // GM notes
  gmNotes: z.string().optional(),
});
export type PuzzleElement = z.infer<typeof PuzzleElementSchema>;

// ============================================
// PUZZLE HINT SYSTEM
// ============================================

export const PuzzleHintSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int(), // Hint sequence (1 = first hint)

  // The hint content
  content: z.object({
    text: z.string(),

    // Optional visual hint
    highlightElements: z.array(z.string()).optional(), // Element IDs to highlight
    revealElements: z.array(z.string()).optional(), // Hidden elements to show
    image: z.string().optional(),

    // In-world flavor
    inWorldDescription: z.string().optional(), // "The ghost whispers..."
    source: z.string().optional(), // "Ancient inscription", "Helpful spirit"
  }),

  // How to earn this hint
  unlockCondition: z.object({
    type: z.enum([
      "automatic", // Available immediately
      "time_elapsed", // After X minutes of trying
      "attempts_made", // After X wrong attempts
      "skill_check", // Pass skill check to get hint
      "resource_cost", // Spend gold/item
      "progress_made", // After solving part of puzzle
      "player_request", // When player asks for help
    ]),

    // Condition parameters
    minutes: z.number().int().optional(),
    attempts: z.number().int().optional(),
    skillCheck: z
      .object({
        skill: z.string(),
        dc: z.number().int(),
      })
      .optional(),
    cost: z
      .object({
        type: z.string(),
        amount: z.number(),
      })
      .optional(),
    requiredProgress: z.number().int().optional(), // Percentage
  }),

  // State
  unlocked: z.boolean().default(false),
  revealed: z.boolean().default(false),
  unlockedAt: z.date().optional(),
});
export type PuzzleHint = z.infer<typeof PuzzleHintSchema>;

// ============================================
// PUZZLE SOLUTION
// ============================================

export const PuzzleSolutionSchema = z.object({
  id: z.string().uuid(),

  // Solution type
  type: z.enum([
    "exact_match", // State must match exactly
    "sequence", // Actions in specific order
    "combination", // Specific combination of values
    "pattern", // Elements form pattern
    "expression", // Mathematical or logical
    "keyword", // Specific word/phrase
    "state_condition", // General state check
  ]),

  // Solution data
  solution: z.object({
    // For exact_match
    elementStates: z.record(z.string(), z.any()).optional(),

    // For sequence
    actionSequence: z
      .array(
        z.object({
          elementId: z.string(),
          action: z.string(),
          value: z.any().optional(),
        }),
      )
      .optional(),

    // For combination
    combination: z.array(z.any()).optional(),

    // For keyword
    keyword: z.string().optional(),
    keywordCaseSensitive: z.boolean().default(false),
    keywordAllowPartial: z.boolean().default(false),

    // For expression
    expression: z.string().optional(), // JavaScript expression

    // For custom validation
    customValidator: z.string().optional(), // Function name or code
  }),

  // Alternative solutions (puzzles can have multiple valid solutions)
  isAlternative: z.boolean().default(false),
  alternativeOf: z.string().uuid().optional(),

  // Partial credit
  partialSolutions: z
    .array(
      z.object({
        description: z.string(),
        condition: z.string(), // Expression to check
        progress: z.number().int().min(0).max(100), // Progress percentage
        reward: z.string().optional(),
      }),
    )
    .optional(),
});
export type PuzzleSolution = z.infer<typeof PuzzleSolutionSchema>;

// ============================================
// PUZZLE REWARD
// ============================================

export const PuzzleRewardSchema = z.object({
  // Main reward for solving
  onSolve: z.object({
    // Narrative
    description: z.string(),
    readAloud: z.string().optional(),

    // Mechanical rewards
    xp: z.number().int().optional(),
    loot: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          value: z.number().optional(),
        }),
      )
      .optional(),

    // World effects
    opensPath: z.string().optional(), // Door, passage, etc.
    revealsSecret: z.string().optional(),
    disablesHazard: z.string().optional(),
    triggersEvent: z.string().optional(),

    // State changes
    stateChanges: z.record(z.string(), z.any()).optional(),
  }),

  // Rewards for partial progress
  onPartialProgress: z
    .array(
      z.object({
        progressThreshold: z.number().int(), // Percentage
        description: z.string(),
        reward: z.string().optional(),
      }),
    )
    .optional(),

  // Penalties for failure (optional)
  onFailure: z
    .object({
      description: z.string().optional(),
      damage: z
        .object({
          dice: z.string(),
          type: z.string(),
        })
        .optional(),
      triggersEncounter: z.string().optional(),
      locksOut: z.boolean().default(false),
      lockoutDuration: z.string().optional(),
    })
    .optional(),

  // Bonus for speed/elegance
  bonusConditions: z
    .array(
      z.object({
        condition: z.enum([
          "solved_quickly", // Under time threshold
          "no_hints_used", // Solved without hints
          "first_try", // No wrong attempts
          "all_players", // Everyone contributed
          "elegant_solution", // Found optimal path
        ]),
        threshold: z.number().optional(),
        bonusDescription: z.string(),
        bonusReward: z.string(),
      }),
    )
    .optional(),
});
export type PuzzleReward = z.infer<typeof PuzzleRewardSchema>;

// ============================================
// MAIN PUZZLE SCHEMA
// ============================================

export const PuzzleSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),

  // Identity
  name: z.string(),
  type: PuzzleTypeSchema,
  difficulty: PuzzleDifficultySchema,

  // Description
  description: z.string(), // GM description
  playerDescription: z.string(), // What players see/hear
  flavorText: z.string().optional(), // In-world inscription, etc.

  // Visual layout
  layout: z.object({
    width: z.number(),
    height: z.number(),
    unit: z.enum(["px", "vh", "vw"]).default("px"),

    // Background
    backgroundImage: z.string().optional(),
    backgroundColor: z.string().optional(),

    // Frame/border theme
    theme: z
      .enum([
        "stone",
        "wood",
        "metal",
        "crystal",
        "arcane",
        "organic",
        "mechanical",
        "ethereal",
        "custom",
      ])
      .optional(),

    // Custom CSS
    customCSS: z.string().optional(),
  }),

  // Interactive elements
  elements: z.array(PuzzleElementSchema),

  // Solution(s)
  solutions: z.array(PuzzleSolutionSchema),

  // Hints
  hints: z.array(PuzzleHintSchema),

  // Rewards
  rewards: PuzzleRewardSchema,

  // State tracking
  state: z.object({
    status: z
      .enum([
        "unseen",
        "discovered",
        "attempting",
        "solved",
        "failed",
        "abandoned",
      ])
      .default("unseen"),

    // Progress
    progress: z.number().int().min(0).max(100).default(0),

    // Attempt tracking
    attempts: z.number().int().default(0),
    wrongAttempts: z.number().int().default(0),
    actionsLog: z
      .array(
        z.object({
          timestamp: z.date(),
          playerId: z.string().uuid().optional(),
          elementId: z.string(),
          action: z.string(),
          value: z.any().optional(),
          result: z
            .enum(["neutral", "progress", "correct", "wrong"])
            .optional(),
        }),
      )
      .default([]),

    // Time tracking
    discoveredAt: z.date().optional(),
    startedAt: z.date().optional(),
    solvedAt: z.date().optional(),
    totalTimeSpent: z.number().int().default(0), // Seconds

    // Hint tracking
    hintsUnlocked: z.array(z.string().uuid()).default([]),
    hintsRevealed: z.array(z.string().uuid()).default([]),

    // Who's worked on it
    contributingPlayers: z.array(z.string().uuid()).default([]),
    solvedBy: z.array(z.string().uuid()).optional(),

    // Current element states (runtime)
    elementStates: z.record(z.string(), z.any()).default({}),

    // Undo stack
    undoStack: z
      .array(
        z.object({
          timestamp: z.date(),
          elementId: z.string(),
          previousState: z.any(),
        }),
      )
      .default([]),
  }),

  // Location in game world
  locationId: z.string().uuid().optional(),
  locationDescription: z.string().optional(),

  // Requirements
  requirements: z
    .object({
      minPlayers: z.number().int().optional(),
      requiredItems: z.array(z.string()).optional(),
      prerequisitePuzzles: z.array(z.string().uuid()).optional(),
      skillRequired: z
        .object({
          skill: z.string(),
          dc: z.number().int(),
        })
        .optional(),
    })
    .optional(),

  // Timing
  timeLimit: z.number().int().optional(), // Seconds, 0 = no limit
  timeLimitConsequence: z.string().optional(),

  // GM Controls
  gmControls: z.object({
    canReset: z.boolean().default(true),
    canRevealSolution: z.boolean().default(true),
    canAdjustDifficulty: z.boolean().default(true),
    canBypass: z.boolean().default(true),
  }),

  // Tags for search
  tags: z.array(z.string()).default([]),

  // Created/modified
  createdAt: z.date(),
  modifiedAt: z.date(),
});
export type Puzzle = z.infer<typeof PuzzleSchema>;

// ============================================
// PUZZLE TEMPLATES
// ============================================

export const PuzzleTemplates = {
  // Basic combination lock
  combinationLock: {
    type: "combination_lock" as const,
    difficulty: "easy" as const,
    layout: {
      width: 400,
      height: 300,
      unit: "px" as const,
      theme: "metal" as const,
    },
    elements: [
      {
        id: "dial1",
        type: "dial" as const,
        position: { x: 20, y: 50, unit: "%" as const },
        size: { width: 60, height: 60, unit: "px" as const },
        state: { value: 0 },
        interaction: {
          clickable: true,
          onClick: {
            action: "cycle" as const,
            values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        },
      },
      {
        id: "dial2",
        type: "dial" as const,
        position: { x: 40, y: 50, unit: "%" as const },
        size: { width: 60, height: 60, unit: "px" as const },
        state: { value: 0 },
        interaction: {
          clickable: true,
          onClick: {
            action: "cycle" as const,
            values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        },
      },
      {
        id: "dial3",
        type: "dial" as const,
        position: { x: 60, y: 50, unit: "%" as const },
        size: { width: 60, height: 60, unit: "px" as const },
        state: { value: 0 },
        interaction: {
          clickable: true,
          onClick: {
            action: "cycle" as const,
            values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        },
      },
      {
        id: "dial4",
        type: "dial" as const,
        position: { x: 80, y: 50, unit: "%" as const },
        size: { width: 60, height: 60, unit: "px" as const },
        state: { value: 0 },
        interaction: {
          clickable: true,
          onClick: {
            action: "cycle" as const,
            values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
          },
        },
      },
    ],
  },

  // Lever puzzle (binary)
  leverPuzzle: {
    type: "lever_combination" as const,
    difficulty: "medium" as const,
    layout: {
      width: 600,
      height: 200,
      unit: "px" as const,
      theme: "stone" as const,
    },
    elements: [
      {
        id: "lever1",
        type: "lever" as const,
        position: { x: 15, y: 50, unit: "%" as const },
        state: { value: "down" },
      },
      {
        id: "lever2",
        type: "lever" as const,
        position: { x: 30, y: 50, unit: "%" as const },
        state: { value: "down" },
      },
      {
        id: "lever3",
        type: "lever" as const,
        position: { x: 45, y: 50, unit: "%" as const },
        state: { value: "down" },
      },
      {
        id: "lever4",
        type: "lever" as const,
        position: { x: 60, y: 50, unit: "%" as const },
        state: { value: "down" },
      },
      {
        id: "lever5",
        type: "lever" as const,
        position: { x: 75, y: 50, unit: "%" as const },
        state: { value: "down" },
      },
    ],
  },

  // Tile slide (3x3)
  tileSlide3x3: {
    type: "tile_slide" as const,
    difficulty: "medium" as const,
    layout: {
      width: 300,
      height: 300,
      unit: "px" as const,
      theme: "wood" as const,
    },
    // 8 tiles + 1 empty space
    elements: Array.from({ length: 8 }, (_, i) => ({
      id: `tile${i + 1}`,
      type: "tile" as const,
      position: {
        x: (i % 3) * 33.33,
        y: Math.floor(i / 3) * 33.33,
        unit: "%" as const,
      },
      size: { width: 33.33, height: 33.33, unit: "%" as const },
      state: { value: i + 1 },
      interaction: { clickable: true, draggable: false },
    })),
  },

  // Pressure plate puzzle
  pressurePlates: {
    type: "pressure_plates" as const,
    difficulty: "hard" as const,
    layout: {
      width: 500,
      height: 500,
      unit: "px" as const,
      theme: "stone" as const,
    },
    elements: [
      // 3x3 grid of plates
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `plate${i + 1}`,
        type: "button" as const,
        position: {
          x: 20 + (i % 3) * 30,
          y: 20 + Math.floor(i / 3) * 30,
          unit: "%" as const,
        },
        size: { width: 25, height: 25, unit: "%" as const },
        state: { active: false },
        interaction: {
          clickable: true,
          onClick: { action: "toggle" as const },
        },
        appearance: {
          backgroundColor: "#666",
          borderColor: "#444",
        },
      })),
    ],
  },

  // Rune sequence
  runeSequence: {
    type: "sequence" as const,
    difficulty: "medium" as const,
    layout: {
      width: 600,
      height: 300,
      unit: "px" as const,
      theme: "arcane" as const,
    },
    elements: [
      // 6 rune buttons
      ...["fire", "water", "earth", "air", "light", "shadow"].map(
        (rune, i) => ({
          id: `rune_${rune}`,
          type: "button" as const,
          position: { x: 10 + i * 15, y: 60, unit: "%" as const },
          size: { width: 12, height: 20, unit: "%" as const },
          state: { value: rune },
          appearance: {
            symbol: rune,
            backgroundColor: "transparent",
          },
          interaction: {
            clickable: true,
            onClick: {
              action: "emit_event" as const,
              event: `rune_pressed_${rune}`,
            },
          },
        }),
      ),
      // Display showing sequence
      {
        id: "sequence_display",
        type: "display" as const,
        position: { x: 25, y: 15, unit: "%" as const },
        size: { width: 50, height: 15, unit: "%" as const },
        state: { value: [] },
        appearance: {
          backgroundColor: "#1a1a2e",
          borderColor: "#4a4a8a",
        },
      },
    ],
  },

  // Mirror/beam puzzle
  mirrorBeam: {
    type: "mirror_beam" as const,
    difficulty: "hard" as const,
    layout: {
      width: 500,
      height: 500,
      unit: "px" as const,
      theme: "crystal" as const,
    },
    elements: [
      // Light source
      {
        id: "light_source",
        type: "beam" as const,
        position: { x: 5, y: 50, unit: "%" as const },
        state: { active: true, direction: "right" },
        appearance: { backgroundColor: "#ffff00" },
      },
      // Target
      {
        id: "target",
        type: "indicator" as const,
        position: { x: 90, y: 50, unit: "%" as const },
        state: { active: false },
        appearance: { backgroundColor: "#333" },
      },
      // Rotatable mirrors
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `mirror${i + 1}`,
        type: "rotatable" as const,
        position: {
          x: 25 + (i % 2) * 30,
          y: 30 + Math.floor(i / 2) * 40,
          unit: "%" as const,
        },
        size: { width: 10, height: 2, unit: "%" as const },
        state: { rotation: 0 },
        interaction: {
          rotatable: true,
          rotationSteps: 8, // 45° increments
          clickable: true,
        },
        appearance: {
          backgroundColor: "#silver",
          borderColor: "#gold",
        },
      })),
    ],
  },
};

// ============================================
// PUZZLE RENDERER (HTML GENERATION)
// ============================================

export function generatePuzzleHTML(puzzle: Puzzle): string {
  const elements = puzzle.elements
    .map((el) => generateElementHTML(el, puzzle))
    .join("\n");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${puzzle.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #1a1a2e;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }

    .puzzle-container {
      position: relative;
      width: ${puzzle.layout.width}${puzzle.layout.unit};
      height: ${puzzle.layout.height}${puzzle.layout.unit};
      ${puzzle.layout.backgroundImage ? `background-image: url('${puzzle.layout.backgroundImage}');` : ""}
      ${puzzle.layout.backgroundColor ? `background-color: ${puzzle.layout.backgroundColor};` : "background-color: #2d2d44;"}
      background-size: cover;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      overflow: hidden;
    }

    .puzzle-element {
      position: absolute;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    }

    .puzzle-element:hover {
      transform: scale(1.05);
      filter: brightness(1.2);
    }

    .puzzle-element:active {
      transform: scale(0.95);
    }

    .puzzle-element.draggable {
      cursor: grab;
    }

    .puzzle-element.dragging {
      cursor: grabbing;
      z-index: 1000;
      opacity: 0.8;
    }

    .puzzle-element.correct {
      box-shadow: 0 0 20px #00ff00;
    }

    .puzzle-element.wrong {
      animation: shake 0.5s ease;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes glow {
      0%, 100% { box-shadow: 0 0 5px currentColor; }
      50% { box-shadow: 0 0 20px currentColor; }
    }

    .dial {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(145deg, #3d3d5c, #2d2d44);
      border: 3px solid #4a4a6a;
      font-size: 24px;
      font-weight: bold;
      color: #fff;
    }

    .lever {
      width: 30px;
      height: 80px;
      background: linear-gradient(90deg, #555, #888, #555);
      border-radius: 5px;
      position: relative;
    }

    .lever::after {
      content: '';
      position: absolute;
      width: 40px;
      height: 20px;
      background: #c00;
      border-radius: 10px;
      top: 0;
      left: -5px;
      transition: top 0.3s ease;
    }

    .lever.up::after {
      top: 0;
      background: #0c0;
    }

    .lever.down::after {
      top: 60px;
      background: #c00;
    }

    .button-element {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      background: linear-gradient(145deg, #4a4a6a, #3d3d5c);
      border: 2px solid #5a5a7a;
    }

    .button-element.active {
      background: linear-gradient(145deg, #6a6a8a, #5a5a7a);
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
    }

    .tile {
      background: linear-gradient(145deg, #4a4a6a, #3d3d5c);
      border: 2px solid #5a5a7a;
      border-radius: 4px;
      font-size: 28px;
      font-weight: bold;
      color: #fff;
    }

    .indicator {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #333;
      border: 2px solid #555;
    }

    .indicator.active {
      background: #0f0;
      box-shadow: 0 0 20px #0f0;
    }

    .display {
      background: #111;
      border: 2px solid #333;
      border-radius: 4px;
      color: #0f0;
      font-family: monospace;
      font-size: 18px;
      padding: 10px;
    }

    .hint-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      padding: 15px;
      border-radius: 8px;
      color: #fff;
      max-width: 300px;
    }

    .hint-button {
      background: #4a4a8a;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      margin-top: 10px;
    }

    .hint-button:hover {
      background: #5a5a9a;
    }

    .progress-bar {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 10px;
      background: #333;
      border-radius: 5px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #4a4a8a, #8a4a8a);
      transition: width 0.3s ease;
    }

    ${puzzle.layout.customCSS || ""}
  </style>
</head>
<body>
  <div class="progress-bar">
    <div class="progress-bar-fill" style="width: ${puzzle.state.progress}%"></div>
  </div>

  <div class="puzzle-container" id="puzzle">
    ${elements}
  </div>

  <div class="hint-panel" id="hint-panel" style="display: none;">
    <p id="hint-text"></p>
    <button class="hint-button" onclick="requestHint()">Request Hint</button>
  </div>

  <script>
    // Puzzle state
    const puzzleState = ${JSON.stringify(puzzle.state.elementStates)};
    const solutions = ${JSON.stringify(puzzle.solutions.map((s) => s.solution))};
    let progress = ${puzzle.state.progress};
    let hintsRevealed = ${puzzle.state.hintsRevealed.length};

    // Element interaction handlers
    document.querySelectorAll('.puzzle-element').forEach(el => {
      el.addEventListener('click', handleClick);
    });

    function handleClick(e) {
      const elementId = e.currentTarget.dataset.id;
      const elementType = e.currentTarget.dataset.type;
      const action = e.currentTarget.dataset.action;

      switch(action) {
        case 'toggle':
          toggleElement(elementId);
          break;
        case 'cycle':
          cycleElement(elementId, JSON.parse(e.currentTarget.dataset.values || '[]'));
          break;
        case 'increment':
          incrementElement(elementId);
          break;
      }

      checkSolution();
      updateDisplay();
    }

    function toggleElement(id) {
      puzzleState[id] = !puzzleState[id];
      const el = document.querySelector(\`[data-id="\${id}"]\`);
      el.classList.toggle('active', puzzleState[id]);
    }

    function cycleElement(id, values) {
      const currentIndex = values.indexOf(puzzleState[id] ?? values[0]);
      const nextIndex = (currentIndex + 1) % values.length;
      puzzleState[id] = values[nextIndex];
      const el = document.querySelector(\`[data-id="\${id}"]\`);
      el.textContent = puzzleState[id];
    }

    function checkSolution() {
      // Simple solution check - customize based on puzzle type
      const solved = solutions.some(sol => {
        if (sol.elementStates) {
          return Object.entries(sol.elementStates).every(
            ([key, value]) => puzzleState[key] === value
          );
        }
        if (sol.combination) {
          const current = Object.values(puzzleState);
          return JSON.stringify(current) === JSON.stringify(sol.combination);
        }
        return false;
      });

      if (solved) {
        onPuzzleSolved();
      }
    }

    function onPuzzleSolved() {
      document.querySelector('.progress-bar-fill').style.width = '100%';
      document.querySelector('.puzzle-container').style.boxShadow = '0 0 50px #0f0';

      // Send message to parent (for iframe embedding)
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'PUZZLE_SOLVED', puzzleId: '${puzzle.id}' }, '*');
      }

      alert('🎉 Puzzle Solved!');
    }

    function updateDisplay() {
      // Update progress bar based on partial solutions
      // This is simplified - real implementation would check partial progress
    }

    function requestHint() {
      // Request hint from game system
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'REQUEST_HINT', puzzleId: '${puzzle.id}' }, '*');
      }
    }

    // Listen for messages from parent
    window.addEventListener('message', (event) => {
      if (event.data.type === 'REVEAL_HINT') {
        document.getElementById('hint-text').textContent = event.data.hint;
        document.getElementById('hint-panel').style.display = 'block';
      }
      if (event.data.type === 'RESET_PUZZLE') {
        location.reload();
      }
    });

    // Initialize
    updateDisplay();
  </script>
</body>
</html>
`.trim();
}

function generateElementHTML(element: PuzzleElement, puzzle: Puzzle): string {
  const style = `
    left: ${element.position.x}${element.position.unit};
    top: ${element.position.y}${element.position.unit};
    ${element.size ? `width: ${element.size.width}${element.size.unit}; height: ${element.size.height}${element.size.unit};` : ""}
    ${element.appearance?.backgroundColor ? `background-color: ${element.appearance.backgroundColor};` : ""}
    ${element.appearance?.borderColor ? `border-color: ${element.appearance.borderColor};` : ""}
    ${element.appearance?.opacity !== undefined ? `opacity: ${element.appearance.opacity};` : ""}
    ${element.state.rotation ? `transform: rotate(${element.state.rotation}deg);` : ""}
  `.trim();

  const classes = [
    "puzzle-element",
    element.type,
    element.interaction?.draggable ? "draggable" : "",
    element.state.active ? "active" : "",
    element.state.correctlyPlaced ? "correct" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dataAttrs = `
    data-id="${element.id}"
    data-type="${element.type}"
    data-action="${element.interaction?.onClick?.action || ""}"
    data-values='${JSON.stringify(element.interaction?.onClick?.values || [])}'
  `.trim();

  const content =
    element.appearance?.text ||
    element.appearance?.symbol ||
    (typeof element.state.value === "string" ||
    typeof element.state.value === "number"
      ? element.state.value
      : "");

  return `
    <div class="${classes}" style="${style}" ${dataAttrs}>
      ${content}
    </div>
  `.trim();
}

// ============================================
// PUZZLE REACT COMPONENT (for artifacts)
// ============================================

export function generatePuzzleReact(puzzle: Puzzle): string {
  return `
import React, { useState, useCallback } from 'react';

export default function ${puzzle.name.replace(/[^a-zA-Z0-9]/g, "")}Puzzle() {
  const [elementStates, setElementStates] = useState(${JSON.stringify(puzzle.state.elementStates)});
  const [progress, setProgress] = useState(${puzzle.state.progress});
  const [solved, setSolved] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState([]);

  const solutions = ${JSON.stringify(puzzle.solutions.map((s) => s.solution))};
  const hints = ${JSON.stringify(puzzle.hints.map((h) => h.content.text))};

  const handleElementClick = useCallback((elementId, action, values) => {
    setElementStates(prev => {
      const newState = { ...prev };

      switch(action) {
        case 'toggle':
          newState[elementId] = !prev[elementId];
          break;
        case 'cycle':
          const currentIndex = values.indexOf(prev[elementId] ?? values[0]);
          newState[elementId] = values[(currentIndex + 1) % values.length];
          break;
        case 'increment':
          newState[elementId] = ((prev[elementId] || 0) + 1) % 10;
          break;
      }

      // Check solution
      const isSolved = solutions.some(sol => {
        if (sol.elementStates) {
          return Object.entries(sol.elementStates).every(
            ([key, value]) => newState[key] === value
          );
        }
        return false;
      });

      if (isSolved) {
        setSolved(true);
        setProgress(100);
      }

      return newState;
    });
  }, [solutions]);

  const requestHint = () => {
    if (hintsRevealed.length < hints.length) {
      setHintsRevealed([...hintsRevealed, hints[hintsRevealed.length]]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Progress bar */}
      <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
          style={{ width: \`\${progress}%\` }}
        />
      </div>

      {/* Puzzle container */}
      <div
        className={\`relative bg-gray-800 rounded-xl shadow-2xl overflow-hidden \${solved ? 'ring-4 ring-green-500' : ''}\`}
        style={{ width: ${puzzle.layout.width}, height: ${puzzle.layout.height} }}
      >
        {${JSON.stringify(puzzle.elements)}.map(el => (
          <button
            key={el.id}
            className={\`absolute flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95 \${
              elementStates[el.id] ? 'bg-purple-600' : 'bg-gray-600'
            }\`}
            style={{
              left: \`\${el.position.x}%\`,
              top: \`\${el.position.y}%\`,
              width: el.size?.width || 60,
              height: el.size?.height || 60,
            }}
            onClick={() => handleElementClick(
              el.id,
              el.interaction?.onClick?.action || 'toggle',
              el.interaction?.onClick?.values || []
            )}
          >
            <span className="text-white text-xl font-bold">
              {elementStates[el.id] !== undefined ? String(elementStates[el.id]) : el.appearance?.text || ''}
            </span>
          </button>
        ))}
      </div>

      {/* Solved message */}
      {solved && (
        <div className="text-2xl font-bold text-green-400 animate-pulse">
          🎉 Puzzle Solved!
        </div>
      )}

      {/* Hints */}
      <div className="mt-4">
        <button
          onClick={requestHint}
          className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 text-white"
          disabled={hintsRevealed.length >= hints.length}
        >
          Request Hint ({hintsRevealed.length}/{hints.length})
        </button>

        {hintsRevealed.length > 0 && (
          <div className="mt-2 p-3 bg-gray-800 rounded text-gray-300">
            {hintsRevealed.map((hint, i) => (
              <p key={i} className="mb-1">💡 {hint}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`.trim();
}

// ============================================
// PUZZLE GENERATION PROMPT
// ============================================

export function buildPuzzleGenerationPrompt(request: {
  type: PuzzleType;
  difficulty: PuzzleDifficulty;
  theme: string;
  setting: string;
  solutionHint?: string;
  narrativeContext?: string;
  requiredElements?: string[];
}): string {
  return `
# GENERATE PUZZLE

Create an interactive puzzle for a TTRPG session.

## SPECIFICATIONS
Type: ${request.type}
Difficulty: ${request.difficulty}
Theme: ${request.theme}
Setting: ${request.setting}

${request.solutionHint ? `Solution hint: ${request.solutionHint}` : ""}
${request.narrativeContext ? `Narrative context: ${request.narrativeContext}` : ""}
${request.requiredElements?.length ? `Must include: ${request.requiredElements.join(", ")}` : ""}

## REQUIREMENTS

1. **Player Description**: What players see when they encounter the puzzle
2. **Flavor Text**: In-world inscription, plaque, or visual clue
3. **Elements**: List of interactive components with:
   - ID, type, position
   - Initial state
   - Interaction rules
   - Visual appearance
4. **Solution**: What state solves the puzzle
5. **Hints**: 3-5 progressive hints (subtle → obvious)
6. **Rewards**: What happens when solved

## PUZZLE DESIGN PRINCIPLES

1. **Visual Clarity**: Players should understand what can be interacted with
2. **Feedback**: Every action should give some feedback
3. **Progressive Difficulty**: Start simple, add complexity
4. **Multiple Attempts**: Allow experimentation without punishment
5. **Teachable**: Early interactions teach the mechanics
6. **Thematic**: Fit the setting and narrative
7. **Collaborative**: Multiple players can contribute

## OUTPUT FORMAT

Provide a complete puzzle definition including:
- All interactive elements
- Solution conditions
- Hint sequence
- Reward structure
- HTML/React rendering hints
`.trim();
}
