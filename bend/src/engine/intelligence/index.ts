// ============================================
// INTELLIGENCE LAYER
// ============================================
//
// The AI SOUL of the engine.
//
// This layer defines:
//   - WHO each AI agent is (Identity Anchoring)
//   - WHAT each agent knows (Knowledge Boundaries)
//   - HOW each agent remembers (Memory Protocol)
//   - HOW each agent speaks (Voice Consistency)
//   - HOW context is assembled (Context Protocol)
//   - HOW agents coordinate (Orchestration)
//
// This is the SEMANTIC TRANSFER PROTOCOL for TTRPGs.
//

export * from "./agent";

// ============================================
// THE GROUNDING PROBLEM
// ============================================
//
// AI has no persistent identity.
// Every context window is a blank slate.
// How do we maintain consistent characters?
//
// SOLUTION: Identity Anchoring
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                         IDENTITY ANCHOR                                 │
//  │                                                                         │
//  │  "You are Aldric, a weathered blacksmith in his fifties who has        │
//  │   worked the same forge for thirty years. You are gruff but kind,      │
//  │   suspicious of magic but fascinated by fine metalwork. Your           │
//  │   greatest fear is losing the forge to the debt you owe."              │
//  │                                                                         │
//  │  This is injected FIRST in every context window.                       │
//  │  It GROUNDS the AI in its role before any interaction.                 │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// THE OMNISCIENCE PROBLEM
// ============================================
//
// AI knows everything in its training.
// An NPC shouldn't know player HP.
// A village blacksmith shouldn't know arcane lore.
//
// SOLUTION: Knowledge Boundaries
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                       KNOWLEDGE BOUNDARY                                │
//  │                                                                         │
//  │  KNOWS:                          DOES NOT KNOW:                        │
//  │  ├── Their own backstory         ├── Player stats/inventory           │
//  │  ├── Their relationships         ├── Other faction secrets            │
//  │  ├── Local gossip/rumors         ├── Private conversations            │
//  │  ├── Their faction's plans       ├── Future events                    │
//  │  ├── Witnessed events            ├── Meta-game information            │
//  │  └── Professional expertise      └── Other NPCs' thoughts             │
//  │                                                                         │
//  │  If asked about unknown things, respond as someone who doesn't know.  │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// THE MEMORY PROBLEM
// ============================================
//
// Each context window starts fresh.
// NPCs should remember past interactions.
// But we can't include everything.
//
// SOLUTION: Memory Protocol
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                         MEMORY SYSTEM                                   │
//  │                                                                         │
//  │  MEMORY TYPES:                                                          │
//  │  ├── Episodic   - "The adventurers saved my daughter last month"       │
//  │  ├── Semantic   - "The duke is corrupt"                                │
//  │  ├── Emotional  - "I feel grateful toward the party"                   │
//  │  ├── Procedural - "How to forge a blade"                               │
//  │  └── Relational - "Theron is trustworthy"                              │
//  │                                                                         │
//  │  RETRIEVAL:                                                             │
//  │  1. Query by relevance to current context                              │
//  │  2. Weight by importance and recency                                   │
//  │  3. Fit within context budget                                          │
//  │  4. Inject as "You remember..."                                        │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// THE VOICE PROBLEM
// ============================================
//
// Different NPCs should sound different.
// A guard and a scholar speak differently.
// Voice should be consistent across sessions.
//
// SOLUTION: Voice Fingerprinting
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                       VOICE FINGERPRINT                                 │
//  │                                                                         │
//  │  ALDRIC THE BLACKSMITH:            LADY SERAPHINE:                     │
//  │  ├── Vocabulary: simple            ├── Vocabulary: educated            │
//  │  ├── Formality: casual             ├── Formality: formal               │
//  │  ├── Sentences: short              ├── Sentences: elaborate            │
//  │  ├── Humor: dry                    ├── Humor: subtle                   │
//  │  ├── Directness: very direct       ├── Directness: indirect            │
//  │  ├── Says "aye" for yes            ├── Uses rhetorical questions       │
//  │  └── Clears throat when nervous    └── Fans herself when displeased    │
//  │                                                                         │
//  │  Include example dialogue for few-shot consistency.                    │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// CONTEXT WINDOW ASSEMBLY
// ============================================
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                     CONTEXT WINDOW (8K tokens)                          │
//  ├─────────────────────────────────────────────────────────────────────────┤
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 1. IDENTITY ANCHOR (Required, ~500 tokens)                  │       │
//  │  │    Who you are, core traits, speech patterns                │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 2. CONSTRAINTS (Required, ~200 tokens)                      │       │
//  │  │    What you can/cannot/must do                              │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 3. SITUATION (Required, ~300 tokens)                        │       │
//  │  │    Current scene, who is present                            │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 4. KNOWLEDGE (Dynamic, ~1000 tokens)                        │       │
//  │  │    What you know that's relevant                            │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 5. RELATIONSHIPS (Dynamic, ~300 tokens)                     │       │
//  │  │    Your relationship with present people                    │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 6. RELEVANT MEMORIES (Dynamic, ~500 tokens)                 │       │
//  │  │    Things you remember about current situation              │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 7. GOALS (Dynamic, ~200 tokens)                             │       │
//  │  │    What you're trying to accomplish                         │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 8. RECENT CONVERSATION (Required, ~2000 tokens)             │       │
//  │  │    Last N messages of dialogue                              │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 9. USER MESSAGE                                             │       │
//  │  │    What they just said/did                                  │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────┐       │
//  │  │ 10. RESPONSE BUFFER (~2000 tokens)                          │       │
//  │  │    Space for the AI to respond                              │       │
//  │  └─────────────────────────────────────────────────────────────┘       │
//  │                                                                         │
//  └─────────────────────────────────────────────────────────────────────────┘
//
//  BUDGET PRIORITY:
//  1. Required sections always included
//  2. Dynamic sections sorted by relevance
//  3. Lower priority sections trimmed if needed
//  4. Summaries used when full content won't fit
//

