// =============================================================================
// NPC AI
// =============================================================================
//
// High-level NPC AI for dialogue, actions, and reactions.
// Uses the new @google/genai SDK with rich context support.
//

import { GeminiClient, getGeminiClient, MODELS } from "./client";
import {
  ContextBuilder,
  FullContext,
  NPCProfile,
  CampaignContext,
  SpeakerContext,
  createContext,
} from "./context";
import { enforceRateLimit, RateLimitType } from "./rate-limit";

// =============================================================================
// TYPES
// =============================================================================

export interface DialogueResponse {
  text: string;
  emotion?: string;
  action?: string;
  internalThought?: string;
  suggestedTopics?: string[];
}

export interface ActionResponse {
  action: string;
  dialogue?: string;
  targetId?: string;
  success?: boolean;
}

export interface ReactionResponse {
  reaction: string;
  emotion: string;
  dispositionChange?: number;
  triggersAction?: string;
}

export interface DialogueOptions {
  speakerContext?: SpeakerContext;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  enableInternalThoughts?: boolean;
  enableSuggestedTopics?: boolean;
}

export interface NPCAIConfig {
  maxTokens?: number;
  temperature?: number;
  enableInternalThoughts?: boolean;
  enableSuggestedTopics?: boolean;
}

// =============================================================================
// NPC AI CLASS
// =============================================================================

export class NPCAI {
  private client: GeminiClient;
  private config: Required<NPCAIConfig>;

  // Optional: for stateful instance with preloaded NPC
  private npc?: NPCProfile;
  private campaignContext?: CampaignContext;

  constructor(config?: NPCAIConfig);
  constructor(npc: NPCProfile, context: CampaignContext);
  constructor(
    npcOrConfig?: NPCProfile | NPCAIConfig,
    context?: CampaignContext
  ) {
    this.client = getGeminiClient();

    // Handle overloaded constructor
    if (npcOrConfig && "id" in npcOrConfig && "name" in npcOrConfig) {
      // Called with (npc, context)
      this.npc = npcOrConfig as NPCProfile;
      this.campaignContext = context;
      this.config = {
        maxTokens: 500,
        temperature: 0.8,
        enableInternalThoughts: true,
        enableSuggestedTopics: true,
      };
    } else {
      // Called with config
      const cfg = npcOrConfig as NPCAIConfig | undefined;
      this.config = {
        maxTokens: cfg?.maxTokens ?? 500,
        temperature: cfg?.temperature ?? 0.8,
        enableInternalThoughts: cfg?.enableInternalThoughts ?? true,
        enableSuggestedTopics: cfg?.enableSuggestedTopics ?? true,
      };
    }
  }

  // ===========================================================================
  // DIALOGUE - Full Context Version
  // ===========================================================================

  /**
   * Generate dialogue using full context
   */
  async generateDialogue(
    context: FullContext,
    playerMessage: string,
    userId?: string,
    campaignId?: string
  ): Promise<DialogueResponse> {
    // Rate limit if IDs provided
    if (userId && campaignId) {
      enforceRateLimit(userId, campaignId, "npcChat");
    }

    const builder = new ContextBuilder();
    builder.setNPC(context.npc);
    if (context.location) builder.setLocation(context.location);
    if (context.world) builder.setWorld(context.world);

    const systemPrompt = builder.buildSystemPrompt();
    const conversationPrompt = this.buildDialoguePrompt(context, playerMessage);

    const response = await this.client.generateText(
      conversationPrompt,
      systemPrompt,
      {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }
    );

    return this.parseDialogueResponse(response);
  }

  /**
   * Continue an existing dialogue
   */
  async continueDialogue(
    context: FullContext,
    playerMessage: string,
    history: Array<{ speaker: string; text: string }>
  ): Promise<DialogueResponse> {
    // Add history to context
    const updatedContext = { ...context };
    updatedContext.history = {
      ...context.history,
      messages: [
        ...context.history.messages,
        ...history.map((h) => ({
          speaker: h.speaker,
          role:
            h.speaker === context.npc.name
              ? ("npc" as const)
              : ("player" as const),
          content: h.text,
          timestamp: new Date(),
        })),
      ],
    };

    return this.generateDialogue(updatedContext, playerMessage);
  }

  // ===========================================================================
  // DIALOGUE - Simple Version (stateful instance)
  // ===========================================================================

