# Asset Inventory — Tiles + Sprites for Engine Coverage

**For:** Claude Design (next handoff)
**From:** Engine side
**Goal:** A complete enumeration of every tile and sprite the engine surfaces need. Track what the design package already covers and what's still missing.

---

## Architecture rule

The engine is silent — it produces deterministic data; the design renders it. Tiles and sprites are **purely visual** layers over engine state. The renderer never invents content; it picks the right asset for the data it received.

Asset categories:
1. **Terrain tiles** — the ground a player stands on (biome-aware)
2. **Interior tiles** — dungeon floors / walls / structural
3. **Hub tiles** — buildings, streets, infrastructure (city interior)
4. **Decoration tiles** — non-blocking flavor (rocks, plants, debris)
5. **Interactive tiles** — chests, doors, levers, altars, traps
6. **Entity sprites** — PCs, NPCs, mobs, fauna, herds (chip + portrait variants)
7. **Effect overlays** — weather, lighting, AoE, status icons

---

## Already in design package

**11 biome / interior tile kinds** (in `surfaces/_ds/TileWorld.jsx`):

| Tile kind | Use |
|---|---|
| `grass` `forest` `road` `dirt` `sand` `water` `shallow` `stone` | Outdoor biomes |
| `tunnel` `cavern` `oreVein` | Underground |
| `floorWood` `floorStone` `wall` `door` `hidden_door` `hidden_passage` `stairs_up` `stairs_down` | Dungeon interior |
| `chest_closed` `bookshelf` `desk` `barrel` `sarcophagus` `crate` | Interactive furnishings |

**81 sprite SVGs** (in `public/sprites/`):

| Folder | Files |
|---|---|
| `decoration/` (12) | bones, cobweb, crystal-cluster ×2, flower-patch ×2, mushroom ×2, rug-pattern ×2, sign-post, tree-stump |
| `doors/` (7) | door-iron ×2, door-magical, door-secret, door-wood ×2, portcullis |
| `hazards/` (17) | arrow-slit, dart-trap, falling-block, fire-jet, gas, glyph ×3, ice-floor, illusion-floor, pit-open, pressure-plate, spike-pit, symbol ×2, tripwire, web |
| `lighting/` (6) | candle, lantern, magical-orb, sunshaft, torch ×2 |
| `objects/` (39) | altar ×2, bed ×2, bookshelf ×2, brazier-cold, brazier-lit ×2, button, cage, chair ×2, chest-closed ×3, chest-open ×2, corpse ×2, crate ×2, fountain ×2, lever-up, lever-down, pillar ×2, rubble ×2, rune ×3, statue ×3, table ×3 |

---

## 1. Terrain tiles — biome system

The engine's `BiomeType` (from [`src/game/biome.ts`](src/game/biome.ts)) defines 11 biomes the world generator uses. Map each to one or more tile renderers.

| BiomeType | Existing tile | Tiles needed |
|---|---|---|
| `ocean` | — | **MISSING**: `deepWater` (wave animation, dark blue), `whitecap` (storm variant) |
| `coast` | `sand`, `shallow` | ✓ covered (sand transitions to shallow) |
| `plains` | `grass` | ✓ covered + maybe `tallGrass` variant for movement-cost tiles |
| `forest` | `forest` | ✓ covered |
| `dense_forest` | — | **MISSING**: `denseForest` (heavier canopy, low visibility tile variant) |
| `hills` | `dirt`, `stone` | partial — **MISSING**: `hillside` (slope blend), `meadow` |
| `mountains` | `stone` | partial — **MISSING**: `cliff` (impassable), `peak` (snow-cap), `scree` |
| `desert` | `sand` | partial — **MISSING**: `duneSand` (parallel ridges), `cracked_clay`, `oasis` (sand+water) |
| `swamp` | — | **MISSING**: `marsh` (mud+reeds), `bog` (impassable mud), `mangrove` |
| `tundra` | — | **MISSING**: `tundra` (frozen grass), `permafrost` (cracked ground) |
| `snow` | — | **MISSING**: `snow` (white drift), `ice` (frozen water tile), `glacier` |

**Additional terrain not bound to a single biome:**
- `lava` (volcanic), `ashfield` (post-eruption), `salt_flat` (desert basin)
- `riverbank`, `ford` (shallow water + sand), `bridge_wood`, `bridge_stone`
- `farmland` (plowed dirt), `pasture` (cropped grass), `vineyard`, `orchard_row`
- `cobblestone_road`, `paved_road`, `rural_path`, `mountain_pass`
- `ruined_floor` (overgrown stone), `cracked_earth`

---

## 2. Interior tiles — dungeon system

