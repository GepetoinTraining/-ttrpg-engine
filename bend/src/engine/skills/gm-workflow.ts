/**
 * DM WORKFLOW FOR SKILL MANAGEMENT
 * ==================================
 *
 * The DM remains the arbiter of all skill discoveries.
 * This file provides the workflow for:
 *
 * 1. Reviewing pending skill discoveries
 * 2. Approving, modifying, or rejecting skills
 * 3. Managing campaign-specific discovery rules
 * 4. Granting proficiencies and expertise
 * 5. Creating custom synergies
 *
 * The system presents recommendations but NEVER
 * automatically approves skills. The tabletop RPG
 * flow requires human judgment.
 */

import { randomUUID } from 'crypto'
import { z } from 'zod'
import {
  type CharacterSkills,
  type DiscoveredSkillDefinition,
  type DiscoveryRule,
  type ActionContext,
  type CoreSkill,
  DiscoveredSkillDefinitionSchema,
  calculateSkillLevel,
} from './schema'
import {
  type Synergy,
} from './synergies'
import {
  approveDiscovery,
  rejectDiscovery,
} from './discovery'

// ============================================
// AI ASSESSMENT
// ============================================

/**
 * AI-generated assessment for DM reference.
 * The AI evaluates balance and provides reasoning.
 */
export const AIAssessmentSchema = z.object({
  /** Should the DM approve this? */
  suggestedApproval: z.boolean(),

  /** Explanation of the recommendation */
  reasoning: z.string(),

  /** Potential balance concerns */
  balanceConcerns: z.array(z.string()),

  /** Suggested modifications if any */
  suggestedModifications: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    scalingAbility: z.string().optional(),
    tags: z.array(z.string()).optional(),
    scope: z.enum(['character', 'campaign', 'global']).optional(),
  }).optional(),

  /** Similar existing skills for reference */
  similarSkills: z.array(z.object({
    name: z.string(),
    similarity: z.number(), // 0-100
    reason: z.string(),
  })),

  /** Power level assessment (1-5) */
  powerLevel: z.number().int().min(1).max(5),

  /** Narrative fit assessment (1-5) */
  narrativeFit: z.number().int().min(1).max(5),
})
export type AIAssessment = z.infer<typeof AIAssessmentSchema>

// ============================================
// DISCOVERY REQUEST
// ============================================

/**
 * A skill discovery request awaiting DM review.
 */
export const SkillDiscoveryRequestSchema = z.object({
  /** Unique ID for this request */
  id: z.string().uuid(),

  /** Campaign this is for */
  campaignId: z.string().uuid(),

  /** Character who discovered the skill */
  characterId: z.string().uuid(),
  characterName: z.string(),

  /** The proposed skill */
  proposedSkill: DiscoveredSkillDefinitionSchema,

  /** Context of discovery */
  discoveryContext: z.object({
    actionDescription: z.string(),
    triggerTags: z.array(z.string()),
    magnitude: z.number().int(),
    rollResult: z.string().optional(),
    narrativeMoment: z.string().optional(),
    sessionId: z.string().uuid().optional(),
    locationName: z.string().optional(),
  }),

  /** AI assessment for DM reference */
  aiAssessment: AIAssessmentSchema.optional(),

  /** Current status */
  status: z.enum(['pending', 'approved', 'rejected', 'modified']),

  /** When request was created */
  requestedAt: z.date(),

  /** When DM reviewed (if any) */
  reviewedAt: z.date().optional(),

  /** DM's notes on the decision */
  dmNotes: z.string().optional(),
})
export type SkillDiscoveryRequest = z.infer<typeof SkillDiscoveryRequestSchema>

// ============================================
// DM ACTION RESULT
// ============================================

export const DMActionResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  updatedSkills: z.any().optional(), // CharacterSkills
  error: z.string().optional(),
})
export type DMActionResult = z.infer<typeof DMActionResultSchema>

// ============================================
// DM WORKFLOW CLASS
// ============================================

export class DMSkillWorkflow {
  /**
   * Create a discovery request from a discovery result.
   */
  static createRequest(
    campaignId: string,
    characterId: string,
    characterName: string,
    skill: DiscoveredSkillDefinition,
    context: ActionContext
  ): SkillDiscoveryRequest {
    return {
      id: randomUUID(),
      campaignId,
      characterId,
      characterName,
      proposedSkill: skill,
      discoveryContext: {
        actionDescription: context.narrativeDescription ?? 'Unknown action',
        triggerTags: context.tags,
        magnitude: context.magnitude,
        rollResult: context.rollResult
          ? `${context.rollResult.natural} (${context.rollResult.total} total)${context.rollResult.wasCritical ? ' CRITICAL!' : ''}`
          : undefined,
        narrativeMoment: context.narrativeDescription,
        sessionId: context.sessionId,
        locationName: context.locationName,
      },
      status: 'pending',
      requestedAt: new Date(),
    }
  }