  /**
   * Generate dialogue for preloaded NPC (simple API)
   */
  async chat(
    playerMessage: string,
    options: DialogueOptions = {}
  ): Promise<DialogueResponse> {
    if (!this.npc) {
      throw new Error("NPCAI not initialized with NPC data");
    }

    const systemPrompt = this.buildSimpleSystemPrompt(options.speakerContext);
    const conversationContext = this.buildConversationContext(
      options.conversationHistory
    );

    const prompt = `
${conversationContext}

${this.formatSpeaker(options.speakerContext)} says: "${playerMessage}"

Respond as ${this.npc.name}. Stay in character. Be concise (1-3 sentences unless more is needed).
${this.npc.voice ? `Voice style: ${this.npc.voice}` : ""}

Respond in JSON format:
{
  "text": "Your in-character dialogue",
  "emotion": "current emotional state",
  "action": "physical action or gesture (optional)"
}`;

    const result = await this.client.generateJSON<{
      text: string;
      emotion?: string;
      action?: string;
    }>({
      systemInstruction: systemPrompt,
      prompt,
    });

    return result;
  }

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  /**
   * Generate NPC action
   */
  async generateAction(
    npc: NPCProfile,
    situation: string,
    availableActions?: string[]
  ): Promise<ActionResponse> {
    const prompt = this.buildActionPrompt(npc, situation, availableActions);

    const response = await this.client.generateText(prompt, "", {
      maxOutputTokens: 200,
      temperature: 0.7,
    });

    return this.parseActionResponse(response);
  }

  /**
   * Generate combat action
   */
  async generateCombatAction(
    npc: NPCProfile,
    combatSituation: {
      hp: number;
      maxHp: number;
      position: string;
      allies: string[];
      enemies: string[];
      availableAbilities: string[];
    }
  ): Promise<ActionResponse> {
    const prompt = `
You are ${npc.name}, a ${npc.race || ""} ${npc.occupation || "combatant"}.
Personality: ${npc.personality}
Current mood: ${npc.currentMood}

COMBAT SITUATION:
- Your HP: ${combatSituation.hp}/${combatSituation.maxHp}
- Position: ${combatSituation.position}
- Allies nearby: ${combatSituation.allies.join(", ") || "none"}
- Enemies: ${combatSituation.enemies.join(", ")}

AVAILABLE ACTIONS:
${combatSituation.availableAbilities.map((a) => `- ${a}`).join("\n")}

What action do you take? Consider your personality and the tactical situation.
Respond with:
ACTION: [what you do]
TARGET: [who you target, if applicable]
DIALOGUE: [what you say, if anything]
`;

    const response = await this.client.generateText(prompt, "", {
      maxOutputTokens: 150,
      temperature: 0.6,
    });

    return this.parseCombatActionResponse(response);
  }

  // ===========================================================================
  // REACTIONS
  // ===========================================================================

  /**
   * Generate NPC reaction to an event
   */
  async generateReaction(
    npc: NPCProfile,
    event: string,
    eventType: "social" | "combat" | "discovery" | "betrayal" | "gift"
  ): Promise<ReactionResponse> {
    const prompt = `
You are ${npc.name}.
Personality: ${npc.personality}
Current mood: ${npc.currentMood}

EVENT: ${event}
EVENT TYPE: ${eventType}

How do you react? Consider your personality and current mood.
Respond with:
REACTION: [your physical/verbal reaction]
EMOTION: [how you feel now]
DISPOSITION_CHANGE: [number from -50 to +50, how this affects your opinion]
`;

    const response = await this.client.generateText(prompt, "", {
      maxOutputTokens: 150,
      temperature: 0.7,
    });

    return this.parseReactionResponse(response);
  }

  /**
   * Generate reaction for preloaded NPC (simple API)
   */
  async react(event: string): Promise<DialogueResponse> {
    if (!this.npc) {
      throw new Error("NPCAI not initialized with NPC data");
    }

    const systemPrompt = this.buildSimpleSystemPrompt();

    const prompt = `
Event: ${event}

How does ${this.npc.name} react to this? Consider their personality and current situation.

Respond in JSON format:
{
  "text": "What they say (if anything)",
  "emotion": "emotional reaction",
  "action": "physical reaction or action"
}`;

    return this.client.generateJSON<DialogueResponse>({
      systemInstruction: systemPrompt,
      prompt,
    });
  }

  // ===========================================================================
  // SPECIAL DIALOGUE
  // ===========================================================================

  /**
   * Generate a rumor
   */
  async generateRumor(
    npc: NPCProfile,
    topic: string,
    truthLevel: "true" | "mostly_true" | "exaggerated" | "false"
  ): Promise<string> {
    const prompt = `
Generate a rumor about: ${topic}
Truth level: ${truthLevel}
The rumor should sound like it's being told by someone who is: ${npc.personality}
Speaking style: ${npc.voice}

Respond with just the rumor text, as if spoken by the NPC.
`;

    return this.client.generateText(prompt, "", {
      maxOutputTokens: 100,
      temperature: 0.9,
    });
  }

