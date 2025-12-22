import type {
  WebSocketClient,
  SessionStartMessage,
  SessionEndMessage,
  SceneChangeMessage,
  LocationChangeMessage,
} from "../types";
import { createMessage } from "../types";
import { broadcastToSession, broadcastToCampaign } from "../broadcast";
import { joinRoom, leaveRoom, getRoomId } from "../rooms";
import {
  trackPresence,
  removePresence,
  broadcastPresenceJoin,
  broadcastPresenceLeave,
} from "../presence";
import * as sessions from "../../db/queries/sessions";
import * as sync from "../../db/queries/sync";

// ============================================
// SESSION HANDLER
// ============================================
//
// Handles session lifecycle events.
//

// ============================================
// SESSION START
// ============================================

export async function handleSessionStart(
  client: WebSocketClient,
  sessionId: string,
  playerIds: string[],
): Promise<void> {
  // Verify GM
  if (client.role !== "gm" && client.role !== "owner") {
    client.send(
      createMessage("error", {
        code: "FORBIDDEN",
        message: "Only GM can start sessions",
      }),
    );
    return;
  }

  // Start session in DB
  await sessions.startSession(sessionId, playerIds);

  // Log sync change
  if (client.campaignId) {
    await sync.logSessionChange(client.campaignId, sessionId, "update", {
      status: "active",
      playerIds,
    });
  }

  // Broadcast to campaign
  if (client.campaignId) {
    broadcastToCampaign(
      client.campaignId,
      createMessage<SessionStartMessage>("session_start", {
        sessionId,
        playerIds,
      }),
    );
  }
}

export async function handleSessionEnd(
  client: WebSocketClient,
  sessionId: string,
  summary?: string,
): Promise<void> {
  // Verify GM
  if (client.role !== "gm" && client.role !== "owner") {
    client.send(
      createMessage("error", {
        code: "FORBIDDEN",
        message: "Only GM can end sessions",
      }),
    );
    return;
  }

  // End session in DB
  const session = await sessions.endSession(sessionId, summary);

  // Log sync change
  if (client.campaignId) {
    await sync.logSessionChange(client.campaignId, sessionId, "update", {
      status: "ended",
      summary,
    });
  }

  // Broadcast
  broadcastToSession(
    sessionId,
    createMessage<SessionEndMessage>("session_end", {
      sessionId,
      summary,
      duration: session.totalDuration,
    }),
  );
}

// ============================================
// SESSION JOIN/LEAVE
// ============================================

export async function handleJoinSession(
  client: WebSocketClient,
  sessionId: string,
): Promise<void> {
  // Join session room
  await joinRoom(client, "session", sessionId);
  client.sessionId = sessionId;

  // Track presence
  trackPresence("session", sessionId, client);

  // Broadcast join
  broadcastPresenceJoin("session", sessionId, client, client.id);

  // Send initial state
  const session = await sessions.getSession(sessionId);
  if (session) {
    client.send(
      createMessage("sync_init", {
        cursor: { version: 0, timestamp: new Date().toISOString() },
        entities: {
          characters: [],
          npcs: [],
          combat: null,
          session,
        },
      }),
    );
  }
}

export function handleLeaveSession(
  client: WebSocketClient,
  sessionId: string,
): void {
  // Leave session room
  leaveRoom(client, getRoomId("session", sessionId));

  // Remove presence
  removePresence("session", sessionId, client.userId);

  // Broadcast leave
  broadcastPresenceLeave("session", sessionId, client.userId, client.id);

  client.sessionId = null;
}

// ============================================
// SCENE CHANGES
// ============================================

export async function handleSceneChange(
  client: WebSocketClient,
  sessionId: string,
  sceneId: string,
  locationId?: string,
): Promise<void> {
  // Verify GM
  if (client.role !== "gm" && client.role !== "owner") {
    client.send(
      createMessage("error", {
        code: "FORBIDDEN",
        message: "Only GM can change scenes",
      }),
    );
    return;
  }

  // Get previous scene
  const session = await sessions.getSession(sessionId);
  const previousSceneId = session?.currentSceneId || null;

  // Update in DB
  await sessions.setScene(sessionId, sceneId, locationId);

  // Log sync change
  if (client.campaignId) {
    await sync.logSessionChange(client.campaignId, sessionId, "update", {
      currentSceneId: sceneId,
      currentLocationId: locationId,
    });
  }

  // Broadcast
  broadcastToSession(
    sessionId,
    createMessage<SceneChangeMessage>("scene_change", {
      sessionId,
      previousSceneId,
      sceneId,
      locationId,
    }),
  );
}

export async function handleLocationChange(
  client: WebSocketClient,
  sessionId: string,
  locationId: string,
): Promise<void> {
  // Verify GM
  if (client.role !== "gm" && client.role !== "owner") {
    client.send(
      createMessage("error", {
        code: "FORBIDDEN",
        message: "Only GM can change locations",
      }),
    );
    return;
  }

  // Get previous location
  const session = await sessions.getSession(sessionId);
  const previousLocationId = session?.currentLocationId || null;

  // Update in DB
  await sessions.setLocation(sessionId, locationId);

  // Log sync change
  if (client.campaignId) {
    await sync.logSessionChange(client.campaignId, sessionId, "update", {
      currentLocationId: locationId,
    });
  }

  // Broadcast
  broadcastToSession(
    sessionId,
    createMessage<LocationChangeMessage>("location_change", {
      sessionId,
      previousLocationId,
      locationId,
    }),
  );
}

// ============================================
// SESSION PAUSE/RESUME
// ============================================

export async function handleSessionPause(
  client: WebSocketClient,
  sessionId: string,
): Promise<void> {
  if (client.role !== "gm" && client.role !== "owner") {
    return;
  }

  await sessions.pauseSession(sessionId);

  broadcastToSession(
    sessionId,
    createMessage("session_pause", { sessionId } as any),
  );
}

export async function handleSessionResume(
  client: WebSocketClient,
  sessionId: string,
): Promise<void> {
  if (client.role !== "gm" && client.role !== "owner") {
    return;
  }

  await sessions.resumeSession(sessionId);

  broadcastToSession(
    sessionId,
    createMessage("session_resume", { sessionId } as any),
  );
}
