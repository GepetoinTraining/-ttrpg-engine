/**
 * GUILD — Generic Guild System + Adventurers' Guild
 * ====================================================
 * 
 * The first guild. Template for ALL guilds.
 * 
 * Guild types share the same structure:
 *   - Chapters (one per qualifying hub)
 *   - Job board (type-specific jobs)
 *   - Members with ranks
 *   - Communication network (intel propagation)
 *   - Treasury with dues and job cuts
 * 
 * The Adventurers' Guild adds:
 *   - NPC parties (3-5 members, dispatched to jobs)
 *   - Travel log (parties discover terrain while traveling)
 *   - Intelligence system (sightings, road conditions, threat reports)
 *   - Economy integration (parties spend gold in home hub)
 * 
 * NPC parties use the SAME tickTraversal() as players.
 * They are the world's eyes and ears.
 */

import { z } from 'zod'

// ============================================================
// GUILD TYPES — Template for all guilds
// ============================================================

export const GuildTypeSchema = z.enum([
  'adventurers',  // Clear dungeons, escort caravans, investigate threats
  'merchant',     // Share prices, protect trade routes
  'mage',         // Share arcane knowledge, sell components
  'thieves',      // Share marks, fence goods, intel
  'artisan',      // Share techniques, bulk materials
  'religious',    // Share divine intel, coordinate temples
])
export type GuildType = z.infer<typeof GuildTypeSchema>

// ============================================================
// GUILD RANK
// ============================================================

export const GuildRankSchema = z.object({
  level: z.number().int().min(1).max(10),
  name: z.string(),
  minReputation: z.number().int(),
  privilegesUnlocked: z.array(z.string()).default([]),
})
export type GuildRank = z.infer<typeof GuildRankSchema>

export const ADVENTURER_RANKS: GuildRank[] = [
  { level: 1,  name: 'Copper',    minReputation: 0,   privilegesUnlocked: ['take_tier1_jobs'] },
  { level: 2,  name: 'Iron',      minReputation: 10,  privilegesUnlocked: ['take_tier2_jobs'] },
  { level: 3,  name: 'Silver',    minReputation: 25,  privilegesUnlocked: ['take_tier3_jobs', 'discount_lodging'] },
  { level: 4,  name: 'Gold',      minReputation: 50,  privilegesUnlocked: ['take_tier4_jobs', 'buy_intel'] },
  { level: 5,  name: 'Platinum',  minReputation: 80,  privilegesUnlocked: ['take_tier5_jobs', 'priority_dispatch', 'guild_vote'] },
]

// ============================================================
// GUILD JOB — Posted on chapter job boards
// ============================================================

export const JobTypeSchema = z.enum([
  'clear_gate',    // Clear a dungeon gate
  'bounty',        // Kill specific monster / leader
  'escort',        // Protect caravan along edge
  'patrol',        // Walk an edge, report intel
  'investigate',   // Check out a reported site
  'retrieve',      // Fetch item from dangerous location
])
export type JobType = z.infer<typeof JobTypeSchema>

export const JobStatusSchema = z.enum([
  'open',        // On the board, no taker yet
  'claimed',     // Party has taken it
  'in_progress', // Party is traveling or on-site
  'completed',   // Done successfully
  'failed',      // Party failed
  'expired',     // No one took it in time
])
export type JobStatus = z.infer<typeof JobStatusSchema>

export interface GuildJob {
  id: string
  type: JobType
  /** What to target (gate ID, edge ID, NPC ID) */
  targetId: string
  targetName: string
  /** Where this job originates */
  chapterNodeId: string
  /** Reward in GP */
  reward: number
  /** Difficulty tier */
  dangerTier: 1 | 2 | 3 | 4 | 5
  /** When it was posted */
  postedDay: number
  /** Who claimed it */
  claimedBy?: string
  /** Current status */
  status: JobStatus
  /** Expires after this day */
  expiresDay?: number
  /** Edge to traverse to reach the target */
  edgeId?: string
}

// ============================================================
// NPC PARTY MEMBER
// ============================================================

export const PartyRoleSchema = z.enum([
  'tank', 'healer', 'damage', 'utility', 'caster',
])
export type PartyRole = z.infer<typeof PartyRoleSchema>

