import type {
  WebSocketClient,
  PresenceJoinMessage,
  PresenceLeaveMessage,
  PresenceUpdateMessage,
} from "./types";
import { createMessage } from "./types";
import { broadcastToRoom } from "./broadcast";
import { getRoomId, getRoomClients } from "./rooms";

// ============================================
// PRESENCE TRACKING
// ============================================
//
// Tracks who is online and their status.
//

// ============================================
// TYPES
// ============================================

export interface UserPresence {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  status: "active" | "idle" | "away";
  focusedElement?: string;
  cursor?: { x: number; y: number; context: string };
  lastActivity: Date;
  joinedAt: Date;
}

export interface PresenceState {
  // campaignId -> userId -> presence
  campaigns: Map<string, Map<string, UserPresence>>;
  // sessionId -> userId -> presence
  sessions: Map<string, Map<string, UserPresence>>;
}

// ============================================
// STATE
// ============================================

const state: PresenceState = {
  campaigns: new Map(),
  sessions: new Map(),
};

// ============================================
// PRESENCE OPERATIONS
// ============================================

export function trackPresence(
  scope: "campaign" | "session",
  scopeId: string,
  client: WebSocketClient,
): void {
  const map = scope === "campaign" ? state.campaigns : state.sessions;

  if (!map.has(scopeId)) {
    map.set(scopeId, new Map());
  }

  const presence: UserPresence = {
    id: client.userId,
    name: client.userName,
    role: client.role,
    avatarUrl: client.avatarUrl,
    status: "active",
    lastActivity: new Date(),
    joinedAt: new Date(),
  };

  map.get(scopeId)!.set(client.userId, presence);
}

export function removePresence(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
): void {
  const map = scope === "campaign" ? state.campaigns : state.sessions;
  map.get(scopeId)?.delete(userId);

  // Cleanup empty maps
  if (map.get(scopeId)?.size === 0) {
    map.delete(scopeId);
  }
}

export function updatePresence(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
  updates: Partial<Pick<UserPresence, "status" | "focusedElement" | "cursor">>,
): void {
  const map = scope === "campaign" ? state.campaigns : state.sessions;
  const presence = map.get(scopeId)?.get(userId);

  if (presence) {
    Object.assign(presence, updates);
    presence.lastActivity = new Date();
  }
}

// ============================================
// PRESENCE QUERIES
// ============================================

export function getCampaignPresence(campaignId: string): UserPresence[] {
  const map = state.campaigns.get(campaignId);
  if (!map) return [];
  return Array.from(map.values());
}

export function getSessionPresence(sessionId: string): UserPresence[] {
  const map = state.sessions.get(sessionId);
  if (!map) return [];
  return Array.from(map.values());
}

export function getUserPresence(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
): UserPresence | null {
  const map = scope === "campaign" ? state.campaigns : state.sessions;
  return map.get(scopeId)?.get(userId) || null;
}

export function isUserOnline(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
): boolean {
  return getUserPresence(scope, scopeId, userId) !== null;
}

export function getOnlineCount(
  scope: "campaign" | "session",
  scopeId: string,
): number {
  const map = scope === "campaign" ? state.campaigns : state.sessions;
  return map.get(scopeId)?.size || 0;
}

// ============================================
// BROADCASTING
// ============================================

export function broadcastPresenceJoin(
  scope: "campaign" | "session",
  scopeId: string,
  client: WebSocketClient,
  excludeClientId?: string,
): void {
  const roomId = getRoomId(scope, scopeId);

  broadcastToRoom(
    roomId,
    createMessage<PresenceJoinMessage>("presence_join", {
      userId: client.userId,
      userName: client.userName,
      role: client.role,
      avatarUrl: client.avatarUrl,
    }),
    excludeClientId,
  );
}

export function broadcastPresenceLeave(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
  excludeClientId?: string,
): void {
  const roomId = getRoomId(scope, scopeId);

  broadcastToRoom(
    roomId,
    createMessage<PresenceLeaveMessage>("presence_leave", {
      userId,
    }),
    excludeClientId,
  );
}

export function broadcastPresenceUpdate(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
  status: UserPresence["status"],
  focusedElement?: string,
  excludeClientId?: string,
): void {
  const roomId = getRoomId(scope, scopeId);

  broadcastToRoom(
    roomId,
    createMessage<PresenceUpdateMessage>("presence_update", {
      userId,
      status,
      focusedElement,
    }),
    excludeClientId,
  );
}

// ============================================
// IDLE DETECTION
// ============================================

export function markIdle(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
): void {
  updatePresence(scope, scopeId, userId, { status: "idle" });
  broadcastPresenceUpdate(scope, scopeId, userId, "idle");
}

export function markAway(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
): void {
  updatePresence(scope, scopeId, userId, { status: "away" });
  broadcastPresenceUpdate(scope, scopeId, userId, "away");
}

export function markActive(
  scope: "campaign" | "session",
  scopeId: string,
  userId: string,
): void {
  const presence = getUserPresence(scope, scopeId, userId);
  if (presence && presence.status !== "active") {
    updatePresence(scope, scopeId, userId, { status: "active" });
    broadcastPresenceUpdate(scope, scopeId, userId, "active");
  }
}

// ============================================
// CLEANUP
// ============================================

export function cleanupStalePresence(maxIdleMs: number = 300000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [scopeId, map] of state.campaigns) {
    for (const [userId, presence] of map) {
      if (now - presence.lastActivity.getTime() > maxIdleMs) {
        map.delete(userId);
        cleaned++;
      }
    }
    if (map.size === 0) {
      state.campaigns.delete(scopeId);
    }
  }

  for (const [scopeId, map] of state.sessions) {
    for (const [userId, presence] of map) {
      if (now - presence.lastActivity.getTime() > maxIdleMs) {
        map.delete(userId);
        cleaned++;
      }
    }
    if (map.size === 0) {
      state.sessions.delete(scopeId);
    }
  }

  return cleaned;
}

// Run cleanup every 5 minutes
setInterval(() => cleanupStalePresence(), 300000);
