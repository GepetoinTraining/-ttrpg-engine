/**
 * D&D 5e SRD equipment catalog — weapons, armor, gear, packs.
 *
 * Open-game-license content. Used by:
 *   - Chargen StepEquipment (V1: starting kits already iterate this)
 *   - Future: DB-backed search/buy at character creation (V2 — roll
 *     starting gold and spend it from this catalog)
 *   - Future: in-world shops, loot tables, crafting recipes
 *
 * Data shape mirrors the `items` + `weapon_stats` + `armor_stats` tables
 * in `src/db/schema.ts` so a seed script can copy these rows into a
 * canonical `equipment_catalog` table without translation.
 */

export type EquipmentCategory =
  | 'weapon-simple-melee'
  | 'weapon-simple-ranged'
  | 'weapon-martial-melee'
  | 'weapon-martial-ranged'
  | 'armor-light'
  | 'armor-medium'
  | 'armor-heavy'
  | 'shield'
  | 'gear'
  | 'pack'
  | 'tool'
  | 'mount-vehicle'
  | 'misc'

export type DamageType =
  | 'bludgeoning' | 'piercing' | 'slashing'
  | 'acid' | 'cold' | 'fire' | 'force' | 'lightning'
  | 'necrotic' | 'poison' | 'psychic' | 'radiant' | 'thunder'

export interface WeaponSpec {
  damage: string         // e.g. "1d8", "2d6"
  damageType: DamageType
  /** finesse, light, heavy, two-handed, versatile (1d10), reach, thrown (20/60), ammunition (80/320), loading, special */
  properties: string[]
  rangeNormal?: number   // feet, for thrown/ranged
  rangeLong?: number
}

export interface ArmorSpec {
  acBonus: number          // for shield: +2; for armor: base AC value
  baseAC?: number          // for armor types: 11+DEX (light), 14+DEX cap 2 (med), 18 (heavy)
  armorClass?: 'light' | 'medium' | 'heavy' | 'shield'
  stealthDisadvantage?: boolean
  strengthRequired?: number
  donTime?: string         // "1 action", "1 minute", "5 minutes", "10 minutes"
}

export interface PackContents {
  /** Items bundled into the pack; quantities embedded in name as needed. */
  items: string[]
}

export interface CatalogItem {
  /** Unique key — used for DB row id when seeded. */
  key: string
  name: string
  category: EquipmentCategory
  valueGP: number          // cost in gold pieces (CP / SP folded in)
  weight: number           // pounds
  description?: string
  weapon?: WeaponSpec
  armor?: ArmorSpec
  pack?: PackContents
}

// ════════════════════════════════════════════════════════════════════
// SIMPLE WEAPONS — anyone proficient with simple weapons can use these
// ════════════════════════════════════════════════════════════════════

