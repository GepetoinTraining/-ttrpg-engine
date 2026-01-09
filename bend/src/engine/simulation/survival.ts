import { z } from 'zod';

// ============================================
// NPC SURVIVAL & SOCIAL FABRIC
// ============================================
//
// Philosophy: NPCS ARE NOT FURNITURE
//
// They have needs. When needs aren't met, they act.
// When enough act together, they migrate.
//
// Maslow's Hierarchy for NPCs:
//   1. PHYSIOLOGICAL - Food, water, shelter
//   2. SAFETY - Security from violence, stability
//   3. BELONGING - Family, community, social bonds
//   4. ESTEEM - Reputation, respect, achievement
//   5. SELF-ACTUALIZATION - Goals, ambitions
//
// When lower needs fail, higher needs become irrelevant.
// A starving NPC doesn't care about reputation.
//
// SOCIAL FABRIC:
// NPCs form bonds. Bonds create groups.
// Groups make collective decisions.
// When a group decides to migrate, they move TOGETHER.
//
// This creates:
//   - Refugee waves (war, famine, monsters)
//   - Family units moving together
//   - Guild migrations (craftsmen follow work)
//   - Religious pilgrimages
//   - Criminal gang relocations
//

// ============================================
// BASIC NEEDS
// ============================================

export const NeedTypeSchema = z.enum([
  // Physiological (survival)
  'food',           // Daily sustenance
  'water',          // In arid regions
  'shelter',        // Housing, protection from elements
  'health',         // Not sick/injured

  // Safety
  'security',       // Protection from violence
  'stability',      // Predictable environment
  'income',         // Means to meet other needs

  // Belonging
  'family',         // Close relationships
  'community',      // Social acceptance
  'faith',          // Religious/spiritual needs

  // Esteem
  'reputation',     // How others see them
  'achievement',    // Accomplishing goals
  'autonomy',       // Control over life

  // Self-actualization
  'purpose',        // Meaning in life
  'growth',         // Personal development
]);
export type NeedType = z.infer<typeof NeedTypeSchema>;

// Which needs are survival-critical
export const SURVIVAL_NEEDS: NeedType[] = ['food', 'water', 'shelter', 'health', 'security'];

// Need satisfaction levels
export const NeedLevelSchema = z.enum([
  'desperate',      // 0-10: Will do anything
  'deprived',       // 11-30: Suffering, seeking relief
  'struggling',     // 31-50: Getting by, stressed
  'adequate',       // 51-70: Needs met, not comfortable
  'comfortable',    // 71-90: Content
  'thriving',       // 91-100: Flourishing
]);
export type NeedLevel = z.infer<typeof NeedLevelSchema>;

export function getNeedLevel(value: number): NeedLevel {
  if (value <= 10) return 'desperate';
  if (value <= 30) return 'deprived';
  if (value <= 50) return 'struggling';
  if (value <= 70) return 'adequate';
  if (value <= 90) return 'comfortable';
  return 'thriving';
}

// ============================================
// NPC SURVIVAL STATE
// ============================================

