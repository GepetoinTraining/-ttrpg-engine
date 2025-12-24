import type {
  WebSocketMessage,
  ConnectMessage,
  SubscribeMessage,
  SyncAckMessage,
  ChatMessage,
  DiceRollMessage,
  CursorMoveMessage,
  PresenceUpdateMessage,
} from "./types";
import { createMessage } from "./types";
import * as sync from "../db/queries/sync";

// ============================================
// WEBSOCKET SERVER
// ============================================
//
// Server-side WebSocket handler for real-time sync.
//
// Features:
//   - Connection management
//   - Channel subscriptions
//   - Presence tracking
//   - Message broadcasting
//

// ============================================
// TYPES
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

  // Send message to this client
  send: (message: WebSocketMessage) => void;

  // Close connection
  close: (code?: number, reason?: string) => void;
}

export interface Room {
  id: string;
  type: "campaign" | "session" | "combat";
  clients: Set<string>;
  cursor: sync.SyncCursor;
}

export interface ServerState {
  clients: Map<string, WebSocketClient>;
  rooms: Map<string, Room>;
  userToClient: Map<string, string>; // userId -> clientId
}

export interface RealtimeConfig {
  port?: number;
  heartbeatInterval?: number;
}

export interface RealtimeServer {
  wss: WebSocketServer;
  broadcast: (roomId: string, message: any, exclude?: WebSocket) => void;
  getRoomClients: (roomId: string) => Set<WebSocket>;
  getPresence: (roomId: string) => Array<{ userId: string; userName: string }>;
  close: () => Promise<void>;
}

/**
 * Create and configure the realtime WebSocket server
 */
export function createRealtimeServer(
  wss: WebSocketServer,
  config: RealtimeConfig = {},
): RealtimeServer {
  wss.on("connection", (ws: WebSocket, req: any) => {
    handleConnect(ws, req);

    ws.on("message", (data: Buffer) => {
      handleMessage(ws, data);
    });

    ws.on("close", () => {
      handleDisconnect(ws);
    });

    ws.on("error", (error: Error) => {
      console.error("[WebSocket] Error:", error);
    });
  });

  const heartbeatInterval = config.heartbeatInterval || 30000;
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, heartbeatInterval);

  wss.on("close", () => {
    clearInterval(interval);
  });

  return {
    wss,
    broadcast: broadcastToRoom,
    getRoomClients,
    getPresence: getRoomPresence,
    close: async () => {
      clearInterval(interval);
      wss.close();
    },
  };
}

// ============================================
// SERVER STATE
// ============================================

const state: ServerState = {
  clients: new Map(),
  rooms: new Map(),
  userToClient: new Map(),
};

// ============================================
// CONNECTION MANAGEMENT
// ============================================

export function handleConnect(
  client: WebSocketClient,
  message: ConnectMessage,
): void {
  // Validate token (Clerk JWT)
  // In real implementation, verify JWT here

  // Store client
  state.clients.set(client.id, client);
  state.userToClient.set(client.userId, client.id);

  // Set campaign context
  client.campaignId = message.payload.campaignId;
  if (message.payload.sessionId) {
    client.sessionId = message.payload.sessionId;
  }

  // Auto-subscribe to campaign
  subscribeToRoom(client, "campaign", message.payload.campaignId);

  // Auto-subscribe to session if provided
  if (message.payload.sessionId) {
    subscribeToRoom(client, "session", message.payload.sessionId);
  }

  // Broadcast presence
  broadcastToRoom(
    getRoomId("campaign", message.payload.campaignId),
    createMessage("presence_join", {
      userId: client.userId,
      userName: client.userName,
      role: client.role,
    }),
    client.id,
  );
}

export function handleDisconnect(clientId: string): void {
  const client = state.clients.get(clientId);
  if (!client) return;

  // Broadcast departure
  if (client.campaignId) {
    broadcastToRoom(
      getRoomId("campaign", client.campaignId),
      createMessage("presence_leave", {
        userId: client.userId,
      }),
      clientId,
    );
  }

  // Remove from rooms
  for (const roomId of client.subscriptions) {
    const room = state.rooms.get(roomId);
    if (room) {
      room.clients.delete(clientId);

      // Cleanup empty rooms
      if (room.clients.size === 0) {
        state.rooms.delete(roomId);
      }
    }
  }

  // Remove client
  state.clients.delete(clientId);
  state.userToClient.delete(client.userId);
}