export interface NPCPartyMember {
  entityId: string
  name: string
  level: number
  role: PartyRole
  combatRating: number
  alive: boolean
}

// ============================================================
// TRAVEL LOG — What a party observes while traversing
// ============================================================

export interface MonsterSighting {
  speciesId: string
  estimatedCount: number
  behaviorState: string     // hunting, patrolling, aggressive
  mileMarker: number
  threatLevel: number       // 1-10
}

export interface TravelLogEntry {
  edgeId: string
  day: number
  /** Sites discovered (from tickTraversal) */
  sitesFound: string[]             // site IDs
  /** Threats observed */
  monsterSightings: MonsterSighting[]
  /** Road condition observed per segment */
  roadConditions: { segmentIndex: number; condition: string }[]
  /** Overall assessment */
  dangerAssessment: 'safe' | 'moderate' | 'dangerous' | 'deadly'
}

// ============================================================
// NPC ADVENTURER PARTY
// ============================================================

export interface NPCAdventurerParty {
  id: string
  name: string
  members: NPCPartyMember[]

  // Base
  homeChapterNodeId: string
  currentNodeId: string

  // Capabilities
  partyLevel: number
  combatRating: number

  // State
  status: 'idle' | 'on_job' | 'recovering' | 'traveling' | 'disbanded'
  currentJobId?: string

  // Travel intel
  travelLog: TravelLogEntry[]

  // History
  jobsCompleted: number
  jobsFailed: number
  membersLost: number
  reputation: number          // 0-100

  // Economics
  gold: number
  weeklyExpenses: number
}

// ============================================================
// GUILD INTELLIGENCE — Aggregated from party travel logs
// ============================================================

export interface GuildIntelligence {
  chapterNodeId: string
  /** Known sites along edges (from party discoveries) */
  knownSites: { edgeId: string; siteId: string; siteName: string; siteType: string; reportedDay: number }[]
  /** Threat reports (from monster sightings during travel) */
  threatReports: { edgeId: string; sighting: MonsterSighting; reportedDay: number }[]
  /** Road condition observations */
  roadReports: { edgeId: string; segmentIndex: number; condition: string; reportedDay: number }[]
  /** Failed job warnings */
  failureReports: { jobId: string; partyId: string; casualties: number; notes: string; day: number }[]
}

// ============================================================
// GUILD CHAPTER — One per qualifying hub
// ============================================================

export interface GuildChapter {
  nodeId: string
  hubName: string
  chapterMaster: string       // NPC entity ID
  /** NPC party IDs registered to this chapter */
  partyIds: string[]
  /** Job IDs assigned to this chapter */
  localJobIds: string[]
  /** Facilities available */
  facilities: string[]        // training_hall, armory, infirmary, etc.
  /** Local reputation 0-100 */
  reputation: number
  /** Intel accumulated by parties */
  intelligence: GuildIntelligence
}

// ============================================================
// GUILD — The top-level structure
// ============================================================

export interface Guild {
  id: string
  name: string
  type: GuildType
  headquartersNodeId: string
  /**
   * Faction id that owns this guild (or null if independent).
   * When set, the guild's resources are part of that faction's purse —
   * inter-chapter intel propagation can lean on the faction's network.
   * Mirrors mm-banking's factionOwnerId pattern.
   */
  factionOwnerId: string | null

  // Chapters
  chapters: GuildChapter[]

  // Jobs
  jobBoard: GuildJob[]

  // Ranks
  ranks: GuildRank[]

  // Economics
  treasury: number
  memberDues: number           // weekly per member
  jobCut: number               // 0-1: fraction of bounty the guild takes

  // Communication
  messageSpeed: number         // days to relay intel between chapters
  networkReach: string[]       // hub node IDs with chapters
}

// ============================================================
// FACTORIES
// ============================================================

let _guildId = 0
export function resetGuildIdCounter(): void { _guildId = 0 }

let _partyId = 0
export function resetPartyIdCounter(): void { _partyId = 0 }

let _jobId = 0
export function resetJobIdCounter(): void { _jobId = 0 }

