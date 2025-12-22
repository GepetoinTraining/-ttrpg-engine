// ============================================
// GEMINI API CLIENT
// ============================================
//
// Low-level Gemini API client with retry logic.
//

// ============================================
// TYPES
// ============================================

export interface GeminiClientConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface GenerationConfig {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface Content {
  role: "user" | "model";
  parts: ContentPart[];
}

export interface GenerateRequest {
  contents: Content[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
  systemInstruction?: Content;
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export interface GenerateResponse {
  candidates: Array<{
    content: Content;
    finishReason: string;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GeminiError {
  code: number;
  message: string;
  status: string;
}

// ============================================
// CLIENT CLASS
// ============================================

export class GeminiClient {
  private config: Required<GeminiClientConfig>;

  constructor(config: GeminiClientConfig) {
    this.config = {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-1.5-flash",
      defaultMaxTokens: 1024,
      defaultTemperature: 0.8,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  // ==========================================
  // MAIN API
  // ==========================================

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    // Apply defaults
    const body = {
      ...request,
      generationConfig: {
        maxOutputTokens: this.config.defaultMaxTokens,
        temperature: this.config.defaultTemperature,
        ...request.generationConfig,
      },
    };

    return this.fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    config?: GenerationConfig,
  ): Promise<string> {
    const contents: Content[] = [];

    // Add system instruction via user/model turn
    if (systemPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: `SYSTEM: ${systemPrompt}` }],
      });
      contents.push({
        role: "model",
        parts: [{ text: "Understood. I will follow these instructions." }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const response = await this.generate({
      contents,
      generationConfig: config,
    });

    return this.extractText(response);
  }

  async chat(
    messages: Array<{ role: "user" | "model"; text: string }>,
    config?: GenerationConfig,
  ): Promise<string> {
    const contents: Content[] = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const response = await this.generate({
      contents,
      generationConfig: config,
    });

    return this.extractText(response);
  }

  async generateWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    config?: GenerationConfig,
  ): Promise<string> {
    const response = await this.generate({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: config,
    });

    return this.extractText(response);
  }

  // ==========================================
  // STREAMING
  // ==========================================

  async *generateStream(
    request: GenerateRequest,
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.config.baseUrl}/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}`;

    const body = {
      ...request,
      generationConfig: {
        maxOutputTokens: this.config.defaultMaxTokens,
        temperature: this.config.defaultTemperature,
        ...request.generationConfig,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Stream request failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() && !line.startsWith("data: [DONE]")) {
          try {
            const data = JSON.parse(line.replace(/^data: /, ""));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // Skip malformed lines
          }
        }
      }
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private extractText(response: GenerateResponse): string {
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No response generated");
    }

    const text = candidate.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Empty response");
    }

    return text;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
  ): Promise<GenerateResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout,
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = (await response.json()) as { error: GeminiError };

          // Don't retry client errors (except rate limit)
          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            throw new Error(error.error?.message || `HTTP ${response.status}`);
          }

          throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort
        if (lastError.name === "AbortError") {
          throw new Error("Request timed out");
        }

        // Wait before retry
        if (attempt < this.config.retries - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error("Request failed");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==========================================
  // MODEL INFO
  // ==========================================

  getModel(): string {
    return this.config.model;
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  async listModels(): Promise<string[]> {
    const url = `${this.config.baseUrl}/models?key=${this.config.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to list models");
    }

    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  }
}

// ============================================
// SINGLETON
// ============================================

let client: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!client) {
    throw new Error("Gemini client not initialized");
  }
  return client;
}

export function initGeminiClient(config: GeminiClientConfig): GeminiClient {
  client = new GeminiClient(config);
  return client;
}
