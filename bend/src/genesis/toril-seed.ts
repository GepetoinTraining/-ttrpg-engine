// =============================================================================
// TORIL SEEDING SERVICE
// =============================================================================
//
// Seeds the Forgotten Realms (Toril) with canonical geography.
//
// PURPOSE:
//   - AI cannot hallucinate places that don't exist
//   - Geography constrains what can be precipitated
//   - The wiki is the source of truth
//
// PHILOSOPHY:
//   - We seed the SKELETON, not the flesh
//   - Nodes and edges define what EXISTS
//   - The data_static is sparse - just enough to anchor reality
//   - Wave function collapse fills in details when observed
//
// CANONICAL SOURCES:
//   - Forgotten Realms Wiki (forgottenrealms.fandom.com)
//   - Published 5e sourcebooks
//   - Canonical adventures (Sword Coast Adventurer's Guide, etc.)
//

import { query, queryOne, uuid, now, toJson } from "../db/client";
import type { WorldNodeType, WorldEdgeType } from "../world/graph";

// =============================================================================
// TYPES
// =============================================================================

export interface CanonicalNode {
  id: string;
  name: string;
  type: WorldNodeType;
  parentId?: string;
  wikiUrl?: string;
  alternateNames?: string[];
  description?: string;
  data: Record<string, unknown>;
}

export interface CanonicalEdge {
  fromId: string;
  toId: string;
  type: WorldEdgeType;
  data?: Record<string, unknown>;
}

export interface SeedResult {
  nodesCreated: number;
  edgesCreated: number;
  errors: string[];
}

// =============================================================================
// CANONICAL TORIL STRUCTURE
// =============================================================================
//
// This is the SKELETON of Toril - the canonical geography.
// Not every village, but every place the AI needs to know EXISTS.
//

