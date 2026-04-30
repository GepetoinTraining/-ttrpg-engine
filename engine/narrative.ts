/**
 * NARRATIVE ENGINE — Campaign → Arc → Quest → Beat
 * ====================================================
 *
 * The story is a TREE, not a timeline.
 * Sessions are WHEN you played. Arcs/Quests/Beats are WHAT the story is.
 *
 * HIERARCHY:
 *   Campaign
 *   ├── Arc (main | side | character | faction | world)
 *   │   └── Quest (trackable objective with beats)
 *   │       └── Beat (atomic dramatic moment)
 *   ├── Rabbit Holes (distractions → depth → connect back)
 *   └── Moral Topology (villains, patrons, conflicts)
 *
 * PLAY MODE INTEGRATION:
 *   GROUP_DM_AI:  DM creates arcs/quests, AI suggests beats
 *   GROUP_AI:     AI generates arcs from world state, runs quests
 *   SOLO_AI:      AI weaves personal arcs, rabbit holes
 *   TRUE_SOLO:    Clockwork generates quests from faction/world events
 */

// ============================================================
// BEAT — Atomic dramatic moment
// ============================================================

export type BeatType =
  | 'hook'        // Call to adventure
  | 'inciting'    // Point of no return
  | 'rising'      // Complications, obstacles
  | 'midpoint'    // Major revelation or shift
  | 'escalation'  // Stakes increase
  | 'crisis'      // Low point, dark moment
  | 'climax'      // Final confrontation
  | 'resolution'  // Aftermath, denouement
  | 'cliffhanger' // Unresolved tension
  | 'milestone'   // Achievement marker
  | 'twist'       // Unexpected revelation
  | 'discovery'   // Information gained
  | 'encounter'   // Combat or social challenge
  | 'transition'  // Travel, time skip
  | 'downtime'    // Rest, crafting, training

export type BeatStatus = 'planned' | 'foreshadowed' | 'active' | 'occurred' | 'skipped' | 'modified'

export interface Beat {
  id: string
  questId: string
  name: string
  description?: string
  beatType: BeatType
  order: number
  status: BeatStatus
  /** Session in which it occurred */
  occurredInSession?: string
  /** World day when it occurred */
  worldDay?: number
  /** Trigger conditions */
  triggers: { type: 'location' | 'npc_interaction' | 'item' | 'time' | 'quest_complete' | 'manual'; value: string }[]
  /** GM content */
  readAloud?: string
  gmNotes?: string
  npcsInvolved: string[]
  /** What happens when this beat fires */
  outcomes?: {
    knowledgeRevealed: string[]
    questsUnlocked: string[]
    questsCompleted: string[]
    stateChanges: { entityId: string; change: string }[]
  }
}

// ============================================================
// QUEST — Trackable objective with beats
// ============================================================

export type QuestType = 'main' | 'side' | 'character' | 'faction' | 'bounty' | 'fetch' | 'escort' | 'exploration' | 'mystery' | 'social'
export type ObjectiveStatus = 'unknown' | 'revealed' | 'active' | 'completed' | 'failed' | 'abandoned'

export interface Objective {
  title: string
  description?: string
  status: ObjectiveStatus
  successCondition?: string
  failureCondition?: string
  rewards?: {
    xp?: number
    gold?: number
    items?: string[]
    reputation?: { faction: string; change: number }[]
    narrative?: string
  }
}

export interface Quest {
  id: string
  arcId: string
  name: string
  description?: string
  questType: QuestType
  objective: Objective
  subObjectives: Objective[]
  /** Quest giver */
  giverEntityId?: string
  giverName?: string
  /** Prerequisites */
  prerequisites: { type: 'quest_complete' | 'level' | 'reputation' | 'item' | 'location_visited'; value: string }[]
  /** Time-sensitive? */
  availableUntil?: number  // world day deadline
  isSecret: boolean
  difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'
  tags: string[]
  /** Progress tracking */
  startedInSession?: string
  completedInSession?: string
}

