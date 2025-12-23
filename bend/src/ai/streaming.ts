// =============================================================================
// STREAMING
// =============================================================================
//
// Streaming responses for real-time AI dialogue and narration.
// Supports SSE for API routes and async iterators for tRPC subscriptions.
//

import { GeminiClient, getGeminiClient, MODELS, type ModelId } from "./client";
import { FullContext, NPCProfile } from "./context";
import { getRateLimiter, RateLimiter } from "./rate-limit";

// =============================================================================
// TYPES
// =============================================================================

export interface StreamOptions {
  model?: ModelId;
  systemInstruction?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface StreamController {
  abort: () => void;
  promise: Promise<string>;
}

export interface DialogueStreamChunk {
  type: "token" | "emotion" | "action" | "complete";
  content: string;
  accumulated?: string;
}

export interface StreamChunk {
  type: "chunk";
  content: string;
}

export interface StreamDone {
  type: "done";
  fullContent: string;
  tokensUsed?: number;
}

export interface StreamError {
  type: "error";
  message: string;
}

export type StreamMessage = StreamChunk | StreamDone | StreamError;

// =============================================================================
// CORE STREAMING FUNCTION
// =============================================================================

/**
 * Stream AI response with callbacks
 */
export async function streamGeneration(options: StreamOptions): Promise<string> {
  const client = new GeminiClient({ model: options.model || MODELS.FLASH });
  let fullText = "";

  try {
    for await (const chunk of client.generateStream(options)) {
      fullText += chunk;
      options.onChunk?.(chunk);
    }

    options.onComplete?.(fullText);
    return fullText;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    throw err;
  }
}

// =============================================================================
// STREAMING NPC CLASS
// =============================================================================

export class StreamingNPC {
  private client: GeminiClient;
  private rateLimiter: RateLimiter;
  private abortController: AbortController | null = null;

  constructor(client?: GeminiClient, rateLimiter?: RateLimiter) {
    this.client = client || getGeminiClient();
    this.rateLimiter = rateLimiter || getRateLimiter();
  }

  // ===========================================================================
  // STREAMING DIALOGUE
  // ===========================================================================

  /**
   * Stream NPC dialogue with parsed sections
   */
  async *streamDialogue(
    context: FullContext,
    playerMessage: string,
    options: Partial<StreamOptions> = {}
  ): AsyncGenerator<DialogueStreamChunk, void, unknown> {
    await this.rateLimiter.acquire();

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context, playerMessage);

    let accumulated = "";
    let currentSection = "response";

    for await (const token of this.client.generateStream({
      prompt: userPrompt,
      systemInstruction: systemPrompt,
      maxOutputTokens: options.maxOutputTokens || 500,
      temperature: options.temperature || 0.8,
    })) {
      accumulated += token;

      // Detect section changes
      if (accumulated.includes("EMOTION:") && currentSection === "response") {
        currentSection = "emotion";
        const parts = accumulated.split("EMOTION:");
        yield {
          type: "token",
          content: token,
          accumulated: parts[0].replace("RESPONSE:", "").trim(),
        };
        continue;
      }

      if (accumulated.includes("ACTION:") && currentSection !== "action") {
        currentSection = "action";
      }

      yield {
        type: "token",
        content: token,
        accumulated,
      };

      options.onChunk?.(token);
    }

    // Parse final response
    const parsed = this.parseStreamedResponse(accumulated);

    yield {
      type: "complete",
      content: parsed.text,
      accumulated,
    };

    if (parsed.emotion) {
      yield { type: "emotion", content: parsed.emotion };
    }

    if (parsed.action) {
      yield { type: "action", content: parsed.action };
    }

    options.onComplete?.(parsed.text);
  }

  /**
   * Stream with callback interface (simpler API)
   */
  streamDialogueCallback(
    context: FullContext,
    playerMessage: string,
    options: Partial<StreamOptions> = {}
  ): StreamController {
    this.abortController = new AbortController();

    const promise = (async () => {
      let fullText = "";

      try {
        for await (const chunk of this.streamDialogue(
          context,
          playerMessage,
          options
        )) {
          if (this.abortController?.signal.aborted) {
            throw new Error("Stream aborted");
          }

          if (chunk.type === "complete") {
            fullText = chunk.content;
          }
        }
      } catch (error) {
        options.onError?.(error as Error);
        throw error;
      }

      return fullText;
    })();

    return {
      abort: () => this.abortController?.abort(),
      promise,
    };
  }

