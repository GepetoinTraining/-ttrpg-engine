import { z } from "zod";

// ============================================
// DICE SYSTEM
// ============================================

export const DieTypeSchema = z.enum([
  "d4",
  "d6",
  "d8",
  "d10",
  "d12",
  "d20",
  "d100",
]);
export type DieType = z.infer<typeof DieTypeSchema>;

export const DieToMax: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export const DiceExpressionSchema = z.object({
  count: z.number().int().positive().default(1),
  die: DieTypeSchema,
  modifier: z.number().int().default(0),
});
export type DiceExpression = z.infer<typeof DiceExpressionSchema>;

// Parse "2d6+3" into DiceExpression
export function parseDiceExpression(expr: string): DiceExpression {
  const match = expr.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) {
    throw new Error(`Invalid dice expression: ${expr}`);
  }

  const count = match[1] ? parseInt(match[1]) : 1;
  const dieSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  const dieType = `d${dieSize}` as DieType;
  if (!DieToMax[dieType]) {
    throw new Error(`Invalid die type: d${dieSize}`);
  }

  return { count, die: dieType, modifier };
}

export const RollResultSchema = z.object({
  expression: DiceExpressionSchema,
  rolls: z.array(z.number().int().positive()),
  modifier: z.number().int(),
  total: z.number().int(),
  isCritical: z.boolean().optional(),
  isFumble: z.boolean().optional(),
});
export type RollResult = z.infer<typeof RollResultSchema>;

export const RollModifierSchema = z.object({
  source: z.string(), // "Bless", "Guidance", "Proficiency"
  value: z.number().int(),
  type: z.enum(["flat", "dice"]).default("flat"),
  diceExpr: z.string().optional(), // if type === 'dice', e.g., "1d4"
});
export type RollModifier = z.infer<typeof RollModifierSchema>;

export const AdvantageStateSchema = z.enum([
  "normal",
  "advantage",
  "disadvantage",
]);
export type AdvantageState = z.infer<typeof AdvantageStateSchema>;

// Roll dice
export function rollDice(expr: DiceExpression): RollResult {
  const rolls: number[] = [];
  for (let i = 0; i < expr.count; i++) {
    rolls.push(Math.floor(Math.random() * DieToMax[expr.die]) + 1);
  }

  const total = rolls.reduce((a, b) => a + b, 0) + expr.modifier;

  return {
    expression: expr,
    rolls,
    modifier: expr.modifier,
    total,
  };
}

// Roll with advantage/disadvantage
export function rollD20(
  advantage: AdvantageState = "normal",
  modifiers: RollModifier[] = [],
): RollResult {
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;

  let baseRoll: number;
  let rolls: number[];

  switch (advantage) {
    case "advantage":
      baseRoll = Math.max(roll1, roll2);
      rolls = [roll1, roll2];
      break;
    case "disadvantage":
      baseRoll = Math.min(roll1, roll2);
      rolls = [roll1, roll2];
      break;
    default:
      baseRoll = roll1;
      rolls = [roll1];
  }

  // Calculate total modifier
  let totalMod = 0;
  for (const mod of modifiers) {
    if (mod.type === "flat") {
      totalMod += mod.value;
    } else if (mod.type === "dice" && mod.diceExpr) {
      const diceResult = rollDice(parseDiceExpression(mod.diceExpr));
      totalMod += diceResult.total;
    }
  }

  return {
    expression: { count: 1, die: "d20", modifier: totalMod },
    rolls,
    modifier: totalMod,
    total: baseRoll + totalMod,
    isCritical: baseRoll === 20,
    isFumble: baseRoll === 1,
  };
}

// ============================================
// ABILITY SCORES
// ============================================

export const AbilitySchema = z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);
export type Ability = z.infer<typeof AbilitySchema>;

