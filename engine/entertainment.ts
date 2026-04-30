/**
 * ENTERTAINMENT & ARTS — The Bard Economy
 * ==================================================
 *
 * Performances generate gold + cultural influence.
 * Bards are information nodes — they collect and spread rumors.
 * Patronage ties arts to the noble economy.
 *
 * Weekly tick:
 *   - Performers at venues generate revenue
 *   - Cultural influence modifies settlement morale
 *   - Rumor network propagates information
 */

// ============================================================
// PERFORMANCE TYPES
// ============================================================

export type PerformanceType =
  | 'music' | 'theater' | 'storytelling' | 'dance'
  | 'poetry' | 'comedy' | 'acrobatics' | 'oration'

export type VenueCategory = 'tavern' | 'theater' | 'arena' | 'street' | 'court' | 'festival'

export const VENUE_CAPACITY: Record<VenueCategory, number> = {
  street:   20,
  tavern:   40,
  theater:  150,
  arena:    500,
  court:    30,
  festival: 1000,
}

export const VENUE_PRESTIGE: Record<VenueCategory, number> = {
  street:   1,
  tavern:   2,
  theater:  4,
  court:    5,
  arena:    3,
  festival: 4,
}

// ============================================================
// PERFORMERS
// ============================================================

export interface Performer {
  id: string
  npcId: string
  specialties: PerformanceType[]
  skillMod: number           // performance check modifier
  reputation: number         // 0-100, grows with successful performances
  patronId?: string          // noble/faction sponsoring them
  homeSettlementId: string
}

export interface PerformanceResult {
  performerId: string
  venueCategory: VenueCategory
  type: PerformanceType
  d20: number
  totalCheck: number
  quality: 'disaster' | 'poor' | 'average' | 'good' | 'masterwork'
  revenue: number
  reputationChange: number
  rumorsCollected: number    // bards hear things during performances
}

/**
 * Resolve a performance. Revenue = audience × quality × prestige.
 */
export function resolvePerformance(
  performer: Performer,
  venue: VenueCategory,
  type: PerformanceType,
  d20: number,
  audienceFill: number, // 0.0 - 1.0 of capacity
): PerformanceResult {
  const check = d20 + performer.skillMod
  let quality: PerformanceResult['quality']
  let qualityMul: number

  if (check <= 5)       { quality = 'disaster';   qualityMul = 0 }
  else if (check <= 10) { quality = 'poor';       qualityMul = 0.5 }
  else if (check <= 15) { quality = 'average';    qualityMul = 1.0 }
  else if (check <= 22) { quality = 'good';       qualityMul = 1.5 }
  else                  { quality = 'masterwork'; qualityMul = 3.0 }

  const audience = Math.floor(VENUE_CAPACITY[venue] * Math.min(1, audienceFill))
  const prestige = VENUE_PRESTIGE[venue]

  // Revenue: 1 CP per audience member × quality × prestige / 100 → GP
  const revenue = (audience * qualityMul * prestige) / 100

  // Reputation: +2 for good, +5 for masterwork, -3 for disaster
  let reputationChange = 0
  if (quality === 'masterwork') reputationChange = 5
  else if (quality === 'good') reputationChange = 2
  else if (quality === 'average') reputationChange = 0
  else if (quality === 'poor') reputationChange = -1
  else reputationChange = -3

  // Bards collect rumors while performing (more with higher check)
  const rumorsCollected = quality === 'disaster' ? 0 : Math.max(0, Math.floor((check - 8) / 4))

  performer.reputation = Math.max(0, Math.min(100, performer.reputation + reputationChange))

  return {
    performerId: performer.id,
    venueCategory: venue,
    type,
    d20,
    totalCheck: check,
    quality,
    revenue,
    reputationChange,
    rumorsCollected,
  }
}

// ============================================================
// PATRONAGE — Nobles sponsor artists
// ============================================================

export interface Patronage {
  patronId: string       // noble/faction ID
  performerId: string
  weeklyStipend: number  // GP per week
  exclusivity: boolean   // patron demands exclusive performances
  startedDay: number
}

/**
 * Calculate patron benefit: reputation boost + cultural influence.
 * Higher-rep performers give more influence to patrons.
 */
export function patronBenefit(performer: Performer, patronage: Patronage): {
  culturalInfluence: number
  weeklyReputationGain: number
} {
  const repBonus = Math.floor(performer.reputation / 20) // 0-5
  return {
    culturalInfluence: repBonus * 2 + (patronage.exclusivity ? 5 : 0),
    weeklyReputationGain: 1, // steady drip from having a patron
  }
}

// ============================================================
// CULTURAL INFLUENCE — Settlement morale modifier
// ============================================================

export interface CulturalScore {
  settlementId: string
  entertainmentScore: number // sum of performer reputations at this settlement
  weeklyRevenue: number      // total entertainment revenue
  moraleBonus: number        // κ modifier to settlement stability
}

/**
 * Calculate cultural score for a settlement.
 * More/better performers → higher morale → less unrest.
 */
export function calculateCulturalScore(
  settlementId: string,
  performers: Performer[],
  weeklyRevenue: number,
): CulturalScore {
  const localPerformers = performers.filter(p => p.homeSettlementId === settlementId)
  const entertainmentScore = localPerformers.reduce((sum, p) => sum + p.reputation, 0)

  // Morale: 1 point per 20 entertainment score, capped at 10
  const moraleBonus = Math.min(10, Math.floor(entertainmentScore / 20))

  return {
    settlementId,
    entertainmentScore,
    weeklyRevenue,
    moraleBonus,
  }
}
