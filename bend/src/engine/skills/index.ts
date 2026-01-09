/**
 * SKILL SYSTEM - Unified Exports
 * ================================
 *
 * The 18 D&D 5e skills are the PERIODIC TABLE.
 * Players and DMs discover new skills through gameplay - the MOLECULES.
 *
 * This module provides emergent skill discovery where skills are
 * born from action, not chosen from a menu.
 */

// ============================================
// SCHEMA - Core Types
// ============================================
export {
  // Enums
  SkillTypeSchema,
  SkillCategorySchema,

  // Types
  type SkillType,
  type SkillCategory,
  type SkillOrigin,
  type SkillPrerequisites,
  type SkillApproval,
  type DiscoveredSkillDefinition,
  type SkillEntry,
  type CharacterSkills,
  type ActionContext,
  type DiscoveryRule,
  type SkillModifierBreakdown,

  // Re-exports from character
  CoreSkillEnum,
  AbilitySchema,
  ProficiencyLevelSchema,
  type CoreSkill,
  type Ability,
  type ProficiencyLevel,

  // Schemas
  SkillOriginSchema,
  SkillPrerequisitesSchema,
  SkillApprovalSchema,
  DiscoveredSkillDefinitionSchema,
  SkillEntrySchema,
  CharacterSkillsSchema,
  ActionContextSchema,
  DiscoveryRuleSchema,
  SkillModifierBreakdownSchema,

  // Helper functions
  calculateSkillLevel,
  xpForLevel,
  xpToNextLevel,
  createCoreSkillEntry,
  createInitialCharacterSkills,
  applyProficiencies,
} from './schema'

// ============================================
// CORE SKILLS - The Periodic Table
// ============================================
export {
  CORE_SKILLS,
  SKILLS_BY_CATEGORY,
  SKILLS_BY_ABILITY,

  type CoreSkillMetadata,
  CoreSkillMetadataSchema,

  getCoreSkillMetadata,
  getCoreSkillTags,
  matchTagsToCoreSkills,
  getSkillLoreEquivalence,
} from './core-skills'

// ============================================
// PROGRESSION - XP and Levels
// ============================================
export {
  // Re-exports for convenience
  // calculateSkillLevel,
  // xpForLevel,
  // xpToNextLevel,

  // Config
  DEFAULT_XP_CONFIG,
  type XPGainConfig,

  // Types
  type SkillCheckResult,
  type TrainingSource,
  SkillCheckResultSchema,
  TrainingSourceSchema,

  // Functions
  calculateCheckXP,
  calculateActionXP,
  calculateTrainingXP,
  calculateSkillModifier,
  getSkillModifierBreakdown,

  // Level descriptions
  SKILL_LEVEL_DESCRIPTIONS,
  getSkillLevelDescription,

  // XP application
  applySkillXP,
  recordSkillUsage,
} from './progression'

// ============================================
// DISCOVERY - Emergent Skills
// ============================================
export {
  SkillDiscoveryEngine,
  skillDiscovery,

  // Config
  DEFAULT_DISCOVERY_CONFIG,
  type DiscoveryConfig,

  // Types
  type DiscoveryResult,
  type MatchInfo,
  DiscoveryResultSchema,
  MatchInfoSchema,

  // Standard rules
  STANDARD_DISCOVERY_RULES,

  // Functions
  addPendingDiscovery,
  approveDiscovery,
  rejectDiscovery,
} from './discovery'

// ============================================
// SYNERGIES - Skill Combinations
// ============================================
export {
  SynergyEngine,
  synergyEngine,

  // Types
  type SynergyRequirement,
  type SynergyGrants,
  type Synergy,
  type SynergyCheckResult,
  SynergyRequirementSchema,
  SynergyGrantsSchema,
  SynergySchema,
  SynergyCheckResultSchema,

  // Standard synergies
  STANDARD_SYNERGIES,

  // Functions
  updateCharacterSynergies,
  hasSynergy,
  getSynergyById,
} from './synergies'

// ============================================
// GATES - Skill-Gated Content
// ============================================
export {
  SkillGateEngine,
  skillGateEngine,

  // Types
  type GateRequirement,
  type GatedContent,
  type SkillGate,
  type GateCheckResult,
  GateRequirementSchema,
  GatedContentSchema,
  SkillGateSchema,
  GateCheckResultSchema,

  // Standard gates
  STANDARD_SKILL_GATES,

  // Functions
  checkContentGate,
  canAccessContent,
  getBlockedContent,
} from './gates'

// ============================================
// DM WORKFLOW - Approval System
// ============================================
export {
  DMSkillWorkflow,
  CampaignRuleManager,

  // Types
  type AIAssessment,
  type SkillDiscoveryRequest,
  type DMActionResult,
  AIAssessmentSchema,
  SkillDiscoveryRequestSchema,
  DMActionResultSchema,

  // Functions
  sortRequestsByPriority,
  filterRequestsByCampaign,
  getPendingRequests,
} from './gm-workflow'