const SIMPLE_MELEE: CatalogItem[] = [
  { key: 'club',         name: 'Club',         category: 'weapon-simple-melee', valueGP: 0.1, weight: 2,
    weapon: { damage: '1d4', damageType: 'bludgeoning', properties: ['light'] } },
  { key: 'dagger',       name: 'Dagger',       category: 'weapon-simple-melee', valueGP: 2,   weight: 1,
    weapon: { damage: '1d4', damageType: 'piercing', properties: ['finesse', 'light', 'thrown'], rangeNormal: 20, rangeLong: 60 } },
  { key: 'greatclub',    name: 'Greatclub',    category: 'weapon-simple-melee', valueGP: 0.2, weight: 10,
    weapon: { damage: '1d8', damageType: 'bludgeoning', properties: ['two-handed'] } },
  { key: 'handaxe',      name: 'Handaxe',      category: 'weapon-simple-melee', valueGP: 5,   weight: 2,
    weapon: { damage: '1d6', damageType: 'slashing', properties: ['light', 'thrown'], rangeNormal: 20, rangeLong: 60 } },
  { key: 'javelin',      name: 'Javelin',      category: 'weapon-simple-melee', valueGP: 0.5, weight: 2,
    weapon: { damage: '1d6', damageType: 'piercing', properties: ['thrown'], rangeNormal: 30, rangeLong: 120 } },
  { key: 'light-hammer', name: 'Light hammer', category: 'weapon-simple-melee', valueGP: 2,   weight: 2,
    weapon: { damage: '1d4', damageType: 'bludgeoning', properties: ['light', 'thrown'], rangeNormal: 20, rangeLong: 60 } },
  { key: 'mace',         name: 'Mace',         category: 'weapon-simple-melee', valueGP: 5,   weight: 4,
    weapon: { damage: '1d6', damageType: 'bludgeoning', properties: [] } },
  { key: 'quarterstaff', name: 'Quarterstaff', category: 'weapon-simple-melee', valueGP: 0.2, weight: 4,
    weapon: { damage: '1d6', damageType: 'bludgeoning', properties: ['versatile (1d8)'] } },
  { key: 'sickle',       name: 'Sickle',       category: 'weapon-simple-melee', valueGP: 1,   weight: 2,
    weapon: { damage: '1d4', damageType: 'slashing', properties: ['light'] } },
  { key: 'spear',        name: 'Spear',        category: 'weapon-simple-melee', valueGP: 1,   weight: 3,
    weapon: { damage: '1d6', damageType: 'piercing', properties: ['thrown', 'versatile (1d8)'], rangeNormal: 20, rangeLong: 60 } },
]

const SIMPLE_RANGED: CatalogItem[] = [
  { key: 'crossbow-light', name: 'Light crossbow', category: 'weapon-simple-ranged', valueGP: 25,  weight: 5,
    weapon: { damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'loading', 'two-handed'], rangeNormal: 80, rangeLong: 320 } },
  { key: 'dart',           name: 'Dart',           category: 'weapon-simple-ranged', valueGP: 0.05, weight: 0.25,
    weapon: { damage: '1d4', damageType: 'piercing', properties: ['finesse', 'thrown'], rangeNormal: 20, rangeLong: 60 } },
  { key: 'shortbow',       name: 'Shortbow',       category: 'weapon-simple-ranged', valueGP: 25,  weight: 2,
    weapon: { damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'two-handed'], rangeNormal: 80, rangeLong: 320 } },
  { key: 'sling',          name: 'Sling',          category: 'weapon-simple-ranged', valueGP: 0.1, weight: 0,
    weapon: { damage: '1d4', damageType: 'bludgeoning', properties: ['ammunition'], rangeNormal: 30, rangeLong: 120 } },
]

// ════════════════════════════════════════════════════════════════════
// MARTIAL WEAPONS — fighters / paladins / rangers / barbarians
// ════════════════════════════════════════════════════════════════════