export function createGuild(
  name: string,
  type: GuildType,
  headquartersNodeId: string,
  hubName: string,
  options: { factionOwnerId?: string | null } = {},
): Guild {
  const id = `guild_${++_guildId}`
  const ranks = type === 'adventurers' ? ADVENTURER_RANKS : [
    { level: 1, name: 'Apprentice', minReputation: 0, privilegesUnlocked: [] },
    { level: 2, name: 'Journeyman', minReputation: 20, privilegesUnlocked: [] },
    { level: 3, name: 'Master', minReputation: 50, privilegesUnlocked: [] },
  ]

  return {
    id,
    name,
    type,
    headquartersNodeId,
    factionOwnerId: options.factionOwnerId ?? null,
    chapters: [{
      nodeId: headquartersNodeId,
      hubName,
      chapterMaster: `gm_${id}`,
      partyIds: [],
      localJobIds: [],
      facilities: ['job_board', 'common_room'],
      reputation: 50,
      intelligence: {
        chapterNodeId: headquartersNodeId,
        knownSites: [],
        threatReports: [],
        roadReports: [],
        failureReports: [],
      },
    }],
    jobBoard: [],
    ranks,
    treasury: 500,
    memberDues: 2,
    jobCut: 0.1,
    messageSpeed: 3, // days between chapters
    networkReach: [headquartersNodeId],
  }
}

export function addGuildChapter(
  guild: Guild,
  nodeId: string,
  hubName: string,
): GuildChapter {
  const chapter: GuildChapter = {
    nodeId,
    hubName,
    chapterMaster: `cm_${guild.id}_${nodeId}`,
    partyIds: [],
    localJobIds: [],
    facilities: ['job_board'],
    reputation: 30,
    intelligence: {
      chapterNodeId: nodeId,
      knownSites: [],
      threatReports: [],
      roadReports: [],
      failureReports: [],
    },
  }
  guild.chapters.push(chapter)
  guild.networkReach.push(nodeId)
  return chapter
}

export function createNPCParty(
  name: string,
  members: NPCPartyMember[],
  homeChapterNodeId: string,
): NPCAdventurerParty {
  const id = `party_${++_partyId}`
  const avgLevel = Math.floor(members.reduce((s, m) => s + m.level, 0) / members.length)
  const totalCR = members.reduce((s, m) => s + m.combatRating, 0)

  return {
    id,
    name,
    members,
    homeChapterNodeId,
    currentNodeId: homeChapterNodeId,
    partyLevel: avgLevel,
    combatRating: totalCR,
    status: 'idle',
    travelLog: [],
    jobsCompleted: 0,
    jobsFailed: 0,
    membersLost: 0,
    reputation: 10,
    gold: 50,
    weeklyExpenses: members.length * 5, // 5gp/member/week
  }
}

export function postJob(
  guild: Guild,
  type: JobType,
  targetId: string,
  targetName: string,
  chapterNodeId: string,
  reward: number,
  dangerTier: 1 | 2 | 3 | 4 | 5,
  worldDay: number,
  edgeId?: string,
): GuildJob {
  const job: GuildJob = {
    id: `job_${++_jobId}`,
    type,
    targetId,
    targetName,
    chapterNodeId,
    reward,
    dangerTier,
    postedDay: worldDay,
    status: 'open',
    expiresDay: worldDay + 30, // expires in 30 days
    edgeId,
  }
  guild.jobBoard.push(job)

  const chapter = guild.chapters.find(c => c.nodeId === chapterNodeId)
  if (chapter) chapter.localJobIds.push(job.id)

  return job
}

// ============================================================
// JOB MATCHING — Assign idle parties to open jobs
// ============================================================

export interface JobMatchResult {
  jobId: string
  partyId: string
  partyName: string
  jobType: JobType
  dangerTier: number
  partyCR: number
}

