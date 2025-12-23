// ============================================
// REAL-TIME LAYER
// ============================================
//
// WebSocket-based real-time sync for TTRPG sessions.
//
// Server Usage (Next.js API route with ws):
//
//   import { handleConnect, handleMessage, handleDisconnect } from '@/realtime';
//
//   wss.on('connection', (ws, req) => {
//     const client = createClient(ws, req);
//
//     ws.on('message', (data) => {
//       const message = JSON.parse(data.toString());
//       handleMessage(client, message);
//     });
//
//     ws.on('close', () => handleDisconnect(client.id));
//   });
//
// Client Usage (React):
//
//   import { RealtimeClient } from '@/realtime';
//
//   const client = new RealtimeClient({
//     url: 'wss://api.example.com/ws',
//     token: clerkToken,
//     userId: user.id,
//     userName: user.name,
//     campaignId: campaign.id,
//     sessionId: session.id,
//   });
//
//   client.on('sync_delta', (msg) => {
//     for (const change of msg.payload.changes) {
//       applyChange(change);
//     }
//   });
//
//   client.on('chat_message', (msg) => {
//     addChatMessage(msg.payload);
//   });
//
//   client.connect();
//

// Types
export * from "./types";

// Server
export {
  handleConnect,
  handleDisconnect,
  handleMessage,
  type WebSocketClient,
  type ServerState,
} from "./server";

// Rooms
export {
  getOrCreateRoom as createRoom,
  deleteRoom as removeRoom,
  getRoom,
  getRoomId,
  joinRoom as subscribeToRoom,
  leaveRoom as unsubscribeFromRoom,
  type Room,
} from "./rooms";

// Broadcast
export {
  broadcastToRoom,
  broadcastToCampaign,
  broadcastToSession,
  broadcastToCombat,
  broadcastSyncDelta as broadcastDelta,
  sendToUser,
  getClientsInRoom,
} from "./broadcast";

// Presence
export {
  trackPresence,
  removePresence,
  updatePresence as updatePresenceStatus,
  getUserPresence as getPresence,
  getSessionPresence,
  getCampaignPresence,
  broadcastPresenceJoin,
  broadcastPresenceLeave,
} from "./presence";

// Handlers
export * as chatHandler from "./handlers/chat";
export * as diceHandler from "./handlers/dice";
export * as combatHandler from "./handlers/combat";
export * as sessionHandler from "./handlers/session";

// Client
export {
  RealtimeClient,
  getRealtimeClient,
  destroyRealtimeClient,
  type RealtimeClientOptions,
  type MessageHandler,
  type ConnectionState,
} from "./client";
