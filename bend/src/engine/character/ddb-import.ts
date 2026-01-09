/**
 * D&D BEYOND IMPORT PARSER
 * =========================
 *
 * Transforms D&D Beyond character JSON into our internal schema.
 *
 * D&D Beyond JSON is fetched from:
 * https://character-service.dndbeyond.com/character/v3/character/{id}
 *
 * NOTE: This is an unofficial API that may change. We parse defensively.
 */

import type {
  Character,
  AbilityScores,
  AbilityBonus,
  Ability,
  Skill,
  Race,
  RaceTrait,
  Class,
  HitDie,
  Spellcasting,
  Background,
  Feat,
  Spell,
  SpellSchool,
  InventoryItem,
  ItemType,
  ItemRarity,
  Currency,
  Alignment,
  Size,
  ProficiencyLevel,
  Condition,
} from './schema'

// ============================================
// D&D BEYOND TYPE DEFINITIONS
// ============================================

// These mirror the DDB JSON structure (partial - we only define what we need)

interface DdbStat {
  id: number  // 1=STR, 2=DEX, 3=CON, 4=INT, 5=WIS, 6=CHA
  value: number
}

interface DdbModifier {
  type: string
  subType: string
  value: number | null
  friendlyTypeName: string
  friendlySubtypeName: string
  entityId: number
  entityTypeId: number
  componentId: number
  componentTypeId: number
}

interface DdbClass {
  definition: {
    id: number
    name: string
    hitDice: number
    spellCastingAbilityId: number | null
  }
  level: number
  isStartingClass: boolean
  subclassDefinition?: {
    id: number
    name: string
  }
}



interface DdbRace {
  baseRaceId: number
  baseRaceName: string
  racialTraits: Array<{
    definition: {
      id: number
      name: string
      description: string
    }
  }>
  weightSpeeds?: {
    normal?: {
      walk?: number
      fly?: number
      swim?: number
      climb?: number
      burrow?: number
    }
  }
  sizeId: number
}

interface DdbBackground {
  definition?: {
    id: number
    name: string
    description: string
    featureName: string
    featureDescription: string
  }
  customBackground?: {
    name: string
    description: string
    featuresBackground?: {
      name: string
      description: string
    }
  }
}

interface DdbFeat {
  definition: {
    id: number
    name: string
    description: string
  }
}

interface DdbSpell {
  definition: {
    id: number
    name: string
    level: number
    school: string
    duration: { durationInterval: number; durationUnit: string; durationType: string }
    range: { origin: string; rangeValue: number | null; aoeType: string | null; aoeValue: number | null }
    components: number[]  // 1=V, 2=S, 3=M
    componentsDescription: string
    castingTimeDescription: string
    description: string
    atHigherLevels: { higherLevelDefinitions: Array<{ description: string }> }
    concentration: boolean
    ritual: boolean
  }
  prepared: boolean
  alwaysPrepared: boolean
}

interface DdbItem {
  id: number
  definition: {
    id: number
    name: string
    description: string
    weight: number
    cost: number
    filterType: string
    rarity: string
    armorClass: number | null
    armorTypeId: number | null
    damage: { diceString: string; damageType: { name: string } } | null
    properties: Array<{ name: string }>
    magic: boolean
    isContainer: boolean
    canAttune: boolean
  }
  quantity: number
  equipped: boolean
  isAttuned: boolean
  chargesUsed: number
}

interface DdbCharacter {
  id: number
  name: string
  gender: string
  faith: string
  age: number | null
  hair: string
  eyes: string
  skin: string
  height: string
  weight: number | null

  stats: DdbStat[]
  bonusStats: DdbStat[]
  overrideStats: DdbStat[]

  race: DdbRace
  classes: DdbClass[]
  background: DdbBackground

  baseHitPoints: number
  bonusHitPoints: number
  removedHitPoints: number
  temporaryHitPoints: number
  overrideHitPoints: number | null

  currentXp: number

