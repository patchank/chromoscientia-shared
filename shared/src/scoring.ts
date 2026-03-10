/**
 * Scoring parameters. Adjust here to change guess and describer bonus rules.
 * Distance is Delta E 2000 (perceptual color difference).
 */

// ——— Guesser points (by rank: 1st, 2nd, 3rd) ———
/** Points for the closest guess (1st place). */
export const GUESS_POINTS_FIRST = 5;

/** Points for 2nd-closest guess. Only awarded when player count ≥ GUESS_MIN_PLAYERS_FOR_SECOND. */
export const GUESS_POINTS_SECOND = 3;

/** Points for 3rd-closest guess. Only awarded when player count ≥ GUESS_MIN_PLAYERS_FOR_THIRD. */
export const GUESS_POINTS_THIRD = 1;

/** Minimum number of players in the game to award 2nd-place points. */
export const GUESS_MIN_PLAYERS_FOR_SECOND = 4;

/** Minimum number of players in the game to award 3rd-place points. */
export const GUESS_MIN_PLAYERS_FOR_THIRD = 6;

// ——— Describer bonus (when a guess is close to the reference) ———
/** If a guess has ΔE below this, the describer gets DESCRIBER_BONUS_POINTS_CLOSE. */
export const DESCRIBER_BONUS_DISTANCE_CLOSE = 7;

/** If a guess has ΔE below this, the describer gets DESCRIBER_BONUS_POINTS_VERY_CLOSE (instead of _CLOSE). */
export const DESCRIBER_BONUS_DISTANCE_VERY_CLOSE = 4;

/** Points granted to the describer when a guess has distance < DESCRIBER_BONUS_DISTANCE_CLOSE (and ≥ VERY_CLOSE). */
export const DESCRIBER_BONUS_POINTS_CLOSE = 2;

/** Points granted to the describer when a guess has distance < DESCRIBER_BONUS_DISTANCE_VERY_CLOSE. */
export const DESCRIBER_BONUS_POINTS_VERY_CLOSE = 5;
