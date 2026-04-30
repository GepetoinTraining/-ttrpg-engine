/**
 * GM ORCHESTRATOR — 4 Play Mode Router
 * =======================================
 *
 * The brain that decides WHAT happens next and WHO controls it.
 *
 * 4 MODES:
 *   1. GROUP_DM_AI:  Human DM creates scenes, AI assists + voices NPCs
 *   2. GROUP_AI:     AI generates scenes, runs NPCs, party plays
 *   3. SOLO_AI:      AI is full GM for a single player
 *   4. TRUE_SOLO:    No AI — pure clockwork generates events from world state
 *
 * HOW IT WORKS:
 *   1. Context packet assembled (world state, party, NPCs, quests, weather)
 *   2. Mode determines WHO generates the next scene card
 *   3. Scene card is pushed into mm-session for execution
 *   4. After resolution, world mutations are committed to .tp
 *
 * This wraps mm-session.ts — it does NOT replace it.
 */

import type {
  CampaignNarrative, Beat, BeatType, Quest, Arc,
  PacingBias, PacingSuggestion, Villain, Patron, Conflict,
} from './narrative.js'
import { suggestNextBeat, calculateProgress } from './narrative.js'

// ============================================================
// SIMULATION DEPTH — What systems are active per campaign
// ============================================================

export interface SimulationDepth {
  /** Farming, harvest, food variety, tenure */
  agriculture: boolean
  /** Meal quality, fuel, regional cuisine */
  cooking: boolean
  /** Deposits, loans, currency exchange, minting */
  banking: boolean
  /** Faith accrual, deity influence, temples */
  religion: boolean
  /** Performances, festivals, cultural score */
  entertainment: boolean
  /** Research, libraries, knowledge flow */
  lore: boolean
  /** Armies, diplomacy, espionage, sieges */
  warfare: boolean
  /** Water levels, flooding, navigation */
  waterSystems: boolean
  /** Logging, quarries, sand, potash */
  extraction: boolean
  /** Trade routes, caravans, market ticks */
  trading: boolean
}

export type SimulationPreset = 'full_simulation' | 'adventure_focused' | 'narrative_lite' | 'survival' | 'minimal'

export const SIMULATION_PRESETS: Record<SimulationPreset, SimulationDepth> = {
  /** Everything on — sandbox, kingdom-builder campaigns */
  full_simulation: {
    agriculture: true, cooking: true, banking: true, religion: true,
    entertainment: true, lore: true, warfare: true, waterSystems: true,
    extraction: true, trading: true,
  },
  /** Classic D&D — trade, war, faith, exploration */
  adventure_focused: {
    agriculture: false, cooking: false, banking: false, religion: true,
    entertainment: true, lore: true, warfare: true, waterSystems: false,
    extraction: false, trading: true,
  },
  /** Story-first — only social/economic flavor */
  narrative_lite: {
    agriculture: false, cooking: false, banking: false, religion: false,
    entertainment: true, lore: true, warfare: false, waterSystems: false,
    extraction: false, trading: true,
  },
  /** Grimdark/survival horror — scarcity matters */
  survival: {
    agriculture: true, cooking: true, banking: false, religion: false,
    entertainment: false, lore: false, warfare: true, waterSystems: true,
    extraction: true, trading: false,
  },
  /** Pure narrative — no simulation, all story */
  minimal: {
    agriculture: false, cooking: false, banking: false, religion: false,
    entertainment: false, lore: false, warfare: false, waterSystems: false,
    extraction: false, trading: false,
  },
}

// ============================================================
// PLAY MODE
// ============================================================

export type PlayMode = 'GROUP_DM_AI' | 'GROUP_AI' | 'SOLO_AI' | 'TRUE_SOLO'

export interface PlayModeConfig {
  mode: PlayMode
  /** AI GM profile (ignored for TRUE_SOLO) */
  gmProfile: GMProfileType
  /** Pacing bias */
  pacingBias: PacingBias
  /** Solo corridor mode (SOLO_AI only) */
  corridorMode: boolean
  /** World-tick auto-advance (TRUE_SOLO) */
  autoAdvance: boolean
  /** Max scenes per session hint */
  maxScenesPerSession: number
  /** Which simulation systems are active — DM discretion */
  simulationDepth: SimulationDepth
}

