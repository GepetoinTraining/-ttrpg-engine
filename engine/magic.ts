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
