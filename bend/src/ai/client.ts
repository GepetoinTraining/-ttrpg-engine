// =============================================================================
// GEMINI CLIENT - Wrapper for @google/genai SDK
// =============================================================================
//
// Low-level Gemini API client with retry logic, streaming, and multi-modal.
//
// Usage:
//   const client = new GeminiClient();
//   const result = await client.generate({ prompt: "Hello!" });
//   console.log(result.text);
//

import { GoogleGenAI } from "@google/genai";

// =============================================================================
// CONFIGURATION
// =============================================================================

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("⚠️  GOOGLE_AI_API_KEY not set - AI features will fail");
}

// Singleton SDK instance
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

// Available models (Dec 2025)
export const MODELS = {
  FLASH: "gemini-2.5-flash",
  PRO: "gemini-2.5-pro",
  FLASH_LITE: "gemini-2.0-flash",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

// =============================================================================
// TYPES
// =============================================================================

export interface GenerateOptions {
  model?: ModelId;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  jsonMode?: boolean;
}

export interface GenerateResult {
  text: string;
  model: string;
  tokensUsed?: number;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface GeminiClientConfig {
  model?: ModelId;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  retries?: number;
  retryDelay?: number;
}

// =============================================================================
// NPC RESPONSE TYPES (for router compatibility)
// =============================================================================

export interface NPCContext {
  id: string;
  name: string;
  race?: string;
  occupation?: string;
  personality: string;
  voice: string;
  motivations: string[];
  secrets?: string[];
  knowledgeTopics: string[];
  rumors?: string[];
  relationships: Array<{
    characterName: string;
    relationship: string;
    disposition: number;
  }>;
  mood: string;
  currentLocation?: string;
  currentActivity?: string;
}

export interface ConversationMessage {
  role: "player" | "npc";
  speaker: string;
  content: string;
  timestamp: Date;
}

export interface NPCResponseInput {
  npc: NPCContext;
  context: {
    sessionId: string;
    campaignId: string;
    locationName: string;
    locationDescription?: string;
  };
  history: ConversationMessage[];
  playerMessage: string;
}

export interface NPCResponse {
  content: string;
  emotion?: string;
  action?: string;
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class GeminiClient {
  private model: ModelId;
  private config: Required<Omit<GeminiClientConfig, "model">>;

  constructor(config: GeminiClientConfig = {}) {
    this.model = config.model || MODELS.FLASH;
    this.config = {
      defaultTemperature: config.defaultTemperature ?? 0.7,
      defaultMaxTokens: config.defaultMaxTokens ?? 2048,
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
  }

  // ===========================================================================
  // MAIN API
  // ===========================================================================

  /**
   * Generate text content
   */
  async generate(
    options: Omit<GenerateOptions, "model"> & { model?: ModelId }
  ): Promise<GenerateResult> {
    const model = options.model || this.model;

    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? this.config.defaultTemperature,
          maxOutputTokens: options.maxOutputTokens ?? this.config.defaultMaxTokens,
          topP: options.topP,
          topK: options.topK,
          stopSequences: options.stopSequences,
          ...(options.jsonMode && {
            responseMimeType: "application/json",
          }),
        },
      });

      return {
        text: response.text ?? "",
        model,
        tokensUsed: response.usageMetadata?.totalTokenCount,
      };
    });
  }

  /**
   * Simple text generation (convenience method)
   */
  async generateText(
    prompt: string,
    systemPrompt?: string,
    config?: Partial<GenerateOptions>
  ): Promise<string> {
    const result = await this.generate({
      prompt,
      systemInstruction: systemPrompt,
      ...config,
    });
    return result.text;
  }

  /**
   * Generate with automatic JSON parsing
   */
  async generateJSON<T = unknown>(
    options: Omit<GenerateOptions, "model" | "jsonMode">
  ): Promise<T> {
    const result = await this.generate({ ...options, jsonMode: true });

    try {
      // Clean potential markdown code blocks
      let text = result.text.trim();
      if (text.startsWith("```json")) {
        text = text.slice(7);
      }
      if (text.startsWith("```")) {
        text = text.slice(3);
      }
      if (text.endsWith("```")) {
        text = text.slice(0, -3);
      }

      return JSON.parse(text.trim()) as T;
    } catch (parseError) {
      console.error(`[GeminiClient] Failed to parse JSON:`, result.text);
      throw new GeminiError("Failed to parse JSON response", parseError);
    }
  }

  /**
   * Multi-turn chat
   */
  async chat(
    messages: ChatMessage[],
    systemPrompt?: string,
    config?: Partial<GenerateOptions>
  ): Promise<string> {
    // Build conversation as a single prompt with history
    let prompt = "";

    if (messages.length > 0) {
      const history = messages.slice(0, -1);
      const lastMessage = messages[messages.length - 1];

      if (history.length > 0) {
        prompt += history
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
          .join("\n\n");
        prompt += "\n\n";
      }

      prompt += `User: ${lastMessage.text}`;
    }

    const result = await this.generate({
      prompt,
      systemInstruction: systemPrompt,
      ...config,
    });

    return result.text;
  }

  /**
   * Generate with image input (multi-modal)
   */
  async generateWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    config?: Partial<GenerateOptions>
  ): Promise<string> {
    const model = config?.model || this.model;

    return this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: prompt },
            ],
          },
        ],
        config: {
          systemInstruction: config?.systemInstruction,
          temperature: config?.temperature ?? this.config.defaultTemperature,
          maxOutputTokens: config?.maxOutputTokens ?? this.config.defaultMaxTokens,
        },
      });

      return response.text ?? "";
    });
  }

  // ===========================================================================
  // NPC DIALOGUE GENERATION
  // ===========================================================================

  /**
   * Generate NPC response for conversation
   * Used by the NPC router for AI-powered dialogue
   */
  async generateNPCResponse(input: NPCResponseInput): Promise<NPCResponse> {
    const { npc, context, history, playerMessage } = input;

    // Build system prompt
    const systemPrompt = this.buildNPCSystemPrompt(npc, context);

    // Build conversation context
    let conversationContext = "";
    if (history.length > 0) {
      conversationContext = history
        .slice(-8) // Last 8 messages
        .map((msg) => `${msg.speaker}: ${msg.content}`)
        .join("\n");
      conversationContext += "\n\n";
    }

    const prompt = `${conversationContext}${history[0]?.speaker || "Player"}: ${playerMessage}

Respond as ${npc.name}. Stay in character. Be concise (1-3 sentences unless more is needed).

Respond in JSON format:
{
  "content": "Your in-character dialogue",
  "emotion": "current emotional state",
  "action": "physical action or gesture (optional, can be null)"
}`;

    try {
      const result = await this.generateJSON<{
        content: string;
        emotion?: string;
        action?: string | null;
      }>({
        systemInstruction: systemPrompt,
        prompt,
        temperature: 0.8,
        maxOutputTokens: 500,
      });

      return {
        content: result.content,
        emotion: result.emotion,
        action: result.action || undefined,
      };
    } catch (error) {
      // Fallback to non-JSON response
      const text = await this.generateText(prompt, systemPrompt, {
        temperature: 0.8,
        maxOutputTokens: 500,
      });

      return {
        content: text,
        emotion: undefined,
        action: undefined,
      };
    }
  }

  private buildNPCSystemPrompt(
    npc: NPCContext,
    context: { locationName: string; locationDescription?: string }
  ): string {
    const sections: string[] = [];

    // Character basics
    sections.push(`You are roleplaying as ${npc.name}, an NPC in a TTRPG campaign.`);

    // Character sheet
    let characterSheet = `CHARACTER:
- Name: ${npc.name}`;
    if (npc.race) characterSheet += `\n- Race: ${npc.race}`;
    if (npc.occupation) characterSheet += `\n- Role: ${npc.occupation}`;
    characterSheet += `\n- Personality: ${npc.personality}`;
    characterSheet += `\n- Voice/Speech: ${npc.voice}`;
    characterSheet += `\n- Current Mood: ${npc.mood}`;
    if (npc.currentActivity) characterSheet += `\n- Currently: ${npc.currentActivity}`;
    sections.push(characterSheet);

    // Knowledge
    if (npc.knowledgeTopics.length > 0) {
      sections.push(`KNOWLEDGE AREAS:\n${npc.knowledgeTopics.map((k) => `- ${k}`).join("\n")}`);
    }

    // Motivations
    if (npc.motivations.length > 0) {
      sections.push(`MOTIVATIONS:\n${npc.motivations.map((m) => `- ${m}`).join("\n")}`);
    }

    // Secrets (NPC knows but won't easily share)
    if (npc.secrets && npc.secrets.length > 0) {
      sections.push(`SECRETS (guard these carefully):\n${npc.secrets.map((s) => `- ${s}`).join("\n")}`);
    }

    // Rumors
    if (npc.rumors && npc.rumors.length > 0) {
      sections.push(`RUMORS YOU'VE HEARD:\n${npc.rumors.map((r) => `- ${r}`).join("\n")}`);
    }

    // Relationships
    if (npc.relationships.length > 0) {
      const relText = npc.relationships
        .map((r) => `- ${r.characterName}: ${r.relationship} (disposition: ${r.disposition})`)
        .join("\n");
      sections.push(`RELATIONSHIPS:\n${relText}`);
    }

    // Location
    let locationText = `CURRENT LOCATION: ${context.locationName}`;
    if (context.locationDescription) {
      locationText += `\n${context.locationDescription}`;
    }
    sections.push(locationText);

    // Instructions
    sections.push(`RULES:
- Stay in character at all times
- Speak in first person as ${npc.name}
- Use your established voice and speech patterns
- React based on your mood and relationships
- Only share knowledge you would reasonably have
- Guard your secrets unless cleverly extracted
- Keep responses concise (1-3 sentences typically)
- Never break character to explain game mechanics`);

    return sections.join("\n\n");
  }

  // ===========================================================================
  // STREAMING
  // ===========================================================================

  /**
   * Stream text content (for real-time responses)
   */
  async *generateStream(
    options: Omit<GenerateOptions, "model"> & { model?: ModelId }
  ): AsyncGenerator<string> {
    const model = options.model || this.model;

    try {
      const response = await ai.models.generateContentStream({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? this.config.defaultTemperature,
          maxOutputTokens: options.maxOutputTokens ?? this.config.defaultMaxTokens,
          topP: options.topP,
          topK: options.topK,
          stopSequences: options.stopSequences,
        },
      });

      for await (const chunk of response) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (error) {
      console.error(`[GeminiClient] Error streaming content:`, error);
      throw new GeminiError("Failed to stream content", error);
    }
  }

  // ===========================================================================
  // MODEL MANAGEMENT
  // ===========================================================================

  getModel(): ModelId {
    return this.model;
  }

  setModel(model: ModelId): void {
    this.model = model;
  }

  // ===========================================================================
  // RETRY LOGIC
  // ===========================================================================

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (except rate limit)
        if (this.isClientError(error) && !this.isRateLimitError(error)) {
          throw error;
        }

        // Wait before retry with exponential backoff
        if (attempt < this.config.retries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new GeminiError("Request failed after retries");
  }

  private isClientError(error: unknown): boolean {
    if (error instanceof Error && "status" in error) {
      const status = (error as any).status;
      return status >= 400 && status < 500;
    }
    return false;
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error && "status" in error) {
      return (error as any).status === 429;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// ERROR CLASS
// =============================================================================

export class GeminiError extends Error {
  public cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "GeminiError";
    this.cause = cause;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let defaultClient: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!defaultClient) {
    defaultClient = new GeminiClient();
  }
  return defaultClient;
}

export function initGeminiClient(config?: GeminiClientConfig): GeminiClient {
  defaultClient = new GeminiClient(config);
  return defaultClient;
}

export default GeminiClient;
