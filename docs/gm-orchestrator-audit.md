# GM Orchestrator Module - Implementation Audit Document

## Overview

The GM Orchestrator module manages game master functionality for a TTRPG engine, supporting three distinct play modes with AI-assisted or human-led gameplay. The module enforces that all world mutations flow through validated delta pipelines—the GM acts as "lens + pacing interface, not authority."

---

## Architecture

### Core Principle
The GM (human or AI) proposes scenes and choices, but **all world changes are validated and committed through the canonical delta system**. The GM cannot directly mutate world state.

### Play Modes

| Mode | Description | GM Role |
|------|-------------|---------|
| `PARTY_HUMAN_GM` | Classic TTRPG with human GM | Human proposes scenes, engine validates |
| `PARTY_AI_GM` | AI mediates party play | AI proposes, human can override |
| `SOLO_AI_GM` | Solo "corridor" experience | AI mediates single-player branching narrative |

**Explicitly Rejected**: `SOLO_HUMAN_GM` - Solo play requires AI assistance.

---

## Database Schema

**Migration**: `bend/src/db/migrations/014_gm_module.ts`

### Tables (6 total)

#### 1. `ai_profiles`
Stores AI GM personality configurations.
```
- id, campaign_id, name, description
- style JSON (descriptiveness, combatNarration, challengeLevel, railroading, humor, darkness)
- tone (serious/balanced/lighthearted), pacing (slow/moderate/fast)
- narrative_config JSON (hooksEnabled, themes, intensity)
- voice JSON (voice consistency fingerprint)
- is_system_preset INTEGER
```

#### 2. `gm_sessions`
Active GM session state.
```
- id, campaign_id, party_id
- mode (PARTY_HUMAN_GM/PARTY_AI_GM/SOLO_AI_GM)
- ai_profile_id, human_gm_id
- status (active/paused/ended)
- current_scene_id, context_packet JSON, timeline_cursor JSON
- session_id (links to sessions table)
- active_corridor_id (for SOLO_AI_GM)
- override_count, last_override_at (for PARTY_AI_GM)
```

#### 3. `gm_scenes`
Scene proposals with two-phase commit tracking.
```
- id, gm_session_id, scene_type
- proposed_at, proposed_by, proposal JSON (ScenePlan)
- validation_result JSON, validated_at
- status (proposed/validated/committed/rejected)
- committed_deltas JSON[], committed_at
- player_choice_id, time_advancement JSON
- sequence_order, parent_scene_id
```

#### 4. `scene_choices`
Player choices within scenes.
```
- id, scene_id, label, description
- proposed_deltas JSON[], requirements JSON
- sort_order
- selected, selected_by, selected_at
- speculation_id (for preview via speculative projection)
```

#### 5. `solo_corridors`
Branch-and-merge for solo play.
```
- id, gm_session_id
- parent_campaign_state_version
- rejoin_point JSON (locationId, worldTimestamp, narrativeContext)
- status (active/completed/abandoned/merged)
- merge_resolution JSON, merged_at, merged_by
- corridor_type, estimated_duration
- corridor_deltas JSON[], character_snapshot JSON
```

#### 6. `context_packets`
Truth slices the GM is allowed to know.
```
- id, gm_session_id
- party_state JSON, visible_npcs JSON[], known_quests JSON[]
- revealed_secrets JSON[], current_location JSON, world_state JSON
- exclusions JSON
- computed_at, valid_until, base_version
```

---

## Engine Module Structure

**Directory**: `bend/src/engine/gm/`

| File | Purpose | Key Exports |
|------|---------|-------------|
| `types.ts` | Zod schemas for all GM types | ~40 schemas including GMMode, ContextPacket, ScenePlan, etc. |
| `session.ts` | Session lifecycle management | startGMSession, pauseGMSession, resumeGMSession, endGMSession |
| `context.ts` | Context packet building | buildContextPacket, refreshContextPacket, getContextForAI |
| `validation.ts` | Delta validation against rules | validateSceneDeltas, validateChoiceRequirements |
| `scene.ts` | Scene + two-phase commit | proposeScene, validateScene, commitPlayerChoice |
| `corridor.ts` | Solo corridor branch/merge | startCorridor, completeCorridor, mergeCorridor |
| `ai-gm.ts` | AI scene generation | generateAIScenePlan, buildAIGMIdentity |
| `profiles.ts` | AI profile CRUD | createAIProfile, getAIProfile, updateAIProfile |
| `orchestrator.ts` | Main coordinator class | GMOrchestrator class |
| `index.ts` | Public exports | All public API |