export function matchJobsToParties(
  guild: Guild,
  parties: NPCAdventurerParty[],
  chapterNodeId: string,
): JobMatchResult[] {
  const results: JobMatchResult[] = []

  // Get open jobs for this chapter
  const chapter = guild.chapters.find(c => c.nodeId === chapterNodeId)
  if (!chapter) return results

  const openJobs = guild.jobBoard
    .filter(j => j.status === 'open' && j.chapterNodeId === chapterNodeId)
    .sort((a, b) => b.reward - a.reward) // highest reward first

  // Get idle parties at this chapter
  const idleParties = parties
    .filter(p => p.status === 'idle' && p.homeChapterNodeId === chapterNodeId)
    .sort((a, b) => b.combatRating - a.combatRating) // strongest first

  for (const job of openJobs) {
    // Find a party strong enough for the job
    const minCR = job.dangerTier * 3 // tier 1 = 3, tier 5 = 15
    const party = idleParties.find(p =>
      p.combatRating >= minCR * 0.7 && // allow 70% threshold (risky but possible)
      !results.some(r => r.partyId === p.id) // not already matched
    )

    if (party) {
      results.push({
        jobId: job.id,
        partyId: party.id,
        partyName: party.name,
        jobType: job.type,
        dangerTier: job.dangerTier,
        partyCR: party.combatRating,
      })
    }
  }

  return results
}

// ============================================================
// DISPATCH — Send a party on a job
// ============================================================

export function dispatchParty(
  party: NPCAdventurerParty,
  job: GuildJob,
): void {
  party.status = 'on_job'
  party.currentJobId = job.id
  job.status = 'claimed'
  job.claimedBy = party.id
}

// ============================================================
// RESOLVE JOB — Party attempts to complete the job
// ============================================================

export interface JobResolutionResult {
  success: boolean
  partyId: string
  jobId: string
  casualties: number
  goldEarned: number
  goldToGuild: number
  reputationChange: number
  narrative: string
}

export function resolveJob(
  party: NPCAdventurerParty,
  job: GuildJob,
  guild: Guild,
  d20: number,
): JobResolutionResult {
  // DC = dangerTier × 5
  const dc = job.dangerTier * 5
  const partyMod = Math.floor(party.combatRating / 5) + Math.floor(party.partyLevel / 3)
  const total = d20 + partyMod

  const success = total >= dc

  // Casualties
  let casualties = 0
  if (!success) {
    // Failed: 1-2 casualties, minimum 1
    casualties = Math.min(party.members.filter(m => m.alive).length - 1, Math.ceil(job.dangerTier / 2))
    if (d20 <= 3) casualties += 1 // critical failure = extra casualty
  } else if (d20 <= 5) {
    // Success but barely: maybe 1 casualty
    casualties = job.dangerTier >= 4 ? 1 : 0
  }

  // Apply casualties
  casualties = Math.min(casualties, party.members.filter(m => m.alive).length)
  let killed = 0
  for (const member of party.members) {
    if (killed >= casualties) break
    if (member.alive) {
      member.alive = false
      killed++
    }
  }

  // Rewards
  const goldEarned = success ? job.reward : 0
  const goldToGuild = Math.floor(goldEarned * guild.jobCut)
  const goldToParty = goldEarned - goldToGuild

  // Reputation
  const repChange = success
    ? Math.ceil(job.dangerTier * 2)
    : -Math.ceil(job.dangerTier)

  // Update party
  party.gold += goldToParty
  party.reputation = Math.max(0, Math.min(100, party.reputation + repChange))
  party.membersLost += casualties
  party.status = casualties > 0 ? 'recovering' : 'idle'
  party.currentJobId = undefined
  party.combatRating = party.members.filter(m => m.alive).reduce((s, m) => s + m.combatRating, 0)

  if (success) {
    party.jobsCompleted++
    job.status = 'completed'
  } else {
    party.jobsFailed++
    job.status = 'failed'
  }

  // Disband if too few alive
  const aliveCount = party.members.filter(m => m.alive).length
  if (aliveCount < 2) {
    party.status = 'disbanded'
  }

  // Guild treasury
  guild.treasury += goldToGuild

  return {
    success,
    partyId: party.id,
    jobId: job.id,
    casualties,
    goldEarned,
    goldToGuild,
    reputationChange: repChange,
    narrative: success
      ? `${party.name} clears "${job.targetName}" (d20=${d20}+${partyMod}=${total} vs DC${dc}). Earned ${goldToParty}gp, ${casualties} casualties.`
      : `${party.name} fails "${job.targetName}" (d20=${d20}+${partyMod}=${total} vs DC${dc}). ${casualties} lost.`,
  }
}

// ============================================================
// FILE INTEL — Party returns and reports findings
// ============================================================

