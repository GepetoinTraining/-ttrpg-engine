// ============================================
// SIMULATION MODULE
// ============================================
//
// The meta-game layer that runs BETWEEN sessions.
//
// While the party adventures, the world keeps moving:
//   - Players queue downtime actions
//   - Followers carry out missions
//   - Settlements grow and face problems
//   - Factions scheme and maneuver
//   - Political relationships shift
//   - Economics fluctuate
//
// This creates a LIVING WORLD that:
//   - Responds to player choices
//   - Creates emergent storylines
//   - Rewards engagement beyond sessions
//   - Adds strategic depth
//   - Generates adventure hooks
//

export * from "./downtime";
export * from "./followers";
export * from "./settlements";
export * from "./factions";
export * from "./contributions";
export * from "./economy";

// ============================================
// THE COMPLETE DOWNTIME LOOP
// ============================================
//
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                        SESSION ENDS                                  │
//  └──────────────────────────────────────────────────────────────────────┘
//                                   │
//                                   ▼
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                    DOWNTIME PERIOD BEGINS                            │
//  │                                                                      │
//  │   Days available: 7                                                  │
//  │   Actions per day per character: 3                                   │
//  │   Real-world deadline: 2 days before next session                    │
//  └──────────────────────────────────────────────────────────────────────┘
//                                   │
//           ┌───────────────────────┼───────────────────────┐
//           │                       │                       │
//           ▼                       ▼                       ▼
//  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
//  │ PLAYER ACTIONS  │   │ FACTION ACTIONS │   │ WORLD EVENTS    │
//  │                 │   │                 │   │                 │
//  │ • Write letters │   │ • Progress      │   │ • Settlement    │
//  │ • Train troops  │   │   schemes       │   │   events        │
//  │ • Build things  │   │ • Diplomatic    │   │ • Random        │
//  │ • Send spies    │   │   moves         │   │   encounters    │
//  │ • Manage        │   │ • React to      │   │ • Economic      │
//  │   settlement    │   │   party         │   │   shifts        │
//  │ • Political     │   │ • Pursue goals  │   │ • Weather/      │
//  │   maneuvering   │   │                 │   │   seasons       │
//  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
//           │                     │                     │
//           └─────────────────────┼─────────────────────┘
//                                 │
//                                 ▼
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                       AI RESOLUTION                                  │
//  │                                                                      │
//  │   For each queued action:                                            │
//  │   1. Roll appropriate check                                          │
//  │   2. Apply modifiers from context                                    │
//  │   3. Determine outcome level                                         │
//  │   4. Generate narrative result                                       │
//  │   5. Calculate resource changes                                      │
//  │   6. Flag important items for GM review                              │
//  └──────────────────────────────────────────────────────────────────────┘
//                                 │
//                                 ▼
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                        GM REVIEW                                     │
//  │                                                                      │
//  │   Quick workflow:                                                    │
//  │   • Auto-approve low-risk actions (bulk)                             │
//  │   • Review flagged items individually                                │
//  │   • Modify outcomes as needed                                        │
//  │   • Add narrative flourishes                                         │
//  │   • Reject with explanation (rare)                                   │
//  └──────────────────────────────────────────────────────────────────────┘
//                                 │
//                                 ▼
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                      WORLD UPDATE                                    │
//  │                                                                      │
//  │   Apply all changes:                                                 │
//  │   • Player resource changes                                          │
//  │   • Settlement updates                                               │
//  │   • Follower status changes                                          │
//  │   • Faction relationship shifts                                      │
//  │   • New secrets/information                                          │
//  │   • Scheme progress                                                  │
//  │   • Event consequences                                               │
//  └──────────────────────────────────────────────────────────────────────┘
//                                 │
//                                 ▼
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                   PLAYER NOTIFICATIONS                               │
//  │                                                                      │
//  │   Before next session, players receive:                              │
//  │   • Summary of their action outcomes                                 │
//  │   • New information discovered                                       │
//  │   • Resource changes                                                 │
//  │   • Alerts about important events                                    │
//  │   • Hooks for next session                                           │
//  └──────────────────────────────────────────────────────────────────────┘
//                                 │
//                                 ▼
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │                      NEXT SESSION                                    │
//  │                                                                      │
//  │   The world has changed:                                             │
//  │   • The Duke responded to that letter                                │
//  │   • The barracks is now complete                                     │
//  │   • The spy mission failed - they know you're watching               │
//  │   • A rival faction has made a move                                  │
//  │   • The cult's ritual is almost ready...                             │
//  │                                                                      │
//  │   CONSEQUENCES DRIVE THE STORY                                       │
//  └──────────────────────────────────────────────────────────────────────┘
//

// ============================================
// INTEGRATION EXAMPLE
// ============================================
//
// Session 12: Party defeats dragon, gains 5000gp, frees prisoners
//
// Downtime Week (7 days, 3 actions/day = 21 actions per character):
//
// KIRA (Rogue):
//   Day 1: [Write letter to Duke] [Spy mission: Cult] [Gather info]
//   Day 2: [Build relationship: Innkeeper] [Train stealth] [Spy mission cont.]
//   Day 3: [Spy mission cont.] [Political maneuvering] [Gather info]
//   ...
//
// THERON (Fighter):
//   Day 1: [Train troops] [Recruit soldiers] [Inspect barracks]
//   Day 2: [Train troops] [Patrol territory] [Write letter: Mercenary contact]
//   Day 3: [Train troops] [Build relationship: Duke's captain] [Carouse]
//   ...
//
// SETTLEMENT (Thornwood Keep):
//   - Construction: Barracks (7/10 days → 14/10 = COMPLETE)
//   - Event: Merchant caravan arrives (opportunity!)
//   - Problem: Bandit sightings (need patrol)
//
// FACTIONS:
//   - Cult of Dragon: Scheme "Awaken Severin" 78% → 85%
//   - Lords' Alliance: Called summit, investigating party
//   - House Blackwood: Undermining Ravencrest
//
// OUTCOMES:
//   - Kira's spy CAUGHT by cult (crit fail) → Cult now hostile
//   - Theron's troops +1 quality → 5 soldiers trained to veteran
//   - Duke's letter POSITIVE → Ally +1, sends 50 soldiers
//   - Barracks complete → Can garrison 50, recruit sergeants
//   - Cult now knows party is a threat → Session 13 ambush planned
//
