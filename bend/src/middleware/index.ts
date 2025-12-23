// ============================================
// MIDDLEWARE LAYER
// ============================================
//
// The TRANSLATION LAYER between 20k lines of
// backend schemas and the frontend/database.
//
// This layer provides:
//   - Aggregates: Combined views of data
//   - Actions: Atomic operations
//   - Events: Cross-system triggers
//   - Deltas: Change sync for Turso
//   - Hooks: Frontend patterns
//

export * from "./aggregates";
export * from "./actions";
export * from "./events";
export * from "./deltas";
export * from "./hooks";

// ============================================
// THE ARCHITECTURE
// ============================================
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                           FRONTEND                                      │
//  │                                                                         │
//  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
//  │  │  React    │  │  Player   │  │    GM     │  │  Real-    │           │
//  │  │  Hooks    │  │    UI     │  │   Panel   │  │  time     │           │
//  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘           │
//  └────────┼──────────────┼──────────────┼──────────────┼───────────────────┘
//           │              │              │              │
//           └──────────────┴───────┬──────┴──────────────┘
//                                  │
//  ┌───────────────────────────────┼─────────────────────────────────────────┐
//  │                        MIDDLEWARE                                       │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────────┐   │
//  │  │                         HOOKS                                    │   │
//  │  │  useCharacter  useSession  useCombat  useWorld  useGMDashboard  │   │
//  │  └─────────────────────────────┬───────────────────────────────────┘   │
//  │                                │                                       │
//  │  ┌─────────────────────────────┼───────────────────────────────────┐   │
//  │  │                      AGGREGATES                                  │   │
//  │  │  CharacterSheet  SessionState  CombatEncounter  WorldSnapshot   │   │
//  │  └─────────────────────────────┬───────────────────────────────────┘   │
//  │                                │                                       │
//  │  ┌───────────────┬─────────────┼─────────────┬───────────────────┐    │
//  │  │    ACTIONS    │             │             │      EVENTS       │    │
//  │  │               │    ┌────────┴────────┐    │                   │    │
//  │  │ StartCombat   │    │   DISPATCHER    │    │ character.died    │    │
//  │  │ TakeDamage    │───▶│                 │───▶│ quest.completed   │    │
//  │  │ LevelUp       │    │ Routes actions  │    │ economy.changed   │    │
//  │  │ CompleteQuest │    │ Triggers events │    │                   │    │
//  │  └───────────────┘    └────────┬────────┘    └───────────────────┘    │
//  │                                │                                       │
//  │  ┌─────────────────────────────┼───────────────────────────────────┐   │
//  │  │                        DELTAS                                    │   │
//  │  │  Generate  ──▶  Queue  ──▶  Sync  ──▶  Resolve Conflicts        │   │
//  │  └─────────────────────────────┬───────────────────────────────────┘   │
//  │                                │                                       │
//  └────────────────────────────────┼────────────────────────────────────────┘
//                                   │
//  ┌────────────────────────────────┼────────────────────────────────────────┐
//  │                          BACKEND                                        │
//  │                                                                         │
//  │  ┌─────────────────────────────────────────────────────────────────┐   │
//  │  │                    ENGINE (20k lines)                            │   │
//  │  │                                                                  │   │
//  │  │  Grid  Rules  Narrative  Assets  Combat  Simulation  Session    │   │
//  │  │               Puzzle  Manager  Intelligence                      │   │
//  │  └─────────────────────────────┬───────────────────────────────────┘   │
//  │                                │                                       │
//  │  ┌─────────────────────────────┼───────────────────────────────────┐   │
//  │  │                    TURSO / SQLITE                                │   │
//  │  │                                                                  │   │
//  │  │  campaigns  characters  npcs  settlements  combats  agents      │   │
//  │  │                     + sync_log for deltas                        │   │
//  │  └─────────────────────────────────────────────────────────────────┘   │
//  │                                                                         │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// DATA FLOW
// ============================================
//
// READ PATH:
//   1. Component calls hook: useCharacter({ characterId })
//   2. Hook checks cache
//   3. If stale/missing, fetches aggregate from API
//   4. API assembles aggregate from Turso
//   5. Returns to hook, updates cache
//   6. Component re-renders with data
//   7. Hook subscribes to relevant events for updates
//
// WRITE PATH:
//   1. User clicks "Take Damage"
//   2. Component calls action: takeDamage(14, 'slashing', 'Orc')
//   3. Action validates input
//   4. Optimistic update applied locally
//   5. Delta generated and queued
//   6. Action dispatched to backend
//   7. Backend updates engine state
//   8. Backend emits events
//   9. Delta synced to Turso
//   10. Confirmation returned
//   11. Other clients receive delta/event
//

