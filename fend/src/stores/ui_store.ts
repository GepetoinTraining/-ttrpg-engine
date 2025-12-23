import { create } from 'zustand'

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean

  // Modals
  activeModal: string | null
  modalData: any

  // Panels
  rightPanelTab: 'players' | 'chat' | 'dice' | 'notes'

  // Combat UI
  showInitiativeTracker: boolean
  showGrid: boolean
  gridOverlay: 'none' | 'movement' | 'range' | 'aoe'

  // Preferences
  darkMode: boolean
  reducedMotion: boolean

  // Actions
  toggleSidebar: () => void
  collapseSidebar: () => void
  expandSidebar: () => void

  openModal: (modalId: string, data?: any) => void
  closeModal: () => void

  setRightPanelTab: (tab: 'players' | 'chat' | 'dice' | 'notes') => void

  toggleInitiativeTracker: () => void
  toggleGrid: () => void
  setGridOverlay: (overlay: 'none' | 'movement' | 'range' | 'aoe') => void

  setDarkMode: (enabled: boolean) => void
  setReducedMotion: (enabled: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  activeModal: null,
  modalData: null,
  rightPanelTab: 'players',
  showInitiativeTracker: true,
  showGrid: true,
  gridOverlay: 'none',
  darkMode: true,
  reducedMotion: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  collapseSidebar: () => set({ sidebarCollapsed: true }),
  expandSidebar: () => set({ sidebarCollapsed: false }),

  openModal: (modalId, data) => set({ activeModal: modalId, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  toggleInitiativeTracker: () => set((s) => ({ showInitiativeTracker: !s.showInitiativeTracker })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setGridOverlay: (overlay) => set({ gridOverlay: overlay }),

  setDarkMode: (enabled) => set({ darkMode: enabled }),
  setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
}))
