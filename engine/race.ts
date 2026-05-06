/**
 * RACE — Playable ancestries catalog
 * ====================================
 *
 * === REALMS-OF-SHOD ALIGNMENT: race ===
 * See: docs/realms-of-shod-mapping.md
 * Downgrade: src/lib/realms-of-shod-export.ts toRealmsRace()
 *
 * Promotes `race: string` from NPCData / CharacterData into a first-class
 * catalog entity so race can drive:
 *   - NamePool cultural group selection
 *   - Baseline ability score modifiers
 *   - Size category (combat range, tile footprint)
 *   - Trait list (darkvision, trance, stonecunning, etc.)
 */

import { z } from 'zod'
import type { Ability } from './mm-character'

// ============================================================
// RACE ENTITY
// ============================================================

export const CreatureSizeSchema = z.enum([
  'tiny', 'small', 'medium', 'large', 'huge', 'gargantuan',
])
export type CreatureSize = z.infer<typeof CreatureSizeSchema>

export const RaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Physical size category — drives combat reach and tile footprint */
  size: CreatureSizeSchema,
  /** Speed in feet (land speed; 30 = medium baseline) */
  speed: z.number().int().min(0),
  /** Ability score modifiers applied to base array at chargen */
  abilityModifiers: z.record(z.string(), z.number()),
  /** Canonical trait ids this race has at baseline */
  traits: z.array(z.string()),
  /** Which NamePool culture key applies to this race (for name generation) */
  culturalGroup: z.string().optional(),
  /** Average lifespan in years */
  lifespan: z.number().int().optional(),
  /** One-line lore blurb */
  description: z.string().optional(),
})
export type Race = z.infer<typeof RaceSchema>

// ============================================================
// RACE CATALOG
// ============================================================

