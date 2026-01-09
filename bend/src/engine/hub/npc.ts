import { z } from 'zod';
import { SeededRNG } from './topology';
import { DistrictType, BuildingType, Hub } from './schema';

// Hub type used in NPCMetadata references

// ============================================
// NPC EXTENSION SCHEMA
// ============================================
//
// PHILOSOPHY:
// An NPC is a Character with isNPC = true.
// They use the SAME skill system, magic system, and progression.
// The difference is WHO controls them (DM/AI vs Player).
//
// "What's an NPC? They have a stat block...
//  we're giving them a skill system and a way to ascend."
//
// NPCs can:
// - Learn skills through action (same discovery system)
// - Cast spells (same magic/lore/entropy system)
// - Level up (same XP progression)
// - Own property, join factions, have relationships
//

// ============================================
// NPC-SPECIFIC TRAITS (extends Character)
// ============================================
//
// These fields are stored in Character.metadata
// when isNPC = true.
//

export const NPCRoleSchema = z.enum([
  // Service
  'innkeeper',
  'bartender',
  'merchant',
  'blacksmith',
  'apothecary',
  'healer',
  'stablehand',
  'banker',

  // Civic
  'guard',
  'official',
  'judge',
  'mayor',
  'noble',
  'servant',

  // Religious
  'priest',
  'acolyte',
  'monk',

  // Criminal
  'thief',
  'fence',
  'smuggler',
  'assassin',

  // Labor
  'farmer',
  'miner',
  'fisher',
  'craftsman',
  'laborer',

  // Scholarly
  'sage',
  'librarian',
  'teacher',
  'mage',
  'alchemist',

  // Entertainment
  'bard',
  'actor',
  'courtesan',
  'gambler',

  // Military
  'soldier',
  'mercenary',
  'knight',
  'captain',

  // Other
  'beggar',
  'child',
  'elder',
  'traveler',
  'adventurer',

  // Additional roles for district variety
  'sailor',
  'pilgrim',
  'apprentice',
  'gardener',
  'gravedigger',
]);
export type NPCRole = z.infer<typeof NPCRoleSchema>;

export const NPCDispositionSchema = z.enum([
  'hostile',     // Will attack on sight
  'unfriendly',  // Distrustful, unhelpful
  'indifferent', // Neutral, transactional
  'friendly',    // Helpful, talkative
  'loyal',       // Will assist actively
]);
export type NPCDisposition = z.infer<typeof NPCDispositionSchema>;

export const NPCMetadataSchema = z.object({
  // Role and occupation
  role: NPCRoleSchema,
  occupation: z.string().optional(),  // Specific job: "Fishmonger", "Court Wizard"

  // Location
  homeHubId: z.string().uuid(),
  homeDistrictId: z.string().uuid().optional(),
  homeBuildingId: z.string().uuid().optional(),
  workBuildingId: z.string().uuid().optional(),

  // Schedule
  schedule: z.object({
    // Where they are at what hour (0-23)
    // Key is hour, value is building ID or "roaming"
    hourly: z.record(z.string(), z.string()).optional(),

    // Weekly variations
    restDays: z.array(z.string()).default([]),  // "Godsday", etc.

    // Special schedules
    sleepHours: z.object({
      start: z.number().int().min(0).max(23).default(22),
      end: z.number().int().min(0).max(23).default(6),
    }).default({ start: 22, end: 6 }),
  }).optional(),

  // Personality
  personality: z.object({
    traits: z.array(z.string()).default([]),  // "greedy", "kind", "suspicious"
    ideals: z.array(z.string()).default([]),
    bonds: z.array(z.string()).default([]),
    flaws: z.array(z.string()).default([]),
  }).optional(),

  // Disposition toward player (can change)
  disposition: NPCDispositionSchema.default('indifferent'),

  // Relationship tracking
  relationships: z.array(z.object({
    characterId: z.string().uuid(),
    type: z.enum(['family', 'friend', 'rival', 'enemy', 'romantic', 'employer', 'employee', 'business']),
    strength: z.number().int().min(-100).max(100),  // -100 = hatred, 100 = devotion
    notes: z.string().optional(),
  })).default([]),

  // Faction memberships (references FactionPresence edges)
  factionMemberships: z.array(z.object({
    factionId: z.string().uuid(),
    rank: z.string(),
    isSecret: z.boolean().default(false),
  })).default([]),

  // Quest/Hook potential
  questHooks: z.array(z.object({
    hookId: z.string(),
    type: z.enum(['quest', 'rumor', 'information', 'service']),
    unlockCondition: z.string().optional(),  // "disposition >= friendly"
    consumed: z.boolean().default(false),
  })).default([]),

  // Dialogue state
  dialogueState: z.object({
    knownTopics: z.array(z.string()).default([]),
    revealedSecrets: z.array(z.string()).default([]),
    lastConversation: z.date().optional(),
    conversationCount: z.number().int().default(0),
  }).optional(),

  // Commerce (if merchant)
  commerce: z.object({
    sellsItems: z.array(z.string()).default([]),  // Item categories or IDs
    buysItems: z.array(z.string()).default([]),
    priceModifier: z.number().default(1.0),  // 0.9 = 10% cheaper
    restockDays: z.array(z.string()).default([]),
  }).optional(),

  // Services (if service provider)
  services: z.array(z.object({
    type: z.string(),  // "healing", "identify", "training"
    cost: z.number().int(),
    description: z.string().optional(),
  })).default([]),

  // Importance
  importance: z.enum([
    'background',  // Generic townsperson
    'minor',       // Has a name, some role
    'notable',     // Important to settlement
    'major',       // Plot-relevant
    'legendary',   // World-shaping
  ]).default('background'),

  // Generation metadata
  generatedFromSeed: z.string().optional(),
  isGenerated: z.boolean().default(true),  // vs manually created
});
export type NPCMetadata = z.infer<typeof NPCMetadataSchema>;