// ============================================
// ROOM MANAGEMENT
// ============================================

function getRoomId(type: Room["type"], id: string): string {
  return `${type}:${id}`;
}

async function subscribeToRoom(
  client: WebSocketClient,
  type: Room["type"],
  id: string,
): Promise<void> {
  const roomId = getRoomId(type, id);

  // Create room if doesn't exist
  if (!state.rooms.has(roomId)) {
    const cursor = await sync.getCurrentCursor(
      client.campaignId!,
      type === "session" ? id : undefined,
    );

    state.rooms.set(roomId, {
      id: roomId,
      type,
      clients: new Set(),
      cursor,
    });
  }

  const room = state.rooms.get(roomId)!;
  room.clients.add(client.id);
  client.subscriptions.add(roomId);

  // Send confirmation with initial state
  if (type === "session" || type === "campaign") {
    const fullSync = await sync.getFullSync(
      client.campaignId!,
      type === "session" ? id : undefined,
    );

    client.send(
      createMessage("sync_init", {
        cursor: {
          version: fullSync.cursor.lastVersion,
          timestamp: fullSync.cursor.lastTimestamp,
        },
        entities: fullSync.entities,
      }),
    );
  }

  client.send(
    createMessage("subscribed", {
      channel: type,
      id,
      cursor: {
        version: room.cursor.lastVersion,
        timestamp: room.cursor.lastTimestamp,
      },
    }),
  );
}

