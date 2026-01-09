import { z } from 'zod';
import { HubGraph } from './graph';
import { NPCMetadata, NPCRole } from './npc';
import { SeededRNG } from './topology';

// ============================================
// NPC SCHEDULING SYSTEM
// ============================================
//
// NPCs follow schedules that determine where they are
// at any given time. This enables:
// - Finding NPCs when players need them
// - NPC encounters during travel
// - Living world feel (shops close at night)
// - Plot timing (catch the merchant before dawn)
//

// ============================================
// TIME SYSTEM
// ============================================

export interface GameTime {
  year: number;
  month: number;     // 1-12
  day: number;       // 1-30 (simplified)
  hour: number;      // 0-23
  minute: number;    // 0-59
  dayOfWeek: number; // 0-6 (mapped to campaign calendar)
}

export const TIME_PERIODS = {
  DAWN: { start: 5, end: 7 },
  MORNING: { start: 7, end: 12 },
  AFTERNOON: { start: 12, end: 17 },
  EVENING: { start: 17, end: 21 },
  NIGHT: { start: 21, end: 5 },
} as const;

export function getTimePeriod(hour: number): keyof typeof TIME_PERIODS {
  if (hour >= 5 && hour < 7) return 'DAWN';
  if (hour >= 7 && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 17) return 'AFTERNOON';
  if (hour >= 17 && hour < 21) return 'EVENING';
  return 'NIGHT';
}

// ============================================
// NPC LOCATION STATE
// ============================================

export const NPCLocationStateSchema = z.object({
  npcId: z.string().uuid(),
  hubId: z.string().uuid(),

  // Current position
  currentNodeId: z.string().uuid(),
  currentActivity: z.enum([
    'working',
    'sleeping',
    'eating',
    'roaming',
    'shopping',
    'socializing',
    'traveling',
    'patrolling',
    'praying',
    'idle',
  ]),

  // Path if traveling
  pathToDestination: z.array(z.string().uuid()).optional(),
  destinationNodeId: z.string().uuid().optional(),
  pathProgress: z.number().min(0).max(1).optional(),

  // Schedule state
  currentScheduleSlot: z.string().optional(),
  nextScheduleChange: z.number().int().optional(),  // Timestamp

  // Availability
  isAvailable: z.boolean().default(true),  // Can be interacted with
  busyReason: z.string().optional(),

  // Last update
  lastUpdatedAt: z.date(),
});
export type NPCLocationState = z.infer<typeof NPCLocationStateSchema>;

// ============================================
// SCHEDULE TEMPLATES
// ============================================

export interface ScheduleSlot {
  startHour: number;
  endHour: number;
  activity: NPCLocationState['currentActivity'];
  locationPreference: 'work' | 'home' | 'tavern' | 'temple' | 'market' | 'roaming';
  probability: number;  // Chance they follow this slot (vs roaming)
}