// ============================================================
// ARC — Major narrative chunk
// ============================================================

export type ArcType = 'main' | 'side' | 'character' | 'faction' | 'world'
export type ArcStatus = 'planned' | 'foreshadowed' | 'active' | 'paused' | 'completed' | 'failed' | 'abandoned'

export interface Arc {
  id: string
  campaignId: string
  name: string
  description?: string
  arcType: ArcType
  parentArcId?: string
  order: number
  objective: Objective
  status: ArcStatus
  /** For character arcs */
  focusCharacterId?: string
  /** For faction arcs */
  focusFactionId?: string
  themes: string[]
  tags: string[]
}

// ============================================================
// CAMPAIGN NARRATIVE STATE
// ============================================================

export interface CampaignNarrative {
  campaignId: string
  /** The big objective */
  campaignObjective: Objective
  arcs: Arc[]
  quests: Quest[]
  beats: Beat[]
  /** Moral topology */
  villains: Villain[]
  patrons: Patron[]
  conflicts: Conflict[]
  /** Rabbit holes */
  rabbitHoles: RabbitHole[]
}

// ============================================================
// PROGRESS TRACKING
// ============================================================

export interface CampaignProgress {
  overallPercent: number
  arcs: { total: number; completed: number; active: number }
  quests: { total: number; completed: number; active: number; available: number; hidden: number }
  currentQuestProgress: { questId: string; questName: string; totalBeats: number; completedBeats: number; currentBeat?: string }[]
  sessionsPlayed: number
}

export function calculateProgress(narrative: CampaignNarrative): CampaignProgress {
  const completedArcs = narrative.arcs.filter(a => a.status === 'completed').length
  const completedQuests = narrative.quests.filter(q => q.objective.status === 'completed').length
  const activeQuests = narrative.quests.filter(q => q.objective.status === 'active')

  const questProgress = activeQuests.map(q => {
    const questBeats = narrative.beats.filter(b => b.questId === q.id)
    const completedBeats = questBeats.filter(b => b.status === 'occurred').length
    const currentBeat = questBeats.find(b => b.status === 'active')
    return {
      questId: q.id,
      questName: q.name,
      totalBeats: questBeats.length,
      completedBeats,
      currentBeat: currentBeat?.name,
    }
  })

  return {
    overallPercent: narrative.campaignObjective.status === 'completed'
      ? 100
      : Math.round((completedQuests / Math.max(narrative.quests.length, 1)) * 100),
    arcs: {
      total: narrative.arcs.length,
      completed: completedArcs,
      active: narrative.arcs.filter(a => a.status === 'active').length,
    },
    quests: {
      total: narrative.quests.length,
      completed: completedQuests,
      active: activeQuests.length,
      available: narrative.quests.filter(q => q.objective.status === 'revealed').length,
      hidden: narrative.quests.filter(q => q.isSecret).length,
    },
    currentQuestProgress: questProgress,
    sessionsPlayed: 0, // Filled by caller from mm-adventure
  }
}

// ============================================================
// PACING — What should happen next?
// ============================================================

export type PacingBias = 'combat' | 'exploration' | 'social' | 'narrative' | 'balanced'

export interface PacingSuggestion {
  suggestedBeatType: BeatType
  reason: string
  urgentHooks: string[]
  tension: number // 0 (calm) to 1 (climactic)
}

/**
 * Suggest next beat type based on recent history and narrative state.
 * Prevents 3+ of same type in a row.
 */
