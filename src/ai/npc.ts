// ============================================
// NPC AI
// ============================================
//
// High-level NPC AI for dialogue and actions.
//

import { GeminiClient, getGeminiClient } from "./client";
import {
  ContextBuilder,
  FullContext,
  NPCProfile,
  createContext,
} from "./context";
import { RateLimiter, getRateLimiter } from "./rate-limit";

// ============================================
// TYPES
// ============================================

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

export interface NPCAIConfig {
  maxTokens?: number;
  temperature?: number;
  enableInternalThoughts?: boolean;
  enableSuggestedTopics?: boolean;
}

// ============================================
// NPC AI CLASS
// ============================================

export class NPCAI {
  private client: GeminiClient;
  private rateLimiter: RateLimiter;
  private config: Required<NPCAIConfig>;

  constructor(
    client?: GeminiClient,
    rateLimiter?: RateLimiter,
    config?: NPCAIConfig,
  ) {
    this.client = client || getGeminiClient();
    this.rateLimiter = rateLimiter || getRateLimiter();
    this.config = {
      maxTokens: 500,
      temperature: 0.8,
      enableInternalThoughts: true,
      enableSuggestedTopics: true,
      ...config,
    };
  }

  // ==========================================
  // DIALOGUE
  // ==========================================

  async generateDialogue(
    context: FullContext,
    playerMessage: string,
  ): Promise<DialogueResponse> {
    await this.rateLimiter.acquire();

    const builder = new ContextBuilder();
    Object.assign(builder, {
      npc: context.npc,
      location: context.location,
      world: context.world,
    });

    const systemPrompt = this.buildDialogueSystemPrompt(context);
    const conversationPrompt = this.buildDialoguePrompt(context, playerMessage);

    const response = await this.client.generateText(
      conversationPrompt,
      systemPrompt,
      {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    );

    return this.parseDialogueResponse(response);
  }

  async continueDialogue(
    context: FullContext,
    playerMessage: string,
    history: Array<{ speaker: string; text: string }>,
  ): Promise<DialogueResponse> {
    await this.rateLimiter.acquire();

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

  // ==========================================
  // ACTIONS
  // ==========================================

  async generateAction(
    npc: NPCProfile,
    situation: string,
    availableActions?: string[],
  ): Promise<ActionResponse> {
    await this.rateLimiter.acquire();

    const prompt = this.buildActionPrompt(npc, situation, availableActions);

    const response = await this.client.generateText(prompt, "", {
      maxOutputTokens: 200,
      temperature: 0.7,
    });

    return this.parseActionResponse(response);
  }

  async generateCombatAction(
    npc: NPCProfile,
    combatSituation: {
      hp: number;
      maxHp: number;
      position: string;
      allies: string[];
      enemies: string[];
      availableAbilities: string[];
    },
  ): Promise<ActionResponse> {
    await this.rateLimiter.acquire();

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

  // ==========================================
  // REACTIONS
  // ==========================================

  async generateReaction(
    npc: NPCProfile,
    event: string,
    eventType: "social" | "combat" | "discovery" | "betrayal" | "gift",
  ): Promise<ReactionResponse> {
    await this.rateLimiter.acquire();

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

  // ==========================================
  // SPECIAL DIALOGUE
  // ==========================================

  async generateRumor(
    npc: NPCProfile,
    topic: string,
    truthLevel: "true" | "mostly_true" | "exaggerated" | "false",
  ): Promise<string> {
    await this.rateLimiter.acquire();

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

  async generateGreeting(
    npc: NPCProfile,
    playerName: string,
    familiarity: "stranger" | "acquaintance" | "friend" | "enemy",
  ): Promise<string> {
    await this.rateLimiter.acquire();

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

  async generateFarewell(
    npc: NPCProfile,
    conversationSummary: string,
  ): Promise<string> {
    await this.rateLimiter.acquire();

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

  // ==========================================
  // PROMPT BUILDERS
  // ==========================================

  private buildDialogueSystemPrompt(context: FullContext): string {
    const npc = context.npc;
    const loc = context.location;

    let prompt = `You are roleplaying as ${npc.name}, a ${npc.race || ""} ${npc.occupation || "person"}.

PERSONALITY: ${npc.personality}

VOICE/SPEAKING STYLE: ${npc.voice}`;

    if (npc.publicGoals?.length) {
      prompt += `\n\nGOALS:\n${npc.publicGoals.map((g) => `- ${g}`).join("\n")}`;
    }

    if (npc.secrets?.length) {
      prompt += `\n\nSECRETS (protect these):\n${npc.secrets.map((s) => `- ${s}`).join("\n")}`;
    }

    if (npc.knowledgeAreas?.length) {
      prompt += `\n\nKNOWLEDGE AREAS: ${npc.knowledgeAreas.join(", ")}`;
    }

    if (npc.relationships?.length) {
      const rels = npc.relationships
        .map(
          (r) =>
            `- ${r.targetName}: ${r.relationship} (${r.disposition > 0 ? "friendly" : r.disposition < 0 ? "hostile" : "neutral"})`,
        )
        .join("\n");
      prompt += `\n\nRELATIONSHIPS:\n${rels}`;
    }

    prompt += `\n\nCURRENT MOOD: ${npc.currentMood}`;

    if (loc.name) {
      prompt += `\n\nLOCATION: ${loc.name}`;
      if (loc.description) {
        prompt += `\n${loc.description}`;
      }
    }

    prompt += `\n\nINSTRUCTIONS:
- Stay in character at all times
- Speak in first person as ${npc.name}
- Use your established voice and mannerisms
- React based on your mood and relationships
- Only share knowledge you would reasonably have
- Protect your secrets unless cleverly extracted
- Keep responses concise (2-4 sentences typically)`;

    return prompt;
  }

  private buildDialoguePrompt(
    context: FullContext,
    playerMessage: string,
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

  private buildActionPrompt(
    npc: NPCProfile,
    situation: string,
    availableActions?: string[],
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

  // ==========================================
  // RESPONSE PARSERS
  // ==========================================

  private parseDialogueResponse(raw: string): DialogueResponse {
    const response: DialogueResponse = { text: "" };

    const responseMatch = raw.match(
      /RESPONSE:\s*(.+?)(?=EMOTION:|THOUGHT:|TOPICS:|$)/s,
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
      /EMOTION:\s*(.+?)(?=DISPOSITION_CHANGE:|$)/s,
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

// ============================================
// SINGLETON
// ============================================

let npcAI: NPCAI | null = null;

export function getNPCAI(): NPCAI {
  if (!npcAI) {
    npcAI = new NPCAI();
  }
  return npcAI;
}

export function initNPCAI(
  client?: GeminiClient,
  rateLimiter?: RateLimiter,
  config?: NPCAIConfig,
): NPCAI {
  npcAI = new NPCAI(client, rateLimiter, config);
  return npcAI;
}
