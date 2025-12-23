import type { WebSocketClient } from "../server";
import type {
  CombatStartMessage,
  CombatEndMessage,
  CombatTurnMessage,
  CombatActionMessage,
  ParticipantUpdateMessage,
  InitiativeUpdateMessage,
} from "../types";
import { createMessage } from "../types";
import { broadcastToRoom } from "../broadcast";
import {
  getRoomId,
  getOrCreateRoom as createRoom,
  deleteRoom as removeRoom,
} from "../rooms";
import * as combat from "../../db/queries/combat";
import * as sync from "../../db/queries/sync";

// ============================================
// COMBAT HANDLER
// ============================================

/**
 * Handle combat start
 */
export async function handleCombatStart(
  sessionId: string,
  combatId: string,
): Promise<void> {
  const combatData = await combat.getCombat(combatId);
  if (!combatData) return;

  const participants = await combat.getInitiativeOrder(combatId);

  // Create combat room
  await createRoom("combat", combatId, combatData.campaignId);

  const message = createMessage("combat_start", {
    combatId,
    sessionId,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      entityType: p.entityType,
      initiative: p.initiative,
      hp: p.hp,
      maxHp: p.maxHp,
      ac: p.ac,
      isVisible: p.isVisible === 1,
    })),
  });

  broadcastToRoom(getRoomId("session", sessionId), message);

  // Log sync
  await sync.logCombatChange(
    combatData.campaignId,
    sessionId,
    combatId,
    "create",
    { status: "active", participants: participants.length },
  );
}

/**
 * Handle combat end
 */
export async function handleCombatEnd(
  sessionId: string,
  combatId: string,
): Promise<void> {
  const message = createMessage("combat_end", {
    combatId,
    sessionId,
  });

  broadcastToRoom(getRoomId("session", sessionId), message);

  // Remove combat room
  removeRoom(getRoomId("combat", combatId));
}

/**
 * Handle turn change
 */
export async function handleTurnChange(
  combatId: string,
  sessionId: string,
  round: number,
  turnIndex: number,
  participantId: string,
  participantName: string,
): Promise<void> {
  const message = createMessage("combat_turn", {
    combatId,
    round,
    turnIndex,
    currentParticipantId: participantId,
    currentParticipantName: participantName,
  });

  broadcastToRoom(getRoomId("session", sessionId), message);
  broadcastToRoom(getRoomId("combat", combatId), message);
}

/**
 * Handle combat action
 */
export async function handleCombatAction(
  combatId: string,
  sessionId: string,
  action: {
    round: number;
    actorId: string;
    actorName: string;
    actionType: string;
    actionData: Record<string, any>;
    targetIds: string[];
    results: Record<string, any>;
  },
): Promise<void> {
  // Log to combat log
  await combat.logAction(combatId, {
    round: action.round,
    turnIndex: 0,
    actorId: action.actorId,
    actorName: action.actorName,
    actionType: action.actionType,
    actionData: action.actionData,
    targetIds: action.targetIds,
    results: action.results,
  });

  const message = createMessage("combat_action", {
    combatId,
    round: action.round,
    actorId: action.actorId,
    actorName: action.actorName,
    actionType: action.actionType,
    actionData: action.actionData,
    targetIds: action.targetIds,
    results: action.results,
  });

  broadcastToRoom(getRoomId("session", sessionId), message);
}

/**
 * Handle participant HP/condition update
 */
export async function handleParticipantUpdate(
  combatId: string,
  sessionId: string,
  participantId: string,
  changes: {
    hp?: number;
    tempHp?: number;
    conditions?: string[];
    position?: { x: number; y: number };
    isAlive?: boolean;
    isVisible?: boolean;
  },
): Promise<void> {
  const message = createMessage("participant_update", {
    combatId,
    participantId,
    changes,
  });

  broadcastToRoom(getRoomId("session", sessionId), message);
  broadcastToRoom(getRoomId("combat", combatId), message);
}

/**
 * Handle initiative order change
 */
export async function handleInitiativeUpdate(
  combatId: string,
  sessionId: string,
): Promise<void> {
  const order = await combat.getInitiativeOrder(combatId);

  const message = createMessage("initiative_update", {
    combatId,
    order: order.map((p) => ({
      participantId: p.id,
      initiative: p.initiative,
    })),
  });

  broadcastToRoom(getRoomId("session", sessionId), message);
}

/**
 * Broadcast damage to participant
 */
export async function broadcastDamage(
  combatId: string,
  sessionId: string,
  participantId: string,
  amount: number,
  newHp: number,
  maxHp: number,
  isAlive: boolean,
): Promise<void> {
  await handleParticipantUpdate(combatId, sessionId, participantId, {
    hp: newHp,
    isAlive,
  });
}

/**
 * Broadcast healing to participant
 */
export async function broadcastHeal(
  combatId: string,
  sessionId: string,
  participantId: string,
  amount: number,
  newHp: number,
  maxHp: number,
): Promise<void> {
  await handleParticipantUpdate(combatId, sessionId, participantId, {
    hp: newHp,
    isAlive: newHp > 0,
  });
}

/**
 * Broadcast condition change
 */
export async function broadcastConditionChange(
  combatId: string,
  sessionId: string,
  participantId: string,
  conditions: string[],
): Promise<void> {
  await handleParticipantUpdate(combatId, sessionId, participantId, {
    conditions,
  });
}

/**
 * Broadcast position change
 */
export async function broadcastMove(
  combatId: string,
  sessionId: string,
  participantId: string,
  x: number,
  y: number,
): Promise<void> {
  await handleParticipantUpdate(combatId, sessionId, participantId, {
    position: { x, y },
  });
}
