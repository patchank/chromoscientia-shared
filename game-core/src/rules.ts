/**
 * Pure game rules. No Firebase, no platform APIs.
 */

import type { Game, GameData, NextTurnState, PlayerId } from "./types";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const TOTAL_ROUNDS = 3;

/**
 * Current describer's player id (from playerOrder[turnIndex]).
 */
export function getCurrentDescriberId(game: Game | GameData): PlayerId {
  const order = game.playerOrder;
  const idx = game.turnIndex;
  if (idx < 0 || idx >= order.length) return order[0] ?? "";
  return order[idx];
}

/**
 * True if the given player is the current describer (and thus should see Describe screen).
 */
export function isDescriber(game: Game | GameData, playerId: PlayerId): boolean {
  return getCurrentDescriberId(game) === playerId;
}

/**
 * True when every player except the current describer has submitted a guess.
 */
export function allNonDescriberPlayersHaveGuessed(
  game: Game | GameData
): boolean {
  const describerId = getCurrentDescriberId(game);
  const order = game.playerOrder;
  const guessers = order.filter((id) => id !== describerId);
  const guesses = game.guesses ?? {};
  return guessers.every((id) => guesses[id]?.color != null);
}

/**
 * Compute the next turn/round state after leaderboard.
 * If game has more turns: next turnIndex (and possibly next round). Else game over.
 */
export function getNextTurnState(
  game: Game | GameData
): NextTurnState {
  const order = game.playerOrder;
  let turnIndex = game.turnIndex + 1;
  let roundIndex = game.roundIndex;

  if (turnIndex >= order.length) {
    turnIndex = 0;
    roundIndex += 1;
  }

  const gameOver = roundIndex >= TOTAL_ROUNDS;
  return {
    gameOver,
    roundIndex: gameOver ? game.roundIndex : roundIndex,
    turnIndex: gameOver ? game.turnIndex : turnIndex,
  };
}

/**
 * Shuffle array (Fisher–Yates). Used for initial playerOrder.
 */
export function shuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
