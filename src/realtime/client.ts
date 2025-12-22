import type { WebSocketMessage, SyncDeltaMessage } from "./types";
import { createMessage, isMessageType } from "./types";

// ============================================
// WEBSOCKET CLIENT
// ============================================
//
// Client-side WebSocket handler for React apps.
//
// Usage:
//
//   const client = new RealtimeClient({
//     url: 'wss://api.example.com/ws',
//     token: clerkToken,
//     campaignId: 'xxx',
//     sessionId: 'yyy',
//   });
//
//   client.on('sync_delta', (msg) => {
//     // Apply changes to local state
//   });
//
//   client.connect();
//

// ============================================
// TYPES
// ============================================

export interface RealtimeClientOptions {
  url: string;
  token: string;
  userId: string;
  userName: string;
  campaignId: string;
  sessionId?: string;

  // Reconnection
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;

  // Heartbeat
  pingInterval?: number;
}

export type MessageHandler<T extends WebSocketMessage = WebSocketMessage> = (
  message: T,
) => void;

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

// ============================================
// CLIENT CLASS
// ============================================

export class RealtimeClient {
  private options: Required<RealtimeClientOptions>;
  private socket: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts: number = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private _state: ConnectionState = "disconnected";
  private _cursor: { version: number; timestamp: string } | null = null;

  constructor(options: RealtimeClientOptions) {
    this.options = {
      reconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      ...options,
    };
  }

  // ==========================================
  // GETTERS
  // ==========================================

  get state(): ConnectionState {
    return this._state;
  }

  get cursor(): { version: number; timestamp: string } | null {
    return this._cursor;
  }

  get isConnected(): boolean {
    return this._state === "connected";
  }

  // ==========================================
  // CONNECTION
  // ==========================================

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this._state = this.reconnectAttempts > 0 ? "reconnecting" : "connecting";
    this.emit("state_change", { state: this._state });

    try {
      this.socket = new WebSocket(this.options.url);
      this.setupSocketHandlers();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  disconnect(): void {
    this.options.reconnect = false;
    this.cleanup();
    this.socket?.close(1000, "Client disconnect");
    this._state = "disconnected";
    this.emit("state_change", { state: this._state });
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this._state = "connected";
      this.reconnectAttempts = 0;
      this.emit("state_change", { state: this._state });

      // Send connect message
      this.send(
        createMessage("connect", {
          userId: this.options.userId,
          token: this.options.token,
          campaignId: this.options.campaignId,
          sessionId: this.options.sessionId,
        }),
      );

      // Start ping interval
      this.startPing();
    };

    this.socket.onclose = (event) => {
      this.cleanup();

      if (
        this.options.reconnect &&
        this.reconnectAttempts < this.options.maxReconnectAttempts
      ) {
        this.scheduleReconnect();
      } else {
        this._state = "disconnected";
        this.emit("state_change", { state: this._state });
        this.emit("disconnected", { code: event.code, reason: event.reason });
      }
    };

    this.socket.onerror = (event) => {
      this.emit("error", { error: event });
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
  }

  private handleConnectionError(error: unknown): void {
    this.emit("error", { error });

    if (
      this.options.reconnect &&
      this.reconnectAttempts < this.options.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const delay =
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this._state = "reconnecting";
    this.emit("state_change", {
      state: this._state,
      attempt: this.reconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ==========================================
  // PING/PONG
  // ==========================================

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send(createMessage("ping", undefined as never));
      }
    }, this.options.pingInterval);
  }

  // ==========================================
  // MESSAGE HANDLING
  // ==========================================

  private handleMessage(message: WebSocketMessage): void {
    // Update cursor on sync messages
    if (isMessageType<SyncDeltaMessage>(message, "sync_delta")) {
      this._cursor = message.payload.cursor;

      // Send ack
      this.send(
        createMessage("sync_ack", {
          version: message.payload.cursor.version,
          timestamp: message.payload.cursor.timestamp,
        }),
      );
    }

    // Handle sync_init
    if (message.type === "sync_init") {
      this._cursor = (message as any).payload.cursor;
    }

    // Emit to handlers
    this.emit(message.type, message);
  }

  // ==========================================
  // SENDING
  // ==========================================

  send(message: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send message:", error);
      return false;
    }
  }

  // ==========================================
  // CONVENIENCE METHODS
  // ==========================================

  sendChat(message: string, whisperTo?: string[]): void {
    this.send(
      createMessage("chat_message", {
        sessionId: this.options.sessionId!,
        senderId: this.options.userId,
        senderName: this.options.userName,
        senderType: "player",
        message,
        isWhisper: !!whisperTo,
        whisperTo,
      }),
    );
  }

  sendDiceRoll(
    expression: string,
    result: number,
    breakdown: string,
    purpose?: string,
    isPrivate = false,
  ): void {
    this.send(
      createMessage("dice_roll", {
        sessionId: this.options.sessionId!,
        rollerId: this.options.userId,
        rollerName: this.options.userName,
        rollerType: "player",
        expression,
        result,
        breakdown,
        purpose,
        isPrivate,
      }),
    );
  }

  sendCursorMove(
    x: number,
    y: number,
    context: "map" | "sheet" | "chat",
  ): void {
    this.send(
      createMessage("cursor_move", {
        userId: this.options.userId,
        x,
        y,
        context,
      }),
    );
  }

  updatePresence(
    status: "active" | "idle" | "away",
    focusedElement?: string,
  ): void {
    this.send(
      createMessage("presence_update", {
        userId: this.options.userId,
        status,
        focusedElement,
      }),
    );
  }

  subscribe(channel: "campaign" | "session" | "combat", id: string): void {
    this.send(createMessage("subscribe", { channel, id }));
  }

  unsubscribe(channel: string, id: string): void {
    this.send(createMessage("unsubscribe", { channel, id }));
  }

  // ==========================================
  // EVENT HANDLING
  // ==========================================

  on<T extends WebSocketMessage>(
    type: T["type"] | "state_change" | "disconnected" | "error",
    handler: MessageHandler<T>,
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler as MessageHandler);
    };
  }

  off(type: string, handler?: MessageHandler): void {
    if (handler) {
      this.handlers.get(type)?.delete(handler);
    } else {
      this.handlers.delete(type);
    }
  }

  private emit(type: string, data: any): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Handler error for ${type}:`, error);
        }
      }
    }
  }
}

// ============================================
// REACT HOOK HELPERS
// ============================================

/**
 * Create a singleton client instance
 */
let clientInstance: RealtimeClient | null = null;

export function getRealtimeClient(
  options?: RealtimeClientOptions,
): RealtimeClient | null {
  if (options && !clientInstance) {
    clientInstance = new RealtimeClient(options);
  }
  return clientInstance;
}

export function destroyRealtimeClient(): void {
  clientInstance?.disconnect();
  clientInstance = null;
}