export function suggestNextBeat(
  recentBeatTypes: BeatType[],
  activeQuestCount: number,
  partyHpPercent: number,
  bias: PacingBias = 'balanced',
): PacingSuggestion {
  const last3 = recentBeatTypes.slice(-3)

  // If party is hurt, suggest downtime/narrative
  if (partyHpPercent < 0.3) {
    return { suggestedBeatType: 'downtime', reason: 'Party needs rest', urgentHooks: [], tension: 0.2 }
  }

  // Prevent 3 combats in a row
  if (last3.length >= 3 && last3.every(b => b === 'encounter' || b === 'climax')) {
    return { suggestedBeatType: 'discovery', reason: 'Too many combats — time for narrative', urgentHooks: [], tension: 0.4 }
  }

  // Prevent 3 narrative lulls in a row
  if (last3.length >= 3 && last3.every(b => b === 'downtime' || b === 'transition')) {
    return { suggestedBeatType: 'hook', reason: 'Pace is too slow — introduce a hook', urgentHooks: [], tension: 0.6 }
  }

  // Active quests drive tension
  const tension = Math.min(1, activeQuestCount * 0.15)

  // Bias-based suggestion
  const biasMap: Record<PacingBias, BeatType> = {
    combat: 'encounter',
    exploration: 'discovery',
    social: 'encounter',
    narrative: 'rising',
    balanced: tension > 0.6 ? 'escalation' : 'rising',
  }

  return {
    suggestedBeatType: biasMap[bias],
    reason: `Pacing suggests ${biasMap[bias]} (tension: ${tension.toFixed(2)})`,
    urgentHooks: [],
    tension,
  }
}

// ============================================================
// RABBIT HOLE / DEPTH SYSTEM
// ============================================================
// Every rabbit hole is a tunnel back to the main road.
// The deeper they go, the more connected it becomes.

export type DepthLevel = 'surface' | 'hook' | 'investigation' | 'mini_quest' | 'resolution' | 'side_arc'
export type RabbitHoleStatus = 'active' | 'dormant' | 'resolved' | 'abandoned' | 'promoted'

export interface RabbitHole {
  id: string
  campaignId: string
  /** Where the distraction started */
  originDescription: string
  currentDepth: number
  depthLevel: DepthLevel

  /** What main thread this connects back to */
  targetThreadId: string
  targetThreadName: string
  connectionType: 'information' | 'resource' | 'obstacle' | 'foreshadowing' | 'character' | 'villain' | 'macguffin'

  /** The planned connection point */
  connectionDescription: string
  enablesQuestId?: string
  enablesBeatId?: string

  /** Generated content at each depth */
  layers: {
    depth: number
    summary: string
    npcsCreated: string[]
    locationsCreated: string[]
    secretsRevealed: string[]
  }[]

  /** If promoted to permanent content */
  promotedToArcId?: string
  promotedToQuestId?: string

  status: RabbitHoleStatus
}

export function escalateDepth(hole: RabbitHole): DepthLevel {
  hole.currentDepth++
  if (hole.currentDepth <= 0) return hole.depthLevel = 'surface'
  if (hole.currentDepth === 1) return hole.depthLevel = 'hook'
  if (hole.currentDepth === 2) return hole.depthLevel = 'investigation'
  if (hole.currentDepth === 3) return hole.depthLevel = 'mini_quest'
  if (hole.currentDepth === 4) return hole.depthLevel = 'resolution'
  return hole.depthLevel = 'side_arc'
}

export function shouldConnect(hole: RabbitHole): boolean {
  return hole.currentDepth >= 4 && hole.depthLevel === 'resolution'
}

// ============================================================
// MORAL PHYSICS — Alignment as force
// ============================================================

export type MoralAlignment =
  | 'lawful_good' | 'neutral_good' | 'chaotic_good'
  | 'lawful_neutral' | 'true_neutral' | 'chaotic_neutral'
  | 'lawful_evil' | 'neutral_evil' | 'chaotic_evil'
  | 'unaligned'

export interface MoralAxis {
  lawChaos: number  // -100 chaotic to +100 lawful
  goodEvil: number  // -100 evil to +100 good
}

