# Memory Topology Implementation Plan

## Overview

This document outlines the implementation plan for integrating the memory topology system into the TTRPG engine. The core insight: **memory is topology, not content**. NPCs remember through graph structure (nodes + edges + gravity weights), not raw storage.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     NPC MEMORY SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   MEMORY GRAPH      │    │        LEDGER               │ │
│  │   (Lossy Topology)  │    │    (Lossless RAG)           │ │
│  │                     │    │                             │ │
│  │  Nodes ──Edges──►   │    │  • Promises made            │ │
│  │    │      │         │    │  • Secrets learned          │ │
│  │    ▼      ▼         │    │  • Debts owed/owing         │ │
│  │  gravity  weight    │    │  • Threats identified       │ │
│  │  salience valence   │    │  • Critical facts           │ │
│  │                     │    │                             │ │
│  │  Compressed via     │    │  Retrieved via triggers     │ │
│  │  SNR-based passes   │    │  when context matches       │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              WORLD GRAPH OVERLAY                         ││
│  │  NPC's perspective on canonical world graph              ││
│  │  • Known nodes (fog of war)                              ││
│  │  • Attitude overrides (opinions of places/people)        ││
│  │  • Familiarity levels                                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. SNR-Based Compression Depth
```
SNR < 100    → Store raw (not worth compressing)
SNR 100-400  → 1 compression pass
SNR 400-800  → 2 compression passes  
SNR 800+     → 3 compression passes (dense, important content)
```

### 2. Dual System: Graph + Ledger
- **Graph**: Lossy, topology-preserved, compressed memories
- **Ledger**: Lossless, RAG-retrieved critical facts

### 3. φ (Phi) Constants
- `0.382` = intent tax (noise floor)
- `0.618` = density threshold
- `1.618` = phi itself
- `2.618` = max compression passes

---

## Files to Modify

### 1. `bend/src/middleware/memory.ts` (NEW FILE)

**Purpose**: Zod schemas for memory topology

**Contents**:
- `MemoryNodeSchema` - nodes in memory graph
- `MemoryEdgeSchema` - edges with type, direction, valence
- `MemoryGraphSchema` - complete topology
- `LedgerEntrySchema` - lossless facts
- `NPCMemorySchema` - combined system
- `ContradictionSchema` - conflicting beliefs
- Helper functions: `getCompressionDepth()`, `phiDecay()`, `shouldPromoteToLedger()`

**Key Types**:
```typescript
MemoryModality: "episodic" | "semantic" | "procedural" | "emotional" | "sensory"

MemoryEdgeType: 
  // Temporal
  "PRECEDES" | "CAUSES" | "ENABLES"
  // Semantic  
  "RELATES_TO" | "CONTRADICTS" | "SUPPORTS" | "REFINES" | "ABSTRACTS"
  // Emotional
  "EVOKES" | "REMINDS_OF"
  // Entity
  "INVOLVES" | "ABOUT" | "LOCATED_AT"

LedgerCategory: "promise" | "secret" | "debt" | "threat" | "fact" | "instruction" | "observation"
```

---

### 2. `bend/src/middleware/aggregates.ts`

**Changes**:
- Import memory schemas
- Update `NPCEncounterAggregate.partyRelation` to include:
  - `memoryGraph`: optional topology
  - `ledger`: array of ledger entries
  - Keep legacy `memories` for backward compat (deprecate later)

**Before**:
```typescript
partyRelation: z.object({
  hasMetBefore: z.boolean(),
  attitude: z.number().int(),
  disposition: z.string(),
  memories: z.array(...).default([]),  // Simple array
  memberOpinions: z.array(...).default([]),
})
```

**After**:
```typescript
partyRelation: z.object({
  hasMetBefore: z.boolean(),
  attitude: z.number().int(),
  disposition: z.string(),
  
  // NEW: Memory topology
  memoryGraph: z.object({
    nodes: z.array(MemoryNodeSchema),
    edges: z.array(MemoryEdgeSchema),
    meta: MemoryGraphMetaSchema.optional(),
  }).optional(),
  
  // NEW: Lossless ledger
  ledger: z.array(LedgerEntrySchema).default([]),
  
  // LEGACY: Keep for migration
  memories: z.array(...).default([]),
  memberOpinions: z.array(...).default([]),
})
```

