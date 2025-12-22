// ============================================
// CONTEXT BUILDING
// ============================================
//
// Build rich context for NPC AI conversations.
//

import * as nodes from "../db/queries/nodes";
import * as factions from "../db/queries/factions";

// ============================================
// TYPES
// ============================================

export interface NPCProfile {
  id: string;
  name: string;
  race?: string;
  occupation?: string;
  age?: string;
  gender?: string;
  appearance?: string;

  // Personality
  personality: string;
  voice: string;
  mannerisms?: string[];
  catchphrases?: string[];

  // Motivations
  publicGoals: string[];
  secretGoals?: string[];
  fears?: string[];
  desires?: string[];

  // Knowledge
  knowledgeAreas: string[];
  rumors?: string[];
  secrets?: string[];

  // Relationships
  relationships: NPCRelationship[];
  factionMemberships?: FactionMembership[];

  // State
  currentMood: string;
  currentActivity?: string;
  healthStatus?: string;
}

export interface NPCRelationship {
  targetName: string;
  targetType: "pc" | "npc" | "faction";
  relationship: string;
  disposition: number; // -100 to 100
  history?: string;
}

export interface FactionMembership {
  factionId: string;
  factionName: string;
  rank: string;
  loyalty: number; // 0-100
}

export interface LocationContext {
  id: string;
  name: string;
  type: string;
  description?: string;
  atmosphere?: string;
  population?: string;
  notableFeatures?: string[];
  currentConditions?: {
    weather?: string;
    time?: string;
    lighting?: string;
    noise?: string;
  };
}

export interface WorldContext {
  setting: string;
  currentDate?: string;
  majorEvents?: string[];
  politicalClimate?: string;
  economicConditions?: string;
}

export interface ConversationHistory {
  messages: Array<{
    speaker: string;
    role: "player" | "npc" | "system";
    content: string;
    timestamp: Date;
  }>;
  topics: string[];
  emotionalArc?: string[];
}

export interface FullContext {
  npc: NPCProfile;
  location: LocationContext;
  world: WorldContext;
  history: ConversationHistory;
  players: PlayerContext[];
  activeQuests?: QuestContext[];
}

export interface PlayerContext {
  characterName: string;
  playerName?: string;
  race: string;
  class: string;
  notableFeatures?: string;
  reputationWithNPC?: number;
}

export interface QuestContext {
  name: string;
  status: string;
  npcInvolvement: string;
}

// ============================================
// CONTEXT BUILDER
// ============================================

export class ContextBuilder {
  private npc: Partial<NPCProfile> = {};
  private location: Partial<LocationContext> = {};
  private world: Partial<WorldContext> = {};
  private history: ConversationHistory = { messages: [], topics: [] };
  private players: PlayerContext[] = [];
  private quests: QuestContext[] = [];

  // ==========================================
  // NPC METHODS
  // ==========================================

  setNPC(profile: NPCProfile): this {
    this.npc = profile;
    return this;
  }

  setNPCBasics(
    id: string,
    name: string,
    race?: string,
    occupation?: string,
  ): this {
    this.npc = { ...this.npc, id, name, race, occupation };
    return this;
  }

  setNPCPersonality(
    personality: string,
    voice: string,
    mannerisms?: string[],
  ): this {
    this.npc.personality = personality;
    this.npc.voice = voice;
    this.npc.mannerisms = mannerisms;
    return this;
  }

  setNPCGoals(publicGoals: string[], secretGoals?: string[]): this {
    this.npc.publicGoals = publicGoals;
    this.npc.secretGoals = secretGoals;
    return this;
  }

  setNPCKnowledge(
    areas: string[],
    rumors?: string[],
    secrets?: string[],
  ): this {
    this.npc.knowledgeAreas = areas;
    this.npc.rumors = rumors;
    this.npc.secrets = secrets;
    return this;
  }

  addNPCRelationship(relationship: NPCRelationship): this {
    if (!this.npc.relationships) {
      this.npc.relationships = [];
    }
    this.npc.relationships.push(relationship);
    return this;
  }

