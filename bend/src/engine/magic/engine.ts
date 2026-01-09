/**
 * SPELL ENGINE - Main Resolution
 *
 * The unified spell casting system.
 * Brings together all components:
 * - Difficulty configuration
 * - Cost calculation (5 axes)
 * - Lore gates
 * - Paradox/entropy
 * - Class identity
 * - Scroll handling
 *
 * "Magic is chemistry with a different substrate."
 */

import type {
  SpellFormula,
  CasterState,
  CastResult,
  ResolvedCost,
  SpellEffect,
  ScrollItem,
} from './types';
import {
  DifficultyMode,
  getDifficultyConfig,
  magicAvailable,
} from './difficulty';
import { CostCalculator, type InventoryQuery } from './costs';
import { ParadoxEngine, rollWildMagic } from './paradox';
import { getCasterProfile } from './caster';
import { useScroll } from './scrolls';
import {
  recordRestEvent,
  type RestEvent,
  type RestEventType,
} from './rest-events';
import type { WorldTimestamp } from '../timeline/substrate';

// ============================================
// SPELL ENGINE CLASS
// ============================================

export class SpellEngine {
  private difficulty: DifficultyMode;

  constructor(difficulty: DifficultyMode = 'NORMAL') {
    this.difficulty = difficulty;
  }

  /**
   * Set the difficulty mode.
   */
  setDifficulty(difficulty: DifficultyMode): void {
    this.difficulty = difficulty;
  }

  /**
   * Get current difficulty.
   */
  getDifficulty(): DifficultyMode {
    return this.difficulty;
  }

  /**
   * Cast a spell from memory/preparation.
   */
  cast(
    spell: SpellFormula,
    caster: CasterState,
    inventory: InventoryQuery,
    _target?: { x: number; y: number; z?: number }
  ): CastResult {
    const config = getDifficultyConfig(this.difficulty);

    // ============================================
    // 0. CHECK MAGIC EXISTS
    // ============================================

    if (!magicAvailable(this.difficulty)) {
      return {
        success: false,
        reason: 'Magic does not exist in this world. Consider technology instead.',
      };
    }

    // ============================================
    // 1. CALCULATE COSTS
    // ============================================

    const cost = CostCalculator.calculate(
      spell,
      caster,
      this.difficulty,
      inventory
    );

    // ============================================
    // 2. CHECK AFFORDABILITY
    // ============================================

    if (!CostCalculator.canAfford(cost)) {
      return {
        success: false,
        reason: CostCalculator.getFailureMessage(cost),
      };
    }

    // ============================================
    // 3. CHECK PARADOX (Before paying costs)
    // ============================================

    let paradoxTriggered = false;
    let paradoxSeverity: CastResult['paradoxSeverity'];
    let paradoxEffect: string | undefined;

    if (config.entropyEnabled && cost.entropyRisk > 0) {
      const paradoxResult = ParadoxEngine.check(
        cost.entropyRisk,
        spell.level,
        caster,
        this.difficulty
      );

      if (paradoxResult.triggered) {
        paradoxTriggered = true;
        paradoxSeverity = paradoxResult.severity;
        paradoxEffect = paradoxResult.effect;

        // Fizzle = spell fails entirely
        if (paradoxResult.severity === 'fizzle') {
          // Still pay costs on fizzle
          CostCalculator.pay(cost, caster, this.difficulty);

          return {
            success: false,
            reason: `Paradox! ${paradoxResult.effect}`,
            paradoxTriggered: true,
            paradoxSeverity: 'fizzle',
            paradoxEffect: paradoxResult.effect,
            entropyGained: paradoxResult.entropyGained,
            slotUsed: cost.energyCost,
            materialsConsumed: cost.materialsCost.map(m => m.element),
          };
        }

        // Other severities: spell proceeds but with consequences
      }
    }

    // ============================================
    // 4. PAY COSTS
    // ============================================

    const updatedCaster = CostCalculator.pay(cost, caster, this.difficulty);

    // ============================================
    // 5. RESOLVE EFFECTS
    // ============================================

    const effects = this.precipitateEffects(spell, updatedCaster);

    // ============================================
    // 6. HANDLE CONCENTRATION
    // ============================================

    if (spell.effects.some(e => e.concentration)) {
      // Would update caster.concentrating = spell.id
      // And break any existing concentration
    }

    // ============================================
    // 7. WILD MAGIC CHECK
    // ============================================

    if (config.wildMagicEnabled && caster.casterType === 'sorcerer') {
      // Wild magic sorcerer check
      const wildRoll = Math.random() * 100;
      if (wildRoll < config.wildMagicChance) {
        const wild = rollWildMagic();
        // Would apply wild magic effect: wild.description
        void wild;
      }
    }

    // ============================================
    // 8. BUILD RESULT
    // ============================================

    return {
      success: true,
      effects,
      slotUsed: cost.energyCost,
      materialsConsumed: cost.materialsCost.map(m => m.element),
      healthPaid: cost.healthCost,
      paradoxTriggered,
      paradoxSeverity,
      paradoxEffect,
      entropyGained: cost.entropyRisk,
    };
  }

