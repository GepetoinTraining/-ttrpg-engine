# Character Topology Architecture

## Core Concept: Character = Token + Atom

A character is **TWO things**:

1. **TOKEN** (topology/seed) - The physics-enabled thing that EXISTS in the world
2. **ATOM** (sheet) - The stats/abilities projection (cached, derived)

**The TOKEN is the source of truth. The ATOM is a projection.**

```
┌─────────────────────────────────────────────────────────────┐
│                    CHARACTER CREATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Player Seed ─┬─► Birth Data ─► UID ─► Character Seed       │
│               │   (geo+time+entropy)                        │
│               │                                             │
│  Race ────────┼─► Race Prime (29-47)                        │
│  Class ───────┼─► Class Prime (53-79)      ├─► TOKEN        │
│  Abilities ───┼─► Element Composition      │   (stored)     │
│               │                            │                │
│               └─► compose(topology) × race × class = SEED   │
│                                                             │
│  TOKEN.seed ─► factorize() ─► derive stats ─► ATOM          │
│                                               (projection)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Configuration vs Representation

- **Configuration** = potential (exists, can be precipitated into world)
- **Representation** = actual (collapsed into world, physics apply)

Once represented, the character is **in the world**. They can affect it and be affected by it.

**Risk = Agency**: You can't affect the world without being affected by it.

AFK death is a feature, not a bug - it's the cost of participation in a living world.

## Element System for Characters

### Race Primes (29-47)
```typescript
HUMAN: 29,      // Adaptable, balanced
ELF: 31,        // Magical, long-lived
DWARF: 37,      // Sturdy, earth-bound
HALFLING: 41,   // Lucky, nimble
GNOME: 43,      // Inventive, curious
HALF_ORC: 47,   // Strong, fierce
```

### Class Primes (53-79)
```typescript
FIGHTER: 53,    // Martial prowess
WIZARD: 59,     // Arcane mastery
CLERIC: 61,     // Divine connection
ROGUE: 67,      // Cunning, stealth
BARBARIAN: 71,  // Primal fury
BARD: 73,       // Inspiration, magic
RANGER: 79,     // Nature, tracking
```

### Base Elements (from genesis/elements.ts)
```typescript
H:  2   // Hydrogen - FLUX (energy, speed)
He: 3   // Helium - FORM (structure)
C:  5   // Carbon - VITALITY (life, growth)
N:  7   // Nitrogen - AETHER (insight)
O:  11  // Oxygen - VITALITY (breath, voice)
Si: 13  // Silicon - FORM (stability)
Fe: 17  // Iron - FORM (strength)
Au: 19  // Gold - AETHER (brilliance)
U:  23  // Uranium - ENTROPY (primal)
```

## Character Seed Composition

```typescript
// Example: Human Fighter with high STR

// 1. Race topology: Human = { C: 2, O: 1, N: 1 }
// 2. Class topology: Fighter = { Fe: 2, H: 1 }
// 3. Primary ability: STR → adds Fe: 1

// Combined topology: { C: 2, O: 1, N: 1, Fe: 3, H: 1 }

// Base seed = compose(topology)
//           = 5^2 × 11^1 × 7^1 × 17^3 × 2^1
//           = 25 × 11 × 7 × 4913 × 2
//           = 18,921,650

// Final seed = baseSeed × racePrime × classPrime
//            = 18,921,650 × 29 × 53
//            = 29,092,438,850
```

## Database Schema

### character_tokens (Source of Truth)
```sql
CREATE TABLE character_tokens (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,           -- Genesis UID (unforgeable)
  seed TEXT NOT NULL,                 -- Composed topology (bigint as string)
  
  player_uid TEXT NOT NULL,           -- Parent player's genesis UID
  player_seed_id TEXT,                -- Topology auth seed reference
  
  birth_timestamp INTEGER NOT NULL,
  birth_entropy TEXT NOT NULL,
  
  topology TEXT NOT NULL,             -- JSON breakdown
  dominant_type TEXT NOT NULL,        -- FLUX/FORM/VITALITY/AETHER/ENTROPY
  entropy REAL NOT NULL,
  
  character_id TEXT,                  -- Link to projected atom
  
  -- World position
  world_id TEXT,
  region_id TEXT,
  location_id TEXT,
  position_x REAL,
  position_y REAL,
  position_z REAL,
  
  -- Physics state
  is_represented INTEGER DEFAULT 0,   -- 0 = configured, 1 = in world
  status TEXT DEFAULT 'configured'    -- configured, represented, destroyed
);
```

### characters (Projection/Cache)
The existing `characters` table remains but becomes a **projection** of the token:
- Quick access to stats without factorization
- Cached for performance
- Updated when token evolves

## Birth Flow

```typescript
// 1. Get player's topology seed
const playerSeed = await getSeed(seedId);

// 2. Collect birth data (geo + time + entropy)
const birthData = {
  coordinates: { latitude, longitude, accuracy },
  timestamp: Date.now(),
  entropy: generateEntropy(),
  userAgent: 'genesis-character-birth'
};

// 3. Birth the character
const { token, atom } = await birthCharacter({
  playerSeedId: seedId,
  playerUid: playerSeed.uid,
  name: "Thorin",
  race: "dwarf",
  class: "fighter",
  abilityScores: { strength: 16, dexterity: 12, ... }
});

// 4. Store token (source of truth)
await tokenDb.createToken({ token, characterId: null });