// ============================================
// NPC GENERATION
// ============================================

export interface NPCGenerationContext {
  hubId: string;
  districtId: string;
  districtType: DistrictType;
  buildingId?: string;
  buildingType?: BuildingType;
  role?: NPCRole;
  importance?: NPCMetadata['importance'];
}

// Role distribution by district type
const ROLE_WEIGHTS: Record<DistrictType, Partial<Record<NPCRole, number>>> = {
  center: {
    merchant: 20, official: 10, guard: 10, noble: 5, servant: 10,
    craftsman: 10, innkeeper: 5, bartender: 5, bard: 5, traveler: 10,
  },
  residential: {
    craftsman: 15, laborer: 15, farmer: 10, child: 10, elder: 10,
    servant: 10, merchant: 5, beggar: 5, traveler: 5, priest: 5,
  },
  commercial: {
    merchant: 30, craftsman: 15, banker: 5, innkeeper: 10, bartender: 10,
    servant: 5, guard: 5, traveler: 10, fence: 5, gambler: 5,
  },
  industrial: {
    craftsman: 25, laborer: 30, blacksmith: 15, miner: 10, farmer: 5,
    merchant: 5, guard: 5, beggar: 5,
  },
  religious: {
    priest: 25, acolyte: 20, monk: 15, healer: 10, beggar: 10,
    elder: 5, sage: 5, pilgrim: 10,
  },
  administrative: {
    official: 25, guard: 20, noble: 10, judge: 10, servant: 10,
    merchant: 5, sage: 10, soldier: 10,
  },
  noble: {
    noble: 20, servant: 30, guard: 15, knight: 10, bard: 5,
    courtesan: 5, sage: 5, merchant: 10,
  },
  slums: {
    beggar: 20, thief: 15, laborer: 15, fence: 10, smuggler: 10,
    gambler: 10, courtesan: 5, child: 10, assassin: 5,
  },
  docks: {
    laborer: 20, merchant: 15, sailor: 15, fisher: 15, smuggler: 10,
    innkeeper: 5, bartender: 10, traveler: 10,
  },
  military: {
    soldier: 30, guard: 20, knight: 10, captain: 5, blacksmith: 10,
    servant: 10, mercenary: 10, stablehand: 5,
  },
  academic: {
    sage: 25, librarian: 15, teacher: 15, mage: 10, alchemist: 10,
    acolyte: 10, noble: 5, servant: 10,
  },
  entertainment: {
    bard: 20, actor: 15, courtesan: 15, gambler: 15, bartender: 15,
    innkeeper: 10, thief: 5, traveler: 5,
  },
  magical: {
    mage: 30, alchemist: 15, sage: 15, acolyte: 10, merchant: 10,
    servant: 10, apprentice: 10,
  },
  foreign: {
    merchant: 25, traveler: 20, courtesan: 10, innkeeper: 10,
    priest: 5, bard: 10, smuggler: 10, guard: 10,
  },
  garden: {
    noble: 20, servant: 25, guard: 15, gardener: 20, priest: 5,
    child: 10, elder: 5,
  },
  necropolis: {
    priest: 20, acolyte: 15, beggar: 15, elder: 15, guard: 10,
    sage: 10, monk: 10, gravedigger: 5,
  },
};

