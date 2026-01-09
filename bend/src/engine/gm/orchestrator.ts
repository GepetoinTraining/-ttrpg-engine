import {
  type GMSession,
  type GMScene,
  type ScenePlan,
  type ContextPacket,
  type AIProfile,
  type SoloCorridor,
  type ApplyChoiceResult,
  type MergeCorridorResult,
} from './types';
import {
  getGMSession,
  startGMSession,
  pauseGMSession,
  resumeGMSession,
  endGMSession,
} from './session';
import {
  buildContextPacket,
  refreshContextPacket,
} from './context';
import {
  generateNextScene,
  applyPlayerChoice,
  getScene,
  getSceneHistory,
  overrideScene,
} from './scene';
import {
  startCorridor,
  getCorridor,
  completeCorridor,
  abandonCorridor,
  mergeCorridor,
} from './corridor';
import { buildAIGMIdentity } from './ai-gm';
import { getAIProfile } from './profiles';

// ============================================
// GM ORCHESTRATOR
// ============================================
//
// The main coordinator for GM operations.
// Routes actions based on mode:
// - PARTY_HUMAN_GM: Human GM creates scenes, engine validates
// - PARTY_AI_GM: AI generates scenes, human can override
// - SOLO_AI_GM: AI mediates solo corridor experience
//
// Core principle: GM is "lens + pacing interface, not authority"
// All world changes via validated deltas through canonical engine pathways.
//

export class GMOrchestrator {
  private session: GMSession;
  private _contextPacket: ContextPacket | null = null;
  private _aiProfile: AIProfile | null = null;

  constructor(session: GMSession) {
    this.session = session;
  }

  /**
   * Create an orchestrator from a session ID.
   */
  static async fromSessionId(sessionId: string): Promise<GMOrchestrator> {
    const session = await getGMSession(sessionId);
    if (!session) {
      throw new Error(`GM session not found: ${sessionId}`);
    }
    return new GMOrchestrator(session);
  }

  /**
   * Create an orchestrator from a scene ID.
   */
  static async fromSceneId(sceneId: string): Promise<GMOrchestrator> {
    const scene = await getScene(sceneId);
    if (!scene) {
      throw new Error(`Scene not found: ${sceneId}`);
    }
    return GMOrchestrator.fromSessionId(scene.gmSessionId);
  }

  // ============================================
  // GETTERS
  // ============================================

  get mode(): GMSession['mode'] {
    return this.session.mode;
  }

  get sessionId(): string {
    return this.session.id;
  }

  get campaignId(): string {
    return this.session.campaignId;
  }

  get partyId(): string {
    return this.session.partyId;
  }

  get isActive(): boolean {
    return this.session.status === 'active';
  }

  get currentSceneId(): string | undefined {
    return this.session.currentSceneId;
  }

  get activeCorridorId(): string | undefined {
    return this.session.activeCorridorId;
  }

  // ============================================
  // CONTEXT MANAGEMENT
  // ============================================

  /**
   * Get the current context packet (cached).
   */
  async getContextPacket(): Promise<ContextPacket> {
    if (!this._contextPacket) {
      this._contextPacket = await buildContextPacket(this.session.id);
    }
    return this._contextPacket;
  }

  /**
   * Refresh the context packet.
   */
  async refreshContext(): Promise<ContextPacket> {
    this._contextPacket = await refreshContextPacket(this.session.id);
    return this._contextPacket;
  }

  /**
   * Get the AI profile (for AI modes).
   */
  async getAIProfile(): Promise<AIProfile | null> {
    if (this.session.mode === 'PARTY_HUMAN_GM') {
      return null;
    }

    if (!this._aiProfile && this.session.aiProfileId) {
      this._aiProfile = await getAIProfile(this.session.aiProfileId);
    }
    return this._aiProfile;
  }

  // ============================================
  // SCENE GENERATION
  // ============================================

  /**
   * Generate the next scene based on mode.
   */
  async generateScene(options?: {
    playerHint?: string;
    forceSceneType?: string;
  }): Promise<GMScene> {
    this.ensureActive();

    if (this.session.mode === 'PARTY_HUMAN_GM') {
      // Human GM mode - create a template scene
      return this.createHumanGMScene(options);
    } else {
      // AI modes - generate via AI
      return this.createAIScene(options);
    }
  }

  private async createHumanGMScene(options?: {
    playerHint?: string;
    forceSceneType?: string;
  }): Promise<GMScene> {
    return generateNextScene({
      sessionId: this.session.id,
      playerHint: options?.playerHint,
      forceSceneType: options?.forceSceneType as GMScene['sceneType'],
    });
  }

  private async createAIScene(options?: {
    playerHint?: string;
    forceSceneType?: string;
  }): Promise<GMScene> {
    // Refresh context before generating
    await this.refreshContext();

    return generateNextScene({
      sessionId: this.session.id,
      playerHint: options?.playerHint,
      forceSceneType: options?.forceSceneType as GMScene['sceneType'],
    });
  }

  // ============================================
  // CHOICE PROCESSING
  // ============================================

  /**
   * Apply a player's choice (commits deltas).
   */
  async processPlayerChoice(
    sceneId: string,
    choiceId: string,
    selectedBy?: string,
  ): Promise<ApplyChoiceResult> {
    this.ensureActive();

    const result = await applyPlayerChoice({
      sessionId: this.session.id,
      sceneId,
      choiceId,
      selectedBy,
    });

    // Refresh context after applying choice
    await this.refreshContext();

    // If in SOLO_AI_GM mode with active corridor, add deltas to corridor
    if (this.session.mode === 'SOLO_AI_GM' && this.session.activeCorridorId) {
      const { addCorridorDelta } = await import('./corridor');
      for (const delta of result.deltas) {
        await addCorridorDelta(this.session.activeCorridorId, delta.id);
      }
    }

    return result;
  }

