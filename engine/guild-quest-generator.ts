/**
 * GUILD QUEST GENERATOR — Town κ → adventurer's guild job board
 * ================================================================
 *
 * The Adventurer's Guild is the DM-when-there-is-no-DM. Each tick, this
 * module reads κ at the chapter's hub, detects the most pressing town
 * problems, and synthesizes a GuildJob from the top need.
 *
 * Detection categories:
 *   commodity_shortage    — supply < demand for a key material
 *   profession_bottleneck — a profession can't advance because of missing input
 *   monster_threat        — κ.ecology.dangerLevel high or recent threat reports
 *   food_crisis           — meat/grain low, or starvationModifier elevated
 *   knowledge_gap         — κ.knowledge.potentials waiting to activate
 *   faction_pressure      — κ.faction.contested or hostile neighbor
 *   route_danger          — recent edge threat reports
 *
 * Scoring:
 *   Each need carries a severity 0-1. The top-severity need is converted
 *   to a job. Reward and dangerTier scale with severity + town wealth.
 *
 * Deterministic: same κ + same d20 → same job (id increments aside).
 */

import type {
  TP,
  EconomyRules,
  EcologyRules,
  FactionRules,
  WeatherRules,
  KnowledgeRules,
  InfrastructureRules,
} from './tp.js'
import {
  type Guild,
  type GuildChapter,
  type GuildJob,
  type JobType,
  postJob,
} from './guild.js'

// ============================================================
// PROFESSION → REQUIRED ADVANCEMENT MATERIAL
// ============================================================
// When a profession sits at journeyman/master tier, the next tier
// requires a specific advancement material. The guild generates
// "retrieve material X" quests for these bottlenecks.

export const PROFESSION_ADVANCEMENT_MATERIAL: Record<string, string> = {
  // Smithing chain
  blacksmith: 'iron',           // basic → journeyman
  weaponsmith: 'mythril',       // master → expert: rare metal
  armorsmith: 'mithril',        // master → expert
  jeweler: 'gemstone_uncut',
  goldsmith: 'gold_ingot',

  // Alchemy chain
  alchemist: 'magic_components',
  apothecary: 'rare_herbs',

  // Crafts
  weaver: 'silk',
  tailor: 'fine_cloth',
  carpenter: 'hardwood',
  mason: 'cut_stone',
  potter: 'kaolin_clay',
  tanner: 'dragon_hide',
  brewer: 'rare_grain',
  baker: 'imported_spices',
  scribe: 'rare_ink',
  enchanter: 'arcane_dust',
  shipwright: 'seasoned_oak',
}

// ============================================================
// NEED TYPES
// ============================================================

export type NeedKind =
  | 'commodity_shortage'
  | 'profession_bottleneck'
  | 'monster_threat'
  | 'food_crisis'
  | 'knowledge_gap'
  | 'faction_pressure'
  | 'route_danger'

export interface TownNeed {
  kind: NeedKind
  /** 0-1 — how urgent. Used to pick the top need. */
  severity: number
  /** Human-readable description of the problem. */
  description: string
  /** The proposed quest if this need wins. */
  questSuggestion: {
    jobType: JobType
    targetId: string
    targetName: string
    reward: number
    dangerTier: 1 | 2 | 3 | 4 | 5
    edgeId?: string
  }
}

// ============================================================
// CONFIG
// ============================================================

/** Below this supply/demand ratio a commodity is considered short. */
const SHORTAGE_RATIO = 0.6
/** danger level above which a quest is generated. */
const MONSTER_THREAT_THRESHOLD = 0.4
/** starvation modifier above which a food crisis fires. */
const FOOD_CRISIS_THRESHOLD = 0.2
/** threats logged within this many days are still "recent". */
const RECENT_THREAT_WINDOW_DAYS = 30

/** Reward base scaled by danger tier 1..5. */
const REWARD_BY_TIER: Record<number, number> = {
  1: 50,
  2: 150,
  3: 500,
  4: 1500,
  5: 5000,
}

// ============================================================
// DETECTION
// ============================================================

interface NodeKappa {
  economy?: EconomyRules
  ecology?: EcologyRules
  faction?: FactionRules
  weather?: WeatherRules
  knowledge?: KnowledgeRules
  infrastructure?: InfrastructureRules
}

/**
 * Detect every active need at this hub. Pure read — no mutation.
 */
