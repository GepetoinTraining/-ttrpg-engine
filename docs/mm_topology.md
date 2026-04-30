# MM ↔ TP Topology Schema

How every Manifold Machine interacts with the Topology Pointer (.tp).

## Scale Threshold — What IS .tp vs what LIVES AT .tp

```
TOPOLOGICAL (IS a .tp node):        MANIFOLD (lives AT a .tp node):
  Elminster (too big, warps space)    Hired Guide (regular NPC)
  The Weave (fundamental force)       Tavern Keeper (commoner)
  Mount Hotenow (landmark)            City Guard (faction member)
  Zhentarim HQ (faction seat)         Shopkeeper (merchant)
  Suzail (settlement)                 Party follower

  Factions = BOTH — .tp (territory) + MM (behavior)
```

## 1. Containment — What Lives Where

```mermaid
graph TB
  subgraph ".tp — World Topology (the space itself)"
    direction TB

    subgraph "crystal_sphere"
      RS["Realmspace"]
    end

    subgraph "planet"
      T["Toril"]
    end

    subgraph "continent"
      F["Faerûn"]
    end

    subgraph "region"
      HL["Heartlands"]
    end

    subgraph "kingdom"
      CO["Cormyr"]
    end

    subgraph "settlement"
      SZ["Suzail"]
    end

    subgraph "district"
      MW["Market Ward"]
    end

    subgraph "building"
      LL["The Laughing Lich Inn"]
    end

    RS --> T --> F --> HL --> CO --> SZ --> MW --> LL
  end

  subgraph "MM_adventure — Campaign Container"
    ADV["MM_adventure<br/>(Curse of Strahd)"]

    subgraph "MM_session — Active Play"
      SESS["MM_session<br/>(Session 14)"]

      subgraph "Pocket Manifold"
        SCENE["MM_scene<br/>(Tavern Brawl)"]
      end
    end

    subgraph "MM_party — The Heroes"
      PARTY["MM_party<br/>(Silver Dragons)"]
      C1["MM_character<br/>(Arden, Fighter 5)"]
      C2["MM_character<br/>(Elara, Wizard 5)"]
    end

    subgraph "MM_followers"
      subgraph "Local (same .tp as party)"
        FL1["MM_npc<br/>(Miri, Guide)"]
        FL2["MM_npc<br/>(Bruenor, Hired Sword)"]
      end
      subgraph "Global (own .tp nodes)"
        FG1["MM_npc<br/>(Renaer, Informant)"]
      end
    end
  end

  ADV ---|"OWNS"| RS
  PARTY -.-|"POSITIONED AT"| LL
  FL1 -.-|"SAME .tp AS PARTY"| LL
  FL2 -.-|"SAME .tp AS PARTY"| LL
  FG1 -.-|"AT OWN .tp"| SZ
  SCENE -.-|"SPAWNED AT"| LL
  SESS -.-|"ACTIVE CARD<br/>locationId"| MW
```

## 2. Read/Write — How MMs Touch .tp

```mermaid
flowchart LR
  subgraph ".tp"
    TP["World Graph<br/>(nodes + edges + κ)"]
  end

  subgraph ".tpb"
    TPB["Session History<br/>(append-only)"]
  end

  subgraph "MMs"
    ADV["MM_adventure"]
    SESS["MM_session"]
    SCENE["MM_scene"]
    PARTY["MM_party"]
    CHAR["MM_character"]
    FLWR["MM_followers"]
    NPC["MM_npc"]
  end

  ADV ==>|"OWNS / loadWorld()"| TP
  ADV ==>|"OWNS"| TPB

  SESS -->|"reads: resolve(locationId)"| TP
  SESS -->|"writes: add_node, add_edge<br/>(world mutations)"| TP
  SESS -->|"appends: scene cards,<br/>choices, combat results"| TPB

  SCENE -->|"reads: κ at location<br/>(magic, physics)"| TP
  SCENE -.->|"no direct write"| TP

  PARTY -.->|"reads: position"| TP
  CHAR -.->|"no access"| TP

  FLWR -->|"reads: position<br/>(local = party .tp,<br/>global = own .tp)"| TP
  FLWR -->|"moveLocalTo(nodeId)<br/>on party move"| TP
  NPC -->|"homeNodeId /<br/>currentNodeId"| TP
```