  modifiers: {
    race: DdbModifier[]
    class: DdbModifier[]
    background: DdbModifier[]
    item: DdbModifier[]
    feat: DdbModifier[]
    condition: DdbModifier[]
  }

  classSpells: Array<{
    spells: DdbSpell[]
  }>

  spellSlots: Array<{
    level: number
    used: number
    available: number
  }>

  pactMagic?: Array<{
    level: number
    used: number
    available: number
  }>

  feats: DdbFeat[]

  inventory: DdbItem[]

  currencies: {
    cp: number
    sp: number
    ep: number
    gp: number
    pp: number
  }

  traits: {
    personalityTraits: string
    ideals: string
    bonds: string
    flaws: string
    appearance: string
  }

  notes: {
    backstory: string
    allies: string
    enemies: string
    organizations: string
    otherNotes: string
  }

  decorations: {
    avatarUrl: string
    frameAvatarUrl: string
  }

  deathSaves: {
    failCount: number
    successCount: number
  }

  conditions: Array<{
    id: number
    level: number | null
  }>

  inspiration: boolean
}

// ============================================
// MAPPING UTILITIES
// ============================================

const DDB_STAT_MAP: Record<number, Ability> = {
  1: 'strength',
  2: 'dexterity',
  3: 'constitution',
  4: 'intelligence',
  5: 'wisdom',
  6: 'charisma'
}

const DDB_SIZE_MAP: Record<number, Size> = {
  2: 'tiny',
  3: 'small',
  4: 'medium',
  5: 'large',
  6: 'huge',
  7: 'gargantuan'
}

export const DDB_ALIGNMENT_MAP: Record<number, Alignment> = {
  1: 'lawful_good',
  2: 'neutral_good',
  3: 'chaotic_good',
  4: 'lawful_neutral',
  5: 'true_neutral',
  6: 'chaotic_neutral',
  7: 'lawful_evil',
  8: 'neutral_evil',
  9: 'chaotic_evil'
}

const DDB_SPELL_SCHOOL_MAP: Record<string, SpellSchool> = {
  'Abjuration': 'abjuration',
  'Conjuration': 'conjuration',
  'Divination': 'divination',
  'Enchantment': 'enchantment',
  'Evocation': 'evocation',
  'Illusion': 'illusion',
  'Necromancy': 'necromancy',
  'Transmutation': 'transmutation'
}

const DDB_HIT_DIE_MAP: Record<number, 'd6' | 'd8' | 'd10' | 'd12'> = {
  6: 'd6',
  8: 'd8',
  10: 'd10',
  12: 'd12'
}

const DDB_SKILL_MAP: Record<string, Skill> = {
  'acrobatics': 'acrobatics',
  'animal-handling': 'animal_handling',
  'arcana': 'arcana',
  'athletics': 'athletics',
  'deception': 'deception',
  'history': 'history',
  'insight': 'insight',
  'intimidation': 'intimidation',
  'investigation': 'investigation',
  'medicine': 'medicine',
  'nature': 'nature',
  'perception': 'perception',
  'performance': 'performance',
  'persuasion': 'persuasion',
  'religion': 'religion',
  'sleight-of-hand': 'sleight_of_hand',
  'stealth': 'stealth',
  'survival': 'survival'
}

const DDB_CONDITION_MAP: Record<number, Condition> = {
  1: 'blinded',
  2: 'charmed',
  3: 'deafened',
  4: 'frightened',
  5: 'grappled',
  6: 'incapacitated',
  7: 'invisible',
  8: 'paralyzed',
  9: 'petrified',
  10: 'poisoned',
  11: 'prone',
  12: 'restrained',
  13: 'stunned',
  14: 'unconscious',
  // Exhaustion levels
  15: 'exhaustion_1',
  16: 'exhaustion_2',
  17: 'exhaustion_3',
  18: 'exhaustion_4',
  19: 'exhaustion_5',
  20: 'exhaustion_6'
}

