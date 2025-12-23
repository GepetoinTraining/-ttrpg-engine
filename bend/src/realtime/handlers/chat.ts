import type { WebSocketClient } from "../server";
import type { ChatMessage } from "../types";
import { createMessage } from "../types";
import { broadcastToRoom, sendToUser } from "../broadcast";
import { getRoomId } from "../rooms";
import * as sessions from "../../db/queries/sessions";

// ============================================
// CHAT HANDLER
// ============================================

export interface ChatOptions {
  sessionId: string;
  senderId: string;
  senderName: string;
  senderType: "player" | "gm" | "npc" | "system";
  message: string;
  isWhisper?: boolean;
  whisperTo?: string[];
}

/**
 * Handle incoming chat message
 */
export async function handleChat(
  client: WebSocketClient,
  message: ChatMessage,
): Promise<void> {
  const { sessionId, isWhisper, whisperTo } = message.payload;

  // Log to database
  await sessions.logChat(
    sessionId,
    message.payload.senderId,
    message.payload.senderName,
    message.payload.senderType as "player" | "gm",
    message.payload.message,
    isWhisper,
    whisperTo,
  );

  if (isWhisper && whisperTo?.length) {
    // Send only to specific users + sender
    for (const targetUserId of whisperTo) {
      sendToUser(targetUserId, message);
    }
    // Echo back to sender
    client.send(message);
  } else {
    // Broadcast to entire session
    broadcastToRoom(getRoomId("session", sessionId), message);
  }
}

/**
 * Send chat as NPC
 */
export async function sendNPCChat(
  sessionId: string,
  npcId: string,
  npcName: string,
  message: string,
): Promise<void> {
  const chatMessage = createMessage("chat_message", {
    sessionId,
    senderId: npcId,
    senderName: npcName,
    senderType: "npc",
    message,
    isWhisper: false,
  });

  await sessions.createEvent(sessionId, {
    type: "chat",
    actorId: npcId,
    actorName: npcName,
    actorType: "npc",
    data: { message },
  });

  broadcastToRoom(getRoomId("session", sessionId), chatMessage);
}

/**
 * Send system message
 */
export async function sendSystemMessage(
  sessionId: string,
  message: string,
): Promise<void> {
  const systemMessage = createMessage("chat_message", {
    sessionId,
    senderId: "system",
    senderName: "System",
    senderType: "system",
    message,
    isWhisper: false,
  });

  broadcastToRoom(getRoomId("session", sessionId), systemMessage);
}

/**
 * Send GM announcement
 */
export async function sendGMAnnouncement(
  sessionId: string,
  gmId: string,
  message: string,
  style: "normal" | "dramatic" | "whisper" = "normal",
): Promise<void> {
  await sessions.createEvent(sessionId, {
    type: "narration",
    subtype: style,
    actorId: gmId,
    actorType: "gm",
    data: { message, style },
  });

  const chatMessage = createMessage("chat_message", {
    sessionId,
    senderId: gmId,
    senderName: "GM",
    senderType: "gm",
    message,
    isWhisper: false,
  });

  broadcastToRoom(getRoomId("session", sessionId), chatMessage);
}