// ============================================
// AGGREGATES SUMMARY
// ============================================
//
// WHAT: Combined views that pull from multiple schemas
// WHY: Frontend needs complete data, not scattered pieces
//
// CharacterSheetAggregate
// ├── identity (creature.ts)
// ├── combat stats (rules/core.ts)
// ├── abilities/skills (rules/core.ts)
// ├── actions/spells (rules/creature.ts)
// ├── inventory (manager/entity.ts)
// ├── followers (simulation/followers.ts)
// ├── relationships (assets/entity.ts)
// └── downtime (simulation/downtime.ts)
//
// SessionStateAggregate
// ├── session info (session/live.ts)
// ├── current scene (session/live.ts)
// ├── party state (manager/entity.ts)
// ├── combat state (combat/manager.ts)
// ├── active quests (narrative/story.ts)
// └── recent events (events)
//
// WorldSnapshotAggregate
// ├── time/calendar (simulation)
// ├── settlements (simulation/settlements.ts)
// ├── factions (simulation/factions.ts)
// ├── economy (simulation/economy.ts)
// ├── narrative state (narrative/story.ts)
// └── party impact (manager/entity.ts)
//

// ============================================
// ACTIONS SUMMARY
// ============================================
//
// WHAT: Atomic operations that touch multiple systems
// WHY: One user intent = one action, middleware orchestrates
//
// Session Actions:
//   session.start      → Create session, load party, set scene
//   session.end        → Close session, award XP, trigger downtime
//   session.changeScene → Update scene, load NPCs, activate agents
//
// Combat Actions:
//   combat.start       → Create combat, roll initiative, position tokens
//   combat.end         → Resolve combat, generate loot, award XP
//   combat.turn        → Validate action, apply effects, advance turn
//
// Character Actions:
//   character.takeDamage → Apply damage, check death, trigger reactions
//   character.heal       → Apply healing, update display
//   character.levelUp    → Update stats, add features, recalculate
//
// Quest Actions:
//   quest.accept         → Add to party, update NPC
//   quest.complete       → Award rewards, update reputation
//
// World Actions:
//   world.advanceTime    → Advance calendar, run simulations
//   world.simulateEconomy → Run economy sim, update prices
//   world.factionTurn    → Run faction AI, execute schemes
//

// ============================================
// EVENTS SUMMARY
// ============================================
//
// WHAT: Cross-system triggers and cascades
// WHY: When something happens, other systems need to know
//
// Event Categories:
//   session   → Session lifecycle events
//   combat    → Combat events (started, damage, ended)
//   character → Character state changes
//   quest     → Quest progression
//   npc       → NPC events
//   economy   → Economic events
//   faction   → Faction events
//   narrative → Story events
//
// Event Cascades:
//   character.died
//   └─▶ combat.combatantDied
//   └─▶ party.memberLost (if player)
//   └─▶ quest.failCheck
//   └─▶ npc.reactions
//   └─▶ narrative.plotImpact
//
//   quest.completed
//   └─▶ reputation.update
//   └─▶ faction.reaction
//   └─▶ economy.rewardFlow
//   └─▶ narrative.threadUpdate
//

// ============================================
// DELTAS SUMMARY
// ============================================
//
// WHAT: Change tracking for Turso sync
// WHY: Efficient sync, offline-first, conflict resolution
//
// Delta Structure:
//   id        → Unique delta ID
//   sequence  → Order for sync
//   table     → Which table changed
//   recordId  → Which record
//   operation → INSERT/UPDATE/DELETE
//   data      → New values
//   version   → For optimistic locking
//
// Sync Protocol:
//   1. Change made locally
//   2. Delta generated
//   3. Optimistic update applied
//   4. Delta queued for sync
//   5. Batch pushed to server
//   6. Server validates and applies
//   7. Conflicts resolved
//   8. Confirmation returned
//   9. Other clients pull deltas
//
// Conflict Resolution:
//   - last_write_wins (default)
//   - server_wins (for critical data)
//   - merge (for non-conflicting fields)
//   - manual (for complex conflicts)
//

// ============================================
// HOOKS SUMMARY
// ============================================
//
// WHAT: Frontend patterns for data fetching
// WHY: Consistent patterns, automatic subscriptions
//
// Character Hooks:
//   useCharacter(id)      → Full character sheet
//   useMyCharacters()     → List of my characters
//
// Session Hooks:
//   useSession(id)        → Session state
//   useActiveSession()    → Current active session
//
// Combat Hooks:
//   useCombat(id)         → Combat state
//   useCombatant(id)      → Single combatant
//
// World Hooks:
//   useWorld()            → World snapshot
//   useSettlement(id)     → Settlement details
//
// Each hook provides:
//   - data (the aggregate)
//   - isLoading, isError, error
//   - actions (mutations)
//   - automatic re-fetch on events
//

