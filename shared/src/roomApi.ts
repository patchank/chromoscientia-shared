import type { FirestoreAdapter } from "./firestoreAdapter";
import {
  randomHex,
  rankGuessesAndAssignPoints,
  allNonDescriberPlayersHaveGuessed,
  getNextTurnState,
  shuffle,
  MIN_PLAYERS,
  MAX_PLAYERS,
  TOTAL_ROUNDS,
  type GameData,
  type Phase,
  type RankedGuess,
} from "@chromoscientia/game-core";
import {
  DESCRIBER_BONUS_DISTANCE_CLOSE,
  DESCRIBER_BONUS_DISTANCE_VERY_CLOSE,
  DESCRIBER_BONUS_POINTS_CLOSE,
  DESCRIBER_BONUS_POINTS_VERY_CLOSE,
  GUESS_MIN_PLAYERS_FOR_SECOND,
  GUESS_MIN_PLAYERS_FOR_THIRD,
  GUESS_POINTS_FIRST,
  GUESS_POINTS_SECOND,
  GUESS_POINTS_THIRD,
} from "./scoring";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_OLD_ROOMS_TO_DELETE = 500;

/** Error message thrown when joining with a nickname already in use. Compare to this in UI to show localized message. */
export const NICKNAME_TAKEN_ERROR = "This nickname is already taken in this room";

export type Unsubscribe = () => void;

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  playerIds: string[];
  playerNames: Record<string, string>;
  status: "waiting" | "playing" | "ended";
  endedByLeave?: boolean;
}

export interface GameSnapshot {
  roomCode: string;
  playerOrder: string[];
  roundIndex: number;
  turnIndex: number;
  phase: Phase;
  referenceColor: string;
  description?: string;
  guesses: Record<string, { color: string; distance?: number; points?: number }>;
  scores: Record<string, number>;
  describerBonus?: number;
  resultsAcknowledgedBy?: string[];
  leaderboardAcknowledgedBy?: string[];
  updatedAt?: unknown;
}

async function deleteOldRoomsAndGames(db: unknown, fs: FirestoreAdapter): Promise<void> {
  const cutoff = fs.Timestamp.fromMillis(Date.now() - ROOM_MAX_AGE_MS);
  const q = fs.query(
    fs.collection(db, "rooms"),
    fs.where("createdAt", "<", cutoff),
    fs.limit(MAX_OLD_ROOMS_TO_DELETE)
  );
  const snapshot = await fs.getDocs(q);
  if (snapshot.empty) return;
  const batch = fs.writeBatch(db);
  for (const d of snapshot.docs) {
    batch.delete(d.ref);
    batch.delete(fs.doc(db, "games", d.id));
  }
  await batch.commit();
}

export interface RoomApi {
  createRoom: (nickname: string) => Promise<string>;
  joinRoom: (code: string, nickname: string) => Promise<void>;
  leaveRoom: (roomCode: string) => Promise<void>;
  endGameForAll: (roomCode: string) => Promise<void>;
  startGame: (roomCode: string) => Promise<void>;
  playAgain: (roomCode: string) => Promise<void>;
  submitDescription: (roomCode: string, description: string) => Promise<void>;
  submitGuess: (roomCode: string, color: string) => Promise<void>;
  advanceToResults: (roomCode: string) => Promise<void>;
  advanceToLeaderboard: (roomCode: string) => Promise<void>;
  acknowledgeResults: (roomCode: string) => Promise<void>;
  advanceTurnOrEnd: (roomCode: string) => Promise<void>;
  acknowledgeLeaderboard: (roomCode: string) => Promise<void>;
  subscribeRoom: (roomCode: string, onUpdate: (data: RoomSnapshot | null) => void) => Unsubscribe;
  subscribeGame: (roomCode: string, onUpdate: (data: GameSnapshot | null) => void) => Unsubscribe;
}