  setNPCMood(mood: string, activity?: string): this {
    this.npc.currentMood = mood;
    this.npc.currentActivity = activity;
    return this;
  }

  // ==========================================
  // LOCATION METHODS
  // ==========================================

  setLocation(location: LocationContext): this {
    this.location = location;
    return this;
  }

  async loadLocation(locationId: string): Promise<this> {
    const node = await nodes.getNode(locationId);
    if (node) {
      const data =
        typeof node.dataStatic === "string"
          ? JSON.parse(node.dataStatic)
          : node.dataStatic;

      this.location = {
        id: node.id,
        name: node.name,
        type: node.type,
        description: data?.description,
        atmosphere: data?.atmosphere,
        population: data?.population,
        notableFeatures: data?.notableFeatures,
      };
    }
    return this;
  }

  setLocationConditions(
    conditions: LocationContext["currentConditions"],
  ): this {
    this.location.currentConditions = conditions;
    return this;
  }

  // ==========================================
  // WORLD METHODS
  // ==========================================

  setWorld(world: WorldContext): this {
    this.world = world;
    return this;
  }

  setWorldBasics(setting: string, currentDate?: string): this {
    this.world.setting = setting;
    this.world.currentDate = currentDate;
    return this;
  }

  addWorldEvent(event: string): this {
    if (!this.world.majorEvents) {
      this.world.majorEvents = [];
    }
    this.world.majorEvents.push(event);
    return this;
  }

  // ==========================================
  // HISTORY METHODS
  // ==========================================

  addMessage(
    speaker: string,
    role: "player" | "npc" | "system",
    content: string,
  ): this {
    this.history.messages.push({
      speaker,
      role,
      content,
      timestamp: new Date(),
    });
    return this;
  }

  setHistory(history: ConversationHistory): this {
    this.history = history;
    return this;
  }

  addTopic(topic: string): this {
    if (!this.history.topics.includes(topic)) {
      this.history.topics.push(topic);
    }
    return this;
  }

  // ==========================================
  // PLAYER METHODS
  // ==========================================

  addPlayer(player: PlayerContext): this {
    this.players.push(player);
    return this;
  }

  setPlayers(players: PlayerContext[]): this {
    this.players = players;
    return this;
  }

  // ==========================================
  // QUEST METHODS
  // ==========================================

  addQuest(quest: QuestContext): this {
    this.quests.push(quest);
    return this;
  }

  // ==========================================
  // BUILD
  // ==========================================

  build(): FullContext {
    return {
      npc: this.npc as NPCProfile,
      location: this.location as LocationContext,
      world: this.world as WorldContext,
      history: this.history,
      players: this.players,
      activeQuests: this.quests.length > 0 ? this.quests : undefined,
    };
  }

  // ==========================================
  // PROMPT GENERATION
  // ==========================================