---

## Key Type Definitions

### GMMode
```typescript
export const GMModeSchema = z.enum([
  'PARTY_HUMAN_GM',
  'PARTY_AI_GM', 
  'SOLO_AI_GM'
]);

// SOLO_HUMAN_GM explicitly rejected in validation
```

### Context Packet (Truth Slice)
What the GM is allowed to know:
```typescript
{
  partyState: { members[], partyLevel, partyGold },
  visibleNpcs: { npcId, name, role, disposition, knownInfo[] }[],
  knownQuests: { questId, name, status, currentObjective }[],
  revealedSecrets: string[],
  currentLocation: { locationId, name, description, features[] },
  worldState: { worldDate, weather, timeOfDay, activeEvents[] }
}
```

**Exclusions** (what GM must NOT know):
- Hidden secrets not yet revealed
- Future scheduled events
- Unrolled dice results
- Player private notes
- NPC internal motivations not yet surfaced

### Scene Plan (GM Output)
```typescript
{
  sceneType: CardType,  // combat, social, exploration, etc.
  title: string,
  description: string,
  readAloud?: string,   // Boxed text for players
  choices: {
    id, label, description,
    proposedDeltas: Delta[],  // What this choice would change
    requirements?: { minLevel?, requiredSkill?, dcCheck? }
  }[],
  npcsInvolved: { npcId, name, role }[],
  environmentEffects: { effect, mechanicalImpact }[],
  successConditions?, failureConditions?,
  proposedTimeAdvancement?: WorldTimestamp
}
```

---

## Two-Phase Commit Flow

The system uses the existing `projection.ts` infrastructure for speculative changes.

### Phase 1: Propose
```typescript
// AI or human GM creates ScenePlan with choices
// Each choice contains proposedDeltas
const scene = await proposeScene(sessionId, scenePlan);
// Status: 'proposed'
```

### Phase 2: Validate
```typescript
// For each choice, create speculative projection
const speculation = createSpeculativeProjection(
  currentState,
  baseVersion,
  choice.proposedDeltas
);

// Run through rules engine
const validation = await validateSceneDeltas(campaignId, choice.proposedDeltas);
// Status: 'validated' or 'rejected'
```

### Phase 3: Commit (on player choice)
```typescript
// Player selects a validated choice
const result = await commitPlayerChoice(sceneId, choiceId, playerId);

// Internally:
// 1. Commit via speculative projection → writeDelta()
// 2. Update scene status to 'committed'
// 3. Record committed_deltas
// 4. Advance timeline cursor
// 5. Refresh context packet for next scene
```

---

## Solo Corridor Mode

For `SOLO_AI_GM`: Player branches into a "corridor" that accumulates deltas separately, then merges back.

### Start Corridor
1. Verify session is SOLO_AI_GM mode
2. Snapshot current character state
3. Record parent campaign state version
4. Define rejoin point (location, timestamp, narrative context)
5. Create `solo_corridors` row with status 'active'
6. Subsequent deltas accumulate to `corridor_deltas` (not main sync_log)

### Complete Corridor
1. Mark corridor status as 'completed'
2. Corridor ready for merge

### Merge Corridor
1. Get corridor and accumulated deltas
2. Compare corridor end state with current campaign state
3. Identify conflicts (same entity modified in both)
4. Apply resolution strategy:
   - `CORRIDOR_WINS`: Corridor changes override
   - `CAMPAIGN_WINS`: Discard corridor changes for conflicts
   - `MERGE`: Attempt to combine (may require manual resolution)
5. Write final merged deltas to main timeline via `writeDelta()`
6. Update corridor status to 'merged'

---

## API Endpoints

**Router**: `bend/src/api/routers/gm-orchestrator.ts`