export type VillainTier = 'minion' | 'lieutenant' | 'boss' | 'bbeg' | 'cosmic'
export type VillainArcStatus = 'lurking' | 'active' | 'confronted' | 'defeated' | 'escaped' | 'victorious'

export interface Villain {
  id: string
  name: string
  title?: string
  tier: VillainTier
  alignment: MoralAlignment
  evilIntensity: number  // 1-100

  /** What they want */
  goals: { description: string; progress: number; deadline?: number; consequence: string }[]

  /** Master plan */
  masterPlan?: { summary: string; phases: { name: string; status: 'pending' | 'active' | 'completed' | 'failed' }[] }

  /** Forces */
  minionCount: number
  lieutenantIds: string[]

  /** Weaknesses the party can exploit */
  weaknesses: { description: string; knownToParty: boolean; discoveryMethod?: string }[]

  /** Party awareness */
  visibility: {
    known: boolean
    nameKnown: boolean
    goalsKnown: boolean
    weaknessKnown: boolean
  }

  arcStatus: VillainArcStatus
}

export type PatronTier = 'local' | 'regional' | 'national' | 'continental' | 'divine'

export interface Patron {
  id: string
  name: string
  title?: string
  tier: PatronTier
  alignment: MoralAlignment
  goodIntensity: number

  /** What they expect */
  expectations: { description: string; priority: 'suggested' | 'expected' | 'required' }[]

  /** What they provide */
  blessings: { name: string; description: string; mechanical?: string; active: boolean }[]

  /** Party standing (-100 to +100) */
  partyStanding: number

  /** Who they oppose */
  opposes: { villainId: string; reason: string }[]
}

export interface Conflict {
  id: string
  name: string
  description: string
  evilSide: { villainIds: string[]; factionIds: string[]; forces: string }
  goodSide: { patronIds: string[]; factionIds: string[]; forces: string }
  stakes: { ifEvilWins: string; ifGoodWins: string; scope: 'local' | 'regional' | 'continental' | 'world' | 'planar' }
  status: 'brewing' | 'cold' | 'skirmishing' | 'war' | 'climax' | 'resolved'
  /** Balance: -100 evil winning to +100 good winning */
  balance: number
  partyRole: 'unaware' | 'bystanders' | 'minor_players' | 'key_players' | 'champions'
}

// ============================================================
// ALIGNMENT CONVERSION
// ============================================================

export function axesToAlignment(axis: MoralAxis): MoralAlignment {
  const lc = axis.lawChaos >= 30 ? 'lawful' : axis.lawChaos <= -30 ? 'chaotic' : 'neutral'
  const ge = axis.goodEvil >= 30 ? 'good' : axis.goodEvil <= -30 ? 'evil' : 'neutral'

  if (lc === 'neutral' && ge === 'neutral') return 'true_neutral'
  if (lc === 'neutral') return `neutral_${ge}` as MoralAlignment
  if (ge === 'neutral') return `${lc}_neutral` as MoralAlignment
  return `${lc}_${ge}` as MoralAlignment
}

export function alignmentToAxes(alignment: MoralAlignment): MoralAxis {
  const map: Record<string, MoralAxis> = {
    lawful_good:     { lawChaos: 75, goodEvil: 75 },
    neutral_good:    { lawChaos: 0, goodEvil: 75 },
    chaotic_good:    { lawChaos: -75, goodEvil: 75 },
    lawful_neutral:  { lawChaos: 75, goodEvil: 0 },
    true_neutral:    { lawChaos: 0, goodEvil: 0 },
    chaotic_neutral: { lawChaos: -75, goodEvil: 0 },
    lawful_evil:     { lawChaos: 75, goodEvil: -75 },
    neutral_evil:    { lawChaos: 0, goodEvil: -75 },
    chaotic_evil:    { lawChaos: -75, goodEvil: -75 },
    unaligned:       { lawChaos: 0, goodEvil: 0 },
  }
  return map[alignment] || { lawChaos: 0, goodEvil: 0 }
}