## 3. Time Dilation — Tick Rates at Each Level

```mermaid
graph TD
  subgraph "World Time (1 day/tick)"
    ADV["MM_adventure<br/>worldDay: 42"]
  end

  subgraph "Session Time (card advancement)"
    SESS["MM_session<br/>currentCard: 5 of 12"]
  end

  subgraph "Combat Time (6 seconds/tick)"
    SCENE["MM_scene<br/>round: 3"]
  end

  subgraph "Downtime Time (1 day/tick)"
    DT["MM_downtime<br/>day: 4 of 7"]
  end

  subgraph "NPC Time (1 day/tick)"
    NPCT["MM_npc.tick()<br/>loyalty drift, daily cost"]
    FLWRT["MM_followers.dailyTick()<br/>batch all NPCs"]
  end

  ADV -->|"startSession()"| SESS
  ADV -->|"startDowntime(7)"| DT
  SESS -->|"prepareCombat()<br/>spawns pocket manifold"| SCENE
  SCENE -->|"resolveCombat()<br/>collapses back"| SESS
  DT -->|"resolveDowntime()"| ADV
  SESS -->|"endSession()"| ADV
  ADV -->|"daily world tick"| NPCT
  NPCT -->|"per-NPC"| FLWRT
```

## 4. κ Resolution — The Planar Anchor

```mermaid
graph BT
  LL["The Laughing Lich<br/>κ: nothing special"]
  MW["Market Ward<br/>κ: economy.tradeModifier = 1.1"]
  SZ["Suzail<br/>κ: law.enforcement = strict"]
  CO["Cormyr<br/>κ: law.system = Code of Cormyr<br/>economy.currency = Golden Lion"]
  HL["Heartlands<br/>κ: nothing"]
  FA["Faerûn<br/>κ: magic.level = standard<br/>magic.source = The Weave"]
  TO["Toril<br/>κ: physics.gravity = standard"]
  RS["Realmspace<br/>κ: physics.atmosphere = standard"]

  LL --> MW --> SZ --> CO --> HL --> FA --> TO --> RS

  PARTY["🎲 Party + Local Followers"]
  PARTY -.->|"tp.resolve('laughing_lich')"| LL

  GLOBAL["📡 Global Follower (Renaer)"]
  GLOBAL -.->|"at own .tp node"| SZ

  RESOLVED["RESOLVED κ<br/>gravity: standard (Toril)<br/>magic: standard via Weave (Faerûn)<br/>law: strict / Code of Cormyr<br/>economy: Golden Lion, ×1.1 trade<br/><br/>Locally flat. Globally curved."]

  LL -.->|"merge result"| RESOLVED
```

## 5. Data Flow — From MF to .tpb

```mermaid
flowchart TB
  subgraph "MFs — Pure Functions"
    DICE["mf_dice<br/>(d20 + mod → result)"]
    CHECK["mf_check<br/>(roll vs DC → hit/miss)"]
    DMG["mf_damage<br/>(dice → HP change)"]
  end

  subgraph "MMs — Containers"
    COMBAT["mm_combat<br/>(attack = check + damage)"]
    SCENE["mm_scene<br/>(round = N turns)"]
    SESSION["mm_session<br/>(session = N cards)"]
    ADVENTURE["mm_adventure<br/>(campaign = N sessions)"]
    PARTY["mm_party<br/>(party = N characters)"]
    CHAR["mm_character<br/>(raw → derived MF)"]
    FLWR["mm_followers<br/>(local + global NPCs)"]
    NPC["mm_npc<br/>(loyalty + knowledge<br/>+ .tp position)"]
  end

  subgraph "Topology"
    TP[".tp — World Graph<br/>(where things ARE)"]
    TPB[".tpb — History<br/>(what HAPPENED)"]
  end

  DICE --> CHECK --> DMG
  DMG --> COMBAT --> SCENE
  CHAR --> PARTY --> SESSION
  NPC --> FLWR --> ADVENTURE
  SCENE --> SESSION --> ADVENTURE
  PARTY --> ADVENTURE

  TP <-->|"resolve / mutate"| SESSION
  TP -->|"κ rules"| SCENE
  TP <-->|"own"| ADVENTURE
  TP <-->|"position"| FLWR

  COMBAT -->|"receipt"| TPB
  SCENE -->|"round result"| TPB
  SESSION -->|"card + choice"| TPB
  ADVENTURE -->|"session record"| TPB
```

