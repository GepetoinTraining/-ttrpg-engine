/**
 * THEME CONFIGURATION
 * ====================
 *
 * Public theme tokens for the TTRPG Engine.
 * Modify these values to customize the application appearance.
 *
 * The internal CSS processors will use these tokens to generate
 * responsive, consistent styles.
 */

export const theme = {
  // ============================================
  // COLORS
  // ============================================
  colors: {
    // Primary palette (gold/amber for D&D feel)
    primary: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b', // Main
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },

    // Slate (dark mode base)
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },

    // Semantic colors
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#0ea5e9',

    // Combat states
    combat: {
      player: '#22c55e',
      enemy: '#ef4444',
      neutral: '#64748b',
      selected: '#f59e0b',
      targeted: '#ef4444',
    },

    // Terrain
    terrain: {
      normal: 'transparent',
      difficult: 'rgba(245, 158, 11, 0.2)',
      impassable: 'rgba(15, 23, 42, 0.8)',
      water: 'rgba(14, 165, 233, 0.3)',
      hazard: 'rgba(239, 68, 68, 0.3)',
    },
  },

  // ============================================
  // SPACING
  // ============================================
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
  },

  // ============================================
  // TYPOGRAPHY
  // ============================================
  fonts: {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'Crimson Pro, Georgia, serif',
    mono: 'JetBrains Mono, Consolas, monospace',
  },

  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },

  // ============================================
  // BORDERS
  // ============================================
  radii: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },

  // ============================================
  // SHADOWS
  // ============================================
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.3)',
    glow: '0 0 20px rgba(245, 158, 11, 0.4)',
  },

  // ============================================
  // TRANSITIONS
  // ============================================
  transitions: {
    fast: '150ms ease-out',
    normal: '250ms ease-out',
    slow: '400ms ease-out',
  },

  // ============================================
  // BREAKPOINTS
  // ============================================
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // ============================================
  // Z-INDEX
  // ============================================
  zIndex: {
    base: 0,
    dropdown: 50,
    sticky: 100,
    modal: 200,
    popover: 300,
    tooltip: 400,
  },
}

export type Theme = typeof theme
