import { z } from "zod";
import {
  CombatState,
  CombatStateSchema,
  InitiativeEntry,
  ActionEconomy,
  rollD20,
  RollModifier,
  AdvantageState,
  resolveAttack,
  resolveSavingThrow,
  AttackRoll,
  SavingThrow,
  DamageInstance,
  applyDamage,
  DamageResistance,
  Condition,
  ConditionInstance,
  ConditionEffects,
} from "./core";
import { Creature, getAbilityModifier } from "./creature";
import { Token, GridConfig, Cell, PathResult } from "../grid/types";
import {
  findPath,
  calculateDistance,
  checkLineOfSight,
  calculateAoE,
  AreaOfEffect,
} from "../grid/math";

// ============================================
// COMBAT EVENTS (for logging & UI)
// ============================================

export const CombatEventTypeSchema = z.enum([
  "combat_started",
  "combat_ended",
  "round_started",
  "round_ended",
  "turn_started",
  "turn_ended",
  "initiative_rolled",
  "movement",
  "attack_roll",
  "damage_dealt",
  "healing_received",
  "saving_throw",
  "condition_applied",
  "condition_removed",
  "spell_cast",
  "ability_used",
  "death",
  "death_save",
  "concentration_check",
  "opportunity_attack",
  "reaction_used",
]);
export type CombatEventType = z.infer<typeof CombatEventTypeSchema>;

export const CombatEventSchema = z.object({
  id: z.string().uuid(),
  type: CombatEventTypeSchema,
  timestamp: z.date(),
  round: z.number().int(),

  // Participants
  actorId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  targetIds: z.array(z.string().uuid()).optional(),
  targetNames: z.array(z.string()).optional(),

  // Details
  data: z.record(z.unknown()).optional(),

  // Human-readable
  description: z.string(),

  // For undo/replay
  stateBefore: z.record(z.unknown()).optional(),
  stateAfter: z.record(z.unknown()).optional(),
});
export type CombatEvent = z.infer<typeof CombatEventSchema>;

// ============================================
// COMBAT MANAGER CLASS
// ============================================

export class CombatManager {
  private state: CombatState;
  private creatures: Map<string, Creature>;
  private tokens: Map<string, Token>;
  private cells: Map<string, Cell>;
  private gridConfig: GridConfig;
  private eventLog: CombatEvent[];
  private eventListeners: ((event: CombatEvent) => void)[];

  constructor(
    campaignId: string,
    sessionId: string | undefined,
    gridConfig: GridConfig,
  ) {
    this.state = {
      id: crypto.randomUUID(),
      campaignId,
      sessionId,
      initiativeOrder: [],
      currentIndex: 0,
      round: 1,
      status: "not_started",
      surprisedTokens: [],
      log: [],
    };
    this.creatures = new Map();
    this.tokens = new Map();
    this.cells = new Map();
    this.gridConfig = gridConfig;
    this.eventLog = [];
    this.eventListeners = [];
  }

  // ============================================
  // SETUP
  // ============================================

  addCreature(creature: Creature, token: Token): void {
    this.creatures.set(creature.id, creature);
    this.tokens.set(token.id, token);
  }

  removeCreature(creatureId: string): void {
    this.creatures.delete(creatureId);
    // Find and remove associated token
    for (const [tokenId, token] of this.tokens) {
      if (token.entityId === creatureId) {
        this.tokens.delete(tokenId);
        break;
      }
    }
    // Remove from initiative
    this.state.initiativeOrder = this.state.initiativeOrder.filter(
      (e) => e.entityId !== creatureId,
    );
  }

  setCell(x: number, y: number, cell: Cell): void {
    this.cells.set(`${x},${y}`, cell);
  }

  // ============================================
  // INITIATIVE
  // ============================================

