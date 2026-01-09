import { z } from 'zod';
import type { Delta } from './deltas';
import type { WorldTimestamp } from './substrate';
import { compareTimestamps } from './substrate';

// ============================================
// STATE PROJECTION
// ============================================
//
// Projection takes a base state and applies deltas
// to compute a new state. This is the core of
// time-travel and speculative execution.
//
// Think of it like Git rebase - you replay changes
// on top of a base to get a new result.
//

export const ProjectionResultSchema = z.object({
  // The projected state
  state: z.record(z.string(), z.any()),

  // Deltas that were applied
  appliedDeltas: z.array(z.string()), // Delta IDs

  // Deltas that were skipped (filtered out)
  skippedDeltas: z.array(z.string()),

  // Any derived deltas generated during projection
  derivedDeltas: z.array(z.object({
    entityType: z.string(),
    entityId: z.string(),
    operation: z.enum(['create', 'update', 'delete']),
    delta: z.record(z.string(), z.any()),
    reason: z.string(),
  })),

  // Final version after projection
  finalVersion: z.number().int(),

  // Final timestamp
  finalTimestamp: z.object({
    day: z.number().int(),
    slot: z.number().int(),
    turn: z.number().int(),
  }).optional(),

  // Projection metadata
  projectionId: z.string().uuid(),
  computedAt: z.string(),
});
export type ProjectionResult = z.infer<typeof ProjectionResultSchema>;

export interface ProjectionOptions {
  // Stop at this timestamp (for time-bounded projection)
  untilTimestamp?: WorldTimestamp;

  // Stop at this version
  untilVersion?: number;

  // Filter which entity types to project
  entityTypes?: string[];

  // Filter which entities to project
  entityIds?: string[];

  // Generate derived deltas (e.g., HP change triggers "bloodied" status)
  generateDerived?: boolean;

  // Conflict resolution strategy
  conflictStrategy?: 'last_wins' | 'first_wins' | 'merge';

  // Validation function - return false to skip delta
  validate?: (delta: Delta, currentState: Record<string, any>) => boolean;

  // Transformation function - modify delta before applying
  transform?: (delta: Delta, currentState: Record<string, any>) => Delta;
}

/**
 * Project deltas onto a scope state to compute new state.
 *
 * @param scopeState - The base state to project onto
 * @param deltas - The deltas to apply (must be ordered by version)
 * @param options - Projection options
 * @returns The projection result with new state and metadata
 */