  /**
   * Generate AI assessment for a discovery request.
   */
  static generateAssessment(
    request: SkillDiscoveryRequest,
    existingSkills: string[] = []
  ): AIAssessment {
    const skill = request.proposedSkill
    const context = request.discoveryContext

    // Analyze balance concerns
    const balanceConcerns: string[] = []

    // Check for overly broad skill
    if (skill.tags.length > 10) {
      balanceConcerns.push('Skill has many tags - may overlap with too many existing skills')
    }

    // Check for potentially OP lore equivalence
    if (skill.loreEquivalence) {
      const maxLevel = Math.max(...Object.values(skill.loreEquivalence))
      if (maxLevel > 3) {
        balanceConcerns.push('High lore equivalence may bypass magical prerequisites')
      }
    }

    // Check parent skills
    if (skill.parentSkills.length === 1) {
      balanceConcerns.push('Single parent skill - consider if this is too specialized')
    }

    // Calculate power level (1-5)
    let powerLevel = 3
    if (skill.loreEquivalence) powerLevel++
    if (skill.parentSkills.length > 2) powerLevel++
    if (context.magnitude > 80) powerLevel++
    if (skill.tags.length < 5) powerLevel--
    powerLevel = Math.max(1, Math.min(5, powerLevel))

    // Calculate narrative fit (1-5)
    let narrativeFit = 3
    if (context.narrativeMoment) narrativeFit++
    if (context.locationName) narrativeFit++
    if (context.rollResult?.includes('CRITICAL')) narrativeFit++
    if (context.magnitude > 60) narrativeFit++
    narrativeFit = Math.max(1, Math.min(5, narrativeFit))

    // Find similar existing skills
    const similarSkills: AIAssessment['similarSkills'] = []
    for (const existingName of existingSkills) {
      // Simple tag overlap check
      const overlapCount = skill.tags.filter(t =>
        existingName.toLowerCase().includes(t.toLowerCase())
      ).length
      if (overlapCount > 0) {
        similarSkills.push({
          name: existingName,
          similarity: Math.min(100, overlapCount * 20),
          reason: `Shares ${overlapCount} tag(s)`,
        })
      }
    }

    // Generate recommendation
    const suggestedApproval =
      balanceConcerns.length < 2 &&
      powerLevel <= 4 &&
      narrativeFit >= 3

    let reasoning = ''
    if (suggestedApproval) {
      reasoning = `Discovery appears balanced and narratively fitting. `
      reasoning += `Power level ${powerLevel}/5, narrative fit ${narrativeFit}/5. `
      if (context.rollResult?.includes('CRITICAL')) {
        reasoning += `Critical success adds weight to this discovery. `
      }
    } else {
      reasoning = `Discovery has ${balanceConcerns.length} balance concern(s). `
      reasoning += `Power level ${powerLevel}/5 may be too high. `
      if (narrativeFit < 3) {
        reasoning += `Consider adding more narrative context. `
      }
    }

    return {
      suggestedApproval,
      reasoning,
      balanceConcerns,
      similarSkills: similarSkills.slice(0, 3),
      powerLevel,
      narrativeFit,
    }
  }