---

### 3. `bend/src/db/migrations.ts`

**New Tables**:

```sql
-- Main graph container (one per agent)
memory_graphs (
  id, agent_id, npc_id,
  snr, compression_passes, loss_vector,
  node_count, edge_count, cluster_count,
  oldest_memory, newest_memory,
  version, last_compressed, last_accessed,
  created_at, updated_at
)

-- Memory nodes
memory_nodes (
  id, graph_id,
  content, content_hash,
  gravity, salience, confidence,
  modality, sequence, timestamp,
  strength, last_accessed,
  source_type, source_id,
  embedding,  -- BLOB for vector search
  created_at
)

-- Memory edges
memory_edges (
  id, graph_id,
  source_id, target_id,
  type, direction,
  weight, valence, reverse_weight,
  sequence, strength,
  created_at
)

-- Contradiction tracking
memory_contradictions (
  id, graph_id,
  node_a, node_b,
  resolved, resolved_to, strategy,
  detected_at, resolved_at
)

-- Lossless ledger
memory_ledger (
  id, graph_id,
  content, summary,
  category, importance, trigger_threshold,
  linked_nodes, triggers, trigger_entities,
  source_type, source_entity, source_date,
  is_active, expires_at,
  access_count, last_accessed,
  created_at
)

-- NPC world overlay (perspective on world graph)
npc_world_overlay (
  id, npc_id, graph_id,
  node_overrides,  -- JSON: attitude, familiarity per node
  known_edges, known_nodes,  -- Fog of war
  relationship_cache,
  stats,
  version, created_at, updated_at
)
```

**New Indexes**:
- `idx_memory_graphs_agent` on `memory_graphs(agent_id)`
- `idx_memory_nodes_graph` on `memory_nodes(graph_id)`
- `idx_memory_nodes_gravity` on `memory_nodes(gravity)`
- `idx_memory_edges_graph` on `memory_edges(graph_id)`
- `idx_memory_edges_type` on `memory_edges(type)`
- `idx_memory_ledger_category` on `memory_ledger(category)`
- `idx_memory_ledger_importance` on `memory_ledger(importance)`

---

### 4. `bend/src/db/queries/memory.ts` (NEW FILE)

**Purpose**: CRUD operations for memory topology

**Functions**:
```typescript
// Graph operations
createMemoryGraph(agentId, npcId?)
getMemoryGraph(graphId)
getMemoryGraphByAgent(agentId)

// Node operations  
addMemoryNode(graphId, input)
getMemoryNodes(graphId, filters?)
updateNodeGravity(nodeId, gravity)
decayNodes(graphId, halfLife)

// Edge operations
addMemoryEdge(graphId, sourceId, targetId, type, weight)
getMemoryEdges(graphId, filters?)
getConnectedNodes(nodeId)

// Ledger operations
addLedgerEntry(graphId, entry)
getLedgerEntries(graphId, filters?)
triggerLedgerSearch(graphId, context)

// Query operations
queryMemories(graphId, query)  // Semantic search
getRelevantMemories(graphId, context)  // For AI context building

// Compression
compressGraph(graphId)  // Run compression pass
getCompressionStats(graphId)
```

---

### 5. `bend/src/ai/context.ts`

**Changes**:
- Add method to load memory topology into NPC context
- Update `ContextBuilder` with memory graph loading

**New Methods**:
```typescript
class ContextBuilder {
  // Existing methods...
  
  async loadMemoryGraph(agentId: string): Promise<this>
  async loadRelevantMemories(query: string, limit?: number): Promise<this>
  async loadLedgerEntries(triggers?: string[]): Promise<this>
  
  buildMemoryContext(): string  // Format memories for prompt
}
```

---

### 6. `bend/src/ai/npc.ts`

**Changes**:
- Update NPCAI class to use memory topology
- Add memory formation after interactions
- Add ledger evaluation for important facts

**New Methods**:
```typescript
class NPCAI {
  // Existing methods...
  
  async formMemory(interaction: Interaction): Promise<void>
  async evaluateForLedger(content: string): Promise<boolean>
  async resolveContradiction(nodeA: string, nodeB: string): Promise<void>
}
```

---

### 7. `bend/src/engine/compression.ts` (NEW FILE)