export function detectTownNeeds(
  tp: TP,
  hubNodeId: string,
  chapter: GuildChapter | undefined,
  worldDay: number,
): TownNeed[] {
  const ctx = tp.resolve(hubNodeId) as NodeKappa | undefined
  if (!ctx) return []
  const needs: TownNeed[] = []

  // 1. COMMODITY SHORTAGES
  const commodities = ctx.economy?.commodities ?? {}
  for (const [name, info] of Object.entries(commodities)) {
    const supply = info.supply ?? 0
    const demand = info.demand ?? 0
    if (demand <= 0) continue
    const ratio = supply / demand
    if (ratio < SHORTAGE_RATIO) {
      const severity = Math.min(1, 1 - ratio)
      needs.push({
        kind: 'commodity_shortage',
        severity,
        description: `${hubNodeId} is short on ${name} (${supply.toFixed(0)}/${demand.toFixed(0)})`,
        questSuggestion: {
          jobType: 'retrieve',
          targetId: name,
          targetName: name,
          reward: Math.ceil(REWARD_BY_TIER[1] * (1 + severity * 4)),
          dangerTier: 1,
        },
      })
    }
  }

  // 2. PROFESSION BOTTLENECKS — derived from κ.infrastructure.professions
  const professions = ctx.infrastructure?.professions ?? {}
  for (const [role, info] of Object.entries(professions)) {
    const tier = info.tier ?? 'basic'
    const count = info.count ?? 0
    if (count === 0) continue
    // Only journeyman/master tier shops have advancement bottlenecks
    if (tier !== 'journeyman' && tier !== 'master') continue
    const material = PROFESSION_ADVANCEMENT_MATERIAL[role]
    if (!material) continue
    // Check if the material is in supply
    const matInfo = commodities[material]
    const supply = matInfo?.supply ?? 0
    if (supply > 5) continue   // already have some — not urgent
    const severity = tier === 'master' ? 0.85 : 0.6
    needs.push({
      kind: 'profession_bottleneck',
      severity,
      description: `The ${role}'s shop needs ${material} to advance past ${tier}`,
      questSuggestion: {
        jobType: 'retrieve',
        targetId: material,
        targetName: material,
        reward: tier === 'master' ? REWARD_BY_TIER[3] : REWARD_BY_TIER[2],
        dangerTier: tier === 'master' ? 3 : 2,
      },
    })
  }

  // 3. MONSTER THREAT
  const dangerLevel = ctx.ecology?.dangerLevel ?? 0
  if (dangerLevel >= MONSTER_THREAT_THRESHOLD) {
    const dominantThreats = ctx.ecology?.dominantThreats ?? []
    const target = dominantThreats[0] ?? 'unknown_threat'
    const tier = dangerLevelToTier(dangerLevel)
    needs.push({
      kind: 'monster_threat',
      severity: dangerLevel,
      description: `Monsters near ${hubNodeId} (${target})`,
      questSuggestion: {
        jobType: 'bounty',
        targetId: target,
        targetName: target,
        reward: Math.ceil(REWARD_BY_TIER[tier] * (0.5 + dangerLevel)),
        dangerTier: tier,
      },
    })
  }

  // 4. RECENT EDGE THREATS — chapter-scoped
  if (chapter) {
    const recentThreats = chapter.intelligence.threatReports.filter(
      t => worldDay - t.reportedDay <= RECENT_THREAT_WINDOW_DAYS,
    )
    if (recentThreats.length > 0) {
      // Group by edge; pick the worst one
      const byEdge = new Map<string, number>()
      for (const t of recentThreats) {
        byEdge.set(t.edgeId, (byEdge.get(t.edgeId) ?? 0) + t.sighting.threatLevel)
      }
      let worstEdge: string | null = null
      let worstScore = 0
      for (const [edge, score] of byEdge) {
        if (score > worstScore) { worstEdge = edge; worstScore = score }
      }
      if (worstEdge) {
        const severity = Math.min(1, worstScore / 30)
        const tier = Math.max(1, Math.min(5, Math.ceil(worstScore / 8))) as 1|2|3|4|5
        needs.push({
          kind: 'route_danger',
          severity,
          description: `${worstEdge} has accumulated threat reports`,
          questSuggestion: {
            jobType: 'patrol',
            targetId: worstEdge,
            targetName: worstEdge,
            reward: Math.ceil(REWARD_BY_TIER[tier] * 0.6),
            dangerTier: tier,
            edgeId: worstEdge,
          },
        })
      }
    }
  }

  // 5. FOOD CRISIS — fires only with positive signal:
  //    - starvationModifier explicitly elevated, OR
  //    - meat/grain are TRACKED (demand>0) but in deficit
  const starvationMod = ctx.weather?.modifiers?.starvationModifier ?? 0
  const meatInfo = commodities['meat']
  const grainInfo = commodities['grain']
  const trackedFoodInDeficit =
    (meatInfo && (meatInfo.demand ?? 0) > 0 && (meatInfo.supply ?? 0) < 50) ||
    (grainInfo && (grainInfo.demand ?? 0) > 0 && (grainInfo.supply ?? 0) < 50)
  if (starvationMod >= FOOD_CRISIS_THRESHOLD || trackedFoodInDeficit) {
    const severity = Math.max(starvationMod, trackedFoodInDeficit ? 0.6 : 0.3)
    needs.push({
      kind: 'food_crisis',
      severity,
      description: `${hubNodeId} faces food shortage`,
      questSuggestion: {
        jobType: 'retrieve',
        targetId: 'meat',
        targetName: 'food supply',
        reward: REWARD_BY_TIER[1],
        dangerTier: 1,
      },
    })
  }

  // 6. KNOWLEDGE GAP
  const potentials = ctx.knowledge?.potentials ?? []
  if (potentials.length > 0) {
    const target = potentials[0]
    needs.push({
      kind: 'knowledge_gap',
      severity: 0.4,            // background priority
      description: `Research stalled — need to seed knowledge of ${target}`,
      questSuggestion: {
        jobType: 'investigate',
        targetId: target,
        targetName: `tome of ${target}`,
        reward: REWARD_BY_TIER[2],
        dangerTier: 2,
      },
    })
  }

  // 7. FACTION PRESSURE
  const contested = ctx.faction?.contested ?? false
  if (contested) {
    needs.push({
      kind: 'faction_pressure',
      severity: 0.5,
      description: `Faction control of ${hubNodeId} is contested`,
      questSuggestion: {
        jobType: 'investigate',
        targetId: hubNodeId,
        targetName: 'rival faction activity',
        reward: REWARD_BY_TIER[3],
        dangerTier: 2,
      },
    })
  }

  return needs
}