export const DEFAULT_MODE_CONFIGS: Record<PlayMode, PlayModeConfig> = {
  GROUP_DM_AI: {
    mode: 'GROUP_DM_AI',
    gmProfile: 'storyteller',
    pacingBias: 'balanced',
    corridorMode: false,
    autoAdvance: false,
    maxScenesPerSession: 12,
    simulationDepth: SIMULATION_PRESETS.adventure_focused,
  },
  GROUP_AI: {
    mode: 'GROUP_AI',
    gmProfile: 'storyteller',
    pacingBias: 'balanced',
    corridorMode: false,
    autoAdvance: false,
    maxScenesPerSession: 10,
    simulationDepth: SIMULATION_PRESETS.adventure_focused,
  },
  SOLO_AI: {
    mode: 'SOLO_AI',
    gmProfile: 'mentor',
    pacingBias: 'narrative',
    corridorMode: true,
    autoAdvance: false,
    maxScenesPerSession: 8,
    simulationDepth: SIMULATION_PRESETS.narrative_lite,
  },
  TRUE_SOLO: {
    mode: 'TRUE_SOLO',
    gmProfile: 'neutral',
    pacingBias: 'balanced',
    corridorMode: false,
    autoAdvance: true,
    maxScenesPerSession: 15,
    simulationDepth: SIMULATION_PRESETS.full_simulation,
  },
}

// ============================================================
// GM PROFILE — AI personality presets
// ============================================================

export type GMProfileType = 'mentor' | 'trickster' | 'warden' | 'storyteller' | 'challenger' | 'neutral'

export interface GMProfile {
  type: GMProfileType
  name: string
  description: string
  tone: string
  pacing: 'fast' | 'moderate' | 'slow'
  combatFrequency: 'low' | 'medium' | 'high'
  socialFrequency: 'low' | 'medium' | 'high'
  mercyLevel: 'no_mercy' | 'fair' | 'generous'
  narrationStyle: 'terse' | 'descriptive' | 'flowery'
  rulesStrictness: 'raw' | 'standard' | 'rule_of_cool'
}

export const GM_PROFILES: Record<GMProfileType, GMProfile> = {
  mentor: {
    type: 'mentor',
    name: 'The Mentor',
    description: 'Guides through challenges, teaches through play',
    tone: 'Warm, encouraging, patient',
    pacing: 'moderate',
    combatFrequency: 'medium',
    socialFrequency: 'high',
    mercyLevel: 'generous',
    narrationStyle: 'descriptive',
    rulesStrictness: 'rule_of_cool',
  },
  trickster: {
    type: 'trickster',
    name: 'The Trickster',
    description: 'Loves surprises, reversals, and dramatic irony',
    tone: 'Playful, mischievous, dramatic',
    pacing: 'fast',
    combatFrequency: 'medium',
    socialFrequency: 'medium',
    mercyLevel: 'fair',
    narrationStyle: 'descriptive',
    rulesStrictness: 'rule_of_cool',
  },
  warden: {
    type: 'warden',
    name: 'The Warden',
    description: 'The world is dangerous and consequences are real',
    tone: 'Grim, serious, foreboding',
    pacing: 'slow',
    combatFrequency: 'high',
    socialFrequency: 'low',
    mercyLevel: 'no_mercy',
    narrationStyle: 'terse',
    rulesStrictness: 'raw',
  },
  storyteller: {
    type: 'storyteller',
    name: 'The Storyteller',
    description: 'Prioritizes narrative, character moments, and drama',
    tone: 'Rich, atmospheric, empathetic',
    pacing: 'moderate',
    combatFrequency: 'low',
    socialFrequency: 'high',
    mercyLevel: 'fair',
    narrationStyle: 'flowery',
    rulesStrictness: 'standard',
  },
  challenger: {
    type: 'challenger',
    name: 'The Challenger',
    description: 'Tactical combat, puzzle mastery, optimized encounters',
    tone: 'Crisp, tactical, precise',
    pacing: 'fast',
    combatFrequency: 'high',
    socialFrequency: 'low',
    mercyLevel: 'no_mercy',
    narrationStyle: 'terse',
    rulesStrictness: 'raw',
  },
  neutral: {
    type: 'neutral',
    name: 'The Neutral Arbiter',
    description: 'Pure world simulation — no personality, just truth',
    tone: 'Matter-of-fact, objective',
    pacing: 'moderate',
    combatFrequency: 'medium',
    socialFrequency: 'medium',
    mercyLevel: 'fair',
    narrationStyle: 'descriptive',
    rulesStrictness: 'standard',
  },
}