export const AbilityScoresSchema = z.object({
  STR: z.number().int().min(1).max(30),
  DEX: z.number().int().min(1).max(30),
  CON: z.number().int().min(1).max(30),
  INT: z.number().int().min(1).max(30),
  WIS: z.number().int().min(1).max(30),
  CHA: z.number().int().min(1).max(30),
});
export type AbilityScores = z.infer<typeof AbilityScoresSchema>;

// Calculate ability modifier: (score - 10) / 2, rounded down
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// ============================================
// SKILLS
// ============================================

export const SkillSchema = z.enum([
  // STR
  "athletics",
  // DEX
  "acrobatics",
  "sleight_of_hand",
  "stealth",
  // INT
  "arcana",
  "history",
  "investigation",
  "nature",
  "religion",
  // WIS
  "animal_handling",
  "insight",
  "medicine",
  "perception",
  "survival",
  // CHA
  "deception",
  "intimidation",
  "performance",
  "persuasion",
]);
export type Skill = z.infer<typeof SkillSchema>;

export const SkillToAbility: Record<Skill, Ability> = {
  athletics: "STR",
  acrobatics: "DEX",
  sleight_of_hand: "DEX",
  stealth: "DEX",
  arcana: "INT",
  history: "INT",
  investigation: "INT",
  nature: "INT",
  religion: "INT",
  animal_handling: "WIS",
  insight: "WIS",
  medicine: "WIS",
  perception: "WIS",
  survival: "WIS",
  deception: "CHA",
  intimidation: "CHA",
  performance: "CHA",
  persuasion: "CHA",
};

export const ProficiencyLevelSchema = z.enum([
  "none",
  "half", // Jack of All Trades
  "proficient",
  "expertise", // Double proficiency
]);
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>;

export const SkillProficiencySchema = z.object({
  skill: SkillSchema,
  level: ProficiencyLevelSchema,
});
export type SkillProficiency = z.infer<typeof SkillProficiencySchema>;

// Calculate proficiency bonus by level
export function getProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

// Calculate skill modifier
export function getSkillModifier(
  skill: Skill,
  abilityScores: AbilityScores,
  proficiencyLevel: ProficiencyLevel,
  characterLevel: number,
): number {
  const ability = SkillToAbility[skill];
  const abilityMod = getAbilityModifier(abilityScores[ability]);
  const profBonus = getProficiencyBonus(characterLevel);

  switch (proficiencyLevel) {
    case "none":
      return abilityMod;
    case "half":
      return abilityMod + Math.floor(profBonus / 2);
    case "proficient":
      return abilityMod + profBonus;
    case "expertise":
      return abilityMod + profBonus * 2;
  }
}

// ============================================
// CONDITIONS
// ============================================

export const ConditionSchema = z.enum([
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
  // Additional common states
  "concentrating",
  "hidden",
  "surprised",
  "dodging",
  "raging",
  "dead",
]);
export type Condition = z.infer<typeof ConditionSchema>;

export const ConditionInstanceSchema = z.object({
  condition: ConditionSchema,
  source: z.string().optional(), // "Spell: Hold Person", "Orc Warchief"
  duration: z.number().int().optional(), // in rounds, undefined = permanent
  endTrigger: z
    .enum(["start_of_turn", "end_of_turn", "save", "manual"])
    .optional(),
  saveDC: z.number().int().optional(),
  saveAbility: AbilitySchema.optional(),
  level: z.number().int().min(1).max(6).optional(), // for exhaustion
});
export type ConditionInstance = z.infer<typeof ConditionInstanceSchema>;

// Condition effects (what they actually do)
export const ConditionEffects: Record<
  Condition,
  {
    cantSee?: boolean;
    cantHear?: boolean;
    cantMove?: boolean;
    cantTakeActions?: boolean;
    cantTakeReactions?: boolean;
    autoFailStrDexSaves?: boolean;
    attacksAgainstAdvantage?: boolean;
    attacksDisadvantage?: boolean;
    speedZero?: boolean;
    autoFailSaves?: Ability[];
    additionalEffects?: string[];
  }