  // ===========================================================================
  // STREAMING NARRATION
  // ===========================================================================

  /**
   * Stream scene narration
   */
  async *streamNarration(
    description: string,
    style: "dramatic" | "casual" | "ominous" | "whimsical" = "dramatic",
    options: Partial<StreamOptions> = {}
  ): AsyncGenerator<string, void, unknown> {
    await this.rateLimiter.acquire();

    const prompt = `Write a ${style} narration for a tabletop RPG scene:

${description}

Write in second person ("You see...", "You hear..."). Keep it to 2-3 evocative sentences.`;

    for await (const token of this.client.generateStream({
      prompt,
      maxOutputTokens: options.maxOutputTokens || 200,
      temperature: options.temperature || 0.9,
    })) {
      yield token;
      options.onChunk?.(token);
    }
  }

  // ===========================================================================
  // STREAMING DESCRIPTION
  // ===========================================================================

  /**
   * Stream location/object description
   */
  async *streamDescription(
    subject: string,
    context: string,
    options: Partial<StreamOptions> = {}
  ): AsyncGenerator<string, void, unknown> {
    await this.rateLimiter.acquire();

    const prompt = `Describe ${subject} for a tabletop RPG.
Context: ${context}

Be vivid but concise. 2-4 sentences. Use sensory details.`;

    for await (const token of this.client.generateStream({
      prompt,
      maxOutputTokens: options.maxOutputTokens || 150,
      temperature: options.temperature || 0.8,
    })) {
      yield token;
      options.onChunk?.(token);
    }
  }

  // ===========================================================================
  // STREAMING COMBAT NARRATION
  // ===========================================================================