The engine's `TileType` (from [`engine/dungeon-stamp.ts`](engine/dungeon-stamp.ts)) defines:
`floor` `wall` `door` `pillar` `pit` `water` `rubble` `altar` `chest` `rune` `stairs_up` `stairs_down`

| TileType | Existing tile | Status |
|---|---|---|
| `floor` | `floorStone` | ✓ |
| `wall` | `wall` | ✓ |
| `door` | `door` (+hidden_door) | ✓ |
| `pit` | hazard sprites cover | ✓ |
| `water` | `water` | ✓ (indoor pool variant nice-to-have) |
| `pillar` `altar` `chest` `rune` | object sprites cover | ✓ |
| `rubble` | object sprite | ✓ |
| `stairs_up` `stairs_down` | tile renderers | ✓ |

**Variants needed for richer dungeons:**
- `floor_mossy`, `floor_bloodstained`, `floor_cracked`, `floor_broken_tile`, `floor_dirt`
- `wall_dressed` (cut stone), `wall_rough` (cave), `wall_painted_relief`, `wall_brick`, `wall_natural` (cavern)
- `lava_floor`, `ice_floor` (already in hazards), `acid_floor`
- `bridge_chasm` (over pit), `trapdoor`, `grate`

---

## 3. Hub tiles — settlements & cities

The engine's `BuildingType` (from [`engine/hub-schema.ts`](engine/hub-schema.ts)) defines **30 building types** + 6 infrastructure types. Each needs an exterior tile sprite (top-down) AND an interior layout (the hub equivalent of the dungeon's room interior).

### Building exteriors (chunk-tile sized, 1–4 tiles per building)

| Category | Types | Notes |
|---|---|---|
| **Residential** | `hovel` `house` `townhouse` `manor` `apartment` | Scale + ornament increases up the ladder |
| **Commercial** | `shop` `market_stall` `warehouse` `inn` `tavern` `restaurant` `bank` `guildhall` | Distinct silhouettes; signs/banners on top |
| **Industrial** | `smithy` `tannery` `mill` `workshop` `brewery` | Smokestacks, water-wheels, vat steam |
| **Religious** | `temple` `shrine` `monastery` | Domed/spired silhouettes |
| **Civic** | `town_hall` `courthouse` `prison` `barracks` `guardhouse` `gatehouse` `tower` | Crenellation, banners, large doors |
| **Special** | `library` `school` `hospital` `theater` `arena` `bathhouse` `stable` `dock` | Each has its own distinct top-down icon |
| **Infrastructure** | `well` `fountain` `bridge` `wall_section` | Single-tile or short-line tiles |

### District-aware tile palettes

Per [`engine/hub-schema.ts`](engine/hub-schema.ts) districts: `center` `residential` `commercial` `industrial` `religious` `administrative` `noble` `slums`

Each district biases:
- **Material**: noble → marble + gold trim; slums → wood + mud; industrial → soot + iron
- **Density**: noble → spaced manors with gardens; slums → packed shanties; commercial → close shops
- **Color**: noble pale stone, slums dark mud, religious cream/gold, industrial grey-black

A **single `building_<type>` tile per type with a `district` modifier** (8 district color/wear variants) keeps the asset count tractable: ~30 base × 8 = 240 variants, or share base sprites and apply CSS-style filters.

### Streets & infrastructure

`HubStreet.material`: `cobblestone` `dirt` `gravel` `wooden`
`HubStreet.type`: `main` `side` `alley` `path` (drives width: 3 / 2 / 1 / 1 tiles)

Tiles needed:
- `street_cobblestone`, `street_dirt`, `street_gravel`, `street_wooden_plank`
- `street_intersection_cobble`, `street_corner` (auto-tiling per neighbor)
- `plaza_paved` (large open space), `marketplace_stalls` (clustered tile group)
- `garden`, `vineyard`, `orchard` (already covered above as terrain)
- `cemetery_grave_row`, `cemetery_mausoleum`
- `dock_pier`, `dock_warehouse`, `boat_small`, `boat_fishing`, `boat_trade`

---

## 4. Ecology decorations — outdoor objects

The design's `decoration/` folder has 12 generic decorations. The engine's ecology + biome system needs more.

### Trees (per biome)

| Biome | Tree types |
|---|---|
| Plains | `tree_oak`, `tree_ash`, `tree_apple` (orchards) |
| Forest | `tree_pine`, `tree_birch`, `tree_maple`, `tree_oak_old` |
| Dense forest | `tree_oak_giant`, `tree_redwood`, `vine_tangle` |
| Tundra/Snow | `tree_pine_snow`, `tree_dead`, `tree_birch_snow` |
| Swamp | `tree_mangrove`, `tree_willow_dead`, `tree_cypress` |
| Desert | `palm_tree`, `cactus_saguaro`, `cactus_barrel`, `joshua_tree` |
| Coastal | `palm_tree`, `mangrove`, `driftwood` |
| Mountains | `tree_pine_mountain`, `tree_alpine` |

