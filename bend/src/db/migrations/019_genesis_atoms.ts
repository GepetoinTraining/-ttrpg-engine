/**
 * MIGRATION 019: Genesis Atoms
 *
 * Database-backed UI atoms. Each button, link, action is a seed
 * with its own topology and destination.
 *
 * "No topology = no existence" - every UI element exists as a seed
 * that precipitates into observable reality.
 */

export const MIGRATION_019_GENESIS_ATOMS = {
  version: 19,
  name: '019_genesis_atoms',
  tables: [
    // ============================================
    // GENESIS ATOMS - UI elements as seeds
    // ============================================
    {
      name: 'genesis_atoms',
      sql: `
        CREATE TABLE IF NOT EXISTS genesis_atoms (
          id TEXT PRIMARY KEY,

          -- Identity (the seed)
          seed TEXT NOT NULL,              -- BigInt as string, prime factorization = identity
          prime TEXT NOT NULL,             -- Base prime (2=Button, 3=Text, 5=Input, etc.)

          -- Classification
          atom_type TEXT NOT NULL,         -- 'button', 'link', 'input', 'text', 'icon', etc.
          variant TEXT DEFAULT 'default',  -- 'primary', 'secondary', 'ghost', 'danger', etc.

          -- Content
          label TEXT,                      -- Display text
          icon TEXT,                       -- Icon identifier (optional)
          tooltip TEXT,                    -- Hover text (optional)

          -- Destination (where it pushes)
          destination_type TEXT,           -- 'route', 'action', 'mutation', 'event', 'external'
          destination TEXT,                -- Route path, action name, mutation name, event name, URL
          destination_params TEXT DEFAULT '{}',  -- JSON params to pass

          -- Physics (optional overrides)
          physics TEXT DEFAULT '{}',       -- JSON physics overrides {mass, temperature, etc.}

          -- Scoping
          campaign_id TEXT REFERENCES campaigns(id),  -- NULL = global atom
          view TEXT,                       -- Which view this atom belongs to
          parent_id TEXT REFERENCES genesis_atoms(id), -- For nested atoms

          -- State
          is_active INTEGER DEFAULT 1,
          is_disabled INTEGER DEFAULT 0,

          -- Ordering
          sort_order INTEGER DEFAULT 0,

          -- Timestamps
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // GENESIS SURFACES - Containers/layouts
    // ============================================
    {
      name: 'genesis_surfaces',
      sql: `
        CREATE TABLE IF NOT EXISTS genesis_surfaces (
          id TEXT PRIMARY KEY,

          -- Identity
          seed TEXT NOT NULL,              -- Surface seed (81 for WorldSurface, 9 for Surface)
          surface_type TEXT NOT NULL,      -- 'world', 'card', 'form', 'modal', 'sidebar', etc.

          -- Content
          title TEXT,
          description TEXT,

          -- Layout
          layout TEXT DEFAULT 'column',    -- 'column', 'row', 'grid'
          physics TEXT DEFAULT '{}',       -- Physics overrides

          -- Scoping
          campaign_id TEXT REFERENCES campaigns(id),
          view TEXT NOT NULL,              -- 'character-builder', 'world', 'session', etc.

          -- Children ordering
          children_order TEXT DEFAULT '[]', -- JSON array of atom/surface IDs in order

          -- Timestamps
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },

    // ============================================
    // GENESIS VIEWS - Complete view definitions
    // ============================================
    {
      name: 'genesis_views',
      sql: `
        CREATE TABLE IF NOT EXISTS genesis_views (
          id TEXT PRIMARY KEY,

          -- Identity
          name TEXT NOT NULL,              -- 'character-builder', 'campaign-dashboard', etc.
          title TEXT,

          -- Root surface
          root_surface_id TEXT REFERENCES genesis_surfaces(id),

          -- Scoping
          campaign_id TEXT REFERENCES campaigns(id),  -- NULL = template view

          -- State
          is_template INTEGER DEFAULT 0,   -- Template views are copied for campaigns
          is_active INTEGER DEFAULT 1,

          -- Timestamps
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
    },
  ],

  indexes: [
    // Atoms
    'CREATE INDEX IF NOT EXISTS idx_genesis_atoms_seed ON genesis_atoms(seed)',
    'CREATE INDEX IF NOT EXISTS idx_genesis_atoms_type ON genesis_atoms(atom_type)',
    'CREATE INDEX IF NOT EXISTS idx_genesis_atoms_campaign ON genesis_atoms(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_genesis_atoms_view ON genesis_atoms(view)',
    'CREATE INDEX IF NOT EXISTS idx_genesis_atoms_parent ON genesis_atoms(parent_id)',

    // Surfaces
    'CREATE INDEX IF NOT EXISTS idx_genesis_surfaces_campaign ON genesis_surfaces(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_genesis_surfaces_view ON genesis_surfaces(view)',

    // Views
    'CREATE INDEX IF NOT EXISTS idx_genesis_views_campaign ON genesis_views(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_genesis_views_name ON genesis_views(name)',
  ],

  // Seed data - global template atoms
  seeds: [
    // Primary action buttons
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-birth-character',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'primary',
        label: 'Birth Character',
        destination_type: 'mutation',
        destination: 'character.birth',
        view: 'character-builder',
        sort_order: 100,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-cancel',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Cancel',
        destination_type: 'event',
        destination: 'genesis:exit',
        view: 'character-builder',
        sort_order: 99,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-view-characters',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'secondary',
        label: 'View Characters',
        destination_type: 'route',
        destination: '/campaign/:id/characters',
        view: 'campaign-dashboard',
        sort_order: 1,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-view-world',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'secondary',
        label: 'View World',
        destination_type: 'route',
        destination: '/campaign/:id/world',
        view: 'campaign-dashboard',
        sort_order: 2,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-enter-session',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'primary',
        label: 'Enter Session',
        destination_type: 'route',
        destination: '/campaign/:id/session',
        view: 'campaign-dashboard',
        sort_order: 3,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-exit',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Exit',
        destination_type: 'event',
        destination: 'genesis:exit',
        view: '*',  // Global - available in all views
        sort_order: 0,
      },
    },

    // Alignment buttons (9 of them)
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-lg',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Lawful Good',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "lawful-good"}',
        view: 'character-builder',
        sort_order: 10,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-ng',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Neutral Good',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "neutral-good"}',
        view: 'character-builder',
        sort_order: 11,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-cg',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Chaotic Good',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "chaotic-good"}',
        view: 'character-builder',
        sort_order: 12,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-ln',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Lawful Neutral',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "lawful-neutral"}',
        view: 'character-builder',
        sort_order: 13,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-tn',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'selected',  // Default selection
        label: 'True Neutral',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "true-neutral"}',
        view: 'character-builder',
        sort_order: 14,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-cn',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Chaotic Neutral',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "chaotic-neutral"}',
        view: 'character-builder',
        sort_order: 15,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-le',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Lawful Evil',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "lawful-evil"}',
        view: 'character-builder',
        sort_order: 16,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-ne',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Neutral Evil',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "neutral-evil"}',
        view: 'character-builder',
        sort_order: 17,
      },
    },
    {
      table: 'genesis_atoms',
      data: {
        id: 'atom-btn-align-ce',
        seed: '2',
        prime: '2',
        atom_type: 'button',
        variant: 'ghost',
        label: 'Chaotic Evil',
        destination_type: 'action',
        destination: 'setAlignment',
        destination_params: '{"alignment": "chaotic-evil"}',
        view: 'character-builder',
        sort_order: 18,
      },
    },
  ],
};
