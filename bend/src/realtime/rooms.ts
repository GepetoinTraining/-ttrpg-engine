import type { WebSocketClient } from "./types";
import * as sync from "../db/queries/sync";

// ============================================
// ROOM MANAGEMENT
// ============================================
//
// Manages WebSocket rooms/channels for broadcasting.
//

// ============================================
// TYPES
// ============================================

export interface Room {
  id: string;
  type: "campaign" | "session" | "combat";
  clients: Set<string>;
  cursor: sync.SyncCursor;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface RoomState {
  rooms: Map<string, Room>;
}

// ============================================
// STATE
// ============================================

const state: RoomState = {
  rooms: new Map(),
};

// ============================================
// ROOM ID HELPERS
// ============================================

export function getRoomId(type: Room["type"], id: string): string {
  return `${type}:${id}`;
}

export function parseRoomId(
  roomId: string,
): { type: Room["type"]; id: string } | null {
  const [type, ...rest] = roomId.split(":");
  if (!type || rest.length === 0) return null;
  return { type: type as Room["type"], id: rest.join(":") };
}

// ============================================
// ROOM OPERATIONS
// ============================================

export async function getOrCreateRoom(
  type: Room["type"],
  id: string,
  campaignId?: string,
): Promise<Room> {
  const roomId = getRoomId(type, id);

  if (state.rooms.has(roomId)) {
    return state.rooms.get(roomId)!;
  }

  // Get initial cursor
  const cursor = await sync.getCurrentCursor(
    campaignId || id,
    type === "session" ? id : undefined,
  );

  const room: Room = {
    id: roomId,
    type,
    clients: new Set(),
    cursor,
    metadata: {},
    createdAt: new Date(),
  };

  state.rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): Room | null {
  return state.rooms.get(roomId) || null;
}

export function getRoomByTypeAndId(
  type: Room["type"],
  id: string,
): Room | null {
  return getRoom(getRoomId(type, id));
}

export function deleteRoom(roomId: string): void {
  state.rooms.delete(roomId);
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

export async function joinRoom(
  client: WebSocketClient,
  type: Room["type"],
  id: string,
): Promise<Room> {
  const room = await getOrCreateRoom(type, id, client.campaignId || undefined);

  room.clients.add(client.id);
  client.subscriptions.add(room.id);

  return room;
}

export function leaveRoom(client: WebSocketClient, roomId: string): void {
  const room = state.rooms.get(roomId);
  if (!room) return;

  room.clients.delete(client.id);
  client.subscriptions.delete(roomId);

  // Cleanup empty rooms
  if (room.clients.size === 0) {
    state.rooms.delete(roomId);
  }
}

export function leaveAllRooms(client: WebSocketClient): void {
  for (const roomId of client.subscriptions) {
    leaveRoom(client, roomId);
  }
}

export function getRoomClients(roomId: string): string[] {
  const room = state.rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.clients);
}

// ============================================
// ROOM QUERIES
// ============================================

export function getCampaignRooms(campaignId: string): Room[] {
  const rooms: Room[] = [];

  for (const room of state.rooms.values()) {
    if (
      room.id.startsWith(`campaign:${campaignId}`) ||
      room.metadata.campaignId === campaignId
    ) {
      rooms.push(room);
    }
  }

  return rooms;
}

export function getSessionRoom(sessionId: string): Room | null {
  return getRoomByTypeAndId("session", sessionId);
}

export function getCombatRoom(combatId: string): Room | null {
  return getRoomByTypeAndId("combat", combatId);
}

export function getActiveRooms(): Room[] {
  return Array.from(state.rooms.values());
}

export function getRoomCount(): number {
  return state.rooms.size;
}

// ============================================
// CURSOR MANAGEMENT
// ============================================

export function updateRoomCursor(
  roomId: string,
  cursor: sync.SyncCursor,
): void {
  const room = state.rooms.get(roomId);
  if (room) {
    room.cursor = cursor;
  }
}

// ============================================
// METADATA
// ============================================

export function setRoomMetadata(
  roomId: string,
  metadata: Record<string, any>,
): void {
  const room = state.rooms.get(roomId);
  if (room) {
    room.metadata = { ...room.metadata, ...metadata };
  }
}

export function getRoomMetadata(roomId: string): Record<string, any> {
  const room = state.rooms.get(roomId);
  return room?.metadata || {};
}

// ============================================
// CLEANUP
// ============================================

export function cleanupEmptyRooms(): number {
  let cleaned = 0;

  for (const [roomId, room] of state.rooms) {
    if (room.clients.size === 0) {
      state.rooms.delete(roomId);
      cleaned++;
    }
  }

  return cleaned;
}

export function cleanupOldRooms(maxAgeMs: number): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [roomId, room] of state.rooms) {
    if (room.clients.size === 0 && now - room.createdAt.getTime() > maxAgeMs) {
      state.rooms.delete(roomId);
      cleaned++;
    }
  }

  return cleaned;
}