// Note: sailor, pilgrim, apprentice, gardener, gravedigger are now in NPCRoleSchema
// and used directly in ROLE_WEIGHTS above

export class NPCGenerator {
  private rng: SeededRNG;

  constructor(seed: string) {
    this.rng = new SeededRNG(seed);
  }

  /**
   * Generate NPC metadata for a new NPC.
   * The caller creates the Character with isNPC=true,
   * this provides the NPC-specific fields.
   */
  generateMetadata(context: NPCGenerationContext): NPCMetadata {
    const role = context.role ?? this.pickRole(context.districtType);
    const importance = context.importance ?? this.pickImportance();

    // Generate schedule based on role
    const schedule = this.generateSchedule(role, context);

    // Generate personality
    const personality = this.generatePersonality(role);

    // Generate commerce if merchant
    const commerce = this.isCommercialRole(role)
      ? this.generateCommerce(role, context.districtType)
      : undefined;

    // Generate services if service provider
    const services = this.isServiceRole(role)
      ? this.generateServices(role)
      : [];

    return {
      role,
      occupation: this.generateOccupation(role, context.districtType),
      homeHubId: context.hubId,
      homeDistrictId: context.districtId,
      homeBuildingId: context.buildingId,
      workBuildingId: context.buildingId,
      schedule,
      personality,
      disposition: 'indifferent',
      relationships: [],
      factionMemberships: [],
      questHooks: [],
      dialogueState: {
        knownTopics: [],
        revealedSecrets: [],
        lastConversation: undefined,
        conversationCount: 0,
      },
      commerce,
      services,
      importance,
      generatedFromSeed: `${context.hubId}_${context.districtId}_${this.rng.next()}`,
      isGenerated: true,
    };
  }

  /**
   * Pick a role based on district type.
   */
  private pickRole(districtType: DistrictType): NPCRole {
    const weights = ROLE_WEIGHTS[districtType];
    const roles = Object.keys(weights) as NPCRole[];
    const roleWeights = roles.map(r => weights[r] ?? 1);

    return this.rng.weightedPick(roles, roleWeights);
  }

  /**
   * Pick importance level.
   */
  private pickImportance(): NPCMetadata['importance'] {
    const roll = this.rng.next() * 100;
    if (roll < 60) return 'background';
    if (roll < 85) return 'minor';
    if (roll < 95) return 'notable';
    if (roll < 99) return 'major';
    return 'legendary';
  }

  /**
   * Generate a schedule for an NPC.
   */
  private generateSchedule(
    role: NPCRole,
    context: NPCGenerationContext
  ): NPCMetadata['schedule'] {
    const hourly: Record<string, string> = {};

    // Default: at work during day, home at night
    const workBuilding = context.buildingId ?? 'roaming';
    const homeBuilding = context.buildingId ?? 'home';

    // Work hours by role (handles overnight wrapping)
    const workHours = this.getWorkHours(role);

    // Sleep hours also wrap overnight (22-6 means 22,23,0,1,2,3,4,5)
    const isSleepHour = (h: number) => h >= 22 || h < 6;

    for (let h = 0; h < 24; h++) {
      if (this.isWorkHour(h, workHours)) {
        hourly[h.toString()] = workBuilding;
      } else if (isSleepHour(h)) {
        hourly[h.toString()] = homeBuilding;
      } else {
        hourly[h.toString()] = this.rng.next() < 0.3 ? 'roaming' : homeBuilding;
      }
    }

    return {
      hourly,
      restDays: this.rng.next() < 0.5 ? ['Godsday'] : [],
      sleepHours: { start: 22, end: 6 },
    };
  }

  private getWorkHours(role: NPCRole): { start: number; end: number; overnight: boolean } {
    const earlyWorkers: NPCRole[] = ['farmer', 'fisher', 'laborer', 'miner'];
    const lateWorkers: NPCRole[] = ['bartender', 'courtesan', 'gambler', 'thief', 'assassin'];
    const allDayWorkers: NPCRole[] = ['guard', 'soldier', 'innkeeper'];

    if (earlyWorkers.includes(role)) return { start: 5, end: 14, overnight: false };
    if (lateWorkers.includes(role)) return { start: 18, end: 2, overnight: true }; // 6pm to 2am
    if (allDayWorkers.includes(role)) return { start: 6, end: 22, overnight: false };
    return { start: 8, end: 18, overnight: false };
  }