  /**
   * Approve a discovery request.
   */
  static approve(
    request: SkillDiscoveryRequest,
    skills: CharacterSkills,
    _dmNotes?: string
  ): DMActionResult {
    try {
      // dmNotes could be stored in the skill's origin.dmNotes if needed
      const updatedSkills = approveDiscovery(
        skills,
        request.proposedSkill.id
      )

      return {
        success: true,
        message: `Approved skill: ${request.proposedSkill.name}${_dmNotes ? ` (${_dmNotes})` : ''}`,
        updatedSkills,
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to approve skill',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Modify and approve a discovery request.
   */
  static modify(
    request: SkillDiscoveryRequest,
    skills: CharacterSkills,
    modifications: Partial<DiscoveredSkillDefinition>,
    _dmNotes?: string
  ): DMActionResult {
    try {
      // dmNotes could be stored in the skill's origin.dmNotes if needed
      const updatedSkills = approveDiscovery(
        skills,
        request.proposedSkill.id,
        modifications
      )

      return {
        success: true,
        message: `Approved modified skill: ${modifications.name ?? request.proposedSkill.name}${_dmNotes ? ` (${_dmNotes})` : ''}`,
        updatedSkills,
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to modify and approve skill',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Reject a discovery request.
   */
  static reject(
    request: SkillDiscoveryRequest,
    skills: CharacterSkills,
    reason: string
  ): DMActionResult {
    try {
      const updatedSkills = rejectDiscovery(
        skills,
        request.proposedSkill.id,
        reason
      )

      return {
        success: true,
        message: `Rejected skill: ${request.proposedSkill.name}`,
        updatedSkills,
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to reject skill',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Grant proficiency in a skill to a character.
   */
  static grantProficiency(
    skills: CharacterSkills,
    skillId: string,
    level: 'half' | 'proficient' | 'expertise',
    source: string
  ): CharacterSkills {
    // Check core skills
    const coreEntry = skills.coreSkills[skillId as CoreSkill]
    if (coreEntry) {
      return {
        ...skills,
        coreSkills: {
          ...skills.coreSkills,
          [skillId]: {
            ...coreEntry,
            proficiency: level,
            proficiencySources: [...coreEntry.proficiencySources, source],
          },
        },
        updatedAt: new Date(),
      }
    }

    // Check discovered skills
    const discoveredEntry = skills.discoveredSkills[skillId]
    if (discoveredEntry) {
      return {
        ...skills,
        discoveredSkills: {
          ...skills.discoveredSkills,
          [skillId]: {
            ...discoveredEntry,
            proficiency: level,
            proficiencySources: [...discoveredEntry.proficiencySources, source],
          },
        },
        updatedAt: new Date(),
      }
    }

    return skills
  }

  /**
   * Grant XP to a skill directly (DM fiat).
   */
  static grantSkillXP(
    skills: CharacterSkills,
    skillId: string,
    xp: number,
    _reason: string
  ): CharacterSkills {
    // reason could be logged or stored for audit trail
    void _reason

    // Check core skills
    const coreEntry = skills.coreSkills[skillId as CoreSkill]
    if (coreEntry) {
      const newXP = coreEntry.xp + xp
      return {
        ...skills,
        coreSkills: {
          ...skills.coreSkills,
          [skillId]: {
            ...coreEntry,
            xp: newXP,
            level: calculateSkillLevel(newXP),
          },
        },
        totalSkillXp: skills.totalSkillXp + xp,
        updatedAt: new Date(),
      }
    }

    // Check discovered skills
    const discoveredEntry = skills.discoveredSkills[skillId]
    if (discoveredEntry) {
      const newXP = discoveredEntry.xp + xp
      return {
        ...skills,
        discoveredSkills: {
          ...skills.discoveredSkills,
          [skillId]: {
            ...discoveredEntry,
            xp: newXP,
            level: calculateSkillLevel(newXP),
          },
        },
        totalSkillXp: skills.totalSkillXp + xp,
        updatedAt: new Date(),
      }
    }

    return skills
  }
}

// ============================================
// CAMPAIGN RULE MANAGEMENT
// ============================================

export class CampaignRuleManager {
  /**
   * Create a new campaign-specific discovery rule.
   */
  static createRule(
    campaignId: string,
    rule: Omit<DiscoveryRule, 'id' | 'isActive'>
  ): DiscoveryRule {
    return {
      ...rule,
      id: `${campaignId}_${randomUUID().slice(0, 8)}`,
      isActive: true,
    }
  }

  /**
   * Disable a discovery rule.
   */
  static disableRule(rule: DiscoveryRule): DiscoveryRule {
    return { ...rule, isActive: false }
  }

  /**
   * Enable a discovery rule.
   */
  static enableRule(rule: DiscoveryRule): DiscoveryRule {
    return { ...rule, isActive: true }
  }

  /**
   * Create a campaign-specific synergy.
   */
  static createSynergy(
    campaignId: string,
    synergy: Omit<Synergy, 'id' | 'isActive' | 'source'>
  ): Synergy {
    return {
      ...synergy,
      id: `${campaignId}_${randomUUID().slice(0, 8)}`,
      isActive: true,
      source: campaignId,
    }
  }
}

// ============================================
// REQUEST QUEUE HELPERS
// ============================================

/**
 * Sort requests by priority (critical first, then by date).
 */
export function sortRequestsByPriority(
  requests: SkillDiscoveryRequest[]
): SkillDiscoveryRequest[] {
  return [...requests].sort((a, b) => {
    // Critical discoveries first
    const aCritical = a.discoveryContext.rollResult?.includes('CRITICAL')
    const bCritical = b.discoveryContext.rollResult?.includes('CRITICAL')
    if (aCritical && !bCritical) return -1
    if (!aCritical && bCritical) return 1

    // Then by magnitude
    if (a.discoveryContext.magnitude !== b.discoveryContext.magnitude) {
      return b.discoveryContext.magnitude - a.discoveryContext.magnitude
    }

    // Then by date (oldest first)
    return a.requestedAt.getTime() - b.requestedAt.getTime()
  })
}

/**
 * Filter requests by campaign.
 */
export function filterRequestsByCampaign(
  requests: SkillDiscoveryRequest[],
  campaignId: string
): SkillDiscoveryRequest[] {
  return requests.filter(r => r.campaignId === campaignId)
}

/**
 * Get pending requests for a campaign.
 */
export function getPendingRequests(
  requests: SkillDiscoveryRequest[],
  campaignId: string
): SkillDiscoveryRequest[] {
  return sortRequestsByPriority(
    requests.filter(r => r.campaignId === campaignId && r.status === 'pending')
  )
}