> = {
  blinded: {
    cantSee: true,
    attacksDisadvantage: true,
    attacksAgainstAdvantage: true,
  },
  charmed: {
    additionalEffects: [
      "Can't attack charmer",
      "Charmer has advantage on social checks",
    ],
  },
  deafened: {
    cantHear: true,
  },
  exhaustion: {
    additionalEffects: ["Effects depend on level (1-6)"],
  },
  frightened: {
    attacksDisadvantage: true,
    additionalEffects: ["Can't willingly move closer to source"],
  },
  grappled: {
    speedZero: true,
  },
  incapacitated: {
    cantTakeActions: true,
    cantTakeReactions: true,
  },
  invisible: {
    attacksAgainstAdvantage: false, // attacks against have disadvantage
    additionalEffects: [
      "Attacks against have disadvantage",
      "Advantage on attacks",
    ],
  },
  paralyzed: {
    cantMove: true,
    cantTakeActions: true,
    cantTakeReactions: true,
    autoFailStrDexSaves: true,
    attacksAgainstAdvantage: true,
    additionalEffects: ["Attacks within 5ft are auto-crits"],
  },
  petrified: {
    cantMove: true,
    cantTakeActions: true,
    cantTakeReactions: true,
    autoFailStrDexSaves: true,
    attacksAgainstAdvantage: true,
    additionalEffects: ["Resistance to all damage", "Immune to poison/disease"],
  },
  poisoned: {
    attacksDisadvantage: true,
    additionalEffects: ["Disadvantage on ability checks"],
  },
  prone: {
    additionalEffects: [
      "Disadvantage on attacks",
      "Melee attacks against have advantage",
      "Ranged attacks against have disadvantage",
      "Must use half movement to stand",
    ],
  },
  restrained: {
    speedZero: true,
    attacksDisadvantage: true,
    attacksAgainstAdvantage: true,
    additionalEffects: ["Disadvantage on DEX saves"],
  },
  stunned: {
    cantMove: true,
    cantTakeActions: true,
    cantTakeReactions: true,
    autoFailStrDexSaves: true,
    attacksAgainstAdvantage: true,
  },
  unconscious: {
    cantMove: true,
    cantTakeActions: true,
    cantTakeReactions: true,
    autoFailStrDexSaves: true,
    attacksAgainstAdvantage: true,
    additionalEffects: [
      "Drops held items",
      "Falls prone",
      "Attacks within 5ft are auto-crits",
    ],
  },
  concentrating: {
    additionalEffects: ["Must make CON save on damage to maintain"],
  },
  hidden: {
    additionalEffects: [
      "Advantage on first attack",
      "Location unknown to enemies",
    ],
  },
  surprised: {
    cantTakeActions: true,
    cantTakeReactions: true,
    additionalEffects: ["Only during first round"],
  },
  dodging: {
    additionalEffects: [
      "Attacks against have disadvantage",
      "Advantage on DEX saves",
      "Lost if speed becomes 0 or incapacitated",
    ],
  },
  raging: {
    additionalEffects: [
      "Advantage on STR checks/saves",
      "Bonus rage damage on STR attacks",
      "Resistance to bludgeoning/piercing/slashing",
    ],
  },
  dead: {
    cantMove: true,
    cantTakeActions: true,
    cantTakeReactions: true,
    additionalEffects: ["Game over (for this character)"],
  },
};

// ============================================
// DAMAGE & HEALING
// ============================================

export const DamageTypeSchema = z.enum([
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]);
export type DamageType = z.infer<typeof DamageTypeSchema>;

export const DamageResistanceSchema = z.enum([
  "vulnerable", // x2 damage
  "normal",
  "resistant", // x0.5 damage
  "immune", // x0 damage
]);
export type DamageResistance = z.infer<typeof DamageResistanceSchema>;