  /**
   * Generate a greeting
   */
  async generateGreeting(
    npc: NPCProfile,
    playerName: string,
    familiarity: "stranger" | "acquaintance" | "friend" | "enemy"
  ): Promise<string> {
    const prompt = `
You are ${npc.name}, a ${npc.race || ""} ${npc.occupation || "person"}.
Personality: ${npc.personality}
Voice: ${npc.voice}
Current mood: ${npc.currentMood}
Current activity: ${npc.currentActivity || "idle"}

${playerName} approaches. Your relationship: ${familiarity}

How do you greet them? Stay in character. One or two sentences.
`;

    return this.client.generateText(prompt, "", {
      maxOutputTokens: 80,
      temperature: 0.8,
    });
  }

  /**
   * Generate a farewell
   */
  async generateFarewell(
    npc: NPCProfile,
    conversationSummary: string
  ): Promise<string> {
    const prompt = `
You are ${npc.name}.
Personality: ${npc.personality}
Voice: ${npc.voice}

The conversation has covered: ${conversationSummary}

How do you say goodbye? Stay in character. One or two sentences.
`;

    return this.client.generateText(prompt, "", {
      maxOutputTokens: 60,
      temperature: 0.7,
    });
  }

  /**
   * Generate NPC's inner thoughts (GM only)
   */
  async generateThoughts(situation: string): Promise<string> {
    if (!this.npc) {
      throw new Error("NPCAI not initialized with NPC data");
    }

    const systemPrompt = `You reveal the inner thoughts of ${this.npc.name}, including hidden motivations and secrets they wouldn't share openly.

Character:
- Name: ${this.npc.name}
- Role: ${this.npc.occupation || "Unknown"}
- Personality: ${this.npc.personality || "Not defined"}
- Secrets: ${this.npc.secrets?.join(", ") || "None known"}`;

    const result = await this.client.generate({
      systemInstruction: systemPrompt,
      prompt: `Situation: ${situation}\n\nWhat is ${this.npc.name} really thinking? What are they not saying?`,
    });

    return result.text;
  }

  // ===========================================================================
  // PROMPT BUILDERS
  // ===========================================================================

  private buildDialoguePrompt(
    context: FullContext,
    playerMessage: string
  ): string {
    let prompt = "";

    // Add conversation history
    if (context.history.messages.length > 0) {
      const recent = context.history.messages.slice(-8);
      prompt += recent
        .map((m) => {
          if (m.role === "system") return `[${m.content}]`;
          return `${m.speaker}: ${m.content}`;
        })
        .join("\n");
      prompt += "\n\n";
    }

    prompt += `PLAYER: ${playerMessage}

Respond as ${context.npc.name}. Format:
RESPONSE: [your spoken dialogue]
EMOTION: [your current emotion]`;

    if (this.config.enableInternalThoughts) {
      prompt += `\nTHOUGHT: [your internal thought, for GM reference]`;
    }

    if (this.config.enableSuggestedTopics) {
      prompt += `\nTOPICS: [2-3 topics you might bring up next]`;
    }

    return prompt;
  }

  private buildSimpleSystemPrompt(speakerContext?: SpeakerContext): string {
    if (!this.npc) {
      return "You are an NPC in a TTRPG campaign.";
    }

    const depthDesc = this.getDepthDescription(this.npc.depth || 0);

    return `You are roleplaying as ${this.npc.name}, an NPC in a TTRPG campaign.

CHARACTER SHEET:
- Name: ${this.npc.name}
- Role: ${this.npc.occupation || "Unknown"}
- Personality: ${this.npc.personality || "Undefined - improvise appropriately"}
- Depth Level: D${this.npc.depth || 0} (${depthDesc})
${this.npc.voice ? `- Voice: ${this.npc.voice}` : ""}

CAMPAIGN CONTEXT:
${this.campaignContext?.summary || "No campaign summary available."}
${this.campaignContext?.currentLocation ? `Current Location: ${this.campaignContext.currentLocation}` : ""}
${this.campaignContext?.currentScene ? `Current Scene: ${this.campaignContext.currentScene}` : ""}

RULES:
- Stay in character at all times
- Be consistent with established personality
- React naturally to the situation
- Keep responses concise but flavorful
- Never break character to explain game mechanics
${this.npc.secrets?.length ? "- You have secrets but won't reveal them easily" : ""}`;
  }

  private buildConversationContext(
    history?: Array<{ role: "user" | "assistant"; content: string }>
  ): string {
    if (!history || history.length === 0) {
      return "";
    }

    const formatted = history
      .slice(-6)
      .map((msg) => {
        const speaker =
          msg.role === "assistant" ? this.npc?.name || "NPC" : "Player";
        return `${speaker}: ${msg.content}`;
      })
      .join("\n");

    return `RECENT CONVERSATION:\n${formatted}\n`;
  }

