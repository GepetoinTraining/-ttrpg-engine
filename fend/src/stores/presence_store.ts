import { create } from 'zustand'

interface User {
  id: string
  name: string
  imageUrl?: string
  characterId?: string
  characterName?: string
  role: 'gm' | 'player'
}

interface PresenceState {
  // Current user
  currentUser: User | null

  // Online users by room
  campaignUsers: Map<string, User[]>
  sessionUsers: Map<string, User[]>

  // Typing indicators
  typing: Map<string, string[]> // roomId -> userIds

  // Cursor positions (for collaborative features)
  cursors: Map<string, { x: number; y: number; userId: string; name: string }[]>

  // Actions
  setCurrentUser: (user: User | null) => void

  setCampaignUsers: (campaignId: string, users: User[]) => void
  addCampaignUser: (campaignId: string, user: User) => void
  removeCampaignUser: (campaignId: string, userId: string) => void

  setSessionUsers: (sessionId: string, users: User[]) => void
  addSessionUser: (sessionId: string, user: User) => void
  removeSessionUser: (sessionId: string, userId: string) => void

  setTyping: (roomId: string, userIds: string[]) => void
  addTyping: (roomId: string, userId: string) => void
  removeTyping: (roomId: string, userId: string) => void

  updateCursor: (roomId: string, userId: string, name: string, x: number, y: number) => void
  removeCursor: (roomId: string, userId: string) => void

  // Helpers
  isOnline: (userId: string, roomType: 'campaign' | 'session', roomId: string) => boolean
  getOnlineCount: (roomType: 'campaign' | 'session', roomId: string) => number
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  currentUser: null,
  campaignUsers: new Map(),
  sessionUsers: new Map(),
  typing: new Map(),
  cursors: new Map(),

  setCurrentUser: (user) => set({ currentUser: user }),

  setCampaignUsers: (campaignId, users) => set((state) => {
    const map = new Map(state.campaignUsers)
    map.set(campaignId, users)
    return { campaignUsers: map }
  }),

  addCampaignUser: (campaignId, user) => set((state) => {
    const map = new Map(state.campaignUsers)
    const users = map.get(campaignId) || []
    if (!users.find(u => u.id === user.id)) {
      map.set(campaignId, [...users, user])
    }
    return { campaignUsers: map }
  }),

  removeCampaignUser: (campaignId, userId) => set((state) => {
    const map = new Map(state.campaignUsers)
    const users = map.get(campaignId) || []
    map.set(campaignId, users.filter(u => u.id !== userId))
    return { campaignUsers: map }
  }),

  setSessionUsers: (sessionId, users) => set((state) => {
    const map = new Map(state.sessionUsers)
    map.set(sessionId, users)
    return { sessionUsers: map }
  }),

  addSessionUser: (sessionId, user) => set((state) => {
    const map = new Map(state.sessionUsers)
    const users = map.get(sessionId) || []
    if (!users.find(u => u.id === user.id)) {
      map.set(sessionId, [...users, user])
    }
    return { sessionUsers: map }
  }),

  removeSessionUser: (sessionId, userId) => set((state) => {
    const map = new Map(state.sessionUsers)
    const users = map.get(sessionId) || []
    map.set(sessionId, users.filter(u => u.id !== userId))
    return { sessionUsers: map }
  }),

  setTyping: (roomId, userIds) => set((state) => {
    const map = new Map(state.typing)
    map.set(roomId, userIds)
    return { typing: map }
  }),

  addTyping: (roomId, userId) => set((state) => {
    const map = new Map(state.typing)
    const users = map.get(roomId) || []
    if (!users.includes(userId)) {
      map.set(roomId, [...users, userId])
    }
    return { typing: map }
  }),

  removeTyping: (roomId, userId) => set((state) => {
    const map = new Map(state.typing)
    const users = map.get(roomId) || []
    map.set(roomId, users.filter(id => id !== userId))
    return { typing: map }
  }),

  updateCursor: (roomId, userId, name, x, y) => set((state) => {
    const map = new Map(state.cursors)
    const cursors = map.get(roomId) || []
    const existing = cursors.findIndex(c => c.userId === userId)
    if (existing >= 0) {
      cursors[existing] = { userId, name, x, y }
    } else {
      cursors.push({ userId, name, x, y })
    }
    map.set(roomId, [...cursors])
    return { cursors: map }
  }),

  removeCursor: (roomId, userId) => set((state) => {
    const map = new Map(state.cursors)
    const cursors = map.get(roomId) || []
    map.set(roomId, cursors.filter(c => c.userId !== userId))
    return { cursors: map }
  }),

  isOnline: (userId, roomType, roomId) => {
    const state = get()
    const map = roomType === 'campaign' ? state.campaignUsers : state.sessionUsers
    const users = map.get(roomId) || []
    return users.some(u => u.id === userId)
  },

  getOnlineCount: (roomType, roomId) => {
    const state = get()
    const map = roomType === 'campaign' ? state.campaignUsers : state.sessionUsers
    return (map.get(roomId) || []).length
  },
}))