// ============================================
// THE ORCHESTRATOR
// ============================================
//
// The master agent that coordinates all others.
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                          ORCHESTRATOR                                   │
//  │                                                                         │
//  │                         ┌───────────────┐                               │
//  │                         │  ORCHESTRATOR │                               │
//  │                         │   (sees all)  │                               │
//  │                         └───────┬───────┘                               │
//  │                                 │                                       │
//  │           ┌─────────────────────┼─────────────────────┐                │
//  │           │                     │                     │                │
//  │           ▼                     ▼                     ▼                │
//  │    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐         │
//  │    │   NARRATOR   │     │    NPCs      │     │   SYSTEMS    │         │
//  │    │              │     │              │     │              │         │
//  │    │ Describes    │     │ Aldric       │     │ Economy      │         │
//  │    │ scenes       │     │ Seraphine    │     │ Factions     │         │
//  │    │              │     │ Guard #3     │     │ Lair         │         │
//  │    └──────────────┘     └──────────────┘     └──────────────┘         │
//  │                                                                         │
//  │  ROUTING:                                                               │
//  │  1. User speaks → Orchestrator receives                                │
//  │  2. Orchestrator determines target (NPC name? System? Narrator?)       │
//  │  3. Routes to appropriate agent                                        │
//  │  4. Agent responds with bounded knowledge                              │
//  │  5. Orchestrator validates and delivers                                │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// AGENT TYPES
// ============================================
//
//  NPC AGENT:
//  ├── Has identity, personality, voice
//  ├── Knows only what this NPC knows
//  ├── Speaks as this character
//  ├── Has goals and relationships
//  └── Can be addressed by name
//
//  NARRATOR AGENT:
//  ├── Describes scenes and actions
//  ├── Speaks in third person
//  ├── Never speaks AS characters
//  ├── Has full scene knowledge
//  └── Maintains atmosphere
//
//  FACTION AGENT:
//  ├── Embodies collective faction will
//  ├── Knows faction secrets
//  ├── Plans schemes and reactions
//  ├── Acts within faction resources
//  └── Used for faction turns
//
//  LAIR AGENT:
//  ├── Embodies the dungeon
//  ├── Knows lair layout
//  ├── Chooses lair actions
//  ├── Reacts to party actions
//  └── Has lair personality
//
//  GM ASSISTANT:
//  ├── Helps GM with prep
//  ├── Answers rules questions
//  ├── Generates content
//  ├── Has full campaign knowledge
//  └── Speaks out of character
//