  /**
   * Stream combat action narration
   */
  async *streamCombatNarration(
    action: {
      attacker: string;
      target: string;
      attackType: string;
      hit: boolean;
      damage?: number;
      critical?: boolean;
      special?: string;
    },
    options: Partial<StreamOptions> = {}
  ): AsyncGenerator<string, void, unknown> {
    await this.rateLimiter.acquire();

    let prompt = `Narrate this combat action for a tabletop RPG:

${action.attacker} attacks ${action.target} with ${action.attackType}.
Result: ${action.hit ? "HIT" : "MISS"}`;

    if (action.hit && action.damage) {
      prompt += `\nDamage: ${action.damage}${action.critical ? " (CRITICAL!)" : ""}`;
    }

    if (action.special) {
      prompt += `\nSpecial: ${action.special}`;
    }

    prompt += `\n\nWrite 1-2 vivid sentences describing this moment.`;

    for await (const token of this.client.generateStream({
      prompt,
      maxOutputTokens: options.maxOutputTokens || 100,
      temperature: options.temperature || 0.9,
    })) {
      yield token;
      options.onChunk?.(token);
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private buildSystemPrompt(context: FullContext): string {
    const npc = context.npc;

    return `You are ${npc.name}, a ${npc.race || ""} ${npc.occupation || "person"}.

PERSONALITY: ${npc.personality}
VOICE: ${npc.voice}
MOOD: ${npc.currentMood}

Stay in character. Respond naturally as ${npc.name} would speak.
Keep responses to 2-4 sentences.

Format your response as:
RESPONSE: [your dialogue]
EMOTION: [your current emotion]`;
  }

  private buildUserPrompt(context: FullContext, playerMessage: string): string {
    return `The player says: "${playerMessage}"

Respond as ${context.npc.name}.`;
  }

  private parseStreamedResponse(raw: string): {
    text: string;
    emotion?: string;
    action?: string;
  } {
    const responseMatch = raw.match(/RESPONSE:\s*(.+?)(?=EMOTION:|ACTION:|$)/s);
    const emotionMatch = raw.match(/EMOTION:\s*(.+?)(?=ACTION:|$)/s);
    const actionMatch = raw.match(/ACTION:\s*(.+?)$/s);

    return {
      text: responseMatch?.[1]?.trim() || raw.trim(),
      emotion: emotionMatch?.[1]?.trim(),
      action: actionMatch?.[1]?.trim(),
    };
  }

  /**
   * Abort current stream
   */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}

// =============================================================================
// SSE STREAMING (FOR API ROUTES)
// =============================================================================

export interface SSEStreamOptions {
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Create SSE stream for Express/Hono response object
 */
export function createSSEStream(
  res: {
    writeHead: (status: number, headers: Record<string, string>) => void;
    write: (data: string) => void;
    end: () => void;
  },
  options: StreamOptions
): void {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  });

  // Stream with SSE format
  streamGeneration({
    ...options,
    onChunk: (chunk) => {
      const escaped = chunk.replace(/\n/g, "\ndata: ");
      res.write(`data: ${escaped}\n\n`);
      options.onChunk?.(chunk);
    },
    onComplete: (fullText) => {
      res.write(`event: done\ndata: ${JSON.stringify({ complete: true })}\n\n`);
      res.end();
      options.onComplete?.(fullText);
    },
    onError: (error) => {
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`
      );
      res.end();
      options.onError?.(error);
    },
  }).catch(() => {
    // Error already handled via onError
  });
}

/**
 * Create ReadableStream for Response API (Next.js, Cloudflare Workers, etc.)
 */
export function createSSEReadableStream(
  generator: AsyncGenerator<string | DialogueStreamChunk, void, unknown>,
  options: SSEStreamOptions = {}
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      options.onStart?.();

      const encoder = new TextEncoder();

      try {
        for await (const chunk of generator) {
          const data =
            typeof chunk === "string"
              ? { type: "token", content: chunk }
              : chunk;

          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const errorMessage = `data: ${JSON.stringify({
          type: "error",
          content: (error as Error).message,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMessage));
      } finally {
        options.onEnd?.();
        controller.close();
      }
    },
  });
}

/**
 * Create SSE Response for Next.js API routes / edge functions
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// =============================================================================
// ASYNC ITERATOR FOR TRPC
// =============================================================================

/**
 * Create async iterator for tRPC subscriptions
 */
export async function* createStreamIterator(
  options: Omit<StreamOptions, "onChunk" | "onComplete" | "onError">
): AsyncGenerator<StreamMessage> {
  const client = new GeminiClient({ model: options.model || MODELS.FLASH });
  let fullText = "";

  try {
    for await (const chunk of client.generateStream(options)) {
      fullText += chunk;
      yield { type: "chunk", content: chunk };
    }

    yield { type: "done", fullContent: fullText };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield { type: "error", message };
  }
}

// =============================================================================
// CLIENT-SIDE SSE CONSUMER
// =============================================================================

export interface SSEClientOptions {
  onToken?: (token: string) => void;
  onEmotion?: (emotion: string) => void;
  onAction?: (action: string) => void;
  onComplete?: (text: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Consume SSE stream on client side
 */
export async function consumeSSEStream(
  url: string,
  body: object,
  options: SSEClientOptions = {}
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let accumulated = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulated += decoder.decode(value, { stream: true });

    const lines = accumulated.split("\n\n");
    accumulated = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);

        if (data === "[DONE]") {
          options.onComplete?.(fullText);
          return fullText;
        }

        try {
          const parsed = JSON.parse(data);

          switch (parsed.type) {
            case "token":
              fullText += parsed.content;
              options.onToken?.(parsed.content);
              break;
            case "emotion":
              options.onEmotion?.(parsed.content);
              break;
            case "action":
              options.onAction?.(parsed.content);
              break;
            case "complete":
              fullText = parsed.content;
              break;
            case "error":
              throw new Error(parsed.content || parsed.message);
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            // JSON parse error, skip
          } else {
            throw e;
          }
        }
      }
    }
  }

  return fullText;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format SSE message
 */
export function formatSSE(event: string, data: unknown): string {
  const jsonData = JSON.stringify(data);
  return `event: ${event}\ndata: ${jsonData}\n\n`;
}

// =============================================================================
// SINGLETON
// =============================================================================

let streamingNPC: StreamingNPC | null = null;

export function getStreamingNPC(): StreamingNPC {
  if (!streamingNPC) {
    streamingNPC = new StreamingNPC();
  }
  return streamingNPC;
}

export function initStreamingNPC(
  client?: GeminiClient,
  rateLimiter?: RateLimiter
): StreamingNPC {
  streamingNPC = new StreamingNPC(client, rateLimiter);
  return streamingNPC;
}