// ============================================================
// CONTEXT PACKET — Everything the AI needs to generate a scene
// ============================================================

export interface ContextPacket {
  // Who
  party: {
    members: { name: string; race: string; class: string; level: number; hpPercent: number }[]
    gold: number
    location: string
  }
  npcPresence: { name: string; disposition: string; occupation: string; currentGoal: string }[]

  // Where
  locationName: string
  locationType: string
  locationDescription?: string
  weatherState?: string
  weatherModifiers?: Record<string, number>

  // What's happening
  activeQuests: { name: string; objective: string; currentBeat?: string }[]
  recentBeats: BeatType[]
  staleHooks: string[]

  // Tension
  factionTensions: { factionA: string; factionB: string; tension: number }[]
  activeVillains: { name: string; tier: string; arcStatus: string; goalsKnown: boolean }[]

  // Constraints
  pacingSuggestion: PacingSuggestion
  gmProfile: GMProfile
  playMode: PlayMode
}

// ============================================================
// SCENE GENERATION — What happens next
// ============================================================

export type SceneType =
  | 'narrative'     | 'revelation'  | 'transition'
  | 'encounter'     | 'exploration' | 'puzzle'
  | 'combat'        | 'chase'       | 'skill_challenge'
  | 'loot'          | 'rest'        | 'milestone'

export interface GeneratedScene {
  type: SceneType
  title: string
  readAloud: string
  description: string
  gmNotes: string
  choices: { id: string; label: string; description: string }[]
  npcsInvolved: string[]
  estimatedDuration: 'short' | 'medium' | 'long'
  beatType: BeatType
}

/**
 * Select scene type based on pacing, mode, and world state.
 * This is the deterministic layer — AI content comes on top.
 */
export function selectSceneType(
  ctx: ContextPacket,
  seed: number,
): SceneType {
  const suggestion = ctx.pacingSuggestion

  // Map beat types → scene types
  const beatToScene: Partial<Record<BeatType, SceneType>> = {
    hook: 'narrative',
    inciting: 'revelation',
    rising: 'encounter',
    midpoint: 'revelation',
    escalation: 'combat',
    crisis: 'narrative',
    climax: 'combat',
    resolution: 'narrative',
    cliffhanger: 'narrative',
    milestone: 'milestone',
    twist: 'revelation',
    discovery: 'exploration',
    encounter: 'encounter',
    transition: 'transition',
    downtime: 'rest',
  }

  const base = beatToScene[suggestion.suggestedBeatType] ?? 'narrative'

  // Mode-specific overrides
  if (ctx.playMode === 'TRUE_SOLO') {
    // Clockwork: more encounters and exploration, less pure narrative
    const clockworkOptions: SceneType[] = ['encounter', 'exploration', 'combat', 'loot', 'transition']
    return clockworkOptions[seed % clockworkOptions.length]
  }

  if (ctx.playMode === 'SOLO_AI' && ctx.gmProfile.type === 'warden') {
    // Warden solo: higher combat rate
    if (seed % 3 === 0) return 'combat'
  }

  return base
}

// ============================================================
// SOLO CORRIDOR — SOLO_AI linear dungeon-like progression
// ============================================================

export interface CorridorSegment {
  id: string
  order: number
  sceneType: SceneType
  completed: boolean
  choices: string[]
  chosenPath?: string
}

export interface SoloCorridor {
  id: string
  segments: CorridorSegment[]
  currentSegment: number
  /** Fork tracking: choices can split the corridor */
  forkHistory: { segmentId: string; choiceLabel: string }[]
}

export function createCorridor(segmentCount: number, seed: number): SoloCorridor {
  const sceneTypes: SceneType[] = ['narrative', 'encounter', 'exploration', 'combat', 'puzzle', 'revelation']
  const segments: CorridorSegment[] = []

  for (let i = 0; i < segmentCount; i++) {
    const typeIdx = (seed + i * 7) % sceneTypes.length
    segments.push({
      id: `corridor_${i}`,
      order: i,
      sceneType: sceneTypes[typeIdx],
      completed: false,
      choices: [],
    })
  }

  // Ensure it ends with climax → resolution
  if (segments.length >= 2) {
    segments[segments.length - 2].sceneType = 'combat'  // climax
    segments[segments.length - 1].sceneType = 'narrative' // resolution
  }

  return { id: `corridor_${seed}`, segments, currentSegment: 0, forkHistory: [] }
}

