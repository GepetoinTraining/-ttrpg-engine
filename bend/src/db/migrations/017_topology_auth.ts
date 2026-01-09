/**
 * MIGRATION 017: TOPOLOGY-FIRST AUTHENTICATION
 * =============================================
 *
 * Adds tables for the topology-based authentication system.
 *
 * Core concepts:
 * - One seed per player (global identity)
 * - Multiple certificates per seed (one per device)
 * - Challenge/response for authentication
 * - Enrollment requires human verification
 */

import type { Migration } from './index';

export const MIGRATION_017_TOPOLOGY_AUTH: Migration = {
  version: 17,
  name: '017_topology_auth',
  tables: [
    // ============================================
    // TOPOLOGY SEEDS
    // ============================================
    // One per player - their global identity
    {
      name: 'topology_seeds',
      sql: `
        CREATE TABLE IF NOT EXISTS topology_seeds (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,

          -- Seed data (server stores commitment, not raw seed)
          seed_commitment TEXT NOT NULL,
          zeta_commitment TEXT NOT NULL,

          -- Status
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          revoked_at TEXT,
          revoked_by TEXT,
          revoke_reason TEXT,

          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (revoked_by) REFERENCES users(id)
        )
      `,
    },


    // ============================================
    // TOPOLOGY CERTIFICATES
    // ============================================
    // Multiple per seed - one per device
    {
      name: 'topology_certificates',
      sql: `
        CREATE TABLE IF NOT EXISTS topology_certificates (
          id TEXT PRIMARY KEY,
          seed_id TEXT NOT NULL,

          -- Certificate data
          device_identifier TEXT NOT NULL,
          certificate_hash TEXT NOT NULL UNIQUE,

          -- Enrollment
          enrolled_at TEXT NOT NULL,
          enrolled_by TEXT,
          enrollment_geo TEXT,

          -- Status
          is_active INTEGER DEFAULT 1,
          last_used_at TEXT,
          revoked_at TEXT,

          FOREIGN KEY (seed_id) REFERENCES topology_seeds(id),
          FOREIGN KEY (enrolled_by) REFERENCES users(id),
          UNIQUE(seed_id, device_identifier)
        )
      `,
    },


    // ============================================
    // ENROLLMENT REQUESTS
    // ============================================
    // Pending enrollments waiting for human verification
    {
      name: 'topology_enrollment_requests',
      sql: `
        CREATE TABLE IF NOT EXISTS topology_enrollment_requests (
          id TEXT PRIMARY KEY,

          -- Request data
          requested_user_id TEXT,
          requested_email TEXT,
          requested_display_name TEXT,
          device_identifier TEXT NOT NULL,
          enrollment_geo TEXT,
          enrollment_datetime TEXT NOT NULL,

          -- Vouching (human verification)
          vouched_by TEXT,
          vouched_at TEXT,

          -- Status
          status TEXT DEFAULT 'pending',
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,

          -- For new device on existing seed
          existing_seed_id TEXT,

          -- Result
          result_seed_id TEXT,
          result_certificate_id TEXT,

          FOREIGN KEY (requested_user_id) REFERENCES users(id),
          FOREIGN KEY (vouched_by) REFERENCES users(id),
          FOREIGN KEY (existing_seed_id) REFERENCES topology_seeds(id),
          FOREIGN KEY (result_seed_id) REFERENCES topology_seeds(id),
          FOREIGN KEY (result_certificate_id) REFERENCES topology_certificates(id)
        )
      `,
    },


    // ============================================
    // CHALLENGES
    // ============================================
    // Short-lived challenges for authentication
    {
      name: 'topology_challenges',
      sql: `
        CREATE TABLE IF NOT EXISTS topology_challenges (
          id TEXT PRIMARY KEY,
          seed_id TEXT NOT NULL,
          certificate_id TEXT NOT NULL,

          -- Challenge data
          n INTEGER NOT NULL,
          expected_trajectory TEXT NOT NULL,

          -- Timing
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER DEFAULT 0,
          used_at TEXT,

          FOREIGN KEY (seed_id) REFERENCES topology_seeds(id),
          FOREIGN KEY (certificate_id) REFERENCES topology_certificates(id)
        )
      `,
    },


    // ============================================
    // CHARACTER OWNERSHIP EXTENSION
    // ============================================
    // Bind characters to owner's seed
    {
      name: 'characters_add_owner_seed',
      sql: `ALTER TABLE characters ADD COLUMN owner_seed_id TEXT REFERENCES topology_seeds(id)`,
    },
  ],

  indexes: [
    // Seeds
    'CREATE INDEX IF NOT EXISTS idx_topology_seeds_user ON topology_seeds(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_topology_seeds_active ON topology_seeds(is_active)',

    // Certificates
    'CREATE INDEX IF NOT EXISTS idx_topology_certs_seed ON topology_certificates(seed_id)',
    'CREATE INDEX IF NOT EXISTS idx_topology_certs_hash ON topology_certificates(certificate_hash)',
    'CREATE INDEX IF NOT EXISTS idx_topology_certs_active ON topology_certificates(is_active)',

    // Enrollment requests
    'CREATE INDEX IF NOT EXISTS idx_topology_enrollments_status ON topology_enrollment_requests(status)',
    'CREATE INDEX IF NOT EXISTS idx_topology_enrollments_user ON topology_enrollment_requests(requested_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_topology_enrollments_expires ON topology_enrollment_requests(expires_at)',

    // Challenges
    'CREATE INDEX IF NOT EXISTS idx_topology_challenges_cert ON topology_challenges(certificate_id)',
    'CREATE INDEX IF NOT EXISTS idx_topology_challenges_expires ON topology_challenges(expires_at)',

    // Character ownership
    'CREATE INDEX IF NOT EXISTS idx_characters_owner_seed ON characters(owner_seed_id)',
  ],
};
