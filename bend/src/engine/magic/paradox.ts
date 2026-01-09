/**
 * PARADOX SYSTEM - Reality Pushes Back
 *
 * From White Wolf's Mage: The Ascension.
 * When you assert something that shouldn't exist, reality disagrees.
 *
 * Entropy accumulates throughout the day.
 * Higher-level spells, necromancy, reality-bending = more entropy.
 * When entropy triggers, bad things happen.
 *
 * Long rest resets daily entropy.
 */

import { z } from 'zod';
import type { CasterState, ParadoxResult } from './types';
import { getDifficultyConfig, type DifficultyMode } from './difficulty';

// ============================================
// PARADOX SEVERITY
// ============================================

export const ParadoxSeveritySchema = z.enum([
  'fizzle',       // Spell fails, components lost
  'minor',        // Reduced effect, small backlash
  'major',        // Significant backlash, side effects
  'catastrophic', // Reality tears, major consequences
]);

export type ParadoxSeverity = z.infer<typeof ParadoxSeveritySchema>;

// ============================================
// BACKLASH EFFECTS
// ============================================

export interface BacklashEffect {
  id: string;
  name: string;
  description: string;
  severity: ParadoxSeverity;

  // Mechanical effects
  damage?: {
    dice: string;          // "1d6 per spell level"
    type: string;          // "psychic"
    perSpellLevel?: boolean;
  };
  condition?: {
    name: string;          // "stunned", "exhaustion"
    duration: string;      // "1 round", "1 minute"
    level?: number;        // For exhaustion
  };
  slotLoss?: boolean;      // Lose highest remaining slot
  spellLock?: {
    spellId?: string;      // Lock specific spell
    school?: string;       // Or lock whole school
    duration: string;      // "24 hours"
  };
  wildMagic?: boolean;     // Trigger wild magic surge
  summon?: {
    creatureType: string;  // What appears
    hostile: boolean;
    cr?: string;           // "equal to spell level"
  };
  environmental?: {
    type: string;          // "reality_scar", "planar_breach", "wild_zone"
    radius: number;        // Feet
    duration: string;
  };
}

// ============================================
// BACKLASH TABLES
// ============================================

export const FIZZLE_EFFECTS: BacklashEffect[] = [
  {
    id: 'fizzle_basic',
    name: 'Spell Fizzles',
    description: 'The spell simply fails to manifest. Components are consumed.',
    severity: 'fizzle',
  },
  {
    id: 'fizzle_dazed',
    name: 'Momentary Disorientation',
    description: 'The spell fails and you are dazed for one round.',
    severity: 'fizzle',
    condition: { name: 'dazed', duration: '1 round' },
  },
  {
    id: 'fizzle_feedback',
    name: 'Arcane Feedback',
    description: 'The spell fails and you take minor psychic damage.',
    severity: 'fizzle',
    damage: { dice: '1d4', type: 'psychic' },
  },
];

export const MINOR_EFFECTS: BacklashEffect[] = [
  {
    id: 'minor_half_power',
    name: 'Weakened Spell',
    description: 'The spell succeeds but at half power (half damage/duration/etc).',
    severity: 'minor',
  },
  {
    id: 'minor_random_target',
    name: 'Misdirected Magic',
    description: 'The spell succeeds but hits a random valid target.',
    severity: 'minor',
  },
  {
    id: 'minor_psychic_damage',
    name: 'Mental Strain',
    description: 'The spell succeeds but you take psychic damage.',
    severity: 'minor',
    damage: { dice: '1d6', type: 'psychic', perSpellLevel: true },
  },
  {
    id: 'minor_exhaustion',
    name: 'Magical Fatigue',
    description: 'The spell succeeds but you gain one level of exhaustion.',
    severity: 'minor',
    condition: { name: 'exhaustion', duration: 'until rest', level: 1 },
  },
  {
    id: 'minor_wild_surge',
    name: 'Wild Magic Leak',
    description: 'The spell succeeds but triggers a wild magic surge.',
    severity: 'minor',
    wildMagic: true,
  },
];

