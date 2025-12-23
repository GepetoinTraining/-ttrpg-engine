import { create } from 'zustand'

interface Token {
  id: string
  name: string
  type: 'player' | 'enemy' | 'npc' | 'object'
  x: number
  y: number
  hp: number
  maxHp: number
  ac: number
  initiative: number
  conditions: string[]
  imageUrl?: string
}

interface CombatState {
  combatId: string | null
  isActive: boolean
  round: number
  turnIndex: number

  tokens: Token[]
  initiativeOrder: string[]
  selectedTokenId: string | null
  targetedTokenId: string | null

  gridWidth: number
  gridHeight: number
  cellSize: number

  // Actions
  setCombat: (combatId: string) => void
  clearCombat: () => void
  setRound: (round: number) => void
  nextTurn: () => void
  previousTurn: () => void

  setTokens: (tokens: Token[]) => void
  updateToken: (tokenId: string, updates: Partial<Token>) => void
  moveToken: (tokenId: string, x: number, y: number) => void
  damageToken: (tokenId: string, damage: number) => void
  healToken: (tokenId: string, healing: number) => void
  addCondition: (tokenId: string, condition: string) => void
  removeCondition: (tokenId: string, condition: string) => void

  selectToken: (tokenId: string | null) => void
  targetToken: (tokenId: string | null) => void

  setGrid: (width: number, height: number, cellSize?: number) => void
}

export const useCombatStore = create<CombatState>((set, get) => ({
  combatId: null,
  isActive: false,
  round: 1,
  turnIndex: 0,
  tokens: [],
  initiativeOrder: [],
  selectedTokenId: null,
  targetedTokenId: null,
  gridWidth: 20,
  gridHeight: 15,
  cellSize: 48,

  setCombat: (combatId) => set({ combatId, isActive: true }),
  clearCombat: () => set({
    combatId: null,
    isActive: false,
    round: 1,
    turnIndex: 0,
    tokens: [],
    initiativeOrder: [],
    selectedTokenId: null,
    targetedTokenId: null,
  }),

  setRound: (round) => set({ round }),

  nextTurn: () => set((state) => {
    const nextIndex = state.turnIndex + 1
    if (nextIndex >= state.initiativeOrder.length) {
      return { turnIndex: 0, round: state.round + 1 }
    }
    return { turnIndex: nextIndex }
  }),

  previousTurn: () => set((state) => {
    if (state.turnIndex === 0) {
      if (state.round === 1) return state
      return { turnIndex: state.initiativeOrder.length - 1, round: state.round - 1 }
    }
    return { turnIndex: state.turnIndex - 1 }
  }),

  setTokens: (tokens) => set({
    tokens,
    initiativeOrder: [...tokens].sort((a, b) => b.initiative - a.initiative).map(t => t.id)
  }),

  updateToken: (tokenId, updates) => set((state) => ({
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, ...updates } : t)
  })),

  moveToken: (tokenId, x, y) => set((state) => ({
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, x, y } : t)
  })),

  damageToken: (tokenId, damage) => set((state) => ({
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, hp: Math.max(0, t.hp - damage) } : t)
  })),

  healToken: (tokenId, healing) => set((state) => ({
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, hp: Math.min(t.maxHp, t.hp + healing) } : t)
  })),

  addCondition: (tokenId, condition) => set((state) => ({
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, conditions: [...t.conditions, condition] } : t)
  })),

  removeCondition: (tokenId, condition) => set((state) => ({
    tokens: state.tokens.map(t => t.id === tokenId ? { ...t, conditions: t.conditions.filter(c => c !== condition) } : t)
  })),

  selectToken: (tokenId) => set({ selectedTokenId: tokenId }),
  targetToken: (tokenId) => set({ targetedTokenId: tokenId }),

  setGrid: (width, height, cellSize = 48) => set({ gridWidth: width, gridHeight: height, cellSize }),
}))