  private buildActionPrompt(
    npc: NPCProfile,
    situation: string,
    availableActions?: string[]
  ): string {
    let prompt = `You are ${npc.name}, a ${npc.race || ""} ${npc.occupation || "person"}.
Personality: ${npc.personality}
Current mood: ${npc.currentMood}
Current activity: ${npc.currentActivity || "idle"}

SITUATION: ${situation}`;

    if (availableActions?.length) {
      prompt += `\n\nAVAILABLE ACTIONS:\n${availableActions.map((a) => `- ${a}`).join("\n")}`;
    }

    prompt += `\n\nWhat do you do? Respond with:
ACTION: [what you do]
DIALOGUE: [what you say, if anything]`;

    return prompt;
  }

  private formatSpeaker(context?: SpeakerContext): string {
    if (!context) return "A player";
    if (context.isGM && context.speakAs === "gm") return "The GM";
    if (context.characterName) return context.characterName;
    return "A player";
  }

  private getDepthDescription(depth: number): string {
    const descriptions: Record<number, string> = {
      0: "Surface - basic name and role only",
      1: "Shallow - has defined personality",
      2: "Medium - has backstory and relationships",
      3: "Deep - has hidden agendas and secrets",
      4: "Very Deep - campaign-significant figure",
      5: "Abyss - fundamental to the world's truth",
    };
    return descriptions[depth] || descriptions[0];
  }

  // ===========================================================================
  // RESPONSE PARSERS
  // ===========================================================================

  private parseDialogueResponse(raw: string): DialogueResponse {
    const response: DialogueResponse = { text: "" };

    const responseMatch = raw.match(
      /RESPONSE:\s*(.+?)(?=EMOTION:|THOUGHT:|TOPICS:|$)/s
    );
    const emotionMatch = raw.match(/EMOTION:\s*(.+?)(?=THOUGHT:|TOPICS:|$)/s);
    const thoughtMatch = raw.match(/THOUGHT:\s*(.+?)(?=TOPICS:|$)/s);
    const topicsMatch = raw.match(/TOPICS:\s*(.+?)$/s);

    response.text = responseMatch?.[1]?.trim() || raw.trim();
    response.emotion = emotionMatch?.[1]?.trim();
    response.internalThought = thoughtMatch?.[1]?.trim();

    if (topicsMatch) {
      response.suggestedTopics = topicsMatch[1]
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    return response;
  }

  private parseActionResponse(raw: string): ActionResponse {
    const actionMatch = raw.match(/ACTION:\s*(.+?)(?=DIALOGUE:|$)/s);
    const dialogueMatch = raw.match(/DIALOGUE:\s*(.+?)$/s);

    return {
      action: actionMatch?.[1]?.trim() || raw.trim(),
      dialogue: dialogueMatch?.[1]?.trim(),
    };
  }

  private parseCombatActionResponse(raw: string): ActionResponse {
    const actionMatch = raw.match(/ACTION:\s*(.+?)(?=TARGET:|DIALOGUE:|$)/s);
    const targetMatch = raw.match(/TARGET:\s*(.+?)(?=DIALOGUE:|$)/s);
    const dialogueMatch = raw.match(/DIALOGUE:\s*(.+?)$/s);

    return {
      action: actionMatch?.[1]?.trim() || raw.trim(),
      targetId: targetMatch?.[1]?.trim(),
      dialogue: dialogueMatch?.[1]?.trim(),
    };
  }

  private parseReactionResponse(raw: string): ReactionResponse {
    const reactionMatch = raw.match(/REACTION:\s*(.+?)(?=EMOTION:|$)/s);
    const emotionMatch = raw.match(
      /EMOTION:\s*(.+?)(?=DISPOSITION_CHANGE:|$)/s
    );
    const dispositionMatch = raw.match(/DISPOSITION_CHANGE:\s*([+-]?\d+)/);

    return {
      reaction: reactionMatch?.[1]?.trim() || raw.trim(),
      emotion: emotionMatch?.[1]?.trim() || "neutral",
      dispositionChange: dispositionMatch
        ? parseInt(dispositionMatch[1], 10)
        : undefined,
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let defaultNPCAI: NPCAI | null = null;

export function getNPCAI(): NPCAI {
  if (!defaultNPCAI) {
    defaultNPCAI = new NPCAI();
  }
  return defaultNPCAI;
}

export function initNPCAI(config?: NPCAIConfig): NPCAI {
  defaultNPCAI = new NPCAI(config);
  return defaultNPCAI;
}

/**
 * Create an NPCAI instance for a specific NPC
 */
export function createNPCAI(
  npc: NPCProfile,
  context: CampaignContext
): NPCAI {
  return new NPCAI(npc, context);
}

export default NPCAI;