function dangerLevelToTier(dangerLevel: number): 1 | 2 | 3 | 4 | 5 {
  if (dangerLevel >= 0.85) return 5
  if (dangerLevel >= 0.65) return 4
  if (dangerLevel >= 0.45) return 3
  if (dangerLevel >= 0.25) return 2
  return 1
}

// ============================================================
// GENERATION — Pick top need, post job
// ============================================================

export interface GenerateQuestInput {
  tp: TP
  guild: Guild
  chapter: GuildChapter
  hubNodeId: string
  worldDay: number
  /** d20 used for tie-breaking when multiple needs share the top severity. */
  d20: number
}

export interface GenerateQuestOutput {
  job: GuildJob | null
  needs: TownNeed[]
  /** Which need was chosen (if any). */
  pickedNeed: TownNeed | null
}

/**
 * Detect needs and synthesize a quest for the chapter's job board.
 * Picks the highest-severity need; ties broken by d20 ordering.
 *
 * Returns null job if there are no detectable needs.
 */
export function generateQuestForChapter(
  input: GenerateQuestInput,
): GenerateQuestOutput {
  const needs = detectTownNeeds(input.tp, input.hubNodeId, input.chapter, input.worldDay)
  if (needs.length === 0) {
    return { job: null, needs: [], pickedNeed: null }
  }

  // Sort by severity descending; tie-break by d20 modulo
  const sorted = [...needs].sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity
    // Stable mod-based tie break — d20 picks an order
    const ka = (a.kind + a.questSuggestion.targetId).length
    const kb = (b.kind + b.questSuggestion.targetId).length
    return ((ka + input.d20) % 7) - ((kb + input.d20) % 7)
  })

  const picked = sorted[0]
  const q = picked.questSuggestion
  const job = postJob(
    input.guild,
    q.jobType,
    q.targetId,
    q.targetName,
    input.chapter.nodeId,
    q.reward,
    q.dangerTier,
    input.worldDay,
    q.edgeId,
  )

  return { job, needs, pickedNeed: picked }
}

// ============================================================
// THINNING POLICY — When should we add a quest?
// ============================================================

/**
 * The chapter's job board is "thin" if it has fewer than this many open
 * jobs at the chapter's hub. Below that threshold we generate a new quest.
 */
export const OPEN_JOB_THRESHOLD = 3

/**
 * Returns true iff the chapter has fewer than OPEN_JOB_THRESHOLD open jobs.
 */
export function isJobBoardThin(guild: Guild, chapterNodeId: string): boolean {
  const open = guild.jobBoard.filter(
    j => j.status === 'open' && j.chapterNodeId === chapterNodeId,
  ).length
  return open < OPEN_JOB_THRESHOLD
}