export const RACE_CATALOG: Race[] = [
  {
    id: 'human',
    name: 'Human',
    size: 'medium',
    speed: 30,
    abilityModifiers: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    traits: ['extra_skill', 'extra_feat'],
    culturalGroup: 'cormyrian',
    lifespan: 80,
    description: 'Adaptable and ambitious, humans dominate most continents.',
  },
  {
    id: 'elf_high',
    name: 'High Elf',
    size: 'medium',
    speed: 30,
    abilityModifiers: { dex: 2, int: 1 },
    traits: ['darkvision_60', 'fey_ancestry', 'trance', 'keen_senses', 'cantrip_wizard'],
    culturalGroup: 'sword_coast',
    lifespan: 750,
    description: 'Scholarly and graceful, high elves blend arcane study with elven elegance.',
  },
  {
    id: 'elf_wood',
    name: 'Wood Elf',
    size: 'medium',
    speed: 35,
    abilityModifiers: { dex: 2, wis: 1 },
    traits: ['darkvision_60', 'fey_ancestry', 'trance', 'keen_senses', 'mask_of_the_wild', 'fleet_of_foot'],
    culturalGroup: 'sword_coast',
    lifespan: 750,
    description: 'Reclusive hunters attuned to the forest, swift and difficult to track.',
  },
  {
    id: 'elf_drow',
    name: 'Drow',
    size: 'medium',
    speed: 30,
    abilityModifiers: { dex: 2, cha: 1 },
    traits: ['darkvision_120', 'fey_ancestry', 'trance', 'keen_senses', 'sunlight_sensitivity', 'drow_magic'],
    culturalGroup: 'drow',
    lifespan: 750,
    description: 'Denizens of the Underdark, gifted with innate magic and punished by sunlight.',
  },
  {
    id: 'dwarf_hill',
    name: 'Hill Dwarf',
    size: 'medium',
    speed: 25,
    abilityModifiers: { con: 2, wis: 1 },
    traits: ['darkvision_60', 'dwarven_resilience', 'stonecunning', 'dwarven_combat_training', 'dwarven_toughness'],
    culturalGroup: 'dwarven',
    lifespan: 350,
    description: 'Wise and hearty hill dwarves are known for their deep community bonds.',
  },
  {
    id: 'dwarf_mountain',
    name: 'Mountain Dwarf',
    size: 'medium',
    speed: 25,
    abilityModifiers: { str: 2, con: 2 },
    traits: ['darkvision_60', 'dwarven_resilience', 'stonecunning', 'dwarven_combat_training', 'dwarven_armor_training'],
    culturalGroup: 'dwarven',
    lifespan: 350,
    description: 'Skilled warriors and craftsmen who prefer the high peaks and deep mines.',
  },
  {
    id: 'halfling_lightfoot',
    name: 'Lightfoot Halfling',
    size: 'small',
    speed: 25,
    abilityModifiers: { dex: 2, cha: 1 },
    traits: ['lucky', 'brave', 'halfling_nimbleness', 'naturally_stealthy'],
    culturalGroup: 'halfling',
    lifespan: 150,
    description: 'Naturally talented at hiding and blending in, lightfoots are wanderers and rogues.',
  },
  {
    id: 'halfling_stout',
    name: 'Stout Halfling',
    size: 'small',
    speed: 25,
    abilityModifiers: { dex: 2, con: 1 },
    traits: ['lucky', 'brave', 'halfling_nimbleness', 'stout_resilience'],
    culturalGroup: 'halfling',
    lifespan: 150,
    description: 'Hardy halflings with strong constitutions and resistance to poison.',
  },
  {
    id: 'gnome_forest',
    name: 'Forest Gnome',
    size: 'small',
    speed: 25,
    abilityModifiers: { int: 2, dex: 1 },
    traits: ['darkvision_60', 'gnome_cunning', 'speak_with_small_beasts', 'natural_illusionist'],
    culturalGroup: 'sword_coast',
    lifespan: 500,
    description: 'Curious and inventive, forest gnomes befriend woodland creatures and cast minor illusions.',
  },
  {
    id: 'gnome_rock',
    name: 'Rock Gnome',
    size: 'small',
    speed: 25,
    abilityModifiers: { int: 2, con: 1 },
    traits: ['darkvision_60', 'gnome_cunning', 'artificers_lore', 'tinker'],
    culturalGroup: 'sword_coast',
    lifespan: 500,
    description: 'Inventive mechanics who love to build clockwork devices and tinker with magic.',
  },
  {
    id: 'half_elf',
    name: 'Half-Elf',
    size: 'medium',
    speed: 30,
    abilityModifiers: { cha: 2 }, // +1 to two others chosen at chargen; simplified here
    traits: ['darkvision_60', 'fey_ancestry', 'skill_versatility'],
    culturalGroup: 'sword_coast',
    lifespan: 180,
    description: 'Bridge between human ambition and elven grace, half-elves carry both inheritances.',
  },
  {
    id: 'half_orc',
    name: 'Half-Orc',
    size: 'medium',
    speed: 30,
    abilityModifiers: { str: 2, con: 1 },
    traits: ['darkvision_60', 'menacing', 'relentless_endurance', 'savage_attacks'],
    culturalGroup: 'sword_coast',
    lifespan: 75,
    description: 'Fearsome warriors who endure what would fell lesser beings.',
  },
  {
    id: 'tiefling',
    name: 'Tiefling',
    size: 'medium',
    speed: 30,
    abilityModifiers: { int: 1, cha: 2 },
    traits: ['darkvision_60', 'hellish_resistance', 'infernal_legacy'],
    culturalGroup: 'sword_coast',
    lifespan: 90,
    description: 'Bearing the mark of an infernal bloodline, tieflings are often mistrusted outsiders.',
  },
  {
    id: 'dragonborn',
    name: 'Dragonborn',
    size: 'medium',
    speed: 30,
    abilityModifiers: { str: 2, cha: 1 },
    traits: ['draconic_ancestry', 'breath_weapon', 'damage_resistance'],
    culturalGroup: 'sword_coast',
    lifespan: 80,
    description: 'Dragon-descended warriors with an innate breath weapon and resistance to their heritage damage.',
  },
  {
    id: 'aasimar',
    name: 'Aasimar',
    size: 'medium',
    speed: 30,
    abilityModifiers: { wis: 1, cha: 2 },
    traits: ['darkvision_60', 'celestial_resistance', 'healing_hands', 'light_bearer'],
    culturalGroup: 'sword_coast',
    lifespan: 160,
    description: 'Touched by celestial power, aasimar bear a divine charge they may embrace or reject.',
  },
  {
    id: 'genasi_fire',
    name: 'Fire Genasi',
    size: 'medium',
    speed: 30,
    abilityModifiers: { con: 2, int: 1 },
    traits: ['darkvision_60', 'fire_resistance', 'reach_to_the_blaze', 'fire_genasi_spells'],
    culturalGroup: 'sword_coast',
    lifespan: 120,
    description: 'Born of fire elemental heritage; warm to the touch and immune to common flame.',
  },
  {
    id: 'goliath',
    name: 'Goliath',
    size: 'medium',
    speed: 30,
    abilityModifiers: { str: 2, con: 1 },
    traits: ['natural_athlete', 'stone_endurance', 'powerful_build', 'mountain_born'],
    culturalGroup: 'sword_coast',
    lifespan: 100,
    description: 'Towering mountain dwellers who prove their worth through feats of strength and endurance.',
  },
  {
    id: 'tabaxi',
    name: 'Tabaxi',
    size: 'medium',
    speed: 30,
    abilityModifiers: { dex: 2, cha: 1 },
    traits: ['darkvision_60', 'feline_agility', 'cats_claws', 'cats_talent'],
    culturalGroup: 'sword_coast',
    lifespan: 100,
    description: 'Feline wanderers driven by insatiable curiosity to collect stories and trinkets.',
  },
  {
    id: 'kenku',
    name: 'Kenku',
    size: 'medium',
    speed: 30,
    abilityModifiers: { dex: 2, wis: 1 },
    traits: ['expert_forgery', 'kenku_training', 'mimicry'],
    culturalGroup: 'sword_coast',
    lifespan: 60,
    description: 'Cursed bird-folk who speak only in mimicked sounds and excel at deception.',
  },
  {
    id: 'tortle',
    name: 'Tortle',
    size: 'medium',
    speed: 30,
    abilityModifiers: { str: 2, wis: 1 },
    traits: ['claws', 'hold_breath', 'natural_armor', 'shell_defense'],
    culturalGroup: 'sword_coast',
    lifespan: 365,
    description: 'Turtle-like wanderers with natural shell armor who live nomadic lives near water.',
  },
  {
    id: 'lizardfolk',
    name: 'Lizardfolk',
    size: 'medium',
    speed: 30,
    abilityModifiers: { con: 2, wis: 1 },
    traits: ['bite', 'cunning_artisan', 'hold_breath', 'hunters_lore', 'natural_armor_lf', 'hungry_jaws'],
    culturalGroup: 'sword_coast',
    lifespan: 60,
    description: 'Cold-blooded pragmatists who view the world through the lens of pure survival.',
  },
]

// ============================================================
// HELPERS
// ============================================================

/** Look up a race by id. Returns undefined if not found. */
export function getRace(id: string): Race | undefined {
  return RACE_CATALOG.find(r => r.id === id)
}

/** All trait ids for a race. */
export function racialTraitsFor(raceId: string): string[] {
  return getRace(raceId)?.traits ?? []
}

/** Races that share a cultural group (for name-pool selection). */
export function racesByCulture(culturalGroup: string): Race[] {
  return RACE_CATALOG.filter(r => r.culturalGroup === culturalGroup)
}