export const TORIL_SKELETON: CanonicalNode[] = [
  // ==========================================================================
  // COSMIC LEVEL
  // ==========================================================================
  {
    id: "realmspace",
    name: "Realmspace",
    type: "crystal_sphere",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Realmspace",
    description: "The crystal sphere containing Toril and its sun",
    data: {
      sphereType: "standard",
      primaryStar: "The Sun",
    },
  },
  {
    id: "toril",
    name: "Toril",
    type: "planet",
    parentId: "realmspace",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Toril",
    alternateNames: ["Abeir-Toril"],
    description: "The world of the Forgotten Realms",
    data: {
      moons: ["Selûne", "Tears of Selûne"],
      primaryContinent: "faerun",
    },
  },

  // ==========================================================================
  // CONTINENTS
  // ==========================================================================
  {
    id: "faerun",
    name: "Faerûn",
    type: "continent",
    parentId: "toril",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Faer%C3%BBn",
    description: "The main continent of Toril, setting of most Forgotten Realms adventures",
    data: {
      hemisphere: "western",
    },
  },
  {
    id: "kara-tur",
    name: "Kara-Tur",
    type: "continent",
    parentId: "toril",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Kara-Tur",
    description: "The eastern continent, inspired by Asian cultures",
    data: {
      hemisphere: "eastern",
    },
  },
  {
    id: "maztica",
    name: "Maztica",
    type: "continent",
    parentId: "toril",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Maztica",
    description: "The western continent across the Trackless Sea",
    data: {
      hemisphere: "western",
    },
  },
  {
    id: "zakhara",
    name: "Zakhara",
    type: "continent",
    parentId: "toril",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Zakhara",
    description: "The Land of Fate, southern peninsula",
    data: {
      setting: "Al-Qadim",
    },
  },
  {
    id: "anchorome",
    name: "Anchorome",
    type: "continent",
    parentId: "toril",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Anchorome",
    description: "Northern continent west of Faerûn",
    data: {},
  },

  // ==========================================================================
  // FAERÛN - MAJOR REGIONS
  // ==========================================================================

  // THE SWORD COAST (Primary adventuring region)
  {
    id: "sword-coast",
    name: "Sword Coast",
    type: "region",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Sword_Coast",
    alternateNames: ["Sword Coast North"],
    description: "The western coastal region from Waterdeep to Luskan",
    data: {
      climate: "temperate",
      terrain: ["coastal", "forest", "hills"],
    },
  },
  {
    id: "western-heartlands",
    name: "Western Heartlands",
    type: "region",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Western_Heartlands",
    description: "The lands between the Sword Coast and the inner sea",
    data: {
      climate: "temperate",
    },
  },
  {
    id: "the-north",
    name: "The North",
    type: "region",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/The_North",
    alternateNames: ["Savage North", "Savage Frontier"],
    description: "The wild frontier north of Waterdeep",
    data: {
      climate: "cold",
      terrain: ["mountains", "forest", "tundra"],
    },
  },

  // HEARTLANDS
  {
    id: "cormyr",
    name: "Cormyr",
    type: "nation",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Cormyr",
    alternateNames: ["Forest Kingdom", "Land of the Purple Dragon"],
    description: "A powerful feudal kingdom ruled by the Obarskyr dynasty",
    data: {
      government: "monarchy",
      capital: "suzail",
      ruler: "King Azoun V",
    },
  },
  {
    id: "dalelands",
    name: "The Dalelands",
    type: "region",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Dalelands",
    description: "A confederation of small, independent communities",
    data: {
      government: "confederation",
    },
  },
  {
    id: "sembia",
    name: "Sembia",
    type: "nation",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Sembia",
    description: "A merchant nation of ambitious traders",
    data: {
      government: "plutocracy",
    },
  },

  // THE MOONSEA
  {
    id: "moonsea",
    name: "The Moonsea",
    type: "region",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Moonsea",
    description: "A region of dark intrigue centered around the Moonsea",
    data: {
      climate: "cold",
    },
  },

  // SOUTH
  {
    id: "amn",
    name: "Amn",
    type: "nation",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Amn",
    alternateNames: ["Merchant's Domain"],
    description: "A wealthy merchant nation south of the Sword Coast",
    data: {
      government: "plutocracy",
      capital: "athkatla",
    },
  },
  {
    id: "tethyr",
    name: "Tethyr",
    type: "nation",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Tethyr",
    description: "A feudal kingdom recovering from civil war",
    data: {
      government: "monarchy",
    },
  },
  {
    id: "calimshan",
    name: "Calimshan",
    type: "nation",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Calimshan",
    description: "An ancient empire with a legacy of genie rule",
    data: {
      climate: "desert",
      capital: "calimport",
    },
  },

  // EAST
  {
    id: "thay",
    name: "Thay",
    type: "nation",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Thay",
    description: "A magocracy ruled by the Red Wizards",
    data: {
      government: "magocracy",
      capital: "eltabbar",
    },
  },
  {
    id: "rashemen",
    name: "Rashemen",
    type: "nation",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Rashemen",
    description: "A land of powerful witches and berserker warriors",
    data: {
      government: "theocracy",
    },
  },

  // UNDERDARK
  {
    id: "underdark",
    name: "The Underdark",
    type: "region",
    parentId: "faerun",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Underdark",
    description: "The vast network of caverns beneath Faerûn",
    data: {
      depth: "subterranean",
      lightLevel: "darkness",
    },
  },

  // ==========================================================================
  // SWORD COAST - MAJOR SETTLEMENTS
  // ==========================================================================
  {
    id: "waterdeep",
    name: "Waterdeep",
    type: "metropolis",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Waterdeep",
    alternateNames: ["City of Splendors", "Crown of the North"],
    description: "The greatest city of the Sword Coast, a hub of trade and adventure",
    data: {
      population: 130000,
      government: "oligarchy",
      ruler: "The Lords of Waterdeep",
      wards: [
        "Castle Ward", "Sea Ward", "North Ward", "Trades Ward",
        "Southern Ward", "Dock Ward", "City of the Dead",
      ],
    },
  },
  {
    id: "baldurs-gate",
    name: "Baldur's Gate",
    type: "city",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Baldur%27s_Gate",
    alternateNames: ["Gate", "The Gate"],
    description: "A major port city and mercantile power",
    data: {
      population: 125000,
      government: "oligarchy",
      ruler: "Council of Four",
    },
  },
  {
    id: "neverwinter",
    name: "Neverwinter",
    type: "city",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Neverwinter",
    alternateNames: ["Jewel of the North", "City of Skilled Hands"],
    description: "A city known for its skilled craftsmen and warm harbor",
    data: {
      population: 23000,
      government: "lordship",
      ruler: "Lord Dagult Neverember",
    },
  },
  {
    id: "luskan",
    name: "Luskan",
    type: "city",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Luskan",
    alternateNames: ["City of Sails"],
    description: "A lawless port city controlled by pirate captains",
    data: {
      population: 16000,
      government: "oligarchy",
      ruler: "Ship Captains",
    },
  },

  // TOWNS
  {
    id: "phandalin",
    name: "Phandalin",
    type: "town",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Phandalin",
    description: "A frontier town near the Sword Mountains",
    data: {
      population: 400,
      notes: "Setting of Lost Mine of Phandelver",
    },
  },
  {
    id: "triboar",
    name: "Triboar",
    type: "town",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Triboar",
    description: "A crossroads town on the Long Road",
    data: {
      population: 2500,
    },
  },
  {
    id: "red-larch",
    name: "Red Larch",
    type: "town",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Red_Larch",
    description: "A small town in the Dessarin Valley",
    data: {
      population: 600,
      notes: "Setting of Princes of the Apocalypse",
    },
  },
  {
    id: "daggerford",
    name: "Daggerford",
    type: "town",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Daggerford",
    description: "A walled town along the Trade Way",
    data: {
      population: 900,
    },
  },
  {
    id: "leilon",
    name: "Leilon",
    type: "town",
    parentId: "sword-coast",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Leilon",
    description: "A mining town being rebuilt after destruction",
    data: {
      population: 300,
    },
  },

  // ==========================================================================
  // THE NORTH - SETTLEMENTS
  // ==========================================================================
  {
    id: "mirabar",
    name: "Mirabar",
    type: "city",
    parentId: "the-north",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Mirabar",
    description: "The mining capital of the North",
    data: {
      population: 14000,
      exports: ["iron", "silver", "gems"],
    },
  },
  {
    id: "silverymoon",
    name: "Silverymoon",
    type: "city",
    parentId: "the-north",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Silverymoon",
    alternateNames: ["Gem of the North"],
    description: "A center of learning and magic",
    data: {
      population: 37000,
      government: "elected council",
    },
  },
  {
    id: "sundabar",
    name: "Sundabar",
    type: "city",
    parentId: "the-north",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Sundabar",
    description: "A fortified city of dwarves and humans",
    data: {
      population: 14000,
    },
  },
  {
    id: "icewind-dale",
    name: "Icewind Dale",
    type: "region",
    parentId: "the-north",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Icewind_Dale",
    description: "A frigid wasteland at the northernmost reaches",
    data: {
      climate: "arctic",
      settlements: ["ten-towns"],
    },
  },
  {
    id: "ten-towns",
    name: "Ten Towns",
    type: "territory",
    parentId: "icewind-dale",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Ten_Towns",
    description: "A confederation of fishing communities around Maer Dualdon",
    data: {
      towns: [
        "Bryn Shander", "Easthaven", "Caer-Dineval", "Caer-Konig",
        "Dougan's Hole", "Good Mead", "Lonelywood", "Targos", "Termalaine", "Bremen"
      ],
    },
  },

  // ==========================================================================
  // MOONSEA - SETTLEMENTS
  // ==========================================================================
  {
    id: "zhentil-keep",
    name: "Zhentil Keep",
    type: "city",
    parentId: "moonsea",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Zhentil_Keep",
    description: "Former seat of Zhentarim power, now in ruins",
    data: {
      status: "ruined",
      faction: "zhentarim",
    },
  },
  {
    id: "mulmaster",
    name: "Mulmaster",
    type: "city",
    parentId: "moonsea",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Mulmaster",
    description: "A city of intrigue on the Moonsea",
    data: {
      population: 46000,
    },
  },
  {
    id: "phlan",
    name: "Phlan",
    type: "city",
    parentId: "moonsea",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Phlan",
    description: "A city repeatedly destroyed and rebuilt",
    data: {
      population: 8000,
    },
  },

  // ==========================================================================
  // CORMYR - SETTLEMENTS
  // ==========================================================================
  {
    id: "suzail",
    name: "Suzail",
    type: "city",
    parentId: "cormyr",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Suzail",
    description: "The capital of Cormyr",
    data: {
      population: 45000,
      isCapital: true,
    },
  },
  {
    id: "marsember",
    name: "Marsember",
    type: "city",
    parentId: "cormyr",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Marsember",
    alternateNames: ["City of Spices"],
    description: "A port city built on a swamp",
    data: {
      population: 36000,
    },
  },

  // ==========================================================================
  // UNDERDARK - MAJOR LOCATIONS
  // ==========================================================================
  {
    id: "menzoberranzan",
    name: "Menzoberranzan",
    type: "city",
    parentId: "underdark",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Menzoberranzan",
    alternateNames: ["City of Spiders"],
    description: "The greatest drow city, ruled by Lolth's priestesses",
    data: {
      population: 20000,
      race: "drow",
      deity: "Lolth",
    },
  },
  {
    id: "gracklstugh",
    name: "Gracklstugh",
    type: "city",
    parentId: "underdark",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Gracklstugh",
    alternateNames: ["City of Blades"],
    description: "A duergar city known for its forges",
    data: {
      population: 10000,
      race: "duergar",
    },
  },
  {
    id: "blingdenstone",
    name: "Blingdenstone",
    type: "city",
    parentId: "underdark",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Blingdenstone",
    description: "A svirfneblin (deep gnome) city",
    data: {
      population: 2000,
      race: "svirfneblin",
    },
  },

  // ==========================================================================
  // CALIMSHAN - SETTLEMENTS
  // ==========================================================================
  {
    id: "calimport",
    name: "Calimport",
    type: "metropolis",
    parentId: "calimshan",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Calimport",
    description: "The largest city on Toril by population",
    data: {
      population: 192000,
      isCapital: true,
    },
  },

  // ==========================================================================
  // AMN - SETTLEMENTS
  // ==========================================================================
  {
    id: "athkatla",
    name: "Athkatla",
    type: "city",
    parentId: "amn",
    wikiUrl: "https://forgottenrealms.fandom.com/wiki/Athkatla",
    alternateNames: ["City of Coin"],
    description: "The mercantile capital of Amn",
    data: {
      population: 118000,
      isCapital: true,
    },
  },
];