const DDB_ITEM_TYPE_MAP: Record<string, ItemType> = {
  'Weapon': 'weapon',
  'Armor': 'armor',
  'Shield': 'shield',
  'Adventuring Gear': 'adventuring_gear',
  'Tool': 'tool',
  'Mount': 'mount',
  'Vehicle': 'vehicle',
  'Trade Good': 'trade_good',
  'Treasure': 'treasure',
  'Wondrous Item': 'wondrous_item',
  'Potion': 'potion',
  'Scroll': 'scroll',
  'Wand': 'wand',
  'Rod': 'rod',
  'Staff': 'staff',
  'Ring': 'ring',
  'Ammunition': 'ammunition'
}

const DDB_RARITY_MAP: Record<string, ItemRarity> = {
  'Common': 'common',
  'Uncommon': 'uncommon',
  'Rare': 'rare',
  'Very Rare': 'very_rare',
  'Legendary': 'legendary',
  'Artifact': 'artifact'
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

/**
 * Parse ability scores from DDB stats
 */
function parseAbilityScores(stats: DdbStat[]): AbilityScores {
  const scores: AbilityScores = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  }

  for (const stat of stats) {
    const ability = DDB_STAT_MAP[stat.id]
    if (ability) {
      scores[ability] = stat.value
    }
  }

  return scores
}

/**
 * Parse ability bonuses from modifiers
 */
function parseAbilityBonuses(
  ddb: DdbCharacter
): AbilityBonus[] {
  const bonuses: AbilityBonus[] = []

  // Bonus stats (racial, etc.)
  for (const stat of ddb.bonusStats || []) {
    const ability = DDB_STAT_MAP[stat.id]
    if (ability && stat.value) {
      bonuses.push({
        source: 'race',
        sourceName: ddb.race.baseRaceName,
        ability,
        value: stat.value
      })
    }
  }

  // Override stats (magic items, etc.)
  for (const stat of ddb.overrideStats || []) {
    const ability = DDB_STAT_MAP[stat.id]
    if (ability && stat.value) {
      bonuses.push({
        source: 'override',
        sourceName: 'Override',
        ability,
        value: stat.value - 10  // Store as bonus over base 10
      })
    }
  }

  return bonuses
}

/**
 * Parse race/species
 */
function parseRace(ddb: DdbCharacter): Race {
  const race = ddb.race
  const speeds = race.weightSpeeds?.normal || {}

  const traits: RaceTrait[] = (race.racialTraits || []).map(trait => ({
    name: trait.definition.name,
    description: trait.definition.description,
    source: 'D&D Beyond'
  }))

  return {
    name: race.baseRaceName,
    displayName: race.baseRaceName,
    size: DDB_SIZE_MAP[race.sizeId] || 'medium',
    speed: speeds.walk || 30,
    creatureType: 'humanoid',
    traits,
    languages: extractLanguages(ddb),
    weaponProficiencies: [],
    armorProficiencies: [],
    toolProficiencies: [],
    source: 'D&D Beyond',
    isHomebrew: false,
    ddbId: race.baseRaceId
  }
}

/**
 * Extract languages from modifiers
 */
function extractLanguages(ddb: DdbCharacter): string[] {
  const languages: string[] = []
  const allModifiers = [
    ...(ddb.modifiers.race || []),
    ...(ddb.modifiers.class || []),
    ...(ddb.modifiers.background || []),
    ...(ddb.modifiers.feat || [])
  ]

  for (const mod of allModifiers) {
    if (mod.type === 'language') {
      languages.push(mod.friendlySubtypeName)
    }
  }

  return [...new Set(languages)]
}

/**
 * Parse classes
 */