// ============================================
// EXAMPLE: NPC CONVERSATION
// ============================================
//
//  USER: "Aldric, can you fix my sword?"
//
//  ORCHESTRATOR:
//  └── Routes to: Aldric (NPC Agent)
//
//  CONTEXT ASSEMBLED FOR ALDRIC:
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │ # YOUR IDENTITY                                                        │
//  │ You are Aldric, a weathered blacksmith in his fifties...               │
//  │                                                                         │
//  │ # CURRENT SITUATION                                                     │
//  │ You are in your forge. The adventurer Theron has entered.              │
//  │                                                                         │
//  │ # YOUR KNOWLEDGE                                                        │
//  │ - Theron and friends saved your daughter last month                    │
//  │ - You owe a debt to the moneylender Vex                                │
//  │ - There are rumors of war coming                                       │
//  │                                                                         │
//  │ # RELATIONSHIP WITH THERON                                              │
//  │ Grateful. They saved your daughter. You trust them.                    │
//  │                                                                         │
//  │ # CONSTRAINTS                                                           │
//  │ - You cannot reveal you're secretly a retired adventurer               │
//  │ - You must protect your family                                         │
//  │                                                                         │
//  │ # RECENT CONVERSATION                                                   │
//  │ Theron: "Aldric, can you fix my sword?"                                │
//  └─────────────────────────────────────────────────────────────────────────┘
//
//  ALDRIC'S RESPONSE:
//  "Aye, let me see it. *takes sword, examines it* Good steel, this.
//   Took some hard knocks, but nothing I can't set right. Give me
//   till sundown, and she'll be good as new. For you? No charge.
//   *clears throat* After what you did for my Elena... least I can do."
//
//  GROUNDING VERIFIED:
//  ├── Uses "aye" (speech pattern ✓)
//  ├── Clears throat (mannerism ✓)
//  ├── Short sentences (voice ✓)
//  ├── References daughter (memory ✓)
//  ├── Doesn't reveal past (constraint ✓)
//  └── Grateful attitude (relationship ✓)
//

// ============================================
// EXAMPLE: MULTI-AGENT SCENE
// ============================================
//
//  SCENE: Tavern negotiation with Lady Seraphine and Aldric present
//
//  USER: "We need to discuss the artifact."
//
//  ORCHESTRATOR:
//  └── Determines: Topic relevant to both NPCs
//  └── Sets turn order: Seraphine (higher status), then Aldric
//
//  SERAPHINE (speaking first):
//  "Ah, the artifact. *fans herself* One does wonder how simple
//   adventurers came upon such a... significant piece. Perhaps
//   you might enlighten us as to its provenance?"
//
//  ALDRIC (reacting):
//  "*shifts uncomfortably* Begging your pardon, my lady, but
//   maybe we shouldn't be discussing such things so openly.
//   *lowers voice* Walls have ears in this town."
//
//  Each agent:
//  ├── Speaks in their own voice
//  ├── Knows only what they know
//  ├── Has their own agenda
//  └── Reacts authentically to others
//

// ============================================
// INTEGRATION WITH OTHER SYSTEMS
// ============================================
//
//  SESSION LAYER:
//  ├── Scene cards trigger agent activation
//  ├── NPC cards load appropriate agents
//  └── Combat deactivates RP agents, activates tactical
//
//  SIMULATION LAYER:
//  ├── Faction AI uses faction agents
//  ├── Economy uses world agent
//  └── Downtime uses multiple agents
//
//  MANAGER LAYER:
//  ├── Agent configs stored as entities
//  ├── Memory stored with change tracking
//  └── Knowledge boundaries linked to entity visibility
//
//  NARRATIVE LAYER:
//  ├── Story context informs agent knowledge
//  ├── Quest progress affects NPC attitudes
//  └── Secrets unlock knowledge boundaries
//

// ============================================
// SAFETY & CONSISTENCY
// ============================================
//
//  GROUNDING VERIFICATION:
//  After each response, verify:
//  ├── Voice consistency (right vocabulary, patterns)
//  ├── Knowledge boundaries (didn't reveal forbidden info)
//  ├── Constraint compliance (didn't violate hard limits)
//  └── Character consistency (in-character behavior)
//
//  ANTI-PATTERNS:
//  ├── "As an AI..." - Never break fourth wall
//  ├── GM secrets - Never reveal to players
//  ├── Player stats - NPCs don't know HP/AC
//  ├── Meta-knowledge - Character doesn't know rules
//  └── Time breaks - Maintain consistent timeline
//
//  RECOVERY:
//  If agent drifts:
//  ├── Re-inject identity anchor
//  ├── Increase constraint emphasis
//  ├── Provide correction example
//  └── Restart conversation if severe
//

// ============================================
// PERFORMANCE CONSIDERATIONS
// ============================================
//
//  CONTEXT BUDGETING:
//  ├── Identity: ~500 tokens (fixed)
//  ├── Situation: ~300 tokens (fixed)
//  ├── Knowledge: ~1000 tokens (trimmed)
//  ├── Memory: ~500 tokens (selected)
//  ├── History: ~2000 tokens (windowed)
//  └── Response: ~2000 tokens (reserved)
//
//  MEMORY RETRIEVAL:
//  ├── Index memories by topic/entity
//  ├── Score by relevance to query
//  ├── Weight by importance/recency
//  └── Return top N within budget
//
//  AGENT CACHING:
//  ├── Cache identity anchors
//  ├── Cache voice fingerprints
//  ├── Lazy-load knowledge
//  └── Stream memories as needed
//