**Purpose**: Double-layer compression algorithm

**Functions**:
```typescript
// SNR calculation
calculateSNR(content: string): number

// Compression passes
compressPass(graph: MemoryGraph, passNumber: number): CompressionResult

// Full compression (SNR-adaptive)
compress(graph: MemoryGraph): CompressionResult

// Spectral clustering for node merging
clusterNodes(nodes: MemoryNode[], edges: MemoryEdge[]): Cluster[]

// Loss tracking
calculateLossVector(before: MemoryGraph, after: MemoryGraph): number[]
```

**Algorithm**:
```
Layer 1: Prune while counting
  - Remove low-gravity nodes below threshold
  - Track entropy lost in loss_vector
  
Layer 2: Compress with spectral clustering
  - Group related nodes into clusters
  - Merge clusters into summary nodes
  - Preserve edge topology
  - Adaptive depth based on loss_vector
```

---

## Stack Additions

### Required: None
The current stack (Turso/SQLite, Zod, tRPC) supports everything needed:
- Turso supports BLOB columns for embeddings
- SQLite JSON functions for flexible data
- Existing graph structure in world_edges pattern

### Optional Enhancements

1. **Vector Search** (if needed for semantic memory queries)
   - Option A: Use Turso's vector extension (if available)
   - Option B: External service (Pinecone, Qdrant)
   - Option C: In-memory with `ml-distance` package
   
2. **Embedding Generation**
   - Already have AI integration
   - Can use same provider for embeddings
   - Alternative: `@xenova/transformers` for local embeddings

---

## Migration Strategy

### Phase 1: Schema Addition
1. Add new tables (non-breaking)
2. Add new Zod schemas
3. Keep legacy `memories` array functional

### Phase 2: Dual-Write
1. Write to both old and new systems
2. Read from new system with fallback
3. Background migration of existing data

### Phase 3: Cutover
1. Switch reads to new system only
2. Deprecate legacy `memories` field
3. Remove dual-write

---

## Integration Points

### Where Memory Forms
1. **After NPC dialogue** (`generateDialogue` in `npc.ts`)
2. **After NPC actions** (`generateAction` in `npc.ts`)
3. **After session events** (session_events table)
4. **GM-injected memories** (direct ledger entries)

### Where Memory Retrieved
1. **Context building** (`context.ts` → `buildSystemPrompt`)
2. **Dialogue generation** (before AI call)
3. **Decision making** (NPC action selection)
4. **Relationship checks** (attitude/disposition)

### Where Compression Runs
1. **End of session** (batch compression)
2. **Memory threshold** (when node count exceeds limit)
3. **Manual trigger** (GM command)

---

## World Graph Overlay Design

Each NPC has a perspective overlay on the canonical world graph:

```typescript
WorldOverlay {
  // What the NPC knows exists
  knownNodes: Set<NodeId>
  
  // What connections the NPC knows about
  knownEdges: Set<EdgeId>
  
  // NPC's opinions/attitudes about nodes
  nodeOverrides: Map<NodeId, {
    attitude: number      // -1 to 1
    familiarity: number   // 0 to 1
    notes: string         // Personal observations
  }>
}
```

**Key principle**: NPC can only reference knowledge within their overlay. Bounded consciousness.

---

## Open Questions

1. **Embedding model**: Use API embeddings or local?
2. **Compression frequency**: Per-session or threshold-based?
3. **Contradiction resolution**: Auto-resolve or require GM input?
4. **Ledger size limits**: Hard cap or soft cap with archiving?

---

## Implementation Order

1. `memory.ts` - Zod schemas (foundation)
2. `migrations.ts` - Database tables
3. `queries/memory.ts` - CRUD operations
4. `compression.ts` - Compression algorithm
5. `context.ts` - Context builder updates
6. `npc.ts` - NPC AI integration
7. `aggregates.ts` - Aggregate updates
8. Migration script for existing data

---

## Success Criteria

- [ ] NPCs maintain coherent memory across sessions
- [ ] Memory compression reduces storage by 60%+ without losing topology
- [ ] Ledger entries surface correctly when triggered
- [ ] Contradictions are detected and tracked
- [ ] World overlay limits NPC knowledge appropriately
- [ ] Compression is SNR-adaptive (dense content gets more passes)