function parseClasses(ddb: DdbCharacter): Class[] {
  return ddb.classes.map(cls => {
    const hitDie: HitDie = {
      die: DDB_HIT_DIE_MAP[cls.definition.hitDice] || 'd8',
      used: 0,
      max: cls.level
    }

    // Spellcasting if applicable
    let spellcasting: Spellcasting | undefined
    if (cls.definition.spellCastingAbilityId) {
      const ability = DDB_STAT_MAP[cls.definition.spellCastingAbilityId]
      if (ability) {
        spellcasting = {
          ability,
          slots: parseSpellSlots(ddb.spellSlots),
          cantripsKnown: countCantrips(ddb, cls.definition.name),
          ritualCasting: true  // Most casters have this
        }

        // Warlock pact magic
        if (cls.definition.name === 'Warlock' && ddb.pactMagic?.length) {
          const pact = ddb.pactMagic[0]
          spellcasting.pactMagic = {
            slotLevel: pact.level,
            slotsMax: pact.available,
            slotsUsed: pact.used
          }
        }
      }
    }

    // Extract saving throw proficiencies for starting class
    const savingThrows: Ability[] = []
    if (cls.isStartingClass) {
      for (const mod of ddb.modifiers.class || []) {
        if (mod.type === 'proficiency' && mod.subType.includes('saving-throws')) {
          const ability = mod.subType.replace('-saving-throws', '') as Ability
          if (Object.values(DDB_STAT_MAP).includes(ability)) {
            savingThrows.push(ability)
          }
        }
      }
    }

    return {
      name: cls.definition.name,
      level: cls.level,
      subclass: cls.subclassDefinition?.name,
      subclassLevel: cls.subclassDefinition ? 3 : undefined,  // Most subclasses at 3
      hitDie,
      isStartingClass: cls.isStartingClass,
      savingThrows,
      skillProficiencies: [],
      weaponProficiencies: [],
      armorProficiencies: [],
      toolProficiencies: [],
      features: [],  // TODO: Parse class features
      spellcasting,
      source: 'D&D Beyond',
      isHomebrew: false,
      ddbId: cls.definition.id
    }
  })
}

/**
 * Parse spell slots
 */
function parseSpellSlots(slots: DdbCharacter['spellSlots']): Array<{ max: number; used: number }> {
  return (slots || [])
    .filter(s => s.level > 0 && s.level <= 9)
    .sort((a, b) => a.level - b.level)
    .map(s => ({
      max: s.available,
      used: s.used
    }))
}

/**
 * Count cantrips for a class
 */
function countCantrips(ddb: DdbCharacter, _className: string): number {
  let count = 0
  for (const block of ddb.classSpells || []) {
    for (const spell of block.spells || []) {
      if (spell.definition.level === 0) {
        count++
      }
    }
  }
  return count
}

/**
 * Parse background
 */
function parseBackground(ddb: DdbCharacter): Background {
  const bg = ddb.background

  if (bg.customBackground) {
    return {
      name: bg.customBackground.name || 'Custom',
      description: bg.customBackground.description,
      skillProficiencies: extractSkillProficiencies(ddb, 'background'),
      toolProficiencies: [],
      languages: [],
      equipment: [],
      feature: bg.customBackground.featuresBackground ? {
        name: bg.customBackground.featuresBackground.name,
        description: bg.customBackground.featuresBackground.description
      } : undefined,
      personalityTraits: [],
      ideals: [],
      bonds: [],
      flaws: [],
      source: 'Custom',
      isHomebrew: true
    }
  }

  if (bg.definition) {
    return {
      name: bg.definition.name,
      description: bg.definition.description,
      skillProficiencies: extractSkillProficiencies(ddb, 'background'),
      toolProficiencies: [],
      languages: [],
      equipment: [],
      feature: {
        name: bg.definition.featureName,
        description: bg.definition.featureDescription
      },
      personalityTraits: [],
      ideals: [],
      bonds: [],
      flaws: [],
      source: 'D&D Beyond',
      isHomebrew: false,
      ddbId: bg.definition.id
    }
  }

  return {
    name: 'Unknown',
    skillProficiencies: [],
    toolProficiencies: [],
    languages: [],
    equipment: [],
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    isHomebrew: false
  }
}

/**
 * Extract skill proficiencies from modifiers
 */