// =============================================================================
// CANONICAL EDGES
// =============================================================================

export const TORIL_EDGES: CanonicalEdge[] = [
  // CONTAINMENT (handled by parentId, but explicit for clarity)

  // MAJOR TRADE ROUTES
  { fromId: "waterdeep", toId: "baldurs-gate", type: "TRADE_ROUTE", data: { name: "Trade Way" } },
  { fromId: "waterdeep", toId: "neverwinter", type: "ROAD", data: { name: "High Road" } },
  { fromId: "neverwinter", toId: "luskan", type: "ROAD", data: { name: "High Road North" } },
  { fromId: "waterdeep", toId: "triboar", type: "ROAD", data: { name: "Long Road" } },
  { fromId: "triboar", toId: "mirabar", type: "ROAD", data: { name: "Long Road North" } },
  { fromId: "triboar", toId: "silverymoon", type: "ROAD", data: { name: "Evermoor Way" } },
  { fromId: "baldurs-gate", toId: "athkatla", type: "TRADE_ROUTE", data: { name: "Trade Way South" } },
  { fromId: "waterdeep", toId: "daggerford", type: "ROAD", data: { name: "Trade Way" } },

  // SEA ROUTES
  { fromId: "waterdeep", toId: "luskan", type: "SEA_ROUTE", data: { name: "Sword Coast Shipping" } },
  { fromId: "waterdeep", toId: "calimport", type: "SEA_ROUTE", data: { name: "Southern Passage" } },
  { fromId: "baldurs-gate", toId: "athkatla", type: "SEA_ROUTE", data: { name: "Western Trade" } },

  // BORDERS
  { fromId: "sword-coast", toId: "western-heartlands", type: "BORDERS" },
  { fromId: "sword-coast", toId: "the-north", type: "BORDERS" },
  { fromId: "cormyr", toId: "dalelands", type: "BORDERS" },
  { fromId: "cormyr", toId: "sembia", type: "BORDERS" },
  { fromId: "amn", toId: "tethyr", type: "BORDERS" },
  { fromId: "tethyr", toId: "calimshan", type: "BORDERS" },

  // POLITICAL
  { fromId: "waterdeep", toId: "neverwinter", type: "ALLIED_WITH", data: { alliance: "Lords' Alliance" } },
  { fromId: "waterdeep", toId: "baldurs-gate", type: "ALLIED_WITH", data: { alliance: "Lords' Alliance" } },
  { fromId: "waterdeep", toId: "silverymoon", type: "ALLIED_WITH", data: { alliance: "Lords' Alliance" } },
  { fromId: "waterdeep", toId: "mirabar", type: "ALLIED_WITH", data: { alliance: "Lords' Alliance" } },

  // UNDERDARK CONNECTIONS
  { fromId: "underdark", toId: "sword-coast", type: "SECRET_CONNECTION", data: { type: "cavern_access" } },
  { fromId: "menzoberranzan", toId: "blingdenstone", type: "AT_WAR_WITH", data: { ongoing: true } },
];

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

