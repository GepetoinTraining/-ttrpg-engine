import { useEffect, useRef, useCallback, useState } from 'react'
import { realtime, useRealtime as useRealtimeBase } from '@api/websocket'

export { useRealtime } from '@api/websocket'

export function usePresence(roomType: 'campaign' | 'session', roomId: string) {
  const [users, setUsers] = useState<any[]>([])

  useRealtimeBase('presence_update', (data) => {
    if (data.roomType === roomType && data.roomId === roomId) {
      setUsers(data.users)
    }
  })

  return users
}

export function useCursor(roomId: string) {
  const [cursors, setCursors] = useState<Map<string, { x: number; y: number; name: string }>>(new Map())

  useRealtimeBase('cursor_move', (data) => {
    if (data.roomId === roomId) {
      setCursors(prev => new Map(prev).set(data.userId, { x: data.x, y: data.y, name: data.name }))
    }
  })

  const updateCursor = useCallback((x: number, y: number) => {
    realtime.send('cursor_move', { roomId, x, y })
  }, [roomId])

  return { cursors, updateCursor }
}

export function useTypingIndicator(roomId: string) {
  const [typing, setTyping] = useState<string[]>([])
  const timeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useRealtimeBase('typing', (data) => {
    if (data.roomId !== roomId) return

    setTyping(prev => [...new Set([...prev, data.userId])])

    const existing = timeoutRef.current.get(data.userId)
    if (existing) clearTimeout(existing)

    timeoutRef.current.set(data.userId, setTimeout(() => {
      setTyping(prev => prev.filter(id => id !== data.userId))
    }, 3000))
  })

  const sendTyping = useCallback(() => {
    realtime.send('typing', { roomId })
  }, [roomId])

  return { typing, sendTyping }
}
