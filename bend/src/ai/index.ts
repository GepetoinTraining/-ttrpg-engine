// =============================================================================
// AI MODULE
// =============================================================================
//
// AI-powered features using Gemini 2.5.
//
// Basic Usage:
//
//   import { GeminiClient, MODELS } from '@/ai';
//
//   const client = new GeminiClient();
//   const result = await client.generate({ prompt: "Hello!" });
//   console.log(result.text);
//
// NPC Dialogue:
//
//   import { NPCAI, createContext } from '@/ai';
//
//   const context = createContext()
//     .setNPCBasics('id', 'Durnan', 'Human', 'Bartender')
//     .setNPCPersonality('Gruff but fair', 'Short sentences, direct')
//     .setNPCMood('busy but attentive')
//     .build();
//
//   const npcAI = new NPCAI();
//   const response = await npcAI.generateDialogue(context, "Hello there!");
//
// Streaming:
//
//   import { getStreamingNPC, createSSEResponse, createSSEReadableStream } from '@/ai';
//
//   const streamer = getStreamingNPC();
//   for await (const chunk of streamer.streamDialogue(context, message)) {
//     console.log(chunk.content);
//   }
//
// Rate Limiting:
//
//   import { enforceRateLimit } from '@/ai';
//
//   enforceRateLimit(userId, campaignId, "npcChat");
//   // Throws RateLimitError if exceeded
//

// =============================================================================
// CLIENT
// =============================================================================

export {
  GeminiClient,
  GeminiError,
  getGeminiClient,
  initGeminiClient,
  MODELS,
} from "./client";

export type {
  GenerateOptions,
  GenerateResult,
  ChatMessage,
  GeminiClientConfig,
  ModelId,
  // NPC-specific types for router compatibility
  NPCContext,
  ConversationMessage,
  NPCResponseInput,
  NPCResponse,
} from "./client";

// =============================================================================
// CONTEXT BUILDING
// =============================================================================

export {
  ContextBuilder,
  createContext,
  buildSimpleNPCContext,
  buildQuickContext,
  buildContext,
  buildMinimalContext,
} from "./context";

export type {
  NPCProfile,
  NPCRelationship,
  FactionMembership,
  LocationContext,
  WorldContext,
  ConversationHistory,
  FullContext,
  PlayerContext,
  QuestContext,
  SpeakerContext,
  CampaignContext,
  ContextOptions,
} from "./context";

// =============================================================================
// NPC AI
// =============================================================================

export {
  NPCAI,
  getNPCAI,
  initNPCAI,
  createNPCAI,
} from "./npc";

export type {
  DialogueResponse,
  ActionResponse,
  ReactionResponse,
  DialogueOptions,
  NPCAIConfig,
} from "./npc";

// =============================================================================
// RATE LIMITING
// =============================================================================

export {
  // Core functions
  checkRateLimit,
  checkUserRateLimit,
  checkCampaignRateLimit,
  enforceRateLimit,
  rateLimitKey,
  getRateLimitStats,
  cleanupExpiredLimits,
  // Classes
  RateLimiter,
  TokenBucket,
  UserRateLimiter,
  GlobalRateLimiter,
  RateLimitError,
  // Singleton
  getRateLimiter,
  initRateLimiter,
  // Constants
  RATE_LIMITS,
} from "./rate-limit";

export type {
  RateLimitConfig,
  RateLimitType,
  RateLimiterStats,
} from "./rate-limit";

// =============================================================================
// STREAMING
// =============================================================================

export {
  // Core streaming
  streamGeneration,
  StreamingNPC,
  getStreamingNPC,
  initStreamingNPC,
  // SSE helpers
  createSSEStream,
  createSSEReadableStream,
  createSSEResponse,
  createStreamIterator,
  consumeSSEStream,
  formatSSE,
} from "./streaming";

export type {
  StreamOptions,
  StreamController,
  DialogueStreamChunk,
  StreamChunk,
  StreamDone,
  StreamError,
  StreamMessage,
  SSEStreamOptions,
  SSEClientOptions,
} from "./streaming";