function extractSkillProficiencies(
  ddb: DdbCharacter,
  source: 'race' | 'class' | 'background' | 'feat'
): Skill[] {
  const skills: Skill[] = []
  const modifiers = ddb.modifiers[source] || []

  for (const mod of modifiers) {
    if (mod.type === 'proficiency') {
      const skillKey = mod.subType.toLowerCase().replace(' ', '-')
      const skill = DDB_SKILL_MAP[skillKey]
      if (skill) {
        skills.push(skill)
      }
    }
  }

  return skills
}

/**
 * Parse feats
 */
function parseFeats(ddb: DdbCharacter): Feat[] {
  return (ddb.feats || []).map(feat => ({
    name: feat.definition.name,
    description: feat.definition.description,
    source: 'D&D Beyond',
    isHomebrew: false,
    ddbId: feat.definition.id
  }))
}

/**
 * Parse spells
 */
function parseSpells(ddb: DdbCharacter): Spell[] {
  const spells: Spell[] = []

  for (const block of ddb.classSpells || []) {
    for (const spell of block.spells || []) {
      const def = spell.definition

      spells.push({
        name: def.name,
        level: def.level,
        school: DDB_SPELL_SCHOOL_MAP[def.school] || 'evocation',
        castingTime: def.castingTimeDescription,
        range: formatRange(def.range),
        components: {
          verbal: def.components.includes(1),
          somatic: def.components.includes(2),
          material: def.components.includes(3),
          materialConsumed: false,
          materialDescription: def.componentsDescription
        },
        duration: formatDuration(def.duration),
        concentration: def.concentration,
        ritual: def.ritual,
        description: def.description,
        higherLevels: def.atHigherLevels?.higherLevelDefinitions?.[0]?.description,
        prepared: spell.prepared,
        alwaysPrepared: spell.alwaysPrepared,
        source: 'D&D Beyond',
        isHomebrew: false,
        ddbId: def.id
      })
    }
  }

  return spells
}

function formatRange(range: DdbSpell['definition']['range']): string {
  if (range.origin === 'Self') return 'Self'
  if (range.origin === 'Touch') return 'Touch'
  if (range.rangeValue) return `${range.rangeValue} feet`
  return 'Self'
}

function formatDuration(duration: DdbSpell['definition']['duration']): string {
  if (duration.durationType === 'Instantaneous') return 'Instantaneous'
  if (duration.durationInterval && duration.durationUnit) {
    return `${duration.durationInterval} ${duration.durationUnit}`
  }
  return 'Instantaneous'
}

/**
 * Parse inventory
 */
export function parseInventory(ddb: DdbCharacter): InventoryItem[] {
  return (ddb.inventory || []).map(item => {
    const def = item.definition

    const inventoryItem: InventoryItem = {
      id: crypto.randomUUID(),
      name: def.name,
      type: DDB_ITEM_TYPE_MAP[def.filterType] || 'other',
      quantity: item.quantity,
      weight: def.weight,
      value: def.cost / 100,  // DDB stores in copper
      description: def.description,
      equipped: item.equipped,
      attuned: item.isAttuned,
      requiresAttunement: def.canAttune,
      magical: def.magic,
      container: def.isContainer,
      containedItems: [],
      source: 'D&D Beyond',
      isHomebrew: false,
      ddbId: def.id
    }

    // Rarity
    if (def.rarity && DDB_RARITY_MAP[def.rarity]) {
      inventoryItem.rarity = DDB_RARITY_MAP[def.rarity]
    }

    // Weapon properties
    if (def.damage) {
      const props = def.properties.map(p => p.name.toLowerCase())
      inventoryItem.weapon = {
        damage: def.damage.diceString,
        damageType: def.damage.damageType.name.toLowerCase(),
        properties: props,
        thrown: props.includes('thrown')
      }
    }

    // Armor properties
    if (def.armorClass) {
      inventoryItem.armor = {
        baseAC: def.armorClass,
        addDex: def.armorTypeId !== 3,  // Heavy armor doesn't add DEX
        maxDex: def.armorTypeId === 2 ? 2 : undefined,  // Medium armor
        stealthDisadvantage: false  // Would need to check properties
      }
    }

    return inventoryItem
  })
}