### Flora & ground cover

- `bush`, `bush_berry`, `bush_thorny`, `reeds`, `tall_grass`, `wildflowers`
- `mushroom_cluster`, `mushroom_giant` (ecology has these)
- `boulder_small`, `boulder_large`, `rock_outcrop`, `log_fallen`
- `crystal_outcrop` (per ore type — partially covered by `crystal-cluster` sprites)
- `lichen_patch`, `moss_patch`, `vine_climbing`

### Bodies of water

- `pond`, `stream`, `waterfall`, `geyser`, `hot_spring`, `oasis_palm`
- `mineshaft_entrance` (industrial + ecology)

### Worked ground

- `farm_furrow` (plowed), `farm_planted_grain`, `farm_planted_root`, `farm_fallow`
- `pasture_fence`, `barn_small`
- `quarry_pit`, `mine_entrance`, `lumber_camp`

---

## 5. Entity sprites — by kingdom + species

The engine's `engine/biome-fauna.ts` defines species in 4 kingdoms: `humanoid`, `beast`, `undead`, `planar`, plus `aberrant`. Each species needs a chip variant (32×32) and a portrait variant (96×96).

### Humanoid (10 species — already mostly listed in fauna)

`goblin` `kobold` `orc` `gnoll` `lizardfolk` `bandit` `ogre` `troll` + extras: `cultist` `mercenary` `noble_guard` `peasant` `priest` `merchant` `artisan` `child` `elder` `beggar`

### Beast (12+ species)

`wolf` `wolf_pack` `bear` `mountain_lion` `alligator` `giant_spider` `scorpion_swarm` `ice_bear` `arctic_wolf` + extras for ecology: `deer` `boar` `rabbit` `fox` `hawk` `owl` `eagle` `vulture` `crow` `raven` `bat` `rat_giant` `serpent` `crocodile` `whale` `seal`

### Undead (4 species)

`skeleton` `wight` `mummy` `ghoul` + extras: `zombie` `wraith` `lich` `vampire_thrall` `vampire` `ghost`

### Planar (4 species)

`dretch` `shadow` `fire_elemental` `water_elemental` + extras: `earth_elemental` `air_elemental` `imp` `succubus` `balor` `unicorn` `dryad` `treant`

### Aberrant (3 species)

`gibbering_mouther` `nothic` `blighted` + extras: `mind_flayer` `beholder` `aboleth`

### Additional categories

- **Constructs**: `golem_stone` `golem_iron` `golem_clay` `animated_armor`
- **Dragons**: chromatic ×5 (red, blue, green, white, black) + metallic ×5 (gold, silver, copper, brass, bronze) + age categories (wyrmling, young, adult, ancient)
- **Giants**: `giant_hill` `giant_stone` `giant_frost` `giant_fire` `giant_cloud` `giant_storm`
- **Slimes**: `slime_green` `slime_red` `cube_gelatinous`

### Domesticated herds (from [`engine/husbandry.ts`](engine/husbandry.ts))

`cattle` `sheep` `goats` `pigs` `chickens` `horses` `giant_goats` — for each, **3 age tiers**: young, adult, elder. So ~21 sprites for herds alone.

### PC tokens (12 classes × 4 portrait variants = 48 needed)

Classes (D&D 5e): `fighter` `wizard` `rogue` `cleric` `ranger` `paladin` `monk` `druid` `sorcerer` `warlock` `barbarian` `bard` (+ `artificer` if optional). Each gets:
- 1 chip (silhouette + class glyph)
- 4 portrait variants (race × gender mix; not all combinations, just enough variety)

Race coloring as a CSS modifier on a base PC chip, not a separate sprite per race.

### NPC role tokens (~20 needed)

`merchant` `guard` `peasant` `noble` `priest` `blacksmith` `alchemist` `healer` `scribe` `bard` `beggar` `child` `elder` `ruler` `captain` `courtesan` `innkeeper` `farmer` `fisherman` `craftsman`

---

## 6. Interactive tiles & objects

Most are covered by the design's `objects/` and `hazards/` folders. Gaps:

