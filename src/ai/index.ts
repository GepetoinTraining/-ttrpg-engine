// ============================================
// AI LAYER
// ============================================
//
// AI-powered features using Gemini.
//
// Basic Usage:
//
//   import { initGeminiClient, getNPCAI } from '@/ai';
//
//   // Initialize once at startup
//   initGeminiClient({ apiKey: process.env.GEMINI_API_KEY });
//
//   // Generate NPC dialogue
//   const npcAI = getNPCAI();
//   const response = await npcAI.generateDialogue(context, "Hello there!");
//   console.log(response.text);
//
// Streaming Usage:
//
//   import { getStreamingNPC, createSSEResponse, createSSEStream } from '@/ai';
//
//   // Stream dialogue tokens
//   const streamer = getStreamingNPC();
//   for await (const chunk of streamer.streamDialogue(context, message)) {
//     console.log(chunk.content);
//   }
//
//   // Or create SSE response for API routes
//   const stream = createSSEStream(streamer.streamDialogue(context, message));
//   return createSSEResponse(stream);
//
// Context Building:
//
//   import { createContext } from '@/ai';
//
//   const context = createContext()
//     .setNPCBasics('id', 'Durnan', 'Human', 'Bartender')
//     .setNPCPersonality('Gruff but fair', 'Short sentences, direct')
//     .setNPCMood('busy but attentive')
//     .setLocation({ id: 'yp', name: 'Yawning Portal', type: 'tavern' })
//     .build();
//

// Gemini Client (low-level)
export {
  GeminiClient,
  getGeminiClient,
  initGeminiClient,
  type GeminiClientConfig,
  type GenerationConfig,
  type Content,
  type ContentPart,
  type GenerateRequest,
  type GenerateResponse,
} from "./client";

// Legacy Gemini exports (for compatibility)
export {
  GeminiClient as GeminiClientLegacy,
  getGeminiClient as getGemini,
  initGemini,
  type GeminiConfig,
  type NPCContext,
  type ConversationContext,
  type ConversationMessage,
  type GenerateResponseOptions,
  type GeneratedResponse,
} from "./gemini";

// Context Building
export {
  ContextBuilder,
  createContext,
  buildSimpleNPCContext,
  buildQuickContext,
  type NPCProfile,
  type NPCRelationship,
  type FactionMembership,
  type LocationContext,
  type WorldContext,
  type ConversationHistory,
  type FullContext,
  type PlayerContext,
  type QuestContext,
} from "./context";

// NPC AI (high-level)
export {
  NPCAI,
  getNPCAI,
  initNPCAI,
  type DialogueResponse,
  type ActionResponse,
  type ReactionResponse,
  type NPCAIConfig,
} from "./npc";

// Rate Limiting
export {
  RateLimiter,
  TokenBucket,
  UserRateLimiter,
  GlobalRateLimiter,
  getRateLimiter,
  initRateLimiter,
  type RateLimiterConfig,
  type RateLimiterStats,
} from "./rate-limit";

// Streaming
export {
  StreamingNPC,
  getStreamingNPC,
  initStreamingNPC,
  createSSEStream,
  createSSEResponse,
  consumeSSEStream,
  type StreamOptions,
  type StreamController,
  type DialogueStreamChunk,
  type SSEStreamOptions,
  type SSEClientOptions,
} from "./streaming";