/**
 * Seed the full Toril skeleton into a campaign's world
 */
export async function seedToril(campaignId: string): Promise<SeedResult> {
  const result: SeedResult = {
    nodesCreated: 0,
    edgesCreated: 0,
    errors: [],
  };

  // Create nodes
  for (const node of TORIL_SKELETON) {
    try {
      await createWorldNode(campaignId, node);
      result.nodesCreated++;
    } catch (error) {
      result.errors.push(`Node ${node.name}: ${error}`);
    }
  }

  // Create edges
  for (const edge of TORIL_EDGES) {
    try {
      await createWorldEdge(campaignId, edge);
      result.edgesCreated++;
    } catch (error) {
      result.errors.push(`Edge ${edge.fromId}->${edge.toId}: ${error}`);
    }
  }

  // Create CONTAINS edges from parentId relationships
  for (const node of TORIL_SKELETON) {
    if (node.parentId) {
      try {
        await createWorldEdge(campaignId, {
          fromId: node.parentId,
          toId: node.id,
          type: "CONTAINS",
        });
        result.edgesCreated++;
      } catch (error) {
        result.errors.push(`Contains ${node.parentId}->${node.id}: ${error}`);
      }
    }
  }

  return result;
}

/**
 * Seed only a specific region (for partial seeding)
 */