// 5. Store atom (projection for quick access)
const character = await db.createCharacter({
  ...atom,
  campaignId,
  ownerId,
  ownerSeedId: seedId
});

// 6. Link token to character
await tokenDb.linkTokenToCharacter(token.id, character.id);
```

## Representation Flow

```typescript
// Character enters the world
await tokenDb.representToken(tokenId, {
  worldId: 'toril',
  regionId: 'sword-coast',
  locationId: 'neverwinter',
  x: 100,
  y: 200,
  z: 0
});

// Now the character is subject to physics
// Time passes, events happen, even when player is offline
```

## Files Created/Modified

### New Files
- `bend/src/genesis/character.ts` - Character topology composition
- `bend/src/db/migrations/018_character_tokens.ts` - Token tables
- `bend/src/db/queries/character-tokens.ts` - Token CRUD operations
- `docs/genesis/CHARACTER_TOPOLOGY.md` - This document

### Modified Files
- `bend/src/db/migrations/index.ts` - Added migration 018
- `bend/src/api/routers/character.ts` - Added genesis imports (in progress)

## Next Steps (Incomplete)

1. **Complete character router Genesis endpoint**
   - Add `birthGenesis` mutation that uses `birthCharacter()`
   - Store both token and atom
   - Link them together

2. **Add character observation**
   - When viewing character, factorize seed to get current state
   - Apply any topology changes (evolution, mutations)
   - Return projected atom

3. **Implement representation**
   - API to place character in world
   - Start physics tick updates
   - Enable world interaction

4. **Handle evolution**
   - Level up = add elements to topology
   - New seed = old seed × evolution elements
   - Update stored topology

## Key Insight

> "Seed IS the thing, not a representation. Seed 44 IS water."

The character's seed IS their identity. The stats are just how we observe that identity from our frame of reference.

---

## Bootstrap Context for Next Session

### What Was Done
1. Created `bend/src/genesis/character.ts` with:
   - `CHARACTER_ELEMENTS` - Primes for races (29-47) and classes (53-79)
   - `RACE_TOPOLOGIES` - Element compositions for each race
   - `CLASS_TOPOLOGIES` - Element compositions for each class
   - `birthCharacter()` - Main function that creates token + atom
   - `factorizeCharacter()` - Reverse: seed → race/class/elements

2. Created `bend/src/db/migrations/018_character_tokens.ts`:
   - `character_tokens` table for storing the topology source of truth
   - `character_token_events` table for timeline/causality tracking

3. Created `bend/src/db/queries/character-tokens.ts`:
   - Full CRUD for tokens
   - `representToken()` - Move from configuration to world
   - `evolveTokenSeed()` - Level up / mutations
   - Event recording for causality

4. Started modifying `bend/src/api/routers/character.ts`:
   - Added imports for genesis and token modules
   - **INCOMPLETE**: Need to add the actual `birthGenesis` mutation

### What Was Completed

The `birthGenesis` mutation has been added to `bend/src/api/routers/character.ts`:
- Validates race/class against `RACE_TOPOLOGIES` and `CLASS_TOPOLOGIES`
- Verifies player has a topology seed
- Calls `birthCharacter()` to create token + atom
- Stores atom in `characters` table (projection)
- Stores token in `character_tokens` table (source of truth)
- Returns both character and token data

Additional endpoints added:
- `getToken` - Get a character's topology token
- `getGenesisRaces` - List available races for character creation
- `getGenesisClasses` - List available classes for character creation

### Key Files to Read
- `bend/src/genesis/character.ts` - The topology composition logic
- `bend/src/genesis/elements.ts` - Base element primes (H=2, C=5, etc.)
- `bend/src/genesis/identity.ts` - UID generation from birth data
- `bend/src/db/queries/character-tokens.ts` - Token database operations

### The Philosophy
- **No topology = no existence**
- Everything needs an atomic build topology
- Seed IS the thing (seed 44 IS water)
- Character sheet is a PROJECTION, not the source
- Once represented in world, physics apply (AFK death is a feature)

---

## Test Results (Working)

```bash
curl -X POST "http://localhost:3001/character.birthGenesis" \
  -H "Content-Type: application/json" \
  -H "x-topology-cert: <cert-hash>" \
  -H "x-campaign-id: <campaign-id>" \
  -d '{
    "name": "Thorin Stonehammer",
    "race": "dwarf",
    "class": "fighter",
    "abilityScores": {
      "strength": 16, "dexterity": 12, "constitution": 15,
      "intelligence": 10, "wisdom": 13, "charisma": 8
    }
  }'
```

**Response:**
```json
{
  "character": {
    "id": "43200625-296a-4cfc-8a25-6a501cfab221",
    "name": "Thorin Stonehammer",
    "race": "Dwarf",
    "class": "Fighter",
    "level": 1,
    "hpMax": 13,
    "con": 17,  // 15 base + 2 racial bonus
    "speed": 25
  },
  "token": {
    "uid": "gen_af14b357_mjoxcu2t_ac097f3a",
    "seed": "72392829002",
    "topology": { "Fe": 5, "Si": 1, "H": 1, "Dwarf": 1, "Fighter": 1 },
    "dominantType": "FORM",
    "status": "configured"
  }
}
```

The character exists in **configuration space** (`isRepresented: 0`). 
To enter the world, call `representToken()` with a location.