/**
 * Parse currency
 */
export function parseCurrency(ddb: DdbCharacter): Currency {
  return {
    copper: ddb.currencies?.cp || 0,
    silver: ddb.currencies?.sp || 0,
    electrum: ddb.currencies?.ep || 0,
    gold: ddb.currencies?.gp || 0,
    platinum: ddb.currencies?.pp || 0
  }
}

/**
 * Parse proficiencies from all sources
 */
function parseProficiencies(ddb: DdbCharacter): Character['proficiencies'] {
  const skills: Record<Skill, ProficiencyLevel> = {} as any
  const savingThrows: Record<Ability, ProficiencyLevel> = {} as any
  const weapons: string[] = []
  const armor: string[] = []
  const tools: string[] = []
  const languages: string[] = []

  const allModifiers = [
    ...(ddb.modifiers.race || []),
    ...(ddb.modifiers.class || []),
    ...(ddb.modifiers.background || []),
    ...(ddb.modifiers.feat || []),
    ...(ddb.modifiers.item || [])
  ]

  for (const mod of allModifiers) {
    if (mod.type === 'proficiency') {
      const subType = mod.subType.toLowerCase()

      // Skills
      const skillKey = subType.replace(' ', '-')
      if (DDB_SKILL_MAP[skillKey]) {
        skills[DDB_SKILL_MAP[skillKey]] = 'proficient'
      }

      // Saving throws
      if (subType.includes('saving-throws')) {
        const ability = subType.replace('-saving-throws', '') as Ability
        if (Object.values(DDB_STAT_MAP).includes(ability)) {
          savingThrows[ability] = 'proficient'
        }
      }

      // Weapons
      if (subType.includes('weapon') || subType.includes('martial') || subType.includes('simple')) {
        weapons.push(mod.friendlySubtypeName)
      }

      // Armor
      if (subType.includes('armor') || subType.includes('shield')) {
        armor.push(mod.friendlySubtypeName)
      }
    }

    // Expertise
    if (mod.type === 'expertise') {
      const skillKey = mod.subType.toLowerCase().replace(' ', '-')
      if (DDB_SKILL_MAP[skillKey]) {
        skills[DDB_SKILL_MAP[skillKey]] = 'expertise'
      }
    }

    // Languages
    if (mod.type === 'language') {
      languages.push(mod.friendlySubtypeName)
    }
  }

  return {
    skills,
    savingThrows,
    weapons: [...new Set(weapons)],
    armor: [...new Set(armor)],
    tools: [...new Set(tools)],
    languages: [...new Set(languages)]
  }
}

/**
 * Parse conditions
 */
function parseConditions(ddb: DdbCharacter): Condition[] {
  return (ddb.conditions || [])
    .map(c => {
      if (c.id === 4 && c.level) {  // Exhaustion
        return DDB_CONDITION_MAP[14 + c.level] // exhaustion_1 through exhaustion_6
      }
      return DDB_CONDITION_MAP[c.id]
    })
    .filter((c): c is Condition => !!c)
}

/**
 * Calculate max HP from DDB data
 */
function calculateMaxHp(ddb: DdbCharacter): number {
  if (ddb.overrideHitPoints) {
    return ddb.overrideHitPoints
  }
  return ddb.baseHitPoints + ddb.bonusHitPoints
}

/**
 * Calculate current HP
 */
function calculateCurrentHp(ddb: DdbCharacter): number {
  const max = calculateMaxHp(ddb)
  return max - ddb.removedHitPoints
}

// ============================================
// MAIN IMPORT FUNCTION
// ============================================

export interface ImportResult {
  success: boolean
  character?: Partial<Character>
  errors: string[]
  warnings: string[]
}