export const DamageInstanceSchema = z.object({
  amount: z.number().int().nonnegative(),
  type: DamageTypeSchema,
  source: z.string().optional(),
  isCritical: z.boolean().default(false),
  isMagical: z.boolean().default(false),
});
export type DamageInstance = z.infer<typeof DamageInstanceSchema>;

export const HealingInstanceSchema = z.object({
  amount: z.number().int().nonnegative(),
  source: z.string().optional(),
  tempHP: z.boolean().default(false),
});
export type HealingInstance = z.infer<typeof HealingInstanceSchema>;

// Apply damage with resistance calculation
export function applyDamage(
  baseDamage: number,
  resistance: DamageResistance,
): number {
  switch (resistance) {
    case "vulnerable":
      return baseDamage * 2;
    case "resistant":
      return Math.floor(baseDamage / 2);
    case "immune":
      return 0;
    default:
      return baseDamage;
  }
}

// ============================================
// ACTION ECONOMY
// ============================================

export const ActionTypeSchema = z.enum([
  "action",
  "bonus_action",
  "reaction",
  "movement",
  "free_action",
  "legendary_action",
  "lair_action",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const StandardActionSchema = z.enum([
  // Standard actions
  "attack",
  "cast_spell",
  "dash",
  "disengage",
  "dodge",
  "help",
  "hide",
  "ready",
  "search",
  "use_object",
  "grapple",
  "shove",
  // Other
  "other",
]);
export type StandardAction = z.infer<typeof StandardActionSchema>;

export const ActionEconomySchema = z.object({
  action: z.boolean().default(true),
  bonusAction: z.boolean().default(true),
  reaction: z.boolean().default(true),
  movement: z.number().int().nonnegative(), // remaining feet
  freeInteraction: z.boolean().default(true), // one free object interaction
});
export type ActionEconomy = z.infer<typeof ActionEconomySchema>;

export const ActionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),

  // What it costs
  actionType: ActionTypeSchema,

  // Requirements
  requiresAttackRoll: z.boolean().default(false),
  requiresSavingThrow: z.boolean().default(false),
  saveDC: z.number().int().optional(),
  saveAbility: AbilitySchema.optional(),

  // Range
  range: z.number().int().optional(), // in feet
  rangeType: z.enum(["melee", "ranged", "self", "touch"]).optional(),

  // Targeting
  targetType: z
    .enum(["self", "one_creature", "multiple", "area", "object"])
    .optional(),
  maxTargets: z.number().int().optional(),

  // Effects
  damage: z
    .array(
      z.object({
        dice: z.string(), // "2d6+3"
        type: DamageTypeSchema,
      }),
    )
    .optional(),
  healing: z.string().optional(), // dice expression
  conditions: z.array(ConditionSchema).optional(),

  // Spell-specific
  isSpell: z.boolean().default(false),
  spellLevel: z.number().int().min(0).max(9).optional(),
  concentration: z.boolean().default(false),
  components: z
    .object({
      verbal: z.boolean().default(false),
      somatic: z.boolean().default(false),
      material: z.string().optional(),
    })
    .optional(),
});
export type Action = z.infer<typeof ActionSchema>;

// ============================================
// COMBAT
// ============================================

export const InitiativeEntrySchema = z.object({
  tokenId: z.string().uuid(),
  entityId: z.string().uuid(),
  name: z.string(),

  // Roll
  roll: z.number().int(),
  dexMod: z.number().int(), // tiebreaker

  // Status
  hasActed: z.boolean().default(false),
  isDelaying: z.boolean().default(false),

  // Resources
  actionEconomy: ActionEconomySchema,
});
export type InitiativeEntry = z.infer<typeof InitiativeEntrySchema>;

