/**
 * GM ORCHESTRATOR MODULE
 *
 * Three game modes:
 * - PARTY_HUMAN_GM: Classic TTRPG with human GM, engine validates
 * - PARTY_AI_GM: AI mediates party play, human can override
 * - SOLO_AI_GM: AI mediates solo "corridor" experience
 *
 * SOLO_HUMAN_GM explicitly rejected - solo play requires AI assistance.
 *
 * Core principle: GM is "lens + pacing interface, not authority"
 * All world changes via validated deltas through canonical engine pathways.
 */

// Types
export * from './types';

// Session management
export {
  startGMSession,
  getActiveGMSession,
  getGMSession,
  getGMSessionsByCampaign,
  pauseGMSession,
  resumeGMSession,
  endGMSession,
  updateCurrentScene,
  updateTimelineCursor,
  updateContextPacket,
  updateActiveCorridor,
  recordOverride,
} from './session';

// Context management
export {
  buildContextPacket,
  refreshContextPacket,
  getContextExclusions,
  getContextForAI,
} from './context';

// Validation
export {
  validateDeltas,
  checkForConflicts,
  validateRequiredFields,
} from './validation';

// Scene management
export {
  generateNextScene,
  validateScene,
  applyPlayerChoice,
  getSceneHistory,
  getScene,
  getSceneChoices,
  getChoice,
  overrideScene,
} from './scene';

// Solo corridors
export {
  startCorridor,
  getCorridor,
  getActiveCorridors,
  getCorridorsBySession,
  addCorridorDelta,
  completeCorridor,
  abandonCorridor,
  mergeCorridor,
} from './corridor';

// AI GM
export {
  generateAIScenePlan,
  buildAIGMIdentity,
} from './ai-gm';

// AI Profiles
export {
  getAIProfile,
  listAIProfiles,
  createAIProfile,
  updateAIProfile,
  deleteAIProfile,
  seedSystemProfiles,
  getSystemProfiles,
} from './profiles';

// Orchestrator
export {
  GMOrchestrator,
  createOrchestrator,
  getOrchestrator,
} from './orchestrator';
