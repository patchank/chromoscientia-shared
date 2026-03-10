/**
 * Color utilities: random hex, hex to Lab, Delta E, and scoring.
 * Uses Delta E 2000 for perceptual distance.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const convert = require("color-convert");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DeltaE = require("delta-e");

export interface LabColor {
  L: number;
  A: number;
  B: number;
}

/**
 * Normalize hex string to 6-char lowercase without #.
 */
function normalizeHex(hex: string): string {
  let h = hex.replace(/^#/, "").toLowerCase();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return h;
}

/**
 * Generate a random color in #000000–#FFFFFF.
 */
export function randomHex(): string {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert hex to Lab. Returns object in delta-e format { L, A, B }.
 */
export function hexToLab(hex: string): LabColor {
  const h = normalizeHex(hex);
  const [L, a, b] = convert.hex.lab.raw(h);
  return { L, A: a, B: b };
}

/**
 * Delta E 2000 between two hex colors.
 */
export function deltaE(hex1: string, hex2: string): number {
  const lab1 = hexToLab(hex1);
  const lab2 = hexToLab(hex2);
  return DeltaE.getDeltaE00(lab1, lab2);
}

export interface RankedGuess {
  playerId: string;
  color: string;
  distance: number;
  points: number;
}

export interface GuessScoringOptions {
  pointsFirst?: number;
  pointsSecond?: number;
  pointsThird?: number;
  minPlayersForSecond?: number;
  minPlayersForThird?: number;
}

const DEFAULT_GUESS_SCORING: Required<GuessScoringOptions> = {
  pointsFirst: 5,
  pointsSecond: 3,
  pointsThird: 1,
  minPlayersForSecond: 4,
  minPlayersForThird: 6,
};

/**
 * Rank guesses by distance to reference, assign points by rank.
 * Defaults: 1st = 5 pts, 2nd = 3 pts (if 4+ players), 3rd = 1 pt (if 6+ players).
 */
export function rankGuessesAndAssignPoints(
  referenceHex: string,
  guesses: Record<string, { color: string }>,
  playerCount: number,
  options?: GuessScoringOptions
): RankedGuess[] {
  const opts = { ...DEFAULT_GUESS_SCORING, ...options };
  const refLab = hexToLab(referenceHex);
  const entries = Object.entries(guesses)
    .filter(([, g]) => g && g.color)
    .map(([playerId, g]) => ({
      playerId,
      color: g.color,
      distance: DeltaE.getDeltaE00(refLab, hexToLab(g.color)),
    }))
    .sort((a, b) => a.distance - b.distance);

  const result: RankedGuess[] = [];
  for (let i = 0; i < entries.length; i++) {
    let points = 0;
    if (i === 0) points = opts.pointsFirst;
    else if (i === 1 && playerCount >= opts.minPlayersForSecond) points = opts.pointsSecond;
    else if (i === 2 && playerCount >= opts.minPlayersForThird) points = opts.pointsThird;
    result.push({
      playerId: entries[i].playerId,
      color: entries[i].color,
      distance: entries[i].distance,
      points,
    });
  }
  return result;
}