  /**
   * Cast a spell from a scroll.
   */
  castFromScroll(
    scroll: ScrollItem,
    spell: SpellFormula,
    caster: CasterState,
    _target?: { x: number; y: number; z?: number }
  ): CastResult & { scrollConsumed: boolean; chargesRemaining: number } {
    const config = getDifficultyConfig(this.difficulty);

    // Check magic exists
    if (!magicAvailable(this.difficulty)) {
      return {
        success: false,
        reason: 'Magic does not exist in this world.',
        scrollConsumed: false,
        chargesRemaining: scroll.charges,
      };
    }

    // Use the scroll
    const scrollResult = useScroll(scroll, caster, spell, this.difficulty);

    if (!scrollResult.success) {
      // Check for wild magic on scroll failure
      let wildMagicEffect: string | undefined;
      if (scrollResult.wildMagic && config.wildMagicEnabled) {
        const wild = rollWildMagic();
        wildMagicEffect = wild.description;
      }

      return {
        success: false,
        reason: scrollResult.reason,
        scrollConsumed: scrollResult.consumed,
        chargesRemaining: scrollResult.chargesRemaining,
        // If wild magic triggered on failure
        ...(wildMagicEffect && { paradoxEffect: `Wild magic: ${wildMagicEffect}` }),
      };
    }

    // Scroll succeeded - resolve spell effects
    const effects = this.precipitateEffects(spell, caster);

    return {
      success: true,
      effects,
      scrollConsumed: scrollResult.consumed,
      chargesRemaining: scrollResult.chargesRemaining,
    };
  }

  /**
   * Check if a spell can be cast (without casting it).
   */
  canCast(
    spell: SpellFormula,
    caster: CasterState,
    inventory: InventoryQuery
  ): { canCast: boolean; reason?: string; cost?: ResolvedCost } {
    if (!magicAvailable(this.difficulty)) {
      return {
        canCast: false,
        reason: 'Magic does not exist in this world',
      };
    }

    const cost = CostCalculator.calculate(spell, caster, this.difficulty, inventory);

    return {
      canCast: cost.canCast,
      reason: cost.canCast ? undefined : CostCalculator.getFailureMessage(cost),
      cost,
    };
  }

  /**
   * Get the cost summary for a spell.
   */
  getCostSummary(
    spell: SpellFormula,
    caster: CasterState,
    inventory: InventoryQuery
  ): string {
    const cost = CostCalculator.calculate(spell, caster, this.difficulty, inventory);
    return CostCalculator.summarize(cost);
  }

  /**
   * Precipitate spell effects from its composition.
   * Uses the genesis observer pattern - effects emerge from the seed.
   */
  private precipitateEffects(
    spell: SpellFormula,
    _caster: CasterState
  ): SpellEffect[] {
    // Get base effects from spell definition
    // Future: modify based on caster level (resolution = casterLevel / 20)
    return [...spell.effects];
  }

  /**
   * Recover spell slots on rest.
   *
   * @deprecated Use restWithDelta() for timeline-aware rest that emits deltas.
   * This method is kept for backward compatibility but doesn't record events.
   */
  rest(
    caster: CasterState,
    restType: 'short' | 'long'
  ): CasterState {
    const newCaster = { ...caster };
    const profile = getCasterProfile(caster.casterType);

    if (restType === 'long') {
      // Long rest: recover all slots
      newCaster.slots = newCaster.slots.map(s => ({
        ...s,
        used: 0,
      }));

      // Reset daily entropy
      newCaster.dailyEntropy = 0;

      // End concentration
      newCaster.concentrating = undefined;

    } else if (restType === 'short') {
      // Short rest: warlock pact magic recovery
      if (profile.slotProgression === 'pact' && newCaster.pactSlots) {
        newCaster.pactSlots = {
          ...newCaster.pactSlots,
          used: 0,
        };
      }

      // Partial entropy decay
      newCaster.dailyEntropy = ParadoxEngine.decayEntropy(
        newCaster.dailyEntropy,
        'short',
        this.difficulty
      );
    }

    return newCaster;
  }