  // ============================================
  // HUMAN OVERRIDE (PARTY_AI_GM mode)
  // ============================================

  /**
   * Human GM overrides an AI-generated scene.
   * Only available in PARTY_AI_GM mode.
   */
  async humanOverride(sceneId: string, newPlan: ScenePlan): Promise<GMScene> {
    this.ensureActive();

    if (this.session.mode !== 'PARTY_AI_GM') {
      throw new Error('Override is only available in PARTY_AI_GM mode');
    }

    return overrideScene(sceneId, newPlan);
  }

  // ============================================
  // SOLO CORRIDOR (SOLO_AI_GM mode)
  // ============================================

  /**
   * Start a solo corridor.
   * Only available in SOLO_AI_GM mode.
   */
  async startCorridor(options?: {
    corridorType?: SoloCorridor['corridorType'];
    estimatedDuration?: string;
  }): Promise<SoloCorridor> {
    this.ensureActive();

    if (this.session.mode !== 'SOLO_AI_GM') {
      throw new Error('Corridors are only available in SOLO_AI_GM mode');
    }

    const corridor = await startCorridor({
      sessionId: this.session.id,
      corridorType: options?.corridorType,
      estimatedDuration: options?.estimatedDuration,
    });

    // Update local session reference
    this.session = { ...this.session, activeCorridorId: corridor.id };

    return corridor;
  }

  /**
   * Get the active corridor.
   */
  async getActiveCorridor(): Promise<SoloCorridor | null> {
    if (!this.session.activeCorridorId) {
      return null;
    }
    return getCorridor(this.session.activeCorridorId);
  }

  /**
   * Complete the active corridor (ready for merge).
   */
  async completeCorridor(): Promise<SoloCorridor> {
    if (!this.session.activeCorridorId) {
      throw new Error('No active corridor');
    }
    return completeCorridor(this.session.activeCorridorId);
  }

  /**
   * Abandon the active corridor (discard changes).
   */
  async abandonCorridor(): Promise<SoloCorridor> {
    if (!this.session.activeCorridorId) {
      throw new Error('No active corridor');
    }

    const corridor = await abandonCorridor(this.session.activeCorridorId);

    // Update local session reference
    this.session = { ...this.session, activeCorridorId: undefined };

    return corridor;
  }

  /**
   * Merge the completed corridor back into main timeline.
   */
  async mergeCorridor(resolution: {
    strategy: 'replace' | 'merge' | 'branch';
    conflictResolutions?: Array<{
      entityType: string;
      entityId: string;
      resolution: 'use_corridor' | 'use_main' | 'custom';
      resolvedDelta?: Record<string, unknown>;
    }>;
  }): Promise<MergeCorridorResult> {
    if (!this.session.activeCorridorId) {
      throw new Error('No active corridor');
    }

    const result = await mergeCorridor({
      corridorId: this.session.activeCorridorId,
      resolution: {
        strategy: resolution.strategy,
        conflictResolutions: resolution.conflictResolutions ?? [],
        finalDeltas: [],
      },
    });

    // Update local session reference
    this.session = { ...this.session, activeCorridorId: undefined };

    // Refresh context after merge
    await this.refreshContext();

    return result;
  }

  // ============================================
  // SESSION LIFECYCLE
  // ============================================

  /**
   * Pause the session.
   */
  async pause(): Promise<GMSession> {
    this.session = await pauseGMSession(this.session.id);
    return this.session;
  }

  /**
   * Resume a paused session.
   */
  async resume(): Promise<GMSession> {
    this.session = await resumeGMSession(this.session.id);
    return this.session;
  }

  /**
   * End the session.
   */
  async end(): Promise<GMSession> {
    this.session = await endGMSession(this.session.id);
    return this.session;
  }

  // ============================================
  // HISTORY & STATE
  // ============================================

  /**
   * Get the current scene.
   */
  async getCurrentScene(): Promise<GMScene | null> {
    if (!this.session.currentSceneId) {
      return null;
    }
    return getScene(this.session.currentSceneId);
  }

  /**
   * Get scene history.
   */
  async getSceneHistory(options?: {
    limit?: number;
    status?: GMScene['status'];
  }): Promise<GMScene[]> {
    return getSceneHistory(this.session.id, options);
  }

  /**
   * Get the AI GM identity (for agent infrastructure integration).
   */
  async getAIGMIdentity(): Promise<Record<string, unknown> | null> {
    const profile = await this.getAIProfile();
    if (!profile) {
      return null;
    }
    return buildAIGMIdentity(profile);
  }

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  private ensureActive(): void {
    if (this.session.status !== 'active') {
      throw new Error(`Session is not active (status: ${this.session.status})`);
    }
  }
}

/**
 * Create a new GMOrchestrator by starting a new session.
 */
export async function createOrchestrator(input: {
  campaignId: string;
  partyId: string;
  mode: GMSession['mode'];
  aiProfileId?: string;
  humanGmId?: string;
  sessionId?: string;
}): Promise<GMOrchestrator> {
  const session = await startGMSession(input);
  return new GMOrchestrator(session);
}

/**
 * Get an orchestrator for an existing session.
 */
export async function getOrchestrator(sessionId: string): Promise<GMOrchestrator | null> {
  const session = await getGMSession(sessionId);
  if (!session) {
    return null;
  }
  return new GMOrchestrator(session);
}