// ============================================
// TURSO SCHEMA
// ============================================
//
// Tables defined in deltas.ts:
//
// Core:
//   campaigns, sessions
//
// Characters:
//   characters, inventory_items, conditions
//
// Social:
//   parties, party_members, npcs, npc_relationships
//
// World:
//   locations, settlements, factions
//
// Gameplay:
//   quests, combats, combat_log
//   downtime_periods, downtime_actions
//   followers
//
// Economy:
//   economic_events
//
// AI:
//   agents, agent_memories
//
// Sync:
//   sync_log (delta tracking)
//

// ============================================
// EXAMPLE: COMPLETE FLOW
// ============================================
//
// User: Player clicks "Attack Orc with Longsword"
//
// 1. COMPONENT
//    const { attack } = useCombat({ combatId });
//    attack('orc-123', 'Longsword');
//
// 2. HOOK → ACTION
//    dispatch({
//      type: 'combat.turn',
//      combatId: '...',
//      combatantId: 'player-456',
//      action: {
//        actionType: 'attack',
//        targetId: 'orc-123',
//        attackName: 'Longsword',
//      },
//    });
//
// 3. DISPATCHER
//    - Validates action
//    - Rolls attack: 15 + 5 = 20 vs AC 13 → HIT
//    - Rolls damage: 1d8 + 3 = 8 slashing
//    - Updates orc HP: 15 - 8 = 7
//
// 4. DELTAS GENERATED
//    { table: 'combats', recordId: '...', operation: 'UPDATE',
//      data: { current_turn_index: 1 } }
//    { table: 'characters', recordId: 'orc-123', operation: 'UPDATE',
//      data: { hp_current: 7 } }
//    { table: 'combat_log', recordId: '...', operation: 'INSERT',
//      data: { action: 'attack', result: 'hit', damage: 8 } }
//
// 5. EVENTS EMITTED
//    { type: 'combat.attackRolled', data: { hit: true, roll: 20 } }
//    { type: 'combat.damageDealt', data: { damage: 8, targetHpAfter: 7 } }
//
// 6. AGGREGATES UPDATED
//    CombatEncounterAggregate refreshed
//
// 7. HOOKS NOTIFIED
//    useCombat invalidates and re-fetches
//
// 8. UI UPDATES
//    - Attack animation plays
//    - Damage number floats up
//    - Orc HP bar updates
//    - Combat log shows entry
//    - Turn indicator moves
//
// 9. SYNC TO TURSO
//    Deltas batched and pushed
//    Other clients receive updates
//

// ============================================
// FILE SUMMARY
// ============================================
//
// middleware/
// ├── aggregates.ts  (800+ lines)
// │   ├── CharacterSheetAggregate
// │   ├── SessionStateAggregate
// │   ├── WorldSnapshotAggregate
// │   ├── NPCEncounterAggregate
// │   ├── CombatEncounterAggregate
// │   ├── DowntimeAggregate
// │   └── Card schemas (quick reference)
// │
// ├── actions.ts     (700+ lines)
// │   ├── Session actions
// │   ├── Combat actions
// │   ├── Character actions
// │   ├── Inventory actions
// │   ├── Quest actions
// │   ├── NPC actions
// │   ├── Downtime actions
// │   ├── World actions
// │   └── GM actions
// │
// ├── events.ts      (500+ lines)
// │   ├── Event categories
// │   ├── Event schemas by category
// │   ├── Event handlers registry
// │   └── Event cascades
// │
// ├── deltas.ts      (500+ lines)
// │   ├── Delta schema
// │   ├── Sync state
// │   ├── Table definitions (Turso schema)
// │   ├── Delta generation
// │   ├── Conflict resolution
// │   └── Delta compression
// │
// ├── hooks.ts       (400+ lines)
// │   ├── Hook definitions
// │   ├── Hook registry
// │   └── Framework-agnostic patterns
// │
// └── index.ts       (this file)
//     └── Documentation and exports
//

// ============================================
// USAGE EXAMPLES
// ============================================
//
// // In React component
// function CharacterSheet({ characterId }) {
//   const {
//     data: character,
//     isLoading,
//     takeDamage,
//     heal,
//     addCondition,
//   } = useCharacter({ characterId });
//
//   if (isLoading) return <Spinner />;
//
//   return (
//     <div>
//       <h1>{character.identity.name}</h1>
//       <HealthBar
//         current={character.combat.hp.current}
//         max={character.combat.hp.max}
//       />
//       <button onClick={() => takeDamage(10, 'fire', 'Dragon breath')}>
//         Take 10 Fire Damage
//       </button>
//     </div>
//   );
// }
//
// // In GM panel
// function GMPanel({ campaignId }) {
//   const { data: world, advanceTime, simulateEconomy } = useWorld({ campaignId });
//   const { data: session, changeScene } = useActiveSession({ campaignId });
//
//   return (
//     <div>
//       <WorldClock date={world.time.currentDate} />
//       <button onClick={() => advanceTime(7, 'days')}>
//         Advance 1 Week
//       </button>
//       <button onClick={() => simulateEconomy(7)}>
//         Run Economy Simulation
//       </button>
//     </div>
//   );
// }
//
