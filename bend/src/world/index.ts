// ============================================
// WORLD LAYER
// ============================================
//
// THE TOP OF THE HIERARCHY
//
// Everything we built hangs off this:
//
//   Multiverse
//     └── Crystal Spheres (Spelljammer)
//           └── Worlds
//                 └── Regions
//                       └── Settlements (→ simulation layer)
//                             └── Locations
//
//   Campaign (lives in a World)
//     └── Party
//           └── Characters (→ rules layer)
//                 └── Followers
//                 └── Inventory
//
// This layer provides:
//   - Cosmology structure
//   - World definitions
//   - Campaign management
//   - Party management
//   - Spelljammer support
//   - World builder
//   - Seeded worlds (Faerûn, etc.)
//

export * from "./cosmos";
export * from "./graph";
export * from "./seeds";

// ============================================
// THE HIERARCHY EXPLAINED
// ============================================
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                          MULTIVERSE                                     │
//  │                                                                         │
//  │  One per installation. Contains all reality.                           │
//  │  Configures cosmology model (Great Wheel, Spelljammer, etc.)           │
//  └─────────────────────────────────────────────────────────────────────────┘
//                                     │
//         ┌───────────────────────────┼───────────────────────────┐
//         │                           │                           │
//         ▼                           ▼                           ▼
//  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
//  │ REALMSPACE   │           │  GREYSPACE   │           │  KRYNNSPACE  │
//  │ (Crystal     │           │  (Crystal    │           │  (Crystal    │
//  │  Sphere)     │           │   Sphere)    │           │   Sphere)    │
//  └──────┬───────┘           └──────┬───────┘           └──────┬───────┘
//         │                          │                          │
//         ▼                          ▼                          ▼
//  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
//  │    TORIL     │           │    OERTH     │           │    KRYNN     │
//  │   (World)    │           │   (World)    │           │   (World)    │
//  │              │           │              │           │              │
//  │  └─ Faerûn   │           │  └─ Flanaess │           │  └─ Ansalon  │
//  │     (Region) │           │     (Region) │           │     (Region) │
//  └──────────────┘           └──────────────┘           └──────────────┘
//                                     │
//                                     │ Campaign Set In
//                                     ▼
//                             ┌──────────────┐
//                             │   CAMPAIGN   │
//                             │              │
//                             │ "Dragon's    │
//                             │  Bane"       │
//                             └──────┬───────┘
//                                    │
//                    ┌───────────────┼───────────────┐
//                    │               │               │
//                    ▼               ▼               ▼
//             ┌──────────┐    ┌──────────┐    ┌──────────┐
//             │ PARTY A  │    │ PARTY B  │    │ PARTY C  │
//             │ "Silver  │    │ "Iron    │    │ "Shadow  │
//             │  Blades" │    │  Hawks"  │    │  Wolves" │
//             └──────────┘    └──────────┘    └──────────┘
//                    │
//                    │ Contains
//                    ▼
//             ┌─────────────────────────────────┐
//             │  Theron (Fighter 7)             │
//             │  Kira (Rogue 7)                 │
//             │  Elara (Wizard 7)               │
//             │  Brother Marcus (Cleric 7)     │
//             └─────────────────────────────────┘
//

// ============================================
// SPELLJAMMER SUPPORT
// ============================================
//
// When Spelljammer is enabled, campaigns can:
//   - Travel between worlds
//   - Own and operate spelljammer ships
//   - Navigate wildspace and the phlogiston
//   - Dock at the Rock of Bral
//   - Fight space battles!
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                        SPELLJAMMER NAVIGATION                           │
//  │                                                                         │
//  │                                                                         │
//  │         ╭──────╮                                      ╭──────╮         │
//  │        ╱        ╲       THE PHLOGISTON               ╱        ╲        │
//  │       │ REALMSPACE │ ═══════════════════════════════│ GREYSPACE │      │
//  │        ╲        ╱         Flow Rivers                ╲        ╱        │
//  │         ╰──────╯                                      ╰──────╯         │
//  │             │                                             │            │
//  │             │ Wildspace                      Wildspace   │            │
//  │             ▼                                             ▼            │
//  │         ┌──────┐                                     ┌──────┐         │
//  │         │ Toril │                                    │ Oerth │         │
//  │         └──────┘                                     └──────┘         │
//  │             │                                             │            │
//  │             ▼                                             ▼            │
//  │      🚀 Hammership                               ⚓ Rock of Bral       │
//  │         "Star of                                                       │
//  │          Waterdeep"                                                    │
//  │                                                                         │
//  └─────────────────────────────────────────────────────────────────────────┘
//