export async function seedRegion(
  campaignId: string,
  regionId: string
): Promise<SeedResult> {
  const result: SeedResult = {
    nodesCreated: 0,
    edgesCreated: 0,
    errors: [],
  };

  // Find nodes that belong to this region
  const regionNodes = TORIL_SKELETON.filter(
    n => n.id === regionId || n.parentId === regionId ||
         TORIL_SKELETON.find(p => p.id === n.parentId)?.parentId === regionId
  );

  for (const node of regionNodes) {
    try {
      await createWorldNode(campaignId, node);
      result.nodesCreated++;
    } catch (error) {
      result.errors.push(`Node ${node.name}: ${error}`);
    }
  }

  // Find edges involving these nodes
  const nodeIds = new Set(regionNodes.map(n => n.id));
  const regionEdges = TORIL_EDGES.filter(
    e => nodeIds.has(e.fromId) || nodeIds.has(e.toId)
  );

  for (const edge of regionEdges) {
    try {
      await createWorldEdge(campaignId, edge);
      result.edgesCreated++;
    } catch (error) {
      result.errors.push(`Edge ${edge.fromId}->${edge.toId}: ${error}`);
    }
  }

  return result;
}

/**
 * Check if a location name is canonical
 */
export function isCanonicalLocation(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return TORIL_SKELETON.some(
    n => n.name.toLowerCase() === normalized ||
         n.alternateNames?.some(alt => alt.toLowerCase() === normalized)
  );
}