export function createRoomApi(
  getDb: () => unknown,
  getOrCreatePlayerId: () => string,
  firestore: FirestoreAdapter
): RoomApi {
  const fs = firestore;
  const api: RoomApi = {
    async createRoom(nickname: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      await deleteOldRoomsAndGames(db, fs);
      const playerId = getOrCreatePlayerId();
      let code: string;
      let attempts = 0;
      do {
        code = generateRoomCode();
        const ref = fs.doc(db, "rooms", code);
        const snap = await fs.getDoc(ref);
        if (!snap.exists()) {
          await fs.setDoc(ref, {
            code,
            hostId: playerId,
            playerIds: [playerId],
            playerNames: { [playerId]: nickname },
            status: "waiting",
            createdAt: fs.serverTimestamp(),
          });
          return code;
        }
        attempts++;
      } while (attempts < 10);
      throw new Error("Could not generate unique room code");
    },

    async joinRoom(code: string, nickname: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const roomRef = fs.doc(db, "rooms", code.toUpperCase());
      const snap = await fs.getDoc(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const data = snap.data();
      const status = data.status ?? "waiting";
      if (status !== "waiting") throw new Error("Game has already started");
      const playerIds: string[] = (data.playerIds as string[]) ?? [];
      if (playerIds.length >= MAX_PLAYERS) throw new Error("Room is full");
      const playerId = getOrCreatePlayerId();
      if (playerIds.includes(playerId)) return;
      const existingNames = Object.values(data.playerNames ?? {}).map((n) =>
        String(n).trim().toLowerCase()
      );
      const nameLower = nickname.trim().toLowerCase();
      if (existingNames.includes(nameLower)) throw new Error(NICKNAME_TAKEN_ERROR);
      const playerNames = { ...(data.playerNames as Record<string, string> ?? {}), [playerId]: nickname };
      await fs.updateDoc(roomRef, {
        playerIds: [...playerIds, playerId],
        playerNames,
      });
    },

    async leaveRoom(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const roomRef = fs.doc(db, "rooms", roomCode);
      const snap = await fs.getDoc(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const data = snap.data();
      const playerIds: string[] = (data.playerIds as string[]) ?? [];
      const playerId = getOrCreatePlayerId();
      if (!playerIds.includes(playerId)) return;
      const newPlayerIds = playerIds.filter((id) => id !== playerId);
      const playerNames = { ...(data.playerNames as Record<string, string> ?? {}) };
      delete playerNames[playerId];
      if (newPlayerIds.length === 0) {
        await fs.deleteDoc(roomRef);
        return;
      }
      const updates: { playerIds: string[]; playerNames: Record<string, string>; hostId?: string } = {
        playerIds: newPlayerIds,
        playerNames,
      };
      if (data.hostId === playerId) updates.hostId = newPlayerIds[0];
      await fs.updateDoc(roomRef, updates);
    },

    async endGameForAll(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const roomRef = fs.doc(db, "rooms", roomCode);
      const snap = await fs.getDoc(roomRef);
      if (!snap.exists()) return;
      await fs.updateDoc(roomRef, { status: "ended" as const, endedByLeave: true });
    },

    async startGame(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const roomRef = fs.doc(db, "rooms", roomCode);
      const roomSnap = await fs.getDoc(roomRef);
      if (!roomSnap.exists()) throw new Error("Room not found");
      const room = roomSnap.data();
      const playerIds: string[] = (room.playerIds as string[]) ?? [];
      if (playerIds.length < MIN_PLAYERS)
        throw new Error(`Need at least ${MIN_PLAYERS} players`);
      const playerOrder = shuffle(playerIds);
      const gameRef = fs.doc(db, "games", roomCode);
      const initialScores: Record<string, number> = {};
      playerIds.forEach((id) => (initialScores[id] = 0));
      await fs.setDoc(gameRef, {
        roomCode,
        playerOrder,
        roundIndex: 0,
        turnIndex: 0,
        phase: "describe" as Phase,
        referenceColor: randomHex(),
        description: "",
        guesses: {},
        scores: initialScores,
        updatedAt: fs.serverTimestamp(),
      });
      await fs.updateDoc(roomRef, { status: "playing", endedByLeave: false });
    },

    async playAgain(roomCode: string) {
      return api.startGame(roomCode);
    },

    async submitDescription(roomCode: string, description: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const gameRef = fs.doc(db, "games", roomCode);
      await fs.updateDoc(gameRef, {
        description,
        phase: "guess" as Phase,
        updatedAt: fs.serverTimestamp(),
      });
    },

    async submitGuess(roomCode: string, color: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const playerId = getOrCreatePlayerId();
      const gameRef = fs.doc(db, "games", roomCode);
      const snap = await fs.getDoc(gameRef);
      if (!snap.exists()) throw new Error("Game not found");
      const game = snap.data() as unknown as GameData;
      const guesses = { ...(game.guesses ?? {}), [playerId]: { color } };
      await fs.updateDoc(gameRef, { guesses, updatedAt: fs.serverTimestamp() });
    },

    async advanceToResults(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const gameRef = fs.doc(db, "games", roomCode);
      const snap = await fs.getDoc(gameRef);
      if (!snap.exists()) throw new Error("Game not found");
      const game = snap.data() as unknown as GameData;
      if (game.phase !== "guess") return;
      if (!allNonDescriberPlayersHaveGuessed(game)) return;
      const referenceHex = game.referenceColor;
      const guesses = game.guesses ?? {};
      const playerCount = game.playerOrder?.length ?? 0;
      const ranked = rankGuessesAndAssignPoints(referenceHex, guesses, playerCount, {
        pointsFirst: GUESS_POINTS_FIRST,
        pointsSecond: GUESS_POINTS_SECOND,
        pointsThird: GUESS_POINTS_THIRD,
        minPlayersForSecond: GUESS_MIN_PLAYERS_FOR_SECOND,
        minPlayersForThird: GUESS_MIN_PLAYERS_FOR_THIRD,
      });
      const describerId = game.playerOrder?.[game.turnIndex ?? 0] ?? "";
      const newGuesses: Record<string, { color: string; distance: number; points: number }> = {};
      const scores = { ...(game.scores ?? {}) };
      ranked.forEach((r: RankedGuess) => {
        newGuesses[r.playerId] = { color: r.color, distance: r.distance, points: r.points };
        scores[r.playerId] = (scores[r.playerId] ?? 0) + r.points;
      });
      const hasVeryClose = ranked.some((r: RankedGuess) => r.distance < DESCRIBER_BONUS_DISTANCE_VERY_CLOSE);
      const hasClose = ranked.some((r: RankedGuess) => r.distance < DESCRIBER_BONUS_DISTANCE_CLOSE);
      const describerBonusForRound = hasVeryClose
        ? DESCRIBER_BONUS_POINTS_VERY_CLOSE
        : hasClose
          ? DESCRIBER_BONUS_POINTS_CLOSE
          : 0;
      if (describerId && describerBonusForRound > 0) {
        scores[describerId] = (scores[describerId] ?? 0) + describerBonusForRound;
      }
      await fs.updateDoc(gameRef, {
        guesses: newGuesses,
        scores,
        describerBonus: describerBonusForRound,
        phase: "results" as Phase,
        updatedAt: fs.serverTimestamp(),
      });
    },

    async advanceToLeaderboard(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const gameRef = fs.doc(db, "games", roomCode);
      await fs.updateDoc(gameRef, {
        phase: "leaderboard" as Phase,
        resultsAcknowledgedBy: [],
        updatedAt: fs.serverTimestamp(),
      });
    },

    async acknowledgeResults(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const playerId = getOrCreatePlayerId();
      const gameRef = fs.doc(db, "games", roomCode);
      await fs.updateDoc(gameRef, {
        resultsAcknowledgedBy: fs.arrayUnion(playerId),
        updatedAt: fs.serverTimestamp(),
      });
      const snap = await fs.getDoc(gameRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const phase = data.phase as Phase;
      const playerOrder = (data.playerOrder as string[]) ?? [];
      const acknowledged = (data.resultsAcknowledgedBy as string[] | undefined) ?? [];
      const effectiveCount = acknowledged.includes(playerId) ? acknowledged.length : acknowledged.length + 1;
      if (phase === "results" && playerOrder.length > 0 && effectiveCount >= playerOrder.length) {
        await api.advanceToLeaderboard(roomCode);
      }
    },

    async advanceTurnOrEnd(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const gameRef = fs.doc(db, "games", roomCode);
      const roomRef = fs.doc(db, "rooms", roomCode);
      const snap = await fs.getDoc(gameRef);
      if (!snap.exists()) throw new Error("Game not found");
      const game = snap.data() as unknown as GameData;
      const next = getNextTurnState(game);
      if (next.gameOver) {
        await fs.updateDoc(roomRef, { status: "ended" });
        return;
      }
      await fs.updateDoc(gameRef, {
        roundIndex: next.roundIndex,
        turnIndex: next.turnIndex,
        phase: "describe" as Phase,
        referenceColor: randomHex(),
        description: "",
        guesses: {},
        leaderboardAcknowledgedBy: [],
        updatedAt: fs.serverTimestamp(),
      });
    },

    async acknowledgeLeaderboard(roomCode: string) {
      const db = getDb();
      if (!db) throw new Error("Firebase not configured");
      const playerId = getOrCreatePlayerId();
      const gameRef = fs.doc(db, "games", roomCode);
      await fs.updateDoc(gameRef, {
        leaderboardAcknowledgedBy: fs.arrayUnion(playerId),
        updatedAt: fs.serverTimestamp(),
      });
      const snap = await fs.getDoc(gameRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const phase = data.phase as Phase;
      const playerOrder = (data.playerOrder as string[]) ?? [];
      const acknowledged = (data.leaderboardAcknowledgedBy as string[] | undefined) ?? [];
      const effectiveCount = acknowledged.includes(playerId) ? acknowledged.length : acknowledged.length + 1;
      if (phase === "leaderboard" && playerOrder.length > 0 && effectiveCount >= playerOrder.length) {
        await api.advanceTurnOrEnd(roomCode);
      }
    },

    subscribeRoom(roomCode: string, onUpdate: (data: RoomSnapshot | null) => void): Unsubscribe {
      const db = getDb();
      if (!db) {
        onUpdate(null);
        return () => {};
      }
      return fs.onSnapshot(fs.doc(db, "rooms", roomCode), (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        const d = snap.data();
        onUpdate({
          code: (d.code as string) ?? roomCode,
          hostId: (d.hostId as string) ?? "",
          playerIds: (d.playerIds as string[]) ?? [],
          playerNames: (d.playerNames as Record<string, string>) ?? {},
          status: (d.status as "waiting" | "playing" | "ended") ?? "waiting",
          endedByLeave: d.endedByLeave === true,
        });
      });
    },

    subscribeGame(roomCode: string, onUpdate: (data: GameSnapshot | null) => void): Unsubscribe {
      const db = getDb();
      if (!db) {
        onUpdate(null);
        return () => {};
      }
      return fs.onSnapshot(fs.doc(db, "games", roomCode), (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        const d = snap.data();
        onUpdate({
          roomCode: (d.roomCode as string) ?? roomCode,
          playerOrder: (d.playerOrder as string[]) ?? [],
          roundIndex: (d.roundIndex as number) ?? 0,
          turnIndex: (d.turnIndex as number) ?? 0,
          phase: (d.phase as Phase) ?? "describe",
          referenceColor: (d.referenceColor as string) ?? "#000000",
          description: d.description as string | undefined,
          guesses: (d.guesses as GameSnapshot["guesses"]) ?? {},
          scores: (d.scores as Record<string, number>) ?? {},
          describerBonus: d.describerBonus as number | undefined,
          resultsAcknowledgedBy: (d.resultsAcknowledgedBy as string[]) ?? [],
          leaderboardAcknowledgedBy: (d.leaderboardAcknowledgedBy as string[]) ?? [],
          updatedAt: d.updatedAt,
        });
      });
    },
  };
  return api;
}
