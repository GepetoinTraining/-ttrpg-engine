import { create } from 'zustand'
import { vanillaTrpc as trpc } from '@/api/trpc'

// ============================================
// TYPES
// ============================================

interface Delta {
  id: string
  table: string
  recordId: string
  operation: 'create' | 'update' | 'delete'
  data: Record<string, any>
  clientVersion: number
  clientTimestamp: string
  status: 'pending' | 'confirmed' | 'rejected'
}

interface SyncCursor {
  campaignId: string
  sessionId?: string
  lastVersion: number
  lastTimestamp: string
}

interface SyncState {
  // State
  isOnline: boolean
  isSyncing: boolean
  campaignId: string | null
  sessionId: string | null
  cursor: SyncCursor | null
  pendingDeltas: Delta[]
  pollInterval: number
  pollTimer: NodeJS.Timeout | null

  // Actions
  init: (campaignId: string, sessionId?: string) => Promise<void>
  shutdown: () => void
  queueDelta: (
    table: string,
    recordId: string,
    operation: 'create' | 'update' | 'delete',
    data: Record<string, any>
  ) => void
  pollSync: () => Promise<void>

  // Internal
  startPolling: () => void
  stopPolling: () => void
  pushDeltas: () => Promise<void>
  pullChanges: () => Promise<void>
}

// ============================================
// STORE
// ============================================

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  isSyncing: false,
  campaignId: null,
  sessionId: null,
  cursor: null,
  pendingDeltas: [],
  pollInterval: 3000, // 3 seconds
  pollTimer: null,

  // ==========================================
  // INIT
  // ==========================================

  init: async (campaignId: string, sessionId?: string) => {
    console.log('[SYNC] Initializing...', { campaignId, sessionId })

    set({ campaignId, sessionId })

    try {
      // Get initial sync state
      const result = await trpc.sync.init.query({ sessionId })

      set({
        cursor: result.cursor,
        isOnline: true,
      })

      // Apply initial entities to stores
      // (session_store, character_store, etc. will listen to these)
      applyInitialState(result.entities)

      // Start polling
      get().startPolling()

      console.log('[SYNC] Initialized', result.cursor)
    } catch (error) {
      console.error('[SYNC] Init failed:', error)
      set({ isOnline: false })
    }
  },

  // ==========================================
  // SHUTDOWN
  // ==========================================

  shutdown: () => {
    console.log('[SYNC] Shutting down')
    get().stopPolling()
    set({
      campaignId: null,
      sessionId: null,
      cursor: null,
      pendingDeltas: [],
    })
  },

  // ==========================================
  // QUEUE DELTA
  // ==========================================

  queueDelta: (table, recordId, operation, data) => {
    const delta: Delta = {
      id: crypto.randomUUID(),
      table,
      recordId,
      operation,
      data,
      clientVersion: (get().cursor?.lastVersion || 0) + 1,
      clientTimestamp: new Date().toISOString(),
      status: 'pending',
    }

    set((state) => ({
      pendingDeltas: [...state.pendingDeltas, delta],
    }))

    console.log('[SYNC] Queued delta:', delta)

    // Push immediately (don't wait for poll)
    get().pushDeltas()
  },

  // ==========================================
  // POLL SYNC
  // ==========================================

  pollSync: async () => {
    if (get().isSyncing) return // Debounce

    set({ isSyncing: true })

    try {
      // Push pending deltas
      await get().pushDeltas()

      // Pull server changes
      await get().pullChanges()

      set({ isOnline: true })
    } catch (error) {
      console.error('[SYNC] Poll failed:', error)
      set({ isOnline: false })
    } finally {
      set({ isSyncing: false })
    }
  },

  // ==========================================
  // PUSH DELTAS
  // ==========================================

  pushDeltas: async () => {
    const { pendingDeltas, sessionId, campaignId } = get()

    if (pendingDeltas.length === 0) return

    const deltasToSend = pendingDeltas.filter(d => d.status === 'pending')
    if (deltasToSend.length === 0) return

    console.log('[SYNC] Pushing deltas:', deltasToSend.length)

    try {
      const result = await trpc.sync.push.mutate({
        deltas: deltasToSend,
        sessionId,
      })

      // Update delta statuses
      set((state) => ({
        pendingDeltas: state.pendingDeltas.map((delta) => {
          const serverResult = result.results.find(r => r.id === delta.id)
          if (serverResult) {
            return { ...delta, status: serverResult.status }
          }
          return delta
        }),
        cursor: {
          campaignId: campaignId!,
          sessionId,
          lastVersion: result.serverVersion,
          lastTimestamp: result.serverTimestamp,
        },
      }))

      // Remove confirmed deltas after 1 second (for debugging)
      setTimeout(() => {
        set((state) => ({
          pendingDeltas: state.pendingDeltas.filter(
            d => d.status === 'pending'
          ),
        }))
      }, 1000)

      console.log('[SYNC] Push complete:', result.results)
    } catch (error) {
      console.error('[SYNC] Push failed:', error)
      // Deltas stay pending, will retry on next poll
    }
  },

  // ==========================================
  // PULL CHANGES
  // ==========================================

  pullChanges: async () => {
    const { cursor, sessionId } = get()

    if (!cursor) return

    try {
      const result = await trpc.sync.changes.query({
        lastVersion: cursor.lastVersion,
        lastTimestamp: cursor.lastTimestamp,
        sessionId,
        limit: 100,
      })

      if (result.changes.length > 0) {
        console.log('[SYNC] Pulled changes:', result.changes.length)

        // Apply changes to stores
        applyServerChanges(result.changes)

        // Update cursor
        set({ cursor: result.cursor })
      }
    } catch (error) {
      console.error('[SYNC] Pull failed:', error)
    }
  },

  // ==========================================
  // POLLING
  // ==========================================

  startPolling: () => {
    const { pollTimer, pollInterval } = get()

    if (pollTimer) return // Already polling

    console.log('[SYNC] Starting poll loop')

    const timer = setInterval(() => {
      get().pollSync()
    }, pollInterval)

    set({ pollTimer: timer })
  },

  stopPolling: () => {
    const { pollTimer } = get()

    if (pollTimer) {
      clearInterval(pollTimer)
      set({ pollTimer: null })
      console.log('[SYNC] Stopped polling')
    }
  },
}))

// ============================================
// HELPERS
// ============================================

function applyInitialState(entities: any) {
  // TODO: Wire up to other stores
  // Example:
  // if (entities.session) {
  //   useSessionStore.getState().setCards(entities.session.cards)
  // }
  console.log('[SYNC] Applied initial state:', entities)
}

function applyServerChanges(changes: any[]) {
  // TODO: Wire up to other stores
  // Example:
  // changes.forEach(change => {
  //   if (change.entityType === 'session') {
  //     useSessionStore.getState().setCards(change.delta.cards)
  //   }
  // })
  console.log('[SYNC] Applied server changes:', changes)
}

// ============================================
// EXPORTS
// ============================================

export type { Delta, SyncCursor }
