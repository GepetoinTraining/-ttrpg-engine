/**
 * MAGIC SYSTEM — Chemistry With a Different Substrate
 * =====================================================
 * 
 * DESIGN:
 *   Base world uses "REAL MAGIC" (the tough one):
 *     - Lore gates: you must STUDY spells, not just pick them
 *     - Entropy: reality pushes back, casting accumulates paradox
 *     - Materials: you need components, and the economy tracks them
 *     - Blood magic: sorcerers can pay in HP instead of slots
 *     - Biome: some spells only work in certain locations
 * 
 *   Easier configurations ADD spell slots as simplification:
 *     EASY:   Slots only. No tracking. Power fantasy.
 *     NORMAL: Slots + expensive components. Standard D&D.
 *     HARD:   Real magic. Lore + entropy + economy. (DEFAULT WORLD)
 *     BRUTAL: Magic doesn't exist. Invent technology instead.
 * 
 *   Monster abilities ARE magic:
 *     A dragon's breath = Fire³ × Cone × Instant × Greater
 *     A beholder's eye ray = Force² × Ranged × Instant
 *     An aboleth's psychic lash = Psychic² × Ranged × Debuff
 *     Monsters don't use spell slots — they use INNATE magic.
 * 
 * SPELL IDENTITY:
 *   Each spell = product of prime numbers.
 *   Fireball = Fire³ × Area² × Ranged × Instant × Standard
 *   The seed IS the spell. Forever. Everywhere.
 *   Factorize the seed → get the composition back.
 */

// ============================================================
// DIFFICULTY MODES
// ============================================================

export type MagicDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'BRUTAL'

export interface MagicConfig {
  name: string
  description: string

  // What's tracked
  magicExists: boolean
  trackMaterials: boolean
  materialsConsumed: boolean
  requireFocus: boolean
  requireLore: boolean
  loreGatesActive: boolean

  // Entropy/paradox
  entropyEnabled: boolean
  entropyMultiplier: number
  entropyDecayRate: number  // 0-1, how fast entropy decays on short rest

  // Economy
  economyAffectsAvailability: boolean
  scrollsAsResource: boolean

  // Class identity
  classIdentityStrong: boolean
  sorcererBloodMagic: boolean

  // Wild magic
  wildMagicEnabled: boolean
  wildMagicChance: number  // Base % on cast

  // Combat
  concentrationChecks: boolean
  counterspellEnabled: boolean

  // Lore speed
  loreXpMultiplier: number
}

export const MAGIC_CONFIGS: Record<MagicDifficulty, MagicConfig> = {
  EASY: {
    name: 'Easy', description: 'Power fantasy. Spell slots only.',
    magicExists: true, trackMaterials: false, materialsConsumed: false,
    requireFocus: false, requireLore: false, loreGatesActive: false,
    entropyEnabled: false, entropyMultiplier: 0, entropyDecayRate: 1,
    economyAffectsAvailability: false, scrollsAsResource: false,
    classIdentityStrong: false, sorcererBloodMagic: false,
    wildMagicEnabled: false, wildMagicChance: 0,
    concentrationChecks: false, counterspellEnabled: true,
    loreXpMultiplier: 3,
  },
  NORMAL: {
    name: 'Normal', description: 'Standard D&D. Track slots and expensive components.',
    magicExists: true, trackMaterials: true, materialsConsumed: true,
    requireFocus: true, requireLore: false, loreGatesActive: false,
    entropyEnabled: false, entropyMultiplier: 0, entropyDecayRate: 1,
    economyAffectsAvailability: false, scrollsAsResource: true,
    classIdentityStrong: true, sorcererBloodMagic: false,
    wildMagicEnabled: true, wildMagicChance: 5,
    concentrationChecks: true, counterspellEnabled: true,
    loreXpMultiplier: 1,
  },
  HARD: {
    name: 'Hard', description: 'Real magic. Lore gates, entropy, economy, blood magic.',
    magicExists: true, trackMaterials: true, materialsConsumed: true,
    requireFocus: true, requireLore: true, loreGatesActive: true,
    entropyEnabled: true, entropyMultiplier: 1, entropyDecayRate: 0.5,
    economyAffectsAvailability: true, scrollsAsResource: true,
    classIdentityStrong: true, sorcererBloodMagic: true,
    wildMagicEnabled: true, wildMagicChance: 10,
    concentrationChecks: true, counterspellEnabled: true,
    loreXpMultiplier: 1,
  },
  BRUTAL: {
    name: 'Brutal', description: 'Magic does not exist. Invent technology.',
    magicExists: false, trackMaterials: true, materialsConsumed: true,
    requireFocus: true, requireLore: true, loreGatesActive: true,
    entropyEnabled: true, entropyMultiplier: 2, entropyDecayRate: 0.25,
    economyAffectsAvailability: true, scrollsAsResource: true,
    classIdentityStrong: true, sorcererBloodMagic: true,
    wildMagicEnabled: false, wildMagicChance: 0,
    concentrationChecks: true, counterspellEnabled: false,
    loreXpMultiplier: 0.5,
  },
}

// ============================================================
// SPELL SCHOOLS
// ============================================================

export type SpellSchool = 'abjuration' | 'conjuration' | 'divination' | 'enchantment' |
  'evocation' | 'illusion' | 'necromancy' | 'transmutation'

// ============================================================
// SPELL ELEMENTS — Prime Composition
// ============================================================

export interface SpellElement {
  prime: number
  name: string
  category: 'damage' | 'delivery' | 'school' | 'duration' | 'intensity'
  school?: SpellSchool
}