export const MAJOR_EFFECTS: BacklashEffect[] = [
  {
    id: 'major_inversion',
    name: 'Spell Inversion',
    description: 'The spell inverts its effect. Healing harms, damage heals, buffs debuff.',
    severity: 'major',
  },
  {
    id: 'major_slot_burn',
    name: 'Arcane Burnout',
    description: 'You lose your highest remaining spell slot as the magic consumes itself.',
    severity: 'major',
    slotLoss: true,
  },
  {
    id: 'major_school_lock',
    name: 'School Rejection',
    description: 'Reality rejects this school of magic. You cannot cast from this school for 1 hour.',
    severity: 'major',
    spellLock: { duration: '1 hour' },
  },
  {
    id: 'major_double_wild',
    name: 'Wild Magic Cascade',
    description: 'Two wild magic surges trigger simultaneously.',
    severity: 'major',
    wildMagic: true,
  },
  {
    id: 'major_stunned',
    name: 'Reality Shock',
    description: 'The paradox stuns you as reality reasserts itself.',
    severity: 'major',
    condition: { name: 'stunned', duration: '1 round' },
    damage: { dice: '2d6', type: 'psychic', perSpellLevel: true },
  },
];

export const CATASTROPHIC_EFFECTS: BacklashEffect[] = [
  {
    id: 'catastrophic_planar_breach',
    name: 'Planar Breach',
    description: 'A tear opens to another plane. Something may come through.',
    severity: 'catastrophic',
    environmental: { type: 'planar_breach', radius: 30, duration: '1 minute' },
    summon: { creatureType: 'outsider', hostile: true, cr: 'spell level' },
  },
  {
    id: 'catastrophic_spell_lock',
    name: 'Total Spell Lock',
    description: 'You lose the ability to cast this specific spell for 24 hours.',
    severity: 'catastrophic',
    spellLock: { duration: '24 hours' },
  },
  {
    id: 'catastrophic_reality_scar',
    name: 'Reality Scar',
    description: 'A permanent scar forms where magic behaves unpredictably.',
    severity: 'catastrophic',
    environmental: { type: 'reality_scar', radius: 60, duration: 'permanent' },
  },
  {
    id: 'catastrophic_hostile_summon',
    name: 'Unwanted Attention',
    description: 'Your magical display attracts a hostile entity.',
    severity: 'catastrophic',
    summon: { creatureType: 'aberration', hostile: true, cr: 'spell level + 2' },
  },
  {
    id: 'catastrophic_drain',
    name: 'Life Force Drain',
    description: 'The spell drains your very essence.',
    severity: 'catastrophic',
    damage: { dice: '3d6', type: 'necrotic', perSpellLevel: true },
    condition: { name: 'exhaustion', duration: 'until long rest', level: 3 },
  },
  {
    id: 'catastrophic_time_slip',
    name: 'Temporal Fracture',
    description: 'You slip out of time momentarily. Hours pass in an instant.',
    severity: 'catastrophic',
    environmental: { type: 'time_slip', radius: 0, duration: '1d4 hours' },
  },
];

// ============================================
// PARADOX ENGINE
// ============================================

export class ParadoxEngine {
  /**
   * Check for paradox when casting a spell.
   * Returns the result of the paradox check.
   */
  static check(
    entropyRisk: number,
    spellLevel: number,
    caster: CasterState,
    difficulty: DifficultyMode
  ): ParadoxResult {
    const config = getDifficultyConfig(difficulty);

    // No paradox if disabled
    if (!config.entropyEnabled) {
      return { triggered: false };
    }

    // Apply difficulty multiplier
    const adjustedRisk = entropyRisk * config.entropyMultiplier;

    // Add daily accumulated entropy
    const totalRisk = adjustedRisk + (caster.dailyEntropy || 0);

    // Roll the check
    const roll = Math.random() * 100;

    if (roll >= totalRisk) {
      // Paradox avoided
      return {
        triggered: false,
        entropyGained: Math.floor(adjustedRisk / 10),  // Small entropy gain even on success
      };
    }

    // Paradox triggered! Determine severity
    const severity = this.determineSeverity(roll, totalRisk, spellLevel);
    const effect = this.selectEffect(severity, spellLevel);

    return {
      triggered: true,
      severity,
      effect: effect.description,
      entropyGained: adjustedRisk,  // Full entropy gain on paradox
    };
  }