  /**
   * Recover spell slots on rest with timeline delta recording.
   *
   * This is the preferred method - it emits a rest event as a delta,
   * allowing the timeline system to:
   * - Query historical state ("what was entropy at noon?")
   * - Project speculative futures ("if they rest now...")
   * - Maintain canonical reset boundaries
   *
   * "The rest doesn't erase the entropy—it marks the boundary."
   */
  async restWithDelta(
    caster: CasterState,
    restType: 'short' | 'long' | 'new_day',
    context: {
      campaignId: string;
      sessionId?: string;
      characterId: string;
      worldTimestamp: WorldTimestamp;
    }
  ): Promise<CasterState> {
    const profile = getCasterProfile(caster.casterType);

    // Build the rest event
    const restEventType: RestEventType = restType === 'new_day'
      ? 'new_day'
      : restType === 'long'
        ? 'long_rest'
        : 'short_rest';

    // Calculate what will be reset
    const resets: RestEvent['resets'] = {
      entropy: false,
      allSlots: false,
      pactSlots: false,
      concentration: false,
    };

    // Store pre-reset state for history
    const beforeState: RestEvent['beforeState'] = {
      entropy: caster.dailyEntropy,
      slots: caster.slots.map(s => ({ level: s.level, used: s.used })),
    };

    // Calculate new state based on rest type
    const newCaster = { ...caster };

    if (restType === 'long' || restType === 'new_day') {
      // Long rest / new day: full recovery
      newCaster.slots = newCaster.slots.map(s => ({
        ...s,
        used: 0,
      }));
      newCaster.dailyEntropy = 0;
      newCaster.concentrating = undefined;

      resets.entropy = true;
      resets.allSlots = true;
      resets.concentration = true;

    } else if (restType === 'short') {
      // Short rest: partial recovery
      if (profile.slotProgression === 'pact' && newCaster.pactSlots) {
        newCaster.pactSlots = {
          ...newCaster.pactSlots,
          used: 0,
        };
        resets.pactSlots = true;
      }

      // Partial entropy decay
      const decayAmount = caster.dailyEntropy - ParadoxEngine.decayEntropy(
        caster.dailyEntropy,
        'short',
        this.difficulty
      );
      newCaster.dailyEntropy = caster.dailyEntropy - decayAmount;
      resets.entropyDecayAmount = decayAmount;
    }

    // Record the rest event as a timeline delta
    const restEvent: RestEvent = {
      type: restEventType,
      characterId: context.characterId,
      worldTimestamp: context.worldTimestamp,
      resets,
      beforeState,
    };

    await recordRestEvent(
      context.campaignId,
      context.sessionId,
      restEvent
    );

    return newCaster;
  }

  /**
   * Handle dawn boundary - called when world time crosses into a new day.
   * This is a system-triggered rest that resets daily resources.
   */
  async onNewDay(
    caster: CasterState,
    context: {
      campaignId: string;
      sessionId?: string;
      characterId: string;
      worldTimestamp: WorldTimestamp;
    }
  ): Promise<CasterState> {
    return this.restWithDelta(caster, 'new_day', context);
  }

  /**
   * Break concentration on a spell.
   */
  breakConcentration(caster: CasterState): CasterState {
    return {
      ...caster,
      concentrating: undefined,
    };
  }

  /**
   * Make a concentration check.
   */
  concentrationCheck(
    caster: CasterState,
    damage: number
  ): { maintained: boolean; roll: number; dc: number } {
    const dc = Math.max(10, Math.floor(damage / 2));

    // Roll: d20 + CON modifier
    // For simplicity, using spellcasting mod (would normally use CON)
    const roll = Math.floor(Math.random() * 20) + 1 + caster.spellcastingMod;

    return {
      maintained: roll >= dc,
      roll,
      dc,
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let spellEngineInstance: SpellEngine | null = null;

/**
 * Get the spell engine singleton.
 */
export function getSpellEngine(difficulty?: DifficultyMode): SpellEngine {
  if (!spellEngineInstance) {
    spellEngineInstance = new SpellEngine(difficulty);
  } else if (difficulty) {
    spellEngineInstance.setDifficulty(difficulty);
  }
  return spellEngineInstance;
}

/**
 * Reset the spell engine (for testing).
 */
export function resetSpellEngine(): void {
  spellEngineInstance = null;
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick cast without full engine setup.
 */
export function quickCast(
  spell: SpellFormula,
  caster: CasterState,
  difficulty: DifficultyMode = 'NORMAL'
): CastResult {
  const engine = getSpellEngine(difficulty);

  // Simple inventory that has everything
  const inventory: InventoryQuery = {
    hasItem: () => true,
    getQuantity: () => 99,
    findSubstitute: () => null,
  };

  return engine.cast(spell, caster, inventory);
}

/**
 * Check spell availability by difficulty.
 */
export function isSpellAvailable(
  _spell: SpellFormula,
  difficulty: DifficultyMode
): boolean {
  // In BRUTAL mode, no spells are available
  // In other modes, all spells are available (subject to cost)
  return magicAvailable(difficulty);
}