/**
 * Import a D&D Beyond character JSON into our schema
 */
export function importFromDDB(
  ddbJson: unknown,
  campaignId: string,
  ownerId: string
): ImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate it's an object
  if (!ddbJson || typeof ddbJson !== 'object') {
    return {
      success: false,
      errors: ['Invalid JSON: expected an object'],
      warnings: []
    }
  }

  const ddb = ddbJson as DdbCharacter

  // Validate required fields
  if (!ddb.name) {
    errors.push('Missing required field: name')
  }
  if (!ddb.stats?.length) {
    errors.push('Missing required field: stats')
  }
  if (!ddb.classes?.length) {
    errors.push('Missing required field: classes')
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  try {
    const character: Partial<Character> = {
      id: crypto.randomUUID(),
      campaignId,
      ownerId,

      name: ddb.name,
      ruleset: '2014',  // DDB is 2014 rules currently

      baseAbilityScores: parseAbilityScores(ddb.stats),
      abilityBonuses: parseAbilityBonuses(ddb),

      race: parseRace(ddb),
      classes: parseClasses(ddb),
      background: parseBackground(ddb),

      feats: parseFeats(ddb),
      proficiencies: parseProficiencies(ddb),
      spells: parseSpells(ddb),

      // Note: inventory and currency are handled separately via the inventory system
      // The parsed data is available via parseInventory(ddb) and parseCurrency(ddb)

      combat: {
        hp: calculateCurrentHp(ddb),
        maxHp: calculateMaxHp(ddb),
        tempHp: ddb.temporaryHitPoints || 0,
        deathSaves: {
          successes: ddb.deathSaves?.successCount || 0,
          failures: ddb.deathSaves?.failCount || 0
        },
        conditions: parseConditions(ddb),
        inspiration: ddb.inspiration || false
      },

      experience: ddb.currentXp || 0,

      appearance: {
        age: ddb.age?.toString(),
        height: ddb.height,
        weight: ddb.weight?.toString(),
        eyes: ddb.eyes,
        hair: ddb.hair,
        skin: ddb.skin,
        description: ddb.traits?.appearance,
        portraitUrl: ddb.decorations?.avatarUrl
      },

      personality: {
        traits: ddb.traits?.personalityTraits ? [ddb.traits.personalityTraits] : [],
        ideals: ddb.traits?.ideals ? [ddb.traits.ideals] : [],
        bonds: ddb.traits?.bonds ? [ddb.traits.bonds] : [],
        flaws: ddb.traits?.flaws ? [ddb.traits.flaws] : []
      },

      backstory: {
        backstory: ddb.notes?.backstory,
        allies: ddb.notes?.allies,
        enemies: ddb.notes?.enemies,
        organizations: ddb.notes?.organizations,
        notes: ddb.notes?.otherNotes
      },

      speed: {
        walk: ddb.race?.weightSpeeds?.normal?.walk || 30,
        fly: ddb.race?.weightSpeeds?.normal?.fly,
        swim: ddb.race?.weightSpeeds?.normal?.swim,
        climb: ddb.race?.weightSpeeds?.normal?.climb,
        burrow: ddb.race?.weightSpeeds?.normal?.burrow
      },

      senses: {},
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],

      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,

      importSource: 'ddb',
      ddbCharacterId: ddb.id,

      status: 'alive',
      isNPC: false
    }

    // Add warnings for things we couldn't fully parse
    if (!ddb.background?.definition && !ddb.background?.customBackground) {
      warnings.push('Background could not be fully imported')
    }

    return {
      success: true,
      character,
      errors: [],
      warnings
    }
  } catch (error) {
    return {
      success: false,
      errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    }
  }
}

/**
 * Fetch character from D&D Beyond by ID
 * Note: This may not work in all environments due to CORS
 */
export async function fetchDDBCharacter(characterId: number): Promise<DdbCharacter> {
  const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch character: ${response.status}`)
  }

  const data = await response.json() as { data: DdbCharacter }
  return data.data
}