  /**
   * Check if a given hour falls within work hours (handles overnight wrap).
   */
  private isWorkHour(hour: number, workHours: { start: number; end: number; overnight: boolean }): boolean {
    if (workHours.overnight) {
      // Overnight shift: e.g., 18-2 means 18,19,20,21,22,23,0,1
      return hour >= workHours.start || hour < workHours.end;
    } else {
      // Normal shift: e.g., 8-18 means 8,9,10,...,17
      return hour >= workHours.start && hour < workHours.end;
    }
  }

  /**
   * Generate personality traits.
   */
  private generatePersonality(role: NPCRole): NPCMetadata['personality'] {
    const traits = this.pickTraits(role, 2);
    const ideals = this.pickIdeals(role, 1);
    const bonds = this.pickBonds(role, 1);
    const flaws = this.pickFlaws(role, 1);

    return { traits, ideals, bonds, flaws };
  }

  private pickTraits(_role: NPCRole, count: number): string[] {
    void _role; // Reserved for role-influenced weights
    const allTraits = [
      'kind', 'cruel', 'greedy', 'generous', 'suspicious', 'trusting',
      'brave', 'cowardly', 'honest', 'deceitful', 'proud', 'humble',
      'patient', 'impatient', 'curious', 'incurious', 'jovial', 'dour',
      'talkative', 'taciturn', 'religious', 'skeptical', 'superstitious',
    ];

    // Role-influenced weights would go here
    return this.rng.shuffle(allTraits).slice(0, count);
  }

  private pickIdeals(_role: NPCRole, count: number): string[] {
    void _role; // Reserved for role-influenced weights
    const allIdeals = [
      'Justice', 'Freedom', 'Tradition', 'Progress', 'Power', 'Knowledge',
      'Faith', 'Family', 'Wealth', 'Honor', 'Adventure', 'Peace',
    ];
    return this.rng.shuffle(allIdeals).slice(0, count);
  }

  private pickBonds(_role: NPCRole, count: number): string[] {
    void _role; // Reserved for role-influenced weights
    const allBonds = [
      'Family above all', 'Loyal to my employer', 'Devoted to my faith',
      'Protecting the innocent', 'Seeking revenge', 'Building a legacy',
      'Repaying a debt', 'Finding lost love', 'Serving my lord',
    ];
    return this.rng.shuffle(allBonds).slice(0, count);
  }

  private pickFlaws(_role: NPCRole, count: number): string[] {
    void _role; // Reserved for role-influenced weights
    const allFlaws = [
      'Addicted to gambling', 'Drinks too much', 'Quick to anger',
      'Holds grudges', 'Too trusting', 'Paranoid', 'Greedy',
      'Cowardly when tested', 'Secret shame', 'Forbidden love',
    ];
    return this.rng.shuffle(allFlaws).slice(0, count);
  }

