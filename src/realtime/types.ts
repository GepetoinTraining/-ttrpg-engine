import { z } from "zod";

// ============================================
// REAL-TIME TYPES
// ============================================
//
// WebSocket message types for live session sync.
//

// ============================================
// CLIENT INTERFACE
// ============================================

export interface WebSocketClient {
  id: string;
  userId: string;
  userName: string;
  role: string;
  campaignId: string | null;
  sessionId: string | null;
  subscriptions: Set<string>;
  lastPing: number;
  avatarUrl?: string;

  // Send message to this client
  send: (message: WebSocketMessage) => void;

  // Close connection
  close: (code?: number, reason?: string) => void;
}

// ============================================
// MESSAGE TYPES
// ============================================

export type MessageType =
  // Connection
  | "connect"
  | "disconnect"
  | "ping"
  | "pong"
  | "error"

  // Subscription
  | "subscribe"
  | "unsubscribe"
  | "subscribed"

  // Sync
  | "sync_init"
  | "sync_delta"
  | "sync_ack"

  // Session
  | "session_start"
  | "session_end"
  | "session_pause"
  | "session_resume"
  | "scene_change"
  | "location_change"

  // Combat
  | "combat_start"
  | "combat_end"
  | "combat_turn"
  | "combat_action"
  | "participant_update"
  | "initiative_update"

  // Characters
  | "character_update"
  | "hp_change"
  | "condition_change"

  // Chat
  | "chat_message"
  | "dice_roll"
  | "whisper"

  // Presence
  | "presence_join"
  | "presence_leave"
  | "presence_update"
  | "cursor_move";

// ============================================
// BASE MESSAGE
// ============================================

export interface BaseMessage {
  type: MessageType;
  id: string; // Unique message ID
  timestamp: string; // ISO timestamp
}

// ============================================
// CONNECTION MESSAGES
// ============================================

export interface ConnectMessage extends BaseMessage {
  type: "connect";
  payload: {
    userId: string;
    token: string;
    campaignId: string;
    sessionId?: string;
  };
}

export interface DisconnectMessage extends BaseMessage {
  type: "disconnect";
  payload: {
    reason?: string;
  };
}

export interface PingMessage extends BaseMessage {
  type: "ping";
}

export interface PongMessage extends BaseMessage {
  type: "pong";
  payload: {
    serverTime: string;
  };
}

