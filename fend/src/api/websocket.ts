import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'

type MessageHandler = (data: any) => void

interface WebSocketMessage {
  type: string
  payload: any
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002'

class RealtimeConnection {
  private socket: WebSocket | null = null
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private token: string | null = null

  connect(token: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return
    }

    this.token = token
    this.socket = new WebSocket(`${WS_URL}?token=${token}`)

    this.socket.onopen = () => {
      console.log('[WS] Connected')
      this.reconnectAttempts = 0
    }

    this.socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.dispatch(message.type, message.payload)
      } catch (e) {
        console.error('[WS] Failed to parse message:', e)
      }
    }

    this.socket.onclose = () => {
      console.log('[WS] Disconnected')
      this.attemptReconnect()
    }

    this.socket.onerror = (error) => {
      console.error('[WS] Error:', error)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token)
      }
    }, delay)
  }

  send(type: string, payload: any) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send - not connected')
      return
    }

    this.socket.send(JSON.stringify({ type, payload }))
  }

  subscribe(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)

    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  private dispatch(type: string, payload: any) {
    const handlers = this.handlers.get(type)
    if (handlers) {
      handlers.forEach((handler) => handler(payload))
    }

    // Also dispatch to wildcard handlers
    const wildcardHandlers = this.handlers.get('*')
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler({ type, payload }))
    }
  }

  // Room management
  joinRoom(roomType: 'campaign' | 'session', roomId: string) {
    this.send('join_room', { roomType, roomId })
  }

  leaveRoom(roomType: 'campaign' | 'session', roomId: string) {
    this.send('leave_room', { roomType, roomId })
  }
}

// Singleton instance
export const realtime = new RealtimeConnection()

// React hook for realtime subscriptions
export function useRealtime(type: string, handler: MessageHandler) {
  const { getToken } = useAuth()
  const handlerRef = useRef(handler)

  // Keep handler ref updated
  handlerRef.current = handler

  useEffect(() => {
    // Connect on mount
    getToken().then((token) => {
      if (token) {
        realtime.connect(token)
      }
    })

    // Subscribe to messages
    const unsubscribe = realtime.subscribe(type, (data) => {
      handlerRef.current(data)
    })

    return unsubscribe
  }, [type, getToken])
}

// Hook for room management
export function useRoom(roomType: 'campaign' | 'session', roomId: string | undefined) {
  useEffect(() => {
    if (!roomId) return

    realtime.joinRoom(roomType, roomId)

    return () => {
      realtime.leaveRoom(roomType, roomId)
    }
  }, [roomType, roomId])
}

// Hook for sending messages
export function useSendMessage() {
  return useCallback((type: string, payload: any) => {
    realtime.send(type, payload)
  }, [])
}