export function project(
  scopeState: Record<string, any>,
  deltas: Delta[],
  options: ProjectionOptions = {}
): ProjectionResult {
  const projectionId = crypto.randomUUID();
  const appliedDeltas: string[] = [];
  const skippedDeltas: string[] = [];
  const derivedDeltas: ProjectionResult['derivedDeltas'] = [];

  // Clone state to avoid mutation
  let state = deepClone(scopeState);
  let finalVersion = 0;
  let finalTimestamp: WorldTimestamp | undefined;

  for (const delta of deltas) {
    // Check version cutoff
    if (options.untilVersion !== undefined && delta.version > options.untilVersion) {
      skippedDeltas.push(delta.id);
      continue;
    }

    // Check timestamp cutoff
    if (options.untilTimestamp && delta.worldTimestamp) {
      if (compareTimestamps(delta.worldTimestamp, options.untilTimestamp) > 0) {
        skippedDeltas.push(delta.id);
        continue;
      }
    }

    // Check entity type filter
    if (options.entityTypes?.length && !options.entityTypes.includes(delta.entityType)) {
      skippedDeltas.push(delta.id);
      continue;
    }

    // Check entity ID filter
    if (options.entityIds?.length && !options.entityIds.includes(delta.entityId)) {
      skippedDeltas.push(delta.id);
      continue;
    }

    // Custom validation
    if (options.validate && !options.validate(delta, state)) {
      skippedDeltas.push(delta.id);
      continue;
    }

    // Transform delta if needed
    const finalDelta = options.transform ? options.transform(delta, state) : delta;

    // Apply the delta
    const beforeState = options.generateDerived ? deepClone(state) : null;
    state = applyDelta(state, finalDelta, options.conflictStrategy);
    appliedDeltas.push(delta.id);
    finalVersion = delta.version;

    if (delta.worldTimestamp) {
      finalTimestamp = delta.worldTimestamp;
    }

    // Generate derived deltas if enabled
    if (options.generateDerived && beforeState) {
      const derived = generateDerivedDeltas(beforeState, state, finalDelta);
      derivedDeltas.push(...derived);
    }
  }

  return {
    state,
    appliedDeltas,
    skippedDeltas,
    derivedDeltas,
    finalVersion,
    finalTimestamp,
    projectionId,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Apply a single delta to state.
 */
function applyDelta(
  state: Record<string, any>,
  delta: Delta,
  conflictStrategy: ProjectionOptions['conflictStrategy'] = 'last_wins'
): Record<string, any> {
  const key = `${delta.entityType}:${delta.entityId}`;

  switch (delta.operation) {
    case 'create':
      // Create new entity
      state[key] = {
        _entityType: delta.entityType,
        _entityId: delta.entityId,
        _version: delta.version,
        ...delta.delta,
      };
      break;

    case 'update':
      // Update existing entity
      if (!state[key]) {
        // Entity doesn't exist, create it
        state[key] = {
          _entityType: delta.entityType,
          _entityId: delta.entityId,
          _version: delta.version,
          ...delta.delta,
        };
      } else {
        // Merge based on strategy
        if (conflictStrategy === 'first_wins') {
          // Only apply fields that don't exist
          for (const [field, value] of Object.entries(delta.delta)) {
            if (state[key][field] === undefined) {
              state[key][field] = value;
            }
          }
        } else if (conflictStrategy === 'merge') {
          // Deep merge
          state[key] = deepMerge(state[key], delta.delta);
        } else {
          // last_wins - shallow merge (default)
          state[key] = {
            ...state[key],
            ...delta.delta,
            _version: delta.version,
          };
        }
      }
      break;

    case 'delete':
      // Mark as deleted (soft delete)
      if (state[key]) {
        state[key]._deleted = true;
        state[key]._deletedAt = delta.timestamp;
        state[key]._version = delta.version;
      }
      break;
  }

  return state;
}

/**
 * Generate derived deltas based on state changes.
 *
 * These are side-effects that should happen when state changes.
 * For example:
 *   - HP drops below 50% → add "bloodied" condition
 *   - HP drops to 0 → add "unconscious" condition
 *   - Inventory weight exceeds capacity → add "encumbered"
 */
function generateDerivedDeltas(
  beforeState: Record<string, any>,
  afterState: Record<string, any>,
  causeDelta: Delta
): ProjectionResult['derivedDeltas'] {
  const derived: ProjectionResult['derivedDeltas'] = [];

  // Only process character updates for now
  if (causeDelta.entityType !== 'character') {
    return derived;
  }

  const key = `${causeDelta.entityType}:${causeDelta.entityId}`;
  const before = beforeState[key];
  const after = afterState[key];

  if (!before || !after) return derived;

  // Check HP changes
  if (causeDelta.delta.hp_current !== undefined || causeDelta.delta.hpCurrent !== undefined) {
    const hpBefore = before.hp_current ?? before.hpCurrent ?? 0;
    const hpAfter = after.hp_current ?? after.hpCurrent ?? 0;
    const maxHp = after.hp_max ?? after.hpMax ?? after.maxHp ?? 10;
    const halfHp = Math.floor(maxHp / 2);

    // Crossed bloodied threshold
    if (hpBefore > halfHp && hpAfter <= halfHp && hpAfter > 0) {
      derived.push({
        entityType: 'condition',
        entityId: `${causeDelta.entityId}:bloodied`,
        operation: 'create',
        delta: {
          characterId: causeDelta.entityId,
          name: 'Bloodied',
          source: 'system',
          description: 'HP is below 50%',
        },
        reason: 'HP dropped below 50%',
      });
    }

    // Recovered from bloodied
    if (hpBefore <= halfHp && hpAfter > halfHp) {
      derived.push({
        entityType: 'condition',
        entityId: `${causeDelta.entityId}:bloodied`,
        operation: 'delete',
        delta: {},
        reason: 'HP recovered above 50%',
      });
    }

    // Dropped to 0 HP
    if (hpBefore > 0 && hpAfter <= 0) {
      derived.push({
        entityType: 'condition',
        entityId: `${causeDelta.entityId}:unconscious`,
        operation: 'create',
        delta: {
          characterId: causeDelta.entityId,
          name: 'Unconscious',
          source: 'system',
          description: 'HP reduced to 0',
        },
        reason: 'HP dropped to 0',
      });
    }

    // Recovered from 0 HP
    if (hpBefore <= 0 && hpAfter > 0) {
      derived.push({
        entityType: 'condition',
        entityId: `${causeDelta.entityId}:unconscious`,
        operation: 'delete',
        delta: {},
        reason: 'HP recovered above 0',
      });
    }
  }

  return derived;
}

/**
 * Deep clone an object.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge two objects.
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// ============================================
// SPECULATIVE PROJECTION
// ============================================
//
// For "what-if" scenarios - project without committing.
//

export interface SpeculativeProjection {
  id: string;
  baseVersion: number;
  speculativeDeltas: Delta[];
  projectedState: Record<string, any>;
  derivedDeltas: ProjectionResult['derivedDeltas'];
  createdAt: string;
  expiresAt: string;
}

/**
 * Create a speculative projection for previewing changes.
 */
export function createSpeculativeProjection(
  baseState: Record<string, any>,
  baseVersion: number,
  speculativeDeltas: Delta[],
  ttlMinutes: number = 30
): SpeculativeProjection {
  const result = project(baseState, speculativeDeltas, {
    generateDerived: true,
  });

  const now = new Date();
  const expires = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  return {
    id: result.projectionId,
    baseVersion,
    speculativeDeltas,
    projectedState: result.state,
    derivedDeltas: result.derivedDeltas,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

/**
 * Commit a speculative projection by writing its deltas.
 */
export async function commitSpeculativeProjection(
  projection: SpeculativeProjection,
  writeDelta: (delta: Omit<Delta, 'id' | 'version'>) => Promise<Delta>
): Promise<Delta[]> {
  const committedDeltas: Delta[] = [];

  // Write all speculative deltas
  for (const delta of projection.speculativeDeltas) {
    const committed = await writeDelta({
      campaignId: delta.campaignId,
      sessionId: delta.sessionId,
      entityType: delta.entityType,
      entityId: delta.entityId,
      operation: delta.operation,
      delta: delta.delta,
      actorId: delta.actorId,
      actorType: delta.actorType,
      timestamp: new Date().toISOString(),
      worldTimestamp: delta.worldTimestamp,
    });
    committedDeltas.push(committed);
  }

  // Write derived deltas
  for (const derived of projection.derivedDeltas) {
    const committed = await writeDelta({
      campaignId: projection.speculativeDeltas[0]?.campaignId ?? '',
      entityType: derived.entityType,
      entityId: derived.entityId,
      operation: derived.operation,
      delta: derived.delta,
      actorType: 'system',
      timestamp: new Date().toISOString(),
    });
    committedDeltas.push(committed);
  }

  return committedDeltas;
}
