import { z } from 'zod';
import { queryOne } from '../../db/client';
import { WorldTimestampSchema, type WorldTimestamp } from './substrate';

// ============================================
// CANONICAL CURSOR
// ============================================
//
// The cursor is the campaign's position in time.
// It's computed from committed deltas - the highest
// timestamp where all deltas have been applied.
//
// Think of it like a Git HEAD - it points to the
// latest committed state.
//

export const CanonicalCursorSchema = z.object({
  campaignId: z.string().uuid(),

  // The canonical timestamp (world time)
  timestamp: WorldTimestampSchema,

  // The sync sequence number (delta ordering)
  sequence: z.number().int(),

  // When this cursor was computed
  computedAt: z.string(), // ISO timestamp

  // How many deltas contributed
  deltaCount: z.number().int(),
});
export type CanonicalCursor = z.infer<typeof CanonicalCursorSchema>;

/**
 * Get the canonical cursor for a campaign.
 *
 * This represents the "committed" state - all deltas
 * up to this point have been applied and are truth.
 *
 * @param campaignId - The campaign to get cursor for
 * @returns The canonical cursor with timestamp and sequence
 */
export async function getCanonicalCursor(
  campaignId: string
): Promise<CanonicalCursor> {
  // Get the highest committed sequence from sync_log
  const result = await queryOne<{
    max_sequence: number | null;
    delta_count: number;
  }>(
    `SELECT
      MAX(sequence) as max_sequence,
      COUNT(*) as delta_count
    FROM sync_log
    WHERE campaign_id = ?
      AND operation != 'delete'`,
    [campaignId]
  );

  const sequence = result?.max_sequence ?? 0;
  const deltaCount = result?.delta_count ?? 0;

  // Get the campaign's current world time
  const campaign = await queryOne<{
    current_date: string | null;
  }>(
    `SELECT current_date FROM campaigns WHERE id = ?`,
    [campaignId]
  );

  // Parse world timestamp from campaign state
  // Default to day 0, slot 96 (8am) if not set
  let timestamp: WorldTimestamp = { day: 0, slot: 96, turn: 0 };

  if (campaign?.current_date) {
    try {
      const parsed = JSON.parse(campaign.current_date);
      if (parsed.day !== undefined && parsed.slot !== undefined) {
        timestamp = {
          day: parsed.day,
          slot: parsed.slot,
          turn: parsed.turn ?? 0,
        };
      }
    } catch {
      // Keep default if parse fails
    }
  }

  return {
    campaignId,
    timestamp,
    sequence,
    computedAt: new Date().toISOString(),
    deltaCount,
  };
}

/**
 * Get cursor for a specific scope (party, character, etc.)
 *
 * Scopes can lag behind the canonical cursor if they
 * haven't synced recently.
 */
export async function getScopeCursor(
  campaignId: string,
  scopeType: 'party' | 'character' | 'session',
  scopeId: string
): Promise<CanonicalCursor> {
  // Get highest sequence for this specific scope
  const result = await queryOne<{
    max_sequence: number | null;
    delta_count: number;
  }>(
    `SELECT
      MAX(sequence) as max_sequence,
      COUNT(*) as delta_count
    FROM sync_log
    WHERE campaign_id = ?
      AND entity_type = ?
      AND entity_id = ?`,
    [campaignId, scopeType, scopeId]
  );

  const sequence = result?.max_sequence ?? 0;
  const deltaCount = result?.delta_count ?? 0;

  // For scope cursor, we still use campaign time as reference
  const canonicalCursor = await getCanonicalCursor(campaignId);

  return {
    campaignId,
    timestamp: canonicalCursor.timestamp,
    sequence,
    computedAt: new Date().toISOString(),
    deltaCount,
  };
}

/**
 * Check if a cursor is behind another.
 */
export function isCursorBehind(
  cursor: CanonicalCursor,
  target: CanonicalCursor
): boolean {
  return cursor.sequence < target.sequence;
}

/**
 * Calculate lag between cursors (in delta count).
 */
export function cursorLag(
  cursor: CanonicalCursor,
  target: CanonicalCursor
): number {
  return Math.max(0, target.sequence - cursor.sequence);
}