function unsubscribeFromRoom(
  client: WebSocketClient,
  type: Room["type"],
  id: string,
): void {
  const roomId = getRoomId(type, id);
  const room = state.rooms.get(roomId);

  if (room) {
    room.clients.delete(client.id);
    client.subscriptions.delete(roomId);

    // Cleanup empty rooms
    if (room.clients.size === 0) {
      state.rooms.delete(roomId);
    }
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================

export async function handleMessage(
  client: WebSocketClient,
  message: WebSocketMessage,
): Promise<void> {
  client.lastPing = Date.now();

  switch (message.type) {
    case "ping":
      client.send(
        createMessage("pong", {
          serverTime: new Date().toISOString(),
        }),
      );
      break;

    case "subscribe":
      await handleSubscribe(client, message as SubscribeMessage);
      break;

    case "unsubscribe":
      handleUnsubscribe(client, message);
      break;

    case "sync_ack":
      handleSyncAck(client, message as SyncAckMessage);
      break;

    case "chat_message":
      handleChat(client, message as ChatMessage);
      break;

    case "dice_roll":
      handleDiceRoll(client, message as DiceRollMessage);
      break;

    case "cursor_move":
      handleCursorMove(client, message as CursorMoveMessage);
      break;

    case "presence_update":
      handlePresenceUpdate(client, message as PresenceUpdateMessage);
      break;

    default:
      client.send(
        createMessage("error", {
          code: "UNKNOWN_MESSAGE_TYPE",
          message: `Unknown message type: ${message.type}`,
        }),
      );
  }
}

async function handleSubscribe(
  client: WebSocketClient,
  message: SubscribeMessage,
): Promise<void> {
  const { channel, id } = message.payload;

  // Validate access (should check permissions)
  if (channel === "campaign" && id !== client.campaignId) {
    client.send(
      createMessage("error", {
        code: "FORBIDDEN",
        message: "Cannot subscribe to another campaign",
      }),
    );
    return;
  }

  await subscribeToRoom(client, channel, id);
}

function handleUnsubscribe(
  client: WebSocketClient,
  message: WebSocketMessage,
): void {
  const { channel, id } = (message as any).payload;
  unsubscribeFromRoom(client, channel, id);
}

function handleSyncAck(client: WebSocketClient, message: SyncAckMessage): void {
  // Client acknowledged processing changes up to this point
  // Could update subscription tracking here
}

function handleChat(client: WebSocketClient, message: ChatMessage): void {
  const { sessionId, isWhisper, whisperTo } = message.payload;

  if (isWhisper && whisperTo) {
    // Send only to specific users
    for (const targetUserId of whisperTo) {
      const targetClientId = state.userToClient.get(targetUserId);
      if (targetClientId) {
        const targetClient = state.clients.get(targetClientId);
        targetClient?.send(message);
      }
    }
    // Also send back to sender
    client.send(message);
  } else {
    // Broadcast to session
    broadcastToRoom(getRoomId("session", sessionId), message);
  }
}

function handleDiceRoll(
  client: WebSocketClient,
  message: DiceRollMessage,
): void {
  const { sessionId, isPrivate } = message.payload;

  if (isPrivate) {
    // Only send to GMs and roller
    const roomId = getRoomId("session", sessionId);
    const room = state.rooms.get(roomId);

    if (room) {
      for (const clientId of room.clients) {
        const targetClient = state.clients.get(clientId);
        if (
          targetClient &&
          (targetClient.role === "gm" ||
            targetClient.role === "owner" ||
            targetClient.id === client.id)
        ) {
          targetClient.send(message);
        }
      }
    }
  } else {
    broadcastToRoom(getRoomId("session", sessionId), message);
  }
}

function handleCursorMove(
  client: WebSocketClient,
  message: CursorMoveMessage,
): void {
  // Broadcast to session (low priority, can throttle)
  if (client.sessionId) {
    broadcastToRoom(
      getRoomId("session", client.sessionId),
      message,
      client.id, // Exclude sender
    );
  }
}

function handlePresenceUpdate(
  client: WebSocketClient,
  message: PresenceUpdateMessage,
): void {
  if (client.campaignId) {
    broadcastToRoom(
      getRoomId("campaign", client.campaignId),
      message,
      client.id,
    );
  }
}

// ============================================
// BROADCASTING
// ============================================

export function broadcastToRoom(
  roomId: string,
  message: WebSocketMessage,
  excludeClientId?: string,
): void {
  const room = state.rooms.get(roomId);
  if (!room) return;

  for (const clientId of room.clients) {
    if (clientId === excludeClientId) continue;

    const client = state.clients.get(clientId);
    client?.send(message);
  }
}

export function broadcastToCampaign(
  campaignId: string,
  message: WebSocketMessage,
  excludeClientId?: string,
): void {
  broadcastToRoom(getRoomId("campaign", campaignId), message, excludeClientId);
}

export function broadcastToSession(
  sessionId: string,
  message: WebSocketMessage,
  excludeClientId?: string,
): void {
  broadcastToRoom(getRoomId("session", sessionId), message, excludeClientId);
}

export function sendToUser(userId: string, message: WebSocketMessage): boolean {
  const clientId = state.userToClient.get(userId);
  if (!clientId) return false;

  const client = state.clients.get(clientId);
  if (!client) return false;

  client.send(message);
  return true;
}

// ============================================
// SYNC BROADCASTING
// ============================================

export async function broadcastDelta(
  campaignId: string,
  sessionId: string | null,
  changes: Array<{
    entityType: string;
    entityId: string;
    operation: "create" | "update" | "delete";
    delta: Record<string, any>;
    version: number;
  }>,
): Promise<void> {
  const cursor = await sync.getCurrentCursor(
    campaignId,
    sessionId || undefined,
  );

  const message = createMessage("sync_delta", {
    changes,
    cursor: {
      version: cursor.lastVersion,
      timestamp: cursor.lastTimestamp,
    },
  });

  // Broadcast to appropriate room
  if (sessionId) {
    broadcastToSession(sessionId, message);
  } else {
    broadcastToCampaign(campaignId, message);
  }
}

// ============================================
// PRESENCE
// ============================================

export function getPresence(roomId: string): Array<{
  userId: string;
  userName: string;
  role: string;
}> {
  const room = state.rooms.get(roomId);
  if (!room) return [];

  const presence: Array<{ userId: string; userName: string; role: string }> =
    [];

  for (const clientId of room.clients) {
    const client = state.clients.get(clientId);
    if (client) {
      presence.push({
        userId: client.userId,
        userName: client.userName,
        role: client.role,
      });
    }
  }

  return presence;
}

export function getSessionPresence(sessionId: string) {
  return getPresence(getRoomId("session", sessionId));
}

export function getCampaignPresence(campaignId: string) {
  return getPresence(getRoomId("campaign", campaignId));
}

// ============================================
// CLEANUP
// ============================================

export function cleanupStaleConnections(maxIdleMs: number = 60000): void {
  const now = Date.now();

  for (const [clientId, client] of state.clients) {
    if (now - client.lastPing > maxIdleMs) {
      client.close(1000, "Connection timed out");
      handleDisconnect(clientId);
    }
  }
}

// Run cleanup every minute
setInterval(() => cleanupStaleConnections(), 60000);
