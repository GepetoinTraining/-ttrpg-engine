/**
 * D&D 5e SRD constants for character creation.
 *
 * Races, subraces, classes, subclasses, backgrounds — all open-game-license
 * content. Structured so the chargen surface can iterate the data and the
 * API can compute final ability scores by combining race + subrace bonuses.
 *
 * Migration note (2026-04-30): subraces upgraded from `string[]` to
 * `SubraceData[]` to carry per-variant ability bonuses + traits. Consumer
 * fixes:
 *   - `src/app/api/character/create/route.ts` reads
 *     `RACES[k].abilityBonuses` AND optionally a chosen subrace's bonuses
 *     (matched on `subrace.name`).
 *   - `src/components/design/surfaces/Chargen.tsx` `StepRace` iterates
 *     `RACES[draft.raceKey].subraces` instead of a hardcoded list.
 */

// ─── Abilities ───

export const ABILITIES = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
] as const
export type Ability = typeof ABILITIES[number]

// ─── Subrace + Race types ───

export interface SubraceData {
  key: string
  name: string
  description: string
  abilityBonuses: Partial<Record<Ability, number>>
  traits: string[]
}

export interface RaceData {
  key: string
  name: string
  description: string
  size: 'small' | 'medium'
  speed: number
  abilityBonuses: Partial<Record<Ability, number>>
  traits: string[]
  subraces: SubraceData[]
}