// Default schedules by role
export const ROLE_SCHEDULES: Record<NPCRole, ScheduleSlot[]> = {
  // Service workers - early to late
  innkeeper: [
    { startHour: 6, endHour: 23, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 23, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  bartender: [
    { startHour: 16, endHour: 2, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 2, endHour: 10, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
    { startHour: 10, endHour: 16, activity: 'idle', locationPreference: 'home', probability: 0.7 },
  ],
  merchant: [
    { startHour: 8, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 18, endHour: 20, activity: 'eating', locationPreference: 'tavern', probability: 0.5 },
    { startHour: 20, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.4 },
    { startHour: 22, endHour: 8, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  blacksmith: [
    { startHour: 6, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 18, endHour: 20, activity: 'eating', locationPreference: 'tavern', probability: 0.6 },
    { startHour: 20, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.5 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],

  // Guards - shift work
  guard: [
    { startHour: 6, endHour: 14, activity: 'patrolling', locationPreference: 'roaming', probability: 0.8 },
    { startHour: 14, endHour: 22, activity: 'patrolling', locationPreference: 'roaming', probability: 0.8 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.7 },
  ],

  // Religious - temple-focused
  priest: [
    { startHour: 5, endHour: 7, activity: 'praying', locationPreference: 'temple', probability: 0.95 },
    { startHour: 7, endHour: 12, activity: 'working', locationPreference: 'temple', probability: 0.8 },
    { startHour: 12, endHour: 13, activity: 'eating', locationPreference: 'temple', probability: 0.7 },
    { startHour: 13, endHour: 17, activity: 'working', locationPreference: 'temple', probability: 0.8 },
    { startHour: 17, endHour: 19, activity: 'praying', locationPreference: 'temple', probability: 0.9 },
    { startHour: 19, endHour: 22, activity: 'socializing', locationPreference: 'temple', probability: 0.6 },
    { startHour: 22, endHour: 5, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],

  // Criminals - night active
  thief: [
    { startHour: 22, endHour: 4, activity: 'working', locationPreference: 'roaming', probability: 0.7 },
    { startHour: 4, endHour: 12, activity: 'sleeping', locationPreference: 'home', probability: 0.8 },
    { startHour: 12, endHour: 16, activity: 'idle', locationPreference: 'home', probability: 0.6 },
    { startHour: 16, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.5 },
  ],

  // Default for unlisted roles
  laborer: [
    { startHour: 6, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 18, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.4 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],

  // Fill in remaining roles with sensible defaults
  apothecary: [
    { startHour: 8, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 18, endHour: 22, activity: 'idle', locationPreference: 'home', probability: 0.7 },
    { startHour: 22, endHour: 8, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  healer: [
    { startHour: 7, endHour: 20, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 20, endHour: 7, activity: 'sleeping', locationPreference: 'home', probability: 0.8 },
  ],
  stablehand: [
    { startHour: 5, endHour: 19, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 19, endHour: 5, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  banker: [
    { startHour: 9, endHour: 17, activity: 'working', locationPreference: 'work', probability: 0.95 },
    { startHour: 17, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.3 },
    { startHour: 22, endHour: 9, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  official: [
    { startHour: 8, endHour: 17, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 17, endHour: 22, activity: 'socializing', locationPreference: 'home', probability: 0.5 },
    { startHour: 22, endHour: 8, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  judge: [
    { startHour: 9, endHour: 17, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 17, endHour: 22, activity: 'idle', locationPreference: 'home', probability: 0.8 },
    { startHour: 22, endHour: 9, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  mayor: [
    { startHour: 9, endHour: 17, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 17, endHour: 22, activity: 'socializing', locationPreference: 'home', probability: 0.6 },
    { startHour: 22, endHour: 9, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  noble: [
    { startHour: 10, endHour: 12, activity: 'eating', locationPreference: 'home', probability: 0.7 },
    { startHour: 12, endHour: 17, activity: 'socializing', locationPreference: 'roaming', probability: 0.5 },
    { startHour: 17, endHour: 20, activity: 'eating', locationPreference: 'home', probability: 0.6 },
    { startHour: 20, endHour: 24, activity: 'socializing', locationPreference: 'tavern', probability: 0.4 },
    { startHour: 0, endHour: 10, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  servant: [
    { startHour: 5, endHour: 22, activity: 'working', locationPreference: 'work', probability: 0.95 },
    { startHour: 22, endHour: 5, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  acolyte: [
    { startHour: 5, endHour: 7, activity: 'praying', locationPreference: 'temple', probability: 0.95 },
    { startHour: 7, endHour: 20, activity: 'working', locationPreference: 'temple', probability: 0.9 },
    { startHour: 20, endHour: 5, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  monk: [
    { startHour: 4, endHour: 6, activity: 'praying', locationPreference: 'temple', probability: 0.95 },
    { startHour: 6, endHour: 20, activity: 'working', locationPreference: 'temple', probability: 0.85 },
    { startHour: 20, endHour: 4, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  fence: [
    { startHour: 20, endHour: 2, activity: 'working', locationPreference: 'work', probability: 0.8 },
    { startHour: 2, endHour: 12, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
    { startHour: 12, endHour: 20, activity: 'socializing', locationPreference: 'tavern', probability: 0.5 },
  ],
  smuggler: [
    { startHour: 22, endHour: 4, activity: 'working', locationPreference: 'roaming', probability: 0.7 },
    { startHour: 4, endHour: 14, activity: 'sleeping', locationPreference: 'home', probability: 0.8 },
    { startHour: 14, endHour: 22, activity: 'idle', locationPreference: 'tavern', probability: 0.5 },
  ],
  assassin: [
    { startHour: 22, endHour: 4, activity: 'working', locationPreference: 'roaming', probability: 0.6 },
    { startHour: 4, endHour: 14, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
    { startHour: 14, endHour: 22, activity: 'idle', locationPreference: 'home', probability: 0.7 },
  ],
  farmer: [
    { startHour: 5, endHour: 19, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 19, endHour: 21, activity: 'eating', locationPreference: 'tavern', probability: 0.3 },
    { startHour: 21, endHour: 5, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  miner: [
    { startHour: 6, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 18, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.6 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  fisher: [
    { startHour: 4, endHour: 14, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 14, endHour: 18, activity: 'idle', locationPreference: 'home', probability: 0.6 },
    { startHour: 18, endHour: 21, activity: 'socializing', locationPreference: 'tavern', probability: 0.5 },
    { startHour: 21, endHour: 4, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  craftsman: [
    { startHour: 7, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 18, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.4 },
    { startHour: 22, endHour: 7, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  sage: [
    { startHour: 7, endHour: 22, activity: 'working', locationPreference: 'work', probability: 0.8 },
    { startHour: 22, endHour: 7, activity: 'sleeping', locationPreference: 'home', probability: 0.85 },
  ],
  librarian: [
    { startHour: 8, endHour: 20, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 20, endHour: 8, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  teacher: [
    { startHour: 8, endHour: 16, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 16, endHour: 22, activity: 'idle', locationPreference: 'home', probability: 0.7 },
    { startHour: 22, endHour: 8, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  mage: [
    { startHour: 8, endHour: 22, activity: 'working', locationPreference: 'work', probability: 0.75 },
    { startHour: 22, endHour: 8, activity: 'sleeping', locationPreference: 'home', probability: 0.8 },
  ],
  alchemist: [
    { startHour: 9, endHour: 21, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 21, endHour: 9, activity: 'sleeping', locationPreference: 'home', probability: 0.85 },
  ],
  bard: [
    { startHour: 18, endHour: 2, activity: 'working', locationPreference: 'tavern', probability: 0.85 },
    { startHour: 2, endHour: 12, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
    { startHour: 12, endHour: 18, activity: 'roaming', locationPreference: 'roaming', probability: 0.5 },
  ],
  actor: [
    { startHour: 18, endHour: 23, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 23, endHour: 10, activity: 'sleeping', locationPreference: 'home', probability: 0.85 },
    { startHour: 10, endHour: 18, activity: 'idle', locationPreference: 'home', probability: 0.6 },
  ],
  courtesan: [
    { startHour: 20, endHour: 4, activity: 'working', locationPreference: 'tavern', probability: 0.8 },
    { startHour: 4, endHour: 14, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
    { startHour: 14, endHour: 20, activity: 'socializing', locationPreference: 'market', probability: 0.5 },
  ],
  gambler: [
    { startHour: 18, endHour: 4, activity: 'working', locationPreference: 'tavern', probability: 0.8 },
    { startHour: 4, endHour: 14, activity: 'sleeping', locationPreference: 'home', probability: 0.85 },
    { startHour: 14, endHour: 18, activity: 'idle', locationPreference: 'home', probability: 0.6 },
  ],
  soldier: [
    { startHour: 6, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 18, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.6 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  mercenary: [
    { startHour: 8, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.7 },
    { startHour: 18, endHour: 24, activity: 'socializing', locationPreference: 'tavern', probability: 0.7 },
    { startHour: 0, endHour: 8, activity: 'sleeping', locationPreference: 'home', probability: 0.85 },
  ],
  knight: [
    { startHour: 6, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 18, endHour: 22, activity: 'socializing', locationPreference: 'home', probability: 0.5 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
  captain: [
    { startHour: 6, endHour: 20, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 20, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.85 },
  ],
  beggar: [
    { startHour: 6, endHour: 22, activity: 'roaming', locationPreference: 'roaming', probability: 0.7 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.6 },
  ],
  child: [
    { startHour: 7, endHour: 12, activity: 'working', locationPreference: 'work', probability: 0.7 },
    { startHour: 12, endHour: 19, activity: 'roaming', locationPreference: 'roaming', probability: 0.6 },
    { startHour: 19, endHour: 7, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  elder: [
    { startHour: 6, endHour: 10, activity: 'idle', locationPreference: 'home', probability: 0.7 },
    { startHour: 10, endHour: 16, activity: 'socializing', locationPreference: 'market', probability: 0.5 },
    { startHour: 16, endHour: 20, activity: 'idle', locationPreference: 'home', probability: 0.7 },
    { startHour: 20, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  traveler: [
    { startHour: 6, endHour: 18, activity: 'roaming', locationPreference: 'roaming', probability: 0.7 },
    { startHour: 18, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.6 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'tavern', probability: 0.8 },
  ],
  adventurer: [
    { startHour: 8, endHour: 18, activity: 'roaming', locationPreference: 'roaming', probability: 0.6 },
    { startHour: 18, endHour: 24, activity: 'socializing', locationPreference: 'tavern', probability: 0.7 },
    { startHour: 0, endHour: 8, activity: 'sleeping', locationPreference: 'tavern', probability: 0.8 },
  ],

  // Additional roles
  sailor: [
    { startHour: 5, endHour: 18, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 18, endHour: 23, activity: 'socializing', locationPreference: 'tavern', probability: 0.7 },
    { startHour: 23, endHour: 5, activity: 'sleeping', locationPreference: 'home', probability: 0.85 },
  ],
  pilgrim: [
    { startHour: 5, endHour: 7, activity: 'praying', locationPreference: 'temple', probability: 0.9 },
    { startHour: 7, endHour: 18, activity: 'roaming', locationPreference: 'roaming', probability: 0.7 },
    { startHour: 18, endHour: 21, activity: 'praying', locationPreference: 'temple', probability: 0.8 },
    { startHour: 21, endHour: 5, activity: 'sleeping', locationPreference: 'tavern', probability: 0.85 },
  ],
  apprentice: [
    { startHour: 6, endHour: 19, activity: 'working', locationPreference: 'work', probability: 0.95 },
    { startHour: 19, endHour: 21, activity: 'eating', locationPreference: 'home', probability: 0.8 },
    { startHour: 21, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  gardener: [
    { startHour: 5, endHour: 17, activity: 'working', locationPreference: 'work', probability: 0.9 },
    { startHour: 17, endHour: 20, activity: 'idle', locationPreference: 'home', probability: 0.7 },
    { startHour: 20, endHour: 5, activity: 'sleeping', locationPreference: 'home', probability: 0.95 },
  ],
  gravedigger: [
    { startHour: 6, endHour: 16, activity: 'working', locationPreference: 'work', probability: 0.85 },
    { startHour: 16, endHour: 20, activity: 'idle', locationPreference: 'home', probability: 0.7 },
    { startHour: 20, endHour: 22, activity: 'socializing', locationPreference: 'tavern', probability: 0.4 },
    { startHour: 22, endHour: 6, activity: 'sleeping', locationPreference: 'home', probability: 0.9 },
  ],
};

// ============================================
// NPC SCHEDULER
// ============================================

export class NPCScheduler {
  private graph: HubGraph;
  private npcLocations: Map<string, NPCLocationState> = new Map();
  private rng: SeededRNG;

  constructor(graph: HubGraph, seed: string) {
    this.graph = graph;
    this.rng = new SeededRNG(seed);
  }

  /**
   * Initialize NPC location based on time.
   */
  initializeNPC(
    npcId: string,
    metadata: NPCMetadata,
    gameTime: GameTime
  ): NPCLocationState {
    const schedule = ROLE_SCHEDULES[metadata.role] ?? ROLE_SCHEDULES.laborer;
    const slot = this.getCurrentSlot(schedule, gameTime.hour);

    // Find appropriate location
    const locationNodeId = this.findLocationForSlot(
      slot,
      metadata,
      gameTime
    );

    const state: NPCLocationState = {
      npcId,
      hubId: metadata.homeHubId,
      currentNodeId: locationNodeId,
      currentActivity: slot.activity,
      currentScheduleSlot: `${slot.startHour}-${slot.endHour}`,
      nextScheduleChange: this.calculateNextChange(schedule, gameTime),
      isAvailable: slot.activity !== 'sleeping',
      busyReason: slot.activity === 'sleeping' ? 'Sleeping' : undefined,
      lastUpdatedAt: new Date(),
    };

    this.npcLocations.set(npcId, state);
    return state;
  }

  /**
   * Update NPC location based on current time.
   */
  updateNPC(
    npcId: string,
    metadata: NPCMetadata,
    gameTime: GameTime
  ): NPCLocationState {
    let state = this.npcLocations.get(npcId);

    if (!state) {
      return this.initializeNPC(npcId, metadata, gameTime);
    }

    const schedule = ROLE_SCHEDULES[metadata.role] ?? ROLE_SCHEDULES.laborer;
    const currentSlot = this.getCurrentSlot(schedule, gameTime.hour);
    const slotKey = `${currentSlot.startHour}-${currentSlot.endHour}`;

    // Check if schedule slot changed
    if (state.currentScheduleSlot !== slotKey) {
      // Roll for following schedule
      if (this.rng.next() < currentSlot.probability) {
        const newLocation = this.findLocationForSlot(currentSlot, metadata, gameTime);

        // If location changed, set up travel
        if (newLocation !== state.currentNodeId) {
          const path = this.graph.findPath(state.currentNodeId, newLocation);

          if (path && path.length > 1) {
            state = {
              ...state,
              currentActivity: 'traveling',
              pathToDestination: path,
              destinationNodeId: newLocation,
              pathProgress: 0,
            };
          } else {
            // Teleport if no path (shouldn't happen often)
            state = {
              ...state,
              currentNodeId: newLocation,
              currentActivity: currentSlot.activity,
            };
          }
        } else {
          state = {
            ...state,
            currentActivity: currentSlot.activity,
          };
        }
      }

      state = {
        ...state,
        currentScheduleSlot: slotKey,
        nextScheduleChange: this.calculateNextChange(schedule, gameTime),
        isAvailable: currentSlot.activity !== 'sleeping',
        busyReason: currentSlot.activity === 'sleeping' ? 'Sleeping' : undefined,
        lastUpdatedAt: new Date(),
      };
    }

    // Update travel progress
    if (state.currentActivity === 'traveling' && state.pathToDestination) {
      state = this.advanceTravel(state);
    }

    this.npcLocations.set(npcId, state);
    return state;
  }

  /**
   * Get all NPCs at a specific node.
   */
  getNPCsAtNode(nodeId: string): string[] {
    const result: string[] = [];
    for (const [npcId, state] of this.npcLocations) {
      if (state.currentNodeId === nodeId) {
        result.push(npcId);
      }
    }
    return result;
  }

  /**
   * Get all NPCs within range of a node.
   */
  getNPCsNearNode(nodeId: string, maxDistance: number): Array<{ npcId: string; distance: number }> {
    const reachable = this.graph.getNodesWithinDistance(nodeId, maxDistance);
    const result: Array<{ npcId: string; distance: number }> = [];

    for (const [npcId, state] of this.npcLocations) {
      const distance = reachable.get(state.currentNodeId);
      if (distance !== undefined) {
        result.push({ npcId, distance });
      }
    }

    return result.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Find an NPC by ID.
   */
  locateNPC(npcId: string): NPCLocationState | undefined {
    return this.npcLocations.get(npcId);
  }

  // === HELPERS ===

  private getCurrentSlot(schedule: ScheduleSlot[], hour: number): ScheduleSlot {
    for (const slot of schedule) {
      if (slot.startHour <= slot.endHour) {
        // Normal slot (e.g., 8-18)
        if (hour >= slot.startHour && hour < slot.endHour) {
          return slot;
        }
      } else {
        // Overnight slot (e.g., 22-6)
        if (hour >= slot.startHour || hour < slot.endHour) {
          return slot;
        }
      }
    }

    // Default to idle at home
    return {
      startHour: 0,
      endHour: 24,
      activity: 'idle',
      locationPreference: 'home',
      probability: 1,
    };
  }

  private findLocationForSlot(
    slot: ScheduleSlot,
    metadata: NPCMetadata,
    _gameTime: GameTime
  ): string {
    const preference = slot.locationPreference;

    switch (preference) {
      case 'work':
        if (metadata.workBuildingId) {
          return metadata.workBuildingId;
        }
        break;

      case 'home':
        if (metadata.homeBuildingId) {
          return metadata.homeBuildingId;
        }
        break;

      case 'tavern':
        const taverns = this.graph.getBuildingsByType('tavern');
        if (taverns.length > 0) {
          return this.rng.pick(taverns).id;
        }
        break;

      case 'temple':
        const temples = this.graph.getBuildingsByType('temple');
        if (temples.length > 0) {
          return this.rng.pick(temples).id;
        }
        break;

      case 'market':
        const shops = this.graph.getBuildingsByType('shop');
        if (shops.length > 0) {
          return this.rng.pick(shops).id;
        }
        break;

      case 'roaming':
        const streets = this.graph.getNodesByType('street');
        if (streets.length > 0) {
          return this.rng.pick(streets).id;
        }
        break;
    }

    // Fallback: stay at current location or home
    return metadata.homeBuildingId ?? metadata.workBuildingId ??
           this.graph.getNodesByType('building')[0]?.id ?? 'unknown';
  }

  private calculateNextChange(schedule: ScheduleSlot[], gameTime: GameTime): number {
    const currentSlot = this.getCurrentSlot(schedule, gameTime.hour);

    // Find when this slot ends
    let endHour = currentSlot.endHour;
    if (endHour <= currentSlot.startHour) {
      // Overnight slot
      if (gameTime.hour >= currentSlot.startHour) {
        endHour += 24;
      }
    }

    // Calculate minutes until end
    const currentMinutes = gameTime.hour * 60 + gameTime.minute;
    const endMinutes = endHour * 60;

    return endMinutes - currentMinutes;
  }

  private advanceTravel(state: NPCLocationState): NPCLocationState {
    if (!state.pathToDestination || state.pathProgress === undefined) {
      return state;
    }

    // Advance progress (would be time-based in production)
    const newProgress = Math.min(1, state.pathProgress + 0.2);

    if (newProgress >= 1) {
      // Arrived at destination
      return {
        ...state,
        currentNodeId: state.destinationNodeId!,
        currentActivity: 'idle',  // Will be updated by schedule
        pathToDestination: undefined,
        destinationNodeId: undefined,
        pathProgress: undefined,
      };
    }

    // Update current node to intermediate position
    const pathIndex = Math.floor(newProgress * (state.pathToDestination.length - 1));

    return {
      ...state,
      currentNodeId: state.pathToDestination[pathIndex],
      pathProgress: newProgress,
    };
  }
}

// ============================================
// BULK UPDATE
// ============================================

export class HubSimulator {
  private scheduler: NPCScheduler;
  private npcMetadata: Map<string, NPCMetadata> = new Map();

  constructor(graph: HubGraph, seed: string) {
    this.scheduler = new NPCScheduler(graph, seed);
  }

  /**
   * Register an NPC for simulation.
   */
  registerNPC(npcId: string, metadata: NPCMetadata): void {
    this.npcMetadata.set(npcId, metadata);
  }

  /**
   * Update all NPCs to current game time.
   */
  tick(gameTime: GameTime): void {
    for (const [npcId, metadata] of this.npcMetadata) {
      this.scheduler.updateNPC(npcId, metadata, gameTime);
    }
  }

  /**
   * Get scheduler for queries.
   */
  getScheduler(): NPCScheduler {
    return this.scheduler;
  }
}
