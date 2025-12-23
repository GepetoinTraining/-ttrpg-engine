import { create } from 'zustand'

interface SessionCard {
  id: string
  type: 'scene' | 'combat' | 'loot' | 'downtime_reveal'
  title: string
  content: any
}

interface SessionState {
  // Session data
  sessionId: string | null
  campaignId: string | null
  isLive: boolean
  isPaused: boolean
  duration: number

  // Card state
  cards: SessionCard[]
  currentCardIndex: number
  currentCard: SessionCard | null

  // Actions
  setSession: (sessionId: string, campaignId: string) => void
  clearSession: () => void
  setLive: (live: boolean) => void
  setPaused: (paused: boolean) => void
  setDuration: (duration: number) => void

  // Card actions
  setCards: (cards: SessionCard[]) => void
  addCard: (card: SessionCard) => void
  removeCard: (cardId: string) => void
  reorderCards: (fromIndex: number, toIndex: number) => void
  setCurrentCardIndex: (index: number) => void
  advanceCard: () => void
  previousCard: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  campaignId: null,
  isLive: false,
  isPaused: false,
  duration: 0,
  cards: [],
  currentCardIndex: 0,
  currentCard: null,

  setSession: (sessionId, campaignId) => set({ sessionId, campaignId }),

  clearSession: () => set({
    sessionId: null,
    campaignId: null,
    isLive: false,
    isPaused: false,
    duration: 0,
    cards: [],
    currentCardIndex: 0,
    currentCard: null,
  }),

  setLive: (isLive) => set({ isLive }),
  setPaused: (isPaused) => set({ isPaused }),
  setDuration: (duration) => set({ duration }),

  setCards: (cards) => set({
    cards,
    currentCard: cards[get().currentCardIndex] || null
  }),

  addCard: (card) => set((state) => ({
    cards: [...state.cards, card]
  })),

  removeCard: (cardId) => set((state) => ({
    cards: state.cards.filter(c => c.id !== cardId)
  })),

  reorderCards: (fromIndex, toIndex) => set((state) => {
    const cards = [...state.cards]
    const [removed] = cards.splice(fromIndex, 1)
    cards.splice(toIndex, 0, removed)
    return { cards }
  }),

  setCurrentCardIndex: (index) => set((state) => ({
    currentCardIndex: index,
    currentCard: state.cards[index] || null,
  })),

  advanceCard: () => set((state) => {
    const nextIndex = Math.min(state.currentCardIndex + 1, state.cards.length - 1)
    return {
      currentCardIndex: nextIndex,
      currentCard: state.cards[nextIndex] || null,
    }
  }),

  previousCard: () => set((state) => {
    const prevIndex = Math.max(state.currentCardIndex - 1, 0)
    return {
      currentCardIndex: prevIndex,
      currentCard: state.cards[prevIndex] || null,
    }
  }),
}))