export const RACES: Record<string, RaceData> = {
  human: {
    key: 'human',
    name: 'Human',
    description: 'Versatile, ambitious, and quick to adapt. The most common race in most D&D worlds.',
    size: 'medium',
    speed: 30,
    abilityBonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    traits: ['Extra language at level 1'],
    subraces: [
      {
        key: 'standard',
        name: 'Standard',
        description: 'Balanced — +1 to every ability score.',
        abilityBonuses: {},
        traits: [],
      },
      {
        key: 'variant',
        name: 'Variant Human',
        description: 'Two free +1s of your choice + a feat + a skill proficiency. Replaces standard +1 to all.',
        abilityBonuses: { strength: -1, dexterity: -1, constitution: -1, intelligence: -1, wisdom: -1, charisma: -1 },  // negates the base +1×6, caller picks two +1s separately
        traits: ['Bonus feat at level 1', 'Skill proficiency of choice'],
      },
    ],
  },
  elf: {
    key: 'elf',
    name: 'Elf',
    description: 'Long-lived, attuned to magic, ancestral home in deep forests or fae glades.',
    size: 'medium',
    speed: 30,
    abilityBonuses: { dexterity: 2 },
    traits: ['Darkvision 60ft', 'Keen Senses (Perception proficiency)', 'Fey Ancestry (charm/sleep resistance)', 'Trance (4hr meditation = long rest)'],
    subraces: [
      {
        key: 'high-elf',
        name: 'High Elf',
        description: 'Scholarly. Wizard cantrip + extra language.',
        abilityBonuses: { intelligence: 1 },
        traits: ['Cantrip from wizard list', 'Longsword/shortsword/longbow/shortbow proficiency', 'Extra language'],
      },
      {
        key: 'wood-elf',
        name: 'Wood Elf',
        description: 'Faster, harder to spot in nature.',
        abilityBonuses: { wisdom: 1 },
        traits: ['Speed 35ft', 'Mask of the Wild (hide in light obscurement)', 'Longsword/shortsword/longbow/shortbow proficiency'],
      },
      {
        key: 'drow',
        name: 'Dark Elf (Drow)',
        description: 'Underdark dwellers. Superior darkvision but sun sensitivity.',
        abilityBonuses: { charisma: 1 },
        traits: ['Darkvision 120ft', 'Sun sensitivity (disadv on attacks + Perception in sun)', 'Drow Magic (Dancing Lights, Faerie Fire at L3, Darkness at L5)', 'Rapier/shortsword/hand crossbow proficiency'],
      },
    ],
  },
  dwarf: {
    key: 'dwarf',
    name: 'Dwarf',
    description: 'Mountain-stout, clan-bound, master smiths and warriors.',
    size: 'medium',
    speed: 25,
    abilityBonuses: { constitution: 2 },
    traits: ['Darkvision 60ft', 'Dwarven Resilience (advantage vs poison, resist poison)', 'Stonecunning (double prof on stone-related History)', 'Battleaxe/handaxe/light hammer/warhammer proficiency'],
    subraces: [
      {
        key: 'hill',
        name: 'Hill Dwarf',
        description: 'Tougher. +1 max HP per level.',
        abilityBonuses: { wisdom: 1 },
        traits: ['Dwarven Toughness (+1 max HP per level)'],
      },
      {
        key: 'mountain',
        name: 'Mountain Dwarf',
        description: 'Hardy. Light + medium armor proficiency baked in.',
        abilityBonuses: { strength: 2 },
        traits: ['Light + medium armor proficiency'],
      },
    ],
  },
  halfling: {
    key: 'halfling',
    name: 'Halfling',
    description: 'Small, lucky, brave despite their size. Beloved guests at every inn.',
    size: 'small',
    speed: 25,
    abilityBonuses: { dexterity: 2 },
    traits: ['Lucky (reroll natural 1s on d20 attack/check/save)', 'Brave (advantage on saves vs frightened)', 'Halfling Nimbleness (move through larger creatures\' spaces)'],
    subraces: [
      {
        key: 'lightfoot',
        name: 'Lightfoot',
        description: 'Stealthy. Hide behind larger creatures.',
        abilityBonuses: { charisma: 1 },
        traits: ['Naturally Stealthy (hide behind larger creatures)'],
      },
      {
        key: 'stout',
        name: 'Stout',
        description: 'Resilient. Poison resistance.',
        abilityBonuses: { constitution: 1 },
        traits: ['Stout Resilience (advantage vs poison, resist poison)'],
      },
    ],
  },
  gnome: {
    key: 'gnome',
    name: 'Gnome',
    description: 'Curious, inventive, magic-touched. Rock gnomes tinker; forest gnomes commune with beasts.',
    size: 'small',
    speed: 25,
    abilityBonuses: { intelligence: 2 },
    traits: ['Darkvision 60ft', 'Gnome Cunning (advantage on INT/WIS/CHA saves vs magic)'],
    subraces: [
      {
        key: 'forest',
        name: 'Forest Gnome',
        description: 'Speak with small beasts. Minor illusion cantrip.',
        abilityBonuses: { dexterity: 1 },
        traits: ['Natural Illusionist (Minor Illusion cantrip)', 'Speak with Small Beasts'],
      },
      {
        key: 'rock',
        name: 'Rock Gnome',
        description: 'Tinker. Build clockwork devices.',
        abilityBonuses: { constitution: 1 },
        traits: ['Artificer\'s Lore (+2× prof on History related to magic items)', 'Tinker (build clockwork toys)'],
      },
    ],
  },
  'half-elf': {
    key: 'half-elf',
    name: 'Half-Elf',
    description: 'Walks both worlds and belongs to neither. Diplomats by nature.',
    size: 'medium',
    speed: 30,
    abilityBonuses: { charisma: 2 },
    traits: ['Darkvision 60ft', 'Fey Ancestry (charm/sleep resistance)', 'Skill Versatility (proficiency in 2 skills of choice)', 'Extra language'],
    subraces: [
      {
        key: 'standard',
        name: 'Standard',
        description: '+1 to two abilities of your choice. The diplomat archetype.',
        abilityBonuses: {},
        traits: ['+1 to two abilities of your choice (excluding CHA)'],
      },
      {
        key: 'wood-descent',
        name: 'Wood Elf descent',
        description: 'Swap skill versatility for Mask of the Wild + 35ft speed.',
        abilityBonuses: {},
        traits: ['Speed 35ft', 'Mask of the Wild', 'Loses Skill Versatility'],
      },
      {
        key: 'drow-descent',
        name: 'Drow descent',
        description: 'Swap skill versatility for Drow Magic + superior darkvision.',
        abilityBonuses: {},
        traits: ['Darkvision 120ft', 'Drow Magic (Dancing Lights, Faerie Fire L3, Darkness L5)', 'Loses Skill Versatility'],
      },
    ],
  },
  'half-orc': {
    key: 'half-orc',
    name: 'Half-Orc',
    description: 'Strength of the wild crossed with human cunning. Often outcasts on both sides.',
    size: 'medium',
    speed: 30,
    abilityBonuses: { strength: 2, constitution: 1 },
    traits: ['Darkvision 60ft', 'Menacing (Intimidation proficiency)', 'Relentless Endurance (drop to 1 HP instead of 0 once per long rest)', 'Savage Attacks (+1 die on melee crits)'],
    subraces: [],
  },
  tiefling: {
    key: 'tiefling',
    name: 'Tiefling',
    description: 'Infernal heritage. Tail, horns, sometimes hooves. Often shunned, often misunderstood.',
    size: 'medium',
    speed: 30,
    abilityBonuses: { charisma: 2, intelligence: 1 },
    traits: ['Darkvision 60ft', 'Hellish Resistance (resist fire)', 'Infernal Legacy (Thaumaturgy cantrip, Hellish Rebuke L3, Darkness L5)'],
    subraces: [],
  },
  dragonborn: {
    key: 'dragonborn',
    name: 'Dragonborn',
    description: 'Draconic ancestry given humanoid form. Breath weapon and damage resistance match the chosen ancestry.',
    size: 'medium',
    speed: 30,
    abilityBonuses: { strength: 2, charisma: 1 },
    traits: ['Breath Weapon (2d6 area damage, scales by level)', 'Damage Resistance (matches ancestry)'],
    subraces: [
      { key: 'black',  name: 'Black (acid)',     description: 'Acid breath, 5×30ft line.',     abilityBonuses: {}, traits: ['Acid breath (line)', 'Acid resistance'] },
      { key: 'blue',   name: 'Blue (lightning)', description: 'Lightning breath, 5×30ft line.', abilityBonuses: {}, traits: ['Lightning breath (line)', 'Lightning resistance'] },
      { key: 'brass',  name: 'Brass (fire)',     description: 'Fire breath, 5×30ft line.',     abilityBonuses: {}, traits: ['Fire breath (line)', 'Fire resistance'] },
      { key: 'bronze', name: 'Bronze (lightning)', description: 'Lightning breath, 5×30ft line.', abilityBonuses: {}, traits: ['Lightning breath (line)', 'Lightning resistance'] },
      { key: 'copper', name: 'Copper (acid)',    description: 'Acid breath, 5×30ft line.',     abilityBonuses: {}, traits: ['Acid breath (line)', 'Acid resistance'] },
      { key: 'gold',   name: 'Gold (fire)',      description: 'Fire breath, 15ft cone.',       abilityBonuses: {}, traits: ['Fire breath (cone)', 'Fire resistance'] },
      { key: 'green',  name: 'Green (poison)',   description: 'Poison breath, 15ft cone.',     abilityBonuses: {}, traits: ['Poison breath (cone)', 'Poison resistance'] },
      { key: 'red',    name: 'Red (fire)',       description: 'Fire breath, 15ft cone.',       abilityBonuses: {}, traits: ['Fire breath (cone)', 'Fire resistance'] },
      { key: 'silver', name: 'Silver (cold)',    description: 'Cold breath, 15ft cone.',       abilityBonuses: {}, traits: ['Cold breath (cone)', 'Cold resistance'] },
      { key: 'white',  name: 'White (cold)',     description: 'Cold breath, 15ft cone.',       abilityBonuses: {}, traits: ['Cold breath (cone)', 'Cold resistance'] },
    ],
  },
}