export function advanceCorridor(corridor: SoloCorridor, choiceLabel?: string): CorridorSegment | null {
  if (corridor.currentSegment >= corridor.segments.length) return null

  const current = corridor.segments[corridor.currentSegment]
  current.completed = true
  if (choiceLabel) {
    corridor.forkHistory.push({ segmentId: current.id, choiceLabel })
  }

  corridor.currentSegment++
  return corridor.currentSegment < corridor.segments.length
    ? corridor.segments[corridor.currentSegment]
    : null
}

// ============================================================
// TRUE SOLO — Clockwork event generation
// ============================================================

export type ClockworkEventType =
  | 'monster_encounter'  | 'merchant_caravan'   | 'weather_shift'
  | 'faction_conflict'   | 'npc_request'        | 'discovery'
  | 'resource_find'      | 'toll_gate'          | 'random_ruin'
  | 'wandering_npc'      | 'ambush'             | 'divine_omen'

export interface ClockworkEvent {
  type: ClockworkEventType
  title: string
  description: string
  sceneType: SceneType
  difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'
}

/**
 * Generate a clockwork event from world state (no AI).
 * Uses d100 table seeded by world day and location.
 */
export function generateClockworkEvent(
  worldDay: number,
  locationDanger: number,   // 0-10
  weatherSeverity: number,  // 0-5
  factionTension: number,   // 0-100
  seed: number,
): ClockworkEvent {
  const roll = ((seed * 31337 + worldDay * 7919) >>> 0) % 100

  // High danger → more combats
  const dangerBias = locationDanger * 5
  // High tension → more faction events
  const tensionBias = factionTension > 50 ? 15 : 0

  const effectiveRoll = Math.min(99, roll + dangerBias - tensionBias)

  if (effectiveRoll < 15) {
    return {
      type: 'monster_encounter',
      title: 'Hostile encounter',
      description: `Creatures emerge from the ${locationDanger > 5 ? 'surrounding darkness' : 'underbrush'}`,
      sceneType: 'combat',
      difficulty: locationDanger > 7 ? 'hard' : locationDanger > 4 ? 'medium' : 'easy',
    }
  }
  if (effectiveRoll < 25) {
    return {
      type: 'merchant_caravan',
      title: 'Traveling merchant',
      description: 'A merchant offers goods and news from distant lands',
      sceneType: 'encounter',
    }
  }
  if (effectiveRoll < 35) {
    return {
      type: 'discovery',
      title: 'Strange discovery',
      description: 'Something unusual catches your attention',
      sceneType: 'exploration',
    }
  }
  if (effectiveRoll < 45) {
    return {
      type: 'npc_request',
      title: 'A plea for help',
      description: 'A local approaches with an urgent request',
      sceneType: 'encounter',
    }
  }
  if (effectiveRoll < 55) {
    return {
      type: 'faction_conflict',
      title: 'Faction tension',
      description: factionTension > 50
        ? 'Armed faction members confront each other in the road'
        : 'Faction banners mark contested territory',
      sceneType: factionTension > 50 ? 'combat' : 'encounter',
      difficulty: factionTension > 70 ? 'hard' : 'medium',
    }
  }
  if (effectiveRoll < 65) {
    return {
      type: 'weather_shift',
      title: 'Weather change',
      description: weatherSeverity > 3
        ? 'The storm forces you to seek shelter'
        : 'The weather shifts unexpectedly',
      sceneType: weatherSeverity > 3 ? 'skill_challenge' : 'transition',
    }
  }
  if (effectiveRoll < 72) {
    return {
      type: 'resource_find',
      title: 'Resource cache',
      description: 'You discover useful resources',
      sceneType: 'loot',
    }
  }
  if (effectiveRoll < 79) {
    return {
      type: 'random_ruin',
      title: 'Ancient ruins',
      description: 'Crumbling structures hint at forgotten history',
      sceneType: 'exploration',
    }
  }
  if (effectiveRoll < 86) {
    return {
      type: 'wandering_npc',
      title: 'Fellow traveler',
      description: 'A lone figure on the road shares a moment of rest',
      sceneType: 'encounter',
    }
  }
  if (effectiveRoll < 93) {
    return {
      type: 'ambush',
      title: 'Ambush!',
      description: 'Enemies spring from hiding!',
      sceneType: 'combat',
      difficulty: locationDanger > 5 ? 'hard' : 'medium',
    }
  }
  return {
    type: 'divine_omen',
    title: 'Omen',
    description: 'An unusual sign appears — the gods are watching',
    sceneType: 'narrative',
  }
}

