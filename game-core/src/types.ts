/**
 * Shared types for Chromoscientia. Matches Firestore document shape.
 */

export type Phase = "describe" | "guess" | "results" | "leaderboard";
export type RoomStatus = "waiting" | "playing" | "ended";

export type PlayerId = string;

export interface GuessEntry {
  color: string; // hex
  distance?: number;
  points?: number;
}

export interface Room {
  code: string;
  hostId: PlayerId;
  playerIds: PlayerId[];
  playerNames: Record<PlayerId, string>;
  status: RoomStatus;
  createdAt: { toMillis: () => number } | { seconds: number };
}

export interface Game {
  roomCode: string;
  playerOrder: PlayerId[];
  roundIndex: number;
  turnIndex: number;
  phase: Phase;
  referenceColor: string; // hex
  description?: string;
  guesses: Record<PlayerId, GuessEntry>;
  scores: Record<PlayerId, number>;
  updatedAt: { toMillis: () => number } | { seconds: number };
}

export interface GameData {
  roomCode: string;
  playerOrder: PlayerId[];
  roundIndex: number;
  turnIndex: number;
  phase: Phase;
  referenceColor: string;
  description?: string;
  guesses: Record<PlayerId, GuessEntry>;
  scores: Record<PlayerId, number>;
  updatedAt?: unknown;
}

export interface NextTurnState {
  gameOver: boolean;
  roundIndex: number;
  turnIndex: number;
}