export const NPCSurvivalStateSchema = z.object({
  npcId: z.string().uuid(),

  // Current need satisfaction (0-100)
  needs: z.object({
    food: z.number().int().min(0).max(100).default(70),
    water: z.number().int().min(0).max(100).default(80),
    shelter: z.number().int().min(0).max(100).default(70),
    health: z.number().int().min(0).max(100).default(80),
    security: z.number().int().min(0).max(100).default(60),
    stability: z.number().int().min(0).max(100).default(60),
    income: z.number().int().min(0).max(100).default(50),
    family: z.number().int().min(0).max(100).default(50),
    community: z.number().int().min(0).max(100).default(50),
    faith: z.number().int().min(0).max(100).default(50),
    reputation: z.number().int().min(0).max(100).default(50),
    achievement: z.number().int().min(0).max(100).default(50),
    autonomy: z.number().int().min(0).max(100).default(50),
    purpose: z.number().int().min(0).max(100).default(50),
    growth: z.number().int().min(0).max(100).default(50),
  }),

  // Resources
  resources: z.object({
    gold: z.number().default(0),
    foodDays: z.number().default(7),        // Days of food stored
    hasHome: z.boolean().default(true),
    hasJob: z.boolean().default(true),
  }),

  // Economic state
  economics: z.object({
    weeklyIncome: z.number().default(0),
    weeklyExpenses: z.number().default(0),
    debt: z.number().default(0),
    savingsWeeks: z.number().default(0),    // Weeks they could survive without income
  }),

  // Current state
  state: z.object({
    isEmployed: z.boolean().default(true),
    isHomeless: z.boolean().default(false),
    isHungry: z.boolean().default(false),
    isStarving: z.boolean().default(false),
    isSick: z.boolean().default(false),
    isInjured: z.boolean().default(false),
    isInDebt: z.boolean().default(false),
    isBegging: z.boolean().default(false),
    isStealing: z.boolean().default(false),
    wantsToMigrate: z.boolean().default(false),
  }),

  // Desperation tracking
  desperation: z.object({
    level: z.number().int().min(0).max(100).default(0),
    daysWithoutFood: z.number().int().default(0),
    daysWithoutShelter: z.number().int().default(0),
    daysUnemployed: z.number().int().default(0),
    timesBegged: z.number().int().default(0),
    timesStole: z.number().int().default(0),
    crimeEscalation: z.number().int().min(0).max(10).default(0),
  }),

  // Migration readiness
  migration: z.object({
    desire: z.number().int().min(0).max(100).default(0),  // How much they want to leave
    blocked: z.boolean().default(false),                   // Can't leave (family, debt, etc.)
    blockedReason: z.string().optional(),
    preferredDestination: z.string().uuid().optional(),
    willingToJoinGroup: z.boolean().default(true),
  }),

  lastUpdated: z.string(),
});
export type NPCSurvivalState = z.infer<typeof NPCSurvivalStateSchema>;

// ============================================
// SOCIAL BONDS
// ============================================

export const BondTypeSchema = z.enum([
  // Family
  'spouse',
  'parent',
  'child',
  'sibling',
  'extended_family',

  // Professional
  'employer',
  'employee',
  'coworker',
  'guild_member',
  'apprentice_master',

  // Social
  'friend',
  'neighbor',
  'romantic',
  'rival',
  'enemy',

  // Institutional
  'congregation',     // Same temple
  'faction_comrade',  // Same faction
  'military_unit',    // Same unit
  'gang_member',      // Criminal organization

  // Dependency
  'debtor',           // Owes them money
  'creditor',         // They owe money
  'patron',           // Supports them
  'dependent',        // They support
]);
export type BondType = z.infer<typeof BondTypeSchema>;

export const SocialBondSchema = z.object({
  id: z.string().uuid(),

  // Who is connected
  npcId: z.string().uuid(),
  targetId: z.string().uuid(),
  targetName: z.string(),

  // Bond type
  type: BondTypeSchema,

  // Strength (-100 to 100)
  // Negative = toxic/hostile bond (still a bond!)
  strength: z.number().int().min(-100).max(100),

  // Bond properties
  properties: z.object({
    // Does this bond block migration?
    blocksMigration: z.boolean().default(false),
    blockReason: z.string().optional(),

    // Does this bond encourage co-migration?
    encourageCoMigration: z.boolean().default(false),
    coMigrationWeight: z.number().min(0).max(1).default(0.5),

    // Economic dependency
    economicDependency: z.number().min(-1).max(1).default(0),  // -1 = they depend on target, 1 = target depends on them

    // Influence on decisions
    influenceWeight: z.number().min(0).max(1).default(0.1),
  }),

  // History
  formedAt: z.string(),
  lastInteraction: z.string().optional(),
});
export type SocialBond = z.infer<typeof SocialBondSchema>;