/** The periodic table of magic. Each element = a prime number. */
export const SPELL_ELEMENTS: Record<string, SpellElement> = {
  // ── Damage (what force is applied) ──
  Fire:      { prime: 137, name: 'Fire',      category: 'damage', school: 'evocation' },
  Cold:      { prime: 139, name: 'Cold',      category: 'damage', school: 'evocation' },
  Lightning: { prime: 149, name: 'Lightning', category: 'damage', school: 'evocation' },
  Acid:      { prime: 151, name: 'Acid',      category: 'damage', school: 'conjuration' },
  Poison:    { prime: 157, name: 'Poison',    category: 'damage', school: 'necromancy' },
  Necrotic:  { prime: 163, name: 'Necrotic',  category: 'damage', school: 'necromancy' },
  Radiant:   { prime: 167, name: 'Radiant',   category: 'damage', school: 'evocation' },
  Force:     { prime: 173, name: 'Force',     category: 'damage', school: 'evocation' },
  Psychic:   { prime: 179, name: 'Psychic',   category: 'damage', school: 'enchantment' },
  Thunder:   { prime: 181, name: 'Thunder',   category: 'damage', school: 'evocation' },

  // ── Delivery (how the spell reaches target) ──
  Ranged:  { prime: 191, name: 'Ranged',  category: 'delivery' },
  Touch:   { prime: 193, name: 'Touch',   category: 'delivery' },
  Self:    { prime: 197, name: 'Self',    category: 'delivery' },
  Area:    { prime: 199, name: 'Area',    category: 'delivery' },
  Cone:    { prime: 211, name: 'Cone',    category: 'delivery' },
  Line:    { prime: 223, name: 'Line',    category: 'delivery' },
  Chain:   { prime: 227, name: 'Chain',   category: 'delivery' },

  // ── School effects (what the magic does) ──
  Healing:    { prime: 229, name: 'Healing',    category: 'school', school: 'evocation' },
  Buff:       { prime: 233, name: 'Buff',       category: 'school', school: 'transmutation' },
  Debuff:     { prime: 239, name: 'Debuff',     category: 'school', school: 'enchantment' },
  Summon:     { prime: 241, name: 'Summon',     category: 'school', school: 'conjuration' },
  Illusion:   { prime: 251, name: 'Illusion',   category: 'school', school: 'illusion' },
  Divination: { prime: 257, name: 'Divination', category: 'school', school: 'divination' },
  Abjuration: { prime: 263, name: 'Abjuration', category: 'school', school: 'abjuration' },
  Transform:  { prime: 269, name: 'Transform',  category: 'school', school: 'transmutation' },
  Control:    { prime: 271, name: 'Control',    category: 'school', school: 'enchantment' },
  Animate:    { prime: 277, name: 'Animate',    category: 'school', school: 'necromancy' },
  Teleport:   { prime: 281, name: 'Teleport',   category: 'school', school: 'conjuration' },
  Create:     { prime: 283, name: 'Create',     category: 'school', school: 'conjuration' },

  // ── Duration (how long it lasts) ──
  Instant:   { prime: 293, name: 'Instant',   category: 'duration' },
  Sustained: { prime: 307, name: 'Sustained', category: 'duration' }, // Concentration
  Lasting:   { prime: 311, name: 'Lasting',   category: 'duration' },
  Permanent: { prime: 313, name: 'Permanent', category: 'duration' },
  Ritual:    { prime: 317, name: 'Ritual',    category: 'duration' },

  // ── Intensity (power level) ──
  Minor:    { prime: 331, name: 'Minor',    category: 'intensity' }, // Cantrip
  Lesser:   { prime: 337, name: 'Lesser',   category: 'intensity' }, // 1-2
  Standard: { prime: 347, name: 'Standard', category: 'intensity' }, // 3-5
  Greater:  { prime: 349, name: 'Greater',  category: 'intensity' }, // 6-7
  Supreme:  { prime: 353, name: 'Supreme',  category: 'intensity' }, // 8
  Ultimate: { prime: 359, name: 'Ultimate', category: 'intensity' }, // 9
}

// ============================================================
// SPELL COMPOSITION — Prime factorization
// ============================================================

/** Compose a spell: elements → unique seed (product of primes). */
export function composeSpell(elements: Record<string, number>): bigint {
  let seed = 1n
  for (const [name, count] of Object.entries(elements)) {
    const el = SPELL_ELEMENTS[name]
    if (el) seed *= BigInt(el.prime) ** BigInt(count)
  }
  return seed
}

/** Factorize a seed back to its elements. */
export function factorizeSpell(seed: bigint): Record<string, number> {
  const result: Record<string, number> = {}
  let remaining = seed

  // Build reverse lookup
  const primeMap: Record<number, string> = {}
  for (const [name, el] of Object.entries(SPELL_ELEMENTS)) {
    primeMap[el.prime] = name
  }

  const primes = Object.values(SPELL_ELEMENTS).map(e => e.prime).sort((a, b) => b - a)
  for (const prime of primes) {
    const bp = BigInt(prime)
    let count = 0
    while (remaining % bp === 0n) { count++; remaining /= bp }
    if (count > 0) {
      const name = primeMap[prime]
      if (name) result[name] = count
    }
  }
  return result
}

/** Determine dominant school from composition. */
export function getSpellSchool(elements: Record<string, number>): SpellSchool | null {
  let best: { school: SpellSchool; count: number } | null = null
  for (const [name, count] of Object.entries(elements)) {
    const el = SPELL_ELEMENTS[name]
    if (el?.school && (!best || count > best.count)) {
      best = { school: el.school, count }
    }
  }
  return best?.school ?? null
}

/** Calculate spell level from composition. */
export function calculateSpellLevel(elements: Record<string, number>): number {
  if (elements['Ultimate']) return 9
  if (elements['Supreme']) return 8
  if (elements['Greater']) return Math.min(7, Math.max(6, Math.floor(totalComplexity(elements) / 2)))
  if (elements['Standard']) return Math.min(5, Math.max(3, Math.floor(totalComplexity(elements) / 2)))
  if (elements['Lesser']) return Math.min(2, Math.max(1, Math.floor(totalComplexity(elements) / 3)))
  if (elements['Minor']) return 0
  return Math.min(9, Math.max(0, Math.floor(totalComplexity(elements) / 3)))
}

function totalComplexity(elements: Record<string, number>): number {
  return Object.values(elements).reduce((s, c) => s + c, 0)
}

/** Calculate entropy risk from composition. */
export function calculateEntropyRisk(elements: Record<string, number>): number {
  let risk = 0
  for (const [name, count] of Object.entries(elements)) {
    const el = SPELL_ELEMENTS[name]
    if (el?.school === 'necromancy') risk += count * 15
    if (name === 'Necrotic' || name === 'Poison') risk += count * 10
  }
  if (elements['Ultimate']) risk += 30
  if (elements['Supreme']) risk += 20
  if (elements['Greater']) risk += 10
  return Math.min(100, risk)
}

