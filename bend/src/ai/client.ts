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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY not set - AI features will fail");
}

// Singleton SDK instance
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

// Available models (Dec 2025)
export const MODELS = {
  FLASH: "gemini-2.5-flash",
  PRO: "gemini-2.5-pro",
  FLASH_LITE: "gemini-2.5-flash-lite",
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