  /**
   * Determine severity based on how badly the roll failed.
   */
  private static determineSeverity(
    roll: number,
    risk: number,
    spellLevel: number
  ): ParadoxSeverity {
    // How far under the threshold?
    const margin = risk - roll;

    // Higher level spells trend toward worse outcomes
    const levelBonus = Math.floor(spellLevel / 3) * 10;
    const effectiveMargin = margin + levelBonus;

    if (effectiveMargin < 20) return 'fizzle';
    if (effectiveMargin < 50) return 'minor';
    if (effectiveMargin < 80) return 'major';
    return 'catastrophic';
  }

  /**
   * Select a random effect from the appropriate table.
   */
  private static selectEffect(
    severity: ParadoxSeverity,
    _spellLevel: number
  ): BacklashEffect {
    let table: BacklashEffect[];

    switch (severity) {
      case 'fizzle':
        table = FIZZLE_EFFECTS;
        break;
      case 'minor':
        table = MINOR_EFFECTS;
        break;
      case 'major':
        table = MAJOR_EFFECTS;
        break;
      case 'catastrophic':
        table = CATASTROPHIC_EFFECTS;
        break;
    }

    const index = Math.floor(Math.random() * table.length);
    return table[index];
  }

  /**
   * Apply a backlash effect to a caster.
   * Returns the modified caster state.
   */
  static applyBacklash(
    effect: BacklashEffect,
    caster: CasterState,
    spellLevel: number
  ): {
    caster: CasterState;
    damageDealt: number;
    conditionsApplied: string[];
    slotsLost: number;
    additionalEffects: string[];
  } {
    const result = {
      caster: { ...caster },
      damageDealt: 0,
      conditionsApplied: [] as string[],
      slotsLost: 0,
      additionalEffects: [] as string[],
    };

    // Apply damage
    if (effect.damage) {
      const baseDice = effect.damage.dice;
      const multiplier = effect.damage.perSpellLevel ? spellLevel : 1;
      // Simplified dice rolling (in real implementation, use proper dice system)
      const [count, sides] = baseDice.match(/(\d+)d(\d+)/)?.slice(1).map(Number) || [1, 6];
      let total = 0;
      for (let i = 0; i < count * multiplier; i++) {
        total += Math.floor(Math.random() * sides) + 1;
      }
      result.damageDealt = total;
      result.caster.currentHP = Math.max(0, result.caster.currentHP - total);
    }

    // Apply conditions
    if (effect.condition) {
      result.conditionsApplied.push(effect.condition.name);
      // In real implementation, add to character's active conditions
    }

    // Apply slot loss
    if (effect.slotLoss) {
      // Find highest available slot and mark it used
      for (let i = result.caster.slots.length - 1; i >= 0; i--) {
        const slot = result.caster.slots[i];
        if (slot.used < slot.max) {
          slot.used++;
          result.slotsLost = slot.level;
          break;
        }
      }
    }

    // Apply spell lock
    if (effect.spellLock) {
      result.additionalEffects.push(
        `Spell lock: ${effect.spellLock.school || 'this spell'} for ${effect.spellLock.duration}`
      );
    }

    // Note wild magic
    if (effect.wildMagic) {
      result.additionalEffects.push('Wild magic surge triggered');
    }

    // Note summons
    if (effect.summon) {
      result.additionalEffects.push(
        `Summoned ${effect.summon.hostile ? 'hostile' : 'neutral'} ${effect.summon.creatureType}`
      );
    }

    // Note environmental effects
    if (effect.environmental) {
      result.additionalEffects.push(
        `Created ${effect.environmental.type} (${effect.environmental.radius}ft radius, ${effect.environmental.duration})`
      );
    }

    return result;
  }