// ============================================================
// SPELL — A complete spell definition
// ============================================================

export interface Spell {
  id: string
  name: string
  level: number         // 0 = cantrip
  school: SpellSchool
  elements: Record<string, number>
  seed: bigint

  // Effects
  dice?: string         // "8d6", "2d10+5"
  damageType?: string
  range?: number        // feet
  area?: { shape: 'sphere' | 'cube' | 'cone' | 'line' | 'cylinder'; size: number }
  targets?: 'self' | 'single' | 'multiple' | 'area'
  duration?: string
  concentration?: boolean
  ritual?: boolean

  // Conditions applied
  condition?: string    // "paralyzed", "charmed"
  saveAbility?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

  // Costs (HARD mode)
  materials?: { element: string; quantity: number; consumed: boolean }[]
  loreTopic?: string
  loreLevel?: number
  biome?: string
  healthCost?: number   // Blood magic

  // Casting
  verbal?: boolean
  somatic?: boolean

  // Who can use it
  classes?: string[]
  /** If true, this is a monster innate ability, not a learned spell */
  innate?: boolean
}

// ============================================================
// MONSTER ABILITY — Magic that monsters use
// ============================================================

/**
 * Monster abilities ARE spells with `innate: true`.
 * They don't use slots. They have recharge mechanics.
 * 
 * Dragon breath = Fire³ × Cone × Instant × Greater + innate
 * Beholder ray  = Force² × Ranged × Instant + innate
 * Lich spells   = actual spells, accessed via slots (lich IS a caster)
 */
export interface MonsterAbility {
  spell: Spell
  /** Recharge: 'at_will' | 'X/day' | 'recharge_5_6' | 'recharge_6' */
  recharge: string
  /** Uses remaining (if limited) */
  usesRemaining?: number
  /** Max uses per day (if limited) */
  maxUses?: number
}