## 6. Complete File Map

| File | Type | Lines | .tp Access | .tpb Access | Contains |
|---|---|---|---|---|---|
| [types.ts](file:///D:/-ttrpg-engine/engine/types.ts) | Foundation | 165 | — | — | CycleDelta, Receipt, ZERO_DELTA |
| [mf-dice.ts](file:///D:/-ttrpg-engine/engine/mf-dice.ts) | MF | 189 | — | — | d20 resolution, deterministic seed |
| [mf-check.ts](file:///D:/-ttrpg-engine/engine/mf-check.ts) | MF | 263 | — | — | Skill/save/attack rolls vs DC |
| [mf-damage.ts](file:///D:/-ttrpg-engine/engine/mf-damage.ts) | MF | 256 | — | — | Damage dice + resistance/vulnerability |
| [mm-combat.ts](file:///D:/-ttrpg-engine/engine/mm-combat.ts) | MM | 303 | — | — | Attack = check + damage pipeline |
| [mm-character.ts](file:///D:/-ttrpg-engine/engine/mm-character.ts) | MM | 472 | — | — | Raw→derived MF, state transitions |
| [mm-npc.ts](file:///D:/-ttrpg-engine/engine/mm-npc.ts) | MM | 482 | **position** | — | NPC: loyalty, disposition, knowledge, .tp |
| [mm-party.ts](file:///D:/-ttrpg-engine/engine/mm-party.ts) | MM | 282 | read | — | Roster, gold, rest orchestration |
| [mm-followers.ts](file:///D:/-ttrpg-engine/engine/mm-followers.ts) | MM | 300 | **read+move** | — | Local + global NPC container |
| [mm-scene.ts](file:///D:/-ttrpg-engine/engine/mm-scene.ts) | MM | 478 | read κ | write | Combat rounds (6s tick pocket) |
| [mm-session.ts](file:///D:/-ttrpg-engine/engine/mm-session.ts) | MM | 611 | **read+write** | write | Scene cards, hooks, combat prep |
| [mm-adventure.ts](file:///D:/-ttrpg-engine/engine/mm-adventure.ts) | MM | 420 | **owns** | owns | Campaign, party, followers, world time |
| [tp.ts](file:///D:/-ttrpg-engine/engine/tp.ts) | TP | 383 | **IS** | — | World graph, κ resolution |
| [tpb.ts](file:///D:/-ttrpg-engine/engine/tpb.ts) | TPB | 231 | — | **IS** | Append-only history, branch/diff |

## Key Insight

> **.tp is the box.** MMs live inside .tp nodes.
>
> **Scale threshold:** Regular NPCs are MMs placed at .tp nodes. Significant entities (Elminster, The Weave) ARE .tp nodes — they're too big to not be topological. Factions are **both**: .tp for territory, MM for behavior.
>
> **Local followers** share the party's .tp node — they move when the party moves, fight when the party fights. **Global followers** sit at their own .tp nodes — their knowledge is gated by their position, not the party's.
>
> When combat starts, a **pocket manifold** spawns. Local followers join as combatants. When combat ends, the pocket collapses back into the session.