  /**
   * Decay daily entropy (called on rest or time passage).
   */
  static decayEntropy(
    currentEntropy: number,
    restType: 'short' | 'long',
    difficulty: DifficultyMode
  ): number {
    const config = getDifficultyConfig(difficulty);

    if (restType === 'long') {
      // Long rest resets entropy
      return 0;
    }

    // Short rest decays by decay rate
    const decay = currentEntropy * config.entropyDecayRate;
    return Math.max(0, currentEntropy - decay);
  }

  /**
   * Calculate total entropy risk for a spell.
   */
  static calculateEntropyRisk(
    baseRisk: number,
    spellLevel: number,
    school: string,
    caster: CasterState
  ): number {
    let risk = baseRisk;

    // Higher level = more risk
    risk += spellLevel * 2;

    // Dangerous schools add risk
    if (['necromancy'].includes(school)) {
      risk += 10;
    }

    // Low HP increases risk (desperation)
    const hpPercent = caster.currentHP / caster.maxHP;
    if (hpPercent < 0.25) {
      risk += 15;
    } else if (hpPercent < 0.5) {
      risk += 5;
    }

    // Already accumulated entropy makes it worse
    risk += caster.dailyEntropy * 0.5;

    return Math.min(100, risk);
  }
}

// ============================================
// WILD MAGIC SURGE TABLE
// ============================================

export interface WildMagicEffect {
  id: string;
  description: string;
  beneficial: boolean;
  duration?: string;
}

export const WILD_MAGIC_TABLE: WildMagicEffect[] = [
  { id: 'wm_fireball_self', description: 'You cast Fireball centered on yourself', beneficial: false },
  { id: 'wm_invisibility', description: 'You become invisible for 1 minute', beneficial: true, duration: '1 minute' },
  { id: 'wm_levitate', description: 'You begin levitating uncontrollably', beneficial: false, duration: '1 minute' },
  { id: 'wm_healing', description: 'You regain 2d10 hit points', beneficial: true },
  { id: 'wm_blue_skin', description: 'Your skin turns blue for 24 hours', beneficial: false, duration: '24 hours' },
  { id: 'wm_third_eye', description: 'A third eye appears on your forehead, granting +2 Perception', beneficial: true, duration: '1 hour' },
  { id: 'wm_enlarge', description: 'You grow 1 foot taller for 1 hour', beneficial: true, duration: '1 hour' },
  { id: 'wm_shrink', description: 'You shrink 6 inches for 1 hour', beneficial: false, duration: '1 hour' },
  { id: 'wm_butterflies', description: 'Illusory butterflies flutter around you for 1 minute', beneficial: true, duration: '1 minute' },
  { id: 'wm_grease', description: 'You cast Grease centered on yourself', beneficial: false },
  { id: 'wm_confusion', description: 'Confusion affects everyone within 30 feet', beneficial: false },
  { id: 'wm_spell_refund', description: 'You regain your lowest expended spell slot', beneficial: true },
  { id: 'wm_vulnerability', description: 'You are vulnerable to all damage for 1 minute', beneficial: false, duration: '1 minute' },
  { id: 'wm_resistance', description: 'You are resistant to all damage for 1 minute', beneficial: true, duration: '1 minute' },
  { id: 'wm_max_damage', description: 'The next damaging spell you cast deals maximum damage', beneficial: true },
  { id: 'wm_age_younger', description: 'You become 1d10 years younger (minimum 1 year old)', beneficial: true },
  { id: 'wm_age_older', description: 'You become 1d10 years older', beneficial: false },
  { id: 'wm_unicorn', description: 'A spectral unicorn appears and follows you for 1 hour', beneficial: true, duration: '1 hour' },
  { id: 'wm_fog', description: 'You cast Fog Cloud centered on yourself', beneficial: false },
  { id: 'wm_fly', description: 'You gain a fly speed of 30 feet for 1 minute', beneficial: true, duration: '1 minute' },
];

/**
 * Roll on the wild magic table.
 */
export function rollWildMagic(): WildMagicEffect {
  const index = Math.floor(Math.random() * WILD_MAGIC_TABLE.length);
  return WILD_MAGIC_TABLE[index];
}