// ============================================
// SEEDED WORLDS
// ============================================
//
// Pre-built worlds ready to use:
//
// FAERÛN (Forgotten Realms)
//   - The most iconic D&D setting
//   - 30 regions, 200+ settlements
//   - Baldur's Gate, Waterdeep, Neverwinter
//   - Ready when you seed it with data!
//
// REALMSPACE (Spelljammer)
//   - Crystal sphere containing Toril
//   - For space-faring campaigns
//   - Includes Selûne, Tears of Selûne
//
// GREYSPACE (Greyhawk)
//   - The original D&D setting
//   - City of Greyhawk, Temple of Elemental Evil
//
// KRYNNSPACE (Dragonlance)
//   - War of the Lance
//   - Dragon Highlords, Heroes of the Lance
//
// ROCK OF BRAL
//   - Spelljammer city-asteroid
//   - Hub for space campaigns
//

// ============================================
// WORLD BUILDER
// ============================================
//
// For GMs creating custom worlds:
//
//   Step 1: CONCEPT
//     "What's your world about?"
//     Name, tagline, genre, inspirations
//
//   Step 2: COSMOLOGY
//     "How does the universe work?"
//     Planes, deities, magic source
//
//   Step 3: GEOGRAPHY
//     "What does it look like?"
//     Continents, climates, features
//
//   Step 4: HISTORY
//     "What happened before?"
//     Ages, major events, current year
//
//   Step 5: CULTURES
//     "Who lives here?"
//     Species, languages, religions
//
//   Step 6: MAGIC
//     "How does magic work?"
//     System, limitations, special rules
//
//   Step 7: FACTIONS
//     "Who has power?"
//     Major organizations, relationships
//
//   Step 8: CONFLICTS
//     "What's happening now?"
//     Current tensions, stakes
//
//   Step 9: DETAILS
//     "Fill in the rest"
//     Starting region, hooks, NPCs
//
//   Step 10: COMPLETE!
//     World is ready for campaigns
//

// ============================================
// DATA FLOW
// ============================================
//
// 1. User selects/creates WORLD
//    └── Uses seeded (Faerûn) or World Builder
//
// 2. GM creates CAMPAIGN in world
//    └── Sets starting region, level range, features
//
// 3. Players create PARTY
//    └── Links to campaign
//
// 4. Players create CHARACTERS
//    └── Join party
//
// 5. GM starts SESSION
//    └── Uses Session layer
//
// 6. Systems activate:
//    └── Narrative (story tracking)
//    └── Combat (when fighting)
//    └── Simulation (downtime, economy, factions)
//    └── Intelligence (AI agents)
//

// ============================================
// INTEGRATION POINTS
// ============================================
//
// World → Engine:
//   - World.majorFactions → simulation/factions.ts
//   - Region.majorSettlements → simulation/settlements.ts
//   - Campaign.currentArcId → narrative/story.ts
//   - Party.members → rules/creature.ts
//
// World → Middleware:
//   - WorldHierarchyAggregate → aggregates.ts
//   - Campaign state → SessionStateAggregate
//   - Party → CharacterSheetAggregate
//
// World → Turso:
//   - multiverse table
//   - crystal_spheres table
//   - worlds table
//   - regions table
//   - campaigns table
//   - parties table
//

// ============================================
// FUTURE: SEED DATA STRUCTURE
// ============================================
//
// When Faerûn seed is ready:
//
// seeds/
// ├── faerun/
// │   ├── world.json         - World definition
// │   ├── regions/
// │   │   ├── sword_coast.json
// │   │   ├── western_heartlands.json
// │   │   └── ...
// │   ├── settlements/
// │   │   ├── waterdeep.json
// │   │   ├── baldurs_gate.json
// │   │   ├── neverwinter.json
// │   │   └── ...
// │   ├── factions/
// │   │   ├── harpers.json
// │   │   ├── zhentarim.json
// │   │   ├── lords_alliance.json
// │   │   └── ...
// │   ├── deities/
// │   │   ├── faerunian_pantheon.json
// │   │   └── ...
// │   └── index.json         - Manifest
// │
// ├── realmspace/
// │   ├── sphere.json
// │   ├── celestial_bodies.json
// │   └── ...
// │
// └── rock_of_bral/
//     ├── settlement.json
//     ├── factions.json
//     └── ...
//
