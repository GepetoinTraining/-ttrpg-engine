import { queryOne } from '../../db/client';
import {
  type ProposedDelta,
  type ValidationResult,
} from './types';

// ============================================
// DELTA VALIDATION
// ============================================
//
// Validates proposed deltas against engine rules before commit.
// This ensures the GM (human or AI) cannot bypass the engine's
// canonical pathways.
//
// The GM is "lens + pacing interface, not authority" - all changes
// must be validated.
//
// INVARIANT: NPCs are NOT a separate entity type. NPCs are characters
// with is_npc = true. All NPC mutations go through character validation
// with NPC-specific constraints applied when the flag is set.
//

/**
 * Validate a set of proposed deltas against engine rules.
 * Returns validation result with any errors or warnings.
 */
export async function validateDeltas(
  campaignId: string,
  deltas: ProposedDelta[],
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const delta of deltas) {
    const result = await validateSingleDelta(campaignId, delta);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single proposed delta.
 */
async function validateSingleDelta(
  campaignId: string,
  delta: ProposedDelta,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. For updates/deletes, verify entity exists
  if (delta.operation === 'update' || delta.operation === 'delete') {
    const exists = await entityExists(delta.entityType, delta.entityId);
    if (!exists) {
      errors.push(`Entity not found: ${delta.entityType}:${delta.entityId}`);
      return { valid: false, errors, warnings };
    }
  }

  // 2. Validate based on entity type
  // INVARIANT: No 'npc' entity type - NPCs are characters with is_npc = true
  switch (delta.entityType) {
    case 'character':
      // Character validation handles both PCs and NPCs (via is_npc flag)
      await validateCharacterDelta(campaignId, delta, errors, warnings);
      break;

    case 'item':
      validateItemDelta(delta, errors, warnings);
      break;

    case 'location':
      validateLocationDelta(delta, errors, warnings);
      break;

    case 'quest':
      validateQuestDelta(delta, errors, warnings);
      break;

    case 'condition':
      validateConditionDelta(delta, errors, warnings);
      break;

    case 'npc':
      // REJECTED: NPC is not a valid entity type
      // NPCs must be created/updated as characters with is_npc = true
      errors.push(
        'Entity type "npc" is not valid. NPCs must be created as characters with is_npc = true. ' +
        'Use entityType: "character" with delta: { is_npc: true, ... }',
      );
      break;

    default:
      // Allow unknown entity types but warn
      warnings.push(`Unknown entity type: ${delta.entityType}`);
  }

  // 3. Check for dangerous operations
  if (delta.operation === 'delete') {
    warnings.push(`Delete operation on ${delta.entityType}:${delta.entityId} - ensure this is intentional`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// ENTITY-SPECIFIC VALIDATION
// ============================================

/**
 * Validate character delta - handles both PCs and NPCs.
 * INVARIANT: NPCs are characters with is_npc = true, not a separate entity.
 */
async function validateCharacterDelta(
  _campaignId: string,
  delta: ProposedDelta,
  errors: string[],
  warnings: string[],
): Promise<void> {
  const data = delta.delta;

  // Determine if this is an NPC (either from delta or existing record)
  let isNpc = data.is_npc === true;
  if (!isNpc && delta.operation === 'update') {
    // Check if the existing character is an NPC
    const existing = await queryOne<{ is_npc: number }>(
      `SELECT is_npc FROM characters WHERE id = ?`,
      [delta.entityId],
    );
    isNpc = existing?.is_npc === 1;
  }

  // === COMMON VALIDATION (applies to both PCs and NPCs) ===

  // HP cannot exceed max
  if (data.hp_current !== undefined && data.hp_max !== undefined) {
    if (data.hp_current > data.hp_max) {
      errors.push('HP current cannot exceed HP max');
    }
  }

  // HP cannot be negative (unless death save rules)
  if (data.hp_current !== undefined && data.hp_current < -10) {
    warnings.push('HP is significantly negative - character may be dead');
  }

  // Level must be valid
  if (data.level !== undefined) {
    if (data.level < 1 || data.level > 20) {
      errors.push('Character level must be between 1 and 20');
    }
  }

  // AC must be reasonable
  if (data.ac !== undefined) {
    if (data.ac < 0) {
      errors.push('AC cannot be negative');
    }
    if (data.ac > 30) {
      warnings.push('AC is unusually high (>30)');
    }
  }

  // Gold/currency cannot be negative
  if (data.gold !== undefined && data.gold < 0) {
    errors.push('Gold cannot be negative');
  }

  // === NPC-SPECIFIC VALIDATION ===
  if (isNpc) {
    // Disposition must be valid (NPC-only field)
    if (data.disposition !== undefined) {
      const validDispositions = ['hostile', 'unfriendly', 'neutral', 'friendly', 'allied'];
      if (!validDispositions.includes(data.disposition)) {
        warnings.push(`Unknown disposition: ${data.disposition}`);
      }
    }

    // NPCs should have a role
    if (delta.operation === 'create' && !data.role) {
      warnings.push('NPC should have a role defined');
    }
  }

  // === PC-SPECIFIC VALIDATION ===
  if (!isNpc) {
    // PCs should not have disposition (that's for NPCs)
    if (data.disposition !== undefined) {
      warnings.push('Disposition is typically used for NPCs, not player characters');
    }

    // PCs must have a player_id on create
    if (delta.operation === 'create' && !data.player_id) {
      warnings.push('Player character should have a player_id');
    }
  }
}

function validateItemDelta(
  delta: ProposedDelta,
  errors: string[],
  _warnings: string[],
): void {
  const data = delta.delta;

  // Quantity cannot be negative
  if (data.quantity !== undefined && data.quantity < 0) {
    errors.push('Item quantity cannot be negative');
  }

  // Value cannot be negative
  if (data.value !== undefined && data.value < 0) {
    errors.push('Item value cannot be negative');
  }
}

function validateLocationDelta(
  delta: ProposedDelta,
  errors: string[],
  _warnings: string[],
): void {
  const data = delta.delta;

  // Name is required for create
  if (delta.operation === 'create' && !data.name) {
    errors.push('Location name is required');
  }
}

function validateQuestDelta(
  delta: ProposedDelta,
  errors: string[],
  warnings: string[],
): void {
  const data = delta.delta;

  // Status transitions
  if (data.status !== undefined) {
    const validStatuses = ['unknown', 'revealed', 'active', 'completed', 'failed', 'abandoned'];
    if (!validStatuses.includes(data.status)) {
      errors.push(`Invalid quest status: ${data.status}`);
    }
  }

  // XP reward cannot be negative
  if (data.xp_reward !== undefined && data.xp_reward < 0) {
    warnings.push('XP reward is negative');
  }
}

function validateConditionDelta(
  delta: ProposedDelta,
  errors: string[],
  _warnings: string[],
): void {
  const data = delta.delta;

  // Name is required
  if (delta.operation === 'create' && !data.name) {
    errors.push('Condition name is required');
  }

  // Duration cannot be negative
  if (data.duration !== undefined && data.duration < 0) {
    errors.push('Condition duration cannot be negative');
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if an entity exists in the database.
 * INVARIANT: No 'npc' table - NPCs are in 'characters' with is_npc = 1
 */
async function entityExists(
  entityType: string,
  entityId: string,
): Promise<boolean> {
  // Map entity types to tables
  // INVARIANT: No 'npc' mapping - NPCs are characters with is_npc = true
  const tableMap: Record<string, string> = {
    character: 'characters',
    // 'npc' is NOT a valid entity type - use 'character' with is_npc = true
    item: 'items',
    location: 'locations',
    quest: 'quests',
    condition: 'conditions',
    faction: 'factions',
    party: 'parties',
    campaign: 'campaigns',
  };

  const table = tableMap[entityType];
  if (!table) {
    // Unknown entity type - assume it exists (may be in a different system)
    return true;
  }

  try {
    const result = await queryOne<{ id: string }>(
      `SELECT id FROM ${table} WHERE id = ?`,
      [entityId],
    );
    return result !== null;
  } catch {
    // Table might not exist - allow operation
    return true;
  }
}

/**
 * Check if a delta would create a conflict with existing state.
 */
export async function checkForConflicts(
  _campaignId: string,
  deltas: ProposedDelta[],
): Promise<string[]> {
  const conflicts: string[] = [];

  // Check for duplicate creates
  const creates = deltas.filter(d => d.operation === 'create');
  const createIds = creates.map(d => `${d.entityType}:${d.entityId}`);
  const duplicates = createIds.filter((id, index) => createIds.indexOf(id) !== index);

  if (duplicates.length > 0) {
    conflicts.push(`Duplicate creates: ${duplicates.join(', ')}`);
  }

  // Check for update-after-delete
  deltas
    .filter(d => d.operation === 'delete')
    .map(d => `${d.entityType}:${d.entityId}`);

  const updateAfterDelete = deltas.filter(d => {
    if (d.operation !== 'update') return false;
    const id = `${d.entityType}:${d.entityId}`;
    const deleteIndex = deltas.findIndex(
      del => del.operation === 'delete' && `${del.entityType}:${del.entityId}` === id,
    );
    const updateIndex = deltas.indexOf(d);
    return deleteIndex >= 0 && deleteIndex < updateIndex;
  });

  if (updateAfterDelete.length > 0) {
    conflicts.push(`Updates after deletes: ${updateAfterDelete.map(d => `${d.entityType}:${d.entityId}`).join(', ')}`);
  }

  return conflicts;
}

/**
 * Validate that all required fields are present for a create operation.
 */
export function validateRequiredFields(
  delta: ProposedDelta,
): string[] {
  const errors: string[] = [];

  if (delta.operation !== 'create') {
    return errors;
  }

  // INVARIANT: No 'npc' entry - NPCs are characters with is_npc = true
  const requiredFields: Record<string, string[]> = {
    character: ['name'],  // Both PCs and NPCs require name
    // 'npc' is NOT a valid entity type
    item: ['name'],
    location: ['name'],
    quest: ['name'],
    condition: ['name', 'characterId'],
  };

  const required = requiredFields[delta.entityType];
  if (!required) {
    return errors;
  }

  for (const field of required) {
    if (delta.delta[field] === undefined || delta.delta[field] === null || delta.delta[field] === '') {
      errors.push(`Missing required field '${field}' for ${delta.entityType} create`);
    }
  }

  return errors;
}