// Which bonds encourage migration together
export const CO_MIGRATION_BONDS: BondType[] = [
  'spouse', 'parent', 'child', 'sibling',
  'friend', 'romantic',
  'guild_member', 'gang_member', 'faction_comrade',
  'dependent',
];

// Which bonds block migration
export const MIGRATION_BLOCKING_BONDS: BondType[] = [
  'employer', 'debtor', 'dependent',
];

// ============================================
// SOCIAL GROUP (Emergent from bonds)
// ============================================

export const SocialGroupTypeSchema = z.enum([
  'family',           // Blood/marriage relations
  'household',        // People living together
  'guild_chapter',    // Local guild members
  'congregation',     // Religious community
  'gang',             // Criminal organization
  'military_unit',    // Soldiers together
  'faction_cell',     // Faction members
  'neighborhood',     // Geographic proximity
  'friend_circle',    // Social friends
  'refugee_band',     // Formed during crisis
]);
export type SocialGroupType = z.infer<typeof SocialGroupTypeSchema>;

export const SocialGroupSchema = z.object({
  id: z.string().uuid(),
  type: SocialGroupTypeSchema,
  name: z.string().optional(),

  // Members
  members: z.array(z.object({
    npcId: z.string().uuid(),
    npcName: z.string(),
    role: z.enum(['leader', 'member', 'dependent', 'peripheral']),
    influence: z.number().min(0).max(1),  // Weight in group decisions
  })),

  // Location
  hubId: z.string().uuid(),
  hubName: z.string(),

  // Group state
  state: z.object({
    cohesion: z.number().int().min(0).max(100),     // How tight the group is
    morale: z.number().int().min(0).max(100),       // Group mood
    resources: z.number().default(0),                // Shared resources
  }),

  // Migration state
  migration: z.object({
    collectiveDesire: z.number().int().min(0).max(100).default(0),
    hasDecidedToMigrate: z.boolean().default(false),
    migrationDestination: z.string().uuid().optional(),
    migrationDate: z.string().optional(),
    migrationLeader: z.string().uuid().optional(),
  }),

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SocialGroup = z.infer<typeof SocialGroupSchema>;

// ============================================
// DESPERATION BEHAVIORS
// ============================================

export const DesperationBehaviorSchema = z.enum([
  // Passive coping
  'skip_meals',           // Reduce food consumption
  'share_housing',        // Move in with others
  'sell_possessions',     // Liquidate assets
  'take_worse_job',       // Accept lower pay

  // Active seeking
  'beg',                  // Ask for charity
  'seek_charity',         // Go to temple/charity
  'seek_patron',          // Find someone to support them
  'seek_work',            // Look for any job

  // Risky behaviors
  'borrow_money',         // Take on debt
  'petty_theft',          // Steal small items
  'smuggling',            // Criminal work
  'sell_contraband',      // Deal in illegal goods

  // Escalation
  'join_gang',            // Join criminal org for protection
  'armed_robbery',        // Violent theft
  'extortion',            // Threaten for money

  // Exit strategies
  'migrate',              // Leave for better place
  'join_military',        // Sign up for army
  'indentured_service',   // Sell labor for years
  'flee',                 // Run away (debt, crime)
]);
export type DesperationBehavior = z.infer<typeof DesperationBehaviorSchema>;

// What behaviors unlock at what desperation level
export const DESPERATION_THRESHOLDS: Record<DesperationBehavior, number> = {
  // Low desperation (20-40)
  skip_meals: 20,
  seek_work: 20,
  take_worse_job: 25,
  sell_possessions: 30,
  share_housing: 35,

  // Medium desperation (40-60)
  borrow_money: 40,
  seek_charity: 45,
  beg: 50,
  seek_patron: 55,
  migrate: 55,

  // High desperation (60-80)
  petty_theft: 60,
  join_military: 65,
  smuggling: 70,
  sell_contraband: 75,
  indentured_service: 75,

  // Critical desperation (80+)
  join_gang: 80,
  armed_robbery: 85,
  extortion: 90,
  flee: 95,
};

// ============================================
// SURVIVAL TICK
// ============================================

export interface SurvivalTickResult {
  npcId: string;
  needChanges: Partial<Record<NeedType, number>>;
  behaviorsTaken: DesperationBehavior[];
  stateChanges: Partial<NPCSurvivalState['state']>;
  migrationDesireChange: number;
  events: Array<{
    type: string;
    description: string;
    consequence?: string;
  }>;
}

/**
 * Process daily survival for an NPC.
 */
export function tickNPCSurvival(
  state: NPCSurvivalState,
  context: {
    settlementFoodSupply: NeedLevel;
    settlementSecurity: NeedLevel;
    settlementEconomy: NeedLevel;
    hasJob: boolean;
    jobIncome: number;
    housingCost: number;
    foodCost: number;
  },
): SurvivalTickResult {
  const result: SurvivalTickResult = {
    npcId: state.npcId,
    needChanges: {},
    behaviorsTaken: [],
    stateChanges: {},
    migrationDesireChange: 0,
    events: [],
  };

  // === FOOD ===
  if (state.resources.foodDays <= 0) {
    state.desperation.daysWithoutFood++;
    result.needChanges.food = -10;

    if (state.desperation.daysWithoutFood >= 3) {
      result.stateChanges.isStarving = true;
      result.needChanges.health = -5;
    } else {
      result.stateChanges.isHungry = true;
    }
  } else {
    state.resources.foodDays--;
    state.desperation.daysWithoutFood = 0;
    result.stateChanges.isHungry = false;
    result.stateChanges.isStarving = false;
  }

  // === INCOME ===
  if (!context.hasJob) {
    state.desperation.daysUnemployed++;
    result.needChanges.income = -5;
    result.stateChanges.isEmployed = false;

    // Burn through savings
    if (state.economics.savingsWeeks > 0) {
      state.economics.savingsWeeks -= 1/7;  // Daily tick
    }
  } else {
    state.desperation.daysUnemployed = 0;
    result.stateChanges.isEmployed = true;
  }

  // === SHELTER ===
  if (state.state.isHomeless) {
    state.desperation.daysWithoutShelter++;
    result.needChanges.shelter = -15;
    result.needChanges.health = -3;
    result.needChanges.security = -10;
  }

  // === SECURITY (from settlement) ===
  const securityModifier = {
    desperate: -20,
    deprived: -10,
    struggling: -5,
    adequate: 0,
    comfortable: 5,
    thriving: 10,
  }[context.settlementSecurity];
  result.needChanges.security = securityModifier;

  // === CALCULATE DESPERATION ===
  const survivalNeeds = [
    state.needs.food,
    state.needs.shelter,
    state.needs.security,
    state.needs.income,
  ];
  const avgSurvival = survivalNeeds.reduce((a, b) => a + b, 0) / survivalNeeds.length;
  const desperation = Math.max(0, Math.min(100, 100 - avgSurvival));

  state.desperation.level = desperation;

  // === DETERMINE BEHAVIORS ===
  const availableBehaviors = Object.entries(DESPERATION_THRESHOLDS)
    .filter(([_, threshold]) => desperation >= threshold)
    .map(([behavior]) => behavior as DesperationBehavior);

  // Pick behaviors based on personality and situation
  if (desperation >= 50 && state.resources.foodDays <= 0) {
    if (availableBehaviors.includes('beg') && !state.state.isBegging) {
      result.behaviorsTaken.push('beg');
      result.stateChanges.isBegging = true;
      result.events.push({
        type: 'behavior_change',
        description: 'Started begging for food',
      });
    }
  }

  if (desperation >= 60 && state.resources.gold <= 0) {
    if (availableBehaviors.includes('petty_theft') && Math.random() < 0.3) {
      result.behaviorsTaken.push('petty_theft');
      state.desperation.timesStole++;
      state.desperation.crimeEscalation++;
      result.events.push({
        type: 'crime',
        description: 'Stole to survive',
        consequence: 'May be caught',
      });
    }
  }

  // === MIGRATION DESIRE ===
  let migrationPressure = 0;

  // Desperation increases migration desire
  if (desperation >= 40) migrationPressure += (desperation - 40) * 0.5;

  // Settlement conditions
  if (context.settlementFoodSupply === 'desperate') migrationPressure += 20;
  if (context.settlementFoodSupply === 'deprived') migrationPressure += 10;
  if (context.settlementSecurity === 'desperate') migrationPressure += 25;
  if (context.settlementSecurity === 'deprived') migrationPressure += 15;

  // Long-term unemployment
  if (state.desperation.daysUnemployed > 30) migrationPressure += 15;
  if (state.desperation.daysUnemployed > 60) migrationPressure += 25;

  result.migrationDesireChange = migrationPressure;

  // Update migration state
  state.migration.desire = Math.min(100, state.migration.desire + migrationPressure * 0.1);
  if (state.migration.desire >= 70) {
    result.stateChanges.wantsToMigrate = true;
  }

  return result;
}

// ============================================
// GROUP MIGRATION DECISION
// ============================================

export interface GroupMigrationDecision {
  groupId: string;
  shouldMigrate: boolean;
  consensusLevel: number;          // 0-1, how unified the decision is
  membersWilling: string[];
  membersReluctant: string[];
  membersBlocked: string[];
  destination?: {
    hubId: string;
    hubName: string;
    reason: string;
  };
  triggers: string[];              // What caused this decision
}

/**
 * Evaluate if a social group should migrate together.
 */
export function evaluateGroupMigration(
  group: SocialGroup,
  memberStates: Map<string, NPCSurvivalState>,
  _bonds: SocialBond[],
  context: {
    currentHubConditions: {
      food: NeedLevel;
      security: NeedLevel;
      economy: NeedLevel;
    };
    knownDestinations: Array<{
      hubId: string;
      hubName: string;
      reputation: number;  // 0-100, how good it seems
      distance: number;    // Days of travel
    }>;
  },
): GroupMigrationDecision {
  const triggers: string[] = [];
  const membersWilling: string[] = [];
  const membersReluctant: string[] = [];
  const membersBlocked: string[] = [];

  // Collect individual migration desires
  let totalDesire = 0;
  let totalInfluence = 0;

  for (const member of group.members) {
    const state = memberStates.get(member.npcId);
    if (!state) continue;

    totalInfluence += member.influence;

    if (state.migration.blocked) {
      membersBlocked.push(member.npcId);
      continue;
    }

    if (state.migration.desire >= 70) {
      membersWilling.push(member.npcId);
      totalDesire += state.migration.desire * member.influence;
    } else if (state.migration.desire >= 40) {
      membersReluctant.push(member.npcId);
      totalDesire += state.migration.desire * member.influence * 0.5;
    }
  }

  // Normalize desire
  const avgDesire = totalInfluence > 0 ? totalDesire / totalInfluence : 0;

  // Check for triggers
  if (context.currentHubConditions.food === 'desperate') {
    triggers.push('famine');
  }
  if (context.currentHubConditions.security === 'desperate') {
    triggers.push('violence');
  }
  if (membersWilling.length > group.members.length * 0.6) {
    triggers.push('majority_wants_to_leave');
  }

  // Leader influence
  const leader = group.members.find(m => m.role === 'leader');
  const leaderState = leader ? memberStates.get(leader.npcId) : undefined;
  const leaderWantsToLeave = (leaderState?.migration.desire ?? 0) >= 70;

  // Decision threshold
  // Need either: 70% desire + leader agreement, OR 90% desire
  const shouldMigrate =
    (avgDesire >= 70 && leaderWantsToLeave) ||
    (avgDesire >= 90) ||
    (triggers.includes('famine') && avgDesire >= 50) ||
    (triggers.includes('violence') && avgDesire >= 50);

  // Find best destination
  let destination: GroupMigrationDecision['destination'];
  if (shouldMigrate && context.knownDestinations.length > 0) {
    // Score destinations
    const scored = context.knownDestinations.map(d => ({
      ...d,
      score: d.reputation - (d.distance * 5),  // Closer is better
    })).sort((a, b) => b.score - a.score);

    if (scored[0]) {
      destination = {
        hubId: scored[0].hubId,
        hubName: scored[0].hubName,
        reason: triggers[0] ?? 'seeking_better_life',
      };
    }
  }

  return {
    groupId: group.id,
    shouldMigrate,
    consensusLevel: membersWilling.length / group.members.length,
    membersWilling,
    membersReluctant,
    membersBlocked,
    destination,
    triggers,
  };
}

// ============================================
// REFUGEE WAVE
// ============================================

export const RefugeeWaveSchema = z.object({
  id: z.string().uuid(),

  // Origin
  originHubId: z.string().uuid(),
  originHubName: z.string(),
  originRegionId: z.string().uuid(),

  // Cause
  cause: z.enum([
    'famine',
    'war',
    'monster_attack',
    'plague',
    'economic_collapse',
    'natural_disaster',
    'political_persecution',
    'religious_persecution',
  ]),
  causeDescription: z.string(),

  // Composition
  groups: z.array(z.object({
    groupId: z.string().uuid(),
    groupType: SocialGroupTypeSchema,
    memberCount: z.number().int(),
    hasLeader: z.boolean(),
  })),
  totalRefugees: z.number().int(),

  // Movement
  currentLocation: z.object({
    type: z.enum(['hub', 'route', 'wilderness']),
    nodeId: z.string().uuid(),
    nodeName: z.string(),
  }),
  destination: z.object({
    hubId: z.string().uuid(),
    hubName: z.string(),
    arrivalEstimate: z.string(),
  }).optional(),

  // State
  state: z.enum([
    'forming',      // Groups deciding to leave
    'departing',    // Leaving origin
    'traveling',    // On the road
    'arriving',     // Reaching destination
    'settling',     // Integrating into new place
    'dispersed',    // Wave has ended
  ]),

  // Condition
  condition: z.object({
    morale: z.number().int().min(0).max(100),
    health: z.number().int().min(0).max(100),
    supplies: z.number().int().min(0).max(100),
    cohesion: z.number().int().min(0).max(100),
  }),

  // History
  startedAt: z.string(),
  events: z.array(z.object({
    date: z.string(),
    type: z.string(),
    description: z.string(),
  })).default([]),
});
export type RefugeeWave = z.infer<typeof RefugeeWaveSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create initial survival state for an NPC.
 */
export function createSurvivalState(
  npcId: string,
  _role: string,
  wealthLevel: 'destitute' | 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic',
): NPCSurvivalState {
  const wealthDefaults = {
    destitute: { gold: 0, foodDays: 1, savings: 0, income: 5, expenses: 8 },
    poor: { gold: 5, foodDays: 3, savings: 1, income: 15, expenses: 14 },
    modest: { gold: 20, foodDays: 7, savings: 4, income: 30, expenses: 25 },
    comfortable: { gold: 100, foodDays: 14, savings: 12, income: 75, expenses: 50 },
    wealthy: { gold: 500, foodDays: 30, savings: 52, income: 200, expenses: 100 },
    aristocratic: { gold: 2000, foodDays: 60, savings: 200, income: 500, expenses: 300 },
  };

  const defaults = wealthDefaults[wealthLevel];

  const baseNeeds = {
    destitute: 20,
    poor: 40,
    modest: 60,
    comfortable: 75,
    wealthy: 85,
    aristocratic: 95,
  }[wealthLevel];

  return {
    npcId,
    needs: {
      food: baseNeeds,
      water: baseNeeds + 10,
      shelter: wealthLevel === 'destitute' ? 10 : baseNeeds,
      health: baseNeeds,
      security: baseNeeds - 10,
      stability: baseNeeds,
      income: baseNeeds,
      family: 50,
      community: 50,
      faith: 50,
      reputation: baseNeeds - 20,
      achievement: 50,
      autonomy: 50,
      purpose: 50,
      growth: 50,
    },
    resources: {
      gold: defaults.gold,
      foodDays: defaults.foodDays,
      hasHome: wealthLevel !== 'destitute',
      hasJob: wealthLevel !== 'destitute',
    },
    economics: {
      weeklyIncome: defaults.income,
      weeklyExpenses: defaults.expenses,
      debt: 0,
      savingsWeeks: defaults.savings,
    },
    state: {
      isEmployed: wealthLevel !== 'destitute',
      isHomeless: wealthLevel === 'destitute',
      isHungry: wealthLevel === 'destitute',
      isStarving: false,
      isSick: false,
      isInjured: false,
      isInDebt: false,
      isBegging: wealthLevel === 'destitute',
      isStealing: false,
      wantsToMigrate: false,
    },
    desperation: {
      level: wealthLevel === 'destitute' ? 60 : 0,
      daysWithoutFood: 0,
      daysWithoutShelter: wealthLevel === 'destitute' ? 30 : 0,
      daysUnemployed: wealthLevel === 'destitute' ? 60 : 0,
      timesBegged: 0,
      timesStole: 0,
      crimeEscalation: 0,
    },
    migration: {
      desire: 0,
      blocked: false,
      willingToJoinGroup: true,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Build social groups from bonds.
 */
export function buildSocialGroups(
  hubId: string,
  hubName: string,
  bonds: SocialBond[],
  npcNames: Map<string, string>,
): SocialGroup[] {
  const groups: SocialGroup[] = [];
  const processedNpcs = new Set<string>();

  // Find family groups
  const familyBonds = bonds.filter(b =>
    ['spouse', 'parent', 'child', 'sibling'].includes(b.type)
  );

  // Build connected components for families
  const familyGraph = new Map<string, Set<string>>();
  for (const bond of familyBonds) {
    if (!familyGraph.has(bond.npcId)) familyGraph.set(bond.npcId, new Set());
    if (!familyGraph.has(bond.targetId)) familyGraph.set(bond.targetId, new Set());
    familyGraph.get(bond.npcId)!.add(bond.targetId);
    familyGraph.get(bond.targetId)!.add(bond.npcId);
  }

  // DFS to find family components
  const visited = new Set<string>();
  for (const npcId of familyGraph.keys()) {
    if (visited.has(npcId)) continue;

    const component: string[] = [];
    const stack = [npcId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);

      const neighbors = familyGraph.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    if (component.length >= 2) {
      // Find head of household (eldest parent or highest earner - simplified to first parent)
      const leader = component[0];

      groups.push({
        id: crypto.randomUUID(),
        type: 'family',
        name: `${npcNames.get(leader) ?? 'Unknown'} family`,
        members: component.map((id, idx) => ({
          npcId: id,
          npcName: npcNames.get(id) ?? 'Unknown',
          role: idx === 0 ? 'leader' : 'member',
          influence: idx === 0 ? 0.4 : 0.6 / (component.length - 1),
        })),
        hubId,
        hubName,
        state: {
          cohesion: 80,
          morale: 60,
          resources: 0,
        },
        migration: {
          collectiveDesire: 0,
          hasDecidedToMigrate: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      component.forEach(id => processedNpcs.add(id));
    }
  }

  return groups;
}