/** Create a monster ability from spell elements. */
export function createMonsterAbility(
  name: string,
  elements: Record<string, number>,
  overrides: Partial<Spell> & { recharge: string },
): MonsterAbility {
  const seed = composeSpell(elements)
  const level = calculateSpellLevel(elements)
  const school = getSpellSchool(elements) ?? 'evocation'

  const spell: Spell = {
    id: `ma_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    level,
    school,
    elements,
    seed,
    innate: true,
    ...overrides,
  }

  const maxUses = parseRechargeUses(overrides.recharge)

  return {
    spell,
    recharge: overrides.recharge,
    usesRemaining: maxUses,
    maxUses,
  }
}

function parseRechargeUses(recharge: string): number | undefined {
  if (recharge === 'at_will') return undefined
  const match = recharge.match(/^(\d+)\/day$/)
  if (match) return parseInt(match[1])
  return undefined // recharge_X_Y doesn't have "uses"
}

// ============================================================
// EXAMPLE MONSTER ABILITIES
// ============================================================

export const EXAMPLE_MONSTER_ABILITIES = {
  /** Adult Red Dragon breath weapon */
  DragonBreath: createMonsterAbility('Fire Breath', {
    Fire: 3, Cone: 1, Instant: 1, Greater: 1,
  }, {
    recharge: 'recharge_5_6',
    dice: '18d6', damageType: 'fire',
    area: { shape: 'cone', size: 60 },
    saveAbility: 'dex',
  }),

  /** Beholder Disintegration Ray */
  BeholderRay: createMonsterAbility('Disintegration Ray', {
    Force: 2, Ranged: 1, Instant: 1, Greater: 1,
  }, {
    recharge: 'at_will',
    dice: '10d8', damageType: 'force',
    range: 120, targets: 'single',
    saveAbility: 'dex',
  }),

  /** Mind Flayer Mind Blast */
  MindBlast: createMonsterAbility('Mind Blast', {
    Psychic: 3, Cone: 1, Instant: 1, Standard: 1,
  }, {
    recharge: 'recharge_5_6',
    dice: '4d8+4', damageType: 'psychic',
    area: { shape: 'cone', size: 60 },
    saveAbility: 'int',
    condition: 'stunned',
  }),

  /** Aboleth Psychic Drain */
  AbolethDrain: createMonsterAbility('Psychic Drain', {
    Psychic: 2, Touch: 1, Instant: 1, Standard: 1,
  }, {
    recharge: '3/day',
    dice: '3d6', damageType: 'psychic',
    range: 5, targets: 'single',
  }),

  /** Banshee Wail */
  BansheeWail: createMonsterAbility('Wail', {
    Necrotic: 3, Area: 1, Instant: 1, Greater: 1,
  }, {
    recharge: '1/day',
    dice: '10d6', damageType: 'necrotic',
    area: { shape: 'sphere', size: 30 },
    saveAbility: 'con',
  }),
}

// ============================================================
// EXAMPLE SPELLS (learnable)
// ============================================================

export const EXAMPLE_SPELLS = {
  Fireball: {
    elements: { Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 },
    seed: composeSpell({ Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 }),
  },
  MagicMissile: {
    elements: { Force: 3, Ranged: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Force: 3, Ranged: 1, Instant: 1, Lesser: 1 }),
  },
  CureWounds: {
    elements: { Healing: 2, Touch: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Healing: 2, Touch: 1, Instant: 1, Lesser: 1 }),
  },
  AnimateDead: {
    elements: { Animate: 3, Touch: 1, Lasting: 1, Standard: 1 },
    seed: composeSpell({ Animate: 3, Touch: 1, Lasting: 1, Standard: 1 }),
  },
}

// ============================================================
// PARADOX ENGINE — Reality Pushes Back
// ============================================================

export type ParadoxSeverity = 'fizzle' | 'minor' | 'major' | 'catastrophic'

export interface ParadoxResult {
  triggered: boolean
  severity?: ParadoxSeverity
  effect?: string
  entropyGained?: number
}

/**
 * Paradox check: d100 against entropy risk.
 * Uses injected roll for determinism.
 */
export function checkParadox(
  entropyRisk: number,
  spellLevel: number,
  dailyEntropy: number,
  difficulty: MagicDifficulty,
  d100: number,
): ParadoxResult {
  const config = MAGIC_CONFIGS[difficulty]
  if (!config.entropyEnabled) return { triggered: false }

  const adjustedRisk = entropyRisk * config.entropyMultiplier
  const totalRisk = adjustedRisk + dailyEntropy

  if (d100 >= totalRisk) {
    return {
      triggered: false,
      entropyGained: Math.floor(adjustedRisk / 10),
    }
  }

  const margin = totalRisk - d100
  const levelBonus = Math.floor(spellLevel / 3) * 10
  const effectiveMargin = margin + levelBonus

  const severity: ParadoxSeverity =
    effectiveMargin < 20 ? 'fizzle' :
    effectiveMargin < 50 ? 'minor' :
    effectiveMargin < 80 ? 'major' : 'catastrophic'

  const effect = selectParadoxEffect(severity, d100)

  return {
    triggered: true,
    severity,
    effect,
    entropyGained: adjustedRisk,
  }
}

// ── Paradox effect tables ──

const FIZZLE_EFFECTS = [
  'Spell fizzles. Components consumed.',
  'Spell fails. Dazed for one round.',
  'Spell fails. 1d4 psychic feedback damage.',
]

const MINOR_EFFECTS = [
  'Spell succeeds at half power.',
  'Spell hits a random valid target.',
  'Spell succeeds. 1d6 psychic damage per spell level.',
  'Spell succeeds. Gain one exhaustion level.',
  'Spell succeeds. Wild magic surge.',
]

const MAJOR_EFFECTS = [
  'Spell inverts: healing harms, buffs debuff.',
  'Highest remaining spell slot burns out.',
  'School of magic locked for 1 hour.',
  'Two wild magic surges simultaneously.',
  'Stunned for 1 round + 2d6 psychic per spell level.',
]

const CATASTROPHIC_EFFECTS = [
  'Planar breach: hostile outsider summoned (CR = spell level).',
  'Total spell lock: cannot cast this spell for 24 hours.',
  'Reality scar: 60ft permanent wild magic zone.',
  'Hostile aberration attracted (CR = spell level + 2).',
  'Life force drain: 3d6 necrotic per level + 3 exhaustion.',
  'Temporal fracture: 1d4 hours pass in an instant.',
]

function selectParadoxEffect(severity: ParadoxSeverity, seed: number): string {
  const table = severity === 'fizzle' ? FIZZLE_EFFECTS
    : severity === 'minor' ? MINOR_EFFECTS
    : severity === 'major' ? MAJOR_EFFECTS
    : CATASTROPHIC_EFFECTS
  return table[seed % table.length]
}

// ============================================================
// WILD MAGIC TABLE
// ============================================================

export const WILD_MAGIC_TABLE = [
  { id: 'wm_fireball_self', text: 'Cast Fireball centered on yourself', beneficial: false },
  { id: 'wm_invisibility', text: 'Invisible for 1 minute', beneficial: true },
  { id: 'wm_levitate', text: 'Levitate uncontrollably for 1 minute', beneficial: false },
  { id: 'wm_healing', text: 'Regain 2d10 HP', beneficial: true },
  { id: 'wm_blue_skin', text: 'Skin turns blue for 24 hours', beneficial: false },
  { id: 'wm_third_eye', text: 'Third eye: +2 Perception for 1 hour', beneficial: true },
  { id: 'wm_enlarge', text: 'Grow 1 foot for 1 hour', beneficial: true },
  { id: 'wm_shrink', text: 'Shrink 6 inches for 1 hour', beneficial: false },
  { id: 'wm_butterflies', text: 'Illusory butterflies for 1 minute', beneficial: true },
  { id: 'wm_grease', text: 'Cast Grease centered on yourself', beneficial: false },
  { id: 'wm_confusion', text: 'Confusion 30ft radius', beneficial: false },
  { id: 'wm_slot_refund', text: 'Regain lowest expended slot', beneficial: true },
  { id: 'wm_vulnerability', text: 'Vulnerable to all damage for 1 minute', beneficial: false },
  { id: 'wm_resistance', text: 'Resistant to all damage for 1 minute', beneficial: true },
  { id: 'wm_max_damage', text: 'Next spell deals max damage', beneficial: true },
  { id: 'wm_age_younger', text: 'Become 1d10 years younger', beneficial: true },
  { id: 'wm_age_older', text: 'Become 1d10 years older', beneficial: false },
  { id: 'wm_unicorn', text: 'Spectral unicorn follows you for 1 hour', beneficial: true },
  { id: 'wm_fog', text: 'Cast Fog Cloud centered on yourself', beneficial: false },
  { id: 'wm_fly', text: 'Gain 30ft fly speed for 1 minute', beneficial: true },
] as const

export function rollWildMagic(d20: number): typeof WILD_MAGIC_TABLE[number] {
  return WILD_MAGIC_TABLE[d20 % WILD_MAGIC_TABLE.length]
}

// ============================================================
// CASTER STATE — Runtime context
// ============================================================

export interface CasterState {
  characterId: string
  casterType: 'wizard' | 'sorcerer' | 'cleric' | 'warlock' | 'druid' | 'bard' |
    'paladin' | 'ranger' | 'artificer' | 'innate'
  casterLevel: number

  // Slots (only used in EASY/NORMAL)
  slots: { level: number; max: number; used: number }[]

  // Pact slots (warlock)
  pactSlots?: { level: number; max: number; used: number }

  // Ability
  spellcastingAbility: 'int' | 'wis' | 'cha'
  spellcastingMod: number
  spellSaveDC: number
  spellAttackBonus: number

  // Blood magic (HARD)
  currentHP: number
  maxHP: number

  // Lore (HARD)
  lore: Record<string, { xp: number; level: number }>

  // Entropy (HARD)
  dailyEntropy: number

  // Concentration
  concentrating: string | null
}

// ============================================================
// CAST RESOLUTION
// ============================================================

export interface CastResult {
  success: boolean
  reason?: string

  // What happened
  slotUsed?: number
  materialsConsumed?: string[]
  healthPaid?: number

  // Paradox
  paradox?: ParadoxResult

  // Entropy change
  entropyGained?: number
}

/**
 * Determine if a caster can cast a spell.
 * Returns null if castable, or a failure reason string.
 */
export function canCast(
  spell: Spell,
  caster: CasterState,
  difficulty: MagicDifficulty,
  hasInventoryItem?: (element: string) => boolean,
): string | null {
  const config = MAGIC_CONFIGS[difficulty]

  // Magic exists?
  if (!config.magicExists) return 'Magic does not exist in this world.'

  // Innate abilities always castable (monsters)
  if (spell.innate) return null

  // Slot check (cantrips always available)
  if (spell.level > 0) {
    // Check pact slots (warlock)
    if (caster.pactSlots && caster.casterType === 'warlock') {
      if (caster.pactSlots.used < caster.pactSlots.max && caster.pactSlots.level >= spell.level) {
        // Can use pact slot
      } else {
        // Check regular slots as fallback
        const slot = caster.slots.find(s => s.level >= spell.level && s.used < s.max)
        if (!slot) return 'No spell slots available.'
      }
    } else {
      const slot = caster.slots.find(s => s.level >= spell.level && s.used < s.max)
      if (!slot) return 'No spell slots available.'
    }
  }

  // Lore gate (HARD)
  if (config.loreGatesActive && spell.loreTopic) {
    const lore = caster.lore[spell.loreTopic]
    const reqLevel = spell.loreLevel ?? 1
    if (!lore || lore.level < reqLevel) {
      return `Insufficient lore: ${spell.loreTopic} (need level ${reqLevel}).`
    }
  }

  // Material check
  if (config.trackMaterials && spell.materials && hasInventoryItem) {
    for (const mat of spell.materials) {
      if (!hasInventoryItem(mat.element)) {
        return `Missing component: ${mat.element}.`
      }
    }
  }

  // Blood magic check (sorcerer paying HP)
  if (spell.healthCost && caster.currentHP <= spell.healthCost) {
    return 'Not enough HP for blood magic cost.'
  }

  return null // Castable!
}

/**
 * Resolve a spell cast. Returns the result and mutates caster state.
 * @param d100 — Deterministic paradox roll
 */
export function resolveCast(
  spell: Spell,
  caster: CasterState,
  difficulty: MagicDifficulty,
  d100: number,
): CastResult {
  const config = MAGIC_CONFIGS[difficulty]

  // Monster innate abilities always succeed
  if (spell.innate) {
    return { success: true }
  }

  // Pay slot cost
  let slotUsed: number | undefined
  if (spell.level > 0) {
    if (caster.casterType === 'warlock' && caster.pactSlots) {
      if (caster.pactSlots.used < caster.pactSlots.max && caster.pactSlots.level >= spell.level) {
        caster.pactSlots.used++
        slotUsed = caster.pactSlots.level
      } else {
        const slot = caster.slots.find(s => s.level >= spell.level && s.used < s.max)
        if (slot) { slot.used++; slotUsed = slot.level }
      }
    } else {
      const slot = caster.slots.find(s => s.level >= spell.level && s.used < s.max)
      if (slot) { slot.used++; slotUsed = slot.level }
    }
  }

  // Pay health cost (blood magic)
  let healthPaid: number | undefined
  if (spell.healthCost && config.sorcererBloodMagic) {
    caster.currentHP -= spell.healthCost
    healthPaid = spell.healthCost
  }

  // Paradox check
  let paradox: ParadoxResult | undefined
  if (config.entropyEnabled) {
    const risk = calculateEntropyRisk(spell.elements)
    paradox = checkParadox(risk, spell.level, caster.dailyEntropy, difficulty, d100)

    if (paradox.entropyGained) {
      caster.dailyEntropy += paradox.entropyGained
    }

    if (paradox.triggered && paradox.severity === 'fizzle') {
      return {
        success: false,
        reason: `Paradox: ${paradox.effect}`,
        slotUsed,
        healthPaid,
        paradox,
        entropyGained: paradox.entropyGained,
      }
    }
  }

  // Handle concentration
  if (spell.concentration) {
    caster.concentrating = spell.id
  }

  return {
    success: true,
    slotUsed,
    healthPaid,
    paradox,
    entropyGained: paradox?.entropyGained,
  }
}

// ============================================================
// REST — Entropy decay and slot recovery
// ============================================================

export function rest(caster: CasterState, type: 'short' | 'long', difficulty: MagicDifficulty): void {
  const config = MAGIC_CONFIGS[difficulty]

  if (type === 'long') {
    // Full recovery
    for (const slot of caster.slots) slot.used = 0
    if (caster.pactSlots) caster.pactSlots.used = 0
    caster.dailyEntropy = 0
    caster.concentrating = null
  } else {
    // Short rest: warlock pact recovery + partial entropy decay
    if (caster.pactSlots) caster.pactSlots.used = 0
    caster.dailyEntropy = Math.max(0, caster.dailyEntropy * (1 - config.entropyDecayRate))
  }
}

// ============================================================
// MONSTER ABILITY HELPERS
// ============================================================

/** Use a monster ability. Returns false if not available. */
export function useMonsterAbility(ability: MonsterAbility): boolean {
  if (ability.recharge === 'at_will') return true

  if (ability.usesRemaining !== undefined) {
    if (ability.usesRemaining <= 0) return false
    ability.usesRemaining--
    return true
  }

  // Recharge abilities (recharge_5_6, recharge_6) always available
  // but consume the "charged" state — handled externally
  return true
}

/** Recharge check for recharge_X_Y abilities. */
export function monsterRechargeCheck(ability: MonsterAbility, d6: number): boolean {
  if (ability.recharge === 'recharge_5_6') return d6 >= 5
  if (ability.recharge === 'recharge_6') return d6 >= 6
  return false
}

/** Reset daily uses (long rest equivalent for monsters). */
export function resetMonsterAbilities(abilities: MonsterAbility[]): void {
  for (const a of abilities) {
    if (a.maxUses !== undefined) a.usesRemaining = a.maxUses
  }
}

// ============================================================
// SPELL CATALOG — D&D 5e learnable spells
//
// === REALMS-OF-SHOD ALIGNMENT: magic ===
// See: docs/realms-of-shod-mapping.md
// Downgrade: src/lib/realms-of-shod-export.ts toRealmsMagic()
//
// Each Spell here is a first-class catalog entry. The prime-
// encoding system above defines the underlying composition math;
// this catalog is the named, learnable surface that players and
// NPCs reference. Both coexist — neither removes the other.
// ============================================================

export const SPELL_CATALOG: Spell[] = [
  // ── Cantrips (level 0) ──
  {
    id: 'fire_bolt', name: 'Fire Bolt', level: 0, school: 'evocation',
    elements: composeSpell({ Fire: 1, Ranged: 1, Instant: 1, Minor: 1 }) as unknown as Record<string, number>,
    seed: composeSpell({ Fire: 1, Ranged: 1, Instant: 1, Minor: 1 }),
    dice: '1d10', damageType: 'fire', range: 120, targets: 'single',
    verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer', 'artificer'],
  },
  {
    id: 'sacred_flame', name: 'Sacred Flame', level: 0, school: 'evocation',
    elements: composeSpell({ Radiant: 1, Ranged: 1, Instant: 1, Minor: 1 }) as unknown as Record<string, number>,
    seed: composeSpell({ Radiant: 1, Ranged: 1, Instant: 1, Minor: 1 }),
    dice: '1d8', damageType: 'radiant', range: 60, targets: 'single',
    saveAbility: 'dex', verbal: true, somatic: true,
    classes: ['cleric'],
  },
  {
    id: 'prestidigitation', name: 'Prestidigitation', level: 0, school: 'transmutation',
    elements: composeSpell({ Illusion: 1, Touch: 1, Instant: 1, Minor: 1 }) as unknown as Record<string, number>,
    seed: composeSpell({ Illusion: 1, Touch: 1, Instant: 1, Minor: 1 }),
    range: 10, targets: 'area',
    verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer', 'bard', 'warlock', 'artificer'],
  },
  {
    id: 'mage_hand', name: 'Mage Hand', level: 0, school: 'conjuration',
    elements: composeSpell({ Create: 1, Ranged: 1, Sustained: 1, Minor: 1 }) as unknown as Record<string, number>,
    seed: composeSpell({ Create: 1, Ranged: 1, Sustained: 1, Minor: 1 }),
    range: 30, targets: 'area', duration: '1 minute', concentration: false,
    verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer', 'bard', 'warlock', 'artificer'],
  },

  // ── Level 1 ──
  {
    id: 'magic_missile', name: 'Magic Missile', level: 1, school: 'evocation',
    elements: { Force: 3, Ranged: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Force: 3, Ranged: 1, Instant: 1, Lesser: 1 }),
    dice: '1d4+1', damageType: 'force', range: 120, targets: 'multiple',
    verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer'],
  },
  {
    id: 'cure_wounds', name: 'Cure Wounds', level: 1, school: 'evocation',
    elements: { Healing: 2, Touch: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Healing: 2, Touch: 1, Instant: 1, Lesser: 1 }),
    dice: '1d8', range: 0, targets: 'single', duration: 'Instantaneous',
    verbal: true, somatic: true,
    classes: ['cleric', 'druid', 'paladin', 'ranger', 'bard', 'artificer'],
  },
  {
    id: 'shield', name: 'Shield', level: 1, school: 'abjuration',
    elements: { Abjuration: 2, Self: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Abjuration: 2, Self: 1, Instant: 1, Lesser: 1 }),
    range: 0, targets: 'self', duration: '1 round',
    verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer'],
  },
  {
    id: 'detect_magic', name: 'Detect Magic', level: 1, school: 'divination',
    elements: { Divination: 2, Self: 1, Sustained: 1, Lesser: 1 },
    seed: composeSpell({ Divination: 2, Self: 1, Sustained: 1, Lesser: 1 }),
    range: 0, targets: 'area', duration: '10 minutes', concentration: true,
    ritual: true, verbal: true, somatic: true,
    classes: ['wizard', 'cleric', 'druid', 'bard', 'paladin', 'ranger', 'sorcerer', 'artificer'],
  },
  {
    id: 'thunderwave', name: 'Thunderwave', level: 1, school: 'evocation',
    elements: { Thunder: 2, Area: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Thunder: 2, Area: 1, Instant: 1, Lesser: 1 }),
    dice: '2d8', damageType: 'thunder', range: 0,
    area: { shape: 'cube', size: 15 }, targets: 'area',
    saveAbility: 'con', verbal: true, somatic: true,
    classes: ['wizard', 'druid', 'bard', 'sorcerer'],
  },
  {
    id: 'bless', name: 'Bless', level: 1, school: 'enchantment',
    elements: { Buff: 2, Ranged: 1, Sustained: 1, Lesser: 1 },
    seed: composeSpell({ Buff: 2, Ranged: 1, Sustained: 1, Lesser: 1 }),
    range: 30, targets: 'multiple', duration: '1 minute', concentration: true,
    verbal: true, somatic: true,
    materials: [{ element: 'holy_water', quantity: 1, consumed: false }],
    classes: ['cleric', 'paladin'],
  },
  {
    id: 'identify', name: 'Identify', level: 1, school: 'divination',
    elements: { Divination: 3, Touch: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Divination: 3, Touch: 1, Instant: 1, Lesser: 1 }),
    range: 0, targets: 'single', duration: 'Instantaneous',
    ritual: true, verbal: true, somatic: true,
    materials: [{ element: 'pearl', quantity: 1, consumed: false }, { element: 'owl_feather', quantity: 1, consumed: false }],
    classes: ['wizard', 'bard', 'artificer'],
  },
  {
    id: 'burning_hands', name: 'Burning Hands', level: 1, school: 'evocation',
    elements: { Fire: 2, Cone: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Fire: 2, Cone: 1, Instant: 1, Lesser: 1 }),
    dice: '3d6', damageType: 'fire', range: 0,
    area: { shape: 'cone', size: 15 }, targets: 'area',
    saveAbility: 'dex', verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer'],
  },

  // ── Level 2 ──
  {
    id: 'misty_step', name: 'Misty Step', level: 2, school: 'conjuration',
    elements: { Teleport: 2, Self: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Teleport: 2, Self: 1, Instant: 1, Lesser: 1 }),
    range: 30, targets: 'self', duration: 'Instantaneous',
    verbal: true,
    classes: ['wizard', 'sorcerer', 'warlock', 'paladin'],
  },
  {
    id: 'invisibility', name: 'Invisibility', level: 2, school: 'illusion',
    elements: { Illusion: 3, Touch: 1, Sustained: 1, Lesser: 1 },
    seed: composeSpell({ Illusion: 3, Touch: 1, Sustained: 1, Lesser: 1 }),
    range: 0, targets: 'single', duration: '1 hour', concentration: true,
    verbal: true, somatic: true,
    materials: [{ element: 'eyelash_gum', quantity: 1, consumed: false }],
    classes: ['wizard', 'sorcerer', 'bard', 'warlock', 'artificer'],
  },
  {
    id: 'hold_person', name: 'Hold Person', level: 2, school: 'enchantment',
    elements: { Control: 3, Ranged: 1, Sustained: 1, Lesser: 1 },
    seed: composeSpell({ Control: 3, Ranged: 1, Sustained: 1, Lesser: 1 }),
    range: 60, targets: 'single', duration: '1 minute', concentration: true,
    condition: 'paralyzed', saveAbility: 'wis',
    verbal: true, somatic: true,
    materials: [{ element: 'iron_bar', quantity: 1, consumed: false }],
    classes: ['wizard', 'cleric', 'druid', 'bard', 'sorcerer', 'warlock', 'paladin'],
  },
  {
    id: 'shatter', name: 'Shatter', level: 2, school: 'evocation',
    elements: { Thunder: 3, Area: 1, Instant: 1, Lesser: 1 },
    seed: composeSpell({ Thunder: 3, Area: 1, Instant: 1, Lesser: 1 }),
    dice: '3d8', damageType: 'thunder', range: 60,
    area: { shape: 'sphere', size: 10 }, targets: 'area',
    saveAbility: 'con', verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer', 'bard', 'warlock'],
  },
  {
    id: 'spiritual_weapon', name: 'Spiritual Weapon', level: 2, school: 'evocation',
    elements: { Healing: 1, Force: 2, Ranged: 1, Sustained: 1, Lesser: 1 },
    seed: composeSpell({ Healing: 1, Force: 2, Ranged: 1, Sustained: 1, Lesser: 1 }),
    dice: '1d8', damageType: 'force', range: 60, targets: 'single',
    duration: '1 minute', concentration: false,
    verbal: true, somatic: true,
    classes: ['cleric'],
  },

  // ── Level 3 ──
  {
    id: 'fireball', name: 'Fireball', level: 3, school: 'evocation',
    elements: { Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 },
    seed: composeSpell({ Fire: 3, Area: 2, Ranged: 1, Instant: 1, Standard: 1 }),
    dice: '8d6', damageType: 'fire', range: 150,
    area: { shape: 'sphere', size: 20 }, targets: 'area',
    saveAbility: 'dex', verbal: true, somatic: true,
    materials: [{ element: 'bat_guano', quantity: 1, consumed: false }],
    classes: ['wizard', 'sorcerer'],
  },
  {
    id: 'counterspell', name: 'Counterspell', level: 3, school: 'abjuration',
    elements: { Abjuration: 3, Ranged: 1, Instant: 1, Standard: 1 },
    seed: composeSpell({ Abjuration: 3, Ranged: 1, Instant: 1, Standard: 1 }),
    range: 60, targets: 'single', duration: 'Instantaneous',
    somatic: true,
    classes: ['wizard', 'sorcerer', 'warlock'],
  },
  {
    id: 'dispel_magic', name: 'Dispel Magic', level: 3, school: 'abjuration',
    elements: { Abjuration: 3, Ranged: 1, Instant: 1, Standard: 1 },
    seed: composeSpell({ Abjuration: 3, Ranged: 1, Instant: 1, Standard: 1 }),
    range: 120, targets: 'single', duration: 'Instantaneous',
    verbal: true, somatic: true,
    classes: ['wizard', 'cleric', 'druid', 'bard', 'sorcerer', 'warlock', 'paladin'],
  },
  {
    id: 'spirit_guardians', name: 'Spirit Guardians', level: 3, school: 'conjuration',
    elements: { Summon: 3, Self: 1, Sustained: 1, Standard: 1 },
    seed: composeSpell({ Summon: 3, Self: 1, Sustained: 1, Standard: 1 }),
    dice: '3d8', damageType: 'radiant', range: 0,
    area: { shape: 'sphere', size: 15 }, targets: 'area',
    duration: '10 minutes', concentration: true, saveAbility: 'wis',
    verbal: true, somatic: true,
    materials: [{ element: 'holy_symbol', quantity: 1, consumed: false }],
    classes: ['cleric'],
  },

  // ── Level 4 ──
  {
    id: 'greater_invisibility', name: 'Greater Invisibility', level: 4, school: 'illusion',
    elements: { Illusion: 4, Touch: 1, Sustained: 1, Standard: 1 },
    seed: composeSpell({ Illusion: 4, Touch: 1, Sustained: 1, Standard: 1 }),
    range: 0, targets: 'single', duration: '1 minute', concentration: true,
    verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer', 'bard'],
  },
  {
    id: 'banishment', name: 'Banishment', level: 4, school: 'abjuration',
    elements: { Abjuration: 4, Ranged: 1, Sustained: 1, Standard: 1 },
    seed: composeSpell({ Abjuration: 4, Ranged: 1, Sustained: 1, Standard: 1 }),
    range: 60, targets: 'single', duration: '1 minute', concentration: true,
    saveAbility: 'cha', verbal: true, somatic: true,
    materials: [{ element: 'distasteful_item', quantity: 1, consumed: false }],
    classes: ['wizard', 'cleric', 'paladin', 'sorcerer', 'warlock'],
  },

  // ── Level 5 ──
  {
    id: 'cone_of_cold', name: 'Cone of Cold', level: 5, school: 'evocation',
    elements: { Cold: 4, Cone: 1, Instant: 1, Standard: 1 },
    seed: composeSpell({ Cold: 4, Cone: 1, Instant: 1, Standard: 1 }),
    dice: '8d8', damageType: 'cold', range: 0,
    area: { shape: 'cone', size: 60 }, targets: 'area',
    saveAbility: 'con', verbal: true, somatic: true,
    materials: [{ element: 'white_dragon_scale', quantity: 1, consumed: false }],
    classes: ['wizard', 'sorcerer'],
  },
  {
    id: 'hold_monster', name: 'Hold Monster', level: 5, school: 'enchantment',
    elements: { Control: 4, Ranged: 1, Sustained: 1, Standard: 1 },
    seed: composeSpell({ Control: 4, Ranged: 1, Sustained: 1, Standard: 1 }),
    range: 90, targets: 'single', duration: '1 minute', concentration: true,
    condition: 'paralyzed', saveAbility: 'wis',
    verbal: true, somatic: true,
    materials: [{ element: 'iron_chain', quantity: 1, consumed: false }],
    classes: ['wizard', 'bard', 'sorcerer', 'warlock'],
  },

  // ── Level 6 ──
  {
    id: 'chain_lightning', name: 'Chain Lightning', level: 6, school: 'evocation',
    elements: { Lightning: 4, Chain: 1, Instant: 1, Greater: 1 },
    seed: composeSpell({ Lightning: 4, Chain: 1, Instant: 1, Greater: 1 }),
    dice: '10d8', damageType: 'lightning', range: 150, targets: 'multiple',
    saveAbility: 'dex', verbal: true, somatic: true,
    materials: [{ element: 'fur', quantity: 1, consumed: false }],
    classes: ['wizard', 'sorcerer'],
  },

  // ── Level 7 ──
  {
    id: 'reverse_gravity', name: 'Reverse Gravity', level: 7, school: 'transmutation',
    elements: { Transform: 4, Area: 1, Sustained: 1, Greater: 1 },
    seed: composeSpell({ Transform: 4, Area: 1, Sustained: 1, Greater: 1 }),
    range: 100, targets: 'area', duration: '1 minute', concentration: true,
    area: { shape: 'cylinder', size: 50 },
    verbal: true, somatic: true,
    materials: [{ element: 'lodestone', quantity: 1, consumed: false }],
    classes: ['wizard', 'druid', 'sorcerer'],
  },

  // ── Level 8 ──
  {
    id: 'incendiary_cloud', name: 'Incendiary Cloud', level: 8, school: 'conjuration',
    elements: { Fire: 4, Summon: 1, Area: 1, Sustained: 1, Supreme: 1 },
    seed: composeSpell({ Fire: 4, Summon: 1, Area: 1, Sustained: 1, Supreme: 1 }),
    dice: '10d8', damageType: 'fire', range: 150,
    area: { shape: 'sphere', size: 20 }, targets: 'area',
    duration: '1 minute', concentration: true, saveAbility: 'dex',
    verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer', 'druid'],
  },

  // ── Level 9 ──
  {
    id: 'meteor_swarm', name: 'Meteor Swarm', level: 9, school: 'evocation',
    elements: { Fire: 4, Area: 3, Ranged: 1, Instant: 1, Ultimate: 1 },
    seed: composeSpell({ Fire: 4, Area: 3, Ranged: 1, Instant: 1, Ultimate: 1 }),
    dice: '40d6', damageType: 'fire', range: 1000,
    area: { shape: 'sphere', size: 40 }, targets: 'area',
    saveAbility: 'dex', verbal: true, somatic: true,
    classes: ['wizard', 'sorcerer'],
  },
  {
    id: 'wish', name: 'Wish', level: 9, school: 'conjuration',
    elements: { Create: 5, Self: 1, Instant: 1, Ultimate: 1 },
    seed: composeSpell({ Create: 5, Self: 1, Instant: 1, Ultimate: 1 }),
    range: 0, targets: 'area', duration: 'Instantaneous',
    verbal: true,
    classes: ['wizard', 'sorcerer'],
  },
  {
    id: 'time_stop', name: 'Time Stop', level: 9, school: 'transmutation',
    elements: { Transform: 5, Self: 1, Instant: 1, Ultimate: 1 },
    seed: composeSpell({ Transform: 5, Self: 1, Instant: 1, Ultimate: 1 }),
    range: 0, targets: 'self', duration: '1d4+1 rounds',
    verbal: true,
    classes: ['wizard', 'sorcerer'],
  },
  {
    id: 'true_resurrection', name: 'True Resurrection', level: 9, school: 'necromancy',
    elements: { Healing: 5, Touch: 1, Instant: 1, Ultimate: 1 },
    seed: composeSpell({ Healing: 5, Touch: 1, Instant: 1, Ultimate: 1 }),
    range: 0, targets: 'single', duration: 'Instantaneous',
    verbal: true, somatic: true,
    materials: [{ element: 'diamond', quantity: 1, consumed: true }],
    classes: ['cleric', 'druid'],
  },

  // ── Utility ──
  {
    id: 'fly', name: 'Fly', level: 3, school: 'transmutation',
    elements: { Transform: 2, Buff: 1, Touch: 1, Sustained: 1, Standard: 1 },
    seed: composeSpell({ Transform: 2, Buff: 1, Touch: 1, Sustained: 1, Standard: 1 }),
    range: 0, targets: 'single', duration: '10 minutes', concentration: true,
    verbal: true, somatic: true,
    materials: [{ element: 'wing_feather', quantity: 1, consumed: false }],
    classes: ['wizard', 'sorcerer', 'warlock', 'artificer'],
  },
  {
    id: 'animate_dead', name: 'Animate Dead', level: 3, school: 'necromancy',
    elements: { Animate: 3, Touch: 1, Lasting: 1, Standard: 1 },
    seed: composeSpell({ Animate: 3, Touch: 1, Lasting: 1, Standard: 1 }),
    range: 10, targets: 'single', duration: '24 hours',
    verbal: true, somatic: true,
    materials: [{ element: 'bone_shard', quantity: 1, consumed: false }],
    classes: ['wizard', 'cleric'],
  },
]

/** Look up a spell by id. */
export function getSpell(id: string): Spell | undefined {
  return SPELL_CATALOG.find(s => s.id === id)
}

/** All spells at a given level (0 = cantrips). */
export function spellsByLevel(level: number): Spell[] {
  return SPELL_CATALOG.filter(s => s.level === level)
}

/** All spells of a given school. */
export function spellsBySchool(school: SpellSchool): Spell[] {
  return SPELL_CATALOG.filter(s => s.school === school)
}

/** All spells available to a character class. */
export function spellsByClass(className: string): Spell[] {
  return SPELL_CATALOG.filter(s => s.classes?.includes(className))
}