  rollInitiative(
    creatureId: string,
    modifiers: RollModifier[] = [],
    advantage: AdvantageState = "normal",
  ): InitiativeEntry {
    const creature = this.creatures.get(creatureId);
    if (!creature) throw new Error(`Creature ${creatureId} not found`);

    const token = this.getTokenForCreature(creatureId);
    if (!token) throw new Error(`Token for creature ${creatureId} not found`);

    const dexMod = getAbilityModifier(creature.abilityScores.DEX);

    const roll = rollD20(advantage, [
      { source: "DEX", value: dexMod, type: "flat" },
      ...modifiers,
    ]);

    const entry: InitiativeEntry = {
      tokenId: token.id,
      entityId: creature.id,
      name: creature.name,
      roll: roll.total,
      dexMod,
      hasActed: false,
      isDelaying: false,
      actionEconomy: this.createFreshActionEconomy(creature),
    };

    // Add to initiative order
    this.state.initiativeOrder.push(entry);
    this.sortInitiative();

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "initiative_rolled",
      timestamp: new Date(),
      round: this.state.round,
      actorId: creatureId,
      actorName: creature.name,
      data: { roll: roll.total, dexMod },
      description: `${creature.name} rolled ${roll.total} for initiative`,
    });

    return entry;
  }

  rollAllInitiative(): void {
    for (const [id, creature] of this.creatures) {
      // Check if already in initiative
      if (!this.state.initiativeOrder.find((e) => e.entityId === id)) {
        this.rollInitiative(id);
      }
    }
  }

  private sortInitiative(): void {
    this.state.initiativeOrder.sort((a, b) => {
      // Higher initiative first
      if (b.roll !== a.roll) return b.roll - a.roll;
      // Tiebreaker: higher DEX
      return b.dexMod - a.dexMod;
    });
  }

  setInitiative(creatureId: string, value: number): void {
    const entry = this.state.initiativeOrder.find(
      (e) => e.entityId === creatureId,
    );
    if (entry) {
      entry.roll = value;
      this.sortInitiative();
    }
  }

  // ============================================
  // COMBAT FLOW
  // ============================================

  startCombat(): void {
    if (this.state.status !== "not_started") {
      throw new Error("Combat already started");
    }

    this.state.status = "active";
    this.state.startedAt = new Date();
    this.state.round = 1;
    this.state.currentIndex = 0;

    // Reset action economy for all
    for (const entry of this.state.initiativeOrder) {
      const creature = this.creatures.get(entry.entityId);
      if (creature) {
        entry.actionEconomy = this.createFreshActionEconomy(creature);
        entry.hasActed = false;
      }
    }

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "combat_started",
      timestamp: new Date(),
      round: 1,
      description: "Combat has begun!",
    });

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "round_started",
      timestamp: new Date(),
      round: 1,
      description: "Round 1 begins",
    });

    // Start first turn
    this.startCurrentTurn();
  }

  private startCurrentTurn(): void {
    const current = this.getCurrentEntry();
    if (!current) return;

    const creature = this.creatures.get(current.entityId);
    if (!creature) return;

    // Refresh action economy
    current.actionEconomy = this.createFreshActionEconomy(creature);
    current.hasActed = false;

    // Process start-of-turn effects
    this.processStartOfTurnEffects(creature);

    // Check surprise
    const isSurprised = this.state.surprisedTokens.includes(current.tokenId);

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "turn_started",
      timestamp: new Date(),
      round: this.state.round,
      actorId: current.entityId,
      actorName: current.name,
      data: { surprised: isSurprised },
      description: isSurprised
        ? `${current.name}'s turn (SURPRISED - cannot act)`
        : `${current.name}'s turn begins`,
    });
  }

  endTurn(): void {
    const current = this.getCurrentEntry();
    if (!current) return;

    const creature = this.creatures.get(current.entityId);
    if (creature) {
      this.processEndOfTurnEffects(creature);
    }

    current.hasActed = true;

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "turn_ended",
      timestamp: new Date(),
      round: this.state.round,
      actorId: current.entityId,
      actorName: current.name,
      description: `${current.name}'s turn ends`,
    });

    // Move to next
    this.state.currentIndex++;

    // Check for new round
    if (this.state.currentIndex >= this.state.initiativeOrder.length) {
      this.endRound();
    } else {
      this.startCurrentTurn();
    }
  }

  private endRound(): void {
    this.emitEvent({
      id: crypto.randomUUID(),
      type: "round_ended",
      timestamp: new Date(),
      round: this.state.round,
      description: `Round ${this.state.round} ends`,
    });

    // Clear surprise after first round
    if (this.state.round === 1) {
      this.state.surprisedTokens = [];
    }

    // Start new round
    this.state.round++;
    this.state.currentIndex = 0;

    // Refresh legendary actions
    for (const entry of this.state.initiativeOrder) {
      const creature = this.creatures.get(entry.entityId);
      if (creature?.legendaryActions) {
        creature.legendaryActions.remaining = creature.legendaryActions.count;
      }
    }

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "round_started",
      timestamp: new Date(),
      round: this.state.round,
      description: `Round ${this.state.round} begins`,
    });

    this.startCurrentTurn();
  }

  endCombat(): void {
    this.state.status = "ended";
    this.state.endedAt = new Date();

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "combat_ended",
      timestamp: new Date(),
      round: this.state.round,
      description: "Combat has ended",
    });
  }

  // ============================================
  // ACTIONS
  // ============================================

  moveToken(
    tokenId: string,
    targetX: number,
    targetY: number,
  ): { success: boolean; path?: PathResult; reason?: string } {
    const token = this.tokens.get(tokenId);
    if (!token) return { success: false, reason: "Token not found" };

    const creature = this.creatures.get(token.entityId);
    if (!creature) return { success: false, reason: "Creature not found" };

    const entry = this.state.initiativeOrder.find((e) => e.tokenId === tokenId);
    if (!entry) return { success: false, reason: "Not in combat" };

    // Calculate path
    const pathResult = findPath(token.x, token.y, targetX, targetY, {
      gridConfig: this.gridConfig,
      cells: this.cells,
      tokens: Array.from(this.tokens.values()),
      movingToken: token,
      movementType: "walk",
    });

    if (!pathResult.valid) {
      return { success: false, path: pathResult, reason: "No valid path" };
    }

    if (pathResult.movementRequired > entry.actionEconomy.movement) {
      return {
        success: false,
        path: pathResult,
        reason: `Not enough movement (need ${pathResult.movementRequired}, have ${entry.actionEconomy.movement})`,
      };
    }

    // Handle opportunity attacks
    for (const attackerId of pathResult.triggersOpportunityAttacks) {
      this.emitEvent({
        id: crypto.randomUUID(),
        type: "opportunity_attack",
        timestamp: new Date(),
        round: this.state.round,
        actorId: attackerId,
        targetIds: [token.entityId],
        description: `Opportunity attack triggered!`,
      });
    }

    // Execute movement
    token.x = targetX;
    token.y = targetY;
    entry.actionEconomy.movement -= pathResult.movementRequired;

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "movement",
      timestamp: new Date(),
      round: this.state.round,
      actorId: token.entityId,
      actorName: creature.name,
      data: {
        from: { x: pathResult.path[0].x, y: pathResult.path[0].y },
        to: { x: targetX, y: targetY },
        cost: pathResult.movementRequired,
        remaining: entry.actionEconomy.movement,
      },
      description: `${creature.name} moves to (${targetX}, ${targetY})`,
    });

    return { success: true, path: pathResult };
  }

  attack(
    attackerId: string,
    targetId: string,
    attackIndex: number = 0,
    advantage: AdvantageState = "normal",
  ): AttackRoll | null {
    const attacker = this.creatures.get(attackerId);
    const target = this.creatures.get(targetId);
    if (!attacker || !target) return null;

    const attack = attacker.attacks[attackIndex];
    if (!attack) return null;

    const entry = this.state.initiativeOrder.find(
      (e) => e.entityId === attackerId,
    );
    if (!entry || !entry.actionEconomy.action) {
      return null; // No action available
    }

    // Check range
    const attackerToken = this.getTokenForCreature(attackerId);
    const targetToken = this.getTokenForCreature(targetId);
    if (!attackerToken || !targetToken) return null;

    const distance = calculateDistance(
      attackerToken.x,
      attackerToken.y,
      targetToken.x,
      targetToken.y,
      this.gridConfig.type,
      this.gridConfig.scale,
    );

    // Determine if in range
    const reach = attack.reach ?? 5;
    const rangeNormal = attack.range?.normal ?? reach;
    const rangeLong = attack.range?.long;

    if (distance > (rangeLong ?? rangeNormal)) {
      return null; // Out of range
    }

    // Determine advantage/disadvantage from conditions
    const finalAdvantage = this.calculateAdvantage(
      attacker,
      target,
      distance,
      advantage,
    );

    // Calculate target AC
    const targetAC = this.calculateTotalAC(target);

    // Roll the attack
    const result = resolveAttack(
      attack.attackBonus,
      targetAC,
      finalAdvantage,
      attack.damage[0].dice,
      attack.damage[0].type,
    );

    result.attackerId = attackerId;
    result.targetId = targetId;
    result.weaponName = attack.name;

    // Apply damage if hit
    if (result.hit && result.totalDamage) {
      this.applyDamageToCreature(targetId, result.damage!);
    }

    // Consume action
    entry.actionEconomy.action = false;

    // Emit event
    this.emitEvent({
      id: crypto.randomUUID(),
      type: "attack_roll",
      timestamp: new Date(),
      round: this.state.round,
      actorId: attackerId,
      actorName: attacker.name,
      targetIds: [targetId],
      targetNames: [target.name],
      data: result,
      description: result.hit
        ? `${attacker.name} hits ${target.name} with ${attack.name} for ${result.totalDamage} damage!`
        : `${attacker.name} misses ${target.name} with ${attack.name}`,
    });

    return result;
  }

  castSpell(
    casterId: string,
    spellName: string,
    targetIds: string[],
    slotLevel?: number,
  ): boolean {
    const caster = this.creatures.get(casterId);
    if (!caster?.spellcasting) return false;

    const spell = caster.spellcasting.spells.find(
      (s) => s.name.toLowerCase() === spellName.toLowerCase(),
    );
    if (!spell) return false;

    // Check slot availability (if not cantrip)
    if (spell.level > 0) {
      const useLevel = slotLevel ?? spell.level;
      const slot = caster.spellcasting.slots.find(
        (s) => s.level === useLevel && s.used < s.total,
      );
      if (!slot) return false;
      slot.used++;
    }

    // Check action economy
    const entry = this.state.initiativeOrder.find(
      (e) => e.entityId === casterId,
    );
    if (!entry) return false;

    // Most spells use action
    if (
      spell.castingTime.includes("action") &&
      !spell.castingTime.includes("bonus")
    ) {
      if (!entry.actionEconomy.action) return false;
      entry.actionEconomy.action = false;
    } else if (spell.castingTime.includes("bonus")) {
      if (!entry.actionEconomy.bonusAction) return false;
      entry.actionEconomy.bonusAction = false;
    } else if (spell.castingTime.includes("reaction")) {
      if (!entry.actionEconomy.reaction) return false;
      entry.actionEconomy.reaction = false;
    }

    // Handle concentration
    if (spell.concentration) {
      // Drop existing concentration
      const existing = caster.conditions.find(
        (c) => c.condition === "concentrating",
      );
      if (existing) {
        this.removeCondition(casterId, "concentrating");
      }
      this.applyCondition(casterId, {
        condition: "concentrating",
        source: spell.name,
      });
    }

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "spell_cast",
      timestamp: new Date(),
      round: this.state.round,
      actorId: casterId,
      actorName: caster.name,
      targetIds,
      data: { spell: spell.name, level: slotLevel ?? spell.level },
      description: `${caster.name} casts ${spell.name}!`,
    });

    return true;
  }

  // ============================================
  // DAMAGE & HEALING
  // ============================================

  applyDamageToCreature(creatureId: string, damage: DamageInstance[]): number {
    const creature = this.creatures.get(creatureId);
    if (!creature) return 0;

    let totalDamage = 0;

    for (const dmg of damage) {
      // Determine resistance
      let resistance: DamageResistance = "normal";
      if (creature.damageModifiers.immunities.includes(dmg.type)) {
        resistance = "immune";
      } else if (creature.damageModifiers.resistances.includes(dmg.type)) {
        resistance = "resistant";
      } else if (creature.damageModifiers.vulnerabilities.includes(dmg.type)) {
        resistance = "vulnerable";
      }

      const finalDamage = applyDamage(dmg.amount, resistance);
      totalDamage += finalDamage;
    }

    // Apply to temp HP first
    if (creature.hitPoints.temp > 0) {
      const tempAbsorbed = Math.min(creature.hitPoints.temp, totalDamage);
      creature.hitPoints.temp -= tempAbsorbed;
      totalDamage -= tempAbsorbed;
    }

    // Apply to HP
    creature.hitPoints.current = Math.max(
      0,
      creature.hitPoints.current - totalDamage,
    );

    // Check for concentration
    if (creature.conditions.some((c) => c.condition === "concentrating")) {
      this.concentrationCheck(creatureId, totalDamage);
    }

    // Check for death
    if (creature.hitPoints.current === 0) {
      this.handleZeroHP(creatureId);
    }

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "damage_dealt",
      timestamp: new Date(),
      round: this.state.round,
      targetIds: [creatureId],
      targetNames: [creature.name],
      data: { damage, totalDamage, currentHP: creature.hitPoints.current },
      description: `${creature.name} takes ${totalDamage} damage (${creature.hitPoints.current}/${creature.hitPoints.max} HP)`,
    });

    return totalDamage;
  }

  healCreature(
    creatureId: string,
    amount: number,
    temp: boolean = false,
  ): number {
    const creature = this.creatures.get(creatureId);
    if (!creature) return 0;

    if (temp) {
      // Temp HP doesn't stack, take higher
      creature.hitPoints.temp = Math.max(creature.hitPoints.temp, amount);
      return amount;
    }

    const actualHealing = Math.min(
      amount,
      creature.hitPoints.max - creature.hitPoints.current,
    );
    creature.hitPoints.current += actualHealing;

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "healing_received",
      timestamp: new Date(),
      round: this.state.round,
      targetIds: [creatureId],
      targetNames: [creature.name],
      data: { amount: actualHealing, currentHP: creature.hitPoints.current },
      description: `${creature.name} heals ${actualHealing} HP (${creature.hitPoints.current}/${creature.hitPoints.max} HP)`,
    });

    return actualHealing;
  }

  // ============================================
  // CONDITIONS
  // ============================================

  applyCondition(creatureId: string, condition: ConditionInstance): void {
    const creature = this.creatures.get(creatureId);
    if (!creature) return;

    // Check immunity
    if (creature.conditionImmunities.includes(condition.condition)) {
      return;
    }

    // Add condition
    creature.conditions.push(condition);

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "condition_applied",
      timestamp: new Date(),
      round: this.state.round,
      targetIds: [creatureId],
      targetNames: [creature.name],
      data: condition,
      description: `${creature.name} is now ${condition.condition}`,
    });
  }

  removeCondition(creatureId: string, condition: Condition): void {
    const creature = this.creatures.get(creatureId);
    if (!creature) return;

    const index = creature.conditions.findIndex(
      (c) => c.condition === condition,
    );
    if (index !== -1) {
      creature.conditions.splice(index, 1);

      this.emitEvent({
        id: crypto.randomUUID(),
        type: "condition_removed",
        timestamp: new Date(),
        round: this.state.round,
        targetIds: [creatureId],
        targetNames: [creature.name],
        data: { condition },
        description: `${creature.name} is no longer ${condition}`,
      });
    }
  }

  // ============================================
  // SAVING THROWS
  // ============================================

  makeSavingThrow(
    creatureId: string,
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA",
    dc: number,
    advantage: AdvantageState = "normal",
  ): SavingThrow {
    const creature = this.creatures.get(creatureId);
    if (!creature) throw new Error(`Creature ${creatureId} not found`);

    const abilityMod = getAbilityModifier(creature.abilityScores[ability]);
    const profBonus = creature.savingThrows[ability]
      ? creature.proficiencyBonus
      : 0;

    // Check for auto-fail conditions
    const effects = this.getConditionEffects(creature);
    if (
      effects.autoFailStrDexSaves &&
      (ability === "STR" || ability === "DEX")
    ) {
      return {
        targetId: creatureId,
        ability,
        dc,
        advantage: "normal",
        roll: {
          expression: { count: 1, die: "d20", modifier: 0 },
          rolls: [1],
          modifier: 0,
          total: 1,
        },
        success: false,
      };
    }

    const result = resolveSavingThrow(abilityMod + profBonus, dc, advantage);
    result.targetId = creatureId;
    result.ability = ability;

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "saving_throw",
      timestamp: new Date(),
      round: this.state.round,
      actorId: creatureId,
      actorName: creature.name,
      data: result,
      description: `${creature.name} ${result.success ? "succeeds" : "fails"} ${ability} save (${result.roll.total} vs DC ${dc})`,
    });

    return result;
  }

  // ============================================
  // HELPERS
  // ============================================

  getCurrentEntry(): InitiativeEntry | undefined {
    return this.state.initiativeOrder[this.state.currentIndex];
  }

  getState(): CombatState {
    return this.state;
  }

  getCreature(id: string): Creature | undefined {
    return this.creatures.get(id);
  }

  getToken(id: string): Token | undefined {
    return this.tokens.get(id);
  }

  getTokenForCreature(creatureId: string): Token | undefined {
    for (const token of this.tokens.values()) {
      if (token.entityId === creatureId) return token;
    }
    return undefined;
  }

  private createFreshActionEconomy(creature: Creature): ActionEconomy {
    return {
      action: true,
      bonusAction: true,
      reaction: true,
      movement: creature.speed.walk,
      freeInteraction: true,
    };
  }

  private calculateTotalAC(creature: Creature): number {
    const dexMod = getAbilityModifier(creature.abilityScores.DEX);
    let ac = creature.armorClass.base + creature.armorClass.shieldBonus;

    switch (creature.armorClass.armorType) {
      case "none":
      case "light":
        ac += dexMod;
        break;
      case "medium":
        ac += Math.min(dexMod, 2);
        break;
      case "natural":
        ac += creature.armorClass.dexBonus ?? dexMod;
        break;
    }

    ac += creature.armorClass.otherBonuses.reduce((s, b) => s + b.value, 0);

    return ac;
  }

  private calculateAdvantage(
    attacker: Creature,
    target: Creature,
    distance: number,
    baseAdvantage: AdvantageState,
  ): AdvantageState {
    let advantageCount = baseAdvantage === "advantage" ? 1 : 0;
    let disadvantageCount = baseAdvantage === "disadvantage" ? 1 : 0;

    // Attacker conditions
    for (const cond of attacker.conditions) {
      const effects = ConditionEffects[cond.condition];
      if (effects?.attacksDisadvantage) disadvantageCount++;
    }

    // Target conditions
    for (const cond of target.conditions) {
      const effects = ConditionEffects[cond.condition];
      if (effects?.attacksAgainstAdvantage) advantageCount++;

      // Prone: melee = advantage, ranged = disadvantage
      if (cond.condition === "prone") {
        if (distance <= 5) advantageCount++;
        else disadvantageCount++;
      }
    }

    // Invisible attacker
    if (attacker.conditions.some((c) => c.condition === "invisible")) {
      advantageCount++;
    }

    // Invisible target
    if (target.conditions.some((c) => c.condition === "invisible")) {
      disadvantageCount++;
    }

    // Advantage and disadvantage cancel
    if (advantageCount > 0 && disadvantageCount > 0) return "normal";
    if (advantageCount > 0) return "advantage";
    if (disadvantageCount > 0) return "disadvantage";
    return "normal";
  }

  private getConditionEffects(creature: Creature): {
    cantMove: boolean;
    cantTakeActions: boolean;
    cantTakeReactions: boolean;
    autoFailStrDexSaves: boolean;
  } {
    const result = {
      cantMove: false,
      cantTakeActions: false,
      cantTakeReactions: false,
      autoFailStrDexSaves: false,
    };

    for (const cond of creature.conditions) {
      const effects = ConditionEffects[cond.condition];
      if (effects?.cantMove) result.cantMove = true;
      if (effects?.cantTakeActions) result.cantTakeActions = true;
      if (effects?.cantTakeReactions) result.cantTakeReactions = true;
      if (effects?.autoFailStrDexSaves) result.autoFailStrDexSaves = true;
    }

    return result;
  }

  private concentrationCheck(creatureId: string, damage: number): void {
    const dc = Math.max(10, Math.floor(damage / 2));
    const result = this.makeSavingThrow(creatureId, "CON", dc);

    if (!result.success) {
      this.removeCondition(creatureId, "concentrating");
      const creature = this.creatures.get(creatureId);

      this.emitEvent({
        id: crypto.randomUUID(),
        type: "concentration_check",
        timestamp: new Date(),
        round: this.state.round,
        actorId: creatureId,
        actorName: creature?.name,
        data: { dc, roll: result.roll.total, success: false },
        description: `${creature?.name} loses concentration!`,
      });
    }
  }

  private handleZeroHP(creatureId: string): void {
    const creature = this.creatures.get(creatureId);
    if (!creature) return;

    // For monsters: death
    // For PCs: unconscious + death saves
    // This is simplified - full implementation would check creature type

    this.applyCondition(creatureId, { condition: "unconscious" });

    this.emitEvent({
      id: crypto.randomUUID(),
      type: "death",
      timestamp: new Date(),
      round: this.state.round,
      targetIds: [creatureId],
      targetNames: [creature.name],
      description: `${creature.name} falls unconscious!`,
    });
  }

  private processStartOfTurnEffects(creature: Creature): void {
    // Process conditions that end at start of turn
    const toRemove: Condition[] = [];

    for (const cond of creature.conditions) {
      if (cond.endTrigger === "start_of_turn") {
        if (cond.duration !== undefined) {
          cond.duration--;
          if (cond.duration <= 0) {
            toRemove.push(cond.condition);
          }
        }
      }
    }

    for (const cond of toRemove) {
      this.removeCondition(creature.id, cond);
    }

    // Recharge abilities
    for (const feature of creature.features) {
      if (feature.recharge && !feature.recharge.recharged) {
        const roll = Math.floor(Math.random() * 6) + 1;
        if (roll >= feature.recharge.min) {
          feature.recharge.recharged = true;
        }
      }
    }
  }

  private processEndOfTurnEffects(creature: Creature): void {
    // Process conditions that allow saves at end of turn
    for (const cond of creature.conditions) {
      if (cond.endTrigger === "save" && cond.saveDC && cond.saveAbility) {
        const result = this.makeSavingThrow(
          creature.id,
          cond.saveAbility,
          cond.saveDC,
        );
        if (result.success) {
          this.removeCondition(creature.id, cond.condition);
        }
      }

      if (cond.endTrigger === "end_of_turn" && cond.duration !== undefined) {
        cond.duration--;
        if (cond.duration <= 0) {
          this.removeCondition(creature.id, cond.condition);
        }
      }
    }
  }

  // ============================================
  // EVENT SYSTEM
  // ============================================

  addEventListener(listener: (event: CombatEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: CombatEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: CombatEvent): void {
    this.eventLog.push(event);
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  getEventLog(): CombatEvent[] {
    return [...this.eventLog];
  }
}