### Session Management
| Endpoint | Input | Output |
|----------|-------|--------|
| `startSession` | campaignId, partyId, mode, aiProfileId? | GMSession |
| `getActiveSession` | campaignId | GMSession \| null |
| `pauseSession` | sessionId | GMSession |
| `resumeSession` | sessionId | GMSession |
| `endSession` | sessionId | GMSession |

### Scene Management
| Endpoint | Input | Output |
|----------|-------|--------|
| `proposeScene` | sessionId, scenePlan | GMScene |
| `validateScene` | sceneId | ValidationResult |
| `commitChoice` | sceneId, choiceId, playerId | CommitResult |
| `overrideScene` | sceneId, overridePlan, gmId | GMScene |

### Corridor Management
| Endpoint | Input | Output |
|----------|-------|--------|
| `startCorridor` | sessionId, corridorType | SoloCorridor |
| `completeCorridor` | corridorId | SoloCorridor |
| `mergeCorridor` | corridorId, resolution | MergeResult |

### AI Profiles
| Endpoint | Input | Output |
|----------|-------|--------|
| `listProfiles` | campaignId | AIProfile[] |
| `createProfile` | profileData | AIProfile |
| `updateProfile` | profileId, updates | AIProfile |
| `deleteProfile` | profileId | void |

### Context
| Endpoint | Input | Output |
|----------|-------|--------|
| `getContextPacket` | sessionId | ContextPacket |
| `refreshContext` | sessionId | ContextPacket |

---

## Integration Points

### Timeline System
- Uses `writeDelta()` from `bend/src/engine/timeline/deltas.ts`
- Uses `createSpeculativeProjection()` / `commitSpeculativeProjection()` from `bend/src/engine/timeline/projection.ts`
- Respects `sync_log` versioning

### Session System
- Links to `sessions` table via `session_id`
- Respects session ownership and permissions

### Intelligence System
- AI scene generation uses agent infrastructure from `bend/src/engine/intelligence/agent.ts`
- Identity anchoring for consistent AI GM personality

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `bend/src/db/migrations/014_gm_module.ts` | ~200 | Database schema |
| `bend/src/engine/gm/types.ts` | ~450 | Type definitions |
| `bend/src/engine/gm/session.ts` | ~180 | Session lifecycle |
| `bend/src/engine/gm/context.ts` | ~200 | Context packet building |
| `bend/src/engine/gm/validation.ts` | ~150 | Delta validation |
| `bend/src/engine/gm/scene.ts` | ~250 | Scene management |
| `bend/src/engine/gm/corridor.ts` | ~200 | Solo corridor management |
| `bend/src/engine/gm/ai-gm.ts` | ~150 | AI scene generation |
| `bend/src/engine/gm/profiles.ts` | ~120 | AI profile CRUD |
| `bend/src/engine/gm/orchestrator.ts` | ~180 | Main coordinator |
| `bend/src/engine/gm/index.ts` | ~50 | Exports |
| `bend/src/api/routers/gm-orchestrator.ts` | ~300 | tRPC endpoints |

## Files Modified

| File | Changes |
|------|---------|
| `bend/src/db/migrations/index.ts` | Added 014_gm_module import |
| `bend/src/api/router.ts` | Added gmOrchestrator router |

---

## Invariants to Audit

1. **No Direct World Mutation**: GM (human or AI) cannot write to world state directly—all changes via validated deltas
2. **Context Packet Exclusions**: Hidden secrets, future events, unrolled dice must never leak into context packet
3. **Two-Phase Commit Required**: All scene outcomes must go through propose → validate → commit
4. **Mode Validation**: SOLO_HUMAN_GM must be explicitly rejected
5. **Corridor Isolation**: Solo corridor deltas must not affect main timeline until merge
6. **Override Tracking**: Human overrides in PARTY_AI_GM must be counted and timestamped
7. **Speculative Projection**: Choice previews must use speculative projection, not direct queries

---

## Questions for Audit

1. Are there any paths where deltas bypass validation?
2. Is the context packet exclusion list complete?
3. Can corridor deltas leak into main timeline before explicit merge?
4. Is the two-phase commit flow correctly using existing projection infrastructure?
5. Are there race conditions in concurrent scene proposals?
6. Should AI profile `voice` fingerprint be more structured?
7. Is the `proposedDeltas` schema flexible enough for all delta types?
