import type { WebSocketClient } from "../server";
import type { DiceRollMessage } from "../types";
import { createMessage } from "../types";
import { broadcastToRoom, getClientsInRoom } from "../broadcast";
import { getRoomId } from "../rooms";
import * as sessions from "../../db/queries/sessions";

// ============================================
// DICE HANDLER
// ============================================

export interface DiceRollOptions {
  sessionId: string;
  rollerId: string;
  rollerName: string;
  rollerType: "player" | "gm" | "npc";
  expression: string;
  result: number;
  breakdown: string;
  purpose?: string;
  isPrivate?: boolean;
}

/**
 * Handle incoming dice roll
 */
export async function handleDiceRoll(
  client: WebSocketClient,
  message: DiceRollMessage,
): Promise<void> {
  const { sessionId, isPrivate } = message.payload;

  // Log to database
  await sessions.logDiceRoll(
    sessionId,
    message.payload.rollerId,
    message.payload.rollerName,
    message.payload.rollerType,
    {
      expression: message.payload.expression,
      result: message.payload.result,
      breakdown: message.payload.breakdown,
      purpose: message.payload.purpose,
    },
  );

  if (isPrivate) {
    // Only send to GMs and the roller
    const roomId = getRoomId("session", sessionId);
    const clients = getClientsInRoom(roomId);

    for (const targetClient of clients) {
      const isGM = targetClient.role === "gm" || targetClient.role === "owner";
      const isRoller = targetClient.id === client.id;

      if (isGM || isRoller) {
        targetClient.send(message);
      }
    }
  } else {
    // Broadcast to entire session
    broadcastToRoom(getRoomId("session", sessionId), message);
  }
}

/**
 * Broadcast a dice roll result
 */
export function broadcastDiceRoll(options: DiceRollOptions): void {
  const message = createMessage("dice_roll", {
    sessionId: options.sessionId,
    rollerId: options.rollerId,
    rollerName: options.rollerName,
    rollerType: options.rollerType,
    expression: options.expression,
    result: options.result,
    breakdown: options.breakdown,
    purpose: options.purpose,
    isPrivate: options.isPrivate || false,
  });

  if (options.isPrivate) {
    // Only to GMs
    const roomId = getRoomId("session", options.sessionId);
    const clients = getClientsInRoom(roomId);

    for (const client of clients) {
      if (client.role === "gm" || client.role === "owner") {
        client.send(message);
      }
    }
  } else {
    broadcastToRoom(getRoomId("session", options.sessionId), message);
  }
}

/**
 * Parse dice expression and roll
 */
export function rollDice(expression: string): {
  result: number;
  breakdown: string;
  rolls: number[];
} {
  // Simple dice roller: supports NdM+X format
  const match = expression.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);

  if (!match) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }

  const count = parseInt(match[1] || "1", 10);
  const sides = parseInt(match[2], 10);
  const modifier = parseInt(match[3] || "0", 10);

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const sum = rolls.reduce((a, b) => a + b, 0);
  const result = sum + modifier;

  let breakdown = `[${rolls.join(", ")}]`;
  if (modifier !== 0) {
    breakdown += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  }
  breakdown += ` = ${result}`;

  return { result, breakdown, rolls };
}

/**
 * Roll and broadcast in one call
 */
export async function rollAndBroadcast(
  sessionId: string,
  rollerId: string,
  rollerName: string,
  rollerType: "player" | "gm" | "npc",
  expression: string,
  purpose?: string,
  isPrivate = false,
): Promise<{ result: number; breakdown: string }> {
  const { result, breakdown } = rollDice(expression);

  await sessions.logDiceRoll(sessionId, rollerId, rollerName, rollerType, {
    expression,
    result,
    breakdown,
    purpose,
  });

  broadcastDiceRoll({
    sessionId,
    rollerId,
    rollerName,
    rollerType,
    expression,
    result,
    breakdown,
    purpose,
    isPrivate,
  });

  return { result, breakdown };
}
