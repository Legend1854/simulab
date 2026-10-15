/** Named constants for the simulation. Other modules import these instead of repeating numbers. */

export const SCHEMA_VERSION = 1;

export const ALLOCATION_TOTAL_PCT = 100;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/** Tolerance for floating-point comparisons in validation (e.g. score weights totalling 100). */
export const FLOAT_TOLERANCE = 1e-9;

/** Relative tolerance when a stored balance is compared with a fresh recalculation. */
export const BALANCE_TOLERANCE = 1e-6;

export const LIMITS = {
  minAssets: 2,
  maxAssets: 8,
  minRiskProfiles: 1,
  maxRiskProfiles: 6,
  minRounds: 1,
  maxRounds: 12,
  maxNameLength: 60,
  maxTitleLength: 80,
  maxTextLength: 400,
  maxLabelLength: 30,
  minReturnPct: -100,
  maxReturnPct: 500,
  maxFeePct: 10,
  maxStartingBalance: 1_000_000_000,
  maxPerformancePointsPerPct: 20,
  maxRiskFitPenalty: 10,
  maxStoredSessions: 50,
} as const;

/** Identifiers used in spreadsheets and storage: lower-case letters, digits and underscores. */
export const ID_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

/** Final rating bands, checked from the highest minimum average score downwards. */
export const RATING_BANDS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 85, label: 'Strategic thinker' },
  { min: 70, label: 'Steady decision-maker' },
  { min: 55, label: 'Developing investor' },
  { min: 0, label: 'Learning in progress' },
];