export function fileIntelReport(
  party: NPCAdventurerParty,
  chapter: GuildChapter,
): number {
  let reportsAdded = 0

  for (const entry of party.travelLog) {
    for (const siteId of entry.sitesFound) {
      const exists = chapter.intelligence.knownSites.some(k => k.siteId === siteId)
      if (!exists) {
        chapter.intelligence.knownSites.push({
          edgeId: entry.edgeId,
          siteId,
          siteName: siteId, // Would be resolved from edge.discoveredSites
          siteType: 'unknown',
          reportedDay: entry.day,
        })
        reportsAdded++
      }
    }
    for (const sighting of entry.monsterSightings) {
      chapter.intelligence.threatReports.push({
        edgeId: entry.edgeId,
        sighting,
        reportedDay: entry.day,
      })
      reportsAdded++
    }
    for (const road of entry.roadConditions) {
      chapter.intelligence.roadReports.push({
        edgeId: entry.edgeId,
        segmentIndex: road.segmentIndex,
        condition: road.condition,
        reportedDay: entry.day,
      })
      reportsAdded++
    }
  }

  // Clear the party's travel log after filing
  party.travelLog = []

  return reportsAdded
}

// ============================================================
// PROPAGATE INTEL — Share between chapters
// ============================================================

export interface IntelPropagation {
  fromChapterNodeId: string
  toChapterNodeId: string
  reportsShared: number
  arrivalDay: number
}

export function propagateIntel(
  guild: Guild,
  fromNodeId: string,
  worldDay: number,
): IntelPropagation[] {
  const results: IntelPropagation[] = []
  const fromChapter = guild.chapters.find(c => c.nodeId === fromNodeId)
  if (!fromChapter) return results

  for (const toChapter of guild.chapters) {
    if (toChapter.nodeId === fromNodeId) continue

    let shared = 0

    // Share known sites not yet known at target
    for (const site of fromChapter.intelligence.knownSites) {
      const exists = toChapter.intelligence.knownSites.some(k => k.siteId === site.siteId)
      if (!exists) {
        toChapter.intelligence.knownSites.push({
          ...site,
          reportedDay: worldDay + guild.messageSpeed,
        })
        shared++
      }
    }

    // Share threat reports from last messageSpeed days
    const recentThreats = fromChapter.intelligence.threatReports
      .filter(t => t.reportedDay >= worldDay - guild.messageSpeed)
    for (const threat of recentThreats) {
      toChapter.intelligence.threatReports.push({
        ...threat,
        reportedDay: worldDay + guild.messageSpeed,
      })
      shared++
    }

    if (shared > 0) {
      results.push({
        fromChapterNodeId: fromNodeId,
        toChapterNodeId: toChapter.nodeId,
        reportsShared: shared,
        arrivalDay: worldDay + guild.messageSpeed,
      })
    }
  }

  return results
}

// ============================================================
// WEEKLY GUILD TICK — Process a chapter's weekly activity
// ============================================================

export interface GuildTickResult {
  chapterNodeId: string
  jobsPosted: number
  jobsMatched: number
  jobsResolved: number
  jobsExpired: number
  intelFiled: number
  intelPropagated: number
  duesCollected: number
}

export function tickGuildChapter(
  guild: Guild,
  chapterNodeId: string,
  parties: NPCAdventurerParty[],
  worldDay: number,
): GuildTickResult {
  const result: GuildTickResult = {
    chapterNodeId,
    jobsPosted: 0,
    jobsMatched: 0,
    jobsResolved: 0,
    jobsExpired: 0,
    intelFiled: 0,
    intelPropagated: 0,
    duesCollected: 0,
  }

  const chapter = guild.chapters.find(c => c.nodeId === chapterNodeId)
  if (!chapter) return result

  // Expire old jobs
  for (const job of guild.jobBoard) {
    if (job.status === 'open' && job.expiresDay && worldDay > job.expiresDay) {
      job.status = 'expired'
      result.jobsExpired++
    }
  }

  // Match jobs to idle parties
  const matches = matchJobsToParties(guild, parties, chapterNodeId)
  for (const match of matches) {
    const party = parties.find(p => p.id === match.partyId)
    const job = guild.jobBoard.find(j => j.id === match.jobId)
    if (party && job) {
      dispatchParty(party, job)
      result.jobsMatched++
    }
  }

  // File intel from returned parties
  const returnedParties = parties.filter(
    p => (p.status === 'idle' || p.status === 'recovering') &&
    p.homeChapterNodeId === chapterNodeId &&
    p.travelLog.length > 0
  )
  for (const party of returnedParties) {
    result.intelFiled += fileIntelReport(party, chapter)
  }

  // Propagate intel to other chapters
  const propagations = propagateIntel(guild, chapterNodeId, worldDay)
  result.intelPropagated = propagations.reduce((s, p) => s + p.reportsShared, 0)

  // Collect dues from active parties
  const activeParties = parties.filter(
    p => p.status !== 'disbanded' && p.homeChapterNodeId === chapterNodeId
  )
  const dues = activeParties.length * guild.memberDues
  guild.treasury += dues
  result.duesCollected = dues

  // Recover parties that were recovering
  for (const party of parties) {
    if (party.status === 'recovering' && party.homeChapterNodeId === chapterNodeId) {
      party.status = 'idle'
    }
  }

  return result
}