// ─── Subclass + Class types ───

export interface SubclassData {
  key: string
  name: string
  description: string
  /** When this subclass becomes available — typically class level 3, sometimes 1 or 2. */
  unlockLevel: number
}

export interface ClassData {
  key: string
  name: string
  description: string
  hitDie: 'd6' | 'd8' | 'd10' | 'd12'
  primaryAbility: Ability
  savingThrows: Ability[]
  /** HP at level 1 = hit die max + CON mod; this is the max die value. */
  startingHp: number
  spellcasting?: Ability
  /** Skills this class can pick proficiencies from at L1. Players choose N. */
  skillChoices?: { count: number; from: string[] }
  subclasses: SubclassData[]
}

export const CLASSES: Record<string, ClassData> = {
  barbarian: {
    key: 'barbarian',
    name: 'Barbarian',
    description: 'Primal fury made flesh. Rage, reckless attack, danger sense.',
    hitDie: 'd12',
    primaryAbility: 'strength',
    savingThrows: ['strength', 'constitution'],
    startingHp: 12,
    skillChoices: { count: 2, from: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
    subclasses: [
      { key: 'berserker', name: 'Path of the Berserker', description: 'Frenzy, mindless rage.', unlockLevel: 3 },
      { key: 'totem',     name: 'Path of the Totem Warrior', description: 'Bear/Eagle/Wolf spirit guide.', unlockLevel: 3 },
    ],
  },
  bard: {
    key: 'bard',
    name: 'Bard',
    description: 'Magic through song, story, and inspiration. Half-caster of all things.',
    hitDie: 'd8',
    primaryAbility: 'charisma',
    savingThrows: ['dexterity', 'charisma'],
    startingHp: 8,
    spellcasting: 'charisma',
    skillChoices: { count: 3, from: ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'] },
    subclasses: [
      { key: 'lore',      name: 'College of Lore',     description: 'Cutting Words, extra magical secrets.', unlockLevel: 3 },
      { key: 'valor',     name: 'College of Valor',    description: 'Combat-bard, extra attack at L6.',       unlockLevel: 3 },
    ],
  },
  cleric: {
    key: 'cleric',
    name: 'Cleric',
    description: 'Divine conduit. Channel divinity, heal, smite, ward.',
    hitDie: 'd8',
    primaryAbility: 'wisdom',
    savingThrows: ['wisdom', 'charisma'],
    startingHp: 8,
    spellcasting: 'wisdom',
    skillChoices: { count: 2, from: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
    subclasses: [
      { key: 'life',      name: 'Life Domain',     description: 'Healing focus, heavy armor.', unlockLevel: 1 },
      { key: 'light',     name: 'Light Domain',    description: 'Fire/radiance, Warding Flare.', unlockLevel: 1 },
      { key: 'knowledge', name: 'Knowledge Domain', description: 'Skill versatility, languages, divination.', unlockLevel: 1 },
      { key: 'nature',    name: 'Nature Domain',    description: 'Druid-flavored cleric.', unlockLevel: 1 },
      { key: 'tempest',   name: 'Tempest Domain',   description: 'Lightning/thunder, Wrath of the Storm.', unlockLevel: 1 },
      { key: 'trickery',  name: 'Trickery Domain',  description: 'Illusion + stealth-flavored cleric.', unlockLevel: 1 },
      { key: 'war',       name: 'War Domain',       description: 'Heavy armor, martial weapons, divine strikes.', unlockLevel: 1 },
    ],
  },
  druid: {
    key: 'druid',
    name: 'Druid',
    description: 'Nature\'s guardian. Wild Shape, primal magic, no metal armor.',
    hitDie: 'd8',
    primaryAbility: 'wisdom',
    savingThrows: ['intelligence', 'wisdom'],
    startingHp: 8,
    spellcasting: 'wisdom',
    skillChoices: { count: 2, from: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
    subclasses: [
      { key: 'land',      name: 'Circle of the Land', description: 'Bonus spells based on terrain, recover slots on rest.', unlockLevel: 2 },
      { key: 'moon',      name: 'Circle of the Moon', description: 'Combat-shifter, transform into bigger beasts.', unlockLevel: 2 },
    ],
  },
  fighter: {
    key: 'fighter',
    name: 'Fighter',
    description: 'Master of arms and armor. Action Surge, Second Wind, Extra Attack.',
    hitDie: 'd10',
    primaryAbility: 'strength',
    savingThrows: ['strength', 'constitution'],
    startingHp: 10,
    skillChoices: { count: 2, from: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
    subclasses: [
      { key: 'champion',       name: 'Champion',        description: 'Improved crits, athletic.', unlockLevel: 3 },
      { key: 'battlemaster',   name: 'Battle Master',    description: 'Combat maneuvers, superiority dice.', unlockLevel: 3 },
      { key: 'eldritchknight', name: 'Eldritch Knight',  description: 'Wizard cantrips + spells.', unlockLevel: 3 },
    ],
  },
  monk: {
    key: 'monk',
    name: 'Monk',
    description: 'Discipline + ki. Unarmored Defense, Flurry of Blows, Stunning Strike.',
    hitDie: 'd8',
    primaryAbility: 'dexterity',
    savingThrows: ['strength', 'dexterity'],
    startingHp: 8,
    skillChoices: { count: 2, from: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
    subclasses: [
      { key: 'openhand',    name: 'Way of the Open Hand', description: 'Pure martial artist, ki-fueled.', unlockLevel: 3 },
      { key: 'shadow',      name: 'Way of Shadow',         description: 'Stealth + shadow spells.', unlockLevel: 3 },
      { key: 'fourelements', name: 'Way of the Four Elements', description: 'Bend elements via ki.', unlockLevel: 3 },
    ],
  },
  paladin: {
    key: 'paladin',
    name: 'Paladin',
    description: 'Sacred oath made manifest. Lay on Hands, Divine Smite, auras.',
    hitDie: 'd10',
    primaryAbility: 'strength',
    savingThrows: ['wisdom', 'charisma'],
    startingHp: 10,
    spellcasting: 'charisma',
    skillChoices: { count: 2, from: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
    subclasses: [
      { key: 'devotion',  name: 'Oath of Devotion',   description: 'Holy classic. Sacred Weapon, Turn the Unholy.', unlockLevel: 3 },
      { key: 'ancients',  name: 'Oath of the Ancients', description: 'Fey-bound, Nature\'s Wrath.', unlockLevel: 3 },
      { key: 'vengeance', name: 'Oath of Vengeance',  description: 'Hunter style, Vow of Enmity.', unlockLevel: 3 },
    ],
  },
  ranger: {
    key: 'ranger',
    name: 'Ranger',
    description: 'Hunter, tracker, half-caster of nature.',
    hitDie: 'd10',
    primaryAbility: 'dexterity',
    savingThrows: ['strength', 'dexterity'],
    startingHp: 10,
    spellcasting: 'wisdom',
    skillChoices: { count: 3, from: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
    subclasses: [
      { key: 'hunter',      name: 'Hunter',         description: 'Versatile combat against varied foes.', unlockLevel: 3 },
      { key: 'beastmaster', name: 'Beast Master',   description: 'Bonded animal companion.', unlockLevel: 3 },
    ],
  },
  rogue: {
    key: 'rogue',
    name: 'Rogue',
    description: 'Sneak attack, expertise, cunning action. Master of out-of-combat utility.',
    hitDie: 'd8',
    primaryAbility: 'dexterity',
    savingThrows: ['dexterity', 'intelligence'],
    startingHp: 8,
    skillChoices: { count: 4, from: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
    subclasses: [
      { key: 'thief',          name: 'Thief',           description: 'Fast Hands, Second-Story Work.', unlockLevel: 3 },
      { key: 'assassin',       name: 'Assassin',        description: 'Death from surprise, Assassinate.', unlockLevel: 3 },
      { key: 'arcanetrickster', name: 'Arcane Trickster', description: 'Wizard spells + sneak attack.', unlockLevel: 3 },
    ],
  },
  sorcerer: {
    key: 'sorcerer',
    name: 'Sorcerer',
    description: 'Innate spellcasting + Metamagic. Power without study.',
    hitDie: 'd6',
    primaryAbility: 'charisma',
    savingThrows: ['constitution', 'charisma'],
    startingHp: 6,
    spellcasting: 'charisma',
    skillChoices: { count: 2, from: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
    subclasses: [
      { key: 'draconic',  name: 'Draconic Bloodline', description: 'Dragon ancestry, scales, resistance.', unlockLevel: 1 },
      { key: 'wildmagic', name: 'Wild Magic',         description: 'Surge table on every spell cast.', unlockLevel: 1 },
    ],
  },
  warlock: {
    key: 'warlock',
    name: 'Warlock',
    description: 'Pact with otherworldly patron. Short-rest casters with Eldritch Invocations.',
    hitDie: 'd8',
    primaryAbility: 'charisma',
    savingThrows: ['wisdom', 'charisma'],
    startingHp: 8,
    spellcasting: 'charisma',
    skillChoices: { count: 2, from: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
    subclasses: [
      { key: 'fiend',       name: 'The Fiend',       description: 'Infernal pact, fire-friendly.', unlockLevel: 1 },
      { key: 'archfey',     name: 'The Archfey',     description: 'Charm/illusion focus.', unlockLevel: 1 },
      { key: 'greatold',    name: 'The Great Old One', description: 'Telepathy, psychic damage, alien horror.', unlockLevel: 1 },
    ],
  },
  wizard: {
    key: 'wizard',
    name: 'Wizard',
    description: 'Spellbook scholar. Most spells of any class, ritual casting, schools of magic.',
    hitDie: 'd6',
    primaryAbility: 'intelligence',
    savingThrows: ['intelligence', 'wisdom'],
    startingHp: 6,
    spellcasting: 'intelligence',
    skillChoices: { count: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
    subclasses: [
      { key: 'abjuration',     name: 'School of Abjuration',  description: 'Ward, dispel, protection.', unlockLevel: 2 },
      { key: 'conjuration',    name: 'School of Conjuration', description: 'Summon + teleport.', unlockLevel: 2 },
      { key: 'divination',     name: 'School of Divination',  description: 'Portent: pre-rolled d20s.', unlockLevel: 2 },
      { key: 'enchantment',    name: 'School of Enchantment', description: 'Charm + control minds.', unlockLevel: 2 },
      { key: 'evocation',      name: 'School of Evocation',   description: 'Sculpt blasts to spare allies.', unlockLevel: 2 },
      { key: 'illusion',       name: 'School of Illusion',    description: 'Master of fakery.', unlockLevel: 2 },
      { key: 'necromancy',     name: 'School of Necromancy',  description: 'Drain life, raise dead.', unlockLevel: 2 },
      { key: 'transmutation',  name: 'School of Transmutation', description: 'Change matter, polymorph.', unlockLevel: 2 },
    ],
  },
}

// ─── Backgrounds ───

export interface BackgroundData {
  key: string
  name: string
  description: string
  /** Skills automatically proficient. */
  skillProfs: string[]
  toolProfs: string[]
  languages: number  // count of "extra languages of your choice"
  equipment: string[]
  feature: { name: string; description: string }
}

export const BACKGROUNDS: Record<string, BackgroundData> = {
  acolyte: {
    key: 'acolyte',
    name: 'Acolyte',
    description: 'Spent your life in service of a temple, learning rites and tending the faithful.',
    skillProfs: ['Insight', 'Religion'],
    toolProfs: [],
    languages: 2,
    equipment: ['Holy symbol', 'Prayer book', '5 sticks of incense', 'Vestments', 'Set of common clothes', '15gp'],
    feature: { name: 'Shelter of the Faithful', description: 'You and your companions can find lodging at temples of your faith.' },
  },
  charlatan: {
    key: 'charlatan',
    name: 'Charlatan',
    description: 'You\'ve always had a way with people. You know how to make them trust you.',
    skillProfs: ['Deception', 'Sleight of Hand'],
    toolProfs: ['Disguise kit', 'Forgery kit'],
    languages: 0,
    equipment: ['Fine clothes', 'Disguise kit', 'Tools of choice (con-related)', '15gp'],
    feature: { name: 'False Identity', description: 'You have a second identity, complete with documentation.' },
  },
  criminal: {
    key: 'criminal',
    name: 'Criminal',
    description: 'You\'ve broken the law and lived to tell about it.',
    skillProfs: ['Deception', 'Stealth'],
    toolProfs: ['One gaming set', 'Thieves\' tools'],
    languages: 0,
    equipment: ['Crowbar', 'Set of dark common clothes with hood', '15gp'],
    feature: { name: 'Criminal Contact', description: 'You have a reliable contact in the criminal underworld.' },
  },
  entertainer: {
    key: 'entertainer',
    name: 'Entertainer',
    description: 'You sang, you danced, you juggled — anything to put food on the table.',
    skillProfs: ['Acrobatics', 'Performance'],
    toolProfs: ['Disguise kit', 'One musical instrument'],
    languages: 0,
    equipment: ['Musical instrument', 'Favor of an admirer', 'Costume', '15gp'],
    feature: { name: 'By Popular Demand', description: 'You can always find a place to perform; admirers will lodge + feed you.' },
  },
  'folk-hero': {
    key: 'folk-hero',
    name: 'Folk Hero',
    description: 'You come from humble origins but stood up to a tyrant and the people remember.',
    skillProfs: ['Animal Handling', 'Survival'],
    toolProfs: ['One artisan\'s tools', 'Vehicles (land)'],
    languages: 0,
    equipment: ['Set of artisan\'s tools', 'Shovel', 'Iron pot', 'Common clothes', '10gp'],
    feature: { name: 'Rustic Hospitality', description: 'Common folk will hide you, share food, and risk themselves to protect you.' },
  },
  'guild-artisan': {
    key: 'guild-artisan',
    name: 'Guild Artisan',
    description: 'You\'re a member of a craft guild — sworn brothers and sisters in your trade.',
    skillProfs: ['Insight', 'Persuasion'],
    toolProfs: ['One artisan\'s tools'],
    languages: 1,
    equipment: ['Artisan\'s tools', 'Letter of introduction from your guild', 'Traveler\'s clothes', '15gp'],
    feature: { name: 'Guild Membership', description: 'Other guild members will give you lodging + cover small expenses; in exchange you pay 5gp/month dues.' },
  },
  hermit: {
    key: 'hermit',
    name: 'Hermit',
    description: 'You lived in seclusion — for prayer, study, or to escape the world.',
    skillProfs: ['Medicine', 'Religion'],
    toolProfs: ['Herbalism kit'],
    languages: 1,
    equipment: ['Scroll case with notes from your studies', 'Winter blanket', 'Herbalism kit', '5gp'],
    feature: { name: 'Discovery', description: 'During your seclusion, you discovered a unique and powerful truth (your DM\'s call).' },
  },
  noble: {
    key: 'noble',
    name: 'Noble',
    description: 'You understand wealth, power, and privilege — and the responsibilities (real or imagined) that come with them.',
    skillProfs: ['History', 'Persuasion'],
    toolProfs: ['One gaming set'],
    languages: 1,
    equipment: ['Set of fine clothes', 'Signet ring', 'Scroll of pedigree', '25gp'],
    feature: { name: 'Position of Privilege', description: 'You\'re welcome in high society. Common folk make every effort to accommodate you.' },
  },
  outlander: {
    key: 'outlander',
    name: 'Outlander',
    description: 'You grew up in the wilds, far from civilization — and you still feel more at home there.',
    skillProfs: ['Athletics', 'Survival'],
    toolProfs: ['One musical instrument'],
    languages: 1,
    equipment: ['Staff', 'Hunting trap', 'Trophy from animal you killed', 'Traveler\'s clothes', '10gp'],
    feature: { name: 'Wanderer', description: 'Excellent memory for maps and geography. Can find food + shelter for self and up to 5 others daily in the wild.' },
  },
  sage: {
    key: 'sage',
    name: 'Sage',
    description: 'Years spent reading every book you could find, in pursuit of an answer that may not exist.',
    skillProfs: ['Arcana', 'History'],
    toolProfs: [],
    languages: 2,
    equipment: ['Bottle of black ink', 'Quill', 'Small knife', 'Letter from a colleague posing a question', 'Common clothes', '10gp'],
    feature: { name: 'Researcher', description: 'When you don\'t know a piece of lore, you know where + from whom you can find it.' },
  },
  sailor: {
    key: 'sailor',
    name: 'Sailor',
    description: 'You sailed on a seagoing vessel for years. Storms, monsters, exotic ports — you\'ve seen it all.',
    skillProfs: ['Athletics', 'Perception'],
    toolProfs: ['Navigator\'s tools', 'Vehicles (water)'],
    languages: 0,
    equipment: ['Belaying pin (club)', '50ft silk rope', 'Lucky charm', 'Common clothes', '10gp'],
    feature: { name: 'Ship\'s Passage', description: 'Free passage on a sailing ship for you + companions, in exchange for crewing.' },
  },
  soldier: {
    key: 'soldier',
    name: 'Soldier',
    description: 'War is your trade. You served in an army or militia long enough to learn it from the inside.',
    skillProfs: ['Athletics', 'Intimidation'],
    toolProfs: ['One gaming set', 'Vehicles (land)'],
    languages: 0,
    equipment: ['Insignia of rank', 'Trophy from fallen enemy', 'Dice or deck of cards', 'Common clothes', '10gp'],
    feature: { name: 'Military Rank', description: 'Soldiers loyal to your former org still recognize your authority. You can invoke rank for favors / shelter.' },
  },
  urchin: {
    key: 'urchin',
    name: 'Urchin',
    description: 'You grew up on the streets, alone, with only your wits and tenacity.',
    skillProfs: ['Sleight of Hand', 'Stealth'],
    toolProfs: ['Disguise kit', 'Thieves\' tools'],
    languages: 0,
    equipment: ['Small knife', 'Map of the city you grew up in', 'Pet mouse', 'Token to remember your parents by', 'Common clothes', '10gp'],
    feature: { name: 'City Secrets', description: 'You know the secret patterns and flow of cities — travel double speed in a city you know.' },
  },
}

/** Convenience: array form for iteration in UI. */
export const BACKGROUND_LIST: BackgroundData[] = Object.values(BACKGROUNDS)

// ─── Standard array for ability scores ───

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const

// ─── HP calculation ───

export function calculateStartingHp(
  classData: ClassData,
  constitutionScore: number,
): number {
  const conMod = Math.floor((constitutionScore - 10) / 2)
  return classData.startingHp + conMod
}

// ─── Modifier from score ───

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

// ─── Subrace lookup helper ─────────────────────────────────────────────
// Given a race key + subrace name (the human-readable label stored on draft),
// return the subrace data — or null if no match. Used by the API to combine
// race + subrace ability bonuses on character create.

export function findSubrace(raceKey: string, subraceName: string | undefined): SubraceData | null {
  if (!subraceName) return null
  const race = RACES[raceKey]
  if (!race) return null
  return race.subraces.find((s) => s.name === subraceName || s.key === subraceName) ?? null
}