export const CombatStateSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),

  // Initiative order
  initiativeOrder: z.array(InitiativeEntrySchema),
  currentIndex: z.number().int().default(0),
  round: z.number().int().default(1),

  // Combat status
  status: z
    .enum(["not_started", "active", "paused", "ended"])
    .default("not_started"),
  startedAt: z.date().optional(),
  endedAt: z.date().optional(),

  // Surprise
  surprisedTokens: z.array(z.string().uuid()).default([]),

  // Combat log
  log: z
    .array(
      z.object({
        round: z.number().int(),
        actorId: z.string().uuid(),
        action: z.string(),
        targets: z.array(z.string().uuid()).optional(),
        result: z.string().optional(),
        timestamp: z.date(),
      }),
    )
    .default([]),
});
export type CombatState = z.infer<typeof CombatStateSchema>;

// ============================================
// ATTACK RESOLUTION
// ============================================

export const AttackRollSchema = z.object({
  attackerId: z.string().uuid(),
  targetId: z.string().uuid(),

  // Attack details
  weaponName: z.string(),
  attackBonus: z.number().int(),
  advantage: AdvantageStateSchema,

  // Roll result
  roll: RollResultSchema,
  targetAC: z.number().int(),

  // Outcome
  hit: z.boolean(),
  critical: z.boolean(),
  fumble: z.boolean(),

  // If hit, damage
  damage: z.array(DamageInstanceSchema).optional(),
  totalDamage: z.number().int().optional(),
});
export type AttackRoll = z.infer<typeof AttackRollSchema>;

export const SavingThrowSchema = z.object({
  targetId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),

  // Save details
  ability: AbilitySchema,
  dc: z.number().int(),
  advantage: AdvantageStateSchema,

  // Roll result
  roll: RollResultSchema,

  // Outcome
  success: z.boolean(),

  // Effects on failure
  effectOnFail: z.string().optional(),
  damageOnFail: z.array(DamageInstanceSchema).optional(),
  damageOnSuccess: z.array(DamageInstanceSchema).optional(), // half damage on save
});
export type SavingThrow = z.infer<typeof SavingThrowSchema>;

// Resolve an attack
export function resolveAttack(
  attackBonus: number,
  targetAC: number,
  advantage: AdvantageState,
  damageExpression: string,
  damageType: DamageType,
  additionalModifiers: RollModifier[] = [],
): AttackRoll {
  // Roll to hit
  const attackRoll = rollD20(advantage, [
    { source: "Attack Bonus", value: attackBonus, type: "flat" },
    ...additionalModifiers,
  ]);

  const hit = attackRoll.total >= targetAC || attackRoll.isCritical === true;
  const critical = attackRoll.isCritical === true;
  const fumble = attackRoll.isFumble === true;

  let damage: DamageInstance[] | undefined;
  let totalDamage: number | undefined;

  if (hit && !fumble) {
    const damageExpr = parseDiceExpression(damageExpression);

    // Critical hit: double dice
    if (critical) {
      damageExpr.count *= 2;
    }

    const damageRoll = rollDice(damageExpr);
    damage = [
      {
        amount: damageRoll.total,
        type: damageType,
        isCritical: critical,
      },
    ];
    totalDamage = damageRoll.total;
  }

  return {
    attackerId: "", // filled by caller
    targetId: "", // filled by caller
    weaponName: "", // filled by caller
    attackBonus,
    advantage,
    roll: attackRoll,
    targetAC,
    hit,
    critical,
    fumble,
    damage,
    totalDamage,
  };
}

// Resolve a saving throw
export function resolveSavingThrow(
  saveBonus: number,
  dc: number,
  advantage: AdvantageState,
  additionalModifiers: RollModifier[] = [],
): SavingThrow {
  const roll = rollD20(advantage, [
    { source: "Save Bonus", value: saveBonus, type: "flat" },
    ...additionalModifiers,
  ]);

  return {
    targetId: "", // filled by caller
    ability: "STR", // filled by caller
    dc,
    advantage,
    roll,
    success: roll.total >= dc,
  };
}