  buildSystemPrompt(): string {
    const npc = this.npc as NPCProfile;
    const loc = this.location as LocationContext;

    const sections: string[] = [];

    // Identity
    sections.push(
      `You are roleplaying as ${npc.name}, a ${npc.race || ""} ${npc.occupation || "person"}.`,
    );

    if (npc.appearance) {
      sections.push(`APPEARANCE: ${npc.appearance}`);
    }

    // Personality
    sections.push(`PERSONALITY: ${npc.personality}`);
    sections.push(`VOICE/SPEAKING STYLE: ${npc.voice}`);

    if (npc.mannerisms?.length) {
      sections.push(`MANNERISMS: ${npc.mannerisms.join(", ")}`);
    }

    if (npc.catchphrases?.length) {
      sections.push(`CATCHPHRASES: "${npc.catchphrases.join('", "')}"`);
    }

    // Goals
    if (npc.publicGoals?.length) {
      sections.push(
        `GOALS:\n${npc.publicGoals.map((g) => `- ${g}`).join("\n")}`,
      );
    }

    if (npc.secretGoals?.length) {
      sections.push(
        `SECRET GOALS (hide these):\n${npc.secretGoals.map((g) => `- ${g}`).join("\n")}`,
      );
    }

    // Knowledge
    if (npc.knowledgeAreas?.length) {
      sections.push(`KNOWLEDGE AREAS: ${npc.knowledgeAreas.join(", ")}`);
    }

    if (npc.rumors?.length) {
      sections.push(
        `RUMORS YOU'VE HEARD:\n${npc.rumors.map((r) => `- ${r}`).join("\n")}`,
      );
    }

    if (npc.secrets?.length) {
      sections.push(
        `YOUR SECRETS (protect these):\n${npc.secrets.map((s) => `- ${s}`).join("\n")}`,
      );
    }

    // Relationships
    if (npc.relationships?.length) {
      const rels = npc.relationships
        .map(
          (r) =>
            `- ${r.targetName}: ${r.relationship} (disposition: ${r.disposition})`,
        )
        .join("\n");
      sections.push(`RELATIONSHIPS:\n${rels}`);
    }

    // Current state
    sections.push(`CURRENT MOOD: ${npc.currentMood}`);

    if (npc.currentActivity) {
      sections.push(`CURRENT ACTIVITY: ${npc.currentActivity}`);
    }

    // Location
    if (loc.name) {
      sections.push(`\nLOCATION: ${loc.name}`);
      if (loc.description) {
        sections.push(`${loc.description}`);
      }
      if (loc.currentConditions) {
        const conditions = Object.entries(loc.currentConditions)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        if (conditions) {
          sections.push(`CONDITIONS: ${conditions}`);
        }
      }
    }

    // World
    if (this.world.setting) {
      sections.push(`\nSETTING: ${this.world.setting}`);
    }
    if (this.world.currentDate) {
      sections.push(`DATE: ${this.world.currentDate}`);
    }
    if (this.world.majorEvents?.length) {
      sections.push(
        `RECENT EVENTS:\n${this.world.majorEvents.map((e) => `- ${e}`).join("\n")}`,
      );
    }

    // Players
    if (this.players.length) {
      const playerInfo = this.players
        .map(
          (p) =>
            `- ${p.characterName}: ${p.race} ${p.class}${p.reputationWithNPC !== undefined ? ` (your opinion: ${p.reputationWithNPC})` : ""}`,
        )
        .join("\n");
      sections.push(`\nPLAYER CHARACTERS:\n${playerInfo}`);
    }

    // Instructions
    sections.push(`\nINSTRUCTIONS:
- Stay in character at all times
- Speak in first person as ${npc.name}
- Use your established voice and mannerisms
- React based on your mood and relationships
- Only share knowledge you would reasonably have
- Protect your secrets unless cleverly extracted
- Keep responses concise (2-4 sentences typically)`);

    return sections.join("\n\n");
  }

  buildConversationContext(): string {
    if (this.history.messages.length === 0) {
      return "";
    }

    const recentMessages = this.history.messages.slice(-10);

    return recentMessages
      .map((m) => {
        if (m.role === "system") {
          return `[${m.content}]`;
        }
        return `${m.speaker}: ${m.content}`;
      })
      .join("\n");
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createContext(): ContextBuilder {
  return new ContextBuilder();
}

// ============================================
// QUICK CONTEXT BUILDERS
// ============================================

export function buildSimpleNPCContext(
  name: string,
  personality: string,
  voice: string,
  mood: string,
  locationName: string,
): FullContext {
  return createContext()
    .setNPCBasics(crypto.randomUUID(), name)
    .setNPCPersonality(personality, voice)
    .setNPCGoals([])
    .setNPCKnowledge([])
    .setNPCMood(mood)
    .setLocation({
      id: "",
      name: locationName,
      type: "location",
    })
    .build();
}

export function buildQuickContext(
  npc: Partial<NPCProfile>,
  location?: Partial<LocationContext>,
): FullContext {
  const builder = createContext();

  if (npc.id && npc.name) {
    builder.setNPC(npc as NPCProfile);
  }

  if (location) {
    builder.setLocation(location as LocationContext);
  }

  return builder.build();
}