- `npc_marker` (generic placeholder when sprite isn't ready)
- `item_drop` (generic loot pile on the floor)
- `currency_pile` (small / medium / large heap of coins)
- `weapon_rack`, `armor_stand` (commonly looted in barracks/temples)
- `fish_caught` (on a dock pier — visual feedback for fishing)
- `forge_active` (smithy), `forge_idle`
- `loom`, `spinning_wheel`, `kiln` (workshops)
- `gallows`, `pillory` (criminal punishment)
- `signpost` (already covered by `sign-post.svg`)

---

## 7. Effect overlays

### Weather (likely already in design's `WeatherOverlay.jsx`)

`rain` `snow` `fog` `lightning` `dust_storm` `ash_fall` `hail` `clear` `overcast` — verify the design package's coverage.

### Lighting (already in `lighting/` folder)

✓ candle, lantern, magical-orb, sunshaft, torch — covered. Add: `daylight_shaft` (window light), `moonlight`, `dim_glow`.

### Combat AoE (handled in TileWorld AoE overlay, not as sprites)

Shapes: sphere/cube/cone/line/cylinder. Element tints: fire, cold, lightning, acid, poison, necrotic, radiant, force, psychic, thunder, healing — all parameterized in TileWorld. No new sprites needed; just confirm the element color palette.

### Status icons (D&D 5e conditions)

Small chip icons (16×16) for: `poisoned` `burned` `frozen` `prone` `stunned` `blinded` `charmed` `frightened` `restrained` `grappled` `paralyzed` `petrified` `exhausted` `unconscious` `incapacitated` `invisible` `deafened`

### Material adaptation glyphs (already exist in `_adaptations.jsx`)

✓ ARMORED ◧, SWIFT », PACK ⁂, REGEN ↻, STEALTH ◐, REFLECT ◇, DRAIN ◍, SPLIT ⋈, ADAPT ✱, CUNNING ∴ — covered.

---

## Priority order for the next design pass

**P0 — Hubs/Cities (Pedro's next ask):**
1. 30 building exterior tiles (one per BuildingType)
2. 4 street material tiles (cobblestone/dirt/gravel/wooden)
3. District color modifiers (8 districts)
4. City wall + gatehouse tiles

**P1 — Ecology fillers (the ecology + sprites push):**
1. Trees per biome (~24 tree variants)
2. Herds × 7 species × 3 age = 21 herd sprites
3. Wild fauna (~30 beast species)
4. Crops + farmland tiles (5–8)

**P2 — Mob roster expansion:**
1. Humanoid extras (mercenary, cultist, etc.)
2. Undead expansion (zombie, lich, vampire)
3. Planar expansion (elementals, demons, fey)
4. Constructs + golems

**P3 — Polish / optional:**
1. Floor variants (mossy, bloodstained, broken)
2. Wall variants (dressed, rough, painted)
3. Status condition icons (D&D 5e)
4. PC class chips × 12 + portrait variants

---

## Asset format requirements (for design pass)

- **Tiles**: SVG, 100×100 viewBox (matches `TileWorld.jsx` convention). Include 8-neighbor variants for tiles that auto-tile (terrain, streets, walls).
- **Sprites (chip)**: SVG, 32×32 viewBox. Single-color silhouette + 1–2 accent colors. Driven by `entity.sprite_entity.color`.
- **Sprites (portrait)**: SVG, 96×96 viewBox. Detailed pose, used in side panels and combat.
- **Icons (status)**: SVG, 16×16 viewBox. Single-color glyph.

Naming convention: `kebab-case-with-hyphens.svg` (matches existing). Place in `public/sprites/<category>/<asset>.svg`.

---

## Engine concept → asset cheat sheet

When a concept lands in the engine, this is what it needs visually:

| Engine concept | Tiles | Sprites |
|---|---|---|
| `BiomeType` (11 biomes) | 11–20 terrain tiles + auto-tile variants | — |
| `HubBuilding.type` (30) | 30 building exteriors | — |
| `HubStreet.material` (4) | 4 street tiles | — |
| `DungeonRoom.type` (10) | (uses tiles already) | — |
| `Species` (fauna + herds, ~50) | — | 50 chips + 50 portraits |
| `BuildingType` interior | (use dungeon tiles) | (use NPC sprites) |
| `Adaptation` (10) | — | 10 glyphs (already done) |
| `WeatherState` | overlays (already done) | — |
| `Condition` (D&D 5e, ~16) | — | 16 status icons |
| PC class (12) | — | 12 chips + 48 portraits |
| NPC role (~20) | — | 20 chips + 20 portraits |

**Total asset target for full coverage**: ~120 tiles + ~250 sprites (including age/age-class variants).

The design package currently ships ~25 tiles + 81 sprites — about 25% coverage. Most P0/P1 items are net-new; the rest are variants and polish.