// ============================================================
// HOOK-BACK ESCALATION — Don't let the party forget
// ============================================================

export interface HookEscalation {
  hookId: string
  hookName: string
  staleScenes: number
  urgency: 'gentle' | 'moderate' | 'urgent' | 'critical'
  reminderType: 'npc_mention' | 'environmental_clue' | 'dream_vision' | 'messenger' | 'consequence'
  reminderDescription: string
}

/**
 * Generate hook-back reminders for stale plot threads.
 * More stale = more aggressive reminder.
 */
export function escalateHooks(
  hooks: { id: string; name: string; staleCount: number; priority: number }[],
): HookEscalation[] {
  return hooks
    .filter(h => h.staleCount >= 3)
    .sort((a, b) => b.priority * b.staleCount - a.priority * a.staleCount)
    .map(h => {
      let urgency: HookEscalation['urgency']
      let reminderType: HookEscalation['reminderType']

      if (h.staleCount >= 10) {
        urgency = 'critical'
        reminderType = 'consequence'
      } else if (h.staleCount >= 7) {
        urgency = 'urgent'
        reminderType = 'messenger'
      } else if (h.staleCount >= 5) {
        urgency = 'moderate'
        reminderType = 'dream_vision'
      } else {
        urgency = 'gentle'
        reminderType = h.staleCount % 2 === 0 ? 'npc_mention' : 'environmental_clue'
      }

      const urgencyDescs: Record<string, string> = {
        gentle: `A passing NPC mentions something related to "${h.name}"`,
        moderate: `In a quiet moment, visions of "${h.name}" surface unbidden`,
        urgent: `A breathless messenger arrives with urgent news about "${h.name}"`,
        critical: `The consequences of ignoring "${h.name}" manifest — things have gotten worse`,
      }

      return {
        hookId: h.id,
        hookName: h.name,
        staleScenes: h.staleCount,
        urgency,
        reminderType,
        reminderDescription: urgencyDescs[urgency],
      }
    })
}

// ============================================================
// CONTEXT PACKET BUILDER — Assemble everything for scene gen
// ============================================================

export interface WorldSnapshot {
  partyMembers: { name: string; race: string; class: string; level: number; hpPercent: number }[]
  partyGold: number
  partyLocation: string
  locationType: string
  locationDescription?: string
  npcsPresent: { name: string; disposition: string; occupation: string; currentGoal: string }[]
  weatherState?: string
  weatherModifiers?: Record<string, number>
  activeQuests: { name: string; objective: string; currentBeat?: string }[]
  recentBeatTypes: BeatType[]
  staleHooks: string[]
  factionTensions: { factionA: string; factionB: string; tension: number }[]
  activeVillains: { name: string; tier: string; arcStatus: string; goalsKnown: boolean }[]
}

export function buildContextPacket(
  snapshot: WorldSnapshot,
  modeConfig: PlayModeConfig,
): ContextPacket {
  const profile = GM_PROFILES[modeConfig.gmProfile]

  const pacingSuggestion = suggestNextBeat(
    snapshot.recentBeatTypes,
    snapshot.activeQuests.length,
    Math.min(...snapshot.partyMembers.map(m => m.hpPercent), 1),
    modeConfig.pacingBias,
  )

  return {
    party: {
      members: snapshot.partyMembers,
      gold: snapshot.partyGold,
      location: snapshot.partyLocation,
    },
    npcPresence: snapshot.npcsPresent,
    locationName: snapshot.partyLocation,
    locationType: snapshot.locationType,
    locationDescription: snapshot.locationDescription,
    weatherState: snapshot.weatherState,
    weatherModifiers: snapshot.weatherModifiers,
    activeQuests: snapshot.activeQuests,
    recentBeats: snapshot.recentBeatTypes,
    staleHooks: snapshot.staleHooks,
    factionTensions: snapshot.factionTensions,
    activeVillains: snapshot.activeVillains,
    pacingSuggestion,
    gmProfile: profile,
    playMode: modeConfig.mode,
  }
}