  /**
   * Generate occupation title.
   */
  private generateOccupation(role: NPCRole, _district: DistrictType): string {
    void _district; // Reserved for district-influenced occupation titles
    const occupations: Partial<Record<NPCRole, string[]>> = {
      merchant: ['Trader', 'Shopkeeper', 'Peddler', 'Dealer', 'Vendor'],
      blacksmith: ['Smith', 'Armorer', 'Weaponsmith', 'Farrier'],
      craftsman: ['Carpenter', 'Potter', 'Weaver', 'Cobbler', 'Tailor'],
      guard: ['Watchman', 'Sentry', 'Gate Guard', 'Night Watch'],
      priest: ['Cleric', 'Pastor', 'Father', 'Mother', 'High Priest'],
      mage: ['Wizard', 'Sorcerer', 'Enchanter', 'Conjurer'],
      noble: ['Lord', 'Lady', 'Baron', 'Baroness', 'Count', 'Countess'],
      thief: ['Cutpurse', 'Pickpocket', 'Burglar', 'Footpad'],
    };

    const options = occupations[role];
    if (options) {
      return this.rng.pick(options);
    }

    // Capitalize role as fallback
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  /**
   * Check if role is commercial.
   */
  private isCommercialRole(role: NPCRole): boolean {
    return ['merchant', 'blacksmith', 'apothecary', 'banker', 'innkeeper', 'fence'].includes(role);
  }

  /**
   * Check if role is service-providing.
   */
  private isServiceRole(role: NPCRole): boolean {
    return ['healer', 'priest', 'mage', 'alchemist', 'sage', 'teacher', 'blacksmith'].includes(role);
  }

  /**
   * Generate commerce data for merchants.
   */
  private generateCommerce(
    role: NPCRole,
    _district: DistrictType
  ): NPCMetadata['commerce'] {
    void _district; // Reserved for district-influenced inventory
    const baseItems: Record<string, string[]> = {
      merchant: ['general', 'supplies'],
      blacksmith: ['weapons', 'armor', 'tools'],
      apothecary: ['potions', 'ingredients', 'herbs'],
      innkeeper: ['food', 'drink', 'lodging'],
      fence: ['stolen_goods', 'contraband'],
      banker: ['currency_exchange', 'loans'],
    };

    return {
      sellsItems: baseItems[role] ?? ['general'],
      buysItems: ['all'],
      priceModifier: 0.9 + this.rng.next() * 0.3,  // 0.9 to 1.2
      restockDays: ['Moonday', 'Starday'],
    };
  }

  /**
   * Generate services for service providers.
   */
  private generateServices(role: NPCRole): NPCMetadata['services'] {
    const services: NPCMetadata['services'] = [];

    switch (role) {
      case 'healer':
      case 'priest':
        services.push(
          { type: 'healing', cost: 10, description: 'Cure minor wounds' },
          { type: 'cure_disease', cost: 50, description: 'Cure common diseases' },
        );
        if (role === 'priest') {
          services.push(
            { type: 'blessing', cost: 5, description: 'Receive a blessing' },
            { type: 'funeral', cost: 25, description: 'Last rites' },
          );
        }
        break;

      case 'mage':
      case 'alchemist':
        services.push(
          { type: 'identify', cost: 25, description: 'Identify magical item' },
          { type: 'enchant', cost: 100, description: 'Minor enchantment' },
        );
        if (role === 'alchemist') {
          services.push(
            { type: 'brew_potion', cost: 50, description: 'Brew custom potion' },
          );
        }
        break;

      case 'sage':
        services.push(
          { type: 'research', cost: 20, description: 'Research a topic (1 day)' },
          { type: 'translate', cost: 10, description: 'Translate document' },
          { type: 'lore', cost: 15, description: 'Answer lore question' },
        );
        break;

      case 'teacher':
        services.push(
          { type: 'training', cost: 50, description: 'Skill training (1 week)' },
          { type: 'tutoring', cost: 10, description: 'Language lesson' },
        );
        break;

      case 'blacksmith':
        services.push(
          { type: 'repair', cost: 5, description: 'Repair equipment' },
          { type: 'sharpen', cost: 2, description: 'Sharpen weapon' },
          { type: 'forge', cost: 25, description: 'Forge custom item' },
        );
        break;
    }

    return services;
  }
}

// ============================================
// NAME GENERATION
// ============================================

export class NPCNameGenerator {
  private rng: SeededRNG;

  constructor(seed: string) {
    this.rng = new SeededRNG(seed);
  }

  /**
   * Generate a name based on race and gender.
   * This is a simplified version - production would have
   * full cultural name databases.
   */
  generate(race: string, gender: 'male' | 'female' | 'other'): { first: string; last: string } {
    const names = this.getNamesByRace(race);
    const genderNames = gender === 'male' ? names.male :
                        gender === 'female' ? names.female :
                        this.rng.pick([names.male, names.female]);

    return {
      first: this.rng.pick(genderNames),
      last: this.rng.pick(names.surnames),
    };
  }