// ============================================================
// CARAVAN ARRIVAL INGESTION — Caravans carry rumors → guild intel
// ============================================================

/**
 * Minimal shape of a caravan-borne rumor. Structurally compatible with
 * `Rumor` from engine/lore.ts (extends KnowledgeEntry). We don't import
 * the full type because guild.ts is below the caravan layer in the
 * dependency stack.
 */
export interface CaravanRumor {
  topic: string
  category: string         // KnowledgeCategory at runtime
  accuracy: number
  fidelity: number
  /** The caravan's source/dest used to back-resolve which edge this is about. */
  sourceChain?: string[]
}

export interface CaravanArrivalDigest {
  /** Rumors that arrived with the caravan (potentially mutated through retelling). */
  rumorsSpread: CaravanRumor[]
  /** Edge the caravan traversed to reach the chapter — used to file road/site intel. */
  edgeId?: string
}

export interface DigestResult {
  /** Threat reports added (monster topic). */
  threatsAdded: number
  /** Site reports added (geography topic). */
  sitesAdded: number
  /** Total rumors digested (all categories). */
  rumorsConsumed: number
}

/**
 * Ingest a caravan arrival into a chapter's intel network.
 *
 * Caravan rumors with `category === 'monster'` become threat reports.
 * Rumors with `category === 'geography'` become known-site reports.
 * Other categories are noted but not transformed into structured intel.
 *
 * The chapter's intelligence is mutated in place. Returns counters.
 */
export function digestCaravanArrival(
  arrival: CaravanArrivalDigest,
  chapter: GuildChapter,
  worldDay: number,
): DigestResult {
  const result: DigestResult = { threatsAdded: 0, sitesAdded: 0, rumorsConsumed: 0 }
  const edgeId = arrival.edgeId ?? 'unknown'

  for (const rumor of arrival.rumorsSpread) {
    result.rumorsConsumed++

    if (rumor.category === 'monster') {
      // Synthesize a coarse threat report from the rumor's fidelity-weighted
      // accuracy. We don't know mile/count precisely — fill with conservative
      // defaults that surfaces can refine later.
      const threatLevel = Math.max(1, Math.round(rumor.accuracy * rumor.fidelity * 10))
      chapter.intelligence.threatReports.push({
        edgeId,
        sighting: {
          speciesId: rumor.topic,            // e.g. "goblin_raid_party"
          estimatedCount: 0,                  // unknown from rumor alone
          behaviorState: 'reported',
          mileMarker: 0,                      // unknown — surface fills if it can
          threatLevel,
        },
        reportedDay: worldDay,
      })
      result.threatsAdded++
    } else if (rumor.category === 'geography') {
      const siteId = `rumor_${rumor.topic}_${worldDay}`
      const exists = chapter.intelligence.knownSites.some(k => k.siteId === siteId)
      if (!exists) {
        chapter.intelligence.knownSites.push({
          edgeId,
          siteId,
          siteName: rumor.topic,
          siteType: 'rumor',
          reportedDay: worldDay,
        })
        result.sitesAdded++
      }
    }
    // Other categories (history, religion, politics, ...) are ignored for
    // intel structure — they exist as guild lore stored elsewhere.
  }

  return result
}