/**
 * Find canonical node by name
 */
export function findCanonicalNode(name: string): CanonicalNode | undefined {
  const normalized = name.toLowerCase().trim();
  return TORIL_SKELETON.find(
    n => n.name.toLowerCase() === normalized ||
         n.alternateNames?.some(alt => alt.toLowerCase() === normalized)
  );
}

/**
 * Get all canonical locations in a region
 */
export function getRegionLocations(regionId: string): CanonicalNode[] {
  return TORIL_SKELETON.filter(n => n.parentId === regionId);
}

// =============================================================================
// DATABASE HELPERS
// =============================================================================

async function createWorldNode(
  campaignId: string,
  node: CanonicalNode
): Promise<void> {
  const nodeId = uuid();

  await query(
    `INSERT INTO world_nodes (id, campaign_id, canonical_id, name, type, parent_id, data_static, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (campaign_id, canonical_id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       data_static = excluded.data_static,
       updated_at = excluded.updated_at`,
    [
      nodeId,
      campaignId,
      node.id,
      node.name,
      node.type,
      node.parentId ? await resolveCanonicalId(campaignId, node.parentId) : null,
      toJson({
        wikiUrl: node.wikiUrl,
        alternateNames: node.alternateNames,
        description: node.description,
        canonical: true,
        ...node.data,
      }),
      now(),
      now(),
    ]
  );
}

async function createWorldEdge(
  campaignId: string,
  edge: CanonicalEdge
): Promise<void> {
  const fromNodeId = await resolveCanonicalId(campaignId, edge.fromId);
  const toNodeId = await resolveCanonicalId(campaignId, edge.toId);

  if (!fromNodeId || !toNodeId) {
    throw new Error(`Cannot resolve node IDs for edge ${edge.fromId} -> ${edge.toId}`);
  }

  await query(
    `INSERT INTO world_edges (id, campaign_id, from_node_id, to_node_id, type, data_static, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (campaign_id, from_node_id, to_node_id, type) DO UPDATE SET
       data_static = excluded.data_static,
       updated_at = excluded.updated_at`,
    [
      uuid(),
      campaignId,
      fromNodeId,
      toNodeId,
      edge.type,
      toJson(edge.data || {}),
      now(),
      now(),
    ]
  );
}

async function resolveCanonicalId(
  campaignId: string,
  canonicalId: string
): Promise<string | null> {
  const result = await queryOne<{ id: string }>(
    `SELECT id FROM world_nodes WHERE campaign_id = ? AND canonical_id = ?`,
    [campaignId, canonicalId]
  );

  return result?.id || null;
}

// =============================================================================
// WIKI INTEGRATION (Future enhancement)
// =============================================================================

/**
 * Fetch additional details from Forgotten Realms Wiki
 * This is a placeholder for future wiki API integration
 */
export async function enrichFromWiki(
  canonicalId: string
): Promise<Record<string, unknown> | null> {
  const node = findCanonicalNode(canonicalId);
  if (!node?.wikiUrl) return null;

  // TODO: Implement wiki fetching
  // For now, we rely on the hardcoded data
  return null;
}

export default {
  seedToril,
  seedRegion,
  isCanonicalLocation,
  findCanonicalNode,
  getRegionLocations,
  TORIL_SKELETON,
  TORIL_EDGES,
};