const MARTIAL_MELEE: CatalogItem[] = [
  { key: 'battleaxe',     name: 'Battleaxe',     category: 'weapon-martial-melee', valueGP: 10, weight: 4,
    weapon: { damage: '1d8', damageType: 'slashing', properties: ['versatile (1d10)'] } },
  { key: 'flail',         name: 'Flail',         category: 'weapon-martial-melee', valueGP: 10, weight: 2,
    weapon: { damage: '1d8', damageType: 'bludgeoning', properties: [] } },
  { key: 'glaive',        name: 'Glaive',        category: 'weapon-martial-melee', valueGP: 20, weight: 6,
    weapon: { damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two-handed'] } },
  { key: 'greataxe',      name: 'Greataxe',      category: 'weapon-martial-melee', valueGP: 30, weight: 7,
    weapon: { damage: '1d12', damageType: 'slashing', properties: ['heavy', 'two-handed'] } },
  { key: 'greatsword',    name: 'Greatsword',    category: 'weapon-martial-melee', valueGP: 50, weight: 6,
    weapon: { damage: '2d6', damageType: 'slashing', properties: ['heavy', 'two-handed'] } },
  { key: 'halberd',       name: 'Halberd',       category: 'weapon-martial-melee', valueGP: 20, weight: 6,
    weapon: { damage: '1d10', damageType: 'slashing', properties: ['heavy', 'reach', 'two-handed'] } },
  { key: 'lance',         name: 'Lance',         category: 'weapon-martial-melee', valueGP: 10, weight: 6,
    weapon: { damage: '1d12', damageType: 'piercing', properties: ['reach', 'special'] } },
  { key: 'longsword',     name: 'Longsword',     category: 'weapon-martial-melee', valueGP: 15, weight: 3,
    weapon: { damage: '1d8', damageType: 'slashing', properties: ['versatile (1d10)'] } },
  { key: 'maul',          name: 'Maul',          category: 'weapon-martial-melee', valueGP: 10, weight: 10,
    weapon: { damage: '2d6', damageType: 'bludgeoning', properties: ['heavy', 'two-handed'] } },
  { key: 'morningstar',   name: 'Morningstar',   category: 'weapon-martial-melee', valueGP: 15, weight: 4,
    weapon: { damage: '1d8', damageType: 'piercing', properties: [] } },
  { key: 'pike',          name: 'Pike',          category: 'weapon-martial-melee', valueGP: 5,  weight: 18,
    weapon: { damage: '1d10', damageType: 'piercing', properties: ['heavy', 'reach', 'two-handed'] } },
  { key: 'rapier',        name: 'Rapier',        category: 'weapon-martial-melee', valueGP: 25, weight: 2,
    weapon: { damage: '1d8', damageType: 'piercing', properties: ['finesse'] } },
  { key: 'scimitar',      name: 'Scimitar',      category: 'weapon-martial-melee', valueGP: 25, weight: 3,
    weapon: { damage: '1d6', damageType: 'slashing', properties: ['finesse', 'light'] } },
  { key: 'shortsword',    name: 'Shortsword',    category: 'weapon-martial-melee', valueGP: 10, weight: 2,
    weapon: { damage: '1d6', damageType: 'piercing', properties: ['finesse', 'light'] } },
  { key: 'trident',       name: 'Trident',       category: 'weapon-martial-melee', valueGP: 5,  weight: 4,
    weapon: { damage: '1d6', damageType: 'piercing', properties: ['thrown', 'versatile (1d8)'], rangeNormal: 20, rangeLong: 60 } },
  { key: 'war-pick',      name: 'War pick',      category: 'weapon-martial-melee', valueGP: 5,  weight: 2,
    weapon: { damage: '1d8', damageType: 'piercing', properties: [] } },
  { key: 'warhammer',     name: 'Warhammer',     category: 'weapon-martial-melee', valueGP: 15, weight: 2,
    weapon: { damage: '1d8', damageType: 'bludgeoning', properties: ['versatile (1d10)'] } },
  { key: 'whip',          name: 'Whip',          category: 'weapon-martial-melee', valueGP: 2,  weight: 3,
    weapon: { damage: '1d4', damageType: 'slashing', properties: ['finesse', 'reach'] } },
]

const MARTIAL_RANGED: CatalogItem[] = [
  { key: 'blowgun',         name: 'Blowgun',         category: 'weapon-martial-ranged', valueGP: 10, weight: 1,
    weapon: { damage: '1', damageType: 'piercing', properties: ['ammunition', 'loading'], rangeNormal: 25, rangeLong: 100 } },
  { key: 'crossbow-hand',   name: 'Hand crossbow',   category: 'weapon-martial-ranged', valueGP: 75, weight: 3,
    weapon: { damage: '1d6', damageType: 'piercing', properties: ['ammunition', 'light', 'loading'], rangeNormal: 30, rangeLong: 120 } },
  { key: 'crossbow-heavy',  name: 'Heavy crossbow',  category: 'weapon-martial-ranged', valueGP: 50, weight: 18,
    weapon: { damage: '1d10', damageType: 'piercing', properties: ['ammunition', 'heavy', 'loading', 'two-handed'], rangeNormal: 100, rangeLong: 400 } },
  { key: 'longbow',         name: 'Longbow',         category: 'weapon-martial-ranged', valueGP: 50, weight: 2,
    weapon: { damage: '1d8', damageType: 'piercing', properties: ['ammunition', 'heavy', 'two-handed'], rangeNormal: 150, rangeLong: 600 } },
  { key: 'net',             name: 'Net',             category: 'weapon-martial-ranged', valueGP: 1,  weight: 3,
    weapon: { damage: '0', damageType: 'bludgeoning', properties: ['special', 'thrown'], rangeNormal: 5, rangeLong: 15 } },
]

// ════════════════════════════════════════════════════════════════════
// ARMOR + SHIELDS
// ════════════════════════════════════════════════════════════════════

const ARMOR: CatalogItem[] = [
  // Light: AC = 11 + DEX (no cap)
  { key: 'padded',         name: 'Padded armor',   category: 'armor-light',  valueGP: 5,    weight: 8,
    armor: { acBonus: 11, baseAC: 11, armorClass: 'light', stealthDisadvantage: true, donTime: '1 minute' } },
  { key: 'leather',        name: 'Leather armor',  category: 'armor-light',  valueGP: 10,   weight: 10,
    armor: { acBonus: 11, baseAC: 11, armorClass: 'light', donTime: '1 minute' } },
  { key: 'studded-leather', name: 'Studded leather', category: 'armor-light', valueGP: 45,  weight: 13,
    armor: { acBonus: 12, baseAC: 12, armorClass: 'light', donTime: '1 minute' } },

  // Medium: AC = base + DEX (cap 2)
  { key: 'hide',          name: 'Hide armor',     category: 'armor-medium', valueGP: 10,   weight: 12,
    armor: { acBonus: 12, baseAC: 12, armorClass: 'medium', donTime: '1 minute' } },
  { key: 'chain-shirt',   name: 'Chain shirt',    category: 'armor-medium', valueGP: 50,   weight: 20,
    armor: { acBonus: 13, baseAC: 13, armorClass: 'medium', donTime: '1 minute' } },
  { key: 'scale-mail',    name: 'Scale mail',     category: 'armor-medium', valueGP: 50,   weight: 45,
    armor: { acBonus: 14, baseAC: 14, armorClass: 'medium', stealthDisadvantage: true, donTime: '1 minute' } },
  { key: 'breastplate',   name: 'Breastplate',    category: 'armor-medium', valueGP: 400,  weight: 20,
    armor: { acBonus: 14, baseAC: 14, armorClass: 'medium', donTime: '1 minute' } },
  { key: 'half-plate',    name: 'Half plate',     category: 'armor-medium', valueGP: 750,  weight: 40,
    armor: { acBonus: 15, baseAC: 15, armorClass: 'medium', stealthDisadvantage: true, donTime: '5 minutes' } },

  // Heavy: AC = fixed (no DEX)
  { key: 'ring-mail',     name: 'Ring mail',      category: 'armor-heavy',  valueGP: 30,   weight: 40,
    armor: { acBonus: 14, baseAC: 14, armorClass: 'heavy', stealthDisadvantage: true, donTime: '5 minutes' } },
  { key: 'chain-mail',    name: 'Chain mail',     category: 'armor-heavy',  valueGP: 75,   weight: 55,
    armor: { acBonus: 16, baseAC: 16, armorClass: 'heavy', stealthDisadvantage: true, strengthRequired: 13, donTime: '5 minutes' } },
  { key: 'splint',        name: 'Splint armor',   category: 'armor-heavy',  valueGP: 200,  weight: 60,
    armor: { acBonus: 17, baseAC: 17, armorClass: 'heavy', stealthDisadvantage: true, strengthRequired: 15, donTime: '10 minutes' } },
  { key: 'plate',         name: 'Plate armor',    category: 'armor-heavy',  valueGP: 1500, weight: 65,
    armor: { acBonus: 18, baseAC: 18, armorClass: 'heavy', stealthDisadvantage: true, strengthRequired: 15, donTime: '10 minutes' } },

  // Shield
  { key: 'shield',        name: 'Shield',         category: 'shield',       valueGP: 10,   weight: 6,
    armor: { acBonus: 2, armorClass: 'shield', donTime: '1 action' } },
]

// ════════════════════════════════════════════════════════════════════
// ADVENTURING GEAR
// ════════════════════════════════════════════════════════════════════

const GEAR: CatalogItem[] = [
  { key: 'backpack',         name: 'Backpack',                 category: 'gear', valueGP: 2,   weight: 5 },
  { key: 'bedroll',          name: 'Bedroll',                  category: 'gear', valueGP: 1,   weight: 7 },
  { key: 'blanket',          name: 'Blanket',                  category: 'gear', valueGP: 0.5, weight: 3 },
  { key: 'candle',           name: 'Candle',                   category: 'gear', valueGP: 0.01, weight: 0,  description: 'Burns 1 hour. Sheds bright light 5ft, dim light 5ft.' },
  { key: 'caltrops',         name: 'Caltrops (bag of 20)',     category: 'gear', valueGP: 1,   weight: 2 },
  { key: 'chain-10ft',       name: 'Chain (10 ft.)',           category: 'gear', valueGP: 5,   weight: 10 },
  { key: 'chest',            name: 'Chest',                    category: 'gear', valueGP: 5,   weight: 25 },
  { key: 'climbers-kit',     name: "Climber's kit",            category: 'tool', valueGP: 25,  weight: 12 },
  { key: 'crowbar',          name: 'Crowbar',                  category: 'gear', valueGP: 2,   weight: 5,  description: 'Advantage on STR checks where leverage applies.' },
  { key: 'fishing-tackle',   name: 'Fishing tackle',           category: 'tool', valueGP: 1,   weight: 4 },
  { key: 'flask',            name: 'Flask or tankard',         category: 'gear', valueGP: 0.02, weight: 1 },
  { key: 'grappling-hook',   name: 'Grappling hook',           category: 'gear', valueGP: 2,   weight: 4 },
  { key: 'healers-kit',      name: "Healer's kit",             category: 'gear', valueGP: 5,   weight: 3,   description: '10 charges; stabilize without check.' },
  { key: 'holy-symbol',      name: 'Holy symbol (amulet)',     category: 'gear', valueGP: 5,   weight: 1 },
  { key: 'holy-water',       name: 'Holy water (flask)',       category: 'gear', valueGP: 25,  weight: 1,  description: '2d6 radiant on hit/splash to fiends + undead.' },
  { key: 'ink',              name: 'Ink (1oz bottle)',         category: 'gear', valueGP: 10,  weight: 0 },
  { key: 'lamp',             name: 'Lamp',                     category: 'gear', valueGP: 0.5, weight: 1 },
  { key: 'lantern-bullseye', name: 'Bullseye lantern',         category: 'gear', valueGP: 10,  weight: 2,  description: '60ft bright cone, 60ft dim. 6hr per oil.' },
  { key: 'lantern-hooded',   name: 'Hooded lantern',           category: 'gear', valueGP: 5,   weight: 2,  description: '30ft bright/dim. 6hr per oil.' },
  { key: 'lock',             name: 'Lock',                     category: 'gear', valueGP: 10,  weight: 1,  description: "DC 15 thieves' tools to pick." },
  { key: 'magnifying-glass', name: 'Magnifying glass',         category: 'gear', valueGP: 100, weight: 0 },
  { key: 'manacles',         name: 'Manacles',                 category: 'gear', valueGP: 2,   weight: 6,  description: 'DC 20 STR to break, DC 15 thieves\' tools to pick.' },
  { key: 'mess-kit',         name: 'Mess kit',                 category: 'gear', valueGP: 0.2, weight: 1 },
  { key: 'mirror-steel',     name: 'Mirror, steel',            category: 'gear', valueGP: 5,   weight: 0.5 },
  { key: 'oil-flask',        name: 'Oil (flask)',              category: 'gear', valueGP: 0.1, weight: 1,  description: 'Lantern fuel; or weapon: 5/20ft thrown, 5ft splash.' },
  { key: 'paper-sheet',      name: 'Paper (one sheet)',        category: 'gear', valueGP: 0.2, weight: 0 },
  { key: 'parchment-sheet',  name: 'Parchment (one sheet)',    category: 'gear', valueGP: 0.1, weight: 0 },
  { key: 'pole-10ft',        name: 'Pole (10 ft.)',            category: 'gear', valueGP: 0.05, weight: 7 },
  { key: 'pot-iron',         name: 'Iron pot',                 category: 'gear', valueGP: 2,   weight: 10 },
  { key: 'pouch',            name: 'Pouch',                    category: 'gear', valueGP: 0.5, weight: 1 },
  { key: 'rations-1day',     name: 'Rations (1 day)',          category: 'gear', valueGP: 0.5, weight: 2 },
  { key: 'rope-hempen',      name: 'Hempen rope (50 ft.)',     category: 'gear', valueGP: 1,   weight: 10 },
  { key: 'rope-silk',        name: 'Silk rope (50 ft.)',       category: 'gear', valueGP: 10,  weight: 5 },
  { key: 'sack',             name: 'Sack',                     category: 'gear', valueGP: 0.01, weight: 0.5 },
  { key: 'signal-whistle',   name: 'Signal whistle',           category: 'gear', valueGP: 0.05, weight: 0 },
  { key: 'signet-ring',      name: 'Signet ring',              category: 'gear', valueGP: 5,   weight: 0 },
  { key: 'soap',             name: 'Soap',                     category: 'gear', valueGP: 0.02, weight: 0 },
  { key: 'spellbook',        name: 'Spellbook',                category: 'gear', valueGP: 50,  weight: 3,  description: '100 blank pages. Wizard required.' },
  { key: 'spyglass',         name: 'Spyglass',                 category: 'gear', valueGP: 1000, weight: 1, description: '×2 magnification.' },
  { key: 'tent-2person',     name: 'Tent (2-person)',          category: 'gear', valueGP: 2,   weight: 20 },
  { key: 'tinderbox',        name: 'Tinderbox',                category: 'gear', valueGP: 0.5, weight: 1 },
  { key: 'torch',            name: 'Torch',                    category: 'gear', valueGP: 0.01, weight: 1, description: '20ft bright, 20ft dim. 1 hour. 1 fire damage on melee hit.' },
  { key: 'vial',             name: 'Vial',                     category: 'gear', valueGP: 1,   weight: 0 },
  { key: 'waterskin',        name: 'Waterskin',                category: 'gear', valueGP: 0.2, weight: 5 },
  { key: 'whetstone',        name: 'Whetstone',                category: 'gear', valueGP: 0.01, weight: 1 },
]

const TOOLS: CatalogItem[] = [
  { key: 'thieves-tools',    name: "Thieves' tools",           category: 'tool', valueGP: 25,  weight: 1,  description: 'Disarm traps, pick locks.' },
  { key: 'disguise-kit',     name: 'Disguise kit',             category: 'tool', valueGP: 25,  weight: 3 },
  { key: 'forgery-kit',      name: 'Forgery kit',              category: 'tool', valueGP: 15,  weight: 5 },
  { key: 'herbalism-kit',    name: 'Herbalism kit',            category: 'tool', valueGP: 5,   weight: 3,  description: 'Brew healing potions; identify plants.' },
  { key: 'navigators-tools', name: "Navigator's tools",        category: 'tool', valueGP: 25,  weight: 2 },
  { key: 'poisoners-kit',    name: "Poisoner's kit",           category: 'tool', valueGP: 50,  weight: 2 },
  { key: 'cartographers',    name: "Cartographer's tools",     category: 'tool', valueGP: 15,  weight: 6 },
  { key: 'smiths-tools',     name: "Smith's tools",            category: 'tool', valueGP: 20,  weight: 8 },
  { key: 'leatherworkers',   name: "Leatherworker's tools",    category: 'tool', valueGP: 5,   weight: 5 },
  { key: 'masons-tools',     name: "Mason's tools",            category: 'tool', valueGP: 10,  weight: 8 },
  { key: 'carpenters-tools', name: "Carpenter's tools",        category: 'tool', valueGP: 8,   weight: 6 },
]

// ════════════════════════════════════════════════════════════════════
// PACKS — bundled gear at a discount
// ════════════════════════════════════════════════════════════════════

const PACKS: CatalogItem[] = [
  { key: 'pack-burglar', name: "Burglar's pack", category: 'pack', valueGP: 16, weight: 47,
    pack: { items: ['Backpack', 'Bag of 1000 ball bearings', '10 ft. of string', 'Bell', '5 candles', 'Crowbar', 'Hammer', '10 pitons', 'Hooded lantern', '2 flasks of oil', '5 days rations', 'Tinderbox', 'Waterskin', '50 ft. hempen rope'] } },
  { key: 'pack-diplomat', name: "Diplomat's pack", category: 'pack', valueGP: 39, weight: 39,
    pack: { items: ['Chest', '2 cases for maps and scrolls', 'Set of fine clothes', 'Bottle of ink', 'Ink pen', 'Lamp', '2 flasks of oil', '5 sheets of paper', 'Vial of perfume', 'Sealing wax', 'Soap'] } },
  { key: 'pack-dungeoneer', name: "Dungeoneer's pack", category: 'pack', valueGP: 12, weight: 61.5,
    pack: { items: ['Backpack', 'Crowbar', 'Hammer', '10 pitons', '10 torches', 'Tinderbox', '10 days rations', 'Waterskin', '50 ft. hempen rope'] } },
  { key: 'pack-entertainer', name: "Entertainer's pack", category: 'pack', valueGP: 40, weight: 38,
    pack: { items: ['Backpack', 'Bedroll', '2 costumes', '5 candles', '5 days rations', 'Waterskin', 'Disguise kit'] } },
  { key: 'pack-explorer', name: "Explorer's pack", category: 'pack', valueGP: 10, weight: 59,
    pack: { items: ['Backpack', 'Bedroll', 'Mess kit', 'Tinderbox', '10 torches', '10 days rations', 'Waterskin', '50 ft. hempen rope'] } },
  { key: 'pack-priest', name: "Priest's pack", category: 'pack', valueGP: 19, weight: 24,
    pack: { items: ['Backpack', 'Blanket', '10 candles', 'Tinderbox', 'Alms box', '2 blocks of incense', 'Censer', 'Vestments', '2 days rations', 'Waterskin'] } },
  { key: 'pack-scholar', name: "Scholar's pack", category: 'pack', valueGP: 40, weight: 10,
    pack: { items: ['Backpack', 'Book of lore', 'Bottle of ink', 'Ink pen', '10 sheets of parchment', 'Little bag of sand', 'Small knife'] } },
]

// ════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════

export const EQUIPMENT_CATALOG: CatalogItem[] = [
  ...SIMPLE_MELEE,
  ...SIMPLE_RANGED,
  ...MARTIAL_MELEE,
  ...MARTIAL_RANGED,
  ...ARMOR,
  ...GEAR,
  ...TOOLS,
  ...PACKS,
]

/** Index by key for O(1) lookup (e.g. resolving a starting-kit string). */
export const EQUIPMENT_BY_KEY: Record<string, CatalogItem> = Object.fromEntries(
  EQUIPMENT_CATALOG.map((item) => [item.key, item]),
)

/** Filter catalog by category (for UI grouping). */
export function catalogByCategory(category: EquipmentCategory): CatalogItem[] {
  return EQUIPMENT_CATALOG.filter((item) => item.category === category)
}

/** All weapons (any category). */
export function allWeapons(): CatalogItem[] {
  return EQUIPMENT_CATALOG.filter((item) => item.category.startsWith('weapon-'))
}

/** All armor (light/medium/heavy + shield). */
export function allArmor(): CatalogItem[] {
  return EQUIPMENT_CATALOG.filter((item) =>
    item.category.startsWith('armor-') || item.category === 'shield',
  )
}

/** Search by name fragment (case-insensitive). */
export function searchEquipment(query: string): CatalogItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return EQUIPMENT_CATALOG
  return EQUIPMENT_CATALOG.filter((item) =>
    item.name.toLowerCase().includes(q) ||
    item.key.toLowerCase().includes(q),
  )
}
