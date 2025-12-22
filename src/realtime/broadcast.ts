import type { WebSocketMessage, WebSocketClient } from "./types";
import { getRoomId, getRoom } from "./rooms";
import * as sync from "../db/queries/sync";
import { createMessage } from "./types";

// ============================================
// BROADCASTING
// ============================================
//
// Utilities for sending messages to multiple clients.
//

// ============================================
// CLIENT REGISTRY
// ============================================

// Global client registry (managed by server.ts)
const clients = new Map<string, WebSocketClient>();
const userToClient = new Map<string, string>();

export function registerClient(client: WebSocketClient): void {
  clients.set(client.id, client);
  userToClient.set(client.userId, client.id);
}

export function unregisterClient(clientId: string): void {
  const client = clients.get(clientId);
  if (client) {
    userToClient.delete(client.userId);
  }
  clients.delete(clientId);
}

export function getClient(clientId: string): WebSocketClient | null {
  return clients.get(clientId) || null;
}

export function getClientByUserId(userId: string): WebSocketClient | null {
  const clientId = userToClient.get(userId);
  if (!clientId) return null;
  return clients.get(clientId) || null;
}

export function getAllClients(): WebSocketClient[] {
  return Array.from(clients.values());
}

// ============================================
// BROADCAST FUNCTIONS
// ============================================

/**
 * Send message to all clients in a room
 */
export function broadcastToRoom(
  roomId: string,
  message: WebSocketMessage,
  excludeClientId?: string,
): number {
  const room = getRoom(roomId);
  if (!room) return 0;

  let sent = 0;
  for (const clientId of room.clients) {
    if (clientId === excludeClientId) continue;

    const client = clients.get(clientId);
    if (client) {
      try {
        client.send(message);
        sent++;
      } catch (e) {
        console.error(`Failed to send to client ${clientId}:`, e);
      }
    }
  }

  return sent;
}

/**
 * Send message to campaign room
 */
export function broadcastToCampaign(
  campaignId: string,
  message: WebSocketMessage,
  excludeClientId?: string,
): number {
  return broadcastToRoom(
    getRoomId("campaign", campaignId),
    message,
    excludeClientId,
  );
}

/**
 * Send message to session room
 */
export function broadcastToSession(
  sessionId: string,
  message: WebSocketMessage,
  excludeClientId?: string,
): number {
  return broadcastToRoom(
    getRoomId("session", sessionId),
    message,
    excludeClientId,
  );
}

/**
 * Send message to combat room
 */
export function broadcastToCombat(
  combatId: string,
  message: WebSocketMessage,
  excludeClientId?: string,
): number {
  return broadcastToRoom(
    getRoomId("combat", combatId),
    message,
    excludeClientId,
  );
}

/**
 * Send message to specific user
 */
export function sendToUser(userId: string, message: WebSocketMessage): boolean {
  const client = getClientByUserId(userId);
  if (!client) return false;

  try {
    client.send(message);
    return true;
  } catch (e) {
    console.error(`Failed to send to user ${userId}:`, e);
    return false;
  }
}

/**
 * Send message to multiple users
 */
export function sendToUsers(
  userIds: string[],
  message: WebSocketMessage,
): number {
  let sent = 0;
  for (const userId of userIds) {
    if (sendToUser(userId, message)) {
      sent++;
    }
  }
  return sent;
}

/**
 * Broadcast to all connected clients
 */
export function broadcastToAll(
  message: WebSocketMessage,
  excludeClientId?: string,
): number {
  let sent = 0;
  for (const [clientId, client] of clients) {
    if (clientId === excludeClientId) continue;

    try {
      client.send(message);
      sent++;
    } catch (e) {
      console.error(`Failed to send to client ${clientId}:`, e);
    }
  }
  return sent;
}

// ============================================
// SYNC BROADCASTING
// ============================================

/**
 * Broadcast sync delta to appropriate room
 */
export async function broadcastSyncDelta(
  campaignId: string,
  sessionId: string | null,
  changes: Array<{
    entityType: string;
    entityId: string;
    operation: "create" | "update" | "delete";
    delta: Record<string, any>;
    version: number;
  }>,
): Promise<number> {
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

  if (sessionId) {
    return broadcastToSession(sessionId, message);
  } else {
    return broadcastToCampaign(campaignId, message);
  }
}

// ============================================
// FILTERED BROADCASTING
// ============================================

/**
 * Broadcast to room, but only to clients matching a filter
 */
export function broadcastToRoomFiltered(
  roomId: string,
  message: WebSocketMessage,
  filter: (client: WebSocketClient) => boolean,
): number {
  const room = getRoom(roomId);
  if (!room) return 0;

  let sent = 0;
  for (const clientId of room.clients) {
    const client = clients.get(clientId);
    if (client && filter(client)) {
      try {
        client.send(message);
        sent++;
      } catch (e) {
        console.error(`Failed to send to client ${clientId}:`, e);
      }
    }
  }

  return sent;
}

/**
 * Broadcast to GMs only in a room
 */
export function broadcastToGMs(
  roomId: string,
  message: WebSocketMessage,
): number {
  return broadcastToRoomFiltered(
    roomId,
    message,
    (client) => client.role === "gm" || client.role === "owner",
  );
}

/**
 * Broadcast to players only in a room
 */
export function broadcastToPlayers(
  roomId: string,
  message: WebSocketMessage,
): number {
  return broadcastToRoomFiltered(
    roomId,
    message,
    (client) => client.role === "player",
  );
}

// ============================================
// STATISTICS
// ============================================

export function getClientCount(): number {
  return clients.size;
}

export function getConnectedUserIds(): string[] {
  return Array.from(userToClient.keys());
}

/**
 * Get all clients in a room
 */
export function getClientsInRoom(roomId: string): WebSocketClient[] {
  const room = getRoom(roomId);
  if (!room) return [];

  const result: WebSocketClient[] = [];
  for (const clientId of room.clients) {
    const client = clients.get(clientId);
    if (client) {
      result.push(client);
    }
  }
  return result;
}