export interface ErrorMessage extends BaseMessage {
  type: "error";
  payload: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// ============================================
// SUBSCRIPTION MESSAGES
// ============================================

export interface SubscribeMessage extends BaseMessage {
  type: "subscribe";
  payload: {
    channel: "campaign" | "session" | "combat";
    id: string;
  };
}

export interface UnsubscribeMessage extends BaseMessage {
  type: "unsubscribe";
  payload: {
    channel: string;
    id: string;
  };
}

export interface SubscribedMessage extends BaseMessage {
  type: "subscribed";
  payload: {
    channel: string;
    id: string;
    cursor: {
      version: number;
      timestamp: string;
    };
  };
}

// ============================================
// SYNC MESSAGES
// ============================================

export interface SyncInitMessage extends BaseMessage {
  type: "sync_init";
  payload: {
    cursor: {
      version: number;
      timestamp: string;
    };
    entities: {
      characters: any[];
      npcs: any[];
      combat: any | null;
      session: any | null;
    };
  };
}

export interface SyncDeltaMessage extends BaseMessage {
  type: "sync_delta";
  payload: {
    changes: Array<{
      entityType: string;
      entityId: string;
      operation: "create" | "update" | "delete";
      delta: Record<string, any>;
      version: number;
    }>;
    cursor: {
      version: number;
      timestamp: string;
    };
  };
}

export interface SyncAckMessage extends BaseMessage {
  type: "sync_ack";
  payload: {
    version: number;
    timestamp: string;
  };
}

// ============================================
// SESSION MESSAGES
// ============================================

export interface SessionStartMessage extends BaseMessage {
  type: "session_start";
  payload: {
    sessionId: string;
    playerIds: string[];
  };
}

export interface SessionEndMessage extends BaseMessage {
  type: "session_end";
  payload: {
    sessionId: string;
    summary?: string;
    duration: number;
  };
}

export interface SceneChangeMessage extends BaseMessage {
  type: "scene_change";
  payload: {
    sessionId: string;
    previousSceneId: string | null;
    sceneId: string;
    locationId?: string;
  };
}

export interface LocationChangeMessage extends BaseMessage {
  type: "location_change";
  payload: {
    sessionId: string;
    previousLocationId: string | null;
    locationId: string;
  };
}

// ============================================
// COMBAT MESSAGES
// ============================================

export interface CombatStartMessage extends BaseMessage {
  type: "combat_start";
  payload: {
    combatId: string;
    sessionId: string;
    participants: Array<{
      id: string;
      name: string;
      entityType: string;
      initiative: number;
      hp: number;
      maxHp: number;
      ac: number;
      isVisible: boolean;
    }>;
  };
}

export interface CombatEndMessage extends BaseMessage {
  type: "combat_end";
  payload: {
    combatId: string;
    sessionId: string;
  };
}

export interface CombatTurnMessage extends BaseMessage {
  type: "combat_turn";
  payload: {
    combatId: string;
    round: number;
    turnIndex: number;
    currentParticipantId: string;
    currentParticipantName: string;
  };
}

export interface CombatActionMessage extends BaseMessage {
  type: "combat_action";
  payload: {
    combatId: string;
    round: number;
    actorId: string;
    actorName: string;
    actionType: string;
    actionData: Record<string, any>;
    targetIds: string[];
    results: Record<string, any>;
  };
}

export interface ParticipantUpdateMessage extends BaseMessage {
  type: "participant_update";
  payload: {
    combatId: string;
    participantId: string;
    changes: {
      hp?: number;
      tempHp?: number;
      conditions?: string[];
      position?: { x: number; y: number };
      isAlive?: boolean;
      isVisible?: boolean;
    };
  };
}

export interface InitiativeUpdateMessage extends BaseMessage {
  type: "initiative_update";
  payload: {
    combatId: string;
    order: Array<{
      participantId: string;
      initiative: number;
    }>;
  };
}

// ============================================
// CHARACTER MESSAGES
// ============================================

export interface CharacterUpdateMessage extends BaseMessage {
  type: "character_update";
  payload: {
    characterId: string;
    changes: Record<string, any>;
  };
}

export interface HPChangeMessage extends BaseMessage {
  type: "hp_change";
  payload: {
    entityType: "character" | "npc" | "participant";
    entityId: string;
    previousHp: number;
    currentHp: number;
    maxHp: number;
    tempHp: number;
    changeType: "damage" | "heal" | "temp_hp" | "set";
    amount: number;
  };
}

export interface ConditionChangeMessage extends BaseMessage {
  type: "condition_change";
  payload: {
    entityType: "character" | "npc" | "participant";
    entityId: string;
    action: "add" | "remove";
    condition: string;
    conditions: string[];
  };
}

// ============================================
// CHAT MESSAGES
// ============================================

export interface ChatMessage extends BaseMessage {
  type: "chat_message";
  payload: {
    sessionId: string;
    senderId: string;
    senderName: string;
    senderType: "player" | "gm" | "npc" | "system";
    message: string;
    isWhisper: boolean;
    whisperTo?: string[];
  };
}

export interface DiceRollMessage extends BaseMessage {
  type: "dice_roll";
  payload: {
    sessionId: string;
    rollerId: string;
    rollerName: string;
    rollerType: "player" | "gm" | "npc";
    expression: string;
    result: number;
    breakdown: string;
    purpose?: string;
    isPrivate: boolean;
  };
}

// ============================================
// PRESENCE MESSAGES
// ============================================

export interface PresenceJoinMessage extends BaseMessage {
  type: "presence_join";
  payload: {
    userId: string;
    userName: string;
    role: string;
    avatarUrl?: string;
  };
}

export interface PresenceLeaveMessage extends BaseMessage {
  type: "presence_leave";
  payload: {
    userId: string;
  };
}

export interface PresenceUpdateMessage extends BaseMessage {
  type: "presence_update";
  payload: {
    userId: string;
    status: "active" | "idle" | "away";
    focusedElement?: string;
  };
}

export interface CursorMoveMessage extends BaseMessage {
  type: "cursor_move";
  payload: {
    userId: string;
    x: number;
    y: number;
    context: "map" | "sheet" | "chat";
  };
}

// ============================================
// UNION TYPE
// ============================================

export type WebSocketMessage =
  | ConnectMessage
  | DisconnectMessage
  | PingMessage
  | PongMessage
  | ErrorMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | SubscribedMessage
  | SyncInitMessage
  | SyncDeltaMessage
  | SyncAckMessage
  | SessionStartMessage
  | SessionEndMessage
  | SceneChangeMessage
  | LocationChangeMessage
  | CombatStartMessage
  | CombatEndMessage
  | CombatTurnMessage
  | CombatActionMessage
  | ParticipantUpdateMessage
  | InitiativeUpdateMessage
  | CharacterUpdateMessage
  | HPChangeMessage
  | ConditionChangeMessage
  | ChatMessage
  | DiceRollMessage
  | PresenceJoinMessage
  | PresenceLeaveMessage
  | PresenceUpdateMessage
  | CursorMoveMessage;

// ============================================
// MESSAGE HELPERS
// ============================================

export function createMessage<T extends WebSocketMessage>(
  type: T["type"],
  payload: T extends { payload: infer P } ? P : never,
): T {
  return {
    type,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    payload,
  } as T;
}

export function isMessageType<T extends WebSocketMessage>(
  message: WebSocketMessage,
  type: T["type"],
): message is T {
  return message.type === type;
}