  private getNamesByRace(race: string): { male: string[]; female: string[]; surnames: string[] } {
    // Simplified - would be much larger in production
    const databases: Record<string, { male: string[]; female: string[]; surnames: string[] }> = {
      human: {
        male: ['Aldric', 'Bran', 'Cedric', 'Dorian', 'Edmund', 'Felix', 'Gareth', 'Hugo', 'Ivan', 'Jasper'],
        female: ['Alena', 'Brynn', 'Cora', 'Diana', 'Elena', 'Fiona', 'Gwen', 'Helena', 'Iris', 'Julia'],
        surnames: ['Ashford', 'Blackwood', 'Coldwell', 'Drake', 'Everhart', 'Fairfax', 'Grimsby', 'Holloway', 'Ironwood', 'Jarvis'],
      },
      dwarf: {
        male: ['Balin', 'Dain', 'Farin', 'Gimli', 'Kili', 'Nain', 'Oin', 'Thorin', 'Thrain', 'Durin'],
        female: ['Disa', 'Hilda', 'Sigrid', 'Thora', 'Frida', 'Helga', 'Ingrid', 'Astrid', 'Brunhild', 'Gerda'],
        surnames: ['Ironforge', 'Stonehammer', 'Goldvein', 'Deepdelve', 'Copperpick', 'Steelbeard', 'Granitebrow', 'Bronzefist', 'Silveraxe', 'Rubyeye'],
      },
      elf: {
        male: ['Aelindel', 'Caelum', 'Elowen', 'Faelar', 'Galathil', 'Ithildir', 'Lorien', 'Naeris', 'Silvain', 'Thalion'],
        female: ['Aelindra', 'Caelia', 'Elowyn', 'Faelara', 'Galadriel', 'Ithilwen', 'Lorena', 'Naerith', 'Silvara', 'Thalindra'],
        surnames: ['Starweaver', 'Moonwhisper', 'Dawntracker', 'Nightbreeze', 'Sunsinger', 'Leafwalker', 'Streamdancer', 'Windrunner', 'Forestborn', 'Silverglade'],
      },
      halfling: {
        male: ['Bilbo', 'Frodo', 'Merry', 'Pippin', 'Sam', 'Bandobras', 'Drogo', 'Fosco', 'Largo', 'Polo'],
        female: ['Rosie', 'Lobelia', 'Primula', 'Esmeralda', 'Petunia', 'Daffodil', 'Marigold', 'Pansy', 'Daisy', 'Lily'],
        surnames: ['Baggins', 'Took', 'Brandybuck', 'Gamgee', 'Proudfoot', 'Burrows', 'Cotton', 'Goodbody', 'Hornblower', 'Underhill'],
      },
    };

    return databases[race.toLowerCase()] ?? databases.human;
  }
}

// ============================================
// NPC POPULATION
// ============================================

export interface PopulationConfig {
  hub: Hub;
  populationTarget: number;
  importanceDistribution: {
    background: number;  // e.g., 0.7 = 70% background NPCs
    minor: number;
    notable: number;
    major: number;
    legendary: number;
  };
}

export class NPCPopulator {
  private generator: NPCGenerator;
  private nameGenerator: NPCNameGenerator;
  private rng: SeededRNG;

  constructor(seed: string) {
    this.generator = new NPCGenerator(seed);
    this.nameGenerator = new NPCNameGenerator(seed);
    this.rng = new SeededRNG(seed + '_populator');
  }

  /**
   * Generate NPC metadata for populating a hub.
   * Returns a list of NPC metadata objects to be used
   * when creating Character entries with isNPC=true.
   */
  populateHub(config: PopulationConfig): Array<{
    name: { first: string; last: string };
    metadata: NPCMetadata;
    districtId: string;
    buildingId?: string;
  }> {
    const npcs: Array<{
      name: { first: string; last: string };
      metadata: NPCMetadata;
      districtId: string;
      buildingId?: string;
    }> = [];

    const { hub, populationTarget, importanceDistribution } = config;

    // Distribute population across districts proportionally
    for (const district of hub.districts) {
      const districtPop = Math.floor(
        populationTarget * (district.chunkCoords.length /
          (hub.chunkGrid.width * hub.chunkGrid.height))
      );

      const context: NPCGenerationContext = {
        hubId: hub.worldNodeId,
        districtId: district.id,
        districtType: district.type,
      };

      // Generate NPCs for this district
      for (let i = 0; i < districtPop; i++) {
        // Determine importance using seeded RNG
        const roll = this.rng.next();
        let importance: NPCMetadata['importance'] = 'background';
        let cumulative = 0;
        for (const [imp, weight] of Object.entries(importanceDistribution)) {
          cumulative += weight;
          if (roll < cumulative) {
            importance = imp as NPCMetadata['importance'];
            break;
          }
        }

        const metadata = this.generator.generateMetadata({
          ...context,
          importance,
        });

        // Pick a random race (weighted toward human) using seeded RNG
        const races = ['human', 'human', 'human', 'dwarf', 'elf', 'halfling'];
        const race = this.rng.pick(races);
        const gender = this.rng.next() < 0.5 ? 'male' : 'female';

        const name = this.nameGenerator.generate(race, gender);

        npcs.push({
          name,
          metadata,
          districtId: district.id,
        });
      }
    }

    return npcs;
  }
}
